// Factual order lookups for chat — session orders, summaries, remove-intent.
const { createClient } = require('@supabase/supabase-js');
const { normalizePhone } = require('./chatSessionStore');

const sb = createClient(
  process.env.SUPABASE_URL || 'https://ikryeyqrithikabwidov.supabase.co',
  process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlrcnlleXFyaXRoaWthYndpZG92Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE3MzY1ODcsImV4cCI6MjA5NzMxMjU4N30.kNfHPxV4fq67cOF8uFsTrLOxPYcLcmmDO3ScIHzI9Uo'
);

function statusAr(s) {
  const m = {
    pending: 'قيد الانتظار',
    confirmed: 'مؤكد',
    preparing: 'جاري التجهيز',
    shipped: 'تم الشحن',
    delivered: 'تم التوصيل',
    cancelled: 'ملغي',
  };
  return m[s] || s;
}

async function fetchSessionOrders(sid) {
  const { data, error } = await sb.rpc('list_orders_by_chat_session', {
    p_session_id: sid,
    p_limit: 3,
  });
  if (error || !data?.found) return [];
  return data.orders || [];
}

async function fetchPhoneOrders(phone) {
  const { data, error } = await sb.rpc('list_orders_by_phone', { p_phone: phone, p_limit: 3 });
  if (error || !data?.found) return [];
  return data.orders || [];
}

function formatOrderLines(order) {
  const items = Array.isArray(order.items) ? order.items : [];
  if (!items.length) return `• ${order.order_number} — ${statusAr(order.status)} — ${Math.round(order.total)} ج.م`;
  const lines = items.map(i => `  • ${i.name} × ${i.qty} — ${Math.round(Number(i.price) * Number(i.qty))} ج.م`);
  return `**${order.order_number}** (${statusAr(order.status)}) — ${Math.round(order.total)} ج.م\n${lines.join('\n')}`;
}

function wantsOrderSummary(message) {
  const t = String(message || '').trim();
  if (!t) return false;
  return /(طلبت\s*إ?يه|إ?يه\s*(اللي\s*)?طلبت|طلبي\s*فيه\s*إ?يه|ايه\s*الطلب|اللي\s*اطلب|حبيبتي\s*انا\s*كدا\s*طلبت|my\s*order|what\s*did\s*i\s*order)/i.test(t);
}

function wantsRemoveProduct(message) {
  const t = String(message || '').trim();
  if (!t) return false;
  // "شيل"/"اشيل" only count when the word itself starts with them — as a
  // bare substring they matched inside completely unrelated conjugations
  // like "بشيل" ("[it] removes...", e.g. "دواء بشيل آثار الندبات" — a
  // price question about a product, not a removal command), silently
  // hijacking the reply into the order-management flow instead of
  // answering it. No trailing boundary: "شيلي"/"شيله"/"شيلها" (common
  // imperative forms with an attached pronoun) must still match.
  return /((^|\s)(شيل|اشيل|امسح|ازيل|أزيل|remove|خرج|أخرج)|مش\s*عا(يز|و))/i.test(t);
}

function productHintFromMessage(message) {
  const t = String(message || '').toLowerCase();
  const hints = [
    { re: /(حبوب|حب\s*الشباب|غسول\s*الوجه)/, label: 'غسول حب الشباب' },
    { re: /(لوشن|لوشن\s*الجسم|اليدين)/, label: 'لوشن' },
    { re: /(تفتيح|كريم\s*التفتيح)/, label: 'كريم التفتيح' },
    { re: /(سيليكون|ندبات|جل)/, label: 'جل السيليكون' },
    { re: /(ليزر)/, label: 'كريم الليزر' },
  ];
  for (const h of hints) {
    if (h.re.test(t)) return h.label;
  }
  return null;
}

function itemMatchesHint(item, hint) {
  if (!hint || !item?.name) return false;
  const name = String(item.name).toLowerCase();
  const h = hint.toLowerCase();
  if (name.includes(h) || h.includes(name.slice(0, 8))) return true;
  const words = h.split(/\s+/).filter(w => w.length > 3);
  return words.some(w => name.includes(w));
}

// Customers rarely type a product's exact catalog name — "كريم الليزر" for
// "كريم العناية بعد الليزر", "كريم التصبغات" for "كريم التفتيح" — so a plain
// substring match against `products.name` (as used elsewhere in this file
// and in orderManage.js) misses these real, common phrasings entirely.
// Shared here so both the price-question fast path (chatEngine.js) and the
// order-modify "add a product" step (orderManage.js) resolve the same
// colloquial names to the same real product, instead of each guessing
// independently. Order of the alias rules matters — more specific matches
// (e.g. "غسول" + "تفتيح") must be checked before their broader sibling
// ("تفتيح" alone) to avoid picking the wrong one of two similarly-named
// products.
const PRODUCT_ALIAS_RULES = [
  { test: (t) => /غسول/.test(t) && /تفتيح/.test(t), name: 'غسول التفتيح' },
  { test: (t) => /(تصبغ|كلف|بقع)/.test(t) || (/تفتيح/.test(t) && !/غسول/.test(t)), name: 'كريم التفتيح' },
  { test: (t) => /ليزر/.test(t), name: 'كريم العناية بعد الليزر' },
  { test: (t) => /(حبوب|حب\s*الشباب)/.test(t), name: 'غسول علاج حب الشباب للوجه' },
  { test: (t) => /(لوشن|ايدين|يدين)/.test(t) || (/جسم/.test(t) && !/وجه/.test(t)), name: 'لوشن اليدين والجسم' },
  { test: (t) => /(سيليكون|ندبات|آثار|اثار)/.test(t), name: 'جل السيليكون لعلاج آثار الندبات' },
];

