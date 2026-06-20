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
    var status = (req.query && req.query.status) || null;
    var limit = Math.min(parseInt(req.query && req.query.limit) || 50, 200);

    var query = supabase
      .from('social_orders')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (status) query = query.eq('status', status);

    var { data, error } = await query;
    if (error) throw error;

    sendJson(res, 200, { ok: true, orders: data || [] });
  } catch (err) {
    console.error('[api/orders/social]', err);
    sendJson(res, 500, { error: err.message || 'Internal server error' });
  }
}

module.exports = handler;
