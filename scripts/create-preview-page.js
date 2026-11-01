const fs = require('fs');
const path = require('path');

const srcPath = path.join(__dirname, '..', 'index.html');
const outPath = path.join(__dirname, '..', 'preview.html');

let html = fs.readFileSync(srcPath, 'utf8');

// 1. Update Title
html = html.replace(
  '<title>Montana | غسول حب الشباب وكريم تفتيح — عناية بالبشرة مصر</title>',
  '<title>Montana Naturals — معاينة التصميم الفاخر الجديد</title>'
);

// 2. Add Floating Preview Bar at top of body
const previewBar = `
<!-- Floating Preview Indicator -->
<div style="position:sticky;top:0;z-index:99999;background:linear-gradient(90deg,#4A355A,#9275A4);color:#fff;padding:9px 16px;text-align:center;font-size:13px;font-weight:700;box-shadow:0 4px 15px rgba(0,0,0,0.2);display:flex;align-items:center;justify-content:center;gap:12px;letter-spacing:0.3px;">
  <span>✨ معاينة الريديزاين الفاخر الجديد (نسخة تجريبية لا تؤثر على الموقع الرئيسي)</span>
  <span style="background:#D8B559;color:#2E2537;padding:3px 10px;border-radius:999px;font-size:11px;font-weight:800;">خاص بمراجعة المالك</span>
</div>
`;
html = html.replace('<body class="mnt-home">', '<body class="mnt-home">\n' + previewBar);

// 3. Update Hero headline, copy, and replace shot with our new luxury banner
const oldHeroShotRegex = /<picture class="hb-shot">[\s\S]*?<\/picture>/;
const newHeroShot = `<picture class="hb-shot">
            <source srcset="images/hero-luxury-banner-620.webp 620w, images/hero-luxury-banner-950.webp 950w, images/hero-luxury-banner.webp 1376w"
                    sizes="(max-width:900px) 92vw, 48vw">
            <img src="images/hero-luxury-banner.webp"
                 alt="مجموعة Montaña Naturals الفاخرة — عناية طبيعية موثوقة"
                 fetchpriority="high" decoding="async"
                 style="border-radius:24px;box-shadow:0 24px 60px -20px rgba(74,53,90,0.35);border:2px solid rgba(216,181,89,0.3);width:100%;max-width:540px;height:auto;object-fit:cover;">
        </picture>`;

html = html.replace(oldHeroShotRegex, newHeroShot);

// 4. Update Hero Copy for maximum Egyptian female resonance
html = html.replace(
  '<h1 class="hb-head">بشرتك تستحق عناية طبيعية<br>بنتائج حقيقية</h1>',
  '<h1 class="hb-head">بشرتك تستحق عناية طبيعية<br><span style="color:#9275A4;">بنتائج تلمسيها بنفسك</span></h1>'
);

html = html.replace(
  '<p class="hb-sub">خمس تركيبات طبية متخصصة للعناية بالوجه والجسم — غسول لحب الشباب، غسول وكريم للتفتيح، لوشن ترطيب، وكريم ما بعد الليزر.</p>',
  '<p class="hb-sub">خمس تركيبات تجميلية متخصصة ومصرحة من وزارة الصحة المصرية لبشرة أفتح، أنقى، وأكثر نضارة — تفتيح الأماكن الداكنة، تهدئة ما بعد الليزر، وعلاج آثار الحبوب.</p>'
);

// 5. Enhance Trust Row right below the hero
const oldBridge = `<div class="lux-trust-row">
            <div class="lux-trust-item"><span class="lux-trust-icon">◆</span><span>مصنع معتمد ومرخص</span></div>
            <div class="lux-trust-item"><span class="lux-trust-icon">◆</span><span>خالي من البارابين</span></div>
            <div class="lux-trust-item"><span class="lux-trust-icon">◆</span><span>مناسب للبشرة الحساسة</span></div>
        </div>`;

