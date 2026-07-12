// Homepage — loads products/banners from Supabase (replaces static HTML cards).
import { products as productsApi, categories as categoriesApi, banners as bannersApi } from '/js/store-api.js';
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

async function initHome() {
  try {
    const all = await productsApi.list();

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
