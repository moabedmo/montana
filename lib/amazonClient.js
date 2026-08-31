// Amazon SP-API client — marketplace + orders (Egypt).
const { amazonCreds, exchangeRefreshToken } = require('./amazonAuth');
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://ikryeyqrithikabwidov.supabase.co';
const SUPABASE_ANON =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlrcnlleXFyaXRoaWthYndpZG92Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE3MzY1ODcsImV4cCI6MjA5NzMxMjU4N30.kNfHPxV4fq67cOF8uFsTrLOxPYcLcmmDO3ScIHzI9Uo';

let _tokenCache = { access: '', expiresAt: 0 };

function userClient(token) {
  return createClient(SUPABASE_URL, SUPABASE_ANON, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
}

async function assertAmazonViewer(accessToken) {
  if (!accessToken) {
    const err = new Error('Unauthorized');
    err.status = 401;
    throw err;
  }
  const sb = userClient(accessToken);
  const checks = await Promise.all([sb.rpc('is_owner'), sb.rpc('is_store_admin')]);
  const ok = checks.some((r) => !r.error && r.data === true);
  if (!ok) {
    const err = new Error('Owner or admin access required');
    err.status = 403;
    throw err;
  }
  const { data: userData } = await sb.auth.getUser();
  return { userId: userData?.user?.id || null };
}

async function getAmazonAccessToken({ force = false } = {}) {
  const now = Date.now();
  if (!force && _tokenCache.access && _tokenCache.expiresAt > now + 60_000) {
    return _tokenCache.access;
  }
  const data = await exchangeRefreshToken();
  _tokenCache = {
    access: data.access_token,
    expiresAt: now + Number(data.expires_in || 3600) * 1000,
  };
  return _tokenCache.access;
}

async function amazonFetch(path, { method = 'GET', query, body, retry = true } = {}) {
  const { apiBase } = amazonCreds();
  const token = await getAmazonAccessToken();
  const url = new URL(path.startsWith('http') ? path : `${apiBase}${path}`);
  if (query && typeof query === 'object') {
    for (const [k, v] of Object.entries(query)) {
      if (v == null || v === '') continue;
      if (Array.isArray(v)) v.forEach((x) => url.searchParams.append(k, String(x)));
      else url.searchParams.set(k, String(v));
    }
  }
  const res = await fetch(url.toString(), {
    method,
    headers: {
      'x-amz-access-token': token,
      Accept: 'application/json',
      'User-Agent': 'MontanaWebsiteIntegration/1.0 (Language=Node.js)',
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if ((res.status === 401 || res.status === 403) && retry) {
    await getAmazonAccessToken({ force: true });
    return amazonFetch(path, { method, query, body, retry: false });
  }
  const text = await res.text();
  let data = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { raw: text };
  }
  if (!res.ok) {
    const msg =
      data?.errors?.[0]?.message ||
      data?.message ||
      data?.error_description ||
      data?.error ||
      text ||
      `HTTP ${res.status}`;
    const err = new Error(msg);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

function pick(...vals) {
  for (const v of vals) {
    if (v != null && v !== '') return v;
  }
  return null;
}

function daysAgoIso(days) {
  const d = new Date(Date.now() - Math.max(1, Number(days) || 30) * 24 * 60 * 60 * 1000);
  return d.toISOString();
}

function normalizeAmazonOrder(raw) {
  const money = pick(raw.OrderTotal?.Amount, raw.orderTotal?.Amount);
  const currency = pick(raw.OrderTotal?.CurrencyCode, raw.orderTotal?.CurrencyCode, 'EGP');
  return {
    id: String(pick(raw.AmazonOrderId, raw.amazonOrderId) || ''),
    status: String(pick(raw.OrderStatus, raw.orderStatus) || '—'),
    total: money != null ? Number(money) : null,
    currency: currency || 'EGP',
    created_at: pick(raw.PurchaseDate, raw.purchaseDate) || null,
    customer_name: '—', // PII needs restricted role / RDT
    customer_phone: '',
    marketplace_id: pick(raw.MarketplaceId, raw.marketplaceId) || '',
    fulfillment: pick(raw.FulfillmentChannel, raw.fulfillmentChannel) || '',
    items_count: pick(raw.NumberOfItemsShipped, raw.NumberOfItemsUnshipped) != null
      ? Number(raw.NumberOfItemsShipped || 0) + Number(raw.NumberOfItemsUnshipped || 0)
      : null,
    raw,
  };
}

async function listAmazonMarketplaces() {
  const data = await amazonFetch('/sellers/v1/marketplaceParticipations');
  const list = data?.payload || data?.marketplaceParticipations || [];
  return Array.isArray(list) ? list : [];
}

async function getAmazonSellerId() {
  const fromEnv = cleanEnv(process.env.AMAZON_SELLER_ID || process.env.AMAZON_SELLING_PARTNER_ID);
  if (fromEnv) return fromEnv;
  // Some payloads include sellingPartnerId; keep as best-effort fallback.
  try {
    const data = await amazonFetch('/sellers/v1/marketplaceParticipations');
    const raw = JSON.stringify(data);
    const m = raw.match(/"(?:sellingPartnerId|sellerId)"\s*:\s*"([A-Z0-9]+)"/i);
    if (m?.[1]) return m[1];
  } catch {
    /* ignore */
  }
  const err = new Error(
    'AMAZON_SELLER_ID missing — من Seller Central → Settings → Account Info انسخ Seller ID وضيفه في Vercel'
  );
  err.status = 503;
  throw err;
}

function cleanEnv(v) {
  return String(v || '')
    .trim()
    .replace(/^["']|["']$/g, '')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/\r|\n/g, '')
    .trim();
}

/**
 * List seller SKUs + live MFN quantity via Listings Items search.
 */
async function listAmazonListings({ pageSize = 20, maxPages = 10 } = {}) {
  const { marketplaceId } = amazonCreds();
  const sellerId = await getAmazonSellerId();
  const items = [];
  let pageToken = '';
  for (let page = 0; page < maxPages; page++) {
    const query = {
      marketplaceIds: marketplaceId,
      includedData: 'summaries,attributes,fulfillmentAvailability',
      pageSize: Math.min(20, Math.max(1, Number(pageSize) || 20)),
    };
    if (pageToken) query.pageToken = pageToken;
    const data = await amazonFetch(`/listings/2021-08-01/items/${encodeURIComponent(sellerId)}`, {
      query,
    });
    const batch = data?.items || data?.payload?.items || [];
    if (Array.isArray(batch)) items.push(...batch);
    pageToken = data?.pagination?.nextToken || data?.nextToken || '';
    if (!pageToken || !batch.length) break;
  }
  return { sellerId, marketplaceId, items: items.map(normalizeAmazonListing) };
}

function normalizeAmazonListing(raw) {
  const sku = pick(raw.sku, raw.sellerSku, raw.SellerSKU) || '';
  const summaries = Array.isArray(raw.summaries) ? raw.summaries[0] : raw.summaries;
  const name = pick(summaries?.itemName, summaries?.item_name, raw?.attributes?.item_name?.[0]?.value);
  const asin = pick(summaries?.asin, raw.asin);
  const productType = pick(summaries?.productType, summaries?.product_type, raw.productType, 'PRODUCT');
  const status = pick(summaries?.status, raw.status);

  let quantity = null;
  const fa = raw.fulfillmentAvailability || raw.fulfillment_availability;
  if (Array.isArray(fa) && fa.length) {
    const mfn = fa.find((x) => String(x.fulfillmentChannelCode || x.fulfillment_channel_code || '').toUpperCase() === 'DEFAULT') || fa[0];
    if (mfn?.quantity != null) quantity = Number(mfn.quantity);
  }
  // fallback: attributes.fulfillment_availability
  if (quantity == null) {
    const attrFa = raw?.attributes?.fulfillment_availability;
    if (Array.isArray(attrFa) && attrFa[0]?.quantity != null) quantity = Number(attrFa[0].quantity);
  }

  return {
    sellerSku: String(sku),
    name: name || null,
    asin: asin || null,
    productType: productType || 'PRODUCT',
    status: status || null,
    stock: Number.isFinite(quantity) ? quantity : null,
    raw,
  };
}

async function patchAmazonListingQuantity({ sellerSku, quantity, productType = 'PRODUCT', sellerId = '' }) {
  const { marketplaceId } = amazonCreds();
  const sid = sellerId || (await getAmazonSellerId());
  const sku = encodeURIComponent(String(sellerSku));
  const body = {
    productType: productType || 'PRODUCT',
    patches: [
      {
        op: 'replace',
        path: '/attributes/fulfillment_availability',
        value: [
          {
            fulfillment_channel_code: 'DEFAULT',
            quantity: Math.max(0, Math.round(Number(quantity) || 0)),
          },
        ],
      },
    ],
  };
  return amazonFetch(`/listings/2021-08-01/items/${encodeURIComponent(sid)}/${sku}`, {
    method: 'PATCH',
    query: { marketplaceIds: marketplaceId, issueLocale: 'en_US' },
    body,
  });
}

async function pushAmazonStockUpdates(rows) {
  const sellerId = await getAmazonSellerId();
  const results = [];
  for (const r of rows) {
    try {
      const raw = await patchAmazonListingQuantity({
        sellerId,
        sellerSku: r.sellerSku,
        quantity: r.stock,
        productType: r.productType || 'PRODUCT',
      });
      results.push({
        sellerSku: r.sellerSku,
        stock: r.stock,
        ok: true,
        status: raw?.status || raw?.submissionId || 'ACCEPTED',
      });
    } catch (e) {
      results.push({
        sellerSku: r.sellerSku,
        stock: r.stock,
        ok: false,
        error: e.message || String(e),
      });
    }
  }
  return {
    pushed: results.filter((x) => x.ok).length,
    failed: results.filter((x) => !x.ok).length,
    results,
    sellerId,
  };
}

async function listAmazonOrders({
  days = 30,
  maxResults = 50,
  marketplaceId = '',
  createdAfter = '',
  orderStatuses = '',
} = {}) {
  const { marketplaceId: defaultMp } = amazonCreds();
  const mp = marketplaceId || defaultMp;
  const after = createdAfter || daysAgoIso(days);
  const query = {
    MarketplaceIds: mp,
    CreatedAfter: after,
    MaxResultsPerPage: Math.min(100, Math.max(1, Number(maxResults) || 50)),
  };
  if (orderStatuses) query.OrderStatuses = orderStatuses;

  const data = await amazonFetch('/orders/v0/orders', { query });
  const payload = data?.payload || data;
  const rawOrders = payload?.Orders || payload?.orders || [];
  const orders = (Array.isArray(rawOrders) ? rawOrders : []).map(normalizeAmazonOrder);
  return {
    orders,
    next_token: payload?.NextToken || payload?.nextToken || null,
    marketplace_id: mp,
    created_after: after,
    rawMeta: {
      count: orders.length,
      marketplace_id: mp,
      created_after: after,
    },
  };
}

async function testAmazonConnection() {
  const token = await getAmazonAccessToken({ force: true });
  const marketplaces = await listAmazonMarketplaces();
  let sellerId = cleanEnv(process.env.AMAZON_SELLER_ID || process.env.AMAZON_SELLING_PARTNER_ID) || null;
  let sellerIdError = null;
  if (!sellerId) {
    try {
      sellerId = await getAmazonSellerId();
    } catch (e) {
      sellerIdError = e.message;
    }
  }
  return {
    ok: true,
    has_access_token: Boolean(token),
    marketplaces_count: marketplaces.length,
    marketplaces: marketplaces.map((m) => ({
      id: m?.marketplace?.id || m?.marketplaceId,
      name: m?.marketplace?.name || m?.marketplaceName,
      country: m?.marketplace?.countryCode || m?.countryCode,
      participating: m?.participation?.isParticipating ?? m?.isParticipating,
    })),
    seller_id: sellerId,
    seller_id_error: sellerIdError,
  };
}

module.exports = {
  assertAmazonViewer,
  getAmazonAccessToken,
  amazonFetch,
  listAmazonMarketplaces,
  listAmazonOrders,
  listAmazonListings,
  patchAmazonListingQuantity,
  pushAmazonStockUpdates,
  getAmazonSellerId,
  testAmazonConnection,
  amazonCreds,
};
