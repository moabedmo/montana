/**
 * Human takeover — pause the bot when a page agent replies (Meta echo),
 * or when ManyChat/API sends pauseBot. Resume via #bot / resumeBot / timeout.
 */

const PAUSE_RE = /⟦BOT_PAUSED:(\d+)⟧/;
/** After a human takeover, auto-resume if the customer messages again after this. */
const DEFAULT_PAUSE_MS = 60 * 60 * 1000; // 1 hour

/** mid → expiry ts — echoes of our own Send API replies */
const outboundMids = new Map();
/** sid → [{ text, at }] recent bot texts for echo matching without mid */
const outboundBySid = new Map();

function pruneOutbound() {
  const now = Date.now();
  for (const [mid, exp] of outboundMids) {
    if (exp < now) outboundMids.delete(mid);
  }
  for (const [sid, rows] of outboundBySid) {
    const keep = (rows || []).filter((r) => now - r.at < 60_000);
    if (keep.length) outboundBySid.set(sid, keep);
    else outboundBySid.delete(sid);
  }
}

function markBotOutbound(sid, messageId, text) {
  pruneOutbound();
  const now = Date.now();
  if (messageId) outboundMids.set(String(messageId), now + 90_000);
  if (sid && text) {
    const rows = outboundBySid.get(sid) || [];
    rows.push({ text: String(text).slice(0, 500), at: now });
    outboundBySid.set(sid, rows.slice(-8));
  }
}

function isOurBotEcho(messaging, sid) {
  pruneOutbound();
  const mid = messaging?.message?.mid;
  if (mid && outboundMids.has(String(mid))) return true;
  const text = String(messaging?.message?.text || '').slice(0, 500);
  if (!text || !sid) return false;
  const rows = outboundBySid.get(sid) || [];
  return rows.some((r) => r.text === text && Date.now() - r.at < 45_000);
}

function findPauseTs(history) {
  for (let i = (history || []).length - 1; i >= 0; i--) {
    const m = String(history[i]?.text || '').match(PAUSE_RE);
    if (m) return Number(m[1]) || 0;
  }
  return 0;
}

function isPauseExpired(history, pauseMs = DEFAULT_PAUSE_MS) {
  const ts = findPauseTs(history);
  if (!ts) return false;
  return Date.now() - ts > pauseMs;
}

function isBotPaused(history, pauseMs = DEFAULT_PAUSE_MS) {
  const ts = findPauseTs(history);
  if (!ts) return false;
  if (Date.now() - ts > pauseMs) return false;
  return true;
}

function stripPauseMarkers(history) {
  return (history || []).filter((h) => !PAUSE_RE.test(String(h?.text || '')));
}

function stampBotPaused(history) {
  const next = stripPauseMarkers(history);
  next.push({
    role: 'user',
    text: `⟦BOT_PAUSED:${Date.now()}⟧ (النظام: موظف بشري دخل المحادثة — البوت واقف لحد ما يتفعّل تاني.)`,
  });
  next.push({
    role: 'model',
    text: 'تمام، هسيبها لفريق مونتانا 💜',
  });
  return next;
}

function wantsBotResume(message) {
  const t = String(message || '').trim();
  if (!t) return false;
  return /^(#?\s*bot|#?\s*بوت|شغّ?ل\s*(ال)?بوت|فعّ?ل\s*(ال)?بوت|ارجع\s*(ال)?بوت|resume\s*bot)[\s!.،؟?]*$/i.test(t);
}

function echoWantsResume(text) {
  return /#\s*(bot|بوت)|شغّ?ل\s*(ال)?بوت|فعّ?ل\s*(ال)?بوت|resume\s*bot/i.test(String(text || ''));
}

/**
 * Meta echo: sender=page, recipient=customer.
 * Returns customer platform id, or null.
 */
function customerIdFromEcho(messaging, channel) {
  if (!messaging?.message?.is_echo) return null;
  const userId = messaging?.recipient?.id;
  if (!userId) return null;
  if (channel === 'instagram') return `instagram:${userId}`;
  if (channel === 'messenger') return `messenger:${userId}`;
  return null;
}

module.exports = {
  markBotOutbound,
  isOurBotEcho,
  isBotPaused,
  isPauseExpired,
  stampBotPaused,
  stripPauseMarkers,
  wantsBotResume,
  echoWantsResume,
  customerIdFromEcho,
  DEFAULT_PAUSE_MS,
};
