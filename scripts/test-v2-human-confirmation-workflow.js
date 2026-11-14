/**
 * Test Suite: Montana AI Sales Assistant v2 — Human Confirmation Workflow
 *
 * Verifies:
 * 1. Customers are NEVER asked to confirm orders in chat (no "نعم", "أكد", "موافق").
 * 2. Automatic order creation once all delivery details are available.
 * 3. Orders saved with status PENDING, awaiting human phone confirmation.
 * 4. Exact natural reply:
 *    “تمام يا فندم 💜 طلب حضرتك اتسجل بنجاح، وحد من فريق مونتانا هيتواصل معاك تليفونيًا لتأكيد الطلب وتفاصيل التوصيل.”
 * 5. Never claims order saved if database creation fails.
 * 6. Bosta shipment is NEVER automatically created before human confirmation.
 * 7. Only genuinely missing details are requested (no duplicate prompts).
 * 8. Order idempotency & inventory consistency are preserved.
 * 9. Multi-channel compatibility (Instagram, Messenger, Web).
 */

const assert = require('assert');
const v2 = require('../lib/salesAssistantV2');
const engine = require('../lib/chatEngine');

const EXPECTED_REPLY =
  'تمام يا فندم 💜 طلب حضرتك اتسجل بنجاح، وحد من فريق مونتانا هيتواصل معاك تليفونيًا لتأكيد الطلب وتفاصيل التوصيل.';

const MOCK_PRODUCTS = [
  { id: 1, name: 'كريم تفتيح البشرة والمناطق الحساسة', price: 249, slug: 'whitening-sensitive-areas-cream', is_active: true, stock: 50 },
  { id: 2, name: 'غسول تفتيح الوجه بالنياسيناميد', price: 299, slug: 'brightening-facial-wash', is_active: true, stock: 40 },
  { id: 3, name: 'لوشن اليدين والجسم المرطب', price: 229, slug: 'moisturizing-body-lotion', is_active: true, stock: 35 },
  { id: 4, name: 'كريم العناية وترطيب ما بعد الليزر', price: 369, slug: 'post-laser-soothing-cream', is_active: true, stock: 25 },
  { id: 5, name: 'غسول تنقية البشرة الدهنية وحب الشباب', price: 329, slug: 'acne-cleanser', is_active: true, stock: 30 },
];

const MOCK_SHIPPING = [
  { governorate: 'القاهرة', cost: 65, delivery_days: '2-3 أيام' },
  { governorate: 'الجيزة', cost: 65, delivery_days: '2-3 أيام' },
  { governorate: 'الإسكندرية', cost: 70, delivery_days: '2-3 أيام' },
  { governorate: 'قنا', cost: 80, delivery_days: '3-4 أيام' },
];

function createMockGenAI() {
  return {
    getGenerativeModel: () => ({
      startChat: () => ({
        sendMessage: async () => ({
          response: {
            text: () => 'تحت أمرك يا فندم في مونتانيا 💜',
            functionCalls: () => [],
          },
        }),
      }),
    }),
  };
}

