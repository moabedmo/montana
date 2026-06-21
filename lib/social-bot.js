'use strict';

const { getSupabase } = require('./supabase');

var SITE_URL = String(process.env.SITE_URL || process.env.VERCEL_URL || 'https://montana-skincare.com').replace(/\/+$/, '');
if (SITE_URL.indexOf('http') !== 0) SITE_URL = 'https://' + SITE_URL;

const PRODUCTS = [
  {
    id: 'acne-cleanser',
    nameAr: 'غسول مونتانيا لعلاج حب الشباب للوجه',
    nameEn: 'Montaña Acne Facial Cleanser',
    price: 450,
    size: '200 ml',
    category: { ar: 'الوجه', en: 'Face' },
    descAr: 'أول تركيبة غسول كريمية في مصر تساعد على الوقاية من جفاف البشرة والالتهابات.',
    descEn: 'First Creamy Cleanser Formula in Egypt that Prevents Dehydration and Inflammation.',
    forAr: 'البشرة المختلطة إلى الدهنية · الرؤوس السوداء · الرؤوس البيضاء · حب الشباب الخفيف',
    forEn: 'Combined to Oily skin · Blackheads · Whiteheads · Mild acne',
    ingredientsAr: 'حمض الساليسيليك، زنك PCA، النياسيناميد، زيت الأرجان، زيت الزيتون، زيت الجوجوبا',
    ingredientsEn: 'Salicylic Acid, Zinc PCA, Niacinamide, Argan Oil, Olive Oil, Jojoba Oil',
    usageAr: 'يوضع على بشرة مبللة، ويُدلك بلطف ثم يُشطف بالماء. مرتين يوميًا.',
    usageEn: 'Apply to wet skin, gently rub, rinse with water. Twice daily.',
    quoteAr: 'بشرة أكثر صفاءً خلال 14 يومًا',
    quoteEn: 'Clear skin in 14 days'
  },
  {
    id: 'whitening-cleanser',
    nameAr: 'غسول مونتانيا للتفتيح',
    nameEn: 'Montaña Whitening Cleanser',
    price: 480,
    size: '200 ml',
    category: { ar: 'الوجه', en: 'Face' },
    descAr: 'لما البهتان يسرق إشراقتك، وبشرتك تستنى ترجع تتنفس من جديد.',
    descEn: 'When dullness hides your natural glow, and your skin is ready to be revealed.',
    forAr: 'البقع الداكنة · عدم توحّد لون البشرة · البشرة الباهتة · آثار ما بعد حب الشباب',
    forEn: 'Dark spots · Uneven tone · Dull skin · Post-acne marks',
    ingredientsAr: 'مستخلص العرقسوس، النياسيناميد، حمض الساليسيليك، زيت شجرة الشاي، زنك PCA، فيتامين C، زيت جنين القمح، زيت اللوز',
    ingredientsEn: 'Licorice Extract, Niacinamide, Salicylic Acid, Tea Tree Oil, Zinc PCA, Vitamin C, Wheat Germ Oil, Almond Oil',
    usageAr: 'ضعي كمية مناسبة على البشرة المبللة، ودلّكي بلطف ثم اشطفي. مرتين يوميًا.',
    usageEn: 'Apply to wet skin, massage gently, rinse. Twice daily.',
    quoteAr: 'غسول بيرجع لبشرتك إشراقتها',
    quoteEn: 'Reveals your natural glow'
  },
  {
    id: 'whitening-cream',
    nameAr: 'كريم مونتانا للتفتيح',
    nameEn: 'Montaña Whitening Cream',
    price: 520,
    size: '50 ml',
    category: { ar: 'الوجه والجسم', en: 'Face & Body' },
    descAr: 'يمنع إنتاج الميلانين الزائد ويوحّد لون البشرة.',
    descEn: 'Blocks excess melanin production and evens skin tone.',
    forAr: 'الكلف · آثار الحبوب · تفاوت لون البشرة · اسمرار تحت الإبط · المناطق الحساسة · تصبغات الجسم',
    forEn: 'Melasma · Acne marks · Uneven tone · Dark underarms · Sensitive areas · Body pigmentation',
    ingredientsAr: 'ألفا أربوتين، مستخلص العرقسوس، نياسيناميد، حمض اللاكتيك، أكسيد الزنك، فيتامين C، فيتامين E، زيت الورد',
    ingredientsEn: 'Alpha-arbutin, Licorice Extract, Niacinamide, Lactic Acid, Zinc Oxide, Vitamin C, Vitamin E, Rose Oil',
    usageAr: 'نظّفي البشرة بغسول مناسب، ثم وزّعي الكريم بحركات دائرية حتى يُمتص. صباحاً ومساءً.',
    usageEn: 'Clean skin first, apply in circular motion until absorbed. Morning and evening.',
    quoteAr: 'فرق ملحوظ من أول استخدام',
    quoteEn: 'Instant visible difference'
  },
  {
    id: 'body-lotion',
    nameAr: 'لوشن مونتانا لليدين والجسم',
    nameEn: 'Montaña Hand & Body Lotion',
    price: 380,
    size: '50 ml',
    category: { ar: 'الجسم', en: 'Body' },
    descAr: 'ترطيب حتى 72 ساعة · لليدين والجسم · لجميع أنواع البشرة · غير دهني.',
    descEn: '72-Hour Hydration · Hand & Body · All Skin Types · Non-Greasy.',
    forAr: 'البشرة الخشنة · الترطيب اليومي · تنعيم البشرة · البشرة المعرضة للغسل المتكرر',
    forEn: 'Rough skin · Daily hydration · Smoothing · Frequently washed skin',
    ingredientsAr: 'الجليسرين، زيت الزيتون، زيت اللوز، زيت الجوجوبا، زيت جوز الهند، زبدة الكاكاو، زبدة الشيا، شمع العسل، فيتامين E',
    ingredientsEn: 'Glycerin, Olive Oil, Almond Oil, Jojoba Oil, Coconut Oil, Cocoa Butter, Shea Butter, Beeswax, Vitamin E',
    usageAr: 'يُوضع على البشرة الجافة كلما دعت الحاجة.',
    usageEn: 'Apply to dry skin whenever needed.',
    quoteAr: 'بشرتي فضلت مرطبة طول اليوم',
    quoteEn: 'Skin felt hydrated all day'
  },
  {
    id: 'post-laser',
    nameAr: 'كريم مونتانا للعناية بعد الليزر',
    nameEn: 'Montaña Post Laser Cream',
    price: 650,
    size: '50 ml',
    category: { ar: 'متخصص', en: 'Clinical' },
    descAr: 'تعافي سريع بعد جلسات الليزر والإجراءات التجميلية.',
    descEn: 'Fast recovery after laser sessions and cosmetic procedures.',
    forAr: 'تهيّج واحمرار بعد الليزر · حساسية الجلد · الحرقان أو الشد · دعم التعافي · تقوية حاجز البشرة',
    forEn: 'Post-laser redness · Skin sensitivity · Burning/tightness · Recovery support · Barrier strengthening',
    ingredientsAr: 'زيت السمسم، بانثينول، الألانتوين، شمع العسل، الجليسرين، الألوفيرا، فيتامين E، النياسيناميد، مستخلص الشاي الأخضر، اللانولين',
    ingredientsEn: 'Sesame Oil, Panthenol, Allantoin, Beeswax, Glycerin, Aloe Vera, Vitamin E, Niacinamide, Green Tea Extract, Lanolin',
    usageAr: 'بعد جلسة الليزر، طبقة خفيفة على المنطقة ودلّكيها بلطف بأيدي نظيفة.',
    usageEn: 'After laser, apply thin layer and gently massage with clean hands.',
    quoteAr: 'الاحمرار اختفى في يومين بدل أسبوع',
    quoteEn: 'Redness gone in 2 days instead of a week'
  },
  {
    id: 'anti-scar',
    nameAr: 'جل مونتانا لعلاج الندبات',
    nameEn: 'Montaña Anti-Scar Gel',
    price: 720,
    size: '50 ml',
    category: { ar: 'متخصص', en: 'Clinical' },
    descAr: 'الندبات تبدأ في التخفيف وآثار حب الشباب تقل بشكل واضح.',
    descEn: 'Scars begin to soften and post-acne marks are visibly reduced.',
    forAr: 'ندوب قديمة وجديدة · ندوب العمليات · آثار حب الشباب · الكيلويد',
    forEn: 'Old & new scars · Surgical scars · Post-acne marks · Keloids',
    ingredientsAr: 'سيليكون طبي، فيتامين E',
    ingredientsEn: 'Medical-Grade Silicone, Vitamin E',
    usageAr: 'على ندبة نظيفة وجافة، طبقة رفيعة مرتين يوميًا. للندوب القديمة: 8–12 أسبوع.',
    usageEn: 'On clean dry scar, thin layer twice daily. Old scars: 8–12 weeks.',
    quoteAr: 'بعد 3 شهور الندبة بدأت تنبسط',
    quoteEn: 'Keloid finally flattening after 3 months'
  }
];

