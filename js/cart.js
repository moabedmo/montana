// Montana storefront — real cart, persisted in localStorage.
// Plain classic script (not a module) so it loads the same way as
// the rest of the site's vanilla JS (script.js, components.js) with
// no import-order surprises.
(function () {
  const CART_KEY = 'montana_cart';

  function readCart() {
    try { return JSON.parse(localStorage.getItem(CART_KEY)) || []; }
    catch { return []; }
  }
  function writeCart(items) {
    localStorage.setItem(CART_KEY, JSON.stringify(items));
    updateCartBadges();
  }

  function updateCartBadges() {
    const count = window.Cart.getCount();
    document.querySelectorAll('.cart-badge').forEach(el => {
      el.textContent = count;
      el.style.display = count > 0 ? '' : 'none';
    });
    // mobile "app" cart screen (index.html) re-renders itself live on
    // every cart change, not just when first switched to.
    window.renderAppCart?.();
  }

  window.Cart = {
    // product: { id, name, image, price, bundleSlug? }
    // opts: { skipMeta?: boolean }
    add(product, qty = 1, opts) {
      const items = readCart();
      const existing = items.find(i => i.id === product.id);
      if (existing) {
        existing.qty += qty;
        if (product.price != null) existing.price = product.price;
        if (product.bundleSlug) existing.bundleSlug = product.bundleSlug;
      } else {
        const row = { id: product.id, name: product.name, image: product.image, price: product.price, qty };
        if (product.bundleSlug) row.bundleSlug = product.bundleSlug;
        items.push(row);
      }
      writeCart(items);
      if (!opts?.skipMeta) {
        try {
          window.MontanaMeta?.trackAddToCart?.(product, qty);
        } catch (_) { /* tracking must never break cart */ }
      }
    },
    /**
     * Add a bundle: every product line at allocated unit prices that sum to
     * bundlePrice (e.g. brightening-routine = 3 items → 699).
     * Cart shape stays { id, name, image, price, qty } (+ optional bundleSlug).
     * AddToCart Meta: all content_ids (slugs) + value = bundlePrice.
     */
    addBundle(bundle) {
      if (!bundle?.lines?.length) return;
      const items = readCart();
      for (const line of bundle.lines) {
        const existing = items.find(i => i.id === line.id);
        if (existing) {
          existing.qty += 1;
          existing.price = line.price;
          existing.bundleSlug = bundle.slug;
        } else {
          items.push({
            id: line.id,
            name: line.name,
            image: line.image,
            price: line.price,
            qty: 1,
            bundleSlug: bundle.slug,
          });
        }
      }
      writeCart(items);
      try {
        const contentIds = (bundle.lines || [])
          .map((l) => String(l.slug || l.id))
          .filter(Boolean);
        window.MontanaMeta?.trackAddToCartBundle?.({
          content_ids: contentIds,
          content_name: bundle.name,
          value: Number(bundle.bundlePrice) || 0,
          currency: 'EGP',
        });
      } catch (_) { /* tracking must never break cart */ }
    },
    remove(productId) {
      writeCart(readCart().filter(i => i.id !== productId));
    },
    setQty(productId, qty) {
      qty = Math.max(0, Math.floor(qty) || 0);
      let items = readCart();
      if (qty === 0) items = items.filter(i => i.id !== productId);
      else items = items.map(i => i.id === productId ? { ...i, qty } : i);
      writeCart(items);
    },
    getItems() { return readCart(); },
    getTotal() { return readCart().reduce((s, i) => s + i.price * i.qty, 0); },
    getCount() { return readCart().reduce((s, i) => s + i.qty, 0); },
    clear() { writeCart([]); }
  };

  document.addEventListener('DOMContentLoaded', updateCartBadges);
  // in case this script runs after DOMContentLoaded already fired
  if (document.readyState !== 'loading') updateCartBadges();
})();
