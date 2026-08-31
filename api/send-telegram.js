// Notifies the store admin via Telegram when an order is placed or proof attached.
const { createClient } = require('@supabase/supabase-js');
const { enforceRateLimit, verifyStoreOrigin, isSafeHttpUrl, hasValidApiSecret } = require('../lib/security');
const { notifyTelegramOrder } = require('../lib/telegramOrderNotify');
const { confirmOrderByNumber, notifyCustomerOrderConfirmed } = require('../lib/orderConfirm');
const { autoSendOrderToBosta, resolveWebhookBaseUrl } = require('../lib/bostaHandlers');
const { handleBostaCreate, handleBostaWebhook } = require('../lib/bostaHandlers');
const { sendPurchaseEvent } = require('../lib/metaCapi');

const sb = createClient(
  process.env.SUPABASE_URL || 'https://ikryeyqrithikabwidov.supabase.co',
  process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlrcnlleXFyaXRoaWthYndpZG92Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE3MzY1ODcsImV4cCI6MjA5NzMxMjU4N30.kNfHPxV4fq67cOF8uFsTrLOxPYcLcmmDO3ScIHzI9Uo'
);

const SB_PUBLIC = process.env.SUPABASE_URL || 'https://ikryeyqrithikabwidov.supabase.co';

async function uploadProofBuffer(buffer, mime, phoneHint) {
  const ext = /png/i.test(mime || '') ? 'png' : /webp/i.test(mime || '') ? 'webp' : 'jpg';
  const hint = String(phoneHint || 'order').replace(/[^\d]/g, '') || 'order';
  const key = `payment-proofs/${Date.now()}_${hint}.${ext}`;
  const { error } = await sb.storage.from('montana').upload(key, buffer, {
    contentType: mime || 'image/jpeg',
    upsert: false,
  });
  if (error) throw new Error(error.message || 'storage upload failed');
  return `${SB_PUBLIC}/storage/v1/object/public/montana/${key}`;
}

function clientIpFromReq(req) {
  const h = req.headers || {};
  const fwd = h['x-forwarded-for'] || h['X-Forwarded-For'];
  return (
    (typeof fwd === 'string' ? fwd.split(',')[0].trim() : undefined) ||
    h['x-real-ip'] ||
    h['X-Real-Ip'] ||
    undefined
  );
}

/** Fire Purchase CAPI after a new order — soft-fail, never throws. */
async function firePurchaseTracking(req, body) {
  try {
    if (body.attach_proof || body.is_proof_update || body.confirm_order_number) return;
    const orderId = body.order_id ?? body.orderId;
    if (orderId == null || orderId === '') return;

    const contentIds = Array.isArray(body.content_ids)
      ? body.content_ids
      : Array.isArray(body.items)
        ? body.items.map((i) => i.slug || i.product_slug || i.product_id || i.id).filter(Boolean)
        : [];

    const numItems = Array.isArray(body.items)
      ? body.items.reduce((s, i) => s + (Number(i.qty || i.quantity) || 1), 0)
      : undefined;

    const r = await sendPurchaseEvent({
      orderId,
      total: body.total,
      contentIds,
      numItems,
      customerName: body.customer_name,
      customerPhone: body.customer_phone || body.phone,
      city: body.city || body.governorate,
      email: body.customer_email || body.email,
      eventSourceUrl: body.event_source_url || 'https://www.montana.com.eg/checkout.html',
      clientIp: clientIpFromReq(req),
      userAgent: req.headers?.['user-agent'] || req.headers?.['User-Agent'],
      fbp: body.fbp,
      fbc: body.fbc,
    });
    if (!r?.ok) console.error('Meta Purchase (server) soft-fail:', JSON.stringify(r));
    else console.log('Meta Purchase (server) ok:', `purchase-${orderId}`);
  } catch (err) {
    console.error('Meta Purchase (server) exception:', err?.message || err);
  }
}