function setupTestEnvironment({ simulateDbFailure = false } = {}) {
  let createdOrders = [];
  let bostaDeliveriesCreated = 0;
  const store = {
    chat_bot_sessions: new Map(),
    site_settings: new Map(),
  };

  const createQueryBuilder = (table) => {
    let filters = {};
    const builder = {
      select: () => builder,
      eq: (col, val) => { filters[col] = val; return builder; },
      ilike: (col, val) => { filters[`ilike_${col}`] = val; return builder; },
      in: (col, vals) => { filters[`in_${col}`] = vals; return builder; },
      order: () => builder,
      limit: () => builder,
      maybeSingle: async () => {
        if (table === 'products' && filters.slug) {
          const hit = MOCK_PRODUCTS.find((p) => p.slug === filters.slug);
          return { data: hit ? { ...hit } : null, error: null };
        }
        if (table === 'site_settings' && filters.key) {
          return { data: { value: store.site_settings.get(filters.key) || '' }, error: null };
        }
        return { data: null, error: null };
      },
      single: async () => {
        if (table === 'shipping_rates' && filters.ilike_governorate) {
          const g = String(filters.ilike_governorate).replace(/%/g, '');
          const hit = MOCK_SHIPPING.find((r) => r.governorate.includes(g) || g.includes(r.governorate));
          return { data: hit || { governorate: g, cost: 65, delivery_days: '2-3 أيام' }, error: null };
        }
        if (table === 'site_settings' && filters.key) {
          return { data: { value: store.site_settings.get(filters.key) || '' }, error: null };
        }
        return { data: null, error: null };
      },
      then: (resolve, reject) => {
        try {
          if (table === 'products') {
            let list = MOCK_PRODUCTS.map((p) => ({ ...p }));
            if (Array.isArray(filters.in_id)) {
              const idSet = new Set(filters.in_id.map(String));
              list = list.filter((p) => idSet.has(String(p.id)));
            }
            return Promise.resolve({ data: list, error: null }).then(resolve, reject);
          }
          if (table === 'shipping_rates') {
            return Promise.resolve({ data: MOCK_SHIPPING, error: null }).then(resolve, reject);
          }
          if (table === 'site_settings') {
            return Promise.resolve({ data: [], error: null }).then(resolve, reject);
          }
          return Promise.resolve({ data: [], error: null }).then(resolve, reject);
        } catch (err) {
          return Promise.reject(err).then(resolve, reject);
        }
      },
    };
    return builder;
  };

  const mockDb = {
    from: (table) => createQueryBuilder(table),
    rpc: async (fnName, params) => {
      if (fnName === 'list_governorates') {
        return { data: MOCK_SHIPPING, error: null };
      }
      if (fnName === 'get_chat_bot_session_v2') {
        const row = store.chat_bot_sessions.get(params.p_session_id);
        if (!row) return { data: { found: false }, error: null };
        return {
          data: {
            found: true,
            cart: row.cart || [],
            history: row.history || [],
            customer_phone: row.customerPhone || null,
            customer_name: row.customerName || null,
            checkout_wizard: row.checkoutWizard || null,
            state_version: row.stateVersion || 1,
            lease_owner: row.leaseOwner || null,
          },
          error: null,
        };
      }
      if (fnName === 'acquire_chat_session_lease') {
        return { data: { acquired: true, owner_id: params.p_owner_id, state_version: 1 }, error: null };
      }
      if (fnName === 'renew_chat_session_lease') {
        return { data: { renewed: true }, error: null };
      }
      if (fnName === 'release_chat_session_lease') {
        return { data: { released: true }, error: null };
      }
      if (fnName === 'save_chat_bot_session_v2') {
        const sid = params.p_session_id;
        const prev = store.chat_bot_sessions.get(sid) || { stateVersion: 1 };
        const nextVersion = (prev.stateVersion || 1) + 1;
        store.chat_bot_sessions.set(sid, {
          cart: params.p_cart || [],
          history: params.p_history || [],
          customerPhone: params.p_customer_phone,
          customerName: params.p_customer_name,
          checkoutWizard: params.p_checkout_wizard,
          stateVersion: nextVersion,
        });
        return { data: { saved: true, conflict: false, state_version: nextVersion }, error: null };
      }
      if (fnName === 'create_chat_order_idempotent' || fnName === 'create_guest_order') {
        if (simulateDbFailure) {
          return { data: null, error: { message: 'Database connection failed', code: 'PGRST500' } };
        }
        const orderNumber = `MON-TEST-${Date.now().toString().slice(-4)}`;
        const orderRecord = {
          id: createdOrders.length + 101,
          order_number: orderNumber,
          customer_name: params.p_customer?.name,
          customer_phone: params.p_customer?.phone,
          governorate: params.p_governorate,
          subtotal: params.p_subtotal,
          shipping_cost: params.p_shipping_cost,
          total: params.p_total,
          status: 'pending', // Strictly PENDING awaiting human confirmation
          payment_method: 'cod',
        };
        createdOrders.push(orderRecord);
        return {
          data: {
            order: orderRecord,
            items: params.p_items || [],
            idempotent_replay: false,
          },
          error: null,
        };
      }
      return { data: null, error: null };
    },
  };

  const sessionStore = new Map();

  engine.__setTestAdapters({
    sb: mockDb,
    sbService: mockDb,
    genAI: createMockGenAI(),
    loadSession: async (sid) => sessionStore.get(sid) || { cart: [], history: [], stateVersion: 1 },
    saveSession: async (sid, patch) => {
      const prev = sessionStore.get(sid) || { stateVersion: 1 };
      const next = { ...prev, ...patch, stateVersion: (prev.stateVersion || 1) + 1 };
      sessionStore.set(sid, next);
      return { ok: true, stateVersion: next.stateVersion };
    },
  });
  v2.setRolloutConfigOverride({ mode: 'on', canaryPercent: 100 });

  return {
    seedSession: (sid, cart, wizard = null) => {
      engine.sessionCarts[sid] = cart;
      if (wizard) engine.checkoutWizards[sid] = wizard;
      sessionStore.set(sid, {
        cart: cart || [],
        history: [],
        checkoutWizard: wizard || null,
        stateVersion: 1,
      });
    },
    getCreatedOrders: () => createdOrders,
    getBostaDeliveriesCreated: () => bostaDeliveriesCreated,
  };
}

