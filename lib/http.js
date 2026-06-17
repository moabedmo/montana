'use strict';

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-admin-key');
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

function checkAdmin(req) {
  const expected = process.env.MONTANA_ADMIN_API_KEY;
  if (!expected) return true;
  const key = req.headers['x-admin-key'];
  return key === expected;
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
  maskToken
};
