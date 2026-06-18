/* Montana — offline phrase & decision tree (6 products, no API) */
window.MontanaChatPhrases = (function () {
  var EXPLICIT = [
    { productId: 'whitening-cream', p: [/كريم\s*(ال)?تفتيح/, /كريم\s*البقع/, /كريم\s*تبييض/] },
    { productId: 'whitening-cleanser', p: [/غسول\s*(ال)?تفتيح/, /غسول\s*تفتيح/, /غسول\s*الاشراق/] },
    { productId: 'acne-cleanser', p: [/غسول\s*(ال)?حبوب/, /غسول\s*حبوب/, /غسول\s*الحبوب/] },
    { productId: 'body-lotion', p: [/لوشن\s*(ال)?جسم/, /لوشن\s*الايدين/, /^لوشن$/] },
    { productId: 'post-laser', p: [/كريم\s*الليزر/, /كريم\s*بعد\s*الليزر/] },
    { productId: 'anti-scar', p: [/جل\s*الندوب/, /كريم\s*الندوب/, /سيليكون\s*الندوب/] }
  ];

  var RULES = [
    { id: 'acne+whiten', p: [/حبوب.*(تفتيح|تبييض|كالح|بهت|بقع|اسمرار)/, /(تفتيح|تبييض|كالح|بهت).*(حبوب|بثور)/, /حبوب.*و.*(كالح|بهت)/], concerns: ['acne', 'whiten'], h: 'multi' },
    { id: 'acne', p: [/عندي\s*حبوب/, /حبوب\s*في/, /مليان\s*حبوب/, /وشي\s*مليان/, /بثور/, /حب\s*شباب/, /بشرة\s*دهن/, /بشرتي\s*دهن/, /زيته/, /زيت\s*زياده/, /مسام\s*واسعه/, /رؤوس\s*سوداء/], concerns: ['acne'], h: 'consult' },
    { id: 'whiten', p: [/بشرتي\s*كالح/, /وشي\s*كالح/, /بهتان/, /مش\s*بيلمع/, /وحده\s*اللون/, /لوني\s*غامق/, /اسمرار/], concerns: ['whiten'], h: 'consult' },
    { id: 'whiten-general', p: [/^تفتيح$/, /^تبييض$/, /عايزه\s*تفتيح/, /محتاجه\s*تفتيح/], concerns: ['whiten'], h: 'consult' },
    { id: 'spots', p: [/بقع\s*في/, /بقع\s*الابط/, /ابط\s*غامق/, /مرفق/, /ركبه\s*غامق/, /مناطق\s*حساسه/], concerns: ['spots'], h: 'consult' },
    { id: 'dry-face', p: [/وشي\s*ناشف/, /وش\s*ناشف/, /وجه\s*ناشف/, /بشرتي\s*ناشف.*وش/], concerns: ['dry'], face: true, h: 'consult' },
    { id: 'dry', p: [/بشرتي\s*ناشف/, /جسمي\s*ناشف/, /ايدي\s*ناشف/, /تقشر/, /جفاف/, /ترطيب/, /خشنه/], concerns: ['dry'], h: 'consult' },
    { id: 'scar', p: [/ندوب/, /ندبه/, /اثار\s*حبوب/, /علامات\s*حبوب/, /بقايا\s*حبوب/, /جرح/], concerns: ['scar'], h: 'consult' },
    { id: 'laser', p: [/بعد\s*الليزر/, /عملت\s*ليزر/, /فراكشنال/, /تقشير\s*كيميائي/], concerns: ['laser'], h: 'consult' },
    { id: 'catalog', p: [
      /منتجات?\s*تانيه/, /في\s*ايه\s*(منتجات?\s*)?تاني/, /عندكم\s*ايه\s*تاني/, /حاجات?\s*تانيه/,
      /ايه\s*المنتجات/, /ايه\s*عندكم/, /عندكم\s*ايه/, /وريني\s*المنتجات/, /كل\s*المنتجات/, /قائمه\s*المنتجات/
    ], h: 'catalog' },
    { id: 'catalog-follow', p: [/^زي\s*ايه$/, /^وايه\s*كمان$/, /^ايه\s*كمان$/, /^ايه\s*تاني$/, /^مثلا$/, /^قوليلي\s*اكتر$/], h: 'catalog_follow' },
    { id: 'shipping', p: [/الشحن/, /التوصيل/, /بيوصل\s*امتى/, /يوصل\s*امتى/, /مدة\s*التوصيل/, /دفع\s*عند\s*الاستلام/, /كاش/], h: 'shipping' },
    { id: 'compare-cleansers', p: [/فرق\s*بين\s*الغسول/, /ايه\s*الفرق.*غسول/, /غسول\s*الحبوب\s*ولا\s*التفتيح/, /انهي\s*غسول/], productIds: ['acne-cleanser', 'whitening-cleanser'], h: 'compare' },
    { id: 'buy-more', p: [/حاجه\s*تانيه/, /منتج\s*تاني/, /كمان\s*حاجه/, /عايزه\s*اشتري\s*كمان/, /اوردر\s*تاني/], h: 'buy_more' },
    { id: 'order', p: [/عايز\s*اطلب/, /عايزه\s*اطلب/, /عاوز\s*اوردر/, /اعمل\s*اوردر/, /ابدأ\s*اوردر/, /هاطلب/, /هاجيب/], h: 'order' }
  ];

  function matchExplicit(norm) {
    for (var i = 0; i < EXPLICIT.length; i++) {
      for (var j = 0; j < EXPLICIT[i].p.length; j++) {
        if (EXPLICIT[i].p[j].test(norm)) return EXPLICIT[i].productId;
      }
    }
    return null;
  }

  function wantsBuy(norm) {
    return /عا(و|ي)ز|عوز|محتاج|هاخد|هاجيب|اطلب|اوردر|هاشتري/.test(norm);
  }

  function matchRule(norm, raw, ctx) {
    ctx = ctx || {};
    var productId = matchExplicit(norm);
    if (productId) {
      return {
        id: productId,
        productId: productId,
        h: wantsBuy(norm) ? 'want_order' : 'want_product'
      };
    }
    for (var i = 0; i < RULES.length; i++) {
      var rule = RULES[i];
      if (rule.h === 'catalog_follow' && !ctx.sessionCatalogShown && !ctx.recentCatalog) continue;
      if (rule.h === 'buy_more' && ctx.sessionPhase !== 'post_order') continue;
      if (rule.h === 'order' && ctx.collectingOrder) continue;
      for (var j = 0; j < rule.p.length; j++) {
        if (rule.p[j].test(norm)) return rule;
      }
    }
    if (/^بكام$|^بكم$|^السعر$|^كام$/.test(norm.trim())) return { id: 'price-only', h: 'price_ctx' };
    if (/^ازاي\s*استخدم|^طريقه\s*الاستخدام|^استخدمه\s*ازاي/.test(norm)) return { id: 'usage-only', h: 'usage_ctx' };
    if (/^جواها\s*ايه$|^جواه\s*ايه$|^مكونات$|^فيه\s*ايه$/.test(norm)) return { id: 'ing-only', h: 'ing_ctx' };
    return null;
  }

  function buildBrain(rule, lang, products, K, intent, ctx) {
    ctx = ctx || {};
    products = products || [];
    intent = intent || {};
    var empty = { step: ctx.orderStep || 'idle', product_names: [] };
    var names = function (p) { return lang === 'en' ? [p.nameEn] : [p.nameAr]; };

    if (rule.h === 'want_order') {
      return null;
    }

    if (rule.h === 'want_product' && rule.productId) {
      var wp = products.find(function (p) { return p.id === rule.productId; });
      if (!wp) return null;
      return {
        reply: K.buildProductExpertReply(wp, lang, { offerOrder: false }),
        action: 'chat',
        order: { step: empty.step, product_names: names(wp) },
        _products: [wp],
        _skipPolish: true
      };
    }

    if (rule.h === 'multi' && rule.concerns) {
      var multi = K.buildMultiConsultationReply(rule.concerns, lang, products);
      if (!multi) return null;
      var mIds = K.resolveMultiConcernIds(rule.concerns);
      return {
        reply: multi,
        action: 'chat',
        order: { step: empty.step, product_names: mIds.map(function (id) {
          var p = products.find(function (x) { return x.id === id; });
          return p ? (lang === 'en' ? p.nameEn : p.nameAr) : '';
        }).filter(Boolean) },
        _products: mIds.map(function (id) { return products.find(function (p) { return p.id === id; }); }).filter(Boolean)
      };
    }

    if (rule.h === 'consult' && rule.concerns && rule.concerns[0]) {
      var c = rule.concerns[0];
      var norm = intent.norm || '';
      if (rule.face) norm += ' وش';
      var reply = K.buildConsultationReply(c, lang, products, norm);
      if (!reply) return null;
      var prod = K.resolveConcernProduct(c, norm, products);
      return {
        reply: reply,
        action: 'chat',
        order: { step: empty.step, product_names: prod ? names(prod) : [] },
        _products: prod ? [prod] : []
      };
    }

    if (rule.h === 'catalog' || rule.h === 'catalog_follow') {
      return {
        reply: K.buildFullCatalogReply(lang, products),
        action: 'chat',
        order: empty,
        _catalog: true
      };
    }

    if (rule.h === 'buy_more') {
      if (ctx.sessionPhase !== 'post_order') return null;
      return {
        reply: lang === 'en'
          ? 'Sure! What would you like to add? Tell me the product or your skin concern.'
          : 'تمام يا حبيبتي! \uD83D\uDC9C عايزة إيه تاني؟ قوليلي المنتج أو مشكلة بشرتك.',
        action: 'buy_more',
        order: empty
      };
    }

    if (rule.h === 'shipping') {
      return { reply: K.shippingReply(lang), action: 'chat', order: empty };
    }

    if (rule.h === 'compare' && rule.productIds) {
      var a = products.find(function (p) { return p.id === rule.productIds[0]; });
      var b = products.find(function (p) { return p.id === rule.productIds[1]; });
      if (a && b) {
        return { reply: K.buildCompareReply(a, b, lang), action: 'chat', order: empty };
      }
    }

    if (rule.h === 'order') {
      return null;
    }

    if (rule.h === 'price_ctx' && ctx.suggestedProduct) {
      var sp = ctx.suggestedProduct;
      return {
        reply: lang === 'en'
          ? sp.nameEn + ' is ' + sp.price + ' EGP — ' + sp.sizeEn + '.'
          : sp.nameAr + ' سعره ' + sp.price + ' جنيه — ' + sp.size + '.',
        action: 'chat',
        order: { step: empty.step, product_names: names(sp) },
        _products: [sp]
      };
    }

    if (rule.h === 'usage_ctx' && ctx.suggestedProduct) {
      return {
        reply: K.buildProductExpertReply(ctx.suggestedProduct, lang, { usage: true, offerOrder: false }),
        action: 'chat',
        order: { step: empty.step, product_names: names(ctx.suggestedProduct) },
        _products: [ctx.suggestedProduct]
      };
    }

    if (rule.h === 'ing_ctx' && ctx.suggestedProduct) {
      return {
        reply: K.buildProductExpertReply(ctx.suggestedProduct, lang, { usage: false, offerOrder: false }),
        action: 'chat',
        order: { step: empty.step, product_names: names(ctx.suggestedProduct) },
        _products: [ctx.suggestedProduct]
      };
    }

    return null;
  }

  return { matchRule: matchRule, buildBrain: buildBrain, RULES: RULES };
})();
