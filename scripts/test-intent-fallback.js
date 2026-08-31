/**
 * Smoke checks for intent-first routing (regex fallback when Gemini is OTHER/fail).
 * Run: node scripts/test-intent-fallback.js
 */
const {
  regexFallbackIntent,
  resolveEffectiveIntent,
} = require('../lib/chatEngine');
const {
  isOfferOrdinalPick,
  resolveBundleFromOrdinal,
  resolveSinglePitchedBundle,
  resolveBundleFromCustomerText,
} = require('../lib/adOffers');

let failed = 0;
function assert(cond, label) {
  if (!cond) {
    failed += 1;
    console.error('FAIL:', label);
  } else {
    console.log('ok:', label);
  }
}

// Points / program — the stuck case «ماشي البرنامج اي»
{
  const r = regexFallbackIntent('ماشي البرنامج اي');
  assert(r.intent === 'POINTS_ASK', 'ماشي البرنامج اي → POINTS_ASK');
}

// ETA typo «متئ بيوصل» (ى→ي after softNormalize)
{
  const r = regexFallbackIntent('متئ بيوصل', { wizardStep: 'address' });
  assert(r.intent === 'DELIVERY_ETA', 'متئ بيوصل → DELIVERY_ETA');
}

// How to register while on await_method
{
  const r = regexFallbackIntent('اسجل ازاي', { wizardStep: 'await_method' });
  assert(r.intent === 'HOW_TO_ORDER', 'اسجل ازاي → HOW_TO_ORDER');
}

// Name / phone / address on await_method
{
  const name = regexFallbackIntent('محمد أحمد علي', { wizardStep: 'await_method' });
  assert(name.intent === 'PROVIDE_NAME' && name.slots?.name, 'ثلاثي → PROVIDE_NAME');

  const phone = regexFallbackIntent('01012345678', { wizardStep: 'await_method' });
  assert(phone.intent === 'PROVIDE_PHONE' && phone.slots?.phone, 'موبايل → PROVIDE_PHONE');
}

// Price / whole set / offers list
{
  assert(regexFallbackIntent('بكم').intent === 'PRICE_ASK', 'بكم → PRICE_ASK');
  assert(regexFallbackIntent('بكام').intent === 'PRICE_ASK', 'بكام → PRICE_ASK');
  assert(regexFallbackIntent('مجموعه كلها').intent === 'ROUTINE_OR_SET', 'مجموعه كلها → ROUTINE_OR_SET');
  assert(regexFallbackIntent('في عروض ؟').intent === 'ROUTINE_OR_SET', 'في عروض ؟ → ROUTINE_OR_SET');
  assert(regexFallbackIntent('عندكم عروض').intent === 'ROUTINE_OR_SET', 'عندكم عروض → ROUTINE_OR_SET');
  assert(regexFallbackIntent('ايه العروض').intent === 'ROUTINE_OR_SET', 'ايه العروض → ROUTINE_OR_SET');
}

// Chat vs site
{
  assert(regexFallbackIntent('هنا', { wizardStep: 'await_method' }).intent === 'CHOOSE_CHAT', 'هنا → CHOOSE_CHAT');
  assert(regexFallbackIntent('الموقع', { wizardStep: 'await_method' }).intent === 'CHOOSE_SITE', 'الموقع → CHOOSE_SITE');
}

// resolveEffectiveIntent: Gemini OTHER → regex; Gemini strong intent wins
{
  const fromOther = resolveEffectiveIntent(
    { intent: 'OTHER', products: [], slots: {} },
    'بكم',
    {}
  );
  assert(fromOther.intent === 'PRICE_ASK', 'OTHER + بكم → PRICE_ASK via fallback');

  const keepGemini = resolveEffectiveIntent(
    { intent: 'POINTS_ASK', products: [], slots: {} },
    'بكم',
    {}
  );
  assert(keepGemini.intent === 'POINTS_ASK', 'Gemini POINTS_ASK wins over بكم text');

  const fail = resolveEffectiveIntent(null, 'مجموعه كلها', {});
  assert(fail.intent === 'ROUTINE_OR_SET', 'null classifier → ROUTINE_OR_SET fallback');
}

// Ordinal offer pick + single-pitch inference
{
  assert(isOfferOrdinalPick('العرض الاول'), 'العرض الاول is ordinal');
  assert(resolveBundleFromOrdinal('العرض الاول')?.key === 'post-laser', 'اول → post-laser');
  assert(resolveBundleFromOrdinal('العرض التاني')?.key === 'brightening', 'تاني → brightening');
  assert(resolveBundleFromOrdinal('العرض التالت')?.key === 'face-body', 'تالت → face-body');
  assert(resolveBundleFromCustomerText('العرض الاول')?.key === 'post-laser', 'customerText ordinal');

  const single = resolveSinglePitchedBundle(
    'عرض عناية ما بعد الليزر يا ندي، سعره 549 جنيه بدل 618 جنيه 💜\nالمنتجات اللي فيه هي: كريم ما بعد الليزر وكريم التفتيح.'
  );
  assert(single?.key === 'post-laser', 'Gemini single pitch → post-laser');

  const allThree = resolveSinglePitchedBundle(
    'عرض عناية ما بعد الليزر — 549\nروتين التفتيح الكامل — 699\nعرض عناية الوش والجسم — 499'
  );
  assert(allThree === null, 'full list pitch → null (no guess)');

  const pick = regexFallbackIntent('العرض الاول');
  assert(pick.intent === 'SELECT_OFFER' && pick.slots?.offerKey === 'post-laser', 'العرض الاول → SELECT_OFFER post-laser');
}

if (failed) {
  console.error(`\n${failed} assertion(s) failed`);
  process.exit(1);
}
console.log('\nAll intent-fallback smoke checks passed.');
