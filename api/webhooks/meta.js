'use strict';

const { getSupabase } = require('../lib/supabase');
const { extractInboundMessages, sendFacebookMessage, sendInstagramMessage } = require('../lib/meta');
const { setCors, sendJson, readJsonBody } = require('../lib/http');

async function getPlatformSettings(platform) {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('montana_settings')
    .select('*')
    .eq('platform', platform)
    .eq('status', 'connected')
    .maybeSingle();

  if (error) throw error;
  return data;
}

async function storeMessage(msg) {
  const supabase = getSupabase();
  await supabase.from('social_messages').insert({
    platform: msg.platform,
    direction: msg.direction,
    sender_id: msg.sender_id,
    recipient_id: msg.recipient_id,
    message_text: msg.message_text,
    raw_payload: msg.raw || {}
  });
}

async function autoReply(inbound) {
  const settings = await getPlatformSettings(inbound.platform);
  if (!settings || !settings.page_access_token) return;

  const replyText = 'أهلاً! شكراً لتواصلك مع Montana 💜 فريقنا هيرد عليك قريباً.';
  var result;

  if (inbound.platform === 'facebook' && settings.page_id) {
    result = await sendFacebookMessage(
      settings.page_id,
      settings.page_access_token,
      inbound.sender_id,
      replyText
    );
  } else if (inbound.platform === 'instagram' && settings.instagram_account_id) {
    result = await sendInstagramMessage(
      settings.instagram_account_id,
      settings.page_access_token,
      inbound.sender_id,
      replyText
    );
  }

  if (result && result.ok) {
    await storeMessage({
      platform: inbound.platform,
      direction: 'outbound',
      sender_id: inbound.recipient_id,
      recipient_id: inbound.sender_id,
      message_text: replyText,
      raw: result.data
    });
  }
}

async function handler(req, res) {
  setCors(res);

  if (req.method === 'GET') {
    const mode = req.query && req.query['hub.mode'];
    const token = req.query && req.query['hub.verify_token'];
    const challenge = req.query && req.query['hub.challenge'];
    const verifyToken = process.env.META_WEBHOOK_VERIFY_TOKEN || 'montana_meta_verify';

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
      const body = await readJsonBody(req);
      const inboundList = extractInboundMessages(body);

      for (var i = 0; i < inboundList.length; i++) {
        var msg = inboundList[i];
        await storeMessage({
          platform: msg.platform,
          direction: 'inbound',
          sender_id: msg.sender_id,
          recipient_id: msg.recipient_id,
          message_text: msg.message_text,
          raw: msg.raw
        });
        await autoReply(msg);
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
