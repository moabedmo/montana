const fs = require('fs');

console.log('Adding Free Shipping Bar & 1-Click Quick Order Modal...');

// CSS for the Shipping Bar and Quick Order Modal
const featuresCss = `
      /* === FREE SHIPPING PROGRESS BAR === */
      .lux-shipping-bar-wrap {
        background: #FFFFFF;
        border-bottom: 1px solid rgba(146, 117, 164, 0.12);
        padding: 8px 16px;
        position: relative;
        z-index: 90;
      }
      .lux-shipping-bar-inner {
        max-width: 650px;
        margin: 0 auto;
        text-align: center;
      }
      .lux-shipping-msg {
        font-size: 13px;
        font-weight: 700;
        color: var(--ink-primary);
        margin-bottom: 6px;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 6px;
      }
      .lux-shipping-track {
        height: 6px;
        background: #EFEBF2;
        border-radius: 10px;
        overflow: hidden;
        position: relative;
      }
      .lux-shipping-fill {
        height: 100%;
        background: linear-gradient(90deg, var(--brand-purple), var(--brand-gold));
        border-radius: 10px;
        transition: width 0.4s ease;
        width: 0%;
      }
      .lux-shipping-fill.unlocked {
        background: linear-gradient(90deg, #27ae60, #2ecc71);
      }

      /* === 1-CLICK QUICK ORDER MODAL === */
      .qo-modal-overlay {
        position: fixed;
        inset: 0;
        background: rgba(45, 31, 53, 0.7);
        backdrop-filter: blur(8px);
        -webkit-backdrop-filter: blur(8px);
        z-index: 10000;
        display: none;
        align-items: center;
        justify-content: center;
        padding: 16px;
      }
      .qo-modal-overlay.active {
        display: flex;
        animation: qoFadeIn 0.25s ease forwards;
      }
      @keyframes qoFadeIn {
        from { opacity: 0; transform: scale(0.96); }
        to { opacity: 1; transform: scale(1); }
      }
      .qo-modal-box {
        background: #FFFFFF;
        border-radius: 24px;
        width: 100%;
        max-width: 480px;
        max-height: 90vh;
        overflow-y: auto;
        padding: 24px 28px;
        box-shadow: 0 25px 50px -12px rgba(45, 31, 53, 0.35);
        border: 1.5px solid rgba(146, 117, 164, 0.2);
        position: relative;
      }
      .qo-close-btn {
        position: absolute;
        top: 18px;
        left: 18px;
        background: #F4EFF7;
        color: var(--ink-secondary);
        width: 32px;
        height: 32px;
        border-radius: 50%;
        border: none;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 15px;
        transition: background 0.2s;
      }
      .qo-close-btn:hover { background: #E8DFF0; color: #2D1F35; }
      .qo-header { text-align: center; margin-bottom: 20px; }
      .qo-badge {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        background: var(--brand-gold-light);
        color: var(--brand-gold-dark);
        font-size: 12px;
        font-weight: 800;
        padding: 4px 12px;
        border-radius: 20px;
        margin-bottom: 8px;
      }
      .qo-title { font-size: 20px; font-weight: 900; color: var(--ink-primary); margin-bottom: 4px; }
      .qo-sub { font-size: 13px; color: var(--ink-muted); }
      
      .qo-item-card {
        display: flex;
        align-items: center;
        gap: 14px;
        background: var(--bg-warm);
        padding: 12px 16px;
        border-radius: 14px;
        border: 1px solid rgba(146, 117, 164, 0.12);
        margin-bottom: 18px;
      }
      .qo-item-img {
        width: 50px;
        height: 50px;
        border-radius: 10px;
        background: white;
        object-fit: contain;
        padding: 4px;
      }
      .qo-item-info { flex: 1; }
      .qo-item-name { font-size: 14.5px; font-weight: 800; color: var(--ink-primary); }
      .qo-item-price { font-size: 15px; font-weight: 900; color: var(--brand-purple-dark); }
      .qo-shipping-tag { font-size: 11.5px; color: #27ae60; font-weight: 700; }

      .qo-form-group { margin-bottom: 14px; }
      .qo-form-group label {
        display: block;
        font-size: 12.5px;
        font-weight: 700;
        color: var(--ink-secondary);
        margin-bottom: 6px;
      }
      .qo-form-input, .qo-form-select {
        width: 100%;
        padding: 12px 14px;
        border-radius: 12px;
        border: 1.5px solid rgba(146, 117, 164, 0.22);
        font-family: inherit;
        font-size: 14px;
        color: var(--ink-primary);
        background: #FFFFFF;
        outline: none;
        transition: border-color 0.2s;
      }
      .qo-form-input:focus, .qo-form-select:focus {
        border-color: var(--brand-purple);
        box-shadow: 0 0 0 3px rgba(146, 117, 164, 0.15);
      }
      .qo-trust-box {
        background: rgba(216, 181, 89, 0.1);
        border: 1px solid rgba(216, 181, 89, 0.35);
        border-radius: 12px;
        padding: 10px 14px;
        font-size: 12px;
        color: #5A4B62;
        margin-block: 16px;
        text-align: center;
        line-height: 1.5;
      }
      .qo-submit-btn {
        width: 100%;
        background: linear-gradient(135deg, #A58229 0%, #D8B559 100%);
        color: #FFFFFF;
        padding: 14px;
        border-radius: 25px;
        font-size: 16px;
        font-weight: 800;
        border: none;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        box-shadow: 0 6px 18px rgba(216, 181, 89, 0.35);
        transition: all 0.2s;
      }
      .qo-submit-btn:hover {
        transform: translateY(-2px);
        box-shadow: 0 8px 24px rgba(216, 181, 89, 0.45);
      }

      /* Secondary Quick Order Button on Routine & Product Cards */
      .btn-quick-order {
        background: #FFFFFF;
        color: var(--brand-gold-dark);
        border: 1.5px solid var(--brand-gold);
        padding: 10px 16px;
        border-radius: 25px;
        font-size: 13.5px;
        font-weight: 800;
        cursor: pointer;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 6px;
        transition: all 0.2s ease;
        margin-top: 8px;
      }
      .btn-quick-order:hover {
        background: var(--brand-gold-light);
        border-color: var(--brand-gold-dark);
      }
`;

