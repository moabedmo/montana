'use strict';

const {
  approveByProofId,
  approveByTelegramMessageId,
  isApprovalText,
  extractProofId
} = require('../../lib/deposit-proofs');
const { sendTelegramMessage, resolveTelegramConfig } = require('../../lib/telegram');
const { setCors, sendJson, readJsonBody } = require('../../lib/http');

function isAdminChat(chatId, cfg) {
  var expected = String(cfg.chatId || '').trim();
  if (!expected) return false;
  if (expected.charAt(0) === '@') return String(chatId) === expected;
  return String(chatId) === expected || String(chatId) === String(Number(expected));
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
    var msg = body.message || body.edited_message;
    if (!msg || !msg.text) {
      sendJson(res, 200, { ok: true, ignored: true });
      return;
    }

    var cfg = resolveTelegramConfig();
    if (!cfg.token || !cfg.chatId) {
      sendJson(res, 503, { ok: false, error: 'Telegram not configured' });
      return;
    }

    if (!isAdminChat(msg.chat && msg.chat.id, cfg)) {
      sendJson(res, 200, { ok: true, ignored: true });
      return;
    }

    var text = String(msg.text || '').trim();
    if (!isApprovalText(text)) {
      sendJson(res, 200, { ok: true, ignored: true });
      return;
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
        '⚠️ مفيش طلب تحويل مطابق. ردّي «تم» على صورة التحويل مباشرة.'
      );
      sendJson(res, 200, { ok: true, matched: false });
      return;
    }

    await sendTelegramMessage(
      cfg.token,
      cfg.chatId,
      '✅ تمت الموافقة — العميل ' + (proof.name || '') + ' (' + (proof.phone || '') + ') يقدر يأكّد الأوردر دلوقتي.'
    );

    sendJson(res, 200, { ok: true, approved: true, proofId: proof.id });
  } catch (err) {
    console.error('[api/webhooks/telegram]', err);
    sendJson(res, 500, { ok: false, error: err.message || 'Internal server error' });
  }
}

module.exports = handler;
