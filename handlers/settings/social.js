'use strict';

const { getSupabase } = require('../../lib/supabase');
const { validateFacebook, validateInstagram } = require('../../lib/meta');
const { prepareTokenForSave } = require('../../lib/token-refresh');
const { setCors, sendJson, readJsonBody, checkAdmin, maskToken } = require('../../lib/http');

const PLATFORMS = ['facebook', 'instagram'];

function rowToPublic(row, includeToken) {
  if (!row) {
    return {
      page_access_token: '',
      page_id: '',
      instagram_account_id: '',
      status: 'disconnected',
      token_expires_at: null,
      user_token_expires_at: null,
      metadata: {}
    };
  }

  return {
    page_access_token: includeToken ? (row.page_access_token || '') : maskToken(row.page_access_token),
    page_id: row.page_id || '',
    instagram_account_id: row.instagram_account_id || '',
    status: row.status || 'disconnected',
    token_expires_at: row.token_expires_at || null,
    user_token_expires_at: row.user_token_expires_at || null,
    metadata: row.metadata || {},
    updated_at: row.updated_at
  };
}

async function getAllSettings(includeToken) {
  const supabase = getSupabase();
  const { data, error } = await supabase.from('montana_settings').select('*').in('platform', PLATFORMS);

  if (error) throw error;

  const map = {};
  (data || []).forEach(function (row) {
    map[row.platform] = rowToPublic(row, includeToken);
  });

  return {
    facebook: map.facebook || rowToPublic(null, includeToken),
    instagram: map.instagram || rowToPublic(null, includeToken)
  };
}

async function savePlatformSettings(platform, payload) {
  const igId = String(payload.instagram_account_id || '').trim();
  const fbPageId = String(payload.page_id || '').trim();

  const tokenPrep = await prepareTokenForSave(platform, payload);
  if (!tokenPrep.ok) return { ok: false, error: tokenPrep.error };

  const pageToken = tokenPrep.page_access_token;
  const pageId = platform === 'facebook' ? fbPageId : tokenPrep.page_id;

  var validation;
  var metadata = {
    long_lived: tokenPrep.long_lived,
    token_converted_at: new Date().toISOString()
  };
  var status = 'disconnected';

  if (platform === 'facebook') {
    validation = await validateFacebook(pageId, pageToken);
    if (!validation.ok) return { ok: false, error: validation.error };
    metadata.page_name = validation.name || tokenPrep.page_name;
    status = 'connected';
  } else if (platform === 'instagram') {
    validation = await validateInstagram(igId, pageToken);
    if (!validation.ok) return { ok: false, error: validation.error };
    metadata.username = validation.username;
    metadata.account_name = validation.name;
    metadata.connected_facebook_page = pageId;
    status = 'connected';
  } else {
    return { ok: false, error: 'Invalid platform' };
  }

  const supabase = getSupabase();
  const row = {
    platform: platform,
    page_access_token: pageToken,
    page_id: pageId,
    instagram_account_id: platform === 'instagram' ? igId : null,
    user_access_token: tokenPrep.user_access_token,
    token_expires_at: tokenPrep.token_expires_at,
    user_token_expires_at: tokenPrep.user_token_expires_at,
    status: status,
    metadata: metadata,
    updated_at: new Date().toISOString()
  };

  const { error } = await supabase.from('montana_settings').upsert(row, { onConflict: 'platform' });
  if (error) throw error;

  return {
    ok: true,
    platform: platform,
    status: status,
    metadata: metadata,
    token_expires_at: row.token_expires_at,
    user_token_expires_at: row.user_token_expires_at,
    long_lived: tokenPrep.long_lived
  };
}

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

  try {
    if (req.method === 'GET') {
      const includeToken = req.headers['x-include-tokens'] === '1';
      const settings = await getAllSettings(includeToken);
      sendJson(res, 200, { ok: true, settings: settings });
      return;
    }

    if (req.method === 'POST') {
      const body = await readJsonBody(req);
      const platform = String(body.platform || '').trim().toLowerCase();

      if (!PLATFORMS.includes(platform)) {
        sendJson(res, 400, { error: 'platform must be facebook or instagram' });
        return;
      }

      const result = await savePlatformSettings(platform, body);
      if (!result.ok) {
        sendJson(res, 400, { ok: false, error: result.error });
        return;
      }

      const settings = await getAllSettings(true);
      sendJson(res, 200, {
        ok: true,
        message: platform === 'facebook' ? 'Facebook connected (long-lived token saved)' : 'Instagram connected (long-lived token saved)',
        platform: platform,
        status: result.status,
        metadata: result.metadata,
        token_expires_at: result.token_expires_at,
        user_token_expires_at: result.user_token_expires_at,
        long_lived: result.long_lived,
        settings: settings
      });
      return;
    }

    sendJson(res, 405, { error: 'Method not allowed' });
  } catch (err) {
    console.error('[api/settings/social]', err);
    sendJson(res, 500, { error: err.message || 'Internal server error' });
  }
}

module.exports = handler;
module.exports.getAllSettings = getAllSettings;
module.exports.savePlatformSettings = savePlatformSettings;
