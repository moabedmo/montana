// Bosta create + webhook handlers (invoked from api/send-telegram.js to stay within Vercel fn limit).
const { createClient } = require('@supabase/supabase-js');
const { verifyStoreOrigin, enforceRateLimit } = require('./security');
const { createDelivery, publicWebhookUrl, mapBostaStateToOrderStatus, verifyWebhookToken } = require('./bosta');

const SB_URL = process.env.SUPABASE_URL || 'https://ikryeyqrithikabwidov.supabase.co';
const SB_ANON = process.env.SUPABASE_ANON_KEY
  || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlrcnlleXFyaXRoaWthYndpZG92Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE3MzY1ODcsImV4cCI6MjA5NzMxMjU4N30.kNfHPxV4fq67cOF8uFsTrLOxPYcLcmmDO3ScIHzI9Uo';
const SB_SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY
  || process.env.SERVICE_ROLE
  || SB_ANON;

const sb = createClient(SB_URL, SB_SERVICE);
const hasServiceRole = !!(process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SERVICE_ROLE);

function isBostaAutoSendEnabled() {
  if (!process.env.BOSTA_API_KEY) return false;
  if (process.env.BOSTA_AUTO_SEND === 'false') return false;
  return true;
}

function resolveWebhookBaseUrl(reqOrUrl) {
  if (typeof reqOrUrl === 'string') return reqOrUrl.replace(/\/$/, '');
  if (reqOrUrl?.headers) {
    const host = reqOrUrl.headers['x-forwarded-host'] || reqOrUrl.headers.host || 'www.montana.com.eg';
    const proto = reqOrUrl.headers['x-forwarded-proto'] || 'https';
    return `${proto}://${host}`;
  }
  if (process.env.SITE_URL) return process.env.SITE_URL.replace(/\/$/, '');
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return 'https://www.montana.com.eg';
}

