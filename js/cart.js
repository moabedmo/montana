window.MontanaCart = (function () {
  var KEY = 'montana_cart';
  var LANG_KEY = 'montana_lang';

  function get() {
    try { return JSON.parse(localStorage.getItem(KEY)) || []; }
    catch (e) { return []; }
  }

  function save(items) {
    localStorage.setItem(KEY, JSON.stringify(items));
    document.dispatchEvent(new CustomEvent('cart:updated', { detail: items }));
  }

  function find(id) {
    return get().find(function (i) { return i.id === id; });
  }

  function add(id, qty) {
    qty = qty || 1;
    var p = product(id);
    if (!p) return get();
    var items = get();
    var existing = items.find(function (i) { return i.id === id; });
    if (existing) existing.qty += qty;
    else items.push({ id: id, qty: qty });
    save(items);
    return items;
  }

  function setQty(id, qty) {
    qty = Math.max(1, parseInt(qty, 10) || 1);
    var items = get().map(function (i) {
      return i.id === id ? { id: id, qty: qty } : i;
    });
    save(items);
    return items;
  }

  function remove(id) {
    var items = get().filter(function (i) { return i.id !== id; });
    save(items);
    return items;
  }

  function clear() {
    save([]);
    return [];
  }

  function count() {
    return get().reduce(function (n, i) { return n + i.qty; }, 0);
  }

  function product(id) {
    return (window.MONTANA_PRODUCTS || []).find(function (p) { return p.id === id; });
  }

  function lines() {
    return get().map(function (item) {
      var p = product(item.id);
      if (!p) return null;
      return { product: p, qty: item.qty, total: p.price * item.qty };
    }).filter(Boolean);
  }

  function subtotal() {
    return lines().reduce(function (s, l) { return s + l.total; }, 0);
  }

  function shipping(sub) {
    return sub >= 1000 ? 0 : 60;
  }

  function total() {
    var sub = subtotal();
    return sub + shipping(sub);
  }

  function getLang() {
    return localStorage.getItem(LANG_KEY) || 'en';
  }

  function setLang(lang) {
    localStorage.setItem(LANG_KEY, lang);
    document.documentElement.setAttribute('lang', lang);
    document.documentElement.setAttribute('dir', lang === 'ar' ? 'rtl' : 'ltr');
    document.dispatchEvent(new CustomEvent('lang:changed', { detail: lang }));
  }

  function formatPrice(n, lang) {
    lang = lang || getLang();
    var formatted = n.toLocaleString(lang === 'ar' ? 'ar-EG' : 'en-EG');
    return lang === 'ar' ? formatted + ' ج.م' : 'EGP ' + formatted;
  }

  function saveOrder(order) {
    if (order.customer && window.MontanaShop) {
      order.customer.name = MontanaShop.sanitizeText(order.customer.name, 100);
      order.customer.phone = MontanaShop.sanitizePhone(order.customer.phone);
      order.customer.address = MontanaShop.sanitizeText(order.customer.address, 300);
      order.customer.notes = MontanaShop.sanitizeText(order.customer.notes, 500);
    }
    var orders = [];
    try { orders = JSON.parse(localStorage.getItem('montana_orders')) || []; } catch (e) {}
    order.id = 'MN-' + Date.now().toString(36).toUpperCase();
    order.date = new Date().toISOString();
    orders.unshift(order);
    localStorage.setItem('montana_orders', JSON.stringify(orders));
    syncOrderToAdmin(order);
    return order;
  }

  function syncOrderToAdmin(order) {
    if (!order || !order.customer) return;
    var adminOrders = [];
    try { adminOrders = JSON.parse(localStorage.getItem('mn_or')) || []; } catch (e) {}
    if (order.id && adminOrders.some(function (o) { return o.shopOrderId === order.id; })) return;

    var items = (order.items || []).map(function (i) {
      return {
        name: String(i.name || '').trim(),
        qty: Math.max(1, parseInt(i.qty, 10) || 1),
        price: Number(i.price) || 0
      };
    }).filter(function (i) { return i.name; });

    var entry = {
      id: Date.now(),
      name: order.customer.name,
      phone: order.customer.phone,
      address: order.customer.address,
      items: items,
      total: Number(order.total) || items.reduce(function (s, i) { return s + i.price * i.qty; }, 0),
      time: new Date().toLocaleString('ar-EG'),
      status: 'pending',
      source: 'shop',
      shopOrderId: order.id,
      payment: order.payment || '',
      notes: order.customer.notes || ''
    };
    if (order.shipping != null) entry.shipping = order.shipping;
    if (order.subtotal != null) entry.subtotal = order.subtotal;

    adminOrders.push(entry);
    localStorage.setItem('mn_or', JSON.stringify(adminOrders));
    try {
      document.dispatchEvent(new CustomEvent('montana:orders-updated', { detail: adminOrders }));
    } catch (e) {}
  }

  return {
    get: get, find: find, add: add, setQty: setQty, remove: remove, clear: clear,
    count: count, lines: lines, subtotal: subtotal, shipping: shipping,
    total: total, product: product, getLang: getLang, setLang: setLang,
    formatPrice: formatPrice, saveOrder: saveOrder
  };
})();
