// Shared security helpers for Express (local) and Vercel serverless APIs.
const crypto = require('crypto');

const BLOCKED_PATHS = /^\/(setup_admin\.js|setup_owner\.js|scripts\/|supabase\/|node_modules\/|\.env|\.git)/;

const ALLOWED_ORIGINS = new Set([
  'https://www.montana.com.eg',
  'https://montana.com.eg',
  'http://localhost:4000',
  'http://127.0.0.1:4000',
]);

const rateBuckets = new Map();

function setSecurityHeaders(res) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  res.setHeader(
    'Content-Security-Policy',
    [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://cdnjs.cloudflare.com",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdnjs.cloudflare.com",
      "font-src 'self' https://fonts.gstatic.com https://cdnjs.cloudflare.com data:",
      "img-src 'self' data: https: blob:",
      "connect-src 'self' https://ikryeyqrithikabwidov.supabase.co https://*.supabase.co wss://*.supabase.co",
      "frame-src https://accept.paymob.com",
      "base-uri 'self'",
      "form-action 'self'",
    ].join('; ')
  );
  if (process.env.NODE_ENV === 'production' || process.env.VERCEL) {
    res.setHeader('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload');
  }
}

function isBlockedPath(pathname) {
  return BLOCKED_PATHS.test(pathname || '');
}

function corsMiddleware(req, res, next) {
  const origin = req.headers.origin;
  if (origin && ALLOWED_ORIGINS.has(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Montana-Secret');
  if (req.method === 'OPTIONS') return res.status(204).end();
  next();
}

function clientIp(req) {
  const fwd = req.headers['x-forwarded-for'];
  if (typeof fwd === 'string') return fwd.split(',')[0].trim();
  return req.socket?.remoteAddress || 'unknown';
}

function rateLimit(key, { windowMs = 60_000, max = 30 } = {}) {
  const now = Date.now();
  const bucket = rateBuckets.get(key) || { count: 0, reset: now + windowMs };
  if (now > bucket.reset) {
    bucket.count = 0;
    bucket.reset = now + windowMs;
  }
  bucket.count += 1;
  rateBuckets.set(key, bucket);
  if (bucket.count > max) {
    const err = new Error('Too many requests');
    err.status = 429;
    throw err;
  }
}

function enforceRateLimit(req, label, opts) {
  rateLimit(`${label}:${clientIp(req)}`, opts);
}

function verifyStoreOrigin(req) {
  if (process.env.NODE_ENV !== 'production' && !process.env.VERCEL) return true;

  const origin = req.headers.origin || '';
  const referer = req.headers.referer || '';
  const host = String(req.headers['x-forwarded-host'] || req.headers.host || '')
    .split(',')[0]
    .trim()
    .toLowerCase()
    .replace(/:\d+$/, '');

  const trustedHosts = new Set(['www.montana.com.eg', 'montana.com.eg']);
  const originOk = [...ALLOWED_ORIGINS].some((o) => origin.startsWith(o) || referer.startsWith(o));

  if (originOk) return;

  // Same-site fetch from our pages often omits Origin; some proxies strip Referer too.
  if (trustedHosts.has(host) && !origin) return;

  const err = new Error('Forbidden origin');
  err.status = 403;
  throw err;
}

function verifyApiSecret(req) {
  const expected = process.env.INTERNAL_API_SECRET;
  if (!expected) return;
  const got = req.headers['x-montana-secret'];
  if (got !== expected) {
    const err = new Error('Unauthorized');
    err.status = 401;
    throw err;
  }
}

function sanitizeTelegramField(value, maxLen = 120) {
  if (value == null) return '';
  return String(value)
    .replace(/[*_`\[\]]/g, '')
    .slice(0, maxLen);
}

function isSafeHttpUrl(url) {
  try {
    const u = new URL(String(url));
    return u.protocol === 'https:' || u.protocol === 'http:';
  } catch {
    return false;
  }
}

function hasValidApiSecret(req) {
  const expected = process.env.INTERNAL_API_SECRET;
  if (!expected) return false;
  return req.headers['x-montana-secret'] === expected;
}

module.exports = {
  setSecurityHeaders,
  isBlockedPath,
  corsMiddleware,
  enforceRateLimit,
  rateLimit,
  verifyStoreOrigin,
  verifyApiSecret,
  hasValidApiSecret,
  sanitizeTelegramField,
  isSafeHttpUrl,
  ALLOWED_ORIGINS,
};
