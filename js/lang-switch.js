/** Always-visible language toggle (AR ↔ EN) */
(function () {
  function isEnglishSite() {
    return (
      document.documentElement.lang === 'en' ||
      /\/en(\/|$)/.test(location.pathname.replace(/\\/g, '/'))
    );
  }

  function switchHref() {
    const path = location.pathname.replace(/\\/g, '/');
    const search = location.search || '';
    const hash = location.hash || '';
    const segments = path.split('/').filter(Boolean);
    const file = segments[segments.length - 1] || 'index.html';
    const pageName = file.endsWith('.html') ? file : 'index.html';

    if (isEnglishSite()) {
      if (pageName === 'index.html' || path.endsWith('/en') || path.endsWith('/en/')) {
        return '/' + search + hash;
      }
      return '/' + pageName + search + hash;
    }

    if (pageName === 'index.html' || path === '/' || path.endsWith('/')) {
      return '/en/' + search + hash;
    }
    return '/en/' + pageName + search + hash;
  }

  function applyLangToggleLinks() {
    const en = isEnglishSite();
    const href = switchHref();
    const aria = en ? 'Switch to Arabic' : 'Switch to English';

    document.querySelectorAll('.lang-switch, .lang-switch-action').forEach((a) => {
      a.setAttribute('data-locale-toggle', '1');
      a.setAttribute('href', href);
    });

    let floater = document.querySelector('.floating-lang-btn');
    if (!floater) {
      floater = document.createElement('a');
      floater.className = 'floating-lang-btn';
      floater.innerHTML = en
        ? '<i class="fas fa-globe"></i> <span>AR</span>'
        : '<i class="fas fa-globe"></i> <span>EN</span>';
      document.body.appendChild(floater);
    }
    floater.setAttribute('data-locale-toggle', '1');
    floater.setAttribute('href', href);
    floater.setAttribute('aria-label', aria);
  }

  function boot() {
    applyLangToggleLinks();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
  window.addEventListener('load', boot);
})();
