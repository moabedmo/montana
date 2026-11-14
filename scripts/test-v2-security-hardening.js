/**
 * scripts/test-v2-security-hardening.js
 *
 * Security regression suite for Montana AI Sales Assistant v2.0 / Migration 120.
 *
 *  A. Migration 120 (static): every SECURITY DEFINER function is service_role
 *     only, pinned search_path, no anon/authenticated/PUBLIC grant anywhere,
 *     session-bound idempotency, no "no key" path, 112 RPCs untouched.
 *  B. JS (static + behavioural): no fallback from create_chat_order_idempotent
 *     to create_guest_order, no fallback in the versioned session save.
 *  C. Routing: a customer-chosen session id can never reach v2 / test isolation.
 *
 * NOTE: this runs no SQL. GRANTs are verified from the migration text here and
 * must be re-verified against the real catalog (has_function_privilege) when
 * the migration is applied — see the readiness report.
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');

let passed = 0;
function check(cond, label) {
  assert.ok(cond, `FAILED: ${label}`);
  passed++;
  console.log(`  ✅ ${label}`);
}

// ── A. Migration 120 static audit ───────────────────────────────────────────
console.log('\nA. MIGRATION 120 — PERMISSIONS & DEFINER HYGIENE');
const sql = read('supabase/migrations/120_v2_idempotency_and_session_lock.sql');
const sqlNoComments = sql.replace(/--.*$/gm, '');
const fnNames = [...sqlNoComments.matchAll(/create\s+or\s+replace\s+function\s+public\.(\w+)\s*\(/gi)].map((m) => m[1]);
check(fnNames.length === 7, `migration defines exactly 7 functions (${fnNames.join(', ')})`);

for (const fn of fnNames) {
  const body = sqlNoComments.split(new RegExp(`create\\s+or\\s+replace\\s+function\\s+public\\.${fn}\\s*\\(`, 'i'))[1].split(/\n\$\$;/)[0];
  check(/security\s+definer/i.test(body), `${fn}: SECURITY DEFINER`);
  check(/set\s+search_path\s*=\s*public,\s*pg_temp/i.test(body), `${fn}: search_path pinned to public, pg_temp`);
  check(
    new RegExp(`revoke\\s+all\\s+on\\s+function\\s+public\\.${fn}\\s*\\([^)]*\\)\\s+from\\s+public,\\s*anon,\\s*authenticated\\s*;`, 'i').test(sqlNoComments),
    `${fn}: REVOKE ALL from public, anon, authenticated`
  );
  check(
    new RegExp(`grant\\s+execute\\s+on\\s+function\\s+public\\.${fn}\\s*\\([^)]*\\)\\s+to\\s+service_role\\s*;`, 'i').test(sqlNoComments),
    `${fn}: GRANT EXECUTE to service_role only`
  );
}
const grants = [...sqlNoComments.matchAll(/grant\s+[^;]*?\bto\b\s+([^;]+);/gi)].map((m) => m[1].trim().toLowerCase());
check(grants.length === 7 && grants.every((g) => g === 'service_role'), 'every GRANT in the file targets service_role and nothing else');
check(!/\bto\b[^;]*\b(anon|authenticated|public)\b/i.test(sqlNoComments.replace(/revoke[^;]*;/gi, '')), 'no anon / authenticated / PUBLIC grant exists');
check(!/function\s+public\.get_chat_bot_session\s*\(/i.test(sqlNoComments), 'get_chat_bot_session (112, anon-readable) is NOT redefined or widened');
check(!/function\s+public\.save_chat_bot_session\s*\(/i.test(sqlNoComments), 'save_chat_bot_session (112) is NOT redefined');
check(!/function\s+public\.create_guest_order\s*\(/i.test(sqlNoComments), 'create_guest_order is NOT redefined');

const idem = sqlNoComments.split(/create\s+or\s+replace\s+function\s+public\.create_chat_order_idempotent/i)[1].split(/\n\$\$;/)[0];
check(/idempotency_key_required/.test(idem) && /length\(v_key\)\s*<\s*16/.test(idem), 'create_chat_order_idempotent: key mandatory (raises), min length 16');
check(/chat_session_id_required/.test(idem), 'create_chat_order_idempotent: chat session id mandatory');
check((idem.match(/idempotency_key_session_mismatch/g) || []).length >= 2, 'create_chat_order_idempotent: replay refused for a different session (both replay paths)');
check((idem.match(/public\.create_guest_order\(/g) || []).length === 1, 'create_chat_order_idempotent: create_guest_order is called once, inside the keyed sub-transaction');
check(!/v_key\s+is\s+null\s+then[\s\S]{0,200}create_guest_order/i.test(idem), 'create_chat_order_idempotent: NO key-less branch that calls create_guest_order');
check(/pg_advisory_xact_lock/.test(idem) && /when\s+unique_violation/.test(idem), 'create_chat_order_idempotent: advisory lock + unique_violation handler');
const lookup = sqlNoComments.split(/create\s+or\s+replace\s+function\s+public\.get_order_by_idempotency_key/i)[1].split(/\n\$\$;/)[0];
check(/chat_session_id\s+is\s+distinct\s+from\s+v_sid/.test(lookup), 'get_order_by_idempotency_key: returns nothing unless the order belongs to the caller session');
check(!/row_to_json\(/.test(lookup), 'get_order_by_idempotency_key: returns a whitelist of fields, not the full order row');

// ── B. No fallback to the legacy order / session RPCs ────────────────────────
console.log('\nB. v2 PATHS NEVER FALL BACK TO LEGACY RPCs');
const engine = read('lib/chatEngine.js');
const store = read('lib/chatSessionStore.js');
const v2src = read('lib/salesAssistantV2.js');
const stripLineComments = (s) => s.replace(/^\s*\/\/.*$/gm, '');
const createOrderSrc = stripLineComments(engine.slice(engine.indexOf('async function create_order('), engine.indexOf('function show_checkout_form(')));
const v2Branch = createOrderSrc.slice(createOrderSrc.indexOf('else if (v2.shouldRouteSessionToV2(sid)'), createOrderSrc.indexOf('const guestRes'));
check(v2Branch.includes('create_chat_order_idempotent'), 'v2 order branch calls create_chat_order_idempotent');
check(!/create_guest_order/.test(v2Branch), 'v2 order branch contains no create_guest_order call');
check(!/fallbackRes|PGRST202|Unknown RPC/.test(createOrderSrc), 'create_order has no PGRST202 / "missing RPC" fallback');
check(!/fallbackV1Rpc/.test(store) && !/await saveSession\(sid, state, client\)/.test(store), 'saveSessionVersioned does not fall back to save_chat_bot_session');
check(/throw new Error\(`save_chat_bot_session_v2 failed/.test(store), 'saveSessionVersioned throws on RPC error');
check(/throw new Error\(`get_chat_bot_session_v2 failed/.test(store), 'v2 loadSession fails closed on RPC error');
const codeOnly = (s) => stripLineComments(s.replace(/\/\*[\s\S]*?\*\//g, ''));
check(!/v2test-|v2-owner-test|test-v2-/.test(codeOnly(engine)) && !/v2test-|v2-owner-test|test-v2-/.test(codeOnly(v2src)), 'no session-id prefix pattern grants v2 access or test isolation');
check(/trustedCaller:\s*trusted === true/.test(read('api/chat.js')), 'api/chat.js passes trustedCaller from the verified header only');
check(/timingSafeEqual/.test(read('lib/security.js')), 'X-Montana-Secret compared in constant time');

// ── C. Behaviour: order creation ─────────────────────────────────────────────
function makeMock({ idemResult }) {
  const calls = [];
  const products = [{ id: 3, name: 'كريم التفتيح', price: 249, image_url: '', slug: 'whitening-cream', stock: 10, is_active: true }];
  const builder = (table) => {
    const b = {
      select() { return b; }, eq() { return b; }, in() { return b; }, ilike() { return b; }, limit() { return b; }, order() { return b; },
      single: async () => (table === 'shipping_rates' ? { data: { governorate: 'القاهرة', cost: 85 }, error: null } : { data: null, error: null }),
      maybeSingle: async () => ({ data: null, error: null }),
      then(res, rej) {
        const data = table === 'products' ? products : [];
        return Promise.resolve({ data, error: null }).then(res, rej);
      },
    };
    return b;
  };
  return {
    calls,
    client: {
      from: builder,
      rpc: async (name, args) => {
        calls.push(name);
        if (name === 'create_chat_order_idempotent') return idemResult(args);
        if (name === 'create_guest_order') return { data: { order: { id: 1, order_number: 'MON-LEGACY' }, items: [] }, error: null };
        return { data: null, error: null };
      },
    },
  };
}

(async () => {
  const chat = require('../lib/chatEngine');
  const v2 = require('../lib/salesAssistantV2');
  const form = { name: 'سارة محمود علي', phone: '01012345678', address: 'مدينة نصر شارع عباس العقاد عمارة 15', governorate: 'القاهرة' };
  const sid = 'instagram:sec_test_1';
  const withCart = () => { chat.sessionCarts[sid] = [{ id: 3, name: 'كريم التفتيح', price: 249, qty: 1 }]; };
  const KEY = 'op_sec_test_key_0123456789abcdef';
  v2.logTelemetry && (process.env.CHAT_SILENT_TELEMETRY = '1');

  console.log('\nC. ORDER PATH BEHAVIOUR (v2 session, mocked client)');
  v2.setRolloutConfigOverride({ mode: 'on', ttlMs: 60000 });

  // C1: v2 RPC missing from PostgREST cache → error, NOT a legacy order
  let m = makeMock({ idemResult: () => ({ data: null, error: { code: 'PGRST202', message: 'Could not find the function public.create_chat_order_idempotent' } }) });
  chat.__setTestAdapters({ sb: m.client, sbService: m.client });
  withCart();
  let r = await chat.__create_order_for_tests({ ...form, operationId: KEY }, sid, 'instagram');
  check(r.error && !r.order_number, 'RPC unavailable (PGRST202) → customer-safe error, no order');
  check(!m.calls.includes('create_guest_order'), 'RPC unavailable → create_guest_order was NEVER called');

  // C2: RPC raises (e.g. session mismatch) → error, no legacy order
  m = makeMock({ idemResult: () => ({ data: null, error: { code: '42501', message: 'idempotency_key_session_mismatch' } }) });
  chat.__setTestAdapters({ sb: m.client, sbService: m.client });
  withCart();
  r = await chat.__create_order_for_tests({ ...form, operationId: KEY }, sid, 'instagram');
  check(r.error && !m.calls.includes('create_guest_order'), 'RPC error (session mismatch) → error, create_guest_order never called');

  // C3: RPC returns empty data → error, no legacy order
  m = makeMock({ idemResult: () => ({ data: null, error: null }) });
  chat.__setTestAdapters({ sb: m.client, sbService: m.client });
  withCart();
  r = await chat.__create_order_for_tests({ ...form, operationId: KEY }, sid, 'instagram');
  check(r.error && !m.calls.includes('create_guest_order'), 'RPC empty response → error, create_guest_order never called');

  // C4: v2 session with NO operation id → refused, nothing called
  m = makeMock({ idemResult: () => ({ data: null, error: null }) });
  chat.__setTestAdapters({ sb: m.client, sbService: m.client });
  withCart();
  r = await chat.__create_order_for_tests({ ...form }, sid, 'instagram');
  check(r.error && m.calls.length === 0, 'v2 session without operationId → refused, zero RPC calls (no un-idempotent order)');

  // C5: success path uses only the idempotent RPC, with the session id bound
  let seen = null;
  m = makeMock({ idemResult: (args) => { seen = args; return { data: { order: { id: 9, order_number: 'MON-12345' }, items: [], idempotent_replay: false }, error: null }; } });
  chat.__setTestAdapters({ sb: m.client, sbService: m.client });
  withCart();
  r = await chat.__create_order_for_tests({ ...form, operationId: KEY }, sid, 'instagram');
  check(r.order_number === 'MON-12345' && m.calls.filter((c) => c === 'create_chat_order_idempotent').length === 1 && !m.calls.includes('create_guest_order'), 'success → exactly one create_chat_order_idempotent call, no legacy call');
  check(seen && seen.p_idempotency_key === KEY && seen.p_chat_session_id === sid, 'the RPC receives the idempotency key AND the chat session id (replay binding)');

  // C6: non-v2 session keeps the legacy website behaviour untouched
  v2.setRolloutConfigOverride({ mode: 'off', ttlMs: 60000 });
  m = makeMock({ idemResult: () => ({ data: null, error: null }) });
  chat.__setTestAdapters({ sb: m.client, sbService: m.client });
  withCart();
  r = await chat.__create_order_for_tests({ ...form }, sid, 'instagram');
  check(r.order_number === 'MON-LEGACY' && m.calls.includes('create_guest_order') && !m.calls.includes('create_chat_order_idempotent'), 'v1 sessions (mode off) still use create_guest_order exactly as before');

  // ── D. Routing / spoofing ───────────────────────────────────────────────
  console.log('\nD. CUSTOMER-CONTROLLED SESSION IDS');
  const ALLOWED = ['instagram:owner-test-9917'];
  const spoof = ['instagram:owner-test-9917', 'v2test-x', 'v2-owner-test', 'web:v2-owner-test', 'test-v2-1', 'messenger:eval-x', 'instagram:v2test-1'];
  for (const mode of ['allowlist', 'test_only', 'canary']) {
    v2.setRolloutConfigOverride({ mode, canaryPercent: 0, allowlist: ALLOWED, ttlMs: 60000 });
    const leaked = spoof.filter((s) => v2.runWithRequestContext({ trusted: false }, () => v2.shouldRouteSessionToV2(s) || v2.isTestIsolationSession(s)));
    check(leaked.length === 0, `mode=${mode}: untrusted request with ANY spoofed id (incl. the exact allowlisted id) → never v2, never test isolation`);
  }
  v2.setRolloutConfigOverride({ mode: 'allowlist', allowlist: ALLOWED, ttlMs: 60000 });
  check(v2.runWithRequestContext({ trusted: true }, () => v2.shouldRouteSessionToV2(ALLOWED[0]) && v2.isTestIsolationSession(ALLOWED[0])), 'trusted request + exact allowlisted id → v2 + test isolation');
  check(v2.runWithRequestContext({ trusted: true }, () => !v2.shouldRouteSessionToV2('instagram:owner-test-9917 ') && !v2.shouldRouteSessionToV2('INSTAGRAM:owner-test-9917') && !v2.shouldRouteSessionToV2('v2test-x')), 'trusted request: near-miss / prefix ids still not matched');
  v2.setRolloutConfigOverride({ mode: 'canary', canaryPercent: 0, allowlist: [], ttlMs: 60000 });
  let any = 0;
  for (let i = 0; i < 3000; i++) if (v2.runWithRequestContext({ trusted: true }, () => v2.shouldRouteSessionToV2(`instagram:c${i}`))) any++;
  check(any === 0, 'canary at 0% routes 0 / 3000 sessions even for trusted requests');
  v2.setRolloutConfigOverride({ mode: 'on', ttlMs: 60000 });
  check(v2.runWithRequestContext({ trusted: false, v2Blocked: true }, () => v2.shouldRouteSessionToV2('instagram:x')) === false, 'v2Blocked (service-role client missing) forces v1 even in mode=on');

  chat.__setTestAdapters(null);
  console.log(`\n🔒 SECURITY HARDENING SUITE PASSED (${passed} assertions)`);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
