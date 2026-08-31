// Telegram bot webhook — handles inline "confirm order" and CRM discount
// approve/reject button presses.
const { confirmOrderByNumber, notifyCustomerOrderConfirmed } = require('../lib/orderConfirm');
const { autoSendOrderToBosta, resolveWebhookBaseUrl } = require('../lib/bostaHandlers');
const { decideDiscountRequest } = require('../lib/crmDiscountApprove');
const { answerCallbackQuery, editMessageConfirmed, clearMessageButtons } = require('../lib/telegramApi');

async function handleDiscountDecision(req, res, token, cb, data, approve) {
  const prefix = approve ? 'approve_discount:' : 'reject_discount:';
  const approvalId = data.slice(prefix.length);

  const result = await decideDiscountRequest(approvalId, approve);

  if (result.error === 'telegram_not_configured' || result.error === 'unauthorized') {
    await answerCallbackQuery(token, cb.id, 'فعّل telegram_confirm_key في site_settings');
    return res.json({ ok: true });
  }
  if (!result.ok) {
    await answerCallbackQuery(token, cb.id, result.error === 'not_found' ? 'الطلب مش موجود' : 'تعذّر التنفيذ');
    return res.json({ ok: true });
  }
  if (result.already) {
    await answerCallbackQuery(token, cb.id, `القرار اتاخد بالفعل: ${result.status}`);
    return res.json({ ok: true });
  }

  await answerCallbackQuery(token, cb.id, approve ? 'تمت الموافقة ✅' : 'تم الرفض ❌');
  if (cb.message?.message_id) {
    await clearMessageButtons(token, cb.message.chat.id, cb.message.message_id);
  }
  return res.json({ ok: true, approval_id: approvalId, result });
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  const token = process.env.TELEGRAM_BOT_TOKEN;
  const adminChatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !adminChatId) {
    return res.status(503).json({ ok: false, error: 'Telegram not configured' });
  }

  try {
    const update = req.body || {};
    const cb = update.callback_query;
    if (!cb) {
      // Not a button press. Log which chat it came from: when order alerts stop
      // arriving it is almost always because TELEGRAM_CHAT_ID no longer matches
      // this chat, and Telegram's "chat not found" says nothing about the real
      // one. Sending the bot any message now prints the id to fix it with.
      const chat = update.message?.chat
        || update.my_chat_member?.chat
        || update.channel_post?.chat;
      if (chat) {
        console.log('[telegram] message from chat id=%s type=%s name=%s | configured TELEGRAM_CHAT_ID=%s | match=%s',
          chat.id, chat.type, chat.title || chat.username || '', adminChatId,
          String(chat.id) === String(adminChatId));
      }
      return res.json({ ok: true });
    }

    const fromChatId = String(cb.message?.chat?.id ?? '');
    if (fromChatId !== String(adminChatId)) {
      await answerCallbackQuery(token, cb.id, 'غير مصرح');
      return res.json({ ok: true });
    }

    const data = String(cb.data || '');

    if (data.startsWith('approve_discount:')) return handleDiscountDecision(req, res, token, cb, data, true);
    if (data.startsWith('reject_discount:')) return handleDiscountDecision(req, res, token, cb, data, false);

    if (!data.startsWith('confirm:')) {
      await answerCallbackQuery(token, cb.id, 'أمر غير معروف');
      return res.json({ ok: true });
    }

    const orderNumber = data.slice('confirm:'.length);
    if (!/^MON-\d{5}$/.test(orderNumber)) {
      await answerCallbackQuery(token, cb.id, 'رقم طلب غير صالح');
      return res.json({ ok: true });
    }

    const result = await confirmOrderByNumber(orderNumber);

    if (result.error === 'confirm_key_mismatch') {
      await answerCallbackQuery(token, cb.id, 'فعّل تأكيد Telegram: حط TELEGRAM_CHAT_ID في site_settings (telegram_confirm_key)');
      return res.json({ ok: true });
    }

    if (!result.ok) {
      await answerCallbackQuery(token, cb.id, result.error === 'not_found' ? 'الطلب مش موجود' : 'تعذّر التأكيد');
      return res.json({ ok: true });
    }

    if (result.already) {
      await answerCallbackQuery(token, cb.id, `الطلب ${orderNumber} مؤكد بالفعل`);
      return res.json({ ok: true });
    }

    const notify = await notifyCustomerOrderConfirmed(result);

    autoSendOrderToBosta({
      orderNumber,
      webhookBaseUrl: resolveWebhookBaseUrl(req),
    }).catch(() => {});

    await answerCallbackQuery(token, cb.id, notify.notified ? 'تم التأكيد ✅' : 'تم التأكيد (بدون إشعار للعميل)');

    if (cb.message?.message_id) {
      await editMessageConfirmed(token, fromChatId, cb.message.message_id, orderNumber);
    }

    res.json({ ok: true, order_number: orderNumber, notify });
  } catch (err) {
    console.error('telegram-webhook:', err.message);
    res.status(200).json({ ok: false });
  }
};
