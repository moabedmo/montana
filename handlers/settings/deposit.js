'use strict';

const { setCors, sendJson } = require('../../lib/http');

function handler(req, res) {
  setCors(res);

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }

  if (req.method !== 'GET') {
    sendJson(res, 405, { ok: false, error: 'Method not allowed' });
    return;
  }

  var amount = Number(process.env.ORDER_DEPOSIT_AMOUNT) || 200;
  var infoAr = process.env.DEPOSIT_PAYMENT_INFO_AR ||
    'حوّلي 200 جنيه رسوم تأكيد حجز (فودافون كاش أو InstaPay) وارفعي صورة التحويل قبل تأكيد الأوردر. المبلغ بيتخصم من الإجمالي.';
  var infoEn = process.env.DEPOSIT_PAYMENT_INFO_EN ||
    'Transfer 200 EGP deposit (Vodafone Cash or InstaPay) — upload proof before confirming your order.';

  sendJson(res, 200, {
    ok: true,
    amount: amount,
    paymentInfo: { ar: infoAr, en: infoEn }
  });
}

module.exports = handler;
