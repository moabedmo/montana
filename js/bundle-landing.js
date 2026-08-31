/**
 * Bundle ad landing page — /bundle/:slug
 * Reuses js/bundles.js (single price source). No chat, no newsletter.
 */
import { products as productsApi, reviews as reviewsApi } from '/js/store-api.js';
import { BUNDLES, getBundleBySlug, resolveBundle } from '/js/bundles.js?v=4';

const WEBP_BY_SLUG = {
  'acne-facial-cleanser': '/images/p1-premium.webp',
  'whitening-cleanser': '/images/p2-premium.webp',
  'whitening-cream': '/images/p3-premium.webp',
  'hand-body-lotion': '/images/p4-premium.webp',
  'post-laser-cream': '/images/p5-premium.webp',
};

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

function heroImg(p) {
  return WEBP_BY_SLUG[p.slug] || imgUrl(p.image_url).replace(/\.(png|jpe?g)$/i, '.webp');
}

function formatMoney(n) {
  return `${Math.round(Number(n) || 0).toLocaleString('ar-EG')} ج.م`;
}

function parseIngredients(text) {
  return String(text || '')
    .split(/[,،]/)
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 6);
}

function pathSlug() {
  const params = new URLSearchParams(location.search);
  const fromPath = location.pathname.match(/\/bundle\/([^/?#]+)/)?.[1];
  return params.get('slug') || (fromPath ? decodeURIComponent(fromPath) : null);
}

function fireWhenMetaReady(fn) {
  const tryFire = () => {
    if (!window.MontanaMeta) return false;
    if (typeof window.fbq !== 'function') return false;
    fn();
    return true;
  };
  if (tryFire()) return;
  let tries = 0;
  const timer = setInterval(() => {
    if (tryFire() || ++tries > 100) {
      clearInterval(timer);
      if (tries > 100 && window.MontanaMeta) fn();
    }
  }, 50);
}

function trackBundleView(resolved) {
  const payload = {
    content_ids: resolved.products.map((p) => String(p.slug)),
    content_name: resolved.bundle.name,
    content_type: 'product',
    value: resolved.bundlePrice,
    currency: 'EGP',
  };
  fireWhenMetaReady(() => {
    console.log('[Montana Meta] Bundle ViewContent →', payload);
    window.MontanaMeta.trackViewContent(payload);
  });
}

function addBundleAndCheckout(resolved) {
  if (!resolved.inStock) return;
  const { bundle, products, bundlePrice, unitPrices } = resolved;
  const lines = products.map((p, i) => ({
    id: p.id,
    name: p.name,
    image: heroImg(p),
    price: unitPrices[i],
    slug: p.slug,
  }));

  if (typeof window.Cart?.addBundle === 'function') {
    window.Cart.addBundle({
      slug: bundle.slug,
      name: bundle.name,
      bundlePrice,
      lines,
    });
  } else {
    // Fallback if a cached cart.js lacks addBundle
    lines.forEach((line) => {
      window.Cart?.add?.(
        { id: line.id, name: line.name, image: line.image, price: line.price, bundleSlug: bundle.slug },
        1,
        { skipMeta: true }
      );
    });
    try {
      window.MontanaMeta?.trackAddToCartBundle?.({
        content_ids: lines.map((l) => String(l.slug)),
        content_name: bundle.name,
        value: bundlePrice,
        currency: 'EGP',
      });
    } catch (_) { /* ignore */ }
  }
  location.href = '/checkout.html';
}

function renderPriceBlock(resolved, { sticky } = {}) {
  const { originalTotal, bundlePrice, savings, inStock } = resolved;
  const save =
    savings > 0
      ? `<span class="bl-save">وفري ${Math.round(savings).toLocaleString('ar-EG')} جنيه</span>`
      : `<span class="bl-save">شحن مجاني على العرض 🎁</span>`;
  const btnLabel = inStock
    ? 'اطلبي دلوقتي — الدفع عند الاستلام'
    : 'نفذت الكمية حالياً';
  const showOld = savings > 0 && originalTotal > bundlePrice;
  return `
    <div class="bl-price-block ${sticky ? 'bl-price-block--sticky' : ''}">
      <div class="bl-prices">
        ${showOld ? `<span class="bl-old">${formatMoney(originalTotal)}</span>` : ''}
        <span class="bl-new">${formatMoney(bundlePrice)}</span>
      </div>
      ${save}
      <button type="button" class="bl-cta" data-bl-cta ${inStock ? '' : 'disabled'}>
        ${btnLabel}
      </button>
      <p class="bl-trust">شحن مجاني لكل المحافظات · توصيل 24-48 ساعة</p>
    </div>`;
}

function renderProductDetail(p, bundle, idx) {
  const blurb = bundle.blurbs?.[p.slug] || '';
  const ings = parseIngredients(p.ingredients);
  const ingHtml = ings.length
    ? `<ul class="bl-ings">${ings.map((i) => `<li>${escapeHtml(i)}</li>`).join('')}</ul>`
    : '';
  return `
    <article class="bl-product">
      <img class="bl-product-img" src="${escapeHtml(heroImg(p))}" alt="${escapeHtml(p.name)}" loading="lazy" decoding="async" width="160" height="160">
      <div class="bl-product-body">
        <h2>${escapeHtml(p.name)}</h2>
        <p>${escapeHtml(blurb)}</p>
        ${ings.length ? `<h3>مكونات أساسية</h3>${ingHtml}` : ''}
      </div>
    </article>`;
}

function renderReviews(allReviews) {
  if (!allReviews.length) return '';
  const cards = allReviews.slice(0, 6).map((r) => `
    <blockquote class="bl-review">
      <div class="bl-review-top">
        <strong>${escapeHtml(r.customer_name || 'عميلة')}</strong>
        <span>${'★'.repeat(Math.min(5, Number(r.rating) || 5))}</span>
      </div>
      ${r.comment ? `<p>${escapeHtml(r.comment)}</p>` : ''}
      ${r._productName ? `<small>${escapeHtml(r._productName)}</small>` : ''}
    </blockquote>`).join('');
  return `
    <section class="bl-section">
      <h2>آراء عميلات استخدمن المنتجات دي</h2>
      <div class="bl-reviews">${cards}</div>
    </section>`;
}

function renderPage(resolved, reviewList) {
  const { bundle, products } = resolved;
  const root = document.getElementById('blRoot');
  document.title = `${bundle.name} | Montana`;
  const desc = document.querySelector('meta[name="description"]');
  if (desc) desc.content = `${bundle.headline} — ${bundle.name} من Montaña. شحن مجاني والدفع عند الاستلام.`;

  root.innerHTML = `
    <header class="bl-top">
      <a href="/" class="bl-logo" aria-label="Montana الرئيسية">
        <img src="/images/logo.png" alt="Montana" width="120" height="40" decoding="async">
      </a>
    </header>

    <main class="bl-main">
      <section class="bl-hero">
        <h1 class="bl-headline">${escapeHtml(bundle.headline)}</h1>
        <div class="bl-hero-media" aria-hidden="true">
          ${products
            .map(
              (p, i) =>
                `<img src="${escapeHtml(heroImg(p))}" alt="" width="200" height="200" ${i === 0 ? 'fetchpriority="high"' : ''} decoding="async">`
            )
            .join('')}
        </div>
        <p class="bl-bundle-name">${escapeHtml(bundle.name)}</p>
        <p class="bl-includes">${products.map((p) => escapeHtml(p.name)).join(' + ')}</p>
        ${renderPriceBlock(resolved)}
      </section>

      <section class="bl-section">
        <h2>إيه اللي جوه البندل؟</h2>
        ${products.map((p, i) => renderProductDetail(p, bundle, i)).join('')}
      </section>

      ${renderReviews(reviewList)}

      <section class="bl-section bl-section--cta">
        <h2>${escapeHtml(bundle.headline)}</h2>
        ${renderPriceBlock(resolved)}
      </section>

      <p class="bl-disclaimer">عناية تجميلية بالبشرة — وليست ادعاءات علاجية. استشيري متخصص البشرة عند الحاجة.</p>
    </main>`;

  root.querySelectorAll('[data-bl-cta]').forEach((btn) => {
    btn.addEventListener('click', () => addBundleAndCheckout(resolved));
  });
}

async function loadReviews(products) {
  const lists = await Promise.all(
    products.map(async (p) => {
      try {
        const rows = await reviewsApi.listForProduct(p.id);
        return (rows || []).map((r) => ({ ...r, _productName: p.name }));
      } catch {
        return [];
      }
    })
  );
  return lists
    .flat()
    .filter((r) => r && (r.comment || r.rating))
    .sort((a, b) => (Number(b.rating) || 0) - (Number(a.rating) || 0));
}

async function init() {
  const root = document.getElementById('blRoot');
  const slug = pathSlug();
  const bundle = getBundleBySlug(slug);

  if (!bundle) {
    root.innerHTML = `<div class="bl-error"><p>البندل مش موجود.</p><a href="/category.html">تسوقي المتجر</a></div>`;
    return;
  }

  try {
    const catalog = await productsApi.list();
    const bySlug = Object.fromEntries((catalog || []).map((p) => [p.slug, p]));
    const resolved = resolveBundle(bundle, bySlug, { allowOos: true });
    if (!resolved) {
      root.innerHTML = `<div class="bl-error"><p>تعذّر تحميل منتجات البندل.</p><a href="/category.html">تسوقي المتجر</a></div>`;
      return;
    }

    trackBundleView(resolved);
    const reviewList = await loadReviews(resolved.products);
    renderPage(resolved, reviewList);
  } catch (err) {
    console.error(err);
    root.innerHTML = `<div class="bl-error"><p>حصل خطأ في التحميل. جرّبي تاني.</p><a href="/">الصفحة الرئيسية</a></div>`;
  }
}

init();

// Expose for debugging / tests
window.__montanaBundles = BUNDLES;
