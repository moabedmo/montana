'use strict';

const GRAPH_VERSION = process.env.META_GRAPH_VERSION || 'v21.0';
const GRAPH_BASE = 'https://graph.facebook.com/' + GRAPH_VERSION;

function requireAppCredentials() {
  const appId = process.env.META_APP_ID;
  const appSecret = process.env.META_APP_SECRET;
  if (!appId || !appSecret) {
    throw new Error('META_APP_ID and META_APP_SECRET must be set for token exchange');
  }
  return { appId: appId, appSecret: appSecret, appToken: appId + '|' + appSecret };
}

async function graphFetch(path, options) {
  options = options || {};
  const url = GRAPH_BASE + path;
  const res = await fetch(url, {
    method: options.method || 'GET',
    headers: options.headers || {},
    body: options.body
  });
  const data = await res.json().catch(function () { return {}; });
  return { ok: res.ok, status: res.status, data: data };
}

async function graphGet(path, token) {
  const sep = path.indexOf('?') >= 0 ? '&' : '?';
  return graphFetch(path + sep + 'access_token=' + encodeURIComponent(token));
}

async function graphPost(path, token, body) {
  return graphFetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(Object.assign({}, body, { access_token: token }))
  });
}

function expiresAtFromUnix(unix) {
  if (!unix || unix === 0) return null;
  return new Date(unix * 1000).toISOString();
}

function expiresAtFromSeconds(seconds) {
  if (!seconds || seconds <= 0) return null;
  return new Date(Date.now() + seconds * 1000).toISOString();
}

async function debugToken(inputToken) {
  const creds = requireAppCredentials();
  const path = '/debug_token?input_token=' + encodeURIComponent(inputToken);
  const result = await graphGet(path, creds.appToken);
  if (!result.ok || !result.data || !result.data.data) {
    return {
      ok: false,
      error: (result.data && result.data.error && result.data.error.message) || 'Token debug failed'
    };
  }
  const d = result.data.data;
  return {
    ok: true,
    type: d.type,
    app_id: d.app_id,
    expires_at: d.expires_at,
    is_valid: d.is_valid,
    expires_at_iso: expiresAtFromUnix(d.expires_at)
  };
}

async function exchangeForLongLivedUserToken(shortLivedToken) {
  const creds = requireAppCredentials();
  const path = '/oauth/access_token?grant_type=fb_exchange_token&client_id=' +
    encodeURIComponent(creds.appId) +
    '&client_secret=' + encodeURIComponent(creds.appSecret) +
    '&fb_exchange_token=' + encodeURIComponent(shortLivedToken);

  const result = await graphFetch(path);
  if (!result.ok || !result.data || !result.data.access_token) {
    return {
      ok: false,
      error: (result.data && result.data.error && result.data.error.message) || 'Token exchange failed'
    };
  }
  return {
    ok: true,
    access_token: result.data.access_token,
    expires_in: result.data.expires_in,
    expires_at_iso: expiresAtFromSeconds(result.data.expires_in)
  };
}

async function fetchPageAccessToken(pageId, userToken) {
  const result = await graphGet('/' + encodeURIComponent(pageId) + '?fields=access_token,name', userToken);
  if (!result.ok || !result.data || !result.data.access_token) {
    return {
      ok: false,
      error: (result.data && result.data.error && result.data.error.message) || 'Failed to fetch page access token'
    };
  }
  return {
    ok: true,
    access_token: result.data.access_token,
    name: result.data.name
  };
}

async function fetchInstagramConnectedPage(igAccountId, token) {
  const result = await graphGet(
    '/' + encodeURIComponent(igAccountId) + '?fields=connected_facebook_page',
    token
  );
  if (!result.ok || !result.data || !result.data.connected_facebook_page) {
    return {
      ok: false,
      error: (result.data && result.data.error && result.data.error.message) || 'Could not find connected Facebook page'
    };
  }
  return { ok: true, page_id: String(result.data.connected_facebook_page) };
}

/**
 * Convert input token to a long-lived page access token.
 * Flow: short-lived token → long-lived user token → long-lived page token
 */
