'use strict';

const { sendTelegramMessage, validateTelegramBot } = require('../lib/telegram');
const { setCors, sendJson, readJsonBody, checkAdmin } = require('../lib/http');

async function handler(req, res) {
  setCors(res);

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }

  if (!checkAdmin(req)) {
    sendJson(res, 401, { ok: false, error: 'Unauthorized' });
    return;
  }

  if (req.method !== 'POST') {
    sendJson(res, 405, { ok: false, error: 'Method not allowed' });
    return;
  }

  try {
    var body = await readJsonBody(req);
    var token = String(body.bot_token || body.token || '').trim();
    var chatId = body.chat_id;
    var text = String(body.text || '').trim();
    var testOnly = !!body.test;

    if (testOnly && !text) {
      text = 'Montana Admin — اتصال ناجح!';
    }

    if (testOnly && token && !chatId) {
      var bot = await validateTelegramBot(token);
      if (!bot.ok) {
        sendJson(res, 400, { ok: false, error: bot.error });
        return;
      }
      sendJson(res, 200, {
        ok: true,
        bot: bot.data,
        message: 'البوت شغال — دلوقتي جرّبي إرسال رسالة بالـ Chat ID'
      });
      return;
    }

    var result = await sendTelegramMessage(token, chatId, text);
    if (!result.ok) {
      sendJson(res, 400, { ok: false, error: result.error });
      return;
    }

    sendJson(res, 200, { ok: true, message: 'تم الإرسال بنجاح', result: result.data });
  } catch (err) {
    console.error('[api/telegram/send]', err);
    sendJson(res, 500, { ok: false, error: err.message || 'Internal server error' });
  }
}

module.exports = handler;