const newBridge = `<div class="lux-trust-row" style="display:flex;flex-wrap:wrap;justify-content:center;gap:16px 28px;padding:12px 16px;background:rgba(255,255,255,0.7);border-radius:18px;border:1px solid rgba(146,117,164,0.15);box-shadow:0 4px 20px -8px rgba(146,117,164,0.15);">
            <div class="lux-trust-item" style="display:flex;align-items:center;gap:8px;font-weight:700;color:#35263E;font-size:14px;"><span style="color:#059669;">🛡️</span><span>مرخص ومسجل بوزارة الصحة المصرية</span></div>
            <div class="lux-trust-item" style="display:flex;align-items:center;gap:8px;font-weight:700;color:#35263E;font-size:14px;"><span style="color:#9275A4;">🌿</span><span>خالي من الكورتيزون والبارابين</span></div>
            <div class="lux-trust-item" style="display:flex;align-items:center;gap:8px;font-weight:700;color:#35263E;font-size:14px;"><span style="color:#D8B559;">⏱️</span><span>نتائج ملحوظة خلال 14 يوم</span></div>
            <div class="lux-trust-item" style="display:flex;align-items:center;gap:8px;font-weight:700;color:#35263E;font-size:14px;"><span style="color:#436697;">📦</span><span>معاينة وفحص الطلب قبل الاستلام</span></div>
        </div>`;

html = html.replace(oldBridge, newBridge);

// 6. Create clean, feminine "Shop by Concern" cards (no dark purple background, no silicone scar gel)
const oldShopByConcernRegex = /<!-- Shop by skin concern \(from indications\.docx\) -->[\s\S]*?<\/section>/;

