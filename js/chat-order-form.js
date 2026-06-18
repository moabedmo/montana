/* Montana chat — structured order form (no free-text order steps in chat) */
window.MontanaChatOrderForm = (function () {
  var sheet = null;
  var callbacks = { onSuccess: null, onCancel: null };
  var lang = 'ar';

  function t(key) {
    var L = {
      ar: {
        title: 'إتمام الطلب',
        products: 'المنتجات',
        name: 'الاسم',
        phone: 'رقم الموبايل (11 رقم)',
        address: 'العنوان (محافظة + منطقة + شارع)',
        total: 'الإجمالي',
        submit: 'تأكيد الأوردر',
        cancel: 'إلغاء',
        pickProduct: 'اختاري منتج واحد على الأقل',
        phoneIncomplete: 'الرقم ناقص — لازم 11 رقم (01xxxxxxxxx)',
        phoneInvalid: 'رقم مصري مش صح — 010 / 011 / 012 / 015',
        nameRequired: 'محتاجة الاسم',
        addressRequired: 'محتاجة العنوان كامل',
        saving: 'بنسجّل الأوردر...'
      },
      en: {
        title: 'Complete order',
        products: 'Products',
        name: 'Name',
        phone: 'Mobile (11 digits)',
        address: 'Address (city + area + street)',
        total: 'Total',
        submit: 'Confirm order',
        cancel: 'Cancel',
        pickProduct: 'Select at least one product',
        phoneIncomplete: 'Incomplete — must be 11 digits (01xxxxxxxxx)',
        phoneInvalid: 'Invalid Egyptian mobile — 010 / 011 / 012 / 015',
        nameRequired: 'Name is required',
        addressRequired: 'Full address is required',
        saving: 'Saving order...'
      }
    };
    return (L[lang] || L.ar)[key] || key;
  }

  function validatePhone(raw) {
    var digits = String(raw || '').replace(/\D/g, '');
    if (digits.indexOf('20') === 0 && digits.length >= 12) digits = '0' + digits.slice(2);
    if (digits.length === 10 && digits.charAt(0) === '1') digits = '0' + digits;
    if (digits.length < 11) return { ok: false, code: 'incomplete', message: t('phoneIncomplete') };
    if (digits.length > 11) return { ok: false, code: 'long', message: t('phoneInvalid') };
    if (!/^01[0125]\d{8}$/.test(digits)) return { ok: false, code: 'invalid', message: t('phoneInvalid') };
    return { ok: true, phone: digits };
  }

  function getCatalog() {
    return window.MONTANA_PRODUCTS || [];
  }

  function pname(p) {
    if (!p || !p.name) return '';
    return lang === 'en' ? (p.name.en || p.name.ar) : (p.name.ar || p.name.en);
  }

  function selectedItems() {
    if (!sheet) return [];
    var items = [];
    sheet.querySelectorAll('.cos-prod-cb:checked').forEach(function (cb) {
      var id = cb.getAttribute('data-id');
      var p = getCatalog().find(function (x) { return x.id === id; });
      if (p) items.push({ name: p.name.ar, qty: 1, price: p.price, id: p.id });
    });
    return items;
  }

  function updateTotal() {
    if (!sheet) return;
    var el = sheet.querySelector('.cos-total-val');
    if (!el) return;
    var sum = selectedItems().reduce(function (s, i) { return s + i.price * i.qty; }, 0);
    el.textContent = sum + (lang === 'en' ? ' EGP' : ' جنيه');
  }

  function ensureSheet() {
    if (sheet) return sheet;
    sheet = document.getElementById('chat-order-sheet');
    if (!sheet) {
      sheet = document.createElement('div');
      sheet.id = 'chat-order-sheet';
      sheet.innerHTML =
        '<div class="cos-inner">' +
        '<div class="cos-head"><span class="cos-title"></span><button type="button" class="cos-close" aria-label="Close">×</button></div>' +
        '<div class="cos-products-wrap"><div class="cos-label cos-label-products"></div><div class="cos-products"></div></div>' +
        '<label class="cos-field"><span class="cos-label cos-label-name"></span><input type="text" id="cos-name" autocomplete="name"></label>' +
        '<label class="cos-field"><span class="cos-label cos-label-phone"></span><input type="tel" id="cos-phone" inputmode="numeric" maxlength="11" autocomplete="tel"></label>' +
        '<p class="cos-hint" id="cos-phone-hint"></p>' +
        '<label class="cos-field"><span class="cos-label cos-label-address"></span><input type="text" id="cos-address" autocomplete="street-address"></label>' +
        '<div class="cos-total-row"><span class="cos-label cos-label-total"></span> <strong class="cos-total-val">0</strong></div>' +
        '<button type="button" class="cos-submit"></button>' +
        '<button type="button" class="cos-cancel"></button>' +
        '</div>';
      var win = document.getElementById('chat-window');
      if (win) win.appendChild(sheet);
    }
    sheet.querySelector('.cos-close').addEventListener('click', close);
    sheet.querySelector('.cos-cancel').addEventListener('click', close);
    sheet.querySelector('.cos-submit').addEventListener('click', submit);
    var phone = sheet.querySelector('#cos-phone');
    if (phone) {
      phone.addEventListener('input', function () {
        phone.value = phone.value.replace(/\D/g, '').slice(0, 11);
        var hint = sheet.querySelector('#cos-phone-hint');
        if (!phone.value) { if (hint) hint.textContent = ''; return; }
        var v = validatePhone(phone.value);
        if (hint) hint.textContent = v.ok ? '' : v.message;
      });
    }
    return sheet;
  }

  function renderLabels() {
    sheet.querySelector('.cos-title').textContent = t('title');
    sheet.querySelector('.cos-label-products').textContent = t('products');
    sheet.querySelector('.cos-label-name').textContent = t('name');
    sheet.querySelector('.cos-label-phone').textContent = t('phone');
    sheet.querySelector('.cos-label-address').textContent = t('address');
    sheet.querySelector('.cos-label-total').textContent = t('total');
    sheet.querySelector('.cos-submit').textContent = t('submit');
    sheet.querySelector('.cos-cancel').textContent = t('cancel');
  }

  function renderProducts(selectedIds) {
    selectedIds = selectedIds || {};
    var wrap = sheet.querySelector('.cos-products');
    wrap.innerHTML = '';
    getCatalog().forEach(function (p) {
      var row = document.createElement('label');
      row.className = 'cos-prod-row';
      var cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.className = 'cos-prod-cb';
      cb.setAttribute('data-id', p.id);
      if (selectedIds[p.id]) cb.checked = true;
      cb.addEventListener('change', updateTotal);
      var span = document.createElement('span');
      span.textContent = pname(p) + ' — ' + p.price + (lang === 'en' ? ' EGP' : ' جنيه');
      row.appendChild(cb);
      row.appendChild(span);
      wrap.appendChild(row);
    });
    updateTotal();
  }

  function open(opts) {
    opts = opts || {};
    lang = opts.lang === 'en' ? 'en' : 'ar';
    callbacks.onSuccess = opts.onSuccess || null;
    callbacks.onCancel = opts.onCancel || null;
    ensureSheet();
    renderLabels();

    var selectedIds = {};
    (opts.items || []).forEach(function (item) {
      if (item.id) selectedIds[item.id] = true;
      else {
        var p = getCatalog().find(function (x) {
          return x.name && (x.name.ar === item.name || x.name.en === item.name);
        });
        if (p) selectedIds[p.id] = true;
      }
    });

    renderProducts(selectedIds);
    var pre = opts.prefill || {};
    sheet.querySelector('#cos-name').value = pre.name || '';
    sheet.querySelector('#cos-phone').value = pre.phone || '';
    sheet.querySelector('#cos-address').value = pre.address || '';
    sheet.querySelector('#cos-phone-hint').textContent = '';
    sheet.classList.add('open');
    sheet.removeAttribute('hidden');
  }

  function close() {
    if (sheet) {
      sheet.classList.remove('open');
      sheet.setAttribute('hidden', '');
    }
    if (callbacks.onCancel) callbacks.onCancel();
    callbacks.onSuccess = null;
    callbacks.onCancel = null;
  }

  function isOpen() {
    return sheet && sheet.classList.contains('open');
  }

  async function submit() {
    if (!sheet) return;
    var items = selectedItems();
    var name = sheet.querySelector('#cos-name').value.trim();
    var phoneRaw = sheet.querySelector('#cos-phone').value.trim();
    var address = sheet.querySelector('#cos-address').value.trim();
    var hint = sheet.querySelector('#cos-phone-hint');

    if (!items.length) {
      if (hint) hint.textContent = t('pickProduct');
      return;
    }
    if (!name) {
      sheet.querySelector('#cos-name').focus();
      return;
    }
    var ph = validatePhone(phoneRaw);
    if (!ph.ok) {
      if (hint) hint.textContent = ph.message;
      sheet.querySelector('#cos-phone').focus();
      return;
    }
    if (!address || address.length < 8) {
      sheet.querySelector('#cos-address').focus();
      if (hint) hint.textContent = t('addressRequired');
      return;
    }
    if (hint) hint.textContent = '';

    var btn = sheet.querySelector('.cos-submit');
    var oldText = btn.textContent;
    btn.disabled = true;
    btn.textContent = t('saving');

    try {
      var orderId = '';
      var payload = { name: name, phone: ph.phone, address: address, items: items };
      if (window.MONTANA_ADMIN && window.MONTANA_ADMIN.addOrder) {
        orderId = await window.MONTANA_ADMIN.addOrder(payload);
      } else if (window.MontanaChatOrders) {
        orderId = MontanaChatOrders.save(payload);
      } else {
        throw new Error('no_store');
      }
      sheet.classList.remove('open');
      sheet.setAttribute('hidden', '');
      if (callbacks.onSuccess) callbacks.onSuccess(orderId, payload);
      callbacks.onSuccess = null;
      callbacks.onCancel = null;
    } catch (e) {
      btn.disabled = false;
      btn.textContent = oldText;
      if (hint) hint.textContent = lang === 'en' ? 'Could not save — try again' : 'مش قدرنا نسجّل — جرّبي تاني';
    }
  }

  return { open: open, close: close, isOpen: isOpen, validatePhone: validatePhone };
})();
