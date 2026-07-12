/** Premium shop — card reveal + shared filter helpers */
(function () {
  if (!document.body.classList.contains('mnt-shop')) return;

  if (!window.__montanaCardObserver && 'IntersectionObserver' in window) {
    window.__montanaCardObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            window.__montanaCardObserver.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: '0px 0px -40px 0px' }
    );
  }

  window.MontanaShopFilter = {
    match(filter, product) {
      if (!filter || filter === 'all') return true;
      const hay = [
        product.slug,
        product.name,
        product.name_en,
        product.description,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      const rules = {
        cleanser: /cleanser|غسول|wash|facial wash/i,
        cream: /cream|كريم/i,
        serum: /serum|سيروم/i,
        lotion: /lotion|لوشن|body/i,
      };
      return rules[filter] ? rules[filter].test(hay) : true;
    },
  };
})();
