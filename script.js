// Hero Slider
const __montanaIsEn =
  document.documentElement.lang === 'en' ||
  /^\/en(\/|$)/.test(location.pathname.replace(/\\/g, '/'));

const slides = document.querySelectorAll('.hero-slide');
const dotsContainer = document.getElementById('heroDots');
let currentSlide = 0;
let slideInterval;

if (slides.length && dotsContainer) {
slides.forEach((_, i) => {
    const dot = document.createElement('div');
    dot.classList.add('hero-dot');
    if (i === 0) dot.classList.add('active');
    dot.addEventListener('click', () => goToSlide(i));
    dotsContainer.appendChild(dot);
});

function goToSlide(n) {
    slides[currentSlide].classList.remove('active');
    dotsContainer.children[currentSlide].classList.remove('active');
    currentSlide = n;
    slides[currentSlide].classList.add('active');
    dotsContainer.children[currentSlide].classList.add('active');
}

function changeSlide(dir) {
    let next = (currentSlide + dir + slides.length) % slides.length;
    goToSlide(next);
    resetAutoSlide();
}

function resetAutoSlide() {
    clearInterval(slideInterval);
    slideInterval = setInterval(() => changeSlide(1), 5000);
}

resetAutoSlide();
}

// Tabs
document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const tab = btn.dataset.tab;
        document.querySelectorAll('.product-card[data-category]').forEach(card => {
            card.style.display = (tab === 'all' || card.dataset.category === tab) ? '' : 'none';
        });
    });
});

// Wishlist toggle
document.querySelectorAll('.wishlist-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        const icon = btn.querySelector('i');
        icon.classList.toggle('far');
        icon.classList.toggle('fas');
        if (icon.classList.contains('fas')) {
            btn.style.color = '#e74c3c';
        } else {
            btn.style.color = '';
        }
    });
});

// Quick View Modal — loads the real product (description + ingredients,
// linked to ingredients.html) from Supabase by slug instead of just
// scraping whatever static text happens to be in the card's DOM.
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

            document.getElementById('modalDesc').textContent = __montanaIsEn ? 'Loading…' : 'جارٍ التحميل…';
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

                const sep = __montanaIsEn ? ',' : '،';
                const tokens = (p.ingredients || '').split(sep).map(s => s.trim()).filter(Boolean);
                const ingHtml = tokens.map(t => {
                    const match = ingredientsCache.find(ing => t.includes(ing.name));
                    return match ? `<a href="ingredients.html?slug=${match.slug}">${t}</a>` : t;
                }).join(__montanaIsEn ? ', ' : '، ');
                const ingLabel = __montanaIsEn ? 'Key ingredients:' : 'المكونات:';
                document.getElementById('modalIngredients').innerHTML = tokens.length ? `<strong>${ingLabel}</strong> ${ingHtml}` : '';

                document.getElementById('modalPrice').innerHTML = __montanaIsEn
                    ? `<span class="current-price">${formatPrice(p.price)}</span>` +
                      (p.old_price ? ` <span class="old-price">${formatPrice(p.old_price)}</span>` : '')
                    : `<span class="current-price">${Math.round(p.price)} ج.م</span>` +
                      (p.old_price ? ` <span class="old-price">${Math.round(p.old_price)} ج.م</span>` : '');
            } catch (err) {
                document.getElementById('modalDesc').textContent = __montanaIsEn
                    ? 'Could not load product details.'
                    : 'تعذّر تحميل بيانات المنتج.';
            }
        });
    });
};

window.bindQuickView();

function closeModal() {
    document.getElementById('quickViewModal').classList.remove('active');
    document.body.style.overflow = '';
}

document.getElementById('quickViewModal').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) closeModal();
});

function changeQty(dir) {
    const input = document.getElementById('modalQty');
    let val = parseInt(input.value) + dir;
    if (val < 1) val = 1;
    input.value = val;
}

