/* Montana chatbot — Egyptian colloquial + skincare professional intents */
window.MontanaChatIntent = (function () {
  function normalizeText(text) {
    return String(text || '')
      .toLowerCase()
      .replace(/[\u064B-\u065F\u0670]/g, '')
      .replace(/[أإآٱ]/g, 'ا')
      .replace(/ى/g, 'ي')
      .replace(/ة/g, 'ه')
      .replace(/ؤ/g, 'و')
      .replace(/ئ/g, 'ي')
      .replace(/ـ/g, '')
      .replace(/[^\w\s\u0600-\u06FF]/g, ' ')
      .replace(/عوز/g, 'عاوز')
      .replace(/عيز/g, 'عايز')
      .replace(/يريت/g, 'ياريت')
      .replace(/يا\s*ريت/g, 'ياريت')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function hasAny(norm, patterns) {
    for (var i = 0; i < patterns.length; i++) {
      if (patterns[i].test(norm)) return true;
    }
    return false;
  }

  function scoreOrder(norm) {
    var score = 0;
    if (hasAny(norm, [/طلب/, /اوردر/, /\border\b/, /اشتري/, /شراء/, /احجز/, /\bbuy\b/, /checkout/, /purchase/])) score += 3;
    if (hasAny(norm, [
      /اعمل\s*(طلب|اوردر)/, /ممكن\s*(اعمل|اطلب|اشتري|اعملي|اوردر|طلب)/, /^(طلب|اطلب|اوردر)$/, /^اطلب/,
      /عايز\s*(اعمل\s*)?(طلب|اوردر|اشتري|اجيب)/, /عاوز\s*(اعمل\s*)?(طلب|اوردر|اشتري|اجيب)/,
      /عايزه\s*(اعمل\s*)?(طلب|اوردر|اشتري|اجيب)/, /عاوزه\s*(اعمل\s*)?(طلب|اوردر|اشتري|اجيب)/,
      /حابب\s*(اعمل\s*)?(طلب|اوردر|اشتري)/, /حابه\s*(اعمل\s*)?(طلب|اوردر|اشتري)/,
      /محتاج\s*(اعمل\s*)?(طلب|اوردر|اشتري)/, /نفسي\s*(اعمل\s*)?(طلب|اوردر|اشتري|اجيب)/,
      /هاطلب/, /هاعمل\s*(طلب|اوردر)/, /هاخد/, /هاجيب/,
      /عا(و|ي)ز(ه|a|ة|ا)?\s*(كريم|غسول|ال)/,
      /عوز\s*(كريم|غسول|ال)/,
      /محتاج(ه|ة|a)?\s*(كريم|غسول|ال)/,
      /ابدأ\s*اوردر/, /ابدا\s*اوردر/, /نبدأ\s*اوردر/, /نفذ\s*اوردر/, /ننفذ\s*الاوردر/, /سجل\s*اوردر/,
      /ابعت(لي|يلي|ه)?\s*(اوردر|طلب|الاوردر)?/, /وصل(ي|ني|ه)?\s*(اوردر|طلب|المنتج)?/,
      /هات(ي|يلي|ه)?\s*(اوردر|طلب|المنتج)?/, /ممكن\s*اوردر/,
      /can\s+i\s+(make\s+)?(an\s+)?order/, /want\s+to\s+order/, /place\s+(an?|my)\s*order/, /i\s*want\s+to\s+buy/
    ])) score += 5;
    if (/ممكن/.test(norm) && /اعمل|اطلب|اشتري|اجيب|اوردر|طلب/.test(norm)) score += 4;
    if (/عايز|عاوز|عايزه|عاوزه|حابب|حابه/.test(norm) && /طلب|اوردر|اشتري|اجيب|هاخد|اطلب/.test(norm)) score += 4;
    return score;
  }

  function scoreProductInquiry(norm) {
    if (/كريم|غسول|لوشن/.test(norm) && !/ايه|موجود|عند|حاج(ه|ة)/.test(norm)) return 0;
    if (/ايه\s*الموجود|موجود\s*ايه|ايه\s*عند(كم|كو)|عندكم\s*ايه|عندكو\s*ايه|قوليلي\s*ايه|وريني\s*ايه/.test(norm)) return 7;
    if (/عا(و|ي)ز(ه|a|ة)?|محتاج(ه|a)?|دور(ي)?\s*على|نفسي\s*(حاج|منتج)/.test(norm) &&
        /حاج(ه|ة)|منتج|علاج|حل/.test(norm)) return 6;
    if (/عا(و|ي)ز(ه|a|ة)?.*(لل|ل)(حبوب|تفتيح|ندوب|جفاف|ناشف|دهن|بقع)/.test(norm)) return 6;
    if (/عندي\s*(حبوب|بقع|ندوب|جفاف|ناشف|اسمرار|بهتان)/.test(norm)) return 6;
    if (/بشرتي\s*(كالح|ناشف|دهن|حساس|مش\s*حلو)/.test(norm)) return 6;
    if (/what\s+do\s+you\s+have|what\s+.*for\s+(acne|brighten|dry|scar)/.test(norm)) return 6;
    return 0;
  }

  function isAgreement(norm, raw) {
    var r = String(raw || '').trim();
    if (r.length > 45) return false;
    if (/[؟?]/.test(r) || /ايه|ازاي|فين|امتى|كام|موجود|عند|قول|وريني/.test(norm)) return false;
    if (r.length > 10 && /^طيب/.test(norm)) return false;
    return hasAny(norm, [
      /^ياريت/, /^يا ريت/, /^اتمنى/, /^خلاص/, /^يلا/, /^ماشي/, /^تمام/, /^اه$/, /^اه\s/, /^ايوه/, /^نعم/,
      /^موافق/, /^اكيد/, /^حاضر/, /^حلو/, /^اوك/, /^اوكي/, /^ok\b/, /^yes/, /^طيب/, /^صح/,
      /^تمام اوي/, /^يلا بينا/, /^مظبوط/, /^خد$/, /^يلا كده/, /^اه يا ريت/, /^ماشي يا ريت/
    ]);
  }

  function scoreAffirm(norm) {
    if (isAgreement(norm, norm)) return 6;
    if (norm.length < 35 && /(?:^|\s)(ايوه|اه|تمام|نعم|ماشي|اكيد|ياريت|يريت|خلاص|يلا|حاضر|طيب|صح|مظبوط|اوكي)(?:\s|$)/.test(norm)) return 5;
    return 0;
  }

  function scoreGreeting(norm) {
    if (hasAny(norm, [/^(مرحب|اهلا|اهل|هاي|صباح|مساء|هلا|ازيك|ازيكي|اخبارك|عامل ايه|عامله ايه)/, /^(hi|hello|hey)/])) return 6;
    if (/السلام عليكم/.test(norm)) return 6;
    return 0;
  }

  function scoreGoodbye(norm, raw) {
    var r = String(raw || '').trim();
    if (r.length > 35) return 0;
    if (hasAny(norm, [
      /^باي(?:\s|!|$)/, /^باي باي/, /^مع السلامه/, /^مع السلامة/, /^سلامات$/,
      /^bye(?:\s|!|$)/, /^goodbye/, /^good\s*night/, /^see\s*you/, /^cya\b/, /^later\b/
    ])) return 7;
    if (/^سلام$/.test(norm) && r.length <= 6) return 6;
    return 0;
  }

  function scoreCatalog(norm) {
    if (hasAny(norm, [
      /منتجات?\s*تانيه/, /في\s*ايه\s*(منتجات?\s*)?تاني/, /عندكم\s*ايه\s*تاني/, /حاجات?\s*تانيه/,
      /ايه\s*كمان\s*عندكم/, /كل\s*حاجه\s*عندكم/, /قائمه\s*كامله/
    ])) return 7;
    if (hasAny(norm, [
      /منتج/, /عندكم/, /عندكو/, /ايه\s*عند/, /ايه\s*الموجود/, /موجود\s*ايه/,
      /وريني/, /اعرض/, /حاجاتكم/, /what\s+do\s+you\s+(have|sell)/, /list.*product/
    ])) return 5;
    return 0;
  }

  function isCatalogFollowUp(norm) {
    if (!norm || norm.length > 25) return false;
    return hasAny(norm, [
      /^زي\s*ايه$/, /^وايه\s*كمان$/, /^ايه\s*كمان$/, /^ايه\s*تاني$/,
      /^وبعدين$/, /^قوليلي\s*اكتر$/, /^زي\s*ايه\s*كمان$/, /^مثلا$/,
      /^what\s+else$/, /^like\s+what$/, /^more\?*$/
    ]);
  }

  function scorePrice(norm) {
    if (hasAny(norm, [/سعر/, /بكام/, /بكم/, /عامل\s*كام/, /ثمن/, /تمن/, /\bprice\b/, /how\s+much/])) return 5;
    return 0;
  }

  function scoreIngredients(norm) {
    if (window.MontanaChatKnowledge && window.MontanaChatKnowledge.findIngredient('', norm)) return 6;
    if (hasAny(norm, [/مكون/, /جواه/, /جواها/, /فيه\s*ايه/, /فيها\s*ايه/, /مكونات/, /معمول\s*من/, /\bingredient/, /made\s+of/])) return 5;
    return 0;
  }

  function scoreUsage(norm) {
    if (hasAny(norm, [
      /ازاي\s*استخدم/, /طريقه\s*الاستخدام/, /طريقة\s*الاستخدام/, /استخدمه\s*ازاي/, /استعمال/,
      /كل\s*قد\s*ايه/, /مرات\s*في\s*اليوم/, /قبل\s*وبعد/, /how\s*to\s*use/, /how\s*often/, /usage/, /apply/
    ])) return 6;
    return 0;
  }

  function scoreShipping(norm) {
    if (hasAny(norm, [/شحن/, /توصيل/, /يوصل\s*امتى/, /بيوصل/, /مدة\s*التوصيل/, /delivery/, /shipping/, /cod/, /دفع\s*عند/])) return 6;
    return 0;
  }

  function scoreRoutine(norm) {
    if (hasAny(norm, [/روتين/, /خطوات/, /استخدم\s*الاتنين/, /نظام\s*العنايه/, /routine/, /regimen/, /step/])) return 5;
    return 0;
  }

  function scoreCompare(norm) {
    if (hasAny(norm, [/ايه\s*الفرق/, /ايه\s*احسن/, /انهي\s*احسن/, /مقارنه/, /compare/, /difference/, /which\s*is\s*better/, /vs\b/])) return 6;
    return 0;
  }

  function scoreThanks(norm) {
    if (hasAny(norm, [/شكر/, /متشكر/, /تسلم/, /ميرسي/, /\bthanks\b/, /thank\s*you/])) return 6;
    return 0;
  }

  function scoreCancel(norm) {
    if (hasAny(norm, [/الغ/, /\bcancel\b/, /مش\s*عايز/, /بلاش/, /سيبك/, /كفايه/])) return 6;
    return 0;
  }

  function scoreAcne(norm) {
    if (hasAny(norm, [
      /حبوب/, /بثور/, /دهن/, /زيته/, /زيتية/, /\bacne\b/, /pimple/, /oily/, /breakout/,
      /مليان\s*حبوب/, /وشي\s*وحش/, /بشرتي\s*مش\s*حلو/, /بشرة\s*مش\s*كويس/, /رؤوس\s*بيضاء/,
      /حب\s*شباب/, /بثرة/, /عندي\s*حبوب/, /في\s*وشي\s*حبوب/, /وشي.*حبوب/, /حبوب.*وشي/,
      /وجهي.*حبوب/, /حبوب.*وجه/
    ])) return 5;
    return 0;
  }

  function scoreOily(norm) {
    if (hasAny(norm, [/بشرة\s*دهنية/, /زهم/, /زيت\s*زياده/, /ملمع/, /oily\s*skin/, /sebum/])) return 5;
    return 0;
  }

  function scorePores(norm) {
    if (hasAny(norm, [/مسام/, /مسام\s*واسعه/, /رؤوس\s*سوداء/, /pores/, /blackhead/, /congested/])) return 5;
    return 0;
  }

  function scoreDry(norm) {
    if (hasAny(norm, [
      /جاف/, /ناشف/, /تشقق/, /تقشر/, /ترطيب/, /\bdry\b/, /dehydrat/, /moistur/,
      /بشرتي\s*ناشف/, /وشي\s*ناشف/, /جسمي\s*ناشف/, /ايدي\s*ناشف/, /خشنه/, /خشنة/
    ])) return 5;
    return 0;
  }

  function scoreRecommend(norm) {
    if (hasAny(norm, [
      /انصح(يني|وني|ك|ني)?/, /رشح(ي|يلي|لي|حيلي)?/, /اختار(ي|يلي|لي|هولي)?/,
      /ايه\s*احسن/, /انهي\s*احسن/, /ايه\s*الانسب/, /ايه\s*الافضل/, /ايه\s*ينفع/,
      /مش\s*عارف(ه|ة)?\s*اختار/, /ساعد(يني|ني)/, /اقترح(ي|يلي)?/, /ترشيح/,
      /recommend/, /suggest/, /which\s+one/, /what\s+should\s+i/, /help\s+me\s+choose/
    ])) return 6;
    return 0;
  }

  function scoreSuitability(norm) {
    if (hasAny(norm, [
      /ينفع\s*(ل|لل|مع)/, /يناسب/, /مناسب/, /احطه\s*على/, /استخدمه\s*لو/, /لو\s*عندي/,
      /good\s+for/, /suitable/, /can\s+i\s+use/
    ])) return 5;
    return 0;
  }

  function scoreWhiten(norm) {
    if (hasAny(norm, [
      /تفتيح/, /تبييض/, /كالح/, /بهتان/, /بقع/, /اسمرار/, /داكن/, /brighten/, /whiten/, /dark\s*spot/, /\bdull\b/,
      /ينور/, /فاتح/, /لوني\s*غامق/, /وحده\s*اللون/, /بشرتي\s*كالح/, /وشي\s*كالح/, /بهت/, /مش\s*بيلمع/
    ])) return 5;
    return 0;
  }

  function scoreSpots(norm) {
    if (hasAny(norm, [/بقع/, /ابط/, /مناطق\s*حساسه/, /مرفق/, /ركبه/, /hyperpigment/, /underarm/, /dark\s*area/])) return 5;
    return 0;
  }

  function scoreScar(norm) {
    if (hasAny(norm, [/ندوب/, /ندبات/, /ندبه/, /بالنسبه\s*ل/, /بالنسبة\s*ل/, /اثار/, /علامات/, /بقايا/, /\bscar\b/, /keloid/])) return 5;
    return 0;
  }

  function scoreLaser(norm) {
    if (hasAny(norm, [/ليزر/, /بعد\s*الليزر/, /فراكشنال/, /تقشير/, /post\s*laser/, /after\s*laser/, /procedure/])) return 6;
    return 0;
  }

  function scoreSensitive(norm) {
    if (hasAny(norm, [/حساسه/, /حساسة/, /تحسس/, /احمرار/, /متهيج/, /sensitive/, /irritat/, /redness/])) return 5;
    return 0;
  }

  function scoreResults(norm) {
    if (hasAny(norm, [/امتى\s*النتيج/, /كام\s*يوم/, /كام\s*اسبوع/, /بتفرق/, /النتيجه\s*امتى/, /هتفرق/, /how\s*long/, /when\s*will/, /results/, /بتبان\s*امتى/, /امتى\s*هتبان/, /امتى\s*بتبان/])) return 6;
    return 0;
  }

  function scoreReturn(norm) {
    if (hasAny(norm, [/مرتجع/, /استرجاع/, /ارجع/, /ترجيع/, /ارجاع/, /\breturn\b/, /\brefund\b/, /رجع\s*المنتج/, /سياسه\s*الاسترجاع/])) return 6;
    return 0;
  }

  function scorePayment(norm) {
    if (hasAny(norm, [/طرق\s*الدفع/, /فودافون\s*كاش/, /انستاباي/, /فيزا/, /\bpayment\b/, /ادفع\s*ازاي/, /طريقه\s*الدفع/, /vodafone\s*cash/, /instapay/])) return 6;
    return 0;
  }

  function scoreHelp(norm) {
    if (hasAny(norm, [/مساعد/, /\bhelp\b/, /مش\s*فاهم/, /ازاي\s*اطلب/, /مش\s*عارف/, /ايه\s*ده/, /فين\s*المنتجات/, /ازاي\s*استخدم\s*الموقع/])) return 5;
    return 0;
  }

  function pickConcern(scores, norm) {
    var all = pickAllConcerns(scores, norm);
    return all.length ? all[0] : null;
  }

  function pickAllConcerns(scores, norm) {
    var list = [];
    if (/اثار\s*حبوب|علامات\s*حبوب|بقايا\s*حبوب/.test(norm)) return ['scar'];
    if (scores.laser >= 5) list.push('laser');
    if (scores.scar >= 5) list.push('scar');
    if (scores.acne >= 5 || scores.oily >= 5 || scores.pores >= 5) list.push('acne');
    if (scores.whiten >= 5 || scores.dull >= 5 || scores.spots >= 5) list.push('whiten');
    if (scores.dry >= 5) list.push('dry');
    if (scores.sensitive >= 5 && list.indexOf('laser') === -1) list.push('sensitive');
    return list;
  }

  function detectIntent(raw, ctx) {
    ctx = ctx || {};
    var norm = normalizeText(raw);
    var agreed = isAgreement(norm, raw);
    var scores = {
      order: scoreOrder(norm),
      productInquiry: scoreProductInquiry(norm),
      affirm: scoreAffirm(norm),
      greeting: scoreGreeting(norm),
      goodbye: scoreGoodbye(norm, raw),
      catalog: scoreCatalog(norm),
      price: scorePrice(norm),
      ingredients: scoreIngredients(norm),
      usage: scoreUsage(norm),
      shipping: scoreShipping(norm),
      routine: scoreRoutine(norm),
      compare: scoreCompare(norm),
      thanks: scoreThanks(norm),
      cancel: scoreCancel(norm),
      acne: scoreAcne(norm),
      oily: scoreOily(norm),
      pores: scorePores(norm),
      dry: scoreDry(norm),
      whiten: scoreWhiten(norm),
      spots: scoreSpots(norm),
      scar: scoreScar(norm),
      laser: scoreLaser(norm),
      sensitive: scoreSensitive(norm),
      recommend: scoreRecommend(norm),
      suitability: scoreSuitability(norm),
      results: scoreResults(norm),
      returnPolicy: scoreReturn(norm),
      payment: scorePayment(norm),
      help: scoreHelp(norm)
    };

    if (ctx.collectingOrder && scores.recommend < 5 && scores.productInquiry < 5) {
      scores.order = Math.max(scores.order, 0);
    }

    if (ctx.botOfferedOrder && (scores.affirm >= 4 || agreed)) scores.order = Math.max(scores.order, 8);
    if (/اثار\s*حبوب|علامات\s*حبوب|بقايا\s*حبوب/.test(norm)) {
      scores.scar = Math.max(scores.scar, 7);
      scores.acne = Math.min(scores.acne, 3);
    }

    var best = 'unknown';
    var bestScore = 0;
    Object.keys(scores).forEach(function (k) {
      if (scores[k] > bestScore) { bestScore = scores[k]; best = k; }
    });

    var concern = pickConcern(scores, norm);
    var concerns = pickAllConcerns(scores, norm);

    var isProductInquiry = scores.productInquiry >= 5 || (scores.catalog >= 4 && (concerns.length >= 1 || /حبوب|تفتيح|ندوب|جاف|ناشف/.test(norm)));

    var orderFromContext = !!(ctx.botOfferedOrder && (scores.affirm >= 4 || agreed));
    var wantsOrder = (scores.order >= 4 || orderFromContext) && !isProductInquiry && scores.productInquiry < 6;

    return {
      intent: best,
      score: bestScore,
      norm: norm,
      wantsOrder: wantsOrder,
      isAffirm: scores.affirm >= 4 || agreed,
      isProductInquiry: isProductInquiry,
      isGreeting: scores.greeting >= 5,
      isGoodbye: scores.goodbye >= 5,
      isCatalog: scores.catalog >= 4 || isCatalogFollowUp(norm),
      isCatalogFollowUp: isCatalogFollowUp(norm),
      isPrice: scores.price >= 4,
      isIngredients: scores.ingredients >= 4,
      isUsage: scores.usage >= 5,
      isShipping: scores.shipping >= 5,
      isRoutine: scores.routine >= 4,
      isCompare: scores.compare >= 5,
      isThanks: scores.thanks >= 5,
      isCancel: scores.cancel >= 5,
      isAddMore: /كمان|برضه|وكمان|بالاضافه|كمان حاجه|حاجه تانيه/.test(norm),
      isRecommend: scores.recommend >= 5 || scores.suitability >= 5,
      isFace: /وش|وجه|face|فيس/.test(norm),
      isBody: /جسم|ايد|ايدين|ركبه|مرفق|ابط|body|hand/.test(norm),
      isResults: scores.results >= 5,
      isReturn: scores.returnPolicy >= 5,
      isPayment: scores.payment >= 5,
      isHelp: scores.help >= 4,
      concern: concern,
      concerns: concerns
    };
  }

  return { normalizeText: normalizeText, detectIntent: detectIntent, scoreOrder: scoreOrder };
})();
