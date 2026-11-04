// lib/botMonitor.js — Live Bot Conversations Inspector & Rule Training Engine
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://ikryeyqrithikabwidov.supabase.co';
const SUPABASE_SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SERVICE_ROLE || '';
const SUPABASE_ANON = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlrcnlleXFyaXRoaWthYndpZG92Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE3MzY1ODcsImV4cCI6MjA5NzMxMjU4N30.kNfHPxV4fq67cOF8uFsTrLOxPYcLcmmDO3ScIHzI9Uo';

function getSbClient() {
  if (SUPABASE_SERVICE) {
    return createClient(SUPABASE_URL, SUPABASE_SERVICE, { auth: { persistSession: false } });
  }
  return createClient(SUPABASE_URL, SUPABASE_ANON);
}

// In-memory cache for prompt injection (60s TTL)
let _rulesPromptCache = { text: '', expiresAt: 0 };

/**
 * 1. List recent bot conversations across all channels
 */
async function listBotConversations({ limit = 50, channel = '', search = '' } = {}) {
  const sb = getSbClient();
  let query = sb
    .from('chat_bot_sessions')
    .select('session_id, customer_phone, customer_name, chat_channel, updated_at, history_json, cart_json, selected_bundle, checkout_wizard_json')
    .order('updated_at', { ascending: false })
    .limit(Math.min(100, Math.max(1, Number(limit) || 50)));

  if (channel) {
    if (channel === 'web') {
      query = query.or('chat_channel.eq.web,chat_channel.is.null,session_id.not.like.instagram:%,session_id.not.like.messenger:%,session_id.not.like.whatsapp:%');
    } else {
      query = query.or(`chat_channel.eq.${channel},session_id.like.${channel}:%`);
    }
  }

  const { data, error } = await query;
  if (error) {
    console.error('[botMonitor] listBotConversations error:', error);
    return { ok: false, error: error.message, conversations: [] };
  }

  const list = (data || []).map((row) => {
    const sid = row.session_id || '';
    let ch = row.chat_channel || '';
    if (!ch) {
      if (sid.startsWith('instagram:')) ch = 'instagram';
      else if (sid.startsWith('messenger:')) ch = 'messenger';
      else if (sid.startsWith('whatsapp:')) ch = 'whatsapp';
      else ch = 'web';
    }

    const history = Array.isArray(row.history_json) ? row.history_json : [];
    const turnsCount = history.length;
    let lastUserMsg = '';
    let lastBotReply = '';

    for (let i = history.length - 1; i >= 0; i--) {
      const h = history[i];
      if (!lastBotReply && (h.role === 'model' || h.role === 'bot')) {
        lastBotReply = String(h.text || h.parts?.[0]?.text || '').trim();
      }
      if (!lastUserMsg && h.role === 'user') {
        lastUserMsg = String(h.text || h.parts?.[0]?.text || '').trim();
      }
      if (lastUserMsg && lastBotReply) break;
    }

    // Determine status badge
    let status = 'active';
    let statusLabel = 'محادثة جارية';
    const hasOrder = !!(row.customer_phone && (row.checkout_wizard_json?.step === 'completed' || turnsCount > 6));
    const allText = history.map((m) => String(m.text || '')).join(' ');

    if (hasOrder || /تم\s*تسجيل\s*طلبك|أوردرك\s*اتسجل|رقم\s*الأوردر/i.test(allText)) {
      status = 'converted';
      statusLabel = 'تم الطلب ✅';
    } else if (/خدمة\s*العملاء|01210021115|أكلم\s*حد|مشكلة|شكوى/i.test(allText)) {
      status = 'needs_human';
      statusLabel = 'تحويل لخدمة العملاء 📞';
    } else if (/غالي|هفكر|مش\s*دلوقتي|كتير/i.test(allText)) {
      status = 'hesitant';
      statusLabel = 'تردد / اعتراض سعر ⚠️';
    }

    return {
      sessionId: sid,
      channel: ch,
      customerName: row.customer_name || 'عميلة غير مسجلة',
      customerPhone: row.customer_phone || null,
      turnsCount,
      lastUserMsg: lastUserMsg.slice(0, 140),
      lastBotReply: lastBotReply.slice(0, 140),
      status,
      statusLabel,
      cartItemsCount: Array.isArray(row.cart_json) ? row.cart_json.length : 0,
      selectedBundle: row.selected_bundle || null,
      updatedAt: row.updated_at,
    };
  });

  // Client-side search filtering if provided
  let filtered = list;
  if (search) {
    const q = String(search).toLowerCase().trim();
    filtered = list.filter(
      (c) =>
        c.customerName.toLowerCase().includes(q) ||
        (c.customerPhone && c.customerPhone.includes(q)) ||
        c.sessionId.toLowerCase().includes(q) ||
        c.lastUserMsg.toLowerCase().includes(q)
    );
  }

  return { ok: true, count: filtered.length, conversations: filtered };
}

