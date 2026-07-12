// Confirm orders (Telegram admin button) and notify the customer on their channel.
const { createClient } = require('@supabase/supabase-js');
const { sendWhatsAppText, sendPageMessage } = require('./metaSend');
const { sendManyChatMessage } = require('./manychatApi');

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://ikryeyqrithikabwidov.supabase.co';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlrcnlleXFyaXRoaWthYndpZG92Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE3MzY1ODcsImV4cCI6MjA5NzMxMjU4N30.kNfHPxV4fq67cOF8uFsTrLOxPYcLcmmDO3ScIHzI9Uo';

const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

function confirmKey() {
  return process.env.TELEGRAM_CONFIRM_KEY || process.env.TELEGRAM_CHAT_ID || '';
}

async function confirmOrderByNumber(orderNumber) {
  const key = confirmKey();
  if (!key) {
    return { ok: false, error: 'telegram_not_configured' };
  }

  const { data, error } = await sb.rpc('confirm_order_by_number', {
    p_order_number: orderNumber,
    p_confirm_key: key,
  });

  if (error) {
    console.error('confirm_order_by_number:', error.message);
    return { ok: false, error: 'confirm_failed' };
  }

  if (data?.error === 'unauthorized') {
    return { ok: false, error: 'confirm_key_mismatch' };
  }

  return data;
}

function customerConfirmMessage(orderNumber, plain) {
  const text = `تم تأكيد طلبك ${orderNumber} بنجاح ✅\nشكراً لثقتك في Montana 💜`;
  if (plain) return text;
  return `تم تأكيد طلبك **${orderNumber}** بنجاح ✅\nشكراً لثقتك في Montana 💜`;
}

async function notifyCustomerOrderConfirmed(result) {
  if (!result?.ok) return { notified: false, reason: 'confirm_failed' };

  const orderNumber = result.order_number;
  const msg = customerConfirmMessage(orderNumber, true);
  const channel = result.chat_channel || 'web';
  const sid = result.chat_session_id || '';

  // Each send is wrapped so a slow/unreachable platform (now bounded by a
  // timeout in metaSend.js/manychatApi.js, but still possible to fail)
  // degrades to "not notified" instead of throwing — the order is already
  // confirmed in the DB at this point, and letting this throw all the way
  // up used to make the Telegram webhook itself look hung/failed even
  // though the confirm had actually succeeded.
  if (channel === 'whatsapp' && sid.startsWith('whatsapp:')) {
    const to = sid.slice('whatsapp:'.length);
    if (process.env.WHATSAPP_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID) {
      try {
        await sendWhatsAppText(to, msg);
        return { notified: true, channel: 'whatsapp' };
      } catch (e) {
        console.error('notifyCustomerOrderConfirmed whatsapp:', e.message);
        return { notified: false, channel: 'whatsapp', reason: 'send_failed' };
      }
    }
  }

  if (channel === 'messenger' && sid.startsWith('messenger:')) {
    const recipientId = sid.slice('messenger:'.length);
    if (process.env.MESSENGER_PAGE_TOKEN) {
      try {
        await sendPageMessage(process.env.MESSENGER_PAGE_TOKEN, recipientId, msg);
        return { notified: true, channel: 'messenger' };
      } catch (e) {
        console.error('notifyCustomerOrderConfirmed messenger:', e.message);
        return { notified: false, channel: 'messenger', reason: 'send_failed' };
      }
    }
  }

  if (channel === 'instagram' && sid.startsWith('instagram:')) {
    const recipientId = sid.slice('instagram:'.length);
    if (process.env.INSTAGRAM_PAGE_TOKEN) {
      try {
        await sendPageMessage(process.env.INSTAGRAM_PAGE_TOKEN, recipientId, msg);
        return { notified: true, channel: 'instagram' };
      } catch (e) {
        console.error('notifyCustomerOrderConfirmed instagram:', e.message);
        return { notified: false, channel: 'instagram', reason: 'send_failed' };
      }
    }
  }

  // ManyChat-relayed sessions are always prefixed "manychat:" regardless of
  // platform (Facebook and Instagram share the same contact-id namespace) —
  // `channel` is the real platform hint (see create_order()), used here so
  // sendManyChatMessage sends the Instagram-specific payload shape when needed.
  if (sid.startsWith('manychat:')) {
    const contactId = sid.slice('manychat:'.length);
    try {
      const result = await sendManyChatMessage(contactId, msg, undefined, channel);
      if (result.ok) return { notified: true, channel };
      console.error('notifyCustomerOrderConfirmed manychat:', result.error);
    } catch (e) {
      console.error('notifyCustomerOrderConfirmed manychat:', e.message);
    }
  }

  if (sid) return { notified: true, channel: channel || 'web', pending: true };

  return { notified: false, reason: 'no_chat_session' };
}

module.exports = {
  confirmOrderByNumber,
  customerConfirmMessage,
  notifyCustomerOrderConfirmed,
};
