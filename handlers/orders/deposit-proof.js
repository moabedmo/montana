'use strict';

const { sendTelegramPhoto, sendTelegramMessage, resolveTelegramConfig } = require('../../lib/telegram');
const { setCors, sendJson, readJsonBody } = require('../../lib/http');

function buildCaption(body) {
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
  lines.push('⏳ في انتظار تأكيد العميل');
  return lines.join('\n').slice(0, 1024);
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

    var caption = buildCaption(body);
    var photo = await sendTelegramPhoto(cfg.token, cfg.chatId, image, caption);
    if (!photo.ok) {
      sendJson(res, 502, { ok: false, error: photo.error || 'فشل إرسال الصورة لتليجرام' });
      return;
    }

    sendJson(res, 200, {
      ok: true,
      proofId: 'dp_' + Date.now(),
      message: 'تم إرسال صورة التحويل للمسؤول'
    });
  } catch (err) {
    console.error('[api/orders/deposit-proof]', err);
    sendJson(res, 500, { ok: false, error: err.message || 'Internal server error' });
  }
}

module.exports = handler;
