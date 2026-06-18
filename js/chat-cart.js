/* Montana chat cart — prices from catalog, not AI */
window.MontanaChatCart = (function () {
  var items = [];

  function findProduct(id) {
    var list = window.MONTANA_PRODUCTS || [];
    for (var i = 0; i < list.length; i++) {
      if (list[i].id === id) return list[i];
    }
    return null;
  }

  function normalizeEntry(p, qty) {
    qty = Math.max(1, parseInt(qty, 10) || 1);
    var name = p.name && p.name.ar ? p.name.ar : (p.nameAr || String(p.name || ''));
    var nameEn = p.name && p.name.en ? p.name.en : (p.nameEn || name);
    return {
      id: p.id,
      name: name,
      nameEn: nameEn,
      price: Number(p.price) || 0,
      qty: qty,
      image: p.image || ''
    };
  }

  function add(productId, qty) {
    var p = findProduct(productId);
    if (!p) return false;
    for (var i = 0; i < items.length; i++) {
      if (items[i].id === productId) {
        items[i].qty += Math.max(1, parseInt(qty, 10) || 1);
        return true;
      }
    }
    items.push(normalizeEntry(p, qty));
    return true;
  }

  function addByName(name) {
    var n = String(name || '').trim().toLowerCase();
    if (!n) return false;
    var list = window.MONTANA_PRODUCTS || [];
    for (var i = 0; i < list.length; i++) {
      var ar = (list[i].name && list[i].name.ar) || list[i].nameAr || '';
      var en = (list[i].name && list[i].name.en) || list[i].nameEn || '';
      if (ar.toLowerCase().indexOf(n) >= 0 || n.indexOf(ar.toLowerCase()) >= 0 ||
          en.toLowerCase().indexOf(n) >= 0) {
        return add(list[i].id, 1);
      }
    }
    return false;
  }

  function remove(productId) {
    items = items.filter(function (i) { return i.id !== productId; });
  }

  function clear() {
    items = [];
  }

  function getItems() {
    return items.slice();
  }

  function count() {
    return items.reduce(function (s, i) { return s + i.qty; }, 0);
  }

  function total() {
    return items.reduce(function (s, i) { return s + i.price * i.qty; }, 0);
  }

  function isEmpty() {
    return !items.length;
  }

  function toOrderItems() {
    return items.map(function (i) {
      return { name: i.name, price: i.price, qty: i.qty };
    });
  }

  function summary(lang) {
    lang = lang || 'ar';
    if (!items.length) {
      return lang === 'en' ? 'Cart is empty.' : 'السلة فاضية.';
    }
    var lines = items.map(function (i) {
      var label = lang === 'en' ? i.nameEn : i.name;
      return label + ' ×' + i.qty + ' — ' + (i.price * i.qty) + (lang === 'en' ? ' EGP' : ' جنيه');
    });
    var sum = total();
    lines.push(lang === 'en'
      ? 'Total: ' + sum + ' EGP'
      : 'الإجمالي: ' + sum + ' جنيه');
    return lines.join('\n');
  }

  function catalogSnapshot(lang) {
    lang = lang || 'ar';
    return items.map(function (i) {
      return {
        id: i.id,
        name: lang === 'en' ? i.nameEn : i.name,
        qty: i.qty,
        unit_price: i.price,
        line_total: i.price * i.qty
      };
    });
  }

  return {
    add: add,
    addByName: addByName,
    remove: remove,
    clear: clear,
    getItems: getItems,
    count: count,
    total: total,
    isEmpty: isEmpty,
    toOrderItems: toOrderItems,
    summary: summary,
    catalogSnapshot: catalogSnapshot,
    findProduct: findProduct
  };
})();
