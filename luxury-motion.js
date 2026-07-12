// ==================== LUXURY MOTION EFFECTS ====================
(function() {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    // ===== 1. ANIMATED MESH GRADIENT BACKGROUND =====
    var bgCanvas = document.createElement('canvas');
    bgCanvas.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;z-index:-1;pointer-events:none;opacity:0.35;';
    document.body.prepend(bgCanvas);

    var ctx = bgCanvas.getContext('2d');
    var w, h, time = 0;

    function resizeCanvas() {
        w = bgCanvas.width = window.innerWidth;
        h = bgCanvas.height = window.innerHeight;
    }
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    function drawGradient() {
        time += 0.003;
        var g1 = ctx.createRadialGradient(
            w * (0.5 + 0.3 * Math.sin(time)), h * (0.5 + 0.3 * Math.cos(time * 0.7)), 0,
            w * 0.5, h * 0.5, w * 0.8
        );
        g1.addColorStop(0, 'rgba(155, 108, 184, 0.18)');
        g1.addColorStop(0.5, 'rgba(232, 160, 191, 0.08)');
        g1.addColorStop(1, 'rgba(255, 255, 255, 0)');
        ctx.clearRect(0, 0, w, h);
        ctx.fillStyle = g1;
        ctx.fillRect(0, 0, w, h);

        var g2 = ctx.createRadialGradient(
            w * (0.3 + 0.3 * Math.cos(time * 0.5)), h * (0.6 + 0.2 * Math.sin(time * 0.8)), 0,
            w * 0.5, h * 0.5, w * 0.6
        );
        g2.addColorStop(0, 'rgba(212, 175, 55, 0.06)');
        g2.addColorStop(1, 'rgba(255, 255, 255, 0)');
        ctx.fillStyle = g2;
        ctx.fillRect(0, 0, w, h);
        requestAnimationFrame(drawGradient);
    }
    drawGradient();

    // ===== 2. SCROLL REVEAL ANIMATIONS =====
    var revealEls = document.querySelectorAll(
        '.product-card, .category-card, .review-card, .ba-card, .offer-card, .feature-item, .section-header, .rewards-content, .newsletter-content'
    );

    revealEls.forEach(function(el) {
        el.style.opacity = '0';
        el.style.transform = 'translateY(50px)';
        el.style.transition = 'none';
    });

    var revealObs = new IntersectionObserver(function(entries) {
        entries.forEach(function(entry) {
            if (entry.isIntersecting) {
                var el = entry.target;
                var siblings = el.parentElement.children;
                var index = Array.from(siblings).indexOf(el);
                setTimeout(function() {
                    el.style.transition = 'opacity 0.7s cubic-bezier(0.16,1,0.3,1), transform 0.7s cubic-bezier(0.16,1,0.3,1)';
                    el.style.opacity = '1';
                    el.style.transform = 'translateY(0)';
                }, index * 80);
                revealObs.unobserve(el);
            }
        });
    }, { threshold: 0.08 });

    revealEls.forEach(function(el) { revealObs.observe(el); });

    // ===== 3. FLOATING GOLD SPARKLES =====
    if (window.innerWidth > 768) {
        var sparkleStyle = document.createElement('style');
        sparkleStyle.textContent = '@keyframes sparkleFloat{0%,100%{opacity:0;transform:translateY(0) scale(0.5)}25%{opacity:0.8;transform:translateY(-30px) scale(1)}50%{opacity:0.4;transform:translateY(-60px) scale(0.7)}75%{opacity:0.8;transform:translateY(-30px) scale(1.1)}}';
        document.head.appendChild(sparkleStyle);

        for (var i = 0; i < 25; i++) {
            var s = document.createElement('div');
            var size = Math.random() * 4 + 2;
            s.style.cssText = 'position:fixed;width:' + size + 'px;height:' + size + 'px;background:radial-gradient(circle,rgba(212,175,55,0.5),transparent);border-radius:50%;pointer-events:none;z-index:0;left:' + (Math.random()*100) + '%;top:' + (Math.random()*100) + '%;animation:sparkleFloat ' + (Math.random()*8+4) + 's ease-in-out infinite;animation-delay:' + (Math.random()*5) + 's;';
            document.body.appendChild(s);
        }
    }

    // ===== 4. 3D TILT ON PRODUCT CARDS =====
    if (window.innerWidth > 768) {
        document.querySelectorAll('.product-card').forEach(function(card) {
            card.addEventListener('mousemove', function(e) {
                var rect = card.getBoundingClientRect();
                var x = (e.clientX - rect.left - rect.width / 2) / rect.width;
                var y = (e.clientY - rect.top - rect.height / 2) / rect.height;
                card.style.transform = 'perspective(800px) rotateX(' + (y * -6) + 'deg) rotateY(' + (x * 6) + 'deg) translateY(-8px)';
                card.style.transition = 'transform 0.1s ease';
                card.style.boxShadow = '0 20px 50px rgba(155,108,184,0.15)';
            });
            card.addEventListener('mouseleave', function() {
                card.style.transform = '';
                card.style.transition = 'transform 0.5s cubic-bezier(0.16,1,0.3,1), box-shadow 0.5s ease';
                card.style.boxShadow = '';
            });
        });
    }

    // ===== 5. SCROLL PROGRESS BAR =====
    var bar = document.createElement('div');
    bar.style.cssText = 'position:fixed;top:0;left:0;height:3px;background:linear-gradient(90deg,#9B6CB8,#D4AF37,#E8A0BF);z-index:9999;width:0%;';
    document.body.appendChild(bar);

    window.addEventListener('scroll', function() {
        var pct = (window.scrollY / (document.body.scrollHeight - window.innerHeight)) * 100;
        bar.style.width = pct + '%';
    }, { passive: true });

    // ===== 6. CURSOR GLOW =====
    if (window.innerWidth > 768) {
        var glow = document.createElement('div');
        glow.style.cssText = 'position:fixed;width:250px;height:250px;border-radius:50%;background:radial-gradient(circle,rgba(155,108,184,0.07) 0%,transparent 70%);pointer-events:none;z-index:0;transform:translate(-50%,-50%);';
        document.body.appendChild(glow);

        var mx = 0, my = 0, gx = 0, gy = 0;
        document.addEventListener('mousemove', function(e) { mx = e.clientX; my = e.clientY; }, { passive: true });
        function updateGlow() {
            gx += (mx - gx) * 0.08;
            gy += (my - gy) * 0.08;
            glow.style.left = gx + 'px';
            glow.style.top = gy + 'px';
            requestAnimationFrame(updateGlow);
        }
        updateGlow();
    }
})();
