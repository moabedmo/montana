/**
 * Owner alerts from the admin / CRM screens: a new pharmacy invoice, and an
 * order that was cancelled or returned. Ordinary status moves (confirmed,
 * shipped, delivered) must stay silent — alerting on those would bury the two
 * that actually need attention.
 *
 * Run: node scripts/test-admin-alerts.js
 */
const fs = require('fs');
const path = require('path');
const { formatAdminAlert, ALERTING_ORDER_STATUSES } = require('../lib/adminAlerts');

let failed = 0;
function assert(cond, label) {
  if (!cond) { failed += 1; console.error('FAIL:', label); } else { console.log('ok:', label); }
}

// ── invoice ──
const inv = formatAdminAlert('invoice_created', {
  invoice_number: 'INV-2026-014', pharmacy: 'صيدلية النور', rep: 'محمد سعيد', total: 4250,
});
assert(/فاتورة صيدلية جديدة/.test(inv), 'invoice alert is labelled');
assert(/INV-2026-014/.test(inv), 'carries the invoice number');
assert(/صيدلية النور/.test(inv) && /محمد سعيد/.test(inv), 'carries pharmacy and rep');
assert(/4250 ج/.test(inv), 'carries the total');
assert(formatAdminAlert('invoice_created', {}) === null, 'an empty invoice payload sends nothing');

// ── order status ──
const cancelled = formatAdminAlert('order_status', {
  status: 'cancelled', order_number: 'MON-12345', customer_name: 'سارة محمد', total: 777,
});
assert(/اتلغى/.test(cancelled) && /MON-12345/.test(cancelled), 'cancelled alert names the order');
assert(/سارة محمد/.test(cancelled) && /777/.test(cancelled), 'cancelled alert carries customer + value');

const returned = formatAdminAlert('order_status', { status: 'returned', order_number: 'MON-12345' });
assert(/اترجّع/.test(returned), 'returned alert is distinct from cancelled');

['confirmed', 'preparing', 'shipped', 'delivered', 'pending'].forEach((s) => {
  assert(formatAdminAlert('order_status', { status: s, order_number: 'MON-12345' }) === null,
    `"${s}" sends nothing (normal progress)`);
});
assert(formatAdminAlert('order_status', { status: 'cancelled' }) === null, 'no order number → nothing sent');
assert(ALERTING_ORDER_STATUSES.length === 2, 'exactly two statuses alert');

// ── unknown kinds are refused, not guessed ──
assert(formatAdminAlert('something_else', { a: 1 }) === null, 'unknown alert kind sends nothing');
assert(formatAdminAlert(undefined) === null, 'missing kind sends nothing');

// ── the callers must not block on, or throw from, the alert ──
const adminJs = fs.readFileSync(path.join(__dirname, '..', 'admin.js'), 'utf8');
const statusFn = adminJs.slice(adminJs.indexOf('async function updateOrderStatus'), adminJs.indexOf('async function updateOrderStatus') + 1400);
assert(/admin_alert: 'order_status'/.test(statusFn), 'admin.js sends the status alert');
assert(/\.catch\(\(\) => \{\}\)/.test(statusFn), 'admin.js alert is fire-and-forget');
assert(/catch \{/.test(statusFn), 'admin.js wraps the lookup so a failure cannot break the status change');

const crmApi = fs.readFileSync(path.join(__dirname, '..', 'crm', 'js', 'crm-api.js'), 'utf8');
const createIdx = crmApi.indexOf("crm_pharmacy_invoices').insert(row)");
const createFn = crmApi.slice(createIdx, createIdx + 900);
assert(/admin_alert: 'invoice_created'/.test(createFn), 'crm-api.js sends the invoice alert');
assert(/\.catch\(\(\) => \{\}\)/.test(createFn), 'crm-api.js alert is fire-and-forget');
assert(createFn.indexOf('admin_alert') > createFn.indexOf('if (error) throw error'),
  'the alert only fires after the invoice actually saved');

if (failed) { console.error(`\n${failed} test(s) failed`); process.exit(1); }
console.log('\nall passed');
