'use strict';

const { getSupabase } = require('../../lib/supabase');
const { extractInboundMessages, sendFacebookMessage, sendInstagramMessage, replyToComment } = require('../../lib/meta');
const { generateReply, saveOrder } = require('../../lib/social-bot');
const { sendTelegramPhotoUrl, resolveTelegramConfig } = require('../../lib/telegram');
const { createProof } = require('../../lib/deposit-proofs');
const { setCors, sendJson, readJsonBody } = require('../../lib/http');

async function getPlatformSettings(platform) {
  var supabase = getSupabase();
  var { data, error } = await supabase
    .from('montana_settings')
    .select('*')
    .eq('platform', platform)
    .eq('status', 'connected')
    .maybeSingle();

  if (error) throw error;
  return data;
}

async function storeMessage(msg) {
  var supabase = getSupabase();
  await supabase.from('social_messages').insert({
    platform: msg.platform,
    direction: msg.direction,
    sender_id: msg.sender_id,
    recipient_id: msg.recipient_id,
    message_text: msg.message_text,
    message_type: msg.message_type || 'message',
    comment_id: msg.comment_id || null,
    post_id: msg.post_id || null,
    raw_payload: msg.raw || {}
  });
}

async function handleDepositImage(inbound, settings) {
  var cfg = resolveTelegramConfig();
  if (!cfg.token || !cfg.chatId) return false;

  var supabase = getSupabase();
  var { data: lastOrder } = await supabase
    .from('social_orders')
    .select('*')
    .eq('social_sender_id', inbound.sender_id)
    .eq('status', 'pending')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  var proofId = 'dp_' + Date.now();
  var caption = '💰 تأكيد حجز — Montana\n' +
    'المصدر: ' + inbound.platform + '\n' +
    (lastOrder ? 'الاسم: ' + (lastOrder.name || '—') + '\nالموبايل: ' + (lastOrder.phone || '—') + '\nالعنوان: ' + (lastOrder.address || '—') + '\n' : '') +
    (lastOrder && lastOrder.total ? 'الإجمالي: ' + lastOrder.total + ' جنيه\n' : '') +
    '👇 اضغطي «✅ موافقة» أو ردّي «تم»';

  var keyboard = { inline_keyboard: [[ { text: '✅ موافقة', callback_data: 'approve:' + proofId } ]] };

  var photo = await sendTelegramPhotoUrl(cfg.token, cfg.chatId, inbound.image_url, caption, keyboard);
  if (!photo.ok) return false;

  await createProof({
    id: proofId,
    source: inbound.platform,
    name: lastOrder ? lastOrder.name : '',
    phone: lastOrder ? lastOrder.phone : '',
    address: lastOrder ? lastOrder.address : '',
    itemsSummary: lastOrder && lastOrder.items ? lastOrder.items.map(function (i) { return i.name + ' x' + i.qty; }).join(', ') : '',
    total: lastOrder ? lastOrder.total : null,
    telegramMessageId: photo.data && photo.data.message_id,
    telegramChatId: cfg.chatId
  });

  var replyText = 'تم استلام صورة التحويل 💜 جاري المراجعة — هنأكدلك في أقرب وقت!';
  if (inbound.platform === 'facebook' && settings.page_id) {
    await sendFacebookMessage(settings.page_id, settings.page_access_token, inbound.sender_id, replyText);
  } else if (inbound.platform === 'instagram' && settings.instagram_account_id) {
    await sendInstagramMessage(settings.instagram_account_id, settings.page_access_token, inbound.sender_id, replyText);
  }

  await storeMessage({
    platform: inbound.platform,
    direction: 'outbound',
    sender_id: inbound.page_id,
    recipient_id: inbound.sender_id,
    message_text: replyText,
    raw: {}
  });

  return true;
}

async function handleInbound(inbound) {
  var settings = await getPlatformSettings(inbound.platform);
  if (!settings || !settings.page_access_token) return;

  if (inbound.image_url) {
    var textHint = (inbound.message_text || '').toLowerCase();
    var isDeposit = !textHint || /تحويل|إيصال|ايصال|صورة|proof|transfer|deposit|payment|فودافون|instapay|كاش|حجز/.test(textHint);
    if (isDeposit) {
      await handleDepositImage(inbound, settings);
      return;
    }
  }

  var isComment = inbound.type === 'comment';
  var reply = await generateReply(inbound.sender_id, inbound.platform, inbound.message_text, isComment);

  if (reply.order) {
    await saveOrder(reply.order, inbound.platform, inbound.sender_id);
  }

  var result;
  if (isComment && inbound.comment_id) {
    result = await replyToComment(inbound.comment_id, settings.page_access_token, reply.text);
  } else if (inbound.platform === 'facebook' && settings.page_id) {
    result = await sendFacebookMessage(
      settings.page_id,
      settings.page_access_token,
      inbound.sender_id,
      reply.text
    );
  } else if (inbound.platform === 'instagram' && settings.instagram_account_id) {
    result = await sendInstagramMessage(
      settings.instagram_account_id,
      settings.page_access_token,
      inbound.sender_id,
      reply.text
    );
  }

  if (result && result.ok) {
    await storeMessage({
      platform: inbound.platform,
      direction: 'outbound',
      sender_id: inbound.recipient_id || inbound.page_id,
      recipient_id: inbound.sender_id,
      message_text: reply.text,
      message_type: isComment ? 'comment_reply' : 'message',
      comment_id: isComment ? inbound.comment_id : null,
      post_id: isComment ? inbound.post_id : null,
      raw: result.data
    });
  }
}

async function handler(req, res) {
  setCors(res);

  if (req.method === 'GET') {
    var mode = req.query && req.query['hub.mode'];
    var token = req.query && req.query['hub.verify_token'];
    var challenge = req.query && req.query['hub.challenge'];
    var verifyToken = process.env.META_WEBHOOK_VERIFY_TOKEN || 'montana_meta_verify';

    if (mode === 'subscribe' && token === verifyToken && challenge) {
      res.statusCode = 200;
      res.setHeader('Content-Type', 'text/plain');
      res.end(String(challenge));
      return;
    }

    sendJson(res, 403, { error: 'Verification failed' });
    return;
  }

  if (req.method === 'POST') {
    try {
      var body = await readJsonBody(req);
      var inboundList = extractInboundMessages(body);

      for (var i = 0; i < inboundList.length; i++) {
        var msg = inboundList[i];
        await storeMessage({
          platform: msg.platform,
          direction: 'inbound',
          sender_id: msg.sender_id,
          recipient_id: msg.recipient_id || msg.page_id,
          message_text: msg.message_text,
          message_type: msg.type || 'message',
          comment_id: msg.comment_id || null,
          post_id: msg.post_id || null,
          raw: msg.raw
        });

        handleInbound(msg).catch(function (err) {
          console.error('[webhook/meta] reply error:', err.message);
        });
      }

      sendJson(res, 200, { ok: true, received: inboundList.length });
    } catch (err) {
      console.error('[api/webhooks/meta]', err);
      sendJson(res, 500, { error: err.message || 'Webhook error' });
    }
    return;
  }

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }

  sendJson(res, 405, { error: 'Method not allowed' });
}

module.exports = handler;
