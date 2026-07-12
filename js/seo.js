/**
 * Montana SEO — meta tags, hreflang, Open Graph, JSON-LD.
 * Include on every public page: <script src="js/seo.js" defer></script>
 * Optional: window.MONTANA_SEO = { page: 'home' } before load.
 */
(function () {
  var SITE = 'https://www.montana.com.eg';
  var DEFAULT_IMAGE = SITE + '/images/logo.png';

  var PAGES = {
    home: {
      ar: {
        title: 'Montana | غسول حب الشباب وكريم تفتيح — عناية بالبشرة مصر',
        description: 'Montana مصر — غسول حب الشباب، كريم تفتيح البشرة، وعناية ما بعد الليزر. منتجات طبيعية فاخرة مع شحن سريع.',
        path: '/',
      },
      en: {
        title: 'Montana | Acne Cleanser & Brightening Cream — Skincare Egypt',
        description: 'Montana Egypt — acne facial cleanser, brightening cream, post-laser recovery. Premium natural skincare with nationwide shipping.',
        path: '/en/',
      },
    },
    shop: {
      ar: { title: 'Montana | المتجر — غسول وكريمات عناية بالبشرة', description: 'تسوق Montana — غسول حب الشباب، كريم تفتيح، ومنتجات عناية بالبشرة. شحن لكل مصر.', path: '/category.html' },
      en: { title: 'Montana | Shop Skincare', description: 'Shop Montana skincare — cleansers, creams, and targeted treatment sets.', path: '/en/category.html' },
    },
    about: {
      ar: { title: 'Montana | من نحن', description: 'تعرف على Montana — علامة مصرية للعناية بالبشرة بمكونات طبيعية فاخرة.', path: '/about.html' },
      en: { title: 'Montana | About Montana', description: 'Discover Montana — Egyptian luxury skincare with premium natural ingredients.', path: '/en/about.html' },
    },
    contact: {
      ar: { title: 'Montana | تواصل معنا', description: 'تواصل مع فريق Montana — دعم العملاء، استفسارات المنتجات، والطلبات.', path: '/contact.html' },
      en: { title: 'Montana | Contact Us', description: 'Contact Montana — customer support, product questions, and order help.', path: '/en/contact.html' },
    },
    faq: {
      ar: { title: 'Montana | الأسئلة الشائعة', description: 'إجابات عن الشحن، الدفع، الاستخدام، والإرجاع — Montana Egypt.', path: '/faq.html' },
      en: { title: 'Montana | FAQ', description: 'Shipping, payment, usage, and returns — Montana Egypt FAQ.', path: '/en/faq.html' },
    },
    product: {
      ar: { title: 'Montana | تفاصيل المنتج', description: 'تفاصيل منتج Montana — المكونات، الاستخدام، والأسعار.', path: '/product.html' },
      en: { title: 'Montana | Product Details', description: 'Montana product details — ingredients, usage, and pricing.', path: '/en/product.html' },
    },
  };

  function isEn() {
    return document.documentElement.lang === 'en' || /\/en(\/|$)/.test(location.pathname);
  }

  function locale() {
    return isEn() ? 'en' : 'ar';
  }

  function upsertMeta(attr, key, content) {
    if (!content) return;
    var sel = attr === 'name' ? 'meta[name="' + key + '"]' : 'meta[property="' + key + '"]';
    var el = document.querySelector(sel);
    if (!el) {
      el = document.createElement('meta');
      if (attr === 'name') el.setAttribute('name', key);
      else el.setAttribute('property', key);
      document.head.appendChild(el);
    }
    el.setAttribute('content', content);
  }

  function upsertLink(rel, href, extra) {
    if (!href) return;
    var sel = 'link[rel="' + rel + '"]' + (extra ? '[' + extra.attr + '="' + extra.val + '"]' : '');
    var el = document.querySelector(sel);
    if (!el) {
      el = document.createElement('link');
      el.setAttribute('rel', rel);
      if (extra) el.setAttribute(extra.attr, extra.val);
      document.head.appendChild(el);
    }
    el.setAttribute('href', href);
  }

  function injectJsonLd(data) {
    var id = 'montana-jsonld';
    var old = document.getElementById(id);
    if (old) old.remove();
    var s = document.createElement('script');
    s.type = 'application/ld+json';
    s.id = id;
    s.textContent = JSON.stringify(data);
    document.head.appendChild(s);
  }

  function detectPage() {
    var file = location.pathname.split('/').filter(Boolean).pop() || 'index.html';
    if (/\/product\//.test(location.pathname)) return 'product';
    if (file === 'index.html' || file === '') return 'home';
    if (file === 'category.html') return 'shop';
    if (file === 'product.html') return 'product';
    if (file === 'about.html') return 'about';
    if (file === 'contact.html') return 'contact';
    if (file === 'faq.html') return 'faq';
    return 'home';
  }

  function currentPath() {
    var p = location.pathname.replace(/\\/g, '/');
    if (p.endsWith('/index.html')) p = p.replace(/index\.html$/, '');
    if (p.endsWith('/') && p !== '/') p = p.slice(0, -1);
    return p || '/';
  }

  function alternatePath(loc) {
    var p = currentPath();
    var q = location.search || '';
    if (loc === 'en') {
      if (p === '/' || p === '') return '/en/' + q;
      if (p.startsWith('/en')) return p + q;
      var file = p.split('/').filter(Boolean).pop() || 'index.html';
      return '/en/' + file + q;
    }
    if (p.startsWith('/en/')) return '/' + p.slice(4) + q;
    if (p === '/en') return '/' + q;
    return p + q;
  }

  function setPageMeta(opts) {
    opts = opts || {};
    var loc = opts.locale || locale();
    var pageKey = opts.page || (window.MONTANA_SEO && window.MONTANA_SEO.page) || 'home';
    var base = (PAGES[pageKey] && PAGES[pageKey][loc]) || PAGES.home[loc];
    var title = opts.title || base.title;
    var description = opts.description || base.description;
    var canonical = opts.canonical || (SITE + (opts.path || base.path || currentPath()) + (location.search || ''));
    var image = opts.image || DEFAULT_IMAGE;
    var ogLocale = loc === 'en' ? 'en_EG' : 'ar_EG';

    document.title = title;
    upsertMeta('name', 'description', description);
    upsertLink('canonical', canonical);
    upsertMeta('property', 'og:type', opts.type || 'website');
    upsertMeta('property', 'og:site_name', 'Montana');
    upsertMeta('property', 'og:title', title);
    upsertMeta('property', 'og:description', description);
    upsertMeta('property', 'og:url', canonical);
    upsertMeta('property', 'og:image', image.startsWith('http') ? image : SITE + '/' + image.replace(/^\.\.\//, '').replace(/^\//, ''));
    upsertMeta('property', 'og:locale', ogLocale);
    upsertMeta('name', 'twitter:card', 'summary_large_image');
    upsertMeta('name', 'twitter:title', title);
    upsertMeta('name', 'twitter:description', description);
    upsertMeta('name', 'twitter:image', image.startsWith('http') ? image : SITE + '/' + image.replace(/^\.\.\//, '').replace(/^\//, ''));

    upsertLink('alternate', SITE + alternatePath('ar'), { attr: 'hreflang', val: 'ar' });
    upsertLink('alternate', SITE + alternatePath('en'), { attr: 'hreflang', val: 'en' });
    upsertLink('alternate', SITE + alternatePath('ar'), { attr: 'hreflang', val: 'x-default' });

    if (opts.noindex) {
      upsertMeta('name', 'robots', 'noindex, nofollow');
    }

    if (opts.schema) injectJsonLd(opts.schema);
  }

  function setProductMeta(product) {
    if (!product) return;
    var loc = locale();
    var name = product.name + (product.size ? ' - ' + product.size : '');
    var desc = (product.description || '').slice(0, 155);
    var path = (loc === 'en' ? '/en/product/' : '/product/') + encodeURIComponent(product.slug || '');
    var img = product.image_url || DEFAULT_IMAGE;
    if (img && !/^https?:\/\//.test(img)) img = SITE + '/' + img.replace(/^\.\.\//, '');

    setPageMeta({
      page: 'product',
      locale: loc,
      title: name + ' | Montana',
      description: desc || (loc === 'en' ? 'Shop ' + name + ' at Montana Egypt.' : 'اشتري ' + name + ' من Montana مصر.'),
      path: path,
      image: img,
      type: 'product',
      schema: {
        '@context': 'https://schema.org',
        '@type': 'Product',
        name: name,
        description: product.description || desc,
        image: img,
        brand: { '@type': 'Brand', name: 'Montana' },
        offers: {
          '@type': 'Offer',
          priceCurrency: 'EGP',
          price: String(Math.round(Number(product.price) || 0)),
          availability: (product.stock > 0 ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock'),
          url: SITE + path,
        },
        aggregateRating: product.review_count > 0 ? {
          '@type': 'AggregateRating',
          ratingValue: String(product.rating || 5),
          reviewCount: String(product.review_count || 0),
        } : undefined,
      },
    });
  }

  function setOrganizationSchema() {
    injectJsonLd({
      '@context': 'https://schema.org',
      '@graph': [
        {
          '@type': 'Organization',
          name: 'Montana',
          url: SITE,
          logo: DEFAULT_IMAGE,
          sameAs: [],
        },
        {
          '@type': 'WebSite',
          name: 'Montana Skincare',
          url: SITE,
          potentialAction: {
            '@type': 'SearchAction',
            target: SITE + '/search.html?q={search_term_string}',
            'query-input': 'required name=search_term_string',
          },
        },
      ],
    });
  }

  window.MontanaSEO = {
    setPageMeta: setPageMeta,
    setProductMeta: setProductMeta,
    setOrganizationSchema: setOrganizationSchema,
    SITE: SITE,
  };

  var NOINDEX_PAGES = {
    'checkout.html': true,
    'account.html': true,
    'login.html': true,
    'order-confirmation.html': true,
    'admin.html': true,
    'admin-login.html': true,
    'owner.html': true,
    'owner-login.html': true,
    'invoice.html': true,
  };

  document.addEventListener('DOMContentLoaded', function () {
    var cfg = window.MONTANA_SEO || {};
    var file = location.pathname.split('/').filter(Boolean).pop() || 'index.html';
    var page = cfg.page || detectPage();
    if (cfg.noindex || NOINDEX_PAGES[file]) {
      setPageMeta({ noindex: true, page: page });
      return;
    }
    if (page === 'product') return;
    setPageMeta({ page: page });
    if (page === 'home') setOrganizationSchema();
  });
})();
