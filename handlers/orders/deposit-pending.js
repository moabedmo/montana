'use strict';

const { listPendingProofs } = require('../../lib/deposit-store');
const { setCors, sendJson, checkAdminPanel } = require('../../lib/http');

async function handler(req, res) {
  setCors(res);

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }

  var auth = checkAdminPanel(req, null, { allowTelegramToken: true });
  if (!auth.ok) {
    sendJson(res, 401, { ok: false, error: auth.error });
    return;
  }

  if (req.method !== 'GET') {
    sendJson(res, 405, { ok: false, error: 'Method not allowed' });
    return;
  }

  try {
    var proofs = await listPendingProofs(30);
    sendJson(res, 200, { ok: true, proofs: proofs });
  } catch (err) {
    console.error('[api/orders/deposit-pending]', err);
    sendJson(res, 500, { ok: false, error: err.message || 'Internal server error' });
  }
}

module.exports = handler;
