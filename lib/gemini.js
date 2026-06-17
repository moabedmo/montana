'use strict';

const GEMINI_MODELS = [
  'gemini-2.5-flash',
  'gemini-2.0-flash',
  'gemini-2.0-flash-lite',
  'gemini-1.5-flash-8b'
];

function maskKey(key) {
  if (!key) return '';
  if (key.length <= 8) return '••••••••';
  return '••••' + key.slice(-4);
}

function resolveGeminiKey() {
  return String(process.env.GEMINI_API_KEY || '').trim();
}

function validateKeyFormat(key) {
  const k = String(key || '').trim();
  if (!k) {
    return { ok: false, error: 'ضيفي GEMINI_API_KEY في ملف .env ثم أعد تشغيل السيرفر (npm start)' };
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

async function callGeminiApi(key, body) {
  let lastData = null;

  for (let i = 0; i < GEMINI_MODELS.length; i++) {
    const model = GEMINI_MODELS[i];
    for (let attempt = 0; attempt < 2; attempt++) {
      if (attempt > 0) await sleep(600);

      const res = await fetch(
        'https://generativelanguage.googleapis.com/v1beta/models/' + model + ':generateContent?key=' + encodeURIComponent(key),
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body)
        }
      );

      const data = await res.json();
      if (data.candidates && data.candidates[0] && data.candidates[0].content) {
        data._model = model;
        return { ok: true, data: data, model: model };
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

  return { ok: false, data: lastData, model: GEMINI_MODELS[GEMINI_MODELS.length - 1] };
}

async function testGeminiKey(key) {
  const check = validateKeyFormat(key);
  if (!check.ok) return check;

  const result = await callGeminiApi(check.key, {
    contents: [{ role: 'user', parts: [{ text: 'ping' }] }],
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
  validateKeyFormat,
  callGeminiApi,
  testGeminiKey
};
