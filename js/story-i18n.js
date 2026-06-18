/* Montana story page — bilingual strings + Supabase CMS overrides */
(function () {
  var _L = 'en';
  var _ready = false;

  var T = {};
  var S = {};
  var ppIngr = [];

  function cloneDefaults() {
    var d = window.MONTANA_HOMEPAGE_DEFAULTS;
    if (!d) return null;
    return JSON.parse(JSON.stringify(d));
  }

  function applyContentPayload(payload) {
    var base = cloneDefaults();
    if (!base) return;
    S = base.S || {};
    T = base.T || {};
    ppIngr = base.ppIngr || [];
    if (!payload) return;

    if (payload.S) {
      Object.keys(payload.S).forEach(function (k) {
        if (payload.S[k] && payload.S[k].length >= 2) S[k] = payload.S[k].slice();
      });
    }
    if (payload.T) {
      Object.keys(payload.T).forEach(function (k) {
        if (!T[k]) T[k] = [];
        (payload.T[k] || []).forEach(function (pair, i) {
          if (pair && pair.length >= 2) T[k][i] = pair.slice();
        });
      });
    }
    if (payload.ppIngr) {
      payload.ppIngr.forEach(function (row, i) {
        if (!ppIngr[i]) ppIngr[i] = { en: [], ar: [] };
        if (row.en) ppIngr[i].en = row.en.slice();
        if (row.ar) ppIngr[i].ar = row.ar.slice();
      });
    }
  }

  function applyIngr(lang) {
    var i = lang === 'ar' ? 1 : 0;
    var langKey = lang === 'ar' ? 'ar' : 'en';
    document.querySelectorAll('.pp-ingr').forEach(function (el, j) {
      if (!ppIngr[j]) return;
      var list = ppIngr[j][langKey] || ppIngr[j].en || [];
      el.innerHTML = list.map(function (s) {
        return '<span class="pi">' + String(s).replace(/</g, '&lt;') + '</span>';
      }).join('');
    });
  }

  function go(lang) {
    if (lang !== 'en' && lang !== 'ar') return;
    _L = lang;
    var ar = lang === 'ar';
    var i = ar ? 1 : 0;
    document.documentElement.setAttribute('lang', lang);
    document.documentElement.setAttribute('dir', ar ? 'rtl' : 'ltr');
    var btnEn = document.getElementById('btn-en');
    var btnAr = document.getElementById('btn-ar');
    if (btnEn) btnEn.classList.toggle('on', lang === 'en');
    if (btnAr) btnAr.classList.toggle('on', lang === 'ar');
    try { localStorage.setItem('montana_lang', lang); } catch (e) {}

    Object.keys(T).forEach(function (c) {
      document.querySelectorAll('.' + c).forEach(function (el, j) {
        if (T[c][j]) el.innerHTML = T[c][j][i];
      });
    });

    applyIngr(lang);

    var h1 = document.querySelector('#ov-open h1');
    if (h1 && S.h1) h1.innerHTML = S.h1[i];
    var pre = document.querySelector('.pre');
    if (pre && S.pre) pre.innerHTML = S.pre[i];
    var sub = document.querySelector('.sub');
    if (sub && S.sub) sub.innerHTML = S.sub[i];
    var fq = document.querySelector('.fq');
    if (fq && S.fq) fq.innerHTML = S.fq[i];
    var ft = document.querySelector('.ftag');
    if (ft && S.ftag) ft.innerHTML = S.ftag[i];
    var fc = document.querySelector('.fcta');
    if (fc && S.fcta) fc.innerHTML = S.fcta[i];
    var sc = document.querySelector('#scroll-cue span');
    if (sc) sc.textContent = ar ? 'ابدئي' : 'Begin';
    if (window.MontanaShop) MontanaShop.bindNav();
    document.querySelectorAll('.pp-add').forEach(function (b) {
      b.textContent = ar ? 'ضيفي للشنطة' : 'Add to Bag';
    });
    document.querySelectorAll('.pp-view').forEach(function (b) {
      b.textContent = ar ? 'شوفي المنتج' : 'View';
    });
    var quizFab = document.querySelector('#quiz-fab [data-i18n="quizCta"], #quiz-fab span');
    if (quizFab && window.MontanaShop) quizFab.textContent = MontanaShop.t('quizCta');
    var finaleQuiz = document.querySelector('#finale-quiz-btn [data-i18n="quizCta"], #finale-quiz-btn span');
    if (finaleQuiz && window.MontanaShop) finaleQuiz.textContent = MontanaShop.t('quizCta');
    if (typeof updateStoryProgress === 'function') {
      updateStoryProgress(typeof currentScene === 'number' ? currentScene : 0);
    }
  }

  window.go = go;
  window.MontanaStoryContent = { getS: function () { return S; }, getT: function () { return T; }, getPpIngr: function () { return ppIngr; } };

  document.addEventListener('lang:changed', function () {
    if (window.MontanaCart) go(MontanaCart.getLang());
  });

  function bootLang() {
    var saved = 'en';
    try { saved = localStorage.getItem('montana_lang') || 'en'; } catch (e) {}
    if (saved !== 'ar' && saved !== 'en') saved = 'en';
    go(saved);
    if (window.MontanaCart && MontanaCart.getLang() !== saved) MontanaCart.setLang(saved);
  }

  function bindLangButtons() {
    var btnEn = document.getElementById('btn-en');
    var btnAr = document.getElementById('btn-ar');
    if (btnAr && !btnAr.textContent.trim()) btnAr.textContent = '\u0639\u0631\u0628\u064A';
    function pick(lang) {
      go(lang);
      if (window.MontanaCart) {
        if (MontanaCart.getLang() !== lang) MontanaCart.setLang(lang);
      } else {
        try { localStorage.setItem('montana_lang', lang); } catch (e) {}
      }
    }
    if (btnEn) btnEn.addEventListener('click', function () { pick('en'); });
    if (btnAr) btnAr.addEventListener('click', function () { pick('ar'); });
  }

  function boot() {
    bootLang();
    bindLangButtons();
    _ready = true;
    document.dispatchEvent(new CustomEvent('montana:story-ready'));
  }

  function loadContentThenBoot() {
    applyContentPayload(cloneDefaults());
    fetch('/api/settings/homepage')
      .then(function (r) { return r.json(); })
      .then(function (d) {
        if (d && d.ok && d.content) applyContentPayload(d.content);
      })
      .catch(function () { /* defaults */ })
      .finally(boot);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadContentThenBoot);
  } else {
    loadContentThenBoot();
  }
})();