function productLink(productId) {
  return SITE_URL + '/product.html?id=' + productId;
}

function productCatalog(lang) {
  return PRODUCTS.map(function (p) {
    var link = productLink(p.id);
    if (lang === 'en') {
      return '- ' + p.nameEn + ' | ' + p.price + ' EGP | ' + p.size + ' | ' + p.forEn + ' | Link: ' + link;
    }
    return '- ' + p.nameAr + ' | ' + p.price + ' جنيه | ' + p.size + ' | ' + p.forAr + ' | لينك: ' + link;
  }).join('\n');
}

function productDetails(lang) {
  return PRODUCTS.map(function (p) {
    if (lang === 'en') {
      return p.nameEn + ':\n  For: ' + p.forEn + '\n  Key ingredients: ' + p.ingredientsEn + '\n  How to use: ' + p.usageEn + '\n  Result: "' + p.quoteEn + '"';
    }
    return p.nameAr + ':\n  مناسب لـ: ' + p.forAr + '\n  المكونات: ' + p.ingredientsAr + '\n  طريقة الاستخدام: ' + p.usageAr + '\n  نتيجة: "' + p.quoteAr + '"';
  }).join('\n\n');
}

function buildSystemPrompt(lang) {
  var replyLang = lang === 'en'
    ? 'Reply in English — warm, expert skincare consultant tone.'
    : 'ردّي بالعربي المصري الطبيعي — زي بياعة كوزمتيك محترفة اسمها نور (ودودة، فاهمة، بتحب تساعد، مش روبوت).';

  return [
    'You are Nour (نور), Montana\'s skincare consultant on Facebook/Instagram.',
    'CRITICAL: Reply in the SAME language as the customer.',
    replyLang,
    '',
    '═══ PRODUCT CATALOG (EXACT names, prices, links — NEVER invent) ═══',
    productCatalog(lang),
    '',
    '═══ DETAILED PRODUCT INFO ═══',
    productDetails(lang),
    '',
    '═══ SELLING FLOW (follow this order) ═══',
    '1. GREET warmly — ask about their skin concern.',
    '2. RECOMMEND the right product(s) — mention name, price, what it does, and include the product LINK so they can see it on the website.',
    '3. When recommending, format each product clearly:',
    '   💜 [Product Name]',
    '   💰 [Price] جنيه',
    '   ✨ [One-line benefit]',
    '   🔗 [Product Link]',
    '4. If they want to ORDER, say: "تمام! محتاجة منك 3 حاجات بس:"',
    '   - الاسم بالكامل',
    '   - رقم الموبايل',
    '   - العنوان بالتفصيل (المحافظة والمنطقة والشارع)',
    '   Ask for ALL THREE at once — don\'t ask one by one.',
    '5. After getting all info, confirm the order summary and tell them about the deposit.',
    '',
    '═══ DEPOSIT (200 EGP) — how to explain it ═══',
    'When the customer asks "ليه 200 جنيه؟" or questions the deposit:',
    lang === 'en'
      ? '- Explain: "The 200 EGP deposit is just a small booking confirmation to secure your order and reserve your products. It\'s deducted from the total — you only pay the remaining balance on delivery. This way we guarantee your items are set aside just for you 💜"'
      : '- قولي: "الـ 200 جنيه دول مجرد تأكيد حجز بسيط عشان نحجزلك المنتجات ونضمنلك إنها متوفرة. المبلغ ده بيتخصم من الإجمالي — يعني بتدفعي الباقي بس عند الاستلام. كده بنضمنلك إن منتجاتك محجوزة باسمك 💜"',
    '- NEVER say "عربون" alone — say "تأكيد حجز" or "رسوم حجز بسيطة".',
    '- Emphasize: it\'s DEDUCTED from total, not extra money.',
    '- Make it feel premium: "عشان منتجاتنا بتخلص بسرعة، الحجز بيضمنلك أولوية".',
    '',
    '═══ RULES ═══',
    '1. Understand Egyptian Arabic naturally (عاوزة، كمان، يريت, etc.).',
    '2. ALWAYS include the product link when recommending.',
    '3. Keep replies concise (3-6 sentences max unless listing products).',
    '4. Never diagnose medically — cosmetic guidance only.',
    '5. If multiple concerns → recommend ALL relevant products in one reply.',
    '6. When mentioning a product, ALWAYS include its price.',
    '7. If customer asks about ingredients or how to use — give full details from the info above.',
    '8. Be confident and knowledgeable — you know every product inside out.',
    '9. IMPORTANT — PRODUCT PAIRS that work better together:',
    '   - Brightening/dull skin → BOTH Whitening Cleanser (480) + Whitening Cream (520) — cleanser daily + cream at night',
    '   - Post-laser + scars → BOTH Post Laser Cream (650) + Anti-Scar Gel (720)',
    '   When a concern matches 2 products, present BOTH clearly with prices and links, and say "الاتنين مع بعض بيدوا نتيجة أقوى — تقدري تطلبي واحد أو الاتنين 💜"',
    '',
    '═══ ORDER DATA COLLECTION ═══',
    'When you have ALL of: customer name, phone, delivery address, AND which products:',
    'Output this hidden tag at the END of your reply (customer won\'t see it):',
    '<!--ORDER_JSON{"name":"...","phone":"...","address":"...","items":[{"id":"product-id","qty":1}]}ORDER_JSON-->',
    'ONLY output this when ALL 4 fields are present. If anything is missing, ask for it.',
    'Valid product IDs: ' + PRODUCTS.map(function (p) { return p.id; }).join(', '),
    '',
    '═══ COMMENTS ON POSTS ═══',
    'For comments: reply briefly with a teaser about the product, include the link, and invite them to DM.',
    lang === 'en'
      ? 'Example: "Great choice! Check it out here: [link] — DM us to order 💜"'
      : 'مثال: "اختيار رائع! شوفي التفاصيل هنا: [لينك] — كلمينا في الخاص عشان نحجزلك 💜"'
  ].join('\n');
}

