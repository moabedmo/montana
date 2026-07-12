// Daily digest of overdue/due-soon B2B invoices — triggered by Vercel Cron
// (see vercel.json + api/crm-visit-notify.js GET branch). Uses the same
// telegram_confirm_key gate as the rest of the CRM Telegram flows so no
// logged-in session (or service-role key) is required.
const { createClient } = require('@supabase/supabase-js');
const { sendMessageWithButtons } = require('./telegramApi');

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://ikryeyqrithikabwidov.supabase.co';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlrcnlleXFyaXRoaWthYndpZG92Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE3MzY1ODcsImV4cCI6MjA5NzMxMjU4N30.kNfHPxV4fq67cOF8uFsTrLOxPYcLcmmDO3ScIHzI9Uo';
const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

function confirmKey() {
  return process.env.TELEGRAM_CONFIRM_KEY || process.env.TELEGRAM_CHAT_ID || '';
}

function escMd(s) {
  return String(s || '').replace(/([_*[\]()`])/g, '\\$1');
}

async function notifyOverdueInvoices() {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return { ok: false, error: 'Telegram not configured' };

  const key = confirmKey();
  const { data, error } = await sb.rpc('get_overdue_invoices_for_alert', { p_confirm_key: key });
  if (error) return { ok: false, error: error.message };
  if (!data?.ok) return { ok: false, error: data?.error || 'unauthorized' };

  const rows = data.rows || [];
  if (!rows.length) return { ok: true, sent: false, count: 0 };

  const lines = rows.map((r) => {
    const remaining = Math.round(Number(r.total || 0) - Number(r.amount_paid || 0));
    const days = Math.max(0, Math.round((Date.now() - new Date(r.due_date).getTime()) / 86400000));
    return `• ${escMd(r.invoice_number)} — ${escMd(r.doctor_name || '—')} (${escMd(r.rep_name || '—')}) — *${remaining} ج.م* متأخرة ${days} يوم`;
  }).join('\n');

  const text = `⏰ *فواتير متأخرة التحصيل* (${rows.length})\n\n${lines}`;
  const result = await sendMessageWithButtons(token, chatId, text, []);
  return { ok: true, sent: true, count: rows.length, telegram: result?.ok !== false };
}

module.exports = { notifyOverdueInvoices };
