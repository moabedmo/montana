/**
 * "بيفتح؟" after post-laser cream pitch must answer from context.
 * Run: node scripts/test-whitening-effect-ask.js
 */
process.env.GEMINI_API_KEY = process.env.GEMINI_API_KEY || 'x';
const {
  regexFallbackIntent,
  isWhiteningEffectAsk,
  isSoftDisagreement,
  resolveWhiteningAskProductKey,
  formatWhiteningEffectReply,
} = require('../lib/chatEngine');

let failed = 0;
function assert(cond, label) {
  if (!cond) {
    failed += 1;
    console.error('FAIL:', label);
  } else {
    console.log('ok:', label);
  }
}

assert(isWhiteningEffectAsk('بيفتح ؟'), 'detect بيفتح');
assert(isWhiteningEffectAsk('بيفتح'), 'detect بيفتح bare');
assert(isWhiteningEffectAsk('يفتح التصبغات'), 'detect يفتح التصبغات');
assert(!isWhiteningEffectAsk('بكام'), 'بكام is not whitening ask');
assert(isSoftDisagreement('ولالا'), 'ولالا soft disagreement');
assert(isSoftDisagreement('لا لا'), 'لا لا soft disagreement');

assert(regexFallbackIntent('بيفتح ؟').intent === 'ASK_WHITENING_EFFECT', 'fallback intent');

const pitch = [
  { role: 'model', text: 'أهلاً بيكِ 🌿\nكريم العناية بعد الليزر سعره 369 جنيه.\nللتهيّج والاحمرار بعد جلسات الليزر، وللإحساس بالحرقان.' },
];
assert(
  resolveWhiteningAskProductKey('بيفتح ؟', pitch, null) === 'post-laser-cream',
  'context after post-laser pitch'
);
assert(
  resolveWhiteningAskProductKey('بيفتح ؟', [], 'post-laser-cream') === 'post-laser-cream',
  'sticky slug'
);

const reply = formatWhiteningEffectReply('post-laser-cream');
assert(/مش بديل كريم التفتيح/.test(reply), 'post-laser reply clarifies not whitening cream');
assert(/618/.test(reply), 'mentions post-laser offer');
assert(/أيوه/.test(formatWhiteningEffectReply('whitening-cream')), 'whitening cream is yes');

if (failed) {
  console.error(`\n${failed} failed`);
  process.exit(1);
}
console.log('\nPASS whitening effect ask');
