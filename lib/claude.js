'use strict';

const CLAUDE_MODELS = [
  'claude-sonnet-4-20250514',
  'claude-3-5-sonnet-latest',
  'claude-3-5-haiku-latest'
];

const CLAUDE_API_URL = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_VERSION = '2023-06-01';

function maskKey(key) {
  if (!key) return '';
  if (key.length <= 8) return '••••••••';
  return '••••' + key.slice(-4);
}

function resolveClaudeKey() {
  return String(process.env.ANTHROPIC_API_KEY || '').trim();
}

function resolveClaudeModel() {
  return String(process.env.CLAUDE_MODEL || CLAUDE_MODELS[0]).trim();
}

function resolveClaudeModels() {
  const single = resolveClaudeModel();
  const rest = CLAUDE_MODELS.filter(function (m) { return m !== single; });
  return [single].concat(rest);
}

function validateKeyFormat(key) {
  const k = String(key || '').trim();
  if (!k) {
    return { ok: false, error: 'ضيفي ANTHROPIC_API_KEY في .env أو Vercel Environment Variables ثم أعد النشر' };
  }
  if (!k.startsWith('sk-ant-')) {
    return { ok: false, error: 'شكل مفتاح Anthropic غلط — لازم يبدأ بـ sk-ant- من console.anthropic.com' };
  }
  return { ok: true, key: k };
}

function sleep(ms) {
  return new Promise(function (resolve) { setTimeout(resolve, ms); });
}

function isRetryableError(msg) {
  if (!msg) return false;
  const m = String(msg).toLowerCase();
  return /429|rate limit|overloaded|unavailable|503|try again|capacity|timeout/i.test(m);
}

function buildClaudeMessages(body) {
  const messages = [];
  if (Array.isArray(body.messages)) {
    body.messages.forEach(function (m) {
      if (!m || !m.content) return;
      const role = m.role === 'assistant' || m.role === 'model' ? 'assistant' : 'user';
      messages.push({ role: role, content: String(m.content) });
    });
  }
  return messages;
}

function extractClaudeText(data) {
  if (!data || !Array.isArray(data.content)) return '';
  return data.content
    .filter(function (block) { return block.type === 'text'; })
    .map(function (block) { return block.text || ''; })
    .join('')
    .trim();
}

async function callClaudeApi(key, body) {
  const models = resolveClaudeModels();
  const messages = buildClaudeMessages(body);
  const gen = body.generationConfig || body.generation_config || {};
  const maxTokens = gen.maxOutputTokens || gen.max_tokens || 1000;
  const temperature = gen.temperature != null ? gen.temperature : 0.7;
  const system = body.system || '';

  let lastData = null;

  for (let i = 0; i < models.length; i++) {
    const model = models[i];
    for (let attempt = 0; attempt < 2; attempt++) {
      if (attempt > 0) await sleep(600);

      const payload = {
        model: model,
        max_tokens: maxTokens,
        temperature: temperature,
        messages: messages
      };
      if (system) payload.system = String(system);

      const res = await fetch(CLAUDE_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': key,
          'anthropic-version': ANTHROPIC_VERSION
        },
        body: JSON.stringify(payload)
      });

      const data = await res.json().catch(function () { return {}; });
      lastData = data;

      if (res.ok) {
        return {
          ok: true,
          model: model,
          text: extractClaudeText(data),
          data: data
        };
      }

      const msg = (data.error && data.error.message) || 'Claude request failed';
      const fatal = res.status === 401 || /invalid.*api.*key|authentication/i.test(msg);
      const quota = res.status === 429 || /rate limit|quota/i.test(msg);

      if (!fatal && !quota && isRetryableError(msg) && attempt === 0) continue;
      if (i < models.length - 1 && (quota || isRetryableError(msg))) break;

      return { ok: false, fatal: fatal, quota: quota, model: model, data: data, error: msg };
    }
  }

  const msg = (lastData && lastData.error && lastData.error.message) || 'Claude request failed';
  return { ok: false, fatal: false, quota: false, model: models[0], data: lastData, error: msg };
}

async function testClaudeKey(key) {
  const check = validateKeyFormat(key);
  if (!check.ok) return check;

  const result = await callClaudeApi(check.key, {
    system: 'Reply with exactly: OK',
    messages: [{ role: 'user', content: 'ping' }],
    generationConfig: { maxOutputTokens: 16, temperature: 0 }
  });

  if (!result.ok) {
    return {
      ok: false,
      fatal: !!result.fatal,
      error: result.error || 'Claude test failed'
    };
  }

  return {
    ok: true,
    message: 'Claude API شغّال — ' + result.model,
    model: result.model
  };
}

module.exports = {
  maskKey,
  resolveClaudeKey,
  resolveClaudeModel,
  resolveClaudeModels,
  validateKeyFormat,
  callClaudeApi,
  extractClaudeText,
  testClaudeKey
};
