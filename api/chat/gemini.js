'use strict';

const { resolveGeminiKey, validateKeyFormat, callGeminiApi } = require('../lib/gemini');
const { setCors, sendJson, readJsonBody } = require('../lib/http');

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
    const body = await readJsonBody(req);
    const key = resolveGeminiKey();
    const check = validateKeyFormat(key);

    if (!check.ok) {
      sendJson(res, 503, { ok: false, error: check.error, code: 'KEY_INVALID' });
      return;
    }

    const result = await callGeminiApi(check.key, body);
    if (!result.ok) {
      const msg = (result.data && result.data.error && result.data.error.message) || 'Gemini request failed';
      const code = result.quota ? 'QUOTA_EXCEEDED' : (result.fatal ? 'KEY_INVALID' : 'API_ERROR');
      sendJson(res, result.fatal ? 401 : 502, {
        ok: false,
        error: msg,
        code: code,
        model: result.model
      });
      return;
    }

    sendJson(res, 200, result.data);
  } catch (err) {
    console.error('[api/chat/gemini]', err);
    sendJson(res, 500, { ok: false, error: err.message || 'Internal server error' });
  }
}

module.exports = handler;
