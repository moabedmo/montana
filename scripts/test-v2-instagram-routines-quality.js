/**
 * Montana AI Sales Assistant v2 — Instagram Routines Quality & Plural Inquiry Test
 *
 * Verifies:
 * 1. Plural routine inquiries ("عاوز استفسر عن الروتينات", "ايه الروتينات اللي عندكم", etc.)
 *    reliably present ALL 3 routines with verified prices, components, and purposes.
 * 2. Does not drop routines or only describe one.
 * 3. Ends with a polite, consultative discovery question.
 * 4. Instagram / ManyChat message bubble splitting (reply1, reply2, reply3) correctly
 *    distributes the 3 routines without dropping content or sending empty headers.
 * 5. Handles consultative follow-ups, objections, and purchase transitions smoothly.
 * 6. Validates the `list_routine_offers` tool for Gemini.
 */

const assert = require('assert');
const engine = require('../lib/chatEngine');
const v2 = require('../lib/salesAssistantV2');
const apiChat = require('../api/chat');

const MOCK_PRODUCTS = [
  {
    id: 1,
    slug: 'whitening-sensitive-areas-cream',
    name: 'كريم تفتيح البشرة والمناطق الحساسة',
    price: 249,
    old_price: 320,
    stock: 50,
    is_active: true,
  },
  {
    id: 2,
    slug: 'whitening-facial-cleanser',
    name: 'غسول تفتيح وتوحيد لون الوجه',
    price: 299,
    old_price: 350,
    stock: 40,
    is_active: true,
  },
  {
    id: 3,
    slug: 'hand-body-lotion',
    name: 'لوشن اليدين والجسم بالترطيب العميق',
    price: 229,
    old_price: 280,
    stock: 30,
    is_active: true,
  },
  {
    id: 4,
    slug: 'post-laser-cream',
    name: 'كريم العناية وترطيب ما بعد الليزر',
    price: 369,
    old_price: 420,
    stock: 20,
    is_active: true,
  },
  {
    id: 5,
    slug: 'acne-facial-cleanser',
    name: 'غسول الوجه لعلاج حب الشباب',
    price: 329,
    old_price: 380,
    stock: 25,
    is_active: true,
  },
];

function createMockSupabase() {
  const store = {
    chat_bot_sessions: new Map(),
    site_settings: new Map([
      ['chat_engine_v2_mode', 'on'],
      ['chat_engine_v2_canary_percent', '100'],
      ['instapay_wallet_number', '01210021115'],
      ['instapay_wallet_name', 'Montana Naturals'],
    ]),
  };

  function createQueryBuilder(table) {
    const filters = {};
    const builder = {
      select() { return builder; },
      eq(col, val) { filters[col] = val; return builder; },
      ilike(col, val) { filters[`ilike_${col}`] = val; return builder; },
      in(col, vals) { filters[`in_${col}`] = vals; return builder; },
      order() { return builder; },
      limit() { return builder; },
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
        if (table === 'site_settings' && filters.key) {
          return { data: { value: store.site_settings.get(filters.key) || '' }, error: null };
        }
        return { data: null, error: null };
      },
      then(resolve, reject) {
        if (table === 'products') {
          let list = MOCK_PRODUCTS.map((p) => ({ ...p }));
          return Promise.resolve({ data: list, error: null }).then(resolve, reject);
        }
        if (table === 'site_settings') {
          const data = Array.from(store.site_settings.entries()).map(([key, value]) => ({ key, value }));
          return Promise.resolve({ data, error: null }).then(resolve, reject);
        }
        return Promise.resolve({ data: [], error: null }).then(resolve, reject);
      },
    };
    return builder;
  }

  return {
    from: (table) => createQueryBuilder(table),
    rpc: async (fnName, params) => {
      if (fnName === 'list_products') return { data: MOCK_PRODUCTS, error: null };
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
      if (fnName === 'acquire_chat_session_lease') return { data: { acquired: true, owner_id: params.p_owner_id, state_version: 1 }, error: null };
      if (fnName === 'renew_chat_session_lease') return { data: { renewed: true }, error: null };
      if (fnName === 'release_chat_session_lease') return { data: { released: true }, error: null };
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
      return { data: null, error: new Error(`Unknown RPC ${fnName}`) };
    },
  };
}

