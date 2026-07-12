// Server-side Telegram notifications for new orders + payment proofs.
const { ensureTelegramWebhook, sendOrderTelegramMessage, sendOrderProofPhoto, sendOrderProofBuffer } = require('./telegramApi');
const { sanitizeTelegramField, isSafeHttpUrl } = require('./security');

function tgConfigured() {
  return !!(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID);
}

function payLabel(method) {
  return { cod: 'COD', wallet: 'Wallet/Instapay', card: 'Card' }[method] || sanitizeTelegramField(method, 20);
}

function escHtml(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function buildOrderCaptionHtml({
  order_number,
  total,
  customer_name,
  customer_phone,
  deposit_amount,
  payment_method,
  points_redeemed,
  isProofUpdate,
}) {
  const header = isProofUpdate ? '🧾 <b>إيصال تحويل — Montana</b>' : '🛍️ <b>طلب جديد — Montana</b>';
  const lines = [
    header,
    `📋 <code>${escHtml(sanitizeTelegramField(order_number, 20))}</code>`,
    customer_name ? `👤 ${escHtml(sanitizeTelegramField(customer_name))}` : null,
    customer_phone ? `📱 <code>${escHtml(sanitizeTelegramField(customer_phone, 20))}</code>` : null,
    payment_method ? `💳 ${escHtml(payLabel(payment_method))}` : null,
    total != null ? `💰 الإجمالي: <b>${Math.round(Number(total) || 0)} ج.م</b>` : null,
    deposit_amount != null && deposit_amount > 0 ? `📥 المقدّم: <b>${Math.round(Number(deposit_amount) || 0)} ج.م</b>` : null,
    points_redeemed > 0 ? `👑 نقاط: <b>${Math.round(Number(points_redeemed) || 0)}</b>` : null,
    '',
    '<i>اضغط ✅ تأكيد الطلب لإبلاغ العميل</i>',
  ];
  return lines.filter((x) => x !== null && x !== undefined).join('\n');
}

async function fetchProofBuffer(url) {
  const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new Error(`fetch proof ${res.status}`);
  const mime = res.headers.get('content-type') || 'image/jpeg';
  return { buffer: Buffer.from(await res.arrayBuffer()), mime };
}

async function notifyTelegramOrder(payload = {}) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) {
    return { ok: false, error: 'Telegram not configured' };
  }

  const {
    order_number,
    total,
    customer_name,
    customer_phone,
    payment_proof_url,
    proof_buffer,
    proof_mime,
    deposit_amount,
    payment_method,
    points_redeemed,
    isProofUpdate,
  } = payload;

  if (!order_number || !/^MON-\d{5}$/.test(order_number)) {
    return { ok: false, error: 'Invalid order_number' };
  }

  const safeProof = payment_proof_url && isSafeHttpUrl(payment_proof_url) ? payment_proof_url : null;
  const hasProof = !!(proof_buffer?.length || safeProof);
  await ensureTelegramWebhook(token);

  if (hasProof) {
    const caption = buildOrderCaptionHtml({
      order_number,
      total,
      customer_name,
      customer_phone,
      deposit_amount,
      payment_method,
      points_redeemed,
      isProofUpdate: true,
    });

    let photoResult = null;

    if (proof_buffer?.length) {
      photoResult = await sendOrderProofBuffer(token, chatId, proof_buffer, proof_mime, caption, order_number);
    } else if (safeProof) {
      try {
        const fetched = await fetchProofBuffer(safeProof);
        photoResult = await sendOrderProofBuffer(token, chatId, fetched.buffer, fetched.mime, caption, order_number);
      } catch (e) {
        console.error('[telegram] fetch proof for sendPhoto:', e.message);
        photoResult = await sendOrderProofPhoto(token, chatId, safeProof, caption, order_number);
      }
    }

    if (photoResult?.ok) return photoResult;

    console.error('[telegram] sendPhoto failed:', photoResult);
    return photoResult || { ok: false, error: 'sendPhoto failed' };
  }

  const plainLines = [
    isProofUpdate ? '🧾 إيصال تحويل — Montana' : '🛍️ طلب جديد — Montana',
    `📋 \`${sanitizeTelegramField(order_number, 20)}\``,
    customer_name ? `👤 ${sanitizeTelegramField(customer_name)}` : null,
    customer_phone ? `📱 \`${sanitizeTelegramField(customer_phone, 20)}\`` : null,
    total != null ? `💰 الإجمالي: *${Math.round(Number(total) || 0)} ج.م*` : null,
    '',
    '_اضغط ✅ تأكيد الطلب لإبلاغ العميل_',
  ].filter(Boolean).join('\n');

  return sendOrderTelegramMessage(token, chatId, plainLines, order_number, true);
}

module.exports = { notifyTelegramOrder, tgConfigured };
