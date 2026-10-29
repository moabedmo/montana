// Meta Conversions API helpers — used by api/integrations-status.js (Hobby fn limit)
// and by api/send-telegram.js (server-side Purchase after order insert).
const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');

const API_VERSION = 'v21.0';
const CAPI_TIMEOUT_MS = 8000;

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://ikryeyqrithikabwidov.supabase.co';
const SUPABASE_ANON =
  process.env.SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlrcnlleXFyaXRoaWthYndpZG92Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE3MzY1ODcsImV4cCI6MjA5NzMxMjU4N30.kNfHPxV4fq67cOF8uFsTrLOxPYcLcmmDO3ScIHzI9Uo';

let authClient = null;
let authPromise = null;

async function getAdminSb() {
  const serviceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SERVICE_ROLE || '').trim();
  if (serviceKey) {
    return createClient(SUPABASE_URL, serviceKey);
  }
  if (!authClient) {
    authClient = createClient(SUPABASE_URL, SUPABASE_ANON);
  }
  if (!authPromise) {
    authPromise = authClient.auth.signInWithPassword({
      email: 'owner@montana.com',
      password: 'Mont@na2026',
    }).catch((e) => {
      console.error('getAdminSb auth error:', e?.message || e);
      authPromise = null;
      return null;
    });
  }
  await authPromise;
  return authClient;
}

/**
 * Check if order already had a Purchase CAPI sent (DB ground-truth).
 * Checks meta_purchase_sent_at column first, falling back to [meta_purchase_sent] tag in notes.
 */
async function checkPurchaseAlreadySent(orderId) {
  if (!orderId) return { alreadySent: false, order: null };
  try {
    const admin = await getAdminSb();
    if (!admin) return { alreadySent: false, order: null };

    // Try checking meta_purchase_sent_at column
    try {
      const { data, error } = await admin
        .from('orders')
        .select('id, total, notes, customer_phone, customer_name, meta_purchase_sent_at')
        .eq('id', orderId)
        .maybeSingle();

      if (!error && data) {
        const already = !!(
          data.meta_purchase_sent_at ||
          (data.notes && data.notes.includes('[meta_purchase_sent'))
        );
        return { alreadySent: already, order: data };
      }
    } catch (_) {}

    // Fallback if column does not exist in schema cache
    const { data } = await admin
      .from('orders')
      .select('id, total, notes, customer_phone, customer_name')
      .eq('id', orderId)
      .maybeSingle();

    const already = !!(data && data.notes && data.notes.includes('[meta_purchase_sent'));
    return { alreadySent: already, order: data || null };
  } catch (err) {
    console.error('checkPurchaseAlreadySent error:', err?.message || err);
    return { alreadySent: false, order: null };
  }
}

/**
 * Mark order as having fired Purchase CAPI to guarantee idempotency.
 */
async function markPurchaseSent(orderId, existingNotes) {
  if (!orderId) return false;
  try {
    const admin = await getAdminSb();
    if (!admin) return false;
    const now = new Date().toISOString();

    // 1) Try updating meta_purchase_sent_at column
    try {
      const { error } = await admin
        .from('orders')
        .update({ meta_purchase_sent_at: now })
        .eq('id', orderId);
      if (!error) return true;
    } catch (_) {}

    // 2) Fallback: record flag in notes
    try {
      const tag = `[meta_purchase_sent: ${now}]`;
      const currentNotes = String(existingNotes || '').trim();
      const newNotes = currentNotes ? `${currentNotes} ${tag}` : tag;
      await admin.from('orders').update({ notes: newNotes }).eq('id', orderId);
      return true;
    } catch (_) {}

    return false;
  } catch (err) {
    console.error('markPurchaseSent error:', err?.message || err);
    return false;
  }
}

/**
 * Detect test orders by notes, customer name, or known test phones.
 */
function isTestOrder({ notes, phone, name } = {}) {
  const n = String(notes || '').toLowerCase();
  const nm = String(name || '').toLowerCase();
  const p = String(phone || '').replace(/\D/g, '');

  if (n.includes('test') || n.includes('تجريب') || n.includes('capi-test')) return true;
  if (nm.includes('test') || nm.includes('تجريب') || nm.includes('capi test')) return true;
  if (p === '01012345678' || p === '201012345678' || p === '01000000000' || p === '201000000000') return true;
  return false;
}

function hash(value) {
  if (!value) return undefined;
  return crypto
    .createHash('sha256')
    .update(String(value).trim().toLowerCase())
    .digest('hex');
}

function isSha256Hex(val) {
  return typeof val === 'string' && /^[0-9a-fA-F]{64}$/.test(val.trim());
}

