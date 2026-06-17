'use strict';

const { getSupabase } = require('./supabase');

const SHIPPING_KEY = 'shipping';

var COMPANY_PRESETS = {
  bosta: {
    testPath: '/cities',
    calculatePath: '/delivery-calculator',
    createPath: '/deliveries',
    trackPath: '/deliveries/track'
  },
  aramex: {
    testPath: '/health',
    calculatePath: '/shipping/rates',
    createPath: '/shipping/shipments',
    trackPath: '/shipping/track'
  }
};

function normalizeBaseUrl(url) {
  var u = String(url || '').trim();
  if (!u) return '';
  if (!/^https?:\/\//i.test(u)) u = 'https://' + u;
  return u.replace(/\/+$/, '');
}

function buildAuthHeaders(apiKey) {
  return {
    Authorization: apiKey,
    'X-API-Key': apiKey,
    'Content-Type': 'application/json',
    Accept: 'application/json'
  };
}

function presetForCompany(companyName) {
  var key = String(companyName || '').trim().toLowerCase();
  if (key.indexOf('bosta') >= 0) return COMPANY_PRESETS.bosta;
  if (key.indexOf('aramex') >= 0) return COMPANY_PRESETS.aramex;
  return {
    testPath: '/health',
    calculatePath: '/shipping/calculate',
    createPath: '/shipments',
    trackPath: '/shipments/track'
  };
}

function rowToSettings(row, includeKey) {
  if (!row) {
    return {
      api_key: '',
      api_url: '',
      company_name: '',
      status: 'disconnected',
      metadata: {}
    };
  }
  var meta = row.metadata || {};
  var key = row.page_access_token || meta.api_key || '';
  return {
    api_key: includeKey ? key : maskApiKey(key),
    api_url: row.page_id || meta.api_url || '',
    company_name: meta.company_name || '',
    status: row.status || 'disconnected',
    metadata: meta,
    updated_at: row.updated_at
  };
}

function maskApiKey(key) {
  if (!key) return '';
  if (key.length <= 8) return '••••••••';
  return '••••' + key.slice(-4);
}

async function getShippingSettings(includeKey) {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('montana_settings')
    .select('*')
    .eq('platform', SHIPPING_KEY)
    .maybeSingle();

  if (error) throw error;
  return rowToSettings(data, includeKey);
}

async function shippingFetch(settings, method, path, body) {
  var base = normalizeBaseUrl(settings.api_url);
  var paths = (settings.metadata && settings.metadata.paths) || presetForCompany(settings.company_name);
  var endpoint = path.startsWith('http') ? path : base + (path.startsWith('/') ? path : '/' + path);

  var res = await fetch(endpoint, {
    method: method,
    headers: buildAuthHeaders(settings.api_key),
    body: body ? JSON.stringify(body) : undefined
  });

  var data = null;
  try {
    data = await res.json();
  } catch (e) {
    data = { raw: await res.text().catch(function () { return ''; }) };
  }

  return { ok: res.ok, status: res.status, data: data, paths: paths };
}

async function testShippingConnection(apiUrl, apiKey, companyName) {
  var base = normalizeBaseUrl(apiUrl);
  var api_key = String(apiKey || '').trim();

  if (!base || !api_key) {
    return { ok: false, error: 'API URL and API Key are required' };
  }

  var preset = presetForCompany(companyName);
  var testUrl = base + preset.testPath;

  try {
    var res = await fetch(testUrl, {
      method: 'GET',
      headers: buildAuthHeaders(api_key)
    });

    if (res.status === 401 || res.status === 403) {
      return { ok: false, error: 'Invalid API credentials (HTTP ' + res.status + ')' };
    }

    if (res.ok || res.status === 404) {
      return {
        ok: true,
        message: 'Connection verified with ' + (companyName || 'shipping provider'),
        tested_url: testUrl,
        http_status: res.status
      };
    }

    var fallback = await fetch(base, {
      method: 'GET',
      headers: buildAuthHeaders(api_key)
    });

    if (fallback.status === 401 || fallback.status === 403) {
      return { ok: false, error: 'Invalid API credentials (HTTP ' + fallback.status + ')' };
    }

    if (fallback.ok) {
      return {
        ok: true,
        message: 'Connection verified (base endpoint)',
        tested_url: base,
        http_status: fallback.status
      };
    }

    return {
      ok: false,
      error: 'Could not verify connection (HTTP ' + res.status + '). Check API URL and company.'
    };
  } catch (err) {
    return { ok: false, error: err.message || 'Network error — could not reach API endpoint' };
  }
}

async function saveShippingSettings(payload) {
  var api_key = String(payload.api_key || '').trim();
  var api_url = normalizeBaseUrl(payload.api_url);
  var company_name = String(payload.company_name || '').trim();

  if (!api_key || !api_url || !company_name) {
    return { ok: false, error: 'API Key, API URL, and Company name are required' };
  }

  var test = await testShippingConnection(api_url, api_key, company_name);
  if (!test.ok) return { ok: false, error: test.error };

  var preset = presetForCompany(company_name);
  var metadata = {
    company_name: company_name,
    api_url: api_url,
    paths: preset,
    last_test_at: new Date().toISOString(),
    last_test_message: test.message,
    tested_url: test.tested_url
  };

  const supabase = getSupabase();
  const row = {
    platform: SHIPPING_KEY,
    page_access_token: api_key,
    page_id: api_url,
    status: 'connected',
    metadata: metadata,
    updated_at: new Date().toISOString()
  };

  const { error } = await supabase.from('montana_settings').upsert(row, { onConflict: 'platform' });
  if (error) throw error;

  return { ok: true, status: 'connected', metadata: metadata, test: test };
}

async function requireConnectedSettings() {
  var settings = await getShippingSettings(true);
  if (!settings || settings.status !== 'connected' || !settings.api_key || !settings.api_url) {
    throw new Error('Shipping provider is not connected');
  }
  settings.company_name = settings.company_name || (settings.metadata && settings.metadata.company_name);
  return settings;
}

async function calculateShippingCost(params) {
  var settings = await requireConnectedSettings();
  var paths = settings.metadata.paths || presetForCompany(settings.company_name);
  var result = await shippingFetch(settings, 'POST', paths.calculatePath, {
    city: params.city,
    zone: params.zone,
    address: params.address,
    cod: params.cod !== false,
    weight: params.weight || 1,
    subtotal: params.subtotal || 0,
    items: params.items || []
  });

  if (!result.ok) {
    return {
      ok: false,
      error: (result.data && result.data.message) || 'Shipping rate calculation failed',
      status: result.status
    };
  }

  var cost = result.data.cost || result.data.shipping_cost || result.data.price || result.data.fee;
  return { ok: true, cost: cost, currency: result.data.currency || 'EGP', raw: result.data };
}

async function createShippingOrder(order) {
  var settings = await requireConnectedSettings();
  var paths = settings.metadata.paths || presetForCompany(settings.company_name);
  var result = await shippingFetch(settings, 'POST', paths.createPath, {
    order_id: order.order_id || order.id,
    customer: {
      name: order.name,
      phone: order.phone,
      address: order.address
    },
    items: order.items || [],
    total: order.total,
    cod: order.cod !== false
  });

  if (!result.ok) {
    return {
      ok: false,
      error: (result.data && result.data.message) || 'Failed to create shipment',
      status: result.status
    };
  }

  return {
    ok: true,
    tracking_id: result.data.tracking_id || result.data.trackingNumber || result.data.id,
    shipment_id: result.data.shipment_id || result.data._id || result.data.id,
    raw: result.data
  };
}

async function trackShipping(trackingId) {
  var settings = await requireConnectedSettings();
  var paths = settings.metadata.paths || presetForCompany(settings.company_name);
  var trackPath = paths.trackPath + (paths.trackPath.indexOf('{') >= 0
    ? ''
    : (paths.trackPath.indexOf('?') >= 0 ? '&' : '?') + 'trackingNumber=' + encodeURIComponent(trackingId));

  var result = await shippingFetch(settings, 'GET', trackPath, null);
  if (!result.ok) {
    return {
      ok: false,
      error: (result.data && result.data.message) || 'Tracking lookup failed',
      status: result.status
    };
  }

  return { ok: true, tracking: result.data };
}

module.exports = {
  SHIPPING_KEY,
  getShippingSettings,
  saveShippingSettings,
  testShippingConnection,
  calculateShippingCost,
  createShippingOrder,
  trackShipping,
  rowToSettings,
  maskApiKey
};
