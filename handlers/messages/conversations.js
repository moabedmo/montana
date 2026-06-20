'use strict';

const { getSupabase } = require('../../lib/supabase');
const { setCors, sendJson, checkAdmin } = require('../../lib/http');

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

  if (req.method !== 'GET') {
    sendJson(res, 405, { error: 'Method not allowed' });
    return;
  }

  try {
    var supabase = getSupabase();
    var platform = (req.query && req.query.platform) || null;
    var senderId = (req.query && req.query.sender_id) || null;
    var limit = Math.min(parseInt(req.query && req.query.limit) || 50, 200);

    if (senderId) {
      var query = supabase
        .from('social_messages')
        .select('*')
        .or('sender_id.eq.' + senderId + ',recipient_id.eq.' + senderId)
        .order('created_at', { ascending: true })
        .limit(limit);
      if (platform) query = query.eq('platform', platform);
      var { data, error } = await query;
      if (error) throw error;
      sendJson(res, 200, { ok: true, messages: data || [] });
      return;
    }

    var { data, error } = await supabase.rpc('get_social_conversations', {
      p_platform: platform,
      p_limit: limit
    }).catch(function () { return { data: null, error: { message: 'rpc not available' } }; });

    if (error || !data) {
      var query = supabase
        .from('social_messages')
        .select('*')
        .eq('direction', 'inbound')
        .order('created_at', { ascending: false })
        .limit(limit);
      if (platform) query = query.eq('platform', platform);
      var result = await query;
      if (result.error) throw result.error;

      var convMap = {};
      (result.data || []).forEach(function (m) {
        if (!convMap[m.sender_id]) {
          convMap[m.sender_id] = {
            sender_id: m.sender_id,
            platform: m.platform,
            last_message: m.message_text,
            last_time: m.created_at,
            message_count: 0
          };
        }
        convMap[m.sender_id].message_count++;
      });

      sendJson(res, 200, { ok: true, conversations: Object.values(convMap) });
      return;
    }

    sendJson(res, 200, { ok: true, conversations: data });
  } catch (err) {
    console.error('[api/messages/conversations]', err);
    sendJson(res, 500, { error: err.message || 'Internal server error' });
  }
}

module.exports = handler;
