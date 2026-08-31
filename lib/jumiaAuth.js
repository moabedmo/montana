// Jumia Vendor OAuth helpers (authorization_code → refresh_token).
const TOKEN_URL = process.env.JUMIA_TOKEN_URL || 'https://vendor-api.jumia.com/token';
const AUTH_URL = process.env.JUMIA_AUTH_URL || '';
const REDIRECT_URI =
  process.env.JUMIA_REDIRECT_URI || 'https://www.montana.com.eg/api/jumia-oauth-callback';

function jumiaCreds() {
  const clean = (v) =>
    String(v || '')
      .trim()
      .replace(/^["']|["']$/g, '')
      .replace(/[\u200B-\u200D\uFEFF]/g, '')
      .replace(/\r|\n/g, '')
      .trim();
  return {
    clientId: clean(process.env.JUMIA_CLIENT_ID),
    clientSecret: clean(process.env.JUMIA_CLIENT_SECRET),
    redirectUri: REDIRECT_URI,
    tokenUrl: TOKEN_URL,
    authUrl: AUTH_URL,
  };
}

function buildAuthorizeUrl(state = 'montana') {
  const { clientId, redirectUri, authUrl } = jumiaCreds();
  if (!clientId) {
    const err = new Error('JUMIA_CLIENT_ID missing');
    err.status = 503;
    throw err;
  }
  if (!authUrl) {
    const err = new Error('JUMIA_AUTH_URL not configured — authorize from Jumia Vendor Center UI');
    err.status = 501;
    throw err;
  }
  const u = new URL(authUrl);
  u.searchParams.set('response_type', 'code');
  u.searchParams.set('client_id', clientId);
  u.searchParams.set('redirect_uri', redirectUri);
  u.searchParams.set('state', state);
  return u.toString();
}

async function exchangeAuthorizationCode(code) {
  const { clientId, clientSecret, redirectUri, tokenUrl } = jumiaCreds();
  if (!clientId || !clientSecret) {
    const err = new Error('JUMIA_CLIENT_ID / JUMIA_CLIENT_SECRET missing');
    err.status = 503;
    throw err;
  }
  if (!code) {
    const err = new Error('authorization code missing');
    err.status = 400;
    throw err;
  }

  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code: String(code),
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri,
  });

  const res = await fetch(tokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
    },
    body: body.toString(),
  });
  const text = await res.text();
  let data = {};
  try {
    data = JSON.parse(text);
  } catch {
    data = { raw: text };
  }
  if (!res.ok) {
    const err = new Error(data.error_description || data.error || data.message || text || `HTTP ${res.status}`);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

async function refreshAccessToken(refreshToken, { includeClientSecret = false } = {}) {
  const { clientId, clientSecret, tokenUrl } = jumiaCreds();
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: String(refreshToken || ''),
    client_id: clientId,
  });
  // Egypt self-auth: the "secret" IS the refresh token — do not also send client_secret.
  if (includeClientSecret && clientSecret && clientSecret !== refreshToken) {
    body.set('client_secret', clientSecret);
  }

  const res = await fetch(tokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
    },
    body: body.toString(),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error_description || data.error || data.message || `HTTP ${res.status}`);
    err.status = res.status;
    throw err;
  }
  return data;
}

function htmlPage(title, bodyHtml) {
  return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${title}</title>
  <style>
    body{font-family:Tahoma,Arial,sans-serif;background:#f7f4fb;color:#2b2140;margin:0;padding:24px}
    .box{max-width:720px;margin:40px auto;background:#fff;border:1px solid #e8dff3;border-radius:16px;padding:24px;box-shadow:0 8px 24px rgba(107,63,160,.08)}
    h1{font-size:22px;margin:0 0 12px}
    p{line-height:1.7;margin:8px 0}
    code,textarea{display:block;width:100%;box-sizing:border-box;direction:ltr;text-align:left;background:#1e1530;color:#f3e9ff;border-radius:10px;padding:12px;border:0;font-size:13px;min-height:90px}
    .ok{color:#1e8449}.err{color:#c0392b}
    a.btn{display:inline-block;margin-top:14px;background:#6D4ADB;color:#fff;text-decoration:none;padding:10px 16px;border-radius:10px;font-weight:700}
  </style>
</head>
<body><div class="box">${bodyHtml}</div></body></html>`;
}

async function requestClientCredentialsToken() {
  const { clientId, clientSecret, tokenUrl } = jumiaCreds();
  const refreshFromEnv = String(process.env.JUMIA_REFRESH_TOKEN || '')
    .trim()
    .replace(/^["']|["']$/g, '');
  if (!clientId || (!clientSecret && !refreshFromEnv)) {
    const err = new Error('JUMIA_CLIENT_ID and (JUMIA_CLIENT_SECRET or JUMIA_REFRESH_TOKEN) required');
    err.status = 503;
    throw err;
  }
  const meta = {
    client_id_prefix: clientId.slice(0, 8),
    client_id_len: clientId.length,
    client_secret_len: clientSecret.length,
    client_secret_suffix: clientSecret ? clientSecret.slice(-4) : '',
    has_refresh_env: !!refreshFromEnv,
    token_url: tokenUrl,
  };

  // Jumia Egypt UI often labels the Refresh Token as "Secret".
  // Official VC integrations use: client_id + refresh_token → access_token.
  const attempts = [
    {
      label: 'secret_as_refresh_token',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        client_id: clientId,
        refresh_token: clientSecret,
      }).toString(),
    },
    {
      label: 'env_refresh_token',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        client_id: clientId,
        refresh_token: refreshFromEnv || clientSecret,
      }).toString(),
    },
    {
      label: 'refresh_with_client_secret',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshFromEnv || clientSecret,
      }).toString(),
    },
    {
      label: 'form_client_credentials',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: clientId,
        client_secret: clientSecret,
      }).toString(),
    },
    {
      label: 'basic_client_credentials',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
        Authorization: 'Basic ' + Buffer.from(`${clientId}:${clientSecret}`).toString('base64'),
      },
      body: new URLSearchParams({ grant_type: 'client_credentials' }).toString(),
    },
  ];

  const results = [];
  for (const a of attempts) {
    if (a.label === 'env_refresh_token' && !refreshFromEnv) continue;
    const res = await fetch(tokenUrl, { method: 'POST', headers: a.headers, body: a.body });
    const text = await res.text();
    let data = {};
    try {
      data = JSON.parse(text);
    } catch {
      data = { raw: text.slice(0, 200) };
    }
    results.push({
      label: a.label,
      status: res.status,
      ok: res.ok,
      error: data.error || data.message || null,
      error_description: data.error_description || null,
      has_access_token: !!data.access_token,
      has_refresh_token: !!data.refresh_token,
      expires_in: data.expires_in || null,
      token_type: data.token_type || null,
    });
    if (res.ok && data.access_token) {
      return { ok: true, method: a.label, token: data, results, meta };
    }
  }
  return { ok: false, results, meta };
}

module.exports = {
  jumiaCreds,
  buildAuthorizeUrl,
  exchangeAuthorizationCode,
  refreshAccessToken,
  requestClientCredentialsToken,
  htmlPage,
  REDIRECT_URI,
};
