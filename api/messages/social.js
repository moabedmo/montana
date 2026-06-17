'use strict';

const { getSupabase } = require('../lib/supabase');
const { sendFacebookMessage, sendInstagramMessage } = require('../lib/meta');
const { setCors, sendJson, readJsonBody, checkAdmin } = require('../lib/http');

async function handler(req, res) {
  setCors(res);

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }

  if (!checkAdmin(req)) {
    sendJson(res, 401, { error: 'Unauthorized' });
    return;
  }

  if (req.method !== 'POST') {
    sendJson(res, 405, { error: 'Method not allowed' });
    return;
  }

  try {
    const body = await readJsonBody(req);
    const platform = String(body.platform || '').trim().toLowerCase();
    const recipientId = String(body.recipient_id || '').trim();
    const text = String(body.message || body.text || '').trim();

    if (!recipientId || !text) {
      sendJson(res, 400, { error: 'recipient_id and message are required' });
      return;
    }

    const supabase = getSupabase();
    const { data: settings, error } = await supabase
      .from('montana_settings')
      .select('*')
      .eq('platform', platform)
      .eq('status', 'connected')
      .maybeSingle();

    if (error) throw error;
    if (!settings || !settings.page_access_token) {
      sendJson(res, 400, { error: platform + ' is not connected' });
      return;
    }

    var result;
    if (platform === 'facebook') {
      result = await sendFacebookMessage(
        settings.page_id,
        settings.page_access_token,
        recipientId,
        text
      );
    } else if (platform === 'instagram') {
      result = await sendInstagramMessage(
        settings.instagram_account_id,
        settings.page_access_token,
        recipientId,
        text
      );
    } else {
      sendJson(res, 400, { error: 'platform must be facebook or instagram' });
      return;
    }

    if (!result.ok) {
      sendJson(res, 400, {
        ok: false,
        error: (result.data && result.data.error && result.data.error.message) || 'Send failed'
      });
      return;
    }

    await supabase.from('social_messages').insert({
      platform: platform,
      direction: 'outbound',
      sender_id: platform === 'facebook' ? settings.page_id : settings.instagram_account_id,
      recipient_id: recipientId,
      message_text: text,
      raw_payload: result.data || {}
    });

    sendJson(res, 200, { ok: true, message_id: result.data && result.data.message_id });
  } catch (err) {
    console.error('[api/messages/social]', err);
    sendJson(res, 500, { error: err.message || 'Internal server error' });
  }
}

module.exports = handler;
