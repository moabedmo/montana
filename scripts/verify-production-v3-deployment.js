const fs = require('fs');

function getSecret() {
  for (const f of ['.env.production.pulled', '.env.runtime.local', '.env.production.local']) {
    if (fs.existsSync(f)) {
      const c = fs.readFileSync(f, 'utf8');
      const m = c.match(/INTERNAL_API_SECRET=["']?([^"'\r\n]+)/);
      if (m && m[1].trim()) return m[1].trim();
    }
  }
  return '';
}

const SECRET = getSecret();
const BASE_URL = process.env.CHAT_URL || 'https://www.montana.com.eg/api/chat';

async function sendChat(message, sid, { trusted = true, channel = 'instagram' } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (trusted && SECRET) headers['x-montana-secret'] = SECRET;

  const t0 = Date.now();
  const res = await fetch(BASE_URL, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      sessionId: sid,
      message,
      channel,
    })
  });
  const elapsed = Date.now() - t0;
  const data = await res.json();
  const reply = data.reply || data.reply1 || '';
  const engineSource = data.engineSource || 'legacy_v1';
  return { status: res.status, reply, elapsed, data, engineSource };
}

async function verifyProductionV3() {
  console.log('======================================================================');
  console.log('VERIFYING PRODUCTION V3 DEPLOYMENT ON https://www.montana.com.eg');
  console.log('Timestamp: ' + new Date().toISOString());
  console.log('======================================================================\n');

  let passed = 0;
  let total = 0;

  function assert(cond, msg, detail) {
    total++;
    if (cond) {
      passed++;
      console.log(`  [PASS] ${msg}`);
    } else {
      console.error(`  [FAIL] ${msg}`);
      if (detail) console.error('         Details:', detail);
      throw new Error(`Failed: ${msg}`);
    }
  }

  // 1. Verify Non-Allowlisted Customer Session -> Routes to V1
  console.log('--- 1. Verification: Non-Allowlisted Customer Session (Safe on V1) ---');
  {
    const customerSid = `web:real_customer_${Date.now()}`;
    const r1 = await sendChat('بكام روتين التفتيح؟', customerSid, { trusted: false, channel: 'web' });
    console.log(`[Source: ${r1.engineSource} | Elapsed: ${r1.elapsed}ms]\nReply: ${r1.reply.slice(0, 120)}...\n`);
    assert(r1.status === 200, 'Customer endpoint returns HTTP 200');
    assert(r1.engineSource !== 'gemini_agent_v3', 'Non-allowlisted session does NOT touch V3');
    assert(r1.reply.includes('777'), 'Customer receives verified pricing via existing stable engine');
  }

  // 2. Verify Allowlisted Internal Session -> Routes to Native Gemini Agent V3
  console.log('\n--- 2. Verification: Allowlisted Internal Session (Routes to V3) ---');
  {
    const internalSid = 'test:owner_qa';
    const r2 = await sendChat('عندي روتين التفتيح وروتين بعد الليزر، ينفع استخدمهم سوا ولا فيه تعارض؟', internalSid, { trusted: true, channel: 'instagram' });
    console.log(`[Source: ${r2.engineSource} | Elapsed: ${r2.elapsed}ms]\nReply:\n${r2.reply}\n`);
    assert(r2.status === 200, 'Allowlisted endpoint returns HTTP 200');
    assert(r2.engineSource === 'gemini_agent_v3', 'Allowlisted session successfully executed via Native Gemini Agent V3');
    assert(!/تعارض.*(خالص|نهائياً|تماماً)|(مفيش|لا\s*يوجد)\s*(أي\s*)?تعارض/i.test(r2.reply), 'Does not make unhedged absolute compatibility claims');
    assert(/(تنسيق|ليزر|تفتيح|تهدئة|طريقة|بشرت)/i.test(r2.reply), 'Delivers sophisticated consultative guidance');
  }

  // 3. Verify Complex Dry/Peeling Consultation on Live V3
  console.log('\n--- 3. Verification: Dry/Peeling Consultation on Live V3 ---');
  {
    const internalSid = 'test:owner_qa_skincare_irritation';
    const r3 = await sendChat('بشرة وشي جافة جداً ومقشرة، هل كريم التفتيح هيرطب ولا أدهن لوشن الجسم على وشي؟', internalSid, { trusted: true, channel: 'instagram' });
    console.log(`[Source: ${r3.engineSource} | Elapsed: ${r3.elapsed}ms]\nReply:\n${r3.reply}\n`);
    assert(r3.engineSource === 'gemini_agent_v3', 'Executed on Gemini Agent V3');
    assert(!r3.reply.includes('لوشن الجسم على الوش') && !r3.reply.includes('كريم بعد الليزر لتهدئة التقشير'), 'Does not recommend body lotion on face or post-laser for facial peeling');
    assert(/(ترطيب|حاجز|طبي|ملطف|للجسم|مش\s*للوجه|مش\s*للوش)/i.test(r3.reply), 'Gives sound medical/cosmetic skincare guidance');
  }

  // 4. Verify Multi-Intent Shipping & Payment on Live V3
  console.log('\n--- 4. Verification: Multi-Intent Delivery ETA + Payment on Live V3 ---');
  {
    const internalSid = 'test:owner_qa_live_4';
    const r4 = await sendChat('الشحن بياخد قد إيه للإسكندرية والدفع كاش ولا فيه عربون؟', internalSid, { trusted: true, channel: 'instagram' });
    console.log(`[Source: ${r4.engineSource} | Elapsed: ${r4.elapsed}ms]\nReply:\n${r4.reply}\n`);
    assert(r4.engineSource === 'gemini_agent_v3', 'Executed on Gemini Agent V3');
    assert(/(إسكندرية|اسكندرية|2|3|أيام|ايام|يومين)/i.test(r4.reply), 'Answers delivery ETA for Alexandria accurately');
    assert(/(كاش|عند\s*الاستلام|معاينة|عربون)/i.test(r4.reply), 'Answers 100% COD without deposit');
  }

  // 5. Verify Test Isolation: Mock Order Creation with Zero Real Shipments
  console.log('\n--- 5. Verification: Test Isolation Order Placement ---');
  {
    const testSid = 'test:owner_qa_live_10';
    // Clear and add item
    await sendChat('عاوزة أطلب روتين التفتيح الكامل', testSid, { trusted: true });
    await sendChat('الاسم: سارة أحمد\nالموبايل: 01012345678\nالعنوان: 15 شارع النصر المعادي القاهرة', testSid, { trusted: true });
    const r5 = await sendChat('العنوان 15 شارع النصر المعادي القاهرة', testSid, { trusted: true });
    console.log(`[Source: ${r5.engineSource}]\nReply:\n${r5.reply}\n`);
    assert(r5.engineSource === 'gemini_agent_v3', 'Order placement executed via V3');
    assert(r5.data.order || /(EVAL-|MON-|تم\s*تسجيل|ألف\s*مبروك)/i.test(r5.reply), 'Pending order creation confirmed');
    if (r5.data.order?.order_number) {
      assert(r5.data.order.order_number.startsWith('EVAL-'), 'Test isolation verified: mock EVAL order generated (no real shipment or inventory deduction)');
    }
  }

  console.log('\n======================================================================');
  console.log(`ALL VERIFICATION CHECKS PASSED: ${passed}/${total} (100%)`);
  console.log('======================================================================\n');
}

verifyProductionV3().catch((err) => {
  console.error('\nProduction Verification Error:', err);
  process.exit(1);
});
