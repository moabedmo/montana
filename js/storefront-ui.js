// Shared product-card rendering + event binding for the storefront.
(function () {
  const IS_EN =
    document.documentElement.lang === 'en' ||
    (typeof location !== 'undefined' && /^\/en(\/|$)/.test(location.pathname));

  const EN_LABELS = {
    badges: { 'best-seller': 'Best seller', new: 'New', sale: 'Sale' },
    quickView: 'Quick view',
    addToCart: 'Add to bag',
    added: 'Added',
  };

  function starsHtml(rating) {
    const r = parseFloat(rating) || 0;
    const full = Math.floor(r), half = r - full >= 0.5;
    let html = '';
    for (let i = 0; i < full; i++) html += '<i class="fas fa-star"></i>';
    if (half) html += '<i class="fas fa-star-half-alt"></i>';
    for (let i = full + (half ? 1 : 0); i < 5; i++) html += '<i class="far fa-star"></i>';
    return html;
  }

  const BADGE_CLASS = { 'best-seller': 'badge-best', new: 'badge-new', sale: 'badge-sale' };

  function badgeLabels() {
    if (!IS_EN) {
      return { 'best-seller': 'الأكثر مبيعاً', new: 'جديد', sale: 'خصم' };
    }
    const ui = window.MONTANA_UI;
    return {
      'best-seller': ui?.badges?.bestSeller || EN_LABELS.badges['best-seller'],
      new: ui?.badges?.new || EN_LABELS.badges.new,
      sale: ui?.badges?.sale || EN_LABELS.badges.sale,
    };
  }

  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function productUrl(slug) {
    const s = String(slug || '').trim();
    if (!s) return IS_EN ? '/en/category.html' : '/category.html';
    return IS_EN ? `/en/product/${encodeURIComponent(s)}` : `/product/${encodeURIComponent(s)}`;
  }

  function formatPrice(n) {
    const num = Math.round(Number(n) || 0);
    return IS_EN ? `${num.toLocaleString('en-EG')} EGP` : `${num.toLocaleString('ar-EG')} ج.م`;
  }

  function imgUrl(url) {
    // The catalog stores .png, and a .webp of the same picture sits beside it
    // at roughly a ninth of the size — 3945 KB against 453 KB across the whole
    // catalog. Swapped in here rather than by rewriting image_url, so it holds
    // for whatever the admin uploads next without anyone remembering to convert.
    url = String(url || '').replace(/\.(png|jpe?g)(\?.*)?$/i, '.webp$2');
    const raw = String(url || '');
    if (!raw || /^(https?:|\/\/|data:|blob:)/i.test(raw)) return raw;
    if (raw.startsWith('/')) return raw;
    return `/${raw.replace(/^(\.\.\/)+/, '').replace(/^\.\//, '')}`;
  }

  function productDisplayName(p) {
    const copy = IS_EN && window.MONTANA_PRODUCT_COPY?.[p.slug];
    const base = copy ? copy.name : p.name;
    let size = p.size || '';
    if (IS_EN && size) {
      size = String(size).replace(/(\d+)\s*مل/g, '$1ml').replace(/(\d+)\s*جم/g, '$1g');
    }
    return base + (size ? ' - ' + size : '');
  }

  function categorySlug(p) {
    return p.categories?.slug || 'skincare';
  }

  function renderProductCard(p) {
    const cat = categorySlug(p);
    const discountPct = p.old_price ? Math.round((1 - p.price / p.old_price) * 100) : null;
    let badgeHtml = '';
    const badges = badgeLabels();
    if (discountPct) badgeHtml = `<span class="badge-sale">-${discountPct}%</span>`;
    else if (p.badge && badges[p.badge]) {
      badgeHtml = `<span class="${BADGE_CLASS[p.badge] || 'badge-new'}">${badges[p.badge]}</span>`;
    }
    const name = productDisplayName(p);
    const safeName = escapeHtml(name);
    const safeSlug = escapeHtml(p.slug || '');
    const safeCat = escapeHtml(cat);
    const safeImg = escapeHtml(imgUrl(p.image_url));
    const ui = window.MONTANA_UI;
    const quickView = IS_EN ? (ui?.trending?.quickView || EN_LABELS.quickView) : 'نظرة سريعة';
    const addLabel = IS_EN ? (ui?.trending?.addToCart || EN_LABELS.addToCart) : 'أضف للسلة';
    const addedLabel = IS_EN ? EN_LABELS.added : 'تمت الإضافة';
    const outOfStock = (p.stock ?? 0) <= 0;
    const outOfStockLabel = IS_EN ? 'Out of stock' : 'نفذت الكمية';
    return `
    <div class="product-card" data-category="${safeCat}">
        <div class="product-badges">${badgeHtml}${outOfStock ? `<span class="badge-out-of-stock">${outOfStockLabel}</span>` : ''}</div>
        <button class="wishlist-btn" data-product-id="${p.id}"><i class="far fa-heart"></i></button>
        <div class="product-img">
            <img src="${safeImg}" alt="${safeName}">
            <div class="product-actions">
                <button class="quick-view"><i class="far fa-eye"></i> ${quickView}</button>
                <button class="add-to-cart-btn" data-id="${p.id}" data-name="${safeName}" data-image="${safeImg}" data-price="${p.price}" data-slug="${safeSlug}" ${outOfStock ? 'disabled style="opacity:.5;cursor:not-allowed"' : ''}><i class="fas fa-shopping-bag"></i> ${outOfStock ? outOfStockLabel : addLabel}</button>
            </div>
        </div>
        <div class="product-info">
            <span class="product-brand">Montaña</span>
            <h3 class="product-name">${safeName}</h3>
            <div class="product-rating">
                <div class="stars">${starsHtml(p.rating)}</div>
                <span>(${p.review_count || 0})</span>
            </div>
            <div class="product-price">
                <span class="current-price">${formatPrice(p.price)}</span>
                ${p.old_price ? `<span class="old-price">${formatPrice(p.old_price)}</span>` : ''}
            </div>
        </div>
    </div>`;
  }

  function initProductCards(root) {
    const scope = root || document;
    const addedLabel = IS_EN ? EN_LABELS.added : 'تمت الإضافة';

    scope.querySelectorAll('.add-to-cart-btn, .add-to-cart-sm').forEach(btn => {
      if (btn.dataset.bound) return;
      btn.dataset.bound = '1';
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (btn.disabled) return;
        if (window.Cart && btn.dataset.id) {
          window.Cart.add({
            id: parseInt(btn.dataset.id, 10),
            name: btn.dataset.name,
            image: btn.dataset.image,
            price: parseFloat(btn.dataset.price)
          });
        }
        const original = btn.innerHTML;
        btn.innerHTML = '<i class="fas fa-check"></i> ' + addedLabel;
        btn.style.background = '#27ae60';
        setTimeout(() => { btn.innerHTML = original; btn.style.background = ''; }, 1500);
      });
    });

    scope.querySelectorAll('.wishlist-btn').forEach(btn => {
      if (btn.dataset.bound) return;
      btn.dataset.bound = '1';
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = btn.dataset.productId;
        if (id && window.Wishlist) window.Wishlist.toggle(id);
        btn.classList.add('liked');
        setTimeout(() => btn.classList.remove('liked'), 400);
      });
    });

    scope.querySelectorAll('.product-card').forEach(card => {
      if (card.dataset.bound) return;
      card.dataset.bound = '1';
      card.style.cursor = 'pointer';
      card.addEventListener('click', (e) => {
        if (e.target.closest('.wishlist-btn') || e.target.closest('.quick-view') || e.target.closest('.add-to-cart-btn')) return;
        const btn = card.querySelector('.add-to-cart-btn[data-slug]');
        window.location.href = btn ? productUrl(btn.dataset.slug) : (IS_EN ? '/en/category.html' : '/category.html');
      });
    });

    if (window.Wishlist) window.Wishlist.refreshUI();

    scope.querySelectorAll('.product-card').forEach(el => {
      if (el.dataset.observed) return;
      el.dataset.observed = '1';
      // Shop pages: optional fade-in via IntersectionObserver — but NEVER leave
      // cards stuck at opacity:0 (IO can miss cards below the fold / with
      // aggressive rootMargin, which looked like an infinite "loading" store).
      if (window.__montanaCardObserver) {
        el.classList.add('is-pending-reveal');
        window.__montanaCardObserver.observe(el);
        // Failsafe: reveal quickly even if IntersectionObserver never fires
        // (aggressive rootMargin / offscreen cards used to stay invisible forever).
        requestAnimationFrame(() => {
          setTimeout(() => {
            if (!el.classList.contains('is-visible')) {
              el.classList.add('is-visible');
              el.classList.remove('is-pending-reveal');
              try { window.__montanaCardObserver.unobserve(el); } catch { /* ignore */ }
            }
          }, 80);
        });
      } else {
        el.classList.add('is-visible');
      }
    });

    if (typeof window.bindQuickView === 'function') window.bindQuickView(scope);
  }

  window.MontanaUI = { renderProductCard, initProductCards, starsHtml, categorySlug };
})();
