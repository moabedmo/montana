'use strict';

const { trackShipping } = require('../lib/shipping');
const { setCors, sendJson, checkAdmin } = require('../lib/http');

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

  if (req.method !== 'GET') {
    sendJson(res, 405, { error: 'Method not allowed' });
    return;
  }

  try {
    var trackingId = (req.query && req.query.id) || (req.query && req.query.tracking_id);
    if (!trackingId) {
      sendJson(res, 400, { error: 'tracking id is required (?id=...)' });
      return;
    }
    var result = await trackShipping(String(trackingId));
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
    console.error('[api/shipping/track]', err);
    sendJson(res, 500, { error: err.message || 'Tracking failed' });
  }
}

module.exports = handler;
