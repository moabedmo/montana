/**
 * Renders English homepage sections from i18n data.
 */
import { CONCERNS, HOME_SECTIONS, COSMETIC_DISCLAIMER, UI_STRINGS } from './i18n/en.js';
import { getLocale, resolveAssetUrl, productUrl, pageUrl } from './i18n/locale.js?v=3';

function renderConcerns() {
  const grid = document.getElementById('concernsGrid');
  if (!grid || getLocale() !== 'en') return;
  if (grid.dataset.rendered === '1') return;

  grid.innerHTML = CONCERNS.map(
    (c) => `
    <article class="lux-concern-card">
      <div class="lux-concern-icon"><i class="fas ${c.icon}"></i></div>
      <h3>${c.title}</h3>
      <p class="lux-concern-text">${c.indication}</p>
      <div class="lux-concern-products">
        ${c.products
          .map(
            (slug) =>
              `<a href="${productUrl(slug)}" class="lux-concern-chip">${c.labels[slug] || slug}</a>`
          )
          .join('')}
      </div>
    </article>`
  ).join('');

  const disclaimer = document.querySelector('.lux-concerns-disclaimer');
  if (disclaimer) disclaimer.textContent = COSMETIC_DISCLAIMER;
  grid.dataset.rendered = '1';
}

