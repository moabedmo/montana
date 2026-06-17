'use strict';

const { calculateShippingCost } = require('../../lib/shipping');
const { setCors, sendJson, readJsonBody } = require('../../lib/http');

async function handler(req, res) {
  setCors(res);

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }

  if (req.method !== 'POST') {
    sendJson(res, 405, { error: 'Method not allowed' });
    return;
  }

  try {
    var body = await readJsonBody(req);
    var result = await calculateShippingCost(body);
    if (!result.ok) {
      sendJson(res, 400, result);
      return;
    }
    sendJson(res, 200, result);
  } catch (err) {
    if (err.message === 'Shipping provider is not connected') {
      sendJson(res, 503, { ok: false, error: err.message, fallback: true });
      return;
    }
    console.error('[api/shipping/calculate]', err);
    sendJson(res, 500, { error: err.message || 'Calculation failed' });
  }
}

module.exports = handler;
