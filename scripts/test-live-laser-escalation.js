const assert = require('assert');
const { handleInboundMessage } = require('../lib/chatEngine');

async function run() {
  console.log('Testing live escalation scenario...');

  const sid = 'messenger:test_aya_escalation_' + Date.now();

  // Turn 1: Quoted reply with volunteered details
  const quoteMsg =
    'رد Àýà على You\n' +
    'من عنينا يا فندم هجهزهولك فوراً، تحبي نشحنهولك على محافظة إيه والعنوان بالتفصيل؟ واسم ورقم موبايل حضرتك عشان المندوب يتواصل معاكي\n' +
    'مغاعة المنيا\n' +
    'منشية الخمسينه امام ملعب ويمبلى\n' +
    '01123635282\n' +
    'عرض بعد الليزر';

  const res1 = await handleInboundMessage({
    sid,
    message: quoteMsg,
    channel: 'messenger',
  });
  console.log('Turn 1 (volunteered details):', res1.reply);
  assert(res1.reply.includes('المنيا') || res1.reply.includes('الأوردر') || res1.reply.includes('549') || res1.reply.includes('الليزر'));

  // Turn 2: Admin Khaled sends confirmation
  const res2 = await handleInboundMessage({
    sid,
    message: 'تم تسجيل الاوردر',
    channel: 'messenger',
  });
  console.log('Turn 2 (Khaled says order registered):', res2);
  assert(res2.botPaused === true || res2.reply === null);

  // Turn 3: Customer says thank you
  const res3 = await handleInboundMessage({
    sid,
    message: 'تمام تسلمى يارب',
    channel: 'messenger',
  });
  console.log('Turn 3 (customer says thanks while paused):', res3);
  assert(res3.botPaused === true || res3.reply === null);

  // Turn 4: Customer says waiting
  const res4 = await handleInboundMessage({
    sid,
    message: 'فى انتظاره',
    channel: 'messenger',
  });
  console.log('Turn 4 (customer says waiting while paused):', res4);
  assert(res4.botPaused === true || res4.reply === null);

  console.log('ALL ESCALATION TEST CASES PASSED!');
}

run().catch((err) => {
  console.error('TEST FAILED:', err);
  process.exit(1);
});
