'use strict';

const { getSupabase } = require('./supabase');
const {
  resolveLongLivedPageToken,
  fetchPageAccessToken,
  exchangeForLongLivedUserToken,
  debugToken,
  fetchInstagramConnectedPage
} = require('./meta');

const REFRESH_BEFORE_DAYS = Number(process.env.TOKEN_REFRESH_BEFORE_DAYS) || 7;

function refreshThresholdIso() {
  return new Date(Date.now() + REFRESH_BEFORE_DAYS * 24 * 60 * 60 * 1000).toISOString();
}

function needsRefresh(row) {
  if (!row || row.status !== 'connected') return false;
  const threshold = Date.now() + REFRESH_BEFORE_DAYS * 24 * 60 * 60 * 1000;

  if (row.user_token_expires_at) {
    if (new Date(row.user_token_expires_at).getTime() <= threshold) return true;
  }
  if (row.token_expires_at) {
    if (new Date(row.token_expires_at).getTime() <= threshold) return true;
  }
  return false;
}

async function refreshPlatformToken(row) {
  const pageId = row.page_id;
  if (!pageId) {
    return { ok: false, platform: row.platform, error: 'Missing page_id for refresh' };
  }

  if (!row.user_access_token) {
    return {
      ok: false,
      platform: row.platform,
      error: 'No user token stored — reconnect in admin to enable auto-refresh',
      needs_reconnect: true
    };
  }

  const exchange = await exchangeForLongLivedUserToken(row.user_access_token);
  if (!exchange.ok) {
    return {
      ok: false,
      platform: row.platform,
      error: exchange.error,
      needs_reconnect: true
    };
  }

  const pageResult = await fetchPageAccessToken(pageId, exchange.access_token);
  if (!pageResult.ok) {
    return { ok: false, platform: row.platform, error: pageResult.error };
  }

  const pageDebug = await debugToken(pageResult.access_token);
  const metadata = Object.assign({}, row.metadata || {}, {
    last_refresh_at: new Date().toISOString(),
    page_name: pageResult.name || (row.metadata && row.metadata.page_name)
  });

  const update = {
    page_access_token: pageResult.access_token,
    user_access_token: exchange.access_token,
    user_token_expires_at: exchange.expires_at_iso,
    token_expires_at: pageDebug.ok ? pageDebug.expires_at_iso : null,
    status: 'connected',
    metadata: metadata,
    updated_at: new Date().toISOString()
  };

  const supabase = getSupabase();
  const { error } = await supabase
    .from('montana_settings')
    .update(update)
    .eq('platform', row.platform);

  if (error) throw error;

  return {
    ok: true,
    platform: row.platform,
    token_expires_at: update.token_expires_at,
    user_token_expires_at: update.user_token_expires_at
  };
}

async function refreshExpiringTokens() {
  const supabase = getSupabase();
  const threshold = refreshThresholdIso();

  const { data: rows, error } = await supabase
    .from('montana_settings')
    .select('*')
    .eq('status', 'connected');

  if (error) throw error;

  const due = (rows || []).filter(needsRefresh);
  const results = [];

  for (var i = 0; i < due.length; i++) {
    try {
      const result = await refreshPlatformToken(due[i]);
      results.push(result);
    } catch (err) {
      results.push({
        ok: false,
        platform: due[i].platform,
        error: err.message || 'Refresh failed'
      });
    }
  }

  return {
    ok: true,
    checked: (rows || []).length,
    refreshed: results.filter(function (r) { return r.ok; }).length,
    failed: results.filter(function (r) { return !r.ok; }).length,
    results: results
  };
}

async function prepareTokenForSave(platform, payload) {
  const inputToken = String(payload.page_access_token || '').trim();
  let pageId = String(payload.page_id || '').trim();
  const igId = String(payload.instagram_account_id || '').trim();

  if (platform === 'instagram' && !pageId) {
    const linked = await fetchInstagramConnectedPage(igId, inputToken);
    if (!linked.ok) return { ok: false, error: linked.error };
    pageId = linked.page_id;
  }

  const resolved = await resolveLongLivedPageToken(pageId, inputToken);
  if (!resolved.ok) return { ok: false, error: resolved.error };

  return {
    ok: true,
    page_id: pageId,
    page_access_token: resolved.page_access_token,
    token_expires_at: resolved.token_expires_at,
    user_access_token: resolved.user_access_token,
    user_token_expires_at: resolved.user_token_expires_at,
    long_lived: resolved.long_lived,
    page_name: resolved.page_name
  };
}

module.exports = {
  REFRESH_BEFORE_DAYS,
  needsRefresh,
  refreshPlatformToken,
  refreshExpiringTokens,
  prepareTokenForSave
};
