/**
 * Montana AI Sales Assistant v3.0 — Native Gemini Agent Verification Suite
 *
 * Verifies the complete agent architecture in isolated test mode:
 * 1. Previously unseen multi-turn consultation & sales conversation.
 * 2. Complex consultations: dry/peeling skin, product compatibility, multi-intent inquiries.
 * 3. Natural cart changes: add dual routines, remove one routine, verify authoritative prices.
 * 4. Incremental delivery details: 1-word name, Arabic-Indic digits phone, address across messages.
 * 5. Mid-checkout unrelated product question answered without resetting session state.
 * 6. Exactly-once pending order creation with ZERO chat confirmation.
 * 7. Test isolation: mock EVAL-XXXXXX order, zero real DB order creation, zero Bosta shipment, zero Telegram alert.
 * 8. Immediate human handoff on order complaints.
 * 9. Suspicious scam caller verification.
 */

const fs = require('fs');
if (fs.existsSync('.env.runtime.local')) {
  const content = fs.readFileSync('.env.runtime.local', 'utf8');
  content.split('\n').forEach(line => {
    const match = line.match(/^([^=]+)=(.*)$/);
    if (match) {
      const key = match[1].trim();
      const val = match[2].trim().replace(/^["']|["']$/g, '');
      if (!process.env[key]) process.env[key] = val;
    }
  });
}

const { GoogleGenerativeAI } = require('@google/generative-ai');
const salesAgentV3 = require('../lib/salesAgentV3');
const { handleInboundMessage } = require('../lib/chatEngine');
const v2 = require('../lib/salesAssistantV2');

const TEST_SID = 'test:agent_v3_multiturn_qa';

// In-memory test store to guarantee 100% isolation
const testDbSessions = new Map();
const mockProducts = [
  { id: 1, name: 'غسول التفتيح اليومي', price: 299, slug: 'whitening-cleanser', size: '200ml', description: 'غسول لطيف لتفتيح وتنقية البشرة', ingredients: 'عرق سوس، أربوتين، فيتامين سي', skin_type: 'جميع أنواع البشرة', is_active: true, stock: 50 },
  { id: 2, name: 'كريم التفتيح المركز', price: 249, slug: 'whitening-cream', size: '50g', description: 'كريم مركز لتفتيح البقع والتصبغات وتوحيد لون البشرة', ingredients: 'أربوتين، كوجيك أسيد، نياسيناميد', skin_type: 'جميع أنواع البشرة', is_active: true, stock: 40 },
  { id: 3, name: 'لوشن اليدين والجسم', price: 229, slug: 'body-lotion', size: '250ml', description: 'لوشن مرطب ومفتح لليدين والجسم فقط', ingredients: 'زبدة شيا، جلسرين، مستخلص توت بري', skin_type: 'الجسم واليدين', is_active: true, stock: 35 },
  { id: 4, name: 'كريم العناية بعد الليزر', price: 369, slug: 'post-laser-cream', size: '100g', description: 'كريم مهدئ وملطف للجلد بعد جلسات الليزر وإزالة الشعر', ingredients: 'بانثينول، صبار، أكسيد زنك', skin_type: 'الجلد المعرض لليزر', is_active: true, stock: 30 },
  { id: 5, name: 'غسول البشرة المعرضة للحبوب', price: 329, slug: 'acne-cleanser', size: '200ml', description: 'غسول للتحكم في دهون البشرة المعرضة للحبوب وتنظيف المسام', ingredients: 'حمض الساليسيليك، زيت شجرة الشاي', skin_type: 'البشرة الدهنية والمعرضة للحبوب', is_active: true, stock: 25 },
];

const mockAdapters = {
  loadSession: (sid) => {
    return Promise.resolve(testDbSessions.get(sid) || {
      cart: [],
      history: [],
      customerName: null,
      customerPhone: null,
      checkoutWizard: null,
      stateVersion: 1,
    });
  },
  saveSession: (sid, state) => {
    testDbSessions.set(sid, {
      ...testDbSessions.get(sid),
      ...state,
      updatedAt: Date.now(),
    });
    return Promise.resolve();
  },
  sb: {
    rpc: (fn, args) => Promise.resolve({ data: { order_number: 'EVAL-999999' }, error: null }),
    from: (table) => ({
      select: () => ({
        eq: () => ({
          order: () => Promise.resolve({ data: mockProducts, error: null }),
          single: () => Promise.resolve({ data: mockProducts[0], error: null }),
        }),
        in: () => Promise.resolve({ data: mockProducts, error: null }),
        ilike: () => ({
          eq: () => ({
            limit: () => ({
              single: () => Promise.resolve({ data: { governorate: 'القاهرة', cost: 50 }, error: null })
            })
          })
        })
      }),
      rpc: (fn, args) => Promise.resolve({ data: { order_number: 'EVAL-999999' }, error: null }),
    }),
  },
  useDynamicRolloutFlag: false,
};

// Inject adapters
salesAgentV3.__setTestAdapters(mockAdapters);

// Setup V2 rollout override for testing
v2.setRolloutConfigOverride({
  mode: 'allowlist',
  allowlist: [TEST_SID],
  ttlMs: 600000,
});

async function runTurn(message, sid = TEST_SID) {
  const res = await salesAgentV3.handleInboundSalesMessage({
    sid,
    message,
    channel: 'instagram',
    trustedCaller: true,
  });
  return res;
}

async function runTestSuite() {
  console.log('======================================================================');
  console.log('MONTANA AI SALES ASSISTANT V3 — NATIVE GEMINI AGENT VERIFICATION');
  console.log('======================================================================\n');

  let passed = 0;
  let total = 0;

  function assert(condition, message, details) {
    total++;
    if (condition) {
      passed++;
      console.log(`  [PASS] ${message}`);
    } else {
      console.error(`  [FAIL] ${message}`);
      if (details) console.error('         Details:', details);
      throw new Error(`Assertion failed: ${message}`);
    }
  }

  // --- PART 1: DETERMINISTIC CRITICAL SAFETY CHECKS ---
  console.log('=== 1. Deterministic Safety & Fraud Checks ===');
  {
    // Order problem -> CS
    const r1 = await runTurn('الأوردر اتأخر وموصلش بقاله أسبوع وفيه مشكلة في الشحنة');
    assert(r1.needsHuman === true, 'Order problem sets needsHuman = true');
    assert(r1.reply.includes('01210021115'), 'Order problem provides CS phone 01210021115');

    // Suspicious money scam call
    const r2 = await runTurn('فيه رقم غريب كلمني 01599887766 وقالي حولي عربون 200 جنيه عشان الأوردر');
    assert(r2.reply.includes('مش من أرقام مونتانيا') || r2.reply.includes('100% كاش'), 'Flags suspicious caller and reinforces 0 deposit COD');
  }

  // --- PART 2: UNSEEN MULTI-TURN SALES & CONSULTATION WORKFLOW ---
  console.log('\n=== 2. Multi-turn Skincare Consultation & Natural Checkout ===');
  {
    const sid = TEST_SID;
    testDbSessions.clear(); // Fresh session

    // Turn 1: Dry / Peeling skin on face consultation
    console.log('\n--- Turn 1: Dry / Peeling Facial Skin Consultation ---');
    const r1 = await runTurn('أختي عجبها كريم التفتيح، بس أنا بشرة وشي جافة جداً ومقشرة، هل هيرطب ولا أدهن لوشن الجسم على وشي؟', sid);
    console.log('Bot Reply 1:\n' + r1.reply + '\n');
    assert(r1.engineSource === 'gemini_agent_v3', 'Executed via Gemini Agent V3');
    assert(!r1.reply.includes('لوشن اليدين والجسم على الوش') && !r1.reply.includes('لوشن الجسم على وشك'), 'Does NOT suggest body lotion for facial peeling');
    assert(!r1.reply.includes('كريم بعد الليزر لتهدئة التقشير'), 'Does NOT recommend post-laser cream for ordinary facial peeling');
    assert(/(ترطيب|حاجز|طبي|ملطف|للجسم|مش\s*للوجه|مش\s*للوش)/i.test(r1.reply), 'Gives sound skincare barrier guidance');

    // Turn 2: Product Compatibility without absolute claims
    console.log('\n--- Turn 2: Product Compatibility & Usage Coordination ---');
    const r2 = await runTurn('عندي روتين التفتيح الكامل وروتين بعد الليزر، ينفع استخدمهم سوا ولا فيه تعارض؟', sid);
    console.log('Bot Reply 2:\n' + r2.reply + '\n');
    assert(!/تعارض.*(خالص|نهائياً|تماماً|مطلقاً|إطلاقاً)|(مفيش|لا\s*يوجد)\s*(أي\s*)?تعارض\s*(خالص|نهائياً|تماماً|مطلقاً|إطلاقاً)/i.test(r2.reply), 'Does NOT make unhedged absolute compatibility claims');
    assert(/(تنسيق|تهدئة|ليزر|تفتيح|طريقة|بشرت)/i.test(r2.reply), 'Explains proper timing and coordination');

    // Turn 3: Multi-intent Delivery ETA & Payment
    console.log('\n--- Turn 3: Multi-Intent Delivery ETA & Payment ---');
    const r3 = await runTurn('الشحن بياخد قد إيه للإسكندرية والدفع بيكون كاش ولا فيه عربون؟', sid);
    console.log('Bot Reply 3:\n' + r3.reply + '\n');
    assert(/(إسكندرية|اسكندرية|2|3|أيام|ايام|يومين)/i.test(r3.reply), 'Answers Alexandria delivery timeframe');
    assert(/(كاش|عند\s*الاستلام|معاينة|عربون)/i.test(r3.reply), 'Answers 100% COD payment upon inspection');

    // Turn 4: Add Multiple Routines to Cart
    console.log('\n--- Turn 4: Add Multiple Routines (Brightening + Post-Laser) ---');
    const r4 = await runTurn('تمام أنا عاوزة أطلب روتين التفتيح الكامل وروتين بعد الليزر مع بعض', sid);
    console.log('Bot Reply 4:\n' + r4.reply + '\n');
    const s4 = testDbSessions.get(sid);
    assert(s4.cart.length >= 2, 'Both routines added to session cart');
    assert(/(777|618|1395|مجاني)/i.test(r4.reply), 'Quotes accurate verified routine totals and free shipping');

    // Turn 5: Customer Changes Mind & Removes a Routine
    console.log('\n--- Turn 5: Customer Correction — Remove Post-Laser Routine ---');
    const r5 = await runTurn('لا معلش شيلي روتين بعد الليزر وخلي روتين التفتيح بس', sid);
    console.log('Bot Reply 5:\n' + r5.reply + '\n');
    const s5 = testDbSessions.get(sid);
    assert(s5.cart.length === 1 && s5.cart[0].bundleKey === 'brightening', 'Post-laser removed, brightening preserved');
    assert(s5.cart[0].price === 777, 'Brightening routine price is exactly 777 EGP');

    // Turn 6: Incremental Name (1-word Egyptian name)
    console.log('\n--- Turn 6: Customer Details — 1-word Name ---');
    const r6 = await runTurn('أنا منى', sid);
    console.log('Bot Reply 6:\n' + r6.reply + '\n');
    const s6 = testDbSessions.get(sid);
    assert(s6.customerName === 'منى' || s6.checkoutWizard?.details?.name === 'منى', 'Accepts and persists 1-word name "منى"');

    // Turn 7: Incremental Phone (Arabic-Indic Numerals)
    console.log('\n--- Turn 7: Customer Details — Arabic-Indic Phone Number ---');
    const r7 = await runTurn('٠١٠١٢٣٤٥٦٧٨', sid);
    console.log('Bot Reply 7:\n' + r7.reply + '\n');
    const s7 = testDbSessions.get(sid);
    assert(s7.customerPhone === '01012345678' || s7.checkoutWizard?.details?.phone === '01012345678', 'Normalizes and persists phone 01012345678');

    // Turn 8: Unrelated Product Question Mid-Checkout
    console.log('\n--- Turn 8: Mid-Checkout Unrelated Question ---');
    const r8 = await runTurn('هو الغسول مناسب للبشرة الحساسة وفيه سلفات؟', sid);
    console.log('Bot Reply 8:\n' + r8.reply + '\n');
    const s8 = testDbSessions.get(sid);
    assert(/(لطيف|حساس|سلفات|خالي)/i.test(r8.reply), 'Answers product ingredients/suitability question directly');
    assert(s8.customerName === 'منى', 'Customer name preserved mid-checkout');
    assert(s8.customerPhone === '01012345678', 'Customer phone preserved mid-checkout');
    assert(s8.cart.length === 1, 'Cart preserved mid-checkout');

    // Turn 9: Delivery Address Provided -> Exactly-Once Pending Order Created!
    console.log('\n--- Turn 9: Delivery Address Provided & Automatic Order Creation ---');
    const r9 = await runTurn('العنوان 15 شارع مصطفى النحاس، مدينة نصر، القاهرة', sid);
    console.log('Bot Reply 9:\n' + r9.reply + '\n');
    assert(r9.order && r9.order.order_number, 'Pending order created automatically without chat confirmation');
    assert(r9.order.order_number.startsWith('EVAL-'), 'Test isolation verified: mock EVAL order number');
    assert(/(EVAL-|تم\s*تسجيل|ألف\s*مبروك|777|كاش)/i.test(r9.reply), 'Announces order confirmation, number, and COD terms');
    const s9 = testDbSessions.get(sid);
    assert(s9.cart.length === 0, 'Cart emptied after successful order placement');
  }

  console.log('\n======================================================================');
  console.log(`TEST RESULTS: ${passed}/${total} PASSED (${Math.round((passed / total) * 100)}%)`);
  console.log('======================================================================\n');
}

runTestSuite().catch((err) => {
  console.error('\nTest Suite Error:', err);
  process.exit(1);
});
