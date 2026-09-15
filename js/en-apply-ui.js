/**
 * Apply English UI copy to static page markup (contact, about, search, checkout, footer).
 */
import { UI_STRINGS as U } from './i18n/en.js';
import { getLocale } from './i18n/locale.js?v=3';

function txt(el, value) {
  if (el && value != null) el.textContent = value;
}

function html(el, value) {
  if (el && value != null) el.innerHTML = value;
}

function applyFooter() {
  const f = U.footer;
  const footer = document.querySelector('.footer');
  if (!footer) return;
  const cols = footer.querySelectorAll('.footer-col');
  if (cols[0]) txt(cols[0].querySelector('p'), f.tagline);
  if (cols[1]) {
    txt(cols[1].querySelector('h3'), f.quickLinks);
    const links = cols[1].querySelectorAll('a');
    const labels = [f.about, f.contact, f.faq, f.privacy, f.terms];
    links.forEach((a, i) => { if (labels[i]) a.textContent = labels[i]; });
  }
  if (cols[2]) {
    txt(cols[2].querySelector('h3'), f.customerService);
    const links = cols[2].querySelectorAll('a');
    const labels = [f.trackOrder, f.returns, f.shipping, f.myAccount];
    links.forEach((a, i) => { if (labels[i]) a.textContent = labels[i]; });
  }
  if (cols[3]) {
    txt(cols[3].querySelector('h3'), f.contactUs);
    const clock = cols[3].querySelector('.fa-clock')?.parentElement;
    if (clock) clock.innerHTML = `<i class="fas fa-clock"></i> ${f.hours}`;
  }
  txt(footer.querySelector('.footer-bottom p'), f.copyright);
}

function applyContact() {
  if (!document.querySelector('.contact-content')) return;
  const c = U.contact;
  document.title = `Montana | ${c.title}`;
  txt(document.querySelector('.page-header h2'), c.title);
  const cards = document.querySelectorAll('.contact-card');
  if (cards[0]) txt(cards[0].querySelector('h4'), c.call);
  if (cards[1]) {
    txt(cards[1].querySelector('h4'), c.whatsapp);
    txt(cards[1].querySelector('span'), c.whatsappSub);
  }
  if (cards[2]) txt(cards[2].querySelector('h4'), c.email);
  txt(document.querySelector('.contact-hours h4'), c.hoursTitle);
  txt(document.querySelector('.contact-hours span'), c.hoursDefault);
  txt(document.querySelector('.contact-form-section h3'), c.formTitle);
  const labels = document.querySelectorAll('.contact-form .form-group label');
  const labelTexts = [c.name, c.emailLabel, c.orderOptional, c.subject, c.message];
  labels.forEach((el, i) => txt(el, labelTexts[i]));
  const nameIn = document.getElementById('contactName');
  if (nameIn) nameIn.placeholder = c.namePh;
  const msgIn = document.getElementById('contactMessage');
  if (msgIn) msgIn.placeholder = c.messagePh;
  const sel = document.getElementById('contactSubject');
  if (sel) {
    sel.innerHTML = c.subjects.map((s) => `<option>${s}</option>`).join('');
  }
  const btn = document.getElementById('contactSubmit');
  if (btn) btn.innerHTML = `<i class="fas fa-paper-plane"></i> ${c.submit}`;
  txt(document.querySelector('.contact-location h3'), `<i class="fas fa-map-marker-alt"></i> ${c.location}`.replace(/^/, ''));
  const locH3 = document.querySelector('.contact-location h3');
  if (locH3) locH3.innerHTML = `<i class="fas fa-map-marker-alt"></i> ${c.location}`;
  txt(document.querySelector('.contact-social h3'), c.follow);
}

function applyAbout() {
  if (!document.querySelector('.about-content')) return;
  const a = U.about;
  document.title = `Montana | ${a.title}`;
  txt(document.querySelector('.page-header h2'), a.title);
  txt(document.querySelector('.about-tagline'), a.tagline);
  const sections = document.querySelectorAll('.about-section');
  if (sections[0]) {
    txt(sections[0].querySelector('h3'), a.storyTitle);
    txt(sections[0].querySelector('p'), a.story);
  }
  if (sections[1]) {
    txt(sections[1].querySelector('h3'), a.visionTitle);
    txt(sections[1].querySelector('p'), a.vision);
  }
  document.querySelectorAll('.about-stat-card span').forEach((el, i) => {
    txt(el, [a.stats.clients, a.stats.products, a.stats.brands, a.stats.rating][i]);
  });
  if (sections[2]) {
    txt(sections[2].querySelector('h3'), a.whyTitle);
    sections[2].querySelectorAll('.about-feature').forEach((feat, i) => {
      const f = a.features[i];
      if (!f) return;
      txt(feat.querySelector('h4'), f.title);
      txt(feat.querySelector('p'), f.desc);
    });
  }
}