document.getElementById('modalAddBtn').addEventListener('click', function () {
    if (!modalProduct) return;
    const qty = Math.max(1, parseInt(document.getElementById('modalQty').value, 10) || 1);
    window.Cart.add({
        id: modalProduct.id,
        name: modalProduct.name + (modalProduct.size ? ' - ' + modalProduct.size : ''),
        image: modalProduct.image_url,
        price: modalProduct.price
    }, qty);
    const original = this.innerHTML;
    const addedMsg = __montanaIsEn ? 'Added to bag' : 'تمت الإضافة للسلة';
    this.innerHTML = '<i class="fas fa-check"></i> ' + addedMsg;
    setTimeout(() => { this.innerHTML = original; }, 1500);
});

// Back to Top
const backToTop = document.getElementById('backToTop');
window.addEventListener('scroll', () => {
    backToTop.classList.toggle('visible', window.scrollY > 400);
});

backToTop.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
});

// Scroll animations
const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.classList.add('animate-in');
            observer.unobserve(entry.target);
        }
    });
}, { threshold: 0.1 });

window.__montanaCardObserver = observer;

document.querySelectorAll('.category-card, .product-card, .review-card, .offer-card, .feature-item').forEach(el => {
    el.style.opacity = '0';
    observer.observe(el);
});

// Mobile menu
const mobileToggle = document.getElementById('mobileToggle');
const mainNav = document.querySelector('.nav-links');

mobileToggle.addEventListener('click', () => {
    if (mainNav.style.display === 'flex') {
        mainNav.style.display = 'none';
    } else {
        mainNav.style.display = 'flex';
        mainNav.style.flexDirection = 'column';
        mainNav.style.position = 'fixed';
        mainNav.style.top = '0';
        mainNav.style.right = '0';
        mainNav.style.bottom = '0';
        mainNav.style.width = '280px';
        mainNav.style.background = 'var(--primary)';
        mainNav.style.zIndex = '1050';
        mainNav.style.padding = '60px 0 20px';
        mainNav.style.overflowY = 'auto';
        mainNav.style.boxShadow = '-4px 0 20px rgba(0,0,0,0.3)';
    }
});

// Product cards — delegated to storefront-ui.js (also re-run after dynamic home load)
if (window.MontanaUI) window.MontanaUI.initProductCards();

// Before & After Sliders - W3Schools standard approach
document.querySelectorAll('[data-ba]').forEach(slider => {
    const overlay = slider.querySelector('.ba-before');
    const handle = slider.querySelector('.ba-handle');
    let isDragging = false;

    function slide(x) {
        const rect = slider.getBoundingClientRect();
        let pos = x - rect.left;
        if (pos < 0) pos = 0;
        if (pos > rect.width) pos = rect.width;
        overlay.style.clipPath = 'inset(0 ' + (rect.width - pos) + 'px 0 0)';
        handle.style.left = pos + 'px';
    }

    slider.addEventListener('mousedown', (e) => {
        e.preventDefault();
        isDragging = true;
        slider.classList.add('active');
    });

    slider.addEventListener('touchstart', (e) => {
        isDragging = true;
        slider.classList.add('active');
    }, { passive: true });

    window.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        e.preventDefault();
        slide(e.clientX);
    });

    window.addEventListener('touchmove', (e) => {
        if (!isDragging) return;
        slide(e.touches[0].clientX);
    }, { passive: true });

    window.addEventListener('mouseup', () => { isDragging = false; slider.classList.remove('active'); });
    window.addEventListener('touchend', () => { isDragging = false; slider.classList.remove('active'); });

    handle.style.left = '50%';
});

// Keyboard: Escape closes modal
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeModal();
});

// App Banner Dots sync
const appBanners = document.getElementById('appBanners');
const appDots = document.querySelectorAll('.app-banner-dot');
if (appBanners && appDots.length) {
    appBanners.addEventListener('scroll', () => {
        const scrollLeft = appBanners.scrollLeft;
        const bannerWidth = appBanners.querySelector('.app-banner').offsetWidth + 10;
        const index = Math.round(scrollLeft / bannerWidth);
        appDots.forEach((d, i) => d.classList.toggle('active', i === index));
    }, { passive: true });
}

// ==================== APP-LIKE BEHAVIORS ====================

