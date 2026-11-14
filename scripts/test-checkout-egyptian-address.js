const assert = require('assert');
const {
  looksLikePersonName,
  parseVolunteeredDeliveryDetails,
  isUsableDeliveryAddress,
} = require('../lib/chatEngine.js');

console.log('Testing Egyptian address and name parsing in checkout...');

// 1. Nada Elwy multi-line
const nadaMulti = `ندا علوي أحمد 
01022469615
الإسماعيلية أرض الجمعيات ميدان فوكس`;
const p1 = parseVolunteeredDeliveryDetails(nadaMulti);
assert(p1 && p1.name === 'ندا علوي أحمد', 'Nada name extracted correctly');
assert(p1.phone === '01022469615', 'Nada phone extracted correctly');
assert(p1.address.includes('أرض الجمعيات'), 'Nada address extracted correctly');
assert(isUsableDeliveryAddress(p1.address), 'Nada address accepted as usable');

// 2. Nada Elwy single-line
const nadaSingle = 'ندا علوي أحمد 01022469615 الإسماعيلية أرض الجمعيات ميدان فوكس';
const p2 = parseVolunteeredDeliveryDetails(nadaSingle);
assert(p2 && p2.name === 'ندا علوي أحمد', 'Nada single-line name extracted');
assert(p2.phone === '01022469615', 'Nada single-line phone extracted');
assert(isUsableDeliveryAddress(p2.address), 'Nada single-line address accepted');

// 3. Asmaa Ramadan multi-line
const asmaaMulti = `اسماء رمضان عبد المطلب
01094738384
الفيوم سنورس قريه ترسا عند دهدوره نقاليفه عند فيلا المستشار اشرف عويس`;
const p3 = parseVolunteeredDeliveryDetails(asmaaMulti);
assert(p3 && p3.name === 'اسماء رمضان عبد المطلب', 'Asmaa name extracted');
assert(p3.phone === '01094738384', 'Asmaa phone extracted');
assert(isUsableDeliveryAddress(p3.address), 'Asmaa address accepted');

// 4. Name should not swallow entire line with address keywords
assert(!looksLikePersonName('ندا علوي أحمد الإسماعيلية أرض الجمعيات ميدان فوكس'), 'Address blob rejected as name');

console.log('ALL TESTS PASSED ✅');