function patchHomeSections() {
  if (getLocale() !== 'en') return;
  const H = HOME_SECTIONS;
  const U = UI_STRINGS;

  const bridgeTag = document.querySelector('.lux-bridge-tagline');
  if (bridgeTag && H.bridge?.tagline) bridgeTag.textContent = H.bridge.tagline;

  document.querySelectorAll('.lux-trust-item span:last-child').forEach((el, i) => {
    if (H.bridge?.trust?.[i]) el.textContent = H.bridge.trust[i];
  });

  const concernHead = document.querySelector('#shop-by-concern .lux-section-head');
  if (concernHead && U.shopByConcern) {
    concernHead.querySelector('.lux-eyebrow').textContent = U.shopByConcern.eyebrow;
    concernHead.querySelector('h2').textContent = U.shopByConcern.title;
    concernHead.querySelector('p').textContent = U.shopByConcern.subtitle;
  }

  const heroTitle = document.getElementById('sc-hero-title');
  if (heroTitle && U.hero?.titleHtml) heroTitle.innerHTML = U.hero.titleHtml;

  const chipSub = document.querySelector('.hero-brand-chip .chip-sub');
  if (chipSub) chipSub.textContent = U.hero.chipSub;
  const scrollLabel = document.querySelector('.hero-scroll-label');
  if (scrollLabel) scrollLabel.textContent = U.hero.scrollLabel;

  const ctaDiscover = document.getElementById('sc-cta');
  if (ctaDiscover) ctaDiscover.innerHTML = `${U.hero.discoverCta} <span class="cta-arrow">←</span>`;

  const cartBtn = document.getElementById('sc-cart-btn');
  if (cartBtn) cartBtn.innerHTML = `<i class="fas fa-shopping-bag"></i> ${U.hero.addToCart}`;

  // Brand story
  const brand = document.querySelector('#brand-story, .lux-brand');
  if (brand && H.brandStory) {
    brand.querySelector('.lux-eyebrow')?.replaceChildren(document.createTextNode(H.brandStory.eyebrow));
    const h2 = brand.querySelector('h2');
    if (h2) h2.textContent = H.brandStory.title;
    const paras = brand.querySelectorAll('.lux-brand-copy p, .lux-brand-text p');
    H.brandStory.paragraphs?.forEach((text, i) => {
      if (paras[i]) paras[i].textContent = text;
    });
    brand.querySelectorAll('.lux-stat-num').forEach((el, i) => {
      if (H.brandStory.stats?.[i]) el.textContent = H.brandStory.stats[i].num;
    });
    brand.querySelectorAll('.lux-stat-label').forEach((el, i) => {
      if (H.brandStory.stats?.[i]) el.textContent = H.brandStory.stats[i].label;
    });
  }

  // Ritual
  const ritual = document.querySelector('#ritual, .lux-ritual');
  if (ritual && H.ritual) {
    ritual.querySelector('.lux-eyebrow')?.replaceChildren(document.createTextNode(H.ritual.eyebrow));
    ritual.querySelector('h2')?.replaceChildren(document.createTextNode(H.ritual.title));
    ritual.querySelector('.lux-section-head p, .lux-ritual-sub')?.replaceChildren(document.createTextNode(H.ritual.subtitle));
    ritual.querySelectorAll('.lux-ritual-step').forEach((step, i) => {
      const s = H.ritual.steps?.[i];
      if (!s) return;
      step.querySelector('.lux-ritual-num')?.replaceChildren(document.createTextNode(s.num));
      step.querySelector('h3')?.replaceChildren(document.createTextNode(s.title));
      step.querySelector('p')?.replaceChildren(document.createTextNode(s.desc));
    });
  }

  // Ingredients
  const ing = document.querySelector('#ingredients');
  if (ing && H.ingredients) {
    ing.querySelector('.lux-eyebrow')?.replaceChildren(document.createTextNode(H.ingredients.eyebrow));
    ing.querySelector('h2')?.replaceChildren(document.createTextNode(H.ingredients.title));
    ing.querySelector('.lux-section-head p')?.replaceChildren(document.createTextNode(H.ingredients.subtitle));
    ing.querySelectorAll('.lux-ing-card').forEach((card, i) => {
      const c = H.ingredients.cards?.[i];
      if (!c) return;
      card.querySelector('.lux-ing-product')?.replaceChildren(document.createTextNode(c.product));
      const list = card.querySelector('.lux-ing-list');
      if (list) {
        list.innerHTML = c.items.map((item) => `<li><span class="lux-ing-dot"></span>${item}</li>`).join('');
      }
      const link = card.querySelector('.lux-ing-link');
      if (link) {
        link.href = productUrl(c.slug);
        link.innerHTML = `${H.ingredients.discover} <i class="fas fa-arrow-left"></i>`;
      }
      card.querySelector('img')?.setAttribute('alt', c.imgAlt);
    });
  }

  // Reviews
  const rev = document.querySelector('#reviews, .lux-reviews');
  if (rev && H.reviews) {
    rev.querySelector('.lux-eyebrow')?.replaceChildren(document.createTextNode(H.reviews.eyebrow));
    rev.querySelector('h2')?.replaceChildren(document.createTextNode(H.reviews.title));
    rev.querySelector('.lux-reviews-score strong')?.replaceChildren(document.createTextNode(H.reviews.score));
    rev.querySelector('.lux-reviews-score span')?.replaceChildren(document.createTextNode(H.reviews.scoreMax));
    rev.querySelector('.lux-reviews-count')?.replaceChildren(document.createTextNode(H.reviews.count));
    rev.querySelectorAll('.lux-review-card').forEach((card, i) => {
      const r = H.reviews.items?.[i];
      if (!r) return;
      card.querySelector('.lux-review-stars')?.replaceChildren(document.createTextNode(r.stars));
      card.querySelector('.lux-review-text')?.replaceChildren(document.createTextNode(r.text));
      card.querySelector('.lux-review-avatar')?.replaceChildren(document.createTextNode(r.initial));
      card.querySelector('.lux-review-name')?.replaceChildren(document.createTextNode(r.name));
      card.querySelector('.lux-review-meta')?.replaceChildren(document.createTextNode(r.product));
    });
  }

  // Features bar
  document.querySelectorAll('.feature-item').forEach((item, i) => {
    const keys = ['fastShipping', 'authentic', 'easyReturns', 'securePay'];
    const f = U.features?.[keys[i]];
    if (!f) return;
    item.querySelector('h4')?.replaceChildren(document.createTextNode(f.title));
    item.querySelector('p')?.replaceChildren(document.createTextNode(f.desc));
  });

  // Categories / trending headers
  document.querySelector('#categories .section-header h2')?.replaceChildren(document.createTextNode(U.categories.title));
  document.querySelector('#categories .section-header p')?.replaceChildren(document.createTextNode(U.categories.subtitle));
  document.querySelector('#trending .section-header h2')?.replaceChildren(document.createTextNode(U.trending.title));
  document.querySelector('#trending .section-header p')?.replaceChildren(document.createTextNode(U.trending.subtitle));

  // Newsletter
  const nl = document.querySelector('.newsletter-section, #newsletter');
  if (nl && H.newsletter) {
    nl.querySelector('h2')?.replaceChildren(document.createTextNode(H.newsletter.title));
    nl.querySelector('p')?.replaceChildren(document.createTextNode(H.newsletter.subtitle));
    const input = nl.querySelector('input[type="email"]');
    if (input) input.placeholder = H.newsletter.placeholder;
    const btn = nl.querySelector('button');
    if (btn) btn.textContent = H.newsletter.cta;
  }

  document.title = U.meta.siteTitle;
  patchFooterAndMobile();
}