/**
 * 2. Get full conversation detail for a single session
 */
async function getBotConversationDetail(sessionId) {
  if (!sessionId) return { ok: false, error: 'sessionId required' };
  const sb = getSbClient();
  const { data, error } = await sb
    .from('chat_bot_sessions')
    .select('*')
    .eq('session_id', sessionId)
    .maybeSingle();

  if (error || !data) {
    return { ok: false, error: error?.message || 'المحادثة غير موجودة' };
  }

  const sid = data.session_id || '';
  let channel = data.chat_channel || '';
  if (!channel) {
    if (sid.startsWith('instagram:')) channel = 'instagram';
    else if (sid.startsWith('messenger:')) channel = 'messenger';
    else if (sid.startsWith('whatsapp:')) channel = 'whatsapp';
    else channel = 'web';
  }

  const rawHistory = Array.isArray(data.history_json) ? data.history_json : [];
  const history = rawHistory.map((m, idx) => ({
    id: idx + 1,
    role: (m.role === 'model' || m.role === 'bot') ? 'bot' : 'user',
    text: String(m.text || m.parts?.[0]?.text || '').trim(),
    time: m.time || m.timestamp || null,
  }));

  return {
    ok: true,
    conversation: {
      sessionId: sid,
      channel,
      customerName: data.customer_name || 'عميلة غير مسجلة',
      customerPhone: data.customer_phone || null,
      cart: Array.isArray(data.cart_json) ? data.cart_json : [],
      checkoutWizard: data.checkout_wizard_json || null,
      selectedBundle: data.selected_bundle || null,
      updatedAt: data.updated_at,
      history,
    },
  };
}

/**
 * 3. List all learned rules and corrections
 */
async function getBotLearnedRules() {
  const sb = getSbClient();
  try {
    const { data } = await sb
      .from('site_settings')
      .select('value')
      .eq('key', 'bot_learned_rules')
      .maybeSingle();

    let rules = [];
    if (data?.value) {
      try {
        rules = typeof data.value === 'string' ? JSON.parse(data.value) : data.value;
      } catch (_) {
        rules = [];
      }
    }
    return { ok: true, rules: Array.isArray(rules) ? rules : [] };
  } catch (err) {
    return { ok: false, error: err.message, rules: [] };
  }
}

/**
 * 4. Save a new bot correction rule taught by the owner
 */
async function saveBotCorrection({ customerQuery, badReply = '', idealReply, ruleNote = '', sessionId = '' } = {}) {
  if (!idealReply || !String(idealReply).trim()) {
    return { ok: false, error: 'الرد النموذجي مطلوب' };
  }
  const sb = getSbClient();

  const { rules } = await getBotLearnedRules();
  const newRule = {
    id: 'rule_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 6),
    customerQuery: String(customerQuery || '').trim().slice(0, 300),
    badReply: String(badReply || '').trim().slice(0, 400),
    idealReply: String(idealReply).trim().slice(0, 1500),
    ruleNote: String(ruleNote || '').trim().slice(0, 300),
    sessionId: String(sessionId || '').trim(),
    createdAt: new Date().toISOString(),
  };

  const updatedRules = [newRule, ...rules.slice(0, 99)]; // Keep up to 100 rules

  const { data: existing } = await sb
    .from('site_settings')
    .select('key')
    .eq('key', 'bot_learned_rules')
    .maybeSingle();

  const jsonValue = JSON.stringify(updatedRules);

  if (existing) {
    await sb
      .from('site_settings')
      .update({ value: jsonValue, updated_at: new Date().toISOString() })
      .eq('key', 'bot_learned_rules');
  } else {
    await sb
      .from('site_settings')
      .insert({ key: 'bot_learned_rules', value: jsonValue });
  }

  // Bust cache
  _rulesPromptCache.expiresAt = 0;

  return { ok: true, rule: newRule, count: updatedRules.length };
}

