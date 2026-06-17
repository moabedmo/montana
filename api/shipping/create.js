'use strict';

const { createShippingOrder } = require('../lib/shipping');
const { setCors, sendJson, readJsonBody, checkAdmin } = require('../lib/http');

async function handler(req, res) {
  setCors(res);

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }

  if (!checkAdmin(req)) {
    sendJson(res, 401, { error: 'Unauthorized' });
    return;
  }

  if (req.method !== 'POST') {
    sendJson(res, 405, { error: 'Method not allowed' });
    return;
  }

  try {
    var body = await readJsonBody(req);
    var result = await createShippingOrder(body);
    if (!result.ok) {
      sendJson(res, 400, result);
      return;
    }
    sendJson(res, 200, result);
  } catch (err) {
    if (err.message === 'Shipping provider is not connected') {
      sendJson(res, 503, { ok: false, error: err.message });
      return;
    }
    console.error('[api/shipping/create]', err);
    sendJson(res, 500, { error: err.message || 'Create shipment failed' });
  }
}

module.exports = handler;
