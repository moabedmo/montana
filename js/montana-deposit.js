/* Montana — 200 EGP deposit before order confirm (chat + shop) */
window.MontanaDeposit = (function () {
  var DEPOSIT_AMOUNT = 200;
  var paymentInfo = {
    ar: 'حوّلي 200 جنيه عربون (فودافون كاش أو InstaPay) وارفعي صورة التحويل قبل تأكيد الأوردر.',
    en: 'Transfer 200 EGP deposit (Vodafone Cash or InstaPay) and upload proof before confirming your order.'
  };
  var settingsLoaded = false;

  function t(lang) {
    return lang === 'en' ? paymentInfo.en : paymentInfo.ar;
  }

  function amount() {
    return DEPOSIT_AMOUNT;
  }

  async function loadSettings() {
    if (settingsLoaded) return;
    try {
      var r = await fetch('/api/settings/deposit');
      var d = await r.json();
      if (d.ok) {
        if (d.amount) DEPOSIT_AMOUNT = d.amount;
        if (d.paymentInfo) {
          if (d.paymentInfo.ar) paymentInfo.ar = d.paymentInfo.ar;
          if (d.paymentInfo.en) paymentInfo.en = d.paymentInfo.en;
        }
        settingsLoaded = true;
      }
    } catch (e) { /* defaults */ }
  }

  function readImageFile(file) {
    return new Promise(function (resolve, reject) {
      if (!file || !/^image\//.test(file.type)) {
        reject(new Error('invalid_image'));
        return;
      }
      if (file.size > 8 * 1024 * 1024) {
        reject(new Error('too_large'));
        return;
      }
      var reader = new FileReader();
      reader.onload = function () { resolve(String(reader.result || '')); };
      reader.onerror = function () { reject(new Error('read_failed')); };
      reader.readAsDataURL(file);
    });
  }

  async function uploadProof(payload) {
    await loadSettings();
    var r = await fetch('/api/orders/deposit-proof', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    var d = await r.json();
    if (!r.ok || !d.ok) {
      throw new Error(d.error || 'upload_failed');
    }
    return d;
  }

  async function notifyOrderConfirmed(order) {
    try {
      await fetch('/api/orders/notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order: order })
      });
    } catch (e) { /* non-blocking */ }
  }

  function itemsSummary(items, lang) {
    return (items || []).map(function (i) {
      return (i.name || '') + ' x' + (i.qty || 1);
    }).join(lang === 'en' ? ', ' : '، ');
  }

  return {
    loadSettings: loadSettings,
    amount: amount,
    paymentInfo: t,
    readImageFile: readImageFile,
    uploadProof: uploadProof,
    notifyOrderConfirmed: notifyOrderConfirmed,
    itemsSummary: itemsSummary
  };
})();
