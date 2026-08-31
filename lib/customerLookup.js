// Storefront customer lookup by Egyptian mobile (orders count + points).
// service_role only — never expose RPCs to anon.
const { createClient } = require('@supabase/supabase-js');
const { enforceRateLimit, verifyStoreOrigin } = require('./security');

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://ikryeyqrithikabwidov.supabase.co';

function getServiceClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SERVICE_ROLE;
  if (!key) return null;
  return createClient(SUPABASE_URL, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function handleCustomerByPhone(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  try {
    verifyStoreOrigin(req);
    enforceRateLimit(req, 'customer-by-phone', { windowMs: 60_000, max: 20 });
  } catch (err) {
    return res.status(err.status || 403).json({ ok: false, error: err.message });
  }

  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
  const phone = String(body.phone || '').trim();
  if (!phone || phone.replace(/\D/g, '').length < 10) {
    return res.status(200).json({ ok: true, found: false, reason: 'invalid_phone' });
  }

  const sb = getServiceClient();
  if (!sb) {
    return res.status(200).json({ ok: false, found: false, reason: 'not_configured' });
  }

  try {
    const [profileRes, pointsRes] = await Promise.all([
      sb.rpc('get_customer_profile_by_phone', { p_phone: phone }),
      sb.rpc('get_customer_points_by_phone', { p_phone: phone }),
    ]);

    const profile = profileRes.data || {};
    const pointsData = pointsRes.data || {};
    const points = Number(pointsData.points) || 0;
    const found = !!(profile.found || points > 0);

    if (!found) {
      return res.status(200).json({
        ok: true,
        found: false,
        phone: pointsData.phone || null,
        orderCount: 0,
        points: 0,
      });
    }

    return res.status(200).json({
      ok: true,
      found: true,
      phone: profile.phone || pointsData.phone || null,
      name: profile.name || null,
      address: profile.address || null,
      governorate: profile.governorate || null,
      orderCount: Number(profile.order_count) || 0,
      points,
      lastOrderNumber: profile.last_order_number || null,
    });
  } catch (err) {
    console.error('customer-by-phone:', err?.message || err);
    return res.status(200).json({ ok: false, found: false });
  }
}

module.exports = { handleCustomerByPhone };
