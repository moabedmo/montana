'use strict';

const { sendTelegramMessage, resolveTelegramConfig } = require('../../lib/telegram');
const { setCors, sendJson, readJsonBody } = require('../../lib/http');

function buildOrderMessage(body) {
  var o = body.order || body;
  var name = o.name || (o.customer && o.customer.name) || '—';
  var phone = o.phone || (o.customer && o.customer.phone) || '—';
  var address = o.address || (o.customer && o.customer.address) || '—';
  var lines = [
    '✅ تأكيد أوردر #' + (o.id || '—') + ' — Montana',
    'المصدر: ' + (o.source === 'shop' ? 'المتجر' : 'الشات'),
    'الاسم: ' + name,
    'الموبايل: ' + phone,
    'العنوان: ' + address
  ];
  if (o.items && o.items.length) {
    lines.push('المنتجات: ' + o.items.map(function (i) {
      return i.name + ' x' + (i.qty || 1);
    }).join(', '));
  }
  if (o.total != null) lines.push('الإجمالي: ' + o.total + ' جنيه');
  if (o.depositAmount) lines.push('تأكيد الحجز: ' + o.depositAmount + ' جنيه ✓');
  if (o.time) lines.push('الوقت: ' + o.time);
  return lines.join('\n');
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
    var cfg = resolveTelegramConfig();
    if (!cfg.token || !cfg.chatId) {
      sendJson(res, 503, { ok: false, error: 'Telegram غير مضبوط على السيرفر' });
      return;
    }

    var msg = buildOrderMessage(body);
    var result = await sendTelegramMessage(cfg.token, cfg.chatId, msg);
    if (!result.ok) {
      sendJson(res, 502, { ok: false, error: result.error || 'فشل الإرسال' });
      return;
    }

    sendJson(res, 200, { ok: true, message: 'تم إرسال الأوردر لتليجرام' });
  } catch (err) {
    console.error('[api/orders/notify]', err);
    sendJson(res, 500, { ok: false, error: err.message || 'Internal server error' });
  }
}

module.exports = handler;
