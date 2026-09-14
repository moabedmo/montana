/**
 * Premium hero showcase — carousel, motion, cart, indications meta.
 */
import { enrichHeroSlide } from './hero-meta.js';
import { getLocale, resolveAssetUrl, productUrl } from './i18n/locale.js?v=3';
import { setOptimizedImageSrc } from './image-opt.js';
import { HERO_SLIDES, UI_STRINGS as UI_EN } from './i18n/en.js';
import { enrichHeroSlideEn } from './i18n/hero-meta-en.js';

const CYCLE_MS = 5500;

const AR_PRODUCTS = [
  { img: 'images/p1.webp', en: 'ACNE FACIAL CLEANSER', name: 'غسول الوجه لعلاج حب الشباب', tag: 'تنظيف لطيف وعميق للبشرة المعرضة للحبوب', price: 329, mood: '#453f64', scale: 1.16, slug: 'acne-facial-cleanser' },
  { img: 'images/p2.webp', en: 'WHITENING CLEANSER', name: 'غسول التفتيح والتوحيد', tag: 'إشراقة يومية وتوحيد فوري للون البشرة', price: 299, mood: '#4f3f5c', scale: 1.16, slug: 'whitening-cleanser' },
  { img: 'images/p3.webp', en: 'WHITENING CREAM', name: 'كريم التفتيح', tag: 'تفتيح ملحوظ وترطيب يدوم طوال اليوم', price: 249, mood: '#543d67', slug: 'whitening-cream' },
  { img: 'images/p4.webp', en: 'HAND & BODY LOTION', name: 'لوشن اليدين والجسم', tag: 'نعومة حريرية لجسمك من أول استخدام', price: 229, mood: '#503f60', slug: 'hand-body-lotion' },
  { img: 'images/p5.webp', en: 'POST-LASER CREAM', name: 'كريم ما بعد الليزر', tag: 'تهدئة وترميم البشرة بعد الجلسات', price: 369, mood: '#5a4358', slug: 'post-laser-cream' },
  { img: 'images/p6.webp', en: 'ANTI-SCAR SILICONE GEL', name: 'جل السيليكون لعلاج الندبات', tag: 'تحسين مظهر الندبات الحديثة والقديمة', price: 950, mood: '#493d58', slug: 'anti-scar-gel' },
];

function assetUrl(path) {
  return resolveAssetUrl(path);
}

function enrichSlide(slide) {
  const s = { ...slide, img: assetUrl(slide.img) };
  return getLocale() === 'en' ? enrichHeroSlideEn(s) : enrichHeroSlide(s);
}

const BASE_PRODUCTS = (getLocale() === 'en' ? HERO_SLIDES : AR_PRODUCTS).map(enrichSlide);

const PRODUCTS = BASE_PRODUCTS;

let cur = 0;
let timer = null;
let frontIsA = true;
let touchX = null;
let heroPaused = false;

const imgA = document.getElementById('sc-img-a');
const imgB = document.getElementById('sc-img-b');
const refA = document.getElementById('sc-ref-a');
const elEn = document.getElementById('sc-en');
const elProductName = document.getElementById('sc-name');
const elTag = document.getElementById('sc-tag');
const elConcerns = document.getElementById('sc-concerns');
const elTrust = document.getElementById('sc-trust');
const elPrice = document.getElementById('sc-price');
const elCur = document.getElementById('sc-cur');
const dotsWrap = document.getElementById('sc-dots');
const info = document.querySelector('.showcase-info');
const stage = document.getElementById('sc-stage');
const tilt = document.getElementById('sc-tilt');
const hero = document.getElementById('hero-section');
const heroBg = document.getElementById('hero-bg');
const heroBokeh = document.getElementById('hero-bokeh');
const heroDust = hero?.querySelector('.hero-dust');
const cta = document.getElementById('sc-cta');
const cartBtn = document.getElementById('sc-cart-btn');
const cursor = document.getElementById('hero-cursor');
const loader = document.getElementById('hero-loader');
const wipe = document.getElementById('sc-wipe');
const scTotal = document.querySelector('.sc-total');

