// scripts/test-mariam-halim-flow.js
// Tests the fixes for Mariam Halim's conversation
const assert = require('assert');
const path = require('path');

process.env.GEMINI_API_KEY = 'test_key';
const chat = require('../lib/chatEngine.js');

console.log('Testing Mariam Halim conversation fixes...\n');

// 1. Duration / Timeline Question
// "بياخد وقت اد اي عشان يفتح؟" must match isResultsTimelineQuestion and NOT isWhiteningEffectAsk
const q1 = 'بياخد وقت اد اي عشان يفتح؟';
console.log('Q1:', q1);
const isTimeline1 = chat.isResultsTimelineQuestion(q1);
const isWhitening1 = chat.isWhiteningEffectAsk(q1);
console.log('  isResultsTimelineQuestion:', isTimeline1);
console.log('  isWhiteningEffectAsk:', isWhitening1);
assert.strictEqual(isTimeline1, true, 'Q1 should be recognized as timeline question');
assert.strictEqual(isWhitening1, false, 'Q1 should NOT be recognized as whitening effect confirmation');

// 2. Discount Confirmation Question
// "هو كدا سعرو ٢٠٠ ؟؟" / "يعني بـ 200؟" must NOT be treated as routine haggle
const q2 = 'هو كدا سعرو ٢٠٠ ؟؟';
console.log('\nQ2:', q2);
const isHaggle2 = chat.isDiscountHaggleAsk(q2);
console.log('  isDiscountHaggleAsk:', isHaggle2);
assert.strictEqual(isHaggle2, false, 'Q2 should NOT be treated as discount haggling');

// 3. Discount Clarification Question
// "اومال اي الخصم اللي فوق دا؟" must NOT trigger routine haggle
const q3 = 'اومال اي الخصم اللي فوق دا؟';
console.log('\nQ3:', q3);
const isHaggle3 = chat.isDiscountHaggleAsk(q3);
console.log('  isDiscountHaggleAsk:', isHaggle3);
assert.strictEqual(isHaggle3, false, 'Q3 should NOT be treated as discount haggling');

// 4. Volunteered Delivery Details
const detailsText = 'مريم حليم \n01282728488\nالنزهه 2 شارع ال 27 برج الجزيره 25 الدور التاسع بجوار سوبر ماركت بيم';
console.log('\nDetails parsing:');
const looksLike = chat.looksLikeVolunteeredDeliveryDetails(detailsText);
const parsed = chat.parseVolunteeredDeliveryDetails(detailsText);
console.log('  looksLikeVolunteeredDeliveryDetails:', looksLike);
console.log('  parsed:', parsed);
assert.strictEqual(looksLike, true);
assert.strictEqual(parsed.name, 'مريم حليم');
assert.strictEqual(parsed.phone, '01282728488');
assert.ok(parsed.address.includes('النزهه 2 شارع ال 27'));

// 5. Customer Name Guard
// "واستاذنك تبعتيلي طريقه الاستخدام" must NEVER be classified as a customer name
const notAName = 'واستاذنك تبعتيلي طريقه الاستخدام';
console.log('\nCustomer name guard:');
const isName = chat.looksLikePersonName ? chat.looksLikePersonName(notAName) : false;
console.log(`  looksLikePersonName("${notAName}"):`, isName);
assert.strictEqual(isName, false, 'Instruction sentence must not be mistaken for a name');

// 6. harvestSeedFromHistory
const history = [
  { role: 'user', text: 'كريم التفتيح لوحدو بكام' },
  { role: 'model', text: 'كريم التفتيح سعره 249...' },
  { role: 'user', text: 'بياخد وقت اد اي عشان يفتح؟' },
  { role: 'model', text: 'النتائج بتكون ملحوظة خلال 14 يوم...' },
  { role: 'user', text: 'هو كدا سعرو 200؟؟' },
  { role: 'model', text: 'كريم التفتيح السعر 249 جنيه...' },
  { role: 'user', text: 'اومال اي الخصم اللي فوق دا؟' },
  { role: 'model', text: 'عندنا دلوقتي خصم BackToSchool...' },
  { role: 'user', text: detailsText },
  { role: 'model', text: 'تمام يا مريم...' },
  { role: 'user', text: 'انا عايزه كريم التفتيح' },
  { role: 'model', text: 'كريم التفتيح سعره 249...' },
  { role: 'user', text: 'واستاذنك تبعتيلي طريقه الاستخدام' },
  { role: 'model', text: 'طريقة استخدام كريم التفتيح...' }
];
console.log('\nharvestSeedFromHistory:');
const seed = chat.harvestSeedFromHistory(history);
console.log('  seed:', seed);
assert.strictEqual(seed.name, 'مريم حليم');
assert.strictEqual(seed.phone, '01282728488');
assert.ok(seed.address.includes('النزهه 2 شارع ال 27'));

// 7. Explicit Checkout Intent with Named Product
// "عايزه اعمل اوردر بكريم التفتيح" must be explicit checkout
const qOrder = 'عايزه اعمل اوردر بكريم التفتيح';
console.log('\nCheckout intent:');
const isCheckout = chat.isExplicitCheckoutIntent(qOrder);
console.log(`  isExplicitCheckoutIntent("${qOrder}"):`, isCheckout);
assert.strictEqual(isCheckout, true);

console.log('\nAll Mariam Halim flow assertions PASSED successfully! ✅');
