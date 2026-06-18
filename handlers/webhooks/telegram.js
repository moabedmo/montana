'use strict';

const {
  approveByProofId,
  approveByTelegramMessageId,
  getProof,
  isApprovalText,
  extractProofId
} = require('../../lib/deposit-proofs');
const {
  sendTelegramMessage,
  resolveTelegramConfig,
  resolveWebhookUrl,
  registerTelegramWebhook,
  answerCallbackQuery,
  editMessageReplyMarkup,
  getWebhookInfo
} = require('../../lib/telegram');
const { setCors, sendJson, readJsonBody, checkAdmin } = require('../../lib/http');

function normalizeChatIdStr(chatId) {
  return String(chatId == null ? '' : chatId).trim();
}

function isAdminChat(chatId, cfg) {
  var expected = normalizeChatIdStr(cfg.chatId);
  var actual = normalizeChatIdStr(chatId);
  if (!expected || !actual) return false;
  if (expected.charAt(0) === '@') return actual === expected;
  if (actual === expected) return true;
  if (String(Number(actual)) === String(Number(expected))) return true;
  return false;
}

function chatMatchesProof(chatId, proof) {
  if (!proof || !proof.telegramChatId) return false;
  var a = normalizeChatIdStr(chatId);
  var b = normalizeChatIdStr(proof.telegramChatId);
  if (a === b) return true;
  if (String(Number(a)) === String(Number(b))) return true;
  return false;
}

async function safeAnswer(token, cqId, text, showAlert) {
  if (!cqId || !token) return;
  try {
    await answerCallbackQuery(token, cqId, text || ' ', showAlert);
  } catch (e) {
    console.error('[webhooks/telegram] answerCallbackQuery failed:', e.message);
  }
}

async function ensureWebhook(cfg) {
  try {
    var result = await registerTelegramWebhook(cfg.token);
    if (!result.ok) console.warn('[webhooks/telegram] webhook:', result.error);
  } catch (e) {
    console.warn('[webhooks/telegram] webhook:', e.message);
  }
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
  try {
    await editMessageReplyMarkup(cfg.token, chatId, messageId, {
      inline_keyboard: [[{ text: '✅ تمت الموافقة', callback_data: 'approved' }]]
    });
  } catch (e) {
    console.warn('[webhooks/telegram] editMessageReplyMarkup:', e.message);
  }
}

async function handleCallbackQuery(body, cfg) {
  var cq = body.callback_query;
  var cqId = cq && cq.id;
  var chatId = cq && cq.message && cq.message.chat && cq.message.chat.id;
  var messageId = cq && cq.message && cq.message.message_id;
  var answerText = '';
  var answerAlert = false;

  try {
    if (!cq || !cq.data) {
      return { ok: true, ignored: true };
    }

    var data = String(cq.data || '');
    if (data === 'approved') {
      answerText = 'تمت الموافقة مسبقًا';
      return { ok: true, ignored: true };
    }

    if (data.indexOf('approve:') !== 0) {
      answerText = 'أمر غير معروف';
      answerAlert = true;
      return { ok: true, ignored: true };
    }

    var proofId = data.slice('approve:'.length);
    var existing = await getProof(proofId);

    if (!isAdminChat(chatId, cfg) && !chatMatchesProof(chatId, existing)) {
      answerText = 'غير مصرح';
      answerAlert = true;
      return { ok: true, ignored: true };
    }

    var proof = null;
    if (existing) {
      proof = await approveByProofId(proofId);
    }
    if (!proof && messageId) {
      proof = await approveByTelegramMessageId(messageId);
    }

    if (!proof) {
      answerText = 'طلب التحويل غير موجود';
      answerAlert = true;
      return { ok: true, matched: false };
    }

    answerText = '✅ تمت الموافقة';
    await markMessageApproved(cfg, chatId, messageId);
    await notifyApproved(cfg, proof);
    return { ok: true, approved: true, proofId: proof.id };
  } catch (err) {
    console.error('[webhooks/telegram] callback error:', err);
    answerText = '❌ ' + (err.message || 'خطأ');
    answerAlert = true;
    throw err;
  } finally {
    if (cqId) await safeAnswer(cfg.token, cqId, answerText || ' ', answerAlert);
  }
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

  if (req.method === 'GET') {
    var cfg = resolveTelegramConfig();
    if (!cfg.token) {
      sendJson(res, 503, { ok: false, error: 'TELEGRAM_BOT_TOKEN missing' });
      return;
    }

    var setup = req.query && req.query.setup === '1';
    if (setup) {
      if (!checkAdmin(req)) {
        sendJson(res, 401, { ok: false, error: 'Unauthorized' });
        return;
      }
      await ensureWebhook(cfg);
    }

    var info = await getWebhookInfo(cfg.token);
    sendJson(res, 200, {
      ok: true,
      webhook: info.ok ? info.data : null,
      webhookError: info.ok ? null : info.error,
      expectedUrl: resolveWebhookUrl(),
      hint: 'لو الزر بيفضل يحمّل: اضغطي «ربط Webhook» من لوحة الأدمن'
    });
    return;
  }

  if (req.method !== 'POST') {
    sendJson(res, 405, { ok: false, error: 'Method not allowed' });
    return;
  }

  var body = null;
  var cfg = null;
  var cqId = null;

  try {
    body = await readJsonBody(req);
    cfg = resolveTelegramConfig();
    cqId = body.callback_query && body.callback_query.id;

    if (!cfg.token || !cfg.chatId) {
      sendJson(res, 503, { ok: false, error: 'Telegram not configured' });
      return;
    }

    await ensureWebhook(cfg);

    var result;
    if (body.callback_query) {
      result = await handleCallbackQuery(body, cfg);
    } else {
      result = await handleTextMessage(body, cfg);
    }

    sendJson(res, 200, result);
  } catch (err) {
    console.error('[api/webhooks/telegram]', err);
    if (cqId && cfg && cfg.token) {
      await safeAnswer(cfg.token, cqId, '❌ ' + (err.message || 'خطأ'), true);
    }
    sendJson(res, 200, { ok: false, error: err.message || 'Internal server error' });
  }
}

module.exports = handler;
