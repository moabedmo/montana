const SUPABASE_URL = 'https://ikryeyqrithikabwidov.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlrcnlleXFyaXRoaWthYndpZG92Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE3MzY1ODcsImV4cCI6MjA5NzMxMjU4N30.kNfHPxV4fq67cOF8uFsTrLOxPYcLcmmDO3ScIHzI9Uo';

// Fresh token per call (not a snapshot from page load) — same fix as
// admin.js, so a long-open owner tab doesn't silently start failing once
// the initial session token expires.
async function authHeaders() {
    let token = window.__OWNER_TOKEN__ || SUPABASE_KEY;
    if (window.__ownerSb) {
        const { data } = await window.__ownerSb.auth.getSession();
        if (data?.session?.access_token) token = data.session.access_token;
    }
    return { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' };
}

function toast(msg, type = 'success') {
    const t = document.getElementById('toast');
    t.innerHTML = `<i class="fas fa-${type === 'success' ? 'check-circle' : 'exclamation-circle'}"></i> ${msg}`;
    t.className = `toast ${type} show`;
    setTimeout(() => t.classList.remove('show'), 3000);
}

function channelAr(ch) {
    const map = { web: 'الموقع', messenger: 'Messenger', instagram: 'Instagram', whatsapp: 'WhatsApp' };
    return map[ch] || ch || 'الموقع';
}

function fmtNum(n) {
    return Number(n || 0).toLocaleString('ar-EG');
}

function fmtMoney(n) {
    return fmtNum(n) + ' ج.م';
}

function statusAr(s) {
    const map = { pending: 'قيد الانتظار', confirmed: 'مؤكد', preparing: 'جاري التجهيز', shipped: 'تم الشحن', delivered: 'تم التوصيل', cancelled: 'ملغي' };
    return map[s] || s;
}

function adminPage(page) {
    return `admin.html?page=${page}`;
}

async function loadOwnerDashboard() {
    const monthEl = document.getElementById('ownerDashMonth');
    let year = null;
    let month = null;
    if (monthEl) {
        if (!monthEl.value) {
            const now = new Date();
            year = now.getFullYear();
            month = now.getMonth() + 1;
            monthEl.value = `${year}-${String(month).padStart(2, '0')}`;
        } else {
            [year, month] = monthEl.value.split('-').map(Number);
        }
    }

    try {
        const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/get_owner_dashboard`, {
            method: 'POST',
            headers: await authHeaders(),
            body: JSON.stringify({ p_year: year, p_month: month })
        });
        const d = await res.json();
        if (!res.ok) throw new Error(d.message || d.error || 'فشل تحميل لوحة المالك');

        const store = d.store || {};
        const inv = d.inventory || {};
        const invoices = d.invoices || {};
        const crm = d.crm || {};

        document.getElementById('odRevenueMonth').textContent = fmtNum(store.revenue_month);
        document.getElementById('odOrdersMonth').textContent = store.orders_month ?? 0;
        document.getElementById('odInvoicesMonth').textContent = invoices.count_month ?? 0;
        document.getElementById('odStockUnits').textContent = fmtNum(inv.total_units);

        document.getElementById('odProducts').textContent = store.products_active ?? 0;
        document.getElementById('odCustomers').textContent = store.customers_total ?? 0;
        document.getElementById('odReps').textContent = crm.active_reps ?? 0;
        document.getElementById('odVisits').textContent = crm.visits_mtd ?? 0;
        document.getElementById('odLowStock').textContent = inv.low_stock_count ?? 0;
        document.getElementById('odPendingOrders').textContent = store.pending_orders ?? 0;

        renderOwnerChannels(d.channels || []);
        renderOwnerCrm(crm);
        renderOwnerInvoices(invoices);
        renderOwnerContact(store);
        renderRecentOrders(d.recent_orders || []);
        renderOwnerLowStock(d.low_stock || [], inv);
    } catch (e) {
        console.error(e);
        toast('تعذّر تحميل لوحة المالك', 'error');
    }
}

function renderOwnerChannels(channels) {
    const el = document.getElementById('ownerChannels');
    if (!el) return;
    if (!channels.length) {
        el.innerHTML = '<p class="empty">لا توجد بيانات للفترة المحددة</p>';
        return;
    }
    el.innerHTML = `<div class="owner-channel-table">
        <div class="owner-channel-head"><span>القناة</span><span>طلبات</span><span>جلسات شات</span><span>رسائل شات</span></div>
        ${channels.map(c => `<div class="owner-channel-row">
            <span class="owner-channel-name"><i class="fab ${c.icon || 'fa-globe'}"></i> ${c.label || channelAr(c.channel)}</span>
            <span>${c.orders ?? 0}</span>
            <span>${c.chat_sessions ?? 0}</span>
            <span>${c.chat_turns ?? 0}</span>
        </div>`).join('')}
    </div>
    <p class="owner-dash-hint">رسائل الشات = عدد الرسائل المحفوظة في محادثات البوت (موقع · Messenger · Instagram · WhatsApp)</p>`;
}

function renderOwnerCrm(crm) {
    const el = document.getElementById('ownerCrm');
    if (!el) return;
    el.innerHTML = `
        <div class="owner-kv-list">
            <div class="owner-kv"><span>مندوبين نشطين</span><strong>${crm.active_reps ?? 0}</strong></div>
            <div class="owner-kv"><span>مديرو CRM</span><strong>${crm.admins ?? 0}</strong></div>
            <div class="owner-kv"><span>أطباء / صيدليات</span><strong>${crm.doctors_total ?? 0}</strong></div>
            <div class="owner-kv"><span>زيارات هذا الشهر</span><strong>${crm.visits_mtd ?? 0}</strong></div>
            <div class="owner-kv warn"><span>أطباء بانتظار الموافقة</span><strong>${crm.pending_doctors ?? 0}</strong></div>
            <div class="owner-kv warn"><span>فواتير B2B معلّقة</span><strong>${crm.pending_b2b ?? 0}</strong></div>
        </div>
        <a href="${adminPage('crm')}" class="btn-primary btn-outline owner-action-link"><i class="fas fa-users-gear"></i> فتح CRM</a>`;
}

function renderOwnerInvoices(invoices) {
    const el = document.getElementById('ownerInvoices');
    if (!el) return;
    el.innerHTML = `
        <div class="owner-kv-list">
            <div class="owner-kv"><span>فواتير الشهر</span><strong>${invoices.count_month ?? 0}</strong></div>
            <div class="owner-kv"><span>إيراد الفواتير (الشهر)</span><strong>${fmtMoney(invoices.revenue_month)}</strong></div>
            <div class="owner-kv"><span>إجمالي الفواتير</span><strong>${invoices.count_all_time ?? 0}</strong></div>
        </div>
        <a href="${adminPage('invoices')}" class="btn-primary btn-outline owner-action-link"><i class="fas fa-file-invoice"></i> الفواتير</a>`;
}

function renderOwnerContact(store) {
    const el = document.getElementById('ownerContact');
    if (!el) return;
    el.innerHTML = `
        <div class="owner-kv-list">
            <div class="owner-kv"><span>رسائل نموذج التواصل (الكل)</span><strong>${store.contact_messages ?? 0}</strong></div>
            <div class="owner-kv"><span>رسائل الشهر</span><strong>${store.contact_messages_month ?? 0}</strong></div>
            <div class="owner-kv"><span>طلبات كل الوقت</span><strong>${store.orders_all_time ?? 0}</strong></div>
            <div class="owner-kv"><span>إيرادات كل الوقت</span><strong>${fmtMoney(store.revenue_all_time)}</strong></div>
        </div>
        <a href="${adminPage('messages')}" class="btn-primary btn-outline owner-action-link"><i class="fas fa-envelope"></i> الرسائل</a>`;
}

function renderRecentOrders(orders) {
    const ordEl = document.getElementById('recentOrders');
    if (!ordEl) return;
    ordEl.innerHTML = orders.length ? orders.map(o => `
        <div class="list-row">
            <div class="list-icon"><i class="fas fa-receipt"></i></div>
            <div class="list-info">
                <h4>${o.order_number}</h4>
                <span>${o.customer_name || 'عميل'} · ${channelAr(o.chat_channel)} · ${new Date(o.created_at).toLocaleDateString('ar')}</span>
            </div>
            <span class="status ${o.status}">${statusAr(o.status)}</span>
        </div>
    `).join('') : '<p class="empty">لا توجد طلبات بعد</p>';
}

function renderOwnerLowStock(rows, inv) {
    const box = document.getElementById('lowStockAlert');
    const list = document.getElementById('lowStockList');
    if (!box || !list) return;
    const outCount = inv.out_of_stock_count ?? 0;
    if (!rows.length && !outCount) {
        box.style.display = 'none';
        return;
    }
    box.style.display = 'block';
    let html = '';
    if (outCount) html += `<p class="owner-out-stock"><i class="fas fa-circle-xmark"></i> ${outCount} منتج نفد من المخزون</p>`;
    html += rows.map(p => `<div class="owner-low-stock-row">
        <span><strong>${p.name}</strong></span>
        <span class="owner-stock-qty">${p.stock} وحدة</span>
    </div>`).join('');
    html += `<a href="${adminPage('products')}" class="btn-primary btn-outline owner-action-link"><i class="fas fa-box"></i> فتح المنتجات</a>`;
    list.innerHTML = html;
}

loadOwnerDashboard();
