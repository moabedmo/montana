'use strict';

/** Vision + Arabic — smart default, then cheaper fallback */
const GEMINI_MODELS = [
  'gemini-2.0-flash',
  'gemini-2.0-flash-lite',
  'gemini-2.5-flash'
];

function maskKey(key) {
  if (!key) return '';
  if (key.length <= 8) return '••••••••';
  return '••••' + key.slice(-4);
}

function resolveGeminiKey() {
  return String(process.env.GEMINI_API_KEY || '').trim();
}

function resolveGeminiModels() {
  const single = String(process.env.GEMINI_MODEL || '').trim();
  if (single) return [single];
  return GEMINI_MODELS.slice();
}

function validateKeyFormat(key) {
  const k = String(key || '').trim();
  if (!k) {
    return { ok: false, error: 'ضيفي GEMINI_API_KEY في .env أو Vercel Environment Variables ثم أعد النشر' };
  }
  if (!k.startsWith('AIza') && !k.startsWith('AQ.')) {
    return { ok: false, error: 'شكل المفتاح غلط — انسخيه من Google AI Studio (AIzaSy أو AQ.)' };
  }
  return { ok: true, key: k };
}

function sleep(ms) {
  return new Promise(function (resolve) { setTimeout(resolve, ms); });
}

function isRetryableError(msg) {
  if (!msg) return false;
  const m = String(msg).toLowerCase();
  return /high demand|overloaded|unavailable|resource_exhausted|quota|429|503|try again|capacity|deadline|internal error/i.test(m);
}

function buildMessageParts(message) {
  const parts = [];
  if (message.content) {
    parts.push({ text: String(message.content) });
  }
  if (Array.isArray(message.images)) {
    message.images.forEach(function (img) {
      if (!img || !img.data) return;
      parts.push({
        inlineData: {
          mimeType: img.mimeType || 'image/jpeg',
          data: String(img.data).replace(/^data:[^;]+;base64,/, '')
        }
      });
    });
  }
  return parts;
}

function buildGeminiRequest(body) {
  const gen = body.generationConfig || body.generation_config || {};
  const request = {
    generationConfig: {
      temperature: gen.temperature != null ? gen.temperature : 0.25,
      maxOutputTokens: gen.maxOutputTokens || gen.max_tokens || 700
    }
  };

  const system = body.system || (body.systemInstruction && body.systemInstruction.parts &&
    body.systemInstruction.parts[0] && body.systemInstruction.parts[0].text);
  if (system) {
    request.systemInstruction = { parts: [{ text: String(system) }] };
  }

  if (Array.isArray(body.contents) && body.contents.length) {
    request.contents = body.contents;
    return request;
  }

  const contents = [];
  if (Array.isArray(body.messages)) {
    body.messages.forEach(function (m) {
      if (!m) return;
      const role = m.role === 'assistant' || m.role === 'model' ? 'model' : 'user';
      const parts = buildMessageParts(m);
      if (parts.length) contents.push({ role: role, parts: parts });
    });
  }

  request.contents = contents;
  return request;
}

function extractGeminiText(data) {
  if (!data || !data.candidates || !data.candidates[0] || !data.candidates[0].content) return '';
  const parts = data.candidates[0].content.parts || [];
  return parts.map(function (p) { return p.text || ''; }).join('').trim();
}

async function callGeminiApi(key, body) {
  const payload = buildGeminiRequest(body);
  const models = resolveGeminiModels();
  let lastData = null;

  for (let i = 0; i < models.length; i++) {
    const model = models[i];
    for (let attempt = 0; attempt < 2; attempt++) {
      if (attempt > 0) await sleep(600);

      const res = await fetch(
        'https://generativelanguage.googleapis.com/v1beta/models/' + model + ':generateContent?key=' + encodeURIComponent(key),
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        }
      );

      const data = await res.json();
      const text = extractGeminiText(data);
      if (text) {
        data._model = model;
        data._text = text;
        return { ok: true, data: data, model: model, text: text };
      }

      lastData = data;
      const errMsg = (data.error && data.error.message) || '';
      if (/quota|RESOURCE_EXHAUSTED|rate limit/i.test(errMsg)) {
        return { ok: false, data: data, model: model, quota: true };
      }
      if (/api key not valid|api_key_invalid|permission denied/i.test(errMsg)) {
        return { ok: false, data: data, model: model, fatal: true };
      }
      if (/not found|NOT_FOUND/i.test(errMsg)) break;
      if (isRetryableError(errMsg) && attempt < 1) continue;
      if (isRetryableError(errMsg)) break;
      return { ok: false, data: data, model: model };
    }
  }

  return { ok: false, data: lastData, model: models[models.length - 1] };
}

async function testGeminiKey(key) {
  const check = validateKeyFormat(key);
  if (!check.ok) return check;

  const result = await callGeminiApi(check.key, {
    messages: [{ role: 'user', content: 'ping' }],
    generationConfig: { maxOutputTokens: 16 }
  });

  if (result.ok) {
    return { ok: true, model: result.model, message: 'المفتاح شغال' };
  }

  const msg = (result.data && result.data.error && result.data.error.message) || 'فشل الاتصال بـ Gemini';
  return { ok: false, error: msg, fatal: !!result.fatal, quota: !!result.quota };
}

module.exports = {
  GEMINI_MODELS,
  maskKey,
  resolveGeminiKey,
  resolveGeminiModels,
  validateKeyFormat,
  buildGeminiRequest,
  extractGeminiText,
  callGeminiApi,
  testGeminiKey
};
