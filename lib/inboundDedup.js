// Claim an inbound message so exactly one request answers it.
//
// This used to be a Map in api/chat.js. Module scope on Vercel belongs to one
// lambda instance, and the duplicates that matter arrive while the first
// request is still waiting on its model call — so they are concurrent, get
// routed to a second instance, and find an empty Map. The guard only ever
// fired on a repeat that arrived after the first had finished and happened to
// land back on the same warm instance.
//
// The claim lives in Postgres now, where a primary key and a single statement
// make it atomic across instances. The in-memory set stays as a cheap first
// check and as the only guard if the database call cannot be made.
//
// Every failure path answers the customer. A dedupe that breaks should let a
// message through twice, never swallow it once.
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://ikryeyqrithikabwidov.supabase.co';
const SERVICE_KEY = process.env.SERVICE_ROLE || process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const WINDOW_MS = 12_000;
const PRUNE_EVERY = 200;

let client = null;
let rpcMissing = false;          // set once if the migration has not been applied
let sincePrune = 0;

function db() {
  if (!SERVICE_KEY) return null;
  if (!client) client = createClient(SUPABASE_URL, SERVICE_KEY);
  return client;
}

// ---------------------------------------------------------------- local set
const local = new Map();

function localClaim(key) {
  const now = Date.now();
  if (local.size > 500) {
    for (const [k, at] of local) {
      if (now - at > WINDOW_MS) local.delete(k);
    }
  }
  const prev = local.get(key);
  local.set(key, now);
  return !(prev && now - prev < WINDOW_MS);
}

function inboundKey(sid, message) {
  return `${sid}|${String(message).trim().slice(0, 300)}`;
}

/**
 * True when this request holds the claim and should answer.
 *
 * The local check runs first: when it already knows the key, the repeat landed
 * on the same instance and there is nothing to ask the database.
 */
async function claimInbound(key) {
  if (!key) return true;
  if (!localClaim(key)) return false;

  const sb = db();
  if (!sb || rpcMissing) return true;

  try {
    const { data, error } = await sb.rpc('claim_inbound_message', {
      p_key: key,
      p_window_ms: WINDOW_MS,
    });
    if (error) {
      // 42883 / PGRST202: the function is not there yet. Stop asking, and say
      // so once rather than on every message.
      if (error.code === '42883' || error.code === 'PGRST202') {
        rpcMissing = true;
        console.warn('[dedup] claim_inbound_message missing — migration 115 not applied');
      } else {
        console.warn('[dedup] claim failed, answering anyway:', error.message);
      }
      return true;
    }
    if (++sincePrune >= PRUNE_EVERY) {
      sincePrune = 0;
      sb.rpc('prune_chat_inbound_dedup').then(
        () => {},
        (e) => console.warn('[dedup] prune failed:', e?.message),
      );
    }
    return data !== false;
  } catch (err) {
    console.warn('[dedup] claim threw, answering anyway:', err.message);
    return true;
  }
}

/** Give the claim back, so a retry after a failed turn is answered. */
async function releaseInbound(key) {
  if (!key) return;
  local.delete(key);
  const sb = db();
  if (!sb || rpcMissing) return;
  try {
    await sb.rpc('release_inbound_message', { p_key: key });
  } catch (err) {
    console.warn('[dedup] release failed:', err.message);
  }
}

module.exports = { claimInbound, releaseInbound, inboundKey, WINDOW_MS };