function applySearch() {
  if (!document.querySelector('.search-page')) return;
  const s = U.search;
  document.title = `Montana | ${s.title}`;
  txt(document.querySelector('.page-header h2'), s.title);
  const input = document.getElementById('searchInput');
  if (input) input.placeholder = s.placeholder;
  txt(document.querySelector('#recentSearches h3'), s.recent);
  txt(document.querySelector('.srch-clear-all'), s.clearAll);
  const trendH = document.querySelector('.srch-section:nth-of-type(2) h3');
  if (trendH) trendH.innerHTML = `${s.trending} <i class="fas fa-fire" style="color:#EF5350"></i>`;
  document.querySelectorAll('.srch-section')[2]?.querySelector('h3') &&
    txt(document.querySelectorAll('.srch-section')[2].querySelector('h3'), s.categories);
  const resultsH = document.querySelector('#searchResults h3');
  if (resultsH) {
    const base = s.results;
    resultsH.childNodes[0].textContent = base + ' ';
  }
  const tags = document.querySelectorAll('#recentSearches .srch-tag');
  const tagLabels = Object.values(s.recentTags);
  tags.forEach((tag, i) => {
    if (tagLabels[i]) tag.innerHTML = `<i class="fas fa-clock"></i> ${tagLabels[i]}`;
  });
  const trendItems = document.querySelectorAll('.srch-trend-item span:not(.srch-rank)');
  s.trendingItems.forEach((label, i) => { if (trendItems[i]) trendItems[i].textContent = label; });
  const chips = document.querySelectorAll('.srch-cat-chip');
  const chipLabels = [
    U.nav.skincare,
  ];
  chips.forEach((chip, i) => {
    if (!chipLabels[i]) return;
    const icon = chip.querySelector('i')?.outerHTML || '';
    chip.innerHTML = `${icon} ${chipLabels[i]}`;
  });
}

