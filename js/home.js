// Homepage — loads products/banners from Supabase (replaces static HTML cards).
import { products as productsApi, categories as categoriesApi, banners as bannersApi, reviews as reviewsApi } from '/js/store-api.js';
import { mapProductToHeroSlide } from '/js/hero-products.js';
import { localizeProduct, getLocale, resolveAssetUrl } from '/js/i18n/locale.js?v=3';

function sortTrending(list) {
  return [...list].sort((a, b) => (b.review_count || 0) - (a.review_count || 0));
}

function sortNew(list) {
  return [...list].sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
}

function renderGrid(gridEl, list) {
  if (!gridEl || !window.MontanaUI) return;
  if (!list.length) {
    const empty = getLocale() === 'en' ? 'No products available right now' : 'لا توجد منتجات حالياً';
    gridEl.innerHTML = `<p style="grid-column:1/-1;text-align:center;padding:40px;color:#999">${empty}</p>`;
    return;
  }
  gridEl.innerHTML = list.map((p) => window.MontanaUI.renderProductCard(localizeProduct(p) || p)).join('');
  window.MontanaUI.initProductCards(gridEl);
}

function applyCategoryTabs(allProducts) {
  document.querySelectorAll('#trending .tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const tab = btn.dataset.tab;
      document.querySelectorAll('#trending .product-card').forEach(card => {
        card.style.display = (tab === 'all' || card.dataset.category === tab) ? '' : 'none';
      });
    });
  });
}

async function loadHeroBanners() {
  try {
    const desktop = await bannersApi.list('desktop');
    if (!desktop.length) return;
    const banner = desktop[0];
    const promoSpans = document.querySelectorAll('.promo-slider span');
    const title = (banner.title || '').trim();
    const subtitle = (banner.subtitle || '').trim();
    const isPlaceholder = (t) => /^بانر(\s+موبايل)?\s*\d+$/i.test(t) || /^banner\s*\d+$/i.test(t);
    if (title && !isPlaceholder(title) && promoSpans[0]) promoSpans[0].textContent = title;
    if (subtitle && promoSpans[1]) promoSpans[1].textContent = subtitle;
  } catch { /* optional */ }
}

async function loadAppBanners() {
  try {
    const mobile = await bannersApi.list('mobile');
    const wrap = document.getElementById('appBanners');
    if (!wrap || !mobile.length) return;
    wrap.innerHTML = mobile.map(b => `
      <a href="${b.link_url || 'category.html'}" class="app-banner" style="background-image:url('${resolveAssetUrl(b.image_url)}')">
        <div class="app-banner-content">
          <h3>${b.title || ''}</h3>
          <p>${b.subtitle || ''}</p>
        </div>
      </a>`).join('');
  } catch { /* keep static fallback */ }
}

async function loadCategoryCount() {
  try {
    const [cats, prods] = await Promise.all([categoriesApi.list(), productsApi.list()]);
    const skincare = cats.find(c => c.slug === 'skincare');
    const count = prods.filter(p => p.categories?.slug === 'skincare' || p.category_id === skincare?.id).length;
    const el = document.querySelector('.category-count');
    if (el && count) el.textContent = getLocale() === 'en' ? `${count} products` : `${count} منتجات`;
  } catch { /* ignore */ }
}

async function syncHeroFromDb() {
  if (!window.__montanaHeroPatch) return;
  try {
    const all = await productsApi.list();
    const mapped = all.slice(0, 5).map((p, i) => mapProductToHeroSlide(p, i));
    if (mapped.length) window.__montanaHeroPatch(mapped);
  } catch { /* static hero remains */ }
}

function formatOfferPrice(n) {
  const num = Math.round(Number(n) || 0);
  return getLocale() === 'en'
    ? `${num.toLocaleString('en-EG')} EGP`
    : `${num.toLocaleString('ar-EG')} ج.م`;
}

function productHref(slug) {
  return getLocale() === 'en'
    ? `/en/product/${encodeURIComponent(slug)}`
    : `/product/${encodeURIComponent(slug)}`;
}

