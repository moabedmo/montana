/**
 * "تحت الإبط غامق" and friends must reach the whitening cream, with the
 * brightening routine offered as the stronger option — never the post-laser
 * cream, and never a bare price.
 *
 * The exclusion list here is the interesting part. It was written as bare
 * substrings, so "الم" matched inside "المناطق" and silently rejected
 * "تفتيح المناطق الحساسة" — the exact message it exists to serve. Whole-word
 * boundaries are the fix and these cases are why.
 *
 * Run: node scripts/test-dark-area-brightening.js
 */
process.env.GEMINI_API_KEY = process.env.GEMINI_API_KEY || 'x';
const {
  isDarkAreaBrighteningAsk,
  darkAreaBrighteningReply,
  deniesDoingLaser,
} = require('../lib/chatEngine');

let failed = 0;
function assert(cond, label) {
  if (!cond) { failed += 1; console.error('FAIL:', label); } else { console.log('ok:', label); }
}

// ── she wants a dark area lightened ──
[
  'تفتيح الاماكن الحساسه',
  'تفتيح المناطق الحساسة',
  'المناطق الحساسه عايزة اليها حاجه',
  'عايزة تفتيح الذراع',
  'نا عايزه تحت الابط',
  'عندي الاندر ارم غامق',
  'انا مش بعمل ليزر بس عندي الاندر ارم غامق',
  'تفتيح البيكيني',
  'الاكواع والركب غامقين',
].forEach((m) => assert(isDarkAreaBrighteningAsk(m), 'handled: ' + m));

// ── an area named for a reason that isn't ours ──
[
  'تحت الابط بيحك',
  'عايزة ازالة شعر تحت الابط',
  'تحت الابط بيوجعني',
  'تحت الابط فيه الم',
  'تحت الابط ريحته وحشة',
].forEach((m) => assert(!isDarkAreaBrighteningAsk(m), 'not ours: ' + m));

// ── ordinary conversation must pass through ──
[
  'بشرتي حساسة',
  'عايزة اطلب',
  'كريم التفتيح بكام',
  'الشحن بكام',
  'السلام عليكم',
].forEach((m) => assert(!isDarkAreaBrighteningAsk(m), 'untouched: ' + m));

// ── the reply ──
const reply = darkAreaBrighteningReply();
assert(/249/.test(reply), 'offers the whitening cream at 249');
assert(/777/.test(reply), 'offers the routine at 777 as the stronger option');
assert(!/369/.test(reply) && !/ليزر/.test(reply), 'never mentions the post-laser cream');
assert(/تحبي/.test(reply), 'ends by asking her to choose');

// ── laser denial: the combined message belongs to the area answer ──
const combined = 'انا مش بعمل ليزر بس عندي الاندر ارم غامق';
assert(deniesDoingLaser(combined), 'the denial is still detected');
assert(isDarkAreaBrighteningAsk(combined), 'but the area answer takes it');
assert(deniesDoingLaser('مش بعمل ليزر'), 'a bare denial is detected');
assert(!isDarkAreaBrighteningAsk('مش بعمل ليزر'), 'a bare denial is NOT an area ask');
assert(!deniesDoingLaser('عايزة كريم بعد الليزر'), 'wanting the laser cream is not a denial');

if (failed) { console.error(`\n${failed} test(s) failed`); process.exit(1); }
console.log('\nall passed');
