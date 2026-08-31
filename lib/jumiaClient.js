// Jumia Vendor API client — orders (and later stock).
const {
  jumiaCreds,
  requestClientCredentialsToken,
  refreshAccessToken,
} = require('./jumiaAuth');
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://ikryeyqrithikabwidov.supabase.co';
const SUPABASE_ANON =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlrcnlleXFyaXRoaWthYndpZG92Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE3MzY1ODcsImV4cCI6MjA5NzMxMjU4N30.kNfHPxV4fq67cOF8uFsTrLOxPYcLcmmDO3ScIHzI9Uo';
const BASE = process.env.JUMIA_API_BASE || 'https://vendor-api.jumia.com';

let _tokenCache = { access: '', refresh: '', expiresAt: 0 };

function userClient(token) {
  return createClient(SUPABASE_URL, SUPABASE_ANON, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
}

async function assertJumiaViewer(accessToken) {
  if (!accessToken) {
    const err = new Error('Unauthorized');
    err.status = 401;
    throw err;
  }
  const sb = userClient(accessToken);
  const checks = await Promise.all([
    sb.rpc('is_owner'),
    sb.rpc('is_store_admin'),
  ]);
  const ok = checks.some((r) => !r.error && r.data === true);
  if (!ok) {
    const err = new Error('Owner or admin access required');
    err.status = 403;
    throw err;
  }
  const { data: userData } = await sb.auth.getUser();
  return { userId: userData?.user?.id || null };
}

async function getJumiaAccessToken({ force = false } = {}) {
  const now = Date.now();
  if (!force && _tokenCache.access && _tokenCache.expiresAt > now + 60_000) {
    return _tokenCache.access;
  }

  const { clientId, clientSecret } = jumiaCreds();
  const refreshEnv = String(process.env.JUMIA_REFRESH_TOKEN || '').trim();
  const refresh = refreshEnv || clientSecret;
  if (!clientId || !refresh) {
    const err = new Error('Jumia credentials missing (JUMIA_CLIENT_ID + secret/token)');
    err.status = 503;
    throw err;
  }

  // Preferred path for Egypt self-auth: secret field == refresh token
  try {
    const data = await refreshAccessToken(refresh);
    _tokenCache = {
      access: data.access_token,
      refresh: data.refresh_token || refresh,
      expiresAt: now + Number(data.expires_in || 3600) * 1000,
    };
    return _tokenCache.access;
  } catch {
    const probed = await requestClientCredentialsToken();
    if (!probed.ok || !probed.token?.access_token) {
      const detail = (probed.results || []).map((r) => `${r.label}:${r.error || r.status}`).join(', ');
      const err = new Error(`Jumia token failed (${detail || 'unknown'})`);
      err.status = 502;
      throw err;
    }
    _tokenCache = {
      access: probed.token.access_token,
      refresh: probed.token.refresh_token || refresh,
      expiresAt: now + Number(probed.token.expires_in || 3600) * 1000,
    };
    return _tokenCache.access;
  }
}

async function jumiaFetch(path, { method = 'GET', query, body, retry = true } = {}) {
  const token = await getJumiaAccessToken();
  const url = new URL(path.startsWith('http') ? path : `${BASE}${path}`);
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
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (res.status === 401 && retry) {
    await getJumiaAccessToken({ force: true });
    return jumiaFetch(path, { method, query, body, retry: false });
  }
  const text = await res.text();
  let data = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { raw: text };
  }
  if (!res.ok) {
    const err = new Error(data.message || data.error || text || `HTTP ${res.status}`);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

function daysAgoIso(days) {
  const d = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  return d.toISOString();
}

function pick(...vals) {
  for (const v of vals) {
    if (v != null && v !== '') return v;
  }
  return null;
}

function normalizeJumiaOrder(raw) {
  const id = pick(raw.id, raw.orderId, raw.order_id, raw.number, raw.orderNumber);
  const items = Array.isArray(raw.items)
    ? raw.items
    : Array.isArray(raw.orderItems)
      ? raw.orderItems
      : Array.isArray(raw.products)
        ? raw.products
        : [];
  const money = pick(
    raw.grandTotal,
    raw.grand_total,
    raw.total,
    raw.price,
    raw.amount,
    raw?.payment?.amount,
    raw?.totals?.grandTotal
  );
  const currency = pick(raw.currency, raw.currencyCode, raw?.payment?.currency, 'EGP');
  const status = pick(raw.status, raw.orderStatus, raw.state, '—');
  const created = pick(raw.createdAt, raw.created_at, raw.created, raw.date, raw.orderedAt);
  const customer = pick(raw.customer, raw.buyer, raw.shippingAddress, raw.address) || {};
  const name = pick(
    customer.name,
    customer.fullName,
    customer.customerName,
    [customer.firstName, customer.lastName].filter(Boolean).join(' '),
    raw.customerName,
    raw.buyerName
  );
  const phone = pick(customer.phone, customer.phoneNumber, customer.mobile, raw.customerPhone);
  const country = pick(raw.country, raw.countryCode, raw.marketplace, customer.country);
  return {
    id: id != null ? String(id) : null,
    status: status != null ? String(status) : '—',
    total: money != null ? Number(money) : null,
    currency: currency || 'EGP',
    created_at: created || null,
    customer_name: name || '—',
    customer_phone: phone || '',
    country: country || '',
    items_count: items.length || Number(raw.itemsCount || raw.items_count || 0) || null,
    raw,
  };
}

async function listJumiaShops() {
  const data = await jumiaFetch('/shops');
  if (Array.isArray(data)) return data;
  if (Array.isArray(data.shops)) return data.shops;
  if (Array.isArray(data.data)) return data.data;
  return [];
}

async function listJumiaOrders({
  days = 30,
  size = 50,
  status = '',
  country = '',
  shopId = '',
  token = '',
  createdAfter = '',
  createdBefore = '',
} = {}) {
  const query = {
    size: Math.min(Math.max(Number(size) || 50, 1), 100),
    sort: 'DESC',
  };
  if (status) query.status = status;
  if (country) query.country = country;
  if (shopId) query.shop_id = shopId;
  if (token) {
    query.token = token;
    query.nextToken = token;
  }
  query.created_after = createdAfter || daysAgoIso(Number(days) || 30);
  if (createdBefore) query.created_before = createdBefore;

  const data = await jumiaFetch('/orders', { query });
  const rows = Array.isArray(data)
    ? data
    : Array.isArray(data.orders)
      ? data.orders
      : Array.isArray(data.data)
        ? data.data
        : Array.isArray(data.items)
          ? data.items
          : [];

  return {
    orders: rows.map(normalizeJumiaOrder).filter((o) => o.id),
    nextToken: data.nextToken || data.next_token || data.token || null,
    isLastPage: data.isLastPage == null ? !data.nextToken : !!data.isLastPage,
    rawMeta: {
      count: rows.length,
      created_after: query.created_after,
    },
  };
}

async function getJumiaOrderItems(orderIds = []) {
  const ids = (Array.isArray(orderIds) ? orderIds : [orderIds]).filter(Boolean).map(String);
  if (!ids.length) return [];
  const data = await jumiaFetch('/orders/items', { query: { order_ids: ids } });
  if (Array.isArray(data)) return data;
  if (Array.isArray(data.items)) return data.items;
  if (Array.isArray(data.orderItems)) return data.orderItems;
  return [];
}

function extractProductRows(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.products)) return data.products;
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data?.items)) return data.items;
  return [];
}

