'use strict';

const { getSupabase } = require('../../lib/supabase');
const { extractInboundMessages, sendFacebookMessage, sendInstagramMessage, replyToComment } = require('../../lib/meta');
const { generateReply, saveOrder } = require('../../lib/social-bot');
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

async function handleInbound(inbound) {
  var settings = await getPlatformSettings(inbound.platform);
  if (!settings || !settings.page_access_token) return;

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