async function createBostaShipmentForOrder({ orderId, orderNumber, webhookBaseUrl }) {
  if (!process.env.BOSTA_API_KEY) {
    const err = new Error('BOSTA_API_KEY not configured on server');
    err.status = 503;
    throw err;
  }
  if (!hasServiceRole) {
    const err = new Error('SERVICE_ROLE / SUPABASE_SERVICE_ROLE_KEY required for Bosta sync');
    err.status = 503;
    throw err;
  }

  let query = sb.from('orders').select('*');
  if (orderId) query = query.eq('id', orderId);
  else if (orderNumber) query = query.eq('order_number', orderNumber);
  else {
    const err = new Error('order_id or order_number required');
    err.status = 400;
    throw err;
  }

  const { data: order, error: oErr } = await query.maybeSingle();
  if (oErr) throw oErr;
  if (!order) {
    const err = new Error('Order not found');
    err.status = 404;
    throw err;
  }

  if (order.bosta_delivery_id) {
    return {
      ok: true,
      already: true,
      order_id: order.id,
      order_number: order.order_number,
      delivery_id: order.bosta_delivery_id,
      tracking_number: order.bosta_tracking_number,
    };
  }

  const { data: items, error: iErr } = await sb.from('order_items').select('*').eq('order_id', order.id);
  if (iErr) throw iErr;

  const webhookUrl = publicWebhookUrl(webhookBaseUrl || resolveWebhookBaseUrl());
  const result = await createDelivery(order, items || [], { webhookUrl });

  const patch = {
    bosta_delivery_id: result.deliveryId,
    bosta_tracking_number: result.trackingNumber,
    bosta_status: result.state,
    bosta_sent_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  if (order.status === 'confirmed' || order.status === 'preparing') {
    patch.status = 'shipped';
  }

  const { error: uErr } = await sb.from('orders').update(patch).eq('id', order.id);
  if (uErr) throw uErr;

  return {
    ok: true,
    order_id: order.id,
    order_number: order.order_number,
    delivery_id: result.deliveryId,
    tracking_number: result.trackingNumber,
    state: result.state,
  };
}

/** Fire-and-forget safe wrapper — never throws; logs Bosta rejections (e.g. demo account). */
async function autoSendOrderToBosta({ orderId, orderNumber, webhookBaseUrl }) {
  if (!isBostaAutoSendEnabled()) return { skipped: true, reason: 'disabled' };
  if (!hasServiceRole) return { skipped: true, reason: 'no_service_role' };
  try {
    const result = await createBostaShipmentForOrder({ orderId, orderNumber, webhookBaseUrl });
    if (result.ok && !result.already) {
      console.log('bosta-auto-send: ok', result.order_number, result.tracking_number || result.delivery_id);
    }
    return result;
  } catch (err) {
    console.error('bosta-auto-send:', orderNumber || orderId, err.message, err.data || '');
    return { ok: false, error: err.message };
  }
}

async function handleBostaCreate(req, res) {
  try {
    verifyStoreOrigin(req);
    enforceRateLimit(req, 'bosta-create', { windowMs: 60_000, max: 20 });
  } catch (err) {
    return res.status(err.status || 403).json({ ok: false, error: err.message });
  }

  if (!process.env.BOSTA_API_KEY) {
    return res.status(503).json({ ok: false, error: 'BOSTA_API_KEY not configured on server' });
  }
  if (!hasServiceRole) {
    return res.status(503).json({ ok: false, error: 'SERVICE_ROLE / SUPABASE_SERVICE_ROLE_KEY required for Bosta sync' });
  }

  const orderId = Number(req.body?.order_id);
  if (!orderId) return res.status(400).json({ ok: false, error: 'order_id required' });

  try {
    const result = await createBostaShipmentForOrder({
      orderId,
      webhookBaseUrl: resolveWebhookBaseUrl(req),
    });
    return res.json({
      ok: true,
      already: !!result.already,
      delivery_id: result.delivery_id,
      tracking_number: result.tracking_number,
      state: result.state,
    });
  } catch (err) {
    console.error('bosta-create:', err.message, err.data || '');
    const status = err.status && err.status >= 400 && err.status < 600 ? err.status : 500;
    return res.status(status).json({ ok: false, error: err.message || 'Bosta request failed' });
  }
}

async function handleBostaWebhook(req, res) {
  try {
    if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

    const token = req.query?.token
      || req.headers['x-bosta-token']
      || (typeof req.headers.authorization === 'string' && req.headers.authorization.replace(/^Bearer\s+/i, ''));
    if (!verifyWebhookToken(token)) {
      return res.status(401).json({ ok: false, error: 'Invalid webhook token' });
    }

    const body = req.body || {};
    const deliveryId = body._id || body.id || body.deliveryId;
    const trackingNumber = body.trackingNumber || body.tracking_number;
    const businessReference = body.businessReference || body.business_reference;
    const state = body.state?.code ?? body.stateCode ?? body.state;

    if (hasServiceRole && (businessReference || deliveryId)) {
      let query = sb.from('orders').select('id, status, order_number');
      if (businessReference) query = query.eq('order_number', businessReference);
      else query = query.eq('bosta_delivery_id', deliveryId);

      const { data: order } = await query.maybeSingle();
      if (order) {
        const nextStatus = mapBostaStateToOrderStatus(state);
        const patch = { updated_at: new Date().toISOString() };
        if (deliveryId) patch.bosta_delivery_id = deliveryId;
        if (trackingNumber) patch.bosta_tracking_number = trackingNumber;
        patch.bosta_status = String(body.state?.value || body.state || state || '');
        if (nextStatus) patch.status = nextStatus;

        await sb.from('orders').update(patch).eq('id', order.id);

        if (nextStatus === 'delivered') {
          try {
            await sb.rpc('award_order_rewards', { p_order_id: order.id });
          } catch { /* optional */ }
        }
      }
    }

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('bosta-webhook:', err.message);
    return res.status(200).json({ ok: true, warning: err.message });
  }
}

module.exports = {
  handleBostaCreate,
  handleBostaWebhook,
  createBostaShipmentForOrder,
  autoSendOrderToBosta,
  resolveWebhookBaseUrl,
  isBostaAutoSendEnabled,
};
