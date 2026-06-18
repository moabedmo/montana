/* Admin — homepage content editor */
(function () {
  var HP = { content: null, productLabels: [
    'Act 01 — Tranquility · غسول حب الشباب',
    'Act 02 — Illumina · غسول التفتيح',
    'Act 03 — Eclipse · كريم التفتيح',
    'Act 04 — Harmony · لوشن اليدين والجسم',
    'Act 05 — Rebirth · كريم بعد الليزر',
    'Act 06 — Erasion · جل الندبات'
  ]};

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function pairField(label, enVal, arVal, opts) {
    opts = opts || {};
    var rows = opts.rows || 2;
    var hint = opts.hint ? '<p style="font-size:11px;color:var(--text-s);margin:4px 0 8px;">' + opts.hint + '</p>' : '';
    return '<div class="form-group full">' +
      '<label>' + label + '</label>' + hint +
      '<div class="form-grid">' +
      '<div class="form-group"><label>English</label><textarea data-hp-en rows="' + rows + '">' + esc(enVal) + '</textarea></div>' +
      '<div class="form-group"><label>العربي</label><textarea data-hp-ar rows="' + rows + '">' + esc(arVal) + '</textarea></div>' +
      '</div></div>';
  }

  function readPair(block) {
    return [
      (block.querySelector('[data-hp-en]') || {}).value || '',
      (block.querySelector('[data-hp-ar]') || {}).value || ''
    ];
  }

  function renderEditor(content) {
    var root = document.getElementById('homepage-editor');
    if (!root) return;
    var c = content || {};
    var S = c.S || {};
    var T = c.T || {};
    var ingr = c.ppIngr || [];
    var html = '';

    html += '<div class="card"><div class="card-title">بداية الصفحة (Hero)</div>';
    html += pairField('العنوان الفرعي (pre)', (S.pre || [])[0], (S.pre || [])[1]);
    html += pairField('العنوان الرئيسي (h1) — HTML مسموح', (S.h1 || [])[0], (S.h1 || [])[1], { rows: 3, hint: 'مثال: &lt;s&gt;نص&lt;/s&gt; · &lt;em&gt;تمييز&lt;/em&gt; · &lt;br&gt;' });
    html += pairField('الوصف (sub)', (S.sub || [])[0], (S.sub || [])[1], { rows: 2 });
    html += pairField('اقتباس النهاية (fq)', (S.fq || [])[0], (S.fq || [])[1], { rows: 2 });
    html += pairField('وعد مونتانا (ftag)', (S.ftag || [])[0], (S.ftag || [])[1]);
    html += pairField('زر CTA (fcta)', (S.fcta || [])[0], (S.fcta || [])[1], { rows: 2 });
    html += '</div>';

    html += '<div class="card"><div class="card-title">إحصائيات النهاية (Finale)</div>';
    (T.fsl || []).forEach(function (row, i) {
      html += pairField('إحصائية ' + (i + 1), row[0], row[1]);
    });
    html += '</div>';

    for (var p = 0; p < 6; p++) {
      html += '<div class="card" data-hp-product="' + p + '">';
      html += '<div class="card-title">' + HP.productLabels[p] + '</div>';
      html += pairField('عنوان الفصل (ch-act)', (T['ch-act'] || [])[p] ? T['ch-act'][p][0] : '', (T['ch-act'] || [])[p] ? T['ch-act'][p][1] : '');
      html += pairField('جملة الفصل (ch-t) — HTML', (T['ch-t'] || [])[p] ? T['ch-t'][p][0] : '', (T['ch-t'] || [])[p] ? T['ch-t'][p][1] : '', { rows: 2 });
      html += pairField('مناسب لـ / Best for (pp-act)', (T['pp-act'] || [])[p] ? T['pp-act'][p][0] : '', (T['pp-act'] || [])[p] ? T['pp-act'][p][1] : '', { rows: 2 });
      html += pairField('Tagline / المشكلة (pp-problem)', (T['pp-problem'] || [])[p] ? T['pp-problem'][p][0] : '', (T['pp-problem'] || [])[p] ? T['pp-problem'][p][1] : '', { rows: 2 });
      html += pairField('اسم المنتج (pp-h) — HTML', (T['pp-h'] || [])[p] ? T['pp-h'][p][0] : '', (T['pp-h'] || [])[p] ? T['pp-h'][p][1] : '', { rows: 2 });
      html += pairField('الوصف (pp-body)', (T['pp-body'] || [])[p] ? T['pp-body'][p][0] : '', (T['pp-body'] || [])[p] ? T['pp-body'][p][1] : '', { rows: 3 });
      html += pairField('اقتباس العميلة (pp-result)', (T['pp-result'] || [])[p] ? T['pp-result'][p][0] : '', (T['pp-result'] || [])[p] ? T['pp-result'][p][1] : '', { rows: 2 });
      html += pairField('الحجم (pp-vol)', (T['pp-vol'] || [])[p] ? T['pp-vol'][p][0] : '', (T['pp-vol'] || [])[p] ? T['pp-vol'][p][1] : '');
      var ing = ingr[p] || { en: [], ar: [] };
      html += '<div class="form-group full"><label>المكونات (افصلي بفاصلة ,)</label><div class="form-grid">' +
        '<div class="form-group"><label>English</label><textarea data-hp-ingr-en rows="2">' + esc((ing.en || []).join(', ')) + '</textarea></div>' +
        '<div class="form-group"><label>العربي</label><textarea data-hp-ingr-ar rows="2">' + esc((ing.ar || []).join('، ')) + '</textarea></div>' +
        '</div></div>';
      html += '</div>';
    }

    root.innerHTML = html;
  }

  function collectContent() {
    var cards = document.querySelectorAll('#homepage-editor > .card');
    if (!cards.length) return HP.content;

    var hero = cards[0];
    var finale = cards[1];
    var heroBlocks = hero.querySelectorAll('.form-group.full');
    var S = {
      pre: readPair(heroBlocks[0]),
      h1: readPair(heroBlocks[1]),
      sub: readPair(heroBlocks[2]),
      fq: readPair(heroBlocks[3]),
      ftag: readPair(heroBlocks[4]),
      fcta: readPair(heroBlocks[5])
    };

    var fsl = [];
    finale.querySelectorAll('.form-group.full').forEach(function (block) {
      fsl.push(readPair(block));
    });

    var T = {
      'pp-act': [], 'pp-problem': [], 'pp-result': [], 'pp-vol': [], 'pp-body': [], 'pp-h': [],
      'ch-act': [], 'ch-t': [], fsl: fsl
    };
    var ppIngr = [];

    for (var p = 0; p < 6; p++) {
      var card = document.querySelector('#homepage-editor [data-hp-product="' + p + '"]');
      if (!card) continue;
      var blocks = card.querySelectorAll('.form-group.full');
      T['ch-act'].push(readPair(blocks[0]));
      T['ch-t'].push(readPair(blocks[1]));
      T['pp-act'].push(readPair(blocks[2]));
      T['pp-problem'].push(readPair(blocks[3]));
      T['pp-h'].push(readPair(blocks[4]));
      T['pp-body'].push(readPair(blocks[5]));
      T['pp-result'].push(readPair(blocks[6]));
      T['pp-vol'].push(readPair(blocks[7]));
      var enIn = (card.querySelector('[data-hp-ingr-en]') || {}).value || '';
      var arIn = (card.querySelector('[data-hp-ingr-ar]') || {}).value || '';
      ppIngr.push({
        en: enIn.split(/,\s*/).map(function (s) { return s.trim(); }).filter(Boolean),
        ar: arIn.split(/[,،]\s*/).map(function (s) { return s.trim(); }).filter(Boolean)
      });
    }

    return { S: S, T: T, ppIngr: ppIngr };
  }

  function setStatus(msg, isErr) {
    var el = document.getElementById('homepage-status');
    if (!el) return;
    el.textContent = msg || '';
    el.style.color = isErr ? 'var(--red)' : 'var(--text-s)';
  }

  function getLocalDefaults() {
    if (window.MONTANA_HOMEPAGE_DEFAULTS) {
      return JSON.parse(JSON.stringify(window.MONTANA_HOMEPAGE_DEFAULTS));
    }
    return null;
  }

  function loadDefaultsFallback(reason) {
    var content = getLocalDefaults();
    if (!content) {
      setStatus(reason || 'تعذر الاتصال — شغّلي السيرفر أو انشري آخر تحديث', true);
      return false;
    }
    HP.content = content;
    renderEditor(content);
    setStatus((reason ? reason + ' · ' : '') + 'عرض النصوص الافتراضية — الحفظ يحتاج API شغّال', true);
    return true;
  }

  async function loadHomepageEditor() {
    setStatus('جاري التحميل...');
    try {
      var r = await fetch('/api/settings/homepage');
      var text = await r.text();
      var d;
      try { d = JSON.parse(text); } catch (parseErr) {
        if (r.status === 404) {
          loadDefaultsFallback('الـ API مش منشور بعد — اعملي Deploy');
          return;
        }
        loadDefaultsFallback('رد غير صالح من السيرفر (HTTP ' + r.status + ')');
        return;
      }
      if (!d.ok) {
        if (loadDefaultsFallback(d.error || 'فشل التحميل')) return;
        setStatus(d.error || 'فشل التحميل', true);
        return;
      }
      HP.content = d.content;
      renderEditor(d.content);
      var src = d.source === 'supabase' ? 'محفوظ على Supabase' : 'النصوص الافتراضية';
      var when = d.updated_at ? ' · آخر تحديث: ' + new Date(d.updated_at).toLocaleString('ar-EG') : '';
      setStatus(src + when);
    } catch (e) {
      loadDefaultsFallback('تعذر الاتصال بالسيرفر — تأكدي إن الموقع منشور');
    }
  }

  async function saveHomepageContent() {
    var content = collectContent();
    try {
      var r = await fetch('/api/settings/homepage', {
        method: 'POST',
        headers: Object.assign({ 'Content-Type': 'application/json' }, typeof socialHeaders === 'function' ? socialHeaders() : {}),
        body: JSON.stringify({ content: content })
      });
      var d = await r.json();
      if (r.status === 401) {
        showToast('API Admin Key غلط أو ناقص — من الإعدادات');
        return;
      }
      if (!d.ok) {
        showToast(d.error || 'فشل الحفظ');
        return;
      }
      HP.content = d.content;
      showToast('تم حفظ محتوى الصفحة الرئيسية');
      setStatus('محفوظ على Supabase · ' + new Date(d.updated_at || Date.now()).toLocaleString('ar-EG'));
    } catch (e) {
      showToast('فشل الاتصال');
    }
  }

  async function resetHomepageContent() {
    if (!confirm('ترجيع كل نصوص الصفحة الرئيسية للافتراضي؟')) return;
    try {
      var r = await fetch('/api/settings/homepage', {
        method: 'POST',
        headers: Object.assign({ 'Content-Type': 'application/json' }, typeof socialHeaders === 'function' ? socialHeaders() : {}),
        body: JSON.stringify({ action: 'reset' })
      });
      var d = await r.json();
      if (!d.ok) {
        showToast(d.error || 'فشل');
        return;
      }
      HP.content = d.content;
      renderEditor(d.content);
      showToast('تم استعادة النصوص الافتراضية');
      setStatus('تم الاستعادة · ' + new Date().toLocaleString('ar-EG'));
    } catch (e) {
      showToast('فشل الاتصال');
    }
  }

  window.loadHomepageEditor = loadHomepageEditor;
  window.saveHomepageContent = saveHomepageContent;
  window.resetHomepageContent = resetHomepageContent;
})();