function detectLang(text) {
  return /[؀-ۿ]/.test(text) ? 'ar' : 'en';
}

async function getConversationHistory(senderId, platform, limit) {
  limit = limit || 10;
  try {
    var supabase = getSupabase();
    var { data } = await supabase
      .from('social_messages')
      .select('direction, message_text, created_at')
      .or('sender_id.eq.' + senderId + ',recipient_id.eq.' + senderId)
      .eq('platform', platform)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (!data || !data.length) return [];
    return data.reverse().map(function (m) {
      return {
        role: m.direction === 'inbound' ? 'user' : 'assistant',
        content: m.message_text || ''
      };
    });
  } catch (e) {
    return [];
  }
}

function extractOrderFromReply(text) {
  var match = text.match(/<!--ORDER_JSON(\{[\s\S]*?\})ORDER_JSON-->/);
  if (!match) return null;
  try {
    var order = JSON.parse(match[1]);
    if (order.name && order.phone && order.address && order.items && order.items.length) {
      order.items = order.items.map(function (item) {
        var prod = PRODUCTS.find(function (p) { return p.id === item.id; });
        return {
          id: item.id,
          name: prod ? prod.nameAr : item.id,
          nameEn: prod ? prod.nameEn : item.id,
          price: prod ? prod.price : 0,
          qty: item.qty || 1
        };
      });
      order.total = order.items.reduce(function (s, i) { return s + i.price * i.qty; }, 0);
      return order;
    }
  } catch (e) {}
  return null;
}

