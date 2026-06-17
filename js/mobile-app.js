window.MontanaMobileApp = (function () {
  var MQ = '(max-width: 1024px)';

  var TABS = [
    { id: 'story', href: 'index.html', labelEn: 'Home', labelAr: 'الرئيسية' },
    { id: 'shop', href: 'shop.html', labelEn: 'Shop', labelAr: 'المتجر' },
    { id: 'ingredients', href: 'ingredients.html', labelEn: 'Science', labelAr: 'العلم' },
    { id: 'bag', href: 'cart.html', labelEn: 'Bag', labelAr: 'الشنطة', badge: true }
  ];

  var ICONS = {
    story: '<svg viewBox="0 0 24 24"><path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/></svg>',
    shop: '<svg viewBox="0 0 24 24"><path d="M7 18c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zM1 2v2h2l3.6 7.59-1.35 2.45c-.16.28-.25.61-.25.96 0 1.1.9 2 2 2h12v-2H7.42c-.14 0-.25-.11-.25-.25l.03-.12.9-1.63h7.45c.75 0 1.41-.41 1.75-1.03l3.58-6.49c.08-.14.12-.31.12-.48 0-.55-.45-1-1-1H5.21l-.94-2H1zm16 16c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/></svg>',
    ingredients: '<svg viewBox="0 0 24 24"><path d="M19.8 18.4L14 10.67V3.5c1.38 0 2.5-1.12 2.5-2.5S15.38-.5 14-.5 11.5.62 11.5 2v.17l-1.74 2.2c-.28.35-.44.78-.44 1.23V11l-4.9 6.2C4.08 18.13 4.5 19.5 5.7 19.5h12.6c.9 0 1.63-.73 1.5-1.6zM6.5 17.5l3.5-4.5V6.5h1v6.5l4.2 5.3H6.5z"/></svg>',
    bag: '<svg viewBox="0 0 24 24"><path d="M18 6h-1V4c0-2.21-1.79-4-4-4S9 1.79 9 4v2H8c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h10c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm-6-2c1.1 0 2 .9 2 2v2h-4V4zm6 16H8V8h10v12z"/></svg>'
  };

  function isMobile() {
    if (window.matchMedia('(hover: none) and (pointer: coarse)').matches) return true;
    return window.matchMedia(MQ).matches;
  }

  function isAr() {
    return document.documentElement.getAttribute('lang') === 'ar';
  }

  function esc(s) {
    if (s == null) return '';
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function field(obj) {
    if (!obj) return '';
    if (typeof obj === 'string') return obj;
    return obj[isAr() ? 'ar' : 'en'] || obj.en || '';
  }

  function formatPrice(n) {
    if (window.MontanaCart) return MontanaCart.formatPrice(n);
    return isAr() ? n.toLocaleString('ar-EG') + ' ج.م' : 'EGP ' + n.toLocaleString('en-EG');
  }

  function currentTab() {
    var page = (location.pathname.split('/').pop() || 'index.html').toLowerCase();
    if (page === '' || page === 'index.html') return 'story';
    if (page === 'shop.html' || page === 'product.html') return 'shop';
    if (page === 'ingredients.html') return 'ingredients';
    if (page === 'cart.html' || page === 'checkout.html' || page === 'order-success.html') return 'bag';
    return '';
  }

  function pageType() {
    var page = (location.pathname.split('/').pop() || 'index.html').toLowerCase();
    if (page === 'index.html' || page === '') return 'story';
    if (page === 'shop.html') return 'shop';
    if (page === 'product.html') return 'product';
    if (page === 'ingredients.html') return 'ingredients';
    if (page === 'cart.html') return 'cart';
    if (page === 'checkout.html') return 'checkout';
    if (page === 'order-success.html') return 'success';
    return 'other';
  }

  function label(tab) {
    return isAr() ? tab.labelAr : tab.labelEn;
  }

  function loadProducts(cb) {
    if (window.MONTANA_PRODUCTS && window.MONTANA_PRODUCTS.length) {
      cb();
      return;
    }
    var s = document.createElement('script');
    s.src = 'js/products.js';
    s.onload = cb;
    s.onerror = cb;
    document.head.appendChild(s);
  }

  function ensureAppScroll() {
    var scroll = document.getElementById('app-scroll');
    if (scroll) return scroll;

    scroll = document.createElement('main');
    scroll.id = 'app-scroll';
    scroll.className = 'app-screen';
    scroll.setAttribute('role', 'main');

    var tab = document.getElementById('app-tabbar');
    if (tab) document.body.insertBefore(scroll, tab);
    else document.body.appendChild(scroll);

    return scroll;
  }

  function adoptIntoScroll(el) {
    if (!el) return;
    if (el.id === 'app-scroll' || el.id === 'app-header' || el.id === 'app-tabbar') return;

    var scroll = ensureAppScroll();
    if (el === scroll || scroll.contains(el)) return;
    scroll.appendChild(el);
  }

  function mountPageContent() {
    var wrap = document.querySelector('.shop-wrap');
    if (wrap) {
      adoptIntoScroll(wrap);
      return;
    }
    var success = document.querySelector('.order-success');
    if (success) adoptIntoScroll(success);
  }

  function getScrollRoot() {
    return document.getElementById('app-scroll') || document.querySelector('.app-screen');
  }

  function wrapInAppScreen(el) {
    adoptIntoScroll(el);
  }

  function killDesktopStory() {
    if (window.ScrollTrigger) {
      ScrollTrigger.getAll().forEach(function (st) { st.kill(); });
    }
    var scroller = document.getElementById('scroller');
    if (scroller) {
      scroller.style.height = '0';
      scroller.style.overflow = 'hidden';
      scroller.style.pointerEvents = 'none';
    }
  }

  /* ── App header (replaces desktop nav) ── */
  function buildAppHeader() {
    if (document.getElementById('app-header')) return;

    var header = document.createElement('header');
    header.id = 'app-header';
    header.className = 'app-header';
    header.innerHTML =
      '<div class="app-header-inner">' +
        '<a href="index.html" class="brand-logo-link" aria-label="Montana"><span class="brand-logo"></span></a>' +
        '<div class="app-header-actions" id="app-header-actions"></div>' +
      '</div>';

    document.body.prepend(header);

    var controls = document.getElementById('nav-controls');
    var slot = document.getElementById('app-header-actions');
    if (controls && slot) {
      slot.appendChild(controls);
    }
  }

  /* ── Bottom tab bar ── */
  function buildTabbar() {
    if (document.getElementById('app-tabbar')) return;

    var active = currentTab();
    var bar = document.createElement('nav');
    bar.id = 'app-tabbar';
    bar.setAttribute('aria-label', 'App navigation');

    bar.innerHTML = TABS.map(function (tab) {
      var cls = 'app-tab' + (tab.id === active ? ' on' : '');
      var badge = tab.badge
        ? '<span class="app-tab-badge" data-tab-badge data-count="0">0</span>'
        : '';
      return '<a href="' + tab.href + '" class="' + cls + '" data-tab="' + tab.id + '">' +
        ICONS[tab.id] +
        '<span data-tab-label="' + tab.id + '">' + esc(label(tab)) + '</span>' +
        badge +
      '</a>';
    }).join('');

    document.body.appendChild(bar);
  }

  /* ── Mobile HOME — built from scratch, not desktop story ── */
  function buildMobileHome() {
    if (!document.getElementById('scroller')) return;

    var scroll = ensureAppScroll();
    if (scroll.querySelector('#app-mobile-home')) return;

    killDesktopStory();

    loadProducts(function () {
      var products = window.MONTANA_PRODUCTS || [];
      var ar = isAr();

      var heroTitle = ar
        ? 'بشرتك تستاهل<br><em>قصة أحلى</em>'
        : 'Your skin deserves<br><em>a better story</em>';
      var heroSub = ar
        ? '٦ تركيبات متخصصة — كل واحدة فصل في رحلة بشرتك.'
        : 'Six specialized formulas — each one a chapter in your skin journey.';
      var heroCta = ar ? 'اكتشفي المجموعة' : 'Explore Collection';
      var heroQuiz = ar ? 'اكتشفي روتينك' : 'Find Your Routine';
      var heroEyebrow = ar ? 'مونتانا ناتشورالز' : 'Montana Naturals';
      var feedLabel = ar ? 'فصول قصتك' : 'Your Story Chapters';
      var finaleLine = ar ? 'رحلة واحدة — وكل الفصول تتغيّر.' : 'One journey — every chapter counts.';
      var finaleShop = ar ? 'ابدئي رحلتك' : 'Begin Your Story';
      var addLabel = ar ? 'ضيفي للشنطة' : 'Add';
      var viewLabel = ar ? 'التفاصيل' : 'View';

      var pills = products.map(function (p, i) {
        return '<a href="#app-card-' + esc(p.id) + '" class="app-chapter-pill">' +
          esc(field(p.act) || ('0' + (i + 1))) +
        '</a>';
      }).join('');

      var cards = products.map(function (p) {
        return '<article class="app-story-card" id="app-card-' + esc(p.id) + '">' +
          '<div class="app-story-card-visual" data-product-id="' + esc(p.id) + '">' +
            '<div class="app-product-spotlight" aria-hidden="true"></div>' +
            '<span class="app-story-card-act">' + esc(field(p.act)) + '</span>' +
            '<div class="app-product-stage">' +
              '<img src="' + esc(p.image) + '" alt="' + esc(field(p.name)) + '">' +
              '<div class="app-product-shadow" aria-hidden="true"></div>' +
            '</div>' +
            '<div class="app-product-pedestal" aria-hidden="true"><div class="app-product-pedestal-top"></div><div class="app-product-pedestal-glow"></div></div>' +
          '</div>' +
          '<div class="app-story-card-body">' +
            '<p class="app-story-card-quote">' + esc(field(p.quote)) + '</p>' +
            '<h2 class="app-story-card-name">' + esc(field(p.name)) + '</h2>' +
            '<p class="app-story-card-desc">' + esc(field(p.desc)) + '</p>' +
            '<div class="app-story-card-foot">' +
              '<span class="app-story-card-price">' + formatPrice(p.price) + '</span>' +
              '<div class="app-story-card-actions">' +
                '<button type="button" class="app-btn app-btn-primary" data-app-add="' + esc(p.id) + '">' + addLabel + '</button>' +
                '<a href="product.html#' + esc(p.id) + '" class="app-btn app-btn-ghost" data-pid="' + esc(p.id) + '">' + viewLabel + '</a>' +
              '</div>' +
            '</div>' +
          '</div>' +
        '</article>';
      }).join('');

      var home = document.createElement('div');
      home.id = 'app-mobile-home';
      home.innerHTML =
        '<section class="app-hero">' +
          '<span class="app-hero-eyebrow">' + esc(heroEyebrow) + '</span>' +
          '<h1>' + heroTitle + '</h1>' +
          '<p>' + esc(heroSub) + '</p>' +
          '<div class="app-hero-ctas">' +
            '<a href="shop.html" class="app-hero-cta">' + esc(heroCta) + '</a>' +
            '<button type="button" class="app-hero-quiz quiz-trigger">' + esc(heroQuiz) + '</button>' +
          '</div>' +
        '</section>' +
        '<div class="app-section-label">' + esc(feedLabel) + '</div>' +
        '<div class="app-story-progress" id="app-story-progress" aria-live="polite">' +
          '<span class="app-story-progress-text"></span>' +
          '<div class="app-story-progress-track"><div class="app-story-progress-fill"></div></div>' +
        '</div>' +
        '<div class="app-chapters-rail">' + pills + '</div>' +
        '<div class="app-story-feed">' + cards + '</div>' +
        '<section class="app-story-finale">' +
          '<p>' + esc(finaleLine) + '</p>' +
          '<div class="app-story-finale-ctas">' +
            '<button type="button" class="app-btn app-btn-primary quiz-trigger">' + esc(heroQuiz) + '</button>' +
            '<a href="shop.html" class="app-btn app-btn-ghost">' + esc(finaleShop) + '</a>' +
          '</div>' +
        '</section>';

      scroll.appendChild(home);

      if (window.MontanaProductStage) MontanaProductStage.enhanceAll(home);

      home.querySelectorAll('[data-app-add]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          if (window.MontanaCart) {
            MontanaCart.add(btn.getAttribute('data-app-add'));
            showToast(ar ? 'اتضافت للشنطة' : 'Added to bag');
            updateBadge();
          }
        });
      });

      home.querySelectorAll('a[data-pid]').forEach(function (a) {
        a.addEventListener('click', function () {
          try { sessionStorage.setItem('montana_pdp', a.getAttribute('data-pid')); } catch (e) {}
        });
      });

      home.querySelectorAll('.app-chapter-pill').forEach(function (pill) {
        pill.addEventListener('click', function (e) {
          var href = pill.getAttribute('href');
          if (!href || href.charAt(0) !== '#') return;
          var target = home.querySelector(href);
          var root = getScrollRoot();
          if (target && root) {
            e.preventDefault();
            var top = target.getBoundingClientRect().top - root.getBoundingClientRect().top + root.scrollTop - 12;
            root.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
          }
        });
      });

      bindMobileStoryProgress(home, products.length, ar, scroll);

      if (window.MontanaShopExtras && typeof MontanaShopExtras.initQuiz === 'function') {
        MontanaShopExtras.initQuiz();
      }
    });
  }

  function bindMobileStoryProgress(home, total, ar, scrollRoot) {
    var progress = home.querySelector('#app-story-progress');
    var textEl = progress && progress.querySelector('.app-story-progress-text');
    var fillEl = progress && progress.querySelector('.app-story-progress-fill');
    var cards = home.querySelectorAll('.app-story-card');
    if (!progress || !textEl || !fillEl || !cards.length) return;

    scrollRoot = scrollRoot || getScrollRoot();

    function setChapter(n) {
      var ch = Math.max(1, Math.min(n, total));
      textEl.textContent = ar
        ? ('الفصل ' + ch + ' من ' + total)
        : ('Chapter ' + ch + ' of ' + total);
      fillEl.style.width = ((ch / total) * 100) + '%';
    }

    setChapter(1);

    if (!('IntersectionObserver' in window) || !scrollRoot) return;

    var current = 1;
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        var idx = -1;
        for (var i = 0; i < cards.length; i++) {
          if (cards[i].id === entry.target.id) { idx = i; break; }
        }
        if (idx >= 0 && idx + 1 !== current) {
          current = idx + 1;
          setChapter(current);
        }
      });
    }, { root: scrollRoot, rootMargin: '-18% 0px -28% 0px', threshold: 0 });

    cards.forEach(function (card) { observer.observe(card); });
  }

  /* ── Shop app banner ── */
  function buildShopApp() {
    var wrap = document.querySelector('.shop-wrap');
    if (!wrap) return;
    if (wrap.querySelector('.app-shop-banner')) return;

    var ar = isAr();
    var banner = document.createElement('div');
    banner.className = 'app-shop-banner';
    banner.innerHTML =
      '<div class="app-quiz-promo">' +
        '<span class="app-quiz-badge">' + (ar ? '✦ مخصص لكِ' : '✦ Personalized') + '</span>' +
        '<p class="app-quiz-headline">' +
          (ar ? 'مش متأكدة من الروتين المناسب؟' : 'Not sure which routine fits you?') +
        '</p>' +
        '<p class="app-quiz-sub">' +
          (ar ? 'اختبار دقيقتين يقترحلك التركيبات المثالية لبشرتك.' : 'A 2-minute quiz finds your perfect formulas.') +
        '</p>' +
        '<button type="button" class="app-quiz-cta quiz-trigger">' +
          '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">' +
            '<path d="M12 3l1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5L12 3z"/>' +
            '<path d="M5 19l1 3 1-3 3-1-3-1-1-3-1 3-3 1 3 1z"/>' +
          '</svg>' +
          '<span>' + (ar ? 'اكتشفي روتينك' : 'Find Your Routine') + '</span>' +
          '<svg class="app-quiz-arrow" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">' +
            '<path d="M5 12h14M13 6l6 6-6 6"/>' +
          '</svg>' +
        '</button>' +
      '</div>' +
      '<div class="app-shop-head">' +
        '<h2>' + (ar ? 'مجموعتك' : 'Your Collection') + '</h2>' +
        '<p>' + (ar ? '٦ تركيبات — اختاري اللي يناسب بشرتك.' : 'Six formulas — find what your skin needs.') + '</p>' +
      '</div>';

    wrap.insertBefore(banner, wrap.firstChild);

    if (window.MontanaShopExtras && typeof MontanaShopExtras.initQuiz === 'function') {
      MontanaShopExtras.initQuiz();
    }
  }

  function buildProductApp() {
    document.body.classList.add('app-page-product');
  }

  function buildCartApp() {}

  function buildIngredientsApp() {}

  function buildSuccessApp() {}

  function showToast(msg) {
    if (window.MontanaShop && MontanaShop.toast) {
      MontanaShop.toast(msg);
      return;
    }
    var el = document.getElementById('nav-toast') || document.getElementById('toast');
    if (!el) return;
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(el._appT);
    el._appT = setTimeout(function () { el.classList.remove('show'); }, 2600);
  }

  function updateBadge() {
    if (!window.MontanaCart) return;
    var badge = document.querySelector('[data-tab-badge]');
    if (!badge) return;
    var n = MontanaCart.count();
    badge.textContent = n;
    badge.setAttribute('data-count', n);
  }

  function updateLabels() {
    document.querySelectorAll('[data-tab-label]').forEach(function (el) {
      var id = el.getAttribute('data-tab-label');
      var tab = TABS.find(function (t) { return t.id === id; });
      if (tab) el.textContent = label(tab);
    });
  }

  function applyPageClass() {
    document.body.classList.remove(
      'app-page-story', 'app-page-shop', 'app-page-product',
      'app-page-ingredients', 'app-page-cart', 'app-page-checkout', 'app-page-success'
    );
    document.body.classList.add('app-page-' + pageType());
  }

  function teardown() {
    lastMobileState = null;
    document.documentElement.classList.remove('app-mode');
    document.body.classList.remove('app-mode');
    ['app-page-story', 'app-page-shop', 'app-page-product', 'app-page-ingredients',
      'app-page-cart', 'app-page-checkout', 'app-page-success'].forEach(function (c) {
      document.body.classList.remove(c);
    });
    var bar = document.getElementById('app-tabbar');
    if (bar) bar.remove();
    var header = document.getElementById('app-header');
    if (header) header.remove();
    var home = document.getElementById('app-mobile-home');
    if (home) home.remove();
    var controls = document.querySelector('#app-header-actions #nav-controls, #nav-controls');
    var nav = document.querySelector('#nav') || document.querySelector('.shop-nav');
    if (controls && nav) nav.appendChild(controls);
    document.querySelectorAll('.app-screen').forEach(function (screen) {
      if (screen.id === 'app-scroll') return;
      while (screen.firstChild) screen.parentNode.insertBefore(screen.firstChild, screen);
      screen.remove();
    });
    var scroll = document.getElementById('app-scroll');
    if (scroll) {
      var tab = document.getElementById('app-tabbar');
      while (scroll.firstChild) {
        if (tab) document.body.insertBefore(scroll.firstChild, tab);
        else document.body.appendChild(scroll.firstChild);
      }
      scroll.remove();
    }
    document.querySelectorAll('.app-shop-banner').forEach(function (b) { b.remove(); });
    var scroller = document.getElementById('scroller');
    if (scroller) {
      scroller.style.height = '';
      scroller.style.overflow = '';
      scroller.style.pointerEvents = '';
    }
    if (pageType() === 'story' && !isMobile()) {
      window.dispatchEvent(new Event('montana:story-restore'));
    }
  }

  var lastMobileState = null;

  function build() {
    var mobile = isMobile();
    if (!mobile) {
      lastMobileState = false;
      teardown();
      return;
    }

    if (lastMobileState === true) {
      updateBadge();
      updateLabels();
      return;
    }
    lastMobileState = true;

    document.documentElement.classList.add('app-mode');
    document.body.classList.add('app-mode');
    applyPageClass();
    killDesktopStory();
    buildAppHeader();
    buildTabbar();
    ensureAppScroll();
    mountPageContent();
    updateBadge();
    updateLabels();

    var type = pageType();
    if (type === 'story') buildMobileHome();
    if (type === 'shop') buildShopApp();
    if (type === 'product') buildProductApp();
    if (type === 'ingredients') buildIngredientsApp();
    if (type === 'cart' || type === 'checkout') buildCartApp();
    if (type === 'success') buildSuccessApp();
  }

  function init() {
    build();
    window.addEventListener('resize', build);
    window.addEventListener('load', build);
    document.addEventListener('cart:updated', updateBadge);
    document.addEventListener('lang:changed', function () {
      updateLabels();
      var home = document.querySelector('#app-mobile-home');
      if (home) {
        home.remove();
        buildMobileHome();
      }
      document.querySelectorAll('.app-shop-banner').forEach(function (b) { b.remove(); });
      if (pageType() === 'shop') buildShopApp();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  return { init: init, build: build, updateBadge: updateBadge };
})();
