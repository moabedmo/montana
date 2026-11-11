/**
 * Test to verify that "How much it is" / questions during checkout
 * are NEVER treated as customer names.
 */
const assert = require('assert');
const { handleInboundMessage } = require('../lib/chatEngine');

async function run() {
  console.log('Testing "How much it is" during checkout details step...');

  const sid = 'test:howmuch:' + Date.now();

  // Step 1: Customer asks to order brightening routine
  const res1 = await handleInboundMessage({
    message: 'عاوزة أطلب روتين التفتيح (عرض 777 ج)',
    sessionId: sid,
  });
  console.log('\n--- Step 1 Reply ---');
  console.log(res1.reply);
  assert(res1.reply.includes('روتين التفتيح') || res1.reply.includes('777'), 'Must pitch routine');
  assert(res1.reply.includes('الاسم'), 'Must ask for name/phone/address');

  // Step 2: Customer asks in English "How much it is"
  const res2 = await handleInboundMessage({
    message: 'How much it is',
    sessionId: sid,
  });
  console.log('\n--- Step 2 Reply ---');
  console.log(res2.reply);

  // Assertions:
  assert(!res2.reply.includes('سجّلت الاسم'), 'MUST NEVER say سجّلت الاسم to a price question!');
  assert(res2.reply.includes('777') || res2.reply.includes('روتين التفتيح'), 'Must quote the price of the brightening routine');
  assert(res2.reply.includes('الاسم') || res2.reply.includes('الموبايل') || res2.reply.includes('العنوان'), 'Must re-ask for missing details');

  console.log('\nALL "HOW MUCH" CHECKOUT TESTS PASSED!');
}

run().catch((e) => {
  console.error('FAILED:', e);
  process.exit(1);
});
