/**
 * Regression: the bot re-asked for the phone/address the customer had
 * already sent, forever.
 *
 * harvestSeedFromRecentUserTurns() read `chatSessions[sid].history`, but that
 * map holds the Gemini ChatSession, whose turns live on a private `_history`.
 * So it always harvested {} and beginChatCheckoutCollection restarted from
 * scratch on every turn. It must read the PERSISTED history instead.
 *
 * Run: node scripts/test-harvest-seed-from-history.js
 */
process.env.GEMINI_API_KEY = process.env.GEMINI_API_KEY || 'x';
const { harvestSeedFromHistory, isUsableDeliveryAddress } = require('../lib/chatEngine');

let failed = 0;
function assert(cond, label) {
  if (!cond) {
    failed += 1;
    console.error('FAIL:', label);
  } else {
    console.log('ok:', label);
  }
}

// Shape written by chatSessionStore.appendHistory()
const history = [
  { role: 'user', text: 'عايزة اطلب روتين التفتيح' },
  { role: 'model', text: 'تمام يا فندم ✍️ ابعتيلي في رسالة واحدة...' },
  { role: 'user', text: 'سلمى محمود حسن' },
  { role: 'model', text: 'تشرفنا يا سلمى 💜' },
  { role: 'user', text: '01102000000' },
  { role: 'model', text: 'ابعتي العنوان بالتفصيل' },
  { role: 'user', text: '٢٧ ش النيل امام بلوك ٩ مساكن الهرم' },
  { role: 'model', text: 'تمام' },
  { role: 'user', text: 'محافظه الجيزه' },
];

const seed = harvestSeedFromHistory(history);
assert(seed.phone === '01102000000', 'phone recovered from history: ' + seed.phone);
assert(!!seed.address && isUsableDeliveryAddress(seed.address), 'address recovered + usable: ' + seed.address);
assert(seed.name === 'سلمى محمود حسن', 'name recovered from history: ' + seed.name);

// Arabic-Indic digits in the phone must still be recovered
const arabicDigits = [{ role: 'user', text: '٠١١٠٢٠٠٠٠٠٠' }];
assert(!!harvestSeedFromHistory(arabicDigits).phone, 'arabic-indic phone digits recovered');

// The Gemini ChatSession shape must never be treated as history again
const geminiChatLike = { _history: [{ role: 'user', parts: [{ text: '01102000000' }] }] };
assert(
  Object.keys(harvestSeedFromHistory(geminiChatLike.history)).length === 0,
  'undefined history harvests nothing (no crash)'
);
assert(Object.keys(harvestSeedFromHistory(null)).length === 0, 'null history harvests nothing');
assert(Object.keys(harvestSeedFromHistory([])).length === 0, 'empty history harvests nothing');

// Model turns must never be mistaken for customer-supplied details
const botOnly = [{ role: 'model', text: 'ابعتي رقم الموبايل 01000000000 والعنوان' }];
assert(!harvestSeedFromHistory(botOnly).phone, 'phone in a BOT turn is not harvested');

if (failed) {
  console.error(`\n${failed} test(s) failed`);
  process.exit(1);
}
console.log('\nall passed');
