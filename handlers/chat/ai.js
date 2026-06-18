'use strict';

const { resolveGeminiKey, validateKeyFormat: validateGeminiKey, callGeminiApi, extractGeminiText } = require('../../lib/gemini');
const { resolveGroqKey, validateKeyFormat: validateGroqKey, callGroqApi } = require('../../lib/groq');
const { resolveClaudeKey, validateKeyFormat: validateClaudeKey, callClaudeApi, extractClaudeText } = require('../../lib/claude');
const { setCors, sendJson, readJsonBody } = require('../../lib/http');

function resolveProvider() {
  const explicit = String(process.env.CHAT_PROVIDER || '').trim().toLowerCase();
  if (explicit === 'groq') return 'groq';
  if (explicit === 'gemini') return 'gemini';
  if (explicit === 'claude' || explicit === 'anthropic') return 'claude';
  if (resolveClaudeKey()) return 'claude';
  if (resolveGeminiKey()) return 'gemini';
  if (resolveGroqKey()) return 'groq';
  return 'gemini';
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

    if (provider === 'claude') {
      const key = resolveClaudeKey();
      const check = validateClaudeKey(key);
      if (!check.ok) {
        sendJson(res, 503, { ok: false, error: check.error, code: 'NO_KEY', provider: 'claude' });
        return;
      }
      const result = await callClaudeApi(check.key, body);
      if (!result.ok) {
        const msg = result.error || 'Claude request failed';
        const code = result.quota ? 'QUOTA_EXCEEDED' : (result.fatal ? 'KEY_INVALID' : 'API_ERROR');
        sendJson(res, result.fatal ? 401 : 502, {
          ok: false,
          error: msg,
          code: code,
          model: result.model,
          provider: 'claude'
        });
        return;
      }
      sendJson(res, 200, {
        ok: true,
        provider: 'claude',
        model: result.model,
        text: result.text || extractClaudeText(result.data)
      });
      return;
    }

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
      sendJson(res, 200, {
        ok: true,
        provider: 'gemini',
        model: result.model,
        text: result.text || extractGeminiText(result.data)
      });
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