/**
 * 5. Delete a learned rule
 */
async function deleteBotCorrection(ruleId) {
  if (!ruleId) return { ok: false, error: 'ruleId required' };
  const sb = getSbClient();
  const { rules } = await getBotLearnedRules();
  const filtered = rules.filter((r) => r.id !== ruleId);

  await sb
    .from('site_settings')
    .update({ value: JSON.stringify(filtered), updated_at: new Date().toISOString() })
    .eq('key', 'bot_learned_rules');

  _rulesPromptCache.expiresAt = 0;
  return { ok: true, count: filtered.length };
}

/**
 * 6. Format learned rules for immediate prompt injection into Gemini system instruction
 */
async function getBotLearnedRulesPrompt() {
  const now = Date.now();
  if (_rulesPromptCache.expiresAt > now) {
    return _rulesPromptCache.text;
  }

  const { rules } = await getBotLearnedRules();
  if (!rules || !rules.length) {
    _rulesPromptCache = { text: '', expiresAt: now + 60_000 };
    return '';
  }

  // Use the most recent 12 rules to keep prompt tight and focused
  const activeRules = rules.slice(0, 12);
  const promptLines = [
    '## توجيهات وتصحيحات معتمدة من إدارة مونتانيا (أولوية قصوى):',
    'التزمي بالردود النموذجية والتوجيهات المعتمدة التالية عند تعاملك مع العملاء:',
  ];

  activeRules.forEach((r, idx) => {
    let block = `${idx + 1}. `;
    if (r.customerQuery) {
      block += `لو العميل سأل/قال: "${r.customerQuery}"\n`;
      block += `   ← الرد المعتمد والأسلوب الصح: "${r.idealReply}"`;
    } else {
      block += `توجيه معتمد: "${r.idealReply}"`;
    }
    if (r.ruleNote) {
      block += ` (ملاحظة: ${r.ruleNote})`;
    }
    promptLines.push(block);
  });

  const promptText = promptLines.join('\n');
  _rulesPromptCache = { text: promptText, expiresAt: now + 60_000 };
  return promptText;
}

/**
 * 7. AI Deep Scan & Behavior Optimization of Recent Conversations
 */
