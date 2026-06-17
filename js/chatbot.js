/* Montana chatbot — AI-driven (Gemini structured JSON, no regex patching) */
window.MontanaChatbot = (function () {
  var chatOpen = false;
  var history = [];
  var orderData = {};
  var collectingOrder = false;
  var orderStep = 'idle';
  var pendingOrder = null;
  var sessionPhase = 'idle';
  var lastCompletedOrder = null;
  var sessionLang = 'ar';
  var sessionBotOfferedOrder = false;
  var sessionSuggestedProduct = null;
  var sessionSuggestedProducts = [];
  var sessionLastConcern = null;
  var sessionLastConcerns = [];
  var sessionCatalogShown = false;
  var isBotBusy = false;
  var messageQueue = [];
  var processingQueue = false;

  var L = {
    botName: 'نور — Montana',
    statusOnline: 'متصلة دلوقتي',
    statusTyping: 'نور بيكتب...',
    avatar: '\uD83D\uDC9C',
    close: '\u2715',
    send: '\u2190',
    placeholder: 'اكتبي رسالتك...',
    welcome: 'أهلاً يا جميلة! \uD83D\uDC9C أنا نور من Montana — بياعة كوزمتيك ومتخصصة عناية بالبشرة.\n\nقوليلي إيه مشكلة بشرتك (حبوب، جفاف، تفتيح، ندوب) وأنا هختارلك الأنسب — أو قولي «عايز أطلب» على طول.',
    quickReplies: ['عندي حبوب في وشي', 'بشرتي كالحة وبهتة', 'عندي ندوب', 'بشرتي ناشفة', 'ازاي استخدمه؟', 'عايز أطلب'],
    noKey: 'الشات محتاج GROQ_API_KEY في ملف .env — من console.groq.com/keys ثم npm start',
    keyInvalid: 'مفتاح Groq في .env مش شغال — انسخيه تاني من console.groq.com',
    apiError: 'مشكلة من Groq: ',
    busy: 'ثانية واحدة يا حبيبتي — جرّبي تاني. أنا هنا!',
    noUnderstand: 'معلش يا جميلة، وضّحيلي أكتر — حبوب، تفتيح، ندوب، جفاف، أو «عايز أطلب»؟',
    error: 'معلش حاولي تاني. أو قوليلي: «عندي حبوب»، «بشرتي كالحة»، «بكام»، أو «عايز أطلب».',
    helpReply: 'أنا نور ومعاكي خطوة بخطوة! \uD83D\uDC9C ممكن أرشّحلك منتج يناسب بشرتك، أقولك السعر والمكونات، أو نعمل أوردر. قوليلي إيه اللي محتاجاه؟',
    confirmTitle: 'تأكيد الأوردر',
    labelName: 'الاسم',
    labelPhone: 'التليفون',
    labelAddress: 'العنوان',
    labelProducts: 'المنتجات',
    labelTotal: 'الإجمالي',
    currency: 'جنيه',
    confirmBtn: 'تأكيد الأوردر',
    cancelBtn: 'إلغاء',
    saving: 'ثانية واحدة... بسجّل أوردرك \uD83D\uDC9C',
    saved: 'مبروك يا جميلة! \uD83C\uDF89 أوردرك اتسجل بنجاح.\n\nرقم الأوردر: #{id}\n\nهنتواصل معاكي على {phone} قريب جداً لتأكيد الشحن.\n\nشكراً لثقتك في Montana! \uD83D\uDC9C',
    saveFailed: 'معلش في مشكلة في تسجيل الأوردر. تواصلي معانا مباشرة.',
    cancelled: 'تمام يا حبيبتي، مفيش مشكلة! لو احتجتي أي حاجة أنا هنا. \uD83D\uDE0A',
    afterOrder: ['عايزة أشتري حاجة تانية', 'شكراً نور'],
    thanksReply: 'العفو يا جميلة! \uD83D\uDC9C أي سؤال عن بشرتك أو منتج — أنا نور وهنا معاكي.',
    goodbyeReply: 'مع السلامة يا جميلة! \uD83D\uDC9C أي وقت تحتاجي حاجة عن بشرتك — أنا نور وهنا.'
  };

  var LE = {
    botName: 'Nour — Montana',
    statusOnline: 'Online now',
    statusTyping: 'Nour is typing...',
    placeholder: 'Type your message...',
    welcome: 'Hi! \uD83D\uDC4B I\'m the Montana skincare assistant.\n\nWant to learn about our products or tell me about a skin concern?',
    quickReplies: ['I have acne', 'Dull skin', 'I have scars', 'Dry skin', 'I want to order'],
    noKey: 'Chat needs GROQ_API_KEY in .env — from console.groq.com/keys then npm start',
    keyInvalid: 'Groq key in .env is not working — copy a new one from console.groq.com',
    busy: 'Server is busy — try again in a few seconds.',
    noUnderstand: 'Sorry, I didn\'t catch that. Tell me your skin concern or say "I want to order".',
    error: 'Sorry, try again — or say: acne, brightening, scars, dry skin, or I want to order.',
    helpReply: 'I can recommend products, share prices, or take your order. Tell me your skin concern (acne, dryness, dark spots, scars) or say "I want to order".',
    confirmTitle: 'Confirm order',
    labelName: 'Name',
    labelPhone: 'Phone',
    labelAddress: 'Address',
    labelProducts: 'Products',
    labelTotal: 'Total',
    currency: 'EGP',
    confirmBtn: 'Confirm order',
    cancelBtn: 'Cancel',
    saving: 'Saving your order...',
    saved: 'Your order is confirmed! \uD83C\uDF89\n\nOrder #: #{id}\n\nWe\'ll contact you at {phone} soon to confirm shipping.\n\nThank you for choosing Montana! \uD83D\uDC9C',
    saveFailed: 'Sorry, we couldn\'t save the order. Please contact us directly.',
    cancelled: 'No problem! I\'m here if you have more questions. \uD83D\uDE0A',
    afterOrder: ['Buy another product', 'Thanks'],
    thanksReply: 'You\'re welcome! \uD83D\uDC9C Happy to help — ask anytime about skincare or our products.',
    goodbyeReply: 'Bye! \uD83D\uDC9C Come back anytime — Nour is here if you need skincare help.'
  };

  function siteLang() {
    return document.documentElement.lang === 'ar' ? 'ar' : 'en';
  }

  function detectLang(text) {
    var t = String(text || '').trim();
    if (!t) return siteLang();
    var latin = (t.match(/[a-zA-Z]/g) || []).length;
    var arabic = (t.match(/[\u0600-\u06FF]/g) || []).length;
    if (latin > arabic) return 'en';
    if (arabic > latin) return 'ar';
    return siteLang();
  }

  function t(lang) {
    return lang === 'en' ? LE : L;
  }

  var THANKS_INTENT = /^(?:شكراً|شكرا|متشكر|متشكرة|تسلم|تسلمي|الله يخليك|ميرسي|thanks|thank you|thx)(?:\s|!|\.|$)/i;
  var CANCEL_ORDER = /(?:الغاء|إلغاء|الغي|لغي|cancel|مش عايز|مش عاوز|مش هاخد|وقف|توقف|سيب الأوردر|الغي الأوردر|بلاش|سيبك|كفاية|كفايه)/i;

  var BRAIN_SCHEMA = {
    type: 'OBJECT',
    properties: {
      reply: { type: 'STRING' },
      action: {
        type: 'STRING',
        enum: ['chat', 'start_order', 'update_order', 'cancel_order', 'thanks', 'confirm_ready', 'buy_more']
      },
      order: {
        type: 'OBJECT',
        properties: {
          step: { type: 'STRING', enum: ['idle', 'name', 'phone', 'address', 'ready'] },
          name: { type: 'STRING' },
          phone: { type: 'STRING' },
          address: { type: 'STRING' },
          product_names: { type: 'ARRAY', items: { type: 'STRING' } }
        }
      }
    },
    required: ['reply', 'action', 'order']
  };

  function field(obj, lang) {
    if (!obj) return '';
    if (typeof obj === 'string') return obj;
    if (lang === 'ar') return obj.ar || obj.en || '';
    return obj.en || obj.ar || '';
  }

  function isRetryableError(msg) {
    if (!msg) return false;
    var m = String(msg).toLowerCase();
    return /high demand|overloaded|unavailable|resource_exhausted|quota|429|503|try again|capacity|deadline|internal error/i.test(m);
  }

  function isFatalApiError(msg) {
    if (!msg) return false;
    if (/quota|RESOURCE_EXHAUSTED|rate limit/i.test(String(msg))) return false;
    return /api key not valid|api_key_invalid|permission denied/i.test(String(msg));
  }

  function apiErrorMessage(data, lang) {
    var strings = t(lang);
    if (!data || !data.error) return strings.noUnderstand;
    var code = data.code || '';
    var msg = data.error.message || data.error || '';
    if (typeof msg !== 'string') msg = String(msg);
    if (code === 'QUOTA_EXCEEDED' || /quota|RESOURCE_EXHAUSTED|rate limit/i.test(msg)) {
      return lang === 'en'
        ? 'Free API quota used up for today. Try again in a few minutes.'
        : 'خلصت الحصة المجانية لليوم — جرّبي تاني بعد شوية.';
    }
    if (code === 'KEY_INVALID' || /api key not valid|api_key_invalid|شكل المفتاح/i.test(msg)) return strings.keyInvalid;
    if (code === 'NO_KEY' || /NO_KEY|مفيش مفتاح|GROQ_API_KEY|GEMINI_API_KEY|\.env/i.test(msg)) return strings.noKey;
    if (isFatalApiError(msg)) return strings.keyInvalid;
    if (isRetryableError(msg)) return strings.busy;
    return strings.error;
  }

  async function callChatAi(body) {
    try {
      var r = await fetch('/api/chat/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      var data = await r.json();
      if (r.ok && data.ok && data.text) {
        return { ok: true, text: data.text, model: data.model || 'groq', provider: data.provider || 'groq' };
      }
      if (r.ok && data.candidates && data.candidates[0] && data.candidates[0].content) {
        return {
          ok: true,
          text: data.candidates[0].content.parts[0].text,
          model: data._model || 'gemini',
          provider: 'gemini'
        };
      }
      return {
        ok: false,
        data: { error: { message: data.error || data.code || 'API_ERROR' }, code: data.code },
        model: data.model || 'none'
      };
    } catch (e) {
      return { ok: false, data: { error: { message: 'NO_KEY' } }, model: 'none' };
    }
  }

  async function callGemini(body) {
    return callChatAi(body);
  }

  function validateAiBrain(brain) {
    if (!brain || !brain.reply) return null;
    brain.action = brain.action || 'chat';
    if (!brain.order) brain.order = { step: orderStep || 'idle', product_names: [] };
    if (brain.order.product_names && brain.order.product_names.length) {
      var resolved = resolveProducts(brain.order.product_names);
      brain.order.product_names = resolved.map(function (i) { return i.name; });
    }
    if (brain.order.name && looksLikePersonName(String(brain.order.name), getIntent(String(brain.order.name)))) {
      /* keep */
    } else if (brain.order.name && /كريم|غسول|حبوب|تفتيح|لوشن/i.test(String(brain.order.name))) {
      brain.order.name = '';
    }
    return brain;
  }

  async function callAiBrain(userText, lang) {
    var messages = history.map(function (h) {
      return {
        role: h.role === 'model' ? 'assistant' : 'user',
        content: h.parts[0].text
      };
    });
    messages.push({ role: 'user', content: userText });
    var system = buildBrainSystem(lang) +
      '\n\nRespond with ONE JSON object only (no markdown): {"reply":"...","action":"chat|start_order|update_order|thanks|confirm_ready|buy_more|cancel_order","order":{"step":"idle|name|phone|address|ready","name":"","phone":"","address":"","product_names":[]}}';

    var result = await callChatAi({
      system: system,
      messages: messages,
      generationConfig: { temperature: 0.25, maxOutputTokens: 500 }
    });
    if (!result.ok) return null;
    var parsed = parseBrainJson(result.text);
    return validateAiBrain(parsed);
  }

  function getProducts() {
    try {
      if (window.MONTANA_ADMIN && window.MONTANA_ADMIN.getProducts) {
        var admin = window.MONTANA_ADMIN.getProducts();
        if (admin && admin.length) {
          return admin.map(normalizeProduct);
        }
      }
    } catch (e) {}
    if (window.MONTANA_PRODUCTS && window.MONTANA_PRODUCTS.length) {
      return window.MONTANA_PRODUCTS.map(normalizeProduct);
    }
    return [];
  }

  function normalizeProduct(p) {
    var ing = p.ingredients;
    var ingList = [];
    if (ing && ing.ar && ing.ar.length) ingList = ing.ar.slice();
    else if (ing && ing.en && ing.en.length) ingList = ing.en.slice();
    else if (Array.isArray(ing)) ingList = ing.slice();
    return {
      id: p.id || '',
      nameAr: field(p.name || p.nameAr, 'ar'),
      nameEn: field(p.name || p.nameEn, 'en'),
      price: p.price,
      size: field(p.size, 'ar'),
      sizeEn: field(p.size, 'en'),
      pfor: field(p.tagline || p.category || p.pfor, 'ar'),
      pforEn: field(p.tagline || p.category || p.pfor, 'en'),
      ingr: ingList.join(', '),
      ingList: ingList,
      desc: field(p.desc, 'ar'),
      descEn: field(p.desc, 'en'),
      heroIngredient: p.display && p.display.heroIngredient ? p.display.heroIngredient : ''
    };
  }

  function productCatalogText(lang) {
    if (window.MontanaChatKnowledge) {
      return MontanaChatKnowledge.catalogExpert(lang, getProducts());
    }
    return getProducts().map(function (p) {
      if (lang === 'en') {
        return '- ' + p.nameEn + ' | ' + p.price + ' EGP | ' + p.sizeEn + ' | ' + (p.pfor || '') + ' | ' + p.descEn;
      }
      return '- ' + p.nameAr + ' | ' + p.price + ' جنيه | ' + p.size + ' | ' + (p.pfor || '') + ' | ' + p.desc;
    }).join('\n');
  }

  function orderSnapshot() {
    return {
      collecting: collectingOrder,
      step: orderStep,
      name: orderData.name || null,
      phone: orderData.phone || null,
      address: orderData.address || null,
      items: (orderData.items || []).map(function (i) { return i.name; })
    };
  }

  function sessionNote() {
    if (!lastCompletedOrder) return '';
    return '\nآخر أوردر: #' + lastCompletedOrder.id + ' — ' + lastCompletedOrder.name + ' — ' +
      lastCompletedOrder.items.map(function (i) { return i.name; }).join('، ');
  }

  function buildBrainSystem(lang) {
    var replyLang = lang === 'en'
      ? 'Reply in English — warm, expert cosmetics consultant tone.'
      : 'ردّي بالعربي المصري كبياعة كوزمتيك محترفة (نور) — ودودة، فاهمة، بتستشيري العميلة قبل ما ترشّحي، من غير مبالغة.';
    var productNote = lang === 'en'
      ? 'Use exact English product names in product_names when replying in English.'
      : 'استخدمي الأسماء العربية بالظبط في product_names عند الرد بالعربي.';

    return [
      'You are Nour, Montana\'s expert cosmetics & skincare sales consultant (bilingual).',
      'CRITICAL: Reply in the SAME language as the customer\'s latest message.',
      '- Customer writes English → reply in English.',
      '- Customer writes Arabic → reply in Egyptian Arabic.',
      replyLang,
      '',
      'Available products:',
      productCatalogText(lang),
      productNote,
      '',
      'Current order state:',
      JSON.stringify(orderSnapshot(), null, 2),
      sessionNote(),
      '',
      'Return JSON only. Understand intent from full conversation context.',
      '',
      'Rules:',
      '1. If asking for name and customer mentions a product or skin issue → recommend product, add to product_names, ask for name again. Never use product request as a person\'s name.',
      '2. Name = person name (1–3 words), not a sentence.',
      '3. Phone = Egyptian number (10–11 digits).',
      '4. Address = governorate + area + street.',
      '5. Thanks after order → action=thanks, short reply.',
      '6. Want to order → start_order/update_order, collect step by step: name → phone → address.',
      '7. One step per reply only.',
      '8. When name, phone, address, products ready → action=confirm_ready, step=ready.',
      '9. Mention prices clearly.',
      '10. Never echo customer text as a name.',
      '11. Keep replies short: 2–4 sentences unless collecting order details.',
      '12. When the customer changes topic, follow the NEW topic.',
      '13. Act as a professional skincare consultant — explain WHY a product fits their concern using ingredients.',
      '14. Recommend product pairs when relevant (whitening cleanser + cream, post-laser + scar gel).',
      '15. Mention usage tips and SPF for brightening products.',
      window.MontanaChatKnowledge ? MontanaChatKnowledge.aiKnowledgeBlock(lang, getProducts()) : ''
    ].join('\n');
  }

  function sanitizePhone(raw) {
    var digits = String(raw || '').replace(/\D/g, '');
    if (digits.length >= 10 && digits.length <= 15) return digits;
    return '';
  }

  function resolveProducts(names) {
    var prods = getProducts();
    var items = [];
    (names || []).forEach(function (name) {
      var n = String(name || '').trim();
      if (!n) return;
      var found = prods.find(function (p) {
        return p.nameAr === n || p.nameEn === n ||
          p.nameAr.indexOf(n) > -1 || n.indexOf(p.nameAr) > -1 ||
          p.nameEn.toLowerCase().indexOf(n.toLowerCase()) > -1;
      });
      if (!found && window.MontanaChatIntent) {
        var norm = MontanaChatIntent.normalizeText(n);
        var all = window.MontanaChatKnowledge
          ? MontanaChatKnowledge.findAllProductsByKnowledge(n, norm, prods)
          : [];
        if (all.length) found = all[0];
      }
      if (found && !items.some(function (i) { return i.name === found.nameAr; })) {
        items.push({ name: found.nameAr, qty: 1, price: found.price });
      }
    });
    return items;
  }

  function mergeOrderItems(newItems) {
    var merged = (orderData.items || []).slice();
    (newItems || []).forEach(function (item) {
      if (!merged.some(function (i) { return i.name === item.name; })) merged.push(item);
    });
    return merged;
  }

  function matchAllProductsFromText(text) {
    var prods = getProducts();
    var t = String(text || '');
    if (!t.trim()) return [];
    var norm = window.MontanaChatIntent ? MontanaChatIntent.normalizeText(t) : t.toLowerCase();
    if (window.MontanaChatKnowledge) {
      return MontanaChatKnowledge.findAllProductsByKnowledge(t, norm, prods);
    }
    var one = matchProductFromText(t);
    return one ? [one] : [];
  }

  function productsFromChatContext() {
    var prods = getProducts();
    var found = [];
    var seen = {};
    function push(p) {
      if (p && !seen[p.id]) { seen[p.id] = true; found.push(p); }
    }
    sessionSuggestedProducts.forEach(push);
    if (sessionSuggestedProduct) push(sessionSuggestedProduct);
    for (var i = 0; i < history.length; i++) {
      var text = history[i].parts[0].text || '';
      matchAllProductsFromText(text).forEach(push);
      prods.forEach(function (p) {
        if (text.indexOf(p.nameAr) > -1 || text.indexOf(p.nameEn) > -1) push(p);
      });
    }
    return found;
  }

  function productNamesList(products, lang) {
    return products.map(function (p) { return lang === 'en' ? p.nameEn : p.nameAr; }).join(lang === 'en' ? ', ' : '، ');
  }

  function parseBrainJson(text) {
    try {
      var cleaned = String(text || '').trim();
      if (cleaned.indexOf('```') > -1) {
        cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
      }
      return JSON.parse(cleaned);
    } catch (e) {
      return null;
    }
  }

  function isThanks(text) {
    return THANKS_INTENT.test(String(text || '').trim());
  }

  function pushHistory(role, text) {
    history.push({ role: role, parts: [{ text: text }] });
    if (history.length > 20) history = history.slice(-20);
  }

  function conversationContext(extra) {
    return history.map(function (h) { return h.parts[0].text; }).join('\n') + (extra ? '\n' + extra : '');
  }

  function getIntent(userText) {
    if (!window.MontanaChatIntent) {
      return { intent: 'unknown', score: 0, wantsOrder: false, isAffirm: false, concern: null };
    }
    var intent = MontanaChatIntent.detectIntent(userText, {
      botOfferedOrder: lastBotOfferedOrder() || sessionBotOfferedOrder,
      collectingOrder: collectingOrder
    });
    var needsContext = intent.isPrice || intent.isUsage || intent.isIngredients ||
      intent.isRecommend || intent.isAffirm || intent.isCompare;
    if (!intent.concern && sessionLastConcern && needsContext) {
      intent.concern = sessionLastConcern;
    }
    if ((!intent.concerns || !intent.concerns.length) && sessionLastConcerns.length && needsContext) {
      intent.concerns = sessionLastConcerns.slice();
    }
    return intent;
  }

  function rememberSessionContext(intent, product) {
    if (!intent) return;
    if (intent.concern) sessionLastConcern = intent.concern;
    if (intent.concerns && intent.concerns.length) sessionLastConcerns = intent.concerns.slice();
    if (product) sessionSuggestedProduct = product;
  }

  function matchProductFromConcern(concern, norm) {
    var prods = getProducts();
    if (!concern) return null;
    if (window.MontanaChatKnowledge) {
      var fromK = MontanaChatKnowledge.resolveConcernProduct(concern, norm, prods);
      if (fromK) return fromK;
      var ids = MontanaChatKnowledge.recommendProducts(concern);
      if (ids.length) {
        if (/غسول|غسل|wash|cleanser|وش|face/.test(norm) && ids.indexOf('whitening-cleanser') > -1) {
          return prods.find(function (p) { return p.id === 'whitening-cleanser'; }) || prods.find(function (p) { return p.id === ids[0]; });
        }
        return prods.find(function (p) { return p.id === ids[0]; }) || null;
      }
    }
    if (concern === 'whiten' || concern === 'spots' || concern === 'dull') {
      if (/غسول|غسل|wash|cleanser|وش|face/.test(norm)) {
        return prods.find(function (p) { return p.id === 'whitening-cleanser'; }) || null;
      }
      return prods.find(function (p) { return p.id === 'whitening-cream'; }) ||
        prods.find(function (p) { return p.id === 'whitening-cleanser'; }) || null;
    }
    if (concern === 'acne' || concern === 'oily' || concern === 'pores') {
      return prods.find(function (p) { return p.id === 'acne-cleanser'; }) || null;
    }
    if (concern === 'scar') {
      return prods.find(function (p) { return p.id === 'anti-scar'; }) || null;
    }
    if (concern === 'dry') {
      return prods.find(function (p) { return p.id === 'body-lotion'; }) || null;
    }
    if (concern === 'laser' || concern === 'sensitive') {
      return prods.find(function (p) { return p.id === 'post-laser'; }) || null;
    }
    return null;
  }

  function matchProductFromText(text) {
    var prods = getProducts();
    var t = String(text || '');
    if (!t.trim()) return null;
    var norm = window.MontanaChatIntent ? MontanaChatIntent.normalizeText(t) : t.toLowerCase();

    if (window.MontanaChatKnowledge) {
      var all = MontanaChatKnowledge.findAllProductsByKnowledge(t, norm, prods);
      if (all.length) return all[0];
    }

    var named = null;
    prods.forEach(function (p) {
      if (t.indexOf(p.nameAr) > -1 || t.indexOf(p.nameEn) > -1 ||
          norm.indexOf(MontanaChatIntent.normalizeText(p.nameAr)) > -1) named = p;
    });
    if (named) return named;

    var intent = getIntent(t);
    if (intent.concern) {
      var fromConcern = matchProductFromConcern(intent.concern, norm);
      if (fromConcern) return fromConcern;
    }

    if (/كالح|بشرتي كالحة|بشرتي كالحه|dull skin/i.test(t) || /كالح|بهت/.test(norm)) {
      return prods.find(function (p) { return p.id === 'whitening-cleanser'; }) ||
        prods.find(function (p) { return /تفتيح|whiten/i.test(p.nameAr + p.nameEn); }) || null;
    }
    if (/تفتيح|تبييض|بهتان|بقع|وحد.*لون|brighten|whiten|dark spot|hyperpigment/i.test(t) || /تفتيح|تبييض|بهتان|بقع|كدر|اسمرار/.test(norm)) {
      if (/غسول|غسل|wash|cleanser|وش|face/i.test(t) || /غسول|غسل|وش/.test(norm)) {
        return prods.find(function (p) { return p.id === 'whitening-cleanser'; }) || null;
      }
      return prods.find(function (p) { return p.id === 'whitening-cream'; }) ||
        prods.find(function (p) { return /تفتيح|whiten/i.test(p.nameAr + p.nameEn); }) || null;
    }
    if (/ندوب|اثار|scar/i.test(t) || /ندوب|اثار|علامات/.test(norm)) {
      return prods.find(function (p) { return /ندوب|scar/i.test(p.nameAr + p.nameEn); }) || null;
    }
    if (/حبوب|دهن|زيت|acne|pimple|breakout|oily|وشي|وجه/i.test(t) || /حبوب|دهن|بثور|زيته/.test(norm)) {
      return prods.find(function (p) { return /حبوب|acne/i.test(p.nameAr + p.nameEn); }) || null;
    }
    if (/جاف|ناشف|ترطيب|لوشن|مرطب|dry|hydrat|moistur|dehydrat/i.test(t) || /جاف|ترطيب|جفاف|ناشف|تقشر/.test(norm)) {
      return prods.find(function (p) { return /لوشن|lotion|body/i.test(p.nameAr + p.nameEn); }) || null;
    }
    return null;
  }

  function findProductInContext(userText) {
    var fromCurrent = matchProductFromText(userText);
    if (fromCurrent) return fromCurrent;
    for (var i = history.length - 1; i >= 0; i--) {
      if (history[i].role !== 'user') continue;
      var m = matchProductFromText(history[i].parts[0].text);
      if (m) return m;
    }
    return null;
  }

  function recommendIntro(text, lang, product) {
    if (/تفتيح|تبييض|كالح|بهتان|بقع|brighten|whiten|dark spot|dull/i.test(text)) {
      return lang === 'en'
        ? 'For brightening, I recommend ' + product.nameEn + '.'
        : 'لو عايزة تفتيح بشرتك، أنصحك بـ ' + product.nameAr + '.';
    }
    if (/ندوب|اثار|scar/i.test(text)) {
      return lang === 'en'
        ? 'For scars, I recommend ' + product.nameEn + '.'
        : 'للندوب والآثار، أنصحك بـ ' + product.nameAr + '.';
    }
    if (/حبوب|دهن|زيت|acne|pimple|oily|وشي|وجه/i.test(text)) {
      return lang === 'en'
        ? 'For acne-prone skin, I recommend ' + product.nameEn + '.'
        : 'للحبوب والبشرة الدهنية، أنصحك بـ ' + product.nameAr + '.';
    }
    if (/جاف|ناشف|ترطيب|dry|hydrat|moistur/i.test(text)) {
      return lang === 'en'
        ? 'For dry skin, I recommend ' + product.nameEn + '.'
        : 'للبشرة الجافة والناشفة، أنصحك بـ ' + product.nameAr + '.';
    }
    return lang === 'en'
      ? 'I recommend ' + product.nameEn + '.'
      : 'أنصحك بـ ' + product.nameAr + ' — هيناسبك.';
  }

  function productFromRecentChat() {
    var prods = getProducts();
    for (var i = history.length - 1; i >= 0 && i >= history.length - 8; i--) {
      var text = history[i].parts[0].text || '';
      var fromKw = matchProductFromText(text);
      if (fromKw) return fromKw;
      for (var j = 0; j < prods.length; j++) {
        var p = prods[j];
        if (text.indexOf(p.nameAr) > -1 || text.indexOf(p.nameEn) > -1) return p;
      }
    }
    return null;
  }

  function markOrderOffer(product) {
    sessionBotOfferedOrder = true;
    if (product) {
      sessionSuggestedProduct = product;
      if (!sessionSuggestedProducts.some(function (p) { return p.id === product.id; })) {
        sessionSuggestedProducts.push(product);
      }
    }
  }

  function markOrderOffers(products) {
    (products || []).forEach(function (p) { markOrderOffer(p); });
  }

  function clearOrderOfferSession() {
    sessionBotOfferedOrder = false;
    sessionSuggestedProduct = null;
    sessionSuggestedProducts = [];
  }

  function noteOrderOfferFromBrain(brain) {
    if (!brain || !brain.reply) return;
    if (!/عايزة نعمل أوردر|عايزة تأكدي|تأكدي أوردر|place an order|would you like to (order|place)/i.test(brain.reply)) return;
    var names = (brain.order && brain.order.product_names) || [];
    if (names.length) {
      var resolved = resolveProducts(names);
      if (resolved.length) {
        var prods = getProducts();
        resolved.forEach(function (item) {
          var p = prods.find(function (x) { return x.nameAr === item.name; });
          if (p) markOrderOffer(p);
        });
        return;
      }
    }
    var fromChat = productFromRecentChat();
    if (fromChat) markOrderOffer(fromChat);
  }

  function lastBotOfferedOrder() {
    for (var i = history.length - 1; i >= 0; i--) {
      if (history[i].role === 'model') {
        var text = history[i].parts[0].text || '';
        return /عايزة نعمل أوردر|عايزة تأكدي|تأكدي أوردر|تأكيد الأوردر|عايزة تأكيد|place an order|would you like to order|would you like to place/i.test(text);
      }
    }
    return false;
  }

  function isOrderIntent(text) {
    return getIntent(text).wantsOrder;
  }

  function isAffirmative(text) {
    return getIntent(text).isAffirm;
  }

  function wantsToOrder(text) {
    var intent = getIntent(text);
    return intent.wantsOrder;
  }

  function looksLikePersonName(text, intent) {
    intent = intent || getIntent(text);
    var t = String(text || '').trim();
    var words = t.split(/\s+/).filter(Boolean);
    if (!words.length || words.length > 4 || t.length > 40) return false;
    if (/\d{5,}/.test(t)) return false;
    if (intent.wantsOrder || intent.isAffirm || intent.isGreeting || intent.isThanks || intent.isGoodbye) return false;
    if (matchProductFromText(t) || isThanks(t)) return false;
    return true;
  }

  function isBrowsingQuestion(intent, text) {
    intent = intent || getIntent(text);
    if (intent.isProductInquiry || intent.isCatalog) return true;
    if (intent.isCatalogFollowUp && recentCatalogInHistory()) return true;
    if (/ايه\s*الموجود|موجود\s*ايه|ايه\s*عند|قوليلي|وريني|عندكم\s*ايه/.test(intent.norm || '')) return true;
    return false;
  }

  function recentCatalogInHistory() {
    if (sessionCatalogShown) return true;
    var i;
    for (i = history.length - 1; i >= 0 && i >= history.length - 8; i--) {
      var h = history[i];
      var txt = h.parts && h.parts[0] ? h.parts[0].text : '';
      if (h.role === 'user') {
        var in2 = getIntent(txt);
        if (in2.isCatalog || in2.isCatalogFollowUp) return true;
        if (/منتجات?\s*تانيه|في\s*ايه.*تاني|ايه\s*عندكم|عندكم\s*ايه|حاجات?\s*تانيه/.test(in2.norm || '')) return true;
      }
      if ((h.role === 'model' || h.role === 'assistant') && /منتجات Montana|مجموعة Montana|كل منتجات|Montana collection/i.test(txt)) return true;
    }
    return false;
  }

  function localPhraseBrain(userText, lang, intent) {
    if (!window.MontanaChatPhrases || !window.MontanaChatKnowledge) return null;
    if (collectingOrder) return null;
    intent = intent || getIntent(userText);
    var norm = intent.norm || (MontanaChatIntent ? MontanaChatIntent.normalizeText(userText) : userText);
    var rule = MontanaChatPhrases.matchRule(norm, userText, {
      collectingOrder: collectingOrder,
      sessionPhase: sessionPhase,
      orderStep: orderStep,
      sessionCatalogShown: sessionCatalogShown,
      recentCatalog: recentCatalogInHistory()
    });
    if (!rule) return null;
    var brain = MontanaChatPhrases.buildBrain(rule, lang, getProducts(), MontanaChatKnowledge, intent, {
      orderStep: orderStep,
      suggestedProduct: sessionSuggestedProduct || productFromRecentChat()
    });
    if (!brain) return null;
    if (brain._products && brain._products.length) {
      markOrderOffers(brain._products);
    }
    if (brain._skipPolish) brain.skipPolish = true;
    delete brain._products;
    delete brain._skipPolish;
    return brain;
  }

  function localKnowledgeBrain(userText, lang, intent) {
    if (!window.MontanaChatKnowledge) return null;
    var K = MontanaChatKnowledge;
    var t = String(userText || '').trim();
    intent = intent || getIntent(t);
    var norm = intent.norm || (MontanaChatIntent ? MontanaChatIntent.normalizeText(t) : t);
    var prods = getProducts();
    var names = function (p) { return lang === 'en' ? [p.nameEn] : [p.nameAr]; };

    if (intent.isShipping) {
      return { reply: K.shippingReply(lang), action: 'chat', order: { step: orderStep || 'idle', product_names: [] } };
    }

    if (intent.isRecommend && !intent.wantsOrder) {
      if (intent.concerns && intent.concerns.length >= 2) {
        var multiRec = K.buildMultiConsultationReply(intent.concerns, lang, prods);
        if (multiRec) {
          var mIdsRec = K.resolveMultiConcernIds(intent.concerns);
          markOrderOffers(mIdsRec.map(function (id) { return prods.find(function (p) { return p.id === id; }); }).filter(Boolean));
          return {
            reply: multiRec,
            action: 'chat',
            order: { step: orderStep || 'idle', product_names: mIdsRec.map(function (id) {
              var p = prods.find(function (x) { return x.id === id; });
              return p ? (lang === 'en' ? p.nameEn : p.nameAr) : '';
            }).filter(Boolean) }
          };
        }
      }
      if (intent.concern) {
        var recReply = K.buildConsultationReply(intent.concern, lang, prods, norm);
        if (recReply) {
          var recP = K.resolveConcernProduct(intent.concern, norm, prods);
          if (recP) markOrderOffer(recP);
          return {
            reply: recReply,
            action: 'chat',
            order: { step: orderStep || 'idle', product_names: recP ? names(recP) : [] }
          };
        }
      }
      return {
        reply: K.buildGuideMenu(lang),
        action: 'chat',
        order: { step: orderStep || 'idle', product_names: [] }
      };
    }

    if (intent.isPrice && !matchProductFromText(t)) {
      var priceProd = sessionSuggestedProduct || productFromRecentChat() || findProductInContext(t);
      if (!priceProd && intent.concern) priceProd = matchProductFromConcern(intent.concern, norm);
      if (priceProd) {
        markOrderOffer(priceProd);
        return {
          reply: lang === 'en'
            ? priceProd.nameEn + ' is ' + priceProd.price + ' EGP — ' + priceProd.sizeEn + '. Would you like to order?'
            : priceProd.nameAr + ' سعره ' + priceProd.price + ' جنيه — ' + priceProd.size + '. عايزة نعمل أوردر؟',
          action: 'chat',
          order: { step: orderStep || 'idle', product_names: names(priceProd) }
        };
      }
    }

    if ((intent.isUsage || intent.isIngredients) && !matchProductFromText(t)) {
      var ctxProd = sessionSuggestedProduct || productFromRecentChat() || findProductInContext(t);
      if (ctxProd) {
        markOrderOffer(ctxProd);
        return {
          reply: K.buildProductExpertReply(ctxProd, lang, { usage: intent.isUsage, offerOrder: true }),
          action: 'chat',
          order: { step: orderStep || 'idle', product_names: names(ctxProd) }
        };
      }
    }

    if ((intent.isProductInquiry || intent.isCatalog) && intent.concerns && intent.concerns.length >= 2) {
      if (collectingOrder) {
        collectingOrder = false;
        orderStep = 'idle';
        orderData = {};
      }
      var multiInq = K.buildMultiConsultationReply(intent.concerns, lang, prods);
      if (multiInq) {
        var mIdsInq = K.resolveMultiConcernIds(intent.concerns);
        markOrderOffers(mIdsInq.map(function (id) { return prods.find(function (p) { return p.id === id; }); }).filter(Boolean));
        return {
          reply: multiInq,
          action: 'chat',
          order: { step: orderStep || 'idle', product_names: mIdsInq.map(function (id) {
            var p = prods.find(function (x) { return x.id === id; });
            return p ? (lang === 'en' ? p.nameEn : p.nameAr) : '';
          }).filter(Boolean) }
        };
      }
    }

    if ((intent.isProductInquiry || intent.isCatalog) && intent.concern && !(intent.concerns && intent.concerns.length >= 2)) {
      if (collectingOrder) {
        collectingOrder = false;
        orderStep = 'idle';
        orderData = {};
      }
      var consultInq = K.buildConsultationReply(intent.concern, lang, prods, norm);
      if (consultInq) {
        var cId = K.recommendProducts(intent.concern)[0];
        var cP = prods.find(function (p) { return p.id === cId; });
        if (cP) markOrderOffer(cP);
        return {
          reply: consultInq,
          action: 'chat',
          order: { step: orderStep || 'idle', product_names: cP ? names(cP) : [] }
        };
      }
    }

    var termKey = K.matchTerm(norm);
    if (termKey && !intent.isPrice && !intent.wantsOrder) {
      var termReply = K.buildTermReply(termKey, lang);
      if (termReply) return { reply: termReply, action: 'chat', order: { step: orderStep || 'idle', product_names: [] } };
    }

    if (intent.isRoutine && intent.concern) {
      var routine = K.buildRoutineReply(intent.concern === 'spots' ? 'whiten' : intent.concern, lang);
      if (routine) return { reply: routine, action: 'chat', order: { step: orderStep || 'idle', product_names: [] } };
    }

    if (intent.concerns && intent.concerns.length >= 2 && !intent.wantsOrder && !intent.isPrice) {
      var multiReply = K.buildMultiConsultationReply(intent.concerns, lang, prods);
      if (multiReply) {
        var mIds = K.resolveMultiConcernIds(intent.concerns);
        markOrderOffers(mIds.map(function (id) { return prods.find(function (p) { return p.id === id; }); }).filter(Boolean));
        return {
          reply: multiReply,
          action: 'chat',
          order: { step: orderStep || 'idle', product_names: mIds.map(function (id) {
            var p = prods.find(function (x) { return x.id === id; });
            return p ? (lang === 'en' ? p.nameEn : p.nameAr) : '';
          }).filter(Boolean) }
        };
      }
    }

    var ing = K.findIngredient(t, norm);
    if (ing) {
      var ingReply = K.buildIngredientReply(ing, lang, prods);
      var ingProd = prods.find(function (p) { return p.id === (ing.products && ing.products[0]); });
      if (ingProd) markOrderOffer(ingProd);
      return {
        reply: ingReply + (lang === 'en' ? '\n\nWould you like to order?' : '\n\nعايزة نعمل أوردر؟'),
        action: 'chat',
        order: { step: orderStep || 'idle', product_names: ingProd ? names(ingProd) : [] }
      };
    }

    if (intent.isCompare) {
      var a = matchProductFromText(t) || productFromRecentChat();
      var bId = a && K.getPair(a.id);
      var b = bId ? prods.find(function (p) { return p.id === bId; }) : null;
      if (!b && intent.concern) {
        var rec = K.recommendProducts(intent.concern);
        if (rec.length >= 2) {
          a = prods.find(function (p) { return p.id === rec[0]; });
          b = prods.find(function (p) { return p.id === rec[1]; });
        }
      }
      if (a && b) {
        return { reply: K.buildCompareReply(a, b, lang), action: 'chat', order: { step: orderStep || 'idle', product_names: [] } };
      }
    }

    var product = matchProductFromText(t) || sessionSuggestedProduct || productFromRecentChat();
    if (!product && intent.concern) product = matchProductFromConcern(intent.concern, norm);

    if (product && intent.isUsage) {
      markOrderOffer(product);
      return {
        reply: K.buildProductExpertReply(product, lang, { usage: true, offerOrder: true }),
        action: 'chat',
        order: { step: orderStep || 'idle', product_names: names(product) }
      };
    }

    if (intent.concern && !intent.isPrice && !intent.wantsOrder && !product) {
      var consult = K.buildConsultationReply(intent.concern, lang, prods, norm);
      if (consult) {
        var mainId = K.recommendProducts(intent.concern)[0];
        var mainP = prods.find(function (p) { return p.id === mainId; });
        if (mainP) markOrderOffer(mainP);
        return {
          reply: consult,
          action: 'chat',
          order: { step: orderStep || 'idle', product_names: mainP ? names(mainP) : [] }
        };
      }
    }

    return null;
  }

  function localCatalogBrain(userText, lang, intent) {
    intent = intent || getIntent(userText);
    if (!intent.isCatalog) return null;
    var prods = getProducts();
    var reply = window.MontanaChatKnowledge
      ? MontanaChatKnowledge.buildFullCatalogReply(lang, prods)
      : (lang === 'en' ? 'Our Montana collection:\n\n' : 'دي كل منتجات Montana عندنا:\n\n') +
        prods.map(function (p) {
          return lang === 'en' ? '• ' + p.nameEn + ' — ' + p.price + ' EGP' : '• ' + p.nameAr + ' — ' + p.price + ' جنيه';
        }).join('\n');
    return {
      reply: reply,
      action: 'chat',
      order: { step: orderStep || 'idle', product_names: [] },
      _catalog: true
    };
  }

  function localOrderBrain(userText, lang, intent) {
    var t = String(userText || '').trim();
    intent = intent || getIntent(t);
    var empty = { step: orderStep || 'idle', product_names: [] };

    if (wantsToOrder(t) && !collectingOrder && !isBrowsingQuestion(intent, t)) {
      collectingOrder = true;
      sessionPhase = 'ordering';
      orderStep = 'name';
      if (!orderData.items) orderData.items = [];
      var picked = matchAllProductsFromText(t);
      if (!picked.length) picked = productsFromChatContext();
      if (!picked.length) {
        var hinted = sessionSuggestedProduct || productFromRecentChat() || findProductInContext(t);
        if (hinted) picked = [hinted];
      }
      if (picked.length) {
        orderData.items = resolveProducts(picked.map(function (p) { return p.nameAr; }));
      }
      clearOrderOfferSession();
      var list = productNamesList(picked, lang);
      return {
        reply: picked.length > 1
          ? (lang === 'en'
            ? 'Perfect! Added: ' + list + '. What name for the order?'
            : 'تمام حبيبتي! \uD83D\uDC9C ضفنا: ' + list + '. اسمك إيه؟')
          : (lang === 'en' ? 'Great! What name should we put on the order?' : 'تمام حبيبتي! \uD83D\uDC9C اسمك إيه عشان نسجل الأوردر؟'),
        action: 'start_order',
        order: { step: 'name', product_names: (orderData.items || []).map(function (i) { return i.name; }) }
      };
    }

    if (!collectingOrder) return null;

    if (isBrowsingQuestion(intent, t)) return null;

    if (orderStep === 'name') {
      var prodHints = matchAllProductsFromText(t);
      if (prodHints.length) {
        orderData.items = mergeOrderItems(resolveProducts(prodHints.map(function (p) { return p.nameAr; })));
        return {
          reply: lang === 'en'
            ? 'Added: ' + productNamesList(prodHints, lang) + '. What name should we put on the order?'
            : 'تمام، ضفنا: ' + productNamesList(prodHints, lang) + '. اسمك إيه يا جميلة؟',
          action: 'update_order',
          order: { step: 'name', product_names: orderData.items.map(function (i) { return i.name; }) }
        };
      }
      if (looksLikePersonName(t, intent)) {
        orderData.name = t;
        orderStep = 'phone';
        return {
          reply: lang === 'en'
            ? 'Thanks ' + orderData.name + '! What\'s your phone number?'
            : 'تسلمي يا ' + orderData.name + '! \uD83D\uDC9C رقم التليفون؟',
          action: 'update_order',
          order: { step: 'phone', name: orderData.name, product_names: [] }
        };
      }
      return {
        reply: lang === 'en' ? 'Please tell me your name (first and last).' : 'محتاجة اسمك يا حبيبتي — الاسم الأول واسم العيلة.',
        action: 'update_order',
        order: { step: 'name', product_names: [] }
      };
    }

    if (orderStep === 'phone') {
      var ph = sanitizePhone(t);
      if (ph) {
        orderData.phone = ph;
        orderStep = 'address';
        return {
          reply: lang === 'en'
            ? 'Got it. Delivery address? (city, area, street)'
            : 'تمام. العنوان فين يا جميلة؟ (محافظة + منطقة + شارع)',
          action: 'update_order',
          order: { step: 'address', phone: orderData.phone, product_names: [] }
        };
      }
      return {
        reply: lang === 'en'
          ? 'Please enter a valid Egyptian phone number (10–11 digits).'
          : 'رقم التليفون مش واضح — دخّلي رقم مصري (١٠–١١ رقم).',
        action: 'update_order',
        order: { step: 'phone', product_names: [] }
      };
    }

    if (orderStep === 'address') {
      if (t.length >= 8) {
        orderData.address = t;
        orderStep = 'ready';
        if (!orderData.items || !orderData.items.length) {
          var ctxProds = productsFromChatContext();
          if (ctxProds.length) {
            orderData.items = resolveProducts(ctxProds.map(function (p) { return p.nameAr; }));
          } else {
            var last = findProductInContext(t);
            if (last) orderData.items = resolveProducts([last.nameAr]);
          }
        }
        if (orderData.name && orderData.phone && orderData.items && orderData.items.length) {
          return {
            reply: lang === 'en' ? 'Perfect! Confirm your order below.' : 'كده تمام يا حبيبتي! \uD83D\uDC9C أكّدي الأوردر من تحت.',
            action: 'confirm_ready',
            order: {
              step: 'ready',
              name: orderData.name,
              phone: orderData.phone,
              address: orderData.address,
              product_names: orderData.items.map(function (i) { return i.name; })
            }
          };
        }
      }
      return {
        reply: lang === 'en'
          ? 'Please send your full address (city, area, street).'
          : 'محتاجة العنوان كامل (محافظة + منطقة + شارع).',
        action: 'update_order',
        order: { step: 'address', product_names: [] }
      };
    }

    return null;
  }

  function localDefaultBrain(lang, intent, userText) {
    intent = intent || getIntent(userText || '');
    if (intent.isGoodbye) {
      return localGoodbyeBrain(userText || '', lang, intent);
    }
    if ((lastBotOfferedOrder() || sessionBotOfferedOrder) && intent.isAffirm) {
      var orderStart = localOrderBrain(userText || '', lang, intent);
      if (orderStart) return orderStart;
    }
    if (window.MontanaChatKnowledge) {
      var ctxProd = sessionSuggestedProduct || productFromRecentChat() || matchProductFromText(userText || '');
      var smart = MontanaChatKnowledge.buildSmartFallback(lang, {
        concern: intent.concern || sessionLastConcern,
        concerns: (intent.concerns && intent.concerns.length) ? intent.concerns : sessionLastConcerns,
        product: ctxProd,
        products: getProducts(),
        norm: intent.norm || ''
      });
      if (smart) {
        if (ctxProd) markOrderOffer(ctxProd);
        else if (intent.concern) {
          var cp = MontanaChatKnowledge.resolveConcernProduct(intent.concern, intent.norm, getProducts());
          if (cp) markOrderOffer(cp);
        }
        return {
          reply: smart,
          action: 'chat',
          order: { step: orderStep || 'idle', product_names: ctxProd ? (lang === 'en' ? [ctxProd.nameEn] : [ctxProd.nameAr]) : [] }
        };
      }
    }
    if (intent && intent.concern) {
      var concernReply = localFallbackBrain(userTextForConcern(intent.concern), lang, intent);
      if (concernReply) return concernReply;
    }
    return {
      reply: window.MontanaChatKnowledge ? MontanaChatKnowledge.buildGuideMenu(lang) : t(lang).helpReply,
      action: 'chat',
      order: { step: orderStep || 'idle', product_names: [] }
    };
  }

  function userTextForConcern(concern) {
    if (concern === 'acne' || concern === 'oily' || concern === 'pores') return 'عندي حبوب في وشي';
    if (concern === 'dry') return 'بشرتي ناشفة';
    if (concern === 'whiten' || concern === 'dull' || concern === 'spots') return 'بشرتي كالحة وعايزة تفتيح';
    if (concern === 'scar') return 'عندي ندوب وآثار';
    if (concern === 'laser') return 'بعد الليزر بشرتي محتاجة عناية';
    if (concern === 'sensitive') return 'بشرتي حساسة وفيها احمرار';
    return '';
  }

  function localGoodbyeBrain(userText, lang, intent) {
    intent = intent || getIntent(userText);
    if (!intent.isGoodbye) return null;
    return {
      reply: t(lang).goodbyeReply,
      action: 'chat',
      order: { step: orderStep || 'idle', product_names: [] }
    };
  }

  function localBrain(userText, lang) {
    var intent = getIntent(userText);
    if (intent.wantsOrder && !isBrowsingQuestion(intent, userText) && !collectingOrder) {
      var orderHit = localOrderBrain(userText, lang, intent);
      if (orderHit) return orderHit;
    }
    return localGreetingBrain(userText, lang, intent) ||
      localGoodbyeBrain(userText, lang, intent) ||
      localPhraseBrain(userText, lang, intent) ||
      localKnowledgeBrain(userText, lang, intent) ||
      localOrderBrain(userText, lang, intent) ||
      localCatalogBrain(userText, lang, intent) ||
      localFallbackBrain(userText, lang, intent) ||
      (intent.concern && (!intent.concerns || intent.concerns.length < 2)
        ? localFallbackBrain(userTextForConcern(intent.concern), lang, intent) : null);
  }

  var chatAiEnabled = null;

  async function useChatAi() {
    if (chatAiEnabled !== null) return chatAiEnabled;
    if (window.MONTANA_CHAT_AI === false) {
      chatAiEnabled = false;
      return false;
    }
    try {
      var r = await fetch('/api/settings/chat');
      var d = await r.json();
      chatAiEnabled = !!(d.ok && d.ai_enabled);
    } catch (e) {
      chatAiEnabled = false;
    }
    return chatAiEnabled;
  }

  function localGreetingBrain(userText, lang, intent) {
    intent = intent || getIntent(userText);
    if (!intent.isGreeting) return null;
    if (lang === 'en') {
      return {
        reply: 'Hi! How can I help you with your skin today?',
        action: 'chat',
        order: { step: orderStep || 'idle', product_names: [] }
      };
    }
    return {
      reply: 'أهلاً يا جميلة! \uD83D\uDC9C أنا نور من Montana — قوليلي إيه مشكلة بشرتك وأنا هرشّحلك الأنسب.',
      action: 'chat',
      order: { step: orderStep || 'idle', product_names: [] }
    };
  }

  function localFallbackBrain(userText, lang, intent) {
    var t = String(userText || '').trim();
    lang = lang || detectLang(t);
    intent = intent || getIntent(t);
    var product = matchProductFromText(t);
    if (!product && intent.concern) {
      product = matchProductFromConcern(intent.concern, intent.norm || t);
    }
    if (!product && (intent.isPrice || intent.isIngredients)) {
      product = sessionSuggestedProduct || productFromRecentChat() || findProductInContext(t);
    }
    if (!product) return null;
    var names = lang === 'en' ? [product.nameEn] : [product.nameAr];

    if (intent.isIngredients || /مكون|مكونات|مصنوع|جواه|جواها|ايه فيه|فيه ايه|فيها ايه|مكون من|ingredient|what.*in|made of/i.test(t)) {
      if (window.MontanaChatKnowledge) {
        var ingMatch = MontanaChatKnowledge.findIngredient(t, intent.norm || t);
        if (ingMatch) {
          markOrderOffer(product);
          return {
            reply: MontanaChatKnowledge.buildIngredientReply(ingMatch, lang, getProducts()) +
              (lang === 'en' ? '\n\n' + product.nameEn + ' — ' + product.price + ' EGP.' : '\n\n' + product.nameAr + ' — ' + product.price + ' جنيه.'),
            action: 'chat',
            order: { step: orderStep || 'idle', product_names: names }
          };
        }
      }
      if (lang === 'en') {
        return {
          reply: product.nameEn + ' key ingredients: ' + product.ingr + '.\n\n' + product.descEn + '\n\nPrice: ' + product.price + ' EGP.',
          action: 'chat',
          order: { step: orderStep || 'idle', product_names: names }
        };
      }
      return {
        reply: product.nameAr + ' مكوناته الأساسية: ' + product.ingr + '.\n\n' + product.desc + '\n\nسعره ' + product.price + ' جنيه.',
        action: 'chat',
        order: { step: orderStep || 'idle', product_names: names }
      };
    }
    if (intent.isPrice || /سعر|بكام|بكم|عامل كام|كام|price|how much|cost/i.test(t)) {
      if (lang === 'en') {
        return {
          reply: product.nameEn + ' is ' + product.price + ' EGP — ' + product.sizeEn + '.',
          action: 'chat',
          order: { step: orderStep || 'idle', product_names: names }
        };
      }
      markOrderOffer(product);
      return {
        reply: product.nameAr + ' سعره ' + product.price + ' جنيه — ' + product.size + '. عايزة نعمل أوردر؟',
        action: 'chat',
        order: { step: orderStep || 'idle', product_names: names }
      };
    }
    if (lang === 'en') {
      markOrderOffer(product);
      return {
        reply: (window.MontanaChatKnowledge
          ? MontanaChatKnowledge.buildProductExpertReply(product, lang, { offerOrder: true })
          : recommendIntro(t, 'en', product) + '\n\n' + product.descEn + '\n\nPrice: ' + product.price + ' EGP. Would you like to place an order?'),
        action: 'chat',
        order: { step: orderStep || 'idle', product_names: names }
      };
    }
    markOrderOffer(product);
    return {
      reply: (window.MontanaChatKnowledge
        ? MontanaChatKnowledge.buildProductExpertReply(product, lang, { offerOrder: true })
        : recommendIntro(t, 'ar', product) + '\n\n' + product.desc + '\n\nسعره ' + product.price + ' جنيه. عايزة نعمل أوردر؟'),
      action: 'chat',
      order: { step: orderStep || 'idle', product_names: names }
    };
  }

  async function think(userText) {
    var lang = detectLang(userText);
    var intent = getIntent(userText);

    if (collectingOrder) {
      var orderOnly = localOrderBrain(userText, lang, intent);
      if (orderOnly) return { ok: true, brain: orderOnly, fallback: true };
    }

    var quick = localGreetingBrain(userText, lang, intent) ||
      localGoodbyeBrain(userText, lang, intent);
    if (quick) return { ok: true, brain: quick, fallback: true };

    var catalogFollow = intent.isCatalogFollowUp && recentCatalogInHistory();
    if (!collectingOrder && (intent.isCatalog || catalogFollow || intent.isShipping ||
        (intent.isProductInquiry && !intent.wantsOrder) ||
        (intent.isRecommend && !intent.wantsOrder))) {
      var browseLocal = localPhraseBrain(userText, lang, intent) ||
        localCatalogBrain(userText, lang, intent) ||
        ((intent.isShipping || intent.isRecommend) ? localKnowledgeBrain(userText, lang, intent) : null);
      if (browseLocal) return { ok: true, brain: browseLocal, fallback: true };
    }

    if (await useChatAi()) {
      try {
        var aiBrain = await callAiBrain(userText, lang);
        if (aiBrain && aiBrain.reply) return { ok: true, brain: aiBrain };
      } catch (e) { /* fallback local */ }
    }

    var local = localBrain(userText, lang);
    if (local) return { ok: true, brain: local, fallback: true };
    return { ok: true, brain: localDefaultBrain(lang, intent, userText), fallback: true };
  }

  function applyBrain(brain) {
    var o = brain.order || {};
    var action = brain.action || 'chat';

    if (action === 'thanks') {
      sessionPhase = 'post_order';
      return 'thanks';
    }
    if (action === 'cancel_order') return 'cancel';
    if (action === 'buy_more') return 'buy_more';

    if (action === 'start_order' || action === 'update_order' || action === 'confirm_ready') {
      collectingOrder = true;
      sessionPhase = 'ordering';

      if (o.name) orderData.name = String(o.name).trim();
      if (o.phone) {
        var ph = sanitizePhone(o.phone);
        if (ph) orderData.phone = ph;
      }
      if (o.address) orderData.address = String(o.address).trim();

      if (o.product_names && o.product_names.length) {
        var resolved = resolveProducts(o.product_names);
        if (resolved.length) orderData.items = resolved;
      }

      if (o.step && o.step !== 'idle') orderStep = o.step;
      else if (orderData.address && orderData.phone && orderData.name) orderStep = 'ready';
      else if (orderData.phone && orderData.name) orderStep = 'address';
      else if (orderData.name) orderStep = 'phone';
      else orderStep = 'name';
    }

    if (action === 'confirm_ready' || o.step === 'ready') {
      if (orderData.name && orderData.phone && orderData.address) {
        if (!orderData.items || !orderData.items.length) {
          var fromBrain = resolveProducts(o.product_names || []);
          if (fromBrain.length) orderData.items = fromBrain;
        }
        if (orderData.items && orderData.items.length) return 'confirm';
      }
    }

    return 'ok';
  }

  function clearTypingIndicators() {
    document.querySelectorAll('#chat-messages .msg.typing').forEach(function (el) { el.remove(); });
  }

  function resetChatUiState() {
    isBotBusy = false;
    processingQueue = false;
    clearTypingIndicators();
    setInputEnabled(true);
    var status = document.getElementById('chat-status');
    if (status) status.textContent = t(sessionLang).statusOnline;
  }

  async function processWithAI(text) {
    sessionLang = detectLang(text);
    var strings = t(sessionLang);
    var intent = getIntent(text);
    var status = document.getElementById('chat-status');
    var typing = null;

    try {
      isBotBusy = true;
      setInputEnabled(false);
      typing = showTyping();
      if (status) status.textContent = strings.statusTyping;

      var result = await Promise.all([
        think(text),
        sleep(thinkDelay(text))
      ]).then(function (r) { return r[0]; });

      if (typing) { typing.remove(); typing = null; }

      if (!result.ok) {
        await typeBotMessage(result.error, { skipThink: true, skipPolish: true });
        return;
      }

      var brain = result.brain;
      if (!brain || !brain.reply) {
        await typeBotMessage(strings.error, { skipThink: true, skipPolish: true });
        return;
      }

      if (brain._catalog) sessionCatalogShown = true;
      delete brain._catalog;

      noteOrderOfferFromBrain(brain);
      pushHistory('user', text);

      var replyProduct = sessionSuggestedProduct || matchProductFromText(text);
      rememberSessionContext(intent, replyProduct);

      var reply = polishReply(brain.reply, sessionLang, intent, {
        isOrderStep: collectingOrder,
        skipPolish: brain.skipPolish || !!(intent.wantsOrder && matchProductFromText(text))
      });
      delete brain.skipPolish;
      pushHistory('model', reply);
      await typeBotMessage(reply, { skipThink: true, userText: text, intent: intent });

      var outcome = applyBrain(brain);

      if (outcome === 'thanks') {
        pushHistory('model', strings.thanksReply);
        await typeBotMessage(strings.thanksReply, { skipThink: true, skipPolish: true });
        return;
      }
      if (outcome === 'cancel') {
        await cancelOrder();
        return;
      }
      if (outcome === 'buy_more') {
        orderData = lastCompletedOrder ? {
          name: lastCompletedOrder.name,
          phone: lastCompletedOrder.phone,
          address: lastCompletedOrder.address,
          items: []
        } : { items: [] };
        collectingOrder = true;
        orderStep = lastCompletedOrder && lastCompletedOrder.name ? 'phone' : 'name';
        sessionPhase = 'ordering';
        return;
      }
      if (outcome === 'confirm') {
        orderStep = 'confirm';
        collectingOrder = false;
        showOrderConfirm();
      }
    } catch (e) {
      if (typing) typing.remove();
      try {
        await typeBotMessage(strings.error, { skipThink: true, skipPolish: true });
      } catch (e2) { /* ignore */ }
    } finally {
      if (typing) typing.remove();
      isBotBusy = false;
      setInputEnabled(true);
      if (status) status.textContent = t(sessionLang).statusOnline;
    }
  }

  async function drainMessageQueue() {
    if (processingQueue) return;
    processingQueue = true;
    try {
      while (messageQueue.length) {
        var next = messageQueue.shift();
        await processWithAI(next);
      }
    } finally {
      processingQueue = false;
      isBotBusy = false;
      setInputEnabled(true);
    }
  }

  async function enqueueMessage(text) {
    messageQueue.push(text);
    await drainMessageQueue();
  }

  async function processMessage(text) {
    sessionLang = detectLang(text);
    var strings = t(sessionLang);
    if (isThanks(text)) {
      sessionPhase = 'post_order';
      pushHistory('user', text);
      pushHistory('model', strings.thanksReply);
      await typeBotMessage(strings.thanksReply, { skipThink: true, skipPolish: true });
      return;
    }
    if (getIntent(text).isGoodbye && !collectingOrder) {
      pushHistory('user', text);
      pushHistory('model', strings.goodbyeReply);
      await typeBotMessage(strings.goodbyeReply, { skipThink: true, skipPolish: true });
      return;
    }
    if (collectingOrder && CANCEL_ORDER.test(text)) {
      await cancelOrder();
      return;
    }
    await enqueueMessage(text);
  }

  function bindUi() {
    var strings = t(siteLang());
    var avatar = document.querySelector('#chat-header .avatar');
    var name = document.querySelector('#chat-header .name');
    var status = document.getElementById('chat-status');
    var close = document.getElementById('chat-close');
    var send = document.getElementById('chat-send');
    var input = document.getElementById('chat-input');
    var btn = document.getElementById('chat-btn');

    if (avatar) avatar.textContent = L.avatar;
    if (name) name.textContent = strings.botName;
    if (status) status.textContent = strings.statusOnline;
    if (close) close.textContent = L.close;
    if (send) send.textContent = L.send;
    if (input) input.placeholder = strings.placeholder;
    if (btn) btn.addEventListener('click', toggleChat);
    if (close) close.addEventListener('click', toggleChat);
    if (send) send.addEventListener('click', sendMessage);
    if (input) {
      input.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') sendMessage();
      });
    }
  }

  function toggleChat() {
    chatOpen = !chatOpen;
    var win = document.getElementById('chat-window');
    var notif = document.getElementById('chat-notif');
    if (!win) return;
    if (chatOpen) {
      win.classList.add('open');
      if (notif) notif.style.display = 'none';
      if (!history.length) initChat();
    } else {
      win.classList.remove('open');
    }
  }

  function initChat() {
    sessionPhase = 'chatting';
    orderStep = 'idle';
    sessionLang = siteLang();
    var strings = t(sessionLang);
    pushHistory('model', strings.welcome);
    typeBotMessage(strings.welcome, { userText: '', skipPolish: true }).then(function () {
      showQuickReplies(strings.quickReplies);
    });
  }

  function handleQuickReply(opt) {
    document.querySelectorAll('.quick-replies').forEach(function (el) { el.remove(); });
    addMsg('user', opt);
    processMessage(opt);
  }

  function sleep(ms) {
    return new Promise(function (resolve) { setTimeout(resolve, ms); });
  }

  function thinkDelay(userText) {
    var len = String(userText || '').length;
    return Math.min(3200, Math.max(1100, 800 + len * 40 + Math.random() * 500));
  }

  function typeDelay(text) {
    var chars = String(text || '').replace(/\n/g, '').length;
    return Math.min(8000, Math.max(1500, chars * 28));
  }

  function tokenizeForTyping(text) {
    var tokens = [];
    var lines = String(text).split('\n');
    for (var li = 0; li < lines.length; li++) {
      if (li > 0) tokens.push('\n');
      var words = lines[li].split(/(\s+)/);
      for (var i = 0; i < words.length; i++) {
        if (words[i]) tokens.push(words[i]);
      }
    }
    return tokens;
  }

  function setInputEnabled(on) {
    var input = document.getElementById('chat-input');
    var send = document.getElementById('chat-send');
    if (input) input.disabled = !on;
    if (send) send.disabled = !on;
  }

  function showTyping() {
    var div = document.getElementById('chat-messages');
    if (!div) return null;
    var msg = document.createElement('div');
    msg.className = 'msg bot typing';
    msg.innerHTML = '<span class="typing-dots"><span></span><span></span><span></span></span>';
    div.appendChild(msg);
    div.scrollTop = div.scrollHeight;
    return msg;
  }

  function polishReply(text, lang, intent, extra) {
    extra = extra || {};
    if (!window.MontanaChatKnowledge || !MontanaChatKnowledge.polishSalesReply) return text;
    return MontanaChatKnowledge.polishSalesReply(text, lang, {
      concern: intent && intent.concern,
      isGreeting: intent && intent.isGreeting,
      isGoodbye: intent && intent.isGoodbye,
      isIngredients: intent && intent.isIngredients,
      isUsage: intent && intent.isUsage,
      isPrice: intent && intent.isPrice,
      isOrderStep: extra.isOrderStep,
      skipPolish: extra.skipPolish
    });
  }

  async function typeBotMessage(text, opts) {
    opts = opts || {};
    var div = document.getElementById('chat-messages');
    if (!div) return null;

    isBotBusy = true;
    setInputEnabled(false);
    var strings = t(sessionLang);
    var status = document.getElementById('chat-status');

    try {
      if (!opts.skipThink) {
        var typing = showTyping();
        if (status) status.textContent = strings.statusTyping;
        await sleep(opts.thinkMs != null ? opts.thinkMs : thinkDelay(opts.userText || text));
        if (typing) typing.remove();
      }

      var msg = document.createElement('div');
      msg.className = 'msg bot typing-live';
      div.appendChild(msg);

      var tokens = tokenizeForTyping(String(text));
      var totalMs = typeDelay(text);
      var typed = 0;
      var built = '';

      for (var i = 0; i < tokens.length; i++) {
        built += tokens[i];
        if (tokens[i].trim()) typed++;
        msg.innerHTML = built.replace(/\n/g, '<br>');
        div.scrollTop = div.scrollHeight;
        if (tokens[i].trim()) {
          var pause = totalMs / Math.max(typed, 1);
          pause = Math.max(45, Math.min(130, pause));
          await sleep(pause + Math.random() * 25);
        }
      }

      msg.classList.remove('typing-live');
      if (status) status.textContent = strings.statusOnline;
      return msg;
    } finally {
      isBotBusy = false;
      setInputEnabled(true);
    }
  }

  async function botSay(text, opts) {
    opts = opts || {};
    var intent = opts.intent || null;
    var polished = polishReply(text, sessionLang, intent, opts);
    await typeBotMessage(polished, opts);
    return polished;
  }

  function addMsg(type, text) {
    var div = document.getElementById('chat-messages');
    if (!div) return null;
    var msg = document.createElement('div');
    msg.className = 'msg ' + type;
    msg.innerHTML = String(text).replace(/\n/g, '<br>');
    div.appendChild(msg);
    div.scrollTop = div.scrollHeight;
    return msg;
  }

  function showQuickReplies(options) {
    var div = document.getElementById('chat-messages');
    if (!div) return;
    var wrap = document.createElement('div');
    wrap.className = 'quick-replies';
    options.forEach(function (opt) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'qr-btn';
      btn.textContent = opt;
      btn.addEventListener('click', function () { handleQuickReply(opt); });
      wrap.appendChild(btn);
    });
    div.appendChild(wrap);
    div.scrollTop = div.scrollHeight;
  }

  async function sendMessage() {
    var input = document.getElementById('chat-input');
    if (!input) return;
    var text = input.value.trim();
    if (!text) return;
    input.value = '';
    document.querySelectorAll('.quick-replies').forEach(function (el) { el.remove(); });
    addMsg('user', text);
    await processMessage(text);
  }

  function showOrderConfirm() {
    var strings = t(sessionLang);
    var esc = window.MontanaChatOrders ? MontanaChatOrders.esc : function (s) { return s; };
    if (!orderData.items || !orderData.items.length) {
      var prods = getProducts();
      if (prods.length) {
        orderData.items = [{
          name: sessionLang === 'en' ? prods[0].nameEn : prods[0].nameAr,
          qty: 1,
          price: prods[0].price
        }];
      }
    }
    var total = orderData.items.reduce(function (s, i) { return s + i.price * i.qty; }, 0);
    pendingOrder = Object.assign({}, orderData);

    var div = document.getElementById('chat-messages');
    if (!div) return;
    document.querySelectorAll('.order-confirm').forEach(function (el) { el.remove(); });

    var confirm = document.createElement('div');
    confirm.className = 'order-confirm';
    confirm.innerHTML =
      '<div class="oc-title">' + strings.confirmTitle + '</div>' +
      '<div class="oc-item">' + strings.labelName + ': ' + esc(orderData.name) + '</div>' +
      '<div class="oc-item">' + strings.labelPhone + ': ' + esc(orderData.phone) + '</div>' +
      '<div class="oc-item">' + strings.labelAddress + ': ' + esc(orderData.address) + '</div>' +
      '<div class="oc-item">' + strings.labelProducts + ': ' + esc(orderData.items.map(function (i) { return i.name + ' x' + i.qty; }).join(', ')) + '</div>' +
      '<div class="oc-item" style="color:#10B981;font-weight:600;">' + strings.labelTotal + ': ' + total + ' ' + strings.currency + '</div>' +
      '<button type="button" class="oc-confirm-btn">' + strings.confirmBtn + '</button>' +
      '<div style="text-align:center;"><button type="button" class="oc-cancel">' + strings.cancelBtn + '</button></div>';
    confirm.querySelector('.oc-confirm-btn').addEventListener('click', confirmOrder);
    confirm.querySelector('.oc-cancel').addEventListener('click', cancelOrder);
    div.appendChild(confirm);
    div.scrollTop = div.scrollHeight;
  }

  async function confirmOrder() {
    if (!pendingOrder || isBotBusy) return;
    var strings = t(sessionLang);
    document.querySelectorAll('.order-confirm').forEach(function (el) { el.remove(); });
    await typeBotMessage(strings.saving, { skipThink: true, thinkMs: 900, skipPolish: true });

    try {
      var orderId = '';
      if (window.MONTANA_ADMIN && window.MONTANA_ADMIN.addOrder) {
        orderId = await window.MONTANA_ADMIN.addOrder(pendingOrder);
      } else if (window.MontanaChatOrders) {
        orderId = MontanaChatOrders.save(pendingOrder);
      } else {
        throw new Error('no_store');
      }
      var savedMsg = strings.saved.replace('{id}', orderId).replace('{phone}', pendingOrder.phone);
      lastCompletedOrder = {
        id: orderId,
        name: pendingOrder.name,
        phone: pendingOrder.phone,
        address: pendingOrder.address,
        items: pendingOrder.items.slice()
      };
      sessionPhase = 'post_order';
      pendingOrder = null;
      orderData = {};
      orderStep = 'idle';
      collectingOrder = false;
      history = [
        { role: 'user', parts: [{ text: sessionLang === 'en' ? 'Order #' + orderId + ' confirmed' : 'تم تأكيد الأوردر #' + orderId }] },
        { role: 'model', parts: [{ text: savedMsg }] }
      ];
      await typeBotMessage(savedMsg, { skipThink: true, thinkMs: 1200, skipPolish: true });
      setTimeout(function () { showQuickReplies(strings.afterOrder); }, 600);
    } catch (e) {
      await typeBotMessage(strings.saveFailed, { skipThink: true, skipPolish: true });
    }
  }

  async function cancelOrder() {
    var strings = t(sessionLang);
    document.querySelectorAll('.order-confirm').forEach(function (el) { el.remove(); });
    pendingOrder = null;
    orderData = {};
    orderStep = 'idle';
    collectingOrder = false;
    sessionPhase = lastCompletedOrder ? 'post_order' : 'chatting';
    clearOrderOfferSession();
    pushHistory('model', strings.cancelled);
    await typeBotMessage(strings.cancelled, { skipThink: true, skipPolish: true });
  }

  function init() {
    bindUi();
    setTimeout(function () {
      if (!chatOpen) {
        var notif = document.getElementById('chat-notif');
        if (notif) notif.style.display = 'flex';
      }
    }, 3000);
  }

  window.toggleChat = toggleChat;
  window.sendMessage = sendMessage;
  window.confirmOrder = confirmOrder;
  window.cancelOrder = cancelOrder;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  return { init: init, toggleChat: toggleChat, sendMessage: sendMessage };
})();
