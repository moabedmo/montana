// ===== SUPABASE CONFIG =====
const SUPABASE_URL = 'https://ikryeyqrithikabwidov.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlrcnlleXFyaXRoaWthYndpZG92Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE3MzY1ODcsImV4cCI6MjA5NzMxMjU4N30.kNfHPxV4fq67cOF8uFsTrLOxPYcLcmmDO3ScIHzI9Uo';
// RLS requires the admin's real session token (not just the anon key) to
// read/write products/orders/customers/etc. Supabase access tokens expire
// after an hour — pulling a fresh one from the client's own session on
// every call (instead of freezing window.__ADMIN_TOKEN__ once at page load)
// lets supabase-js's built-in auto-refresh keep long admin sessions working
// instead of every write silently 401-ing once the token goes stale.
async function authHeaders() {
    let token = window.__ADMIN_TOKEN__ || SUPABASE_KEY;
    if (window.__adminSb) {
        const { data } = await window.__adminSb.auth.getSession();
        if (data?.session?.access_token) token = data.session.access_token;
    }
    return { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json', 'Prefer': 'return=representation' };
}

async function api(table, method = 'GET', body = null, query = '') {
    const opts = { method, headers: await authHeaders() };
    if (body) opts.body = JSON.stringify(body);
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}${query}`, opts);
    const data = await res.json();
    if (!res.ok) {
        console.error('API error', table, data);
        throw new Error(data.message || data.error || 'API error');
    }
    return data;
}

// ===== NAVIGATION =====
document.querySelectorAll('.nav-link').forEach(link => {
    link.addEventListener('click', e => {
        e.preventDefault();
        const page = link.dataset.page;
        document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
        document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
        link.classList.add('active');
        document.getElementById('page-' + page).classList.add('active');
        document.getElementById('pageTitle').textContent = link.textContent.trim();
        document.getElementById('sidebar').classList.remove('open');
        if (page === 'dashboard') loadDashboard();
        if (page === 'products') loadProducts();
        if (page === 'orders') loadOrders();
        if (page === 'customers') loadCustomers();
        if (page === 'categories') loadCategories();
        if (page === 'coupons') loadCoupons();
        if (page === 'reviews') loadReviews();
        if (page === 'ingredients') loadIngredients();
        if (page === 'shipping') loadShippingRates();
        if (page === 'messages') loadMessages();
        if (page === 'returns') loadReturns();
        if (page === 'invoices') { loadInvoicesPage(); loadAdminSalesReport(); }
        if (page === 'crm') loadCrmPage();
        if (page === 'settings') loadSettings();
    });
});

// ===== TOAST =====
function toast(msg, type = 'success') {
    const t = document.getElementById('toast');
    t.innerHTML = `<i class="fas fa-${type === 'success' ? 'check-circle' : 'exclamation-circle'}"></i> ${msg}`;
    t.className = `toast ${type} show`;
    setTimeout(() => t.classList.remove('show'), 3000);
}

// ===== MODAL =====
function openModal(title, html) {
    document.getElementById('modalTitle').textContent = title;
    document.getElementById('modalBody').innerHTML = html;
    document.getElementById('modal').classList.add('open');
}
function closeModal() { document.getElementById('modal').classList.remove('open'); }

// ===== DASHBOARD =====
async function loadDashboard() {
    const products = await api('products', 'GET', null, '?select=id,name,price,image_url,rating,review_count&is_active=eq.true&order=review_count.desc&limit=5');
    const allProducts = await api('products', 'GET', null, '?select=id&is_active=eq.true');
    const orders = await api('orders', 'GET', null, '?select=total,created_at,order_number,customer_name,status&order=created_at.desc&limit=5');
    const allOrders = await api('orders', 'GET', null, '?select=id,total');
    const customers = await api('customers', 'GET', null, '?select=id');
    const pending = await api('orders', 'GET', null, '?select=id&status=eq.pending');

    document.getElementById('statProducts').textContent = allProducts.length || 0;
    document.getElementById('statOrders').textContent = allOrders.length || 0;
    document.getElementById('statCustomers').textContent = customers.length || 0;

    const revenue = allOrders.reduce((sum, o) => sum + parseFloat(o.total || 0), 0);
    document.getElementById('statRevenue').textContent = revenue.toLocaleString();

    const ordersBadge = document.getElementById('ordersCount');
    if (ordersBadge) ordersBadge.textContent = pending.length || 0;

    const topEl = document.getElementById('topProducts');
    topEl.innerHTML = products.map(p => `
        <div class="top-product">
            <img src="${p.image_url || ''}" alt="">
            <div class="top-product-info"><h4>${p.name}</h4><span>⭐ ${p.rating} (${p.review_count} تقييم)</span></div>
            <span class="top-product-price">${p.price} ج.م</span>
        </div>
    `).join('') || '<p class="empty">لا توجد منتجات</p>';

    const ordEl = document.getElementById('recentOrders');
    ordEl.innerHTML = orders.length ? orders.map(o => `
        <div class="top-product">
            <div class="stat-icon" style="width:36px;height:36px;font-size:14px;background:rgba(155,108,184,0.1);color:var(--purple);border-radius:8px"><i class="fas fa-receipt"></i></div>
            <div class="top-product-info"><h4>${o.order_number}</h4><span>${o.customer_name || 'عميل'} · ${new Date(o.created_at).toLocaleDateString('ar')}</span></div>
            <span class="status ${o.status}">${statusAr(o.status)}</span>
        </div>
    `).join('') : '<p class="empty">لا توجد طلبات بعد</p>';

    loadLowStockAlerts();
}

const LOW_STOCK_THRESHOLD = 50;

async function loadLowStockAlerts() {
    const box = document.getElementById('lowStockAlert');
    const list = document.getElementById('lowStockList');
    if (!box || !list) return;
    try {
        const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/get_low_stock_products`, { method: 'POST', headers: await authHeaders(), body: JSON.stringify({ p_threshold: LOW_STOCK_THRESHOLD }) });
        const rows = await res.json();
        if (!res.ok || !Array.isArray(rows) || !rows.length) {
            box.style.display = 'none';
            return;
        }
        box.style.display = 'block';
        list.innerHTML = rows.map(p => `<div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--border)">
            <span><strong>${p.name}</strong></span>
            <span style="color:#e74c3c;font-weight:700">${p.stock} وحدة</span>
        </div>`).join('') + `<button class="btn-primary btn-outline" style="margin-top:12px" onclick="document.querySelector('[data-page=products]').click()"><i class="fas fa-box"></i> فتح المنتجات</button>`;
    } catch {
        box.style.display = 'none';
    }
}

