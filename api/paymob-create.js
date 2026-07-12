// Paymob Accept — create iframe payment session.
// Requires PAYMOB_API_KEY, PAYMOB_INTEGRATION_ID, PAYMOB_IFRAME_ID in env.
// When SUPABASE_SERVICE_ROLE_KEY is set, amount is verified against the real order.
const { enforceRateLimit, verifyStoreOrigin } = require('../lib/security');

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://ikryeyqrithikabwidov.supabase.co';

async function fetchOrderTotal(orderNumber) {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) return null;
  const url = `${SUPABASE_URL}/rest/v1/orders?order_number=eq.${encodeURIComponent(orderNumber)}&select=total,payment_method,status&limit=1`;
  const res = await fetch(url, {
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
    },
  });
  if (!res.ok) return null;
  const rows = await res.json();
  return rows?.[0] || null;
}

module.exports = async (req, res) => {
  if (req.method === 'GET') {
    const configured = !!(process.env.PAYMOB_API_KEY && process.env.PAYMOB_INTEGRATION_ID && process.env.PAYMOB_IFRAME_ID);
    return res.json({ configured });
  }
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  try {
    verifyStoreOrigin(req);
    enforceRateLimit(req, 'paymob-create', { windowMs: 60_000, max: 15 });
  } catch (err) {
    return res.status(err.status || 403).json({ ok: false, error: err.message });
  }

  const apiKey = process.env.PAYMOB_API_KEY;
  const integrationId = process.env.PAYMOB_INTEGRATION_ID;
  const iframeId = process.env.PAYMOB_IFRAME_ID;

  if (!apiKey || !integrationId || !iframeId) {
    return res.status(503).json({ ok: false, error: 'Paymob not configured — set PAYMOB_* env vars' });
  }

  try {
    const { amount, order_number, customer } = req.body || {};
    if (!order_number || !/^MON-\d{5}$/.test(String(order_number))) {
      return res.status(400).json({ ok: false, error: 'Valid order_number required' });
    }

    const dbOrder = await fetchOrderTotal(order_number);
    if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
      if (!dbOrder) {
        return res.status(404).json({ ok: false, error: 'Order not found' });
      }
      if (dbOrder.payment_method !== 'card') {
        return res.status(400).json({ ok: false, error: 'Order is not a card payment' });
      }
    }

    const verifiedAmount = dbOrder ? Number(dbOrder.total) : Number(amount);
    const amountCents = Math.round(verifiedAmount * 100);
    if (!amountCents || amountCents < 100) {
      return res.status(400).json({ ok: false, error: 'Invalid payment amount' });
    }
    if (dbOrder && Math.abs(Number(amount) - verifiedAmount) > 0.02) {
      return res.status(400).json({ ok: false, error: 'Amount does not match order' });
    }

    const authRes = await fetch('https://accept.paymob.com/api/auth/tokens', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ api_key: apiKey })
    });
    const authData = await authRes.json();
    if (!authData.token) throw new Error('Paymob auth failed');

    const orderRes = await fetch('https://accept.paymob.com/api/ecommerce/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        auth_token: authData.token,
        delivery_needed: false,
        amount_cents: amountCents,
        currency: 'EGP',
        merchant_order_id: String(order_number),
        items: []
      })
    });
    const orderData = await orderRes.json();
    if (!orderData.id) throw new Error('Paymob order registration failed');

    const nameParts = String(customer?.name || 'Montana Customer').trim().split(/\s+/);
    const firstName = nameParts[0] || 'Customer';
    const lastName = nameParts.slice(1).join(' ') || '.';

    const keyRes = await fetch('https://accept.paymob.com/api/acceptance/payment_keys', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        auth_token: authData.token,
        amount_cents: amountCents,
        expiration: 3600,
        order_id: orderData.id,
        billing_data: {
          first_name: firstName,
          last_name: lastName,
          email: customer?.email || 'guest@montana.com',
          phone_number: customer?.phone || '01000000000',
          apartment: 'NA', floor: 'NA', street: 'NA', building: 'NA',
          shipping_method: 'PKG', postal_code: 'NA',
          city: customer?.city || 'Cairo', country: 'EG', state: 'Cairo'
        },
        currency: 'EGP',
        integration_id: parseInt(integrationId, 10)
      })
    });
    const keyData = await keyRes.json();
    if (!keyData.token) throw new Error('Paymob payment key failed');

    res.json({
      ok: true,
      iframe_url: `https://accept.paymob.com/api/acceptance/iframes/${iframeId}?payment_token=${keyData.token}`
    });
  } catch (err) {
    console.error('paymob-create:', err.message);
    res.status(500).json({ ok: false, error: err.message });
  }
};