// HTML for Shipping Bar:
const shippingBarHtml = `
<!-- FREE SHIPPING PROGRESS BAR -->
<div class="lux-shipping-bar-wrap" id="shippingBarWrap">
    <div class="lux-shipping-bar-inner">
        <div class="lux-shipping-msg" id="shippingMsg">
            <i class="fas fa-truck-fast" style="color:var(--brand-gold);"></i>
            <span id="shippingMsgText">🚚 شحن مجاني لجميع محافظات مصر عند اختيار أي روتين أو 3 منتجات</span>
        </div>
        <div class="lux-shipping-track">
            <div class="lux-shipping-fill" id="shippingFill"></div>
        </div>
    </div>
</div>
`;

// HTML for Quick Order Modal:
const quickOrderModalHtml = `
<!-- 1-CLICK QUICK ORDER MODAL -->
<div class="qo-modal-overlay" id="qoModal" onclick="if(event.target===this) closeQuickOrder()">
    <div class="qo-modal-box">
        <button class="qo-close-btn" onclick="closeQuickOrder()" aria-label="إغلاق">&times;</button>
        <div class="qo-header">
            <span class="qo-badge"><i class="fas fa-bolt"></i> طلب فوري خلال دقيقة</span>
            <h3 class="qo-title">إتمام الطلب السريع</h3>
            <p class="qo-sub">املئي البيانات البسيطة وسيتم إرسال الطلب فوراً</p>
        </div>
        
        <div class="qo-item-card">
            <img id="qoImg" src="images/hero-products-mobile.webp" alt="المنتج" class="qo-item-img">
            <div class="qo-item-info">
                <div class="qo-item-name" id="qoName">روتين التفتيح والنضارة الكامل</div>
                <div class="qo-item-price"><span id="qoPrice">777</span> جنيه <span class="qo-shipping-tag">· شحن مجاني 🎁</span></div>
            </div>
        </div>

        <form id="qoForm" onsubmit="submitQuickOrder(event)">
            <input type="hidden" id="qoItemType" value="">
            <input type="hidden" id="qoItemId" value="">
            
            <div class="qo-form-group">
                <label>الاسم بالكامل *</label>
                <input type="text" id="qoCustomerName" class="qo-form-input" placeholder="اكتبي اسمك ثلاثي" required>
            </div>

            <div class="qo-form-group">
                <label>رقم الموبايل (واتساب) *</label>
                <input type="tel" id="qoPhone" class="qo-form-input" placeholder="010XXXXXXXX أو 012/011/015" pattern="^01[0125][0-9]{8}$" required>
            </div>

            <div class="qo-form-group">
                <label>المحافظة *</label>
                <select id="qoGovernorate" class="qo-form-select" required>
                    <option value="">اختاري المحافظة</option>
                    <option value="Cairo">القاهرة</option>
                    <option value="Giza">الجيزة</option>
                    <option value="Alexandria">الإسكندرية</option>
                    <option value="Qalyubia">القليوبية</option>
                    <option value="Sharqia">الشرقية</option>
                    <option value="Dakahlia">الدقهلية (المنصورة)</option>
                    <option value="Gharbia">الغربية (طنطا)</option>
                    <option value="Monufia">المنوفية</option>
                    <option value="Beheira">البحيرة</option>
                    <option value="Kafr El Sheikh">كفر الشيخ</option>
                    <option value="Damietta">دمياط</option>
                    <option value="Port Said">بورسعيد</option>
                    <option value="Ismailia">الإسماعيلية</option>
                    <option value="Suez">السويس</option>
                    <option value="Fayoum">الفيوم</option>
                    <option value="Beni Suef">بني سويف</option>
                    <option value="Minya">المنيا</option>
                    <option value="Asyut">أسيوط</option>
                    <option value="Sohag">سوهاج</option>
                    <option value="Qena">قنا</option>
                    <option value="Luxor">الأقصر</option>
                    <option value="Aswan">أسوان</option>
                </select>
            </div>

            <div class="qo-form-group">
                <label>العنوان بالتفصيل (المنطقة، الشارع، رقم العمارة) *</label>
                <input type="text" id="qoAddress" class="qo-form-input" placeholder="مثال: المعادي، شارع 9، عمارة 12، الدور 3" required>
            </div>

            <div class="qo-trust-box">
                🛡️ <strong>الدفع كاش عند الاستلام بعد فحص ومعاينة الشحنة</strong><br>
                ستقوم خدمة العملاء بالتواصل معكِ هاتفياً لتأكيد موعد الشحن.
            </div>

            <button type="submit" class="qo-submit-btn" id="qoSubmitBtn">
                <i class="fas fa-check-circle"></i> تأكيد الطلب الآن
            </button>
        </form>
    </div>
</div>
`;

