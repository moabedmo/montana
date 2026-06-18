'use strict';

const { getSupabase } = require('./supabase');

var DEPOSITS_PLATFORM = 'deposits';
var MAX_PROOFS = 200;
var MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

function defaultApprovalWords() {
  return ['تم', 'تمام', 'ok', 'yes', 'approve', 'approved', 'موافق', 'تأكيد', 'ta2kid'];
}

function approvalWords() {
  var raw = String(process.env.DEPOSIT_APPROVAL_WORDS || '').trim();
  if (!raw) return defaultApprovalWords();
  return raw.split(/[,،|]+/).map(function (w) { return w.trim(); }).filter(Boolean);
}

function isApprovalText(text) {
  var t = String(text || '').trim().toLowerCase();
  if (!t) return false;
  var words = approvalWords();
  for (var i = 0; i < words.length; i++) {
    var w = words[i].toLowerCase();
    if (t === w || t.indexOf(w + ' dp_') === 0 || t.indexOf(w + ' ') === 0) return true;
  }
  return false;
}

function extractProofId(text) {
  var m = String(text || '').match(/dp_\d+/i);
  return m ? m[0] : '';
}

function pruneProofs(proofs) {
  var now = Date.now();
  var keys = Object.keys(proofs || {});
  keys.forEach(function (id) {
    var p = proofs[id];
    var created = p && p.createdAt ? Date.parse(p.createdAt) : 0;
    if (!created || now - created > MAX_AGE_MS) delete proofs[id];
  });
  keys = Object.keys(proofs);
  if (keys.length > MAX_PROOFS) {
    keys.sort(function (a, b) {
      return Date.parse(proofs[a].createdAt || 0) - Date.parse(proofs[b].createdAt || 0);
    });
    keys.slice(0, keys.length - MAX_PROOFS).forEach(function (id) { delete proofs[id]; });
  }
  return proofs;
}

async function loadStore() {
  var supabase = getSupabase();
  var res = await supabase
    .from('montana_settings')
    .select('metadata')
    .eq('platform', DEPOSITS_PLATFORM)
    .maybeSingle();

  if (res.error) throw res.error;
  var meta = (res.data && res.data.metadata) || {};
  if (!meta.proofs || typeof meta.proofs !== 'object') meta.proofs = {};
  meta.proofs = pruneProofs(meta.proofs);
  return meta;
}

async function saveStore(meta) {
  var supabase = getSupabase();
  var row = {
    platform: DEPOSITS_PLATFORM,
    status: 'connected',
    metadata: meta,
    updated_at: new Date().toISOString()
  };
  var res = await supabase.from('montana_settings').upsert(row, { onConflict: 'platform' });
  if (res.error) throw res.error;
}

async function createProof(data) {
  var meta = await loadStore();
  var proof = {
    id: data.id,
    status: 'pending',
    source: data.source || '',
    name: data.name || '',
    phone: data.phone || '',
    address: data.address || '',
    itemsSummary: data.itemsSummary || '',
    total: data.total != null ? data.total : null,
    telegramMessageId: data.telegramMessageId || null,
    telegramChatId: data.telegramChatId != null ? String(data.telegramChatId) : '',
    createdAt: new Date().toISOString(),
    approvedAt: null
  };
  meta.proofs[proof.id] = proof;
  await saveStore(meta);
  return proof;
}

async function getProof(proofId) {
  var meta = await loadStore();
  return meta.proofs[proofId] || null;
}

async function setProofStatus(proofId, status) {
  var meta = await loadStore();
  var proof = meta.proofs[proofId];
  if (!proof) return null;
  proof.status = status;
  if (status === 'approved') proof.approvedAt = new Date().toISOString();
  meta.proofs[proofId] = proof;
  await saveStore(meta);
  return proof;
}

async function approveByProofId(proofId) {
  var proof = await getProof(proofId);
  if (!proof) return null;
  if (proof.status === 'approved') return proof;
  return setProofStatus(proofId, 'approved');
}

async function approveByTelegramMessageId(messageId) {
  var meta = await loadStore();
  var id = null;
  Object.keys(meta.proofs).forEach(function (key) {
    var p = meta.proofs[key];
    if (p && String(p.telegramMessageId) === String(messageId)) id = key;
  });
  if (!id) return null;
  return approveByProofId(id);
}

module.exports = {
  createProof: createProof,
  getProof: getProof,
  approveByProofId: approveByProofId,
  approveByTelegramMessageId: approveByTelegramMessageId,
  isApprovalText: isApprovalText,
  extractProofId: extractProofId
};
