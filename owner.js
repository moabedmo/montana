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
    const map = {
        web: 'الموقع',
        messenger: 'فيسبوك / Messenger',
        facebook: 'فيسبوك / Messenger',
        instagram: 'Instagram',
        manychat: 'فيسبوك / إنستجرام (ManyChat)',
        whatsapp: 'WhatsApp',
    };
    return map[ch] || ch || 'الموقع';
}

function fmtNum(n) {
    return Number(n || 0).toLocaleString('ar-EG');
}

function fmtMoney(n) {
    return fmtNum(Math.round(Number(n || 0))) + ' ج.م';
}

function statusAr(s) {
    const map = { pending: 'قيد الانتظار', confirmed: 'مؤكد', preparing: 'جاري التجهيز', shipped: 'تم الشحن', delivered: 'تم التوصيل', cancelled: 'ملغي' };
    return map[s] || s;
}

function pharmStatusAr(s) {
    const map = { paid: 'مدفوعة', open: 'مفتوحة', overdue: 'متأخرة', no_date: 'بدون موعد' };
    return map[s] || s || '—';
}

function adminPage(page) {
    return `admin.html?page=${page}`;
}

function pharmacyInvoicesPage(viewId) {
    let url = 'crm/admin/?page=pharmacy-invoices&standalone=1';
    if (viewId) url += `&view=${encodeURIComponent(viewId)}`;
    return url;
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
        const pharm = d.pharmacy_ar || {};

        document.getElementById('odRevenueMonth').textContent = fmtNum(store.revenue_month);
        document.getElementById('odOrdersMonth').textContent = store.orders_month ?? 0;
        document.getElementById('odSocialMonth').textContent = store.orders_social_month ?? 0;
        const fb = store.orders_facebook_month ?? 0;
        const ig = store.orders_instagram_month ?? 0;
        const mc = store.orders_manychat_month ?? 0;
        document.getElementById('odFbMonth').textContent = `${fb} · ${ig} · ${mc}`;

        document.getElementById('odPharmCount').textContent = pharm.count_all ?? 0;
        document.getElementById('odPharmCollected').textContent = fmtNum(pharm.collected_all);
        document.getElementById('odPharmRemain').textContent = fmtNum(pharm.remaining_all);
        document.getElementById('odPharmOverdue').textContent = pharm.overdue_count ?? 0;

        document.getElementById('odStockUnits').textContent = fmtNum(inv.total_units);
        document.getElementById('odProducts').textContent = store.products_active ?? 0;
        document.getElementById('odCustomers').textContent = store.customers_total ?? 0;
        document.getElementById('odReps').textContent = crm.active_reps ?? 0;
        document.getElementById('odVisits').textContent = crm.visits_mtd ?? 0;
        document.getElementById('odLowStock').textContent = inv.low_stock_count ?? 0;
        document.getElementById('odPendingOrders').textContent = store.pending_orders ?? 0;
        document.getElementById('odInvoicesMonth').textContent = invoices.count_month ?? 0;

        renderOwnerChannels(d.channels || [], store);
        renderOwnerCrm(crm);
        renderOwnerPharmacyAr(pharm);
        renderOwnerPharmacyList(d.pharmacy_invoices || []);
        renderOwnerInvoices(invoices);
        renderOwnerContact(store);
        renderRecentOrders(d.recent_orders || []);
        renderOwnerLowStock(d.low_stock || [], inv);
    } catch (e) {
        console.error(e);
        toast('تعذّر تحميل لوحة المالك', 'error');
    }
}

