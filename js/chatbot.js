/* Montana chatbot — AI-first sales consultant (Nour) */
window.MontanaChatbot = (function () {
  'use strict';

  // ─── State ───────────────────────────────────────────────────────────
  var chatOpen = false;
  var history = [];
  var orderData = {};
  var orderStep = 'idle';       // idle | product | name | phone | address | ready | confirm
  var collectingOrder = false;
  var pendingOrder = null;
  var pendingDepositProof = false;
  var pendingDepositApproved = false;
  var depositApprovalWaiter = null;
  var sessionPhase = 'idle';    // idle | chatting | ordering | post_order
  var lastCompletedOrder = null;
  var sessionLang = 'ar';
  var sessionSuggestedProduct = null;
  var sessionSuggestedProducts = [];
  var sessionLastConcern = null;
  var sessionLastConcerns = [];
  var sessionCatalogShown = false;
  var isBotBusy = false;
  var messageQueue = [];
  var processingQueue = false;
  var pendingChatImage = null;
  var chatAiEnabled = null;

  // ─── Strings ─────────────────────────────────────────────────────────
  var L = {
    botName: 'نور — Montana',
    statusOnline: 'متصلة دلوقتي',
    statusTyping: 'نور بتكتب...',
    avatar: '💜',
    close: '✕',
    send: '←',
    placeholder: 'اكتبي رسالتك...',
    welcome: 'أهلاً يا جميلة! 💜 أنا نور من Montana — متخصصة عناية بالبشرة.\n\nقوليلي إيه مشكلة بشرتك (حبوب، جفاف، تفتيح، ندوب) وأنا هختارلك الأنسب — أو قولي «عايز أطلب» على طول.',
    quickReplies: ['عندي حبوب في وشي', 'بشرتي كالحة وبهتة', 'عندي ندوب', 'بشرتي ناشفة', 'ازاي استخدمه؟', 'عايز أطلب'],
    noUnderstand: 'معلش يا جميلة، وضّحيلي أكتر — حبوب، تفتيح، ندوب، جفاف، أو «عايز أطلب»؟',
    error: 'معلش حاولي تاني. أو قوليلي: «عندي حبوب»، «بشرتي كالحة»، «بكام»، أو «عايز أطلب».',
    busy: 'ثانية واحدة يا حبيبتي — جرّبي تاني. أنا هنا!',
    helpReply: 'أنا نور ومعاكي خطوة بخطوة! 💜 ممكن أرشّحلك منتج يناسب بشرتك، أقولك السعر والمكونات، أو نعمل أوردر. قوليلي إيه اللي محتاجاه؟',
    confirmTitle: 'تأكيد الأوردر',
    labelName: 'الاسم',
    labelPhone: 'التليفون',
    labelAddress: 'العنوان',
    labelProducts: 'المنتجات',
    labelTotal: 'الإجمالي',
    currency: 'جنيه',
    confirmBtn: 'تأكيد الأوردر',
    cancelBtn: 'إلغاء',
    depositTitle: 'تأكيد حجز 200 جنيه',
    depositHint: 'حوّلي 200 جنيه وارفعي صورة التحويل — المسؤول يوافق على تليجرام وبعدين يتفعّل التأكيد.',
    depositUpload: '📷 رفع صورة التحويل',
    depositWaiting: '⏳ تم إرسال الصورة — في انتظار موافقة المسؤول',
    depositApproved: '✓ تمت الموافقة — أكّدي الأوردر',
    depositRequired: 'لازم ترفعي صورة التحويل (200 جنيه) قبل التأكيد.',
    depositNotApproved: 'لسه المسؤول موافقش على التحويل — استني شوية.',
    depositTimeout: 'انتهى وقت الانتظار — جرّبي رفع الصورة تاني.',
    depositUploading: 'بنرسل الصورة للمسؤول...',
    depositFailed: 'مش قدرنا نرفع الصورة — جرّبي تاني',
    saving: 'ثانية واحدة... بسجّل أوردرك 💜',
    saved: 'مبروك يا جميلة! 🎉 أوردرك اتسجل بنجاح.\n\nرقم الأوردر: #{id}\n\nهنتواصل معاكي على {phone} قريب جداً لتأكيد الشحن.\n\nشكراً لثقتك في Montana! 💜',
    saveFailed: 'معلش في مشكلة في تسجيل الأوردر. تواصلي معانا مباشرة.',
    cancelled: 'تمام يا حبيبتي، مفيش مشكلة! لو احتجتي أي حاجة أنا هنا. 😊',
    afterOrder: ['عايزة أشتري حاجة تانية', 'شكراً نور'],
    thanksReply: 'العفو يا جميلة! 💜 أي سؤال عن بشرتك أو منتج — أنا نور وهنا معاكي.',
    goodbyeReply: 'مع السلامة يا جميلة! 💜 أي وقت تحتاجي حاجة عن بشرتك — أنا نور وهنا.',
    addedToCart: 'تم إضافة {product} للسلة! 🛒',
    addToCartBtn: '🛒 أضف للسلة',
    cartContinue: 'عايزة حاجة تانية',
    cartOrder: 'ننفذ الأوردر'
  };

  var LE = {
    botName: 'Nour — Montana',
    statusOnline: 'Online now',
    statusTyping: 'Nour is typing...',
    placeholder: 'Type your message...',
    welcome: 'Hi! 👋 I\'m Nour, Montana\'s skincare consultant.\n\nTell me about your skin concern or say "I want to order".',
    quickReplies: ['I have acne', 'Dull skin', 'I have scars', 'Dry skin', 'I want to order'],
    noUnderstand: 'Sorry, I didn\'t catch that. Tell me your skin concern or say "I want to order".',
    error: 'Sorry, try again — or say: acne, brightening, scars, dry skin, or I want to order.',
    busy: 'Server is busy — try again in a few seconds.',
    helpReply: 'I can recommend products, share prices, or take your order. Tell me your skin concern or say "I want to order".',
    confirmTitle: 'Confirm order',
    labelName: 'Name',
    labelPhone: 'Phone',
    labelAddress: 'Address',
    labelProducts: 'Products',
    labelTotal: 'Total',
    currency: 'EGP',
    confirmBtn: 'Confirm order',
    cancelBtn: 'Cancel',
    depositTitle: '200 EGP deposit',
    depositHint: 'Transfer 200 EGP and upload proof — admin approves on Telegram, then confirm.',
    depositUpload: '📷 Upload transfer proof',
    depositWaiting: '⏳ Proof sent — waiting for admin approval',
    depositApproved: '✓ Approved — confirm your order',
    depositRequired: 'Upload deposit proof (200 EGP) before confirming.',
    depositNotApproved: 'Waiting for admin to approve your transfer.',
    depositTimeout: 'Approval timed out — upload proof again.',
    depositUploading: 'Sending proof to admin...',
    depositFailed: 'Could not upload proof — try again',
    saving: 'Saving your order...',
    saved: 'Your order is confirmed! 🎉\n\nOrder #: #{id}\n\nWe\'ll contact you at {phone} soon.\n\nThank you for choosing Montana! 💜',
    saveFailed: 'Sorry, we couldn\'t save the order. Please contact us directly.',
    cancelled: 'No problem! I\'m here if you have more questions. 😊',
    afterOrder: ['Buy another product', 'Thanks'],
    thanksReply: 'You\'re welcome! 💜 Happy to help — ask anytime about skincare.',
    goodbyeReply: 'Bye! 💜 Come back anytime — Nour is here.',
    addedToCart: '{product} added to cart! 🛒',
    addToCartBtn: '🛒 Add to Cart',
    cartContinue: 'I want something else',
    cartOrder: 'Place my order'
  };

  // ─── Helpers ─────────────────────────────────────────────────────────
  function siteLang() { return document.documentElement.lang === 'ar' ? 'ar' : 'en'; }

  function detectLang(text) {
    var s = String(text || '').trim();
    if (!s) return siteLang();
    var latin = (s.match(/[a-zA-Z]/g) || []).length;
    var arabic = (s.match(/[؀-ۿ]/g) || []).length;
    return latin > arabic ? 'en' : arabic > latin ? 'ar' : siteLang();
  }

  function str(lang) { return lang === 'en' ? LE : L; }
  function field(obj, lang) {
    if (!obj) return '';
    if (typeof obj === 'string') return obj;
    return lang === 'ar' ? (obj.ar || obj.en || '') : (obj.en || obj.ar || '');
  }
  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  function esc(s) { return window.MontanaChatOrders ? MontanaChatOrders.esc(s) : String(s || ''); }

  // ─── Product normalization ───────────────────────────────────────────
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
      pfor: field(p.tagline || p.category, 'ar'),
      desc: field(p.desc, 'ar'),
      descEn: field(p.desc, 'en'),
      ingr: ingList.join(', '),
      ingList: ingList,
      heroIngredient: p.display && p.display.heroIngredient ? p.display.heroIngredient : ''
    };
  }

  function getProducts() {
    try {
      if (window.MONTANA_ADMIN && window.MONTANA_ADMIN.getProducts) {
        var admin = window.MONTANA_ADMIN.getProducts();
        if (admin && admin.length) return admin.map(normalizeProduct);
      }
    } catch (e) {}
    return (window.MONTANA_PRODUCTS || []).map(normalizeProduct);
  }

  function productName(p, lang) { return lang === 'en' ? p.nameEn : p.nameAr; }
  function productNamesList(prods, lang) {
    return prods.map(function (p) { return productName(p, lang); }).join(lang === 'en' ? ', ' : '، ');
  }

  // ─── Product matching ────────────────────────────────────────────────
  function matchProductFromText(text) {
    var prods = getProducts();
    var t = String(text || '').trim();
    if (!t) return null;
    var norm = window.MontanaChatIntent ? MontanaChatIntent.normalizeText(t) : t.toLowerCase();
    if (window.MontanaChatKnowledge) {
      var all = MontanaChatKnowledge.findAllProductsByKnowledge(t, norm, prods);
      if (all.length) return all[0];
    }
    for (var i = 0; i < prods.length; i++) {
      if (t.indexOf(prods[i].nameAr) > -1 || t.indexOf(prods[i].nameEn) > -1) return prods[i];
    }
    return null;
  }

  function matchAllProductsFromText(text) {
    var prods = getProducts();
    var t = String(text || '').trim();
    if (!t) return [];
    var norm = window.MontanaChatIntent ? MontanaChatIntent.normalizeText(t) : t.toLowerCase();
    if (window.MontanaChatKnowledge) return MontanaChatKnowledge.findAllProductsByKnowledge(t, norm, prods);
    var one = matchProductFromText(t);
    return one ? [one] : [];
  }

  function matchProductFromConcern(concern, norm) {
    var prods = getProducts();
    if (window.MontanaChatKnowledge) {
      var fromK = MontanaChatKnowledge.resolveConcernProduct(concern, norm, prods);
      if (fromK) return fromK;
    }
    var map = { acne: 'acne-cleanser', oily: 'acne-cleanser', pores: 'acne-cleanser',
      whiten: 'whitening-cream', dull: 'whitening-cream', spots: 'whitening-cream',
      scar: 'anti-scar', dry: 'body-lotion', laser: 'post-laser', sensitive: 'post-laser' };
    var id = map[concern];
    return id ? prods.find(function (p) { return p.id === id; }) || null : null;
  }

  function contextProduct() {
    if (sessionSuggestedProduct) return sessionSuggestedProduct;
    var prods = getProducts();
    for (var i = history.length - 1; i >= 0 && i >= history.length - 8; i--) {
      var text = history[i].parts[0].text || '';
      for (var j = 0; j < prods.length; j++) {
        if (text.indexOf(prods[j].nameAr) > -1 || text.indexOf(prods[j].nameEn) > -1) return prods[j];
      }
    }
    return null;
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
      if (!found && window.MontanaChatKnowledge) {
        var norm = window.MontanaChatIntent ? MontanaChatIntent.normalizeText(n) : n.toLowerCase();
        var all = MontanaChatKnowledge.findAllProductsByKnowledge(n, norm, prods);
        if (all.length) found = all[0];
      }
      if (found && !items.some(function (i) { return i.name === found.nameAr; })) {
        items.push({ name: found.nameAr, qty: 1, price: found.price });
      }
    });
    return items;
  }

  // ─── Session context ─────────────────────────────────────────────────
  function rememberProduct(p) {
    if (!p) return;
    sessionSuggestedProduct = p;
    if (!sessionSuggestedProducts.some(function (x) { return x.id === p.id; })) {
      sessionSuggestedProducts.push(p);
    }
  }

  function rememberProducts(arr) { (arr || []).forEach(rememberProduct); }

  function noteProductsFromReply(text) {
    var prods = getProducts();
    prods.forEach(function (p) {
      if (String(text).indexOf(p.nameAr) > -1 || String(text).indexOf(p.nameEn) > -1) rememberProduct(p);
    });
  }

  function rememberContext(intent, product) {
    if (intent && intent.concern) sessionLastConcern = intent.concern;
    if (intent && intent.concerns && intent.concerns.length) sessionLastConcerns = intent.concerns.slice();
    if (product) rememberProduct(product);
  }

  // ─── Intent detection ────────────────────────────────────────────────
  function getIntent(text) {
    if (!window.MontanaChatIntent) {
      return { intent: 'unknown', score: 0, wantsOrder: false, isAffirm: false, concern: null, concerns: [] };
    }
    var intent = MontanaChatIntent.detectIntent(text, {
      botOfferedOrder: sessionSuggestedProducts.length > 0,
      collectingOrder: collectingOrder
    });
    if (!intent.concern && sessionLastConcern && (intent.isPrice || intent.isUsage || intent.isIngredients || intent.isAffirm || intent.isRecommend)) {
      intent.concern = sessionLastConcern;
    }
    if ((!intent.concerns || !intent.concerns.length) && sessionLastConcerns.length && (intent.isPrice || intent.isUsage || intent.isIngredients || intent.isAffirm)) {
      intent.concerns = sessionLastConcerns.slice();
    }
    return intent;
  }

  // ─── History ─────────────────────────────────────────────────────────
  function pushHistory(role, text) {
    history.push({ role: role, parts: [{ text: text }] });
    if (history.length > 20) history = history.slice(-20);
  }

  // ─── Validation ──────────────────────────────────────────────────────
  function validatePhone(raw, lang) {
    lang = lang || sessionLang;
    var digits = String(raw || '').replace(/\D/g, '');
    if (digits.indexOf('20') === 0 && digits.length >= 12) digits = '0' + digits.slice(2);
    if (digits.length === 10 && digits.charAt(0) === '1') digits = '0' + digits;
    if (!digits.length) return { ok: false, message: lang === 'en' ? 'Please send your mobile number (11 digits).' : 'محتاجة رقم الموبايل — 11 رقم (زي 01012345678).' };
    if (digits.length < 11) return { ok: false, message: lang === 'en' ? 'Number is incomplete — must be 11 digits (' + digits.length + ' sent).' : 'الرقم ناقص — لازم 11 رقم (انتي بعتتي ' + digits.length + '). مثال: 01012345678.' };
    if (digits.length > 11) return { ok: false, message: lang === 'en' ? 'Number too long — must be exactly 11 digits.' : 'الرقم أطول من اللازم — لازم 11 رقم بالظبط.' };
    if (!/^01[0125]\d{8}$/.test(digits)) return { ok: false, message: lang === 'en' ? 'Invalid Egyptian mobile — must start with 010, 011, 012, or 015.' : 'رقم مصري مش صح — لازم يبدأ بـ 010 أو 011 أو 012 أو 015.' };
    return { ok: true, phone: digits };
  }

  function looksLikePhoneAttempt(text) { return String(text || '').replace(/\D/g, '').length >= 7; }

  function looksLikePersonName(text, intent) {
    intent = intent || getIntent(text);
    var t = String(text || '').trim();
    var words = t.split(/\s+/).filter(Boolean);
    if (!words.length || words.length > 4 || t.length > 40) return false;
    if (/\d{5,}/.test(t) || /[؟?]/.test(t)) return false;
    if (intent.wantsOrder || intent.isAffirm || intent.isGreeting || intent.isThanks || intent.isGoodbye) return false;
    if (matchProductFromText(t)) return false;
    return true;
  }

  function looksLikeAddress(text) {
    var t = String(text || '').trim();
    if (t.length < 10 || /[؟?]/.test(t)) return false;
    var norm = window.MontanaChatIntent ? MontanaChatIntent.normalizeText(t) : t.toLowerCase();
    if (/^(مش|ما|ليه|ازاي|كيف|ايه|مين|هطلب)/.test(norm)) return false;
    if (/شارع|street|ش\.|عمارة|عماره|دور|منطقة|منطقه|حي|مدينة|محافظ|القاهره|القاهرة|الجيزه|الجيزة|الاسكندر|cairo|giza|alex|october|زمالك|nasr|tagamo|شبرا|المعادي|التجمع|6\s*october/i.test(t)) return true;
    return t.length >= 14 && t.split(/\s+/).filter(Boolean).length >= 2;
  }

  var CANCEL_RE = /(?:الغاء|إلغاء|الغي|لغي|cancel|مش عايز|مش عاوز|بلاش|سيبك|كفايه|كفاية)/i;
  var THANKS_RE = /^(?:شكراً|شكرا|متشكر|متشكرة|تسلم|تسلمي|ميرسي|thanks|thank you|thx)(?:\s|!|\.|$)/i;

  function orderHasItems() { return !!(orderData.items && orderData.items.length); }

  // ─── AI API ──────────────────────────────────────────────────────────
  async function checkAiEnabled() {
    if (chatAiEnabled !== null) return chatAiEnabled;
    if (window.MONTANA_CHAT_AI === false) { chatAiEnabled = false; return false; }
    try {
      var r = await fetch('/api/settings/chat');
      var d = await r.json();
      chatAiEnabled = !!(d.ok && d.ai_enabled);
    } catch (e) { chatAiEnabled = false; }
    return chatAiEnabled;
  }

  function productCatalogText(lang) {
    if (window.MontanaChatKnowledge) return MontanaChatKnowledge.catalogExpert(lang, getProducts());
    return getProducts().map(function (p) {
      return lang === 'en'
        ? '- ' + p.nameEn + ' | ' + p.price + ' EGP | ' + p.sizeEn + ' | ' + p.descEn
        : '- ' + p.nameAr + ' | ' + p.price + ' جنيه | ' + p.size + ' | ' + p.desc;
    }).join('\n');
  }

  function buildAiSystem(lang) {
    var replyLang = lang === 'en'
      ? 'Reply in English — warm, expert skincare consultant tone.'
      : 'ردّي بالعربي المصري الطبيعي — زي بياعة كوزمتيك محترفة اسمها نور (ودودة، فاهمة، مش روبوت).';

    var suggestedNames = sessionSuggestedProducts.length
      ? sessionSuggestedProducts.map(function (p) { return productName(p, lang); }).join(', ')
      : '';

    var lines = [
      'You are Nour, Montana\'s skincare & cosmetics consultant.',
      'CRITICAL: Reply in the SAME language as the customer\'s latest message.',
      replyLang,
      '',
      'PRODUCT CATALOG (use EXACT names and prices — never invent):',
      productCatalogText(lang),
      '',
      suggestedNames ? 'Products already suggested this session: ' + suggestedNames : '',
      '',
      'RULES:',
      '1. Understand Egyptian Arabic naturally (عاوزا، كمان، والحبوب، يريت, etc.).',
      '2. Recommend from catalog only. Mention Arabic product name + price in جنيه.',
      '3. Multiple concerns → recommend ALL relevant products in one reply.',
      '4. NEVER ask "عايزة نعمل أوردر" — customer orders when ready.',
      '5. Do NOT collect name/phone/address — the app handles order collection.',
      '6. Keep replies concise (3–8 sentences unless listing products).',
      '7. Never diagnose medically — cosmetic guidance only.',
      '8. When mentioning a product, always include its price.',
      window.MontanaChatKnowledge ? MontanaChatKnowledge.aiKnowledgeBlock(lang, getProducts()) : ''
    ].filter(Boolean);

    return lines.join('\n');
  }

  async function callAi(userText, lang, opts) {
    opts = opts || {};
    var messages = history.map(function (h) {
      return { role: h.role === 'model' ? 'assistant' : 'user', content: h.parts[0].text };
    });
    var userLine = String(userText || '').trim();
    if (!userLine && opts.images && opts.images.length) {
      userLine = lang === 'en' ? 'Please analyze this skin photo and recommend Montana products.' : 'شوفي صورة بشرتي وقوليلي إيه المناسب من منتجات Montana.';
    }
    var lastMsg = { role: 'user', content: userLine };
    if (opts.images && opts.images.length) lastMsg.images = opts.images;
    messages.push(lastMsg);

    var system = buildAiSystem(lang);
    if (opts.images && opts.images.length) {
      system += '\n\n' + (lang === 'en'
        ? 'Customer attached a skin photo. Describe briefly (no medical diagnosis). Recommend suitable Montana products with names and prices.'
        : 'العميلة بعتت صورة بشرة. صفّي اللي ظاهر باختصار من غير تشخيص طبي. ارشّحي منتجات Montana بالاسم والسعر.');
    }

    try {
      var r = await fetch('/api/chat/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system: system,
          messages: messages,
          generationConfig: { temperature: 0.65, maxOutputTokens: 900 }
        })
      });
      var data = await r.json();
      if (r.ok && data.ok && data.text) {
        var reply = String(data.text).trim().replace(/^```[\s\S]*?```\s*/m, '').trim();
        return reply || null;
      }
    } catch (e) {}
    return null;
  }

  // ─── Local knowledge brain ───────────────────────────────────────────
  function localBrain(userText, lang, intent) {
    var K = window.MontanaChatKnowledge;
    var P = window.MontanaChatPhrases;
    var prods = getProducts();
    var norm = intent.norm || (window.MontanaChatIntent ? MontanaChatIntent.normalizeText(userText) : String(userText).toLowerCase());

    // Greeting
    if (intent.isGreeting) {
      return lang === 'en'
        ? 'Hi! How can I help you with your skin today?'
        : 'أهلاً يا جميلة! 💜 أنا نور من Montana — قوليلي إيه مشكلة بشرتك وأنا هرشّحلك الأنسب.';
    }

    // Goodbye
    if (intent.isGoodbye) return str(lang).goodbyeReply;

    // Thanks
    if (intent.isThanks || THANKS_RE.test(String(userText).trim())) return str(lang).thanksReply;

    // Shipping
    if (intent.isShipping && K) return K.shippingReply(lang);

    // Results timeline
    if (intent.isResults && K && K.buildResultsReply) {
      var resultsProd = matchProductFromText(userText) || sessionSuggestedProduct || contextProduct();
      if (resultsProd) {
        rememberProduct(resultsProd);
        return K.buildResultsReply(resultsProd.id, lang, prods);
      }
      return lang === 'en'
        ? 'Results depend on the product — tell me which one you\'re asking about!'
        : 'النتيجة بتختلف حسب المنتج — قوليلي بتسألي على أنهي منتج وأنا أقولك! 💜';
    }

    // Return policy
    if (intent.isReturn && K && K.buildReturnReply) {
      return K.buildReturnReply(lang);
    }

    // Payment methods
    if (intent.isPayment && K && K.buildPaymentReply) {
      return K.buildPaymentReply(lang);
    }

    // Help
    if (intent.isHelp) {
      return str(lang).helpReply;
    }

    // Phrase-based matching
    if (P && K && !collectingOrder) {
      var rule = P.matchRule(norm, userText, {
        collectingOrder: collectingOrder, sessionPhase: sessionPhase, orderStep: orderStep,
        sessionCatalogShown: sessionCatalogShown, recentCatalog: sessionCatalogShown
      });
      if (rule) {
        var brain = P.buildBrain(rule, lang, prods, K, intent, {
          orderStep: orderStep,
          suggestedProduct: sessionSuggestedProduct || contextProduct()
        });
        if (brain && brain.reply) {
          if (brain._products) { rememberProducts(brain._products); delete brain._products; }
          delete brain._skipPolish;
          return brain.reply;
        }
      }
    }

    if (!K) return null;

    // Multi-concern
    if (intent.concerns && intent.concerns.length >= 2 && !intent.wantsOrder) {
      var multi = K.buildMultiConsultationReply(intent.concerns, lang, prods);
      if (multi) {
        var mIds = K.resolveMultiConcernIds(intent.concerns);
        rememberProducts(mIds.map(function (id) { return prods.find(function (p) { return p.id === id; }); }).filter(Boolean));
        return multi;
      }
    }

    // Recommend
    if (intent.isRecommend && !intent.wantsOrder && intent.concern) {
      var recReply = K.buildConsultationReply(intent.concern, lang, prods, norm);
      if (recReply) {
        var recP = K.resolveConcernProduct(intent.concern, norm, prods);
        if (recP) rememberProduct(recP);
        return recReply;
      }
    }

    // Price (context-aware)
    if (intent.isPrice) {
      var priceProd = matchProductFromText(userText) || sessionSuggestedProduct || contextProduct();
      if (!priceProd && intent.concern) priceProd = matchProductFromConcern(intent.concern, norm);
      if (priceProd) {
        rememberProduct(priceProd);
        return lang === 'en'
          ? priceProd.nameEn + ' is ' + priceProd.price + ' EGP — ' + priceProd.sizeEn + '.'
          : priceProd.nameAr + ' سعره ' + priceProd.price + ' جنيه — ' + priceProd.size + '.';
      }
    }

    // Usage (context-aware)
    if (intent.isUsage) {
      var usageProd = matchProductFromText(userText) || sessionSuggestedProduct || contextProduct();
      if (usageProd) {
        rememberProduct(usageProd);
        return K.buildProductExpertReply(usageProd, lang, { usage: true, offerOrder: false });
      }
    }

    // Ingredients
    if (intent.isIngredients) {
      var ingProd = matchProductFromText(userText) || sessionSuggestedProduct || contextProduct();
      if (ingProd) {
        rememberProduct(ingProd);
        return K.buildProductExpertReply(ingProd, lang, { usage: false, offerOrder: false });
      }
      var ing = K.findIngredient(userText, norm);
      if (ing) return K.buildIngredientReply(ing, lang, prods);
    }

    // Catalog
    if (intent.isCatalog || intent.isCatalogFollowUp) {
      sessionCatalogShown = true;
      return K.buildFullCatalogReply(lang, prods);
    }

    // Skin concern (single)
    if (intent.concern && !intent.wantsOrder) {
      var consult = K.buildConsultationReply(intent.concern, lang, prods, norm);
      if (consult) {
        var cProd = K.resolveConcernProduct(intent.concern, norm, prods);
        if (cProd) rememberProduct(cProd);
        return consult;
      }
    }

    // Compare
    if (intent.isCompare) {
      var a = matchProductFromText(userText) || contextProduct();
      if (a) {
        var bId = K.getPair(a.id);
        var b = bId ? prods.find(function (p) { return p.id === bId; }) : null;
        if (b) return K.buildCompareReply(a, b, lang);
      }
    }

    // Routine
    if (intent.isRoutine && intent.concern) {
      var routineKey = intent.concern === 'spots' ? 'whiten' : intent.concern;
      var routine = K.buildRoutineReply(routineKey, lang);
      if (routine) return routine;
    }

    // Term
    var termKey = K.matchTerm(norm);
    if (termKey) {
      var termReply = K.buildTermReply(termKey, lang);
      if (termReply) return termReply;
    }

    // Direct product match from text
    var directProd = matchProductFromText(userText);
    if (directProd) {
      rememberProduct(directProd);
      return K.buildProductExpertReply(directProd, lang, { offerOrder: false });
    }

    // Ingredient lookup
    var ingLookup = K.findIngredient(userText, norm);
    if (ingLookup) {
      var ingProducts = (ingLookup.products || []).map(function (pid) { return prods.find(function (p) { return p.id === pid; }); }).filter(Boolean);
      rememberProducts(ingProducts);
      return K.buildIngredientReply(ingLookup, lang, prods);
    }

    return null;
  }

  // ─── Order flow (conversational) ────────────────────────────────────
  function wantsToOrder(text, intent) {
    intent = intent || getIntent(text);
    return intent.wantsOrder;
  }

  function isBrowsingQuestion(intent) {
    return intent.isProductInquiry || intent.isCatalog || intent.isCatalogFollowUp;
  }

  function buildProductPicker(lang) {
    var prods = getProducts();
    var list = prods.map(function (p) {
      return lang === 'en'
        ? '• ' + p.nameEn + ' — ' + p.price + ' EGP'
        : '• ' + p.nameAr + ' — ' + p.price + ' جنيه';
    }).join('\n');
    return lang === 'en'
      ? 'Which Montana product would you like?\n\n' + list + '\n\nTell me the product name or your skin concern.'
      : 'عايزة إيه من منتجات Montana?\n\n' + list + '\n\nقوليلي اسم المنتج أو مشكلة بشرتك.';
  }

  function startOrder(lang) {
    collectingOrder = true;
    sessionPhase = 'ordering';
    var picked = sessionSuggestedProducts.slice();
    if (!picked.length) {
      orderStep = 'product';
      return buildProductPicker(lang);
    }
    orderData.items = resolveProducts(picked.map(function (p) { return p.nameAr; }));
    orderStep = 'name';
    var list = productNamesList(picked, lang);
    return lang === 'en'
      ? 'Perfect! Added: ' + list + '.\n\nWhat\'s your full name?'
      : 'تمام! 💜 ضفنا: ' + list + '.\n\nاسمك بالكامل إيه؟';
  }

  function handleOrderStep(text, lang, intent) {
    var t = String(text || '').trim();

    if (CANCEL_RE.test(t)) {
      return { reply: null, action: 'cancel' };
    }

    // Product step
    if (orderStep === 'product') {
      var productPick = matchAllProductsFromText(t);
      if (!productPick.length && intent.concern) {
        var cp = matchProductFromConcern(intent.concern, intent.norm || '');
        if (cp) productPick = [cp];
      }
      if (productPick.length) {
        orderData.items = resolveProducts(productPick.map(function (p) { return p.nameAr; }));
        rememberProducts(productPick);
        orderStep = 'confirm_or_add';
        return {
          reply: lang === 'en'
            ? 'Added: ' + productNamesList(productPick, lang) + '.\n\nWould you like to add another product or proceed with the order?'
            : 'تمام! 💜 ضفنا: ' + productNamesList(productPick, lang) + '.\n\nتحبي تضيفي منتج تاني ولا نجهّز الأوردر؟',
          quickReplies: lang === 'en'
            ? ['Add another product', 'Proceed with order']
            : ['أضيفي منتج تاني', 'جهّزي الأوردر']
        };
      }
      return { reply: buildProductPicker(lang) };
    }

    // Confirm or add more step
    if (orderStep === 'confirm_or_add') {
      var addMore = /تاني|كمان|أضيف|اضيف|ضيف|add|more|another/i.test(t);
      var proceed = /جهز|اكمل|أكمل|تمام|كمل|خلاص|بس كده|كفاية|proceed|confirm|done|checkout|order|yes/i.test(t);

      var moreProd = matchAllProductsFromText(t);
      if (moreProd.length) {
        var existing = orderData.items || [];
        var newItems = resolveProducts(moreProd.map(function (p) { return p.nameAr; }));
        newItems.forEach(function (ni) {
          var found = existing.find(function (e) { return e.id === ni.id; });
          if (found) { found.qty = (found.qty || 1) + 1; }
          else { existing.push(ni); }
        });
        orderData.items = existing;
        rememberProducts(moreProd);
        var allNames = existing.map(function (i) { return i.name + ' x' + i.qty; }).join('، ');
        return {
          reply: lang === 'en'
            ? 'Added! Your cart now: ' + allNames + '.\n\nAnything else or proceed?'
            : 'تمام! 💜 سلتك دلوقتي: ' + allNames + '.\n\nتحبي تضيفي حاجة تانية ولا نجهّز الأوردر؟',
          quickReplies: lang === 'en'
            ? ['Add another product', 'Proceed with order']
            : ['أضيفي منتج تاني', 'جهّزي الأوردر']
        };
      }

      if (addMore) {
        orderStep = 'product';
        return { reply: buildProductPicker(lang) };
      }

      if (proceed) {
        orderStep = 'name';
        var cartSummary = (orderData.items || []).map(function (i) { return i.name + ' x' + i.qty; }).join('، ');
        return {
          reply: lang === 'en'
            ? 'Great! Your order: ' + cartSummary + '.\n\nWhat\'s your full name?'
            : 'تمام! 💜 أوردرك: ' + cartSummary + '.\n\nاسمك بالكامل إيه؟'
        };
      }

      return {
        reply: lang === 'en'
          ? 'Would you like to add another product or proceed with the order?'
          : 'تحبي تضيفي منتج تاني ولا نجهّز الأوردر؟',
        quickReplies: lang === 'en'
          ? ['Add another product', 'Proceed with order']
          : ['أضيفي منتج تاني', 'جهّزي الأوردر']
      };
    }

    // Name step
    if (orderStep === 'name') {
      var prodHints = matchAllProductsFromText(t);
      if (prodHints.length) {
        var existing = orderData.items || [];
        var newItems = resolveProducts(prodHints.map(function (p) { return p.nameAr; }));
        newItems.forEach(function (ni) {
          var found = existing.find(function (e) { return e.id === ni.id; });
          if (found) { found.qty = (found.qty || 1) + 1; }
          else { existing.push(ni); }
        });
        orderData.items = existing;
        rememberProducts(prodHints);
        orderStep = 'confirm_or_add';
        var allNames = existing.map(function (i) { return i.name + ' x' + i.qty; }).join('، ');
        return {
          reply: lang === 'en'
            ? 'Added! Your cart: ' + allNames + '.\n\nAnything else or proceed?'
            : 'تمام! ضفنا: ' + allNames + '.\n\nتحبي تضيفي حاجة تانية ولا نجهّز الأوردر؟',
          quickReplies: lang === 'en'
            ? ['Add another product', 'Proceed with order']
            : ['أضيفي منتج تاني', 'جهّزي الأوردر']
        };
      }
      if (looksLikePersonName(t, intent)) {
        orderData.name = t;
        orderStep = 'phone';
        return {
          reply: lang === 'en'
            ? 'Thanks ' + t + '! What\'s your phone number? (11 digits)'
            : 'تسلمي يا ' + t + '! 💜 رقم الموبايل؟ (11 رقم)'
        };
      }
      return {
        reply: lang === 'en'
          ? 'Please tell me your name (first and last).'
          : 'محتاجة اسمك يا حبيبتي — الاسم الأول واسم العيلة.'
      };
    }

    // Phone step
    if (orderStep === 'phone') {
      var phResult = validatePhone(t, lang);
      if (phResult.ok) {
        orderData.phone = phResult.phone;
        orderStep = 'address';
        return {
          reply: lang === 'en'
            ? 'Got it. Delivery address? (city, area, street)'
            : 'تمام. العنوان فين يا جميلة؟ (محافظة + منطقة + شارع)'
        };
      }
      return { reply: phResult.message };
    }

    // Address step
    if (orderStep === 'address') {
      if (looksLikeAddress(t)) {
        orderData.address = t;
        orderStep = 'ready';
        return {
          reply: lang === 'en'
            ? 'Perfect! Confirm your order below.'
            : 'كده تمام يا حبيبتي! 💜 أكّدي الأوردر من تحت.',
          action: 'confirm'
        };
      }
      return {
        reply: lang === 'en'
          ? 'Please send your full address (governorate + area + street).'
          : 'محتاجة العنوان كامل (محافظة + منطقة + شارع).'
      };
    }

    return null;
  }

  // ─── Core think: AI-first, local fallback ────────────────────────────
  async function think(userText, opts) {
    opts = opts || {};
    var lang = detectLang(userText || (opts.images ? 'صورة' : ''));
    var intent = getIntent(userText);
    var strings = str(lang);

    // 1. Cancel order
    if (collectingOrder && CANCEL_RE.test(userText)) {
      return { reply: null, action: 'cancel', lang: lang };
    }

    // 2. Active order step
    if (collectingOrder && orderStep !== 'idle' && orderStep !== 'ready') {
      if (isBrowsingQuestion(intent) && orderStep !== 'product') {
        collectingOrder = false;
        orderStep = 'idle';
        orderData = {};
      } else {
        var stepResult = handleOrderStep(userText, lang, intent);
        if (stepResult) {
          return { reply: stepResult.reply, action: stepResult.action || 'chat', lang: lang, quickReplies: stepResult.quickReplies };
        }
      }
    }

    // 3. Quick local intents
    if (!opts.images || !opts.images.length) {
      if (THANKS_RE.test(String(userText).trim())) {
        sessionPhase = 'post_order';
        return { reply: strings.thanksReply, action: 'thanks', lang: lang };
      }
      if (intent.isGoodbye && !collectingOrder) {
        return { reply: strings.goodbyeReply, action: 'chat', lang: lang };
      }
      if (intent.isGreeting && !collectingOrder) {
        return {
          reply: lang === 'en'
            ? 'Hi! How can I help you with your skin today?'
            : 'أهلاً يا جميلة! 💜 أنا نور من Montana — قوليلي إيه مشكلة بشرتك وأنا هرشّحلك الأنسب.',
          action: 'chat', lang: lang
        };
      }
    }

    // 4. Start order
    if (!collectingOrder && (wantsToOrder(userText, intent) || (intent.isAffirm && sessionSuggestedProducts.length)) && !isBrowsingQuestion(intent)) {
      return { reply: startOrder(lang), action: 'chat', lang: lang };
    }

    // 5. AI first
    if (await checkAiEnabled()) {
      try {
        var aiReply = await callAi(userText, lang, opts);
        if (aiReply) {
          noteProductsFromReply(aiReply);
          return { reply: aiReply, action: 'chat', lang: lang, fromAi: true };
        }
      } catch (e) {}
    }

    // 6. Local knowledge
    var localReply = localBrain(userText, lang, intent);
    if (localReply) {
      noteProductsFromReply(localReply);
      return { reply: localReply, action: 'chat', lang: lang };
    }

    // 7. Smart fallback
    var K = window.MontanaChatKnowledge;
    if (K) {
      var fallback = K.buildSmartFallback(lang, {
        concern: intent.concern || sessionLastConcern,
        concerns: intent.concerns && intent.concerns.length ? intent.concerns : sessionLastConcerns,
        product: sessionSuggestedProduct || contextProduct(),
        products: getProducts(),
        norm: intent.norm || ''
      });
      if (fallback) return { reply: fallback, action: 'chat', lang: lang };
    }

    return { reply: strings.noUnderstand, action: 'chat', lang: lang };
  }

  // ─── Polish reply ────────────────────────────────────────────────────
  function polishReply(text, lang, intent, opts) {
    opts = opts || {};
    if (opts.skipPolish || !window.MontanaChatKnowledge || !MontanaChatKnowledge.polishSalesReply) return text;
    return MontanaChatKnowledge.polishSalesReply(text, lang, {
      concern: intent && intent.concern,
      isGreeting: intent && intent.isGreeting,
      isGoodbye: intent && intent.isGoodbye,
      isIngredients: intent && intent.isIngredients,
      isUsage: intent && intent.isUsage,
      isPrice: intent && intent.isPrice,
      isOrderStep: opts.isOrderStep,
      skipPolish: opts.skipPolish
    });
  }

  // ─── UI: typing animation ───────────────────────────────────────────
  function thinkDelay(text) {
    var len = String(text || '').length;
    return Math.min(3200, Math.max(1100, 800 + len * 40 + Math.random() * 500));
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
    var attach = document.getElementById('chat-attach');
    if (input) input.disabled = !on;
    if (send) send.disabled = !on;
    if (attach) attach.disabled = !on;
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

  async function typeBotMessage(text, opts) {
    opts = opts || {};
    var div = document.getElementById('chat-messages');
    if (!div) return null;

    isBotBusy = true;
    setInputEnabled(false);
    var strings = str(sessionLang);
    var statusEl = document.getElementById('chat-status');

    try {
      if (!opts.skipThink) {
        var typing = showTyping();
        if (statusEl) statusEl.textContent = strings.statusTyping;
        await sleep(opts.thinkMs != null ? opts.thinkMs : thinkDelay(opts.userText || text));
        if (typing) typing.remove();
      }

      var msg = document.createElement('div');
      msg.className = 'msg bot typing-live';
      div.appendChild(msg);

      var tokens = tokenizeForTyping(String(text));
      var totalChars = String(text).replace(/\n/g, '').length;
      var totalMs = Math.min(8000, Math.max(1500, totalChars * 28));
      var built = '';

      for (var i = 0; i < tokens.length; i++) {
        built += tokens[i];
        msg.innerHTML = built.replace(/\n/g, '<br>');
        div.scrollTop = div.scrollHeight;
        if (tokens[i].trim()) {
          var pause = Math.max(45, Math.min(130, totalMs / Math.max(i + 1, 1)));
          await sleep(pause + Math.random() * 25);
        }
      }

      msg.classList.remove('typing-live');
      if (statusEl) statusEl.textContent = strings.statusOnline;
      return msg;
    } finally {
      isBotBusy = false;
      setInputEnabled(true);
    }
  }

  function addMsg(type, text, opts) {
    opts = opts || {};
    var div = document.getElementById('chat-messages');
    if (!div) return null;
    var msg = document.createElement('div');
    msg.className = 'msg ' + type;
    var html = String(text || '').replace(/\n/g, '<br>');
    if (opts.image && opts.image.data) {
      html = '<img class="msg-photo" src="' + opts.image.data.replace(/"/g, '&quot;') + '" alt="">' +
        (html ? '<div class="msg-photo-caption">' + html + '</div>' : '');
    }
    msg.innerHTML = html;
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

  function handleQuickReply(opt) {
    document.querySelectorAll('.quick-replies').forEach(function (el) { el.remove(); });
    addMsg('user', opt);
    processMessage(opt);
  }

  // ─── Add to Cart button ──────────────────────────────────────────────
  function showAddToCartButtons(products, lang) {
    if (!products || !products.length || !window.MontanaCart) return;
    var div = document.getElementById('chat-messages');
    if (!div) return;
    document.querySelectorAll('.chat-cart-btns').forEach(function (el) { el.remove(); });
    var wrap = document.createElement('div');
    wrap.className = 'chat-cart-btns';
    products.forEach(function (p) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'chat-add-cart-btn';
      btn.innerHTML = str(lang).addToCartBtn + ' — ' + esc(productName(p, lang));
      btn.addEventListener('click', function () {
        wrap.remove();
        MontanaCart.add(p.id);
        if (window.MontanaShop) MontanaShop.updateBadge();
        var strings = str(lang);
        var confirmText = strings.addedToCart.replace('{product}', productName(p, lang));
        typeBotMessage(confirmText, { skipThink: false, thinkMs: 600 }).then(function () {
          pushHistory('model', confirmText);
          showQuickReplies([strings.cartContinue, strings.cartOrder]);
        });
      });
      wrap.appendChild(btn);
    });
    div.appendChild(wrap);
    div.scrollTop = div.scrollHeight;
  }

  // ─── Order confirmation card with deposit ────────────────────────────
  function showOrderConfirm() {
    var strings = str(sessionLang);
    if (!orderHasItems()) {
      orderStep = 'product';
      collectingOrder = true;
      typeBotMessage(buildProductPicker(sessionLang), { skipThink: true });
      return;
    }
    var total = orderData.items.reduce(function (s, i) { return s + i.price * i.qty; }, 0);
    pendingOrder = Object.assign({}, orderData);
    pendingDepositProof = false;
    pendingDepositApproved = false;
    if (depositApprovalWaiter) { depositApprovalWaiter.cancel(); depositApprovalWaiter = null; }

    var div = document.getElementById('chat-messages');
    if (!div) return;
    document.querySelectorAll('.order-confirm').forEach(function (el) { el.remove(); });

    var depAmount = window.MontanaDeposit ? MontanaDeposit.amount() : 200;
    var depInfo = window.MontanaDeposit ? MontanaDeposit.paymentInfo(sessionLang) : strings.depositHint;

    var confirm = document.createElement('div');
    confirm.className = 'order-confirm';
    confirm.innerHTML =
      '<div class="oc-title">' + strings.confirmTitle + '</div>' +
      '<div class="oc-item">' + strings.labelName + ': ' + esc(orderData.name) + '</div>' +
      '<div class="oc-item">' + strings.labelPhone + ': ' + esc(orderData.phone) + '</div>' +
      '<div class="oc-item">' + strings.labelAddress + ': ' + esc(orderData.address) + '</div>' +
      '<div class="oc-item">' + strings.labelProducts + ': ' + esc(orderData.items.map(function (i) { return i.name + ' x' + i.qty; }).join(', ')) + '</div>' +
      '<div class="oc-item" style="color:#10B981;font-weight:600;">' + strings.labelTotal + ': ' + total + ' ' + strings.currency + '</div>' +
      '<div class="oc-deposit">' +
        '<div class="oc-deposit-title">' + strings.depositTitle.replace('200', depAmount) + '</div>' +
        '<p class="oc-deposit-info">' + esc(depInfo) + '</p>' +
        '<input type="file" accept="image/*" class="oc-deposit-file" hidden>' +
        '<button type="button" class="oc-deposit-upload">' + strings.depositUpload + '</button>' +
        '<p class="oc-deposit-status"></p>' +
      '</div>' +
      '<button type="button" class="oc-confirm-btn" disabled>' + strings.confirmBtn + '</button>' +
      '<div style="text-align:center;"><button type="button" class="oc-cancel">' + strings.cancelBtn + '</button></div>';

    var fileInput = confirm.querySelector('.oc-deposit-file');
    var uploadBtn = confirm.querySelector('.oc-deposit-upload');
    var statusEl = confirm.querySelector('.oc-deposit-status');
    var confirmBtn = confirm.querySelector('.oc-confirm-btn');

    uploadBtn.addEventListener('click', function () { fileInput.click(); });

    fileInput.addEventListener('change', async function () {
      var f = fileInput.files && fileInput.files[0];
      fileInput.value = '';
      if (!f || !window.MontanaDeposit) return;
      uploadBtn.disabled = true;
      statusEl.textContent = strings.depositUploading;
      statusEl.style.color = '#E9D5FF';
      try {
        var dataUrl = await MontanaDeposit.readImageFile(f);
        var uploadResult = await MontanaDeposit.uploadProof({
          image: dataUrl, source: 'chat',
          name: orderData.name, phone: orderData.phone, address: orderData.address,
          itemsSummary: MontanaDeposit.itemsSummary(orderData.items, sessionLang),
          total: total
        });
        pendingDepositProof = true;
        if (pendingOrder) { pendingOrder.depositProofSent = true; pendingOrder.proofId = uploadResult.proofId; }
        statusEl.textContent = strings.depositWaiting;
        statusEl.style.color = '#E9D5FF';

        if (depositApprovalWaiter) depositApprovalWaiter.cancel();
        depositApprovalWaiter = MontanaDeposit.waitForAdminApproval(uploadResult.proofId);
        try {
          await depositApprovalWaiter.promise;
          pendingDepositApproved = true;
          if (pendingOrder) pendingOrder.depositApproved = true;
          statusEl.textContent = strings.depositApproved;
          statusEl.style.color = '#10B981';
          confirmBtn.disabled = false;
        } catch (waitErr) {
          if (waitErr && waitErr.message === 'cancelled') return;
          statusEl.textContent = waitErr && waitErr.message === 'approval_timeout' ? strings.depositTimeout : strings.depositNotApproved;
          statusEl.style.color = '#F87171';
          uploadBtn.disabled = false;
          pendingDepositProof = false;
        }
      } catch (e) {
        statusEl.textContent = (e && e.message && e.message !== 'upload_failed') ? e.message : strings.depositFailed;
        statusEl.style.color = '#F87171';
        uploadBtn.disabled = false;
      }
    });

    confirmBtn.addEventListener('click', confirmOrder);
    confirm.querySelector('.oc-cancel').addEventListener('click', cancelOrder);
    div.appendChild(confirm);
    div.scrollTop = div.scrollHeight;

    if (window.MontanaDeposit) MontanaDeposit.loadSettings();
  }

  // ─── Confirm / Cancel order ──────────────────────────────────────────
  async function confirmOrder() {
    if (!pendingOrder || isBotBusy) return;
    var strings = str(sessionLang);
    if (!pendingDepositApproved && !(pendingOrder && pendingOrder.depositApproved)) {
      await typeBotMessage(pendingDepositProof ? strings.depositNotApproved : strings.depositRequired, { skipThink: true });
      return;
    }
    document.querySelectorAll('.order-confirm').forEach(function (el) { el.remove(); });
    await typeBotMessage(strings.saving, { skipThink: true, thinkMs: 900 });

    var depAmount = window.MontanaDeposit ? MontanaDeposit.amount() : 200;
    pendingOrder.depositAmount = depAmount;
    pendingOrder.depositProofSent = true;
    pendingOrder.source = 'chatbot';

    try {
      var orderId = '';
      if (window.MONTANA_ADMIN && window.MONTANA_ADMIN.addOrder) {
        orderId = await window.MONTANA_ADMIN.addOrder(pendingOrder);
      } else if (window.MontanaChatOrders) {
        orderId = MontanaChatOrders.save(pendingOrder);
      } else {
        throw new Error('no_store');
      }
      if (window.MontanaDeposit) {
        pendingOrder.id = orderId;
        pendingOrder.time = new Date().toLocaleString('ar-EG');
        await MontanaDeposit.notifyOrderConfirmed(pendingOrder);
      }
      var savedMsg = strings.saved.replace('{id}', orderId).replace('{phone}', pendingOrder.phone);
      lastCompletedOrder = {
        id: orderId, name: pendingOrder.name, phone: pendingOrder.phone,
        address: pendingOrder.address, items: pendingOrder.items.slice()
      };
      sessionPhase = 'post_order';
      resetOrderState();
      history = [
        { role: 'user', parts: [{ text: sessionLang === 'en' ? 'Order #' + orderId + ' confirmed' : 'تم تأكيد الأوردر #' + orderId }] },
        { role: 'model', parts: [{ text: savedMsg }] }
      ];
      await typeBotMessage(savedMsg, { skipThink: true, thinkMs: 1200 });
      setTimeout(function () { showQuickReplies(strings.afterOrder); }, 600);
    } catch (e) {
      await typeBotMessage(strings.saveFailed, { skipThink: true });
    }
  }

  async function cancelOrder() {
    var strings = str(sessionLang);
    document.querySelectorAll('.order-confirm').forEach(function (el) { el.remove(); });
    resetOrderState();
    sessionPhase = lastCompletedOrder ? 'post_order' : 'chatting';
    sessionSuggestedProduct = null;
    sessionSuggestedProducts = [];
    pushHistory('model', strings.cancelled);
    await typeBotMessage(strings.cancelled, { skipThink: true });
  }

  function resetOrderState() {
    pendingOrder = null;
    pendingDepositProof = false;
    pendingDepositApproved = false;
    if (depositApprovalWaiter) { depositApprovalWaiter.cancel(); depositApprovalWaiter = null; }
    orderData = {};
    orderStep = 'idle';
    collectingOrder = false;
  }

  // ─── Message processing pipeline ────────────────────────────────────
  async function processWithAI(payload) {
    var text = typeof payload === 'string' ? payload : (payload && payload.text) || '';
    var images = payload && payload.images ? payload.images : null;
    sessionLang = detectLang(text || (images ? 'صورة' : ''));
    var strings = str(sessionLang);
    var intent = getIntent(text);
    var statusEl = document.getElementById('chat-status');
    var typing = null;

    try {
      isBotBusy = true;
      setInputEnabled(false);
      typing = showTyping();
      if (statusEl) statusEl.textContent = strings.statusTyping;

      var result = await Promise.all([
        think(text, { images: images }),
        sleep(thinkDelay(text || 'photo'))
      ]).then(function (r) { return r[0]; });

      if (typing) { typing.remove(); typing = null; }

      if (result.action === 'cancel') {
        await cancelOrder();
        return;
      }

      var reply = result.reply;
      if (!reply) {
        await typeBotMessage(strings.error, { skipThink: true });
        return;
      }

      if (!result.fromAi) {
        reply = polishReply(reply, sessionLang, intent, {
          isOrderStep: collectingOrder,
          skipPolish: collectingOrder || result.action === 'thanks'
        });
      }

      var replyProduct = sessionSuggestedProduct || matchProductFromText(text);
      rememberContext(intent, replyProduct);

      pushHistory('user', text);
      noteProductsFromReply(reply);
      pushHistory('model', reply);

      await typeBotMessage(reply, { skipThink: true, userText: text, intent: intent });

      if (result.quickReplies && result.quickReplies.length) {
        showQuickReplies(result.quickReplies);
      }

      if (result.action === 'thanks') {
        sessionPhase = 'post_order';
        return;
      }

      if (!collectingOrder && result.action === 'chat' && sessionSuggestedProduct) {
        var cartProducts = sessionSuggestedProducts.length > 1
          ? sessionSuggestedProducts.slice(-2)
          : [sessionSuggestedProduct];
        var uniqueCart = [];
        cartProducts.forEach(function (p) {
          if (!uniqueCart.some(function (u) { return u.id === p.id; })) uniqueCart.push(p);
        });
        showAddToCartButtons(uniqueCart, sessionLang);
      }

      if (result.action === 'confirm') {
        orderStep = 'confirm';
        collectingOrder = false;
        showOrderConfirm();
      }
    } catch (e) {
      if (typing) typing.remove();
      try { await typeBotMessage(strings.error, { skipThink: true }); } catch (e2) {}
    } finally {
      if (typing) typing.remove();
      isBotBusy = false;
      setInputEnabled(true);
      if (statusEl) statusEl.textContent = str(sessionLang).statusOnline;
    }
  }

  // ─── Message queue ───────────────────────────────────────────────────
  async function drainMessageQueue() {
    if (processingQueue) return;
    processingQueue = true;
    try {
      while (messageQueue.length) {
        await processWithAI(messageQueue.shift());
      }
    } finally {
      processingQueue = false;
      isBotBusy = false;
      setInputEnabled(true);
    }
  }

  async function processMessage(payload) {
    if (typeof payload === 'string') payload = { text: payload };
    messageQueue.push(payload);
    await drainMessageQueue();
  }

  // ─── Image attachment ────────────────────────────────────────────────
  function clearImagePreview() {
    pendingChatImage = null;
    var preview = document.getElementById('chat-image-preview');
    if (preview) preview.remove();
  }

  function showImagePreview(dataUrl) {
    clearImagePreview();
    var area = document.getElementById('chat-input-area');
    if (!area) return;
    var preview = document.createElement('div');
    preview.id = 'chat-image-preview';
    preview.innerHTML = '<img alt=""><button type="button" aria-label="Remove">×</button>';
    preview.querySelector('img').src = dataUrl;
    preview.querySelector('button').addEventListener('click', clearImagePreview);
    area.parentNode.insertBefore(preview, area);
  }

  function bindImageAttach() {
    var attach = document.getElementById('chat-attach');
    var file = document.getElementById('chat-image-input');
    if (!attach || !file) return;
    attach.addEventListener('click', function () { file.click(); });
    file.addEventListener('change', function () {
      var f = file.files && file.files[0];
      file.value = '';
      if (!f || !/^image\//.test(f.type)) return;
      if (f.size > 4 * 1024 * 1024) {
        var input = document.getElementById('chat-input');
        if (input) {
          var old = input.placeholder;
          input.placeholder = sessionLang === 'en' ? 'Image max 4MB' : 'الصورة لازم تكون أقل من ٤ ميجا';
          setTimeout(function () { input.placeholder = old; }, 2500);
        }
        return;
      }
      var reader = new FileReader();
      reader.onload = function () {
        pendingChatImage = { mimeType: f.type || 'image/jpeg', data: String(reader.result || '') };
        showImagePreview(pendingChatImage.data);
      };
      reader.readAsDataURL(f);
    });
  }

  // ─── Send message ────────────────────────────────────────────────────
  async function sendMessage() {
    var input = document.getElementById('chat-input');
    if (!input) return;
    var text = input.value.trim();
    if (!text && !pendingChatImage) return;
    if (!text && pendingChatImage) {
      text = sessionLang === 'en'
        ? 'What do you see in my skin?'
        : 'شوفي بشرتي في الصورة وقوليلي إيه المناسب';
    }
    var images = pendingChatImage ? [pendingChatImage] : null;
    var imageCopy = pendingChatImage;
    input.value = '';
    clearImagePreview();
    pendingChatImage = null;
    document.querySelectorAll('.quick-replies').forEach(function (el) { el.remove(); });
    addMsg('user', text, { image: imageCopy });
    await processMessage({ text: text, images: images });
  }

  // ─── Toggle chat ─────────────────────────────────────────────────────
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
    var strings = str(sessionLang);
    pushHistory('model', strings.welcome);
    typeBotMessage(strings.welcome, { userText: '', skipThink: false }).then(function () {
      showQuickReplies(strings.quickReplies);
    });
  }

  // ─── Bind UI ─────────────────────────────────────────────────────────
  function bindUi() {
    var strings = str(siteLang());
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
    if (input) input.addEventListener('keydown', function (e) { if (e.key === 'Enter') sendMessage(); });
    bindImageAttach();
  }

  // ─── Init ────────────────────────────────────────────────────────────
  function init() {
    bindUi();
    setTimeout(function () {
      if (!chatOpen) {
        var notif = document.getElementById('chat-notif');
        if (notif) notif.style.display = 'flex';
      }
    }, 3000);
  }

  // ─── Expose globals ──────────────────────────────────────────────────
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
