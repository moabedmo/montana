// Persist chat cart, conversation history, and wizard state in Supabase.
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://ikryeyqrithikabwidov.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlrcnlleXFyaXRoaWthYndpZG92Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE3MzY1ODcsImV4cCI6MjA5NzMxMjU4N30.kNfHPxV4fq67cOF8uFsTrLOxPYcLcmmDO3ScIHzI9Uo';

const sb = createClient(SUPABASE_URL, SUPABASE_KEY);
const MAX_HISTORY = 24;

/** Soft-stale window: idle carts older than this get wiped on soft reopen. */
const SESSION_STALE_MS = 12 * 60 * 60 * 1000;
/**
 * Sentinel written when we need to clear sticky selected_bundle.
 * Works even before migration 112 (old RPC only overwrites on non-empty values).
 * After 112, empty string also clears to SQL NULL.
 */
const SELECTED_BUNDLE_CLEARED = '__cleared__';

function normalizeSelectedBundle(raw) {
  if (!raw || raw === SELECTED_BUNDLE_CLEARED) return null;
  return raw;
}

async function loadSession(sid) {
  const { data, error } = await sb.rpc('get_chat_bot_session', { p_session_id: sid });
  if (error || !data?.found) {
    return {
      cart: [],
      history: [],
      customerPhone: null,
      customerName: null,
      checkoutWizard: null,
      orderWizard: null,
      selectedBundle: null,
      updatedAt: null,
      stale: false,
    };
  }
  const updatedAt = data.updated_at ? new Date(data.updated_at).getTime() : null;
  const stale = !!(updatedAt && (Date.now() - updatedAt > SESSION_STALE_MS));
  return {
    cart: Array.isArray(data.cart) ? data.cart : [],
    history: Array.isArray(data.history) ? data.history : [],
    customerPhone: data.customer_phone || null,
    customerName: data.customer_name || null,
    checkoutWizard: data.checkout_wizard || null,
    orderWizard: data.order_wizard || null,
    selectedBundle: normalizeSelectedBundle(data.selected_bundle),
    updatedAt,
    stale,
  };
}

async function saveSession(sid, state) {
  if (!sid) return;
  const history = (state.history || []).slice(-MAX_HISTORY);
  // selectedBundle convention:
  //   undefined → omit (RPC NULL = keep sticky)
  //   null / '' → explicit clear (sentinel, or '' after migration 112)
  //   string    → set
  let bundleArg;
  if (state.selectedBundle === undefined) bundleArg = null;
  else if (state.selectedBundle == null || state.selectedBundle === '') {
    bundleArg = SELECTED_BUNDLE_CLEARED;
  } else {
    bundleArg = state.selectedBundle;
  }

  await sb.rpc('save_chat_bot_session', {
    p_session_id: sid,
    p_cart: state.cart ?? null,
    p_history: history,
    p_customer_phone: state.customerPhone ?? null,
    p_customer_name: state.customerName ?? null,
    p_checkout_wizard: state.checkoutWizard === undefined ? null : state.checkoutWizard,
    p_order_wizard: state.orderWizard === undefined ? null : state.orderWizard,
    p_chat_channel: state.chatChannel ?? null,
    p_selected_bundle: bundleArg,
  });
}

function appendHistory(history, userText, modelText) {
  const next = [...(history || [])];
  if (userText) next.push({ role: 'user', text: String(userText).slice(0, 2000) });
  if (modelText) next.push({ role: 'model', text: String(modelText).slice(0, 4000) });
  return next.slice(-MAX_HISTORY);
}

function historyToGemini(history) {
  return (history || []).map((h) => ({
    role: h.role === 'model' ? 'model' : 'user',
    parts: [{ text: h.text }],
  }));
}

// Arabic-Indic (٠-٩) and Extended Arabic-Indic/Persian (۰-۹) digits are
// common on Arabic keyboards but don't match JS's \d — convert them to
// Western digits first so phone/number input isn't silently rejected.
function toWesternDigits(str) {
  return String(str || '').replace(/[٠-٩۰-۹]/g, (ch) => {
    const code = ch.charCodeAt(0);
    if (code >= 0x0660 && code <= 0x0669) return String(code - 0x0660);
    if (code >= 0x06F0 && code <= 0x06F9) return String(code - 0x06F0);
    return ch;
  });
}

function normalizePhone(text) {
  let digits = toWesternDigits(text).replace(/[^\d]/g, '');
  if (!digits) return null;
  // WhatsApp / international: 2010xxxxxxxx or 002010xxxxxxxx → 010xxxxxxxx
  if (digits.startsWith('0020')) digits = digits.slice(2);
  if (/^20(1\d{9})$/.test(digits)) digits = '0' + digits.slice(2);
  else if (/^1\d{9}$/.test(digits) && digits.length === 10) digits = '0' + digits;
  if (/^01\d{9}$/.test(digits)) return digits;
  return null;
}

/** Pull the first valid Egyptian mobile out of free-form chat text. */
function extractPhoneFromText(text) {
  const western = toWesternDigits(text || '');
  // Prefer explicit 01… / +20… / 20… runs before a looser digit sweep
  const candidates = western.match(/(?:\+?20|0020)?0?1\d{9}/g) || [];
  for (const c of candidates) {
    const n = normalizePhone(c);
    if (n) return n;
  }
  return normalizePhone(western);
}

module.exports = {
  loadSession,
  saveSession,
  appendHistory,
  historyToGemini,
  normalizePhone,
  extractPhoneFromText,
  toWesternDigits,
  MAX_HISTORY,
  SESSION_STALE_MS,
};
