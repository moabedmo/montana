/**
 * Owner's rule: find out what the customer wants before quoting anything.
 *
 * The bot used to open by reciting all three routines with their prices —
 * on the first hello, on a bare "بكام؟", on "عايزة اطلب", and on any photo it
 * could not read. That answers a question she has not asked yet and reads like
 * a flyer rather than someone helping her.
 *
 * She tells us what she wants in one of three ways: she names a product, she
 * names an offer, or she sends a photo of the ad or the product. Each of those
 * is answered directly, with a real price. Everything else asks first.
 *
 * The full priced list is not gone — it is what she gets when she actually
 * asks for it ("إيه العروض عندكم؟"). That is her choosing it, not us leading.
 *
 * Run: node scripts/test-ask-before-listing.js
 */
process.env.GEMINI_API_KEY = process.env.GEMINI_API_KEY || 'x';
const {
  askWhatSheNeedsReply,
  whichOfferPriceAskReply,
  imageOffersReply,
  routinesWelcomeReply,
  emptyCartOfferRoutinesReply,
} = require('../lib/chatEngine');

let failed = 0;
function assert(cond, label) {
  if (!cond) { failed += 1; console.error('FAIL:', label); } else { console.log('ok:', label); }
}

/** Any routine or unit price appearing in a reply. */
const PRICE = /\b(777|699|618|549|558|499|249|299|329|369|229|950)\b/;
/** Reads as a question to her, not a recital at her. */
const ASKS = /(قوليلي|عايزة|تحبي|أنهي|إيه)/;

const quiet = [
  ['first hello / ad open', routinesWelcomeReply()],
  ['bare "بكام؟"', whichOfferPriceAskReply()],
  ['a photo we could not read', imageOffersReply()],
  ['generic ask-what-she-needs', askWhatSheNeedsReply()],
];

for (const [label, reply] of quiet) {
  assert(!PRICE.test(reply), `no prices when we do not know yet: ${label}`);
  assert(ASKS.test(reply), `asks her instead of reciting: ${label}`);
  assert(reply.length < 320, `stays short: ${label} (${reply.length} chars)`);
}

// Nothing in the quiet replies should enumerate the three routines.
for (const [label, reply] of quiet) {
  const named = ['عناية ما بعد الليزر', 'روتين التفتيح الكامل', 'عناية الوش والجسم']
    .filter((n) => reply.includes(n));
  assert(named.length === 0, `does not list the routines: ${label}`);
}

// ...but the list still exists for when she asks for it by name.
const list = emptyCartOfferRoutinesReply();
assert(PRICE.test(list), 'the explicit offers list still carries prices');
assert(/618|777|558/.test(list), 'the explicit offers list still names the routines');

// The engine must not have kept a second, forgotten list builder wired to the
// bare-price path — that is exactly how this survived the first pass.
const fs = require('fs');
const path = require('path');
const src = fs.readFileSync(path.join(__dirname, '..', 'lib', 'chatEngine.js'), 'utf8');
const listCalls = (src.match(/formatAllRoutineOffersList\(/g) || []).length;
assert(
  listCalls <= 2,
  `formatAllRoutineOffersList is called ${listCalls}x — one import, one explicit-ask site`
);

if (failed) { console.error(`\n${failed} test(s) failed`); process.exit(1); }
console.log('\nall passed');
