const fs = require('fs');
const path = require('path');

// 1. Fix lib/adOffers.js
const adOffersPath = path.join(__dirname, '..', 'lib', 'adOffers.js');
let adCode = fs.readFileSync(adOffersPath, 'utf8');
const adCRLF = adCode.includes('\r\n');
if (adCRLF) adCode = adCode.replace(/\r\n/g, '\n');

const oldAllOrdinals = `function resolveAllBundlesFromOrdinals(message) {
  const t = soft(String(message || '').trim()).replace(/-/g, ' ');
  if (!t) return [];`;

const newAllOrdinals = `function resolveAllBundlesFromOrdinals(message) {
  const t = soft(String(message || '').trim()).replace(/-/g, ' ');
  if (!t) return [];
  // Delivery addresses / contact info must NEVER be parsed as bundle ordinals
  if (/(شارع|ش\\.|برج|عمارة|عقار|دور|شقة|محافظة|ميدان|بلوك|سوبر\\s*ماركت|01\\d{9})/i.test(t)) return [];`;

if (!adCode.includes(oldAllOrdinals)) {
  console.error('adOffers target not found!');
  process.exit(1);
}
adCode = adCode.replace(oldAllOrdinals, newAllOrdinals);

// Also fix the digit matching in resolveAllBundlesFromOrdinals
const oldDigitCheck = `  // Detect ordinals by phrase (avoid bare digits matching year/phone)
  if (/(العرض|الروتين)?\\s*(الاول|الأول|اول|الأولاني|اولاني)|عرض\\s*(الاول|الأول|اول)|(^|\\s)(1|١)(\\s|$)/.test(t)
    && /(عرض|روتين|عايز|عاوز|اول|تاني|تالت|و|رقم)/.test(t)) {
    push(BUNDLES[0]);
  } else if (/(^|\\s)(الاول|الأول|اولاني|الأولاني)(\\s|$|و|,|،)/.test(t)) {
    push(BUNDLES[0]);
  }

  if (/(العرض|الروتين)?\\s*(التاني|الثاني|تاني)|عرض\\s*(التاني|الثاني|تاني)|(^|\\s)(2|٢)(\\s|$)/.test(t)
    && /(عرض|روتين|عايز|عاوز|اول|تاني|تالت|و|رقم)/.test(t)) {
    push(BUNDLES[1]);
  } else if (/(^|\\s)(التاني|الثاني|تاني)(\\s|$|و|,|،)/.test(t)) {
    push(BUNDLES[1]);
  }

  if (/(العرض|الروتين)?\\s*(التالت|الثالث|تالت)|عرض\\s*(التالت|الثالث|تالت)|(^|\\s)(3|٣)(\\s|$)/.test(t)
    && /(عرض|روتين|عايز|عاوز|اول|تاني|تالت|و|رقم)/.test(t)) {
    push(BUNDLES[2]);
  } else if (/(^|\\s)(التالت|الثالث|تالت)(\\s|$|و|,|،)/.test(t)) {
    push(BUNDLES[2]);
  }`;

const newDigitCheck = `  // Detect ordinals by phrase (avoid bare digits matching address/date/phone)
  if (/(العرض|الروتين)?\\s*(الاول|الأول|اول|الأولاني|اولاني)|عرض\\s*(الاول|الأول|اول)|(عرض|روتين|رقم)\\s*(1|١)|(^|\\s)(1|١)\\s*(عرض|روتين)/.test(t)) {
    push(BUNDLES[0]);
  } else if (/(^|\\s)(الاول|الأول|اولاني|الأولاني)(\\s|$|و|,|،)/.test(t)) {
    push(BUNDLES[0]);
  }

  if (/(العرض|الروتين)?\\s*(التاني|الثاني|تاني)|عرض\\s*(التاني|الثاني|تاني)|(عرض|روتين|رقم)\\s*(2|٢)|(^|\\s)(2|٢)\\s*(عرض|روتين)/.test(t)) {
    push(BUNDLES[1]);
  } else if (/(^|\\s)(التاني|الثاني|تاني)(\\s|$|و|,|،)/.test(t)) {
    push(BUNDLES[1]);
  }

  if (/(العرض|الروتين)?\\s*(التالت|الثالث|تالت)|عرض\\s*(التالت|الثالث|تالت)|(عرض|روتين|رقم)\\s*(3|٣)|(^|\\s)(3|٣)\\s*(عرض|روتين)/.test(t)) {
    push(BUNDLES[2]);
  } else if (/(^|\\s)(التالت|الثالث|تالت)(\\s|$|و|,|،)/.test(t)) {
    push(BUNDLES[2]);
  }`;

if (!adCode.includes(oldDigitCheck)) {
  console.error('adOffers digitCheck target not found!');
  process.exit(1);
}
adCode = adCode.replace(oldDigitCheck, newDigitCheck);

if (adCRLF) adCode = adCode.replace(/\n/g, '\r\n');
fs.writeFileSync(adOffersPath, adCode, 'utf8');
console.log('Fixed lib/adOffers.js!');

// 2. Fix lib/chatEngine.js formatRoutineUsageReply signature & calls
const enginePath = path.join(__dirname, '..', 'lib', 'chatEngine.js');
let engCode = fs.readFileSync(enginePath, 'utf8');
const engCRLF = engCode.includes('\r\n');
if (engCRLF) engCode = engCode.replace(/\r\n/g, '\n');

const oldUsageDef = `function formatRoutineUsageReply(sid, chatHistory, message = '') {
  const cart = sessionCarts[sid] || [];
  const cartBundle = cart.find((i) => i?.isBundle || String(i?.id || '').startsWith('bundle:'));
  const lastBot = lastModelMessage(chatHistory);
  const t = prepareCustomerText(expandFrancoAndTypos(message));
  const activeSlug = selectedProductSlug || (cart.length === 1 && !cart[0].isBundle ? cart[0].slug : null);`;

const newUsageDef = `function formatRoutineUsageReply(sid, chatHistory, message = '', productSlugHint = null) {
  const cart = sessionCarts[sid] || [];
  const cartBundle = cart.find((i) => i?.isBundle || String(i?.id || '').startsWith('bundle:'));
  const lastBot = lastModelMessage(chatHistory);
  const t = prepareCustomerText(expandFrancoAndTypos(message));
  const activeSlug = productSlugHint || (cart.length === 1 && !cart[0].isBundle ? cart[0].slug : null);`;

if (!engCode.includes(oldUsageDef)) {
  console.error('chatEngine usageDef target not found!');
  process.exit(1);
}
engCode = engCode.replace(oldUsageDef, newUsageDef);

// Update calls to formatRoutineUsageReply inside handleInboundMessage
engCode = engCode.replace(
  'return formatRoutineUsageReply(sid, chatHistory, message);',
  'return formatRoutineUsageReply(sid, chatHistory, message, selectedProductSlug);'
);
engCode = engCode.replace(
  'return finish(formatRoutineUsageReply(sid, chatHistory, message), message);',
  'return finish(formatRoutineUsageReply(sid, chatHistory, message, selectedProductSlug), message);'
);

if (engCRLF) engCode = engCode.replace(/\n/g, '\r\n');
fs.writeFileSync(enginePath, engCode, 'utf8');
console.log('Fixed lib/chatEngine.js formatRoutineUsageReply!');
