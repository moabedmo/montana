'use strict';

const { maskKey: maskGemini, resolveGeminiKey, resolveGeminiModels, testGeminiKey } = require('../../lib/gemini');
const { maskKey: maskGroq, resolveGroqKey, resolveGroqModels, testGroqKey } = require('../../lib/groq');
const { setCors, sendJson, readJsonBody } = require('../../lib/http');

function resolveProvider() {
  const p = String(process.env.CHAT_PROVIDER || 'gemini').trim().toLowerCase();
  return p === 'groq' ? 'groq' : 'gemini';
}

async function handler(req, res) {
  setCors(res);

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }

  try {
    const provider = resolveProvider();
    const aiOn = process.env.CHAT_USE_AI !== 'false';

    if (req.method === 'GET') {
      if (provider === 'gemini') {
        const key = resolveGeminiKey();
        sendJson(res, 200, {
          ok: true,
          provider: 'gemini',
          configured: !!key,
          ai_enabled: aiOn && !!key,
          api_key: maskGemini(key),
          models: resolveGeminiModels(),
          primary_model: resolveGeminiModels()[0] || 'gemini-2.0-flash',
          vision: true,
          source: 'env'
        });
        return;
      }

      const key = resolveGroqKey();
      sendJson(res, 200, {
        ok: true,
        provider: 'groq',
        configured: !!key,
        ai_enabled: aiOn && !!key,
        api_key: maskGroq(key),
        models: resolveGroqModels(),
        primary_model: resolveGroqModels()[0] || 'allam-2-7b',
        source: 'env'
      });
      return;
    }

    if (req.method === 'POST') {
      const body = await readJsonBody(req);
      if ((body.action || 'test') !== 'test') {
        sendJson(res, 405, { ok: false, error: 'المفتاح يُضبط فقط عبر .env' });
        return;
      }

      if (provider === 'gemini') {
        const result = await testGeminiKey(resolveGeminiKey());
        if (!result.ok) {
          sendJson(res, 400, { ok: false, error: result.error, fatal: !!result.fatal, provider: 'gemini' });
          return;
        }
        sendJson(res, 200, { ok: true, message: result.message, model: result.model, provider: 'gemini' });
        return;
      }

      const result = await testGroqKey(resolveGroqKey());
      if (!result.ok) {
        sendJson(res, 400, { ok: false, error: result.error, fatal: !!result.fatal, provider: 'groq' });
        return;
      }
      sendJson(res, 200, { ok: true, message: result.message, model: result.model, provider: 'groq' });
      return;
    }

    sendJson(res, 405, { error: 'Method not allowed' });
  } catch (err) {
    console.error('[api/settings/chat]', err);
    sendJson(res, 500, { error: err.message || 'Internal server error' });
  }
}

module.exports = handler;
