// Bosta create + webhook handlers (invoked from api/send-telegram.js to stay within Vercel fn limit).
const { createClient } = require('@supabase/supabase-js');
const { verifyStoreOrigin, enforceRateLimit } = require('./security');
const { createDelivery, updateDelivery, terminateDelivery, publicWebhookUrl, mapBostaStateToOrderStatus, verifyWebhookToken, getAwb, createPickup } = require('./bosta');

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

async function createBostaShipmentForOrder({
  orderId,
  orderNumber,
  webhookBaseUrl,
  forceUpdate = false,
  customerName,
  customerPhone,
  customerAddress,
  subtotal,
  shippingCost,
  total,
  rows,
}) {
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

  // Sync edited order totals & customer info to Supabase orders table
  const orderPatch = { updated_at: new Date().toISOString() };
  let hasOrderChanges = false;
  if (total != null && !isNaN(Number(total))) { orderPatch.total = Number(total); hasOrderChanges = true; }
  if (subtotal != null && !isNaN(Number(subtotal))) { orderPatch.subtotal = Number(subtotal); hasOrderChanges = true; }
  if (shippingCost != null && !isNaN(Number(shippingCost))) { orderPatch.shipping_cost = Number(shippingCost); hasOrderChanges = true; }
  if (customerName) { orderPatch.customer_name = customerName; hasOrderChanges = true; }
  if (customerPhone) { orderPatch.customer_phone = customerPhone; hasOrderChanges = true; }
  if (customerAddress) { orderPatch.address = customerAddress; hasOrderChanges = true; }

  if (hasOrderChanges) {
    await sb.from('orders').update(orderPatch).eq('id', order.id);
  }

  // Sync edited items to order_items in Supabase
  let items = null;
  if (Array.isArray(rows) && rows.length > 0) {
    try {
      await sb.from('order_items').delete().eq('order_id', order.id);
      const newItems = rows.map(r => ({
        order_id: order.id,
        product_id: r.product_id || null,
        product_name: r.name || 'منتج',
        price: parseFloat(r.pharmacyPrice || r.price) || 0,
        quantity: parseInt(r.qty, 10) || 1,
        total: parseFloat(r.total) || 0,
        product_image: r.image || null,
      }));
      await sb.from('order_items').insert(newItems);
      items = newItems;
    } catch (itErr) {
      console.warn('[bostaHandlers] Error syncing order_items:', itErr.message);
    }
  }

  if (!items) {
    const { data: dbItems, error: iErr } = await sb.from('order_items').select('*').eq('order_id', order.id);
    if (iErr) throw iErr;
    items = dbItems || [];
  }

  // Fetch updated order from DB to guarantee freshest fields (total, address, phone)
  const { data: freshOrder } = await sb.from('orders').select('*').eq('id', order.id).single();
  const currentOrder = freshOrder || order;

  const webhookUrl = publicWebhookUrl(webhookBaseUrl || resolveWebhookBaseUrl());

  if (currentOrder.bosta_delivery_id) {
    if (forceUpdate) {
      console.log(`[bostaHandlers] Force update requested for ${currentOrder.order_number}: terminating old delivery ${currentOrder.bosta_delivery_id}`);
      try {
        await terminateDelivery(currentOrder.bosta_delivery_id);
      } catch (termErr) {
        console.warn(`[bostaHandlers] Termination warning for ${currentOrder.bosta_delivery_id}:`, termErr.message);
      }
      const result = await createDelivery(currentOrder, items, { webhookUrl });
      const patch = {
        bosta_delivery_id: result.deliveryId,
        bosta_tracking_number: result.trackingNumber,
        bosta_status: result.state,
        bosta_sent_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      await sb.from('orders').update(patch).eq('id', currentOrder.id);
      return {
        ok: true,
        updated: true,
        order_id: currentOrder.id,
        order_number: currentOrder.order_number,
        delivery_id: result.deliveryId,
        tracking_number: result.trackingNumber,
        state: result.state,
      };
    }
    return {
      ok: true,
      already: true,
      order_id: currentOrder.id,
      order_number: currentOrder.order_number,
      delivery_id: currentOrder.bosta_delivery_id,
      tracking_number: currentOrder.bosta_tracking_number,
    };
  }
  const result = await createDelivery(currentOrder, items, { webhookUrl });

  const patch = {
    bosta_delivery_id: result.deliveryId,
    bosta_tracking_number: result.trackingNumber,
    bosta_status: result.state,
    bosta_sent_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  if (currentOrder.status === 'confirmed' || currentOrder.status === 'preparing') {
    patch.status = 'shipped';
  }

  const { error: uErr } = await sb.from('orders').update(patch).eq('id', currentOrder.id);
  if (uErr) throw uErr;

  return {
    ok: true,
    order_id: currentOrder.id,
    order_number: currentOrder.order_number,
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

  const orderId = Number(req.body?.order_id) || null;
  const orderNumber = req.body?.order_number || null;
  if (!orderId && !orderNumber) return res.status(400).json({ ok: false, error: 'order_id or order_number required' });

  const forceUpdate = Boolean(req.body?.force_update || req.body?.update);

  try {
    const result = await createBostaShipmentForOrder({
      orderId,
      orderNumber,
      webhookBaseUrl: resolveWebhookBaseUrl(req),
      forceUpdate,
      customerName: req.body?.customer_name,
      customerPhone: req.body?.customer_phone,
      customerAddress: req.body?.customer_address,
      subtotal: req.body?.subtotal,
      shippingCost: req.body?.shipping_cost,
      total: req.body?.total,
      rows: req.body?.rows,
    });
    return res.json({
      ok: true,
      already: !!result.already,
      updated: !!result.updated,
      order_id: result.order_id,
      order_number: result.order_number,
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

async function handleBostaAwb(req, res) {
  try {
    const orderId = req.query?.order_id || req.body?.order_id;
    const orderNumber = req.query?.order_number || req.body?.order_number;
    const deliveryId = req.query?.id || req.query?.delivery_id || req.body?.delivery_id;

    let targetDeliveryId = null;

    // Always fetch fresh live delivery from database if order is specified
    if ((orderId || orderNumber) && hasServiceRole) {
      let q = sb.from('orders').select('id, order_number, bosta_delivery_id, bosta_tracking_number');
      if (orderId) q = q.eq('id', orderId);
      else if (orderNumber) q = q.eq('order_number', orderNumber);
      const { data: order } = await q.maybeSingle();
      if (order?.bosta_delivery_id || order?.bosta_tracking_number) {
        targetDeliveryId = order.bosta_delivery_id || order.bosta_tracking_number;
      } else if (order) {
        const created = await createBostaShipmentForOrder({
          orderId: order.id,
          webhookBaseUrl: resolveWebhookBaseUrl(req),
        });
        targetDeliveryId = created.delivery_id || created.tracking_number;
      }
    }

    if (!targetDeliveryId) {
      targetDeliveryId = deliveryId;
    }

    if (!targetDeliveryId) {
      return res.status(400).json({ ok: false, error: 'delivery_id or order_id required' });
    }
    const awbData = await getAwb(targetDeliveryId);
    if (!awbData) {
      return res.status(404).json({ ok: false, error: 'AWB not found' });
    }
    if (req.query?.json === 'true' || req.headers?.accept?.includes('application/json')) {
      return res.json({ ok: true, delivery_id: targetDeliveryId, data: awbData });
    }
    const pdfBuffer = Buffer.from(awbData, 'base64');
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="awb-${targetDeliveryId}.pdf"`);
    res.setHeader('Content-Length', pdfBuffer.length);
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.setHeader('Surrogate-Control', 'no-store');
    return res.end(pdfBuffer);
  } catch (err) {
    console.error('bosta-awb:', err.message);
    const status = err.status && err.status >= 400 && err.status < 600 ? err.status : 500;
    return res.status(status).json({ ok: false, error: err.message || 'Failed to fetch AWB' });
  }
}

async function handleBostaPickup(req, res) {
  try {
    if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
    verifyStoreOrigin(req);
    enforceRateLimit(req, 'bosta-pickup', { windowMs: 60_000, max: 10 });
    const { scheduledDate, scheduledTimeSlot, notes } = req.body || {};
    const result = await createPickup({ scheduledDate, scheduledTimeSlot, notes });
    return res.json({
      ok: true,
      pickup: result,
      puid: result?.puid,
      scheduledDate: result?.scheduledDate,
      message: 'تم حجز موعد المندوب بنجاح'
    });
  } catch (err) {
    console.error('bosta-pickup:', err.message, err.data || '');
    return res.status(err.status || 500).json({ ok: false, error: err.message });
  }
}

module.exports = {
  handleBostaCreate,
  handleBostaWebhook,
  handleBostaAwb,
  handleBostaPickup,
  createBostaShipmentForOrder,
  autoSendOrderToBosta,
  resolveWebhookBaseUrl,
  isBostaAutoSendEnabled,
};

