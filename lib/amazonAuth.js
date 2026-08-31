// Amazon SP-API — Login with Amazon (LWA) token helpers.
const TOKEN_URL = process.env.AMAZON_LWA_TOKEN_URL || 'https://api.amazon.com/auth/o2/token';

function clean(v) {
  return String(v || '')
    .trim()
    .replace(/^["']|["']$/g, '')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/\r|\n/g, '')
    .trim();
}

function amazonCreds() {
  return {
    clientId: clean(process.env.AMAZON_LWA_CLIENT_ID || process.env.AMAZON_CLIENT_ID),
    clientSecret: clean(process.env.AMAZON_LWA_CLIENT_SECRET || process.env.AMAZON_CLIENT_SECRET),
    refreshToken: clean(process.env.AMAZON_LWA_REFRESH_TOKEN || process.env.AMAZON_REFRESH_TOKEN),
    tokenUrl: TOKEN_URL,
    apiBase: clean(process.env.AMAZON_SP_API_BASE) || 'https://sellingpartnerapi-eu.amazon.com',
    // Egypt marketplace
    marketplaceId: clean(process.env.AMAZON_MARKETPLACE_ID) || 'ARBP9OOSHTCHU',
  };
}

async function exchangeRefreshToken(refreshToken) {
  const { clientId, clientSecret, tokenUrl, refreshToken: envRefresh } = amazonCreds();
  const refresh = clean(refreshToken) || envRefresh;
  if (!clientId || !clientSecret || !refresh) {
    const err = new Error(
      'Amazon credentials missing (AMAZON_LWA_CLIENT_ID / CLIENT_SECRET / REFRESH_TOKEN)'
    );
    err.status = 503;
    throw err;
  }

  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: refresh,
    client_id: clientId,
    client_secret: clientSecret,
  });

  const res = await fetch(tokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
      Accept: 'application/json',
    },
    body: body.toString(),
  });
  const text = await res.text();
  let data = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { raw: text };
  }
  if (!res.ok) {
    const err = new Error(
      data.error_description || data.error || data.message || text || `HTTP ${res.status}`
    );
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

module.exports = {
  amazonCreds,
  exchangeRefreshToken,
  TOKEN_URL,
};
