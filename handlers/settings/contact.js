'use strict';

const { getSupabase } = require('../../lib/supabase');
const { setCors, sendJson, readJsonBody, checkAdmin } = require('../../lib/http');

var DEFAULTS = {
  phone: '01094456787',
  email: 'info@montana-naturals.com',
  whatsapp: '01094456787',
  address: 'Cairo, Egypt',
  facebook: 'Montana Naturals',
  instagram: '@montana_naturals',
  hours: 'Saturday – Thursday: 10 AM – 8 PM\nFriday: Closed'
};

async function handler(req, res) {
  setCors(res);

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }

  if (req.method === 'GET') {
    try {
      var supabase = getSupabase();
      var { data } = await supabase
        .from('montana_settings')
        .select('metadata')
        .eq('platform', 'contact')
        .maybeSingle();

      var contact = (data && data.metadata) || DEFAULTS;
      sendJson(res, 200, { ok: true, contact: contact });
    } catch (e) {
      sendJson(res, 200, { ok: true, contact: DEFAULTS });
    }
    return;
  }

  if (req.method === 'POST') {
    if (!checkAdmin(req)) {
      sendJson(res, 401, { error: 'Unauthorized' });
      return;
    }

    try {
      var body = await readJsonBody(req);
      var contact = {
        phone: String(body.phone || '').trim() || DEFAULTS.phone,
        email: String(body.email || '').trim() || DEFAULTS.email,
        whatsapp: String(body.whatsapp || '').trim() || DEFAULTS.whatsapp,
        address: String(body.address || '').trim() || DEFAULTS.address,
        facebook: String(body.facebook || '').trim() || DEFAULTS.facebook,
        instagram: String(body.instagram || '').trim() || DEFAULTS.instagram,
        hours: String(body.hours || '').trim() || DEFAULTS.hours
      };

      var supabase = getSupabase();
      await supabase.from('montana_settings').upsert({
        platform: 'contact',
        status: 'connected',
        metadata: contact,
        updated_at: new Date().toISOString()
      }, { onConflict: 'platform' });

      sendJson(res, 200, { ok: true, contact: contact });
    } catch (e) {
      console.error('[settings/contact]', e);
      sendJson(res, 500, { error: e.message });
    }
    return;
  }

  sendJson(res, 405, { error: 'Method not allowed' });
}

module.exports = handler;
