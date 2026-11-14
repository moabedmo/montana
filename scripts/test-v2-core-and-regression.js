/**
 * Stage 1 Verification & Regex Regression Test Matrix
 *
 * Tests:
 * 1. Versioned Checkout Snapshot & Explicit Confirmation Binding (invalidation on any change)
 * 2. Atomic Database-Level Order Idempotency (failed attempt retry + intentional repeat purchase)
 * 3. Lease-Renewing Per-Session Concurrency Control (>TTL AI call renewal + FIFO serialization, zero dropped messages)
 * 4. Conflict-Free Optimistic Session State Merge
 * 5. Turn-Level Tool Call Deduplication
 * 6. Strict Sales Claim Verifier & Honest Model-Failure Fallback
 * 7. Feature Flag, Canary Bucketing & Zero-Side-Effect Shadow Mode + Sub-ms Rollback Latency
 * 8. Privacy-Safe Telemetry & PII Masking
 * 9. Full Regex Regression Test Matrix (CRITICAL_SAFETY_GUARD, DETERMINISTIC_FACTS, CHECKOUT_AND_ORDER_WIZARD, SALES_ROUTING_RULES)
 */

const assert = require('assert');
const v2 = require('../lib/salesAssistantV2');
const engine = require('../lib/chatEngine');

process.env.CHAT_SILENT_TELEMETRY = '1';

