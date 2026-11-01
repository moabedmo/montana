const fs = require('fs');

console.log('Optimizing layout, header spacing, and section hierarchy for index.html and category.html...');

// Read template from scripts/deploy-luxury-redesign.js or construct with updated styles
let indexContent = fs.readFileSync('index.html', 'utf8');

// 1. Fix CSS for Header and Navigation to prevent any overlap
const newHeaderCss = `
      /* === LUXURY HEADER (COLLISION-FREE & PERFECTLY BALANCED) === */
      .lux-header {
        position: sticky;
        top: 0;
        z-index: 100;
        background: rgba(250, 248, 245, 0.97);
        backdrop-filter: blur(16px);
        -webkit-backdrop-filter: blur(16px);
        border-bottom: 1px solid rgba(146, 117, 164, 0.15);
        box-shadow: 0 4px 20px rgba(45, 31, 53, 0.04);
      }
      .lux-header-inner {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding-block: 12px;
        gap: 16px;
      }
      .lux-logo {
        display: flex;
        align-items: center;
        flex-shrink: 0;
        margin-left: 20px;
      }
      .lux-logo img {
        height: 38px;
        width: auto;
        display: block;
      }
      .lux-nav {
        flex: 1;
        display: flex;
        justify-content: center;
      }
      .lux-nav-links {
        display: flex;
        align-items: center;
        gap: 20px;
        list-style: none;
        margin: 0;
        padding: 0;
      }
      .lux-nav-link {
        font-weight: 700;
        font-size: 14.5px;
        color: var(--ink-secondary);
        transition: color 0.2s ease;
        white-space: nowrap;
        display: flex;
        align-items: center;
        gap: 6px;
      }
      .lux-nav-link:hover {
        color: var(--brand-purple-dark);
      }
      .lux-header-actions {
        display: flex;
        align-items: center;
        gap: 10px;
        flex-shrink: 0;
      }
      .lux-store-pill-btn {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        background: linear-gradient(135deg, #A58229 0%, #D8B559 100%);
        color: #FFFFFF !important;
        padding: 8px 18px;
        border-radius: 25px;
        font-size: 14px;
        font-weight: 800;
        box-shadow: 0 4px 12px rgba(216, 181, 89, 0.35);
        transition: all 0.2s ease;
        white-space: nowrap;
      }
      .lux-store-pill-btn:hover {
        transform: translateY(-2px);
        box-shadow: 0 6px 16px rgba(216, 181, 89, 0.45);
      }
      .lux-consult-btn {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        background: var(--brand-purple-light);
        color: var(--brand-purple-dark) !important;
        border: 1.5px solid rgba(146, 117, 164, 0.3);
        padding: 8px 14px;
        border-radius: 25px;
        font-size: 13px;
        font-weight: 700;
        transition: all 0.2s ease;
        white-space: nowrap;
      }
      .lux-consult-btn:hover {
        background: var(--brand-purple);
        color: #FFFFFF !important;
      }
      .lux-action-btn {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 40px;
        height: 40px;
        border-radius: 50%;
        background: #FFFFFF;
        color: var(--ink-primary);
        border: 1px solid rgba(146, 117, 164, 0.2);
        box-shadow: 0 2px 8px rgba(0,0,0,0.04);
        position: relative;
        cursor: pointer;
        flex-shrink: 0;
      }
      .lux-badge-count {
        position: absolute;
        top: -4px;
        right: -4px;
        background: var(--brand-purple-dark);
        color: white;
        font-size: 11px;
        font-weight: 800;
        padding: 2px 6px;
        border-radius: 12px;
        line-height: 1;
      }
`;

// Replace old header styles with newHeaderCss
indexContent = indexContent.replace(/\/\* === LUXURY HEADER === \*\/[\s\S]*?\/\* === HERO SECTION:/, newHeaderCss + '\n      /* === HERO SECTION:');

