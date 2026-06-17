window.MontanaSEO = (function () {
  /* غيّري الرابط لدومين الموقع الفعلي عند النشر */
  var SITE_FALLBACK = 'https://montananaturals.com';

  function siteOrigin() {
    if (typeof location !== 'undefined' && location.origin && location.origin !== 'null') {
      return location.origin;
    }
    return SITE_FALLBACK;
  }

  function absUrl(path) {
    path = String(path || '').replace(/^\//, '');
    return siteOrigin() + '/' + path;
  }

  function setMeta(name, content, prop) {
    if (!content) return;
    var sel = prop ? 'meta[property="' + name + '"]' : 'meta[name="' + name + '"]';
    var el = document.querySelector(sel);
    if (!el) {
      el = document.createElement('meta');
      if (prop) el.setAttribute('property', name);
      else el.setAttribute('name', name);
      document.head.appendChild(el);
    }
    el.setAttribute('content', content);
  }

  function setCanonical(path) {
    var href = absUrl(path);
    var el = document.querySelector('link[rel="canonical"]');
    if (!el) {
      el = document.createElement('link');
      el.rel = 'canonical';
      document.head.appendChild(el);
    }
    el.href = href;
  }

  function injectJsonLd(data) {
    var el = document.getElementById('montana-jsonld');
    if (!el) {
      el = document.createElement('script');
      el.type = 'application/ld+json';
      el.id = 'montana-jsonld';
      document.head.appendChild(el);
    }
    el.textContent = JSON.stringify(data);
  }

  function organizationSchema() {
    return {
      '@context': 'https://schema.org',
      '@type': 'Organization',
      name: 'Montana Naturals',
      url: siteOrigin() + '/',
      logo: absUrl('assets/logo.png'),
      description: 'Premium clinical skincare — six formulas for your skin story. Cairo & Giza delivery.',
      areaServed: { '@type': 'City', name: 'Cairo' }
    };
  }

  function productSchema(p) {
    var name = MontanaShop.field(p.name);
    var desc = MontanaShop.field(p.desc);
    return {
      '@context': 'https://schema.org',
      '@type': 'Product',
      name: name,
      description: desc,
      image: absUrl(p.image),
      brand: { '@type': 'Brand', name: 'Montana Naturals' },
      offers: {
        '@type': 'Offer',
        priceCurrency: 'EGP',
        price: p.price,
        availability: 'https://schema.org/InStock',
        url: absUrl('product.html#' + p.id)
      }
    };
  }

  function itemListSchema(products) {
    return {
      '@context': 'https://schema.org',
      '@type': 'ItemList',
      name: 'Montana Naturals Collection',
      itemListElement: products.map(function (p, i) {
        return {
          '@type': 'ListItem',
          position: i + 1,
          url: absUrl('product.html#' + p.id),
          name: MontanaShop.field(p.name)
        };
      })
    };
  }

  function initPage(opts) {
    opts = opts || {};
    if (opts.title) document.title = opts.title;
    if (opts.description) setMeta('description', opts.description);
    if (opts.robots) setMeta('robots', opts.robots);
    if (opts.canonical) setCanonical(opts.canonical);
    if (opts.ogTitle) setMeta('og:title', opts.ogTitle, true);
    if (opts.ogDescription) setMeta('og:description', opts.ogDescription, true);
    if (opts.ogImage) setMeta('og:image', absUrl(opts.ogImage), true);
    if (opts.ogType) setMeta('og:type', opts.ogType, true);
    setMeta('og:url', absUrl(opts.canonical || location.pathname.split('/').pop() || 'index.html'), true);
    setMeta('og:site_name', 'Montana Naturals', true);
    setMeta('twitter:card', 'summary_large_image');
    if (opts.ogTitle) setMeta('twitter:title', opts.ogTitle);
    if (opts.ogDescription) setMeta('twitter:description', opts.ogDescription);
    if (opts.ogImage) setMeta('twitter:image', absUrl(opts.ogImage));
    if (opts.jsonLd) injectJsonLd(opts.jsonLd);
  }

  return {
    siteOrigin: siteOrigin,
    absUrl: absUrl,
    setMeta: setMeta,
    setCanonical: setCanonical,
    injectJsonLd: injectJsonLd,
    organizationSchema: organizationSchema,
    productSchema: productSchema,
    itemListSchema: itemListSchema,
    initPage: initPage
  };
})();