/** Live "عروض اليوم" — same catalog source as category.html. Hide OOS. */
function renderTodaysOffers(all) {
  const mount = document.getElementById('todaysOffers');
  if (!mount) return;

  const offers = (all || [])
    .filter((p) => (p.stock ?? 0) > 0)
    .filter((p) => !/^anti-scar/i.test(p.slug || ''))
    .sort((a, b) => (b.review_count || 0) - (a.review_count || 0))
    .slice(0, 4)
    .map((p) => localizeProduct(p) || p);

  if (!offers.length) {
    mount.innerHTML = '';
    return;
  }

  mount.innerHTML = offers.map((p) => {
    const discountPct = p.old_price
      ? Math.round((1 - Number(p.price) / Number(p.old_price)) * 100)
      : null;
    const img = resolveAssetUrl(p.image_url);
    return `
    <a href="${productHref(p.slug)}" class="app-offer-card" style="text-decoration:none;color:inherit">
      ${discountPct ? `<div class="app-offer-discount">-${discountPct}%</div>` : ''}
      <img loading="lazy" decoding="async" src="${img}" alt="${p.name}">
      <div class="app-offer-details">
        <span class="app-offer-brand">Montaña</span>
        <h4>${p.name}</h4>
        <div class="app-offer-prices">
          <span class="app-price-new">${formatOfferPrice(p.price)}</span>
          ${p.old_price ? `<span class="app-price-old">${formatOfferPrice(p.old_price)}</span>` : ''}
        </div>
      </div>
    </a>`;
  }).join('');
}

/**
 * "العلم وراء كل منتج" — one card per active product, straight from the
 * catalog. It was three hand-written cards out of six products; the three it
 * left out all had ingredients recorded, they were simply never typed in.
 */
/** The catalog stores .png; the .webp beside it is about a ninth of the size. */
function webpPath(url) {
  return String(url || '').replace(/\.(png|jpe?g)(\?.*)?$/i, '.webp$2');
}

function renderIngredientCards(list) {
  const grid = document.querySelector('.lux-ing-grid');
  if (!grid || !list?.length) return;
  const isEn = getLocale() === 'en';
  const sep = isEn ? ',' : '،';
  const discover = isEn ? 'Discover the product' : 'اكتشف المنتج';
  const prefix = isEn ? '/en/product/' : '/product/';

  grid.innerHTML = list.map((raw, i) => {
    const p = localizeProduct(raw);
    const items = String(p.ingredients || '')
      .split(sep)
      .map((t) => t.trim())
      .filter(Boolean)
      .slice(0, 3);
    if (!items.length) return '';
    const href = prefix + raw.slug;
    return `
      <a class="lux-ing-card lux-reveal lux-reveal-delay-${(i % 3) + 1}" href="${href}">
        <div class="lux-ing-body">
          <div class="lux-ing-product">${p.name}</div>
          <ul class="lux-ing-list">
            ${items.map((t) => `<li><span class="lux-ing-dot"></span>${t}</li>`).join('')}
          </ul>
          <span class="lux-ing-link">${discover} <i class="fas fa-arrow-left"></i></span>
        </div>
        <div class="lux-ing-visual">
          <img src="${resolveAssetUrl(webpPath(raw.image_url))}" alt="${p.name}" loading="lazy" decoding="async">
        </div>
      </a>`;
  }).join('');

  grid.querySelectorAll('.lux-reveal').forEach((el) => el.classList.add('lux-visible'));
}

/**
 * Fill the reviews section from the reviews table, and leave it hidden when
 * there is nothing in it.
 *
 * The section used to carry a hand-written "4.8/5 — من أكثر من 1,200+ تقييم
 * حقيقي" above three invented testimonials, while the table held zero rows and
 * the counts printed on the product cards added up to 1,417 that did not
 * exist. A rating the shop made up is worth less than no rating at all, and on
 * a site running paid ads it is a claim someone can hold you to.
 */
