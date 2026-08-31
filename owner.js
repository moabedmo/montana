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
      @page{size:A4 portrait;margin:10mm}
      *{box-sizing:border-box;margin:0;padding:0}
      html,body{
        width:210mm;min-height:297mm;margin:0;padding:0;
        font-family:'Tajawal',Segoe UI,Tahoma,sans-serif;
        background:#fff;direction:rtl;color:#2D1B3D;
        -webkit-print-color-adjust:exact;print-color-adjust:exact;
      }
      .owner-pi-invoice{
        width:100%;max-width:none;min-height:calc(297mm - 20mm);
        margin:0;background:#fff;overflow:hidden;
        display:flex;flex-direction:column;
      }
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
      @media print{
        html,body{width:210mm;height:auto;margin:0;padding:0}
        .owner-pi-invoice{width:100%;min-height:auto}
        .pi-inv-header,.pi-inv-meta,.pi-inv-footer,th,.disc{
          -webkit-print-color-adjust:exact!important;print-color-adjust:exact!important;
        }
      }
    `;
    frame.style.cssText = 'position:fixed;left:0;top:0;width:210mm;height:297mm;border:0;opacity:0;z-index:99999;pointer-events:none';
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

/* ═══════════════════════════════════════════
   طلبات أمازون — SP-API Egypt
   ═══════════════════════════════════════════ */
function fmtAmazonDate(v) {
    if (!v) return '—';
    const d = new Date(v);
    if (Number.isNaN(d.getTime())) return String(v);
    return d.toLocaleString('ar-EG', { dateStyle: 'short', timeStyle: 'short' });
}

function renderAmazonOrdersList(el, orders, meta = {}) {
    if (!el) return;
    if (!orders?.length) {
        el.innerHTML = `<p class="empty">لا توجد طلبات أمازون في الفترة المحددة${meta.error ? ` — ${meta.error}` : ''}</p>`;
        return;
    }
    el.innerHTML = `<div class="owner-channel-table">
        <div class="owner-channel-head"><span>رقم الطلب</span><span>القناة</span><span>الإجمالي</span><span>الحالة</span><span>التاريخ</span></div>
        ${orders.map((o) => {
            const total = o.total != null ? `${fmtNum(o.total)} ${o.currency || 'EGP'}` : '—';
            return `<div class="owner-channel-row">
                <span dir="ltr"><strong>${o.id}</strong></span>
                <span>${o.fulfillment || '—'}</span>
                <span>${total}</span>
                <span>${o.status || '—'}</span>
                <span>${fmtAmazonDate(o.created_at)}</span>
            </div>`;
        }).join('')}
    </div>
    <p class="owner-dash-hint">عُرض ${orders.length} طلب${meta.created_after ? ` · من ${fmtAmazonDate(meta.created_after)}` : ''} · Amazon SP-API (مصر)</p>`;
}

async function loadOwnerAmazonOrders() {
    const el = document.getElementById('ownerAmazonOrders');
    if (!el) return;
    el.innerHTML = '<p class="empty">جارٍ سحب الطلبات من أمازون…</p>';
    const days = Number(document.getElementById('ownerAmazonDays')?.value || 30);
    try {
        const headers = await authHeaders();
        const res = await fetch(`/api/integrations-status?action=amazon-orders&days=${days}&size=50`, { headers });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || data.ok === false) throw new Error(data.error || `HTTP ${res.status}`);
        renderAmazonOrdersList(el, data.orders || [], data.rawMeta || {});
    } catch (e) {
        console.error(e);
        el.innerHTML = `<p class="empty">تعذّر سحب طلبات أمازون: ${e.message || e}</p>`;
    }
}

function bindOwnerAmazonUi() {
    document.getElementById('ownerAmazonRefreshBtn')?.addEventListener('click', () => loadOwnerAmazonOrders());
    document.getElementById('ownerAmazonDays')?.addEventListener('change', () => loadOwnerAmazonOrders());
    document.getElementById('ownerAmazonStockRefreshBtn')?.addEventListener('click', () => loadOwnerAmazonStock());
    document.getElementById('ownerAmazonStockPushBtn')?.addEventListener('click', () => pushOwnerAmazonStock());
}

function renderAmazonStockCompare(el, metaEl, data) {
    if (!el) return;
    const rows = data.rows || [];
    const s = data.summary || {};
    if (metaEl) {
        metaEl.textContent = `مونتانيا ${s.montana_count ?? 0} · أمازون ${s.amazon_count ?? 0} · مربوط ${s.matched ?? 0} · فروقات ${s.mismatched ?? 0} · قابل للدفع ${s.pushable ?? 0}`;
        if (data.errors?.listings) metaEl.textContent += ` · تنبيه: ${data.errors.listings}`;
    }
    if (!rows.length) {
        el.innerHTML = '<p class="empty">لا توجد أصناف للمقارنة</p>';
        return;
    }
    el.innerHTML = `<div class="owner-channel-table">
        <div class="owner-channel-head"><span>المنتج</span><span>مونتانيا</span><span>أمازون SKU</span><span>أمازون</span><span>فرق</span><span>الربط</span></div>
        ${rows.map((r) => {
            const delta = r.delta == null ? '—' : (r.delta > 0 ? `+${r.delta}` : String(r.delta));
            const title = r.montana_name || r.amazon_name || r.slug || r.amazon_sellerSku || '—';
            const sub = [r.slug, r.amazon_asin].filter(Boolean).join(' · ');
            return `<div class="owner-channel-row">
                <span><strong>${title}</strong>${sub ? `<br><small dir="ltr">${sub}</small>` : ''}</span>
                <span>${r.montana_stock != null ? fmtNum(r.montana_stock) : '—'}</span>
                <span dir="ltr">${r.amazon_sellerSku || '—'}</span>
                <span>${r.amazon_stock != null ? fmtNum(r.amazon_stock) : '—'}</span>
                <span>${delta}</span>
                <span>${matchLabel(r.match)}${r.can_push ? '' : ' · ناقص'}</span>
            </div>`;
        }).join('')}
    </div>`;
}

async function loadOwnerAmazonStock() {
    const el = document.getElementById('ownerAmazonStock');
    const meta = document.getElementById('ownerAmazonStockMeta');
    if (!el) return;
    el.innerHTML = '<p class="empty">جارٍ مقارنة المخزون مع أمازون…</p>';
    try {
        const headers = await authHeaders();
        const res = await fetch('/api/integrations-status?action=amazon-stock', { headers });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || data.ok === false) throw new Error(data.error || `HTTP ${res.status}`);
        window.__ownerAmazonStock = data;
        renderAmazonStockCompare(el, meta, data);
    } catch (e) {
        console.error(e);
        el.innerHTML = `<p class="empty">تعذّر مقارنة مخزون أمازون: ${e.message || e}</p>`;
        if (meta) meta.textContent = '';
    }
}

async function pushOwnerAmazonStock() {
    if (!confirm('هتدفع مخزون الموقع لأمازون (الفروقات فقط). متأكد؟')) return;
    const btn = document.getElementById('ownerAmazonStockPushBtn');
    if (btn) btn.disabled = true;
    try {
        const headers = await authHeaders();
        const res = await fetch('/api/integrations-status?action=amazon-stock-push', {
            method: 'POST',
            headers: { ...headers, 'Content-Type': 'application/json' },
            body: '{}',
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || data.ok === false) throw new Error(data.error || `HTTP ${res.status}`);
        toast(
            data.pushed
                ? `تم تحديث ${data.pushed} صنف على أمازون${data.failed ? ` · فشل ${data.failed}` : ''}`
                : (data.message || 'لا فروقات'),
            data.failed ? 'error' : 'success'
        );
        await loadOwnerAmazonStock();
    } catch (e) {
        console.error(e);
        toast(e.message || 'فشل دفع المخزون لأمازون', 'error');
    } finally {
        if (btn) btn.disabled = false;
    }
}

/* ═══════════════════════════════════════════
   طلبات جوميا — Vendor API live pull
   ═══════════════════════════════════════════ */
function fmtJumiaDate(v) {
    if (!v) return '—';
    const d = new Date(v);
    if (Number.isNaN(d.getTime())) return String(v);
    return d.toLocaleString('ar-EG', { dateStyle: 'short', timeStyle: 'short' });
}

function renderJumiaOrdersList(el, orders, meta = {}) {
    if (!el) return;
    if (!orders?.length) {
        el.innerHTML = `<p class="empty">لا توجد طلبات جوميا في الفترة المحددة${meta.error ? ` — ${meta.error}` : ''}</p>`;
        return;
    }
    const head = `<div class="owner-channel-table">
        <div class="owner-channel-head"><span>رقم الطلب</span><span>العميل</span><span>الإجمالي</span><span>الحالة</span><span>التاريخ</span></div>
        ${orders.map((o) => {
            const total = o.total != null ? `${fmtNum(o.total)} ${o.currency || 'EGP'}` : '—';
            return `<div class="owner-channel-row">
                <span dir="ltr"><strong>${o.id}</strong></span>
                <span>${o.customer_name || '—'}${o.customer_phone ? ` · <span dir="ltr">${o.customer_phone}</span>` : ''}</span>
                <span>${total}</span>
                <span>${o.status || '—'}</span>
                <span>${fmtJumiaDate(o.created_at)}</span>
            </div>`;
        }).join('')}
    </div>
    <p class="owner-dash-hint">عُرض ${orders.length} طلب${meta.created_after ? ` · من ${fmtJumiaDate(meta.created_after)}` : ''} · جوميا Vendor API</p>`;
    el.innerHTML = head;
}

async function loadOwnerJumiaOrders() {
    const el = document.getElementById('ownerJumiaOrders');
    if (!el) return;
    el.innerHTML = '<p class="empty">جارٍ سحب الطلبات من جوميا…</p>';
    const days = Number(document.getElementById('ownerJumiaDays')?.value || 30);
    try {
        const headers = await authHeaders();
        const res = await fetch(`/api/integrations-status?action=jumia-orders&days=${days}&size=50`, { headers });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || data.ok === false) throw new Error(data.error || `HTTP ${res.status}`);
        renderJumiaOrdersList(el, data.orders || [], data.rawMeta || {});
    } catch (e) {
        console.error(e);
        el.innerHTML = `<p class="empty">تعذّر سحب طلبات جوميا: ${e.message || e}</p>`;
    }
}

function bindOwnerJumiaUi() {
    document.getElementById('ownerJumiaRefreshBtn')?.addEventListener('click', () => loadOwnerJumiaOrders());
    document.getElementById('ownerJumiaDays')?.addEventListener('change', () => loadOwnerJumiaOrders());
    document.getElementById('ownerJumiaStockRefreshBtn')?.addEventListener('click', () => loadOwnerJumiaStock());
    document.getElementById('ownerJumiaStockPushBtn')?.addEventListener('click', () => pushOwnerJumiaStock());
}

function matchLabel(m) {
    const map = {
        manual: 'يدوي',
        alias: 'تلقائي',
        slug: 'slug',
        fuzzy: 'تقريبي',
        name: 'بالاسم',
        'manual-unresolved': 'SKU يدوي ناقص',
    };
    return map[m] || (m ? m : '—');
}

function renderJumiaStockCompare(el, metaEl, data) {
    if (!el) return;
    const rows = data.rows || [];
    const s = data.summary || {};
    if (metaEl) {
        metaEl.textContent = `مونتانيا ${s.montana_count ?? 0} · جوميا ${s.jumia_count ?? 0} · مربوط ${s.matched ?? 0} · فروقات ${s.mismatched ?? 0} · قابل للدفع ${s.pushable ?? 0}`;
        if (data.errors?.stock || data.errors?.products) {
            metaEl.textContent += ` · تنبيه API: ${[data.errors.stock, data.errors.products].filter(Boolean).join(' / ')}`;
        }
    }
    if (!rows.length) {
        el.innerHTML = '<p class="empty">لا توجد أصناف للمقارنة</p>';
        return;
    }
    el.innerHTML = `<div class="owner-channel-table">
        <div class="owner-channel-head"><span>المنتج</span><span>مونتانيا</span><span>جوميا</span><span>فرق</span><span>الربط</span></div>
        ${rows.map((r) => {
            const delta = r.delta == null ? '—' : (r.delta > 0 ? `+${r.delta}` : String(r.delta));
            const deltaClass = r.delta == null ? '' : (r.delta === 0 ? '' : 'warn');
            const title = r.montana_name || r.jumia_name || r.slug || r.jumia_sellerSku || '—';
            const sub = [r.slug, r.jumia_sellerSku].filter(Boolean).join(' · ');
            return `<div class="owner-channel-row ${deltaClass}">
                <span><strong>${title}</strong>${sub ? `<br><small dir="ltr">${sub}</small>` : ''}</span>
                <span>${r.montana_stock != null ? fmtNum(r.montana_stock) : '—'}</span>
                <span>${r.jumia_stock != null ? fmtNum(r.jumia_stock) : '—'}</span>
                <span>${delta}</span>
                <span>${matchLabel(r.match)}${r.can_push ? '' : ' · ناقص SID'}</span>
            </div>`;
        }).join('')}
    </div>`;
}

async function loadOwnerJumiaStock() {
    const el = document.getElementById('ownerJumiaStock');
    const meta = document.getElementById('ownerJumiaStockMeta');
    if (!el) return;
    el.innerHTML = '<p class="empty">جارٍ مقارنة المخزون…</p>';
    try {
        const headers = await authHeaders();
        const res = await fetch('/api/integrations-status?action=jumia-stock', { headers });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || data.ok === false) throw new Error(data.error || `HTTP ${res.status}`);
        window.__ownerJumiaStock = data;
        renderJumiaStockCompare(el, meta, data);
    } catch (e) {
        console.error(e);
        el.innerHTML = `<p class="empty">تعذّر مقارنة المخزون: ${e.message || e}</p>`;
    }
}

async function pushOwnerJumiaStock() {
    if (!confirm('هتدفع مخزون الموقع لجوميا للأصناف اللي فيها فرق فقط. متأكد؟')) return;
    const btn = document.getElementById('ownerJumiaStockPushBtn');
    if (btn) btn.disabled = true;
    try {
        const headers = await authHeaders();
        const res = await fetch('/api/integrations-status?action=jumia-stock-push', {
            method: 'POST',
            headers,
            body: JSON.stringify({ onlyMismatched: true }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || data.ok === false) throw new Error(data.error || `HTTP ${res.status}`);
        toast(data.pushed ? `تم إرسال ${data.pushed} صنف لجوميا (Feed: ${data.feedId || '—'})` : (data.message || 'لا فروقات'), 'success');
        await loadOwnerJumiaStock();
    } catch (e) {
        console.error(e);
        toast(e.message || 'فشل دفع المخزون', 'error');
    } finally {
        if (btn) btn.disabled = false;
    }
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

/* ═══════════════════════════════════════════
   أوراق الشركة — private docs for the owner
   ═══════════════════════════════════════════ */
let pendingOwnerDocFiles = [];

async function ownerDocsApi(path, { method = 'GET', body } = {}) {
    const headers = await authHeaders();
    const opts = { method, headers };
    if (body !== undefined) opts.body = JSON.stringify(body);
    const qs = path.startsWith('?') ? path.slice(1) : path;
    const res = await fetch(`/api/integrations-status?action=owner-company-docs&${qs}`, opts);
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.ok === false) {
        throw new Error(data.error || `HTTP ${res.status}`);
    }
    return data;
}

function ownerDocIconClass(mime, name) {
    const m = (mime || '').toLowerCase();
    const n = (name || '').toLowerCase();
    if (m.includes('pdf') || n.endsWith('.pdf')) return 'pdf';
    if (m.startsWith('image/') || /\.(jpe?g|png|webp|gif)$/.test(n)) return 'image';
    if (m.includes('sheet') || m.includes('excel') || /\.(xlsx?|csv)$/.test(n)) return 'sheet';
    return '';
}

function ownerDocIcon(mime, name) {
    const cls = ownerDocIconClass(mime, name);
    if (cls === 'pdf') return 'fa-file-pdf';
    if (cls === 'image') return 'fa-file-image';
    if (cls === 'sheet') return 'fa-file-excel';
    return 'fa-file-alt';
}

function fmtBytes(n) {
    const b = Number(n) || 0;
    if (b < 1024) return `${b} ب`;
    if (b < 1024 * 1024) return `${(b / 1024).toFixed(0)} ك.ب`;
    return `${(b / (1024 * 1024)).toFixed(1)} م.ب`;
}

function guessOwnerDocCategory(name) {
    const t = String(name || '');
    if (/ضريب|vat|tax/i.test(t)) return 'ضرائب';
    if (/سجل|ترخيص|commercial|license/i.test(t)) return 'سجل وتراخيص';
    if (/عقد|contract/i.test(t)) return 'عقود';
    if (/بنك|حساب|bank/i.test(t)) return 'بنوك';
    return null;
}

function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            const s = String(reader.result || '');
            const i = s.indexOf(',');
            resolve(i >= 0 ? s.slice(i + 1) : s);
        };
        reader.onerror = () => reject(new Error('تعذّر قراءة الملف'));
        reader.readAsDataURL(file);
    });
}

async function loadOwnerDocuments() {
    const el = document.getElementById('ownerDocsList');
    if (!el) return;
    el.innerHTML = '<p class="empty">جارٍ التحميل…</p>';
    try {
        const data = await ownerDocsApi('docsAction=list');
        renderOwnerDocuments(data.docs || []);
    } catch (e) {
        console.error('[owner docs]', e);
        el.innerHTML = `<p class="empty">تعذّر تحميل الأوراق${e?.message ? `: ${escHtml(e.message)}` : ''}</p>`;
    }
}

function renderOwnerDocuments(rows) {
    const el = document.getElementById('ownerDocsList');
    if (!el) return;
    if (!rows.length) {
        el.innerHTML = '<p class="empty">لا توجد أوراق بعد — ارفع أول ملف من زر «رفع أوراق»</p>';
        return;
    }
    el.innerHTML = `<div class="owner-docs-list">${rows.map((d) => {
        const iconCls = ownerDocIconClass(d.mime_type, d.file_name);
        const icon = ownerDocIcon(d.mime_type, d.file_name);
        const when = d.created_at ? new Date(d.created_at).toLocaleDateString('ar-EG') : '';
        const id = String(d.id || '').replace(/'/g, '');
        return `<div class="owner-doc-row" data-id="${escHtml(d.id)}">
            <div class="owner-doc-icon ${iconCls}"><i class="fas ${icon}"></i></div>
            <div class="owner-doc-meta">
                <h4>${escHtml(d.title || d.file_name)} <span class="owner-doc-cat">${escHtml(d.category || 'عام')}</span></h4>
                <span>الملف: ${escHtml(d.file_name)} · ${fmtBytes(d.file_size)} · ${when}${d.notes ? ` · ${escHtml(d.notes)}` : ''}</span>
            </div>
            <div class="owner-doc-actions">
                <button type="button" onclick="viewOwnerDocument('${id}')"><i class="fas fa-eye"></i> عرض</button>
                <button type="button" onclick="downloadOwnerDocument('${id}')"><i class="fas fa-download"></i> تنزيل</button>
                <button type="button" class="danger" onclick="deleteOwnerDocument('${id}')"><i class="fas fa-trash"></i></button>
            </div>
        </div>`;
    }).join('')}</div>`;
}

async function ownerDocSigned(id, download) {
    const q = `docsAction=url&id=${encodeURIComponent(id)}${download ? '&download=1' : ''}`;
    return ownerDocsApi(q);
}

window.viewOwnerDocument = async function viewOwnerDocument(id) {
    try {
        const { url, doc } = await ownerDocSigned(id, false);
        const dlData = await ownerDocSigned(id, true);
        const modal = document.getElementById('ownerDocPreviewModal');
        const body = document.getElementById('ownerDocPreviewBody');
        const title = document.getElementById('ownerDocPreviewTitle');
        const dl = document.getElementById('ownerDocPreviewDownload');
        if (title) title.textContent = doc.title || doc.file_name;
        if (dl) {
            dl.href = dlData.url;
            dl.setAttribute('download', doc.file_name || 'document');
        }
        const mime = (doc.mime_type || '').toLowerCase();
        const name = (doc.file_name || '').toLowerCase();
        if (mime.startsWith('image/') || /\.(jpe?g|png|webp|gif)$/.test(name)) {
            body.innerHTML = `<img src="${url}" alt="${escHtml(doc.title || '')}">`;
        } else if (mime.includes('pdf') || name.endsWith('.pdf')) {
            body.innerHTML = `<iframe src="${url}" title="معاينة PDF"></iframe>`;
        } else {
            body.innerHTML = `<div class="owner-doc-preview-fallback">
                <p>المعاينة غير متاحة لهذا النوع — نزّل الملف لفتحه على الهاتف.</p>
                <p style="margin-top:12px"><a class="btn-primary" href="${dlData.url}" download="${escHtml(doc.file_name)}"><i class="fas fa-download"></i> تنزيل ${escHtml(doc.file_name)}</a></p>
            </div>`;
        }
        modal?.classList.remove('hidden');
    } catch (e) {
        console.error(e);
        toast(e.message || 'تعذّر فتح الملف', 'error');
    }
};

window.closeOwnerDocPreview = function closeOwnerDocPreview() {
    document.getElementById('ownerDocPreviewModal')?.classList.add('hidden');
    const body = document.getElementById('ownerDocPreviewBody');
    if (body) body.innerHTML = '';
};

window.downloadOwnerDocument = async function downloadOwnerDocument(id) {
    try {
        const { url, doc } = await ownerDocSigned(id, true);
        const a = document.createElement('a');
        a.href = url;
        a.target = '_blank';
        a.rel = 'noopener';
        a.download = doc.file_name || 'document';
        document.body.appendChild(a);
        a.click();
        a.remove();
        toast('جاري التنزيل…');
    } catch (e) {
        console.error(e);
        toast(e.message || 'تعذّر التنزيل', 'error');
    }
};

window.deleteOwnerDocument = async function deleteOwnerDocument(id) {
    if (!confirm('حذف هذه الورقة نهائيًا؟')) return;
    try {
        await ownerDocsApi('docsAction=delete', { method: 'POST', body: { docsAction: 'delete', id } });
        toast('تم حذف الورقة');
        loadOwnerDocuments();
    } catch (e) {
        console.error(e);
        toast(e.message || 'تعذّر الحذف', 'error');
    }
};

function showOwnerDocUploadForm(files) {
    pendingOwnerDocFiles = Array.from(files || []).filter(Boolean);
    const form = document.getElementById('ownerDocsForm');
    const title = document.getElementById('ownerDocTitle');
    const notes = document.getElementById('ownerDocNotes');
    const cat = document.getElementById('ownerDocCategory');
    const pending = document.getElementById('ownerDocsPending');
    if (!pendingOwnerDocFiles.length) return;
    if (pending) {
        pending.textContent = pendingOwnerDocFiles.length === 1
            ? `الملف المختار: ${pendingOwnerDocFiles[0].name} (${fmtBytes(pendingOwnerDocFiles[0].size)})`
            : `${pendingOwnerDocFiles.length} ملفات جاهزة: ${pendingOwnerDocFiles.map((f) => f.name).join(' · ')}`;
    }
    if (title) {
        // Leave blank so the owner types the display name — don't overwrite with filename
        title.value = '';
        title.placeholder = pendingOwnerDocFiles.length > 1
            ? 'اسم موحّد اختياري — أو سيبه فاضي لاسم كل ملف'
            : 'اكتب اسم الورقة هنا (مثلاً: البطاقة الضريبية)';
        setTimeout(() => title.focus(), 50);
    }
    if (notes) notes.value = '';
    if (cat) {
        const guessed = guessOwnerDocCategory(pendingOwnerDocFiles[0]?.name || '');
        cat.value = guessed || 'عام';
    }
    form?.removeAttribute('hidden');
}

function hideOwnerDocUploadForm() {
    pendingOwnerDocFiles = [];
    const form = document.getElementById('ownerDocsForm');
    form?.setAttribute('hidden', '');
    const input = document.getElementById('ownerDocFile');
    if (input) input.value = '';
    const pending = document.getElementById('ownerDocsPending');
    if (pending) pending.textContent = '';
}

async function uploadOneOwnerDoc(file, { title, category, notes }) {
    const DIRECT_MAX = 3.2 * 1024 * 1024;
    if (file.size > 50 * 1024 * 1024) throw new Error(`${file.name}: الحد الأقصى 50 ميجا`);
    const typed = (title || '').trim();
    const docTitle = typed || (file.name || '').replace(/\.[^.]+$/, '') || file.name;
    const docCategory = guessOwnerDocCategory(typed || file.name) || category || 'عام';

    if (file.size <= DIRECT_MAX) {
        const fileBase64 = await fileToBase64(file);
        await ownerDocsApi('docsAction=upload', {
            method: 'POST',
            body: {
                docsAction: 'upload',
                title: docTitle,
                category: docCategory,
                notes,
                fileName: file.name,
                mimeType: file.type || 'application/octet-stream',
                fileBase64,
            },
        });
        return;
    }

    const prepared = await ownerDocsApi('docsAction=prepare', {
        method: 'POST',
        body: {
            docsAction: 'prepare',
            title: docTitle,
            category: docCategory,
            notes,
            fileName: file.name,
            mimeType: file.type || 'application/octet-stream',
            fileSize: file.size,
        },
    });
    if (!prepared.signedUrl && !prepared.token) throw new Error(`${file.name}: تعذّر إنشاء رابط الرفع`);
    let uploaded = false;
    if (prepared.token && window.__ownerSb?.storage?.from) {
        const up = await window.__ownerSb.storage
            .from('montana')
            .uploadToSignedUrl(prepared.path || prepared.storage_path, prepared.token, file, {
                contentType: file.type || 'application/octet-stream',
            });
        if (!up.error) uploaded = true;
    }
    if (!uploaded) {
        const put = await fetch(prepared.signedUrl, {
            method: 'PUT',
            headers: { 'Content-Type': file.type || 'application/octet-stream' },
            body: file,
        });
        if (!put.ok) throw new Error(`${file.name}: فشل الرفع (${put.status})`);
    }
    // Ensure typed title wins even if prepare echoed filename
    const meta = { ...prepared.meta, title: docTitle, category: docCategory, notes };
    await ownerDocsApi('docsAction=confirm', {
        method: 'POST',
        body: { docsAction: 'confirm', meta },
    });
}

async function confirmOwnerDocUpload() {
    if (!pendingOwnerDocFiles.length) return;
    const files = pendingOwnerDocFiles.slice();
    const typedTitle = (document.getElementById('ownerDocTitle')?.value || '').trim();
    const category = document.getElementById('ownerDocCategory')?.value || 'عام';
    const notes = (document.getElementById('ownerDocNotes')?.value || '').trim() || null;
    const btn = document.getElementById('ownerDocConfirmUpload');
    if (!typedTitle && files.length === 1) {
        toast('اكتب اسم الورقة قبل الرفع', 'error');
        document.getElementById('ownerDocTitle')?.focus();
        return;
    }
    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جاري الرفع…'; }
    let ok = 0;
    const errors = [];
    try {
        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            if (btn) btn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> ${i + 1}/${files.length}`;
            try {
                await uploadOneOwnerDoc(file, {
                    // Single file: always the typed name. Multi: typed name applies to all if provided.
                    title: typedTitle || null,
                    category,
                    notes,
                });
                ok += 1;
            } catch (e) {
                console.error(e);
                errors.push(e.message || file.name);
            }
        }
        if (ok) {
            toast(ok === 1 ? 'تم رفع الورقة' : `تم رفع ${ok} أوراق`);
            hideOwnerDocUploadForm();
            loadOwnerDocuments();
        }
        if (errors.length) {
            toast(errors[0], 'error');
        }
    } finally {
        if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-check"></i> تأكيد الرفع'; }
    }
}