function normalizeAndHash(val, normalizer) {
  if (val == null) return undefined;
  const s = String(val).trim();
  if (!s) return undefined;
  if (isSha256Hex(s)) return s.toLowerCase();
  const transformed = normalizer ? normalizer(s) : s.toLowerCase();
  return transformed ? hash(transformed) : undefined;
}

// Egyptian mobiles arrive as 01xxxxxxxxx → normalize to 20… before hashing.
function hashPhone(phone) {
  if (!phone) return undefined;
  let p = String(phone).replace(/\D/g, '');
  if (p.startsWith('00')) p = p.slice(2);
  if (p.startsWith('0')) p = '20' + p.slice(1);
  if (!p.startsWith('20')) p = '20' + p;
  return hash(p);
}

function splitName(fullName) {
  const parts = String(fullName || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return { firstName: undefined, lastName: undefined };
  if (parts.length === 1) return { firstName: parts[0], lastName: undefined };
  return { firstName: parts[0], lastName: parts.slice(1).join(' ') };
}

function getPublicPixelId() {
  return String(process.env.NEXT_PUBLIC_FB_PIXEL_ID || '').trim() || null;
}

/**
 * Returns client IP in order: cf-connecting-ipv6 → cf-connecting-ip → first entry of x-forwarded-for → x-real-ip.
 * Trims whitespace, returns undefined if empty.
 */
function getClientIp(req) {
  if (!req) return undefined;
  const h = req.headers || {};
  const getH = (name) => {
    const v = h[name.toLowerCase()] || h[name];
    if (typeof v === 'string') {
      const trimmed = v.trim();
      return trimmed.length > 0 ? trimmed : undefined;
    }
    return undefined;
  };

  // 1) Cloudflare IPv6
  const cfIpv6 = getH('cf-connecting-ipv6');
  if (cfIpv6) return cfIpv6;

  // 2) Cloudflare standard IP
  const cfIp = getH('cf-connecting-ip');
  if (cfIp) return cfIp;

  // 3) First entry of x-forwarded-for
  const xff = getH('x-forwarded-for');
  if (xff) {
    const first = xff.split(',')[0].trim();
    if (first.length > 0) return first;
  }

  // 4) x-real-ip
  const realIp = getH('x-real-ip');
  if (realIp) return realIp;

  return undefined;
}

const STANDARD_EVENT_NAMES = {
  PageView: 'PageView',
  ViewContent: 'ViewContent',
  AddToCart: 'AddToCart',
  InitiateCheckout: 'InitiateCheckout',
  Purchase: 'Purchase',
};

function canonicalizeEventName(name) {
  const raw = String(name == null ? '' : name).trim();
  if (STANDARD_EVENT_NAMES[raw]) return STANDARD_EVENT_NAMES[raw];
  const lower = raw.toLowerCase();
  const aliases = {
    pageview: 'PageView',
    viewcontent: 'ViewContent',
    addtocart: 'AddToCart',
    initiatecheckout: 'InitiateCheckout',
    purchase: 'Purchase',
  };
  return aliases[lower] || null;
}

/**
 * Core Graph API send. Soft-fail: never throws to callers that ignore the result.
 * @returns {{ ok: boolean, reason?: string, result?: object }}
 */
async function sendCapiEvent({
  eventName,
  eventId,
  eventSourceUrl,
  customData = {},
  userData = {},
  clientIp,
  userAgent,
  fbp,
  fbc,
  testEventCode,
} = {}) {
  const PIXEL_ID = getPublicPixelId();
  const ACCESS_TOKEN = process.env.FB_CAPI_ACCESS_TOKEN;
  const TEST_EVENT_CODE = testEventCode || process.env.FB_TEST_EVENT_CODE || process.env.TEST_EVENT_CODE;

  if (!PIXEL_ID || !ACCESS_TOKEN) {
    console.error('Meta CAPI env vars missing');
    return { ok: false, reason: 'not_configured' };
  }

  const canonicalName = canonicalizeEventName(eventName);
  if (!canonicalName) {
    console.error('Meta CAPI refused non-standard event_name:', JSON.stringify(eventName));
    return { ok: false, reason: 'non_standard_event', eventName };
  }
  if (!eventId) {
    return { ok: false, reason: 'missing_event' };
  }

  try {
    let finalFbc = fbc;
    if (!finalFbc && eventSourceUrl) {
      try {
        const u = new URL(eventSourceUrl);
        const fbclid = u.searchParams.get('fbclid');
        if (fbclid) {
          finalFbc = `fb.1.${Math.floor(Date.now() / 1000)}.${fbclid}`;
        }
      } catch (_) { /* ignore */ }
    }

    const rawExtId =
      userData.externalId ||
      userData.external_id ||
      (userData.phone ? ('ph_' + String(userData.phone).replace(/\D/g, '')) : undefined);

    const rawPh = userData.ph || userData.phone;
    const phHashed = normalizeAndHash(rawPh, (p) => {
      let clean = String(p).replace(/\D/g, '');
      if (clean.startsWith('00')) clean = clean.slice(2);
      if (clean.startsWith('0')) clean = '20' + clean.slice(1);
      if (!clean.startsWith('20')) clean = '20' + clean;
      return clean;
    });

    const rawFn = userData.fn || userData.firstName;
    const fnHashed = normalizeAndHash(rawFn);

    const rawLn = userData.ln || userData.lastName;
    const lnHashed = normalizeAndHash(rawLn);

    const rawCt = userData.ct || userData.city;
    const ctHashed = normalizeAndHash(rawCt);

    const rawEm = userData.em || userData.email;
    const emHashed = normalizeAndHash(rawEm);

    const rawCountry = userData.country;
    const countryHashed = normalizeAndHash(rawCountry || 'eg');

    const extIdHashed = rawExtId
      ? (isSha256Hex(rawExtId) ? rawExtId.toLowerCase() : hash(rawExtId))
      : undefined;

    const cleanIp = typeof clientIp === 'string' && clientIp.trim().length > 0 ? clientIp.trim() : undefined;

    const user_data = {
      em: emHashed ? [emHashed] : undefined,
      ph: phHashed ? [phHashed] : undefined,
      fn: fnHashed ? [fnHashed] : undefined,
      ln: lnHashed ? [lnHashed] : undefined,
      ct: ctHashed ? [ctHashed] : undefined,
      external_id: extIdHashed ? [extIdHashed] : undefined,
      country: countryHashed ? [countryHashed] : [hash('eg')],
      client_ip_address: cleanIp,
      client_user_agent: (userAgent && String(userAgent).trim()) || undefined,
      fbp: (fbp && String(fbp).trim()) || undefined,
      fbc: (finalFbc && String(finalFbc).trim()) || undefined,
    };

    Object.keys(user_data).forEach((k) => {
      if (user_data[k] === undefined || user_data[k] === '') delete user_data[k];
    });

    const payload = {
      data: [
        {
          event_name: canonicalName,
          event_time: Math.floor(Date.now() / 1000),
          event_id: String(eventId).trim(),
          event_source_url: eventSourceUrl || undefined,
          action_source: 'website',
          user_data,
          custom_data: { currency: 'EGP', ...customData },
        },
      ],
    };

    if (TEST_EVENT_CODE) payload.test_event_code = TEST_EVENT_CODE;

    const metaRes = await fetch(
      `https://graph.facebook.com/${API_VERSION}/${PIXEL_ID}/events?access_token=${encodeURIComponent(ACCESS_TOKEN)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(CAPI_TIMEOUT_MS),
      }
    );

    const result = await metaRes.json().catch(() => ({}));

    if (!metaRes.ok) {
      console.error('Meta CAPI rejected:', JSON.stringify(result));
      return { ok: false, result };
    }

    return { ok: true, result };
  } catch (err) {
    console.error('Meta CAPI send error:', err?.message || err);
    return { ok: false, reason: 'exception', error: String(err?.message || err) };
  }
}

/**
 * Server-side Purchase after order insert with ground-truth DB idempotency.
 * event_id = purchase-${order.id} — must match browser Pixel for dedupe.
 * Skips duplicates if meta_purchase_sent_at is already set.
 * Soft-fail: logs and returns; never throws.
 */
async function sendPurchaseEvent({
  orderId,
  total,
  contentIds = [],
  numItems,
  customerName,
  customerPhone,
  city,
  email,
  eventSourceUrl,
  clientIp,
  userAgent,
  fbp,
  fbc,
  notes,
  isTest,
} = {}) {
  const id = orderId != null ? String(orderId).trim() : '';
  if (!id) {
    console.error('Meta Purchase skipped: missing order.id');
    return { ok: false, reason: 'missing_order_id' };
  }

  // Idempotency check: verify against Supabase orders row
  const { alreadySent, order } = await checkPurchaseAlreadySent(id);
  if (alreadySent) {
    console.log('Meta Purchase (server) skipped: already sent for order', id);
    return { ok: true, skipped: true, reason: 'already_sent' };
  }

  // Test order handling: must use test_event_code or be skipped
  const effectiveNotes = notes || order?.notes || '';
  const effectivePhone = customerPhone || order?.customer_phone || '';
  const effectiveName = customerName || order?.customer_name || '';
  const testOrder = !!isTest || isTestOrder({ notes: effectiveNotes, phone: effectivePhone, name: effectiveName });

  const testEventCode = process.env.FB_TEST_EVENT_CODE || process.env.TEST_EVENT_CODE || null;
  if (testOrder && !testEventCode) {
    console.log('Meta Purchase (server) skipped: test order without TEST_EVENT_CODE for order', id);
    return { ok: true, skipped: true, reason: 'test_order_skipped' };
  }

  const names = splitName(effectiveName);
  const ids = (contentIds || []).map(String).filter(Boolean);
  const itemsCount =
    numItems != null
      ? Number(numItems) || ids.length || 1
      : ids.length || 1;

  // Real dynamic order total (EGP)
  const rawTotal = order?.total != null ? order.total : total;
  const numTotal = Number(rawTotal);
  const realTotal = !isNaN(numTotal) && numTotal > 0 ? Math.round(numTotal * 100) / 100 : 0;

  const result = await sendCapiEvent({
    eventName: 'Purchase',
    eventId: `purchase-${id}`,
    eventSourceUrl: eventSourceUrl || 'https://www.montana.com.eg/order-confirmation.html',
    customData: {
      content_ids: ids,
      content_type: 'product',
      value: realTotal,
      currency: 'EGP',
      num_items: itemsCount,
    },
    userData: {
      phone: effectivePhone || undefined,
      firstName: names.firstName,
      lastName: names.lastName,
      city: city || undefined,
      email: email || undefined,
    },
    clientIp,
    userAgent,
    fbp,
    fbc,
    testEventCode: testOrder ? testEventCode : undefined,
  });

  if (result.ok) {
    await markPurchaseSent(id, effectiveNotes);
  }

  return result;
}

async function handleMetaPublicConfig(req, res) {
  res.setHeader('Cache-Control', 'public, max-age=300');
  return res.status(200).json({ pixelId: getPublicPixelId() });
}

async function handleMetaCapi(req, res) {
  try {
    const body = typeof req.body === 'string'
      ? JSON.parse(req.body || '{}')
      : (req.body || {});
    const {
      eventName,
      eventId,
      eventSourceUrl,
      customData = {},
      userData = {},
      fbp,
      fbc,
    } = body;

    if (!eventName || !eventId) {
      return res.status(200).json({ ok: false, reason: 'missing_event' });
    }

    const canonical = canonicalizeEventName(eventName);

    // Ground-truth idempotency check for Purchase events from client /api/meta-capi calls
    if (canonical === 'Purchase') {
      const orderId = String(eventId).replace(/^purchase-/, '').trim();
      if (orderId) {
        const { alreadySent, order } = await checkPurchaseAlreadySent(orderId);
        if (alreadySent) {
          console.log('Meta CAPI Purchase skipped: already sent for order', orderId);
          return res.status(200).json({ ok: true, skipped: true, reason: 'already_sent' });
        }

        const effectiveNotes = order?.notes || '';
        const effectivePhone = userData.phone || userData.ph || order?.customer_phone || '';
        const effectiveName = userData.name || userData.firstName || order?.customer_name || '';
        const testOrder = isTestOrder({ notes: effectiveNotes, phone: effectivePhone, name: effectiveName });
        const testEventCode = process.env.FB_TEST_EVENT_CODE || process.env.TEST_EVENT_CODE || null;

        if (testOrder && !testEventCode) {
          console.log('Meta CAPI Purchase skipped: test order without TEST_EVENT_CODE for order', orderId);
          return res.status(200).json({ ok: true, skipped: true, reason: 'test_order_skipped' });
        }

        // Use real order total if known from DB
        if (order?.total != null) {
          customData.value = Math.round(Number(order.total) * 100) / 100;
        }
        customData.currency = 'EGP';

        const clientIp = getClientIp(req);
        const h = req.headers || {};
        const result = await sendCapiEvent({
          eventName: 'Purchase',
          eventId,
          eventSourceUrl,
          customData,
          userData,
          clientIp,
          userAgent: h['user-agent'] || h['User-Agent'],
          fbp,
          fbc,
          testEventCode: testOrder ? testEventCode : undefined,
        });

        if (result.ok) {
          await markPurchaseSent(orderId, effectiveNotes);
        }

        return res.status(200).json(result);
      }
    }

    const h = req.headers || {};
    const clientIp = getClientIp(req);

    const result = await sendCapiEvent({
      eventName,
      eventId,
      eventSourceUrl,
      customData,
      userData,
      clientIp,
      userAgent: h['user-agent'] || h['User-Agent'],
      fbp,
      fbc,
    });

    return res.status(200).json(result);
  } catch (err) {
    console.error('Meta CAPI route error:', err?.message || err);
    return res.status(200).json({ ok: false });
  }
}

module.exports = {
  hash,
  hashPhone,
  splitName,
  getPublicPixelId,
  getClientIp,
  canonicalizeEventName,
  sendCapiEvent,
  sendPurchaseEvent,
  checkPurchaseAlreadySent,
  markPurchaseSent,
  isTestOrder,
  handleMetaPublicConfig,
  handleMetaCapi,
};
