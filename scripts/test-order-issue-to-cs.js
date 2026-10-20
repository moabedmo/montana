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
  isOrderExchangeRequest,
  orderIssueCsReply,
  orderExchangeCsReply,
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

// ── asking to swap something in an order that is ALREADY placed ──
// Doha wrote "أنا اتلغبطت وطلبت من الويب سايت … وأنا محتاجه ال whitening
// cleanser", then "أنا كنت عاملة الاوردر امبارح فعايزه ابدله". Neither matched:
// the first has an order word but no problem word the detector knew (it knows
// "غلط", not "اتلغبطت"), the second has "ابدله" where the detector only knew
// "استبدال". Both fell to the model, which asked for her phone and then started
// a checkout read-back for an order she had already placed.
[
  'أنا اتلغبطت وطلبت من الويب سايت بتاعكوا الغسول بتاع البشرة المعرضة للحبوب وأنا محتاجه ال montana whitening cleanser',
  'أنا كنت عاملة الاوردر امبارح فعايزه ابدله',
  'عملت اوردر امبارح وعايزة اغير المنتج',
  'طلبت الغسول بالغلط عايزة ابدله بغسول التفتيح',
  'ممكن استبدل الكريم اللي طلبته من الموقع',
  'كنت عاملة اوردر وعايزة اعدله',
].forEach((m) => assert(isOrderExchangeRequest(m), 'exchange of a placed order goes to CS: ' + m));

// "بدل" and "طلبت" are everyday sales words. None of these is an exchange.
[
  'عايزة ابدل الكريم بالغسول',                       // editing what she is choosing
  'غيري الاوردر بقى غسول التفتيح',                   // cart edit — no order placed yet
  'طلبت قبل كده وعايزة اطلب تاني',                   // reorder, not a swap
  'السعر بدل 300 بقى 249؟',                          // a price
  'اتلغبطت في الاسم',                                 // a typo, nothing placed
  'عايزة كريم بدل الغسول',
  'طلبت امبارح',                                      // placed, but nothing she wants changed
  'عايزة اطلب غسول التفتيح',
].forEach((m) => assert(!isOrderExchangeRequest(m), 'stays in normal chat: ' + m));

// ── the reply itself ──
const reply = orderIssueCsReply();
assert(reply.includes(CS_SUPPORT_PHONE), 'reply carries the CS number');
assert(reply.includes('01210021115'), 'CS number is 01210021115');
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

// ── the exchange reply ──
const exReply = orderExchangeCsReply();
assert(exReply.includes('01210021115'), 'exchange reply carries the CS number');
assert(exReply.length < 280, 'exchange reply is short: ' + exReply.length + ' chars');
assert(!/رقم\s*(ال)?موبايل/i.test(exReply), 'exchange reply does NOT ask for her phone');
assert(!/(618|777|558|اطلبي|تحبي\s*تطلبي|عروض|روتين)/i.test(exReply), 'exchange reply does not sell');

// ── and the handoff must stop the bot answering the follow-ups ──
// Doha's next three messages — a phone number, a second phone number, an order
// number — were each answered as if they were a fresh order lookup ("مفيش أوردر
// متسجل بالرقم ده"), while the owner was already handling her by hand. Handing a
// customer to a person and then carrying on talking is the bug; the handoff has
// to pause the bot, the way an explicit "عايزة اكلم حد" already does.
const blockEnd = engine.indexOf('"عايزة أطلب" with nothing chosen yet', earlyCheckAt);
const block = engine.slice(earlyCheckAt, blockEnd > earlyCheckAt ? blockEnd : earlyCheckAt + 2500);
assert(/isOrderExchangeRequest\(message\)/.test(block), 'the early block checks for an exchange request');
assert(/stampBotPaused\(chatHistory\)/.test(block), 'the early block pauses the bot after handing over');
assert(/botPaused: true/.test(block), 'the handoff reply is flagged botPaused');
assert(/needsHuman: true/.test(block), 'the handoff is still flagged needsHuman');

if (failed) { console.error(`\n${failed} test(s) failed`); process.exit(1); }
console.log('\nall passed');
