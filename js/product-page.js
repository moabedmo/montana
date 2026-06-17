window.MontanaProductPage = (function () {
  function esc(s) { return MontanaShop.esc(s); }

  function arr(obj) {
    var val = MontanaShop.field(obj);
    return Array.isArray(val) ? val : [];
  }

  function showError(root, msg) {
    root.innerHTML =
      '<div class="pdp-error">' +
        '<p>' + esc(msg) + '</p>' +
        '<a href="shop.html" class="btn-primary" style="display:inline-block;margin-top:20px;">' +
          esc(MontanaShop.t('continue')) +
        '</a>' +
      '</div>';
    MontanaShop.bindNav();
  }

  function render() {
    var root = document.getElementById('pdp');
    if (!root) return;

    if (!window.MONTANA_PRODUCTS || !window.MONTANA_PRODUCTS.length) {
      showError(root, MontanaCart.getLang() === 'ar'
        ? 'تعذّر تحميل بيانات المنتجات. حدّثي الصفحة أو ارجعي للمتجر.'
        : 'Could not load product data. Please refresh or return to the shop.');
      return;
    }

    var id = MontanaShop.getProductIdFromUrl();
    var p = MontanaShop.getProduct(id);
    if (!p) {
      showError(root, MontanaCart.getLang() === 'ar'
        ? 'المنتج غير موجود.'
        : 'Product not found.');
      return;
    }

    var qty = root._qty || 1;
    var lang = MontanaCart.getLang();
    var name = MontanaShop.field(p.name);
    var displayName = lang === 'en'
      ? esc(name).replace(/^(\S+)\s(.+)$/, '$1 <em>$2</em>')
      : esc(name);

    document.title = 'Montana Naturals — ' + name;
    if (window.MontanaSEO) {
      var desc = MontanaShop.field(p.desc);
      MontanaSEO.initPage({
        title: document.title,
        description: desc,
        canonical: 'product.html#' + p.id,
        ogTitle: 'Montana Naturals — ' + name,
        ogDescription: desc,
        ogImage: p.image,
        ogType: 'product',
        jsonLd: MontanaSEO.productSchema(p)
      });
    }

    var usageHtml = '';
    if (p.usage) {
      var steps = arr(p.usage);
      if (steps.length) {
        usageHtml =
          '<div class="pdp-usage">' +
            '<div class="pdp-section-label" data-i18n="usage">How to Use</div>' +
            '<ol>' + steps.map(function (step) { return '<li>' + esc(step) + '</li>'; }).join('') + '</ol>' +
          '</div>';
      }
    }

    root.innerHTML =
      '<div class="pdp-visual" data-product-id="' + esc(p.id) + '"><img class="pdp-img" src="' + esc(p.image) + '" alt="' + esc(name) + '"></div>' +
      '<div class="pdp-info">' +
        '<div class="pdp-act">' + esc(MontanaShop.field(p.act)) + '</div>' +
        '<h1 class="pdp-name">' + displayName + '</h1>' +
        '<div class="pdp-tag">' + esc(MontanaShop.field(p.tagline)) + ' · ' + esc(MontanaShop.field(p.size)) + '</div>' +
        '<div class="pdp-price">' + MontanaCart.formatPrice(p.price) + '</div>' +
        '<div class="pdp-quote">' + esc(MontanaShop.field(p.quote)) + '</div>' +
        '<p class="pdp-desc">' + esc(MontanaShop.field(p.desc)) + '</p>' +
        '<div class="pdp-section-label" data-i18n="ingredients">Ingredients</div>' +
        '<div class="pdp-ingr">' + arr(p.ingredients).map(function (i) {
          var href = MontanaShop.ingredientHref(i);
          if (href) return '<a href="' + href + '" class="ingr-link">' + esc(i) + '</a>';
          return '<span class="ingr-chip">' + esc(i) + '</span>';
        }).join('') + '</div>' +
        usageHtml +
        '<div class="pdp-actions">' +
          '<div class="qty-wrap">' +
            '<button type="button" class="qty-btn" id="qty-min">−</button>' +
            '<span class="qty-val" id="qty-val">' + qty + '</span>' +
            '<button type="button" class="qty-btn" id="qty-plus">+</button>' +
          '</div>' +
          '<button type="button" class="btn-primary" id="add-btn" data-i18n="addToBag">Add to Bag</button>' +
        '</div>' +
      '</div>';

    MontanaShop.bindNav();

    if (window.MontanaProductStage) MontanaProductStage.enhanceAll(root);

    var qtyMin = document.getElementById('qty-min');
    var qtyPlus = document.getElementById('qty-plus');
    var qtyVal = document.getElementById('qty-val');
    var addBtn = document.getElementById('add-btn');

    if (qtyMin) qtyMin.onclick = function () {
      if (qty > 1) { qty--; root._qty = qty; qtyVal.textContent = qty; }
    };
    if (qtyPlus) qtyPlus.onclick = function () {
      qty++; root._qty = qty; qtyVal.textContent = qty;
    };
    if (addBtn) addBtn.onclick = function () {
      MontanaCart.add(p.id, qty);
      MontanaShop.toast(MontanaShop.t('added'));
    };

    var pairsRoot = document.getElementById('pairs-root');
    if (pairsRoot && window.MontanaShopExtras) {
      pairsRoot.dataset.pid = p.id;
      MontanaShopExtras.renderPairsWith(p.id, pairsRoot);
    }
  }

  function init() {
    MontanaShop.initLang();
    MontanaShop.bindLang();
    MontanaShop.bindNav();
    render();
    if (window.MontanaShopExtras && typeof MontanaShopExtras.initQuiz === 'function') {
      MontanaShopExtras.initQuiz();
    }
    document.addEventListener('lang:changed', render);
    window.addEventListener('hashchange', render);
  }

  return { init: init, render: render };
})();