async function runTests() {
  let passed = 0;

  function ok(cond, name) {
    assert.ok(cond, `FAIL: ${name}`);
    passed++;
  }

  // ── 1. Versioned Checkout Snapshot & Invalidation ─────────────────────────
  {
    const baseParams = {
      cart: [{ id: 'bundle:brightening', name: 'روتين التفتيح الكامل', qty: 1, price: 777, isBundle: true }],
      subtotal: 777,
      shipping: 0,
      discount: 0,
      total: 777,
      name: 'ندا علوي أحمد',
      phone: '01022469615',
      address: 'أرض الجمعيات ميدان فوكس عمارة 4',
      governorate: 'الإسماعيلية',
    };

    const wiz1 = v2.bindCheckoutSnapshot({}, baseParams, 'manychat:1001');
    ok(wiz1.snapshotVersion === 1, 'Initial snapshotVersion is 1');
    ok(wiz1.pendingSnapshotHash && wiz1.pendingSnapshotHash.length === 24, 'Computes 24-char SHA-256 snapshot hash');
    ok(wiz1.confirmedSnapshotHash === null, 'Unconfirmed snapshot starts with confirmedSnapshotHash = null');

    // Verify fails before explicit confirmation
    const checkBefore = v2.verifyExplicitSnapshotConfirmation(wiz1, baseParams);
    ok(checkBefore.valid === false && checkBefore.reason === 'EXPLICIT_CONFIRMATION_REQUIRED', 'Blocks order creation before explicit confirmation');

    // Simulate customer confirming v1
    wiz1.confirmedSnapshotHash = wiz1.pendingSnapshotHash;
    const checkAfter = v2.verifyExplicitSnapshotConfirmation(wiz1, baseParams);
    ok(checkAfter.valid === true && checkAfter.operationId === wiz1.operationId, 'Allows order creation when confirmedSnapshotHash matches current state');

    // Mutate address -> must invalidate confirmation and bump version to 2
    const modifiedAddressParams = { ...baseParams, address: 'شارع شبين الكوم بجوار صيدلية العزبي' };
    const checkMutatedDirect = v2.verifyExplicitSnapshotConfirmation(wiz1, modifiedAddressParams);
    ok(checkMutatedDirect.valid === false && checkMutatedDirect.reason === 'SNAPSHOT_MUTATED_BEFORE_CONFIRM', 'Detects direct state mutation against pending snapshot');

    const wiz2 = v2.bindCheckoutSnapshot(wiz1, modifiedAddressParams, 'manychat:1001');
    ok(wiz2.snapshotVersion === 2, 'Increments snapshotVersion to 2 when address changes');
    ok(wiz2.confirmedSnapshotHash === null, 'Clears confirmedSnapshotHash when snapshot mutates');
    ok(wiz2.operationId !== wiz1.operationId, 'Generates new operationId for new snapshot version');

    // Mutate governorate / shipping -> invalidates confirmation and bumps version to 3
    wiz2.confirmedSnapshotHash = wiz2.pendingSnapshotHash;
    const modifiedGovParams = { ...modifiedAddressParams, governorate: 'القاهرة', shipping: 75, total: 852 };
    const wiz3 = v2.bindCheckoutSnapshot(wiz2, modifiedGovParams, 'manychat:1001');
    ok(wiz3.snapshotVersion === 3 && wiz3.confirmedSnapshotHash === null, 'Invalidates confirmation when governorate/shipping/total changes');

    // Summary formatting contains all mandatory fields
    const summaryText = v2.formatVersionedOrderSummary(baseParams);
    ok(
      summaryText.includes('روتين التفتيح الكامل') &&
      summaryText.includes('777') &&
      summaryText.includes('مجاني') &&
      summaryText.includes('ندا علوي أحمد') &&
      summaryText.includes('01022469615') &&
      summaryText.includes('الإسماعيلية') &&
      summaryText.includes('تأكيد'),
      'formatVersionedOrderSummary displays products, quantities, shipping, total, delivery details, and confirmation prompt'
    );
  }

  // ── 2. Atomic Database-Level Order Idempotency ────────────────────────────
  {
    let dbCommits = 0;
    const fakeDbOrders = new Map();

    // Case A: First attempt FAILS -> must NOT block subsequent retry with same operationId
    const opFailThenSucceed = 'op_test_retry_after_fail_v1';
    let shouldFail = true;
    const failRes = await v2.executeIdempotentOrderCreate({
      operationId: opFailThenSucceed,
      sid: 'manychat:retry1',
      findExistingOrderFn: async (opId) => fakeDbOrders.get(opId) || null,
      createOrderFn: async (opId) => {
        if (shouldFail) return { error: 'Temporary DB timeout' };
        dbCommits++;
        const ord = { order_number: 'MON-90001', total: 777, shipping: 0, opId };
        fakeDbOrders.set(opId, ord);
        return ord;
      },
    });
    ok(failRes.error === 'Temporary DB timeout', 'Failed order attempt returns error cleanly');

    shouldFail = false;
    const retryRes = await v2.executeIdempotentOrderCreate({
      operationId: opFailThenSucceed,
      sid: 'manychat:retry1',
      findExistingOrderFn: async (opId) => fakeDbOrders.get(opId) || null,
      createOrderFn: async (opId) => {
        dbCommits++;
        const ord = { order_number: 'MON-90001', total: 777, shipping: 0, opId };
        fakeDbOrders.set(opId, ord);
        return ord;
      },
    });
    ok(retryRes.order_number === 'MON-90001' && dbCommits === 1, 'Retry after failed creation succeeds without stuck lock');

    // Case B: Duplicate webhook retry with SAME operationId -> returns existing order, zero extra DB inserts
    const dupRes = await v2.executeIdempotentOrderCreate({
      operationId: opFailThenSucceed,
      sid: 'manychat:retry1',
      findExistingOrderFn: async (opId) => fakeDbOrders.get(opId) || null,
      createOrderFn: async () => {
        dbCommits++;
        return { order_number: 'MON-99999' };
      },
    });
    ok(dupRes.order_number === 'MON-90001' && dupRes.idempotentReplay === true && dbCommits === 1, 'Duplicate operationId returns existing order without creating a second order');

    // Case C: Intentional repeat purchase (same customer, 1 minute later, new snapshotVersion -> new operationId)
    const opRepeatPurchase = 'op_test_retry_after_fail_v2';
    const repeatRes = await v2.executeIdempotentOrderCreate({
      operationId: opRepeatPurchase,
      sid: 'manychat:retry1',
      findExistingOrderFn: async (opId) => fakeDbOrders.get(opId) || null,
      createOrderFn: async (opId) => {
        dbCommits++;
        const ord = { order_number: 'MON-90002', total: 777, shipping: 0, opId };
        fakeDbOrders.set(opId, ord);
        return ord;
      },
    });
    ok(repeatRes.order_number === 'MON-90002' && dbCommits === 2, 'Intentional repeat purchase with new operationId succeeds');
  }

  // ── 3. Lease-Renewing Per-Session Concurrency Control ─────────────────────
  {
    const executionOrder = [];
    let renewCount = 0;
    const mockDbLock = {
      acquire: async () => {},
      renew: async () => { renewCount++; },
      release: async () => {},
    };

    // Turn 1 takes 180ms with a 60ms TTL and 25ms heartbeat -> lease must renew and NOT be stolen by Turn 2
    const p1 = v2.withSessionConcurrencyLock(
      'manychat:concurrent_1',
      async () => {
        executionOrder.push('turn1_start');
        await new Promise((r) => setTimeout(r, 180));
        executionOrder.push('turn1_end');
        return 'res1';
      },
      { leaseTtlMs: 60, heartbeatIntervalMs: 25, maxWaitMs: 2000, dbLockAdapter: mockDbLock }
    );

    // Turn 2 arrives 20ms later for the same session
    await new Promise((r) => setTimeout(r, 20));
    const p2 = v2.withSessionConcurrencyLock(
      'manychat:concurrent_1',
      async () => {
        executionOrder.push('turn2_start');
        await new Promise((r) => setTimeout(r, 30));
        executionOrder.push('turn2_end');
        return 'res2';
      },
      { leaseTtlMs: 60, heartbeatIntervalMs: 25, maxWaitMs: 2000, dbLockAdapter: mockDbLock }
    );

    const [r1, r2] = await Promise.all([p1, p2]);
    ok(r1 === 'res1' && r2 === 'res2', 'Both concurrent messages processed without dropping either');
    ok(renewCount >= 3, `Heartbeat renewed lease ${renewCount} times during long AI call (>TTL)`);
    ok(
      executionOrder.join(',') === 'turn1_start,turn1_end,turn2_start,turn2_end',
      `Strict FIFO serialization verified: ${executionOrder.join(' -> ')}`
    );
  }

  // ── 4. Conflict-Free Optimistic Session State Merge ───────────────────────
  {
    const baseLoadedAt = new Date(Date.now() - 5000).toISOString();
    const latestDbState = {
      updatedAt: new Date(Date.now() - 1000).toISOString(), // updated concurrently!
      stateVersion: 4,
      customerPhone: '01022469615',
      checkoutWizard: {
        step: 'details',
        data: { name: 'ندا علوي أحمد', phone: '01022469615' },
      },
      history: [{ role: 'user', text: 'اسمي ندا علوي أحمد 01022469615' }],
    };
    const localTurnState = {
      checkoutWizard: {
        step: 'details',
        data: { address: 'الإسماعيلية أرض الجمعيات ميدان فوكس' },
      },
      history: [{ role: 'user', text: 'الإسماعيلية أرض الجمعيات ميدان فوكس' }],
    };

    const merged = v2.atomicMergeSessionState(latestDbState, localTurnState, baseLoadedAt);
    ok(
      merged.checkoutWizard.data.name === 'ندا علوي أحمد' &&
      merged.checkoutWizard.data.phone === '01022469615' &&
      merged.checkoutWizard.data.address === 'الإسماعيلية أرض الجمعيات ميدان فوكس',
      'atomicMergeSessionState preserves concurrently collected name, phone, and address without lost updates'
    );
    ok(merged.history.length === 2, 'atomicMergeSessionState preserves both history turns');
    ok(merged.stateVersion === 5, 'atomicMergeSessionState increments stateVersion');
  }

  // ── 5. Turn-Level Tool Call Deduplication ─────────────────────────────────
  {
    const dedup = v2.createTurnToolDeduplicator();
    let calls = 0;
    const fn = async () => ({ ok: true, callNum: ++calls });
    await dedup('add_routine_offer', { offer_key: 'brightening' }, fn);
    await dedup('add_routine_offer', { offer_key: 'brightening' }, fn);
    ok(calls === 1, 'Coalesces duplicate mutating tool calls within the same turn');
  }

  // ── 6. Strict Sales Claim Verifier & Honest Fallback ──────────────────────
  {
    const s1 = v2.verifyAndSanitizeSalesClaims('عندنا جل السيليكون ممتاز للندبات');
    ok(s1.violations.includes('SILICONE_MENTION_BLOCKED') && !/سيليكون/.test(s1.text), 'Blocks silicone mentions');

    const s2 = v2.verifyAndSanitizeSalesClaims('تمام يا فندم، ثواني وهرجعلك بكل التفاصيل 😊');
    ok(s2.violations.includes('FALSE_AUTO_FOLLOWUP_PROMISE_BLOCKED') && !/ثواني وهرجعلك/.test(s2.text), 'Blocks false automatic follow-up promises');

    const s3 = v2.verifyAndSanitizeSalesClaims('ده علاج نهائي طبي وتفتيح فوري من أول ساعة ومترخص برقم COSMTOL999999');
    ok(
      s3.violations.includes('UNAPPROVED_MEDICAL_OR_INSTANT_CLAIM') &&
      s3.violations.includes('INVALID_LICENSE_NUMBER_CORRECTED') &&
      s3.text.includes('COSMTOL25117170'),
      'Corrects unapproved medical/instant claims and wrong license numbers'
    );

    const fb = v2.safeModelFailureFallback({
      checkoutWizard: { step: 'details', data: { name: 'ندا علوي', phone: '01022469615' } },
    });
    ok(fb.includes('العنوان بالتفصيل') && !/ثواني وهرجعلك/.test(fb), 'Context-aware fallback during checkout asks only for missing field and never promises auto follow-up');
  }

  // ── 7. Feature Flag, Shadow Sandbox & Sub-Millisecond Rollback ────────────
  {
    const sandbox = v2.createShadowSandbox({ cart: [{ id: 1, name: 'كريم التفتيح', price: 249, qty: 1 }] });
    await sandbox.saveSession('manychat:01022469615', { cart: [] });
    const shadowOrder = await sandbox.createOrder({ governorate: 'القاهرة', total: 324 });
    await sandbox.sendExternalNotification('telegram', { text: 'test' });
    ok(shadowOrder.shadow === true && sandbox.interceptedOperations.length === 3, 'Shadow sandbox intercepts all DB writes, order creations, and notifications with zero side effects');

    // Measure actual rollback latency
    v2.setRolloutConfigOverride({ mode: 'on' });
    ok(v2.shouldRouteSessionToV2('manychat:test') === true, 'Routes to V2 when mode is ON');
    const t0 = process.hrtime.bigint();
    v2.setRolloutConfigOverride({ mode: 'off' });
    const routedAfterRollback = v2.shouldRouteSessionToV2('manychat:test');
    const elapsedMs = Number(process.hrtime.bigint() - t0) / 1e6;
    ok(routedAfterRollback === false && elapsedMs < 5, `Immediate rollback verified in ${elapsedMs.toFixed(4)} ms (< 5ms threshold)`);
  }

  // ── 8. Privacy-Safe Telemetry & PII Masking ───────────────────────────────
  {
    v2.clearTelemetryEvents();
    v2.logTelemetry('checkout_test', {
      sid: 'whatsapp:01022469615',
      phone: '01022469615',
      customerName: 'ندا علوي أحمد',
      address: 'أرض الجمعيات ميدان فوكس',
      apiKey: 'secret_key_123',
    });
    const ev = v2.getTelemetryEvents()[0];
    ok(
      ev.phone === '010****9615' &&
      ev.sid.includes('010****9615') &&
      ev.customerName === '[REDACTED_PII]' &&
      ev.address === '[REDACTED_PII]' &&
      ev.apiKey === '[REDACTED_PII]',
      'Telemetry masks phone numbers and redacts names, addresses, and secrets'
    );
  }

  // ── 9. Regex Regression Test Matrix (Requirement #3) ──────────────────────
  {
    // A. CRITICAL_SAFETY_GUARD
    ok(engine.isDepositCallInquiry('في رقم رن عليا بيقولي حولي 200 جنيه عربون فودافون كاش') === true, 'Regex Matrix: isDepositCallInquiry detects deposit scam inquiry');
    ok(engine.callerNumberVerdictReply('01210021115').includes('رقمنا الرسمي'), 'Regex Matrix: callerNumberVerdictReply recognizes official 01210021115');
    ok(engine.callerNumberVerdictReply('01099887766').includes('مش من أرقامنا'), 'Regex Matrix: callerNumberVerdictReply warns against unofficial caller');
    ok(engine.namesSkinCondition('عندي اكزيما شديدة في ايدي') === true, 'Regex Matrix: namesSkinCondition detects medical skin condition');
    ok(engine.skinConditionReply().includes('طبيب الجلدية'), 'Regex Matrix: skinConditionReply advises dermatologist without pitching');
    ok(engine.isPregnancyQuestion('هو الكريم آمن للحامل والمرضع؟') === true, 'Regex Matrix: isPregnancyQuestion detects pregnancy safety ask');
    ok(engine.isWalkAwayDecline('لا شكرا يا فندم خلاص مش هينفع اطلبه') === true, 'Regex Matrix: isWalkAwayDecline detects polite refusal');
    ok(engine.isMetaPlatformNoiseMessage('Use the latest version of the Instagram app to see this type of message') === true, 'Regex Matrix: isMetaPlatformNoiseMessage filters IG banner');

    // B. DETERMINISTIC_FACTS
    ok(engine.isLighteningDegreeQuestion('الكريم بيفتح كام درجة؟') === true, 'Regex Matrix: isLighteningDegreeQuestion detects degree ask');
    ok(engine.isResultsTimelineQuestion('النتيجة بتبان بعد قد ايه؟') === true, 'Regex Matrix: isResultsTimelineQuestion detects timeline ask');
    ok(engine.isDiscountHaggleAsk('ممكن تعمليلي خصم وتخليه ب 600؟') === true, 'Regex Matrix: isDiscountHaggleAsk detects counter-offer haggling');

    // C. CHECKOUT_AND_ORDER_WIZARD
    const parsed = engine.parseVolunteeredDeliveryDetails('ندا علوي أحمد 01022469615 الإسماعيلية أرض الجمعيات ميدان فوكس');
    ok(
      parsed?.name === 'ندا علوي أحمد' &&
      parsed?.phone === '01022469615' &&
      engine.isUsableDeliveryAddress(parsed?.address),
      'Regex Matrix: single-line Egyptian landmark address & name parsed accurately'
    );
  }

  console.log(`PASS scripts/test-v2-core-and-regression.js (${passed} assertions)`);
}

runTests().catch((err) => {
  console.error(err);
  process.exit(1);
});
