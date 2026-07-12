// Notifies the store admin via Telegram when an order is placed or proof attached.
const { createClient } = require('@supabase/supabase-js');
const { enforceRateLimit, verifyStoreOrigin, isSafeHttpUrl, hasValidApiSecret } = require('../lib/security');
const { notifyTelegramOrder } = require('../lib/telegramOrderNotify');
const { confirmOrderByNumber, notifyCustomerOrderConfirmed } = require('../lib/orderConfirm');

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

module.exports = async (req, res) => {
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
      return res.json({ ok: true, order_number: body.confirm_order_number, notify });
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