function resolveProductMentions(text, products) {
  const t = String(text || '');
  if (!t.trim() || !Array.isArray(products) || !products.length) return [];
  const found = new Set();

  for (const p of products) {
    if (p?.name && t.includes(p.name)) found.add(p.name);
  }
  for (const rule of PRODUCT_ALIAS_RULES) {
    if (rule.test(t)) {
      const p = products.find((p) => p.name === rule.name);
      if (p) found.add(p.name);
    }
  }

  return products.filter((p) => found.has(p.name));
}

function lastModelMessage(history) {
  for (let i = (history || []).length - 1; i >= 0; i--) {
    if (history[i]?.role === 'model') return history[i].text || '';
  }
  return '';
}

function wasAskingToAddToCart(text) {
  // "تحبي أسجلك أوردر يا فندم؟" is the current prompt-mandated recommend
  // nudge (the prompt explicitly bans the older "تحبي تضيفيه؟" phrasing
  // this regex used to be built around) — without matching "أسجلك"/"سجل"
  // here too, a plain "تمام"/"اوك" reply to that exact question fell
  // through with no deterministic recognition at all.
  return /(تحبي\s*أ?ضيف|أ?ضيف(ه|هولك|ليك)?\s*(لل)?(سلة|السلة|أوردر|الأوردر)|أحط(ه|هولك)?\s*(في)?\s*(ال)?(سلة|أوردر)|أ?سجلك?\s*(ال)?أوردر|add\s*(it\s*)?to\s*(the\s*)?cart)/i.test(text || '');
}

function isProductAddConfirmation(message) {
  const t = String(message || '').trim();
  return /^(اوك|ok|okay|ايو[ae]|أ?[iي]و[ae]|نعم|أ?[iي]اه|آه|اه|يريت|تمام|ماشي|حاضر|موافق|yes|yeah|yep)[!.،?\s]*$/i.test(t);
}

async function tryOrderContextReply({ message, sid, cart, customerPhone, chatHistory }) {
  const cartEmpty = !cart || !cart.length;

  if (wantsOrderSummary(message)) {
    let orders = await fetchSessionOrders(sid);
    if (!orders.length && customerPhone) {
      const phoneOrders = await fetchPhoneOrders(customerPhone);
      if (phoneOrders.length) {
        const enriched = [];
        for (const o of phoneOrders) {
          const { data } = await sb.rpc('get_order_items_for_cart', {
            p_order_number: o.order_number,
            p_phone: customerPhone,
          });
          enriched.push({ ...o, items: data?.ok ? data.items : [] });
        }
        orders = enriched;
      }
    }
    if (!orders.length) {
      if (cartEmpty) {
        return {
          reply: 'لسه مفيش طلب متسجّل في المحادثة دي. لو عاوزة تطلبي، قوليلي المنتجات اللي تحبيها 💜',
          sessionId: sid,
        };
      }
      return {
        reply: `لسه مفيش طلب مؤكد — في أوردرك:\n${cart.map(i => `• ${i.name} × ${i.qty}`).join('\n')}\n\nتحبي **نكمل الطلب** ولا **تضيفي حاجة**؟`,
        sessionId: sid,
      };
    }
    const latest = orders[0];
    const body = orders.map(formatOrderLines).join('\n\n');
    const prefix = orders.length === 1
      ? `آخر طلبك (${latest.order_number}):`
      : `طلباتك الأخيرة:`;
    return { reply: `${prefix}\n\n${body}`, sessionId: sid };
  }

  if (cartEmpty && wantsRemoveProduct(message)) {
    const orders = await fetchSessionOrders(sid);
    if (!orders.length) {
      return {
        reply: 'الأوردر فاضي ومفيش طلب نشط في المحادثة دي. لو عاوزة تعدّلي طلب سابق، ابعتيلي **رقم الموبايل** اللي سجّلتيه بيه 📱',
        sessionId: sid,
        startOrderWizard: true,
      };
    }
    const latest = orders[0];
    const items = Array.isArray(latest.items) ? latest.items : [];
    const hint = productHintFromMessage(message);

    if (hint) {
      const inOrder = items.find(i => itemMatchesHint(i, hint));
      if (!inOrder) {
        const inOrderList = items.map(i => i.name).join('، ') || 'مفيش منتجات';
        return {
          reply: `طلب \`${latest.order_number}\` فيه: ${inOrderList}.\n\n**${hint}** مش موجود في الطلب ده — على الأرجح ما اتضافش لأوردرك قبل ما نكمّل الدفع.\n\nلو عاوزة تلغي الطلب أو تعدّلي عنوان، ابعتيلي **رقم الموبايل** 📱`,
          sessionId: sid,
          startOrderWizard: true,
        };
      }
      return {
        reply: `طلب \`${latest.order_number}\` فيه **${inOrder.name}**.\n\nلتعديل المنتجات لازم نلغي الطلب ونعيده — ابعتيلي **رقم الموبايل** (${latest.customer_phone ? 'اللي سجّلتيه' : 'اللي سجّلتيه في الطلب'}) 📱`,
        sessionId: sid,
        startOrderWizard: true,
      };
    }

    return {
      reply: `آخر طلبك \`${latest.order_number}\`:\n${formatOrderLines(latest)}\n\nعشان **نشيل منتج من طلب مؤكد**، ابعتيلي **رقم الموبايل** وهساعدك 💜`,
      sessionId: sid,
      startOrderWizard: true,
    };
  }

  return null;
}

module.exports = {
  tryOrderContextReply,
  isProductAddConfirmation,
  wasAskingToAddToCart,
  lastModelMessage,
  resolveProductMentions,
  fetchSessionOrders,
  formatOrderLines,
};
