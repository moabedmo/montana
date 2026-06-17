'use strict';

const { maskKey, resolveGeminiKey, testGeminiKey } = require('../lib/gemini');
const { setCors, sendJson, readJsonBody } = require('../lib/http');

async function handler(req, res) {
  setCors(res);

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }

  try {
    if (req.method === 'GET') {
      const key = resolveGeminiKey();
      const aiOn = process.env.CHAT_USE_AI !== 'false' && !!key;
      sendJson(res, 200, {
        ok: true,
        configured: !!key,
        ai_enabled: aiOn,
        api_key: maskKey(key),
        source: 'env'
      });
      return;
    }

    if (req.method === 'POST') {
      const body = await readJsonBody(req);
      if ((body.action || 'test') !== 'test') {
        sendJson(res, 405, { ok: false, error: 'المفتاح يُضبط فقط عبر GEMINI_API_KEY في ملف .env' });
        return;
      }

      const result = await testGeminiKey(resolveGeminiKey());
      if (!result.ok) {
        sendJson(res, 400, { ok: false, error: result.error, fatal: !!result.fatal });
        return;
      }
      sendJson(res, 200, { ok: true, message: result.message, model: result.model });
      return;
    }

    sendJson(res, 405, { error: 'Method not allowed' });
  } catch (err) {
    console.error('[api/settings/gemini]', err);
    sendJson(res, 500, { error: err.message || 'Internal server error' });
  }
}

module.exports = handler;