async function renderReviews(products) {
  const section = document.getElementById('reviews');
  const grid = document.getElementById('reviewsGrid');
  const summary = document.getElementById('reviewsSummary');
  if (!section || !grid || !summary) return;

  const isEn = getLocale() === 'en';
  const byProduct = await Promise.all(
    (products || []).map(async (p) => {
      try {
        const list = await reviewsApi.listForProduct(p.id);
        return (list || []).map((r) => ({ ...r, product: localizeProduct(p).name }));
      } catch {
        return [];
      }
    })
  );

  const all = byProduct.flat().filter((r) => r && r.rating);
  if (!all.length) return; // stays hidden

  const avg = all.reduce((s, r) => s + Number(r.rating || 0), 0) / all.length;
  summary.innerHTML =
    `<div class="lux-reviews-score">${avg.toFixed(1)}<span>/5</span></div>` +
    `<div class="lux-reviews-count">${isEn
      ? `from ${all.length} customer review${all.length === 1 ? '' : 's'}`
      : `من ${all.length} تقييم`}</div>`;

  const withText = all.filter((r) => (r.comment || '').trim());
  const pick = (withText.length ? withText : all)
    .sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0))
    .slice(0, 3);

  grid.innerHTML = pick.map((r, i) => {
    const name = (r.customer_name || '').trim() || (isEn ? 'A customer' : 'عميلة');
    const stars = '★'.repeat(Math.round(Number(r.rating) || 0)).padEnd(5, '☆');
    return `
      <div class="lux-review-card lux-reveal lux-reveal-delay-${i + 1} lux-visible">
        <div class="lux-review-stars">${stars}</div>
        ${r.comment ? `<p class="lux-review-text">«${r.comment}»</p>` : ''}
        <div class="lux-review-author">
          <div class="lux-review-avatar">${name.slice(0, 1)}</div>
          <div>
            <div class="lux-review-name">${name}</div>
            <div class="lux-review-meta">${r.product || ''}</div>
          </div>
        </div>
      </div>`;
  }).join('');

  section.hidden = false;
}

async function initHome() {
  try {
    const all = await productsApi.list();

    renderIngredientCards(all);
    renderReviews(all);

    const trendingGrid = document.querySelector('#trendingGrid') || document.querySelector('#trending .products-grid');
    if (trendingGrid) renderGrid(trendingGrid, sortTrending(all));

    const newSection = document.querySelector('.new-arrivals .container');
    if (newSection) {
      const newProducts = sortNew(all).slice(0, 4);
      const comingSoon = newSection.querySelector('.coming-soon-box');
      if (newProducts.length) {
        if (comingSoon) comingSoon.remove();
        let grid = newSection.querySelector('.products-grid');
        if (!grid) {
          grid = document.createElement('div');
          grid.className = 'products-grid';
          newSection.appendChild(grid);
        }
        renderGrid(grid, newProducts);
      }
    }

    renderTodaysOffers(all);
    applyCategoryTabs(all);
    loadCategoryCount();
    loadAppBanners();
    loadHeroBanners();
    syncHeroFromDb();
  } catch (e) {
    console.warn('Home products load failed — static cards remain', e);
  }
}

initHome();

// Newsletter
const nlForm = document.querySelector('.newsletter-form');
if (nlForm) {
  nlForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const input = nlForm.querySelector('input[type="email"]');
    const btn = nlForm.querySelector('button');
    const email = input?.value?.trim();
    if (!email) return;
    btn.disabled = true;
    const nlCopy = getLocale() === 'en'
      ? { ok: 'Subscribed ✓', retry: 'Try again', cta: 'Subscribe' }
      : { ok: 'تم الاشتراك ✓', retry: 'حاول مرة أخرى', cta: 'اشترك الآن' };
    try {
      const { newsletter } = await import('/js/store-api.js');
      const res = await newsletter.subscribe(email);
      btn.textContent = res.ok ? nlCopy.ok : (res.message || nlCopy.retry);
      if (res.ok) input.value = '';
    } catch {
      btn.textContent = nlCopy.retry;
    }
    setTimeout(() => { btn.disabled = false; btn.textContent = nlCopy.cta; }, 3000);
  });
}

// Load site settings into footer (index)
import { applySiteSettings } from '/js/site-settings.js';
applySiteSettings();
