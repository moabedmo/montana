// Paymob webhook — verifies HMAC and logs successful payments.
// Requires PAYMOB_HMAC_SECRET from Paymob dashboard.
// Optionally set SERVICE_ROLE + SUPABASE_URL to auto-confirm orders.
const crypto = require('crypto');
const { autoSendOrderToBosta, resolveWebhookBaseUrl } = require('../lib/bostaHandlers');

const SB_SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SERVICE_ROLE;

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  const hmacSecret = process.env.PAYMOB_HMAC_SECRET;
  const body = req.body || {};

  if (!hmacSecret) {
    console.error('paymob-webhook: PAYMOB_HMAC_SECRET not configured');
    return res.status(503).json({ ok: false, error: 'Webhook not configured' });
  }

  try {
    if (!body.obj) {
      return res.status(400).json({ ok: false, error: 'Invalid payload' });
    }

    const o = body.obj;
    const concat = [
      o.amount_cents, o.created_at, o.currency, o.error_occured,
      o.has_parent_transaction, o.id, o.integration_id, o.is_3d_secure,
      o.is_auth, o.is_capture, o.is_refunded, o.is_standalone_payment,
      o.is_voided, o.order?.id, o.owner, o.pending,
      o.source_data?.pan, o.source_data?.sub_type, o.source_data?.type, o.success
    ].join('');
    const calc = crypto.createHmac('sha512', hmacSecret).update(concat).digest('hex');
    if (!body.hmac || calc !== body.hmac) {
      return res.status(401).json({ ok: false, error: 'Invalid HMAC' });
    }

    const success = body.obj?.success === true;
    const merchantOrderId = body.obj?.order?.merchant_order_id || body.obj?.merchant_order_id;

    if (success && merchantOrderId && SB_SERVICE) {
      const url = `${process.env.SUPABASE_URL || 'https://ikryeyqrithikabwidov.supabase.co'}/rest/v1/orders?order_number=eq.${encodeURIComponent(merchantOrderId)}`;
      await fetch(url, {
        method: 'PATCH',
        headers: {
          apikey: SB_SERVICE,
          Authorization: `Bearer ${SB_SERVICE}`,
          'Content-Type': 'application/json',
          Prefer: 'return=minimal'
        },
        body: JSON.stringify({ payment_status: 'confirmed', status: 'confirmed', updated_at: new Date().toISOString() })
      });
      autoSendOrderToBosta({
        orderNumber: merchantOrderId,
        webhookBaseUrl: resolveWebhookBaseUrl(),
      }).catch(() => {});
    }

    res.json({ ok: true });
  } catch (err) {
    console.error('paymob-webhook:', err.message);
    res.status(500).json({ ok: false, error: err.message });
  }
};
