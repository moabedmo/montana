/**
 * Meta Pixel + CAPI dual-send helper.
 * Same eventId goes to fbq and /api/meta-capi for deduplication.
 * PageView lives ONLY in js/meta-pixel.js — never here.
 *
 * Standard events MUST use fbq('track', ...) with exact Meta names.
 * Never use fbq('trackCustom', ...) for these five.
 */
(function () {
  // Canonical Meta standard event names (case-sensitive, no whitespace).
  var STANDARD = {
    PageView: 'PageView',
    ViewContent: 'ViewContent',
    AddToCart: 'AddToCart',
    InitiateCheckout: 'InitiateCheckout',
    Purchase: 'Purchase',
  };

  function canonicalizeEventName(name) {
    var raw = String(name == null ? '' : name).trim();
    if (!raw) return null;
    if (Object.prototype.hasOwnProperty.call(STANDARD, raw)) return STANDARD[raw];
    // Reject wrong casing / aliases — do NOT send as custom
    var lower = raw.toLowerCase();
    var map = {
      pageview: STANDARD.PageView,
      viewcontent: STANDARD.ViewContent,
      addtocart: STANDARD.AddToCart,
      initiatecheckout: STANDARD.InitiateCheckout,
      purchase: STANDARD.Purchase,
    };
    if (map[lower]) return map[lower];
    console.error('Meta: refusing non-standard event name:', JSON.stringify(name));
    return null;
  }

  function newEventId() {
    return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
  }

  function getCookie(name) {
    if (typeof document === 'undefined') return null;
    const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
    if (match) return match[2];
    if (name === '_fbc') {
      try {
        const params = new URLSearchParams(window.location.search);
        const fbclid = params.get('fbclid');
        if (fbclid) return `fb.1.${Date.now()}.${fbclid}`;
      } catch (_) {}
    }
    return null;
  }

  function getVisitorId() {
    try {
      let vid = localStorage.getItem('montana_vid');
      if (!vid) {
        vid = 'mvid_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 9);
        localStorage.setItem('montana_vid', vid);
      }
      return vid;
    } catch (_) {
      return null;
    }
  }

  async function hashSubtle(str) {
    if (str == null) return null;
    var val = String(str).trim().toLowerCase();
    if (!val) return null;
    try {
      if (typeof window !== 'undefined' && window.crypto && window.crypto.subtle) {
        var msgBuffer = new TextEncoder().encode(val);
        var hashBuffer = await window.crypto.subtle.digest('SHA-256', msgBuffer);
        var hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(function (b) { return b.toString(16).padStart(2, '0'); }).join('');
      }
    } catch (_) {}
    return null;
  }

  function normalizePhoneE164(phone) {
    if (!phone) return '';
    var p = String(phone).replace(/\D/g, '');
    if (p.indexOf('00') === 0) p = p.slice(2);
    if (p.indexOf('0') === 0) p = '20' + p.slice(1);
    if (p.indexOf('20') !== 0) p = '20' + p;
    return p;
  }

  /**
   * Persists SHA-256 hashed customer identifiers into localStorage for returning visitors.
   * Phone normalized to E.164 digits without "+" (01xxxxxxxxx → 201xxxxxxxxx) → mt_ph.
   * First name, city, country "eg" trimmed, lowercased, then SHA-256 hashed.
   * Never stores raw values. Wrapped in try/catch.
   */
  async function persistCustomerIdentifiers(info) {
    if (!info || typeof info !== 'object') return;
    try {
      // 1) Phone
      var p = info.phone || info.customer_phone;
      if (p) {
        var cleanPhone = normalizePhoneE164(p);
        if (cleanPhone) {
          var hashedPhone = await hashSubtle(cleanPhone);
          if (hashedPhone) {
            try { localStorage.setItem('mt_ph', hashedPhone); } catch (_) {}
          }
        }
      }

      // 2) First name
      var fn = info.firstName || (info.name || info.customer_name ? splitName(info.name || info.customer_name).firstName : '');
      if (fn) {
        var hashedFn = await hashSubtle(fn);
        if (hashedFn) {
          try { localStorage.setItem('mt_fn', hashedFn); } catch (_) {}
        }
      }

      // 3) City
      var ct = info.city || info.governorate;
      if (ct) {
        var hashedCt = await hashSubtle(ct);
        if (hashedCt) {
          try { localStorage.setItem('mt_ct', hashedCt); } catch (_) {}
        }
      }

      // 4) Country "eg"
      var hashedCountry = await hashSubtle('eg');
      if (hashedCountry) {
        try { localStorage.setItem('mt_country', hashedCountry); } catch (_) {}
      }

      // Sync pixel init with new identifiers
      syncFbqInit();
    } catch (_) {
      // safe fallback
    }
  }

  /**
   * Reads persisted SHA-256 customer identifiers from localStorage.
   */
  function getPersistedUserData() {
    var data = {};
    try {
      var ph = localStorage.getItem('mt_ph');
      if (ph) data.ph = ph;
      var fn = localStorage.getItem('mt_fn');
      if (fn) data.fn = fn;
      var ct = localStorage.getItem('mt_ct');
      if (ct) data.ct = ct;
      var country = localStorage.getItem('mt_country');
      if (country) data.country = country;
      var vid = getVisitorId();
      if (vid) data.external_id = vid;
    } catch (_) {}
    return data;
  }

  /**
   * Passes pre-hashed customer identifiers to fbq('init', pixelId, userData).
   * Already-hashed values (64 hex chars) are accepted by Meta Advanced Matching.
   */
  function syncFbqInit() {
    try {
      if (typeof window === 'undefined' || typeof window.fbq !== 'function') return;
      var pixelId = window.MONTANA_FB_PIXEL_ID;
      if (!pixelId) {
        try {
          var state = window.fbq.getState && window.fbq.getState();
          pixelId = state && state.pixels && state.pixels[0] && state.pixels[0].id;
        } catch (_) {}
      }
      if (pixelId) {
        var ud = getPersistedUserData();
        if (ud && Object.keys(ud).length > 0) {
          window.fbq('init', String(pixelId), ud);
        }
      }
    } catch (_) {}
  }

  function getStoredUserData() {
    // Start with persisted pre-hashed values (mt_ph, mt_fn, mt_ct, mt_country, external_id)
    const data = Object.assign({}, getPersistedUserData());

    try {
      const storedPhone = localStorage.getItem('montana_last_phone') || sessionStorage.getItem('montana_last_phone');
      if (storedPhone && !data.phone && !data.ph) data.phone = storedPhone;
      const storedEmail = localStorage.getItem('montana_last_email') || sessionStorage.getItem('montana_last_email');
      if (storedEmail) data.email = storedEmail;

      const rawProfile = localStorage.getItem('montana_customer_profile');
      if (rawProfile) {
        const prof = JSON.parse(rawProfile);
        if (prof.phone && !data.phone && !data.ph) data.phone = prof.phone;
        if (prof.email && !data.email) data.email = prof.email;
        if (prof.name) {
          const names = splitName(prof.name);
          if (names.firstName && !data.firstName && !data.fn) data.firstName = names.firstName;
          if (names.lastName && !data.lastName) data.lastName = names.lastName;
        }
        if ((prof.governorate || prof.city) && !data.city && !data.ct) {
          data.city = prof.governorate || prof.city;
        }
      }
    } catch (_) {}

    const vid = getVisitorId();
    if (vid) {
      data.externalId = vid;
      data.external_id = vid;
    }
    return data;
  }

  function onceGuard(key) {
    try {
      if (sessionStorage.getItem(key) || localStorage.getItem(key)) return false;
      sessionStorage.setItem(key, '1');
      localStorage.setItem(key, '1');
      return true;
    } catch (_) {
      if (window.__montanaMetaOnce && window.__montanaMetaOnce[key]) return false;
      window.__montanaMetaOnce = window.__montanaMetaOnce || {};
      window.__montanaMetaOnce[key] = true;
      return true;
    }
  }

  async function trackEvent(eventName, customData, userData, customEventId) {
    const canonical = canonicalizeEventName(eventName);
    if (!canonical) return null;

    const eventId = customEventId || newEventId();
    customData = customData || {};
    const mergedUserData = Object.assign({}, getStoredUserData(), userData || {});

    // Ensure browser pixel has customer identifiers synced
    syncFbqInit();

    // Standard event only — never trackCustom
    try {
      if (typeof window !== 'undefined' && typeof window.fbq === 'function') {
        window.fbq('track', canonical, customData, { eventID: eventId });
      }
    } catch (err) {
      console.error('Meta Pixel track failed:', err);
    }

    try {
      await fetch('/api/meta-capi', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventName: canonical,
          eventId,
          eventSourceUrl: typeof window !== 'undefined' ? window.location.href : '',
          customData,
          userData: mergedUserData,
          fbp: getCookie('_fbp'),
          fbc: getCookie('_fbc'),
        }),
      });
    } catch (err) {
      console.error('Meta CAPI send failed:', err);
    }

    return eventId;
  }

  function splitName(fullName) {
    const parts = String(fullName || '').trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return { firstName: undefined, lastName: undefined };
    if (parts.length === 1) return { firstName: parts[0], lastName: undefined };
    return { firstName: parts[0], lastName: parts.slice(1).join(' ') };
  }

  function trackViewContent(customData) {
    const id = customData && customData.content_ids && customData.content_ids[0];
    if (!id) {
      console.error('Meta ViewContent skipped: missing content_ids');
      return Promise.resolve(null);
    }
    // Clear legacy session guards from earlier builds that blocked ViewContent
    try {
      Object.keys(sessionStorage).forEach((k) => {
        if (k.indexOf('meta_vc_') === 0) sessionStorage.removeItem(k);
      });
    } catch (_) { /* ignore */ }

    const memKey = 'vc_' + String(id);
    window.__montanaMetaOnce = window.__montanaMetaOnce || {};
    if (window.__montanaMetaOnce[memKey]) return Promise.resolve(null);
    window.__montanaMetaOnce[memKey] = true;
    return trackEvent(STANDARD.ViewContent, customData);
  }

  function trackInitiateCheckout(customData, userData) {
    let eid = null;
    try {
      eid = sessionStorage.getItem('meta_initiate_checkout_eid');
      if (!eid) {
        eid = newEventId();
        sessionStorage.setItem('meta_initiate_checkout_eid', eid);
      }
    } catch (_) {
      eid = newEventId();
    }
    return trackEvent(STANDARD.InitiateCheckout, customData || {}, userData, eid);
  }

  function enrichCheckoutUserData(userData) {
    if (!userData || typeof userData !== 'object') return Promise.resolve(null);
    try {
      if (userData.phone) {
        localStorage.setItem('montana_last_phone', userData.phone);
        sessionStorage.setItem('montana_last_phone', userData.phone);
      }
      if (userData.email) {
        localStorage.setItem('montana_last_email', userData.email);
        sessionStorage.setItem('montana_last_email', userData.email);
      }
    } catch (_) {}

    persistCustomerIdentifiers(userData);

    let eid = null;
    try { eid = sessionStorage.getItem('meta_initiate_checkout_eid'); } catch (_) {}
    return trackEvent(STANDARD.InitiateCheckout, {}, userData, eid || undefined);
  }

  async function trackPurchaseOnce(order, items) {
    if (!order) return null;
    const orderId = order.id || order.order_id || (order.order_number && String(order.order_number).replace(/\D/g, ''));
    if (!orderId) {
      console.error('Meta Purchase skipped: missing order.id');
      return null;
    }
    if (!onceGuard(`meta_purchase_${orderId}`)) return null;

    // Skip test orders if no test event code is configured to prevent polluting real metrics
    const isTest =
      /test|تجريب|capi/i.test(order.notes || '') ||
      /test|تجريب|capi/i.test(order.customer_name || order.name || '') ||
      (order.customer_phone && /01012345678|01000000000/.test(String(order.customer_phone).replace(/\D/g, '')));
    if (isTest && !window.FB_TEST_EVENT_CODE) {
      console.log('Meta Purchase skipped on browser: test order without FB_TEST_EVENT_CODE');
      return null;
    }

    const lineItems = Array.isArray(items) ? items : (order.items || []);
    const contentIds = lineItems
      .map((i) => i.product_slug || i.slug || i.product_id || i.id)
      .filter((id) => id != null && id !== '')
      .map(String);
    const names = splitName(order.customer_name || order.name || '');
    const phone = order.customer_phone || order.phone || '';
    const city = order.city || order.governorate || '';

    // Calculate real dynamic total
    var rawTotal = order.total != null ? order.total : (order.total_amount != null ? order.total_amount : order.amount);
    var totalVal = Number(rawTotal);
    if (!totalVal || isNaN(totalVal) || totalVal <= 0) {
      totalVal = lineItems.reduce(function (acc, it) {
        return acc + (Number(it.price || it.unit_price || 0) * (Number(it.qty || it.quantity || 1)));
      }, 0);
      if (order.shipping_cost || order.shipping) {
        totalVal += Number(order.shipping_cost || order.shipping || 0);
      }
      if (order.discount) {
        totalVal -= Number(order.discount || 0);
      }
    }
    var realTotal = Math.round((Number(totalVal) || 0) * 100) / 100;

    // Persist customer identifiers for returning visitors
    persistCustomerIdentifiers({ phone: phone, name: order.customer_name || order.name, city: city });

    return trackEvent(
      STANDARD.Purchase,
      {
        content_ids: contentIds,
        content_type: 'product',
        value: realTotal,
        currency: 'EGP',
        num_items: lineItems.reduce((s, i) => s + (Number(i.quantity || i.qty) || 1), 0) || contentIds.length || 1,
      },
      {
        phone: phone || undefined,
        firstName: names.firstName,
        lastName: names.lastName,
        city: city || undefined,
      },
      `purchase-${orderId}`
    );
  }

  // Attempt initial pixel init sync on load
  if (typeof window !== 'undefined') {
    setTimeout(syncFbqInit, 50);
  }

  window.MontanaMeta = {
    STANDARD,
    trackEvent,
    trackViewContent,
    trackInitiateCheckout,
    enrichCheckoutUserData,
    getStoredUserData,
    getPersistedUserData,
    persistCustomerIdentifiers,
    syncFbqInit,
    trackPurchaseOnce,
    trackAddToCart(product, qty) {
      if (!product) return Promise.resolve(null);
      const q = Math.max(1, Number(qty) || 1);
      const price = Number(product.price) || 0;
      return trackEvent(STANDARD.AddToCart, {
        content_ids: [String(product.id)],
        content_name: product.name,
        content_type: 'product',
        value: price * q,
        currency: 'EGP',
      });
    },
    /** Bundle ATC — content_ids = product slugs, value = bundle price. */
    trackAddToCartBundle(payload) {
      if (!payload) return Promise.resolve(null);
      const ids = (payload.content_ids || []).map(String).filter(Boolean);
      if (!ids.length) return Promise.resolve(null);
      return trackEvent(STANDARD.AddToCart, {
        content_ids: ids,
        content_name: payload.content_name || 'Bundle',
        content_type: 'product',
        value: Number(payload.value) || 0,
        currency: payload.currency || 'EGP',
      });
    },
  };
})();
