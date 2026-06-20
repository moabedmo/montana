'use strict';

const { approveByProofId } = require('../../lib/deposit-proofs');
const { setCors, sendJson, readJsonBody, checkAdmin, checkAdminPanel } = require('../../lib/http');

function checkApproveKey(req) {
  var expected = String(process.env.MONTANA_ADMIN_API_KEY || process.env.DEPOSIT_APPROVE_SECRET || '').trim();
  if (!expected) return checkAdmin(req);
  var key = (req.query && req.query.key) || req.headers['x-admin-key'];
  return String(key || '') === expected || checkAdmin(req);
}

async function handler(req, res) {
  setCors(res);

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }

  if (req.method === 'POST') {
    var body = await readJsonBody(req);
    var auth = checkAdminPanel(req, body, { allowTelegramToken: true });
    if (!auth.ok) {
      sendJson(res, 401, { ok: false, error: auth.error });
      return;
    }
    try {
      var proofId = String(body.proofId || body.id || '').trim();
      if (!proofId) {
        sendJson(res, 400, { ok: false, error: 'proofId مطلوب' });
        return;
      }
      var proof = await approveByProofId(proofId);
      if (!proof) {
        sendJson(res, 404, { ok: false, error: 'طلب التحويل غير موجود' });
        return;
      }
      sendJson(res, 200, { ok: true, proof: proof, message: 'تمت الموافقة' });
    } catch (err) {
      console.error('[api/orders/deposit-approve POST]', err);
      sendJson(res, 500, { ok: false, error: err.message || 'Internal server error' });
    }
    return;
  }

  if (req.method !== 'GET') {
    sendJson(res, 405, { ok: false, error: 'Method not allowed' });
    return;
  }

  if (!checkApproveKey(req)) {
    sendJson(res, 401, { ok: false, error: 'Unauthorized' });
    return;
  }

  try {
    var qProofId = String((req.query && req.query.proofId) || '').trim();
    if (!qProofId) {
      sendJson(res, 400, { ok: false, error: 'proofId مطلوب' });
      return;
    }

    var approved = await approveByProofId(qProofId);
    if (!approved) {
      sendJson(res, 404, { ok: false, error: 'طلب التحويل غير موجود' });
      return;
    }

    res.statusCode = 200;
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.end(
      '<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="utf-8">' +
      '<meta name="viewport" content="width=device-width,initial-scale=1">' +
      '<title>Montana — تمت الموافقة</title></head><body style="font-family:sans-serif;text-align:center;padding:40px 20px;background:#1a1030;color:#fff">' +
      '<h1 style="color:#10B981">✅ تمت الموافقة</h1>' +
      '<p>العميل <strong>' + String(approved.name || '').replace(/[<>&"]/g, function (c) { return '&#' + c.charCodeAt(0) + ';'; }) + '</strong> يقدر يأكّد الأوردر دلوقتي.</p>' +
      '</body></html>'
    );
  } catch (err) {
    console.error('[api/orders/deposit-approve]', err);
    sendJson(res, 500, { ok: false, error: err.message || 'Internal server error' });
  }
}

module.exports = handler;
