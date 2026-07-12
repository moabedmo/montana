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
  { img: 'images/p1.webp', en: 'ACNE FACIAL CLEANSER', name: 'غسول الوجه لعلاج حب الشباب', tag: 'تنظيف لطيف وعميق للبشرة المعرضة للحبوب', price: 285, mood: '#453f64', scale: 1.16, slug: 'acne-facial-cleanser' },
  { img: 'images/p2.webp', en: 'WHITENING CLEANSER', name: 'غسول التفتيح والتوحيد', tag: 'إشراقة يومية وتوحيد فوري للون البشرة', price: 310, mood: '#4f3f5c', scale: 1.16, slug: 'whitening-cleanser' },
  { img: 'images/p3.webp', en: 'WHITENING CREAM', name: 'كريم التفتيح', tag: 'تفتيح ملحوظ وترطيب يدوم طوال اليوم', price: 240, mood: '#543d67', slug: 'whitening-cream' },
  { img: 'images/p4.webp', en: 'HAND & BODY LOTION', name: 'لوشن اليدين والجسم', tag: 'نعومة حريرية لجسمك من أول استخدام', price: 195, mood: '#503f60', slug: 'hand-body-lotion' },
  { img: 'images/p5.webp', en: 'POST-LASER CREAM', name: 'كريم ما بعد الليزر', tag: 'تهدئة وترميم البشرة بعد الجلسات', price: 265, mood: '#5a4358', slug: 'post-laser-cream' },
  { img: 'images/p6.webp', en: 'ANTI-SCAR SILICONE GEL', name: 'جل السيليكون لعلاج الندبات', tag: 'تحسين مظهر الندبات الحديثة والقديمة', price: 340, mood: '#493d58', slug: 'anti-scar-gel' },
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
    syncDots();
  }

  function next() {
    go((cur + 1) % PRODUCTS.length, 1);
  }

  function restart() {
    if (heroPaused || reduced || hero.classList.contains('hero-has-video')) return;
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

  // Hero background video(s) → freeze image carousel, play videos back-to-back.
  // Video files are named by product (videos/p{n}.mp4) mapped to a slug, because
  // the live PRODUCTS order comes from the DB (see __montanaHeroPatch) and is not
  // guaranteed to match the p1..p6 file numbering — so we match on slug, not index.
  // Root-absolute so this resolves correctly from both / and /en/ (relative
  // paths would 404 under /en/videos/... and silently kill the video hero).
  const HERO_VIDEO_FILES = [
    { src: '/videos/p1.mp4', slug: 'acne-facial-cleanser' },
    { src: '/videos/p2.mp4', slug: 'whitening-cleanser' },
    { src: '/videos/p3.mp4', slug: 'whitening-cream' },
    { src: '/videos/p4.mp4', slug: 'hand-body-lotion' },
    { src: '/videos/p5.mp4', slug: 'post-laser-cream' },
    { src: '/videos/p6.mp4', slug: 'anti-scar-gel' },
  ];
  const heroVideoEl = document.getElementById('hero-bg-video');
  let heroVideoList = []; // existing videos in file order: [{ src, slug }]
  let heroVpos = 0;

  function heroVideoProduct() {
    const slug = heroVideoList[heroVpos]?.slug;
    const idx = slug ? PRODUCTS.findIndex((p) => p.slug === slug) : -1;
    return { idx, product: idx >= 0 ? PRODUCTS[idx] : null };
  }

  function applyHeroVideoText(animate) {
    const { idx, product } = heroVideoProduct();
    if (!product) return; // product not in current catalog — keep last text, still play video
    cur = idx;
    hero.style.backgroundColor = product.mood;
    if (elCur) elCur.textContent = String(idx + 1).padStart(2, '0');
    info?.classList.add('switching');
    setTimeout(() => {
      applyProductMeta(product);
      info?.classList.remove('switching');
    }, animate && !reduced ? 260 : 0);
  }

  // Two stacked <video> layers so we can softly cross-fade between clips (a single
  // element would flash a black frame while the new src loads). Some localized
  // pages (e.g. /en/) still ship only one <video> — create the second layer on the
  // fly so the fade works everywhere.
  let heroVidB = document.getElementById('hero-bg-video-b');
  if (heroVideoEl && !heroVidB) {
    heroVidB = document.createElement('video');
    heroVidB.id = 'hero-bg-video-b';
    heroVidB.className = 'hero-bg-video';
    heroVidB.muted = true;
    heroVidB.setAttribute('playsinline', '');
    heroVidB.preload = 'auto';
    heroVidB.setAttribute('aria-hidden', 'true');
    heroVideoEl.insertAdjacentElement('afterend', heroVidB);
  }
  let heroActive = heroVideoEl;
  let heroIdle = heroVidB;
  let heroTransitioning = false;
  const FADE_MS = 800;      // cross-fade duration
  const FADE_LEAD = 1.1;    // seconds before a clip ends to start the fade

  function playVid(vid) {
    const p = vid.play();
    if (p && p.catch) p.catch(() => {});
  }

  const nextPos = () => (heroVpos + 1) % heroVideoList.length;

  // Buffer the following clip into the idle layer so the fade can start instantly
  // (no waiting → no freeze on the current clip's last frame).
  function preloadNext() {
    if (heroVideoList.length < 2) return;
    const { src } = heroVideoList[nextPos()];
    if (heroIdle.getAttribute('src') !== src) { heroIdle.src = src; heroIdle.load(); }
    heroIdle.classList.remove('is-active');
  }

  // Paint the given clip on the active layer immediately (first frame / no fade).
  function showHeroVideo(pos) {
    heroVpos = (pos + heroVideoList.length) % heroVideoList.length;
    const { src } = heroVideoList[heroVpos];
    applyHeroVideoText(false);
    if (heroActive.getAttribute('src') !== src) {
      heroActive.src = src; heroActive.load();
      heroActive.classList.add('is-active');
      playVid(heroActive);
    } else {
      // Already the right clip: if it's already autoplaying, leave it running —
      // resetting currentTime here would seek/restart it and flash the poster frame.
      heroActive.classList.add('is-active');
      if (heroActive.paused) { heroActive.currentTime = 0; playVid(heroActive); }
    }
    preloadNext();
  }

  // Soft cross-fade to the (already preloaded) next clip while the current one is
  // still playing — started slightly before the current clip ends, so it never
  // stops on its last frame.
  function crossfadeToNext() {
    if (heroTransitioning || heroVideoList.length < 2) return;
    heroTransitioning = true;
    heroVpos = nextPos();
    heroIdle.currentTime = 0;
    playVid(heroIdle);
    applyHeroVideoText(true);
    requestAnimationFrame(() => {
      heroIdle.classList.add('is-active');      // fade in
      heroActive.classList.remove('is-active'); // fade out
    });
    setTimeout(() => {
      heroActive.pause();
      const prev = heroActive;
      heroActive = heroIdle;
      heroIdle = prev;
      heroTransitioning = false;
      preloadNext(); // buffer the clip after this one
    }, FADE_MS + 60);
  }

  async function setupHeroVideoPlaylist() {
    const found = [];
    for (const f of HERO_VIDEO_FILES) {
      try {
        const r = await fetch(f.src, { method: 'HEAD' });
        if (r.ok) found.push(f);
      } catch (_) { /* missing → skip */ }
    }
    if (!found.length) { hero.classList.remove('hero-has-video'); restart(); return; }
    heroVideoList = found;

    showHeroVideo(0);
    if (found.length > 1) {
      heroVideoEl.loop = false;
      heroVidB.loop = false;
      // Begin the fade FADE_LEAD seconds before the clip ends so the outgoing clip
      // keeps playing through the transition instead of pausing on its last frame.
      const onTime = (e) => {
        const v = e.target;
        if (v !== heroActive || heroTransitioning || !v.duration) return;
        if (v.currentTime >= v.duration - FADE_LEAD) crossfadeToNext();
      };
      // Safety net: if a clip somehow reaches the very end, advance immediately.
      const onEnded = (e) => {
        if (e.target === heroActive && !heroTransitioning) crossfadeToNext();
      };
      [heroVideoEl, heroVidB].forEach((v) => {
        v.addEventListener('timeupdate', onTime);
        v.addEventListener('ended', onEnded);
      });
    } else {
      heroActive.loop = true;
    }
  }

  // Skip the autoplay video playlist on mobile/reduced-motion (isLite) —
  // it was fetching 2 full video clips (~3-4MB) within seconds of page
  // load on every device, including mobile data. Those visitors get the
  // existing static-image carousel instead (the same fallback already used
  // when no video files are found at all), desktop keeps the video hero.
  if (heroVideoEl && heroVidB && !isLite) {
    hero.classList.add('hero-has-video');
    setupHeroVideoPlaylist();
    // Mobile browsers sometimes block autoplay (low battery / data saver).
    // A single tap anywhere on the hero should resume the active layer.
    hero.addEventListener('click', () => {
      if (heroActive.paused) playVid(heroActive);
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

    // In video mode, the new catalog just overwrote the text with PRODUCTS[0];
    // re-assert the text for whichever video is currently playing (matched by slug).
    if (hero.classList.contains('hero-has-video') && heroVideoList.length) {
      applyHeroVideoText(false);
    }
  };
}
