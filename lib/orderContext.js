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

/** Customer-service number for order disputes / missing orders in admin. */
const CS_SUPPORT_PHONE = '01019787225';

function orderNotFoundCsReply() {
  return (
    `يا فندم أنا آسفة، مش لاقية أي أوردر بالبيانات دي في السيستم 💜\n\n` +
    `اتصلي بخدمة العملاء على **${CS_SUPPORT_PHONE}** وهيراجعوا الموضوع معاكي فورًا.`
  );
}

/**
 * An order problem (late, missing, wrong, a payment question) goes straight to
 * a human — no phone lookup, no back-and-forth. Owner's rule: the bot must not
 * argue or stall on these, just hand over the customer service number.
 */
function orderIssueCsReply() {
  return (
    `أنا آسفة على اللي حصل يا فندم 💜\n\n` +
    `الموضوع ده بيتراجع مع خدمة العملاء على طول — كلمينا على **${CS_SUPPORT_PHONE}** ` +
    `وهيراجعوا أوردرك ويظبطوهولك فورًا.`
  );
}

/**
 * A complaint about an order that already exists — late, wrong, damaged, an
 * item missing, a return. wantsExistingOrderHelp() only covers "where is it",
 * so these were falling through to the sales flow. Needs an order word AND a
 * problem word, so "مشكلة في بشرتي" is never mistaken for an order complaint.
 */
function isOrderProblemComplaint(message) {
  const t = prepareCustomerText(expandFrancoAndTypos(message));
  if (!t) return false;
  if (!/(اوردر|أوردر|طلب|طلبي|طلبيه|شحن[ةه]|الشحنه|الاوردر)/i.test(t)) return false;
  // "ارجع/رجع" only right before the order word — otherwise "عايزة ارجع اطلب
  // تاني" (a customer wanting to buy again) would be read as a return request.
  if (/(^|\s)ا?رجّ?ع\s*(ال)?(اوردر|أوردر|طلب|طلبيه|شحنه)/i.test(t)) return true;
  return /(مشكل[ةه]|مشاكل|شكو[يى]|اشتك[يى]|بشتك[يى]|غلط|خط[أا]|ناقص|مكسور|تالف|مضروب|مرتجع|استرجاع|استبدال|ا?[رإ]رجاع|ترجيع|ا?تاخر|مت[أا]خر|لسه\s*ما\s*جاش|ما\s*جاش|اتلغ[يى]|ملغ[يى])/i.test(t);
}

/** Existing order: where is it / not delivered / paid deposit / reopen old chat. */
function wantsExistingOrderHelp(message) {
  const t = prepareCustomerText(expandFrancoAndTypos(message));
  if (!t) return false;
  return /(فين\s*(ال)?(أوردر|اوردر|طلب)|موصلش|موصلتش|ما\s*وصل|مش\s*واصل|حالة\s*(ال)?(طلب|أوردر|اوردر)|تتبع|وين\s*(ال)?(طلب|أوردر)|ديبوز|ديبوسيت|deposit|مقدم|مقدّم|دفعت|دفعتي|دفع\s*(مقدم|ديبوز)|لينك\s*(ال)?دفع|أوردر\s*قديم|طلب\s*قديم|[ات]?رجع[يى]?\s*ل*شات|راجع[يى]?\s*(ل*شات|ال)?(اوردر|أوردر|طلب)?|مش\s*لاقي(ة)?\s*(ال)?(أوردر|اوردر|طلب)|where.?is.?my.?order|track.?order|paid\s*(a\s*)?deposit)/i.test(t)
    || /(الأوردر|الطلب|اوردر|أوردر).{0,25}(موصل|وصل|فين|وين|مش\s*جاي)/i.test(t)
    || /(الدفع|الفلوس|الديبوز).{0,20}(من\s*شهر|بقال|من\s*اسبوع)/i.test(t);
}

