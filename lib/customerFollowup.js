// lib/customerFollowup.js — Automated & Safe ManyChat Customer Follow-Up Engine
// Strictly compliant with Meta's 24-Hour Messaging Policy.
// Follows up with customers who inquired or abandoned checkout between 2h and 22h ago.

const { createClient } = require('@supabase/supabase-js');
const {
  sendManyChatMessage,
  getManyChatSubscriberInfo,
  addManyChatTagByName,
} = require('./manychatApi');
const { fetchSessionOrders, fetchPhoneOrders } = require('./orderContext');

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://ikryeyqrithikabwidov.supabase.co';
const SUPABASE_SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SERVICE_ROLE || '';
const SUPABASE_ANON = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlrcnlleXFyaXRoaWthYndpZG92Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE3MzY1ODcsImV4cCI6MjA5NzMxMjU4N30.kNfHPxV4fq67cOF8uFsTrLOxPYcLcmmDO3ScIHzI9Uo';

function getSbClient() {
  if (SUPABASE_SERVICE) {
    return createClient(SUPABASE_URL, SUPABASE_SERVICE, { auth: { persistSession: false } });
  }
  return createClient(SUPABASE_URL, SUPABASE_ANON);
}

/**
 * Check if the customer text expressed refusal or objection.
 */
function isCustomerRejection(text) {
  if (!text) return false;
  return /(مش\s*(عايز|عاوز|مهتم|شار|محتاج)|غالي|بلاش|الغ(ي|اء)|لا\s*شكر)/i.test(text);
}

/**
 * Generate a personalized, highly compliant Arabic follow-up message.
 */
function generateFollowupMessage(session, subscriberName = '') {
  const greeting = subscriberName ? `يا فندم ${subscriberName} 💜` : `يا فندم حبيت أطمن عليكي 💜`;
  const cart = Array.isArray(session.cart_json) ? session.cart_json : [];
  const bundle = String(session.selected_bundle || '').toLowerCase();
  
  // Extract last customer query text if available
  let lastUserText = '';
  if (Array.isArray(session.history_json) && session.history_json.length > 0) {
    for (let i = session.history_json.length - 1; i >= 0; i--) {
      const turn = session.history_json[i];
      if (turn.role === 'user' || turn.sender === 'user') {
        lastUserText = String(turn.text || turn.content || '');
        break;
      }
    }
  }

  // 1. Abandoned cart reminder
  if (cart.length > 0) {
    const itemNames = cart.map(i => i.name).filter(Boolean);
    const cartDesc = itemNames.length > 0 ? ` (${itemNames.slice(0, 2).join(' + ')})` : '';
    return `${greeting} أوردرك${cartDesc} لسه محفوظ ومستنيك 🌸 تحبي نجهزهولك النهاردة ويوصلك لحد باب البيت مع حق المعاينة قبل الدفع؟ 🎁`;
  }

  // 2. Brightening / Dark Areas
  if (bundle === 'brightening' || /(تفتيح|بكيني|اندر|بقع|كلف|غمقان)/i.test(lastUserText)) {
    return `${greeting} لو محتارة في روتين التفتيح أو عندك أي استفسار عن طريقة الاستخدام والنتيجة أنا معاكي خطوة بخطوة 🌸 وعرض الشحن المجاني ومعاينة المنتجات قبل الدفع لسه محفوظ ليكي 🎁`;
  }

  // 3. Acne Cleanser / Oily Skin
  if (bundle === 'face-body' || /(حبوب|حب\s*شباب|مسام|دهون|غسول)/i.test(lastUserText)) {
    return `${greeting} لو عندك أي استفسار بخصوص غسول حب الشباب وتنظيف المسام أنا معاكي 🌸 تحبي نجهزلك الأوردر يوصلك خلال يومين مع حق المعاينة قبل الاستلام؟ 🚚`;
  }

  // 4. Post-Laser / Sensitive Skin / Recovery
  if (bundle === 'postlaser' || /(ليزر|جلس|حروق|احمرار|التهاب)/i.test(lastUserText)) {
    return `${greeting} لو حابة تستفسري أكتر عن كريم ما بعد الليزر والترطيب أنا معاكي خطوة بخطوة 🌸 ومعاكي حق المعاينة الكاملة قبل الدفع 🎁`;
  }

  // 5. General Skincare Nudge
  return `${greeting} لو محتاجة مساعدة في اختيار المنتج الأنسب لنوع بشرتك أو عندك أي سؤال أنا تحت أمرك 🌸 وحق المعاينة قبل الدفع متاح دايماً 🎁`;
}

/**
 * Scan for eligible follow-up candidates within the safe 2h-22h window.
 */
