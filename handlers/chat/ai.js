'use strict';

const { resolveGeminiKey, validateKeyFormat: validateGeminiKey, callGeminiApi } = require('../../lib/gemini');
const { resolveGroqKey, validateKeyFormat: validateGroqKey, callGroqApi } = require('../../lib/groq');
const { setCors, sendJson, readJsonBody } = require('../../lib/http');

function resolveProvider() {
  const p = String(process.env.CHAT_PROVIDER || 'groq').trim().toLowerCase();
  return p === 'gemini' ? 'gemini' : 'groq';
}

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
    const provider = resolveProvider();

    if (provider === 'gemini') {
      const key = resolveGeminiKey();
      const check = validateGeminiKey(key);
      if (!check.ok) {
        sendJson(res, 503, { ok: false, error: check.error, code: 'NO_KEY', provider: 'gemini' });
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
          model: result.model,
          provider: 'gemini'
        });
        return;
      }
      sendJson(res, 200, Object.assign({ ok: true, provider: 'gemini' }, result.data));
      return;
    }

    const key = resolveGroqKey();
    const check = validateGroqKey(key);
    if (!check.ok) {
      sendJson(res, 503, { ok: false, error: check.error, code: 'NO_KEY', provider: 'groq' });
      return;
    }

    const result = await callGroqApi(check.key, body);
    if (!result.ok) {
      const msg = (result.data && result.data.error && result.data.error.message) || 'Groq request failed';
      const code = result.quota ? 'QUOTA_EXCEEDED' : (result.fatal ? 'KEY_INVALID' : 'API_ERROR');
      sendJson(res, result.fatal ? 401 : 502, {
        ok: false,
        error: msg,
        code: code,
        model: result.model,
        provider: 'groq'
      });
      return;
    }

    sendJson(res, 200, {
      ok: true,
      provider: 'groq',
      model: result.model,
      text: result.text
    });
  } catch (err) {
    console.error('[api/chat/ai]', err);
    sendJson(res, 500, { ok: false, error: err.message || 'Internal server error' });
  }
}

module.exports = handler;
