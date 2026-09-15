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
// Quick view (modal + card buttons) lives in js/quick-view.js — it is needed
// on the shop, search and wishlist pages too, and script.js is homepage-only.

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
let appScreenScrollY = 0;

function lockAppScreenScroll() {
    appScreenScrollY = window.scrollY || window.pageYOffset || 0;
    document.documentElement.classList.add('app-screen-open');
    document.body.classList.add('app-screen-open');
    document.body.style.top = `-${appScreenScrollY}px`;
}

function unlockAppScreenScroll() {
    document.documentElement.classList.remove('app-screen-open');
    document.body.classList.remove('app-screen-open');
    document.body.style.top = '';
    window.scrollTo(0, appScreenScrollY);
}

function switchScreen(screen) {
    if (window.innerWidth > 768) return;

    const allScreens = document.querySelectorAll('.app-screen');
    const homeElements = document.querySelectorAll('.app-only, .categories-section, .products-section, .before-after-section, .new-arrivals, .rewards-section, .reviews-section, .offers-banner');
    const header = document.querySelector('.header');
    const bottomLinks = document.querySelectorAll('.mobile-bottom-nav a');

    allScreens.forEach(s => s.classList.remove('active'));
    bottomLinks.forEach(l => l.classList.remove('active'));

    if (screen === 'home') {
        unlockAppScreenScroll();
        homeElements.forEach(el => el.style.display = '');
        if (header) header.style.display = '';
        bottomLinks[0]?.classList.add('active');
    } else {
        lockAppScreenScroll();
        homeElements.forEach(el => el.style.display = 'none');
        if (header) header.style.display = 'none';
        const target = document.getElementById('screen-' + screen);
        if (target) {
            target.classList.add('active');
            target.scrollTop = 0;
        }

        if (screen === 'categories') bottomLinks[1]?.classList.add('active');
        if (screen === 'offers') bottomLinks[2]?.classList.add('active');
        if (screen === 'favorites') { bottomLinks[3]?.classList.add('active'); window.renderAppFavorites?.(); }
        if (screen === 'cart') { bottomLinks[4]?.classList.add('active'); window.renderAppCart?.(); }
    }
}

/** Story rings above Offers — were decorative only; wire to real destinations. */
function goAppStory(story) {
    if (window.innerWidth > 768) return;
    const scrollToSel = (sel) => {
        if (document.body.classList.contains('app-screen-open')) switchScreen('home');
        requestAnimationFrame(() => {
            const el = document.querySelector(sel);
            if (!el) return;
            const top = el.getBoundingClientRect().top + window.scrollY - 72;
            window.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
        });
    };
    switch (story) {
        case 'offers':
            switchScreen('offers');
            break;
        // 'new' and 'best' used to scroll to the New Arrivals and Trending
        // sections. Those are gone — their stories are links to the shop now,
        // and A elements skip this handler entirely.
        case 'tips':
            scrollToSel('#ingredients');
            break;
        case 'concern':
            scrollToSel('#shop-by-concern');
            break;
        default:
            break;
    }
}

document.querySelectorAll('.app-story[data-story]').forEach((el) => {
    if (el.tagName === 'A') return; // care → category.html via href
    el.addEventListener('click', (e) => {
        e.preventDefault();
        goAppStory(el.dataset.story);
    });
});

window.goAppStory = goAppStory;

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
