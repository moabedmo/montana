'use strict';

async function telegramRequest(token, method, body) {
  var url = 'https://api.telegram.org/bot' + encodeURIComponent(token) + '/' + method;
  var res = await fetch(url, {
    method: body ? 'POST' : 'GET',
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined
  });

  var data;
  try {
    data = await res.json();
  } catch (e) {
    return { ok: false, error: 'رد غير متوقع من Telegram', status: res.status };
  }

  if (!res.ok || !data.ok) {
    return {
      ok: false,
      error: explainTelegramError(data),
      status: res.status,
      telegram: data
    };
  }

  return { ok: true, data: data.result, status: res.status };
}

function explainTelegramError(data) {
  var desc = (data && data.description) ? String(data.description) : '';
  var code = data && data.error_code;

  if (code === 401 || /unauthorized/i.test(desc)) {
    return 'توكن البوت غلط — انسخيه تاني من BotFather';
  }
  if (/chat not found/i.test(desc)) {
    return 'Chat ID غلط أو البوت مش متضاف للمجموعة — ابعتي /start للبوت أو ضيفيه للجروب';
  }
  if (/bot was blocked/i.test(desc)) {
    return 'البوت متبلوك — ابعتي /start للبوت من حسابك';
  }
  if (/group chat was upgraded|supergroup/i.test(desc)) {
    return 'المجموعة اتحولت Supergroup — حدّثي Chat ID من getUpdates';
  }
  if (/wrong file identifier|can't parse entities|parse/i.test(desc)) {
    return 'مشكلة في تنسيق الرسالة — جرّبي تاني';
  }
  if (desc) return desc;
  return 'فشل الاتصال بـ Telegram — تأكدي من التوكن و Chat ID';
}

function normalizeChatId(chatId) {
  var raw = String(chatId || '').trim();
  if (!raw) return '';
  if (raw.charAt(0) === '@') return raw;
  if (/^-?\d+$/.test(raw)) return Number(raw);
  return raw;
}

async function validateTelegramBot(token) {
  return telegramRequest(String(token || '').trim(), 'getMe');
}

async function sendTelegramMessage(token, chatId, text) {
  token = String(token || '').trim();
  chatId = normalizeChatId(chatId);
  text = String(text || '').trim();

  if (!token) return { ok: false, error: 'Bot Token مطلوب' };
  if (!chatId) return { ok: false, error: 'Chat ID مطلوب' };
  if (!text) return { ok: false, error: 'نص الرسالة مطلوب' };
  if (!/^\d+:[A-Za-z0-9_-]+$/.test(token)) {
    return { ok: false, error: 'شكل التوكن غلط — لازم يكون زي 123456789:ABCdef...' };
  }

  var me = await validateTelegramBot(token);
  if (!me.ok) return me;

  return telegramRequest(token, 'sendMessage', {
    chat_id: chatId,
    text: text
  });
}

function resolveTelegramConfig() {
  return {
    token: String(process.env.TELEGRAM_BOT_TOKEN || process.env.TG_BOT_TOKEN || '').trim(),
    chatId: String(process.env.TELEGRAM_CHAT_ID || process.env.TG_CHAT_ID || '').trim()
  };
}

async function sendTelegramPhoto(token, chatId, imageBase64, caption) {
  token = String(token || '').trim();
  chatId = normalizeChatId(chatId);
  caption = String(caption || '').trim().slice(0, 1024);

  if (!token) return { ok: false, error: 'Bot Token مطلوب' };
  if (!chatId) return { ok: false, error: 'Chat ID مطلوب' };

  var b64 = String(imageBase64 || '').replace(/^data:[^;]+;base64,/, '');
  if (!b64) return { ok: false, error: 'صورة مطلوبة' };

  var buffer;
  try {
    buffer = Buffer.from(b64, 'base64');
  } catch (e) {
    return { ok: false, error: 'صورة غير صالحة' };
  }
  if (!buffer.length) return { ok: false, error: 'صورة فارغة' };
  if (buffer.length > 8 * 1024 * 1024) return { ok: false, error: 'الصورة كبيرة — الحد 8MB' };

  var me = await validateTelegramBot(token);
  if (!me.ok) return me;

  var boundary = '----Montana' + Date.now();
  var chunks = [];
  function addPart(text) { chunks.push(Buffer.from(text, 'utf8')); }

  addPart('--' + boundary + '\r\nContent-Disposition: form-data; name="chat_id"\r\n\r\n' + chatId + '\r\n');
  if (caption) {
    addPart('--' + boundary + '\r\nContent-Disposition: form-data; name="caption"\r\n\r\n' + caption + '\r\n');
  }
  addPart('--' + boundary + '\r\nContent-Disposition: form-data; name="photo"; filename="deposit.jpg"\r\nContent-Type: image/jpeg\r\n\r\n');
  chunks.push(buffer);
  addPart('\r\n--' + boundary + '--\r\n');

  var body = Buffer.concat(chunks);
  var url = 'https://api.telegram.org/bot' + encodeURIComponent(token) + '/sendPhoto';

  try {
    var res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'multipart/form-data; boundary=' + boundary },
      body: body
    });
    var data = await res.json();
    if (!res.ok || !data.ok) {
      return { ok: false, error: explainTelegramError(data), status: res.status, telegram: data };
    }
    return { ok: true, data: data.result, status: res.status };
  } catch (e) {
    return { ok: false, error: e.message || 'فشل رفع الصورة' };
  }
}

module.exports = {
  sendTelegramMessage: sendTelegramMessage,
  sendTelegramPhoto: sendTelegramPhoto,
  validateTelegramBot: validateTelegramBot,
  explainTelegramError: explainTelegramError,
  resolveTelegramConfig: resolveTelegramConfig
};
