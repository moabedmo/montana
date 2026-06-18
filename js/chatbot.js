/* Montana chatbot — Gemini consult + code-only orders */
window.MontanaChatbot = (function () {
  var chatOpen = false;
  var history = [];
  var orderData = {};
  var collectingOrder = false;
  var orderStep = 'idle';
  var pendingOrder = null;
  var pendingDepositProof = false;
  var pendingDepositApproved = false;
  var depositApprovalWaiter = null;
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
    noKey: 'الشات محتاج GEMINI_API_KEY في .env — من aistudio.google.com/apikey ثم أعد التشغيل',
    keyInvalid: 'مفتاح Gemini في .env مش شغال — انسخيه تاني من Google AI Studio',
    apiError: 'مشكلة من Gemini: ',
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
    depositTitle: 'عربون 200 جنيه',
    depositHint: 'حوّلي 200 جنيه وارفعي صورة التحويل — المسؤول يوافق على تليجرام وبعدين يتفعّل التأكيد.',
    depositUpload: '📷 رفع صورة التحويل',
    depositWaiting: '⏳ تم إرسال الصورة — في انتظار موافقة المسؤول (رد «تم» على تليجرام)',
    depositApproved: '✓ تمت الموافقة — أكّدي الأوردر',
    depositSent: '✓ تم إرسال الصورة للمسؤول — أكّدي الأوردر',
    depositRequired: 'لازم ترفعي صورة التحويل (200 جنيه) قبل التأكيد.',
    depositNotApproved: 'لسه المسؤول موافقش على التحويل — استني شوية.',
    depositTimeout: 'انتهى وقت الانتظار — جرّبي رفع الصورة تاني.',
    depositUploading: 'بنرسل الصورة للمسؤول...',
    depositFailed: 'مش قدرنا نرفع الصورة — جرّبي تاني',
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
    noKey: 'Chat needs GEMINI_API_KEY in .env — from aistudio.google.com/apikey then restart',
    keyInvalid: 'Gemini key in .env is not working — copy a new one from Google AI Studio',
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
    depositTitle: '200 EGP deposit',
    depositHint: 'Transfer 200 EGP and upload proof — admin approves on Telegram, then confirm.',
    depositUpload: '📷 Upload transfer proof',
    depositWaiting: '⏳ Proof sent — waiting for admin approval (reply «تم» on Telegram)',
    depositApproved: '✓ Approved — confirm your order',
    depositSent: '✓ Proof sent to admin — confirm your order',
    depositRequired: 'Upload deposit proof (200 EGP) before confirming.',
    depositNotApproved: 'Waiting for admin to approve your transfer.',
    depositTimeout: 'Approval timed out — upload proof again.',
    depositUploading: 'Sending proof to admin...',
    depositFailed: 'Could not upload proof — try again',
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
          step: { type: 'STRING', enum: ['idle', 'product', 'name', 'phone', 'address', 'ready'] },
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
    if (brain.action === 'open_order') brain.action = 'start_order';
    if (brain.order.product_names && brain.order.product_names.length) {
      var resolved = resolveProducts(brain.order.product_names);
      brain.order.product_names = resolved.map(function (i) { return i.name; });
    }
    if ((brain.action === 'start_order' || brain.action === 'update_order') &&
        (!brain.order.product_names || !brain.order.product_names.length)) {
      if (sessionSuggestedProducts.length) {
        brain.order.product_names = sessionSuggestedProducts.map(function (p) { return p.nameAr; });
      } else if (sessionSuggestedProduct) {
        brain.order.product_names = [sessionSuggestedProduct.nameAr];
      }
    }
    if (brain.order.name && looksLikePersonName(String(brain.order.name), getIntent(String(brain.order.name)))) {
      /* keep */
    } else if (brain.order.name && /كريم|غسول|حبوب|تفتيح|لوشن/i.test(String(brain.order.name))) {
      brain.order.name = '';
    }
    return brain;
  }

  var pendingChatImage = null;

  async function callConsultAi(userText, lang, opts) {
    opts = opts || {};
    var messages = history.map(function (h) {
      return {
        role: h.role === 'model' ? 'assistant' : 'user',
        content: h.parts[0].text
      };
    });
    var userLine = String(userText || '').trim();
    if (!userLine && opts.images && opts.images.length) {
      userLine = lang === 'en'
        ? 'Please analyze this skin photo and recommend Montana products.'
        : 'شوفي صورة بشرتي وقوليلي إيه المناسب من منتجات Montana.';
    }
    var lastMsg = { role: 'user', content: userLine };
    if (opts.images && opts.images.length) lastMsg.images = opts.images;
    messages.push(lastMsg);

    var system = buildConsultSystem(lang);
    if (opts.images && opts.images.length) {
      system += lang === 'en'
        ? '\n\nThe customer attached a skin photo. Describe what you see briefly (no medical diagnosis). Recommend suitable Montana products using exact catalog names and prices.'
        : '\n\nالعميلة بعتت صورة بشرة. صفّي اللي ظاهر باختصار من غير تشخيص طبي. ارشّحي منتجات Montana بالاسم العربي الكامل والسعر من القائمة.';
    }

    var result = await callChatAi({
      system: system,
      messages: messages,
      generationConfig: { temperature: 0.65, maxOutputTokens: 900 }
    });
    if (!result.ok) return null;
    var reply = String(result.text || '').trim();
    if (!reply) return null;
    reply = reply.replace(/^```[\s\S]*?```\s*/m, '').trim();
    return {
      reply: reply,
      action: 'chat',
      order: { step: orderStep || 'idle', product_names: [] }
    };
  }

  function buildConsultSystem(lang) {
    var replyLang = lang === 'en'
      ? 'Reply in English — warm, natural, expert cosmetics consultant (Nour).'
      : 'ردّي بالعربي المصري الطبيعي — زي بياعة كوزمتيك محترفة اسمها نور (ودودة، فاهمة، مش روبوت).';
    var suggested = sessionSuggestedProducts.length
      ? sessionSuggestedProducts.map(function (p) { return lang === 'en' ? p.nameEn : p.nameAr; }).join(', ')
      : '';

    return [
      'You are Nour, Montana\'s skincare & cosmetics consultant.',
      'CRITICAL: Reply in the SAME language as the customer\'s latest message.',
      replyLang,
      '',
      'PRODUCT CATALOG (use EXACT names and prices — never invent):',
      productCatalogText(lang),
      '',
      suggested ? ('Products already suggested this session: ' + suggested) : '',
      '',
      'RULES:',
      '1. Understand Egyptian Arabic naturally (عاوزا، كمان، والحبوب، يريت، etc.).',
      '2. Recommend from catalog only. Mention full Arabic product name + price in جنيه when recommending.',
      '3. Multiple concerns → recommend ALL relevant products in one clear reply.',
      '4. NEVER ask «عايزة نعمل أوردر» or «would you like to order» — customer orders when ready.',
      '5. Do NOT collect name, phone, or address — the app handles orders separately.',
      '6. Keep replies helpful but concise (3–8 sentences unless listing products).',
      '7. Never diagnose medically — cosmetic guidance only.',
      window.MontanaChatKnowledge ? MontanaChatKnowledge.aiKnowledgeBlock(lang, getProducts()) : ''
    ].filter(Boolean).join('\n');
  }

  async function callAiBrain(userText, lang, opts) {
    return callConsultAi(userText, lang, opts);
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

  function lastBotMessage() {
    for (var i = history.length - 1; i >= 0; i--) {
      if (history[i].role === 'model') {
        return history[i].parts[0].text || '';
      }
    }
    return '';
  }

  function buildSessionContextBlock(lang) {
    var offered = lastBotOfferedOrder() || sessionBotOfferedOrder;
    var suggested = sessionSuggestedProduct;
    var suggestedName = suggested ? (lang === 'en' ? suggested.nameEn : suggested.nameAr) : '';
    var lastBot = lastBotMessage();
    var lines = [
      'LIVE SESSION CONTEXT (interpret short/incomplete Egyptian replies using this):',
      '- collecting_order: ' + collectingOrder,
      '- order_step: ' + (orderStep || 'idle'),
      '- session_phase: ' + (sessionPhase || 'chatting')
    ];
    if (orderData.name) lines.push('- order_name: ' + orderData.name);
    if (orderData.phone) lines.push('- order_phone: ' + orderData.phone);
    if (orderData.address) lines.push('- order_address: ' + orderData.address);
    if (orderData.items && orderData.items.length) {
      lines.push('- order_products: ' + orderData.items.map(function (i) { return i.name; }).join(', '));
    }
    if (lastBot) {
      lines.push('- last_bot_message: "' + lastBot.slice(0, 500).replace(/"/g, '\'') + '"');
    }
    if (suggestedName) lines.push('- suggested_product: ' + suggestedName);
    if (sessionSuggestedProducts.length) {
      lines.push('- suggested_products: ' + sessionSuggestedProducts.map(function (p) {
        return lang === 'en' ? p.nameEn : p.nameAr;
      }).join(', '));
    }
    if (sessionLastConcern) lines.push('- last_skin_concern: ' + sessionLastConcern);
    if (sessionSuggestedProducts.length) {
      lines.push(lang === 'en'
        ? '- Customer may agree briefly (yes, ok, sure) or say «I want to order» → action=start_order with ALL suggested_products in product_names. NEVER ask «would you like to order».'
        : '- لو قالت ايوه/تمام/يريت/عايز أطلب → action=start_order وكل suggested_products في product_names. ممنوع تسألي «عايزة نعمل أوردر».');
    }
    lines.push(lang === 'en'
      ? '- Infer intent from FULL conversation history. Incomplete or misspelled Egyptian Arabic is normal.'
      : '- افهمي النية من المحادثة كلها. المصري الناقص أو المختصر أو بألفات مختلفة (يريت/ياريت) طبيعي — متوقّعيش جمل كاملة.');
    return lines.join('\n');
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
      buildSessionContextBlock(lang),
      '',
      'Return JSON only. Understand intent from full conversation context.',
      '',
      'ORDER (customer initiates — NEVER ask «عايزة نعمل أوردر» or «would you like to order»):',
      '- start_order / update_order: collect name → phone (11 digits) → address in chat when customer says they want to order or agrees (ايوه/تمام/يريت/عايز أطلب).',
      '- product_names: include ALL suggested products from the conversation when customer agrees.',
      '- confirm_ready: only when name + valid 11-digit phone + real address + products.',
      '- cancel_order: الغي / مش عايز / cancel.',
      '- Phone MUST be exactly 11 digits (010/011/012/015). Never use a question as address.',
      '- For skin advice and product questions → action=chat only.',
      '',
      'Rules:',
      '1. Reply in customer language — warm Egyptian Arabic, natural and concise.',
      '2. Recommend products with prices. Never push ordering — customer decides.',
      '3. Multiple concerns → recommend multiple products, track all in product_names.',
      '4. Thanks after order → action=thanks.',
      '5. Never invent products or prices.',
      window.MontanaChatKnowledge ? MontanaChatKnowledge.aiKnowledgeBlock(lang, getProducts()) : ''
    ].join('\n');
  }

  function sanitizePhone(raw) {
    var v = validateEgyptPhone(raw);
    return v.ok ? v.phone : '';
  }

  function validateEgyptPhone(raw, lang) {
    lang = lang || sessionLang;
    var digits = String(raw || '').replace(/\D/g, '');
    if (digits.indexOf('20') === 0 && digits.length >= 12) {
      digits = '0' + digits.slice(2);
    }
    if (digits.length === 10 && digits.charAt(0) === '1') {
      digits = '0' + digits;
    }
    if (!digits.length) {
      return {
        ok: false,
        message: lang === 'en'
          ? 'Please send your mobile number (11 digits, e.g. 01012345678).'
          : 'محتاجة رقم الموبايل — 11 رقم (زي 01012345678).'
      };
    }
    if (digits.length < 11) {
      return {
        ok: false,
        message: lang === 'en'
          ? 'Number is incomplete — Egyptian mobile must be 11 digits (you sent ' + digits.length + '). Example: 01012345678.'
          : 'الرقم ناقص — لازم 11 رقم مصري (انتي بعتتي ' + digits.length + '). مثال: 01012345678.'
      };
    }
    if (digits.length > 11) {
      return {
        ok: false,
        message: lang === 'en'
          ? 'Number is too long — must be exactly 11 digits (01xxxxxxxxx).'
          : 'الرقم أطول من اللازم — لازم 11 رقم بالظبط (01xxxxxxxxx).'
      };
    }
    if (!/^01[0125]\d{8}$/.test(digits)) {
      return {
        ok: false,
        message: lang === 'en'
          ? 'Invalid Egyptian mobile — must start with 010, 011, 012, or 015.'
          : 'رقم مصري مش صح — لازم يبدأ بـ 010 أو 011 أو 012 أو 015.'
      };
    }
    return { ok: true, phone: digits };
  }

  function looksLikePhoneAttempt(text) {
    var digits = String(text || '').replace(/\D/g, '');
    return digits.length >= 7;
  }

  function enforceOrderBrain(brain, lang, userText, intent) {
    if (!brain || !brain.reply) return null;
    intent = intent || getIntent(userText || '');
    var action = brain.action || 'chat';
    if (action === 'open_order') action = brain.action = 'start_order';
    var o = brain.order || {};
    var t = String(userText || '').trim();

    if (action === 'cancel_order') return brain;

    var inOrder = action === 'start_order' || action === 'update_order' ||
      action === 'confirm_ready' || collectingOrder;
    if (!inOrder) return brain;

    if (o.product_names && o.product_names.length) {
      var resolved = resolveProducts(o.product_names);
      if (resolved.length) {
        brain.order.product_names = resolved.map(function (i) { return i.name; });
      }
    } else if (sessionSuggestedProducts.length) {
      brain.order = brain.order || {};
      brain.order.product_names = sessionSuggestedProducts.map(function (p) { return p.nameAr; });
    }

    var step = orderStep || o.step || 'idle';

    if (step === 'name' && looksLikePersonName(t, intent)) {
      orderData.name = t;
      return {
        reply: lang === 'en'
          ? 'Thanks ' + t + '! What\'s your phone number? (11 digits)'
          : 'تسلمي يا ' + t + '! 💜 رقم الموبايل؟ (11 رقم)',
        action: 'update_order',
        order: { step: 'phone', name: t, product_names: (orderData.items || []).map(function (i) { return i.name; }) }
      };
    }

    if ((step === 'phone' || looksLikePhoneAttempt(t)) && !looksLikeAddress(t)) {
      var phCheck = validateEgyptPhone(looksLikePhoneAttempt(t) ? t : (o.phone || orderData.phone), lang);
      if (!phCheck.ok) {
        return {
          reply: phCheck.message,
          action: 'update_order',
          order: { step: 'phone', name: orderData.name || o.name || '', product_names: (orderData.items || []).map(function (i) { return i.name; }) }
        };
      }
      orderData.phone = phCheck.phone;
      brain.order = brain.order || {};
      brain.order.phone = phCheck.phone;
      if (step === 'phone' && looksLikePhoneAttempt(t)) {
        return {
          reply: lang === 'en'
            ? 'Got it. Delivery address? (city, area, street)'
            : 'تمام. العنوان فين يا جميلة؟ (محافظة + منطقة + شارع)',
          action: 'update_order',
          order: { step: 'address', name: orderData.name, phone: phCheck.phone, product_names: (orderData.items || []).map(function (i) { return i.name; }) }
        };
      }
    }

    if (step === 'address' && t && !looksLikePhoneAttempt(t)) {
      if (isOrderProductQuestion(t) || !orderHasItems()) {
        return {
          reply: lang === 'en' ? 'Which product(s) would you like?' : 'قوليلي عايزة إيه من منتجاتنا؟',
          action: 'update_order',
          order: { step: 'product', name: orderData.name || '', phone: orderData.phone || '', product_names: [] }
        };
      }
      if (!looksLikeAddress(t)) {
        return {
          reply: lang === 'en'
            ? 'Please send your full address (governorate + area + street).'
            : 'محتاجة العنوان كامل (محافظة + منطقة + شارع).',
          action: 'update_order',
          order: {
            step: 'address',
            name: orderData.name || '',
            phone: orderData.phone || '',
            product_names: (orderData.items || []).map(function (i) { return i.name; })
          }
        };
      }
      orderData.address = t;
      var phoneReady = validateEgyptPhone(orderData.phone, lang);
      if (orderData.name && phoneReady.ok && orderHasItems()) {
        return {
          reply: lang === 'en' ? 'Perfect! Confirm your order below.' : 'كده تمام يا حبيبتي! 💜 أكّدي الأوردر من تحت.',
          action: 'confirm_ready',
          order: {
            step: 'ready',
            name: orderData.name,
            phone: orderData.phone,
            address: t,
            product_names: orderData.items.map(function (i) { return i.name; })
          }
        };
      }
    }

    if (action === 'confirm_ready' || o.step === 'ready') {
      var phoneReady = validateEgyptPhone(orderData.phone || o.phone || '', lang);
      var addrText = orderData.address || o.address || '';
      if (!orderHasItems()) {
        return buildProductPickerReply(lang, 'update_order');
      }
      if (!phoneReady.ok) {
        return {
          reply: phoneReady.message,
          action: 'update_order',
          order: { step: 'phone', name: orderData.name || o.name || '', product_names: (orderData.items || []).map(function (i) { return i.name; }) }
        };
      }
      if (!orderData.name && !o.name) {
        return {
          reply: lang === 'en' ? 'What name for the order?' : 'اسمك إيه؟',
          action: 'update_order',
          order: { step: 'name', product_names: (orderData.items || []).map(function (i) { return i.name; }) }
        };
      }
      if (!addrText || !looksLikeAddress(addrText)) {
        return {
          reply: lang === 'en' ? 'Delivery address? (city, area, street)' : 'العنوان فين؟ (محافظة + منطقة + شارع)',
          action: 'update_order',
          order: { step: 'address', name: orderData.name, phone: phoneReady.phone, product_names: (orderData.items || []).map(function (i) { return i.name; }) }
        };
      }
    }

    return brain;
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

  function rememberSuggestedProduct(product) {
    if (!product) return;
    sessionSuggestedProduct = product;
    if (!sessionSuggestedProducts.some(function (p) { return p.id === product.id; })) {
      sessionSuggestedProducts.push(product);
    }
  }

  function rememberSuggestedProducts(products) {
    (products || []).forEach(function (p) { rememberSuggestedProduct(p); });
  }

  function markOrderOffer(product) {
    rememberSuggestedProduct(product);
  }

  function markOrderOffers(products) {
    rememberSuggestedProducts(products);
  }

  function clearOrderOfferSession() {
    sessionBotOfferedOrder = false;
    sessionSuggestedProduct = null;
    sessionSuggestedProducts = [];
  }

  function extractProductsFromReply(text) {
    var prods = getProducts().slice().sort(function (a, b) {
      return (b.nameAr || '').length - (a.nameAr || '').length;
    });
    var found = [];
    var seen = {};
    var t = String(text || '');
    prods.forEach(function (p) {
      if (seen[p.id]) return;
      if (t.indexOf(p.nameAr) > -1 || t.indexOf(p.nameEn) > -1) {
        seen[p.id] = true;
        found.push(p);
      }
    });
    return found;
  }

  function getSessionOrderProducts() {
    return sessionSuggestedProducts.slice();
  }

  function noteProductsFromReply(text) {
    extractProductsFromReply(text).forEach(function (p) { rememberSuggestedProduct(p); });
  }

  function tryStartOrderBrain(userText, lang, intent) {
    if (collectingOrder) return null;
    intent = intent || getIntent(userText);
    if (isBrowsingQuestion(intent, userText)) return null;
    var wants = wantsToOrder(userText) || (intent.isAffirm && sessionSuggestedProducts.length);
    if (!wants) return null;
    var picked = getSessionOrderProducts();
    if (!picked.length) {
      return {
        reply: lang === 'en'
          ? 'Tell me your skin concern or which Montana products you want — then say «I want to order».'
          : 'قوليلي مشكلة بشرتك أو إيه المنتجات اللي عايزاها — وبعدين قولي «عايز أطلب».',
        action: 'chat',
        order: { step: 'idle', product_names: [] }
      };
    }
    return beginOrderFromProducts(picked, lang, 'start_order');
  }

  function noteSuggestedFromBrain(brain) {
    if (!brain || !brain.reply) return;
    noteProductsFromReply(brain.reply);
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
    if (/[؟?]/.test(t)) return false;
    if (isOrderProductQuestion(t)) return false;
    if (intent.wantsOrder || intent.isAffirm || intent.isGreeting || intent.isThanks || intent.isGoodbye) return false;
    if (matchProductFromText(t) || isThanks(t)) return false;
    return true;
  }

  function isOrderProductQuestion(text) {
    var norm = window.MontanaChatIntent ? MontanaChatIntent.normalizeText(text) : String(text || '').toLowerCase();
    return /هطلب\s*ايه|اطلب\s*ايه|ايه\s*المنتج|ايه\s*اطلب|مش\s*تعرف|مش\s*عارف|محددتش|مختار|اختر|اختار|عايز\s*ايه|عايزه\s*ايه|which\s*product|what\s*.*order|what\s*should\s*i\s*order|dont\s*you\s*know/i.test(norm);
  }

  function looksLikeAddress(text) {
    var t = String(text || '').trim();
    if (t.length < 10) return false;
    if (/[؟?]/.test(t)) return false;
    if (isOrderProductQuestion(t)) return false;
    var norm = window.MontanaChatIntent ? MontanaChatIntent.normalizeText(t) : t.toLowerCase();
    if (/^(مش|ما|ليه|ازاي|كيف|ايه|مين|هطلب|تعرف|تعرفي|محدد|اختار|اختر|لاليه)/.test(norm)) return false;
    if (/هطلب|اطلب|منتج|تطلب|which product|what to order/.test(norm)) return false;
    if (/شارع|street|ش\.|عمارة|عماره|دور|منطقة|منطقه|حي|مدينة|محافظ|اسوان|أسوان|القاهره|القاهرة|القاهرا|الجيزه|الجيزة|الجيزا|الاسكندر|cairo|giza|alex|october|زمالك|مدين|nasr|tagamo|شبرا|المعادي|التجمع|6\s*october/i.test(t)) return true;
    return t.length >= 14 && !/[؟?]/.test(t) && t.split(/\s+/).filter(Boolean).length >= 2;
  }

  function orderHasItems() {
    return !!(orderData.items && orderData.items.length);
  }

  function productsFromRecommendedInChat() {
    var found = [];
    var seen = {};
    var prods = getProducts();
    function push(p) {
      if (p && !seen[p.id]) { seen[p.id] = true; found.push(p); }
    }
    sessionSuggestedProducts.forEach(push);
    for (var i = history.length - 1; i >= 0 && i >= history.length - 14; i--) {
      var h = history[i];
      if (h.role !== 'model') continue;
      var text = h.parts[0].text || '';
      if (/منتجات Montana|كل منتجات|Montana collection|Our Montana collection/i.test(text)) continue;
      if (!/جنيه|EGP|السعر|عايزة نعمل أوردر|Would you like to place/i.test(text)) continue;
      matchAllProductsFromText(text).forEach(push);
      prods.forEach(function (p) {
        if (text.indexOf(p.nameAr) > -1 || text.indexOf(p.nameEn) > -1) push(p);
      });
    }
    return found;
  }

  function resolveStartOrderProducts(text, offeredOrder) {
    var fromText = matchAllProductsFromText(text);
    if (fromText.length) return fromText;
    if (sessionSuggestedProducts.length) return sessionSuggestedProducts.slice();
    if (offeredOrder) {
      var fromRecs = productsFromRecommendedInChat();
      if (fromRecs.length) return fromRecs;
      if (sessionSuggestedProduct) return [sessionSuggestedProduct];
    }
    return [];
  }

  function localScarBrain(userText, lang, intent) {
    if (collectingOrder) return null;
    intent = intent || getIntent(userText);
    var norm = intent.norm || '';
    if (!/ندوب|ندبات|ندبه|بالنسبه|بالنسبة|\bscar\b/i.test(norm)) return null;
    if (intent.concern === 'acne' && !/ندوب|ندبات|ندبه|بالنسبه/i.test(norm)) return null;
    var prods = getProducts();
    var scarP = prods.find(function (p) { return p.id === 'anti-scar'; });
    if (!scarP || !window.MontanaChatKnowledge) return null;
    markOrderOffer(scarP);
    var reply = MontanaChatKnowledge.buildConsultationReply('scar', lang, prods, norm) ||
      MontanaChatKnowledge.buildProductExpertReply(scarP, lang, { offerOrder: false });
    return {
      reply: reply,
      action: 'chat',
      order: { step: orderStep || 'idle', product_names: [scarP.nameAr] }
    };
  }

  function buildProductPickerReply(lang, action) {
    action = action || 'start_order';
    var prods = getProducts();
    var list = prods.map(function (p) {
      return lang === 'en'
        ? '• ' + p.nameEn + ' — ' + p.price + ' EGP'
        : '• ' + p.nameAr + ' — ' + p.price + ' جنيه';
    }).join('\n');
    return {
      reply: lang === 'en'
        ? 'Sure! Which Montana product would you like?\n\n' + list + '\n\nTell me the product name or your skin concern.'
        : 'تمام حبيبتي! 💜 عايزة إيه من منتجات Montana؟\n\n' + list + '\n\nقوليلي اسم المنتج أو مشكلة بشرتك.',
      action: action,
      order: { step: 'product', product_names: [] }
    };
  }

  function beginOrderFromProducts(picked, lang, action) {
    action = action || 'start_order';
    collectingOrder = true;
    sessionPhase = 'ordering';
    if (!orderData.items) orderData.items = [];
    if (picked.length) {
      orderData.items = resolveProducts(picked.map(function (p) { return p.nameAr; }));
      orderStep = 'name';
      var list = productNamesList(picked, lang);
      return {
        reply: picked.length > 1
          ? (lang === 'en'
            ? 'Perfect! Added: ' + list + '. What name for the order?'
            : 'تمام حبيبتي! 💜 ضفنا: ' + list + '. اسمك إيه؟')
          : (lang === 'en'
            ? 'Great! Added ' + list + '. What name should we put on the order?'
            : 'تمام! 💜 ضفنا ' + list + '. اسمك إيه عشان نسجل الأوردر؟'),
        action: action,
        order: { step: 'name', product_names: (orderData.items || []).map(function (i) { return i.name; }) }
      };
    }
    orderStep = 'product';
    return buildProductPickerReply(lang, action);
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
            ? priceProd.nameEn + ' is ' + priceProd.price + ' EGP — ' + priceProd.sizeEn + '.'
            : priceProd.nameAr + ' سعره ' + priceProd.price + ' جنيه — ' + priceProd.size + '.',
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
          reply: K.buildProductExpertReply(ctxProd, lang, { usage: intent.isUsage, offerOrder: false }),
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
        reply: ingReply,
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
        reply: K.buildProductExpertReply(product, lang, { usage: true, offerOrder: false }),
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

    if (!collectingOrder && !isBrowsingQuestion(intent, t)) {
      if (wantsToOrder(t) || (intent.isAffirm && sessionSuggestedProducts.length)) {
        return beginOrderFromProducts(getSessionOrderProducts(), lang, 'start_order');
      }
    }

    if (!collectingOrder) return null;

    if (isBrowsingQuestion(intent, t) && orderStep !== 'product') return null;

    if (orderStep === 'product') {
      if (isOrderProductQuestion(t) || intent.isCatalog) {
        return buildProductPickerReply(lang, 'update_order');
      }
      var productPick = matchAllProductsFromText(t);
      if (!productPick.length && intent.concern) {
        var concernProd = matchProductFromConcern(intent.concern, intent.norm || '');
        if (concernProd) productPick = [concernProd];
      }
      if (productPick.length) {
        orderData.items = mergeOrderItems(resolveProducts(productPick.map(function (p) { return p.nameAr; })));
        orderStep = orderData.name ? (orderData.phone ? (orderData.address ? 'ready' : 'address') : 'phone') : 'name';
        if (orderStep === 'name') {
          return {
            reply: lang === 'en'
              ? 'Added: ' + productNamesList(productPick, lang) + '. What name for the order?'
              : 'تمام! 💜 ضفنا: ' + productNamesList(productPick, lang) + '. اسمك إيه؟',
            action: 'update_order',
            order: { step: 'name', product_names: orderData.items.map(function (i) { return i.name; }) }
          };
        }
        if (orderStep === 'phone') {
          return {
            reply: lang === 'en'
              ? 'Added: ' + productNamesList(productPick, lang) + '. What\'s your phone number?'
              : 'تمام! 💜 ضفنا: ' + productNamesList(productPick, lang) + '. رقم التليفون؟',
            action: 'update_order',
            order: { step: 'phone', name: orderData.name, product_names: orderData.items.map(function (i) { return i.name; }) }
          };
        }
        if (orderStep === 'address') {
          return {
            reply: lang === 'en'
              ? 'Added: ' + productNamesList(productPick, lang) + '. Delivery address? (city, area, street)'
              : 'تمام! 💜 ضفنا: ' + productNamesList(productPick, lang) + '. العنوان فين؟ (محافظة + منطقة + شارع)',
            action: 'update_order',
            order: { step: 'address', name: orderData.name, phone: orderData.phone, product_names: orderData.items.map(function (i) { return i.name; }) }
          };
        }
      }
      return buildProductPickerReply(lang, 'update_order');
    }

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
        if (!orderHasItems()) {
          orderStep = 'product';
          return {
            reply: lang === 'en'
              ? 'Thanks ' + orderData.name + '! Which product would you like?'
              : 'تسلمي يا ' + orderData.name + '! 💜 قوليلي الأول عايزة إيه من منتجاتنا؟',
            action: 'update_order',
            order: { step: 'product', name: orderData.name, product_names: [] }
          };
        }
        orderStep = 'phone';
        return {
          reply: lang === 'en'
            ? 'Thanks ' + orderData.name + '! What\'s your phone number?'
            : 'تسلمي يا ' + orderData.name + '! 💜 رقم التليفون؟',
          action: 'update_order',
          order: { step: 'phone', name: orderData.name, product_names: orderData.items.map(function (i) { return i.name; }) }
        };
      }
      return {
        reply: lang === 'en' ? 'Please tell me your name (first and last).' : 'محتاجة اسمك يا حبيبتي — الاسم الأول واسم العيلة.',
        action: 'update_order',
        order: { step: 'name', product_names: (orderData.items || []).map(function (i) { return i.name; }) }
      };
    }

    if (orderStep === 'phone') {
      var phResult = validateEgyptPhone(t, lang);
      if (phResult.ok) {
        orderData.phone = phResult.phone;
        if (!orderHasItems()) {
          orderStep = 'product';
          return {
            reply: lang === 'en'
              ? 'Got it. Which product would you like first?'
              : 'تمام. 💜 قوليلي الأول عايزة إيه من منتجاتنا؟',
            action: 'update_order',
            order: { step: 'product', name: orderData.name, phone: orderData.phone, product_names: [] }
          };
        }
        orderStep = 'address';
        return {
          reply: lang === 'en'
            ? 'Got it. Delivery address? (city, area, street)'
            : 'تمام. العنوان فين يا جميلة؟ (محافظة + منطقة + شارع)',
          action: 'update_order',
          order: { step: 'address', name: orderData.name, phone: orderData.phone, product_names: orderData.items.map(function (i) { return i.name; }) }
        };
      }
      return {
        reply: phResult.message,
        action: 'update_order',
        order: { step: 'phone', name: orderData.name || '', product_names: (orderData.items || []).map(function (i) { return i.name; }) }
      };
    }

    if (orderStep === 'address') {
      if (isOrderProductQuestion(t) || !orderHasItems()) {
        orderStep = 'product';
        orderData.address = '';
        return {
          reply: lang === 'en'
            ? 'You\'re right! Which product would you like first?'
            : 'عندك حق! 😅 قوليلي الأول عايزة إيه من منتجاتنا؟',
          action: 'update_order',
          order: { step: 'product', product_names: [] }
        };
      }
      if (looksLikeAddress(t)) {
        orderData.address = t;
        orderStep = 'ready';
        if (orderData.name && orderData.phone && orderHasItems()) {
          return {
            reply: lang === 'en' ? 'Perfect! Confirm your order below.' : 'كده تمام يا حبيبتي! 💜 أكّدي الأوردر من تحت.',
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
        orderStep = 'product';
        return buildProductPickerReply(lang, 'update_order');
      }
      return {
        reply: lang === 'en'
          ? 'Please send your full address (city, area, street).'
          : 'محتاجة العنوان كامل (محافظة + منطقة + شارع).',
        action: 'update_order',
        order: { step: 'address', product_names: orderData.items.map(function (i) { return i.name; }) }
      };
    }

    return null;
  }

  function localDefaultBrain(lang, intent, userText) {
    intent = intent || getIntent(userText || '');
    if (intent.isGoodbye) {
      return localGoodbyeBrain(userText || '', lang, intent);
    }
    if (intent.isAffirm && sessionSuggestedProducts.length) {
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
        reply: product.nameAr + ' سعره ' + product.price + ' جنيه — ' + product.size + '.',
        action: 'chat',
        order: { step: orderStep || 'idle', product_names: names }
      };
    }
    if (lang === 'en') {
      markOrderOffer(product);
      return {
        reply: (window.MontanaChatKnowledge
          ? MontanaChatKnowledge.buildProductExpertReply(product, lang, { offerOrder: false })
          : recommendIntro(t, 'en', product) + '\n\n' + product.descEn + '\n\nPrice: ' + product.price + ' EGP.'),
        action: 'chat',
        order: { step: orderStep || 'idle', product_names: names }
      };
    }
    markOrderOffer(product);
    return {
      reply: (window.MontanaChatKnowledge
        ? MontanaChatKnowledge.buildProductExpertReply(product, lang, { offerOrder: false })
        : recommendIntro(t, 'ar', product) + '\n\n' + product.desc + '\n\nسعره ' + product.price + ' جنيه.'),
      action: 'chat',
      order: { step: orderStep || 'idle', product_names: names }
    };
  }

  async function think(userText, opts) {
    opts = opts || {};
    var lang = detectLang(userText || (opts.images ? 'صورة' : ''));
    var intent = getIntent(userText);

    if (collectingOrder && CANCEL_ORDER.test(userText)) {
      return {
        ok: true,
        brain: {
          reply: lang === 'en' ? 'No problem — order cancelled.' : 'تمام يا حبيبتي، الأوردر اتلغى.',
          action: 'cancel_order',
          order: { step: 'idle', product_names: [] }
        },
        fallback: true
      };
    }

    if (collectingOrder && (orderStep === 'product' || orderStep === 'name' ||
        orderStep === 'phone' || orderStep === 'address')) {
      var stepBrain = localOrderBrain(userText, lang, intent);
      if (stepBrain) {
        return { ok: true, brain: enforceOrderBrain(stepBrain, lang, userText, intent), fallback: true };
      }
    }

    if (!collectingOrder) {
      var quick = localGreetingBrain(userText, lang, intent) ||
        localGoodbyeBrain(userText, lang, intent);
      if (quick && !(opts.images && opts.images.length)) return { ok: true, brain: quick, fallback: true };

      if (isThanks(userText)) {
        return { ok: true, brain: { reply: t(lang).thanksReply, action: 'thanks', order: { step: 'idle', product_names: [] } }, fallback: true };
      }

      var orderStart = tryStartOrderBrain(userText, lang, intent);
      if (orderStart) {
        return { ok: true, brain: enforceOrderBrain(orderStart, lang, userText, intent), fallback: true };
      }
    }

    if (await useChatAi()) {
      try {
        var aiBrain = await callConsultAi(userText, lang, opts);
        if (aiBrain && aiBrain.reply) return { ok: true, brain: aiBrain };
      } catch (e) { /* fallback */ }
    }

    var localConsult = localPhraseBrain(userText, lang, intent) ||
      localKnowledgeBrain(userText, lang, intent) ||
      localCatalogBrain(userText, lang, intent);
    if (localConsult) return { ok: true, brain: localConsult, fallback: true };

    var orderFallback = localOrderBrain(userText, lang, intent);
    if (orderFallback) {
      var enforcedFb = enforceOrderBrain(orderFallback, lang, userText, intent);
      if (enforcedFb) return { ok: true, brain: enforcedFb, fallback: true };
    }

    if (window.MontanaChatKnowledge) {
      var fb = localDefaultBrain(lang, intent, userText);
      if (fb) return { ok: true, brain: fb, fallback: true };
    }
    return { ok: true, brain: { reply: t(lang).noUnderstand, action: 'chat', order: { step: 'idle', product_names: [] } }, fallback: true };
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

    if (action === 'open_order') action = 'start_order';

    if (action === 'start_order' || action === 'update_order' || action === 'confirm_ready') {
      collectingOrder = true;
      sessionPhase = 'ordering';

      if (o.name && looksLikePersonName(String(o.name), getIntent(String(o.name)))) {
        orderData.name = String(o.name).trim();
      }
      if (o.phone) {
        var phResult = validateEgyptPhone(o.phone, sessionLang);
        if (phResult.ok) orderData.phone = phResult.phone;
      }
      if (o.address && looksLikeAddress(o.address) && !isOrderProductQuestion(o.address)) {
        orderData.address = String(o.address).trim();
      }

      if (action === 'start_order' && orderData.items && orderData.items.length) {
        /* beginOrderFromProducts already set items from session */
      } else if (action === 'start_order' && sessionSuggestedProducts.length) {
        orderData.items = resolveProducts(sessionSuggestedProducts.map(function (p) { return p.nameAr; }));
      } else if (o.product_names && o.product_names.length) {
        var resolved = resolveProducts(o.product_names);
        if (resolved.length) {
          orderData.items = (action === 'update_order' && orderHasItems())
            ? mergeOrderItems(resolved)
            : resolved;
        }
      } else if (!orderData.items || !orderData.items.length) {
        if (sessionSuggestedProducts.length) {
          orderData.items = resolveProducts(sessionSuggestedProducts.map(function (p) { return p.nameAr; }));
        } else if (sessionSuggestedProduct) {
          orderData.items = resolveProducts([sessionSuggestedProduct.nameAr]);
        }
      }

      if (o.step && o.step !== 'idle') orderStep = o.step;
      else if (!orderHasItems()) orderStep = 'product';
      else if (orderData.address && orderData.phone && orderData.name) orderStep = 'ready';
      else if (orderData.phone && orderData.name) orderStep = 'address';
      else if (orderData.name) orderStep = 'phone';
      else orderStep = 'name';
    }

    if (action === 'confirm_ready' || o.step === 'ready') {
      var phoneCheck = validateEgyptPhone(orderData.phone, sessionLang);
      if (orderData.name && phoneCheck.ok && orderData.address && looksLikeAddress(orderData.address) && orderHasItems()) {
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

  async function processWithAI(payload) {
    var text = typeof payload === 'string' ? payload : (payload && payload.text) || '';
    var images = payload && payload.images ? payload.images : null;
    sessionLang = detectLang(text || (images ? 'صورة' : ''));
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
        think(text, { images: images }),
        sleep(thinkDelay(text || 'photo'))
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

      noteSuggestedFromBrain(brain);
      pushHistory('user', text);

      var replyProduct = sessionSuggestedProduct || matchProductFromText(text);
      rememberSessionContext(intent, replyProduct);

      var reply = polishReply(brain.reply, sessionLang, intent, {
        isOrderStep: collectingOrder,
        skipPolish: brain.skipPolish || !!(intent.wantsOrder && matchProductFromText(text))
      });
      delete brain.skipPolish;
      noteProductsFromReply(reply);
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

  async function enqueueMessage(payload) {
    if (typeof payload === 'string') payload = { text: payload };
    messageQueue.push(payload);
    await drainMessageQueue();
  }

  async function processMessage(payload) {
    var text = typeof payload === 'string' ? payload : (payload && payload.text) || '';
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
    await enqueueMessage(typeof payload === 'string' ? { text: payload } : payload);
  }

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
        showToastAttach(sessionLang === 'en' ? 'Image max 4MB' : 'الصورة لازم تكون أقل من ٤ ميجا');
        return;
      }
      var reader = new FileReader();
      reader.onload = function () {
        pendingChatImage = {
          mimeType: f.type || 'image/jpeg',
          data: String(reader.result || '')
        };
        showImagePreview(pendingChatImage.data);
      };
      reader.readAsDataURL(f);
    });
  }

  function showToastAttach(msg) {
    var input = document.getElementById('chat-input');
    if (!input) return;
    var old = input.getAttribute('placeholder');
    input.setAttribute('placeholder', msg);
    setTimeout(function () { input.setAttribute('placeholder', old || t(sessionLang).placeholder); }, 2500);
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
    bindImageAttach();
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

  function showOrderConfirm() {
    var strings = t(sessionLang);
    var esc = window.MontanaChatOrders ? MontanaChatOrders.esc : function (s) { return s; };
    if (!orderHasItems()) {
      orderStep = 'product';
      collectingOrder = true;
      var pick = buildProductPickerReply(sessionLang, 'update_order');
      typeBotMessage(pick.reply, { skipThink: true, skipPolish: true });
      return;
    }
    var total = orderData.items.reduce(function (s, i) { return s + i.price * i.qty; }, 0);
    pendingOrder = Object.assign({}, orderData);
    pendingDepositProof = false;
    pendingDepositApproved = false;
    if (depositApprovalWaiter) {
      depositApprovalWaiter.cancel();
      depositApprovalWaiter = null;
    }

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
          image: dataUrl,
          source: 'chat',
          name: orderData.name,
          phone: orderData.phone,
          address: orderData.address,
          itemsSummary: MontanaDeposit.itemsSummary(orderData.items, sessionLang),
          total: total
        });
        pendingDepositProof = true;
        if (pendingOrder) {
          pendingOrder.depositProofSent = true;
          pendingOrder.proofId = uploadResult.proofId;
        }
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
          statusEl.textContent = waitErr && waitErr.message === 'approval_timeout'
            ? strings.depositTimeout
            : strings.depositNotApproved;
          statusEl.style.color = '#F87171';
          uploadBtn.disabled = false;
          pendingDepositProof = false;
        }
      } catch (e) {
        statusEl.textContent = (e && e.message && e.message !== 'upload_failed')
          ? e.message
          : strings.depositFailed;
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

  async function confirmOrder() {
    if (!pendingOrder || isBotBusy) return;
    var strings = t(sessionLang);
    if (!pendingDepositApproved && !(pendingOrder && pendingOrder.depositApproved)) {
      await typeBotMessage(
        pendingDepositProof ? strings.depositNotApproved : strings.depositRequired,
        { skipThink: true, skipPolish: true }
      );
      return;
    }
    document.querySelectorAll('.order-confirm').forEach(function (el) { el.remove(); });
    await typeBotMessage(strings.saving, { skipThink: true, thinkMs: 900, skipPolish: true });

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
        id: orderId,
        name: pendingOrder.name,
        phone: pendingOrder.phone,
        address: pendingOrder.address,
        items: pendingOrder.items.slice()
      };
      sessionPhase = 'post_order';
      pendingOrder = null;
      pendingDepositProof = false;
      pendingDepositApproved = false;
      if (depositApprovalWaiter) {
        depositApprovalWaiter.cancel();
        depositApprovalWaiter = null;
      }
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
    pendingDepositProof = false;
    pendingDepositApproved = false;
    if (depositApprovalWaiter) {
      depositApprovalWaiter.cancel();
      depositApprovalWaiter = null;
    }
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
