// Proactive send to a ManyChat contact (used after the admin/Telegram
// confirms an order, to push "your order is confirmed" back to a customer
// on Facebook/Instagram). ManyChat owns the Page's Messenger/Instagram
// webhook subscription, so a normal Graph API send (sendPageMessage) can't
// reach these contacts — this has to go through ManyChat's own Send API.
async function sendManyChatMessage(contactId, text, tag = 'CONFIRMED_EVENT_UPDATE', channel) {
  const token = process.env.MANYCHAT_API_TOKEN;
  if (!token) return { ok: false, error: 'manychat_not_configured' };

  // Same endpoint handles both platforms, but without an explicit
  // "type": "instagram" marker it's treated as a Facebook Messenger send —
  // ManyChat's own community reports this failing silently (200 OK, message
  // never delivered) for actual Instagram subscribers. `channel` here is the
  // real platform hint each automation already sends us (see chatEngine.js
  // create_order()), not the generic "manychat" placeholder.
  const content = { messages: [{ type: 'text', text }] };
  if (channel === 'instagram') content.type = 'instagram';

  const res = await fetch('https://api.manychat.com/fb/sending/sendContent', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      subscriber_id: contactId,
      data: { version: 'v2', content },
      // Message tag Meta requires for sends outside the customer's 24h
      // window — omit it (pass null/undefined) for sends that are still
      // within that window, like the abandoned-cart reminder.
      ...(tag ? { message_tag: tag } : {}),
    }),
    // No timeout previously — a hung call here (awaited inside the
    // Telegram "confirm order" webhook, see orderConfirm.js) left the
    // admin's confirm button looking stuck with no response.
    signal: AbortSignal.timeout(8000),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.status === 'error') {
    return { ok: false, error: data.message || data.details || `http_${res.status}` };
  }
  return { ok: true };
}

/**
 * Send a voice note to a ManyChat contact.
 *
 * The bot can synthesise a reply (lib/voiceReply.js) but the ManyChat flow has
 * no audio block wired to the response, so the file was being generated and
 * never heard. This pushes it through the same Send API the order confirmation
 * already uses, which needs no dashboard change.
 *
 * No tag: this only ever follows a message the customer just sent, so the
 * conversation is inside Meta's 24-hour window and a tag would be wrong.
 */
async function sendManyChatAudio(contactId, url, channel) {
  const token = process.env.MANYCHAT_API_TOKEN;
  if (!token) return { ok: false, error: 'manychat_not_configured' };
  if (!contactId || !url) return { ok: false, error: 'missing_contact_or_url' };

  const content = { messages: [{ type: 'audio', url }] };
  // Without the marker ManyChat treats the send as Messenger and an Instagram
  // subscriber gets a silent 200 — the same trap sendManyChatMessage documents.
  if (channel === 'instagram') content.type = 'instagram';

  try {
    const res = await fetch('https://api.manychat.com/fb/sending/sendContent', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ subscriber_id: contactId, data: { version: 'v2', content } }),
      signal: AbortSignal.timeout(8000),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.status === 'error') {
      return { ok: false, error: data.message || data.details || `http_${res.status}` };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err.name === 'TimeoutError' ? 'timeout' : err.message };
  }
}

module.exports = { sendManyChatMessage, sendManyChatAudio };
