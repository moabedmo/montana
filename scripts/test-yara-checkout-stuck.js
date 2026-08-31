/**
 * Regression: Instagram dump that stuck on "ابعتيلي في رسالة واحدة".
 * Run: node scripts/test-yara-checkout-stuck.js
 */
process.env.GEMINI_API_KEY = process.env.GEMINI_API_KEY || 'x';
const {
  parseVolunteeredDeliveryDetails,
  looksLikeVolunteeredDeliveryDetails,
  isUsableDeliveryAddress,
  looksLikePersonName,
  regexFallbackIntent,
} = require('../lib/chatEngine');
const { softNormalizeAr } = require('../lib/orderContext');

let failed = 0;
function assert(cond, label) {
  if (!cond) {
    failed += 1;
    console.error('FAIL:', label);
  } else {
    console.log('ok:', label);
  }
}

const dump = 'يارا احمد المرسي\n01064239555\nقريه كفر حسان أمام محطه القطر';
const dumpOneLine = 'يارا احمد المرسي 01064239555 قريه كفر حسان أمام محطه القطر';

assert(!looksLikePersonName('اي حاجه عادي'), 'اي حاجه عادي is NOT a person name');
assert(!looksLikePersonName('أي حاجة عادي'), 'أي حاجة عادي is NOT a person name');
assert(regexFallbackIntent('اي حاجه عادي', { wizardStep: 'await_method' }).intent === 'CHOOSE_CHAT', 'اي حاجه → CHOOSE_CHAT');

assert(looksLikeVolunteeredDeliveryDetails(dump), 'detect yara dump');
const parsed = parseVolunteeredDeliveryDetails(dump);
assert(parsed?.phone === '01064239555' || String(parsed?.phone || '').endsWith('1064239555'), 'yara phone');
assert(looksLikePersonName(parsed?.name), 'yara name: ' + parsed?.name);
assert(isUsableDeliveryAddress(parsed?.address), 'yara address usable: ' + parsed?.address);

const intentDetails = regexFallbackIntent(dump, { wizardStep: 'details' });
assert(intentDetails.intent === 'PROVIDE_FULL_DETAILS', 'dump → PROVIDE_FULL_DETAILS not PROVIDE_PHONE: ' + intentDetails.intent);
assert(intentDetails.slots?.name && intentDetails.slots?.phone && intentDetails.slots?.address, 'full slots filled');

const intentAwait = regexFallbackIntent(dump, { wizardStep: 'await_method' });
assert(intentAwait.intent === 'PROVIDE_FULL_DETAILS', 'dump on await_method → FULL_DETAILS');

assert(looksLikeVolunteeredDeliveryDetails(dumpOneLine), 'one-line dump detected');
assert(regexFallbackIntent(dumpOneLine, { wizardStep: 'details' }).intent === 'PROVIDE_FULL_DETAILS', 'one-line → FULL_DETAILS');

assert(regexFallbackIntent('غربيه', { wizardStep: 'governorate' }).intent === 'PROVIDE_GOVERNORATE', 'غربيه → PROVIDE_GOVERNORATE');
assert(regexFallbackIntent('الغربيه', { wizardStep: 'details' }).intent === 'PROVIDE_GOVERNORATE', 'الغربيه → PROVIDE_GOVERNORATE');
assert(softNormalizeAr('غربيه') === 'غربيه', 'softNorm غربيه');

if (failed) {
  console.error(`\n${failed} failed`);
  process.exit(1);
}
console.log('\nPASS yara checkout stuck');
