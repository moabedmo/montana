window.MontanaProductStage = (function () {
  var VARIANTS = {
    card: { img: '.card-img', motion: true, zoom: false, strip: true, badge: true },
    pdp: { img: '.pdp-img', motion: true, zoom: true, strip: true, badge: true },
    story: { img: '.pp-img', motion: false, zoom: false, strip: false, badge: false },
    mobile: { img: '.app-product-stage img', motion: true, zoom: false, strip: true, badge: true }
  };

  function field(obj) {
    if (!obj) return '';
    if (typeof obj === 'string') return obj;
    var lang = document.documentElement.getAttribute('lang') === 'ar' ? 'ar' : 'en';
    return obj[lang] || obj.en || '';
  }

  function esc(s) {
    return window.MontanaShop && MontanaShop.esc
      ? MontanaShop.esc(s)
      : String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
  }

  function getProduct(host, img) {
    var id = host.getAttribute('data-product-id');
    if (!id && img) {
      var ov = host.closest('.ov-prod, [id^="ov-p"]');
      if (ov) {
        var btn = ov.querySelector('[data-product]');
        if (btn) id = btn.getAttribute('data-product');
      }
    }
    if (!id || !window.MONTANA_PRODUCTS) return null;
    return MONTANA_PRODUCTS.find(function (p) { return p.id === id; }) || null;
  }

  function chapterNum(n) {
    return n < 10 ? '0' + n : String(n);
  }

  function detailLine(product) {
    if (!product || !product.display) return '';
    var size = field(product.size);
    var hero = product.display.heroIngredient || '';
    var act = field(product.act);
    return [size, hero, act].filter(Boolean).join(' · ');
  }

  function canMotion() {
    return typeof window.matchMedia === 'function' &&
      !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  function canTilt() {
    return canMotion() && window.matchMedia('(min-width: 769px)').matches;
  }

  function pedestalHtml() {
    return (
      '<div class="ps-glass-slab" aria-hidden="true"></div>' +
      '<div class="ps-pedestal-top">' +
        '<div class="ps-pedestal-rim"></div>' +
        '<div class="ps-pedestal-reflect"></div>' +
      '</div>' +
      '<div class="ps-pedestal-glow"></div>'
    );
  }

  function setupImg(img, product) {
    if (!img || !product) return;
    img.classList.add('ps-img');
    img.setAttribute('decoding', 'async');
    if (!img.getAttribute('loading')) {
      img.setAttribute('loading', img.closest('.ps-host--pdp, .ps-host--story') ? 'eager' : 'lazy');
    }
    if (!img.srcset && product.image) {
      img.srcset = product.image + ' 1x, ' + product.image + ' 2x';
      img.sizes = 'min(320px, 33vw)';
    }
  }

  function addPremiumLayers(host, wrap, floatEl, img, product, cfg) {
    var d = product && product.display;
    if (!d) return;

    host.style.setProperty('--ps-aura', d.aura || '124,58,237');

    if (!wrap.querySelector('.ps-chapter-bg')) {
      var ch = document.createElement('div');
      ch.className = 'ps-chapter-bg';
      ch.setAttribute('aria-hidden', 'true');
      ch.textContent = chapterNum(d.chapter);
      wrap.insertBefore(ch, wrap.firstChild);
    }

    if (!wrap.querySelector('.ps-aura')) {
      var aura = document.createElement('div');
      aura.className = 'ps-aura';
      aura.setAttribute('aria-hidden', 'true');
      wrap.insertBefore(aura, wrap.firstChild);
    }

    if (cfg.badge && !host.querySelector('.ps-clinical-badge')) {
      var badge = document.createElement('span');
      badge.className = 'ps-clinical-badge';
      badge.textContent = field(d.badge);
      host.appendChild(badge);
    }

    if (cfg.strip && !wrap.querySelector('.ps-detail-strip')) {
      var strip = document.createElement('div');
      strip.className = 'ps-detail-strip';
      strip.textContent = detailLine(product);
      wrap.appendChild(strip);
    }
  }

  function bindTilt(host, wrap, floatEl, shadow, isPdp) {
    if (!canTilt()) return;
    var maxRy = isPdp ? 24 : 18;
    var maxRx = isPdp ? 20 : 14;

    function onMove(e) {
      var r = wrap.getBoundingClientRect();
      var x = (e.clientX - r.left) / r.width - 0.5;
      var y = (e.clientY - r.top) / r.height - 0.5;
      floatEl.style.animationPlayState = 'paused';
      floatEl.style.transform =
        'rotateY(' + (x * maxRy) + 'deg) rotateX(' + (-y * maxRx) + 'deg) rotateZ(' + (x * 2.5) + 'deg)';
      if (shadow) {
        shadow.style.animationPlayState = 'paused';
        shadow.style.transform =
          'translateX(calc(-50% + ' + (x * 12) + 'px)) perspective(300px) rotateX(78deg) scaleY(0.45)';
      }
      host.style.setProperty('--ps-tilt-x', String(x));
      host.style.setProperty('--ps-tilt-y', String(y));
    }

    function onLeave() {
      floatEl.style.transform = '';
      floatEl.style.animationPlayState = '';
      if (shadow) {
        shadow.style.transform = '';
        shadow.style.animationPlayState = '';
      }
      host.style.removeProperty('--ps-tilt-x');
      host.style.removeProperty('--ps-tilt-y');
    }

    host.addEventListener('mouseenter', function () {
      floatEl.style.animationPlayState = 'paused';
    });
    host.addEventListener('mousemove', onMove);
    host.addEventListener('mouseleave', onLeave);
  }

  function bindSlowSway(floatEl) {
    if (!canMotion() || !floatEl) return;
    floatEl.classList.add('ps-float--sway');
  }

  function bindParallax(host, floatEl) {
    if (!canMotion() || !floatEl || !window.gsap || !window.ScrollTrigger) return;
    var vis = host.closest('.pp-vis, .pdp-visual');
    if (!vis) return;
    gsap.to(floatEl, {
      y: -18,
      ease: 'none',
      scrollTrigger: {
        trigger: vis,
        start: 'top bottom',
        end: 'bottom top',
        scrub: 0.6
      }
    });
  }

  function bindZoom(host, img) {
    if (!img || host.querySelector('.ps-zoom-btn')) return;
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'ps-zoom-btn';
    btn.setAttribute('aria-label', document.documentElement.getAttribute('lang') === 'ar' ? 'تكبير' : 'Zoom');
    btn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.35-4.35M11 8v6M8 11h6"/></svg>';
    host.appendChild(btn);

    btn.addEventListener('click', function () {
      openLightbox(img.src, img.alt);
    });
    img.style.cursor = 'zoom-in';
    img.addEventListener('click', function () {
      openLightbox(img.src, img.alt);
    });
  }

  function openLightbox(src, alt) {
    var existing = document.getElementById('ps-lightbox');
    if (existing) existing.remove();
    var lb = document.createElement('div');
    lb.id = 'ps-lightbox';
    lb.className = 'ps-lightbox';
    lb.innerHTML =
      '<button type="button" class="ps-lightbox-close" aria-label="Close">×</button>' +
      '<div class="ps-lightbox-stage">' +
        '<img src="' + esc(src) + '" alt="' + esc(alt || '') + '">' +
      '</div>';
    document.body.appendChild(lb);
    requestAnimationFrame(function () { lb.classList.add('open'); });
    function close() {
      lb.classList.remove('open');
      setTimeout(function () { lb.remove(); }, 280);
    }
    lb.querySelector('.ps-lightbox-close').onclick = close;
    lb.addEventListener('click', function (e) { if (e.target === lb) close(); });
    document.addEventListener('keydown', function onKey(e) {
      if (e.key === 'Escape') { close(); document.removeEventListener('keydown', onKey); }
    });
  }

  function enhanceStoryWrap(wrap, img, product, cfg) {
    var vis = wrap.closest('.pp-vis');
    if (vis) {
      vis.dataset.psEnhanced = '1';
      vis.classList.add('ps-host', 'ps-host--story');
    }
    wrap.dataset.psEnhanced = '1';
    wrap.classList.add('ps-host', 'ps-host--story', 'ps-imgwrap');

    if (vis && !vis.querySelector('.ps-stage')) {
      var stage = document.createElement('div');
      stage.className = 'ps-stage';
      var spot = document.createElement('div');
      spot.className = 'ps-spotlight';
      spot.setAttribute('aria-hidden', 'true');
      stage.appendChild(spot);
      vis.insertBefore(stage, wrap);
      stage.appendChild(wrap);
    }

    if (!wrap.querySelector('.ps-aura')) {
      var aura = document.createElement('div');
      aura.className = 'ps-aura';
      aura.setAttribute('aria-hidden', 'true');
      wrap.insertBefore(aura, wrap.firstChild);
    }

    wrap.querySelectorAll('.pp-ring').forEach(function (r, i) {
      r.classList.add('ps-ring', i === 0 ? 'ps-ring-1' : 'ps-ring-2');
      r.removeAttribute('style');
      r.setAttribute('aria-hidden', 'true');
    });
    if (!wrap.querySelector('.ps-ring')) {
      var ring1 = document.createElement('div');
      ring1.className = 'ps-ring ps-ring-1';
      var ring2 = document.createElement('div');
      ring2.className = 'ps-ring ps-ring-2';
      wrap.insertBefore(ring2, wrap.querySelector('.ps-float, .pp-float, img'));
      wrap.insertBefore(ring1, ring2);
    }

    var floatEl = wrap.querySelector('.ps-float, .pp-float');
    if (!floatEl) {
      floatEl = document.createElement('div');
      floatEl.className = 'ps-float pp-float';
      var shadow = document.createElement('div');
      shadow.className = 'ps-img-shadow pp-img-shadow';
      shadow.setAttribute('aria-hidden', 'true');
      img.parentNode.insertBefore(floatEl, img);
      floatEl.appendChild(img);
      floatEl.appendChild(shadow);
    }

    if (!wrap.querySelector('.ps-pedestal, .pp-pedestal')) {
      var ped = document.createElement('div');
      ped.className = 'ps-pedestal pp-pedestal';
      ped.setAttribute('aria-hidden', 'true');
      ped.innerHTML = pedestalHtml();
      wrap.appendChild(ped);
    } else {
      var pedEl = wrap.querySelector('.ps-pedestal, .pp-pedestal');
      if (pedEl && !pedEl.querySelector('.ps-glass-slab')) {
        pedEl.insertAdjacentHTML('afterbegin', '<div class="ps-glass-slab" aria-hidden="true"></div>');
      }
    }

    setupImg(img, product);
    addPremiumLayers(vis || wrap, wrap, floatEl, img, product, cfg);
    return wrap;
  }

  function enhanceMobileVisual(host, img, product, cfg) {
    host.dataset.psEnhanced = '1';
    host.classList.add('ps-host', 'ps-host--mobile');
    if (product && product.display) {
      host.style.setProperty('--ps-aura', product.display.aura || '124,58,237');
    }

    if (!host.querySelector('.ps-chapter-bg') && product && product.display) {
      var ch = document.createElement('div');
      ch.className = 'ps-chapter-bg';
      ch.setAttribute('aria-hidden', 'true');
      ch.textContent = chapterNum(product.display.chapter);
      host.appendChild(ch);
    }

    if (!host.querySelector('.ps-aura')) {
      var aura = document.createElement('div');
      aura.className = 'ps-aura';
      aura.setAttribute('aria-hidden', 'true');
      host.insertBefore(aura, host.firstChild.nextSibling);
    }

    var stage = host.querySelector('.app-product-stage');
    if (stage) {
      stage.classList.add('ps-float');
    }

    var ped = host.querySelector('.app-product-pedestal');
    if (ped && !ped.querySelector('.ps-glass-slab')) {
      ped.classList.add('ps-pedestal');
      ped.insertAdjacentHTML('afterbegin', '<div class="ps-glass-slab" aria-hidden="true"></div>');
    }

    setupImg(img, product);
    var wrap = host;
    var floatEl = stage || host;
    addPremiumLayers(host, wrap, floatEl, img, product, cfg);
    if (cfg.motion && stage) bindSlowSway(stage);
    return host;
  }

  function buildStage(host, img, variant, product) {
    var cfg = VARIANTS[variant];
    var stage = document.createElement('div');
    stage.className = 'ps-stage';

    var spot = document.createElement('div');
    spot.className = 'ps-spotlight';
    spot.setAttribute('aria-hidden', 'true');

    var wrap = document.createElement('div');
    wrap.className = 'ps-imgwrap';

    var ring1 = document.createElement('div');
    ring1.className = 'ps-ring ps-ring-1';
    ring1.setAttribute('aria-hidden', 'true');
    var ring2 = document.createElement('div');
    ring2.className = 'ps-ring ps-ring-2';
    ring2.setAttribute('aria-hidden', 'true');

    var floatEl = document.createElement('div');
    floatEl.className = 'ps-float';

    var shadow = document.createElement('div');
    shadow.className = 'ps-img-shadow';
    shadow.setAttribute('aria-hidden', 'true');

    setupImg(img, product);

    host.insertBefore(stage, img);
    stage.appendChild(spot);
    stage.appendChild(wrap);
    wrap.appendChild(ring1);
    wrap.appendChild(ring2);
    wrap.appendChild(floatEl);
    floatEl.appendChild(img);
    floatEl.appendChild(shadow);

    var ped = document.createElement('div');
    ped.className = 'ps-pedestal';
    ped.setAttribute('aria-hidden', 'true');
    ped.innerHTML = pedestalHtml();
    wrap.appendChild(ped);

    addPremiumLayers(host, wrap, floatEl, img, product, cfg);

    if (cfg.motion) {
      bindSlowSway(floatEl);
      bindTilt(host, wrap, floatEl, shadow, variant === 'pdp');
      if (variant === 'story' || variant === 'pdp') bindParallax(host, floatEl);
    }
    if (cfg.zoom) bindZoom(host, img);

    return { stage: stage, wrap: wrap, floatEl: floatEl };
  }

  function enhanceInPlace(host, img, variant, product) {
    var cfg = VARIANTS[variant];
    var stage = host.querySelector('.ps-stage');
    var wrap = host.querySelector('.ps-imgwrap');
    var floatEl = host.querySelector('.ps-float');
    var stageImg = host.querySelector(cfg.img);

    if (!stage) {
      if (variant === 'mobile') {
        var spot = host.querySelector('.app-product-spotlight');
        if (!spot) {
          spot = document.createElement('div');
          spot.className = 'app-product-spotlight ps-spotlight';
          spot.setAttribute('aria-hidden', 'true');
          host.insertBefore(spot, host.firstChild);
        }
        stage = document.createElement('div');
        stage.className = 'ps-stage';
        wrap = document.createElement('div');
        wrap.className = 'ps-imgwrap';
        floatEl = host.querySelector('.app-product-stage') || document.createElement('div');
        if (!floatEl.classList.contains('app-product-stage')) {
          floatEl.className = 'app-product-stage ps-float';
        } else {
          floatEl.classList.add('ps-float');
        }
        var ped = host.querySelector('.app-product-pedestal');
        host.insertBefore(stage, host.querySelector('.app-story-card-act') || host.firstChild);
        stage.appendChild(wrap);
        if (floatEl.parentNode !== wrap) wrap.appendChild(floatEl);
        if (ped && ped.parentNode !== wrap) wrap.appendChild(ped);
        if (!ped) {
          ped = document.createElement('div');
          ped.className = 'app-product-pedestal ps-pedestal';
          ped.setAttribute('aria-hidden', 'true');
          ped.innerHTML = pedestalHtml();
          wrap.appendChild(ped);
        } else {
          ped.classList.add('ps-pedestal');
          if (!ped.querySelector('.ps-glass-slab')) {
            ped.insertAdjacentHTML('afterbegin', '<div class="ps-glass-slab" aria-hidden="true"></div>');
          }
        }
      }
    }

    if (!wrap && stage) wrap = stage.querySelector('.ps-imgwrap');
    if (!floatEl && wrap) {
      floatEl = wrap.querySelector('.ps-float') || wrap.querySelector('.app-product-stage');
    }

    setupImg(img || stageImg, product);
    if (wrap && floatEl) addPremiumLayers(host, wrap, floatEl, img || stageImg, product, cfg);
    if (cfg.zoom && (img || stageImg)) bindZoom(host, img || stageImg);
    if (cfg.motion && wrap && floatEl) {
      bindSlowSway(floatEl);
      bindTilt(host, wrap, floatEl, wrap.querySelector('.ps-img-shadow'), variant === 'pdp');
    }
  }

  function enhanceHost(host, variant) {
    if (!host || host.dataset.psEnhanced) return host;
    var cfg = VARIANTS[variant];
    if (!cfg) return host;

    var img = host.querySelector(cfg.img);
    if (!img) return host;

    var product = getProduct(host, img);

    if (variant === 'story') {
      return enhanceStoryWrap(host, img, product, cfg);
    }

    if (variant === 'mobile') {
      return enhanceMobileVisual(host, img, product, cfg);
    }

    host.dataset.psEnhanced = '1';
    host.classList.add('ps-host', 'ps-host--' + variant);

    if (host.querySelector('.ps-stage')) {
      enhanceInPlace(host, img, variant, product);
      return host;
    }

    buildStage(host, img, variant, product);
    return host;
  }

  function enhanceAll(root) {
    root = root || document;
    root.querySelectorAll('.card-img-wrap:not([data-ps-enhanced])').forEach(function (h) {
      enhanceHost(h, 'card');
    });
    root.querySelectorAll('.pdp-visual:not([data-ps-enhanced])').forEach(function (h) {
      enhanceHost(h, 'pdp');
    });
    root.querySelectorAll('.pp-imgwrap:not([data-ps-enhanced])').forEach(function (h) {
      enhanceHost(h, 'story');
    });
    root.querySelectorAll('.app-story-card-visual:not([data-ps-enhanced])').forEach(function (h) {
      if (!h.getAttribute('data-product-id')) {
        var card = h.closest('.app-story-card');
        if (card && card.id) h.setAttribute('data-product-id', card.id.replace('app-card-', ''));
      }
      enhanceHost(h, 'mobile');
    });
  }

  function animateEntrance(el) {
    if (!el) return;
  }

  return {
    enhanceAll: enhanceAll,
    enhanceHost: enhanceHost,
    animateEntrance: animateEntrance,
    openLightbox: openLightbox
  };
})();
