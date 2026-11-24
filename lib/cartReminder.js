// Abandoned-cart reminder: finds Messenger/Instagram sessions that left
// items in their cart ~3 hours ago and never checked out, and nudges them
// once via ManyChat. Triggered hourly by api/cart-reminder-cron.js.
const { createClient } = require('@supabase/supabase-js');
const { sendManyChatMessage } = require('./manychatApi');
const { isBotPaused } = require('./botPause');

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

    // Safety check 1: Load session details (history, phone, pause state)
    const { data: sess } = await sbService
      .from('chat_bot_sessions')
      .select('history_json, customer_phone, cart_json')
      .eq('session_id', row.session_id)
      .maybeSingle();

    const history = sess?.history_json || [];
    const historyText = JSON.stringify(history);

    // If human agent took over, or bot is paused, or order was handled by human -> NEVER send reminder!
    const isHandledByHuman = isBotPaused(history) ||
      /(?:تم\s*الإرسال\s*بواسطة|تم\s*تسجيل\s*(?:ال)?(?:اوردر|أوردر)|سجلتلك|سجلنا|الاوردر\s*اتسجل|خدمة\s*العملاء|Khaled|خالد)/i.test(historyText);

    if (isHandledByHuman) {
      await sbService.rpc('mark_cart_reminder_sent', { p_session_id: row.session_id }).catch(() => {});
      await sbService.from('chat_bot_sessions').update({ cart_json: [] }).eq('session_id', row.session_id).catch(() => {});
      continue;
    }

    // Safety check 2: Check if an order already exists for this session or phone
    const phone = sess?.customer_phone;
    const { data: existingBySession } = await sbService.from('orders').select('id').eq('chat_session_id', row.session_id).limit(1);
    if (existingBySession && existingBySession.length > 0) {
      await sbService.rpc('mark_cart_reminder_sent', { p_session_id: row.session_id }).catch(() => {});
      await sbService.from('chat_bot_sessions').update({ cart_json: [] }).eq('session_id', row.session_id).catch(() => {});
      continue;
    }

    if (phone) {
      const { data: existingByPhone } = await sbService.from('orders').select('id').eq('customer_phone', phone).limit(1);
      if (existingByPhone && existingByPhone.length > 0) {
        await sbService.rpc('mark_cart_reminder_sent', { p_session_id: row.session_id }).catch(() => {});
        await sbService.from('chat_bot_sessions').update({ cart_json: [] }).eq('session_id', row.session_id).catch(() => {});
        continue;
      }
    }

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
