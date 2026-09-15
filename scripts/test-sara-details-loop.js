/**
 * Sara Hamed, 12 Sep. She complained about an order, the bot handed her the
 * support number, she said "طالما مش متسجل اطلبي واحد", and the bot answered:
 *
 *   "تمام يا فندم، أنا هسجلك أوردر جديد لكريم التفتيح 💜
 *    عشان أكمل الأوردر، ممكن بعد إذنك تقوليلي الاسم كامل، ورقم الموبايل،
 *    والعنوان بالتفصيل؟"
 *
 * She sent all three. The bot asked again. She sent them again. It asked again.
 * Three times, and no order was ever placed.
 *
 * The parser was never the problem — it reads her message perfectly. The
 * problem was that nothing called it: the one live handler for volunteered
 * details required a non-empty cart, and the bot had promised the order
 * without putting anything in one. The other three handlers that would have
 * caught it all sit inside the `!skipScriptedMaze` block and never run.
 *
 * Run: node scripts/test-sara-details-loop.js
 */
process.env.GEMINI_API_KEY = process.env.GEMINI_API_KEY || 'x';
const {
  parseVolunteeredDeliveryDetails,
  looksLikeVolunteeredDeliveryDetails,
  isUsableDeliveryAddress,
  looksLikePersonName,
} = require('../lib/chatEngine');

let failed = 0;
function assert(cond, label) {
  if (!cond) { failed += 1; console.error('FAIL:', label); } else { console.log('ok:', label); }
}

// Exactly what she typed — three bare lines, no labels of any kind.
const SARA = [
  'ساره حامد جلال حامد',
  '01099691458',
  '٢٤ شارع محمد نوفل الساحل شبرا مصر محافظة القاهره الدور التالت الشقه الي في وش السلم',
].join('\n');

assert(looksLikeVolunteeredDeliveryDetails(SARA), 'her message is recognised as details');

const parsed = parseVolunteeredDeliveryDetails(SARA);
assert(!!parsed, 'it parses at all');
assert(parsed?.phone === '01099691458', 'phone: ' + parsed?.phone);
assert(looksLikePersonName(parsed?.name), 'name is a person: ' + parsed?.name);
assert(/حامد/.test(parsed?.name || ''), 'name is hers, not a fragment: ' + parsed?.name);
assert(!/\d/.test(parsed?.name || ''), 'the phone did not leak into the name');
assert(isUsableDeliveryAddress(parsed?.address), 'address is usable');
assert(/شبرا/.test(parsed?.address || ''), 'address kept the area: ' + parsed?.address);
assert(/التالت|الدور/.test(parsed?.address || ''), 'address kept the floor');

// Same details with the labels some customers add, and with Western digits —
// both shapes have to land in the same place.
const LABELLED = 'الاسم: ساره حامد جلال حامد\nالموبايل: 01099691458\nالعنوان: 24 شارع محمد نوفل الساحل شبرا محافظة القاهرة';
assert(looksLikeVolunteeredDeliveryDetails(LABELLED), 'labelled version is recognised');
const p2 = parseVolunteeredDeliveryDetails(LABELLED);
assert(p2?.phone === '01099691458', 'labelled phone: ' + p2?.phone);
assert(!/الاسم|الموبايل|العنوان/.test(p2?.name || ''), 'labels stripped from the name: ' + p2?.name);

// ── the guard that actually broke ──
// The live handler is gated on the cart, so the seeding step that fills it has
// to exist and has to run before that gate.
const fs = require('fs');
const src = fs.readFileSync(require('path').join(__dirname, '..', 'lib', 'chatEngine.js'), 'utf8');
const lines = src.split('\n');

const seedAt = lines.findIndex((l) => l.includes('await seedCartFromPromisedProduct('));
const gateAt = lines.findIndex((l) => l.includes("if ((sessionCarts[sid] || []).length && looksLikeVolunteeredDeliveryDetails(message))"));
assert(seedAt !== -1, 'the cart is seeded from the promised product');
assert(gateAt !== -1, 'the cart-gated checkout call is still there');
assert(seedAt !== -1 && gateAt !== -1 && seedAt < gateAt, 'seeding runs BEFORE the cart gate');

const fallbackAt = lines.findIndex((l) => l.includes('Still nothing to attach them to'));
assert(fallbackAt !== -1, 'details are kept even when no product can be resolved');

/** The conditions a given line sits inside, innermost first. */
function enclosing(lineIndex) {
  let depth = 0;
  const out = [];
  for (let i = lineIndex; i >= 0 && out.length < 6; i--) {
    const line = lines[i];
    for (let j = line.length - 1; j >= 0; j--) {
      if (line[j] === '}') depth += 1;
      else if (line[j] === '{') {
        if (depth === 0) out.push(line.trim());
        else depth -= 1;
      }
    }
  }
  return out;
}
// Only `!skipScriptedMaze` is the dead block. These three sit inside
// `if (isLlmFirstEnabled() && message)`, which is the opposite — that is the
// branch production actually takes.
for (const [label, idx] of [['seeding', seedAt], ['cart gate', gateAt], ['fallback', fallbackAt]]) {
  if (idx === -1) continue;
  const enc = enclosing(idx);
  const dead = enc.find((l) => /skipScriptedMaze/.test(l));
  assert(!dead, `${label} is NOT inside the skipped block`);
  assert(
    enc.some((l) => /isLlmFirstEnabled\(\)/.test(l)),
    `${label} is inside the LLM-first branch production runs`
  );
}

if (failed) { console.error(`\n${failed} test(s) failed`); process.exit(1); }
console.log('\nall passed');
