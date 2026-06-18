'use strict';

const { getSupabase } = require('./supabase');
const { getDefaultHomepageContent } = require('./homepage-defaults');

const PLATFORM = 'homepage';

function deepMergeContent(base, override) {
  if (!override || typeof override !== 'object') return base;
  var out = JSON.parse(JSON.stringify(base));

  if (override.S) {
    Object.keys(override.S).forEach(function (key) {
      if (Array.isArray(override.S[key]) && override.S[key].length >= 2) {
        out.S[key] = [String(override.S[key][0] || ''), String(override.S[key][1] || '')];
      }
    });
  }

  if (override.T) {
    Object.keys(override.T).forEach(function (key) {
      if (!Array.isArray(override.T[key])) return;
      if (!out.T[key]) out.T[key] = [];
      override.T[key].forEach(function (pair, idx) {
        if (!Array.isArray(pair)) return;
        out.T[key][idx] = [String(pair[0] || ''), String(pair[1] || '')];
      });
    });
  }

  if (Array.isArray(override.ppIngr)) {
    override.ppIngr.forEach(function (item, idx) {
      if (!item || !out.ppIngr[idx]) return;
      if (Array.isArray(item.en)) out.ppIngr[idx].en = item.en.map(String);
      if (Array.isArray(item.ar)) out.ppIngr[idx].ar = item.ar.map(String);
    });
  }

  return out;
}

async function getHomepageContent() {
  var defaults = getDefaultHomepageContent();
  try {
    var supabase = getSupabase();
    var result = await supabase
      .from('montana_settings')
      .select('metadata, updated_at')
      .eq('platform', PLATFORM)
      .maybeSingle();

    if (result.error) {
      return { ok: true, content: defaults, source: 'default', dbError: result.error.message };
    }

    var row = result.data;
    if (!row || !row.metadata || !row.metadata.content) {
      return { ok: true, content: defaults, source: 'default' };
    }

    return {
      ok: true,
      content: deepMergeContent(defaults, row.metadata.content),
      source: 'supabase',
      updated_at: row.updated_at || row.metadata.updated_at || null
    };
  } catch (err) {
    return { ok: true, content: defaults, source: 'default', error: err.message || String(err) };
  }
}

async function saveHomepageContent(content) {
  if (!content || typeof content !== 'object') {
    return { ok: false, error: 'content مطلوب' };
  }

  var supabase = getSupabase();
  var merged = deepMergeContent(getDefaultHomepageContent(), content);
  var now = new Date().toISOString();

  var row = {
    platform: PLATFORM,
    status: 'connected',
    metadata: {
      content: merged,
      updated_at: now
    },
    updated_at: now
  };

  var result = await supabase.from('montana_settings').upsert(row, { onConflict: 'platform' });
  if (result.error) {
    return { ok: false, error: result.error.message || 'فشل الحفظ في Supabase' };
  }

  return { ok: true, content: merged, updated_at: now };
}

module.exports = {
  getDefaultHomepageContent,
  deepMergeContent,
  getHomepageContent,
  saveHomepageContent
};
