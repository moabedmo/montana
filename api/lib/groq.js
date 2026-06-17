'use strict';

/** Groq models — ordered: Arabic + quota, then max daily requests. See console.groq.com/docs/rate-limits */
const GROQ_MODELS = [
  'allam-2-7b',
  'llama-3.1-8b-instant'
];

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';

function maskKey(key) {
  if (!key) return '';
  if (key.length <= 8) return '••••••••';
  return '••••' + key.slice(-4);
}

function resolveGroqKey() {
  return String(process.env.GROQ_API_KEY || '').trim();
}

function resolveGroqModels() {
  const single = String(process.env.GROQ_MODEL || '').trim();
  if (single) return [single];
  return GROQ_MODELS.slice();
}

function validateKeyFormat(key) {
  const k = String(key || '').trim();
  if (!k) {
    return { ok: false, error: 'ضيفي GROQ_API_KEY في ملف .env من console.groq.com ثم أعد تشغيل السيرفر' };
  }
  if (!k.startsWith('gsk_')) {
    return { ok: false, error: 'شكل مفتاح Groq غلط — لازم يبدأ بـ gsk_ من console.groq.com/keys' };
  }
  return { ok: true, key: k };
}

function sleep(ms) {
  return new Promise(function (resolve) { setTimeout(resolve, ms); });
}

function isRetryableError(msg) {
  if (!msg) return false;
  const m = String(msg).toLowerCase();
  return /429|rate limit|too many requests|overloaded|unavailable|503|try again/i.test(m);
}

function buildGroqMessages(body) {
  const messages = [];
  const system = body.system || (body.systemInstruction && body.systemInstruction.parts &&
    body.systemInstruction.parts[0] && body.systemInstruction.parts[0].text);
  if (system) {
    messages.push({ role: 'system', content: String(system) });
  }

  if (Array.isArray(body.messages)) {
    body.messages.forEach(function (m) {
      if (!m || !m.content) return;
      const role = m.role === 'assistant' || m.role === 'model' ? 'assistant' : 'user';
      messages.push({ role: role, content: String(m.content) });
    });
    return messages;
  }

  (body.contents || []).forEach(function (c) {
    if (!c || !c.parts || !c.parts[0]) return;
    const role = c.role === 'model' ? 'assistant' : 'user';
    messages.push({ role: role, content: String(c.parts[0].text || '') });
  });
  return messages;
}

async function callGroqApi(key, body) {
  const models = resolveGroqModels();
  const messages = buildGroqMessages(body);
  const gen = body.generationConfig || body.generation_config || {};
  const maxTokens = gen.maxOutputTokens || gen.max_tokens || 500;
  const temperature = gen.temperature != null ? gen.temperature : 0.25;

  let lastData = null;

  for (let i = 0; i < models.length; i++) {
    const model = models[i];
    for (let attempt = 0; attempt < 2; attempt++) {
      if (attempt > 0) await sleep(800);

      const payload = {
        model: model,
        messages: messages,
        temperature: temperature,
        max_tokens: maxTokens,
        response_format: { type: 'json_object' }
      };

      const res = await fetch(GROQ_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + key
        },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      const choice = data.choices && data.choices[0];
      if (choice && choice.message && choice.message.content) {
        return {
          ok: true,
          text: choice.message.content,
          model: model,
          data: data
        };
      }

      lastData = data;
      const errMsg = (data.error && data.error.message) || '';
      if (/invalid api key|invalid_api_key|authentication/i.test(errMsg)) {
        return { ok: false, data: data, model: model, fatal: true };
      }
      if (/not found|decommissioned|model.*not/i.test(errMsg)) break;
      if (isRetryableError(errMsg) && attempt < 1) continue;
      if (isRetryableError(errMsg)) break;
      if (i < models.length - 1) break;
      return { ok: false, data: data, model: model, quota: /rate limit|429/i.test(errMsg) };
    }
  }

  const msg = (lastData && lastData.error && lastData.error.message) || '';
  return {
    ok: false,
    data: lastData,
    model: models[models.length - 1],
    quota: /rate limit|429/i.test(msg)
  };
}

async function testGroqKey(key) {
  const check = validateKeyFormat(key);
  if (!check.ok) return check;

  const result = await callGroqApi(check.key, {
    system: 'Reply with JSON only: {"ok":true}',
    messages: [{ role: 'user', content: 'ping' }],
    generationConfig: { maxOutputTokens: 32, temperature: 0 }
  });

  if (result.ok) {
    return { ok: true, model: result.model, message: 'مفتاح Groq شغال' };
  }

  const msg = (result.data && result.data.error && result.data.error.message) || 'فشل الاتصال بـ Groq';
  return { ok: false, error: msg, fatal: !!result.fatal, quota: !!result.quota };
}

module.exports = {
  GROQ_MODELS,
  maskKey,
  resolveGroqKey,
  resolveGroqModels,
  validateKeyFormat,
  callGroqApi,
  testGroqKey
};