// Replace header HTML in indexContent
const newHeaderHtml = `<!-- 2. LUXURY HEADER -->
<header class="lux-header">
    <div class="container lux-header-inner">
        <!-- Logo -->
        <a href="index.html" class="lux-logo" aria-label="Montana Naturals الرئيسية">
            <img src="images/logo.png" alt="Montaña Naturals">
        </a>
        
        <!-- Navigation Menu -->
        <nav class="lux-nav">
            <ul class="lux-nav-links">
                <li><a href="#routines" class="lux-nav-link"><i class="fas fa-fire" style="color:#D8B559;"></i> عروض الروتين</a></li>
                <li><a href="#products" class="lux-nav-link"><i class="fas fa-sparkles" style="color:var(--brand-purple);"></i> منتجات المتجر</a></li>
                <li><a href="#concerns" class="lux-nav-link">دليل العناية</a></li>
                <li><a href="#proof" class="lux-nav-link">تجارب قبل وبعد</a></li>
            </ul>
        </nav>
        
        <!-- Action Buttons -->
        <div class="lux-header-actions">
            <a href="category.html" class="lux-store-pill-btn">
                <i class="fas fa-store"></i> المتجر الكامل
            </a>
            <a href="https://wa.me/201210021115?text=%D9%85%D8%B1%D8%AD%D8%A8%D8%A7%D9%8B%D8%8C%20%D8%A3%D9%88%D8%AF%20%D8%A7%D9%84%D8%A7%D8%B3%D8%AA%D9%81%D8%B3%D8%A7%D8%B1%20%D8%B9%D9%86%20%D8%B9%D8%B1%D9%88%D8%B6%20%D9%85%D9%88%D9%86%D8%AA%D8%A7%D9%86%D9%8A%D8%A7" target="_blank" rel="noopener" class="lux-consult-btn">
                <i class="fab fa-whatsapp"></i> استشارة
            </a>
            <a href="checkout.html" class="lux-action-btn" aria-label="سلة المشتريات" title="السلة">
                <i class="fas fa-shopping-bag"></i>
                <span class="lux-badge-count cart-badge" style="display:none">0</span>
            </a>
        </div>
    </div>
</header>`;

indexContent = indexContent.replace(/<!-- 2\. LUXURY HEADER -->[\s\S]*?<!-- 3\. HERO SECTION:/, newHeaderHtml + '\n\n<!-- 3. HERO SECTION:');

fs.writeFileSync('index.html', indexContent, 'utf8');
console.log('Updated index.html header layout successfully!');

// Also update category.html with the same robust header
let shopContent = fs.readFileSync('category.html', 'utf8');
shopContent = shopContent.replace(/\/\* === HEADER === \*\/[\s\S]*?\/\* === SHOP HERO BANNER === \*\//, newHeaderCss + '\n      /* === SHOP HERO BANNER === */');

const newShopHeaderHtml = `<!-- 2. HEADER -->
<header class="lux-header">
    <div class="container lux-header-inner">
        <a href="index.html" class="lux-logo" aria-label="Montana Naturals الرئيسية">
            <img src="images/logo.png" alt="Montaña Naturals">
        </a>
        <nav class="lux-nav">
            <ul class="lux-nav-links">
                <li><a href="index.html" class="lux-nav-link"><i class="fas fa-home"></i> الرئيسية</a></li>
                <li><a href="#routines" class="lux-nav-link"><i class="fas fa-fire" style="color:#D8B559;"></i> عروض الروتين</a></li>
                <li><a href="#all-products" class="lux-nav-link"><i class="fas fa-sparkles" style="color:var(--brand-purple);"></i> المنتجات الفردية</a></li>
            </ul>
        </nav>
        <div class="lux-header-actions">
            <a href="https://wa.me/201210021115?text=%D9%85%D8%B1%D8%AD%D8%A8%D8%A7%D9%8B%D8%8C%20%D8%A3%D9%88%D8%AF%20%D8%A7%D9%84%D8%A7%D8%B3%D8%AA%D9%81%D8%B3%D8%A7%D8%B1%20%D8%B9%D9%86%20%D8%B9%D8%B1%D9%88%D8%B6%20%D9%85%D9%88%D9%86%D8%AA%D8%A7%D9%86%D9%8A%D8%A7" target="_blank" rel="noopener" class="lux-consult-btn">
                <i class="fab fa-whatsapp"></i> استشارة
            </a>
            <a href="checkout.html" class="lux-action-btn" aria-label="سلة المشتريات" title="السلة">
                <i class="fas fa-shopping-bag"></i>
                <span class="lux-badge-count cart-badge" style="display:none">0</span>
            </a>
        </div>
    </div>
</header>`;

shopContent = shopContent.replace(/<!-- 2\. HEADER -->[\s\S]*?<!-- 3\. SHOP HERO -->/, newShopHeaderHtml + '\n\n<!-- 3. SHOP HERO -->');

fs.writeFileSync('category.html', shopContent, 'utf8');
console.log('Updated category.html header layout successfully!');
