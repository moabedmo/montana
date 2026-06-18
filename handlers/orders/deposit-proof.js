'use strict';

const { sendTelegramPhoto, resolveTelegramConfig, setTelegramWebhook } = require('../../lib/telegram');
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
  lines.push('🆔 ' + proofId);
  lines.push('👇 ردّي «تم» على الصورة دي لتفعيل زر تأكيد الأوردر للعميل');
  return lines.join('\n').slice(0, 1024);
}

async function ensureWebhook(token) {
  var url = String(process.env.TELEGRAM_WEBHOOK_URL || '').trim();
  if (!url) return;
  try {
    await setTelegramWebhook(token, url);
  } catch (e) {
    console.warn('[deposit-proof] setWebhook:', e.message);
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
    var photo = await sendTelegramPhoto(cfg.token, cfg.chatId, image, caption);
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
    if (/SUPABASE|supabase/i.test(msg)) {
      msg = 'لازم Supabase يكون مضبوط — شغّلي migration 003_deposit_proofs.sql';
    }
    sendJson(res, 500, { ok: false, error: msg });
  }
}

module.exports = handler;
