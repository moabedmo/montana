/* Montana — 200 EGP deposit before order confirm (chat + shop) */
window.MontanaDeposit = (function () {
  var DEPOSIT_AMOUNT = 200;
  var paymentInfo = {
    ar: 'حوّلي 200 جنيه رسوم تأكيد حجز (فودافون كاش أو InstaPay) وارفعي صورة التحويل قبل تأكيد الأوردر. المبلغ بيتخصم من الإجمالي.',
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

  function compressImageFile(file, maxDim, quality) {
    maxDim = maxDim || 1400;
    quality = quality || 0.82;
    return new Promise(function (resolve, reject) {
      if (!file || !/^image\//.test(file.type)) {
        reject(new Error('invalid_image'));
        return;
      }
      var img = new Image();
      var url = URL.createObjectURL(file);
      img.onload = function () {
        URL.revokeObjectURL(url);
        var w = img.naturalWidth || img.width;
        var h = img.naturalHeight || img.height;
        if (!w || !h) {
          reject(new Error('invalid_image'));
          return;
        }
        var scale = Math.min(1, maxDim / Math.max(w, h));
        var cw = Math.max(1, Math.round(w * scale));
        var ch = Math.max(1, Math.round(h * scale));
        var canvas = document.createElement('canvas');
        canvas.width = cw;
        canvas.height = ch;
        var ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, cw, ch);
        var dataUrl = canvas.toDataURL('image/jpeg', quality);
        resolve(dataUrl);
      };
      img.onerror = function () {
        URL.revokeObjectURL(url);
        reject(new Error('read_failed'));
      };
      img.src = url;
    });
  }

  function readImageFile(file) {
    return compressImageFile(file).catch(function () {
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
    });
  }

  async function uploadProof(payload) {
    await loadSettings();
    var r = await fetch('/api/orders/deposit-proof', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    var d = {};
    try { d = await r.json(); } catch (e) {
      throw new Error(r.status === 404
        ? 'السيرفر مش شغّال — جرّبي تاني بعد دقيقة'
        : 'فشل الاتصال بالسيرفر');
    }
    if (!r.ok || !d.ok) {
      throw new Error(d.error || 'upload_failed');
    }
    return d;
  }

  function waitForAdminApproval(proofId, opts) {
    opts = opts || {};
    var interval = opts.intervalMs || 3000;
    var maxMs = opts.maxMs || 30 * 60 * 1000;
    var started = Date.now();
    var cancelled = false;
    var timer = null;

    function cancel() {
      cancelled = true;
      if (timer) clearTimeout(timer);
    }

    var promise = new Promise(function (resolve, reject) {
      function poll() {
        if (cancelled) {
          reject(new Error('cancelled'));
          return;
        }
        fetch('/api/orders/deposit-status?proofId=' + encodeURIComponent(proofId))
          .then(function (r) { return r.json(); })
          .then(function (d) {
            if (cancelled) {
              reject(new Error('cancelled'));
              return;
            }
            if (d.ok && d.approved) {
              resolve(d);
              return;
            }
            if (Date.now() - started > maxMs) {
              reject(new Error('approval_timeout'));
              return;
            }
            timer = setTimeout(poll, interval);
          })
          .catch(function () {
            if (cancelled) {
              reject(new Error('cancelled'));
              return;
            }
            if (Date.now() - started > maxMs) reject(new Error('approval_timeout'));
            else timer = setTimeout(poll, interval);
          });
      }
      poll();
    });

    return { promise: promise, cancel: cancel };
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
    waitForAdminApproval: waitForAdminApproval,
    notifyOrderConfirmed: notifyOrderConfirmed,
    itemsSummary: itemsSummary
  };
})();
