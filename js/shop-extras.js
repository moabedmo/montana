window.MontanaShopExtras = (function () {
  var WHATSAPP = '201000000000'; /* غيّري الرقم لرقم واتساب المتجر */

  var BUNDLES = [
    {
      id: 'brightening-set',
      name: { en: 'Brightening Duo', ar: 'ثنائي التفتيح' },
      desc: { en: 'Cleanser + cream for even, luminous tone.', ar: 'غسول + كريم لبشرة موحّدة ونضرة.' },
      ids: ['whitening-cleanser', 'whitening-cream'],
      discount: 0.05
    },
    {
      id: 'recovery-set',
      name: { en: 'Recovery Duo', ar: 'ثنائي التعافي' },
      desc: { en: 'Post-laser care + scar repair.', ar: 'عناية بعد الليزر + علاج الندوب.' },
      ids: ['post-laser', 'anti-scar'],
      discount: 0.08
    },
    {
      id: 'full-story',
      name: { en: 'Complete Collection', ar: 'المجموعة الكاملة' },
      desc: { en: 'All six formulas — your full skin story.', ar: 'الـ ٦ منتجات — قصة بشرتك كاملة.' },
      ids: ['acne-cleanser', 'whitening-cleanser', 'whitening-cream', 'body-lotion', 'post-laser', 'anti-scar'],
      discount: 0.10
    }
  ];

  var PAIRS = {
    'acne-cleanser': ['whitening-cleanser'],
    'whitening-cleanser': ['whitening-cream'],
    'whitening-cream': ['whitening-cleanser'],
    'body-lotion': ['whitening-cleanser'],
    'post-laser': ['anti-scar'],
    'anti-scar': ['post-laser']
  };

  var QUIZ = {
    steps: [
      {
        key: 'concern',
        q: { en: 'What is your main skin concern?', ar: 'إيه أكتر مشكلة بتواجهيها في بشرتك؟' },
        opts: [
          { v: 'acne', l: { en: 'Breakouts & oily skin', ar: 'حبوب وبشرة دهنية' } },
          { v: 'dull', l: { en: 'Dull, uneven tone', ar: 'بهتان ولون مش موحّد' } },
          { v: 'spots', l: { en: 'Dark spots', ar: 'بقع واسمرار' } },
          { v: 'dry', l: { en: 'Dryness & tightness', ar: 'جفاف وتشدد' } },
          { v: 'laser', l: { en: 'After laser or treatment', ar: 'بعد الليزر أو إجراء' } },
          { v: 'scars', l: { en: 'Scars & keloids', ar: 'ندوب وجرح قديم' } }
        ]
      },
      {
        key: 'area',
        q: { en: 'Where do you need care most?', ar: 'فين محتاجة العناية أكتر؟' },
        opts: [
          { v: 'face', l: { en: 'Face', ar: 'الوجه' } },
          { v: 'body', l: { en: 'Body', ar: 'الجسم' } },
          { v: 'both', l: { en: 'Face & body', ar: 'الوجه والجسم' } }
        ]
      }
    ],
    map: {
      acne: ['acne-cleanser'],
      dull: ['whitening-cleanser', 'whitening-cream'],
      spots: ['whitening-cream'],
      dry: ['body-lotion'],
      laser: ['post-laser'],
      scars: ['anti-scar']
    }
  };

  window.MONTANA_GLOSSARY = [
    { id: 'zinc-pca', name: 'Zinc PCA', cat: 'active', role: { en: 'Sebum regulator', ar: 'منظّم للزهم' }, products: ['acne-cleanser', 'whitening-cleanser'], what: { en: 'A zinc salt that regulates sebum production.', ar: 'ملح زنك بيظبط إفراز الزهم في البشرة.' }, why: { en: 'Reduces oiliness and helps prevent breakouts at the source.', ar: 'بيقلّل الدهون وبيمنع الحبوب من أصلها.' }, skin: { en: 'Oily & acne-prone', ar: 'بشرة دهنية ومعرضة للحبوب' } },
    { id: 'salicylic', name: 'Salicylic Acid', cat: 'active', role: { en: 'BHA · Pore refiner', ar: 'BHA · يصفّي المسام' }, products: ['acne-cleanser'], what: { en: 'A BHA that penetrates inside pores.', ar: 'حمض BHA بينفذ جوه المسام.' }, why: { en: 'Dissolves clogged pores and clears congestion.', ar: 'بيفك الانسداد وبيصفّي المسام من جوا.' }, skin: { en: 'Oily, congested skin', ar: 'بشرة دهنية ومسام مسدودة' } },
    { id: 'licorice', name: 'Licorice Extract', cat: 'botanical', role: { en: 'Brightening botanical', ar: 'نباتي للتفتيح' }, products: ['whitening-cleanser'], what: { en: 'A botanical that inhibits melanin transfer.', ar: 'مستخلص عرق السوس بيقلّل نقل الميلانين.' }, why: { en: 'Brightens and evens skin tone naturally.', ar: 'بينوّر البشرة ويوحّد اللون بشكل طبيعي.' }, skin: { en: 'All skin types', ar: 'كل أنواع البشرة' } },
    { id: 'niacinamide', name: 'Niacinamide', cat: 'vitamin', role: { en: 'Vitamin B3 · Barrier', ar: 'فيتامين B3 · حاجز' }, products: ['whitening-cleanser', 'whitening-cream'], what: { en: 'Vitamin B3 that strengthens the skin barrier.', ar: 'فيتامين B3 بيقوّي حاجز البشرة.' }, why: { en: 'Unifies tone, reduces redness, and supports repair.', ar: 'بيوحّد اللون، بيقلّل الاحمرار، وبيساعد التعافي.' }, skin: { en: 'All skin types', ar: 'كل أنواع البشرة' } },
    { id: 'alpha-arbutin', name: 'Alpha-Arbutin', cat: 'active', role: { en: 'Spot fader', ar: 'يخفّي البقع' }, products: ['whitening-cream'], what: { en: 'A depigmenting agent that blocks tyrosinase.', ar: 'مادة تفتيح بتوقف إنزيم التيروزيناز.' }, why: { en: 'Fades dark spots and prevents new ones.', ar: 'بتخفّي البقع وتمنع ظهور جديد.' }, skin: { en: 'Hyperpigmentation', ar: 'بقع واسمرار' } },
    { id: 'glycerin', name: 'Glycerin', cat: 'active', role: { en: 'Humectant', ar: 'مرطّب' }, products: ['body-lotion'], what: { en: 'A humectant that draws moisture into skin.', ar: 'مرطّب بيسحب المية لجوا البشرة.' }, why: { en: 'Delivers deep, lasting hydration.', ar: 'بيوفّر ترطيب عميق يدوم.' }, skin: { en: 'Dry & dehydrated', ar: 'بشرة جافة وعطشانة' } },
    { id: 'green-tea', name: 'Green Tea Extract', cat: 'botanical', role: { en: 'Anti-inflammatory', ar: 'مضاد للالتهاب' }, products: ['post-laser'], what: { en: 'A powerful antioxidant with anti-inflammatory action.', ar: 'مضاد أكسدة قوي بيقلّل الالتهاب.' }, why: { en: 'Soothes redness and calms post-procedure skin.', ar: 'بيهدّي الاحمرار ويهدّي البشرة بعد الإجراءات.' }, skin: { en: 'Sensitive, post-treatment', ar: 'بشرة حساسة وبعد علاج' } },
    { id: 'silicone', name: 'Medical Silicone', cat: 'clinical', role: { en: 'Scar therapy', ar: 'علاج الندوب' }, products: ['anti-scar'], what: { en: 'Clinical-grade silicone gel for scar management.', ar: 'جل سيليكون طبي لعلاج الندوب.' }, why: { en: 'Regulates collagen to flatten and fade scars.', ar: 'بيظبط الكولاجين عشان الندبة تنبسط وتخف.' }, skin: { en: 'Scars & keloids', ar: 'ندوب وجرح' } },
    { id: 'argan-oil', name: 'Argan Oil', cat: 'botanical', role: { en: 'Barrier oil', ar: 'زيت للحاجز' }, products: ['acne-cleanser'], what: { en: 'A nourishing oil rich in vitamin E and fatty acids.', ar: 'زيت مغذّي غني بفيتامين E والأحماض الدهنية.' }, why: { en: 'Restores the skin barrier without clogging pores.', ar: 'بيرجّع حاجز البشرة من غير ما يسد المسام.' }, skin: { en: 'Dry & compromised barrier', ar: 'بشرة جافة وحاجز ضعيف' } },
    { id: 'jojoba-oil', name: 'Jojoba Oil', cat: 'botanical', role: { en: 'Sebum mimic', ar: 'يوازن الدهون' }, products: ['acne-cleanser'], what: { en: 'A plant wax that mimics skin\'s natural sebum.', ar: 'شمع نباتي شبيه بالزهم الطبيعي للبشرة.' }, why: { en: 'Balances oil production and soothes irritation.', ar: 'بيوازن الدهون ويهدّي التهيّج.' }, skin: { en: 'Oily & combination', ar: 'بشرة دهنية ومختلطة' } },
    { id: 'vitamin-c', name: 'Vitamin C', cat: 'vitamin', role: { en: 'Antioxidant brightener', ar: 'مضاد أكسدة للتفتيح' }, products: ['whitening-cleanser'], what: { en: 'A potent antioxidant that brightens and protects.', ar: 'مضاد أكسدة قوي بينوّر وبيحمي.' }, why: { en: 'Fades dullness and shields against environmental damage.', ar: 'بيمسح البهتان وبيحمي من عوامل البيئة.' }, skin: { en: 'Dull & uneven tone', ar: 'بهتان ولون مش موحّد' } },
    { id: 'vitamin-c-e', name: 'Vitamin C & E', cat: 'vitamin', role: { en: 'Antioxidant duo', ar: 'ثنائي مضادات أكسدة' }, products: ['whitening-cream'], what: { en: 'Antioxidant duo that neutralizes free radicals.', ar: 'ثنائي مضادات أكسدة بيعالج الجذور الحرة.' }, why: { en: 'Protects skin while supporting spot fading.', ar: 'بيحمي البشرة ويساعد البقع تخف.' }, skin: { en: 'Hyperpigmentation', ar: 'بقع واسمرار' } },
    { id: 'shea-butter', name: 'Shea Butter', cat: 'botanical', role: { en: 'Rich emollient', ar: 'مرطّب غني' }, products: ['body-lotion'], what: { en: 'A rich emollient from shea tree nuts.', ar: 'مرطّب غني من جوز شجرة الشيا.' }, why: { en: 'Seals moisture and softens rough skin.', ar: 'بيحبس الرطوبة وينعّم البشرة الخشنة.' }, skin: { en: 'Dry body skin', ar: 'بشرة جسم جافة' } },
    { id: 'coconut-oil', name: 'Coconut Oil', cat: 'botanical', role: { en: 'Lipid seal', ar: 'يحبس الترطيب' }, products: ['body-lotion'], what: { en: 'A lightweight lipid that reinforces the moisture barrier.', ar: 'دهون خفيفة بتقوّي حاجز الترطيب.' }, why: { en: 'Locks hydration for long-lasting comfort.', ar: 'بتقفل الترطيب لراحة تدوم.' }, skin: { en: 'Dehydrated skin', ar: 'بشرة عطشانة' } },
    { id: 'vitamin-e', name: 'Vitamin E', cat: 'vitamin', role: { en: 'Cell defender', ar: 'يحمي الخلايا' }, products: ['body-lotion', 'anti-scar'], what: { en: 'A fat-soluble antioxidant that defends skin cells.', ar: 'مضاد أكسدة يذوب في الدهون وبيدافع عن خلايا البشرة.' }, why: { en: 'Supports repair and prevents premature aging.', ar: 'بيساعد التعافي وبيمنع علامات التعب المبكرة.' }, skin: { en: 'All skin types', ar: 'كل أنواع البشرة' } },
    { id: 'sesame-oil', name: 'Sesame Oil', cat: 'botanical', role: { en: 'Recovery oil', ar: 'زيت للتعافي' }, products: ['post-laser'], what: { en: 'A traditional oil rich in sesamin and fatty acids.', ar: 'زيت تقليدي غني بالسيسامين والأحماض الدهنية.' }, why: { en: 'Rebuilds the lipid barrier after stress or treatment.', ar: 'بيرجّع الحاجز الدهني بعد التوتر أو العلاج.' }, skin: { en: 'Sensitive & post-treatment', ar: 'بشرة حساسة وبعد علاج' } },
    { id: 'vitamin-e-b3', name: 'Vitamin E & B3', cat: 'vitamin', role: { en: 'Repair complex', ar: 'مركّب للتعافي' }, products: ['post-laser'], what: { en: 'Repair-focused vitamins that calm and rebuild.', ar: 'فيتامينات للتعافي بتهدّي وتبني من جديد.' }, why: { en: 'Accelerates recovery and strengthens the barrier.', ar: 'بتسرّع التعافي وتقوّي حاجز البشرة.' }, skin: { en: 'Post-procedure', ar: 'بعد الإجراءات' } }
  ];

  var ING_CATS = [
    { id: 'all', labelKey: 'ingAll' },
    { id: 'active', labelKey: 'ingCatActive' },
    { id: 'botanical', labelKey: 'ingCatBotanical' },
    { id: 'vitamin', labelKey: 'ingCatVitamin' },
    { id: 'clinical', labelKey: 'ingCatClinical' }
  ];

  var _ingFilter = 'all';
  var _ingQuery = '';

  function catLabel(cat) {
    var map = {
      active: 'ingCatActive',
      botanical: 'ingCatBotanical',
      vitamin: 'ingCatVitamin',
      clinical: 'ingCatClinical'
    };
    return MontanaShop.t(map[cat] || 'ingCatActive');
  }

  function filteredGlossary() {
    var q = _ingQuery.trim().toLowerCase();
    return window.MONTANA_GLOSSARY.filter(function (g) {
      if (_ingFilter !== 'all' && g.cat !== _ingFilter) return false;
      if (!q) return true;
      var hay = (g.name + ' ' + f(g.what) + ' ' + f(g.why) + ' ' + f(g.skin) + ' ' + f(g.role || '')).toLowerCase();
      return hay.indexOf(q) !== -1;
    });
  }

  function glossaryStats() {
    var all = window.MONTANA_GLOSSARY;
    return {
      total: all.length,
      active: all.filter(function (g) { return g.cat === 'active'; }).length,
      botanical: all.filter(function (g) { return g.cat === 'botanical'; }).length
    };
  }

  function productLinksHtml(ids) {
    if (!ids || !ids.length) return '';
    return ids.map(function (pid) {
      var p = MontanaShop.getProduct(pid);
      if (!p) return '';
      return '<a href="product.html#' + esc(pid) + '" class="ing-product-link">' +
        '<img src="' + esc(p.image) + '" alt="" loading="lazy">' +
        '<span>' + esc(f(p.name)) + '</span>' +
      '</a>';
    }).join('');
  }

  function renderIndex(list) {
    var nav = document.getElementById('ing-index');
    if (!nav) return;
    nav.innerHTML =
      '<span class="ing-index-label" data-i18n="ingIndex">' + esc(MontanaShop.t('ingIndex')) + '</span>' +
      '<nav class="ing-index-list" aria-label="' + esc(MontanaShop.t('ingIndex')) + '">' +
        list.map(function (g) {
          return '<a href="#' + esc(g.id) + '" class="ing-index-link" data-ing-nav="' + esc(g.id) + '">' + esc(g.name) + '</a>';
        }).join('') +
      '</nav>';
    nav.querySelectorAll('[data-ing-nav]').forEach(function (a) {
      a.onclick = function (e) {
        e.preventDefault();
        var id = a.getAttribute('data-ing-nav');
        try { history.replaceState(null, '', '#' + id); } catch (err) {}
        scrollToGlossary();
      };
    });
  }

  function renderFilters() {
    var bar = document.getElementById('ing-filters');
    if (!bar) return;
    bar.innerHTML = ING_CATS.map(function (c) {
      return '<button type="button" class="ing-filter' + (_ingFilter === c.id ? ' is-active' : '') + '" data-ing-filter="' + esc(c.id) + '">' +
        esc(MontanaShop.t(c.labelKey)) +
      '</button>';
    }).join('');
    bar.querySelectorAll('[data-ing-filter]').forEach(function (btn) {
      btn.onclick = function () {
        _ingFilter = btn.getAttribute('data-ing-filter');
        renderGlossary(document.getElementById('glossary-root'));
      };
    });
  }

  function bindSearch() {
    var input = document.getElementById('ing-search');
    if (!input || input._ingBound) return;
    input._ingBound = true;
    input.placeholder = MontanaShop.t('ingSearch');
    input.addEventListener('input', function () {
      _ingQuery = input.value;
      renderGlossary(document.getElementById('glossary-root'));
    });
  }

  function bindIndexObserver() {
    if (!window.IntersectionObserver) return;
    var links = document.querySelectorAll('[data-ing-nav]');
    if (!links.length) return;
    var map = {};
    links.forEach(function (a) { map[a.getAttribute('data-ing-nav')] = a; });
    var obs = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        var id = en.target.id;
        links.forEach(function (a) { a.classList.remove('is-active'); });
        if (map[id]) map[id].classList.add('is-active');
      });
    }, { rootMargin: '-30% 0px -55% 0px', threshold: 0 });
    document.querySelectorAll('.ing-card').forEach(function (card) { obs.observe(card); });
  }

  function f(obj) { return MontanaShop.field(obj); }
  function esc(s) { return MontanaShop.esc(s); }

  function bundlePrice(bundle) {
    var sum = bundle.ids.reduce(function (s, id) {
      var p = MontanaShop.getProduct(id);
      return s + (p ? p.price : 0);
    }, 0);
    return Math.round(sum * (1 - bundle.discount));
  }

  function bundleOriginal(bundle) {
    return bundle.ids.reduce(function (s, id) {
      var p = MontanaShop.getProduct(id);
      return s + (p ? p.price : 0);
    }, 0);
  }

  function addProducts(ids) {
    ids.forEach(function (id) { MontanaCart.add(id); });
    MontanaShop.toast(MontanaShop.t('added'));
  }

  function getPairsFor(id) {
    return (PAIRS[id] || []).map(function (pid) { return MontanaShop.getProduct(pid); }).filter(Boolean);
  }

  function cartSuggestions() {
    var inCart = {};
    MontanaCart.get().forEach(function (i) { inCart[i.id] = true; });
    var suggested = {};
    MontanaCart.get().forEach(function (item) {
      (PAIRS[item.id] || []).forEach(function (pid) {
        if (!inCart[pid]) suggested[pid] = true;
      });
    });
    return Object.keys(suggested).map(function (id) { return MontanaShop.getProduct(id); }).filter(Boolean);
  }

  function quizResult(answers) {
    var ids = QUIZ.map[answers.concern] || ['whitening-cleanser'];
    if (answers.area === 'body' && answers.concern !== 'dry' && answers.concern !== 'scars') {
      if (ids.indexOf('body-lotion') === -1) ids = ids.concat(['body-lotion']);
    }
    var seen = {};
    return ids.filter(function (id) { if (seen[id]) return false; seen[id] = true; return true; });
  }

  function getOrder(id) {
    id = MontanaShop.sanitizeId(id);
    if (!id) return null;
    try {
      var orders = JSON.parse(localStorage.getItem('montana_orders')) || [];
      return orders.find(function (o) { return o.id === id; });
    } catch (e) { return null; }
  }

  function whatsAppLink(order) {
    var ar = MontanaCart.getLang() === 'ar';
    var lines = [
      ar ? 'طلب جديد — مونتانا ناتشورالز' : 'New order — Montana Naturals',
      (ar ? 'رقم الطلب: ' : 'Order: ') + order.id,
      (ar ? 'الاسم: ' : 'Name: ') + order.customer.name,
      (ar ? 'التليفون: ' : 'Phone: ') + order.customer.phone,
      (ar ? 'العنوان: ' : 'Address: ') + order.customer.address
    ];
    if (order.customer.notes) lines.push((ar ? 'ملاحظات: ' : 'Notes: ') + order.customer.notes);
    lines.push('');
    order.items.forEach(function (item) {
      lines.push('• ' + item.name + ' × ' + item.qty);
    });
    lines.push('');
    lines.push((ar ? 'الإجمالي: ' : 'Total: ') + MontanaCart.formatPrice(order.total));
    return 'https://wa.me/' + WHATSAPP + '?text=' + encodeURIComponent(lines.join('\n'));
  }

  function renderBundles(container) {
    if (!container) return;
    container.innerHTML =
      '<div class="section-head">' +
        '<h2 class="section-title" data-i18n="bundlesTitle">Curated Sets</h2>' +
        '<p class="section-sub" data-i18n="bundlesSub">Save when you build your routine.</p>' +
      '</div>' +
      '<div class="bundles-grid">' + BUNDLES.map(function (b) {
        var orig = bundleOriginal(b);
        var price = bundlePrice(b);
        var save = orig - price;
        return '<article class="bundle-card">' +
          '<h3 class="bundle-name">' + esc(f(b.name)) + '</h3>' +
          '<p class="bundle-desc">' + esc(f(b.desc)) + '</p>' +
          '<div class="bundle-items">' + b.ids.map(function (id) {
            var p = MontanaShop.getProduct(id);
            return p ? '<span>' + esc(f(p.name)) + '</span>' : '';
          }).join('') + '</div>' +
          '<div class="bundle-foot">' +
            '<div class="bundle-prices">' +
              '<span class="bundle-price">' + MontanaCart.formatPrice(price) + '</span>' +
              '<span class="bundle-save">' + esc(MontanaShop.t('save')) + ' ' + MontanaCart.formatPrice(save) + '</span>' +
            '</div>' +
            '<button type="button" class="card-add" data-bundle="' + esc(b.id) + '">' + esc(MontanaShop.t('addBundle')) + '</button>' +
          '</div>' +
        '</article>';
      }).join('') + '</div>';

    MontanaShop.bindNav();
    container.querySelectorAll('[data-bundle]').forEach(function (btn) {
      btn.onclick = function () {
        var b = BUNDLES.find(function (x) { return x.id === btn.getAttribute('data-bundle'); });
        if (b) addProducts(b.ids);
      };
    });
  }

  function renderPairsWith(productId, container) {
    if (!container) return;
    var pairs = getPairsFor(productId);
    if (!pairs.length) { container.innerHTML = ''; return; }
    container.innerHTML =
      '<div class="pairs-block">' +
        '<div class="pairs-label" data-i18n="pairsWith">Pairs well with</div>' +
        '<div class="pairs-list">' + pairs.map(function (rp) {
          return '<a href="product.html#' + esc(rp.id) + '" class="pair-chip">' +
            '<img src="' + esc(rp.image) + '" alt="' + esc(f(rp.name)) + '">' +
            '<span>' + esc(f(rp.name)) + '</span>' +
            '<button type="button" class="pair-add" data-add-pair="' + esc(rp.id) + '">+</button>' +
          '</a>';
        }).join('') + '</div>' +
      '</div>';
    MontanaShop.bindNav();
    container.querySelectorAll('[data-add-pair]').forEach(function (btn) {
      btn.onclick = function (e) {
        e.preventDefault();
        e.stopPropagation();
        MontanaCart.add(btn.getAttribute('data-add-pair'));
        MontanaShop.toast(MontanaShop.t('added'));
      };
    });
  }

  function renderCartExtras(container) {
    if (!container) return;
    var suggestions = cartSuggestions();
    if (!suggestions.length) {
      container.innerHTML =
        '<div class="cart-extras">' +
          '<p class="cart-extras-label" data-i18n="routineHint">Not sure what you need?</p>' +
          '<a href="shop.html#quiz" class="btn-ghost" data-i18n="takeQuiz">Take the skin quiz</a>' +
        '</div>';
      MontanaShop.bindNav();
      return;
    }
    container.innerHTML =
      '<div class="cart-extras">' +
        '<h3 class="cart-extras-title" data-i18n="completeRoutine">Complete your routine</h3>' +
        '<div class="pairs-list">' + suggestions.map(function (p) {
          return '<a href="product.html#' + esc(p.id) + '" class="pair-chip">' +
            '<img src="' + esc(p.image) + '" alt="' + esc(f(p.name)) + '">' +
            '<span>' + esc(f(p.name)) + '</span>' +
            '<button type="button" class="pair-add" data-add-pair="' + esc(p.id) + '">+</button>' +
          '</a>';
        }).join('') + '</div>' +
      '</div>';
    MontanaShop.bindNav();
    container.querySelectorAll('[data-add-pair]').forEach(function (btn) {
      btn.onclick = function (e) {
        e.preventDefault();
        e.stopPropagation();
        MontanaCart.add(btn.getAttribute('data-add-pair'));
        if (typeof window.renderCart === 'function') window.renderCart();
        else location.reload();
        MontanaShop.toast(MontanaShop.t('added'));
      };
    });
  }

  function renderGlossary(container) {
    if (!container) return;
    var list = filteredGlossary();
    renderIndex(list);
    renderFilters();
    bindSearch();

    if (!list.length) {
      container.innerHTML = '<p class="ing-empty" data-i18n="ingEmpty">' + esc(MontanaShop.t('ingEmpty')) + '</p>';
      MontanaShop.bindNav();
      return;
    }

    container.innerHTML = list.map(function (g, i) {
      var num = (i + 1) < 10 ? '0' + (i + 1) : String(i + 1);
      var role = g.role ? '<span class="ing-card-role">' + esc(f(g.role)) + '</span>' : '';
      var products = productLinksHtml(g.products);
      var foot = products
        ? '<div class="ing-card-foot">' +
            '<span class="ing-formula-label" data-i18n="ingInFormula">' + esc(MontanaShop.t('ingInFormula')) + '</span>' +
            products +
          '</div>'
        : '';
      return '<article class="glossary-card ing-card" id="' + esc(g.id) + '" data-cat="' + esc(g.cat || '') + '">' +
        '<div class="ing-card-inner">' +
          '<div class="ing-card-head">' +
            '<div class="ing-card-title-wrap">' +
              '<span class="ing-card-num">' + num + '</span>' +
              '<h2 class="glossary-name ing-card-name">' + esc(g.name) + '</h2>' +
              role +
            '</div>' +
            '<span class="ing-cat-badge">' + esc(catLabel(g.cat)) + '</span>' +
          '</div>' +
          '<div class="ing-card-body">' +
            '<div class="glossary-row ing-detail">' +
              '<span class="ing-detail-label" data-i18n="gWhat">' + esc(MontanaShop.t('gWhat')) + '</span>' +
              '<p class="ing-detail-text">' + esc(f(g.what)) + '</p>' +
            '</div>' +
            '<div class="glossary-row ing-detail">' +
              '<span class="ing-detail-label" data-i18n="gWhy">' + esc(MontanaShop.t('gWhy')) + '</span>' +
              '<p class="ing-detail-text">' + esc(f(g.why)) + '</p>' +
            '</div>' +
            '<div class="glossary-row ing-detail">' +
              '<span class="ing-detail-label" data-i18n="gSkin">' + esc(MontanaShop.t('gSkin')) + '</span>' +
              '<p class="ing-detail-text">' + esc(f(g.skin)) + '</p>' +
            '</div>' +
          '</div>' +
          foot +
        '</div>' +
      '</article>';
    }).join('');

    MontanaShop.bindNav();
    bindIndexObserver();
  }

  function scrollToGlossary() {
    var hash = MontanaShop.getIngredientIdFromUrl();
    if (!hash) return;
    if (!(location.hash || '').replace(/^#/, '').trim()) {
      try {
        history.replaceState(null, '', location.pathname + location.search + '#' + hash);
      } catch (e) {}
    }
    function highlight() {
      document.querySelectorAll('.glossary-card.glossary-highlight, .ing-card.ing-highlight').forEach(function (c) {
        c.classList.remove('glossary-highlight', 'ing-highlight');
      });
      var el = document.getElementById(hash);
      if (!el) return false;
      el.classList.add('glossary-highlight', 'ing-highlight');
      document.querySelectorAll('[data-ing-nav]').forEach(function (a) {
        a.classList.toggle('is-active', a.getAttribute('data-ing-nav') === hash);
      });
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return true;
    }
    requestAnimationFrame(function () {
      if (!highlight()) setTimeout(highlight, 150);
    });
  }

  function initGlossaryPage() {
    var stats = glossaryStats();
    var statRoot = document.getElementById('ing-stats');
    if (statRoot) {
      statRoot.innerHTML =
        '<div class="ing-stat"><span class="ing-stat-num">' + stats.total + '</span><span class="ing-stat-label" data-i18n="ingStatTotal">' + esc(MontanaShop.t('ingStatTotal')) + '</span></div>' +
        '<div class="ing-stat"><span class="ing-stat-num">' + stats.active + '</span><span class="ing-stat-label" data-i18n="ingStatActive">' + esc(MontanaShop.t('ingStatActive')) + '</span></div>' +
        '<div class="ing-stat"><span class="ing-stat-num">' + stats.botanical + '</span><span class="ing-stat-label" data-i18n="ingStatBotanical">' + esc(MontanaShop.t('ingStatBotanical')) + '</span></div>';
    }
    renderGlossary(document.getElementById('glossary-root'));
    scrollToGlossary();
    if (!window._glossaryHashBound) {
      window._glossaryHashBound = true;
      window.addEventListener('hashchange', scrollToGlossary);
    }
  }

  function ensureQuizShell() {
    if (!document.querySelector('link[href*="quiz.css"]')) {
      var link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = 'css/quiz.css';
      document.head.appendChild(link);
    }
    if (!document.getElementById('quiz-modal')) {
      document.body.insertAdjacentHTML('beforeend',
        '<div id="quiz-modal" class="quiz-modal" aria-hidden="true">' +
          '<div class="quiz-backdrop"></div>' +
          '<div class="quiz-panel">' +
            '<button type="button" class="quiz-close-btn" aria-label="Close">' +
              '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>' +
            '</button>' +
            '<div id="quiz-body"></div>' +
          '</div>' +
        '</div>');
    }
    if (!document.getElementById('quiz-fab-wrap') && !document.querySelector('.quiz-trigger')) {
      document.body.insertAdjacentHTML('beforeend',
        '<div id="quiz-fab-wrap">' +
          '<button type="button" id="quiz-fab" class="quiz-trigger" aria-label="Skin quiz">' +
            '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M12 3l1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5L12 3z"/><path d="M5 19l1 3 1-3 3-1-3-1-1-3-1 3-3 1 3 1z"/></svg>' +
            '<span data-i18n="quizCta">Find your routine</span>' +
          '</button>' +
        '</div>');
      if (window.MontanaShop) MontanaShop.bindNav();
    }
  }

  function initQuiz() {
    ensureQuizShell();
    var modal = document.getElementById('quiz-modal');
    var body = document.getElementById('quiz-body');
    if (!modal || !body) return;

    var step = 0;
    var answers = {};

    var QUIZ_ICONS = {
      acne: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="3"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/></svg>',
      dull: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 3v2M12 19v2M5 12H3M21 12h-2M6.3 6.3L4.9 4.9M19.1 19.1l-1.4-1.4M6.3 17.7l-1.4 1.4M19.1 4.9l-1.4 1.4"/><circle cx="12" cy="12" r="4"/></svg>',
      spots: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="8" cy="9" r="2"/><circle cx="16" cy="14" r="2.5"/><circle cx="11" cy="16" r="1.5"/></svg>',
      dry: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 2.5c-3 4-5 7-5 10a5 5 0 0010 0c0-3-2-6-5-10z"/></svg>',
      laser: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 3l2 5 5 2-5 2-2 5-2-5-5-2 5-2 2-5z"/><path d="M4 14l1 2 2 1-2 1-1 2-1-2-2-1 2-1 1-2z"/></svg>',
      scars: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M4 12c2-4 5-6 8-6s6 2 8 6c-2 4-5 6-8 6s-6-2-8-6z"/><path d="M8 12h8" stroke-dasharray="2 3"/></svg>',
      face: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="10" r="4"/><path d="M6 20c0-3.3 2.7-6 6-6s6 2.7 6 6"/></svg>',
      body: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 4v16M8 8h8M9 20h6"/></svg>',
      both: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="9" cy="9" r="3"/><circle cx="16" cy="14" r="3"/><path d="M6 20c0-2.5 1.5-4 3-4M15 20c0-2.5 1.5-4 3-4"/></svg>'
    };

    function quizIcon(v) {
      return QUIZ_ICONS[v] || QUIZ_ICONS.face;
    }

    function quizHeader(currentStep) {
      var total = QUIZ.steps.length;
      var pct = ((currentStep + 1) / total) * 100;
      var stepName = currentStep === 0 ? MontanaShop.t('quizStep1') : MontanaShop.t('quizStep2');
      return '<div class="quiz-head">' +
        '<span class="quiz-eyebrow" data-i18n="quizEyebrow">' + esc(MontanaShop.t('quizEyebrow')) + '</span>' +
        '<div class="quiz-step-meta">' +
          '<span class="quiz-step-label">' + (currentStep + 1) + ' / ' + total + '</span>' +
          '<span class="quiz-step-name">' + esc(stepName) + '</span>' +
        '</div>' +
        '<div class="quiz-progress-track">' +
          '<div class="quiz-progress-fill" style="width:' + pct + '%"></div>' +
        '</div>' +
      '</div>';
    }

    function open() {
      step = 0;
      answers = {};
      modal.classList.add('open');
      modal.setAttribute('aria-hidden', 'false');
      document.body.style.overflow = 'hidden';
      renderStep();
    }

    function close() {
      modal.classList.remove('open');
      modal.setAttribute('aria-hidden', 'true');
      document.body.style.overflow = '';
    }

    function renderStep() {
      if (step >= QUIZ.steps.length) {
        var ids = quizResult(answers);
        var products = ids.map(function (id) { return MontanaShop.getProduct(id); }).filter(Boolean);
        body.innerHTML =
          '<div class="quiz-result-head">' +
            '<span class="quiz-result-badge" data-i18n="quizResultBadge">' + esc(MontanaShop.t('quizResultBadge')) + '</span>' +
            '<h3 class="quiz-q" data-i18n="quizResult">' + esc(MontanaShop.t('quizResult')) + '</h3>' +
            '<p class="quiz-result-sub" data-i18n="quizResultSub">' + esc(MontanaShop.t('quizResultSub')) + '</p>' +
          '</div>' +
          '<div class="quiz-results">' + products.map(function (p) {
            return '<a href="product.html#' + esc(p.id) + '" class="quiz-result-card">' +
              '<div class="quiz-result-img"><img src="' + esc(p.image) + '" alt="' + esc(f(p.name)) + '"></div>' +
              '<div class="quiz-result-info">' +
                '<span class="quiz-result-act">' + esc(f(p.act)) + '</span>' +
                '<span class="quiz-result-name">' + esc(f(p.name)) + '</span>' +
                '<span class="quiz-result-price">' + esc(MontanaCart.formatPrice(p.price)) + '</span>' +
              '</div>' +
            '</a>';
          }).join('') + '</div>' +
          '<div class="quiz-actions">' +
            '<button type="button" class="btn-primary" id="quiz-add-all" data-i18n="addRoutine">' + esc(MontanaShop.t('addRoutine')) + '</button>' +
            '<button type="button" class="btn-ghost" id="quiz-close" data-i18n="quizClose">' + esc(MontanaShop.t('quizClose')) + '</button>' +
          '</div>';
        document.getElementById('quiz-add-all').onclick = function () {
          addProducts(ids);
          close();
        };
        document.getElementById('quiz-close').onclick = close;
        return;
      }

      var s = QUIZ.steps[step];
      body.innerHTML =
        quizHeader(step) +
        '<h3 class="quiz-q">' + esc(f(s.q)) + '</h3>' +
        '<p class="quiz-hint" data-i18n="quizHint">' + esc(MontanaShop.t('quizHint')) + '</p>' +
        '<div class="quiz-opts">' + s.opts.map(function (o) {
          return '<button type="button" class="quiz-opt" data-v="' + esc(o.v) + '">' +
            '<span class="quiz-opt-icon">' + quizIcon(o.v) + '</span>' +
            '<span class="quiz-opt-text">' + esc(f(o.l)) + '</span>' +
            '<span class="quiz-opt-arrow" aria-hidden="true">' +
              '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14M13 6l6 6-6 6"/></svg>' +
            '</span>' +
          '</button>';
        }).join('') + '</div>';
      body.querySelectorAll('.quiz-opt').forEach(function (btn) {
        btn.onclick = function () {
          answers[s.key] = btn.getAttribute('data-v');
          step++;
          renderStep();
        };
      });
    }

    document.querySelectorAll('.quiz-trigger').forEach(function (btn) {
      btn.onclick = open;
    });
    if (!modal._bound) {
      modal._bound = true;
      modal.querySelector('.quiz-backdrop').onclick = close;
      var closeBtn = modal.querySelector('.quiz-close-btn');
      if (closeBtn) closeBtn.onclick = close;
    }
    if (location.hash === '#quiz') open();
  }

  function initWhatsApp() {
    var btn = document.getElementById('whatsapp-btn');
    if (!btn) return;
    var id = MontanaShop.sanitizeId(new URLSearchParams(location.search).get('id'));
    var order = getOrder(id);
    if (!order) { btn.style.display = 'none'; return; }
    btn.href = whatsAppLink(order);
    btn.target = '_blank';
    btn.rel = 'noopener noreferrer';
  }

  document.addEventListener('lang:changed', function () {
    var bundles = document.getElementById('bundles-section');
    if (bundles && bundles.innerHTML) renderBundles(bundles);
    var glossary = document.getElementById('glossary-root');
    if (glossary) {
      var stats = glossaryStats();
      var statRoot = document.getElementById('ing-stats');
      if (statRoot) {
        statRoot.innerHTML =
          '<div class="ing-stat"><span class="ing-stat-num">' + stats.total + '</span><span class="ing-stat-label" data-i18n="ingStatTotal">' + esc(MontanaShop.t('ingStatTotal')) + '</span></div>' +
          '<div class="ing-stat"><span class="ing-stat-num">' + stats.active + '</span><span class="ing-stat-label" data-i18n="ingStatActive">' + esc(MontanaShop.t('ingStatActive')) + '</span></div>' +
          '<div class="ing-stat"><span class="ing-stat-num">' + stats.botanical + '</span><span class="ing-stat-label" data-i18n="ingStatBotanical">' + esc(MontanaShop.t('ingStatBotanical')) + '</span></div>';
      }
      renderGlossary(glossary);
    }
    var pairs = document.getElementById('pairs-root');
    if (pairs && pairs.dataset.pid) renderPairsWith(pairs.dataset.pid, pairs);
    var cartExtras = document.getElementById('cart-extras');
    if (cartExtras) renderCartExtras(cartExtras);
  });

  return {
    renderBundles: renderBundles,
    renderPairsWith: renderPairsWith,
    renderCartExtras: renderCartExtras,
    renderGlossary: renderGlossary,
    initGlossaryPage: initGlossaryPage,
    scrollToGlossary: scrollToGlossary,
    initQuiz: initQuiz,
    initWhatsApp: initWhatsApp,
    getOrder: getOrder
  };
})();