function normalizeJumiaStockRow(raw) {
  const id = pick(raw.id, raw.productSid, raw.product_sid, raw.sid);
  const sellerSku = pick(raw.sellerSku, raw.seller_sku, raw.sku);
  const stock = pick(raw.globalStock, raw.global_stock, raw.stock, raw.quantity, raw.available);
  const name = pick(raw.name, raw.title, raw.productName);
  return {
    id: id != null ? String(id) : null,
    sellerSku: sellerSku != null ? String(sellerSku) : null,
    stock: stock != null ? Number(stock) : null,
    name: name || null,
    lastStockUpdatedAt: pick(raw.lastStockUpdatedAt, raw.last_stock_updated_at, raw.updatedAt) || null,
    raw,
  };
}

async function listJumiaCatalogStock({ size = 100, token = '', shopId = '' } = {}) {
  const all = [];
  let next = token || '';
  let pages = 0;
  let isLastPage = false;
  do {
    const query = { size: Math.min(Math.max(Number(size) || 100, 1), 100) };
    if (shopId) query.shopId = shopId;
    if (next) {
      query.nextToken = next;
      query.token = next;
    }
    const data = await jumiaFetch('/catalog/stock', { query });
    const rows = extractProductRows(data).map(normalizeJumiaStockRow).filter((r) => r.sellerSku || r.id);
    all.push(...rows);
    next = data.nextToken || data.next_token || null;
    isLastPage = data.isLastPage == null ? !next : !!data.isLastPage;
    pages += 1;
  } while (next && !isLastPage && pages < 20);
  return {
    products: all,
    nextToken: next,
    isLastPage: isLastPage || !next,
  };
}

