/**
 * Quick view — the modal behind the "نظرة سريعة" button on every product card.
 *
 * This lived in script.js, which only the homepage loads, so the button on the
 * shop, search and wishlist pages was never bound: storefront-ui.js guards the
 * call with `typeof window.bindQuickView === 'function'`, so nothing happened
 * and nothing errored. The markup is injected by components.js on those pages;
 * this is the behaviour that goes with it.
 */

// script.js defines this, and script.js is homepage-only — so on the shop,
// search and wishlist pages the modal threw on it the moment it opened.
// Named differently from script.js's const of the same purpose: two
// top-level declarations of one name across two classic scripts is a
// redeclaration error that would break the homepage.
const QV_IS_EN = (document.documentElement.lang === 'en'
    || /^\/en(\/|$)/.test(location.pathname));
let modalProduct = null;
let ingredientsCache = null;

function starsHtml(rating) {
    const full = Math.floor(rating), half = rating - full >= 0.5;
    let html = '';
    for (let i = 0; i < full; i++) html += '<i class="fas fa-star"></i>';
    if (half) html += '<i class="fas fa-star-half-alt"></i>';
    for (let i = full + (half ? 1 : 0); i < 5; i++) html += '<i class="far fa-star"></i>';
    return html;
}

window.bindQuickView = function (root) {
    const scope = root || document;
    scope.querySelectorAll('.quick-view').forEach(btn => {
        if (btn.dataset.qvBound) return;
        btn.dataset.qvBound = '1';
        btn.addEventListener('click', async (e) => {
            e.stopPropagation();
            const card = btn.closest('.product-card');
            const cartBtn = card?.querySelector('.add-to-cart-btn[data-slug]');
            const slug = cartBtn?.dataset.slug;

            document.getElementById('modalQty').value = 1;
            document.getElementById('quickViewModal').classList.add('active');
            document.body.style.overflow = 'hidden';

            if (!slug) return;

            document.getElementById('modalDesc').textContent = QV_IS_EN ? 'Loading…' : 'جارٍ التحميل…';
            document.getElementById('modalIngredients').innerHTML = '';

            try {
                const { products: productsApi, ingredients: ingredientsApi } = await import('/js/store-api.js');
                const { localizeProduct, formatPrice, resolveAssetUrl } = await import('/js/i18n/locale.js?v=3');
                if (!ingredientsCache) ingredientsCache = await ingredientsApi.list();
                const raw = await productsApi.get(slug);
                const p = localizeProduct(raw) || raw;
                modalProduct = p;

                document.getElementById('modalImg').src = resolveAssetUrl(p.image_url);
                document.getElementById('modalBrand').textContent = 'Montaña';
                document.getElementById('modalName').textContent = p.name + (p.size ? ' - ' + p.size : '');
                document.getElementById('modalStars').innerHTML = starsHtml(p.rating);
                document.getElementById('modalReviewCount').textContent = `(${p.review_count})`;
                document.getElementById('modalDesc').textContent = p.description || '';

                const sep = QV_IS_EN ? ',' : '،';
                const tokens = (p.ingredients || '').split(sep).map(s => s.trim()).filter(Boolean);
                const ingHtml = tokens.map(t => {
                    const match = ingredientsCache.find(ing => t.includes(ing.name));
                    return match ? `<a href="ingredients.html?slug=${match.slug}">${t}</a>` : t;
                }).join(QV_IS_EN ? ', ' : '، ');
                const ingLabel = QV_IS_EN ? 'Key ingredients:' : 'المكونات:';
                document.getElementById('modalIngredients').innerHTML = tokens.length ? `<strong>${ingLabel}</strong> ${ingHtml}` : '';

                document.getElementById('modalPrice').innerHTML = QV_IS_EN
                    ? `<span class="current-price">${formatPrice(p.price)}</span>` +
                      (p.old_price ? ` <span class="old-price">${formatPrice(p.old_price)}</span>` : '')
                    : `<span class="current-price">${Math.round(p.price)} ج.م</span>` +
                      (p.old_price ? ` <span class="old-price">${Math.round(p.old_price)} ج.م</span>` : '');
            } catch (err) {
                document.getElementById('modalDesc').textContent = QV_IS_EN
                    ? 'Could not load product details.'
                    : 'تعذّر تحميل بيانات المنتج.';
            }
        });
    });
};

function closeModal() {
    const modal = document.getElementById('quickViewModal');
    if (!modal) return;
    modal.classList.remove('active');
    document.body.style.overflow = '';
}

function changeQty(dir) {
    const input = document.getElementById('modalQty');
    if (!input) return;
    let val = parseInt(input.value, 10) + dir;
    if (val < 1) val = 1;
    input.value = val;
}

/**
 * components.js injects the modal on inner pages, so it does not exist when
 * this file first runs. Wire it once, whenever it turns up.
 */
function wireQuickViewModal() {
    const modal = document.getElementById('quickViewModal');
    if (!modal || modal.dataset.qvWired) return;
    modal.dataset.qvWired = '1';

    modal.addEventListener('click', (e) => {
        if (e.target === e.currentTarget) closeModal();
    });

    document.getElementById('modalAddBtn')?.addEventListener('click', function () {
    if (!modalProduct) return;
    const qty = Math.max(1, parseInt(document.getElementById('modalQty').value, 10) || 1);
    window.Cart.add({
        id: modalProduct.id,
        name: modalProduct.name + (modalProduct.size ? ' - ' + modalProduct.size : ''),
        image: modalProduct.image_url,
        price: modalProduct.price
    }, qty);
    const original = this.innerHTML;
    const addedMsg = QV_IS_EN ? 'Added to bag' : 'تمت الإضافة للسلة';
    this.innerHTML = '<i class="fas fa-check"></i> ' + addedMsg;
    setTimeout(() => { this.innerHTML = original; }, 1500);
    });
}

window.wireQuickViewModal = wireQuickViewModal;
window.closeModal = closeModal;
window.changeQty = changeQty;

function initQuickView() {
    wireQuickViewModal();
    window.bindQuickView();
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initQuickView);
} else {
    initQuickView();
}
