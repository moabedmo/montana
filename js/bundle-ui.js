/**
 * Shared bundle cards — mount into #bundlesMount on homepage + store.
 * Prices/savings always computed from live catalog via js/bundles.js.
 */
import { products as productsApi } from '/js/store-api.js';
import {
  BUNDLES,
  resolveBundle,
} from '/js/bundles.js?v=4';

const IS_EN =
  document.documentElement.lang === 'en' ||
  (typeof location !== 'undefined' && /^\/en(\/|$)/.test(location.pathname));

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function imgUrl(url) {
  const raw = String(url || '');
  if (!raw || /^(https?:|\/\/|data:|blob:)/i.test(raw)) return raw;
  if (raw.startsWith('/')) return raw;
  return `/${raw.replace(/^(\.\.\/)+/, '').replace(/^\.\//, '')}`;
}

/**
 * Bundle thumbnails sit two or three abreast, so the studio backdrop that
 * looks right on a single card turns into grey tiles with a seam down the
 * middle. These are the only place the cut-out version is used; everywhere
 * else on the site shows the photograph as taken.
 *
 * Falls back to the given image when a product has no cut-out — the gel, for
 * one — rather than breaking the tile.
 */
const CUTOUT = /\/(p[1-5])\.(webp|png)(\?|$)/i;
function bundleImgUrl(url) {
  const resolved = imgUrl(url);
  return resolved.replace(CUTOUT, '/$1-cut.webp$3');
}

function formatMoney(n) {
  const num = Math.round(Number(n) || 0);
  return IS_EN
    ? `${num.toLocaleString('en-EG')} EGP`
    : `${num.toLocaleString('ar-EG')} ج.م`;
}

function productLabel(p) {
  return IS_EN && window.MONTANA_PRODUCT_COPY?.[p.slug]
    ? window.MONTANA_PRODUCT_COPY[p.slug].name
    : p.name;
}

function renderCard(resolved) {
  const { bundle, products, originalTotal, bundlePrice, savings } = resolved;
  const imgs = products
    .map(
      (p) =>
        `<img class="bundle-card-img" src="${escapeHtml(bundleImgUrl(p.image_url))}" alt="${escapeHtml(productLabel(p))}" loading="lazy" decoding="async">`
    )
    .join('');
  const names = products.map((p) => escapeHtml(productLabel(p))).join(' + ');
  const saveLabel = IS_EN
    ? `Save ${Math.round(savings)} EGP`
    : `وفري ${Math.round(savings).toLocaleString('ar-EG')} جنيه`;
  const freeShipLabel = IS_EN ? 'Free shipping on this offer' : 'شحن مجاني على العرض 🎁';
  const cta = IS_EN ? 'Add bundle to bag' : 'أضف البندل للسلة';
  const trust = IS_EN
    ? 'Cash on delivery · Free shipping'
    : 'الدفع عند الاستلام · شحن مجاني';
  const showOld = savings > 0 && originalTotal > bundlePrice;

  return `
  <article class="bundle-card" data-bundle="${escapeHtml(bundle.slug)}">
    <div class="bundle-card-media" aria-hidden="true">${imgs}</div>
    <div class="bundle-card-body">
      <span class="bundle-card-brand">Montaña</span>
      <h3 class="bundle-card-name">${escapeHtml(bundle.name)}</h3>
      <p class="bundle-card-includes">${names}</p>
      <div class="bundle-card-prices" aria-label="${IS_EN ? 'Price' : 'السعر'}">
        <span class="bundle-card-new">${formatMoney(bundlePrice)}</span>
        ${showOld ? `<span class="bundle-card-old">${formatMoney(originalTotal)}</span>` : ''}
      </div>
      ${savings > 0 ? `<span class="bundle-card-save">${saveLabel}</span>` : `<span class="bundle-card-save">${freeShipLabel}</span>`}
      <button type="button" class="bundle-card-cta" data-bundle-slug="${escapeHtml(bundle.slug)}">
        <i class="fas fa-shopping-bag"></i> ${cta}
      </button>
      <p class="bundle-card-trust">${trust}</p>
    </div>
  </article>`;
}

function addBundleToCart(resolved) {
  const { bundle, products, bundlePrice, unitPrices } = resolved;
  if (!window.Cart?.addBundle) {
    // Fallback: add with allocated prices via Cart.add + skipMeta, then one track
    products.forEach((p, i) => {
      window.Cart?.add?.(
        {
          id: p.id,
          name: productLabel(p),
          image: imgUrl(p.image_url),
          price: unitPrices[i],
          bundleSlug: bundle.slug,
        },
        1,
        { skipMeta: true }
      );
    });
  } else {
    window.Cart.addBundle({
      slug: bundle.slug,
      name: bundle.name,
      bundlePrice,
      lines: products.map((p, i) => ({
        id: p.id,
        name: productLabel(p),
        image: imgUrl(p.image_url),
        price: unitPrices[i],
        slug: p.slug,
      })),
    });
    return;
  }

  try {
    window.MontanaMeta?.trackAddToCartBundle?.({
      content_ids: products.map((p) => String(p.slug)),
      content_name: bundle.name,
      value: bundlePrice,
      currency: 'EGP',
    });
  } catch (_) { /* tracking must never break cart */ }
}

function bindCards(root, resolvedMap) {
  root.querySelectorAll('.bundle-card-cta').forEach((btn) => {
    if (btn.dataset.bound) return;
    btn.dataset.bound = '1';
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const slug = btn.dataset.bundleSlug;
      const resolved = resolvedMap.get(slug);
      if (!resolved) return;
      addBundleToCart(resolved);
      const original = btn.innerHTML;
      btn.innerHTML = `<i class="fas fa-check"></i> ${IS_EN ? 'Added' : 'تمت الإضافة'}`;
      btn.classList.add('is-added');
      setTimeout(() => {
        btn.innerHTML = original;
        btn.classList.remove('is-added');
      }, 1600);
    });
  });
}

export async function mountBundles(selector = '#bundlesMount') {
  const root = typeof selector === 'string' ? document.querySelector(selector) : selector;
  if (!root) return;

  let catalog;
  try {
    catalog = await productsApi.list();
  } catch (err) {
    console.warn('Bundles: catalog load failed', err);
    root.innerHTML = '';
    return;
  }

  const bySlug = Object.fromEntries((catalog || []).map((p) => [p.slug, p]));
  const resolvedList = [];
  const resolvedMap = new Map();
  for (const bundle of BUNDLES) {
    const resolved = resolveBundle(bundle, bySlug);
    if (!resolved) continue;
    resolvedList.push(resolved);
    resolvedMap.set(bundle.slug, resolved);
  }

  if (!resolvedList.length) {
    root.innerHTML = '';
    root.hidden = true;
    return;
  }

  root.hidden = false;
  const title = root.dataset.title || (IS_EN ? 'Bundle deals' : 'عروض البندلات');
  root.innerHTML = `
    <div class="bundles-section-inner">
      <div class="bundles-section-head">
        <h2 class="bundles-section-title">${escapeHtml(title)}</h2>
      </div>
      <div class="bundles-grid">
        ${resolvedList.map(renderCard).join('')}
      </div>
    </div>`;
  bindCards(root, resolvedMap);
}

// Auto-mount homepage + mobile offers screen
async function mountAllBundleSlots() {
  await mountBundles('#bundlesMount');
  await mountBundles('#offersBundlesMount');
}

if (document.querySelector('#bundlesMount, #offersBundlesMount')) {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => mountAllBundleSlots());
  } else {
    mountAllBundleSlots();
  }
}