module.exports = async (req, res) => {
  const routeAction = req.query?.action;
  if (routeAction === 'bosta-webhook') return handleBostaWebhook(req, res);
  if (routeAction === 'bosta-create') {
    if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
    return handleBostaCreate(req, res);
  }

  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  // Trusted external senders (ManyChat forwarding a customer's payment-proof
  // photo, same as api/chat.js's own bypass) authenticate via X-Montana-Secret
  // instead of the browser-style origin check below, since a server-to-server
  // call from ManyChat never carries a matching Origin/Referer.
  const trusted = hasValidApiSecret(req);
  if (!trusted) {
    try {
      verifyStoreOrigin(req);
    } catch (err) {
      return res.status(err.status || 403).json({ ok: false, error: err.message });
    }
  }

  try {
    const body = req.body || {};
    try {
      enforceRateLimit(req, 'send-telegram', {
        windowMs: 60_000,
        max: body.attach_proof ? 60 : 30,
      });
    } catch (err) {
      return res.status(err.status || 429).json({ ok: false, error: err.message });
    }

    // One-shot connectivity check → current TELEGRAM_CHAT_ID
    if (body.ping === true || routeAction === 'ping') {
      const token = process.env.TELEGRAM_BOT_TOKEN;
      const chatId = process.env.TELEGRAM_CHAT_ID;
      if (!token || !chatId) {
        return res.status(503).json({ ok: false, error: 'telegram_not_configured' });
      }
      const meRes = await fetch(`https://api.telegram.org/bot${token}/getMe`, {
        signal: AbortSignal.timeout(8000),
      });
      const me = await meRes.json().catch(() => ({}));
      const botUsername = me?.result?.username || null;
      const { sendOrderTelegramMessage } = require('../lib/telegramApi');
      const data = await sendOrderTelegramMessage(
        token,
        chatId,
        'اختبار إشعار مونتانا ✅\nلو الرسالة دي وصلك يبقى الرقم الجديد شغال 💜',
        null,
        false
      );
      if (!data?.ok) {
        console.error('telegram ping failed:', data);
        return res.status(502).json({
          ok: false,
          error: data?.description || 'telegram_send_failed',
          chat_id_suffix: String(chatId).slice(-4),
          bot_username: botUsername,
          hint: botUsername
            ? `افتح t.me/${botUsername} من الأكونت الجديد واضغط Start ثم أعد الاختبار`
            : 'افتح بوت مونتانا من الأكونت الجديد واضغط Start',
        });
      }
      return res.json({
        ok: true,
        ping: true,
        chat_id_suffix: String(chatId).slice(-4),
        bot_username: botUsername,
      });
    }

    // Admin-panel "confirm order" button — same confirm+notify-customer
    // path the Telegram inline button already uses, so both routes behave
    // identically regardless of which one the admin happens to use.
    if (body.confirm_order_number) {
      if (!/^MON-\d{5}$/.test(body.confirm_order_number)) {
        return res.status(400).json({ ok: false, error: 'invalid_order_number' });
      }
      const result = await confirmOrderByNumber(body.confirm_order_number);
      if (!result.ok) return res.json({ ok: false, error: result.error });
      if (result.already) return res.json({ ok: true, already: true, order_number: body.confirm_order_number });
      const notify = await notifyCustomerOrderConfirmed(result);
      autoSendOrderToBosta({
        orderNumber: body.confirm_order_number,
        webhookBaseUrl: resolveWebhookBaseUrl(req),
      }).catch(() => {});
      return res.json({ ok: true, order_number: body.confirm_order_number, notify });
    }

    // Owner alerts from the admin / CRM screens: a new pharmacy invoice, an
    // order cancelled or returned. Nothing is sent for statuses that are just
    // the order moving along normally — see ALERTING_ORDER_STATUSES.
    if (body.admin_alert) {
      const { formatAdminAlert } = require('../lib/adminAlerts');
      const { sendOrderTelegramMessage } = require('../lib/telegramApi');
      const token = process.env.TELEGRAM_BOT_TOKEN;
      const chatId = process.env.TELEGRAM_CHAT_ID;
      if (!token || !chatId) return res.json({ ok: false, error: 'telegram_not_configured' });
      const text = formatAdminAlert(String(body.admin_alert), body);
      if (!text) return res.json({ ok: true, skipped: true });
      const sent = await sendOrderTelegramMessage(token, chatId, text, null, false);
      return res.json({ ok: !!sent?.ok, error: sent?.ok ? null : (sent?.error || sent?.description || null) });
    }

    const {
      order_number,
      total,
      customer_name,
      customer_phone,
      phone,
      payment_proof_url,
      deposit_amount,
      payment_method,
      points_redeemed,
      is_proof_update,
      attach_proof,
      chat_session_id,
      proof_base64,
      proof_mime,
    } = body;

    let notifyTotal = total;
    let notifyMethod = payment_method;
    let notifyPhone = customer_phone || phone;
    let notifyName = customer_name;
    let attachStatus = null;
    let proofUrl = payment_proof_url;
    let proofBuffer = null;
    let proofMime = proof_mime;

    if (attach_proof) {
      if (!order_number || !/^MON-\d{5}$/.test(order_number)) {
        return res.status(400).json({ ok: false, error: 'Invalid order_number' });
      }

      if (proof_base64) {
        try {
          proofBuffer = Buffer.from(String(proof_base64), 'base64');
          if (!proofBuffer.length) return res.status(400).json({ ok: false, error: 'empty_file' });
          if (proofBuffer.length > 4_000_000) return res.status(400).json({ ok: false, error: 'file_too_large' });
          proofUrl = await uploadProofBuffer(proofBuffer, proof_mime, notifyPhone);
        } catch (e) {
          console.error('send-telegram storage:', e.message);
          return res.status(500).json({ ok: false, error: 'storage_failed' });
        }
      }

      if (!proofUrl || !isSafeHttpUrl(proofUrl)) {
        return res.status(400).json({ ok: false, error: 'Invalid payment_proof_url' });
      }

      const { data: status, error: attachError } = await sb.rpc('attach_payment_proof_smart', {
        p_order_number: order_number,
        p_payment_proof_url: proofUrl,
        p_deposit_amount: deposit_amount ?? 200,
        p_session_id: chat_session_id ? String(chat_session_id).slice(0, 64) : null,
        p_phone: notifyPhone || null,
      });

      attachStatus = status;

      if (attachError) {
        console.error('send-telegram attach:', attachError.message);
        return res.status(500).json({ ok: false, error: 'attach_failed' });
      }
      if (!status?.found) {
        return res.status(404).json({ ok: false, error: status?.error || 'order_not_found' });
      }

      notifyTotal = status.total;
      notifyMethod = status.payment_method || 'cod';
      if (!notifyName && status.customer_name) notifyName = status.customer_name;
      if (!notifyPhone && status.customer_phone) notifyPhone = status.customer_phone;
    }

    // New COD/wallet/card order notify — fire Purchase CAPI here so tracking
    // does not depend on the confirmation page / sessionStorage (FB in-app).
    // Awaited (soft-fail) so Vercel does not freeze the isolate before Meta responds.
    if (!attach_proof && !is_proof_update && order_number) {
      await firePurchaseTracking(req, body);
    }

    const data = await notifyTelegramOrder({
      order_number,
      total: notifyTotal,
      customer_name: notifyName,
      customer_phone: notifyPhone,
      payment_proof_url: proofUrl,
      proof_buffer: proofBuffer,
      proof_mime: proofMime,
      deposit_amount,
      payment_method: notifyMethod,
      points_redeemed,
      isProofUpdate: !!is_proof_update || !!attach_proof,
    });

    if (!data.ok) {
      console.error('Telegram error:', data);
      if (attach_proof && attachStatus?.found) {
        return res.json({
          ok: true,
          total: notifyTotal,
          telegram_delayed: true,
          proof_saved: true,
        });
      }
      return res.status(502).json({
        ok: false,
        error: data.description || data.error || 'Telegram send failed',
        proof_saved: !!attach_proof && !!attachStatus?.found,
      });
    }

    res.json({ ok: true, total: notifyTotal });
  } catch (err) {
    console.error('send-telegram:', err.message);
    res.status(500).json({ ok: false, error: err.message });
  }
};
