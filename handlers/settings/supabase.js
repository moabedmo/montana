'use strict';

const { testConnection } = require('../../lib/deposit-store');
const { getSupabase } = require('../../lib/supabase');
const { setCors, sendJson } = require('../../lib/http');

async function handler(req, res) {
  setCors(res);

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }

  if (req.method !== 'GET') {
    sendJson(res, 405, { ok: false, error: 'Method not allowed' });
    return;
  }

  try {
    var deposit = await testConnection();

    var socialOk = false;
    var socialError = '';
    try {
      var supabase = getSupabase();
      var social = await supabase.from('montana_settings').select('platform').limit(1);
      if (social.error) socialError = social.error.message;
      else socialOk = true;
    } catch (e) {
      socialError = e.message;
    }

    sendJson(res, deposit.connected ? 200 : 503, {
      ok: deposit.connected,
      supabase: {
        configured: !!(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY),
        depositProofs: deposit,
        montanaSettings: socialOk
          ? { ok: true }
          : { ok: false, error: socialError || 'montana_settings table missing — run migration 001' }
      }
    });
  } catch (err) {
    console.error('[api/settings/supabase]', err);
    sendJson(res, 500, { ok: false, error: err.message || 'Internal server error' });
  }
}

module.exports = handler;
