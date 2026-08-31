// Owner alerts raised from the admin / CRM screens.
//
// These come from the browser on purpose. Unlike a new order — which also
// arrives from Messenger and Instagram where no browser exists, and so must be
// announced server-side — an invoice or a status change is always a person
// clicking in the admin UI, so the client is the honest place to fire from.
const { sanitizeTelegramField } = require('./security');

const ORDER_STATUS_AR = {
  pending: 'قيد الانتظار',
  confirmed: 'مؤكد',
  preparing: 'جاري التجهيز',
  shipped: 'تم الشحن',
  delivered: 'تم التوصيل',
  cancelled: 'ملغي',
  returned: 'مرتجع',
};

/** Only states worth interrupting the owner for. */
const ALERTING_ORDER_STATUSES = ['cancelled', 'returned'];

function money(v) {
  const n = Number(v);
  return Number.isFinite(n) ? `${Math.round(n)} ج` : null;
}

function formatAdminAlert(kind, data = {}) {
  if (kind === 'invoice_created') {
    const lines = ['🧾 *فاتورة صيدلية جديدة*'];
    const num = sanitizeTelegramField(data.invoice_number, 30);
    const pharmacy = sanitizeTelegramField(data.pharmacy, 60);
    const rep = sanitizeTelegramField(data.rep, 40);
    const total = money(data.total);
    if (num) lines.push(`رقم: ${num}`);
    if (pharmacy) lines.push(`الصيدلية: ${pharmacy}`);
    if (rep) lines.push(`المندوب: ${rep}`);
    if (total) lines.push(`الإجمالي: *${total}*`);
    return lines.length > 1 ? lines.join('\n') : null;
  }

  if (kind === 'order_status') {
    const status = String(data.status || '').toLowerCase();
    if (!ALERTING_ORDER_STATUSES.includes(status)) return null;
    const num = sanitizeTelegramField(data.order_number, 20);
    if (!num) return null;
    const head = status === 'cancelled' ? '❌ *أوردر اتلغى*' : '↩️ *أوردر اترجّع*';
    const lines = [head, `رقم الطلب: ${num}`];
    const customer = sanitizeTelegramField(data.customer_name, 60);
    const total = money(data.total);
    if (customer) lines.push(`العميل: ${customer}`);
    if (total) lines.push(`القيمة: ${total}`);
    return lines.join('\n');
  }

  return null;
}

module.exports = { formatAdminAlert, ORDER_STATUS_AR, ALERTING_ORDER_STATUSES };
