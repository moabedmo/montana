// Web push notifications to CRM admin subscribers.
const webpush = require('web-push');
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://ikryeyqrithikabwidov.supabase.co';

function pushConfigured() {
  return !!(
    process.env.VAPID_PUBLIC_KEY &&
    process.env.VAPID_PRIVATE_KEY &&
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

async function notifyAdminsPush({ title, body, url = '/crm/admin/' } = {}) {
  if (!pushConfigured()) return { ok: false, skipped: 'Push not configured' };

  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || 'mailto:admin@montana.com.eg',
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY,
  );

  const admin = createClient(SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  const { data: subs, error } = await admin.from('crm_admin_push_subscriptions').select('id, endpoint, p256dh, auth');
  if (error) return { ok: false, error: error.message };
  if (!subs?.length) return { ok: false, skipped: 'No admin subscriptions' };

  const payload = JSON.stringify({ title: title || 'Montana CRM', body: body || '', url });
  let sent = 0;
  let removed = 0;

  for (const sub of subs) {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        payload,
      );
      sent++;
    } catch (e) {
      const code = e.statusCode;
      if (code === 404 || code === 410) {
        await admin.from('crm_admin_push_subscriptions').delete().eq('id', sub.id);
        removed++;
      }
    }
  }

  return { ok: sent > 0, sent, removed };
}

module.exports = { notifyAdminsPush, pushConfigured };
