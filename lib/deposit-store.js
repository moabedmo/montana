'use strict';

const { getSupabase } = require('./supabase');

var memory = globalThis.__montanaDepositStore || (globalThis.__montanaDepositStore = { proofs: {}, byMsg: {} });

function hasSupabase() {
  return !!(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

function trySupabase() {
  if (!hasSupabase()) return null;
  try {
    return getSupabase();
  } catch (e) {
    return null;
  }
}

function rowToProof(row) {
  if (!row) return null;
  return {
    id: row.id,
    status: row.status,
    source: row.source || '',
    name: row.name || '',
    phone: row.phone || '',
    address: row.address || '',
    itemsSummary: row.items_summary || '',
    total: row.total != null ? Number(row.total) : null,
    telegramMessageId: row.telegram_message_id,
    telegramChatId: row.telegram_chat_id || '',
    createdAt: row.created_at,
    approvedAt: row.approved_at
  };
}

function proofToRow(proof) {
  return {
    id: proof.id,
    status: proof.status || 'pending',
    source: proof.source || null,
    name: proof.name || null,
    phone: proof.phone || null,
    address: proof.address || null,
    items_summary: proof.itemsSummary || null,
    total: proof.total != null ? proof.total : null,
    telegram_message_id: proof.telegramMessageId || null,
    telegram_chat_id: proof.telegramChatId || null,
    created_at: proof.createdAt || new Date().toISOString(),
    approved_at: proof.approvedAt || null
  };
}

async function saveProof(proof) {
  var supabase = trySupabase();
  if (supabase) {
    var res = await supabase.from('deposit_proofs').upsert(proofToRow(proof), { onConflict: 'id' });
    if (res.error) throw res.error;
    return;
  }
  memory.proofs[proof.id] = proof;
  if (proof.telegramMessageId) {
    memory.byMsg[String(proof.telegramMessageId)] = proof.id;
  }
}

async function loadProof(proofId) {
  var supabase = trySupabase();
  if (supabase) {
    var res = await supabase.from('deposit_proofs').select('*').eq('id', proofId).maybeSingle();
    if (res.error) throw res.error;
    return rowToProof(res.data);
  }
  return memory.proofs[proofId] || null;
}

async function findProofIdByMessageId(messageId) {
  var supabase = trySupabase();
  if (supabase) {
    var res = await supabase
      .from('deposit_proofs')
      .select('id')
      .eq('telegram_message_id', messageId)
      .maybeSingle();
    if (res.error) throw res.error;
    return res.data ? res.data.id : null;
  }
  return memory.byMsg[String(messageId)] || null;
}

function storageMode() {
  return trySupabase() ? 'supabase' : 'memory';
}

async function testConnection() {
  var supabase = trySupabase();
  if (!supabase) {
    return { ok: false, connected: false, error: 'SUPABASE_URL و SUPABASE_SERVICE_ROLE_KEY مطلوبين في Vercel' };
  }
  var res = await supabase.from('deposit_proofs').select('id').limit(1);
  if (res.error) {
    if (/relation.*does not exist/i.test(res.error.message || '')) {
      return {
        ok: false,
        connected: false,
        error: 'جدول deposit_proofs مش موجود — شغّلي supabase/migrations/003_deposit_proofs.sql'
      };
    }
    return { ok: false, connected: false, error: res.error.message };
  }
  return { ok: true, connected: true, mode: 'supabase' };
}

module.exports = {
  hasSupabase: hasSupabase,
  storageMode: storageMode,
  saveProof: saveProof,
  loadProof: loadProof,
  findProofIdByMessageId: findProofIdByMessageId,
  testConnection: testConnection
};
