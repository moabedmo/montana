// ==================== COLUMNS HERO - TRANSFORM REVEAL ====================
(function() {
    const hero = document.getElementById('colHero');
    if (!hero) return;

    const slides = [
        {
            before: 'images/col-banner-acne.png',
            after: 'images/banner-acne-desktop.png',
            badge: 'الأكثر مبيعاً',
            title: 'غسول الوجه لعلاج حب الشباب',
            desc: 'بزيت الأرجان والجوجوبا - نتيجة في 14 يوم',
        },
        {
            before: 'images/banner-cream-desktop.png',
            after: 'images/banner-lotion-desktop.png',
            badge: 'خصم 20%',
            title: 'كريم التفتيح بالألفا أربوتين',
            desc: 'تفتيح فوري - للوجه والرقبة والمناطق الحساسة',
        },
        {
            before: 'images/banner-cleanser-desktop.png',
            after: 'images/banner-laser-desktop.png',
            badge: 'جديد',
            title: 'غسول التفتيح والتوحيد',
            desc: 'بخلاصة العرقسوس - ينظف ويوحد ويُنير بشرتك',
        },
        {
            before: 'images/banner-scar-desktop.png',
            after: 'images/banner-lotion-desktop.png',
            badge: 'الأكثر مبيعاً',
            title: 'لوشن اليدين والجسم',
            desc: 'ترطيب 72 ساعة - غير دهني - لجميع أنواع البشرة',
        },
    ];

    let current = 0;
    let timer = null;
    const CYCLE = 6000;

    const beforeEl = hero.querySelector('.col-hero-before');
    const afterEl = hero.querySelector('.col-hero-after');
    const badgeEl = hero.querySelector('.col-hero-badge');
    const titleEl = hero.querySelector('.col-hero-final-content h2');
    const descEl = hero.querySelector('.col-hero-final-content p');
    const counterEl = document.getElementById('colCurrent');
    const dots = document.querySelectorAll('.col-dot');
    const bars = hero.querySelectorAll('.col-bar');

    function loadSlide(i) {
        const s = slides[i];
        beforeEl.style.backgroundImage = "url('" + s.before + "')";
        afterEl.style.backgroundImage = "url('" + s.after + "')";
        badgeEl.textContent = s.badge;
        titleEl.textContent = s.title;
        descEl.textContent = s.desc;
        if (counterEl) counterEl.textContent = String(i + 1).padStart(2, '0');
    }

    function resetState() {
        hero.classList.remove('running', 'done');
        beforeEl.style.animation = 'none';
        bars.forEach(function(b) { b.style.animation = 'none'; });
        void hero.offsetHeight;
        beforeEl.style.animation = '';
        bars.forEach(function(b) { b.style.animation = ''; });
    }

    function runAnimation() {
        resetState();
        loadSlide(current);
        updateDots();

        // Show before image for 1.5s first
        setTimeout(function() {
            // Start column sweep
            hero.classList.add('running');

            // After columns finish, show final
            setTimeout(function() {
                hero.classList.add('done');

                // Wait, then next slide
                setTimeout(function() {
                    hero.classList.remove('done');
                    current = (current + 1) % slides.length;
                    runAnimation();
                }, 2500);

            }, 2000);
        }, 1500);
    }

    function updateDots() {
        dots.forEach(function(d, i) {
            d.classList.toggle('active', i === current);
            var fill = d.querySelector('.col-dot-fill');
            fill.style.transition = 'none';
            fill.style.width = '0%';
            if (i === current) {
                requestAnimationFrame(function() {
                    requestAnimationFrame(function() {
                        fill.style.transition = 'width ' + CYCLE + 'ms linear';
                        fill.style.width = '100%';
                    });
                });
            }
        });
    }

    window.colGoTo = function(index) {
        current = index;
        runAnimation();
    };

    // Start
    runAnimation();
})();
