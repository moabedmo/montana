// Telegram notifications for CRM visit / financial activity.
const { sendOrderTelegramMessage } = require('./telegramApi');
const { sanitizeTelegramField } = require('./security');

function finSummary(financialRequests) {
  if (!Array.isArray(financialRequests) || !financialRequests.length) return '';
  return financialRequests.map((r) => {
    if (!r?.enabled) return null;
    if (r.type === 'sample_invoice') return '📦 فاتورة عينات';
    if (r.type === 'leaflet_deal') {
      return `📄 روشيتات: ${sanitizeTelegramField(r.pharmacy_name, 40)} — ${r.leaflet_count || 0} × ${r.amount || 0} ج.م`;
    }
    if (r.type === 'pharmacy_delivery') {
      const mode = { cash: 'كاش', credit: 'آجل', partial: 'جزئي' }[r.payment_mode] || r.payment_mode;
      const lines = (r.lines || []).filter((l) => l.qty > 0).length;
      return `💊 تسليم صيدلية (${mode}): ${lines} منتج — مدفوع ${r.amount_paid || 0} ج.م`;
    }
    return null;
  }).filter(Boolean).join('\n');
}

async function notifyCrmVisit(payload = {}) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return { ok: false, error: 'Telegram not configured' };

  const {
    rep_name,
    doctor_name,
    doctor_type,
    visit_type,
    time_of_day,
    sample_units,
    needs_b2b,
    financial_requests,
    notes,
    gps_verified,
    distance_m,
    visit_id,
  } = payload;

  const fin = finSummary(financial_requests);
  const lines = [
    '🩺 *زيارة CRM جديدة — Montana*',
    `👤 المندوب: ${sanitizeTelegramField(rep_name, 60)}`,
    `🏥 العميل: ${sanitizeTelegramField(doctor_name, 80)} (${sanitizeTelegramField(doctor_type, 20) || 'doctor'})`,
    `🕐 ${sanitizeTelegramField(time_of_day, 4) || 'AM'} · ${sanitizeTelegramField(visit_type, 20) || 'regular'}`,
    sample_units > 0 ? `📦 عينات: *${sample_units}* وحدة` : null,
    gps_verified === false ? `⚠️ GPS: ${distance_m != null ? distance_m + 'm' : 'غير متحقق'}` : '📍 GPS: OK',
    needs_b2b || fin ? '🧾 *طلبات فواتير:*' : null,
    fin || (needs_b2b ? '• B2B invoice requested' : null),
    notes ? `📝 ${sanitizeTelegramField(notes, 200)}` : null,
    visit_id ? `\`visit:${String(visit_id).slice(0, 8)}\`` : null,
  ].filter(Boolean);

  return sendOrderTelegramMessage(token, chatId, lines.join('\n'), null, false);
}

module.exports = { notifyCrmVisit };
