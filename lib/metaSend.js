// Outbound message senders for Meta's platforms — shared by the
// WhatsApp/Messenger/Instagram webhooks. Node 18+'s global fetch()
// is used directly; no new HTTP client dependency needed.

// A stalled Graph API call had no timeout at all — since these sends are
// awaited inside the Telegram "confirm order" webhook (see
// orderConfirm.js), a hung Graph API request made the admin's confirm
// button look like it was doing nothing. Bound every call.
const META_TIMEOUT_MS = 8000;

async function sendWhatsAppText(to, text) {
  const url = `https://graph.facebook.com/v20.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`;
  await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ messaging_product: 'whatsapp', to, type: 'text', text: { body: text } }),
    signal: AbortSignal.timeout(META_TIMEOUT_MS),
  });
}

// Shared by Messenger and Instagram — both are Graph API "Send API"
// calls over /me/messages, differing only in which Page token is used.
async function sendPageMessage(pageAccessToken, recipientId, text, opts = {}) {
  const url = `https://graph.facebook.com/v20.0/me/messages?access_token=${encodeURIComponent(pageAccessToken)}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ recipient: { id: recipientId }, message: { text } }),
    signal: AbortSignal.timeout(META_TIMEOUT_MS),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || body.error) {
    console.error('sendPageMessage:', res.status, JSON.stringify(body.error || body));
    throw new Error(body.error?.message || `Graph send failed ${res.status}`);
  }
  try {
    const { markBotOutbound } = require('./botPause');
    const sid = opts.sid || null;
    markBotOutbound(sid, body.message_id || body.messageId, text);
  } catch (_) { /* pause tracking must never break send */ }
  return body;
}

// Private reply to a Facebook Page comment — converts the public
// comment into a real Messenger conversation with its author (Meta
// maps the comment to the right person automatically; no PSID needed
// for this call). This is how a comment like "كام السعر؟" turns into
// a normal DM the same chatEngine handles.
async function sendFacebookCommentPrivateReply(pageAccessToken, commentId, text) {
  const url = `https://graph.facebook.com/v20.0/${commentId}/private_replies?access_token=${encodeURIComponent(pageAccessToken)}`;
  await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: text }),
    signal: AbortSignal.timeout(META_TIMEOUT_MS),
  });
}

// Instagram's private-reply-to-comment uses the same Send API as DMs,
// but targets { comment_id } instead of { id: igsid }.
async function sendInstagramCommentPrivateReply(pageAccessToken, commentId, text) {
  const url = `https://graph.facebook.com/v20.0/me/messages?access_token=${encodeURIComponent(pageAccessToken)}`;
  await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ recipient: { comment_id: commentId }, message: { text } }),
    signal: AbortSignal.timeout(META_TIMEOUT_MS),
  });
}

module.exports = { sendWhatsAppText, sendPageMessage, sendFacebookCommentPrivateReply, sendInstagramCommentPrivateReply };
