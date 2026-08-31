/**
 * Owner's rule: an order that didn't arrive, or any problem with an order,
 * must NOT be handled by the bot — no phone lookup, no back-and-forth. It
 * hands over the customer service number and stops.
 *
 * Run: node scripts/test-order-issue-to-cs.js
 */
process.env.GEMINI_API_KEY = process.env.GEMINI_API_KEY || 'x';
const {
  isOrderProblemComplaint,
  wantsExistingOrderHelp,
  orderIssueCsReply,
  CS_SUPPORT_PHONE,
} = require('../lib/orderContext');

let failed = 0;
function assert(cond, label) {
  if (!cond) { failed += 1; console.error('FAIL:', label); } else { console.log('ok:', label); }
}

const handled = (m) => wantsExistingOrderHelp(m) || isOrderProblemComplaint(m);

// ── everything the owner described must reach customer service ──
[
  'الاوردر موصلش',
  'الأوردر مش واصل',
  'فين اوردري',
  'عندي مشكلة في الاوردر',
  'الطلب وصل ناقص',
  'الاوردر جه مكسور',
  'الاوردر اتأخر',
  'طلبي متأخر من اسبوع',
  'عايزة ارجع الاوردر',
  'الاوردر غلط مش ده اللي طلبته',
  'الشحنة لسه ما جاش',
  'عايزة اشتكي من الطلب',
].forEach((m) => assert(handled(m), 'goes to CS: ' + m));

// ── must NOT swallow ordinary sales conversation ──
[
  'عايزة اطلب روتين التفتيح',
  'اسعار منتجات مونتانا',
  'الشحن بكام',
  'عندي مشكلة في بشرتي',
  'بشرتي فيها حبوب',
  'الكريم بيعمل مشاكل للبشرة الحساسة؟',
  'سلمى محمود حسن',
  '01102354774',
].forEach((m) => assert(!handled(m), 'stays in normal chat: ' + m));

// ── the reply itself ──
const reply = orderIssueCsReply();
assert(reply.includes(CS_SUPPORT_PHONE), 'reply carries the CS number');
assert(reply.includes('01019787225'), 'CS number is 01019787225');
assert(reply.length < 260, 'reply is short — no rambling: ' + reply.length + ' chars');
assert(!/رقم\s*(ال)?موبايل/i.test(reply), 'reply does NOT ask for her phone');
assert(!/(اطلبي|تحبي\s*تطلبي|عروض|روتين)/i.test(reply), 'reply does not try to sell');

// ── the engine must actually short-circuit, not fall through to a lookup ──
const engine = require('fs').readFileSync(require('path').join(__dirname, '..', 'lib', 'chatEngine.js'), 'utf8');
const guard = engine.indexOf('if (shouldLookup && !(orderWizard && !inStatusLookup)) {');
assert(guard !== -1, 'lookup guard found in engine');
const after = engine.slice(guard, guard + 500);
assert(/orderIssueCsReply\(\)/.test(after), 'guard returns the CS reply');
assert(!/fetchPhoneOrders/.test(after), 'guard no longer runs a phone lookup');
assert(/needsHuman: true/.test(after), 'guard flags the conversation for a human');

// ── and it must run OUTSIDE the scripted maze ──
// The first version of this fix lived under `if (!skipScriptedMaze && message)`,
// which LLM-first skips entirely — so it never ran and Gemini answered instead.
const lines = engine.split('\n');
const checkLine = lines.findIndex((l) => l.includes('Order problem / late delivery → hand straight'));
assert(checkLine !== -1, 'the early order-problem check exists');

let depth = 0;
const enclosing = [];
for (let i = checkLine; i >= 0 && enclosing.length < 3; i--) {
  const line = lines[i];
  for (let j = line.length - 1; j >= 0; j--) {
    if (line[j] === '}') depth += 1;
    else if (line[j] === '{') {
      if (depth === 0) enclosing.push(line.trim());
      else depth -= 1;
    }
  }
}
assert(
  !enclosing.some((l) => /skipScriptedMaze|isLlmFirstEnabled/.test(l)),
  'check is NOT nested inside the scripted maze / llm-first branch'
);

const mazeStart = engine.indexOf('if (!skipScriptedMaze && message) {');
const earlyCheckAt = engine.indexOf('Order problem / late delivery → hand straight');
assert(mazeStart === -1 || earlyCheckAt < mazeStart, 'check runs before the scripted maze');

if (failed) { console.error(`\n${failed} test(s) failed`); process.exit(1); }
console.log('\nall passed');