async function resolveLongLivedPageToken(pageId, inputToken) {
  if (!pageId || !inputToken) {
    return { ok: false, error: 'Page ID and access token are required' };
  }

  var userToken = null;
  var userTokenExpiresAt = null;
  var exchange = await exchangeForLongLivedUserToken(inputToken);

  if (exchange.ok) {
    userToken = exchange.access_token;
    userTokenExpiresAt = exchange.expires_at_iso;
  } else {
    var debug = await debugToken(inputToken);
    if (!debug.ok) return { ok: false, error: debug.error };

    if (debug.type === 'USER' && debug.is_valid) {
      userToken = inputToken;
      userTokenExpiresAt = debug.expires_at_iso;
    } else if (debug.type === 'PAGE' && debug.is_valid) {
      return {
        ok: true,
        page_access_token: inputToken,
        token_expires_at: debug.expires_at_iso,
        user_access_token: null,
        user_token_expires_at: null,
        token_type: 'page',
        long_lived: !debug.expires_at || debug.expires_at === 0
      };
    } else {
      return { ok: false, error: exchange.error || 'Could not exchange token — use a valid user or page token' };
    }
  }

  var pageResult = await fetchPageAccessToken(pageId, userToken);
  if (!pageResult.ok) return { ok: false, error: pageResult.error };

  var pageDebug = await debugToken(pageResult.access_token);
  return {
    ok: true,
    page_access_token: pageResult.access_token,
    token_expires_at: pageDebug.ok ? pageDebug.expires_at_iso : null,
    user_access_token: userToken,
    user_token_expires_at: userTokenExpiresAt,
    token_type: 'page',
    long_lived: pageDebug.ok && (!pageDebug.expires_at || pageDebug.expires_at === 0),
    page_name: pageResult.name
  };
}

async function validateFacebook(pageId, token) {
  if (!pageId || !token) {
    return { ok: false, error: 'Page ID and Page Access Token are required' };
  }
  const result = await graphGet('/' + encodeURIComponent(pageId) + '?fields=id,name', token);
  if (!result.ok) {
    return {
      ok: false,
      error: (result.data && result.data.error && result.data.error.message) || 'Facebook connection failed'
    };
  }
  return { ok: true, name: result.data.name, id: result.data.id };
}

async function validateInstagram(igAccountId, token) {
  if (!igAccountId || !token) {
    return { ok: false, error: 'Instagram Account ID and Page Access Token are required' };
  }
  const result = await graphGet('/' + encodeURIComponent(igAccountId) + '?fields=id,username,name', token);
  if (!result.ok) {
    return {
      ok: false,
      error: (result.data && result.data.error && result.data.error.message) || 'Instagram connection failed'
    };
  }
  return { ok: true, username: result.data.username, name: result.data.name, id: result.data.id };
}

async function sendFacebookMessage(pageId, token, recipientId, text) {
  return graphPost('/' + encodeURIComponent(pageId) + '/messages', token, {
    recipient: { id: recipientId },
    messaging_type: 'RESPONSE',
    message: { text: text }
  });
}

async function sendInstagramMessage(igAccountId, token, recipientId, text) {
  return graphPost('/' + encodeURIComponent(igAccountId) + '/messages', token, {
    recipient: { id: recipientId },
    message: { text: text }
  });
}

function extractInboundMessages(body) {
  var messages = [];
  if (!body || !body.entry) return messages;

  body.entry.forEach(function (entry) {
    (entry.messaging || []).forEach(function (event) {
      if (!event.message || !event.message.text) return;
      var platform = event.message.is_echo ? null : (body.object === 'instagram' ? 'instagram' : 'facebook');
      if (!platform) return;
      messages.push({
        platform: platform,
        sender_id: event.sender && event.sender.id,
        recipient_id: event.recipient && event.recipient.id,
        message_text: event.message.text,
        page_id: entry.id,
        raw: event
      });
    });
  });

  return messages;
}

module.exports = {
  debugToken,
  exchangeForLongLivedUserToken,
  fetchPageAccessToken,
  fetchInstagramConnectedPage,
  resolveLongLivedPageToken,
  validateFacebook,
  validateInstagram,
  sendFacebookMessage,
  sendInstagramMessage,
  extractInboundMessages
};