function bindOwnerDocumentsUi() {
    const fileInput = document.getElementById('ownerDocFile');
    fileInput?.addEventListener('change', () => {
        const files = fileInput.files;
        if (files?.length) showOwnerDocUploadForm(files);
        // allow selecting the same file again later
        fileInput.value = '';
    });
    document.getElementById('ownerDocConfirmUpload')?.addEventListener('click', confirmOwnerDocUpload);
    document.getElementById('ownerDocCancelUpload')?.addEventListener('click', hideOwnerDocUploadForm);
    document.getElementById('ownerLinksSaveBtn')?.addEventListener('click', saveOwnerCompanyLinks);
    document.getElementById('ownerLinksGrid')?.addEventListener('input', (e) => {
        const input = e.target?.closest?.('input[data-link-key]');
        if (!input) return;
        const row = input.closest('.owner-link-row');
        const open = row?.querySelector('a.owner-link-open');
        if (!open) return;
        const url = normalizeOwnerLinkUrl(input.value);
        if (url) {
            open.href = url;
            open.classList.remove('is-disabled');
        } else {
            open.removeAttribute('href');
            open.classList.add('is-disabled');
        }
    });
}

function normalizeOwnerLinkUrl(raw) {
    const v = String(raw || '').trim();
    if (!v) return '';
    if (/^https?:\/\//i.test(v)) return v;
    return `https://${v}`;
}

function linkBrandIcon(key, icon) {
    if (key === 'facebook' || key === 'instagram' || key === 'amazon') {
        return `fab ${icon}`;
    }
    return `fas ${icon || 'fa-link'}`;
}

function renderOwnerCompanyLinks(links) {
    const el = document.getElementById('ownerLinksGrid');
    if (!el) return;
    const rows = Array.isArray(links) ? links : [];
    if (!rows.length) {
        el.innerHTML = '<p class="empty">لا توجد لينكات</p>';
        return;
    }
    el.innerHTML = rows.map((l) => {
        const url = String(l.url || '').trim();
        const href = url ? normalizeOwnerLinkUrl(url) : '';
        const iconClass = linkBrandIcon(l.key, l.icon);
        return `<div class="owner-link-row" data-key="${escHtml(l.key)}">
            <i class="${iconClass}" aria-hidden="true"></i>
            <label>${escHtml(l.label || l.key)}</label>
            <input type="url" data-link-key="${escHtml(l.key)}" data-link-label="${escHtml(l.label || '')}" data-link-icon="${escHtml(l.icon || '')}" placeholder="https://..." value="${escHtml(url)}" dir="ltr">
            <a class="owner-link-open${href ? '' : ' is-disabled'}" ${href ? `href="${escHtml(href)}" target="_blank" rel="noopener"` : ''}><i class="fas fa-external-link-alt"></i> فتح</a>
        </div>`;
    }).join('');
}

async function loadOwnerCompanyLinks() {
    const el = document.getElementById('ownerLinksGrid');
    if (!el) return;
    el.innerHTML = '<p class="empty">جارٍ التحميل…</p>';
    try {
        const data = await ownerDocsApi('docsAction=links');
        renderOwnerCompanyLinks(data.links || []);
    } catch (e) {
        console.error('[owner links]', e);
        el.innerHTML = `<p class="empty">تعذّر تحميل اللينكات${e?.message ? `: ${escHtml(e.message)}` : ''}</p>`;
    }
}

async function saveOwnerCompanyLinks() {
    const btn = document.getElementById('ownerLinksSaveBtn');
    const inputs = [...document.querySelectorAll('#ownerLinksGrid input[data-link-key]')];
    const links = inputs.map((input) => ({
        key: input.getAttribute('data-link-key'),
        label: input.getAttribute('data-link-label') || input.getAttribute('data-link-key'),
        icon: input.getAttribute('data-link-icon') || 'fa-link',
        url: String(input.value || '').trim(),
    }));
    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جاري الحفظ…'; }
    try {
        const data = await ownerDocsApi('docsAction=links-save', {
            method: 'POST',
            body: { docsAction: 'links-save', links },
        });
        renderOwnerCompanyLinks(data.links || links);
        toast('تم حفظ لينكات الشركة');
    } catch (e) {
        console.error(e);
        toast(e.message || 'فشل حفظ اللينكات', 'error');
    } finally {
        if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-save"></i> حفظ اللينكات'; }
    }
}

/* ── صيدليات التوفر (stockists) ── */
let ownerStockistCache = [];

function ownerStockistFilterQuery() {
    return {
        q: String(document.getElementById('ownerStockistSearch')?.value || '').trim().toLowerCase(),
        region: String(document.getElementById('ownerStockistRegionFilter')?.value || '').trim(),
    };
}

function filteredOwnerStockists() {
    const { q, region } = ownerStockistFilterQuery();
    return ownerStockistCache.filter((p) => {
        if (region && String(p.region || '') !== region) return false;
        if (!q) return true;
        const hay = `${p.name || ''} ${p.region || ''} ${p.link || ''} ${p.notes || ''}`.toLowerCase();
        return hay.includes(q);
    });
}

function renderOwnerStockists() {
    const el = document.getElementById('ownerStockistList');
    if (!el) return;
    const rows = filteredOwnerStockists();
    if (!ownerStockistCache.length) {
        el.innerHTML = '<p class="empty">لا توجد صيدليات بعد — أضف أول صيدلية</p>';
        return;
    }
    if (!rows.length) {
        el.innerHTML = '<p class="empty">لا نتائج للبحث</p>';
        return;
    }
    el.innerHTML = rows.map((p) => {
        const href = p.link ? normalizeOwnerLinkUrl(p.link) : '';
        return `<div class="owner-stockist-row" data-id="${escHtml(p.id)}">
            <strong>${escHtml(p.name)}</strong>
            <span class="region">${escHtml(p.region || 'أخرى')}</span>
            <input type="url" data-stockist-link="${escHtml(p.id)}" placeholder="https://..." value="${escHtml(p.link || '')}" dir="ltr">
            <div class="owner-stockist-actions">
                <a class="${href ? '' : 'is-disabled'}" ${href ? `href="${escHtml(href)}" target="_blank" rel="noopener"` : ''}><i class="fas fa-external-link-alt"></i></a>
                <button type="button" data-stockist-save="${escHtml(p.id)}" title="حفظ اللينك"><i class="fas fa-save"></i></button>
                <button type="button" class="danger" data-stockist-del="${escHtml(p.id)}" title="حذف"><i class="fas fa-trash"></i></button>
            </div>
        </div>`;
    }).join('');
}

async function loadOwnerStockists() {
    const el = document.getElementById('ownerStockistList');
    if (!el) return;
    el.innerHTML = '<p class="empty">جارٍ التحميل…</p>';
    try {
        const data = await ownerDocsApi('docsAction=pharmacies');
        ownerStockistCache = Array.isArray(data.pharmacies) ? data.pharmacies : [];
        const regions = [...new Set(ownerStockistCache.map((p) => p.region).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'ar'));
        const sel = document.getElementById('ownerStockistRegionFilter');
        const dl = document.getElementById('ownerStockistRegionList');
        if (sel) {
            const cur = sel.value;
            sel.innerHTML = `<option value="">كل المناطق</option>` + regions.map((r) => `<option value="${escHtml(r)}">${escHtml(r)}</option>`).join('');
            if (cur) sel.value = cur;
        }
        if (dl) {
            dl.innerHTML = regions.map((r) => `<option value="${escHtml(r)}"></option>`).join('');
        }
        renderOwnerStockists();
    } catch (e) {
        console.error('[owner stockists]', e);
        el.innerHTML = `<p class="empty">تعذّر تحميل الصيدليات${e?.message ? `: ${escHtml(e.message)}` : ''}</p>`;
    }
}

async function addOwnerStockist() {
    const name = String(document.getElementById('ownerStockistName')?.value || '').trim();
    const region = String(document.getElementById('ownerStockistRegion')?.value || '').trim() || 'أخرى';
    const link = String(document.getElementById('ownerStockistLink')?.value || '').trim();
    if (!name) {
        toast('اكتب اسم الصيدلية', 'error');
        return;
    }
    const btn = document.getElementById('ownerStockistAddBtn');
    if (btn) btn.disabled = true;
    try {
        const data = await ownerDocsApi('docsAction=pharmacies-upsert', {
            method: 'POST',
            body: { docsAction: 'pharmacies-upsert', pharmacy: { name, region, link } },
        });
        ownerStockistCache = data.pharmacies || [];
        document.getElementById('ownerStockistName').value = '';
        document.getElementById('ownerStockistLink').value = '';
        renderOwnerStockists();
        toast('تمت إضافة الصيدلية');
        await loadOwnerStockists();
    } catch (e) {
        console.error(e);
        toast(e.message || 'فشل الإضافة', 'error');
    } finally {
        if (btn) btn.disabled = false;
    }
}

async function saveOwnerStockistLink(id) {
    const input = document.querySelector(`input[data-stockist-link="${CSS.escape(id)}"]`);
    const row = ownerStockistCache.find((p) => p.id === id);
    if (!row) return;
    const link = String(input?.value || '').trim();
    try {
        const data = await ownerDocsApi('docsAction=pharmacies-upsert', {
            method: 'POST',
            body: { docsAction: 'pharmacies-upsert', pharmacy: { ...row, link } },
        });
        ownerStockistCache = data.pharmacies || [];
        renderOwnerStockists();
        toast('تم حفظ لينك الصيدلية');
    } catch (e) {
        toast(e.message || 'فشل الحفظ', 'error');
    }
}

async function deleteOwnerStockist(id) {
    if (!confirm('حذف الصيدلية من قائمة التوفر؟')) return;
    try {
        const data = await ownerDocsApi('docsAction=pharmacies-delete', {
            method: 'POST',
            body: { docsAction: 'pharmacies-delete', id },
        });
        ownerStockistCache = data.pharmacies || [];
        renderOwnerStockists();
        toast('تم الحذف');
        await loadOwnerStockists();
    } catch (e) {
        toast(e.message || 'فشل الحذف', 'error');
    }
}

function bindOwnerStockistsUi() {
    document.getElementById('ownerStockistAddBtn')?.addEventListener('click', () => addOwnerStockist());
    document.getElementById('ownerStockistSearch')?.addEventListener('input', () => renderOwnerStockists());
    document.getElementById('ownerStockistRegionFilter')?.addEventListener('change', () => renderOwnerStockists());
    document.getElementById('ownerStockistList')?.addEventListener('click', (e) => {
        const saveBtn = e.target.closest('[data-stockist-save]');
        if (saveBtn) {
            saveOwnerStockistLink(saveBtn.getAttribute('data-stockist-save'));
            return;
        }
        const delBtn = e.target.closest('[data-stockist-del]');
        if (delBtn) deleteOwnerStockist(delBtn.getAttribute('data-stockist-del'));
    });
    ['ownerStockistName', 'ownerStockistRegion', 'ownerStockistLink'].forEach((id) => {
        document.getElementById(id)?.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                addOwnerStockist();
            }
        });
    });
}

bindOwnerDocumentsUi();
loadOwnerDocuments();
loadOwnerCompanyLinks();
bindOwnerStockistsUi();
loadOwnerStockists();
bindOwnerAmazonUi();
loadOwnerAmazonOrders();
loadOwnerAmazonStock();
bindOwnerJumiaUi();
loadOwnerJumiaOrders();
loadOwnerJumiaStock();

loadOwnerDashboard();
