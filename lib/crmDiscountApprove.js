// Discount-approval Telegram flow — mirrors lib/orderConfirm.js's confirm-key
// pattern so the webhook can act without a logged-in Supabase session.
const { createClient } = require('@supabase/supabase-js');
const { ensureTelegramWebhook, sendMessageWithButtons, clearMessageButtons } = require('./telegramApi');
const { sanitizeTelegramField } = require('./security');

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://ikryeyqrithikabwidov.supabase.co';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlrcnlleXFyaXRoaWthYndpZG92Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE3MzY1ODcsImV4cCI6MjA5NzMxMjU4N30.kNfHPxV4fq67cOF8uFsTrLOxPYcLcmmDO3ScIHzI9Uo';
const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

function confirmKey() {
  return process.env.TELEGRAM_CONFIRM_KEY || process.env.TELEGRAM_CHAT_ID || '';
}

function escMd(s) {
  return String(s || '').replace(/([_*[\]()`])/g, '\\$1');
}

async function notifyDiscountRequest({ approval_id, rep_name, doctor_name, discount_pct, subtotal, requested_total, items }) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return { ok: false, error: 'Telegram not configured' };

  await ensureTelegramWebhook(token);

  const lines = (items || []).map((it) => `• ${escMd(it.name || it.product_id)} × ${it.qty}`).join('\n');
  const text = [
    '💸 *طلب خصم يحتاج موافقة*',
    `👤 المندوب: ${escMd(sanitizeTelegramField(rep_name, 60))}`,
    `🏥 العميل: ${escMd(sanitizeTelegramField(doctor_name, 60))}`,
    `📦 المنتجات:\n${lines}`,
    `💰 قبل الخصم: *${Math.round(subtotal)} ج.م*`,
    `🔻 الخصم المطلوب: *${discount_pct}%*`,
    `💵 الإجمالي بعد الخصم: *${Math.round(requested_total)} ج.م*`,
  ].join('\n');

  return sendMessageWithButtons(token, chatId, text, [
    { text: '✅ موافقة', callback_data: `approve_discount:${approval_id}` },
    { text: '❌ رفض', callback_data: `reject_discount:${approval_id}` },
  ]);
}

async function decideDiscountRequest(approvalId, approve) {
  const key = confirmKey();
  if (!key) return { ok: false, error: 'telegram_not_configured' };

  const { data, error } = await sb.rpc('crm_approve_discount_request', {
    p_id: approvalId,
    p_confirm_key: key,
    p_approve: approve,
  });
  if (error) {
    console.error('crm_approve_discount_request:', error.message);
    return { ok: false, error: 'decide_failed' };
  }
  return data;
}

module.exports = { notifyDiscountRequest, decideDiscountRequest, clearMessageButtons };
