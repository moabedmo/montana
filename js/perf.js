/**
 * Storefront performance helpers — noopener, lazy images, deferred scripts, locale-aware links.
 */
(function () {
  function isEnSite() {
    return (
      document.documentElement.lang === 'en' ||
      /\/en(\/|$)/.test(location.pathname.replace(/\\/g, '/'))
    );
  }

  function localePage(href) {
    const raw = String(href || '').trim();
    const qIdx = raw.indexOf('?');
    const hashIdx = raw.indexOf('#');
    let cut = raw.length;
    if (qIdx >= 0) cut = Math.min(cut, qIdx);
    if (hashIdx >= 0) cut = Math.min(cut, hashIdx);
    const file = raw.slice(0, cut).replace(/^\.\//, '').replace(/^(\.\.\/)+/, '');
    const suffix = raw.slice(cut);
    if (!file || !/^[a-z0-9_-]+\.html$/i.test(file)) return raw;
    return (isEnSite() ? '/en/' : '/') + file + suffix;
  }

  function isLocaleToggleLink(a) {
    return (
      a.classList.contains('lang-switch') ||
      a.classList.contains('lang-switch-action') ||
      a.classList.contains('floating-lang-btn') ||
      a.getAttribute('data-locale-toggle') === '1'
    );
  }

  function fixLocaleLinks(root) {
    const scope = root && root.querySelectorAll ? root : document;
    scope.querySelectorAll('a[href]').forEach((a) => {
      if (isLocaleToggleLink(a)) return;
      const href = a.getAttribute('href');
      if (!href || /^(https?:|mailto:|tel:|#|javascript:)/i.test(href)) return;
      if (href.startsWith('/product/') || href.startsWith('/en/product/')) return;
      if (isEnSite() && href.startsWith('/en/')) return;
      if (!isEnSite() && href.startsWith('/') && !href.startsWith('/en/') && /\.html/i.test(href)) return;

      if (isEnSite() && href.startsWith('/') && !href.startsWith('/en/') && /\.html/i.test(href)) {
        a.setAttribute('href', '/en' + href);
        return;
      }
      if (!isEnSite() && href.startsWith('/en/')) {
        a.setAttribute('href', href.replace(/^\/en\//, '/'));
        return;
      }
      if (/^(\.\.\/)*[a-z0-9_-]+\.html(\?|#|$)/i.test(href)) {
        a.setAttribute('href', localePage(href));
      }
    });

    scope.querySelectorAll('[onclick*="location.href"]').forEach((el) => {
      const oc = el.getAttribute('onclick') || '';
      const m = oc.match(/location\.href\s*=\s*['"]([^'"]+)['"]/);
      if (m && /\.html/i.test(m[1])) {
        el.setAttribute('onclick', oc.replace(m[1], localePage(m[1])));
      }
    });
  }

  function patchBlankLinks() {
    document.querySelectorAll('a[target="_blank"]').forEach((a) => {
      const rel = (a.getAttribute('rel') || '').split(/\s+/).filter(Boolean);
      if (!rel.includes('noopener')) rel.push('noopener');
      if (!rel.includes('noreferrer')) rel.push('noreferrer');
      a.setAttribute('rel', rel.join(' '));
    });
  }

  function lazyBelowFold() {
    const vh = window.innerHeight || 800;
    document.querySelectorAll('img:not([loading])').forEach((img) => {
      const r = img.getBoundingClientRect();
      if (r.top > vh * 1.2) img.loading = 'lazy';
    });
  }

  function loadScript(src, opts) {
    if (document.querySelector(`script[src="${src}"]`)) return;
    const s = document.createElement('script');
    s.src = src;
    if (opts?.defer) s.defer = true;
    if (opts?.async) s.async = true;
    if (opts?.type) s.type = opts.type;
    document.body.appendChild(s);
  }

  function deferNonCritical() {
    const base = document.querySelector('script[src*="components.js"]')?.src.includes('../') ? '../' : '';
    const idle = window.requestIdleCallback || ((cb) => setTimeout(cb, 1200));
    idle(() => {
      if (!document.querySelector('script[src*="chat-widget"]')) {
        loadScript(base + 'chat-widget.js?v=12', { defer: true });
      }
    });
  }

  patchBlankLinks();
  lazyBelowFold();
  fixLocaleLinks();

  if (document.body.classList.contains('mnt-home')) {
    window.addEventListener('load', deferNonCritical, { once: true });
  }

  document.addEventListener('DOMContentLoaded', () => {
    patchBlankLinks();
    fixLocaleLinks();
  });
  new MutationObserver((mutations) => {
    patchBlankLinks();
    mutations.forEach((m) => {
      m.addedNodes.forEach((node) => {
        if (node.nodeType === 1) fixLocaleLinks(node);
      });
    });
  }).observe(document.documentElement, {
    childList: true,
    subtree: true,
  });
})();
