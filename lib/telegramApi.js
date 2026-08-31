// Telegram Bot API helpers (admin notifications + inline confirm button).
const PUBLIC_SITE_URL = process.env.PUBLIC_SITE_URL || 'https://www.montana.com.eg';

// A stalled Telegram API call used to hang the awaiting request
// indefinitely (no timeout at all) — from the admin's side that looked
// exactly like the "confirm order" button doing nothing. Bound every call
// so a slow/unreachable Telegram fails fast instead.
const TG_TIMEOUT_MS = 8000;

async function tgApi(token, method, body) {
  const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(TG_TIMEOUT_MS),
  });
  return res.json();
}

async function tgMultipart(token, method, form) {
  const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: 'POST',
    body: form,
    signal: AbortSignal.timeout(TG_TIMEOUT_MS),
  });
  return res.json();
}

// setWebhook was being re-sent before every single order/proof notification
// instead of once — an extra unguarded round-trip on the same hot path that
// only ever needs to run once per warm instance (Telegram keeps the webhook
// registered between calls; nothing here changes between requests).
let webhookEnsured = false;

async function ensureTelegramWebhook(token) {
  if (!token || process.env.TELEGRAM_SKIP_WEBHOOK_SET === '1' || webhookEnsured) return;
  const url = `${PUBLIC_SITE_URL}/api/telegram-webhook`;
  await tgApi(token, 'setWebhook', {
    url,
    // 'message' is here so the webhook can report the chat id it is being
    // written from. Telegram answers "chat not found" when TELEGRAM_CHAT_ID is
    // stale (a group upgraded to a supergroup changes its id, or the bot was
    // removed) — and that error is otherwise impossible to debug from outside.
    allowed_updates: ['callback_query', 'message'],
    drop_pending_updates: false,
  });
  webhookEnsured = true;
}

async function sendOrderTelegramMessage(token, chatId, text, orderNumber, showConfirm) {
  const body = {
    chat_id: chatId,
    text,
    parse_mode: 'Markdown',
    disable_web_page_preview: false,
  };
  if (showConfirm && orderNumber) {
    body.reply_markup = {
      inline_keyboard: [[
        { text: '✅ تأكيد الطلب', callback_data: `confirm:${orderNumber}` },
      ]],
    };
  }
  return tgApi(token, 'sendMessage', body);
}

async function sendOrderProofPhoto(token, chatId, photoUrl, caption, orderNumber) {
  const body = {
    chat_id: chatId,
    photo: photoUrl,
    caption,
    parse_mode: 'HTML',
  };
  if (orderNumber) {
    body.reply_markup = {
      inline_keyboard: [[
        { text: '✅ تأكيد الطلب', callback_data: `confirm:${orderNumber}` },
      ]],
    };
  }
  return tgApi(token, 'sendPhoto', body);
}

/** Send receipt image as uploaded file (reliable — Telegram may fail to fetch Supabase URLs). */
async function sendOrderProofBuffer(token, chatId, buffer, mime, caption, orderNumber) {
  const ext = /png/i.test(mime || '') ? 'png' : /webp/i.test(mime || '') ? 'webp' : 'jpg';
  const form = new FormData();
  form.append('chat_id', String(chatId));
  form.append('photo', new Blob([buffer], { type: mime || 'image/jpeg' }), `proof.${ext}`);
  form.append('caption', caption);
  form.append('parse_mode', 'HTML');
  if (orderNumber) {
    form.append('reply_markup', JSON.stringify({
      inline_keyboard: [[
        { text: '✅ تأكيد الطلب', callback_data: `confirm:${orderNumber}` },
      ]],
    }));
  }
  return tgMultipart(token, 'sendPhoto', form);
}

/** Generic message with an arbitrary row of inline buttons — used for
 *  discount-approval requests (Approve/Reject) and other CRM alerts. */
async function sendMessageWithButtons(token, chatId, text, buttons) {
  const body = { chat_id: chatId, text, parse_mode: 'Markdown' };
  if (buttons?.length) {
    body.reply_markup = { inline_keyboard: [buttons] };
  }
  return tgApi(token, 'sendMessage', body);
}

async function clearMessageButtons(token, chatId, messageId) {
  return tgApi(token, 'editMessageReplyMarkup', {
    chat_id: chatId,
    message_id: messageId,
    reply_markup: { inline_keyboard: [] },
  });
}

async function answerCallbackQuery(token, callbackQueryId, text) {
  return tgApi(token, 'answerCallbackQuery', {
    callback_query_id: callbackQueryId,
    text,
    show_alert: !!text && text.length > 40,
  });
}

async function editMessageConfirmed(token, chatId, messageId, orderNumber) {
  return tgApi(token, 'editMessageReplyMarkup', {
    chat_id: chatId,
    message_id: messageId,
    reply_markup: { inline_keyboard: [] },
  }).then(() => tgApi(token, 'sendMessage', {
    chat_id: chatId,
    text: `✅ *تم تأكيد* \`${orderNumber}\` — العميل اتبلّغ`,
    parse_mode: 'Markdown',
  }));
}

module.exports = {
  ensureTelegramWebhook,
  sendOrderTelegramMessage,
  sendOrderProofPhoto,
  sendOrderProofBuffer,
  sendMessageWithButtons,
  clearMessageButtons,
  answerCallbackQuery,
  editMessageConfirmed,
};
