'use strict';

const {
  saveProof,
  loadProof,
  findProofIdByMessageId,
  storageMode
} = require('./deposit-store');

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

function buildApproveUrl(proofId) {
  var secret = String(process.env.MONTANA_ADMIN_API_KEY || process.env.DEPOSIT_APPROVE_SECRET || '').trim();
  var base = String(process.env.SITE_URL || process.env.VERCEL_URL || '').trim();
  if (!secret || !base || !proofId) return '';
  if (base.indexOf('http') !== 0) base = 'https://' + base;
  return base.replace(/\/$/, '') + '/api/orders/deposit-approve?proofId=' + encodeURIComponent(proofId) + '&key=' + encodeURIComponent(secret);
}

async function createProof(data) {
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
  await saveProof(proof);
  return proof;
}

async function getProof(proofId) {
  return loadProof(proofId);
}

async function setProofStatus(proofId, status) {
  var proof = await loadProof(proofId);
  if (!proof) return null;
  proof.status = status;
  if (status === 'approved') proof.approvedAt = new Date().toISOString();
  await saveProof(proof);
  return proof;
}

async function approveByProofId(proofId) {
  var proof = await getProof(proofId);
  if (!proof) return null;
  if (proof.status === 'approved') return proof;
  return setProofStatus(proofId, 'approved');
}

async function approveByTelegramMessageId(messageId) {
  var proofId = await findProofIdByMessageId(messageId);
  if (!proofId) return null;
  return approveByProofId(proofId);
}

module.exports = {
  createProof: createProof,
  getProof: getProof,
  approveByProofId: approveByProofId,
  approveByTelegramMessageId: approveByTelegramMessageId,
  isApprovalText: isApprovalText,
  extractProofId: extractProofId,
  buildApproveUrl: buildApproveUrl,
  storageMode: storageMode
};
