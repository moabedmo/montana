// Daily owner digest on Telegram: yesterday's storefront sales and the
// pharmacy invoicing/collection for the same day.
//
// It rides the existing 07:00 cron tick (api/crm-visit-notify.js) rather than
// taking its own schedule — the Vercel Hobby plan allows only two cron jobs and
// the other slot is already spoken for.
const { createClient } = require('@supabase/supabase-js');
const { sendOrderTelegramMessage } = require('./telegramApi');

// Same fallback chain as the other lib/ modules: this file must never throw at
// require() time, or it would take the whole daily cron down with it.
const sb = createClient(
  process.env.SUPABASE_URL || 'https://ikryeyqrithikabwidov.supabase.co',
  process.env.SERVICE_ROLE
    || process.env.SUPABASE_SERVICE_ROLE_KEY
    || process.env.SUPABASE_ANON_KEY
    || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlrcnlleXFyaXRoaWthYndpZG92Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE3MzY1ODcsImV4cCI6MjA5NzMxMjU4N30.kNfHPxV4fq67cOF8uFsTrLOxPYcLcmmDO3ScIHzI9Uo'
);

/** Cairo is UTC+2 year-round; the 07:00 UTC tick lands at 09:00 local. */
function cairoDayBounds(daysAgo = 1) {
  const now = new Date();
  const cairo = new Date(now.getTime() + 2 * 60 * 60 * 1000);
  cairo.setUTCDate(cairo.getUTCDate() - daysAgo);
  const y = cairo.getUTCFullYear();
  const m = cairo.getUTCMonth();
  const d = cairo.getUTCDate();
  const startLocal = Date.UTC(y, m, d, 0, 0, 0) - 2 * 60 * 60 * 1000;
  const endLocal = startLocal + 24 * 60 * 60 * 1000;
  const label = `${String(d).padStart(2, '0')}/${String(m + 1).padStart(2, '0')}`;
  return { from: new Date(startLocal).toISOString(), to: new Date(endLocal).toISOString(), label };
}

function egp(n) {
  return `${Math.round(Number(n) || 0)} ج`;
}

async function buildDailyDigest(daysAgo = 1) {
  const { from, to, label } = cairoDayBounds(daysAgo);

  const [ordersRes, invoicesRes] = await Promise.all([
    sb.from('orders').select('order_number, total, status, items').gte('created_at', from).lt('created_at', to),
    sb.from('crm_pharmacy_invoices').select('total, amount_paid').gte('created_at', from).lt('created_at', to),
  ]);

  const orders = (ordersRes.data || []).filter((o) => o.status !== 'cancelled');
  const revenue = orders.reduce((s, o) => s + (Number(o.total) || 0), 0);

  // Best seller by quantity across the day's orders
  const qtyByName = {};
  for (const o of orders) {
    for (const it of (Array.isArray(o.items) ? o.items : [])) {
      const name = it.product_name || it.name;
      if (!name) continue;
      qtyByName[name] = (qtyByName[name] || 0) + (Number(it.quantity || it.qty) || 0);
    }
  }
  const top = Object.entries(qtyByName).sort((a, b) => b[1] - a[1])[0] || null;

  const invoices = invoicesRes.data || [];
  const invoiced = invoices.reduce((s, i) => s + (Number(i.total) || 0), 0);
  const collected = invoices.reduce((s, i) => s + (Number(i.amount_paid) || 0), 0);

  const lines = [`📊 *ملخص ${label}*`, ''];
  lines.push('🛍️ *المتجر*');
  lines.push(orders.length ? `• ${orders.length} أوردر — ${egp(revenue)}` : '• مفيش أوردرات');
  if (top) lines.push(`• الأكتر مبيعًا: ${top[0]} (${top[1]})`);

  lines.push('');
  lines.push('🧾 *الصيدليات*');
  if (invoices.length) {
    lines.push(`• ${invoices.length} فاتورة — ${egp(invoiced)}`);
    lines.push(`• المحصّل: ${egp(collected)}`);
    const outstanding = invoiced - collected;
    if (outstanding > 0) lines.push(`• الباقي: ${egp(outstanding)}`);
  } else {
    lines.push('• مفيش فواتير');
  }

  return {
    text: lines.join('\n'),
    orders: orders.length,
    revenue,
    invoices: invoices.length,
    invoiced,
    collected,
  };
}

/** Never throws — the cron runs other jobs after this one. */
async function sendDailyDigest(daysAgo = 1) {
  try {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;
    if (!token || !chatId) return { ok: false, error: 'not configured' };
    const digest = await buildDailyDigest(daysAgo);
    const res = await sendOrderTelegramMessage(token, chatId, digest.text, null, false);
    return { ok: !!res?.ok, error: res?.ok ? null : (res?.error || res?.description || null), ...digest };
  } catch (e) {
    console.warn('[daily-digest] failed', e.message);
    return { ok: false, error: e.message };
  }
}

module.exports = { buildDailyDigest, sendDailyDigest, cairoDayBounds };
