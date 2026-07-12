// Abandoned-cart reminder: finds Messenger/Instagram sessions that left
// items in their cart ~3 hours ago and never checked out, and nudges them
// once via ManyChat. Triggered hourly by api/cart-reminder-cron.js.
const { createClient } = require('@supabase/supabase-js');
const { sendManyChatMessage } = require('./manychatApi');

const SUPABASE_URL = 'https://ikryeyqrithikabwidov.supabase.co';
const sbService = process.env.SERVICE_ROLE
  ? createClient(SUPABASE_URL, process.env.SERVICE_ROLE)
  : null;

function buildReminderText(cart) {
  const names = (cart || []).map((i) => i.name).filter(Boolean);
  if (!names.length) return null;
  const list = names.length > 1
    ? names.slice(0, -1).join('، ') + ' و' + names[names.length - 1]
    : names[0];
  return `يا فندم 💜 أوردرك (${list}) لسه محفوظ ومستنيك، تحبي نكمله سوا دلوقتي؟`;
}

async function sendAbandonedCartReminders() {
  if (!sbService) return { ok: false, error: 'service_role_not_configured' };

  const { data, error } = await sbService.rpc('get_abandoned_carts');
  if (error) return { ok: false, error: error.message };

  const candidates = data || [];
  let sent = 0;
  const errors = [];

  for (const row of candidates) {
    const contactId = row.session_id?.startsWith('manychat:')
      ? row.session_id.slice('manychat:'.length)
      : null;
    const text = buildReminderText(row.cart_json);
    if (!contactId || !text) continue;

    // No message_tag: these are all within the 3-4h window, well inside
    // Meta's standard 24h messaging window, so no special tag is needed.
    const result = await sendManyChatMessage(contactId, text, null);
    if (result.ok) {
      sent += 1;
    } else {
      errors.push({ session_id: row.session_id, error: result.error });
    }
    // Mark as reminded regardless of send outcome — a permanently-failing
    // contact (e.g. blocked the page) shouldn't be retried every hour.
    await sbService.rpc('mark_cart_reminder_sent', { p_session_id: row.session_id });
  }

  return { ok: true, candidates: candidates.length, sent, errors };
}

module.exports = { sendAbandonedCartReminders };