function renderOwnerChannels(channels, store) {
    const el = document.getElementById('ownerChannels');
    if (!el) return;
    const fbAll = store?.orders_facebook_all ?? 0;
    const igAll = store?.orders_instagram_all ?? 0;
    const mcAll = store?.orders_manychat_all ?? 0;
    const socialHead = `<div class="owner-kv-list" style="margin-bottom:14px">
        <div class="owner-kv"><span><i class="fab fa-facebook-messenger"></i> Messenger (كل الوقت)</span><strong>${fbAll}</strong></div>
        <div class="owner-kv"><span><i class="fab fa-instagram"></i> Instagram (كل الوقت)</span><strong>${igAll}</strong></div>
        <div class="owner-kv"><span><i class="fas fa-share-nodes"></i> ManyChat (كل الوقت)</span><strong>${mcAll}</strong></div>
        <div class="owner-kv"><span>سوشيال هذا الشهر</span><strong>${store?.orders_social_month ?? 0}</strong></div>
    </div>`;
    if (!channels.length) {
        el.innerHTML = socialHead + '<p class="empty">لا توجد بيانات للفترة المحددة</p>';
        return;
    }
    el.innerHTML = socialHead + `<div class="owner-channel-table">
        <div class="owner-channel-head"><span>القناة</span><span>طلبات</span><span>جلسات شات</span><span>رسائل شات</span></div>
        ${channels.map(c => {
            const icon = c.icon || 'fa-globe';
            const family = /facebook|instagram|whatsapp/.test(icon) ? 'fab' : 'fas';
            return `<div class="owner-channel-row">
            <span class="owner-channel-name"><i class="${family} ${icon}"></i> ${c.label || channelAr(c.channel)}</span>
            <span>${c.orders ?? 0}</span>
            <span>${c.chat_sessions ?? 0}</span>
            <span>${c.chat_turns ?? 0}</span>
        </div>`;
        }).join('')}
    </div>
    <p class="owner-dash-hint">Messenger / Instagram عند تمييز القناة · ManyChat لأوردرات السوشيال غير المميّزة · الجلسات للشهر المحدد</p>`;
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

function renderOwnerPharmacyAr(pharm) {
    const el = document.getElementById('ownerPharmacyAr');
    if (!el) return;
    el.innerHTML = `
        <div class="owner-kv-list">
            <div class="owner-kv"><span>عدد الفواتير</span><strong>${pharm.count_all ?? 0}</strong></div>
            <div class="owner-kv"><span>أسعار قديمة / جديدة</span><strong>${pharm.old_prices_count ?? 0} / ${pharm.new_prices_count ?? 0}</strong></div>
            <div class="owner-kv"><span>إجمالي الفواتير</span><strong>${fmtMoney(pharm.total_all)}</strong></div>
            <div class="owner-kv"><span>محصّل</span><strong>${fmtMoney(pharm.collected_all)}</strong></div>
            <div class="owner-kv"><span>متبقي</span><strong>${fmtMoney(pharm.remaining_all)}</strong></div>
            <div class="owner-kv warn"><span>متأخر (عدد · مبلغ)</span><strong>${pharm.overdue_count ?? 0} · ${fmtMoney(pharm.overdue_amount)}</strong></div>
            <div class="owner-kv warn"><span>مفتوحة بدون موعد تحصيل</span><strong>${pharm.no_due_date_open ?? 0}</strong></div>
            <div class="owner-kv"><span>فواتير الشهر المحدد</span><strong>${pharm.count_month ?? 0}</strong></div>
            <div class="owner-kv"><span>عدد العبوات</span><strong>${fmtNum(pharm.bottles_all)}</strong></div>
        </div>
        <a href="${pharmacyInvoicesPage()}" class="btn-primary owner-action-link"><i class="fas fa-prescription-bottle-medical"></i> فتح صفحة فواتير الصيدليات</a>`;
}

let OWNER_PHARM_ROWS = {};

function escHtml(s) {
    return String(s ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function money2(n) {
    return Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function renderOwnerPharmacyList(rows) {
    const el = document.getElementById('ownerPharmacyList');
    if (!el) return;
    OWNER_PHARM_ROWS = {};
    (rows || []).forEach((r) => { if (r?.id) OWNER_PHARM_ROWS[r.id] = r; });

    if (!rows.length) {
        el.innerHTML = '<p class="empty">لا توجد فواتير صيدليات بعد</p>';
        return;
    }
    el.innerHTML = `
      <p class="owner-pharm-hint-click"><i class="fas fa-hand-pointer"></i> اضغط على أي فاتورة لفتح صفحة الفواتير بالتفاصيل (عرض · تحصيل · تصدير)</p>
      <div class="owner-pharm-table-wrap"><table class="owner-pharm-table">
        <thead>
          <tr>
            <th>رقم</th><th>الصيدلية</th><th>المنطقة</th><th>التاريخ</th>
            <th>العبوات</th><th>الإجمالي</th><th>محصّل</th><th>متبقي</th><th>الأسعار</th><th>الحالة</th>
          </tr>
        </thead>
        <tbody>
          ${rows.map(r => {
            const st = r.collection_status || 'open';
            const price = r.price_list === 'old' ? 'old' : 'new';
            return `<tr class="owner-pharm-row ${st === 'overdue' ? 'overdue' : ''}" onclick="location.href='${pharmacyInvoicesPage(r.id)}'" title="فتح صفحة فواتير الصيدليات">
              <td><b>${escHtml(r.invoice_number) || '—'}</b></td>
              <td>${escHtml(r.pharmacy_name) || '—'}</td>
              <td>${escHtml(r.region) || '—'}</td>
              <td>${escHtml(r.invoice_date) || '—'}</td>
              <td><b>${fmtNum(r.bottles)}</b></td>
              <td>${fmtNum(r.total)}</td>
              <td>${fmtNum(r.amount_paid)}</td>
              <td><b>${fmtNum(r.remaining)}</b></td>
              <td><span class="owner-pill ${price}">${price === 'old' ? 'قديمة' : 'جديدة'}</span></td>
              <td><span class="owner-pill ${st}">${pharmStatusAr(st)}</span></td>
            </tr>`;
          }).join('')}
        </tbody>
      </table></div>
      <p class="owner-dash-hint">عرض حتى 200 فاتورة — الأحدث أولاً · الملخص أعلاه يشمل الكل</p>
      <a href="${pharmacyInvoicesPage()}" class="btn-primary owner-action-link"><i class="fas fa-prescription-bottle-medical"></i> فتح صفحة فواتير الصيدليات</a>`;
}

window.closeOwnerPiModal = () => {
    document.getElementById('ownerPiModal')?.classList.add('hidden');
};

window.openOwnerPharmacyInvoice = async (id) => {
    const body = document.getElementById('ownerPiBody');
    const modal = document.getElementById('ownerPiModal');
    if (!body || !modal) return;

    body.innerHTML = '<p class="empty" style="background:#fff;border-radius:16px;padding:40px">جارٍ تحميل تفاصيل الفاتورة…</p>';
    modal.classList.remove('hidden');

    let r = OWNER_PHARM_ROWS[id] || null;
    try {
        const headers = await authHeaders();
        const res = await fetch(
            `${SUPABASE_URL}/rest/v1/crm_pharmacy_invoices?id=eq.${encodeURIComponent(id)}&select=*`,
            { headers: { ...headers, Accept: 'application/json' } }
        );
        const rows = await res.json();
        if (!res.ok) throw new Error(rows?.message || 'تعذّر جلب الفاتورة');
        if (Array.isArray(rows) && rows[0]) {
            r = { ...r, ...rows[0] };
            OWNER_PHARM_ROWS[id] = r;
        }
    } catch (e) {
        console.error(e);
        if (!r) {
            body.innerHTML = `<p class="empty" style="background:#fff;border-radius:16px;padding:40px">${escHtml(e.message || 'فشل التحميل')}</p>`;
            return;
        }
    }

    if (!r) {
        body.innerHTML = '<p class="empty" style="background:#fff;border-radius:16px;padding:40px">الفاتورة غير موجودة</p>';
        return;
    }

    const bal = Math.max(Number(r.total || 0) - Number(r.amount_paid || 0), 0);
    let cs = r.collection_status;
    if (!cs) {
        if (r.status === 'paid' || bal <= 0) cs = 'paid';
        else if (!r.due_date) cs = 'no_date';
        else if (String(r.due_date).slice(0, 10) < new Date().toISOString().slice(0, 10)) cs = 'overdue';
        else cs = 'open';
    }

    const discFrac = (Number(r.discount) || 0) <= 1 ? (Number(r.discount) || 0) : (Number(r.discount) || 0) / 100;
    const discPct = Math.round(discFrac * 1000) / 10;
    const items = Array.isArray(r.line_items) ? r.line_items : [];
    const dateVal = r.invoice_date ? String(r.invoice_date).slice(0, 10) : '';
    const priceList = (r.price_list || 'new') === 'old' ? 'old' : 'new';
    const payMap = { cash: 'نقدي', credit: 'آجل', partial: 'جزئي' };
    const statusMap = {
        paid: 'مدفوعة', partial: 'جزئي', open: 'مفتوحة', overdue: 'متأخرة',
        no_date: 'بدون موعد', pending: 'معلقة',
    };

    const rowsHtml = items.length
        ? items.map((l, i) => {
            const qty = Number(l.qty) || 0;
            const unit = Number(l.unit_price) || 0;
            const pharmacy = discFrac > 0 && discFrac < 1
                ? unit * (1 - discFrac)
                : (qty ? (Number(l.line_total) || 0) / qty : unit);
            const lineTot = Number(l.line_total) || (qty * pharmacy);
            return `<tr>
              <td>${i + 1}</td>
              <td><div class="pname">${escHtml(l.name || l.sku || '—')}</div>${l.sku ? `<div style="font-size:11px;color:#8888a0">${escHtml(l.sku)}</div>` : ''}</td>
              <td>${money2(unit)}</td>
              <td>${qty}</td>
              <td><span class="disc">${discPct}%</span></td>
              <td>${money2(pharmacy)}</td>
              <td class="rtot">${money2(lineTot)}</td>
            </tr>`;
          }).join('')
        : `<tr><td colspan="7" style="text-align:center;color:#8888a0;padding:24px">لا توجد أصناف على الفاتورة</td></tr>`;

    const notes = r.notes && !String(r.notes).startsWith('Imported from Excel')
        ? `<br><span class="lbl">ملاحظات:</span> ${escHtml(r.notes)}`
        : '';

    body.innerHTML = `
    <div class="owner-pi-invoice" id="ownerPiPrintRoot">
      <div class="pi-inv-header">
        <div class="pi-inv-logo">
          <img src="images/logo.png" alt="Montana" onerror="this.outerHTML='<h1>MONTAÑA</h1>'">
          <span>PREMIUM CARE</span>
        </div>
        <div class="pi-inv-title"><h2>INVOICE</h2></div>
      </div>
      <div class="pi-inv-info">
        <div>
          <h3>بيانات الشركة</h3>
          <p>
            <strong>Montana Cosmetics - مونتانيا مستحضرات التجميل</strong><br>
            العنوان: 1268 مجاورة 6 الحي الأول - 6 أكتوبر - الجيزة<br>
            <span class="lbl">رقم ضريبي:</span> 754-091-953<br>
            <span class="lbl">سجل تجاري:</span> 31096
          </p>
        </div>
        <div>
          <h3>بيانات العميل</h3>
          <p>
            <strong>${escHtml(r.pharmacy_name || '—')}</strong><br>
            <span class="lbl">المنطقة:</span> ${escHtml(r.region || '—')}<br>
            <span class="lbl">قائمة الأسعار:</span>
            <strong style="color:${priceList === 'old' ? '#9a3b28' : '#2a6b45'}">${priceList === 'old' ? 'أسعار قديمة' : 'أسعار جديدة'}</strong>
            ${notes}
          </p>
        </div>
      </div>
      <div class="pi-inv-meta">
        <div class="pi-inv-meta-item"><div class="lbl">رقم الفاتورة</div><div class="val">${escHtml(r.invoice_number || '—')}</div></div>
        <div class="pi-inv-meta-item"><div class="lbl">التاريخ</div><div class="val">${dateVal ? escHtml(dateVal) : '—'}</div></div>
        <div class="pi-inv-meta-item"><div class="lbl">طريقة الدفع</div><div class="val">${payMap[r.payment_type] || escHtml(r.payment_type || '—')}</div></div>
        <div class="pi-inv-meta-item"><div class="lbl">الحالة</div><div class="val">${statusMap[cs] || cs}</div></div>
        <div class="pi-inv-meta-item"><div class="lbl">موعد التحصيل</div><div class="val">${r.due_date ? escHtml(String(r.due_date).slice(0, 10)) : '—'}</div></div>
      </div>
      <div class="pi-inv-table">
        <table>
          <thead>
            <tr>
              <th>#</th><th>الصنف</th><th>سعر الجمهور</th><th>الكمية</th>
              <th>الخصم</th><th>سعر الصيدلي</th><th>الإجمالي</th>
            </tr>
          </thead>
          <tbody>${rowsHtml}</tbody>
        </table>
      </div>
      <div class="pi-inv-totals">
        <div class="pi-inv-totals-box">
          <div class="pi-inv-totals-row"><span>المجموع الفرعي</span><span>${money2(r.subtotal)} ج.م</span></div>
          <div class="pi-inv-totals-row"><span>الضريبة</span><span>${money2(r.tax)} ج.م</span></div>
          <div class="pi-inv-totals-row"><span>محصّل</span><span>${money2(r.amount_paid)} ج.م</span></div>
          <div class="pi-inv-totals-row"><span>المتبقي</span><span>${money2(bal)} ج.م</span></div>
          <div class="pi-inv-totals-row total"><span>إجمالي الفاتورة</span><span>${money2(r.total)} ج.م</span></div>
        </div>
      </div>
      <div class="pi-inv-footer">
        <div class="pi-inv-footer-info">
          <strong>Montana Cosmetics</strong><br>
          6 أكتوبر - الجيزة - مصر<br>
          هاتف: 01234567890 | info@montana.com
        </div>
        <div class="pi-inv-stamp">MONTAÑA<br>مونتانيا<br>✓</div>
      </div>
      <div class="pi-inv-watermark">
        شكراً لتعاملكم معنا | <strong>Montana Premium Care</strong> | www.montana.com.eg
      </div>
    </div>`;
};

window.printOwnerPiInvoice = () => {
    const node = document.getElementById('ownerPiPrintRoot');
    const frame = document.getElementById('ownerPiPrintFrame');
    if (!node || !frame) {
        toast('افتح الفاتورة أولاً', 'error');
        return;
    }
    const styles = `
      *{box-sizing:border-box;margin:0;padding:0}
      body{font-family:'Tajawal',Segoe UI,Tahoma,sans-serif;background:#fff;padding:12px;direction:rtl;color:#2D1B3D}
      .owner-pi-invoice{max-width:800px;margin:0 auto;background:#fff;overflow:hidden}
      .pi-inv-header{background:linear-gradient(135deg,#2D1B3D,#9B6CB8);color:#fff;padding:28px 36px;display:flex;justify-content:space-between;align-items:center}
      .pi-inv-logo h1{font-size:26px;font-weight:900;letter-spacing:3px;margin:0 0 4px}
      .pi-inv-logo span{font-size:11px;opacity:.7;letter-spacing:2px}
      .pi-inv-logo img{height:40px;filter:brightness(0) invert(1)}
      .pi-inv-title{text-align:left}
      .pi-inv-title h2{font-size:28px;font-weight:900;letter-spacing:2px;margin:0}
      .pi-inv-info{display:flex;justify-content:space-between;gap:32px;padding:24px 36px;border-bottom:1px solid #E8DFF0}
      .pi-inv-info h3{font-size:11px;font-weight:700;color:#9B6CB8;text-transform:uppercase;letter-spacing:1px;margin:0 0 10px}
      .pi-inv-info p{font-size:13px;line-height:1.8;margin:0}
      .lbl{color:#8888a0;font-size:11px}
      .pi-inv-meta{display:flex;padding:16px 28px;background:#F8F5FB;border-bottom:1px solid #E8DFF0;flex-wrap:wrap}
      .pi-inv-meta-item{flex:1;min-width:110px;text-align:center;padding:10px 8px;border-left:1px solid #E8DFF0}
      .pi-inv-meta-item .lbl{font-size:10px;font-weight:700;margin-bottom:4px;color:#8888a0}
      .pi-inv-meta-item .val{font-size:14px;font-weight:800;color:#2D1B3D}
      .pi-inv-table{padding:0 28px}
      table{width:100%;border-collapse:collapse;margin:18px 0}
      th{background:#2D1B3D;color:#fff;padding:11px 14px;font-size:11px;text-align:right}
      td{padding:12px 14px;font-size:13px;border-bottom:1px solid #E8DFF0}
      .pname{font-weight:700;color:#2D1B3D}
      .disc{background:rgba(155,108,184,.1);color:#9B6CB8;padding:2px 8px;border-radius:12px;font-size:11px;font-weight:700}
      .rtot{font-weight:800;color:#9B6CB8}
      .pi-inv-totals{padding:0 28px 22px;display:flex;justify-content:flex-end}
      .pi-inv-totals-box{width:280px}
      .pi-inv-totals-row{display:flex;justify-content:space-between;padding:8px 0;font-size:13px;color:#8888a0}
      .pi-inv-totals-row.total{border-top:2px solid #2D1B3D;margin-top:8px;padding-top:12px;font-size:18px;font-weight:900;color:#2D1B3D}
      .pi-inv-totals-row.total span:last-child{color:#9B6CB8}
      .pi-inv-footer{background:#F8F5FB;padding:20px 36px;border-top:1px solid #E8DFF0;display:flex;justify-content:space-between;align-items:center}
      .pi-inv-footer-info{font-size:11px;color:#8888a0;line-height:1.8}
      .pi-inv-stamp{border:2px solid #9B6CB8;color:#9B6CB8;border-radius:12px;padding:10px 16px;font-size:12px;font-weight:800;text-align:center;line-height:1.4}
      .pi-inv-watermark{text-align:center;padding:12px;font-size:11px;color:#8888a0;border-top:1px dashed #E8DFF0}
    `;
    const doc = frame.contentDocument || frame.contentWindow.document;
    doc.open();
    doc.write(`<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="UTF-8"><title>فاتورة صيدلية</title>
      <link href="https://fonts.googleapis.com/css2?family=Tajawal:wght@400;700;800;900&display=swap" rel="stylesheet">
      <style>${styles}</style></head><body>${node.outerHTML}</body></html>`);
    doc.close();
    setTimeout(() => {
        frame.contentWindow.focus();
        frame.contentWindow.print();
    }, 300);
};

function renderOwnerInvoices(invoices) {
    const el = document.getElementById('ownerInvoices');
    if (!el) return;
    el.innerHTML = `
        <div class="owner-kv-list">
            <div class="owner-kv"><span>فواتير المتجر (الشهر)</span><strong>${invoices.count_month ?? 0}</strong></div>
            <div class="owner-kv"><span>إيراد فواتير المتجر</span><strong>${fmtMoney(invoices.revenue_month)}</strong></div>
            <div class="owner-kv"><span>إجمالي فواتير المتجر</span><strong>${invoices.count_all_time ?? 0}</strong></div>
        </div>
        <a href="${adminPage('invoices')}" class="btn-primary btn-outline owner-action-link"><i class="fas fa-file-invoice"></i> فواتير المتجر</a>`;
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
