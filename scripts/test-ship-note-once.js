/**
 * Owner's rule: "الشحن مجاني من 3 منتجات" is said ONCE per conversation —
 * after every price it reads as pushy, never saying it loses the upsell.
 *
 * Run: node scripts/test-ship-note-once.js
 */
process.env.GEMINI_API_KEY = process.env.GEMINI_API_KEY || 'x';
const { applyShipFrom3NoteOnce, mentionsShipFrom3 } = require('../lib/chatEngine');

let failed = 0;
function assert(cond, label) {
  if (!cond) { failed += 1; console.error('FAIL:', label); } else { console.log('ok:', label); }
}

const priceReply = 'غسول التفتيح سعره 299 جنيه يا فندم 💜';

// ── first time: the note is added ──
const first = applyShipFrom3NoteOnce(priceReply, []);
assert(mentionsShipFrom3(first), 'first unit price gets the note');
assert(first.startsWith(priceReply), 'original reply is preserved');

// ── second time: not repeated ──
const history = [{ role: 'model', text: first }];
const second = applyShipFrom3NoteOnce('كريم التفتيح سعره 249 جنيه', history);
assert(!mentionsShipFrom3(second), 'second unit price does NOT repeat the note');

// ── a model reply that repeats it on its own gets the repeat trimmed ──
const modelRepeat = 'كريم التفتيح سعره 249 جنيه\n\nالشحن مجاني من 3 منتجات 🎁';
const trimmed = applyShipFrom3NoteOnce(modelRepeat, history);
assert(!mentionsShipFrom3(trimmed), 'model repeat is stripped');
assert(/249/.test(trimmed), 'the price survives the strip');

// ── it must not attach where it would be noise ──
assert(
  !mentionsShipFrom3(applyShipFrom3NoteOnce('روتين التفتيح الكامل بـ 777 جنيه — الشحن مجاني', [])),
  'routine offers (already free shipping) get no note'
);
assert(
  !mentionsShipFrom3(applyShipFrom3NoteOnce('تم تسجيل أوردرك ✅ رقم الطلب MON-12345 — الإجمالي 249 جنيه', [])),
  'order confirmation gets no note'
);
assert(
  !mentionsShipFrom3(applyShipFrom3NoteOnce('ابعتيلي العنوان بالتفصيل والمحافظة — الإجمالي 299', [])),
  'checkout collection gets no note'
);
assert(
  !mentionsShipFrom3(applyShipFrom3NoteOnce('أهلاً بيكِ في مونتانا 🌿 تحبي تعرفي إيه؟', [])),
  'a reply with no price gets no note'
);

// ── if the model already said it this turn, do not double it ──
const already = 'غسول التفتيح 299 جنيه — والشحن مجاني من 3 منتجات';
assert(applyShipFrom3NoteOnce(already, []) === already, 'no double note when the model already said it');

// ── empty / missing input ──
assert(applyShipFrom3NoteOnce('', []) === '', 'empty reply is untouched');
assert(applyShipFrom3NoteOnce(null, []) === null, 'null reply is untouched');

if (failed) { console.error(`\n${failed} test(s) failed`); process.exit(1); }
console.log('\nall passed');