function cleanReplyText(text) {
  return text.replace(/<!--ORDER_JSON[\s\S]*?ORDER_JSON-->/g, '').trim();
}

async function callAiProvider(system, messages) {
  var resolveClaudeKey, validateClaudeKey, callClaudeApi, extractClaudeText;
  var resolveGeminiKey, validateGeminiKey, callGeminiApi, extractGeminiText;
  var resolveGroqKey, validateGroqKey, callGroqApi;

  try {
    var claude = require('./claude');
    resolveClaudeKey = claude.resolveClaudeKey || claude.resolveKey;
    validateClaudeKey = claude.validateKeyFormat;
    callClaudeApi = claude.callClaudeApi || claude.callApi;
    extractClaudeText = claude.extractClaudeText || claude.extractText;
  } catch (e) {}

  try {
    var gemini = require('./gemini');
    resolveGeminiKey = gemini.resolveGeminiKey || gemini.resolveKey;
    validateGeminiKey = gemini.validateKeyFormat;
    callGeminiApi = gemini.callGeminiApi || gemini.callApi;
    extractGeminiText = gemini.extractGeminiText || gemini.extractText;
  } catch (e) {}

  try {
    var groq = require('./groq');
    resolveGroqKey = groq.resolveGroqKey || groq.resolveKey;
    validateGroqKey = groq.validateKeyFormat;
    callGroqApi = groq.callGroqApi || groq.callApi;
  } catch (e) {}

  var provider = String(process.env.CHAT_PROVIDER || '').trim().toLowerCase();
  if (!provider) {
    if (resolveClaudeKey && resolveClaudeKey()) provider = 'claude';
    else if (resolveGeminiKey && resolveGeminiKey()) provider = 'gemini';
    else if (resolveGroqKey && resolveGroqKey()) provider = 'groq';
    else provider = 'gemini';
  }

  var body = { system: system, messages: messages, generationConfig: { temperature: 0.6, maxOutputTokens: 800 } };

  if (provider === 'claude' && resolveClaudeKey) {
    var key = resolveClaudeKey();
    var check = validateClaudeKey(key);
    if (!check.ok) return null;
    var result = await callClaudeApi(check.key, body);
    if (result.ok) return result.text || extractClaudeText(result.data);
  }

  if (provider === 'gemini' && resolveGeminiKey) {
    var key = resolveGeminiKey();
    var check = validateGeminiKey(key);
    if (!check.ok) return null;
    var result = await callGeminiApi(check.key, body);
    if (result.ok) return result.text || extractGeminiText(result.data);
  }

  if (provider === 'groq' && resolveGroqKey) {
    var key = resolveGroqKey();
    var check = validateGroqKey(key);
    if (!check.ok) return null;
    var result = await callGroqApi(check.key, body);
    if (result.ok) return result.text;
  }

  return null;
}

