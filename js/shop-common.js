window.MontanaShop = (function () {
  function esc(s) {
    if (s == null) return '';
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function sanitizeText(s, maxLen) {
    s = String(s == null ? '' : s).replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '').trim();
    if (maxLen && s.length > maxLen) s = s.slice(0, maxLen);
    return s;
  }

  function sanitizePhone(s) {
    return sanitizeText(s, 20).replace(/[^\d+\s\-()]/g, '');
  }

  function sanitizeId(s) {
    return String(s || '').replace(/[^A-Za-z0-9\-]/g, '').slice(0, 32);
  }

  var I18N = {
    en: {
      navStory: 'Story', navShop: 'Collection', navIngredients: 'Ingredients', navCart: 'Bag',
      shippingBar: 'Cairo & Giza delivery in 2–4 days · Free shipping over EGP 1,000 · Cash on delivery',
      quizCta: 'Find your routine',
      quizEyebrow: '✦ Skin Quiz', quizHint: 'Choose one option', quizStep1: 'Your concern', quizStep2: 'Your focus',
      quizResult: 'Your recommended routine', quizResultBadge: '✦ Your match', quizResultSub: 'Products picked for your skin',
      addRoutine: 'Add routine to bag', quizClose: 'Close',
      bundlesTitle: 'Curated Sets', bundlesSub: 'Save when you build your routine.',
      addBundle: 'Add set', save: 'Save',
      pairsWith: 'Pairs well with',
      completeRoutine: 'Complete your routine', routineHint: 'Not sure what you need?', takeQuiz: 'Take the skin quiz',
      gWhat: 'What it is', gWhy: 'Why it matters', gSkin: 'Best for',
      glossaryTitle: 'The <em>Science</em><br>Behind Every Formula',
      glossarySub: 'Clinical actives, botanical extracts, and vitamins — decoded for your skin.',
      ingIndex: 'Index', ingSearch: 'Search ingredients…', ingAll: 'All',
      ingCatActive: 'Actives', ingCatBotanical: 'Botanicals', ingCatVitamin: 'Vitamins', ingCatClinical: 'Specialized',
      ingInFormula: 'Found in', ingEmpty: 'No ingredients match your search.',
      ingStatTotal: 'Ingredients', ingStatActive: 'Actives', ingStatBotanical: 'Botanicals',
      whatsappCta: 'Confirm on WhatsApp',
      heroEyebrow: 'Montana Naturals · The Collection',
      heroTitle: 'Your skin story,<br><em>in six formulas.</em>',
      heroSub: 'Specialized formulas. Premium ingredients. Delivered to your door.',
      products: 'products', all: 'All', face: 'Face', body: 'Body', clinical: 'Specialized',
      addToBag: 'Add to Bag', viewProduct: 'View Product',
      added: 'Added to your bag',
      size: 'Size', ingredients: 'Ingredients', usage: 'How to Use', back: '← Back to Collection',
      cartTitle: 'Your Bag', cartEmpty: 'Your bag is empty', cartEmptySub: 'Discover the collection and begin your skin story.',
      subtotal: 'Subtotal', shipping: 'Shipping', free: 'Free', total: 'Total',
      shippingNote: 'Free shipping on orders over EGP 1,000. Cash on delivery available.',
      checkout: 'Proceed to Checkout', continue: 'Continue Shopping', remove: 'Remove',
      checkoutTitle: 'Checkout', checkoutSub: 'Complete your order — we\'ll handle the rest.',
      name: 'Full Name', phone: 'Phone',
      address: 'Address', notes: 'Notes (optional)',
      payment: 'Payment Method', cod: 'Cash on Delivery', card: 'Card (coming soon)',
      placeOrder: 'Place Order',
      depositTitle: '200 EGP deposit',
      depositUpload: 'Upload transfer proof',
      depositWaiting: 'Proof sent — waiting for admin approval',
      depositApproved: 'Approved — you can place your order',
      depositSent: 'Proof sent — you can place your order',
      depositRequired: 'Upload deposit proof (200 EGP) before placing order.',
      depositNotApproved: 'Waiting for admin approval on Telegram.',
      depositTimeout: 'Approval timed out — upload proof again',
      depositUploading: 'Sending proof to admin...',
      depositFailed: 'Could not upload proof — try again',
      orderThanks: 'Thank you', orderSub: 'Your order has been received. We\'ll contact you shortly to confirm delivery.',
      orderBack: 'Back to Collection', orderStory: 'Return to Story',
      footerPrivacy: 'Privacy Policy'
    },
    ar: {
      navStory: 'القصة', navShop: 'المتجر', navIngredients: 'المكونات', navCart: 'الشنطة',
      shippingBar: 'توصيل القاهرة والجيزة خلال ٢–٤ أيام · شحن مجاني فوق ١٠٠٠ ج.م · دفع عند الاستلام',
      quizCta: 'اكتشفي روتينك',
      quizEyebrow: '✦ اختبار بشرتك', quizHint: 'اختاري إجابة واحدة بس', quizStep1: 'مشكلتك', quizStep2: 'منطقة العناية',
      quizResult: 'الروتين المقترح ليكي', quizResultBadge: '✦ الأنسب ليكي', quizResultSub: 'منتجات مختارة لبشرتك',
      addRoutine: 'ضيفي الروتين للشنطة', quizClose: 'قفلي',
      bundlesTitle: 'مجموعات جاهزة', bundlesSub: 'وفّري لما تكمّلي روتينك.',
      addBundle: 'ضيفي المجموعة', save: 'وفّري',
      pairsWith: 'بيكمّل مع',
      completeRoutine: 'كمّلي روتينك', routineHint: 'مش متأكدة محتاجة إيه؟', takeQuiz: 'اعملي اختبار البشرة',
      gWhat: 'إيه هو', gWhy: 'ليه مهم', gSkin: 'مناسب لـ',
      glossaryTitle: 'العلم <em>ورا</em><br>كل تركيبة',
      glossarySub: 'مواد فعّالة ونباتات وفيتامينات — مشروحة لبشرتك.',
      ingIndex: 'الفهرس', ingSearch: 'ابحثي عن مكوّن…', ingAll: 'الكل',
      ingCatActive: 'مواد فعّالة', ingCatBotanical: 'نباتية', ingCatVitamin: 'فيتامينات', ingCatClinical: 'متخصص',
      ingInFormula: 'موجود في', ingEmpty: 'مفيش مكوّنات تطابق البحث.',
      ingStatTotal: 'مكوّن', ingStatActive: 'مواد فعّالة', ingStatBotanical: 'نباتية',
      whatsappCta: 'أكّدي على واتساب',
      heroEyebrow: 'مونتانا ناتشورالز · المجموعة',
      heroTitle: 'قصة بشرتك<br><em>في ٦ منتجات.</em>',
      heroSub: 'تركيبات متخصصة. مكونات فاخرة. توصيل لحد بابك.',
      products: 'منتج', all: 'الكل', face: 'الوجه', body: 'الجسم', clinical: 'متخصص',
      addToBag: 'ضيفي للشنطة', viewProduct: 'شوفي المنتج',
      added: 'اتضافت للشنطة',
      size: 'الحجم', ingredients: 'المكونات', usage: 'طريقة الاستخدام', back: '← رجوع للمتجر',
      cartTitle: 'شنطتك', cartEmpty: 'الشنطة فاضية', cartEmptySub: 'اكتشفي المجموعة وابدئي قصة بشرتك.',
      subtotal: 'المجموع', shipping: 'الشحن', free: 'مجاني', total: 'الإجمالي',
      shippingNote: 'شحن مجاني للطلبات فوق ١٠٠٠ ج.م. الدفع عند الاستلام متاح.',
      checkout: 'كمّلي الطلب', continue: 'كملي تسوق', remove: 'شيلي',
      checkoutTitle: 'إتمام الطلب', checkoutSub: 'كمّلي بياناتك — وإحنا هنتولى الباقي.',
      name: 'الاسم', phone: 'رقم التليفون',
      address: 'العنوان', notes: 'ملاحظات',
      payment: 'طريقة الدفع', cod: 'الدفع عند الاستلام', card: 'بطاقة (قريبًا)',
      placeOrder: 'أكّدي الطلب',
      depositTitle: 'تأكيد حجز 200 جنيه',
      depositUpload: 'رفع صورة التحويل',
      depositWaiting: 'تم إرسال الصورة — في انتظار موافقة المسؤول',
      depositApproved: 'تمت الموافقة — أكّدي الطلب',
      depositSent: 'تم إرسال الصورة — أكّدي الطلب',
      depositRequired: 'لازم ترفعي صورة التحويل (200 جنيه) قبل تأكيد الطلب.',
      depositNotApproved: 'لسه المسؤول موافقش — استني شوية.',
      depositTimeout: 'انتهى وقت الانتظار — جرّبي رفع الصورة تاني',
      depositUploading: 'بنرسل الصورة للمسؤول...',
      depositFailed: 'مش قدرنا نرفع الصورة — جرّبي تاني',
      orderThanks: 'شكرًا ليكي', orderSub: 'استلمنا طلبك. هنتواصل معاكي قريبًا لتأكيد التوصيل.',
      orderBack: 'رجوع للمتجر', orderStory: 'ارجعي للقصة',
      footerPrivacy: 'سياسة الخصوصية'
    }
  };

  function t(key) {
    var lang = window.MontanaCart ? MontanaCart.getLang() : 'en';
    return (I18N[lang] || I18N.en)[key] || key;
  }

  function toast(msg) {
    var el = document.getElementById('toast');
    if (!el) return;
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(el._t);
    el._t = setTimeout(function () { el.classList.remove('show'); }, 2800);
  }

  function updateBadge() {
    if (!window.MontanaCart) return;
    document.querySelectorAll('.cart-badge').forEach(function (b) {
      var n = MontanaCart.count();
      b.textContent = n;
      b.setAttribute('data-count', n);
    });
  }

  function initLang() {
    if (!window.MontanaCart) return;
    var lang = MontanaCart.getLang();
    document.documentElement.setAttribute('lang', lang);
    document.documentElement.setAttribute('dir', lang === 'ar' ? 'rtl' : 'ltr');
    var btnEn = document.getElementById('btn-en');
    var btnAr = document.getElementById('btn-ar');
    if (btnEn) btnEn.classList.toggle('on', lang === 'en');
    if (btnAr) btnAr.classList.toggle('on', lang === 'ar');
    if (window.MontanaAmbient) MontanaAmbient.onLangChange();
  }

  function bindLang() {
    if (!window.MontanaCart) return;
    var btnEn = document.getElementById('btn-en');
    var btnAr = document.getElementById('btn-ar');
    function pick(lang) {
      if (window.go) window.go(lang);
      if (MontanaCart.getLang() !== lang) MontanaCart.setLang(lang);
    }
    if (btnEn) btnEn.onclick = function () { pick('en'); };
    if (btnAr) btnAr.onclick = function () { pick('ar'); };
  }

  document.addEventListener('lang:changed', function () {
    initLang();
    bindNav();
  });

  function bindNav() {
    document.querySelectorAll('[data-i18n]').forEach(function (el) {
      var key = el.getAttribute('data-i18n');
      var html = t(key);
      if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') el.placeholder = html;
      else if (html.indexOf('<') !== -1) el.innerHTML = html;
      else el.textContent = html;
    });
    updateBadge();
  }

  var INGREDIENT_SLUGS = {
    'Zinc PCA': 'zinc-pca',
    'Salicylic Acid': 'salicylic',
    'Argan Oil': 'argan-oil',
    'Jojoba Oil': 'jojoba-oil',
    'Licorice Extract': 'licorice',
    'Vitamin C': 'vitamin-c',
    'Niacinamide': 'niacinamide',
    'Vitamin B3': 'niacinamide',
    'Alpha-Arbutin': 'alpha-arbutin',
    'Vitamin C & E': 'vitamin-c-e',
    'Glycerin': 'glycerin',
    'Shea Butter': 'shea-butter',
    'Coconut Oil': 'coconut-oil',
    'Vitamin E': 'vitamin-e',
    'Green Tea Extract': 'green-tea',
    'Sesame Oil': 'sesame-oil',
    'Vitamin E & B3': 'vitamin-e-b3',
    'Medical Silicone': 'silicone',
    'Medical-Grade Silicone': 'silicone'
  };

  function ingredientHref(name) {
    name = String(name || '').trim();
    var id = INGREDIENT_SLUGS[name];
    return id ? 'ingredients.html#' + id : null;
  }

  function ingredientChip(name, extraClass) {
    var href = ingredientHref(name);
    var cls = esc((extraClass || 'ingr-link').trim());
    if (href) return '<a href="' + esc(href) + '" class="' + cls + '">' + esc(name) + '</a>';
    return '<span class="' + esc(cls === 'ingr-link' ? 'ingr-chip' : cls) + '">' + esc(name) + '</span>';
  }

  function bindIngredientLinks(root) {
    (root || document).querySelectorAll('.pi, .pdp-ingr span').forEach(function (el) {
      if (el.tagName === 'A') return;
      var name = el.textContent.trim();
      var href = ingredientHref(name);
      if (!href) return;
      var a = document.createElement('a');
      a.href = href;
      a.className = el.className + ' ingr-link';
      a.textContent = name;
      el.parentNode.replaceChild(a, el);
    });
  }

  function getIngredientIdFromUrl() {
    var hash = (location.hash || '').replace(/^#/, '').trim();
    if (hash) return decodeURIComponent(hash);
    try {
      var saved = sessionStorage.getItem('montana_ingr');
      if (saved) return saved;
    } catch (e) {}
    return null;
  }

  function saveIngredientNav(id) {
    id = String(id || '').trim();
    if (!id) return;
    try { sessionStorage.setItem('montana_ingr', id); } catch (e) {}
  }

  document.addEventListener('click', function (e) {
    var a = e.target.closest('a.ingr-link');
    if (!a) return;
    var href = a.getAttribute('href') || '';
    var i = href.indexOf('#');
    if (i !== -1) saveIngredientNav(href.slice(i + 1));
  }, true);

  function getProductIdFromUrl() {
    var q = new URLSearchParams(location.search).get('id');
    if (q) return decodeURIComponent(String(q).trim());
    var hash = (location.hash || '').replace(/^#/, '').trim();
    if (!hash) {
      try {
        var saved = sessionStorage.getItem('montana_pdp');
        if (saved) return saved;
      } catch (e) {}
      return null;
    }
    if (hash.indexOf('id=') === 0) return decodeURIComponent(hash.slice(3).trim());
    return decodeURIComponent(hash);
  }

  function getProduct(id) {
    id = id || getProductIdFromUrl();
    if (!id) return null;
    id = decodeURIComponent(String(id).trim());
    return (window.MONTANA_PRODUCTS || []).find(function (p) { return p.id === id; });
  }

  function field(obj) {
    var lang = MontanaCart.getLang();
    if (obj && typeof obj === 'object' && (obj.en != null || obj.ar != null)) {
      return obj[lang] || obj.en;
    }
    return obj;
  }

  document.addEventListener('cart:updated', updateBadge);

  return {
    t: t, toast: toast, updateBadge: updateBadge, initLang: initLang, bindLang: bindLang, bindNav: bindNav,
    getProduct: getProduct, getProductIdFromUrl: getProductIdFromUrl, getIngredientIdFromUrl: getIngredientIdFromUrl,
    saveIngredientNav: saveIngredientNav, ingredientHref: ingredientHref, ingredientChip: ingredientChip,
    bindIngredientLinks: bindIngredientLinks, field: field,
    esc: esc, sanitizeText: sanitizeText, sanitizePhone: sanitizePhone, sanitizeId: sanitizeId
  };
})();