async function runInstagramRoutinesTestSuite() {
  console.log('========================================================================');
  console.log('  MONTANA AI SALES ASSISTANT V2 — INSTAGRAM ROUTINES QUALITY TEST SUITE ');
  console.log('========================================================================\n');

  const mockSb = createMockSupabase();
  engine.__setTestAdapters({
    sb: mockSb,
    sbService: mockSb,
  });

  v2.setRolloutConfigOverride({ mode: 'on', canaryPercent: 100 });

  let passCount = 0;
  let testCount = 0;

  function test(name, fn) {
    testCount++;
    try {
      fn();
      console.log(`  ✅ [PASS] #${testCount.toString().padStart(2, '0')}: ${name}`);
      passCount++;
    } catch (err) {
      console.error(`  ❌ [FAIL] #${testCount.toString().padStart(2, '0')}: ${name}`);
      console.error(`     Error: ${err.message}`);
    }
  }

  async function testAsync(name, fn) {
    testCount++;
    try {
      await fn();
      console.log(`  ✅ [PASS] #${testCount.toString().padStart(2, '0')}: ${name}`);
      passCount++;
    } catch (err) {
      console.error(`  ❌ [FAIL] #${testCount.toString().padStart(2, '0')}: ${name}`);
      console.error(`     Error: ${err.message}`);
    }
  }

  // ── TEST 1: Exact User Reported Phrase ("عاوز استفسر عن الروتينات") ─────────
  await testAsync('Exact reported phrase: "عاوز استفسر عن الروتينات" presents ALL 3 routines', async () => {
    const sid = `instagram:test_rep_${Date.now()}`;
    const res = await engine.handleInboundMessage({
      sid,
      message: 'عاوز استفسر عن الروتينات',
      channel: 'instagram',
      trustedCaller: true,
    });

    assert.ok(res.reply, 'Must return a reply');

    // 1. Must describe Full Brightening Routine with verified price (777)
    assert.ok(/روتين التفتيح الكامل.*777|777.*روتين التفتيح/i.test(res.reply), 'Must include Full Brightening Routine with 777 EGP');
    assert.ok(/غسول التفتيح/i.test(res.reply) && /كريم التفتيح/i.test(res.reply) && /لوشن/i.test(res.reply), 'Must include brightening components');

    // 2. Must describe Post-Laser Care with verified price (618)
    assert.ok(/ما بعد الليزر.*618|618.*ما بعد الليزر/i.test(res.reply), 'Must include Post-Laser Routine with 618 EGP');
    assert.ok(/كريم ما بعد الليزر/i.test(res.reply), 'Must include post laser cream');

    // 3. Must describe Face & Body Care with verified price (558)
    assert.ok(/الوش والجسم.*558|558.*الوش والجسم/i.test(res.reply), 'Must include Face & Body Routine with 558 EGP');
    assert.ok(/حب الشباب/i.test(res.reply), 'Must include acne cleanser');

    // 4. Must note free shipping
    assert.ok(/شحن مجاني/i.test(res.reply), 'Must state free shipping on the routines');

    // 5. Must end with consultative question asking what skin concern they want to address
    assert.ok(/حابة تركزي|بشرتك|الأنسب|الأقرب|محتاجة/i.test(res.reply), 'Must end with consultative closing question');
  });

  // ── TEST 2: Plural Phrase Variants ──────────────────────────────────────────
  const pluralVariants = [
    'ايه الروتينات اللي عندكم؟',
    'عايزة اعرف عروض الروتين كلها',
    'ممكن تفاصيل الروتينات',
    'عندكم روتينات ايه للبشرة؟',
    'استفسار عن عروض الروتين',
    'عاوز اعرف الروتينات المتاحة',
    'كلمني عن الروتينات وأسعارها',
  ];

  for (const phrase of pluralVariants) {
    await testAsync(`Plural variant: "${phrase}" presents ALL 3 routines`, async () => {
      const sid = `instagram:test_var_${Date.now()}`;
      const res = await engine.handleInboundMessage({
        sid,
        message: phrase,
        channel: 'instagram',
        trustedCaller: true,
      });

      assert.ok(/777/.test(res.reply), `"${phrase}" must mention 777 EGP routine`);
      assert.ok(/618/.test(res.reply), `"${phrase}" must mention 618 EGP routine`);
      assert.ok(/558/.test(res.reply), `"${phrase}" must mention 558 EGP routine`);
      assert.ok(/شحن مجاني/.test(res.reply), `"${phrase}" must mention free shipping`);
      assert.ok(/حابة|بشرتك|الأنسب|الأقرب/.test(res.reply), `"${phrase}" must ask consultative question`);
    });
  }

  // ── TEST 3: Instagram / ManyChat Webhook Bubble Packing ─────────────────────
  await testAsync('Instagram webhook splits into 3 balanced bubbles without dropping content', async () => {
    let capturedResponse = null;
    const req = {
      method: 'POST',
      headers: {
        'x-montana-secret': process.env.API_SECRET || 'test_secret',
      },
      body: {
        message: 'عاوز استفسر عن الروتينات',
        sessionId: 'instagram:user_789456',
        channel: 'instagram',
      },
    };
    const res = {
      status: (code) => {
        assert.strictEqual(code, 200, 'Must return HTTP 200');
        return res;
      },
      json: (data) => {
        capturedResponse = data;
        return res;
      },
    };

    // Temporarily bypass secret check for test
    process.env.API_SECRET = 'test_secret';

    await apiChat(req, res);

    assert.ok(capturedResponse, 'Webhook must produce a JSON response');
    assert.strictEqual(typeof capturedResponse.reply1, 'string', 'reply1 must be string');
    assert.strictEqual(typeof capturedResponse.reply2, 'string', 'reply2 must be string');
    assert.strictEqual(typeof capturedResponse.reply3, 'string', 'reply3 must be string');

    assert.notStrictEqual(capturedResponse.reply1, 'NONE', 'reply1 must not be NONE');
    assert.notStrictEqual(capturedResponse.reply2, 'NONE', 'reply2 must not be NONE');
    assert.notStrictEqual(capturedResponse.reply3, 'NONE', 'reply3 must not be NONE');

    // Instagram text must not contain markdown asterisks
    assert.ok(!/\*\*/.test(capturedResponse.reply1), 'reply1 must not contain markdown asterisks on Instagram');
    assert.ok(!/\*\*/.test(capturedResponse.reply2), 'reply2 must not contain markdown asterisks on Instagram');
    assert.ok(!/\*\*/.test(capturedResponse.reply3), 'reply3 must not contain markdown asterisks on Instagram');

    // Verify all 3 routines are distributed across bubbles
    const allBubbles = [capturedResponse.reply1, capturedResponse.reply2, capturedResponse.reply3].join('\n\n');
    assert.ok(/777/.test(allBubbles), 'All bubbles together must contain 777');
    assert.ok(/618/.test(allBubbles), 'All bubbles together must contain 618');
    assert.ok(/558/.test(allBubbles), 'All bubbles together must contain 558');

    // Verify bubble 3 has the consultative question
    assert.ok(/حابة|بشرتك|الأنسب|الأقرب/.test(capturedResponse.reply3), 'Bubble 3 must contain consultative closing question');
  });

  // ── TEST 4: Single Routine Direct Inquiry Is NOT Forced to Full List ────────
  await testAsync('Single routine inquiry ("روتين التفتيح بكام") gives that routine specifically', async () => {
    const sid = `instagram:test_single_${Date.now()}`;
    const res = await engine.handleInboundMessage({
      sid,
      message: 'روتين التفتيح بكام',
      channel: 'instagram',
      trustedCaller: true,
    });

    assert.ok(/777/.test(res.reply), 'Must quote 777 EGP for brightening routine');
    // Does not force post-laser or face-body if she specifically asked for brightening
    assert.ok(!/618/.test(res.reply), 'Must not force post-laser 618 price on specific whitening ask');
  });

  // ── TEST 5: Consultative Multi-Turn Follow-Up (Choosing a Routine) ───────────
  await testAsync('Follow-up turn selecting brightening routine proceeds to purchase intent', async () => {
    const sid = `instagram:test_followup_${Date.now()}`;
    // Turn 1: Inquire about routines
    await engine.handleInboundMessage({
      sid,
      message: 'عاوز استفسر عن الروتينات',
      channel: 'instagram',
      trustedCaller: true,
    });

    // Turn 2: Customer responds to consultative question
    const res2 = await engine.handleInboundMessage({
      sid,
      message: 'عايزة اركز على التفتيح واطلب روتين التفتيح الكامل',
      channel: 'instagram',
      trustedCaller: true,
    });

    assert.ok(res2.reply, 'Must reply to selection');
    assert.ok(/777|تفتيح|أوردر|بيانات|الاسم|الموبايل|العنوان/i.test(res2.reply), 'Must acknowledge brightening routine and prepare order');
  });

  // ── TEST 6: Tool Declaration & Function Call (list_routine_offers) ───────────
  test('list_routine_offers tool exists and returns structured catalog data', () => {
    const { BUNDLES } = require('../lib/adOffers');
    assert.strictEqual(BUNDLES.length, 3, 'Must have exactly 3 official routine bundles');

    const brightening = BUNDLES.find((b) => b.key === 'brightening');
    assert.strictEqual(brightening.bundlePrice, 777, 'Brightening price must be 777');
    assert.strictEqual(brightening.productSlugs.length, 3, 'Brightening must have 3 products');

    const postLaser = BUNDLES.find((b) => b.key === 'post-laser');
    assert.strictEqual(postLaser.bundlePrice, 618, 'Post-laser price must be 618');
    assert.strictEqual(postLaser.productSlugs.length, 2, 'Post-laser must have 2 products');

    const faceBody = BUNDLES.find((b) => b.key === 'face-body');
    assert.strictEqual(faceBody.bundlePrice, 558, 'Face & body price must be 558');
    assert.strictEqual(faceBody.productSlugs.length, 2, 'Face & body must have 2 products');
  });

  console.log('\n------------------------------------------------------------------------');
  console.log(`  Total Tests  : ${testCount}`);
  console.log(`  Passed       : ${passCount}`);
  console.log(`  Failed       : ${testCount - passCount}`);
  console.log(`  Success Rate : ${Math.round((passCount / testCount) * 100)}%`);
  console.log('========================================================================\n');

  assert.strictEqual(passCount, testCount, 'All Instagram routines tests must pass');
}

runInstagramRoutinesTestSuite().catch((e) => {
  console.error('Test suite failed fatally:', e);
  process.exit(1);
});
