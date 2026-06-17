'use strict';

const { getShippingSettings, saveShippingSettings } = require('../lib/shipping');
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

  try {
    if (req.method === 'GET') {
      var includeKey = req.headers['x-include-tokens'] === '1';
      var settings = await getShippingSettings(includeKey);
      sendJson(res, 200, { ok: true, settings: settings });
      return;
    }

    if (req.method === 'POST') {
      var body = await readJsonBody(req);
      var result = await saveShippingSettings(body);
      if (!result.ok) {
        sendJson(res, 400, { ok: false, error: result.error });
        return;
      }
      var saved = await getShippingSettings(true);
      sendJson(res, 200, {
        ok: true,
        message: 'Shipping connected — ' + (body.company_name || 'provider'),
        status: result.status,
        test: result.test,
        settings: saved
      });
      return;
    }

    sendJson(res, 405, { error: 'Method not allowed' });
  } catch (err) {
    console.error('[api/settings/shipping]', err);
    sendJson(res, 500, { error: err.message || 'Internal server error' });
  }
}

module.exports = handler;
