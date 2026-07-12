// Shared website header & footer for inner pages
(function () {
  const IS_EN =
    window.MONTANA_LOCALE === 'en' ||
    document.documentElement.lang === 'en' ||
    /\/en(\/|$)/.test(location.pathname.replace(/\\/g, '/'));

  const assetP = '/';
  const page = (file) => (IS_EN ? '/en/' : '/') + String(file).replace(/^\//, '');
  const homeHref = IS_EN ? '/en/' : '/';
  const langHref = IS_EN ? '/' : '/en/';
  const langLabel = IS_EN ? 'العربية' : 'English';
  const langTitle = IS_EN ? 'Arabic' : 'English';

  const langScript = document.createElement('script');
  langScript.src = '/js/lang-switch.js?v=2';
  document.body.appendChild(langScript);

  if (!document.querySelector('script[src*="seo.js"]')) {
    const seoScript = document.createElement('script');
    seoScript.src = assetP + 'js/seo.js';
    seoScript.defer = true;
    document.head.appendChild(seoScript);
  }

  if (!document.querySelector('script[src*="analytics-config"]')) {
    const ac = document.createElement('script');
    ac.src = assetP + 'js/analytics-config.js';
    document.head.appendChild(ac);
    const an = document.createElement('script');
    an.src = assetP + 'js/analytics.js';
    an.defer = true;
    document.head.appendChild(an);
  }

  if (!document.querySelector('script[src*="perf.js"]')) {
    const perfScript = document.createElement('script');
    perfScript.src = assetP + 'js/perf.js?v=2';
    perfScript.defer = true;
    document.head.appendChild(perfScript);
  }

  const chatScript = document.createElement('script');
  chatScript.src = assetP + 'chat-widget.js?v=12';
  chatScript.defer = true;
  document.body.appendChild(chatScript);

  const isInnerPage = !document.querySelector('.hero-slider');

  const EN_DEFAULT = {
    promo: [
      '🎁 Buy 2, get the 3rd free',
      '🚚 Free shipping on orders over 500 EGP',
      '✨ Exclusive discounts for Montana Rewards members',
    ],
    header: {
      searchPlaceholder: 'Search products, brands, and more…',
      store: 'Shop',
      account: 'Account',
      cart: 'Bag',
    },
    nav: {
      home: 'Home',
      skincare: 'Skincare',
      haircare: 'Hair care',
      health: 'Health & wellness',
      kids: 'Kids',
      therm: 'Therm',
      comingSoon: 'Coming soon',
    },
    footer: {
      tagline:
        'Your destination for premium, authentic skincare in Egypt. World-class formulas at accessible prices.',
      quickLinks: 'Quick links',
      about: 'About us',
      contact: 'Contact us',
      faq: 'FAQ',
      privacy: 'Privacy policy',
      customerService: 'Customer service',
      trackOrder: 'Track order',
      returns: 'Return policy',
      shipping: 'Shipping & delivery',
      myAccount: 'My account',
      contactUs: 'Get in touch',
      hours: '9 AM – 11 PM daily',
      copyright: '© 2026 Montana. All rights reserved.',
    },
  };

  const AR_DEFAULT = {
    promo: [
      '🎁 اشتري قطعتين واحصل على الثالثة مجاناً',
      '🚚 شحن مجاني للطلبات فوق 500 جنيه',
      '✨ خصومات حصرية لأعضاء Montana Rewards',
    ],
    header: {
      searchPlaceholder: 'ابحث عن منتجات، ماركات، وأكثر...',
      store: 'المتجر',
      account: 'حسابي',
      cart: 'السلة',
    },
    nav: {
      home: 'الرئيسية',
      skincare: 'العناية بالبشرة',
      haircare: 'العناية بالشعر',
      health: 'الصحة والتغذية',
      kids: 'الأطفال',
      therm: 'الثيرم',
      comingSoon: 'قريباً',
    },
    footer: {
      tagline:
        'وجهتك الأولى لمنتجات العناية الفاخرة والأصلية في مصر. نوفر لك أفضل الماركات العالمية بأسعار منافسة.',
      quickLinks: 'روابط سريعة',
      about: 'من نحن',
      contact: 'تواصل معنا',
      faq: 'الأسئلة الشائعة',
      privacy: 'سياسة الخصوصية',
      customerService: 'خدمة العملاء',
      trackOrder: 'تتبع الطلب',
      returns: 'الإرجاع والاستبدال',
      shipping: 'الشحن والتوصيل',
      myAccount: 'حسابي',
      contactUs: 'تواصل معنا',
      hours: '9 ص - 11 م يومياً',
      copyright: '© 2026 Montana. جميع الحقوق محفوظة.',
    },
  };

  function injectLayout() {
    const base = IS_EN ? EN_DEFAULT : AR_DEFAULT;
    const U = window.MONTANA_UI;
    const H = { ...base.header, ...U?.header };
    const N = { ...base.nav, ...U?.nav };
    const F = { ...base.footer, ...U?.footer };
    const promo = U?.promo || base.promo;

    const headerHTML = `
    <div class="promo-banner">
        <div class="promo-slider">
            <span>${promo[0]}</span>
            <span>${promo[1]}</span>
            <span>${promo[2]}</span>
        </div>
    </div>
    <header class="header">
        <div class="header-main">
            <div class="container">
                <div class="header-content">
                    <div class="logo">
                        <a href="${homeHref}"><img src="${assetP}images/logo.png" alt="Montana" class="logo-img"></a>
                    </div>
                    <div class="search-bar">
                        <input type="text" placeholder="${H.searchPlaceholder}" onclick="window.location.href='${page('search.html')}'" readonly>
                        <button><i class="fas fa-search"></i></button>
                    </div>
                    <div class="header-actions">
                        <a href="${page('category.html')}" class="header-action header-store-btn">
                            <i class="fas fa-store"></i>
                            <small>${H.store}</small>
                        </a>
                        <a href="${page('account.html')}" class="header-action">
                            <i class="far fa-user"></i>
                            <small>${H.account}</small>
                        </a>
                        <a href="${page('checkout.html')}" class="header-action cart-icon">
                            <i class="fas fa-shopping-bag"></i>
                            <span class="badge cart-badge" style="display:none">0</span>
                            <small>${H.cart}</small>
                        </a>
                        <a href="${langHref}" class="header-action lang-switch-action" data-locale-toggle="1" title="${langTitle}">
                            <i class="fas fa-globe"></i>
                            <small>${langLabel}</small>
                        </a>
                    </div>
                </div>
            </div>
        </div>
        <nav class="main-nav">
            <div class="container">
                <ul class="nav-links">
                    <li class="nav-item"><a href="${homeHref}"><i class="fas fa-home"></i> ${N.home}</a></li>
                    <li class="nav-item"><a href="${page('category.html')}"><i class="fas fa-spa"></i> ${N.skincare}</a></li>
                    <li class="nav-item nav-soon"><a href="javascript:void(0)" title="${N.comingSoon}"><i class="fas fa-pump-soap"></i> ${N.haircare} (${N.comingSoon})</a></li>
                    <li class="nav-item nav-soon"><a href="javascript:void(0)" title="${N.comingSoon}"><i class="fas fa-heartbeat"></i> ${N.health} (${N.comingSoon})</a></li>
                    <li class="nav-item nav-soon"><a href="javascript:void(0)" title="${N.comingSoon}"><i class="fas fa-baby"></i> ${N.kids} (${N.comingSoon})</a></li>
                    <li class="nav-item nav-soon"><a href="javascript:void(0)" title="${N.comingSoon}"><i class="fas fa-temperature-low"></i> ${N.therm} (${N.comingSoon})</a></li>
                </ul>
            </div>
        </nav>
    </header>`;

    const footerHTML = `
    <footer class="footer">
        <div class="container">
            <div class="footer-grid">
                <div class="footer-col">
                    <div class="footer-logo">
                        <img src="${assetP}images/logo.png" alt="Montana" class="footer-logo-img">
                    </div>
                    <p>${F.tagline}</p>
                    <div class="social-links">
                        <a href="#"><i class="fab fa-facebook-f"></i></a>
                        <a href="#"><i class="fab fa-instagram"></i></a>
                        <a href="#"><i class="fab fa-tiktok"></i></a>
                        <a href="#"><i class="fab fa-whatsapp"></i></a>
                    </div>
                </div>
                <div class="footer-col">
                    <h3>${F.quickLinks}</h3>
                    <a href="${page('about.html')}">${F.about}</a>
                    <a href="${page('contact.html')}">${F.contact}</a>
                    <a href="${page('faq.html')}">${F.faq}</a>
                    <a href="${page('privacy.html')}">${F.privacy}</a>
                </div>
                <div class="footer-col">
                    <h3>${F.customerService}</h3>
                    <a href="${page('tracking.html')}">${F.trackOrder}</a>
                    <a href="${page('returns.html')}">${F.returns}</a>
                    <a href="${page('faq.html')}">${F.shipping}</a>
                    <a href="${page('account.html')}">${F.myAccount}</a>
                </div>
                <div class="footer-col">
                    <h3>${F.contactUs}</h3>
                    <div class="contact-info">
                        <p><i class="fas fa-phone"></i> 01234567890</p>
                        <p><i class="fas fa-envelope"></i> info@montana.com</p>
                        <p><i class="fas fa-map-marker-alt"></i> ${IS_EN ? 'Cairo, Egypt' : 'القاهرة، مصر'}</p>
                        <p><i class="fas fa-clock"></i> ${F.hours}</p>
                    </div>
                </div>
            </div>
            <div class="footer-bottom">
                <p>${F.copyright}</p>
            </div>
        </div>
    </footer>`;

    if (document.body.classList.contains('injected-site-chrome')) return;

    if (window.innerWidth > 768) {
      const pageHeader = document.querySelector('.page-header');
      if (pageHeader) {
        pageHeader.insertAdjacentHTML('beforebegin', headerHTML);
        pageHeader.style.display = 'none';
      }
      document.body.insertAdjacentHTML('beforeend', footerHTML);
      document.body.classList.add('injected-site-chrome');
    }

    if (window.innerWidth > 768) {
      import('/js/site-settings.js').then((m) => m.applySiteSettings()).catch(() => {});
    }
  }

  function boot() {
    if (!isInnerPage) return;
    injectLayout();
  }

  if (!isInnerPage) return;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