async function scanAndAnalyzeRecentConversations({ count = 20 } = {}) {
  const sb = getSbClient();
  const targetCount = Math.min(50, Math.max(5, Number(count) || 20));

  const { data, error } = await sb
    .from('chat_bot_sessions')
    .select('session_id, customer_phone, customer_name, chat_channel, updated_at, history_json, cart_json, selected_bundle, checkout_wizard_json')
    .order('updated_at', { ascending: false })
    .limit(targetCount * 3);

  if (error || !data) {
    return { ok: false, error: error?.message || 'تعذر جلب المحادثات' };
  }

  const validSessions = data
    .filter((s) => Array.isArray(s.history_json) && s.history_json.length >= 2)
    .slice(0, targetCount);

  if (!validSessions.length) {
    return { ok: false, error: 'لا توجد محادثات كافية للفحص والتحليل حالياً' };
  }

  let transcript = '';
  let convertedCount = 0;

  validSessions.forEach((s, idx) => {
    const history = s.history_json || [];
    const hasOrder = !!(s.customer_phone && (s.checkout_wizard_json?.step === 'completed' || history.length > 6));
    if (hasOrder) convertedCount++;

    transcript += `\n--- [محادثة #${idx + 1} | القناة: ${s.chat_channel || 'web'} | العميل: ${s.customer_name || 'عميلة'} | نتيجة: ${hasOrder ? 'أوردر مسجل' : 'لم يكتمل أوردر'}] ---\n`;
    history.forEach((m) => {
      const sender = (m.role === 'model' || m.role === 'bot') ? 'بوت مونتانيا' : 'العميل';
      const text = String(m.text || m.parts?.[0]?.text || '').trim();
      transcript += `${sender}: ${text}\n`;
    });
  });

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return { ok: false, error: 'GEMINI_API_KEY غير مضبوط في البيئة' };
  }

  const { GoogleGenerativeAI } = require('@google/generative-ai');
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.5-flash',
    generationConfig: {
      temperature: 0.3,
      responseMimeType: 'application/json',
    },
  });

  const prompt = `أنت كبير مستشاري تحسين معدل التحويل (CRO) والمبيعات لبراند سكين كير مصري "Montana Naturals".
منتجات مونتانيا الأساسية:
- روتين التفتيح المتكامل (777 ج.م - شحن مجاني)
- روتين ما بعد الليزر (618 ج.م - شحن مجاني)
- روتين الوجه والجسم (558 ج.م - شحن مجاني)
- غسول التفتيح (299 ج.م)
- كريم التفتيح (249 ج.م)
- لوشن الجسم (299 ج.م)
- الشحن 65-75 ج للمحافظات، ومجاني من 3 منتجات. الدفع 100% كاش عند الاستلام بعد المعاينة بدون أي مقدم.

أمامك ${validSessions.length} محادثة حقيقية جرت بين عملاء مصريين وبوت البيع على الشات (إنستجرام، ماسنجر، واتساب، الموقع).
المطلوب تحليل هذه المحادثات واستخراج الأسباب الحقيقية وراء تسرب العملاء أو عدم إتمام الأوردر، وتقديم توصيات رد محددة وقابلة للتطبيق فوراً.

يجب إرجاع النتيجة بتنسيق JSON حصري مطابق للـ Schema التالية:
{
  "overview": "ملخص تحليلي تنفيذي من 3-4 أسطر يشرح سلوك العملاء في هذه العينة وأكبر فجوة في أسلوب البوت",
  "metrics": {
    "totalScanned": ${validSessions.length},
    "convertedCount": ${convertedCount},
    "conversionRate": "${Math.round((convertedCount / validSessions.length) * 100)}%"
  },
  "topDropoffReasons": [
    "سبب 1: ...",
    "سبب 2: ...",
    "سبب 3: ..."
  ],
  "recommendations": [
    {
      "id": "rec_1",
      "title": "عنوان المشكلة باختصار",
      "category": "شحن / سعر / طمأنة / اعتراض / إغلاق البيع",
      "problemObserved": "شرح ما حدث في المحادثات ولماذا تردد العميل",
      "suggestedRule": "الرد والتوجيه النموذجي المعتمد بالعامية المصرية الذي يجب أن يتعلمه البوت فوراً لحل هذا الاعتراض",
      "ruleNote": "توجيه إضافي للبوت (اختياري)"
    }
  ]
}

إليك المحادثات للتحليل:
${transcript}`;

  try {
    const res = await model.generateContent(prompt);
    const rawText = res.response.text();
    let json;
    try {
      json = JSON.parse(rawText);
    } catch (_) {
      const match = rawText.match(/\{[\s\S]*\}/);
      if (match) json = JSON.parse(match[0]);
      else throw new Error('تعذر قراءة تحليل الذكاء الاصطناعي');
    }

    return {
      ok: true,
      report: json,
    };
  } catch (err) {
    console.error('[botMonitor] scan error:', err);
    return { ok: false, error: err.message };
  }
}

module.exports = {
  listBotConversations,
  getBotConversationDetail,
  getBotLearnedRules,
  saveBotCorrection,
  deleteBotCorrection,
  getBotLearnedRulesPrompt,
  scanAndAnalyzeRecentConversations,
};
