/**
 * The routine-offers list runs ~426 chars — just over the 420-char brief cap,
 * so enforceBriefReply() was silently cutting the THIRD offer off and the
 * customer only ever saw two of the three routines.
 *
 * Run: node scripts/test-offers-list-not-truncated.js
 */
process.env.GEMINI_API_KEY = process.env.GEMINI_API_KEY || 'x';
const { enforceBriefReply } = require('../lib/chatEngine');
const { formatAllRoutineOffersList } = require('../lib/adOffers');

let failed = 0;
function assert(cond, label) {
  if (!cond) { failed += 1; console.error('FAIL:', label); } else { console.log('ok:', label); }
}

// Every intro the engine uses must survive the cap with all three prices intact
const intros = [
  null,
  'العروض المتاحة يا فندم (**شحن مجاني** على كل عرض):',
  'تحبي سعر أنهي عرض يا فندم؟ (**شحن مجاني** على كل عرض):',
  'تحت أمرك يا فندم 💜 دي عروض الروتين — قوليلي أنهي واحد وأسجّله على طول:',
  'أهلاً بيكِ يا فندم 🌿 دي كل عروض الروتين المتاحة عندنا دلوقتي، اختاري اللي يناسب بشرتك:',
];

for (const intro of intros) {
  const raw = intro ? formatAllRoutineOffersList(intro) : formatAllRoutineOffersList();
  const out = enforceBriefReply(raw);
  const label = intro ? intro.slice(0, 34) + '…' : '(default header)';
  assert(/618/.test(out), `618 survives — ${label}`);
  assert(/777/.test(out), `777 survives — ${label}`);
  assert(/558/.test(out), `558 survives — ${label}`);
}

// The cap must still work on ordinary long replies
const rambling = 'كلام كتير جدًا. '.repeat(60);
assert(enforceBriefReply(rambling).length < rambling.length, 'the brief cap still trims rambling replies');

if (failed) { console.error(`\n${failed} test(s) failed`); process.exit(1); }
console.log('\nall passed');