function statusAr(s) {
    const map = { pending: 'قيد الانتظار', confirmed: 'مؤكد', preparing: 'جاري التجهيز', shipped: 'تم الشحن', delivered: 'تم التوصيل', cancelled: 'ملغي' };
    return map[s] || s;
}

// ===== PRODUCTS =====
async function loadProducts() {
    const products = await api('products', 'GET', null, '?select=*,categories(name)&order=id');
    const tb = document.getElementById('productsTable');
    tb.innerHTML = products.map(p => `<tr>
        <td><img class="table-img" src="${p.image_url || ''}" alt=""></td>
        <td><strong>${p.name}</strong><br><small style="color:var(--muted)">${p.size || ''}</small></td>
        <td><strong style="color:var(--purple)">${p.price} ج.م</strong>${p.old_price ? `<br><s style="color:var(--muted);font-size:11px">${p.old_price}</s>` : ''}</td>
        <td>${p.stock}</td>
        <td><span class="status ${p.stock > 0 ? 'active' : 'inactive'}" style="cursor:pointer" onclick="toggleProductStock(${p.id}, ${p.stock})" title="اضغطي للتبديل">${p.stock > 0 ? 'متاح' : 'نفذت الكمية'}</span></td>
        <td><div class="action-btns">
            <button class="btn-sm btn-edit" onclick="editProduct(${p.id})"><i class="fas fa-pen"></i></button>
            <button class="btn-sm btn-delete" onclick="deleteProduct(${p.id})"><i class="fas fa-trash"></i></button>
        </div></td>
    </tr>`).join('');
}

function openProductModal(product = null) {
    const p = product || {};
    openModal(p.id ? 'تعديل المنتج' : 'إضافة منتج', `
        <div class="form-group"><label>اسم المنتج</label><input id="pName" value="${p.name || ''}"></div>
        <div class="form-group"><label>الاسم بالإنجليزي</label><input id="pNameEn" value="${p.name_en || ''}" dir="ltr"></div>
        <div class="form-row">
            <div class="form-group"><label>السعر</label><input type="number" id="pPrice" value="${p.price || ''}"></div>
            <div class="form-group"><label>السعر القديم</label><input type="number" id="pOldPrice" value="${p.old_price || ''}"></div>
        </div>
        <div class="form-row">
            <div class="form-group"><label>الحجم</label><input id="pSize" value="${p.size || ''}"></div>
            <div class="form-group"><label>المخزون</label><input type="number" id="pStock" value="${p.stock || 100}"></div>
        </div>
        <div class="form-group"><label>الوصف</label><textarea id="pDesc">${p.description || ''}</textarea></div>
        <div class="form-group"><label>المكونات</label><textarea id="pIngredients">${p.ingredients || ''}</textarea></div>
        <div class="form-group"><label>رابط الصورة</label><input id="pImage" value="${p.image_url || ''}" dir="ltr"></div>
        <div class="form-row">
            <div class="form-group"><label>نوع البشرة</label><input id="pSkin" value="${p.skin_type || ''}"></div>
            <div class="form-group"><label>Badge</label>
                <select id="pBadge"><option value="">بدون</option><option value="new" ${p.badge==='new'?'selected':''}>جديد</option><option value="best-seller" ${p.badge==='best-seller'?'selected':''}>الأكثر مبيعاً</option><option value="sale" ${p.badge==='sale'?'selected':''}>خصم</option></select>
            </div>
        </div>
        <button class="btn-primary" onclick="saveProduct(${p.id || 'null'})"><i class="fas fa-save"></i> حفظ المنتج</button>
    `);
}

async function editProduct(id) {
    const [p] = await api('products', 'GET', null, `?id=eq.${id}`);
    if (p) openProductModal(p);
}

async function saveProduct(id) {
    const data = {
        name: document.getElementById('pName').value,
        name_en: document.getElementById('pNameEn').value,
        slug: document.getElementById('pNameEn').value.toLowerCase().replace(/\s+/g, '-') || 'product-' + Date.now(),
        price: parseFloat(document.getElementById('pPrice').value),
        old_price: parseFloat(document.getElementById('pOldPrice').value) || null,
        size: document.getElementById('pSize').value,
        stock: parseInt(document.getElementById('pStock').value) || 100,
        description: document.getElementById('pDesc').value,
        ingredients: document.getElementById('pIngredients').value,
        image_url: document.getElementById('pImage').value,
        skin_type: document.getElementById('pSkin').value,
        badge: document.getElementById('pBadge').value || null,
        category_id: 1,
    };
    if (id) {
        await api('products', 'PATCH', data, `?id=eq.${id}`);
        toast('تم تعديل المنتج');
    } else {
        await api('products', 'POST', data);
        toast('تم إضافة المنتج');
    }
    closeModal();
    loadProducts();
}

async function toggleProductStock(id, currentStock) {
    if (currentStock > 0) {
        if (!confirm('تأكيد: تحديد المنتج كـ"نفذت الكمية"؟ لن يظهر للعملاء كمتاح للشراء لا في الموقع ولا في البوت.')) return;
        await api('products', 'PATCH', { stock: 0 }, `?id=eq.${id}`);
        toast('تم تحديد المنتج كـ"نفذت الكمية"');
    } else {
        const qty = prompt('أدخلي الكمية المتاحة الجديدة:', '100');
        if (qty === null) return;
        const n = parseInt(qty, 10);
        if (!n || n < 1) { toast('كمية غير صحيحة', 'error'); return; }
        await api('products', 'PATCH', { stock: n }, `?id=eq.${id}`);
        toast('تم تحديث المخزون — المنتج متاح دلوقتي');
    }
    loadProducts();
}

