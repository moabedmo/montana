/**
 * Meta Pixel loader — init only in the base snippet.
 * PageView fires from exactly ONE place: firePageView() after fbevents.js loads.
 * Do NOT put PageView in the init snippet. Do NOT use trackCustom.
 * Pixel ID comes from /api/meta-public-config (env) — never hardcoded here.
 */
(function () {
  // Build from ASCII codes so the name cannot be corrupted by encoding/editors.
  // Must be exactly: P-a-g-e-V-i-e-w (capital P, capital V).
  var PAGE_VIEW_EVENT = String.fromCharCode(80, 97, 103, 101, 86, 105, 101, 119);

  function firePageView() {
    if (window.__montanaPageViewSent) return;
    if (typeof window.fbq !== 'function') return;

    // Exact string passed to fbq — visible in DevTools console for Test Events debugging
    console.log(
      '[Montana Meta] fbq track event name =',
      JSON.stringify(PAGE_VIEW_EVENT),
      'charCodes=',
      PAGE_VIEW_EVENT.split('').map(function (c) { return c.charCodeAt(0); }),
      'len=',
      PAGE_VIEW_EVENT.length
    );

    if (PAGE_VIEW_EVENT !== 'PageView' || PAGE_VIEW_EVENT.length !== 8) {
      console.error('[Montana Meta] PageView name corrupted, aborting', PAGE_VIEW_EVENT);
      return;
    }

    window.__montanaPageViewSent = true;
    try {
      window.fbq('track', PAGE_VIEW_EVENT);
    } catch (err) {
      console.error('Meta PageView failed:', err);
      window.__montanaPageViewSent = false;
    }
  }

  function injectPixel(pixelId) {
    if (!pixelId || window.__montanaMetaPixelLoaded) return;
    window.__montanaMetaPixelLoaded = true;

    !(function (f, b, e, v, n, t, s) {
      if (f.fbq) return;
      n = f.fbq = function () {
        n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments);
      };
      if (!f._fbq) f._fbq = n;
      n.push = n;
      n.loaded = !0;
      n.version = '2.0';
      n.queue = [];
      t = b.createElement(e);
      t.async = !0;
      t.src = v;
      // Init + PageView after fbevents.js is ready (not only queued on the stub)
      t.onload = function () {
        try {
          window.fbq('init', String(pixelId));
          firePageView();
        } catch (err) {
          console.error('Meta pixel onload failed:', err);
        }
      };
      t.onerror = function () {
        console.error('Meta fbevents.js failed to load');
        window.__montanaMetaPixelLoaded = false;
      };
      s = b.getElementsByTagName(e)[0];
      s.parentNode.insertBefore(t, s);
    })(window, document, 'script', 'https://connect.facebook.net/en_US/fbevents.js');
  }

  async function boot() {
    if (window.__montanaMetaPixelBooted) return;
    window.__montanaMetaPixelBooted = true;

    let pixelId = String(window.MONTANA_FB_PIXEL_ID || '').trim();
    if (!pixelId) {
      try {
        const res = await fetch('/api/meta-public-config');
        const data = await res.json();
        pixelId = String(data?.pixelId || '').trim();
      } catch (_) {
        window.__montanaMetaPixelBooted = false;
        return;
      }
    }
    if (!pixelId) {
      window.__montanaMetaPixelBooted = false;
      return;
    }
    injectPixel(pixelId);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { boot(); }, { once: true });
  } else {
    boot();
  }
})();
