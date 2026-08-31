// Meta Conversions API helpers — used by api/integrations-status.js (Hobby fn limit)
// and by api/send-telegram.js (server-side Purchase after order insert).
const crypto = require('crypto');

const API_VERSION = 'v21.0';
const CAPI_TIMEOUT_MS = 8000;

function hash(value) {
  if (!value) return undefined;
  return crypto
    .createHash('sha256')
    .update(String(value).trim().toLowerCase())
    .digest('hex');
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
} = {}) {
  const PIXEL_ID = getPublicPixelId();
  const ACCESS_TOKEN = process.env.FB_CAPI_ACCESS_TOKEN;
  const TEST_EVENT_CODE = process.env.FB_TEST_EVENT_CODE;

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
    const user_data = {
      em: userData.email ? [hash(userData.email)] : undefined,
      ph: userData.phone ? [hashPhone(userData.phone)] : undefined,
      fn: userData.firstName ? [hash(userData.firstName)] : undefined,
      ln: userData.lastName ? [hash(userData.lastName)] : undefined,
      ct: userData.city ? [hash(userData.city)] : undefined,
      country: [hash('eg')],
      client_ip_address: clientIp || undefined,
      client_user_agent: userAgent || undefined,
      fbp: fbp || undefined,
      fbc: fbc || undefined,
    };

    Object.keys(user_data).forEach((k) => {
      if (user_data[k] === undefined) delete user_data[k];
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
 * Server-side Purchase after order insert.
 * event_id = purchase-${order.id} — must match browser Pixel for dedupe.
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
} = {}) {
  const id = orderId != null ? String(orderId).trim() : '';
  if (!id) {
    console.error('Meta Purchase skipped: missing order.id');
    return { ok: false, reason: 'missing_order_id' };
  }

  const names = splitName(customerName);
  const ids = (contentIds || []).map(String).filter(Boolean);
  const itemsCount =
    numItems != null
      ? Number(numItems) || ids.length || 1
      : ids.length || 1;

  return sendCapiEvent({
    eventName: 'Purchase',
    eventId: `purchase-${id}`,
    eventSourceUrl: eventSourceUrl || 'https://www.montana.com.eg/order-confirmation.html',
    customData: {
      content_ids: ids,
      content_type: 'product',
      value: Number(total) || 0,
      currency: 'EGP',
      num_items: itemsCount,
    },
    userData: {
      phone: customerPhone || undefined,
      firstName: names.firstName,
      lastName: names.lastName,
      city: city || undefined,
      email: email || undefined,
    },
    clientIp,
    userAgent,
    fbp,
    fbc,
  });
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

    const h = req.headers || {};
    const fwd = h['x-forwarded-for'] || h['X-Forwarded-For'];
    const clientIp =
      (typeof fwd === 'string' ? fwd.split(',')[0].trim() : undefined) ||
      h['x-real-ip'] ||
      h['X-Real-Ip'] ||
      undefined;

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
  canonicalizeEventName,
  sendCapiEvent,
  sendPurchaseEvent,
  handleMetaPublicConfig,
  handleMetaCapi,
};
