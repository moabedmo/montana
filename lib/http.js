'use strict';

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-admin-key, x-telegram-token, x-include-tokens');
}

function sendJson(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(body));
}

async function readJsonBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;

  const chunks = [];
  for await (const chunk of req) {
    chunks.push(chunk);
  }
  const raw = Buffer.concat(chunks).toString('utf8');
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch (e) {
    return {};
  }
}

function getAdminKeyFromRequest(req, body) {
  return String(
    (req.headers && req.headers['x-admin-key']) ||
    (req.query && req.query.key) ||
    (body && body.admin_key) ||
    ''
  ).trim();
}

function getTelegramTokenFromRequest(req, body) {
  return String(
    (req.headers && req.headers['x-telegram-token']) ||
    (body && (body.bot_token || body.token)) ||
    ''
  ).trim();
}

function checkAdmin(req, body) {
  var expected = String(process.env.MONTANA_ADMIN_API_KEY || '').trim();
  if (!expected) return true;
  return getAdminKeyFromRequest(req, body) === expected;
}

function checkAdminPanel(req, body, options) {
  options = options || {};
  var expected = String(process.env.MONTANA_ADMIN_API_KEY || '').trim();
  if (!expected) return { ok: true };

  if (getAdminKeyFromRequest(req, body) === expected) {
    return { ok: true };
  }

  if (options.allowTelegramToken) {
    var envToken = String(process.env.TELEGRAM_BOT_TOKEN || process.env.TG_BOT_TOKEN || '').trim();
    var reqToken = getTelegramTokenFromRequest(req, body);
    if (envToken && reqToken && reqToken === envToken) {
      return { ok: true };
    }
  }

  return {
    ok: false,
    error: 'API Admin Key مطلوب — انسخي MONTANA_ADMIN_API_KEY من Vercel وحطّيه في الإعدادات → API Admin Key'
  };
}

function maskToken(token) {
  if (!token) return '';
  if (token.length <= 8) return '••••••••';
  return '••••' + token.slice(-4);
}

module.exports = {
  setCors,
  sendJson,
  readJsonBody,
  checkAdmin,
  checkAdminPanel,
  getAdminKeyFromRequest,
  getTelegramTokenFromRequest,
  maskToken
};
