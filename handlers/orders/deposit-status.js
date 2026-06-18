'use strict';

const { getProof } = require('../../lib/deposit-proofs');
const { setCors, sendJson } = require('../../lib/http');

async function handler(req, res) {
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

  try {
    var proofId = String((req.query && req.query.proofId) || '').trim();
    if (!proofId) {
      sendJson(res, 400, { ok: false, error: 'proofId مطلوب' });
      return;
    }

    var proof = await getProof(proofId);
    if (!proof) {
      sendJson(res, 404, { ok: false, error: 'طلب التحويل غير موجود' });
      return;
    }

    sendJson(res, 200, {
      ok: true,
      proofId: proof.id,
      status: proof.status || 'pending',
      approved: proof.status === 'approved'
    });
  } catch (err) {
    console.error('[api/orders/deposit-status]', err);
    sendJson(res, 500, { ok: false, error: err.message || 'Internal server error' });
  }
}

module.exports = handler;
