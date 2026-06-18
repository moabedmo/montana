'use strict';

const { sendTelegramPhoto, resolveTelegramConfig, registerTelegramWebhook } = require('../../lib/telegram');
const { createProof } = require('../../lib/deposit-proofs');
const { setCors, sendJson, readJsonBody } = require('../../lib/http');

function buildCaption(body, proofId) {
  var amount = Number(process.env.ORDER_DEPOSIT_AMOUNT) || 200;
  var lines = [
    '💰 عربون ' + amount + ' جنيه — Montana',
    'المصدر: ' + (body.source === 'shop' ? 'المتجر' : 'الشات'),
    'الاسم: ' + (body.name || '—'),
    'الموبايل: ' + (body.phone || '—'),
    'العنوان: ' + (body.address || '—')
  ];
  if (body.itemsSummary) lines.push('المنتجات: ' + body.itemsSummary);
  if (body.total != null) lines.push('إجمالي الأوردر: ' + body.total + ' جنيه');
  lines.push('👇 اضغطي «✅ موافقة» أو ردّي «تم» على الصورة');
  return lines.join('\n').slice(0, 1024);
}

function buildApproveKeyboard(proofId) {
  return {
    inline_keyboard: [[
      { text: '✅ موافقة', callback_data: 'approve:' + proofId }
    ]]
  };
}

async function ensureWebhook(token) {
  try {
    var result = await registerTelegramWebhook(token);
    if (!result.ok) console.warn('[deposit-proof] webhook:', result.error);
  } catch (e) {
    console.warn('[deposit-proof] webhook:', e.message);
  }
}

async function handler(req, res) {
  setCors(res);

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }

  if (req.method !== 'POST') {
    sendJson(res, 405, { ok: false, error: 'Method not allowed' });
    return;
  }

  try {
    var body = await readJsonBody(req);
    var image = body.image || body.photo;
    if (!image || !String(image).includes('base64')) {
      sendJson(res, 400, { ok: false, error: 'ارفعي صورة التحويل' });
      return;
    }

    var cfg = resolveTelegramConfig();
    if (!cfg.token || !cfg.chatId) {
      sendJson(res, 503, {
        ok: false,
        error: 'Telegram غير مضبوط على السيرفر — ضيفي TELEGRAM_BOT_TOKEN و TELEGRAM_CHAT_ID في Vercel'
      });
      return;
    }

    var proofId = 'dp_' + Date.now();
    var caption = buildCaption(body, proofId);
    var keyboard = buildApproveKeyboard(proofId);
    var photo = await sendTelegramPhoto(cfg.token, cfg.chatId, image, caption, keyboard);
    if (!photo.ok) {
      sendJson(res, 502, { ok: false, error: photo.error || 'فشل إرسال الصورة لتليجرام' });
      return;
    }

    var messageId = photo.data && photo.data.message_id;
    await createProof({
      id: proofId,
      source: body.source,
      name: body.name,
      phone: body.phone,
      address: body.address,
      itemsSummary: body.itemsSummary,
      total: body.total,
      telegramMessageId: messageId,
      telegramChatId: cfg.chatId
    });

    await ensureWebhook(cfg.token);

    sendJson(res, 200, {
      ok: true,
      proofId: proofId,
      status: 'pending',
      message: 'تم إرسال صورة التحويل — في انتظار موافقة المسؤول'
    });
  } catch (err) {
    console.error('[api/orders/deposit-proof]', err);
    var msg = err.message || 'Internal server error';
    if (/relation.*deposit_proofs|does not exist/i.test(msg)) {
      msg = 'جدول deposit_proofs مش موجود — شغّلي migration 003 في Supabase SQL Editor';
    } else if (/SUPABASE|supabase/i.test(msg)) {
      msg = 'Supabase مش مضبوط — ضيفي SUPABASE_URL و SUPABASE_SERVICE_ROLE_KEY في Vercel';
    }
    sendJson(res, 500, { ok: false, error: msg });
  }
}

module.exports = handler;
