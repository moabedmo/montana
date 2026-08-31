/**
 * Nour labeled checkout dump — must parse name/phone/address in one shot.
 * Run: node scripts/test-nour-checkout-parse.js
 */
process.env.GEMINI_API_KEY = process.env.GEMINI_API_KEY || 'x';
const {
  parseVolunteeredDeliveryDetails,
  looksLikeVolunteeredDeliveryDetails,
  isUsableDeliveryAddress,
  isMetaPlatformNoiseMessage,
  looksLikePersonName,
} = require('../lib/chatEngine');

const assert = (c, m) => { if (!c) { console.error('FAIL:', m); process.exit(1); } };

const dump = `الاسم ثلاثي : نور هانى صالح 
رقم الموبايل : 01016242561
العنوان بالكامل : محافظة القاهره مدينة السلام اسكندريه الدلتا 2 بلوك 64 أمام سوبر ماركت اولاد على الدور الخامس`;

assert(looksLikeVolunteeredDeliveryDetails(dump), 'detect dump');
const parsed = parseVolunteeredDeliveryDetails(dump);
console.log(parsed);
assert(parsed?.phone === '01016242561' || parsed?.phone?.endsWith('1016242561'), 'phone');
assert(looksLikePersonName(parsed.name), 'name is person: ' + parsed.name);
assert(!/ثلاثي|رقم|عنوان/.test(parsed.name), 'name without labels: ' + parsed.name);
assert(isUsableDeliveryAddress(parsed.address), 'usable address');
assert(/بلوك|أمام|دور|مدينة/.test(parsed.address), 'address content');

const oneLine = 'الاسم ثلاثي : نور هانى صالح رقم الموبايل : 01016242561 العنوان بالكامل : محافظة القاهره مدينة السلام اسكندريه الدلتا 2 بلوك 64 أمام سوبر ماركت اولاد على الدور الخامس';
const p2 = parseVolunteeredDeliveryDetails(oneLine);
assert(p2?.phone && isUsableDeliveryAddress(p2.address), 'one-line dump');
assert(looksLikePersonName(p2.name), 'one-line name');

assert(isMetaPlatformNoiseMessage('استخدام أحدث تطبيق\nاستخدم أحدث إصدار من تطبيق Instagram لرؤية هذا النوع من الرسائل.'), 'ig noise');
assert(!isMetaPlatformNoiseMessage(dump), 'dump is not noise');

console.log('PASS nour checkout parse');