// Sticky header shadow on scroll
const headerMain = document.querySelector('.header-main');
if (headerMain) {
    window.addEventListener('scroll', () => {
        headerMain.classList.toggle('scrolled', window.scrollY > 10);
    }, { passive: true });
}

// ==================== APP SCREEN NAVIGATION ====================
function switchScreen(screen) {
    if (window.innerWidth > 768) return;

    const allScreens = document.querySelectorAll('.app-screen');
    const homeElements = document.querySelectorAll('.app-only, .categories-section, .products-section, .before-after-section, .new-arrivals, .rewards-section, .reviews-section, .offers-banner');
    const header = document.querySelector('.header');
    const bottomLinks = document.querySelectorAll('.mobile-bottom-nav a');

    allScreens.forEach(s => s.classList.remove('active'));
    bottomLinks.forEach(l => l.classList.remove('active'));

    if (screen === 'home') {
        homeElements.forEach(el => el.style.display = '');
        if (header) header.style.display = '';
        window.scrollTo({ top: 0, behavior: 'smooth' });
        bottomLinks[0].classList.add('active');
    } else {
        homeElements.forEach(el => el.style.display = 'none');
        if (header) header.style.display = 'none';
        const target = document.getElementById('screen-' + screen);
        if (target) target.classList.add('active');

        if (screen === 'categories') bottomLinks[1].classList.add('active');
        if (screen === 'offers') bottomLinks[2].classList.add('active');
        if (screen === 'favorites') { bottomLinks[3].classList.add('active'); window.renderAppFavorites?.(); }
        if (screen === 'cart') { bottomLinks[4].classList.add('active'); window.renderAppCart?.(); }
    }
}

// Bottom nav click handlers
const bottomNavLinks = document.querySelectorAll('.mobile-bottom-nav a');
const navScreenMap = ['home', 'categories', 'offers', 'favorites', 'cart'];

bottomNavLinks.forEach((link, i) => {
    link.addEventListener('click', (e) => {
        // "المتجر" (index 1) goes straight to the real product catalog —
        // there's only one real category, so a "choose a category" screen
        // in between is an unnecessary extra tap.
        if (navScreenMap[i] === 'categories') return; // let the href navigate normally
        e.preventDefault();
        switchScreen(navScreenMap[i]);
    });
});

// Product card navigation handled by MontanaUI.initProductCards()

// Haptic-like feedback on tap (visual only)
document.querySelectorAll('.product-card, .category-card, .btn-primary, .tab-btn').forEach(el => {
    el.addEventListener('touchstart', () => {}, { passive: true });
});

// Wishlist UI sync handled by MontanaUI + js/wishlist.js

// Hide promo banner on scroll down
let lastScroll = 0;
const promoBanner = document.querySelector('.promo-banner');
if (promoBanner && window.innerWidth <= 768) {
    window.addEventListener('scroll', () => {
        const currentScroll = window.scrollY;
        if (currentScroll > 100 && currentScroll > lastScroll) {
            promoBanner.style.transform = 'translateY(-100%)';
            promoBanner.style.transition = 'transform 0.3s ease';
        } else {
            promoBanner.style.transform = 'translateY(0)';
        }
        lastScroll = currentScroll;
    }, { passive: true });
}

// Scroll-based section highlighting for bottom nav
const sections = {
    '#categories': 1,
    '#offers': 2,
};

if (window.innerWidth <= 768) {
    window.addEventListener('scroll', () => {
        const scrollPos = window.scrollY + 200;
        Object.entries(sections).forEach(([selector, navIndex]) => {
            const section = document.querySelector(selector);
            if (section && scrollPos >= section.offsetTop && scrollPos < section.offsetTop + section.offsetHeight) {
                bottomNavLinks.forEach(l => l.classList.remove('active'));
                if (bottomNavLinks[navIndex]) bottomNavLinks[navIndex].classList.add('active');
            }
        });
        if (window.scrollY < 300) {
            bottomNavLinks.forEach(l => l.classList.remove('active'));
            const homeLink = document.querySelector('.mobile-bottom-nav a:last-child');
            if (homeLink) homeLink.classList.add('active');
        }
    }, { passive: true });
}
