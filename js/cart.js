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
    // product: { id, name, image, price }
    add(product, qty = 1) {
      const items = readCart();
      const existing = items.find(i => i.id === product.id);
      if (existing) existing.qty += qty;
      else items.push({ id: product.id, name: product.name, image: product.image, price: product.price, qty });
      writeCart(items);
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