// JS logic for Shipping Bar & Quick Order:
const featuresJs = `
function updateShippingBar() {
    if (!window.Cart) return;
    const items = window.Cart.get() || [];
    const count = items.reduce((sum, i) => sum + (i.quantity || i.qty || 1), 0);
    const hasBundle = items.some(i => i.bundleSlug || (i.name && i.name.includes('روتين')));

    const msg = document.getElementById('shippingMsgText');
    const fill = document.getElementById('shippingFill');
    if (!msg || !fill) return;

    if (count === 0) {
        msg.innerHTML = '🚚 شحن مجاني لجميع محافظات مصر عند اختيار أي روتين أو 3 منتجات';
        fill.style.width = '0%';
        fill.classList.remove('unlocked');
    } else if (hasBundle || count >= 3) {
        msg.innerHTML = '🎉 مبروك! طلبك مؤهل لـ <strong>شحن مجاني هدية</strong> لجميع المحافظات!';
        fill.style.width = '100%';
        fill.classList.add('unlocked');
    } else if (count === 2) {
        msg.innerHTML = 'باقيلك <strong>منتج واحد فقط</strong> وتستمتعي بـ <strong>شحن مجاني فوري</strong> 🎁';
        fill.style.width = '66%';
        fill.classList.remove('unlocked');
    } else if (count === 1) {
        msg.innerHTML = 'باقيلك <strong>منتجين</strong> للحصول على <strong>شحن مجاني هدية</strong> 🚚';
        fill.style.width = '33%';
        fill.classList.remove('unlocked');
    }
}

function openQuickOrder(name, price, img, type, id) {
    document.getElementById('qoName').textContent = name;
    document.getElementById('qoPrice').textContent = price;
    document.getElementById('qoImg').src = img || 'images/hero-products-mobile.webp';
    document.getElementById('qoItemType').value = type || 'product';
    document.getElementById('qoItemId').value = id || '1';
    document.getElementById('qoModal').classList.add('active');
    document.body.style.overflow = 'hidden';
}

function closeQuickOrder() {
    document.getElementById('qoModal').classList.remove('active');
    document.body.style.overflow = '';
}

async function submitQuickOrder(e) {
    e.preventDefault();
    const btn = document.getElementById('qoSubmitBtn');
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جاري تسجيل طلبك...';

    const name = document.getElementById('qoCustomerName').value.trim();
    const phone = document.getElementById('qoPhone').value.trim();
    const gov = document.getElementById('qoGovernorate').value;
    const addr = document.getElementById('qoAddress').value.trim();
    const itemName = document.getElementById('qoName').textContent;
    const itemPrice = parseFloat(document.getElementById('qoPrice').textContent) || 0;
    const itemType = document.getElementById('qoItemType').value;
    const itemId = parseInt(document.getElementById('qoItemId').value) || 1;

    // Put item in cart so existing checkout/confirmation flow works flawlessly
    if (window.Cart) {
        window.Cart.clear?.();
        if (itemType === 'brightening') {
            window.Cart.add({ id: 3, name: 'غسول التفتيح (ضمن الروتين)', price: 275, image: 'images/p3-premium.webp' }, 1, { skipMeta: true });
            window.Cart.add({ id: 2, name: 'كريم التفتيح (ضمن الروتين)', price: 228, image: 'images/p2-premium.webp' }, 1, { skipMeta: true });
            window.Cart.add({ id: 4, name: 'لوشن الجسم (ضمن الروتين)', price: 274, image: 'images/p4-premium.webp' }, 1, { skipMeta: true });
        } else if (itemType === 'post-laser') {
            window.Cart.add({ id: 5, name: 'كريم ما بعد الليزر (ضمن الروتين)', price: 345, image: 'images/p5-premium.webp' }, 1, { skipMeta: true });
            window.Cart.add({ id: 2, name: 'كريم التفتيح (ضمن الروتين)', price: 273, image: 'images/p2-premium.webp' }, 1, { skipMeta: true });
        } else if (itemType === 'face-body') {
            window.Cart.add({ id: 1, name: 'غسول حب الشباب (ضمن الروتين)', price: 299, image: 'images/p1-premium.webp' }, 1, { skipMeta: true });
            window.Cart.add({ id: 4, name: 'لوشن اليدين والجسم (ضمن الروتين)', price: 259, image: 'images/p4-premium.webp' }, 1, { skipMeta: true });
        } else {
            window.Cart.add({ id: itemId, name: itemName, price: itemPrice, image: document.getElementById('qoImg').src }, 1);
        }
    }

    // Save customer details in sessionStorage for checkout
    try {
        sessionStorage.setItem('qo_prefill', JSON.stringify({ name, phone, gov, addr }));
    } catch (_) {}

    // Redirect to checkout to complete in 1-click
    window.location.href = 'checkout.html?quick=1';
}

// Hook into cart updates
const origUpdateBadges = window.updateBadges || function(){};
window.updateBadges = function() {
    origUpdateBadges();
    updateShippingBar();
};

document.addEventListener('DOMContentLoaded', () => {
    updateShippingBar();
});
`;

// Helper to inject into a file
function injectFeatures(file) {
    let content = fs.readFileSync(file, 'utf8');

    // 1. Inject CSS before </style>
    if (!content.includes('qo-modal-overlay')) {
        content = content.replace('</style>', featuresCss + '\n    </style>');
    }

    // 2. Inject Shipping Bar right after <header class="lux-header">... </header>
    if (!content.includes('lux-shipping-bar-wrap')) {
        content = content.replace('</header>', '</header>\n' + shippingBarHtml);
    }

    // 3. Inject Quick Order Modal before </body>
    if (!content.includes('qo-modal-overlay')) {
        content = content.replace('</body>', quickOrderModalHtml + '\n</body>');
    }

    // 4. Inject JS logic before </script>\n\n</body>
    if (!content.includes('updateShippingBar')) {
        content = content.replace('updateBadges();\n});', 'updateBadges();\n});\n' + featuresJs);
    }

    fs.writeFileSync(file, content, 'utf8');
    console.log(file + ' updated with Shipping Bar & Quick Order Modal!');
}

injectFeatures('index.html');
injectFeatures('category.html');