async function deleteProduct(id) {
    if (!confirm('هل أنت متأكد من حذف هذا المنتج؟')) return;
    await api('products', 'DELETE', null, `?id=eq.${id}`);
    toast('تم حذف المنتج', 'error');
    loadProducts();
}

// ===== ORDERS =====
async function loadOrders(status = 'all') {
    let query = '?select=*&order=created_at.desc';
    if (status !== 'all') query += `&status=eq.${status}`;
    const orders = await api('orders', 'GET', null, query);
    const tb = document.getElementById('ordersTable');
    tb.innerHTML = orders.length ? orders.map(o => `<tr>
        <td><strong>${o.order_number}</strong></td>
        <td>${o.customer_name || '-'}<br><small style="color:var(--muted)">${o.customer_phone || ''}</small></td>
        <td><strong style="color:var(--purple)">${o.total} ج.م</strong></td>
        <td><select class="status-select" onchange="updateOrderStatus(${o.id}, this.value)">
            <option value="pending" ${o.status==='pending'?'selected':''}>قيد الانتظار</option>
            <option value="confirmed" ${o.status==='confirmed'?'selected':''}>مؤكد</option>
            <option value="preparing" ${o.status==='preparing'?'selected':''}>جاري التجهيز</option>
            <option value="shipped" ${o.status==='shipped'?'selected':''}>تم الشحن</option>
            <option value="delivered" ${o.status==='delivered'?'selected':''}>تم التوصيل</option>
            <option value="cancelled" ${o.status==='cancelled'?'selected':''}>ملغي</option>
        </select></td>
        <td>${new Date(o.created_at).toLocaleDateString('ar')}</td>
        <td><button class="btn-sm btn-edit" onclick="viewOrder(${o.id})"><i class="fas fa-eye"></i></button>
            <button class="btn-sm btn-edit" onclick="openOrderInvoice(${o.id})" title="فاتورة"><i class="fas fa-file-invoice"></i></button>
            <button class="btn-sm btn-delete" onclick="deleteOrder(${o.id}, '${o.order_number}')" title="حذف"><i class="fas fa-trash"></i></button></td>
    </tr>`).join('') : '<tr><td colspan="6" style="text-align:center;padding:40px;color:var(--muted)">لا توجد طلبات</td></tr>';
}

async function deleteOrder(id, orderNumber) {
    if (!confirm(`متأكدة إنك عايزة تحذفي الطلب ${orderNumber}؟ الإجراء ده نهائي ومش هينفع يترجع.`)) return;
    try {
        await api('orders', 'DELETE', null, `?id=eq.${id}`);
        toast(`تم حذف الطلب ${orderNumber}`);
        loadOrders();
    } catch (e) {
        toast('تعذّر حذف الطلب: ' + e.message);
    }
}

async function updateOrderStatus(id, status) {
    await api('orders', 'PATCH', { status, updated_at: new Date().toISOString() }, `?id=eq.${id}`);
    let msg = 'تم تحديث حالة الطلب';
    if (status === 'confirmed') {
        try {
            const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/create_invoice_from_order`, {
                method: 'POST', headers: await authHeaders(), body: JSON.stringify({ p_order_id: id })
            });
            const data = await res.json();
            if (data?.invoice_number && data.created) msg += ` — فاتورة ${data.invoice_number}`;
        } catch { /* trigger may have already created it */ }
    }
    if (status === 'delivered') {
        try {
            const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/award_order_rewards`, {
                method: 'POST',
                headers: await authHeaders(),
                body: JSON.stringify({ p_order_id: id })
            });
            const data = await res.json();
            if (data?.points > 0) msg += ` — ${data.points} نقطة مكافآت`;
        } catch { /* migration 013 may not be applied yet */ }
    }
    toast(msg);
}

function paymentStatusAr(s) {
    const map = { pending: 'بانتظار التأكيد', awaiting_review: 'بانتظار مراجعة الإيصال', confirmed: 'تم التأكيد' };
    return map[s] || s;
}

async function viewOrder(id) {
    const [o] = await api('orders', 'GET', null, `?id=eq.${id}`);
    const items = await api('order_items', 'GET', null, `?order_id=eq.${id}`);
    const proofHtml = o.payment_proof_url
        ? `<div><strong>إيصال التحويل:</strong><br><a href="${o.payment_proof_url}" target="_blank" rel="noopener noreferrer"><img src="${o.payment_proof_url}" style="max-width:100%;max-height:200px;border-radius:10px;margin-top:8px"></a></div>
           ${o.payment_status !== 'confirmed' ? `<button class="btn-primary" style="margin-top:12px" onclick="confirmOrderPayment(${o.id}, '${o.order_number}')"><i class="fas fa-check"></i> تأكيد الطلب${o.deposit_amount > 0 ? ` (${o.deposit_amount} ج.م)` : ''}</button>` : ''}`
        : '<div><strong>إيصال:</strong> لم يُرفع بعد</div>';
    openModal('تفاصيل الطلب #' + o.order_number, `
        <div style="display:flex;flex-direction:column;gap:12px">
            <div><strong>العميل:</strong> ${o.customer_name || '-'}</div>
            <div><strong>الهاتف:</strong> ${o.customer_phone || '-'}</div>
            <div><strong>العنوان:</strong> ${o.address || '-'}${o.city ? '، ' + o.city : ''}${o.governorate ? ' — ' + o.governorate : ''}</div>
            <div><strong>طريقة الدفع:</strong> ${o.payment_method}</div>
            <div><strong>حالة الدفع:</strong> <span class="status ${o.payment_status === 'confirmed' ? 'active' : 'pending'}">${paymentStatusAr(o.payment_status)}</span></div>
            <div><strong>حالة الطلب:</strong> <span class="status ${o.status}">${statusAr(o.status)}</span></div>
            ${proofHtml}
            ${(!o.payment_proof_url && o.payment_status !== 'confirmed') ? `<button class="btn-primary" style="margin-top:4px" onclick="confirmOrderPayment(${o.id}, '${o.order_number}')"><i class="fas fa-check"></i> تأكيد الطلب</button>` : ''}
            <hr style="border:none;border-top:1px solid var(--border)">
            <h4>المنتجات:</h4>
            ${items.map(i => `<div style="display:flex;justify-content:space-between"><span>${i.product_name} x${i.quantity}</span><strong>${i.total} ج.م</strong></div>`).join('')}
            <hr style="border:none;border-top:1px solid var(--border)">
            <div style="display:flex;justify-content:space-between;font-size:18px"><strong>الإجمالي</strong><strong style="color:var(--purple)">${o.total} ج.م</strong></div>
            <button class="btn-primary" style="margin-top:16px" onclick="closeModal(); openOrderInvoice(${o.id})"><i class="fas fa-file-invoice"></i> إصدار / طباعة فاتورة</button>
        </div>
    `);
}

