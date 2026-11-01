const fs = require('fs');

console.log('Adding the 3rd routine (Face & Body - 558 EGP) to index.html and category.html...');

// The 3rd routine card HTML:
const thirdRoutineCard = `
            <!-- Routine 3: Face & Body Care Routine -->
            <article class="lux-routine-card">
                <div class="lux-routine-banner">
                    <span class="lux-routine-pill">عناية متكاملة للوجه والجسم</span>
                    <span class="lux-routine-shipping"><i class="fas fa-truck-fast"></i> شحن مجاني هدية</span>
                </div>
                <div class="lux-routine-body">
                    <h3 class="lux-routine-title">روتين نضارة الوجه وترطيب الجسم</h3>
                    <p class="lux-routine-desc">تنظيف طبي عميق لمسام الوجه المعرضة للحبوب مع ترطيب مخملي مكثف لليدين والجسم يدوم 72 ساعة.</p>
                    
                    <div class="lux-steps-list">
                        <div class="lux-step-item">
                            <div class="lux-step-num">1</div>
                            <div class="lux-step-info">
                                <h5>غسول الوجه وحب الشباب (200 مل)</h5>
                                <p>تنقية المسام من الإفرازات الدهنية بحمض الساليسيليك دون التسبب في جفاف</p>
                            </div>
                        </div>
                        <div class="lux-step-item">
                            <div class="lux-step-num">2</div>
                            <div class="lux-step-info">
                                <h5>لوشن اليدين والجسم 72h (50 مل)</h5>
                                <p>ترطيب مخملي فائق النعومة بزبدة الكاكاو والجوجوبا وفيتامين E للجسم</p>
                            </div>
                        </div>
                    </div>
                    
                    <div class="lux-routine-footer">
                        <div class="lux-price-tag">
                            <div class="lux-price-current">558 <span>جنيه</span></div>
                            <div class="lux-price-orig">بدون مصاريف شحن</div>
                        </div>
                        <button class="btn-add-routine" onclick="handleOrderRoutine('face-body')">
                            <i class="fas fa-shopping-bag"></i> اطلبي العرض (شحن مجاني)
                        </button>
                    </div>
                </div>
            </article>`;

// Update index.html
let index = fs.readFileSync('index.html', 'utf8');

// 1. Change CSS grid from repeat(2, 1fr) to repeat(3, 1fr) for routines
index = index.replace(
    /\.lux-routines-grid\s*\{[\s\S]*?grid-template-columns:\s*repeat\(2,\s*1fr\);/,
    '.lux-routines-grid {\n        display: grid;\n        grid-template-columns: repeat(3, 1fr);'
);

// Add responsive style for tablet
if (!index.includes('@media (max-width: 1100px)')) {
    index = index.replace(
        '@media (max-width: 1024px) {',
        '@media (max-width: 1100px) {\n        .lux-routines-grid { grid-template-columns: repeat(2, 1fr); }\n      }\n      @media (max-width: 1024px) {'
    );
}

// 2. Insert 3rd routine card into index.html
if (!index.includes('face-body')) {
    index = index.replace(
        /<!-- Routine 2: Post Laser Routine -->[\s\S]*?<\/article>/,
        (match) => match + '\n' + thirdRoutineCard
    );
}

// 3. Update handleOrderRoutine in index.html to handle 'face-body'
const handleRoutineCode = `} else if (type === 'face-body') {
            window.Cart.add({ id: 1, name: 'غسول حب الشباب (ضمن الروتين)', price: 299, image: 'images/p1-premium.webp' }, 1, { skipMeta: true });
            window.Cart.add({ id: 4, name: 'لوشن اليدين والجسم (ضمن الروتين)', price: 259, image: 'images/p4-premium.webp' }, 1, { skipMeta: true });
        }`;

if (!index.includes("type === 'face-body'")) {
    index = index.replace(
        "window.Cart.add({ id: 2, name: 'كريم التفتيح (ضمن الروتين)', price: 273, image: 'images/p2-premium.webp' }, 1, { skipMeta: true });\n        }",
        "window.Cart.add({ id: 2, name: 'كريم التفتيح (ضمن الروتين)', price: 273, image: 'images/p2-premium.webp' }, 1, { skipMeta: true });\n        " + handleRoutineCode
    );
}

fs.writeFileSync('index.html', index, 'utf8');
console.log('index.html updated with 3rd routine!');

// Update category.html
let shop = fs.readFileSync('category.html', 'utf8');

// Change shop routines grid to repeat(3, 1fr)
shop = shop.replace(
    /\.shop-routines-grid\s*\{[\s\S]*?grid-template-columns:\s*repeat\(2,\s*1fr\);/,
    '.shop-routines-grid {\n        display: grid;\n        grid-template-columns: repeat(3, 1fr);'
);

// Add 3rd card in category.html
const thirdShopRoutineCard = `
        <!-- Routine 3: Face & Body Routine -->
        <article class="shop-routine-card" data-cat="bundles">
            <div class="shop-routine-top">
                <span>🌿 عناية كاملة للوجه والجسم</span>
                <span>شحن مجاني هدية</span>
            </div>
            <div class="shop-routine-body">
                <h3 class="shop-routine-name">روتين نضارة الوجه وترطيب الجسم</h3>
                <p class="shop-routine-desc">تنظيف طبي لمسام الوجه وتقليل الدهون والحبوب مع ترطيب حريري لليدين والجسم 72 ساعة.</p>
                <div class="shop-routine-steps">
                    <div class="shop-routine-step"><span class="step-dot">1</span><span>غسول حب الشباب الطبي (200 مل) — ساليسيليك وأرجان</span></div>
                    <div class="shop-routine-step"><span class="step-dot">2</span><span>لوشن اليدين والجسم 72h (50 مل) — كاكاو وجوجوبا</span></div>
                </div>
                <div class="shop-routine-bottom">
                    <div class="shop-price-box">
                        <div class="shop-now-price">558 <span>جنيه</span></div>
                        <div class="shop-orig-price">بدون مصاريف شحن</div>
                    </div>
                    <button class="btn-routine-buy" onclick="handleOrderRoutine('face-body')">
                        <i class="fas fa-shopping-bag"></i> اطلبي العرض (شحن مجاني)
                    </button>
                </div>
            </div>
        </article>`;

if (!shop.includes('face-body')) {
    shop = shop.replace(
        /<!-- Post Laser Routine -->[\s\S]*?<\/article>/,
        (match) => match + '\n' + thirdShopRoutineCard
    );

    shop = shop.replace(
        "window.Cart.add({ id: 2, name: 'كريم التفتيح (ضمن الروتين)', price: 273, image: 'images/p2-premium.webp' }, 1, { skipMeta: true });\n        }",
        "window.Cart.add({ id: 2, name: 'كريم التفتيح (ضمن الروتين)', price: 273, image: 'images/p2-premium.webp' }, 1, { skipMeta: true });\n        " + handleRoutineCode
    );
}

fs.writeFileSync('category.html', shop, 'utf8');
console.log('category.html updated with 3rd routine!');