async function getCustomerOrders(senderId) {
  try {
    var supabase = getSupabase();
    var { data } = await supabase
      .from('social_orders')
      .select('*')
      .eq('social_sender_id', senderId)
      .order('created_at', { ascending: false })
      .limit(5);
    return data || [];
  } catch (e) {
    return [];
  }
}

async function cancelSocialOrder(orderId, senderId) {
  try {
    var supabase = getSupabase();
    var { data, error } = await supabase
      .from('social_orders')
      .update({ status: 'cancelled' })
      .eq('id', orderId)
      .eq('social_sender_id', senderId)
      .eq('status', 'pending')
      .select()
      .maybeSingle();
    if (error) return null;
    return data;
  } catch (e) {
    return null;
  }
}

async function generateReply(senderId, platform, messageText, isComment) {
  var lang = detectLang(messageText);
  var history = await getConversationHistory(senderId, platform);
  var customerOrders = await getCustomerOrders(senderId);

  var system = buildSystemPrompt(lang);

  if (customerOrders.length) {
    var orderInfo = customerOrders.map(function (o) {
      var items = (o.items || []).map(function (i) { return i.name + ' x' + (i.qty || 1); }).join(', ');
      return 'Order #' + o.id + ' | Status: ' + o.status + ' | Items: ' + items + ' | Total: ' + o.total + ' EGP | Date: ' + (o.created_at || '').slice(0, 10);
    }).join('\n');
    system += '\n\n═══ CUSTOMER ORDER HISTORY ═══\n' +
      'This customer has previous orders:\n' + orderInfo + '\n' +
      'If they ask about their order, refer to this info.\n' +
      'If they want to CANCEL a pending order, output: <!--CANCEL_ORDER:ORDER_ID-->\n' +
      'Only cancel if the customer explicitly asks. Confirm before cancelling.';
  }

  if (isComment) {
    system += '\n\nThis message is a COMMENT on a post (not a DM). Reply briefly, include product link, invite to DM for ordering.';
  }

  var messages = history.slice();
  messages.push({ role: 'user', content: messageText });

  var replyText = await callAiProvider(system, messages);

  if (!replyText) {
    replyText = lang === 'en'
      ? 'Hi! Thanks for reaching out 💜 How can I help you with your skincare? Check our products here: ' + SITE_URL
      : 'أهلاً! 💜 أنا نور من Montana — قوليلي إيه مشكلة بشرتك وأنا أرشّحلك الأنسب. شوفي منتجاتنا هنا: ' + SITE_URL;
  }

  var order = extractOrderFromReply(replyText);

  var cancelMatch = replyText.match(/<!--CANCEL_ORDER:([\w-]+)-->/);
  var cancelledOrderId = null;
  if (cancelMatch) {
    var cancelled = await cancelSocialOrder(cancelMatch[1], senderId);
    if (cancelled) cancelledOrderId = cancelMatch[1];
  }

  var cleanText = cleanReplyText(replyText).replace(/<!--CANCEL_ORDER:[\w-]+-->/g, '').trim();

  return { text: cleanText, order: order, cancelledOrderId: cancelledOrderId, lang: lang };
}