async function confirmOrderPayment(id, orderNumber) {
    const confirmRes = await fetch('/api/send-telegram', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirm_order_number: orderNumber })
    }).then(r => r.json()).catch(() => null);

    if (!confirmRes?.ok) {
        // Confirm endpoint unreachable/misconfigured — still update the
        // order status directly so the admin isn't stuck, just without
        // the customer auto-notify.
        await api('orders', 'PATCH', {
            payment_status: 'confirmed',
            status: 'confirmed',
            updated_at: new Date().toISOString()
        }, `?id=eq.${id}`);
    }
    let msg = 'تم تأكيد الحجز';
    try {
        const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/create_invoice_from_order`, {
            method: 'POST', headers: await authHeaders(), body: JSON.stringify({ p_order_id: id })
        });
        const data = await res.json();
        if (data?.invoice_number) msg += ` — فاتورة ${data.invoice_number}`;
    } catch { /* ok */ }
    toast(msg);
    closeModal();
    loadOrders(document.querySelector('.filter-btn.active')?.dataset.status || 'all');
}

// Order filter buttons only (not banner tabs)
document.querySelectorAll('#page-orders .filter-bar .filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('#page-orders .filter-bar .filter-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        loadOrders(btn.dataset.status || 'all');
    });
});

// ===== CUSTOMERS =====
async function loadCustomers() {
    const customers = await api('customers', 'GET', null, '?select=*&order=created_at.desc');
    const tb = document.getElementById('customersTable');
    tb.innerHTML = customers.length ? customers.map(c => `<tr>
        <td><strong>${c.name}</strong></td>
        <td>${c.phone || '-'}</td>
        <td>${c.email || '-'}</td>
        <td><strong style="color:var(--gold)">${c.points}</strong></td>
        <td><span class="status active">${c.tier}</span></td>
        <td>${new Date(c.created_at).toLocaleDateString('ar')}</td>
    </tr>`).join('') : '<tr><td colspan="6" style="text-align:center;padding:40px;color:var(--muted)">لا يوجد عملاء بعد</td></tr>';
}

// ===== CATEGORIES =====
async function loadCategories() {
    const cats = await api('categories', 'GET', null, '?select=*&order=sort_order');
    const tb = document.getElementById('categoriesTable');
    tb.innerHTML = cats.map(c => `<tr>
        <td><i class="fas ${c.icon}" style="color:${c.color};font-size:20px"></i></td>
        <td><strong>${c.name}</strong></td>
        <td>${c.name_en || '-'}</td>
        <td><span class="status ${c.is_active ? 'active' : 'inactive'}">${c.is_active ? 'مفعل' : 'مخفي'}</span></td>
        <td><div class="action-btns">
            <button class="btn-sm btn-edit" onclick="editCategory(${c.id})"><i class="fas fa-pen"></i></button>
            <button class="btn-sm btn-delete" onclick="deleteCategory(${c.id})"><i class="fas fa-trash"></i></button>
        </div></td>
    </tr>`).join('');
}

function openCategoryModal(cat = null) {
    const c = cat || {};
    openModal(c.id ? 'تعديل القسم' : 'إضافة قسم', `
        <div class="form-group"><label>اسم القسم</label><input id="cName" value="${c.name || ''}"></div>
        <div class="form-group"><label>الاسم بالإنجليزي</label><input id="cNameEn" value="${c.name_en || ''}" dir="ltr"></div>
        <div class="form-row">
            <div class="form-group"><label>الأيقونة (Font Awesome)</label><input id="cIcon" value="${c.icon || 'fa-star'}" dir="ltr"></div>
            <div class="form-group"><label>اللون</label><input type="color" id="cColor" value="${c.color || '#9B6CB8'}"></div>
        </div>
        <button class="btn-primary" onclick="saveCategory(${c.id || 'null'})"><i class="fas fa-save"></i> حفظ القسم</button>
    `);
}

async function editCategory(id) {
    const [c] = await api('categories', 'GET', null, `?id=eq.${id}`);
    if (c) openCategoryModal(c);
}

async function saveCategory(id) {
    const data = {
        name: document.getElementById('cName').value,
        name_en: document.getElementById('cNameEn').value,
        slug: document.getElementById('cNameEn').value.toLowerCase().replace(/\s+/g, '-') || 'cat-' + Date.now(),
        icon: document.getElementById('cIcon').value,
        color: document.getElementById('cColor').value,
    };
    if (id) { await api('categories', 'PATCH', data, `?id=eq.${id}`); toast('تم تعديل القسم'); }
    else { await api('categories', 'POST', data); toast('تم إضافة القسم'); }
    closeModal(); loadCategories();
}

async function deleteCategory(id) {
    if (!confirm('هل أنت متأكد؟')) return;
    await api('categories', 'DELETE', null, `?id=eq.${id}`);
    toast('تم حذف القسم', 'error'); loadCategories();
}

// ===== COUPONS =====
async function loadCoupons() {
    const coupons = await api('coupons', 'GET', null, '?select=*&order=id');
    const tb = document.getElementById('couponsTable');
    tb.innerHTML = coupons.map(c => `<tr>
        <td><strong style="font-family:monospace;letter-spacing:1px">${c.code}</strong></td>
        <td>${c.discount_type === 'percentage' ? 'نسبة' : 'مبلغ ثابت'}</td>
        <td><strong>${c.discount_value}${c.discount_type === 'percentage' ? '%' : ' ج.م'}</strong></td>
        <td>${c.min_order} ج.م</td>
        <td>${c.used_count}/${c.max_uses}</td>
        <td><span class="status ${c.is_active ? 'active' : 'inactive'}">${c.is_active ? 'مفعل' : 'منتهي'}</span></td>
        <td><div class="action-btns">
            <button class="btn-sm btn-delete" onclick="deleteCoupon(${c.id})"><i class="fas fa-trash"></i></button>
        </div></td>
    </tr>`).join('');
}

function openCouponModal() {
    openModal('إضافة كوبون', `
        <div class="form-group"><label>الكود</label><input id="cpCode" dir="ltr" placeholder="MONTANA20" style="text-transform:uppercase"></div>
        <div class="form-row">
            <div class="form-group"><label>النوع</label><select id="cpType"><option value="percentage">نسبة مئوية</option><option value="fixed">مبلغ ثابت</option></select></div>
            <div class="form-group"><label>القيمة</label><input type="number" id="cpValue"></div>
        </div>
        <div class="form-row">
            <div class="form-group"><label>الحد الأدنى للطلب</label><input type="number" id="cpMin" value="0"></div>
            <div class="form-group"><label>عدد الاستخدامات</label><input type="number" id="cpMax" value="100"></div>
        </div>
        <button class="btn-primary" onclick="saveCoupon()"><i class="fas fa-save"></i> إضافة الكوبون</button>
    `);
}

async function saveCoupon() {
    await api('coupons', 'POST', {
        code: document.getElementById('cpCode').value.toUpperCase(),
        discount_type: document.getElementById('cpType').value,
        discount_value: parseFloat(document.getElementById('cpValue').value),
        min_order: parseFloat(document.getElementById('cpMin').value) || 0,
        max_uses: parseInt(document.getElementById('cpMax').value) || 100,
    });
    toast('تم إضافة الكوبون'); closeModal(); loadCoupons();
}

async function deleteCoupon(id) {
    if (!confirm('حذف الكوبون؟')) return;
    await api('coupons', 'DELETE', null, `?id=eq.${id}`);
    toast('تم حذف الكوبون', 'error'); loadCoupons();
}

// ===== REVIEWS =====
async function loadReviews() {
    const reviews = await api('reviews', 'GET', null, '?select=*,products(name)&order=created_at.desc');
    const tb = document.getElementById('reviewsTable');
    tb.innerHTML = reviews.length ? reviews.map(r => `<tr>
        <td>${r.customer_name}</td>
        <td>${r.products?.name || '-'}</td>
        <td>${'⭐'.repeat(r.rating)}</td>
        <td>${r.comment || '-'}</td>
        <td>${new Date(r.created_at).toLocaleDateString('ar')}</td>
        <td><button class="btn-sm btn-delete" onclick="deleteReview(${r.id})"><i class="fas fa-trash"></i></button></td>
    </tr>`).join('') : '<tr><td colspan="6" style="text-align:center;padding:40px;color:var(--muted)">لا توجد تقييمات</td></tr>';
}

async function deleteReview(id) {
    if (!confirm('حذف التقييم؟')) return;
    await api('reviews', 'DELETE', null, `?id=eq.${id}`);
    toast('تم حذف التقييم', 'error'); loadReviews();
}

// ===== INGREDIENTS =====
async function loadIngredients() {
    const rows = await api('ingredients', 'GET', null, '?select=*&order=sort_order');
    document.getElementById('ingredientsTable').innerHTML = rows.length ? rows.map(r => `<tr>
        <td><strong>${r.name}</strong></td>
        <td dir="ltr">${r.slug}</td>
        <td>${r.sort_order}</td>
        <td><div class="action-btns">
            <button class="btn-sm btn-edit" onclick="editIngredient(${r.id})"><i class="fas fa-pen"></i></button>
            <button class="btn-sm btn-delete" onclick="deleteIngredient(${r.id})"><i class="fas fa-trash"></i></button>
        </div></td>
    </tr>`).join('') : '<tr><td colspan="4" style="text-align:center;padding:40px;color:var(--muted)">لا توجد مكونات</td></tr>';
}

function openIngredientModal(ing = null) {
    const r = ing || {};
    openModal(r.id ? 'تعديل مكون' : 'إضافة مكون', `
        <div class="form-group"><label>الاسم</label><input id="ingName" value="${r.name || ''}"></div>
        <div class="form-group"><label>Slug</label><input id="ingSlug" value="${r.slug || ''}" dir="ltr"></div>
        <div class="form-group"><label>الوصف</label><textarea id="ingDesc">${r.description || ''}</textarea></div>
        <div class="form-group"><label>الترتيب</label><input type="number" id="ingOrder" value="${r.sort_order || 0}"></div>
        <button class="btn-primary" onclick="saveIngredient(${r.id || 'null'})"><i class="fas fa-save"></i> حفظ</button>
    `);
}

async function editIngredient(id) {
    const [r] = await api('ingredients', 'GET', null, `?id=eq.${id}`);
    if (r) openIngredientModal(r);
}

async function saveIngredient(id) {
    const data = {
        name: document.getElementById('ingName').value,
        slug: document.getElementById('ingSlug').value || document.getElementById('ingName').value.replace(/\s+/g, '-'),
        description: document.getElementById('ingDesc').value,
        sort_order: parseInt(document.getElementById('ingOrder').value) || 0
    };
    if (id) { await api('ingredients', 'PATCH', data, `?id=eq.${id}`); toast('تم التعديل'); }
    else { await api('ingredients', 'POST', data); toast('تم الإضافة'); }
    closeModal(); loadIngredients();
}

async function deleteIngredient(id) {
    if (!confirm('حذف المكون؟')) return;
    await api('ingredients', 'DELETE', null, `?id=eq.${id}`);
    toast('تم الحذف', 'error'); loadIngredients();
}

// ===== SHIPPING RATES =====
async function loadShippingRates() {
    const rows = await api('shipping_rates', 'GET', null, '?select=*&order=sort_order');
    document.getElementById('shippingTable').innerHTML = rows.map(r => `<tr>
        <td>${r.governorate}</td>
        <td><input type="number" value="${r.cost}" style="width:80px;padding:6px" onchange="updateShippingCost(${r.id}, this.value)"></td>
        <td><span class="status ${r.is_active ? 'active' : 'inactive'}">${r.is_active ? 'نشط' : 'معطل'}</span></td>
        <td><button class="btn-sm btn-edit" onclick="toggleShipping(${r.id}, ${!r.is_active})">${r.is_active ? 'تعطيل' : 'تفعيل'}</button></td>
    </tr>`).join('');
}

async function updateShippingCost(id, cost) {
    await api('shipping_rates', 'PATCH', { cost: parseFloat(cost) || 0 }, `?id=eq.${id}`);
    toast('تم تحديث السعر');
}

async function toggleShipping(id, active) {
    await api('shipping_rates', 'PATCH', { is_active: active }, `?id=eq.${id}`);
    loadShippingRates();
}

// ===== CONTACT MESSAGES =====
async function loadMessages() {
    const rows = await api('contact_messages', 'GET', null, '?select=*&order=created_at.desc&limit=100');
    document.getElementById('messagesTable').innerHTML = rows.length ? rows.map(m => `<tr>
        <td>${m.name}</td>
        <td dir="ltr">${m.email}</td>
        <td>${m.subject}</td>
        <td style="max-width:240px;white-space:pre-wrap;font-size:12px">${m.message}</td>
        <td>${new Date(m.created_at).toLocaleDateString('ar')}</td>
    </tr>`).join('') : '<tr><td colspan="5" style="text-align:center;padding:40px;color:var(--muted)">لا توجد رسائل</td></tr>';
}

async function loadReturns() {
    const rows = await api('return_requests', 'GET', null, '?select=*&order=created_at.desc&limit=100');
    const statusMap = { pending: 'قيد المراجعة', approved: 'مقبول', rejected: 'مرفوض', completed: 'مكتمل' };
    document.getElementById('returnsTable').innerHTML = rows.length ? rows.map(r => `<tr>
        <td dir="ltr">${r.order_number}</td>
        <td>${r.customer_name}</td>
        <td dir="ltr">${r.customer_phone}</td>
        <td>${r.reason}</td>
        <td style="max-width:200px;font-size:12px">${r.details || '—'}</td>
        <td><select class="status-select" onchange="updateReturnStatus(${r.id}, this.value)">
            <option value="pending" ${r.status==='pending'?'selected':''}>قيد المراجعة</option>
            <option value="approved" ${r.status==='approved'?'selected':''}>مقبول</option>
            <option value="rejected" ${r.status==='rejected'?'selected':''}>مرفوض</option>
            <option value="completed" ${r.status==='completed'?'selected':''}>مكتمل</option>
        </select></td>
        <td>${new Date(r.created_at).toLocaleDateString('ar')}</td>
    </tr>`).join('') : '<tr><td colspan="7" style="text-align:center;padding:40px;color:var(--muted)">لا توجد طلبات إرجاع</td></tr>';
}

async function updateReturnStatus(id, status) {
    await api('return_requests', 'PATCH', { status }, `?id=eq.${id}`);
    toast('تم تحديث حالة الإرجاع');
}

// ===== INVOICES =====
function openManualInvoice() {
    const tok = window.__ADMIN_TOKEN__ || '';
    if (!tok) { toast('سجّل دخول Admin أولاً', 'error'); return; }
    try { localStorage.setItem('__ADMIN_TOKEN__', tok); } catch { /* ignore */ }
    sessionStorage.setItem('__ADMIN_TOKEN__', tok);
    window.open(`invoice.html?at=${encodeURIComponent(tok)}`, '_blank');
}

function openOrderInvoice(orderId) {
    const tok = window.__ADMIN_TOKEN__ || '';
    if (!tok) { toast('سجّل دخول Admin أولاً', 'error'); return; }
    try { localStorage.setItem('__ADMIN_TOKEN__', tok); } catch { /* ignore */ }
    sessionStorage.setItem('__ADMIN_TOKEN__', tok);
    const q = new URLSearchParams({ order_id: String(orderId), at: tok });
    window.open(`invoice.html?${q.toString()}`, '_blank');
}

function openSavedInvoice(invoiceId) {
    const tok = window.__ADMIN_TOKEN__ || '';
    if (!tok) { toast('سجّل دخول Admin أولاً', 'error'); return; }
    try { localStorage.setItem('__ADMIN_TOKEN__', tok); } catch { /* ignore */ }
    sessionStorage.setItem('__ADMIN_TOKEN__', tok);
    const q = new URLSearchParams({ invoice_id: String(invoiceId), at: tok });
    window.open(`invoice.html?${q.toString()}`, '_blank');
}

async function loadInvoicesPage() {
    const orders = await api('orders', 'GET', null, '?select=id,order_number,customer_name,customer_phone,total,status,created_at&order=created_at.desc&limit=50');
    const invOrdersTb = document.getElementById('invoiceOrdersTable');
    invOrdersTb.innerHTML = orders.length ? orders.map(o => `<tr>
        <td><strong>${o.order_number}</strong></td>
        <td>${o.customer_name || '-'}<br><small style="color:var(--muted)">${o.customer_phone || ''}</small></td>
        <td><strong style="color:var(--purple)">${o.total} ج.م</strong></td>
        <td><span class="status ${o.status}">${statusAr(o.status)}</span></td>
        <td>${new Date(o.created_at).toLocaleDateString('ar')}</td>
        <td><button class="btn-sm btn-edit" onclick="openOrderInvoice(${o.id})"><i class="fas fa-file-invoice"></i> فاتورة</button></td>
    </tr>`).join('') : '<tr><td colspan="6" style="text-align:center;padding:40px;color:var(--muted)">لا توجد طلبات</td></tr>';

    let invoices = [];
    try {
        invoices = await api('invoices', 'GET', null, '?select=*,orders(order_number)&order=created_at.desc&limit=100');
    } catch {
        invoices = [];
    }
    const invTb = document.getElementById('invoicesTable');
    const srcMap = { order: 'طلب', doctor: 'CRM', customer: 'عميل', manual: 'يدوي' };
    invTb.innerHTML = invoices.length ? invoices.map(inv => `<tr>
        <td><strong>${inv.invoice_number}</strong></td>
        <td>${srcMap[inv.source_type] || inv.source_type || '—'}</td>
        <td>${inv.orders?.order_number || '—'}</td>
        <td>${inv.customer_name}<br><small style="color:var(--muted)">${inv.customer_phone || ''}</small></td>
        <td><strong style="color:var(--purple)">${inv.total} ج.م</strong></td>
        <td>${inv.stock_deducted ? '<span class="status active">مخصوم</span>' : '<span class="status pending">—</span>'}</td>
        <td>${new Date(inv.invoice_date || inv.created_at).toLocaleDateString('ar')}</td>
        <td>
            <button class="btn-sm btn-edit" onclick="openSavedInvoice(${inv.id})"><i class="fas fa-eye"></i></button>
            <button class="btn-sm btn-delete" onclick="deleteInvoiceRecord(${inv.id}, ${inv.stock_deducted ? 'true' : 'false'})"><i class="fas fa-trash"></i></button>
        </td>
    </tr>`).join('') : '<tr><td colspan="8" style="text-align:center;padding:40px;color:var(--muted)">لا توجد فواتير محفوظة — أنشئ فاتورة من طلب واحفظها</td></tr>';
}

async function loadAdminSalesReport() {
    const inp = document.getElementById('adminSalesMonth');
    const out = document.getElementById('adminSalesReport');
    if (!inp || !out) return;
    if (!inp.value) {
        const n = new Date();
        inp.value = `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}`;
    }
    const [y, m] = inp.value.split('-').map(Number);
    try {
        const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/get_sales_report`, {
            method: 'POST', headers: await authHeaders(), body: JSON.stringify({ p_year: y, p_month: m })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'error');
        const t = data.totals || {};
        const brickRows = (data.by_brick || []).slice(0, 5).map(r =>
            `<tr><td>${r.brick || '—'}</td><td>${r.invoice_count || 0}</td><td><strong>${Number(r.revenue || 0).toFixed(0)} ج.م</strong></td></tr>`
        ).join('') || '<tr><td colspan="3">لا بيانات</td></tr>';
        out.innerHTML = `
            <div class="stats-grid" style="margin-bottom:16px">
                <div class="stat-card gold"><div class="stat-info"><h3>${Number(t.total_revenue || 0).toFixed(0)}</h3><span>إيرادات الشهر</span></div></div>
                <div class="stat-card purple"><div class="stat-info"><h3>${t.invoice_count || 0}</h3><span>فواتير</span></div></div>
                <div class="stat-card blue"><div class="stat-info"><h3>${t.pending_b2b || 0}</h3><span>B2B معلّقة (CRM)</span></div></div>
            </div>
            <h4 style="margin-bottom:8px">أعلى المناطق (Brick)</h4>
            <table class="data-table"><thead><tr><th>Brick</th><th>فواتير</th><th>إيراد</th></tr></thead><tbody>${brickRows}</tbody></table>`;
    } catch (e) {
        out.textContent = 'تعذّر تحميل التقرير — تأكد من migration 039';
    }
}

