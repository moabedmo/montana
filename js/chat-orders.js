/* Chatbot orders → same storage as admin (localStorage mn_or) */
window.MontanaChatOrders = (function () {
  var KEY = 'mn_or';

  function load() {
    try {
      return JSON.parse(localStorage.getItem(KEY)) || [];
    } catch (e) {
      return [];
    }
  }

  function saveAll(orders) {
    localStorage.setItem(KEY, JSON.stringify(orders));
    try {
      document.dispatchEvent(new CustomEvent('montana:orders-updated', { detail: orders }));
    } catch (e) {}
  }

  function esc(s) {
    if (s == null) return '';
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function save(order) {
    var items = (order.items || []).map(function (i) {
      return {
        name: String(i.name || '').trim(),
        qty: Math.max(1, parseInt(i.qty, 10) || 1),
        price: Number(i.price) || 0
      };
    }).filter(function (i) { return i.name; });

    var entry = {
      id: Date.now(),
      name: String(order.name || '').trim(),
      phone: String(order.phone || '').trim(),
      address: String(order.address || '').trim(),
      items: items,
      total: items.reduce(function (s, i) { return s + i.price * i.qty; }, 0),
      time: new Date().toLocaleString('ar-EG'),
      status: 'pending',
      source: 'chatbot',
      depositAmount: Number(order.depositAmount) || 0,
      depositProofSent: !!order.depositProofSent
    };

    if (!entry.name || !entry.phone || !entry.address) {
      throw new Error('missing_fields');
    }
    if (!entry.items.length) {
      throw new Error('missing_items');
    }

    var orders = load();
    orders.push(entry);
    saveAll(orders);
    return entry.id;
  }

  return { save: save, load: load, esc: esc };
})();
