// Montana AI Chat Widget - Premium Edition
(function() {
    const IS_EN =
        document.documentElement.lang === 'en' ||
        /^\/en(\/|$)/.test(location.pathname.replace(/\\/g, '/'));

    const COPY = IS_EN
        ? {
            agent: { name: 'Layla', letter: 'L', emoji: '💜' },
            status: 'Online now · Replies instantly',
            welcome: 'Hi there!',
            welcomeIntro: (name) => `I'm ${name} from Montana. I'll help you find the right formula for your skin.`,
            firstBubble: 'How can I help you today?',
            now: 'Now',
            placeholder: 'Type your message…',
            genericError: 'Something went wrong — please try again',
            serverError: "Sorry, we can't reach the server right now. Try again shortly or call us at 01234567890 📞",
            uploadBtn: 'Send transfer receipt',
            uploading: 'Uploading…',
            uploadOk: 'Receipt received ✅ We will review it and confirm your booking soon!',
            uploadFail: 'Could not upload the receipt — please try again.',
            uploadPartial: 'Receipt saved ✅ Notification delayed — we will still review your order.',
            uploadAlready: 'We already received your receipt for this order ✅',
            pickFileFirst: 'Please choose the receipt image first 📎',
            proofPending: (order) => `Your order ${order} is registered. We'll review it and contact you shortly 👇`,
            namePh: 'Full name',
            phonePh: 'Mobile number',
            addressPh: 'Full address',
            loadingGovs: 'Loading governorates…',
            govError: 'Could not load governorates',
            govOption: (name, cost) => Number(cost) > 0 ? `${name} — Shipping ${Math.round(cost)} EGP` : `${name} — Free shipping 🎁`,
            confirmOrder: 'Confirm order',
            fillFields: 'Please complete all fields',
            submitting: 'Submitting order…',
            submitFail: 'Something went wrong — please try again',
        }
        : {
            agent: { name: 'لايان', letter: 'ل', emoji: '💜' },
            status: 'متصلة الآن · بترد فوراً',
            welcome: 'أهلاً بيكي!',
            welcomeIntro: (name) => `أنا ${name} من فريق Montana. هساعدك تلاقي المنتج المناسب لبشرتك.`,
            firstBubble: 'إزاي أقدر أساعدك النهارده؟',
            now: 'الآن',
            placeholder: 'اكتب رسالتك...',
            genericError: 'حصل مشكلة، حاول تاني',
            serverError: 'عذراً، مش قادر أتواصل مع السيرفر دلوقتي. جرب تاني بعد شوية أو تواصل معانا على 01234567890 📞',
            uploadBtn: 'إرسال إيصال التحويل',
            uploading: 'جارٍ الرفع…',
            uploadOk: 'تم استلام الإيصال ✅ هنراجعه ونأكدلك الحجز قريب!',
            uploadFail: 'حصلت مشكلة في رفع الإيصال، جرّبي تاني.',
            uploadPartial: 'الإيصال اتسجّل ✅ الإشعار اتأخر شوية — هنراجع الطلب برضو.',
            uploadAlready: 'استلمنا إيصال الطلب ده قبل كده ✅ — لو محتاج تعدّل، تواصلي معانا.',
            pickFileFirst: 'اختاري صورة الإيصال الأول 📎',
            proofPending: (order) => `طلبك \`${order}\` اتسجّل ✅ هنراجعه ونكلمك قريب 💜`,
            namePh: 'الاسم بالكامل',
            phonePh: 'رقم الموبايل',
            addressPh: 'العنوان بالتفصيل',
            loadingGovs: 'جارٍ تحميل المحافظات…',
            govError: 'تعذّر تحميل المحافظات',
            govOption: (name, cost) => Number(cost) > 0 ? `${name} — شحن ${Math.round(cost)} ج.م` : `${name} — شحن مجاني 🎁`,
            confirmOrder: 'تأكيد الطلب',
            fillFields: 'من فضلك أكملي كل الحقول',
            submitting: 'جارٍ تسجيل الطلب…',
            submitFail: 'حصلت مشكلة، جرّبي تاني',
        };

    const CHAT_WIDGET_V = '13';
    const sessionId = localStorage.getItem('montana_chat_sid') || 'sid_' + Math.random().toString(36).substr(2, 9);
    localStorage.setItem('montana_chat_sid', sessionId);

    function normalizeOrderNumber(value) {
        const m = String(value || '').match(/MON-\d{5}/i);
        return m ? m[0].toUpperCase() : '';
    }

    function savePendingProof(info) {
        const order_number = normalizeOrderNumber(info?.order_number);
        if (!order_number) return;
        localStorage.setItem('montana_pending_proof', JSON.stringify({
            order_number,
            phone: info.phone || '',
            customer_name: info.customer_name || '',
        }));
    }

    function loadPendingProof() {
        try { return JSON.parse(localStorage.getItem('montana_pending_proof') || 'null'); } catch { return null; }
    }

    function scanChatForOrderNumber() {
        const text = document.getElementById('chatMessages')?.innerText || '';
        return normalizeOrderNumber(text);
    }

    async function resolveProofInfo(info) {
        const resolved = { ...(info || {}) };
        resolved.order_number = normalizeOrderNumber(resolved.order_number)
            || normalizeOrderNumber(loadPendingProof()?.order_number)
            || scanChatForOrderNumber();

        if (!resolved.order_number || !resolved.phone) {
            try {
                const r = await fetch(`/api/chat-notify?sessionId=${encodeURIComponent(sessionId)}&pendingProof=1`);
                const data = await r.json();
                const p = data.pending_proof;
                if (p?.found) {
                    resolved.order_number = resolved.order_number || normalizeOrderNumber(p.order_number);
                    resolved.phone = resolved.phone || p.phone || '';
                    resolved.customer_name = resolved.customer_name || p.customer_name || '';
                }
            } catch { /* ignore */ }
        }

        if (resolved.order_number) savePendingProof(resolved);
        return resolved;
    }

    async function prepareProofImage(file) {
        if (!file || !String(file.type || '').startsWith('image/')) return file;
        return new Promise((resolve) => {
            const img = new Image();
            const url = URL.createObjectURL(file);
            img.onload = () => {
                URL.revokeObjectURL(url);
                const max = 1200;
                let { width, height } = img;
                const scale = Math.min(1, max / Math.max(width, height, 1));
                width = Math.max(1, Math.round(width * scale));
                height = Math.max(1, Math.round(height * scale));
                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;
                canvas.getContext('2d').drawImage(img, 0, 0, width, height);
                canvas.toBlob((blob) => {
                    if (!blob) { resolve(file); return; }
                    resolve(new File([blob], 'proof.jpg', { type: 'image/jpeg' }));
                }, 'image/jpeg', 0.78);
            };
            img.onerror = () => { URL.revokeObjectURL(url); resolve(file); };
            img.src = url;
        });
    }

    async function fileToBase64(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => {
                const res = String(reader.result || '');
                const i = res.indexOf(',');
                resolve(i >= 0 ? res.slice(i + 1) : res);
            };
            reader.onerror = () => reject(new Error('read_failed'));
            reader.readAsDataURL(file);
        });
    }

    async function uploadProofForChat(file) {
        const prepared = await prepareProofImage(file);
        const proofBase64 = await fileToBase64(prepared);
        if (!proofBase64) throw new Error('empty_file');
        if (proofBase64.length > 3_500_000) throw new Error('file_too_large');
        return { proofBase64, proofMime: prepared.type || 'image/jpeg' };
    }

    function markProofDone(orderNumber) {
        const on = normalizeOrderNumber(orderNumber);
        if (on) {
            localStorage.setItem('montana_proof_done_' + on, '1');
            localStorage.removeItem('montana_pending_proof');
        }
    }

    function isProofDone(orderNumber) {
        const on = normalizeOrderNumber(orderNumber);
        return !!(on && localStorage.getItem('montana_proof_done_' + on));
    }

    // Fetch current agent
    let agent = { ...COPY.agent };
    fetch('/api/agent').then(r => r.json()).then(a => {
        if (!IS_EN && a?.name) agent = a;
        document.querySelectorAll('.mchat-agent-name').forEach(el => el.textContent = agent.name);
        document.querySelectorAll('.mchat-agent-letter').forEach(el => el.textContent = agent.letter);
        document.querySelectorAll('.mchat-agent-emoji').forEach(el => el.textContent = agent.emoji);
    }).catch(() => {});

    // Inject HTML
    document.body.insertAdjacentHTML('beforeend', `
    <!-- Chat FAB Button -->
    <div class="mchat-fab" id="chatFab" onclick="toggleChat()">
        <div class="mchat-fab-pulse"></div>
        <div class="mchat-fab-pulse delay"></div>
        <svg class="mchat-fab-icon" id="chatFabIcon" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>
        <svg class="mchat-fab-close" id="chatFabClose" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" style="display:none"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        <span class="mchat-fab-badge" id="chatBadge">1</span>
    </div>

    <!-- Chat Window -->
    <div class="mchat-window" id="chatWindow">
        <!-- Header -->
        <div class="mchat-header">
            <div class="mchat-header-content">
                <div class="mchat-avatar">
                    <div class="mchat-avatar-inner">
                        <span class="mchat-agent-letter">${agent.letter}</span>
                    </div>
                    <span class="mchat-online-dot"></span>
                </div>
                <div class="mchat-header-info">
                    <h4 class="mchat-agent-name">${agent.name}</h4>
                    <div class="mchat-status">
                        <span class="mchat-status-dot"></span>
                        <span>${COPY.status}</span>
                    </div>
                </div>
                <button class="mchat-close" onclick="toggleChat()">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
            </div>
        </div>

        <!-- Messages -->
        <div class="mchat-messages" id="chatMessages"></div>

        <div class="mchat-composer">
            <input type="text" id="chatInput" placeholder="${COPY.placeholder}" onkeydown="if(event.key==='Enter')sendMessage()" autocomplete="off">
            <button type="button" class="mchat-send" id="chatSendBtn" onclick="sendMessage()" aria-label="${IS_EN ? 'Send' : 'إرسال'}">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 2L11 13"/><path d="M22 2L15 22L11 13L2 9L22 2Z"/></svg>
            </button>
        </div>

        <!-- Powered By -->
        <div class="mchat-powered">
            <span>Montana AI</span>
        </div>
    </div>
    `);

    // Inject CSS
    const style = document.createElement('style');
    style.textContent = `
    /* Montana Chat — premium dark glass (scoped, beats premium.css) */
    .mchat-fab {
        position: fixed; bottom: 24px; left: 24px;
        width: 58px; height: 58px; border-radius: 50%;
        background: linear-gradient(145deg, #b8922e 0%, #9B6CB8 55%, #6b4d88 100%);
        display: flex; align-items: center; justify-content: center;
        cursor: pointer; z-index: 9999;
        box-shadow: 0 10px 32px rgba(0,0,0,0.35), 0 0 0 1px rgba(255,255,255,0.12);
        transition: transform 0.25s ease, box-shadow 0.25s ease, opacity 0.2s ease;
        transition: transform 0.25s ease, box-shadow 0.25s ease;
    }
    .mchat-fab:hover { transform: translateY(-2px) scale(1.04); box-shadow: 0 14px 40px rgba(155,108,184,0.45); }
    .mchat-fab:active { transform: scale(0.96); }
    .mchat-fab-icon, .mchat-fab-close { width: 24px; height: 24px; position: relative; z-index: 2; }
    .mchat-fab-pulse {
        position: absolute; inset: -2px; border-radius: 50%;
        border: 1px solid rgba(201,168,76,0.35);
        animation: mchatFabPulse 3s ease-out infinite;
        pointer-events: none;
    }
    .mchat-fab-pulse.delay { animation-delay: 1.5s; }
    @keyframes mchatFabPulse { 0% { transform: scale(1); opacity: 0.7; } 100% { transform: scale(1.35); opacity: 0; } }
    .mchat-fab-badge {
        position: absolute; top: -2px; right: -2px;
        background: #e74c3c; color: #fff; font-size: 10px; min-width: 18px; height: 18px;
        border-radius: 9px; display: flex; align-items: center; justify-content: center;
        font-weight: 800; font-family: 'Tajawal', sans-serif; border: 2px solid #12081f; z-index: 3;
    }

    #chatWindow.mchat-window {
        position: fixed; bottom: 96px; left: 24px;
        width: 390px; max-width: calc(100vw - 32px); height: min(580px, calc(100vh - 120px));
        background: linear-gradient(165deg, #1a0f2e 0%, #12081f 48%, #0d0618 100%) !important;
        border: 1px solid rgba(255,255,255,0.1) !important;
        border-radius: 22px !important;
        box-shadow: 0 24px 64px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.06) !important;
        z-index: 9998; display: none; flex-direction: column; overflow: hidden;
        font-family: 'Tajawal', sans-serif; direction: rtl;
        backdrop-filter: blur(18px);
    }
    #chatWindow.mchat-window.open { display: flex; animation: mchatOpen 0.38s cubic-bezier(0.22, 1, 0.36, 1); }
    @keyframes mchatOpen { from { opacity: 0; transform: translateY(16px) scale(0.97); } to { opacity: 1; transform: none; } }

    #chatWindow .mchat-header {
        position: relative; padding: 16px 18px;
        background: linear-gradient(135deg, rgba(155,108,184,0.35), rgba(94,61,122,0.2)) !important;
        border-bottom: 1px solid rgba(255,255,255,0.08) !important;
    }
    #chatWindow .mchat-header-content {
        position: relative; display: flex; align-items: center; gap: 12px;
        background: transparent !important;
    }
    #chatWindow .mchat-header-info { background: transparent !important; }

    #chatWindow .mchat-avatar { position: relative; flex-shrink: 0; }
    #chatWindow .mchat-avatar-inner {
        width: 42px; height: 42px; border-radius: 50%;
        background: linear-gradient(145deg, #9B6CB8, #5e3d7a);
        border: 2px solid rgba(201,168,76,0.45);
        display: flex; align-items: center; justify-content: center;
        font-size: 17px; font-weight: 800; color: #fff;
        box-shadow: 0 4px 14px rgba(0,0,0,0.25);
    }
    #chatWindow .mchat-online-dot {
        position: absolute; bottom: 0; right: 0;
        width: 11px; height: 11px; border-radius: 50%;
        background: #4ade80; border: 2px solid #1a0f2e;
    }
    #chatWindow .mchat-header-info { flex: 1; min-width: 0; }
    #chatWindow .mchat-header-info h4 { font-size: 15px; font-weight: 800; color: #fff !important; margin: 0; }
    #chatWindow .mchat-status { display: flex; align-items: center; gap: 6px; margin-top: 2px; }
    #chatWindow .mchat-status-dot { width: 6px; height: 6px; border-radius: 50%; background: #4ade80; }
    #chatWindow .mchat-status span { font-size: 11px; color: rgba(255,255,255,0.62) !important; }

    #chatWindow .mchat-close {
        margin-right: auto; width: 34px; height: 34px; border-radius: 50%; border: none;
        background: rgba(255,255,255,0.08); color: rgba(255,255,255,0.85);
        display: flex; align-items: center; justify-content: center; cursor: pointer;
        transition: background 0.2s, transform 0.2s;
    }
    #chatWindow .mchat-close svg { width: 16px; height: 16px; }
    #chatWindow .mchat-close:hover { background: rgba(255,255,255,0.14); transform: rotate(90deg); }

    #chatWindow .mchat-messages {
        flex: 1; overflow-y: auto; padding: 16px 16px 12px;
        display: flex; flex-direction: column; gap: 12px;
        background: transparent !important;
        background-image: none !important;
    }
    #chatWindow .mchat-messages::-webkit-scrollbar { width: 4px; }
    #chatWindow .mchat-messages::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.12); border-radius: 4px; }

    #chatWindow .mchat-msg { max-width: 92%; animation: mchatMsgIn 0.35s ease; }
    #chatWindow .mchat-msg.bot { align-self: flex-start; }
    #chatWindow .mchat-msg.user { align-self: flex-end; }
    @keyframes mchatMsgIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }

    #chatWindow .mchat-bubble-wrap { display: flex; flex-direction: column; gap: 4px; max-width: 100%; }
    #chatWindow .mchat-bubble {
        padding: 12px 14px; font-size: 13.5px; line-height: 1.65;
        white-space: pre-wrap; word-break: break-word;
    }
    #chatWindow .mchat-msg.bot .mchat-bubble {
        background: rgba(255,255,255,0.07) !important;
        border: 1px solid rgba(255,255,255,0.1) !important;
        color: rgba(255,255,255,0.92) !important;
        border-radius: 6px 18px 18px 18px !important;
        box-shadow: 0 4px 16px rgba(0,0,0,0.15) !important;
    }
    #chatWindow .mchat-msg.user .mchat-bubble {
        background: linear-gradient(135deg, #9B6CB8, #7d53a0) !important;
        border: 1px solid rgba(255,255,255,0.12) !important;
        color: #fff !important;
        border-radius: 18px 6px 18px 18px !important;
        box-shadow: 0 6px 20px rgba(155,108,184,0.28) !important;
    }

    #chatWindow .mchat-time { font-size: 10px; color: rgba(255,255,255,0.35); padding: 0 6px; }
    #chatWindow .mchat-msg.user .mchat-time { text-align: left; }

    #chatWindow .mchat-typing-wrap { align-self: flex-start; }
    #chatWindow .mchat-typing {
        display: flex; gap: 5px; padding: 12px 16px;
        background: rgba(255,255,255,0.07); border: 1px solid rgba(255,255,255,0.08);
        border-radius: 6px 18px 18px 18px;
    }
    #chatWindow .mchat-typing span {
        width: 7px; height: 7px; border-radius: 50%; background: rgba(201,168,76,0.85);
        animation: mchatTypeDot 1.2s ease-in-out infinite;
    }
    #chatWindow .mchat-typing span:nth-child(2) { animation-delay: 0.15s; }
    #chatWindow .mchat-typing span:nth-child(3) { animation-delay: 0.3s; }
    @keyframes mchatTypeDot { 0%,60%,100% { opacity: 0.35; transform: translateY(0); } 30% { opacity: 1; transform: translateY(-4px); } }

    #chatWindow .mchat-composer {
        display: flex; align-items: center; gap: 10px;
        padding: 12px 14px 10px;
        background: rgba(0,0,0,0.22) !important;
        border-top: 1px solid rgba(255,255,255,0.08) !important;
    }
    #chatWindow .mchat-composer input {
        flex: 1; min-width: 0;
        border: 1px solid rgba(255,255,255,0.1); border-radius: 14px;
        background: rgba(255,255,255,0.06) !important;
        padding: 11px 14px; font-size: 13px;
        font-family: 'Tajawal', sans-serif; outline: none;
        color: #fff !important;
        transition: border-color 0.2s, box-shadow 0.2s;
    }
    #chatWindow .mchat-composer input::placeholder { color: rgba(255,255,255,0.38) !important; }
    #chatWindow .mchat-composer input:focus {
        border-color: rgba(155,108,184,0.55);
        box-shadow: 0 0 0 3px rgba(155,108,184,0.15);
    }
    #chatWindow .mchat-send {
        width: 44px; height: 44px; border-radius: 14px; border: none; flex-shrink: 0;
        background: linear-gradient(135deg, #C9A84C, #9B6CB8) !important;
        color: #12081f; display: flex; align-items: center; justify-content: center;
        cursor: pointer; transition: transform 0.2s, box-shadow 0.2s;
        box-shadow: 0 4px 14px rgba(201,168,76,0.25);
    }
    #chatWindow .mchat-send svg { width: 18px; height: 18px; transform: scaleX(-1); }
    #chatWindow .mchat-send:hover { transform: translateY(-1px); box-shadow: 0 6px 18px rgba(201,168,76,0.35); }
    #chatWindow .mchat-send:active { transform: scale(0.96); }

    #chatWindow .mchat-powered {
        text-align: center; padding: 7px 10px 10px;
        font-size: 10px; letter-spacing: 0.04em;
        color: rgba(255,255,255,0.28) !important;
        background: transparent !important;
    }

    #chatWindow .mchat-proof-box,
    #chatWindow .mchat-order-form {
        border-radius: 14px; padding: 12px; margin: 0; max-width: 100%;
        background: rgba(255,255,255,0.05) !important;
        border: 1px dashed rgba(201,168,76,0.35) !important;
    }
    #chatWindow .mchat-order-form { border-style: solid; border-color: rgba(155,108,184,0.35) !important; }
    #chatWindow .mchat-proof-title { font-size: 12px; font-weight: 700; color: rgba(255,255,255,0.85); margin-bottom: 8px; }
    #chatWindow .mchat-proof-order { font-family: ui-monospace, monospace; direction: ltr; display: inline-block; color: #C9A84C; }
    #chatWindow .mchat-proof-box input[type="file"] { width: 100%; font-size: 11px; margin-bottom: 8px; color: rgba(255,255,255,0.7); }
    #chatWindow .mchat-proof-box button,
    #chatWindow .mchat-order-form button {
        width: 100%; padding: 9px; border: none; border-radius: 12px;
        background: linear-gradient(135deg, #C9A84C, #9B6CB8); color: #12081f;
        font-size: 12px; font-weight: 800; font-family: 'Tajawal', sans-serif; cursor: pointer;
    }
    #chatWindow .mchat-order-form input,
    #chatWindow .mchat-order-form textarea,
    #chatWindow .mchat-order-form select {
        border: 1px solid rgba(255,255,255,0.12); border-radius: 10px; padding: 8px 10px;
        font-size: 12px; font-family: 'Tajawal', sans-serif;
        color: #fff !important; background: rgba(0,0,0,0.25) !important; outline: none;
    }
    #chatWindow .mchat-order-form-err { color: #f87171; font-size: 11px; }

    @media (max-width: 768px) {
        .mchat-fab { bottom: 84px; left: 16px; width: 54px; height: 54px; }
        /* While the page is scrolling, shrink to a small dot so it never sits
           on top of a product card's own action button — expands back once
           scrolling settles. */
        .mchat-fab.mchat-fab--scrolling {
            width: 34px; height: 34px; opacity: 0.55; box-shadow: none;
        }
        .mchat-fab.mchat-fab--scrolling .mchat-fab-icon,
        .mchat-fab.mchat-fab--scrolling .mchat-fab-close { transform: scale(0.7); }
        .mchat-fab.mchat-fab--scrolling .mchat-fab-badge,
        .mchat-fab.mchat-fab--scrolling .mchat-fab-pulse { display: none; }
        #chatWindow.mchat-window {
            bottom: 0; left: 0; right: 0; top: 0; width: 100%; height: 100%;
            max-width: none; border-radius: 0 !important;
        }
        #chatWindow.mchat-window.open { animation: mchatOpenMobile 0.32s ease; }
        @keyframes mchatOpenMobile { from { transform: translateY(100%); } to { transform: none; } }
    }
    `;
    document.head.appendChild(style);

    // Shrink the FAB while the page is scrolling on mobile so it never blocks
    // a product card's own action button underneath it — restores full size
    // shortly after the user stops scrolling.
    (function setupFabScrollShrink() {
        const fab = document.getElementById('chatFab');
        if (!fab) return;
        let scrollTimer = null;
        window.addEventListener('scroll', () => {
            if (window.innerWidth > 768) return;
            fab.classList.add('mchat-fab--scrolling');
            clearTimeout(scrollTimer);
            scrollTimer = setTimeout(() => fab.classList.remove('mchat-fab--scrolling'), 500);
        }, { passive: true });
    })();

    // Restore proof upload box if customer refreshed after placing order.
    async function restorePendingProofBox() {
        if (document.querySelector('.mchat-proof-box')) return;
        try {
            const r = await fetch(`/api/chat-notify?sessionId=${encodeURIComponent(sessionId)}&pendingProof=1`);
            const data = await r.json();
            const pending = data.pending_proof;
            if (pending?.found && pending.order_number && pending.phone) {
                if (isProofDone(pending.order_number)) return;
                renderProofBox({
                    order_number: pending.order_number,
                    phone: pending.phone,
                    customer_name: pending.customer_name,
                }, { skipIntro: false });
            }
        } catch { /* ignore */ }
    }

    // ===== FUNCTIONS =====
    window.toggleChat = function() {
        const win = document.getElementById('chatWindow');
        const isOpen = win.classList.toggle('open');
        document.getElementById('chatFabIcon').style.display = isOpen ? 'none' : '';
        document.getElementById('chatFabClose').style.display = isOpen ? '' : 'none';
        document.getElementById('chatBadge').style.display = 'none';

        // Stop pulses when open
        document.querySelectorAll('.mchat-fab-pulse').forEach(p => p.style.display = isOpen ? 'none' : '');

        if (isOpen) {
            setTimeout(() => document.getElementById('chatInput').focus(), 300);
            const msgs = document.getElementById('chatMessages');
            msgs.scrollTop = msgs.scrollHeight;
            restorePendingProofBox();
            pollConfirmNotification();
        }
    };

    window.sendMessage = function() {
        const input = document.getElementById('chatInput');
        const text = input.value.trim();
        if (!text) return;
        input.value = '';
        sendMsg(text);
    };

    function sendMsg(text) {
        const msgs = document.getElementById('chatMessages');
        const now = new Date().toLocaleTimeString(IS_EN ? 'en-GB' : 'ar', { hour: '2-digit', minute: '2-digit' });

        // User message
        msgs.insertAdjacentHTML('beforeend', `
            <div class="mchat-msg user">
                <div class="mchat-bubble-wrap">
                    <div class="mchat-bubble">${escapeHtml(text)}</div>
                    <span class="mchat-time">${now}</span>
                </div>
            </div>
        `);
        msgs.scrollTop = msgs.scrollHeight;

        // Typing indicator
        msgs.insertAdjacentHTML('beforeend', `
            <div class="mchat-typing-wrap" id="typing">
                <div class="mchat-typing"><span></span><span></span><span></span></div>
            </div>
        `);
        msgs.scrollTop = msgs.scrollHeight;

        // API call — the reply is held back (typing indicator stays up) until
        // at least MIN_REPLY_DELAY_MS has passed since the message was sent,
        // so the bot feels like someone actually typing instead of an
        // instant, obviously-automated response. Only adds wait time on top
        // of whatever's left after the real API call — a slow API response
        // never gets an extra flat 10s stacked on top of it.
        const MIN_REPLY_DELAY_MS = 10000;
        const sentAt = Date.now();
        fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: text, sessionId })
        })
        .then(r => r.json())
        .then(data => {
            const remaining = MIN_REPLY_DELAY_MS - (Date.now() - sentAt);
            setTimeout(() => {
                document.getElementById('typing')?.remove();
                const reply = data.reply || data.error || COPY.genericError;
                typeMessage(reply, now);
                if (data.awaitingProof) renderProofBox(data.awaitingProof, { skipIntro: true });
                if (data.showOrderForm) renderCheckoutForm();
            }, Math.max(0, remaining));
        })
        .catch(() => {
            const remaining = MIN_REPLY_DELAY_MS - (Date.now() - sentAt);
            setTimeout(() => {
                document.getElementById('typing')?.remove();
                addBotMsg(COPY.serverError, now);
            }, Math.max(0, remaining));
        });
    }

    // Splits a long reply into separate bubbles (on blank lines) so it reads
    // like a person texting in a few messages instead of one wall of text.
    function splitReplyIntoBubbles(text) {
        const parts = String(text || '').split(/\n\s*\n+/).map(p => p.trim()).filter(Boolean);
        return parts.length ? parts : [text];
    }

    // Typewriter effect for one bubble, calls onDone when finished.
    function typeOneBubble(text, time, onDone) {
        const msgs = document.getElementById('chatMessages');
        const formatted = formatReply(text);

        const msgEl = document.createElement('div');
        msgEl.className = 'mchat-msg bot';
        msgEl.innerHTML = `
            <div class="mchat-bubble-wrap">
                <div class="mchat-bubble" id="typeTarget"></div>
                <span class="mchat-time">${time}</span>
            </div>
        `;
        msgs.appendChild(msgEl);

        const target = document.getElementById('typeTarget');
        let i = 0;
        const chars = formatted;
        const speed = Math.max(8, 30 - text.length / 20);

        function type() {
            if (i < chars.length) {
                // Handle HTML tags
                if (chars[i] === '<') {
                    const closeTag = chars.indexOf('>', i);
                    target.innerHTML += chars.substring(i, closeTag + 1);
                    i = closeTag + 1;
                } else {
                    target.innerHTML += chars[i];
                    i++;
                }
                msgs.scrollTop = msgs.scrollHeight;
                setTimeout(type, speed);
            } else {
                target.removeAttribute('id');
                if (onDone) onDone();
            }
        }
        type();
    }

    // Renders a reply as a sequence of bubbles, with a short typing pause
    // between each so multi-part replies feel like natural texting.
    function typeMessage(text, time) {
        const msgs = document.getElementById('chatMessages');
        const parts = splitReplyIntoBubbles(text);

        function renderPart(idx) {
            if (idx >= parts.length) return;
            const isLast = idx === parts.length - 1;
            typeOneBubble(parts[idx], time, () => {
                if (isLast) return;
                msgs.insertAdjacentHTML('beforeend', `
                    <div class="mchat-typing-wrap" id="typingBetween">
                        <div class="mchat-typing"><span></span><span></span><span></span></div>
                    </div>
                `);
                msgs.scrollTop = msgs.scrollHeight;
                setTimeout(() => {
                    document.getElementById('typingBetween')?.remove();
                    renderPart(idx + 1);
                }, 500 + Math.random() * 400);
            });
        }
        renderPart(0);
    }

    function addBotMsg(text, time) {
        const msgs = document.getElementById('chatMessages');
        msgs.insertAdjacentHTML('beforeend', `
            <div class="mchat-msg bot">
                <div class="mchat-bubble-wrap">
                    <div class="mchat-bubble">${formatReply(text)}</div>
                    <span class="mchat-time">${time}</span>
                </div>
            </div>
        `);
        msgs.scrollTop = msgs.scrollHeight;
    }

    function escapeHtml(text) {
        const d = document.createElement('div');
        d.textContent = text;
        return d.innerHTML;
    }

    function formatReply(text) {
        const safe = escapeHtml(text || '');
        return safe
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\n/g, '<br>');
    }

    // Shown right after create_order() succeeds (see api/chat.js's
    // `awaitingProof` marker) — lets the customer attach the deposit
    // transfer screenshot without leaving the chat.
    async function renderProofBox(info, { skipIntro } = {}) {
        if (document.querySelector('.mchat-proof-box')) return;
        const resolved = await resolveProofInfo(info);
        if (!resolved.order_number) {
            const time = new Date().toLocaleTimeString(IS_EN ? 'en-GB' : 'ar', { hour: '2-digit', minute: '2-digit' });
            addBotMsg(IS_EN ? 'Order number missing — tell us your order number or contact support.' : 'مش لاقيين رقم الطلب — اكتبي رقم الطلب MON-XXXXX أو تواصلي معانا 📞', time);
            return;
        }
        if (isProofDone(resolved.order_number)) return;
        const msgs = document.getElementById('chatMessages');
        const boxId = 'proofBox_' + Date.now();
        const orderNum = resolved.order_number;

        if (!skipIntro && orderNum) {
            const time = new Date().toLocaleTimeString(IS_EN ? 'en-GB' : 'ar', { hour: '2-digit', minute: '2-digit' });
            addBotMsg(COPY.proofPending(orderNum), time);
        }

        msgs.insertAdjacentHTML('beforeend', `
            <div class="mchat-proof-box" id="${boxId}">
                <div class="mchat-proof-title">${IS_EN ? 'Transfer receipt' : 'إيصال التحويل'} · <span class="mchat-proof-order">${escapeHtml(orderNum)}</span></div>
                <input type="file" accept="image/*" id="${boxId}_file">
                <img class="mchat-proof-preview" id="${boxId}_preview" style="display:none">
                <button id="${boxId}_btn">${COPY.uploadBtn}</button>
            </div>
        `);
        msgs.scrollTop = msgs.scrollHeight;

        const fileInput = document.getElementById(`${boxId}_file`);
        const preview = document.getElementById(`${boxId}_preview`);
        const btn = document.getElementById(`${boxId}_btn`);

        fileInput.addEventListener('change', () => {
            const file = fileInput.files[0];
            if (!file) { preview.style.display = 'none'; return; }
            preview.src = URL.createObjectURL(file);
            preview.style.display = 'block';
        });

        btn.addEventListener('click', async () => {
            const file = fileInput.files[0];
            if (!file) {
                addBotMsg(COPY.pickFileFirst, new Date().toLocaleTimeString(IS_EN ? 'en-GB' : 'ar', { hour: '2-digit', minute: '2-digit' }));
                return;
            }
            if (isProofDone(resolved.order_number)) {
                addBotMsg(COPY.uploadAlready, new Date().toLocaleTimeString(IS_EN ? 'en-GB' : 'ar', { hour: '2-digit', minute: '2-digit' }));
                document.getElementById(boxId)?.remove();
                return;
            }
            btn.disabled = true;
            btn.textContent = COPY.uploading;
            const time = new Date().toLocaleTimeString(IS_EN ? 'en-GB' : 'ar', { hour: '2-digit', minute: '2-digit' });
            try {
                const fresh = await resolveProofInfo(resolved);
                const orderNumLive = fresh.order_number;
                const phoneDigits = String(fresh.phone || '').replace(/[^\d]/g, '') || 'order';
                if (!orderNumLive) throw new Error('invalid_order');
                const uploaded = await uploadProofForChat(file);
                const tgRes = await fetch('/api/send-telegram', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        attach_proof: true,
                        order_number: orderNumLive,
                        phone: fresh.phone || phoneDigits,
                        chat_session_id: sessionId,
                        proof_base64: uploaded.proofBase64,
                        proof_mime: uploaded.proofMime,
                        deposit_amount: 0,
                        customer_name: fresh.customer_name || null,
                        is_proof_update: true,
                    }),
                });
                let tgData = {};
                try { tgData = await tgRes.json(); } catch { tgData = {}; }
                if (tgData.ok || tgData.proof_saved) {
                    markProofDone(orderNumLive);
                    document.getElementById(boxId)?.remove();
                    addBotMsg(tgData.telegram_delayed ? COPY.uploadPartial : COPY.uploadOk, time);
                    return;
                }
                if (tgRes.status === 429) throw new Error('rate_limit');
                throw new Error(tgData.error || `server ${tgRes.status}`);
            } catch (e) {
                console.error('[chat proof upload]', e);
                btn.disabled = false;
                btn.textContent = COPY.uploadBtn;
                addBotMsg(COPY.uploadFail, time);
            }
        });
    }

    // Shown after show_checkout_form() — real form fields instead of
    // trusting the model to correctly parse name/phone/address/
    // governorate out of free text (see api/chat.js for why).
    async function renderCheckoutForm() {
        if (document.querySelector('.mchat-order-form')) return;
        const msgs = document.getElementById('chatMessages');
        const boxId = 'orderForm_' + Date.now();
        msgs.insertAdjacentHTML('beforeend', `
            <div class="mchat-order-form" id="${boxId}">
                <input type="text" id="${boxId}_name" placeholder="${COPY.namePh}">
                <input type="tel" id="${boxId}_phone" placeholder="${COPY.phonePh}" dir="ltr">
                <textarea id="${boxId}_address" placeholder="${COPY.addressPh}"></textarea>
                <select id="${boxId}_gov"><option value="">${COPY.loadingGovs}</option></select>
                <span class="mchat-order-form-err" id="${boxId}_err" style="display:none"></span>
                <button id="${boxId}_btn">${COPY.confirmOrder}</button>
            </div>
        `);
        msgs.scrollTop = msgs.scrollHeight;

        const govSelect = document.getElementById(`${boxId}_gov`);
        try {
            const { shipping } = await import('/js/store-api.js');
            const [rates, cartRes] = await Promise.all([
                shipping.list(),
                fetch('/api/chat', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ sessionId, getCart: true }),
                }).then((r) => r.json()).catch(() => ({})),
            ]);
            const freeShip = !!cartRes.freeShipping;
            govSelect.innerHTML = rates.map((r) => {
                const cost = freeShip ? 0 : (Number(r.cost) || 0);
                return `<option value="${r.governorate}">${COPY.govOption(r.governorate, cost)}</option>`;
            }).join('');
        } catch (e) {
            govSelect.innerHTML = `<option value="">${COPY.govError}</option>`;
        }

        document.getElementById(`${boxId}_btn`).addEventListener('click', async () => {
            const name = document.getElementById(`${boxId}_name`).value.trim();
            const phone = document.getElementById(`${boxId}_phone`).value.trim();
            const address = document.getElementById(`${boxId}_address`).value.trim();
            const governorate = govSelect.value;
            const errEl = document.getElementById(`${boxId}_err`);

            if (!name || !phone || !address || !governorate) {
                errEl.textContent = COPY.fillFields;
                errEl.style.display = 'block';
                return;
            }
            errEl.style.display = 'none';

            const btn = document.getElementById(`${boxId}_btn`);
            btn.disabled = true;
            btn.textContent = COPY.submitting;
            const time = new Date().toLocaleTimeString(IS_EN ? 'en-GB' : 'ar', { hour: '2-digit', minute: '2-digit' });

            try {
                const res = await fetch('/api/chat', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ sessionId, formSubmit: { name, phone, address, governorate } })
                });
                const data = await res.json();
                document.getElementById(boxId)?.remove();
                addBotMsg(data.reply || COPY.genericError, time);
                if (data.awaitingProof) renderProofBox(data.awaitingProof, { skipIntro: true });
            } catch (e) {
                btn.disabled = false;
                btn.textContent = COPY.confirmOrder;
                errEl.textContent = COPY.submitFail;
                errEl.style.display = 'block';
            }
        });
    }

    // When admin confirms via Telegram, push message into open chat.
    let lastNotifyOrder = '';

    async function pollConfirmNotification() {
        try {
            const r = await fetch(`/api/chat-notify?sessionId=${encodeURIComponent(sessionId)}`);
            const data = await r.json();
            if (!data?.message) return;
            if (data.order_number && data.order_number === lastNotifyOrder) return;
            lastNotifyOrder = data.order_number || 'done';
            const time = new Date().toLocaleTimeString(IS_EN ? 'en-GB' : 'ar', { hour: '2-digit', minute: '2-digit' });
            addBotMsg(data.message.replace(/\*\*/g, ''), time);
            const win = document.getElementById('chatWindow');
            if (win && !win.classList.contains('open')) {
                const badge = document.getElementById('chatBadge');
                if (badge) { badge.style.display = ''; badge.textContent = '1'; }
            }
        } catch { /* ignore */ }
    }

    setInterval(() => {
        const win = document.getElementById('chatWindow');
        if (!win?.classList.contains('open')) return;
        pollConfirmNotification();
    }, 5000);
})();
