// ==================== LUXURY ANIMATIONS ====================
(function() {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    // ===== 1. PRELOADER =====
    var loader = document.createElement('div');
    loader.id = 'mn-loader';
    loader.innerHTML = '<div class="mn-loader-inner"><img src="images/logo.png" alt=""><div class="mn-loader-bar"><div class="mn-loader-fill"></div></div></div>';
    document.body.prepend(loader);

    window.addEventListener('load', function() {
        setTimeout(function() {
            loader.style.opacity = '0';
            setTimeout(function() { loader.remove(); }, 600);
        }, 1500);
    });

    // ===== 2. CUSTOM CURSOR =====
    if (window.innerWidth > 768) {
        var cursor = document.createElement('div');
        cursor.className = 'mn-cursor';
        var cursorDot = document.createElement('div');
        cursorDot.className = 'mn-cursor-dot';
        document.body.appendChild(cursor);
        document.body.appendChild(cursorDot);

        var cx = 0, cy = 0, dx = 0, dy = 0;
        document.addEventListener('mousemove', function(e) {
            dx = e.clientX; dy = e.clientY;
            cursorDot.style.left = dx + 'px';
            cursorDot.style.top = dy + 'px';
        });

        function updateCursor() {
            cx += (dx - cx) * 0.12;
            cy += (dy - cy) * 0.12;
            cursor.style.left = cx + 'px';
            cursor.style.top = cy + 'px';
            requestAnimationFrame(updateCursor);
        }
        updateCursor();

        // Hover effect on interactive elements
        document.querySelectorAll('a, button, .mn-product, .mn-featured-img').forEach(function(el) {
            el.addEventListener('mouseenter', function() { cursor.classList.add('mn-cursor-hover'); });
            el.addEventListener('mouseleave', function() { cursor.classList.remove('mn-cursor-hover'); });
        });
    }

    // ===== 3. PARALLAX ON SCROLL =====
    if (window.innerWidth > 768) {
        var parallaxEls = document.querySelectorAll('.mn-featured-img img, .mn-split-img img, .mn-split-img video');
        window.addEventListener('scroll', function() {
            parallaxEls.forEach(function(el) {
                var rect = el.getBoundingClientRect();
                if (rect.top < window.innerHeight && rect.bottom > 0) {
                    var speed = 0.08;
                    var yPos = (rect.top - window.innerHeight / 2) * speed;
                    el.style.transform = 'scale(1.1) translateY(' + yPos + 'px)';
                }
            });
        }, { passive: true });
    }

    // ===== 4. IMAGE REVEAL WITH MASK =====
    document.querySelectorAll('.mn-featured-img').forEach(function(el) {
        el.style.clipPath = 'inset(100% 0 0 0)';
        el.style.transition = 'clip-path 1.2s cubic-bezier(0.16,1,0.3,1)';

        var imgObs = new IntersectionObserver(function(entries) {
            if (entries[0].isIntersecting) {
                el.style.clipPath = 'inset(0 0 0 0)';
                imgObs.disconnect();
            }
        }, { threshold: 0.2 });
        imgObs.observe(el);
    });

    // Split sections - NO clip-path, just fade in
    document.querySelectorAll('.mn-split-img').forEach(function(el) {
        el.style.opacity = '0';
        el.style.transform = 'translateX(-40px)';
        el.style.transition = 'opacity 1s ease, transform 1s cubic-bezier(0.16,1,0.3,1)';

        var splitObs = new IntersectionObserver(function(entries) {
            if (entries[0].isIntersecting) {
                el.style.opacity = '1';
                el.style.transform = 'translateX(0)';
                splitObs.disconnect();
            }
        }, { threshold: 0.05, rootMargin: '0px 0px -50px 0px' });
        splitObs.observe(el);
    });

    // ===== 5. GALLERY IMAGES - STAGGERED REVEAL =====
    document.querySelectorAll('.mn-gallery').forEach(function(gallery) {
        var imgs = gallery.querySelectorAll('img');
        imgs.forEach(function(img, i) {
            img.style.clipPath = 'inset(0 0 100% 0)';
            img.style.transition = 'clip-path 1s cubic-bezier(0.16,1,0.3,1)';
            img.style.transitionDelay = (i * 150) + 'ms';
        });

        var galObs = new IntersectionObserver(function(entries) {
            if (entries[0].isIntersecting) {
                imgs.forEach(function(img) { img.style.clipPath = 'inset(0 0 0 0)'; });
                galObs.disconnect();
            }
        }, { threshold: 0.2 });
        galObs.observe(gallery);
    });

    // ===== 6. MARQUEE TEXT =====
    var marqueeSection = document.createElement('div');
    marqueeSection.className = 'mn-marquee';
    marqueeSection.innerHTML = '<div class="mn-marquee-track"><span>MONTANA</span><span>✦</span><span>PREMIUM SKINCARE</span><span>✦</span><span>NATURAL INGREDIENTS</span><span>✦</span><span>MADE IN EGYPT</span><span>✦</span><span>MONTANA</span><span>✦</span><span>PREMIUM SKINCARE</span><span>✦</span><span>NATURAL INGREDIENTS</span><span>✦</span><span>MADE IN EGYPT</span><span>✦</span></div>';
    // Insert after trust section
    var trustSection = document.querySelector('.mn-trust');
    if (trustSection && trustSection.nextSibling) {
        trustSection.parentNode.insertBefore(marqueeSection, trustSection.nextSibling);
    }

    // ===== 7. MAGNETIC BUTTONS =====
    if (window.innerWidth > 768) {
        document.querySelectorAll('.mn-btn, .mn-hero-btn').forEach(function(btn) {
            btn.addEventListener('mousemove', function(e) {
                var rect = btn.getBoundingClientRect();
                var x = e.clientX - rect.left - rect.width / 2;
                var y = e.clientY - rect.top - rect.height / 2;
                btn.style.transform = 'translate(' + (x * 0.2) + 'px, ' + (y * 0.2) + 'px)';
            });
            btn.addEventListener('mouseleave', function() {
                btn.style.transform = '';
                btn.style.transition = 'transform 0.4s cubic-bezier(0.16,1,0.3,1)';
            });
            btn.addEventListener('mouseenter', function() {
                btn.style.transition = 'transform 0.1s ease';
            });
        });
    }

    // ===== 8. COUNTER ANIMATION =====
    document.querySelectorAll('.mn-trust-num').forEach(function(el) {
        var target = el.textContent;
        var numObs = new IntersectionObserver(function(entries) {
            if (entries[0].isIntersecting) {
                var num = parseInt(target);
                var current = 0;
                var step = 1;
                var timer = setInterval(function() {
                    current += step;
                    if (current >= num) { el.textContent = target; clearInterval(timer); }
                    else { el.textContent = '0' + current; }
                }, 60);
                numObs.disconnect();
            }
        }, { threshold: 0.5 });
        numObs.observe(el);
    });

    // ===== 9. SMOOTH HORIZONTAL SCROLL ON PRODUCTS =====
    var productsGrid = document.querySelector('.mn-products');
    if (productsGrid && window.innerWidth > 768) {
        productsGrid.addEventListener('wheel', function(e) {
            if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
            e.preventDefault();
            productsGrid.scrollLeft += e.deltaY;
        }, { passive: false });
    }

    // ===== 10. TEXT LINE REVEAL =====
    document.querySelectorAll('.mn-title').forEach(function(title) {
        title.style.overflow = 'hidden';
        var inner = document.createElement('span');
        inner.style.cssText = 'display:block;transform:translateY(100%);transition:transform 0.8s cubic-bezier(0.16,1,0.3,1)';
        inner.textContent = title.textContent;
        title.textContent = '';
        title.appendChild(inner);

        var tObs = new IntersectionObserver(function(entries) {
            if (entries[0].isIntersecting) {
                inner.style.transform = 'translateY(0)';
                tObs.disconnect();
            }
        }, { threshold: 0.5 });
        tObs.observe(title);
    });

    // ===== 11. LABEL LETTER SPACING ANIMATION =====
    document.querySelectorAll('.mn-label').forEach(function(label) {
        label.style.letterSpacing = '0px';
        label.style.opacity = '0';
        label.style.transition = 'letter-spacing 1s ease, opacity 0.6s ease';

        var lObs = new IntersectionObserver(function(entries) {
            if (entries[0].isIntersecting) {
                label.style.letterSpacing = '4px';
                label.style.opacity = '1';
                lObs.disconnect();
            }
        }, { threshold: 0.5 });
        lObs.observe(label);
    });

    // ===== 12. SCROLL ZOOM TO FULLSCREEN =====
    if (window.innerWidth > 768) {
        // Add zoom container around first gallery
        var firstGallery = document.querySelector('.mn-gallery');
        if (firstGallery) {
            var zoomWrap = document.createElement('div');
            zoomWrap.className = 'mn-zoom-section';
            zoomWrap.style.cssText = 'height:200vh;position:relative;';

            var zoomSticky = document.createElement('div');
            zoomSticky.style.cssText = 'position:sticky;top:0;height:100vh;overflow:hidden;display:flex;align-items:center;justify-content:center;';

            // Create zoom image from category-skincare or first product
            var zoomImg = document.createElement('div');
            zoomImg.className = 'mn-zoom-img';
            zoomImg.style.cssText = 'width:50%;height:60%;border-radius:16px;overflow:hidden;transition:none;will-change:transform,width,height,border-radius;';
            zoomImg.innerHTML = '<img src="images/category-skincare.png" style="width:100%;height:100%;object-fit:cover;">';

            zoomSticky.appendChild(zoomImg);
            zoomWrap.appendChild(zoomSticky);
            firstGallery.parentNode.insertBefore(zoomWrap, firstGallery);
            firstGallery.style.display = 'none';

            window.addEventListener('scroll', function() {
                var rect = zoomWrap.getBoundingClientRect();
                var progress = -rect.top / (zoomWrap.offsetHeight - window.innerHeight);
                progress = Math.max(0, Math.min(1, progress));

                // Scale from 50% to 100% width, 60% to 100% height, border-radius 16 to 0
                var w = 50 + (progress * 50);
                var h = 60 + (progress * 40);
                var radius = 16 - (progress * 16);

                zoomImg.style.width = w + '%';
                zoomImg.style.height = h + '%';
                zoomImg.style.borderRadius = radius + 'px';
            }, { passive: true });
        }
    }

    // ===== INJECT STYLES =====
    var style = document.createElement('style');
    style.textContent = [
        // Preloader
        '#mn-loader{position:fixed;inset:0;background:#F3EEF8;z-index:9999;display:flex;align-items:center;justify-content:center;transition:opacity 0.6s ease}',
        '.mn-loader-inner{text-align:center}',
        '.mn-loader-inner img{height:40px;margin-bottom:24px;animation:loaderPulse 1.5s ease infinite}',
        '.mn-loader-bar{width:120px;height:2px;background:rgba(155,108,184,0.15);border-radius:2px;overflow:hidden}',
        '.mn-loader-fill{height:100%;background:var(--purple);animation:loaderFill 1.5s ease forwards}',
        '@keyframes loaderPulse{0%,100%{opacity:0.5}50%{opacity:1}}',
        '@keyframes loaderFill{0%{width:0}100%{width:100%}}',

        // Custom cursor
        '.mn-cursor{position:fixed;width:40px;height:40px;border:1px solid rgba(155,108,184,0.4);border-radius:50%;pointer-events:none;z-index:9998;transform:translate(-50%,-50%);transition:width 0.3s,height 0.3s,border-color 0.3s}',
        '.mn-cursor-dot{position:fixed;width:6px;height:6px;background:var(--purple);border-radius:50%;pointer-events:none;z-index:9998;transform:translate(-50%,-50%)}',
        '.mn-cursor-hover{width:60px;height:60px;border-color:rgba(197,165,90,0.6);background:rgba(155,108,184,0.05)}',
        'body{cursor:none}',
        'a,button{cursor:none}',

        // Marquee
        '.mn-marquee{padding:24px 0;overflow:hidden;background:rgba(155,108,184,0.08);border-top:1px solid rgba(155,108,184,0.08);border-bottom:1px solid rgba(155,108,184,0.08)}',
        '.mn-marquee-track{display:flex;gap:32px;animation:marqueeScroll 20s linear infinite;white-space:nowrap;width:max-content}',
        '.mn-marquee-track span{font-family:"Cormorant Garamond",serif;font-size:18px;font-weight:400;color:rgba(45,27,61,0.25);letter-spacing:4px}',
        '@keyframes marqueeScroll{0%{transform:translateX(0)}100%{transform:translateX(-50%)}}',
    ].join('');
    document.head.appendChild(style);

})();
