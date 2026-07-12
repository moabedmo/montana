// ==================== PREMIUM VISUAL EFFECTS ====================

(function() {
    // ===== 1. FLOATING PARTICLES =====
    function createParticles() {
        if (window.innerWidth < 769) return;
        const container = document.createElement('div');
        container.className = 'particles-container';
        document.body.prepend(container);

        for (let i = 0; i < 15; i++) {
            const p = document.createElement('div');
            p.className = 'particle';
            const size = Math.random() * 6 + 3;
            p.style.cssText = `
                width: ${size}px;
                height: ${size}px;
                left: ${Math.random() * 100}%;
                animation-duration: ${Math.random() * 15 + 10}s;
                animation-delay: ${Math.random() * 10}s;
            `;
            container.appendChild(p);
        }
    }

    // ===== 2. SCROLL REVEAL =====
    function initScrollReveal() {
        const sections = document.querySelectorAll(
            '.categories-section, .products-section, .brands-section, ' +
            '.before-after-section, .new-arrivals, .rewards-section, ' +
            '.reviews-section, .offers-banner, .newsletter-section'
        );
        sections.forEach(s => s.classList.add('reveal'));

        const grids = document.querySelectorAll(
            '.categories-grid, .products-grid, .reviews-grid, .ba-grid, .offers-grid'
        );
        grids.forEach(g => g.classList.add('stagger-children'));

        const cards = document.querySelectorAll(
            '.product-card, .category-card, .review-card, .ba-card, .offer-card, .feature-item'
        );
        cards.forEach(c => {
            c.classList.add('reveal');
            c.style.opacity = '0';
        });

        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('visible');
                    entry.target.style.opacity = '';
                }
            });
        }, { threshold: 0.08, rootMargin: '0px 0px -40px 0px' });

        document.querySelectorAll('.reveal, .reveal-left, .reveal-right, .reveal-scale').forEach(el => {
            observer.observe(el);
        });
    }

    // ===== 3. CURSOR GLOW (Desktop) =====
    function initCursorGlow() {
        if (window.innerWidth < 769) return;
        const glow = document.createElement('div');
        glow.className = 'cursor-glow';
        document.body.appendChild(glow);

        let mouseX = 0, mouseY = 0;
        let glowX = 0, glowY = 0;

        document.addEventListener('mousemove', e => {
            mouseX = e.clientX;
            mouseY = e.clientY;
        }, { passive: true });

        function updateGlow() {
            glowX += (mouseX - glowX) * 0.08;
            glowY += (mouseY - glowY) * 0.08;
            glow.style.left = glowX + 'px';
            glow.style.top = glowY + 'px';
            requestAnimationFrame(updateGlow);
        }
        updateGlow();
    }

    // ===== 4. 3D TILT ON PRODUCT CARDS (Desktop) =====
    function init3DTilt() {
        if (window.innerWidth < 769) return;
        document.querySelectorAll('.product-card').forEach(card => {
            card.addEventListener('mousemove', e => {
                const rect = card.getBoundingClientRect();
                const x = e.clientX - rect.left;
                const y = e.clientY - rect.top;
                const centerX = rect.width / 2;
                const centerY = rect.height / 2;
                const rotateX = (y - centerY) / centerY * -4;
                const rotateY = (x - centerX) / centerX * 4;
                card.style.transform = `translateY(-8px) rotateX(${rotateX}deg) rotateY(${rotateY}deg)`;
            });

            card.addEventListener('mouseleave', () => {
                card.style.transform = '';
            });
        });
    }

    // ===== 5. GRADIENT TEXT ON SECTION TITLES =====
    function initGradientTitles() {
        document.querySelectorAll('.section-header h2').forEach(h2 => {
            h2.classList.add('gradient-text');
        });
    }

    // ===== 6. SMOOTH COUNT UP ANIMATION =====
    function countUp(el, target, duration = 1500) {
        let start = 0;
        const increment = target / (duration / 16);
        const timer = setInterval(() => {
            start += increment;
            if (start >= target) {
                el.textContent = target.toLocaleString();
                clearInterval(timer);
            } else {
                el.textContent = Math.floor(start).toLocaleString();
            }
        }, 16);
    }

    // Animate review score
    function initCountUp() {
        const scoreEl = document.querySelector('.review-score');
        if (scoreEl) {
            const observer = new IntersectionObserver(entries => {
                if (entries[0].isIntersecting) {
                    const target = parseFloat(scoreEl.textContent);
                    let current = 0;
                    const timer = setInterval(() => {
                        current += 0.1;
                        if (current >= target) {
                            scoreEl.textContent = target.toFixed(1);
                            clearInterval(timer);
                        } else {
                            scoreEl.textContent = current.toFixed(1);
                        }
                    }, 30);
                    observer.disconnect();
                }
            });
            observer.observe(scoreEl);
        }
    }

    // ===== 7. PARALLAX ON HERO (Desktop) =====
    function initParallax() {
        if (window.innerWidth < 769) return;
        const hero = document.querySelector('.hero');
        if (!hero) return;

        window.addEventListener('scroll', () => {
            const scroll = window.scrollY;
            if (scroll < 800) {
                const slides = hero.querySelectorAll('.hero-slide');
                slides.forEach(s => {
                    s.style.backgroundPositionY = (scroll * 0.3) + 'px';
                });
            }
        }, { passive: true });
    }

    // ===== 8. MAGNETIC BUTTONS =====
    function initMagneticButtons() {
        if (window.innerWidth < 769) return;
        document.querySelectorAll('.btn-primary, .btn-outline').forEach(btn => {
            btn.addEventListener('mousemove', e => {
                const rect = btn.getBoundingClientRect();
                const x = e.clientX - rect.left - rect.width / 2;
                const y = e.clientY - rect.top - rect.height / 2;
                btn.style.transform = `translate(${x * 0.15}px, ${y * 0.15}px)`;
            });
            btn.addEventListener('mouseleave', () => {
                btn.style.transform = '';
            });
        });
    }

    // ===== INIT ALL =====
    function init() {
        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
        createParticles();
        initScrollReveal();
        initCursorGlow();
        init3DTilt();
        initGradientTitles();
        initCountUp();
        initParallax();
        initMagneticButtons();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