const newShopByConcern = `<!-- Elevated Shop by Skin Concern (Clean Luxury Feminine) -->
<section class="lux-section lux-reveal" id="shop-by-concern" style="background:#FAF8FC;padding:56px 0;border-y:1px solid #EFEAF2;">
    <div class="container" style="max-width:1200px;margin:0 auto;padding:0 20px;">
        <div class="lux-section-head" style="text-align:center;margin-bottom:36px;">
            <span class="lux-eyebrow" style="color:#D8B559;font-weight:800;letter-spacing:1px;font-size:12px;text-transform:uppercase;">دليل العناية الشخصي</span>
            <h2 style="font-size:clamp(24px,3vw,34px);font-weight:800;color:#31233A;margin:8px 0;">تسوقي حسب احتياج بشرتك</h2>
            <p style="color:#604D6C;font-size:15px;max-width:540px;margin:0 auto;">اختاري ما تبحثين عنه واكتشفي البروتوكول المناسب لبشرتك من Montaña</p>
        </div>
        <div class="lux-concerns-grid" style="display:grid;grid-template-columns:repeat(auto-fit, minmax(260px, 1fr));gap:20px;">
            <!-- Card 1: Whitening & Hyperpigmentation -->
            <article class="lux-concern-card" style="background:#FFFFFF;border-radius:24px;padding:24px;border:1px solid rgba(146,117,164,0.18);box-shadow:0 8px 24px -10px rgba(146,117,164,0.12);transition:transform 0.2s, box-shadow 0.2s;">
                <div style="width:48px;height:48px;border-radius:16px;background:rgba(146,117,164,0.12);color:#9275A4;display:flex;align-items:center;justify-content:center;font-size:22px;margin-bottom:14px;">✨</div>
                <h3 style="font-size:18px;font-weight:800;color:#31233A;margin:0 0 8px;">تفتيح وتوحيد لون البشرة</h3>
                <p style="font-size:13.5px;color:#665471;line-height:1.7;margin:0 0 16px;">لإزالة آثار التصبغات واسمرار المناطق الحساسة وتحت الإبط وتفاوت لون الوجه والرقبة.</p>
                <div style="display:flex;flex-wrap:wrap;gap:8px;">
                    <a href="/product/whitening-cream" class="lux-concern-chip" style="background:#F6F2F8;color:#5A3F6D;font-weight:700;padding:6px 14px;border-radius:999px;font-size:12.5px;text-decoration:none;border:1px solid rgba(146,117,164,0.25);">كريم التفتيح المركز</a>
                    <a href="/product/whitening-cleanser" class="lux-concern-chip" style="background:#F6F2F8;color:#5A3F6D;font-weight:700;padding:6px 14px;border-radius:999px;font-size:12.5px;text-decoration:none;border:1px solid rgba(146,117,164,0.25);">غسول التفتيح</a>
                    <a href="#bundlesMount" class="lux-concern-chip" style="background:#FAF4E6;color:#856417;font-weight:800;padding:6px 14px;border-radius:999px;font-size:12.5px;text-decoration:none;border:1px solid rgba(216,181,89,0.35);">روتين التفتيح 777 ج 🎁</a>
                </div>
            </article>

            <!-- Card 2: Post-Laser Soothing -->
            <article class="lux-concern-card" style="background:#FFFFFF;border-radius:24px;padding:24px;border:1px solid rgba(16,185,129,0.2);box-shadow:0 8px 24px -10px rgba(16,185,129,0.1);transition:transform 0.2s, box-shadow 0.2s;">
                <div style="width:48px;height:48px;border-radius:16px;background:rgba(16,185,129,0.12);color:#059669;display:flex;align-items:center;justify-content:center;font-size:22px;margin-bottom:14px;">🌿</div>
                <h3 style="font-size:18px;font-weight:800;color:#31233A;margin:0 0 8px;">عناية وتهدئة ما بعد الليزر</h3>
                <p style="font-size:13.5px;color:#665471;line-height:1.7;margin:0 0 16px;">تهدئة سريعة للبشرة المعالجة بالليزر، وتقليل الاحمرار والالتهاب وحماية البشرة من اسمرار ما بعد الجلسات.</p>
                <div style="display:flex;flex-wrap:wrap;gap:8px;">
                    <a href="/product/post-laser-cream" class="lux-concern-chip" style="background:#ECFDF5;color:#047857;font-weight:700;padding:6px 14px;border-radius:999px;font-size:12.5px;text-decoration:none;border:1px solid rgba(16,185,129,0.3);">كريم ما بعد الليزر</a>
                    <a href="#bundlesMount" class="lux-concern-chip" style="background:#FAF4E6;color:#856417;font-weight:800;padding:6px 14px;border-radius:999px;font-size:12.5px;text-decoration:none;border:1px solid rgba(216,181,89,0.35);">عرض الليزر 618 ج 🎁</a>
                </div>
            </article>

            <!-- Card 3: Acne & Blemishes -->
            <article class="lux-concern-card" style="background:#FFFFFF;border-radius:24px;padding:24px;border:1px solid rgba(67,102,151,0.2);box-shadow:0 8px 24px -10px rgba(67,102,151,0.1);transition:transform 0.2s, box-shadow 0.2s;">
                <div style="width:48px;height:48px;border-radius:16px;background:rgba(67,102,151,0.12);color:#436697;display:flex;align-items:center;justify-content:center;font-size:22px;margin-bottom:14px;">💧</div>
                <h3 style="font-size:18px;font-weight:800;color:#31233A;margin:0 0 8px;">حب الشباب وآثاره</h3>
                <p style="font-size:13.5px;color:#665471;line-height:1.7;margin:0 0 16px;">تنظيف عميق للمسام وإزالة الزيوت الزائدة بلطف مع تهدئة الحبوب وتحسين مظهر البشرة بدون جفاف.</p>
                <div style="display:flex;flex-wrap:wrap;gap:8px;">
                    <a href="/product/acne-facial-cleanser" class="lux-concern-chip" style="background:#EFF6FF;color:#1D4ED8;font-weight:700;padding:6px 14px;border-radius:999px;font-size:12.5px;text-decoration:none;border:1px solid rgba(67,102,151,0.3);">غسول حب الشباب</a>
                    <a href="/product/whitening-cream" class="lux-concern-chip" style="background:#F6F2F8;color:#5A3F6D;font-weight:700;padding:6px 14px;border-radius:999px;font-size:12.5px;text-decoration:none;border:1px solid rgba(146,117,164,0.25);">كريم التفتيح للآثار</a>
                </div>
            </article>

            <!-- Card 4: Body Hydration -->
            <article class="lux-concern-card" style="background:#FFFFFF;border-radius:24px;padding:24px;border:1px solid rgba(216,181,89,0.3);box-shadow:0 8px 24px -10px rgba(216,181,89,0.15);transition:transform 0.2s, box-shadow 0.2s;">
                <div style="width:48px;height:48px;border-radius:16px;background:rgba(216,181,89,0.15);color:#8C7026;display:flex;align-items:center;justify-content:center;font-size:22px;margin-bottom:14px;">🌸</div>
                <h3 style="font-size:18px;font-weight:800;color:#31233A;margin:0 0 8px;">ترطيب وتنعيم الجسم</h3>
                <p style="font-size:13.5px;color:#665471;line-height:1.7;margin:0 0 16px;">تركيبة ناعمة سريعة الامتصاص تمنح اليدين والجسم ترطيباً فائقاً دون ملمس دهني أو لزوجة.</p>
                <div style="display:flex;flex-wrap:wrap;gap:8px;">
                    <a href="/product/hand-body-lotion" class="lux-concern-chip" style="background:#FAF8F3;color:#856417;font-weight:700;padding:6px 14px;border-radius:999px;font-size:12.5px;text-decoration:none;border:1px solid rgba(216,181,89,0.35);">لوشن اليدين والجسم</a>
                    <a href="#bundlesMount" class="lux-concern-chip" style="background:#FAF4E6;color:#856417;font-weight:800;padding:6px 14px;border-radius:999px;font-size:12.5px;text-decoration:none;border:1px solid rgba(216,181,89,0.35);">عرض الوش والجسم 558 ج</a>
                </div>
            </article>
        </div>
        <p style="text-align:center;font-size:12px;color:#836F8F;margin-top:28px;">دواعي استعمال تجميلية للعناية بالبشرة — وليست ادعاءات علاجية. استشيري طبيب الجلدية عند الحاجة.</p>
    </div>
</section>`;