if (!hero || !imgA || !dotsWrap) {
  console.warn('[hero-showcase] missing DOM — skipped');
} else {
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const hoverCapable = window.matchMedia('(hover: hover)').matches;
  const isLite = reduced || window.matchMedia('(max-width: 768px), (hover: none)').matches;

  if (isLite) {
    document.documentElement.classList.add('mnt-lite');
    cursor?.remove();
    heroDust?.remove();
    heroBokeh?.remove();
    document.getElementById('aurora-bg')?.remove();
  }

  hero.style.backgroundColor = PRODUCTS[0].mood;
  if (scTotal) scTotal.textContent = String(PRODUCTS.length).padStart(2, '0');

  function applyProductScale(el, product) {
    if (!el) return;
    el.style.setProperty('--sc-scale', String(product?.scale ?? 1));
  }

  function renderTrust(trust) {
    if (!elTrust) return;
    elTrust.innerHTML = (trust || [])
      .map((t) => `<span class="sc-trust-pill">${t}</span>`)
      .join('');
  }

  function applyProductMeta(p) {
    const isEn = getLocale() === 'en';
    const UI = isEn ? UI_EN : null;
    if (elEn) elEn.textContent = p.en;
    if (elProductName) elProductName.textContent = p.name;
    if (elTag) elTag.textContent = p.tag;
    if (elPrice) elPrice.textContent = p.price;
    if (elConcerns) {
      elConcerns.textContent = p.concerns
        ? `${isEn ? UI.hero.concernsPrefix : 'مناسب لـ: '}${p.concerns}`
        : '';
    }
    renderTrust(p.trust);
    if (cta && p.slug) cta.href = productUrl(p.slug);
    if (cta && isEn) cta.innerHTML = `${UI.hero.discoverCta} <span class="cta-arrow">←</span>`;
    if (cartBtn) {
      cartBtn.dataset.id = p.cartId || '';
      cartBtn.dataset.name = p.cartName || p.name;
      cartBtn.dataset.price = p.price;
      cartBtn.dataset.slug = p.slug || '';
      cartBtn.dataset.image = assetUrl(p.cartImage || p.img);
      if (isEn) cartBtn.innerHTML = `<i class="fas fa-shopping-bag"></i> ${UI.hero.addToCart}`;
    }
  }

  applyProductScale(imgA, PRODUCTS[0]);
  applyProductScale(imgB, PRODUCTS[1] || PRODUCTS[0]);
  applyProductScale(refA, PRODUCTS[0]);
  applyProductMeta(PRODUCTS[0]);

  // Loader — once per session
  if (sessionStorage.getItem('mnt-hero-intro') === '1') {
    loader?.classList.add('hl-done');
  } else {
    Promise.all([
      new Promise((r) => (imgA.complete ? r() : imgA.addEventListener('load', r, { once: true }))),
      new Promise((r) => setTimeout(r, 900)),
    ]).then(() => {
      loader?.classList.add('hl-done');
      sessionStorage.setItem('mnt-hero-intro', '1');
    });
    setTimeout(() => loader?.classList.add('hl-done'), 2500);
  }

  PRODUCTS.forEach((p, i) => {
    const d = document.createElement('button');
    d.type = 'button';
    d.className = `sc-dot${i === 0 ? ' active' : ''}`;
    d.setAttribute('aria-label', p.name);
    d.innerHTML = '<span class="sc-dot-fill"></span>';
    d.onclick = () => {
      go(i, i > cur ? 1 : -1);
      restart();
    };
    dotsWrap.appendChild(d);
  });
  PRODUCTS.forEach((p) => {
    const im = new Image();
    im.src = p.img;
  });

  function syncDots() {
    dotsWrap.querySelectorAll('.sc-dot').forEach((d, di) => {
      d.classList.toggle('active', di === cur);
      const fill = d.querySelector('.sc-dot-fill');
      if (!fill) return;
      fill.style.animation = 'none';
      void fill.offsetWidth;
      if (di === cur && !reduced && !heroPaused) {
        fill.style.animation = `scDotFill ${CYCLE_MS}ms linear forwards`;
      }
    });
  }

  function runWipe() {
    if (!wipe || reduced) return;
    wipe.classList.remove('sc-wipe-run');
    void wipe.offsetWidth;
    wipe.classList.add('sc-wipe-run');
  }

  function go(i, dir = 1) {
    if (i === cur || i < 0 || i >= PRODUCTS.length) return;
    const p = PRODUCTS[i];
    const front = frontIsA ? imgA : imgB;
    const back = frontIsA ? imgB : imgA;

    stage?.classList.add('sc-transitioning');
    tilt?.classList.add(dir >= 0 ? 'sc-slide-next' : 'sc-slide-prev');
    runWipe();

    setOptimizedImageSrc(back, p.img);
    applyProductScale(back, p);
    back.classList.add('active', 'sc-enter');
    front.classList.add('sc-exit');
    front.classList.remove('active');
    frontIsA = !frontIsA;

    setTimeout(() => {
      front.classList.remove('sc-exit', 'sc-enter');
      back.classList.remove('sc-enter');
    }, 520);

    setTimeout(() => {
      setOptimizedImageSrc(refA, p.img);
      applyProductScale(refA, p);
    }, 280);

    info?.classList.add('switching');
    setTimeout(() => {
      applyProductMeta(p);
      info?.classList.remove('switching');
    }, 280);

    setTimeout(() => {
      tilt?.classList.remove('sc-slide-next', 'sc-slide-prev');
      stage?.classList.remove('sc-transitioning');
    }, 900);

    cur = i;
    if (elCur) elCur.textContent = String(i + 1).padStart(2, '0');
    hero.style.backgroundColor = p.mood;
    showHeroSlide(p);
    syncDots();
  }

  function next() {
    go((cur + 1) % PRODUCTS.length, 1);
  }

  function restart() {
    if (heroPaused || reduced) return;
    clearInterval(timer);
    timer = setInterval(next, CYCLE_MS);
    syncDots();
  }

  function pause() {
    heroPaused = true;
    clearInterval(timer);
    dotsWrap.querySelectorAll('.sc-dot-fill').forEach((f) => {
      if (f.style.animation) f.style.animationPlayState = 'paused';
    });
  }

  function unpause() {
    heroPaused = false;
    restart();
  }

  // ── Hero backdrop stills ────────────────────────────────────────────────
  // The hero used to play six product clips (11 MB of MP4) behind the copy,
  // behind a tap-to-play button. It is one still per product now, cross-faded
  // by the same carousel that already drives the headline and the dots.
  //
  // Keyed by slug, not by index: the live PRODUCTS order comes from the DB
  // (see __montanaHeroPatch) and is not guaranteed to match the file
  // numbering. Root-absolute so /en/ resolves them too.
  const HERO_SLIDE_BY_SLUG = {
    'acne-facial-cleanser': '/images/hero-slide-1.webp',
    'whitening-cleanser': '/images/hero-slide-2.webp',
    'whitening-cream': '/images/hero-slide-3.webp',
    'hand-body-lotion': '/images/hero-slide-4.webp',
    'post-laser-cream': '/images/hero-slide-5.webp',
    // The catalog calls the gel 'anti-scar-silicone-gel'; the hardcoded
    // fallback list in this file calls it 'anti-scar-gel'. Both are here
    // because the old video playlist only had the short one, so the gel
    // slide never matched live and silently kept the previous backdrop.
    'anti-scar-silicone-gel': '/images/hero-slide-6.webp',
    'anti-scar-gel': '/images/hero-slide-6.webp',
  };

  const slideEls = [
    document.getElementById('hero-bg-slide'),
    document.getElementById('hero-bg-slide-b'),
  ];
  let slideFront = slideEls[0];
  let slideBack = slideEls[1];

  const heroSlideSrc = (product) => (product?.slug ? HERO_SLIDE_BY_SLUG[product.slug] : null);

  // Two stacked <img> layers: the incoming one only fades up once it has
  // decoded, so a slow connection never shows a half-painted backdrop.
  function showHeroSlide(product) {
    const src = heroSlideSrc(product);
    if (!slideFront || !slideBack || !src) return; // no still for it — keep the last
    if (slideFront.getAttribute('src') === src) return;

    const swap = () => {
      slideBack.classList.add('is-active');
      slideFront.classList.remove('is-active');
      const prev = slideFront;
      slideFront = slideBack;
      slideBack = prev;
    };

    if (slideBack.getAttribute('src') !== src) slideBack.src = src;
    if (slideBack.complete && slideBack.naturalWidth) swap();
    else slideBack.addEventListener('load', swap, { once: true });
  }

  if (slideFront) {
    const first = heroSlideSrc(PRODUCTS[0]);
    if (first && slideFront.getAttribute('src') !== first) slideFront.src = first;
    slideFront.classList.add('is-active');
    // Warm the rest so no fade ever waits on the network.
    PRODUCTS.forEach((p) => {
      const src = heroSlideSrc(p);
      if (src) { const im = new Image(); im.src = src; }
    });
  }

  restart();
  stage?.addEventListener('mouseenter', pause);
  stage?.addEventListener('mouseleave', () => {
    if (hero.getBoundingClientRect().bottom > window.innerHeight * 0.4) unpause();
  });

  // Pause when hero leaves viewport
  if ('IntersectionObserver' in window) {
    const visObs = new IntersectionObserver(
      ([entry]) => {
        if (entry.intersectionRatio < 0.35) pause();
        else if (!stage?.matches(':hover')) unpause();
      },
      { threshold: [0, 0.35, 0.55] }
    );
    visObs.observe(hero);
  }

  // 3D tilt
  if (!reduced && hoverCapable && stage && tilt) {
    stage.addEventListener('mousemove', (e) => {
      const r = stage.getBoundingClientRect();
      const dx = (e.clientX - r.left) / r.width - 0.5;
      const dy = (e.clientY - r.top) / r.height - 0.5;
      tilt.style.transform = `rotateY(${dx * 14}deg) rotateX(${dy * -12}deg)`;
    });
    stage.addEventListener('mouseleave', () => {
      tilt.style.transform = '';
    });

    let rafId = null;
    hero.addEventListener('mousemove', (e) => {
      if (rafId) return;
      rafId = requestAnimationFrame(() => {
        const dx = e.clientX / window.innerWidth - 0.5;
        const dy = e.clientY / window.innerHeight - 0.5;
        if (heroBg) heroBg.style.transform = `translate(${dx * -14}px, ${dy * -10}px) scale(1.04)`;
        if (heroBokeh) heroBokeh.style.transform = `translate(${dx * -34}px, ${dy * -24}px)`;
        if (heroDust) heroDust.style.transform = `translate(${dx * -22}px, ${dy * -16}px)`;
        rafId = null;
      });
    });
    hero.addEventListener('mouseleave', () => {
      if (heroBg) heroBg.style.transform = 'scale(1.04)';
      if (heroBokeh) heroBokeh.style.transform = '';
      if (heroDust) heroDust.style.transform = '';
    });
  }

  // Swipe (RTL)
  stage?.addEventListener('touchstart', (e) => {
    touchX = e.touches[0].clientX;
    pause();
  }, { passive: true });
  stage?.addEventListener('touchend', (e) => {
    if (touchX === null) return;
    const dx = e.changedTouches[0].clientX - touchX;
    touchX = null;
    const isEn = getLocale() === 'en';
    if (isEn) {
      if (dx < -45) go((cur + 1) % PRODUCTS.length, 1);
      else if (dx > 45) go((cur - 1 + PRODUCTS.length) % PRODUCTS.length, -1);
    } else {
      if (dx > 45) go((cur + 1) % PRODUCTS.length, 1);
      else if (dx < -45) go((cur - 1 + PRODUCTS.length) % PRODUCTS.length, -1);
    }
    unpause();
  }, { passive: true });

  hero.setAttribute('tabindex', '0');
  hero.addEventListener('keydown', (e) => {
    const isEn = getLocale() === 'en';
    if (isEn ? e.key === 'ArrowRight' : e.key === 'ArrowLeft') {
      go((cur + 1) % PRODUCTS.length, 1);
      restart();
    } else if (isEn ? e.key === 'ArrowLeft' : e.key === 'ArrowRight') {
      go((cur - 1 + PRODUCTS.length) % PRODUCTS.length, -1);
      restart();
    }
  });

  // Scroll parallax
  if (!reduced) {
    let ticking = false;
    window.addEventListener(
      'scroll',
      () => {
        if (ticking) return;
        ticking = true;
        requestAnimationFrame(() => {
          const y = window.scrollY;
          const vh = window.innerHeight;
          const p = Math.min(Math.max(y / (vh * 0.55), 0), 1);
          hero.classList.toggle('hero-scrolled', y > 24);
          if (info) info.style.transform = `translateY(${p * -36}px)`;
          if (stage) stage.style.transform = `translateY(${p * 28}px)`;
          ticking = false;
        });
      },
      { passive: true }
    );
  }

  // Custom cursor
  if (!reduced && hoverCapable && cursor) {
    let cx = 0;
    let cy = 0;
    let rx = 0;
    let ry = 0;
    hero.addEventListener('mouseenter', () => cursor.classList.add('hc-visible'));
    hero.addEventListener('mouseleave', () => {
      cursor.classList.remove('hc-visible', 'hc-grow', 'hc-arrow');
    });
    hero.addEventListener('mousemove', (e) => {
      cx = e.clientX;
      cy = e.clientY;
    });
    (function tick() {
      rx += (cx - rx) * 0.18;
      ry += (cy - ry) * 0.18;
      cursor.style.transform = `translate(${rx}px, ${ry}px)`;
      requestAnimationFrame(tick);
    })();

    const growTargets = '.sc-dot, .sc-cta-ghost, .sc-cta-solid, .showcase-stage, #sc-cart-btn';
    hero.querySelectorAll(growTargets).forEach((el) => {
      el.addEventListener('mouseenter', () => cursor.classList.add('hc-grow'));
      el.addEventListener('mouseleave', () => cursor.classList.remove('hc-grow'));
    });
    cta?.addEventListener('mouseenter', () => cursor.classList.add('hc-arrow'));
    cta?.addEventListener('mouseleave', () => cursor.classList.remove('hc-arrow'));

    if (cta) {
      cta.addEventListener('mousemove', (e) => {
        const r = cta.getBoundingClientRect();
        cta.style.setProperty('--mx', `${(e.clientX - (r.left + r.width / 2)) * 0.35}px`);
        cta.style.setProperty('--my', `${(e.clientY - (r.top + r.height / 2)) * 0.35}px`);
      });
      cta.addEventListener('mouseleave', () => {
        cta.style.setProperty('--mx', '0px');
        cta.style.setProperty('--my', '0px');
      });
    }
  }

  // Add to cart
  cartBtn?.addEventListener('click', () => {
    const p = PRODUCTS[cur];
    if (window.Cart?.add) {
      window.Cart.add(
        {
          id: p.cartId || p.slug,
          name: p.cartName || p.name,
          image: p.cartImage || p.img,
          price: p.price,
        },
        1
      );
    }
    cartBtn.classList.add('sc-cart-pulse');
    setTimeout(() => cartBtn.classList.remove('sc-cart-pulse'), 600);
  });

  window.__montanaHeroPatch = function (newProducts) {
    if (!newProducts?.length) return;
    const enrichFn = getLocale() === 'en' ? enrichHeroSlideEn : enrichHeroSlide;
    PRODUCTS.splice(0, PRODUCTS.length, ...newProducts.map((p) => enrichFn({ ...p, img: assetUrl(p.img) })));
    if (scTotal) scTotal.textContent = String(PRODUCTS.length).padStart(2, '0');
    dotsWrap.innerHTML = '';
    PRODUCTS.forEach((p, i) => {
      const d = document.createElement('button');
      d.type = 'button';
      d.className = `sc-dot${i === 0 ? ' active' : ''}`;
      d.setAttribute('aria-label', p.name);
      d.innerHTML = '<span class="sc-dot-fill"></span>';
      d.onclick = () => {
        go(i, i > cur ? 1 : -1);
        restart();
      };
      dotsWrap.appendChild(d);
    });
    cur = 0;
    frontIsA = true;
    setOptimizedImageSrc(imgA, PRODUCTS[0].img);
    imgA.classList.add('active');
    imgB.classList.remove('active');
    applyProductScale(imgA, PRODUCTS[0]);
    setOptimizedImageSrc(refA, PRODUCTS[0].img);
    applyProductScale(refA, PRODUCTS[0]);
    applyProductMeta(PRODUCTS[0]);
    hero.style.backgroundColor = PRODUCTS[0].mood;
    if (elCur) elCur.textContent = '01';
    syncDots();
    restart();
    showHeroSlide(PRODUCTS[0]);
  };
}
