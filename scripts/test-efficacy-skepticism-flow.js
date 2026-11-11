/**
 * Test for customer skepticism, efficacy questions, and "التلات عبوات" recognition.
 */
const assert = require('assert');
const { handleInboundMessage } = require('../lib/chatEngine');

async function run() {
  console.log('Testing skepticism / efficacy / 3 bottles flow...');

  // Test 1: Skepticism / past bad experience
  const sid1 = 'test:skep:' + Date.now();
  const res1 = await handleInboundMessage({
    message: 'بس يكون بيجيب نتيجه علشان اناجربت كزا منتج ولاعملو حاجه خالص',
    sessionId: sid1,
  });
  console.log('\n--- Test 1 (Skepticism) ---');
  console.log(res1.reply);
  assert(res1.reply.includes('COSMTOL25117170'), 'Must cite MOH approval');
  assert(res1.reply.includes('المعاينة') || res1.reply.includes('معاينتها'), 'Must mention inspection before payment');
  assert(!res1.reply.includes('غسول علاج حب الشباب للوجه'), 'Must not dump unrelated catalog');

  // Test 2: "يعني كويس ولا كلام وخلاص"
  const sid2 = 'test:skep2:' + Date.now();
  const res2 = await handleInboundMessage({
    message: 'يعني كويس ولا كلام وخلاص',
    sessionId: sid2,
  });
  console.log('\n--- Test 2 ("كلام وخلاص") ---');
  console.log(res2.reply);
  assert(res2.reply.includes('COSMTOL25117170'), 'Must cite MOH approval');
  assert(!res2.reply.includes('غسول علاج حب الشباب للوجه'), 'Must not dump catalog');

  // Test 3: "التلات عبوات" after bot pitched cream vs routine
  const sid3 = 'test:bottles:' + Date.now();
  // Turn A: bot asked
  const hist3 = [
    { role: 'user', text: 'انا عندي تحت الابط اسمر بس مش قوي' },
    { role: 'model', text: 'تحبي نبدأ بالكريم لوحده ولا الروتين كامل؟' }
  ];
  const res3 = await handleInboundMessage({
    message: 'التلات عبوات',
    sessionId: sid3,
    chatHistory: hist3,
  });
  console.log('\n--- Test 3 ("التلات عبوات") ---');
  console.log(res3.reply);
  assert(res3.reply.includes('روتين التفتيح') || res3.reply.includes('777'), 'Must recognize brightening routine');
  assert(res3.reply.includes('الاسم') || res3.reply.includes('المحافظة') || res3.reply.includes('العنوان'), 'Must ask for order details or confirm');
  assert(!res3.reply.includes('غسول علاج حب الشباب للوجه'), 'Must not dump catalog');

  console.log('\nALL SKEPTICISM & BOTTLE TESTS PASSED!');
}

run().catch((e) => {
  console.error('FAILED:', e);
  process.exit(1);
});