async function getFollowupCandidates({ limit = 30 } = {}) {
  const sb = getSbClient();
  const now = new Date();
  const minTime = new Date(now.getTime() - 22 * 60 * 60 * 1000).toISOString(); // 22h ago max
  const maxTime = new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString();  // 2h ago min

  let query = sb
    .from('chat_bot_sessions')
    .select('session_id, customer_phone, customer_name, chat_channel, updated_at, history_json, cart_json, selected_bundle, checkout_wizard_json')
    .or('chat_channel.eq.messenger,chat_channel.eq.instagram,session_id.like.manychat:%,session_id.like.instagram:%')
    .gte('updated_at', minTime)
    .lte('updated_at', maxTime)
    .order('updated_at', { ascending: false })
    .limit(limit);

  const { data, error } = await query;
  if (error) {
    console.error('[customerFollowup] Query error:', error);
    return { ok: false, error: error.message };
  }

  const sessions = data || [];
  const candidates = [];

  for (const s of sessions) {
    const sid = s.session_id || '';
    const contactId = sid.replace(/^(manychat:|instagram:|messenger:)/, '').trim();
    if (!contactId || !/^\d+$/.test(contactId)) continue;

    // Determine channel
    let channel = s.chat_channel;
    if (!channel) {
      if (sid.startsWith('instagram:')) channel = 'instagram';
      else channel = 'messenger';
    }

    // 1. Check if orders already placed
    let hasOrder = false;
    if (s.checkout_wizard_json?.step === 'completed' || s.checkout_wizard_json?.orderNumber) {
      hasOrder = true;
    } else {
      const orders = await fetchSessionOrders(sid);
      if (orders && orders.length > 0) hasOrder = true;
      if (!hasOrder && s.customer_phone) {
        const phoneOrders = await fetchPhoneOrders(s.customer_phone);
        if (phoneOrders && phoneOrders.length > 0) hasOrder = true;
      }
    }

    if (hasOrder) {
      // Mark in ManyChat so we never check them again
      await addManyChatTagByName(contactId, 'Order_Placed');
      continue;
    }

    // 2. Check ManyChat subscriber status and tags
    const subInfo = await getManyChatSubscriberInfo(contactId);
    if (!subInfo.ok || !subInfo.subscriber) continue;

    const sub = subInfo.subscriber;
    const tags = Array.isArray(sub.tags) ? sub.tags.map(t => t.name) : [];

    // Already followed up or completed order
    if (tags.includes('Followup_Sent') || tags.includes('Order_Placed')) continue;

    // Check customer refusal
    if (isCustomerRejection(sub.last_input_text)) continue;

    // Calculate elapsed hours
    const updatedAt = new Date(s.updated_at);
    const elapsedHours = ((now - updatedAt) / (1000 * 60 * 60)).toFixed(1);

    const messageText = generateFollowupMessage(s, sub.first_name || '');

    candidates.push({
      sessionId: sid,
      contactId,
      channel,
      subscriberName: sub.name || s.customer_name || 'عميلة',
      lastInput: sub.last_input_text || '',
      selectedBundle: s.selected_bundle || 'general',
      elapsedHours: Number(elapsedHours),
      updatedAt: s.updated_at,
      messageText,
    });
  }

  return { ok: true, count: candidates.length, candidates };
}

/**
 * Send follow-up to a specific candidate safely.
 */
async function sendFollowupToCandidate({ contactId, channel, messageText }) {
  if (!contactId || !messageText) return { ok: false, error: 'missing_params' };

  // Send message inside 24h window (tag = null ensures standard compliant messaging)
  const sendRes = await sendManyChatMessage(contactId, messageText, null, channel);
  if (!sendRes.ok) {
    return { ok: false, error: sendRes.error };
  }

  // Tag subscriber in ManyChat as Followup_Sent
  await addManyChatTagByName(contactId, 'Followup_Sent');

  return { ok: true };
}

/**
 * Run automated follow-up batch (with safe pacing).
 */
async function runAutoFollowups({ limit = 15, dryRun = false } = {}) {
  const scan = await getFollowupCandidates({ limit });
  if (!scan.ok) return scan;

  if (dryRun) {
    return { ok: true, dryRun: true, count: scan.candidates.length, candidates: scan.candidates };
  }

  let sent = 0;
  const errors = [];

  for (const c of scan.candidates) {
    const res = await sendFollowupToCandidate(c);
    if (res.ok) {
      sent++;
    } else {
      errors.push({ contactId: c.contactId, error: res.error });
    }
    // Safe rate-limit delay (500ms between sends)
    await new Promise(r => setTimeout(r, 500));
  }

  return {
    ok: true,
    scanned: scan.candidates.length,
    sent,
    failed: errors.length,
    errors,
  };
}

module.exports = {
  getFollowupCandidates,
  sendFollowupToCandidate,
  runAutoFollowups,
};
