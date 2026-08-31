/**
 * A staff member calls the customer to confirm the order and asks for a
 * confirmation payment. The bot used to DENY this ("مفيش مقدّم"), which made a
 * real call look like a scam. The bot must never request money and never deny
 * the call — it checks the caller's number against our official line instead.
 *
 * Run: node scripts/test-deposit-call-inquiry.js
 */
process.env.GEMINI_API_KEY = process.env.GEMINI_API_KEY || 'x';
const {
  isDepositCallInquiry,
  botAskedForCallerNumber,
  askCallerNumberReply,
  callerNumberVerdictReply,
} = require('../lib/chatEngine');

const OFFICIAL = '01019787225';
let failed = 0;
function assert(cond, label) {
  if (!cond) { failed += 1; console.error('FAIL:', label); } else { console.log('ok:', label); }
}

// ── detects the question, however it's phrased ──
[
  'في حد كلمني وطلب مني 200 جنيه',
  'حد اتصل بيا وقال لازم ادفع مقدم',
  'جالي اتصال بيطلب فلوس ده صح ولا نصب',
  'واحد كلمني وطلب تحويل فودافون كاش ده منكم؟',
  'اتصلوا بيا وطلبوا عربون عشان يأكدوا الاوردر',
].forEach((m) => assert(isDepositCallInquiry(m), 'detects: ' + m));

// ── must NOT hijack ordinary messages ──
[
  'بتقبلوا فودافون كاش؟',
  'الشحن بكام',
  'عايزة اطلب روتين التفتيح',
  '01102354774',
  'سلمى محمود حسن',
  '١٣ ش مكه امام بلوك ١٥ مساكن كفر طهرمس فيصل',
  'الاوردر وصل امتى',
].forEach((m) => assert(!isDepositCallInquiry(m), 'ignores: ' + m));

// ── follow-up only fires after we asked for the caller number ──
const askedHistory = [{ role: 'model', text: askCallerNumberReply() }];
assert(botAskedForCallerNumber(askedHistory), 'recognises its own caller-number question');
assert(
  !botAskedForCallerNumber([{ role: 'model', text: 'ابعتي من فضلك **رقم موبايلك** (01xxxxxxxxx)' }]),
  'the checkout phone ask is NOT the caller-number question'
);
assert(!botAskedForCallerNumber([]), 'empty history → not asked');

// ── the verdict ──
const good = callerNumberVerdictReply(OFFICIAL);
assert(good.includes(OFFICIAL) && /أيوه/.test(good), 'official number → confirms the call is real');
assert(!/200|٢٠٠/.test(good), 'confirmation never states an amount');

const bad = callerNumberVerdictReply('01234567890');
assert(/مش من أرقامنا/.test(bad), 'unknown number → flagged as not ours');
assert(/متدفعيش/.test(bad), 'unknown number → tells her not to pay');
assert(bad.includes(OFFICIAL), 'unknown number → still gives the official line');

// ── the bot must never solicit money anywhere in these replies ──
[askCallerNumberReply(), good, bad].forEach((r, i) => {
  assert(!/(ابعتي|حولي|ادفعي)\s*(لنا|ال)?\s*(مبلغ|فلوس|مقدم)/i.test(r), `reply ${i} never asks for money`);
});

if (failed) { console.error(`\n${failed} test(s) failed`); process.exit(1); }
console.log('\nall passed');
