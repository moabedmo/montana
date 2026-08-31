// Stock alerts for the store owner — fired from create_order once the order
// row exists, so every sales channel (site, chat, Messenger, Instagram) is
// covered by one code path.
const { sendOrderTelegramMessage } = require('./telegramApi');
const { sanitizeTelegramField } = require('./security');

/** Matches get_low_stock_products() in migration 041. */
const LOW_STOCK_THRESHOLD = 50;

/**
 * Which products crossed a stock line *because of this order*.
 *
 * Deliberately crossing-based, not level-based: alerting whenever stock is
 * merely below the line would fire on every single order once a product runs
 * low, and an alert that arrives 40 times a day stops being read. A product
 * announces itself once on the way down, and again only if it hits zero.
 */
function stockCrossings(items, stockBefore, threshold = LOW_STOCK_THRESHOLD) {
  const crossings = [];
  for (const item of items || []) {
    const before = Number(stockBefore?.[String(item.id)]);
    if (!Number.isFinite(before)) continue;
    const qty = Number(item.qty) || 0;
    const after = before - qty;
    if (before > 0 && after <= 0) {
      crossings.push({ name: item.name, after: Math.max(0, after), level: 'out' });
    } else if (before > threshold && after <= threshold) {
      crossings.push({ name: item.name, after, level: 'low' });
    }
  }
  return crossings;
}

function formatStockAlert(crossings, orderNumber, threshold = LOW_STOCK_THRESHOLD) {
  if (!crossings?.length) return null;
  const out = crossings.filter((c) => c.level === 'out');
  const low = crossings.filter((c) => c.level === 'low');
  const lines = [];
  if (out.length) {
    lines.push('🔴 *خلص من المخزون*');
    out.forEach((c) => lines.push(`• ${sanitizeTelegramField(c.name, 60)}`));
  }
  if (low.length) {
    if (lines.length) lines.push('');
    lines.push(`🟠 *قرب يخلص* (أقل من ${threshold})`);
    low.forEach((c) => lines.push(`• ${sanitizeTelegramField(c.name, 60)} — فاضل ${c.after}`));
  }
  if (orderNumber) {
    lines.push('');
    lines.push(`بعد الأوردر ${orderNumber}`);
  }
  return lines.join('\n');
}

/** Never throws: an alert must not be able to lose an order already saved. */
async function notifyStockCrossings(items, stockBefore, orderNumber) {
  try {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;
    if (!token || !chatId) return { ok: false, error: 'not configured' };
    const crossings = stockCrossings(items, stockBefore);
    const text = formatStockAlert(crossings, orderNumber);
    if (!text) return { ok: true, skipped: true };
    const res = await sendOrderTelegramMessage(token, chatId, text, null, false);
    if (!res?.ok) console.warn('[stock-alert] not delivered', res?.error || res?.description);
    return res;
  } catch (e) {
    console.warn('[stock-alert] threw', e.message);
    return { ok: false, error: e.message };
  }
}

module.exports = {
  LOW_STOCK_THRESHOLD,
  stockCrossings,
  formatStockAlert,
  notifyStockCrossings,
};
