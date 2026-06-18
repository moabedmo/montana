'use strict';

const {
  resolveTelegramConfig,
  resolveWebhookUrl,
  registerTelegramWebhook,
  getWebhookInfo
} = require('../../lib/telegram');
const { setCors, sendJson, readJsonBody, checkAdminPanel } = require('../../lib/http');

async function handler(req, res) {
  setCors(res);

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }

  if (req.method === 'GET') {
    var cfg = resolveTelegramConfig();
    if (!cfg.token) {
      sendJson(res, 503, { ok: false, error: 'TELEGRAM_BOT_TOKEN غير مضبوط على Vercel' });
      return;
    }
    var info = await getWebhookInfo(cfg.token);
    sendJson(res, 200, {
      ok: true,
      webhookUrl: resolveWebhookUrl(),
      webhook: info.ok ? info.data : null,
      error: info.ok ? null : info.error
    });
    return;
  }

  if (req.method !== 'POST') {
    sendJson(res, 405, { ok: false, error: 'Method not allowed' });
    return;
  }

  try {
    var body = await readJsonBody(req);
    var auth = checkAdminPanel(req, body, { allowTelegramToken: true });
    if (!auth.ok) {
      sendJson(res, 401, { ok: false, error: auth.error });
      return;
    }

    var token = String(body.bot_token || body.token || resolveTelegramConfig().token || '').trim();
    var webhookUrl = resolveWebhookUrl();

    if (!token) {
      sendJson(res, 400, { ok: false, error: 'Bot Token مطلوب' });
      return;
    }

    var result = await registerTelegramWebhook(token, webhookUrl);
    var info = await getWebhookInfo(token);

    sendJson(res, result.ok ? 200 : 502, {
      ok: result.ok,
      webhookUrl: webhookUrl,
      webhook: info.ok ? info.data : null,
      error: result.ok ? null : result.error,
      message: result.ok ? 'تم ربط Webhook — جرّبي زر الموافقة تاني' : undefined
    });
  } catch (err) {
    console.error('[api/telegram/setup-webhook]', err);
    sendJson(res, 500, { ok: false, error: err.message || 'Internal server error' });
  }
}

module.exports = handler;
