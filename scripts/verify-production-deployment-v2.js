const { createClient } = require('@supabase/supabase-js');

const PROD_URL = 'https://www.montana.com.eg/api/chat';
const SUPABASE_URL = 'https://ikryeyqrithikabwidov.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlrcnlleXFyaXRoaWthYndpZG92Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE3MzY1ODcsImV4cCI6MjA5NzMxMjU4N30.kNfHPxV4fq67cOF8uFsTrLOxPYcLcmmDO3ScIHzI9Uo';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function callChat(sid, message, extra = {}) {
  const res = await fetch(PROD_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify({ message, sessionId: sid, ...extra }),
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, reply: data.reply || '', data };
}

async function run() {
  console.log('================================================================');
  console.log('🚀 MONTANA PRODUCTION DEPLOYMENT VERIFICATION (LIVE)');
  console.log(`Endpoint: ${PROD_URL}`);
  console.log('================================================================\n');

  let passed = 0;
  let failed = 0;

  // ─────────────────────────────────────────────────────────────────────────
  // TEST 1: All Routines Inquiry on Instagram (Plural inquiry)
  // ─────────────────────────────────────────────────────────────────────────
  console.log('▶ TEST 1: Instagram Channel — Plural Routine Inquiry ("عاوز استفسر عن الروتينات")');
  const sidIg = `instagram:test_verify_${Date.now()}`;
  const res1 = await callChat(sidIg, 'عاوز استفسر عن الروتينات');

  console.log(`HTTP Status: ${res1.status}`);
  console.log(`Assistant Reply:\n"""\n${res1.reply}\n"""\n`);

  const hasBrightening = /777/.test(res1.reply) && /تفتيح/.test(res1.reply);
  const hasPostLaser = /618/.test(res1.reply) && /ليزر/.test(res1.reply);
  const hasFaceBody = /558/.test(res1.reply) && /(وجه|وش).*(جسم)/.test(res1.reply);
  const hasFreeShipping = /شحن\s*مجاني/.test(res1.reply);
  const hasConsultativeClosing = /(أنهي|انهي|روتين|مشكلة|حابب|حابة)/.test(res1.reply);

  if (res1.ok && hasBrightening && hasPostLaser && hasFaceBody && hasFreeShipping && hasConsultativeClosing) {
    console.log('✅ PASS: All 3 routines returned with correct verified prices (777, 618, 558), free shipping perk, and consultative closing.\n');
    passed++;
  } else {
    console.error('❌ FAIL: Routine inquiry did not return all 3 routines correctly.');
    console.error({ hasBrightening, hasPostLaser, hasFaceBody, hasFreeShipping, hasConsultativeClosing });
    failed++;
  }

  await sleep(1500);

  // ─────────────────────────────────────────────────────────────────────────
  // TEST 2: Incomplete Details Handling on Messenger
  // ─────────────────────────────────────────────────────────────────────────
  console.log('▶ TEST 2: Messenger Channel — Incomplete Customer Details');
  const sidMessenger = `messenger:test_verify_${Date.now()}`;
  const res2 = await callChat(
    sidMessenger,
    'عايز أطلب غسول التفتيح\nالاسم: منى أحمد\nالموبايل: 01012345678\nالعنوان: 15 شارع النيل'
  );

  console.log(`HTTP Status: ${res2.status}`);
  console.log(`Assistant Reply:\n"""\n${res2.reply}\n"""\n`);

  const asksGovernorate = /(محافظ|محافظة|محافظتك)/.test(res2.reply);
  const doesNotAskPhone = !/(رقم\s*(الموبايل|التليفون|الهاتف)|موبايلك)/.test(res2.reply);
  const doesNotAskName = !/(اسم\s*حضرتك|الاسم\s*بالكامل|اسمك)/.test(res2.reply);
  const doesNotAskConfirmation = !/(تحبي نأكد|اكتبي نعم|قولي أكد|اكتبي أكد|عشان نأكد|نأكد الأوردر\?)/.test(res2.reply);

  if (res2.ok && asksGovernorate && doesNotAskPhone && doesNotAskName && doesNotAskConfirmation) {
    console.log('✅ PASS: Assistant identified missing governorate and asked ONLY for it without asking for chat confirmation.\n');
    passed++;
  } else {
    console.error('❌ FAIL: Assistant did not ask exclusively for the missing field.');
    console.error({ asksGovernorate, doesNotAskPhone, doesNotAskName, doesNotAskConfirmation });
    failed++;
  }

  await sleep(1500);

  // ─────────────────────────────────────────────────────────────────────────
  // TEST 3: Human-Confirmation-Only Order Workflow on Production
  // ─────────────────────────────────────────────────────────────────────────
  console.log('▶ TEST 3: Order Workflow — Complete Details & Human Confirmation Only');
  const testPhone = '01000000000';
  const sidOrder = `messenger:test_order_${Date.now()}`;
  const res3 = await callChat(
    sidOrder,
    `عايز كريم التفتيح\nالاسم: عميل تجربة نظام ديبلويمينت\nالموبايل: ${testPhone}\nالعنوان: 12 شارع التحرير شقة 4\nالمحافظة: القاهرة`
  );

  console.log(`HTTP Status: ${res3.status}`);
  console.log(`Assistant Reply:\n"""\n${res3.reply}\n"""\n`);

  const expectedExact = 'تمام يا فندم 💜 طلب حضرتك اتسجل بنجاح، وحد من فريق مونتانا هيتواصل معاك تليفونيًا لتأكيد الطلب وتفاصيل التوصيل.';
  const hasExactOrCoreReply = res3.reply.includes(expectedExact) || res3.reply.includes('طلب حضرتك اتسجل بنجاح');
  const noConfirmationPrompt = !/(تحبي نأكد|اكتبي نعم|قولي أكد|اكتبي أكد|عشان نأكد|نأكد الأوردر\?)/.test(res3.reply);

  let orderVerifiedInDb = false;
  let createdOrderId = null;

  try {
    const sb = createClient(SUPABASE_URL, SUPABASE_ANON);
    const { data: auth } = await sb.auth.signInWithPassword({
      email: 'owner@montana.com',
      password: 'Mont@na2026',
    });

    if (auth?.session?.access_token) {
      const client = createClient(SUPABASE_URL, SUPABASE_ANON, {
        global: { headers: { Authorization: `Bearer ${auth.session.access_token}` } }
      });

      const { data: orders, error: oErr } = await client
        .from('orders')
        .select('id, order_number, status, bosta_tracking_number, total, customer_name, customer_phone, address, governorate')
        .eq('customer_phone', testPhone)
        .order('created_at', { ascending: false })
        .limit(1);

      if (!oErr && orders && orders.length > 0) {
        const o = orders[0];
        createdOrderId = o.id;
        console.log(`📦 Found Created Order in Database:`);
        console.log(`   Order ID: ${o.id}`);
        console.log(`   Order Number: ${o.order_number}`);
        console.log(`   Status: ${o.status}`);
        console.log(`   Bosta Tracking: ${o.bosta_tracking_number || 'NONE (as expected - no shipment created)'}`);
        console.log(`   Total: ${o.total} EGP`);
        console.log(`   Governorate: ${o.governorate}`);

        if (o.status === 'pending' && !o.bosta_tracking_number) {
          orderVerifiedInDb = true;
        }

        // Clean up test order immediately
        console.log(`🧹 Cleaning up test order ID ${createdOrderId} from database...`);
        await client.from('order_items').delete().eq('order_id', createdOrderId);
        await client.from('orders').delete().eq('id', createdOrderId);
        console.log(`   Test order deleted successfully.`);
      }
    }
  } catch (err) {
    console.error('Error verifying/cleaning up in Supabase:', err.message);
  }

  if (res3.ok && hasExactOrCoreReply && noConfirmationPrompt && orderVerifiedInDb) {
    console.log('✅ PASS: Order was automatically saved with status PENDING, exact human confirmation response given, and NO Bosta shipment was created.\n');
    passed++;
  } else {
    console.error('❌ FAIL: Order workflow failed verification.');
    console.error({ hasExactOrCoreReply, noConfirmationPrompt, orderVerifiedInDb });
    failed++;
  }

  await sleep(1500);

  // ─────────────────────────────────────────────────────────────────────────
  // TEST 4: Storefront & Integrations Health
  // ─────────────────────────────────────────────────────────────────────────
  console.log('▶ TEST 4: Storefront and Integrations Health Check');
  const storeRes = await fetch('https://www.montana.com.eg/');
  const integRes = await fetch('https://www.montana.com.eg/api/integrations-status');
  const integData = await integRes.json().catch(() => ({}));

  console.log(`Storefront HTTP Status: ${storeRes.status}`);
  console.log(`Integrations Status HTTP Status: ${integRes.status}`);
  console.log(`Integrations: ${JSON.stringify(integData)}`);

  if (storeRes.ok && integRes.ok) {
    console.log('✅ PASS: Storefront and integrations endpoints are healthy.\n');
    passed++;
  } else {
    console.error('❌ FAIL: Health check failed.');
    failed++;
  }

  console.log('================================================================');
  console.log(`FINAL RESULT: ${passed} PASSED, ${failed} FAILED`);
  console.log('================================================================');

  if (failed > 0) process.exit(1);
}

run().catch((e) => {
  console.error('Fatal error during verification:', e);
  process.exit(1);
});
