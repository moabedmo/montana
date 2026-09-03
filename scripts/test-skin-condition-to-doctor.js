/**
 * A named skin condition is a medical question. Left to the model, the bot
 * told a customer with eczema that the body lotion was "مناسب جدًا" for it,
 * and ignored a question about urticaria entirely — twice, then offered to
 * help with something else.
 *
 * Owner's rule: the products are cosmetic, not medical, and her dermatologist
 * decides. Ordinary sensitive skin is NOT this — that is a cosmetic concern
 * and keeps its normal suitability answer.
 *
 * Run: node scripts/test-skin-condition-to-doctor.js
 */
process.env.GEMINI_API_KEY = process.env.GEMINI_API_KEY || 'x';
const { namesSkinCondition, skinConditionReply } = require('../lib/chatEngine');

let failed = 0;
function assert(cond, label) {
  if (!cond) { failed += 1; console.error('FAIL:', label); } else { console.log('ok:', label); }
}

// ── conditions that must go to a doctor ──
[
  'مينفعوش للبشرة الحساسه واللى عندهم ارتكاريا؟',
  'عندي اكزيما ينفع استخدمه',
  'عندي أكزيما في ايدي',
  'عندي صدفية ينفع',
  'عندي بهاق',
  'عندي روزاسيا',
  'عندي حساسية جلدية',
].forEach((m) => assert(namesSkinCondition(m), 'to the doctor: ' + m));

// ── ordinary skin talk must NOT be swept up ──
[
  'بشرتي حساسة جدا ينفع؟',
  'بشرتي حساسة',
  'المناطق الحساسة',
  'تفتيح الاماكن الحساسه',
  'عايزة اطلب',
  'كريم التفتيح بكام',
  'عندي حبوب',
  'عندي تصبغات',
].forEach((m) => assert(!namesSkinCondition(m), 'normal chat: ' + m));

// ── the reply ──
const reply = skinConditionReply();
assert(/تجميلي/.test(reply), 'says the products are cosmetic');
assert(/مش\s*منتجات\s*علاجية/.test(reply), 'says they are not medical');
assert(/طبيب/.test(reply), 'sends her to a dermatologist');
assert(!/(مناسب\s*جدًا|مناسب\s*جدا|بيعالج|هيعالج)/.test(reply), 'never claims it treats the condition');
assert(!/\b(249|299|329|369|558|618|777)\b/.test(reply), 'does not pitch a price on a medical question');

if (failed) { console.error(`\n${failed} test(s) failed`); process.exit(1); }
console.log('\nall passed');
