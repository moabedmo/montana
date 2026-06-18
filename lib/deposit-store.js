'use strict';

var TTL_SEC = 48 * 60 * 60;
var memory = globalThis.__montanaDepositStore || (globalThis.__montanaDepositStore = { proofs: {}, byMsg: {} });

function redisConfig() {
  return {
    url: String(process.env.UPSTASH_REDIS_REST_URL || '').trim(),
    token: String(process.env.UPSTASH_REDIS_REST_TOKEN || '').trim()
  };
}

function hasRedis() {
  var cfg = redisConfig();
  return !!(cfg.url && cfg.token);
}

async function redisRequest(path, options) {
  var cfg = redisConfig();
  var res = await fetch(cfg.url + path, Object.assign({
    headers: { Authorization: 'Bearer ' + cfg.token }
  }, options || {}));
  return res.json();
}

async function redisGet(key) {
  if (!hasRedis()) return null;
  var data = await redisRequest('/get/' + encodeURIComponent(key));
  if (!data || data.result == null) return null;
  return data.result;
}

async function redisSet(key, value) {
  if (!hasRedis()) return;
  await redisRequest('/set/' + encodeURIComponent(key), {
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + redisConfig().token,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ value: value, ex: TTL_SEC })
  });
}

function proofKey(id) { return 'montana:proof:' + id; }
function msgKey(id) { return 'montana:msg:' + id; }

async function saveProof(proof) {
  var json = JSON.stringify(proof);
  if (hasRedis()) {
    await redisSet(proofKey(proof.id), json);
    if (proof.telegramMessageId) {
      await redisSet(msgKey(proof.telegramMessageId), proof.id);
    }
    return;
  }
  memory.proofs[proof.id] = proof;
  if (proof.telegramMessageId) {
    memory.byMsg[String(proof.telegramMessageId)] = proof.id;
  }
}

async function loadProof(proofId) {
  if (hasRedis()) {
    var raw = await redisGet(proofKey(proofId));
    if (!raw) return null;
    try { return JSON.parse(raw); } catch (e) { return null; }
  }
  return memory.proofs[proofId] || null;
}

async function findProofIdByMessageId(messageId) {
  if (hasRedis()) {
    return await redisGet(msgKey(messageId));
  }
  return memory.byMsg[String(messageId)] || null;
}

module.exports = {
  hasRedis: hasRedis,
  saveProof: saveProof,
  loadProof: loadProof,
  findProofIdByMessageId: findProofIdByMessageId
};
