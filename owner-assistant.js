// Mohamed Abed assistant — WhatsApp-style UI for owner dashboard
(function () {
  const HIST_KEY = 'montana_oa_history_v1';
  let busy = false;
  let greeted = false;

  function $(id) { return document.getElementById(id); }

  function loadHistory() {
    try { return JSON.parse(localStorage.getItem(HIST_KEY) || '[]'); } catch { return []; }
  }

  function saveHistory(h) {
    try { localStorage.setItem(HIST_KEY, JSON.stringify(h.slice(-40))); } catch { /* private */ }
  }

  function fmtTime() {
    return new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Cairo' });
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function formatBubble(text) {
    let t = escapeHtml(text);
    t = t.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    t = t.replace(/\n/g, '<br>');
    return t;
  }

  function appendMsg(role, text, opts = {}) {
    const box = $('oaMessages');
    if (!box) return;
    const el = document.createElement('div');
    el.className = `oa-msg oa-${role}${opts.pending ? ' oa-pending' : ''}`;
    el.innerHTML = `
      <div class="oa-bubble">${formatBubble(text)}</div>
      <div class="oa-time">${fmtTime()}</div>`;
    box.appendChild(el);
    box.scrollTop = box.scrollHeight;
    return el;
  }

  function renderAll() {
    const box = $('oaMessages');
    if (!box) return;
    box.innerHTML = '';
    const hist = loadHistory();
    if (!hist.length) {
      appendMsg('assistant', 'أهلاً يا فندم 👋\nأنا **محمد عابد**، أسيستنت أعمال مونتانيا.\nاسألني عن المخزون، الفواتير المتأخرة، طلبات النهاردة، أداء المندوبين، أو اطلب تقرير CSV.');
      greeted = true;
      return;
    }
    hist.forEach((m) => appendMsg(m.role === 'user' ? 'user' : 'assistant', m.text));
    greeted = true;
  }

  async function getToken() {
    let token = window.__OWNER_TOKEN__;
    if (window.__ownerSb) {
      const { data } = await window.__ownerSb.auth.getSession();
      if (data?.session?.access_token) token = data.session.access_token;
    }
    return token;
  }

  function triggerDownload(download) {
    if (!download?.csv || !download?.filename) return;
    const blob = new Blob([download.csv], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = download.filename;
    a.click();
    URL.revokeObjectURL(a.href);
    if (typeof toast === 'function') toast(`تم تنزيل ${download.filename}`);
  }

  async function sendMessage(raw) {
    const text = String(raw || '').trim();
    if (!text || busy) return;
    busy = true;
    const input = $('oaInput');
    const sendBtn = $('oaSend');
    if (input) input.value = '';
    if (sendBtn) sendBtn.disabled = true;
    $('oaStatus').textContent = 'بيفكر…';

    const hist = loadHistory();
    hist.push({ role: 'user', text });
    saveHistory(hist);
    appendMsg('user', text);
    const pending = appendMsg('assistant', '…', { pending: true });

    try {
      const token = await getToken();
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          owner_assistant: true,
          message: text,
          history: hist.slice(0, -1).map((m) => ({
            role: m.role === 'user' ? 'user' : 'model',
            text: m.text,
          })),
        }),
      });
      const data = await res.json();
      pending?.remove();
      if (!res.ok || !data.ok) {
        appendMsg('assistant', data.error || 'حصلت مشكلة — حاول تاني.');
      } else {
        hist.push({ role: 'assistant', text: data.reply });
        saveHistory(hist);
        appendMsg('assistant', data.reply);
        if (data.download) triggerDownload(data.download);
      }
    } catch (e) {
      pending?.remove();
      appendMsg('assistant', 'مفيش اتصال دلوقتي — تأكد من الشبكة وحاول تاني.');
    } finally {
      busy = false;
      if (sendBtn) sendBtn.disabled = false;
      $('oaStatus').textContent = 'أسيستنت أعمال مونتانيا · متصل';
      input?.focus();
    }
  }

  window.openOwnerAssistant = () => {
    const shell = $('oaShell');
    if (!shell) return;
    shell.hidden = false;
    document.body.classList.add('oa-open');
    if (!greeted) renderAll();
    setTimeout(() => $('oaInput')?.focus(), 200);
  };

  window.closeOwnerAssistant = () => {
    const shell = $('oaShell');
    if (!shell) return;
    shell.hidden = true;
    document.body.classList.remove('oa-open');
  };

  window.oaClearChat = () => {
    if (!confirm('بداية محادثة جديدة مع محمد عابد؟')) return;
    localStorage.removeItem(HIST_KEY);
    greeted = false;
    renderAll();
  };

  document.addEventListener('DOMContentLoaded', () => {
    // Scripts load after auth — DOM already ready; init now too
  });

  // Init immediately (script appended after auth gate)
  $('oaForm')?.addEventListener('submit', (e) => {
    e.preventDefault();
    sendMessage($('oaInput')?.value);
  });

  $('oaChips')?.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-q]');
    if (!btn) return;
    sendMessage(btn.dataset.q);
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !$('oaShell')?.hidden) closeOwnerAssistant();
  });
})();
