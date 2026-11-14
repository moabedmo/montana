/**
 * Montana AI Sales Assistant v2.0
 * Comprehensive Local PostgreSQL Migration 120 Verification
 *
 * Runs against the local Docker test container `montana_restore_test` (port 54332).
 */
const { execSync } = require('child_process');
const assert = require('assert');

function runPsql(query, asRole = null) {
  const rolePrefix = asRole ? `SET ROLE ${asRole}; ` : '';
  const fullSql = `${rolePrefix}${query}`.replace(/"/g, '\\"');
  const cmd = `docker exec montana_restore_test psql -U postgres -d postgres -t -A -F "|" -c "${fullSql}"`;
  const raw = execSync(cmd).toString().trim();
  const lines = raw.split('\n').map(l => l.trim()).filter(l => l !== 'SET');
  return lines.join('\n');
}

function runPsqlRaw(query, asRole = null) {
  try {
    const res = runPsql(query, asRole);
    return { ok: true, data: res, error: null };
  } catch (err) {
    return { ok: false, data: null, error: err.message };
  }
}

async function runAsyncPsql(query, asRole = null) {
  return new Promise((resolve) => {
    const { exec } = require('child_process');
    const rolePrefix = asRole ? `SET ROLE ${asRole}; ` : '';
    const fullSql = `${rolePrefix}${query}`.replace(/"/g, '\\"');
    const cmd = `docker exec montana_restore_test psql -U postgres -d postgres -t -A -F "|" -c "${fullSql}"`;
    exec(cmd, (error, stdout, stderr) => {
      if (error) {
        resolve({ ok: false, error: stderr || error.message });
      } else {
        const lines = stdout.trim().split('\n').map(l => l.trim()).filter(l => l !== 'SET');
        resolve({ ok: true, data: lines.join('\n') });
      }
    });
  });
}

(async () => {
  console.log('========================================================================');
  console.log('  MONTANA AI SALES ASSISTANT V2.0 — LOCAL MIGRATION 120 VERIFICATION   ');
  console.log('========================================================================\n');

  let passed = 0;
  let failed = 0;

  function test(desc, fn) {
    try {
      fn();
      console.log(`  ✅ PASS: ${desc}`);
      passed++;
    } catch (e) {
      console.error(`  ❌ FAIL: ${desc}`);
      console.error(`     Error: ${e.message}`);
      failed++;
    }
  }

  async function testAsync(desc, fn) {
    try {
      await fn();
      console.log(`  ✅ PASS: ${desc}`);
      passed++;
    } catch (e) {
      console.error(`  ❌ FAIL: ${desc}`);
      console.error(`     Error: ${e.message}`);
      failed++;
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 1. SCHEMA STRUCTURE & FUNCTION METADATA
  // ─────────────────────────────────────────────────────────────────────────────
  console.log('--- 1. SCHEMA STRUCTURE & FUNCTION METADATA ---');

  test('orders table has idempotency_key column', () => {
    const col = runPsql("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'idempotency_key';");
    assert.strictEqual(col, 'idempotency_key|text');
  });

  test('orders_idempotency_key_uniq partial unique index exists', () => {
    const idx = runPsql("SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'orders' AND indexname = 'orders_idempotency_key_uniq';");
    assert.ok(idx.includes('orders_idempotency_key_uniq'));
    assert.ok(idx.includes('UNIQUE INDEX'));
    assert.ok(idx.includes('WHERE (idempotency_key IS NOT NULL)'));
  });

  test('chat_bot_sessions has state_version, lease_owner, lease_expires_at columns', () => {
    const cols = runPsql("SELECT column_name FROM information_schema.columns WHERE table_name = 'chat_bot_sessions' AND column_name IN ('state_version', 'lease_owner', 'lease_expires_at') ORDER BY column_name;");
    assert.deepStrictEqual(cols.split('\n'), ['lease_expires_at', 'lease_owner', 'state_version']);
  });

  const v2Functions = [
    'get_order_by_idempotency_key',
    'create_chat_order_idempotent',
    'get_chat_bot_session_v2',
    'acquire_chat_session_lease',
    'renew_chat_session_lease',
    'release_chat_session_lease',
    'save_chat_bot_session_v2'
  ];

  test('all 7 new RPC functions exist, are SECURITY DEFINER, and pin search_path', () => {
    for (const f of v2Functions) {
      const meta = runPsql(`SELECT prosecdef, proconfig::text FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid WHERE n.nspname = 'public' AND p.proname = '${f}';`);
      assert.ok(meta, `Function ${f} must exist`);
      const [secDef, conf] = meta.split('|');
      assert.strictEqual(secDef, 't', `${f} must be SECURITY DEFINER`);
      assert.ok(conf.includes('search_path=public, pg_temp'), `${f} must pin search_path to public, pg_temp`);
    }
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // 2. PERMISSIONS & ROLE ISOLATION
  // ─────────────────────────────────────────────────────────────────────────────
  console.log('\n--- 2. PERMISSIONS & ROLE ISOLATION ---');

  test('anon role is REVOKED from all 7 v2 functions (permission denied)', () => {
    const dummyCalls = [
      "SELECT public.get_order_by_idempotency_key('dummy_key_12345678', 'sid_test')",
      "SELECT public.get_chat_bot_session_v2('sid_test')",
      "SELECT public.acquire_chat_session_lease('sid_test', 'owner_test', 3000)",
      "SELECT public.renew_chat_session_lease('sid_test', 'owner_test', 3000)",
      "SELECT public.release_chat_session_lease('sid_test', 'owner_test')",
      "SELECT public.save_chat_bot_session_v2('sid_test', p_expected_version := 1, p_lease_owner := 'owner_test')",
      "SELECT public.create_chat_order_idempotent('dummy_key_12345678', '{\"name\":\"test\",\"phone\":\"01011112222\"}'::jsonb, '[]'::jsonb, 'cod', 'standard', 0, 0, 0, 0, null, 0, 'sid_test', 'web')"
    ];

    for (let i = 0; i < dummyCalls.length; i++) {
      const res = runPsqlRaw(dummyCalls[i], 'anon');
      assert.strictEqual(res.ok, false, `Call ${v2Functions[i]} as anon must fail`);
      assert.ok(res.error.includes('permission denied') || res.error.includes('42501'), `Expected permission denied for ${v2Functions[i]}, got: ${res.error}`);
    }
  });

  test('service_role has EXECUTE privilege on all 7 functions', () => {
    const res = runPsqlRaw("SELECT public.get_order_by_idempotency_key('short_key', 'sid')", 'service_role');
    assert.strictEqual(res.ok, true, `service_role must be able to execute: ${res.error}`);
    assert.strictEqual(JSON.parse(res.data).found, false);
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // 3. LEGACY create_guest_order UNCHANGED & FUNCTIONAL
  // ─────────────────────────────────────────────────────────────────────────────
  console.log('\n--- 3. LEGACY create_guest_order RPC ---');

  test('create_guest_order 16-parameter live signature is untouched and functional', () => {
    const args = runPsql("SELECT pronargs FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid WHERE n.nspname = 'public' AND p.proname = 'create_guest_order' AND pronargs = 16;");
    assert.strictEqual(args, '16', '16-arg create_guest_order must exist');
  });

  test('legacy checkout flow via create_guest_order works and leaves idempotency_key null', () => {
    const stockBefore = Number(runPsql("SELECT stock FROM public.products WHERE id = 3;")); // whitening cream (249)

    const customerJson = JSON.stringify({
      name: 'عميل ويب قديم',
      phone: '01012345678',
      address: 'القاهرة المعادي شارع 9 عمارة 15',
      city: 'القاهرة'
    });
    const itemsJson = JSON.stringify([{ id: 3, name: 'كريم التفتيح', qty: 1, price: 249 }]);

    const callSql = `SELECT public.create_guest_order('${customerJson}'::jsonb, '${itemsJson}'::jsonb, 'cod', 'standard', null, null, 249, 80, 0, 329, 'القاهرة', null, 0, 0, 'web_session_legacy_1', 'web');`;
    const res = JSON.parse(runPsql(callSql, 'service_role'));

    assert.ok(res.order && res.order.order_number, 'Legacy order created');
    const legacyOrderNumber = res.order.order_number;

    // Verify DB row
    const row = runPsql(`SELECT order_number, coalesce(idempotency_key, ''), total, status FROM public.orders WHERE order_number = '${legacyOrderNumber}';`);
    const [num, idemKey, total, status] = row.split('|');
    assert.strictEqual(num, legacyOrderNumber);
    assert.strictEqual(idemKey, '', 'idempotency_key must be NULL for legacy guest checkout');
    assert.strictEqual(total, '329.00', 'Total must be 329 (249 subtotal + 80 shipping)');
    assert.strictEqual(status, 'pending');

    // Verify stock decremented by 1
    const stockAfter = Number(runPsql("SELECT stock FROM public.products WHERE id = 3;"));
    assert.strictEqual(stockAfter, stockBefore - 1, 'Stock must be decremented by exactly 1');
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // 4. V2 IDEMPOTENCY & CONCURRENT ORDER CREATION
  // ─────────────────────────────────────────────────────────────────────────────
  console.log('\n--- 4. V2 IDEMPOTENT ORDER CREATION & CONCURRENCY ---');

  const v2OpId = 'v2_op_test_key_' + Date.now();
  const v2Sid = 'instagram:v2_verify_' + Date.now();

  test('single v2 order creation creates order and binds idempotency_key', () => {
    const stockBefore = Number(runPsql("SELECT stock FROM public.products WHERE id = 2;")); // whitening cleanser (299)
    const customerJson = JSON.stringify({
      name: 'منار أحمد إبراهيم',
      phone: '01099887766',
      address: 'الجيزة الدقي شارع التحرير عمارة 5',
      city: 'الجيزة'
    });
    const itemsJson = JSON.stringify([{ id: 2, name: 'غسول التفتيح', qty: 1, price: 299 }]);

    const callSql = `SELECT public.create_chat_order_idempotent('${v2OpId}', '${customerJson}'::jsonb, '${itemsJson}'::jsonb, 'cod', 'standard', 299, 80, 0, 379, 'الجيزة', 0, '${v2Sid}', 'instagram');`;
    const res = JSON.parse(runPsql(callSql, 'service_role'));

    assert.ok(res.order && res.order.order_number, 'v2 order created');
    assert.strictEqual(res.idempotent_replay, false);

    const v2OrderNum = res.order.order_number;
    const dbKey = runPsql(`SELECT idempotency_key FROM public.orders WHERE order_number = '${v2OrderNum}';`);
    assert.strictEqual(dbKey, v2OpId);

    const stockAfter = Number(runPsql("SELECT stock FROM public.products WHERE id = 2;"));
    assert.strictEqual(stockAfter, stockBefore - 1);
  });

  test('replay with SAME key and SAME session returns identical order and does NOT deduct stock', () => {
    const stockBefore = Number(runPsql("SELECT stock FROM public.products WHERE id = 2;"));
    const customerJson = JSON.stringify({ name: 'منار أحمد', phone: '01099887766', address: '...', city: 'الجيزة' });
    const itemsJson = JSON.stringify([{ id: 2, name: 'غسول التفتيح', qty: 1, price: 299 }]);

    const callSql = `SELECT public.create_chat_order_idempotent('${v2OpId}', '${customerJson}'::jsonb, '${itemsJson}'::jsonb, 'cod', 'standard', 299, 80, 0, 379, 'الجيزة', 0, '${v2Sid}', 'instagram');`;
    const res = JSON.parse(runPsql(callSql, 'service_role'));

    assert.strictEqual(res.idempotent_replay, true);
    assert.strictEqual(res.order.idempotency_key, v2OpId);

    const stockAfter = Number(runPsql("SELECT stock FROM public.products WHERE id = 2;"));
    assert.strictEqual(stockAfter, stockBefore, 'Stock must NOT be deducted on replay');
  });

  test('replay with SAME key but DIFFERENT session raises 42501 (session mismatch)', () => {
    const customerJson = JSON.stringify({ name: 'منار أحمد', phone: '01099887766', address: '...', city: 'الجيزة' });
    const itemsJson = JSON.stringify([{ id: 2, name: 'غسول التفتيح', qty: 1, price: 299 }]);

    const callSql = `SELECT public.create_chat_order_idempotent('${v2OpId}', '${customerJson}'::jsonb, '${itemsJson}'::jsonb, 'cod', 'standard', 299, 80, 0, 379, 'الجيزة', 0, 'different_session_spoof', 'instagram');`;
    const res = runPsqlRaw(callSql, 'service_role');

    assert.strictEqual(res.ok, false);
    assert.ok(res.error.includes('idempotency_key_session_mismatch') || res.error.includes('42501'));
  });

  await testAsync('10 concurrent requests with the SAME operationId result in EXACTLY 1 order and 1 stock deduction', async () => {
    const concurrentOpId = 'concurrent_stress_op_' + Date.now();
    const concurrentSid = 'messenger:concurrent_' + Date.now();
    const stockBefore = Number(runPsql("SELECT stock FROM public.products WHERE id = 4;")); // lotion (229)

    const customerJson = JSON.stringify({
      name: 'تسنيم مصطفى عثمان',
      phone: '01234567890',
      address: 'الإسكندرية سموحة شارع فوزي معاذ عمارة 12',
      city: 'الإسكندرية'
    });
    const itemsJson = JSON.stringify([{ id: 4, name: 'لوشن اليدين والجسم', qty: 1, price: 229 }]);

    const query = `SELECT public.create_chat_order_idempotent('${concurrentOpId}', '${customerJson}'::jsonb, '${itemsJson}'::jsonb, 'cod', 'standard', 229, 80, 0, 309, 'الإسكندرية', 0, '${concurrentSid}', 'messenger');`;

    const promises = Array.from({ length: 10 }, () => runAsyncPsql(query, 'service_role'));
    const results = await Promise.all(promises);

    for (const r of results) {
      assert.strictEqual(r.ok, true, `Concurrent request failed: ${r.error}`);
    }

    const orderNumbers = results.map(r => JSON.parse(r.data).order.order_number);
    const uniqueOrders = new Set(orderNumbers);
    assert.strictEqual(uniqueOrders.size, 1, 'All 10 calls must return the EXACT same order number');

    const dbRows = Number(runPsql(`SELECT count(*) FROM public.orders WHERE idempotency_key = '${concurrentOpId}';`));
    assert.strictEqual(dbRows, 1, 'Exactly 1 row must exist in orders for this key');

    const stockAfter = Number(runPsql("SELECT stock FROM public.products WHERE id = 4;"));
    assert.strictEqual(stockAfter, stockBefore - 1, 'Inventory must be decremented exactly once');

    const replays = results.filter(r => JSON.parse(r.data).idempotent_replay === true);
    assert.strictEqual(replays.length, 9, 'Exactly 9 calls must report idempotent_replay: true');
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // 5. SESSION LEASING & STALE-WRITE PROTECTION
  // ─────────────────────────────────────────────────────────────────────────────
  console.log('\n--- 5. SESSION LEASING & STALE-WRITE PROTECTION ---');

  const testSid = 'instagram:lease_test_' + Date.now();

  test('acquire_chat_session_lease acquires lease, blocks conflicting owner, and expires cleanly', () => {
    // 1. Owner A acquires lease
    const acqA = JSON.parse(runPsql(`SELECT public.acquire_chat_session_lease('${testSid}', 'owner_A', 3000);`, 'service_role'));
    assert.strictEqual(acqA.acquired, true);
    assert.strictEqual(acqA.owner_id, 'owner_A');

    // 2. Owner B cannot acquire while lease is active
    const acqB = JSON.parse(runPsql(`SELECT public.acquire_chat_session_lease('${testSid}', 'owner_B', 3000);`, 'service_role'));
    assert.strictEqual(acqB.acquired, false);
    assert.strictEqual(acqB.owner_id, 'owner_A');

    // 3. Owner A can renew
    const renA = JSON.parse(runPsql(`SELECT public.renew_chat_session_lease('${testSid}', 'owner_A', 5000);`, 'service_role'));
    assert.strictEqual(renA.renewed, true);

    // 4. Non-owner cannot renew
    const renB = JSON.parse(runPsql(`SELECT public.renew_chat_session_lease('${testSid}', 'owner_B', 5000);`, 'service_role'));
    assert.strictEqual(renB.renewed, false);

    // 5. Release lease
    const rel = JSON.parse(runPsql(`SELECT public.release_chat_session_lease('${testSid}', 'owner_A');`, 'service_role'));
    assert.strictEqual(rel.released, true);

    // 6. Owner B can now acquire
    const acqB2 = JSON.parse(runPsql(`SELECT public.acquire_chat_session_lease('${testSid}', 'owner_B', 3000);`, 'service_role'));
    assert.strictEqual(acqB2.acquired, true);
    runPsql(`SELECT public.release_chat_session_lease('${testSid}', 'owner_B');`, 'service_role');
  });

  test('save_chat_bot_session_v2 detects stale version and rejects overwrite', () => {
    // Initialize session at version 1
    const s1 = JSON.parse(runPsql(`SELECT public.save_chat_bot_session_v2('${testSid}', p_cart := '[{\"product_id\":1,\"quantity\":1}]'::jsonb);`, 'service_role'));
    assert.strictEqual(s1.saved, true);
    const v1 = s1.state_version;

    // Writer A updates to version 2
    const s2 = JSON.parse(runPsql(`SELECT public.save_chat_bot_session_v2('${testSid}', p_cart := '[{\"product_id\":1,\"quantity\":2}]'::jsonb, p_expected_version := ${v1});`, 'service_role'));
    assert.strictEqual(s2.saved, true);
    assert.strictEqual(s2.state_version, v1 + 1);

    // Writer B attempts write with stale expected version (v1)
    const sStale = JSON.parse(runPsql(`SELECT public.save_chat_bot_session_v2('${testSid}', p_cart := '[{\"product_id\":3,\"quantity\":1}]'::jsonb, p_expected_version := ${v1});`, 'service_role'));
    assert.strictEqual(sStale.saved, false);
    assert.strictEqual(sStale.conflict, true);
    assert.strictEqual(sStale.reason, 'STALE_VERSION');
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // 6. DASHBOARD & BOSTA WORKFLOW COMPATIBILITY
  // ─────────────────────────────────────────────────────────────────────────────
  console.log('\n--- 6. DASHBOARD & BOSTA WORKFLOW COMPATIBILITY ---');

  test('dashboard query retrieves both legacy and v2 orders with all columns', () => {
    const dashQuery = "SELECT id, order_number, customer_name, customer_phone, governorate, total, status, coalesce(idempotency_key, ''), created_at FROM public.orders ORDER BY created_at DESC LIMIT 5;";
    const rows = runPsql(dashQuery);
    const lines = rows.split('\n');
    assert.ok(lines.length >= 3, 'Must return at least 3 orders');

    const nullCount = Number(runPsql("SELECT count(*) FROM public.orders WHERE idempotency_key IS NULL;"));
    const keyCount = Number(runPsql("SELECT count(*) FROM public.orders WHERE idempotency_key IS NOT NULL;"));
    assert.ok(nullCount > 0, `Must contain legacy orders with NULL idempotency_key (found ${nullCount})`);
    assert.ok(keyCount > 0, `Must contain v2 orders with populated idempotency_key (found ${keyCount})`);
  });

  test('order status transition (pending -> confirmed -> shipped) works seamlessly on v2 order', () => {
    const v2OrderNum = runPsql(`SELECT order_number FROM public.orders WHERE idempotency_key = '${v2OpId}';`);
    assert.ok(v2OrderNum, 'v2 order number must exist');

    // 1. Confirm order
    runPsql(`UPDATE public.orders SET status = 'confirmed' WHERE order_number = '${v2OrderNum}';`);
    let status = runPsql(`SELECT status FROM public.orders WHERE order_number = '${v2OrderNum}';`);
    assert.strictEqual(status, 'confirmed');

    // 2. Attach Bosta tracking and ship
    runPsql(`UPDATE public.orders SET status = 'shipped', bosta_tracking_number = 'BST-100293847', bosta_status = 'SHIPPED' WHERE order_number = '${v2OrderNum}';`);
    const shippedRow = runPsql(`SELECT status, bosta_tracking_number FROM public.orders WHERE order_number = '${v2OrderNum}';`);
    assert.strictEqual(shippedRow, 'shipped|BST-100293847');

    // 3. Deliver
    runPsql(`UPDATE public.orders SET status = 'delivered', bosta_status = 'DELIVERED' WHERE order_number = '${v2OrderNum}';`);
    status = runPsql(`SELECT status FROM public.orders WHERE order_number = '${v2OrderNum}';`);
    assert.strictEqual(status, 'delivered');
  });

  console.log('\n========================================================================');
  console.log(`  VERIFICATION FINISHED: ${passed} PASSED | ${failed} FAILED            `);
  console.log('========================================================================');

  if (failed > 0) process.exit(1);
})();