function botAskedForOrderLookupPhone(lastBot) {
  const t = String(lastBot || '');
  if (!t) return false;
  // Checkout collection ("ابعتيلي الاسم ورقم الموبايل والعنوان") is NOT status lookup
  if (
    /ابعتيلي\s*(الاسم|اسمك|العنوان)|والعنوان|المحافظة|بيانات\s*التوصيل|نكمل\s*(ال)?(أوردر|اوردر|طلب)|تسجّ?ل\s*(ال)?أوردر/i.test(t)
  ) {
    return false;
  }
  return /(رقم\s*(ال)?موبايل|موبايلك).{0,50}(أوردر|اوردر|طلب|سجّلت|سجلت)/i.test(t)
    || /(أوردر|اوردر|طلب).{0,50}(رقم\s*(ال)?موبايل|موبايلك)/i.test(t)
    || /مفيش\s*(أي\s*)?(أوردر|اوردر|طلب)/i.test(t)
    || /مش\s*لاقي(ة)?\s*(أي\s*)?(أوردر|اوردر|طلب)/i.test(t)
    || /ابعتيلي\s*\*?\*?رقم\s*(ال)?موبايل/i.test(t)
    || /خدمة\s*العملاء\s*على/i.test(t);
}

function formatOrdersStatusReply(orders) {
  const list = (orders || []).map((o, i) => {
    const when = o.created_at ? ` — ${String(o.created_at).slice(0, 10)}` : '';
    return `${i + 1}. \`${o.order_number}\` — ${statusAr(o.status)} — ${Math.round(Number(o.total) || 0)} ج.م${when}`;
  }).join('\n');
  const latest = orders[0];
  const head = orders.length === 1
    ? `لقيت طلبك \`${latest.order_number}\` — حالته: **${statusAr(latest.status)}** — ${Math.round(Number(latest.total) || 0)} ج.م`
    : `لقيت ${orders.length} طلبات على الرقم ده:\n${list}`;
  return `${head}\n\nلو محتاجة مساعدة أكتر، كلمي خدمة العملاء على **${CS_SUPPORT_PHONE}** 💜`;
}

