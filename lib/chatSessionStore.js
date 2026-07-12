// Persist chat cart, conversation history, and wizard state in Supabase.
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://ikryeyqrithikabwidov.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlrcnlleXFyaXRoaWthYndpZG92Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE3MzY1ODcsImV4cCI6MjA5NzMxMjU4N30.kNfHPxV4fq67cOF8uFsTrLOxPYcLcmmDO3ScIHzI9Uo';

const sb = createClient(SUPABASE_URL, SUPABASE_KEY);
const MAX_HISTORY = 24;

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
    };
  }
  return {
    cart: Array.isArray(data.cart) ? data.cart : [],
    history: Array.isArray(data.history) ? data.history : [],
    customerPhone: data.customer_phone || null,
    customerName: data.customer_name || null,
    checkoutWizard: data.checkout_wizard || null,
    orderWizard: data.order_wizard || null,
  };
}

async function saveSession(sid, state) {
  if (!sid) return;
  const history = (state.history || []).slice(-MAX_HISTORY);
  await sb.rpc('save_chat_bot_session', {
    p_session_id: sid,
    p_cart: state.cart ?? null,
    p_history: history,
    p_customer_phone: state.customerPhone ?? null,
    p_customer_name: state.customerName ?? null,
    p_checkout_wizard: state.checkoutWizard === undefined ? null : state.checkoutWizard,
    p_order_wizard: state.orderWizard === undefined ? null : state.orderWizard,
    p_chat_channel: state.chatChannel ?? null,
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
  const digits = toWesternDigits(text).replace(/[^\d]/g, '');
  if (/^01\d{9}$/.test(digits)) return digits;
  return null;
}

module.exports = {
  loadSession,
  saveSession,
  appendHistory,
  historyToGemini,
  normalizePhone,
  toWesternDigits,
  MAX_HISTORY,
};
