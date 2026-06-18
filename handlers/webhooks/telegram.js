'use strict';

const {
  approveByProofId,
  approveByTelegramMessageId,
  isApprovalText,
  extractProofId
} = require('../../lib/deposit-proofs');
const {
  sendTelegramMessage,
  resolveTelegramConfig,
  answerCallbackQuery,
  editMessageReplyMarkup
} = require('../../lib/telegram');
const { setCors, sendJson, readJsonBody } = require('../../lib/http');

function isAdminChat(chatId, cfg) {
  var expected = String(cfg.chatId || '').trim();
  if (!expected) return false;
  if (expected.charAt(0) === '@') return String(chatId) === expected;
  return String(chatId) === expected || String(chatId) === String(Number(expected));
}

async function notifyApproved(cfg, proof) {
  await sendTelegramMessage(
    cfg.token,
    cfg.chatId,
    '✅ تمت الموافقة — العميل ' + (proof.name || '') + ' (' + (proof.phone || '') + ') يقدر يأكّد الأوردر دلوقتي.'
  );
}

async function markMessageApproved(cfg, chatId, messageId) {
  if (!messageId) return;
  await editMessageReplyMarkup(cfg.token, chatId, messageId, {
    inline_keyboard: [[{ text: '✅ تمت الموافقة', callback_data: 'approved' }]]
  });
}

async function handleCallbackQuery(body, cfg) {
  var cq = body.callback_query;
  if (!cq || !cq.data) {
    return { ok: true, ignored: true };
  }

  var chatId = cq.message && cq.message.chat && cq.message.chat.id;
  if (!isAdminChat(chatId, cfg)) {
    if (cq.id) await answerCallbackQuery(cfg.token, cq.id, 'غير مصرح');
    return { ok: true, ignored: true };
  }

  var data = String(cq.data || '');
  if (data === 'approved') {
    if (cq.id) await answerCallbackQuery(cfg.token, cq.id, 'تمت الموافقة مسبقًا');
    return { ok: true, ignored: true };
  }

  if (data.indexOf('approve:') !== 0) {
    if (cq.id) await answerCallbackQuery(cfg.token, cq.id, 'أمر غير معروف');
    return { ok: true, ignored: true };
  }

  var proofId = data.slice('approve:'.length);
  var proof = await approveByProofId(proofId);
  if (!proof) {
    if (cq.id) await answerCallbackQuery(cfg.token, cq.id, 'طلب التحويل غير موجود');
    return { ok: true, matched: false };
  }

  if (cq.id) await answerCallbackQuery(cfg.token, cq.id, '✅ تمت الموافقة');
  await markMessageApproved(cfg, chatId, cq.message && cq.message.message_id);
  await notifyApproved(cfg, proof);
  return { ok: true, approved: true, proofId: proof.id };
}

async function handleTextMessage(body, cfg) {
  var msg = body.message || body.edited_message;
  if (!msg || !msg.text) {
    return { ok: true, ignored: true };
  }

  if (!isAdminChat(msg.chat && msg.chat.id, cfg)) {
    return { ok: true, ignored: true };
  }

  var text = String(msg.text || '').trim();
  if (!isApprovalText(text)) {
    return { ok: true, ignored: true };
  }

  var proof = null;
  if (msg.reply_to_message && msg.reply_to_message.message_id) {
    proof = await approveByTelegramMessageId(msg.reply_to_message.message_id);
  }
  if (!proof) {
    var proofId = extractProofId(text);
    if (proofId) proof = await approveByProofId(proofId);
  }

  if (!proof) {
    await sendTelegramMessage(
      cfg.token,
      cfg.chatId,
      '⚠️ مفيش طلب تحويل مطابق. اضغطي «✅ موافقة» أو ردّي «تم» على صورة التحويل.'
    );
    return { ok: true, matched: false };
  }

  if (msg.reply_to_message && msg.reply_to_message.message_id) {
    await markMessageApproved(cfg, msg.chat.id, msg.reply_to_message.message_id);
  }
  await notifyApproved(cfg, proof);
  return { ok: true, approved: true, proofId: proof.id };
}

async function handler(req, res) {
  setCors(res);

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }

  if (req.method !== 'POST') {
    sendJson(res, 405, { ok: false, error: 'Method not allowed' });
    return;
  }

  try {
    var body = await readJsonBody(req);
    var cfg = resolveTelegramConfig();
    if (!cfg.token || !cfg.chatId) {
      sendJson(res, 503, { ok: false, error: 'Telegram not configured' });
      return;
    }

    var result;
    if (body.callback_query) {
      result = await handleCallbackQuery(body, cfg);
    } else {
      result = await handleTextMessage(body, cfg);
    }

    sendJson(res, 200, result);
  } catch (err) {
    console.error('[api/webhooks/telegram]', err);
    sendJson(res, 500, { ok: false, error: err.message || 'Internal server error' });
  }
}

module.exports = handler;