function wantsOrderSummary(message) {
  const t = String(message || '').trim();
  if (!t) return false;
  return /(طلبت\s*إ?يه|إ?يه\s*(اللي\s*)?طلبت|طلبي\s*فيه\s*إ?يه|ايه\s*الطلب|اللي\s*اطلب|كدا\s*طلبت|كذا\s*طلبت|حبيبتي\s*انا\s*كدا\s*طلبت|my\s*order|what\s*did\s*i\s*order)/i.test(t);
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
  const t = prepareCustomerText(message);
  const hints = [
    { re: /(حبوب|حب\s*الشباب|غسول\s*الوجه)/, label: 'غسول حب الشباب' },
    { re: /(لوشن|لوشن\s*الجسم|اليدين)/, label: 'لوشن' },
    { re: /(تفتيح|تفت|كريم\s*التفتيح)/, label: 'كريم التفتيح' },
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

// Soft-normalize Arabic + expand common Franco/typos so "tfteh", "تفتیح",
// "عايزه كريم التفت" still resolve to real catalog products. Matching is
// intent-first — exact spelling is rare in Messenger/WhatsApp.
function softNormalizeAr(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/[\u064B-\u065F]/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    .replace(/ـ/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function expandFrancoAndTypos(text) {
  let t = String(text || '');
  const maps = [
    [/\btf+t+e*h+\b/gi, 'تفتيح'],
    [/\btaf+tee*h+\b/gi, 'تفتيح'],
    [/\bgh[oa]sol\b/gi, 'غسول'],
    [/\bghosol\b/gi, 'غسول'],
    [/\b(krem|cream|crem)\b/gi, 'كريم'],
    [/\b(loshn|lotion|loshen)\b/gi, 'لوشن'],
    // Common Arabic typos for lotion (اللاتنين) — never match inside "الاتنين"
    [/اللاتنين|اللاتين|اللاتن/g, 'لوشن'],
    [/ورهملي|وريهملي|ورّهملي|وريهم\s*لي|ورهم\s*لي/g, 'وريني'],
    // Underarm Franco / slang → تحت الابط (helps brightening routing)
    [/ال?اندر\s*[اآ]?رم|اندرارم|under\s*-?\s*arms?/gi, 'تحت الابط'],
    // Sensitive area Franco / English → مناطق حساسة
    [/سينسيتي[فف]\s*[اإ]?ري[ااه]?|سينسيتف\s*اريا|sensitive\s*areas?/gi, 'مناطق حساسة'],
    [/\b(7bo[pb]|hbob|hobob)\b/gi, 'حبوب'],
    [/\bacne\b/gi, 'حب الشباب'],
    [/\b(ndbat|nodbat|nadabat)\b/gi, 'ندبات'],
    [/\b(silicon|silikon|silicone)\b/gi, 'سيليكون'],
    [/\blaser\b/gi, 'ليزر'],
    [/post\s*-?\s*(laser|ليزر)|بوست\s*-?\s*ليزر|البوست\s*ليزر/gi, 'ما بعد الليزر'],
    [/\bb\s*kam\b/gi, 'بكام'],
    [/بكم/g, 'بكام'],
    [/بكام+/g, 'بكام'],
    // Bare "سعر" typos / keyboard slips (ءعر، سغر، صعر…) → سعر
    [/^(ال)?(ءعر|سغر|صعر|سعؤ|سع|اسعر|ااسعار|sa3r|se3r|sghr)[\s!.،؟?]*$/i, 'سعر'],
    [/\bas3ar\b/gi, 'اسعار'],
    [/\b3ayz[aeh]?\b/gi, 'عايزه'],
    [/\b3awz[aeh]?\b/gi, 'عاوزه'],
    [/غاو[زر]ه/g, 'عاوزه'],
    [/غاوزه/g, 'عاوزه'],
    [/\btsbghat|tasbghat\b/gi, 'تصبغات'],
    [/\bklf\b/gi, 'كلف'],
    [/\bb2a\b/gi, 'بقى'],
    [/\b7lw\b/gi, 'حلو'],
    [/\byaret\b/gi, 'يريت'],
    [/\btmam\b/gi, 'تمام'],
    [/\bnkamm?el\b/gi, 'نكمل'],
    [/\bkamm?el\b/gi, 'كمل'],
    [/\bn5alla[sṣ]?\b/gi, 'نخلص'],
    [/\border\s*now\b/gi, 'اطلب دلوقتي'],
  ];
  for (const [re, ar] of maps) t = t.replace(re, ar);
  return t;
}

function prepareCustomerText(text) {
  return softNormalizeAr(expandFrancoAndTypos(text));
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
  { test: (t) => /غسول/.test(t) && /تفتيح|تفت/.test(t), name: 'غسول التفتيح' },
  // Explicit "كريم" + تفتيح even when غسول is also in the same ask ("الغسول والكريم التفتيح")
  { test: (t) => /كريم/.test(t) && /تفتيح|تفت/.test(t) && !/ليزر/.test(t), name: 'كريم التفتيح' },
  // "كريم مونتانا بكام" / "كريم montana" → flagship whitening cream (not post-laser)
  {
    test: (t) =>
      /كريم/.test(t)
      && /مونتان|montana/i.test(t)
      && !/ليزر|غسول|لوشن|حب\s*الشباب/.test(t),
    name: 'كريم التفتيح',
  },
  { test: (t) => /(تصبغ|كلف|بقع|نمش)/.test(t) || (/تفتيح|تفت/.test(t) && !/غسول/.test(t) && !/كريم/.test(t)), name: 'كريم التفتيح' },
  { test: (t) => /ليزر/.test(t), name: 'كريم العناية بعد الليزر' },
  { test: (t) => /(حبوب|حب\s*الشباب|شباب)/.test(t) && !/تفتيح|تفت/.test(t), name: 'غسول علاج حب الشباب للوجه' },
  { test: (t) => /(لوشن|ايدين|يدين)/.test(t) || (/جسم/.test(t) && !/وجه|غسول|كريم|تفتيح|تفت/.test(t)), name: 'لوشن اليدين والجسم' },
  // Silicone gel intentionally NOT aliased — chat bot must not discuss it
];

/** Products the chat must never pitch / list (still may exist on the website). */
function isChatExcludedProduct(p) {
  if (!p) return false;
  const slug = String(p.slug || '');
  const name = softNormalizeAr(p.name || '');
  return slug === 'silicone-gel'
    || /سيليكون/.test(name)
    || /ندبات/.test(name);
}

function filterChatProducts(products) {
  return (Array.isArray(products) ? products : []).filter((p) => !isChatExcludedProduct(p));
}

/** Customer asked about silicone / scars — deflect without naming the gel. */
function isSiliconeOrScarAsk(message) {
  const t = prepareCustomerText(expandFrancoAndTypos(message));
  if (!t) return false;
  if (/(اثر|اثار|آثار)\s*جانب/.test(t)) return false;
  return /سيليكون|silicone|ندبات|ندب/.test(t)
    || (/(اثر|اثار|آثار).{0,12}(ندب|جرح|عمليه|عملية)/.test(t));
}

/**
 * Resolve bare "و الغسول" / "والكريم" using recent conversation context
 * (e.g. كريم التفتيح in history → غسول التفتيح).
 */
function resolveCategoryFollowUp(message, historyText, products) {
  const t = prepareCustomerText(expandFrancoAndTypos(message));
  if (!t || t.length > 70) return null;
  const bare =
    /^(و\s*)?(ال)?(غسول|كريم|لوشن)([\s!.،؟?]*)$/i.test(t) ||
    /^(والغسول|و\s*الغسول|والكريم|و\s*الكريم|واللوشن|و\s*اللوشن)([\s!.،؟?]*)$/i.test(t) ||
    /^(عا[ييو]ز[اهة]?\s*)?(ال)?(غسول|كريم|لوشن)\s*(بس|فقط|لوحده|وحده)([\s!.،؟?]*)$/i.test(t) ||
    /^(ال)?(غسول|كريم|لوشن)\s*(بس|فقط|لوحده|وحده)([\s!.،؟?]*)$/i.test(t);
  if (!bare) return null;

  const ctx = prepareCustomerText(expandFrancoAndTypos(historyText || ''));
  const list = filterChatProducts(products);

  const pick = (name) => list.find((p) => p.name === name) || null;

  if (/غسول/.test(t)) {
    if (/تفتيح|تصبغ|كلف|بقع|نمش|كريم\s*التفتيح/.test(ctx)) return pick('غسول التفتيح');
    if (/حبوب|حب\s*الشباب|شباب/.test(ctx)) return pick('غسول علاج حب الشباب للوجه');
    return { ambiguous: 'cleanser' };
  }
  if (/كريم/.test(t)) {
    if (/ليزر/.test(ctx)) return pick('كريم العناية بعد الليزر');
    if (/تفتيح|تصبغ|كلف|بقع|نمش/.test(ctx)) return pick('كريم التفتيح');
    return { ambiguous: 'cream' };
  }
  if (/لوشن/.test(t)) return pick('لوشن اليدين والجسم');
  return null;
}

function resolveProductMentions(text, products) {
  const t = prepareCustomerText(text);
  const catalog = filterChatProducts(products);
  if (!t || !catalog.length) return [];
  const found = new Set();

  for (const p of catalog) {
    if (!p?.name) continue;
    const pn = softNormalizeAr(p.name);
    if (!pn) continue;
    if (t.includes(pn)) {
      found.add(p.name);
      continue;
    }
    // Distinctive tokens (≥4 chars) all present — e.g. "كريم التفت" ≈ كريم التفتيح
    const tokens = pn.split(/\s+/).filter((w) => w.length >= 4);
    if (tokens.length >= 2 && tokens.every((w) => t.includes(w) || t.includes(w.slice(0, 4)))) {
      found.add(p.name);
    }
  }
  for (const rule of PRODUCT_ALIAS_RULES) {
    if (rule.test(t)) {
      const p = catalog.find((prod) => prod.name === rule.name);
      if (p) found.add(p.name);
    }
  }

  return catalog.filter((p) => found.has(p.name));
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
  fetchPhoneOrders,
  formatOrderLines,
  formatOrdersStatusReply,
  wantsExistingOrderHelp,
  botAskedForOrderLookupPhone,
  orderNotFoundCsReply,
  orderIssueCsReply,
  isOrderProblemComplaint,
  CS_SUPPORT_PHONE,
  softNormalizeAr,
  expandFrancoAndTypos,
  prepareCustomerText,
  resolveCategoryFollowUp,
  isChatExcludedProduct,
  filterChatProducts,
  isSiliconeOrScarAsk,
};