function patchFooterAndMobile() {
  if (getLocale() !== 'en') return;
  const U = UI_STRINGS;
  const H = HOME_SECTIONS;

  // Footer (index inline footer)
  const footer = document.querySelector('footer.footer');
  if (footer) {
    const f = U.footer;
    const cols = footer.querySelectorAll('.footer-col');
    if (cols[0]) cols[0].querySelector('p')?.replaceChildren(document.createTextNode(f.tagline));
    if (cols[1]) {
      cols[1].querySelector('h3')?.replaceChildren(document.createTextNode(f.quickLinks));
      const links = cols[1].querySelectorAll('a');
      [f.about, f.contact, f.faq, f.privacy, f.terms].forEach((t, i) => links[i]?.replaceChildren(document.createTextNode(t)));
    }
    if (cols[2]) {
      cols[2].querySelector('h3')?.replaceChildren(document.createTextNode(f.customerService));
      const links = cols[2].querySelectorAll('a');
      [f.trackOrder, f.returns, f.shipping, f.myAccount].forEach((t, i) => links[i]?.replaceChildren(document.createTextNode(t)));
    }
    if (cols[3]) {
      cols[3].querySelector('h3')?.replaceChildren(document.createTextNode(f.contactUs));
      const clock = cols[3].querySelector('.fa-clock')?.parentElement;
      if (clock) clock.innerHTML = `<i class="fas fa-clock"></i> ${f.hours}`;
    }
    footer.querySelector('.footer-bottom p')?.replaceChildren(document.createTextNode(f.copyright));
  }

  // Floating store CTA
  const storeBtn = document.querySelector('.floating-store-btn');
  if (storeBtn) {
    storeBtn.href = pageUrl('category.html');
    storeBtn.innerHTML = `<i class="fas fa-store"></i> ${U.floatingStore}`;
  }

  // Header top + actions
  document.querySelector('.header-top-links a[href*="account"]')?.replaceChildren(
    document.createTextNode(''),
    ...(() => {
      const a = document.querySelector('.header-top-links a[href*="account"]');
      if (!a) return [];
      a.innerHTML = `<i class="fas fa-map-marker-alt"></i> ${U.header.trackOrder}`;
      return [];
    })()
  );
  document.querySelectorAll('.header-top-links a').forEach((a, i) => {
    const texts = [U.header.trackOrder, U.header.customerCare];
    if (i < 2) a.innerHTML = `<i class="fas fa-${i === 0 ? 'map-marker-alt' : 'headset'}"></i> ${texts[i]}`;
  });
  document.querySelector('.search-bar input')?.setAttribute('placeholder', U.header.searchPlaceholder);
  document.querySelectorAll('.header-action small').forEach((el, i) => {
    const labels = [U.header.store, U.header.wishlist, U.header.account, U.header.cart];
    if (labels[i]) el.textContent = labels[i];
  });
  document.querySelectorAll('.nav-links .nav-item > a').forEach((a, i) => {
    const items = [
      [U.nav.home, 'fa-home'],
      [U.nav.skincare, 'fa-spa'],
      [`${U.nav.haircare} (${U.nav.comingSoon})`, 'fa-pump-soap'],
      [`${U.nav.health} (${U.nav.comingSoon})`, 'fa-heartbeat'],
      [`${U.nav.kids} (${U.nav.comingSoon})`, 'fa-baby'],
      [`${U.nav.therm} (${U.nav.comingSoon})`, 'fa-temperature-low'],
    ];
    const item = items[i];
    if (item) a.innerHTML = `<i class="fas ${item[1]}"></i> ${item[0]}`;
  });

  // Promo banner
  document.querySelectorAll('.promo-slider span').forEach((el, i) => {
    if (U.promo[i]) el.textContent = U.promo[i];
  });

  // Categories section
  document.querySelector('#categories .lux-eyebrow')?.replaceChildren(document.createTextNode(U.categories.eyebrow));
  document.querySelector('.category-card h3')?.replaceChildren(document.createTextNode(U.categories.skincare));
  document.querySelector('.category-link')?.replaceChildren(document.createTextNode(U.categories.shopNow));
  document.querySelector('.lux-roadmap p')?.replaceChildren(document.createTextNode(U.categories.roadmap));

  // Trending tabs
  const tabKeys = ['all', 'skincare', 'haircare', 'health', 'kids', 'therm'];
  document.querySelectorAll('.section-tabs .tab-btn').forEach((btn, i) => {
    const key = tabKeys[i];
    if (key && U.trending.tabs[key]) btn.textContent = U.trending.tabs[key];
  });
  document.querySelector('#trending .view-all-link, #trending .section-header a')?.replaceChildren(document.createTextNode(U.trending.viewAll));

  // Rewards
  const rewards = document.querySelector('.rewards-section');
  if (rewards && U.rewards) {
    rewards.querySelector('.rewards-badge')?.replaceChildren(document.createTextNode(U.rewards.badge));
    rewards.querySelector('h2')?.replaceChildren(document.createTextNode(U.rewards.title));
    rewards.querySelector('.rewards-section > .container > p, .rewards-content > p')?.replaceChildren(document.createTextNode(U.rewards.subtitle));
    rewards.querySelectorAll('.perk span, .perk').forEach((el, i) => {
      if (U.rewards.perks[i]) {
        if (el.querySelector('span')) el.querySelector('span').textContent = U.rewards.perks[i];
        else el.appendChild(document.createTextNode(U.rewards.perks[i]));
      }
    });
    rewards.querySelector('.rewards-content .btn-primary, .rewards-cta')?.replaceChildren(document.createTextNode(U.rewards.cta));
    rewards.querySelector('.rc-name')?.replaceChildren(document.createTextNode(U.rewards.cardTier));
    rewards.querySelector('.rc-points')?.replaceChildren(document.createTextNode(U.rewards.cardPoints));
  }

  // Before / after
  const ba = document.querySelector('.before-after-section');
  if (ba && U.beforeAfter) {
    ba.querySelector('h2')?.replaceChildren(document.createTextNode(U.beforeAfter.title));
    ba.querySelector('.section-header p')?.replaceChildren(document.createTextNode(U.beforeAfter.subtitle));
    ba.querySelectorAll('.ba-label').forEach((el, i) => {
      el.textContent = i === 0 ? U.beforeAfter.before : U.beforeAfter.after;
    });
  }

  // Mobile bottom nav
  document.querySelectorAll('.mobile-bottom-nav a span:not(.nav-badge)').forEach((el, i) => {
    const labels = [U.app.home, U.app.store, U.app.offers, U.app.wishlist, U.app.cart];
    if (labels[i]) el.textContent = labels[i];
  });

  // App screens
  document.querySelector('#screen-categories .app-screen-header h2')?.replaceChildren(document.createTextNode(U.app.categories));
  document.querySelector('#screen-categories .app-cat-text h3')?.replaceChildren(document.createTextNode(U.nav.skincare));
  document.querySelector('#screen-categories .app-cat-text span')?.replaceChildren(document.createTextNode(U.categories.productCount));
  document.querySelector('#screen-offers .app-screen-header h2')?.replaceChildren(document.createTextNode(U.offers.title));
  document.querySelector('.app-offer-tag')?.replaceChildren(document.createTextNode(U.offers.limited));
  document.querySelector('.app-offer-info h3')?.replaceChildren(document.createTextNode(U.offers.headline));
  document.querySelector('.app-offer-info p')?.replaceChildren(document.createTextNode(U.offers.desc));
  document.querySelector('.app-offer-btn')?.replaceChildren(document.createTextNode(U.offers.shopNow));
  document.querySelector('.app-section-title h3')?.replaceChildren(document.createTextNode(U.offers.todayDeals));
  document.querySelector('#screen-favorites .app-screen-header h2')?.replaceChildren(document.createTextNode(U.wishlist.title));
  document.querySelector('#screen-favorites .app-empty-state h3')?.replaceChildren(document.createTextNode(U.wishlist.emptyTitle));
  document.querySelector('#screen-favorites .app-empty-state p')?.replaceChildren(document.createTextNode(U.wishlist.emptyDesc));
  document.querySelector('#screen-cart .app-screen-header h2')?.replaceChildren(document.createTextNode(U.cart.title));

  // Cart screen renderer (mobile)
  const C = U.cart;
  window.renderAppCart = function renderAppCartEn() {
    const body = document.getElementById('appCartBody');
    if (!body || !window.Cart) return;
    const items = window.Cart.getItems();
    if (!items.length) {
      body.innerHTML = `
            <div class="app-empty-state">
                <div class="app-empty-icon"><i class="fas fa-shopping-bag"></i></div>
                <h3>${C.emptyTitle}</h3>
                <p>${C.emptyDesc}</p>
                <button class="app-empty-btn" onclick="switchScreen('home')">${C.browse}</button>
            </div>`;
      return;
    }
    const subtotal = window.Cart.getTotal();
    body.innerHTML = items.map(it => `
        <div class="app-cart-item">
            <img src="${resolveAssetUrl(it.image)}" alt="">
            <div class="app-cart-info">
                <h4>${it.name}</h4>
                <span class="app-cart-brand">Montaña</span>
                <div class="app-cart-bottom">
                    <span class="app-cart-price">${Math.round(it.price * it.qty)} EGP</span>
                    <div class="app-cart-qty">
                        <button onclick="Cart.setQty(${it.id}, ${it.qty - 1}); renderAppCart()">-</button>
                        <span>${it.qty}</span>
                        <button onclick="Cart.setQty(${it.id}, ${it.qty + 1}); renderAppCart()">+</button>
                    </div>
                </div>
            </div>
            <button class="app-cart-remove" onclick="Cart.remove(${it.id}); renderAppCart()"><i class="fas fa-trash-alt"></i></button>
        </div>
    `).join('') + `
        <div class="app-cart-summary">
            <div class="app-cart-row"><span>${C.subtotal}</span><span>${Math.round(subtotal)} EGP</span></div>
            <div class="app-cart-row"><span>${C.shipping}</span><span class="app-free">${C.shippingCalc}</span></div>
            <div class="app-cart-row app-cart-total"><span>${C.total}</span><span>${Math.round(subtotal)} EGP</span></div>
            <button class="app-checkout-btn" onclick="window.location.href='checkout.html'">
                <i class="fas fa-lock"></i> ${C.checkout}
            </button>
        </div>`;
  };

  // Quick view modal
  document.getElementById('modalAddBtn')?.replaceChildren(
    document.createTextNode(''),
    ...(() => {
      const btn = document.getElementById('modalAddBtn');
      if (btn) btn.innerHTML = `<i class="fas fa-shopping-bag"></i> ${U.modal.addToCart}`;
      return [];
    })()
  );
}

renderConcerns();
patchHomeSections();

if (window.montanaInitLuxReveal) {
  window.montanaInitLuxReveal(document.getElementById('concernsGrid'));
}
