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
    return match ? match[2] : null;
  }

  function onceGuard(key) {
    try {
      if (sessionStorage.getItem(key)) return false;
      sessionStorage.setItem(key, '1');
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
    userData = userData || {};

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
          userData,
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

  function trackInitiateCheckout(customData) {
    if (!onceGuard('meta_initiate_checkout')) return Promise.resolve(null);
    return trackEvent(STANDARD.InitiateCheckout, customData || {});
  }

  async function trackPurchaseOnce(order, items) {
    if (!order) return null;
    const orderId = order.id || order.order_id;
    if (!orderId) {
      console.error('Meta Purchase skipped: missing order.id');
      return null;
    }
    if (!onceGuard(`meta_purchase_${orderId}`)) return null;

    const lineItems = Array.isArray(items) ? items : (order.items || []);
    const contentIds = lineItems
      .map((i) => i.product_slug || i.slug || i.product_id || i.id)
      .filter((id) => id != null && id !== '')
      .map(String);
    const names = splitName(order.customer_name || order.name || '');
    const phone = order.customer_phone || order.phone || '';
    const city = order.city || order.governorate || '';

    return trackEvent(
      STANDARD.Purchase,
      {
        content_ids: contentIds,
        content_type: 'product',
        value: Number(order.total) || 0,
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

  window.MontanaMeta = {
    STANDARD,
    trackEvent,
    trackViewContent,
    trackInitiateCheckout,
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