async function deleteInvoiceRecord(id, hadStock) {
    const extra = hadStock ? '\n\nسيتم استرجاع المخزون المخصوم.' : '';
    if (!confirm('حذف هذه الفاتورة من النظام؟' + extra)) return;
    await api('invoices', 'DELETE', null, `?id=eq.${id}`);
    toast('تم حذف الفاتورة', 'error');
    loadInvoicesPage();
}

// ===== CRM =====
function openCrmAdmin(sameTab = true) {
    const url = `${location.origin}/crm/admin/`;
    if (sameTab) {
        location.href = url;
        return;
    }
    const w = window.open(url, '_blank', 'noopener,noreferrer');
    if (!w) location.href = url;
}
function openCrmRep() {
    const url = `${location.origin}/crm/rep/`;
    const w = window.open(url, '_blank', 'noopener,noreferrer');
    if (!w) location.href = url;
}
function openCrmGuide() {
    const url = `${location.origin}/crm/guide.html`;
    const w = window.open(url, '_blank', 'noopener,noreferrer');
    if (!w) location.href = url;
}
function openCrmLogin() {
    location.href = `${location.origin}/crm/`;
}

async function loadCrmPage() {
    const banner = document.getElementById('crmAccessBanner');
    const statsGrid = document.getElementById('crmStatsGrid');
    if (!banner) return;

    let isCrmAdmin = false;
    try {
        const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/is_crm_admin`, { method: 'POST', headers: await authHeaders(), body: '{}' });
        isCrmAdmin = (await res.json()) === true;
    } catch { /* ignore */ }

    if (isCrmAdmin) {
        banner.innerHTML = '<div class="crm-access ok"><i class="fas fa-check-circle"></i> حساب Admin المتجر مربوط — اضغط «فتح لوحة CRM» للدخول مباشرة</div>';
        statsGrid.style.display = '';
        try {
            const reps = await api('crm_reps', 'GET', null, '?select=id&active=eq.true');
            const pending = await api('crm_doctors', 'GET', null, '?select=id&approved=eq.false');
            const monthStart = new Date();
            monthStart.setDate(1);
            monthStart.setHours(0, 0, 0, 0);
            const visits = await api('crm_visits', 'GET', null, `?select=id&visited_at=gte.${monthStart.toISOString()}`);
            const flagged = await api('crm_visits', 'GET', null, '?select=id&gps_verified=eq.false');
            document.getElementById('crmStatReps').textContent = reps.length;
            document.getElementById('crmStatDoctors').textContent = pending.length;
            document.getElementById('crmStatVisits').textContent = visits.length;
            document.getElementById('crmStatFlagged').textContent = flagged.length;
        } catch {
            statsGrid.style.display = 'none';
        }
    } else {
        banner.innerHTML = '<div class="crm-access warn"><i class="fas fa-info-circle"></i> لوحة CRM تحتاج حساب <strong>crm_reps</strong> بصلاحية Admin. افتح <a href="/crm/" target="_blank" rel="noopener">/crm</a> وسجّل بحساب CRM، أو اربط نفس البريد في جدول المندوبين.</div>';
        statsGrid.style.display = 'none';
    }
}

// ===== SETTINGS =====
async function loadSettings() {
    const settings = await api('site_settings', 'GET', null, '?select=*');
    settings.forEach(s => {
        const el = document.getElementById('set_' + s.key);
        if (el) el.value = s.value || '';
    });
    loadIntegrationStatus();
}

async function loadIntegrationStatus() {
    const paymobEl = document.getElementById('paymobStatus');
    const gridEl = document.getElementById('integrationsStatus');
    const urlsEl = document.getElementById('webhookUrls');
    if (!paymobEl && !gridEl) return;

    let base = 'https://www.montana.com.eg';
    try {
        const cfg = await import('/js/site-config.js');
        base = cfg.PUBLIC_SITE_URL || base;
    } catch { /* use default */ }
    if (urlsEl) {
        urlsEl.innerHTML = `
            <strong>Webhook URLs — انسخها في Meta Developers:</strong><br>
            WhatsApp: <code dir="ltr">${base}/api/whatsapp-webhook</code><br>
            Messenger (Facebook): <code dir="ltr">${base}/api/messenger-webhook</code><br>
            Instagram: <code dir="ltr">${base}/api/instagram-webhook</code><br>
            Telegram (زر تأكيد): <code dir="ltr">${base}/api/telegram-webhook</code><br>
            Paymob (callback): <code dir="ltr">${base}/api/paymob-webhook</code>`;
    }

    try {
        const res = await fetch('/api/integrations-status');
        const st = await res.json();

        if (paymobEl) {
            paymobEl.className = 'integration-status ' + (st.paymob ? 'ok' : 'off');
            paymobEl.textContent = st.paymob
                ? '✓ Paymob متصل على السيرفر — البطاقة تظهر في Checkout عند التفعيل'
                : '✗ Paymob غير مضبوط — أضف PAYMOB_* في Vercel';
        }

        if (gridEl) {
            const items = [
                ['Telegram (إشعارات الطلبات)', st.telegram, 'TELEGRAM_BOT_TOKEN + TELEGRAM_CHAT_ID + SUPABASE_SERVICE_ROLE_KEY'],
                ['WhatsApp Business (شات)', st.whatsapp, 'WHATSAPP_TOKEN + WHATSAPP_PHONE_NUMBER_ID'],
                ['Messenger (شات)', st.messenger, 'MESSENGER_PAGE_TOKEN'],
                ['Instagram DM (شات)', st.instagram, 'INSTAGRAM_PAGE_TOKEN'],
                ['Gemini (شات AI)', st.gemini, 'GEMINI_API_KEY']
            ];
            gridEl.innerHTML = items.map(([label, ok, hint]) => `
                <div class="integration-badge ${ok ? 'ok' : 'off'}">
                    <span>${label}</span>
                    <span>${ok ? '✓ مربوط' : '— غير مضبوط'}</span>
                </div>
                ${ok ? '' : `<small style="color:var(--muted);font-size:10px;margin:-4px 0 4px 4px">${hint}</small>`}
            `).join('');
        }
    } catch {
        if (paymobEl) { paymobEl.className = 'integration-status off'; paymobEl.textContent = 'تعذّر التحقق — شغّل السيرفر محلياً أو انشر على Vercel'; }
        if (gridEl) gridEl.textContent = 'تعذّر التحقق من حالة الربط';
    }
}

async function saveSettings() {
    const keys = ['site_name','site_tagline','phone','email','whatsapp','address','working_hours',
        'free_shipping_min','shipping_cost','express_shipping_cost','return_days',
        'instapay_wallet_number','instapay_wallet_name',
        'primary_color','dark_color','facebook_url','instagram_url','tiktok_url','paymob_card_enabled'];

    for (const key of keys) {
        const el = document.getElementById('set_' + key);
        if (!el) continue;
        const value = String(el.value ?? '');
        const existing = await api('site_settings', 'GET', null, `?key=eq.${key}&select=key`);
        if (existing.length) {
            await api('site_settings', 'PATCH', { value, updated_at: new Date().toISOString() }, `?key=eq.${key}`);
        } else {
            await api('site_settings', 'POST', { key, value });
        }
    }
    toast('تم حفظ الإعدادات');
    loadIntegrationStatus();
}

// Status select styling
document.addEventListener('change', e => {
    if (e.target.classList.contains('status-select')) {
        e.target.style.color = { pending: '#D4AF37', confirmed: '#3b82f6', preparing: '#3b82f6', shipped: '#9B6CB8', delivered: '#27ae60', cancelled: '#EF5350' }[e.target.value];
    }
});

// ===== INIT =====
loadDashboard();
const startPage = new URLSearchParams(location.search).get('page');
if (startPage) document.querySelector(`[data-page="${startPage}"]`)?.click();