html = html.replace(oldShopByConcernRegex, newShopByConcern);

// 7. Add Sticky Bottom Bar for Mobile View
const mobileStickyBar = `
<!-- Mobile Sticky Action Bar -->
<div id="previewStickyBar" style="position:fixed;bottom:0;left:0;right:0;z-index:999;background:rgba(255,255,255,0.96);backdrop-filter:blur(10px);border-top:1px solid rgba(146,117,164,0.2);padding:10px 16px;box-shadow:0 -4px 20px rgba(0,0,0,0.08);display:none;align-items:center;justify-content:space-between;gap:12px;">
  <a href="#bundlesMount" style="flex:1;background:linear-gradient(135deg,#9275A4,#7A5A8E);color:#fff;text-decoration:none;padding:12px 18px;border-radius:999px;font-weight:800;font-size:14px;text-align:center;box-shadow:0 8px 18px -4px rgba(110,84,128,0.5);display:flex;align-items:center;justify-content:center;gap:8px;">
    <span>اطلبي عروض الروتين (شحن مجاني)</span>
    <span>←</span>
  </a>
  <button onclick="if(window.openChatWidget)window.openChatWidget();return false;" style="width:46px;height:46px;border-radius:50%;background:#F4F1F6;border:1px solid rgba(146,117,164,0.3);color:#9275A4;display:flex;align-items:center;justify-content:center;font-size:19px;cursor:pointer;">
    <i class="fas fa-comment-dots"></i>
  </button>
</div>

<script>
  // Show sticky bar on mobile when scrolled down past hero
  if (window.innerWidth <= 820) {
    const bar = document.getElementById('previewStickyBar');
    if (bar) {
      window.addEventListener('scroll', function() {
        if (window.scrollY > 300) {
          bar.style.display = 'flex';
        } else {
          bar.style.display = 'none';
        }
      }, { passive: true });
    }
  }
</script>
`;

html = html.replace('</body>', mobileStickyBar + '\n</body>');

fs.writeFileSync(outPath, html, 'utf8');
console.log('preview.html successfully generated and written!');