async function saveOrder(order, platform, senderId) {
  var supabase = getSupabase();
  var orderRecord = {
    id: 'SO-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
    name: order.name,
    phone: order.phone,
    address: order.address,
    items: order.items,
    total: order.total,
    status: 'pending',
    source: platform,
    social_sender_id: senderId,
    created_at: new Date().toISOString()
  };

  await supabase.from('social_orders').insert(orderRecord);

  try {
    var telegram = require('./telegram');
    var tgToken = process.env.TELEGRAM_BOT_TOKEN || process.env.TG_BOT_TOKEN;
    var tgChat = process.env.TELEGRAM_CHAT_ID || process.env.TG_CHAT_ID;
    if (tgToken && tgChat) {
      var itemsText = order.items.map(function (i) { return i.name + ' x' + i.qty + ' (' + i.price + ' جنيه)'; }).join('\n');
      var msg = '🛒 أوردر جديد من ' + platform + '\n\n' +
        '👤 ' + order.name + '\n📱 ' + order.phone + '\n📍 ' + order.address + '\n\n' +
        itemsText + '\n\n💰 الإجمالي: ' + order.total + ' جنيه\n' +
        '💳 تأكيد الحجز: 200 جنيه\n' +
        '📦 الباقي عند الاستلام: ' + (order.total - 200) + ' جنيه';
      await telegram.sendTelegramMessage(tgToken, tgChat, msg);
    }
  } catch (e) {
    console.error('[social-bot] telegram notify error:', e.message);
  }

  try {
    var autoShip = require('../handlers/shipping/auto-ship');
    await autoShip.registerOrder(orderRecord);
  } catch (e) {
    console.error('[social-bot] auto-ship error:', e.message);
  }

  return orderRecord;
}

module.exports = {
  generateReply,
  saveOrder,
  cancelSocialOrder,
  getCustomerOrders,
  extractOrderFromReply,
  cleanReplyText,
  PRODUCTS,
  productLink
};