async function listJumiaCatalogProducts({ size = 50, token = '', shopId = '' } = {}) {
  const all = [];
  let next = token || '';
  let pages = 0;
  let isLastPage = false;
  do {
    const query = { size: Math.min(Math.max(Number(size) || 50, 1), 100) };
    if (shopId) query.shopId = shopId;
    if (next) {
      query.nextToken = next;
      query.token = next;
    }
    const data = await jumiaFetch('/catalog/products', { query });
    const rows = extractProductRows(data);
    for (const p of rows) {
      const variations = Array.isArray(p.variations) ? p.variations : [p];
      for (const v of variations) {
        const id = pick(v.id, v.productSid, p.id, p.productSid);
        const sellerSku = pick(v.sellerSku, v.seller_sku, p.sellerSku);
        const name = pick(v.name, p.name, p.title);
        const stock = pick(v.stock, v.quantity, p.stock, p.globalStock);
        all.push({
          id: id != null ? String(id) : null,
          sellerSku: sellerSku != null ? String(sellerSku) : null,
          name: name || null,
          stock: stock != null ? Number(stock) : null,
          raw: v === p ? p : { ...p, variation: v },
        });
      }
    }
    next = data.nextToken || data.next_token || null;
    isLastPage = data.isLastPage == null ? !next : !!data.isLastPage;
    pages += 1;
  } while (next && !isLastPage && pages < 20);
  return { products: all.filter((p) => p.sellerSku || p.id), nextToken: next, isLastPage: isLastPage || !next };
}

async function pushJumiaStockFeed(products = []) {
  const payload = {
    products: (products || [])
      .map((p) => ({
        sellerSku: String(p.sellerSku || p.seller_sku || ''),
        id: String(p.id || p.productSid || ''),
        stock: Math.max(0, Math.floor(Number(p.stock) || 0)),
      }))
      .filter((p) => p.sellerSku && p.id),
  };
  if (!payload.products.length) {
    const err = new Error('No stock rows to push (need sellerSku + product id)');
    err.status = 400;
    throw err;
  }
  const data = await jumiaFetch('/feeds/products/stock', { method: 'POST', body: payload });
  return {
    feedId: data.feedId || data.feed_id || data.id || null,
    raw: data,
    pushed: payload.products.length,
  };
}

async function getJumiaFeed(feedId) {
  if (!feedId) {
    const err = new Error('feedId required');
    err.status = 400;
    throw err;
  }
  return jumiaFetch(`/feeds/${encodeURIComponent(feedId)}`);
}

module.exports = {
  assertJumiaViewer,
  getJumiaAccessToken,
  jumiaFetch,
  listJumiaShops,
  listJumiaOrders,
  getJumiaOrderItems,
  normalizeJumiaOrder,
  listJumiaCatalogStock,
  listJumiaCatalogProducts,
  pushJumiaStockFeed,
  getJumiaFeed,
};