function applyCheckoutStatic() {
  if (!document.getElementById('checkoutPage')) return;
  const c = U.checkout;
  document.title = `Montana | ${c.title}`;
  txt(document.querySelector('.page-header h2'), c.title);
  const steps = document.querySelectorAll('.ck-step');
  if (steps[0]) steps[0].innerHTML = `<span>1</span> ${c.steps.address}`;
  if (steps[1]) steps[1].innerHTML = `<span>2</span> ${c.steps.payment}`;
  if (steps[2]) steps[2].innerHTML = `<span>3</span> ${c.steps.confirm}`;
  const sections = document.querySelectorAll('.ck-section');
  const patchSection = (idx, title, icon) => {
    const h = sections[idx]?.querySelector('h3');
    if (h) h.innerHTML = `<i class="fas ${icon}"></i> ${title}`;
  };
  patchSection(0, c.deliveryTitle, 'fa-map-marker-alt');
  const labels0 = sections[0]?.querySelectorAll('label');
  const ph0 = sections[0]?.querySelectorAll('input, textarea');
  const l0 = [c.fullName, c.phone, c.emailOptional, c.address, c.city];
  labels0?.forEach((el, i) => txt(el, l0[i]));
  if (ph0?.[0]) ph0[0].placeholder = c.fullNamePh;
  if (ph0?.[3]) ph0[3].placeholder = c.addressPh;
  if (ph0?.[4]) ph0[4].placeholder = c.cityPh;
  patchSection(1, c.deliveryMethod, 'fa-truck');
  patchSection(2, c.paymentTitle, 'fa-credit-card');
  const payOpts = document.querySelectorAll('.ck-payment-option span');
  if (payOpts[0]) payOpts[0].innerHTML = `${c.cod} <small style="display:block;font-size:11px;color:var(--text-muted);font-weight:500">${c.codSub}</small>`;
  if (payOpts[1]) payOpts[1].innerHTML = `${c.wallet} <small style="display:block;font-size:11px;color:var(--text-muted);font-weight:500">${c.walletSub}</small>`;
  const cardOpt = document.getElementById('cardPaymentOption')?.querySelector('span');
  if (cardOpt) cardOpt.innerHTML = `${c.card} <small style="display:block;font-size:11px;color:var(--text-muted);font-weight:500">${c.cardSub}</small>`;
  const soonOpt = document.getElementById('cardSoonOption');
  if (soonOpt) {
    txt(soonOpt.querySelector('span:not(.ck-soon-tag)'), c.cardSoon);
    txt(soonOpt.querySelector('.ck-soon-tag'), c.soon);
  }
  patchSection(3, c.couponTitle, 'fa-ticket-alt');
  const couponIn = document.getElementById('couponInput');
  if (couponIn) couponIn.placeholder = c.couponPh;
  txt(document.getElementById('applyCouponBtn'), c.apply);
  const pointsSec = document.getElementById('pointsSection');
  if (pointsSec) {
    const h3 = pointsSec.querySelector('h3');
    if (h3) h3.innerHTML = `<i class="fas fa-crown"></i> ${c.rewardsTitle}`;
    const balP = pointsSec.querySelector('p');
    if (balP) {
      const pts = document.getElementById('pointsBalance')?.textContent || '0';
      balP.innerHTML = c.rewardsBalance.replace('{points}', `<strong id="pointsBalance">${pts}</strong>`);
    }
  }
  const pointsIn = document.getElementById('pointsInput');
  if (pointsIn) pointsIn.placeholder = c.pointsPh;
  txt(document.getElementById('applyPointsBtn'), c.apply);
  patchSection(4, c.summaryTitle, 'fa-receipt');
  const summaryLabels = document.querySelectorAll('.ck-summary .ck-row span:first-child');
  if (summaryLabels[0]) summaryLabels[0].id = 'ckSubtotalLabel';
  if (summaryLabels[0]) txt(summaryLabels[0], c.subtotal);
  if (summaryLabels[1]) txt(summaryLabels[1], c.shipping);
  if (summaryLabels[2]) txt(summaryLabels[2], c.discount);
  const pr = document.getElementById('ckPointsRow');
  if (pr) txt(pr.querySelector('span:first-child'), c.pointsDiscount);
  txt(document.querySelector('.ck-row.ck-total span:first-child'), c.total);
  txt(document.querySelector('.ck-bottom-total span'), c.total);
  const confirmBtn = document.getElementById('confirmBtn');
  if (confirmBtn) confirmBtn.innerHTML = `<i class="fas fa-check"></i> ${c.confirm}`;
}

function applyShopPage() {
  if (!document.body.classList.contains('mnt-shop') || !document.getElementById('shopHeroTitle')) return;
  const s = U.shop;
  document.title = `Montana | ${s.title}`;
  txt(document.getElementById('shopPageTitle'), s.title);
  txt(document.getElementById('shopHeroTitle'), s.title === 'Skincare' ? 'Skincare Collection' : s.title);
  txt(document.querySelector('.shop-sub'), s.shopSub);
  txt(document.querySelector('.shop-eyebrow'), 'MONTAÑA · SKINCARE');
  const trust = document.querySelectorAll('.shop-trust-item span');
  [s.trustShipping, s.trustAuthentic, s.trustTested, s.trustGlobal].forEach((t, i) => txt(trust[i], t));
  const filters = document.querySelectorAll('.cat-sub');
  [s.all, s.cleanser, s.cream, s.serum, s.lotion].forEach((t, i) => txt(filters[i], t));
  txt(document.getElementById('catCount'), s.loading);
  const sort = document.getElementById('catSort');
  if (sort) {
    const opts = [s.sortFeatured, s.sortPriceAsc, s.sortPriceDesc, s.sortRating];
    sort.querySelectorAll('option').forEach((o, i) => { if (opts[i]) o.textContent = opts[i]; });
  }
}

function applyPromoBanner() {
  document.querySelectorAll('.promo-slider span').forEach((el, i) => {
    if (U.promo[i]) el.textContent = U.promo[i];
  });
}

export function applyEnglishUi() {
  if (getLocale() !== 'en') return;
  applyPromoBanner();
  applyFooter();
  applyContact();
  applyAbout();
  applySearch();
  applyCheckoutStatic();
  applyShopPage();
}

if (getLocale() === 'en') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', applyEnglishUi);
  } else {
    applyEnglishUi();
  }
  window.addEventListener('load', () => setTimeout(applyEnglishUi, 50));
}
