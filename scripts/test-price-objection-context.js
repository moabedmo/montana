const fs = require('fs');
for (const envFile of ['.env.runtime.local', '.env.local', '.env.production.local']) {
  if (fs.existsSync(envFile)) {
    const content = fs.readFileSync(envFile, 'utf8');
    content.split('\n').forEach(line => {
      const match = line.match(/^([^=]+)=(.*)$/);
      if (match) {
        const key = match[1].trim();
        const val = match[2].trim().replace(/^["']|["']$/g, '');
        if (!process.env[key]) process.env[key] = val;
      }
    });
  }
}

const assert = require('assert');
const { appendHistory, historyToGemini } = require('../lib/chatSessionStore');
const salesAgentV3 = require('../lib/salesAgentV3');

async function testHistoryIntegrity() {
  console.log('--- 1. Testing History Store Integrity ---');

  // Test appendHistory with both signatures
  let h = [];
  h = appendHistory(h, 'صباح الخير', 'صباح النور يا فندم');
  assert.strictEqual(h.length, 2);
  assert.strictEqual(h[0].role, 'user');
  assert.strictEqual(h[0].text, 'صباح الخير');
  assert.strictEqual(h[1].role, 'model');
  assert.strictEqual(h[1].text, 'صباح النور يا فندم');

  // Test appendHistory with array signature (the one that caused [object Object] bug)
  h = appendHistory(h, [
    { role: 'user', text: 'بكام روتين التفتيح؟' },
    { role: 'bot', text: 'بـ 777 جنيه يا فندم' },
  ]);
  assert.strictEqual(h.length, 4);
  assert(!h.some(item => String(item.text).includes('[object Object]')), 'Must not contain [object Object]');
  assert.strictEqual(h[2].role, 'user');
  assert.strictEqual(h[3].role, 'model');

  // Test historyToGemini with mixed roles ('bot', 'model', 'assistant') and corrupted items
  const dirtyHistory = [
    { role: 'user', text: '[object Object],[object Object]' }, // should be dropped
    { role: 'user', text: 'غالي جدا يافندم' },
    { role: 'bot', text: 'مقدّرة جداً يا فندم...' }, // role 'bot' must become 'model'
    { role: 'user', text: 'المنتج غالي' },
  ];

  const geminiH = historyToGemini(dirtyHistory);
  console.log('Clean Gemini History:', JSON.stringify(geminiH, null, 2));
  assert.strictEqual(geminiH[0].role, 'user');
  assert.strictEqual(geminiH[0].parts[0].text, 'غالي جدا يافندم');
  assert.strictEqual(geminiH[1].role, 'model');
  assert.strictEqual(geminiH[1].parts[0].text, 'مقدّرة جداً يا فندم...');
  assert.strictEqual(geminiH[2].role, 'user');
  assert.strictEqual(geminiH[2].parts[0].text, 'المنتج غالي');
  console.log('  [PASS] History Store integrity and Gemini turn sanitation verified.');
}

async function testPriceObjectionDialogue() {
  console.log('\n--- 2. Testing Price Objection Dialogue & Conversation Continuity ---');

  const sid = 'test:hossam_el_sayed_test_' + Date.now();

  // Turn 1: Customer enters with "غالي جدا يافندم" (simulating ad flow landing)
  console.log('\n[Turn 1] Customer: "غالي جدا يافندم"');
  const r1 = await salesAgentV3.handleInboundSalesMessage({
    sid,
    message: 'غالي جدا يافندم',
    channel: 'messenger',
    selectedBundle: 'brightening',
    trustedCaller: true,
  });

  console.log('Bot Reply 1:\n', r1.reply);
  assert(!/(أنهي|انهي|أي)\s*منتج/i.test(r1.reply), 'Must NOT ask which product is expensive');
  assert(/(777|تفتيح|كامل|3\s*منتجات|ثلاثة|لوشن|غسول|كريم)/i.test(r1.reply), 'Identifies the brightening routine offer');
  assert(/(369|249|لوحده|تبدأ|تجرب|اقتصادي)/i.test(r1.reply), 'Offers affordable single product alternative (369 or 249)');

  // Turn 2: Customer follows up with "المنتج غالي"
  console.log('\n[Turn 2] Customer: "المنتج غالي"');
  const r2 = await salesAgentV3.handleInboundSalesMessage({
    sid,
    message: 'المنتج غالي',
    channel: 'messenger',
    trustedCaller: true,
  });

  console.log('Bot Reply 2:\n', r2.reply);
  assert(!/^(أهلاً\s*بحضرتك|أهلاً\s*بيك|أهلاً\s*وسهلاً)/i.test(r2.reply.trim()), 'Must NOT start with greeting on follow-up turn');
  assert(!/(أنهي|انهي|أي)\s*منتج/i.test(r2.reply), 'Must NOT ask which product is expensive');
  assert(/(369|249|كريم|غسول|تبدأ|لوحده)/i.test(r2.reply), 'Reinforces single product catalog option');
  console.log('  [PASS] Price objection handled with context preservation and zero repeated greetings.');
}

async function run() {
  await testHistoryIntegrity();
  await testPriceObjectionDialogue();
  console.log('\n======================================================================');
  console.log('ALL PRICE OBJECTION & CONTINUITY TESTS PASSED (100%)');
  console.log('======================================================================\n');
}

run().catch((e) => {
  console.error('Test failed:', e);
  process.exit(1);
});