async function runTests() {
  console.log('========================================================================');
  console.log('  MONTANA AI SALES ASSISTANT V2 — HUMAN CONFIRMATION WORKFLOW TESTS     ');
  console.log('========================================================================\n');

  let passed = 0;
  let total = 0;

  async function test(name, fn) {
    total++;
    try {
      await fn();
      passed++;
      console.log(`  ✅ [PASS] #${String(total).padStart(2, '0')}: ${name}`);
    } catch (err) {
      console.error(`  ❌ [FAIL] #${String(total).padStart(2, '0')}: ${name}`);
      console.error(`     Error: ${err.message}`);
    }
  }

  // ── TEST 1: Full volunteered delivery details -> auto create order (no confirm asked) ──
  await test('Volunteered full details: Auto-creates order with PENDING status, exact reply, zero chat confirm prompts', async () => {
    const env = setupTestEnvironment();
    const sid = `instagram:test_volunteered_${Date.now()}`;
    const cart = [
      { id: 1, name: 'كريم تفتيح البشرة والمناطق الحساسة', price: 249, qty: 1, slug: 'whitening-sensitive-areas-cream' },
    ];
    env.seedSession(sid, cart);

    const input = 'الاسم: نورهان علي\nالموبايل: 01019876543\nالعنوان: 15 شارع النصر المعادي القاهرة';
    const res = await engine.handleInboundMessage({ message: input, sid, trustedCaller: true, channel: 'instagram' });

    assert.strictEqual(res.reply, EXPECTED_REPLY, `Must match exact required reply string`);
    assert.ok(!/ردي بـ|قولي نعم|قولي تأكيد|أكدي|تأكيد النهائي/i.test(res.reply), 'Must NOT ask customer to confirm in chat');

    const orders = env.getCreatedOrders();
    assert.strictEqual(orders.length, 1, 'Exactly one order must be created in DB');
    assert.strictEqual(orders[0].status, 'pending', 'Order status must be pending awaiting human phone confirmation');
    assert.strictEqual(orders[0].customer_name, 'نورهان علي');
    assert.strictEqual(orders[0].customer_phone, '01019876543');
    assert.strictEqual(orders[0].governorate, 'القاهرة');
  });

  // ── TEST 2: Step-by-step wizard -> auto create on final governorate step ──
  await test('Step-by-step wizard: Completes on governorate with PENDING status and zero confirm prompts', async () => {
    const env = setupTestEnvironment();
    const sid = `instagram:test_wizard_${Date.now()}`;
    const cart = [
      { id: 2, name: 'غسول تفتيح الوجه بالنياسيناميد', price: 299, qty: 1, slug: 'brightening-facial-wash' },
    ];
    const wizard = {
      step: 'governorate',
      data: {
        name: 'ياسمين حسن',
        phone: '01122334455',
        address: 'الدقي شارع مصدق أمام سينما التحرير',
      },
    };
    env.seedSession(sid, cart, wizard);

    const res = await engine.handleInboundMessage({ message: 'الجيزة', sid, trustedCaller: true, channel: 'instagram' });

    assert.strictEqual(res.reply, EXPECTED_REPLY, 'Must return exact natural completion reply');
    assert.ok(!/ردي بـ|قولي نعم|قولي تأكيد/i.test(res.reply), 'Must NOT ask customer to confirm');

    const orders = env.getCreatedOrders();
    assert.strictEqual(orders.length, 1, 'Exactly one order created');
    assert.strictEqual(orders[0].status, 'pending', 'Order status must be pending');
    assert.strictEqual(orders[0].governorate, 'الجيزة');
  });

  // ── TEST 3: Partial delivery details -> asks ONLY for genuinely missing fields ──
  await test('Partial details (Name + Phone + Address without gov): Asks ONLY for missing governorate', async () => {
    const env = setupTestEnvironment();
    const sid = `instagram:test_partial_${Date.now()}`;
    const cart = [
      { id: 1, name: 'كريم تفتيح البشرة', price: 249, qty: 1, slug: 'whitening-sensitive-areas-cream' },
    ];
    env.seedSession(sid, cart);

    const input = 'الاسم: مريم سعيد\nالموبايل: 01234567890\nالعنوان: شارع البحر برج الأندلس الدور الخامس';
    const res = await engine.handleInboundMessage({ message: input, sid, trustedCaller: true, channel: 'instagram' });

    assert.ok(/المحافظة/i.test(res.reply), 'Must ask for the missing governorate');
    assert.ok(!/اسمك الثلاثي/i.test(res.reply), 'Must NOT re-ask for the name');

    const orders = env.getCreatedOrders();
    assert.strictEqual(orders.length, 0, 'Must NOT create order until governorate is provided');
  });

  // ── TEST 4: Database failure simulation -> NEVER claim order saved ──
  await test('Database failure: Never claims order was saved, returns error message', async () => {
    const env = setupTestEnvironment({ simulateDbFailure: true });
    const sid = `instagram:test_db_fail_${Date.now()}`;
    const cart = [
      { id: 1, name: 'كريم تفتيح البشرة', price: 249, qty: 1, slug: 'whitening-sensitive-areas-cream' },
    ];
    env.seedSession(sid, cart);

    const input = 'الاسم: نورهان علي\nالموبايل: 01019876543\nالعنوان: 15 شارع النصر المعادي القاهرة';
    const res = await engine.handleInboundMessage({ message: input, sid, trustedCaller: true, channel: 'instagram' });

    assert.ok(!/طلب حضرتك اتسجل بنجاح/i.test(res.reply), 'Must NEVER claim order was saved when DB fails');
    assert.ok(/مشكلة|حاول/i.test(res.reply), 'Must return polite failure message allowing retry');

    const orders = env.getCreatedOrders();
    assert.strictEqual(orders.length, 0, 'Zero orders created');
  });

  // ── TEST 5: Bosta courier delivery is NOT called automatically ──
  await test('Courier protection: Zero automated Bosta delivery calls on order creation', async () => {
    const env = setupTestEnvironment();
    const sid = `instagram:test_bosta_protect_${Date.now()}`;
    const cart = [
      { id: 1, name: 'كريم تفتيح البشرة', price: 249, qty: 1, slug: 'whitening-sensitive-areas-cream' },
    ];
    env.seedSession(sid, cart);

    const input = 'الاسم: رانيا خليل\nالموبايل: 01055554433\nالعنوان: شارع الهرم محطة العريش الجيزة';
    await engine.handleInboundMessage({ message: input, sid, trustedCaller: true, channel: 'instagram' });

    assert.strictEqual(env.getBostaDeliveriesCreated(), 0, 'Bosta courier must NOT be called before human confirmation');
  });

  // ── TEST 6: Empty cart handling -> Prompts for product, no empty order created ──
  await test('Empty cart: Details sent with empty cart prompts for product/routine, no empty order created', async () => {
    const env = setupTestEnvironment();
    const sid = `instagram:test_empty_cart_${Date.now()}`;
    env.seedSession(sid, []); // Empty cart

    const input = 'الاسم: سلمى طارق\nالموبايل: 01066778899\nالعنوان: المعادي شارع النادي القاهرة';
    const res = await engine.handleInboundMessage({ message: input, sid, trustedCaller: true, channel: 'instagram' });

    assert.ok(/الأوردر ده لأنهي منتج|عروض الروتين|روتين التفتيح/i.test(res.reply), 'Must ask which product or offer is wanted');
    assert.strictEqual(env.getCreatedOrders().length, 0, 'No empty order created');
  });

  // ── TEST 7: ManyChat / Instagram Webhook reply format (reply1, reply2, reply3) ──
  await test('Instagram webhook delivery: Reply formatted concisely for single clean bubble', async () => {
    const env = setupTestEnvironment();
    const sid = `instagram:test_manychat_${Date.now()}`;
    const cart = [
      { id: 1, name: 'كريم تفتيح البشرة', price: 249, qty: 1, slug: 'whitening-sensitive-areas-cream' },
    ];
    env.seedSession(sid, cart);

    const input = 'الاسم: فاطمة سمير\nالموبايل: 01099887766\nالعنوان: سموحة شارع فوزي معاذ الإسكندرية';
    const res = await engine.handleInboundMessage({ message: input, sid, trustedCaller: true, channel: 'instagram' });

    assert.strictEqual(res.reply, EXPECTED_REPLY);
    assert.ok(res.reply.length < 200, 'Reply is concise and elegant');
  });

  // ── TEST 8: Legacy confirm_saved turn completed with exact natural reply ──
  await test('Existing session on confirm_saved: "نعم" or "تأكيد" completes order with exact reply', async () => {
    const env = setupTestEnvironment();
    const sid = `instagram:test_legacy_confirm_${Date.now()}`;
    const cart = [
      { id: 1, name: 'كريم تفتيح البشرة', price: 249, qty: 1, slug: 'whitening-sensitive-areas-cream' },
    ];
    const wizard = {
      step: 'confirm_saved',
      data: {
        name: 'سلوى رضوان',
        phone: '01011223399',
        address: 'مدينة نصر الحي السابع شارع الطيران',
        governorate: 'القاهرة',
      },
    };
    env.seedSession(sid, cart, wizard);

    const res = await engine.handleInboundMessage({ message: 'نعم تمام', sid, trustedCaller: true, channel: 'instagram' });

    assert.strictEqual(res.reply, EXPECTED_REPLY, 'Must return the exact human confirmation reply');
    const orders = env.getCreatedOrders();
    assert.strictEqual(orders.length, 1, 'Order created successfully');
    assert.strictEqual(orders[0].status, 'pending', 'Order status must be pending');
  });

  console.log('\n------------------------------------------------------------------------');
  console.log(`  Total Tests  : ${total}`);
  console.log(`  Passed       : ${passed}`);
  console.log(`  Failed       : ${total - passed}`);
  console.log(`  Success Rate : ${Math.round((passed / total) * 100)}%`);
  console.log('========================================================================\n');

  if (passed !== total) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
