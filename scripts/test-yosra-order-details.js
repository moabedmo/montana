const assert = require('assert');
const v3 = require('../lib/salesAgentV3');
const { parseVolunteeredDeliveryDetails } = require('../lib/chatEngine');

const YOSRA_MSG = `يسرا محمد 
المنيا مركز مغاغه 
منشيه المصري بجوار فيلا احمد حسن لاعب الكوره 
01080072157`;

console.log('Testing parseVolunteeredDeliveryDetails on Yosra...');
const parsed = parseVolunteeredDeliveryDetails(YOSRA_MSG);
console.log('Parsed:', parsed);

assert(parsed, 'should parse details');
assert.strictEqual(parsed.phone, '01080072157', 'phone match');
assert.strictEqual(parsed.name, 'يسرا محمد', 'name match');
assert(parsed.address.includes('مغاغه') && parsed.address.includes('احمد حسن'), 'address contains details');

console.log('Testing deterministic order creation & state in salesAgentV3...');
const sid = 'eval-yosra-unit-' + Date.now();
const mockHistory = [
  { sender: 'customer', text: 'استفسار عن عرض روتين ما بعد الليزر' },
  { sender: 'agent', text: 'عرض روتين بعد الليزر سعره 618 جنيه والشحن مجاني...' },
  { sender: 'customer', text: 'تمام ٦١٨' },
  { sender: 'agent', text: 'أيوه بالظبط يا فندم، عرض روتين بعد الليزر بـ 618 جنيه والشحن مجاني...' },
  { sender: 'customer', text: 'محتاجه' }
];

// Mock Gemini returning text that in the past looped (asking for details again)
const mockGenAI = {
  getGenerativeModel: () => ({
    startChat: () => ({
      sendMessage: async () => ({
        response: {
          functionCalls: () => null,
          text: () => 'أيوه بالظبط يا فندم، عرض روتين بعد الليزر بـ 618 جنيه والشحن مجاني. ممكن أطلب من حضرتك الاسم الكريم ورقم الموبايل والعنوان بالتفصيل عشان نجهز الأوردر ونبعته لحضرتك؟ 💜'
        }
      })
    })
  })
};

v3.__setTestAdapters({ genAI: mockGenAI });

v3.handleInboundSalesMessage({
  sessionId: sid,
  message: YOSRA_MSG,
  channel: 'instagram',
  chatHistory: mockHistory,
}).then(res => {
  v3.__setTestAdapters(null);
  console.log('SalesAgentV3 Response Result:', res);
  assert(res.reply, 'should have reply');
  console.log('Reply text:\n', res.reply);
  assert(
    res.reply.includes('تم تسجيل طلبك') || res.reply.includes('EVAL-') || res.reply.includes('MON-'),
    'Reply should confirm the order'
  );
  assert(
    !res.reply.includes('ممكن أطلب من حضرتك الاسم') && !res.reply.includes('العنوان بالتفصيل'),
    'Reply must NOT ask for delivery details again'
  );
  console.log('\n>>> ALL YOSRA TESTS PASSED 100% PERFECTLY! <<<');
}).catch(err => {
  v3.__setTestAdapters(null);
  console.error('Test error:', err);
  process.exit(1);
});
