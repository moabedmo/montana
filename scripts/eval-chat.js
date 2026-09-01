/**
 * Eval gate from real customer cases (scripts/eval-chat-cases.json).
 * Run before every prod deploy: node scripts/eval-chat.js
 */
const fs = require('fs');
const path = require('path');

const BASE = process.env.CHAT_URL || 'https://www.montana.com.eg/api/chat';
// /api/chat rate-limits an IP to 40 requests/minute. At 350ms the eval tripped
// its own limit and reported HTTP 429 as if cases had failed — 1600ms keeps the
// whole run comfortably under it.
const DELAY_MS = Number(process.env.EVAL_DELAY_MS || 1600);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function turn(sid, message, extra = {}) {
  await sleep(DELAY_MS);
  // A single dropped connection used to abort the whole run before it printed
  // a score — 60+ cases wasted on one transient ECONNRESET. Retry instead.
  let lastErr = null;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(BASE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body: JSON.stringify({ message, sessionId: sid, channel: 'messenger', ...extra }),
      });
      const data = await res.json().catch(() => ({}));
      return { ok: res.ok, reply: data.reply || '', status: res.status };
    } catch (err) {
      lastErr = err;
      if (attempt < 3) await sleep(1500 * attempt);
    }
  }
  return { ok: false, reply: '', status: 0, error: String(lastErr?.message || lastErr) };
}

function check(expect, reply, prevReply) {
  const fails = [];
  if (expect.allThreeOffers && !(/618/.test(reply) && /777/.test(reply) && /558/.test(reply))) {
    fails.push('expected all three offer prices');
  }
  if (expect.notFake && /999|749|سيرم تفتيح|واقي شمس|للبشرة ولا للشعر/.test(reply)) {
    fails.push('fake offers / hair quiz');
  }
  if (expect.noHair && /شعر|هير|hair/.test(reply)) fails.push('hair mention');
  if (expect.asksWhichOffer && !/أنهي عرض|تقصدي|618|777|558|549|699|499|رقم العرض|اسمه/.test(reply)) {
    fails.push('should ask which offer');
  }
  if (expect.asksWhichOffer === false && /قولي رقم العرض أو اسمه/.test(reply) && !/249|299|229/.test(reply)) {
    fails.push('should not ask which offer for unit-price ask');
  }
  if (
    expect.notFullOffersRedump &&
    /أنهي عرض تحبيه/.test(reply) &&
    /قولي اسم العرض/.test(reply) &&
    /618/.test(reply) &&
    /777/.test(reply)
  ) {
    fails.push('re-dumped full offers list');
  }
  // "ازاي استخدم روتين التفتيح" names the offer, and that was enough to get it
  // answered with the 777 price instead of the steps she asked for.
  if (expect.usageStepsNotPrice) {
    if (!/(اغسلي|طبّقي|طبقي|رطّبي|رطبي|١\)|1\))/.test(reply)) {
      fails.push('expected the usage steps');
    }
    if (/777/.test(reply) && !/اغسلي/.test(reply)) {
      fails.push('answered a usage question with the offer price');
    }
  }
  // Pregnancy / breastfeeding is a medical question, not a sales one. The bot
  // was answering "منتجاتنا كلها آمنة ومناسبة للحوامل" on its own — a safety
  // claim the brand has not made, about products containing salicylic acid.
  if (expect.defersPregnancyToDoctor) {
    if (!/(طبيب|دكتور|استشير)/.test(reply)) {
      fails.push('must send her to her doctor');
    }
    if (/(آمن|امن|مناسب)[^.\n]{0,30}(للحوامل|للحامل|الحمل|الرضاع)/.test(reply)) {
      fails.push('claimed the products are safe in pregnancy');
    }
  }
  // "مش بعمل ليزر" — she ruled the laser cream out in the same breath. A real
  // customer said exactly this about a dark underarm and was pitched the
  // post-laser cream at 369 anyway.
  if (expect.notPostLaserCream) {
    if (/ما\s*بعد\s*الليزر|بعد\s*الليزر/.test(reply) && /369/.test(reply)) {
      fails.push('pitched the post-laser cream after she said she does not do laser');
    }
  }
  if (expect.brighteningRoutine) {
    // Substance, not phrasing: the model legitimately writes the routine as
    // "روتين التفتيح الكامل (غسول + كريم + لوشن)" — demanding the exact string
    // "غسول التفتيح" failed replies that were completely correct.
    const namesRoutine =
      /روتين\s*التفتيح/.test(reply)
      || (/غسول/.test(reply) && /كريم/.test(reply) && /لوشن/.test(reply));
    if (!(/777/.test(reply) && namesRoutine)) {
      fails.push('expected brightening routine 777');
    }
  }
  if (expect.brighteningPrice777) {
    if (!(/777/.test(reply) && /تفتيح/.test(reply))) {
      fails.push('expected brightening 777 price (routine already pitched ok)');
    }
    if (/مناسب ليكي:.*كريم التفتيح/.test(reply) && /249/.test(reply) && !/777/.test(reply)) {
      fails.push('single cream on severity follow-up');
    }
  }
  if (
    expect.notSingleWhiteningCream &&
    /مناسب ليكي:.*كريم التفتيح/.test(reply) &&
    /249/.test(reply) &&
    !/777/.test(reply)
  ) {
    fails.push('single whitening cream instead of routine');
  }
  if (expect.postLaserBundle && !(/618/.test(reply) && /ما بعد الليزر/.test(reply))) {
    fails.push('expected post-laser bundle');
  }
  if (expect.faceBodyBundle && !(/558/.test(reply) && /(وش|جسم)/.test(reply))) {
    fails.push('expected face-body bundle');
  }
  if (expect.multiOffersAdded) {
    if (!(/618/.test(reply) && /558/.test(reply))) fails.push('expected both offer prices in cart reply');
    if (/تحبي أسجلكِ الأوردر بالعرض ده/.test(reply) && !/سجّلت العروض/.test(reply)) {
      fails.push('pitched single offer instead of adding both');
    }
  }
  if (expect.answersBenefits) {
    if (/تحبي أسجلكِ الأوردر بالعرض ده/.test(reply)) fails.push('re-pitched offer instead of benefits');
    if (!/(غسول|كريم|لوشن|مكونات|تفتيح|ينظ|يهدي|يرطب)/i.test(reply)) {
      fails.push('expected product benefit/details');
    }
  }
  if (expect.notOfferRepitch && /تحبي أسجلكِ الأوردر بالعرض ده/.test(reply)) {
    fails.push('should not re-ask to register the same offer');
  }
  if (expect.addedOrClosing) {
    const ok =
      /سجّلت|سجله|في أوردرك|نكمل الأوردر|تحبي أسجلكِ الأوردر\؟|تحبي أسجلك الأوردر/.test(reply)
      && !/تحبي أسجلكِ الأوردر بالعرض ده/.test(reply);
    if (!ok) fails.push('expected add-to-cart or short close, not full offer re-pitch');
  }
  if (expect.ministryApproval && !/COSMTOL25117170/.test(reply)) {
    fails.push('expected Ministry of Health approval number');
  }
  if (expect.notFourteenDayReturn && /14\s*يوم|ترجعيه/.test(reply)) {
    fails.push('should not answer guarantee with 14-day return');
  }
  if (expect.resultsIn14Days) {
    if (!(/14/.test(reply) && /(نتيج|نتايج|يوم)/.test(reply))) {
      fails.push('expected results timeline (~14 days)');
    }
    if (/تحبي أسجلكِ الأوردر بالعرض ده/.test(reply)) {
      fails.push('re-pitched offer instead of results timeline');
    }
  }
  if (expect.returnPolicy) {
    if (!(/14/.test(reply) && /(ارجاع|إرجاع|ترجع|استبدال)/.test(reply))) {
      fails.push('expected return policy');
    }
    if (/COSMTOL25117170/.test(reply)) fails.push('return should not be MOH guarantee reply');
  }
  if (expect.answersSuitability) {
    if (!/(بكين|مناطق\s*حساس|تحت\s*ال[إا]بط|مناسب|أيوه|ايوه)/i.test(reply)) {
      fails.push('expected suitability yes for bikini/sensitive areas');
    }
    if (/تحبي أسجلكِ الأوردر بالعرض ده/.test(reply)) {
      fails.push('re-pitched offer instead of suitability answer');
    }
  }
  if (expect.answersPregnancy) {
    if (!/(حوامل|حامل|الحمل|الحامل)/i.test(reply)) {
      fails.push('expected pregnancy keyword in reply');
    }
    if (/777|699|روتين التفتيح الكامل|غسول التفتيح|كريم التفتيح|لوشن اليدين والجسم/.test(reply)) {
      fails.push('should not repitch routine price/products for pregnancy FAQ');
    }
    if (!/(استشيري|طبيب|صيدلي|تهيّج|تهيج|موضعي)/i.test(reply)) {
      fails.push('expected pregnancy-safety advice words');
    }
  }
  if (expect.answersIngredientsFollowup) {
    if (!(/غسول/.test(reply) && /كريم/.test(reply) && /المكونات\s*:/.test(reply))) {
      fails.push('expected cleanser + cream ingredients in follow-up');
    }
    if (/لوشن/.test(reply)) {
      fails.push('should answer requested cleanser + cream only, not lotion again');
    }
    if (/777|699|تحبي أسجلكِ الأوردر بالعرض ده|روتين التفتيح الكامل/.test(reply)) {
      fails.push('repitched routine instead of ingredient follow-up');
    }
  }
  if (expect.notReAddBundle && /سجّلت\s*(روتين|عرض)/.test(reply)) {
    fails.push('re-added bundle instead of answering FAQ');
  }
  if (expect.asksGovernorate && !/محافظ/.test(reply)) {
    fails.push('expected ask for governorate after address');
  }
  if (expect.notReaskAddress && /العنوان بالتفصيل/.test(reply)) {
    fails.push('re-asked for address after a full address was sent');
  }
  if (expect.notShortAddressNag && /العنوان قصير/.test(reply)) {
    fails.push('nagged short address after ماشي/تمام (should recover prior address)');
  }
  if (expect.asksGovernorateOnly) {
    if (!/محافظ/.test(reply)) fails.push('expected ask for governorate name only');
    if (/المحافظة دي مش ظاهرة/.test(reply)) fails.push('treated address paste as unknown governorate');
  }
  if (expect.notGovNotFound && /المحافظة دي مش ظاهرة/.test(reply)) {
    fails.push('governorate-not-found after address re-paste');
  }
  if (expect.orderPlaced && !(/تم تسجيل أوردرك|رقم الطلب|MON-/i.test(prevReply || '') || /تم تسجيل أوردرك|رقم الطلب|MON-/i.test(reply))) {
    // order confirm is on previous step; soft-close is current reply
    const histOk = /تم تسجيل أوردرك|رقم الطلب|MON-/i.test(prevReply || '');
    if (!histOk) fails.push('expected order confirmation before soft close');
  }
  if (expect.softCloseAfterOrder) {
    if (/أنهي عرض تحبيه|قولي اسم العرض/.test(reply)) {
      fails.push('dumped offers after order instead of soft close');
    }
    if (!/تحت أمرك|أي حاجة تانية|اي حاجه تانيه|استفسار/.test(reply)) {
      fails.push('expected soft close after order ack');
    }
  }
  // Owner's rule (changed deliberately): an order problem is NOT handled by the
  // bot at all — no phone lookup, no selling. It hands over the CS number.
  if (expect.handsOrderIssueToCs) {
    if (!/01019787225/.test(reply)) fails.push('expected the customer service number');
    if (/رقم\s*(ال)?موبايل/.test(reply)) fails.push('must not ask for her phone');
    if (/(618|777|558|اطلبي|تحبي\s*تطلبي)/.test(reply)) fails.push('must not sell on an order complaint');
  }
  if (expect.asksOrderLookupPhone) {
    if (!/رقم\s*(ال)?موبايل/.test(reply)) {
      fails.push('expected ask for phone to look up order status');
    }
    if (/الأسعار قدامك|قولي رقم العرض|618/.test(reply) && /777/.test(reply) && /558/.test(reply)) {
      fails.push('listed offer prices instead of order-status lookup');
    }
  }
  if (expect.notOffersForMissingDelivery) {
    if (/الأسعار قدامك|قولي رقم العرض أو اسمه/.test(reply)) {
      fails.push('showed which-offer prices for missing-delivery complaint');
    }
    if (/أهلاً بيكِ في مونتانا/.test(reply) && /618/.test(reply) && /777/.test(reply)) {
      fails.push('welcome+offers dump for missing-delivery complaint');
    }
  }
  if (expect.declinesExtraDiscount) {
    // The model words the refusal freely ("سعره ثابت"، "مفيش إمكانية لخصم") —
    // check that it declined and held the price, not one exact sentence.
    const declined = /مفيش[^.\n]{0,25}خصم|خصم\s*إضافي|(سعر\w*|أسعار)[^.\n]{0,20}ثابت|زي الموقع|نفس\s*سعر\s*الموقع/i.test(reply);
    if (!declined) {
      fails.push('expected polite no-extra-discount reply');
    }
    if (/الأسعار قدامك|قولي رقم العرض أو اسمه|ابعتيلي في \*\*رسالة واحدة\*\*|رقم الموبايل \(01/.test(reply)) {
      fails.push('dumped offers or checkout details on discount ask');
    }
  }
  if (expect.walkAwaySoftClose) {
    if (/تحبي تسجّلي الأوردر|إجمالي المنتجات|نكمله سوا|لسه محفوظ/.test(reply)) {
      fails.push('kept pitching checkout after walk-away');
    }
    if (!/تحت أمرك|منورانا|أي وقت|اي وقت/.test(reply)) {
      fails.push('expected soft close after walk-away');
    }
  }
  if (expect.etaThenAskAddress) {
    if (!(/2\s*[-–]?\s*3|يوم/.test(reply) && /عنوان/.test(reply))) {
      fails.push('expected ETA + ask for missing address (not generic continue)');
    }
    if (/نكمل تسجيل البيانات\؟/.test(reply)) {
      fails.push('generic continue instead of asking missing field');
    }
  }
  if (expect.asksDetailedAddress) {
    if (!/(عنوان|شارع|علام)/i.test(reply)) fails.push('expected ask for detailed street address');
    if (/تم تسجيل أوردرك|رقم الطلب|MON-/i.test(reply)) fails.push('placed order with governorate-only address');
  }
  if (expect.notOrderPlaced && /تم تسجيل أوردرك|رقم الطلب\s*:?\s*\*?MON-/i.test(reply)) {
    fails.push('should not have placed an order');
  }
  if (expect.answersNatural) {
    if (!/(طبيع|مكونات|فيتامين|عرقسوس|شيا|COSMTOL25117170)/i.test(reply)) {
      fails.push('expected natural-ingredients style answer');
    }
    if (/تحبي أسجلكِ الأوردر بالعرض ده/.test(reply)) fails.push('re-pitched offer on natural FAQ');
  }
  if (expect.answersResultsVary) {
    if (!/(شخص|ناس|تختلف|14)/i.test(reply)) fails.push('expected results-vary answer');
  }
  if (expect.freeShippingMention && !/شحن\s*\*?\*?مجاني|مجاني.*شحن|الشحن \*\*مجاني\*\*/i.test(reply)) {
    fails.push('expected free shipping on routine reply');
  }
  if (expect.shippingPolicy) {
    if (!/(شحن|مجاني|محافظ)/i.test(reply)) fails.push('expected shipping policy reply');
    if (/أنهي عرض تحبيه|قولي اسم العرض/.test(reply) && /618/.test(reply) && /777/.test(reply)) {
      fails.push('dumped all offers instead of shipping policy');
    }
  }
  if (expect.cleanserUnitPrice) {
    if (!(/غسول/.test(reply) && /(299|329)/.test(reply))) {
      fails.push('expected cleanser unit price(s)');
    }
    if (/618/.test(reply) && /777/.test(reply) && /558/.test(reply)) {
      fails.push('dumped all three offers for cleanser-alone ask');
    }
  }
  if (expect.whiteningCleanserPrice) {
    if (!(/غسول\s*التفتيح/.test(reply) && /299/.test(reply))) {
      fails.push('expected whitening cleanser 299');
    }
    if (/777/.test(reply) && /لوشن اليدين والجسم/.test(reply) && /تحبي أسجلكِ الأوردر بالعرض ده/.test(reply)) {
      fails.push('pitched full brightening routine instead of cleanser alone');
    }
  }
  if (expect.freeShipFrom3Note) {
    // Word order varies ("مجاني من 3 منتجات" / "من 3 منتجات الشحن مجاني") —
    // check the three facts are present, not the sentence shape.
    if (!(/شحن/.test(reply) && /مجاني/.test(reply) && /[3٣]\s*منتجات/.test(reply))) {
      fails.push('expected free-shipping-from-3-products note');
    }
  }
  if (expect.cleanserAndCreamUnitPrices) {
    if (!(/غسول\s*التفتيح/.test(reply) && /كريم\s*التفتيح/.test(reply) && /299/.test(reply) && /249/.test(reply))) {
      fails.push('expected whitening cleanser 299 + cream 249 unit prices');
    }
    if (/تحبي أسجلكِ الأوردر بالعرض ده/.test(reply)) {
      fails.push('pitched full routine CTA instead of unit prices');
    }
  }
  if (expect.twoProductUnitPrices) {
    const hasCleanser = /غسول/.test(reply) && /299|329/.test(reply);
    const hasSecond = (/كريم/.test(reply) && /249/.test(reply)) || (/لوشن/.test(reply) && /229/.test(reply));
    if (!(hasCleanser && hasSecond)) {
      fails.push('expected two named product unit prices');
    }
    if (/تحبي أسجلكِ الأوردر بالعرض ده/.test(reply) && /777/.test(reply)) {
      fails.push('pitched brightening routine instead of two unit prices');
    }
  }
  if (expect.notBrighteningRoutinePitch) {
    if (/تحبي أسجلكِ الأوردر بالعرض ده/.test(reply) || (/روتين التفتيح الكامل/.test(reply) && /777/.test(reply) && /لوشن اليدين والجسم/.test(reply))) {
      fails.push('should not pitch full brightening routine for 1–2 product ask');
    }
  }
  if (expect.namedGovShipping) {
    if (!(/بن[يى]\s*سويف/.test(reply) && /\d+/.test(reply) && /شحن|جنيه/.test(reply))) {
      fails.push('expected Beni Suef shipping rate');
    }
  }
  if (expect.notSuitability && /مناسب للبكيني/.test(reply)) {
    fails.push('answered shipping with suitability FAQ');
  }
  if (expect.notAskWhichCleanser && /حب الشباب/.test(reply) && /تفتيح/.test(reply) && /ولا|أو|قصدك/.test(reply)) {
    fails.push('re-asked which cleanser despite whitening context');
  }
  if (expect.explainsRoutineComposition) {
    if (!(/غسول\s*التفتيح/.test(reply) && /كريم\s*التفتيح/.test(reply) && /لوشن/.test(reply))) {
      fails.push('expected routine composition (cleanser+cream+lotion)');
    }
    if (/قوليلي أنهي عرض أو منتج/.test(reply)) {
      fails.push('asked which product instead of explaining routine');
    }
  }
  if (expect.notAskWhichProduct && /قوليلي أنهي عرض أو منتج|قوليلي اسم المنتج/.test(reply)) {
    fails.push('asked which product/offer');
  }
  if (expect.notReRegisterPitch && /تحبي أسجلكِ الأوردر بالعرض ده/.test(reply)) {
    fails.push('re-asked to register the same offer');
  }
  if (expect.bundleAlreadyInCart) {
    if (!(/موجود في أوردرك|نكمل الأوردر/.test(reply))) {
      fails.push('expected already-in-cart / continue checkout nudge');
    }
    if (/تحبي أسجلكِ الأوردر بالعرض ده/.test(reply)) {
      fails.push('re-pitched register CTA despite cart');
    }
  }
  if (expect.sendsSiteOrBundleLink) {
    if (!(/montana\.com\.eg/i.test(reply) && /(bundle\/|https:\/\/)/i.test(reply))) {
      fails.push('expected website/bundle link for product look ask');
    }
    if (/تحبي أسجلكِ الأوردر/.test(reply) && !/montana\.com\.eg/i.test(reply)) {
      fails.push('re-pitched offer instead of sending site link');
    }
  }
  if (expect.notProductCatalogDump) {
    // Full SKU catalog dump (Jeje ءعر bug) — not the 3 routine offers
    if (
      /منتجاتنا المتاحة|تحبي تعرفي إيه عن أي منتج/.test(reply)
      || (/كريم التفتيح/.test(reply) && /249/.test(reply) && /غسول التفتيح/.test(reply) && /299/.test(reply) && /لوشن/.test(reply) && /229/.test(reply) && !/618/.test(reply))
    ) {
      fails.push('dumped full product catalog instead of offers/clarify');
    }
  }
  if (expect.softClarifyOrOffers) {
    const ok =
      (/618/.test(reply) && /777/.test(reply) && /558/.test(reply))
      || /تحت أمرك|قوليلي تحبي|العروض|عرض|منتج معيّن|منتج معين|تفاصيل\s*أكتر|أنهي\s*واحد/.test(reply);
    if (!ok) fails.push('expected soft clarify or offers after emoji/confusion');
  }
  if (expect.unitProductsPriceList) {
    if (!(/249/.test(reply) && /299/.test(reply) && /229/.test(reply))) {
      fails.push('expected individual product unit prices');
    }
    if (/قولي رقم العرض أو اسمه/.test(reply) && !/249/.test(reply)) {
      fails.push('asked which offer instead of unit prices');
    }
    // Must not be ONLY the 3 routine totals without unit SKUs
    if (/618/.test(reply) && /777/.test(reply) && /558/.test(reply) && !/249/.test(reply)) {
      fails.push('dumped routine offers instead of unit product prices');
    }
  }
  if (expect.faceAndSensitiveSuitability) {
    if (!/(وجه|الوجه)/.test(reply) || !/(حساس|sensitive)/i.test(reply)) {
      fails.push('expected face + sensitive-area suitability answer');
    }
    if (!/(ينفع|مناسب|للاتنين|الاتنين)/i.test(reply)) {
      fails.push('expected suitability yes/both answer');
    }
  }
  if (expect.notPriceOnlyForSuitability) {
    // Price-only reply about cleanser without saying face/sensitive usage
    if (/299/.test(reply) && /غسول/.test(reply) && !/(وجه|حساس|ينفع|مناسب)/i.test(reply)) {
      fails.push('answered suitability with price-only');
    }
    if (/تنويه:\s*الشحن\s*\*\*?مجاني/.test(reply) && !/(وجه|حساس|ينفع)/i.test(reply)) {
      fails.push('answered suitability with shipping tip only');
    }
  }
  if (expect.usageSteps) {
    if (!/(اغسل|طبّق|طبقي|مرتين|صباح|مساء|خطوات|١\)|1\)|طريقة استخدام)/i.test(reply)) {
      fails.push('expected how-to-use steps');
    }
    if (!/(غسول|كريم|لوشن)/i.test(reply)) {
      fails.push('expected products mentioned in usage steps');
    }
  }
  if (expect.notRoutineBlurbsOnly) {
    // Composition blurbs without application steps (Menna bug)
    if (/عبارة عن\s*\*?\*?3 منتجات/.test(reply) && !/(اغسل|طبّق|طبقي|مرتين يومي)/i.test(reply)) {
      fails.push('gave product blurbs instead of usage steps');
    }
  }
  if (expect.notMinistryOnly && /^[\s\S]*COSMTOL25117170[\s\S]*$/.test(reply) && !/(شخص|ناس|تختلف|14)/i.test(reply)) {
    fails.push('answered results-vary with MOH-only reply');
  }
  if (expect.onlyAdBundle && expect.adKey === 'brightening') {
    if (!(/777/.test(reply) && /تفتيح/.test(reply))) fails.push('expected brightening only');
    if (/618/.test(reply) && /558/.test(reply)) fails.push('dumped all three offers despite ad');
  }
  if (expect.onlyAdBundle && expect.adKey === 'post-laser') {
    if (!(/618/.test(reply) && /ليزر/.test(reply))) fails.push('expected post-laser only');
    if (/777/.test(reply) && /558/.test(reply)) fails.push('dumped all three offers despite ad');
  }
  if (
    expect.notSingleSkuTrap &&
    /كريم التفتيح\s*×\s*1/.test(reply) &&
    /249/.test(reply) &&
    !/618/.test(reply)
  ) {
    fails.push('single SKU trap');
  }
  if (expect.explainsPoints && !/نقط|10 جنيه|كل 10/.test(reply)) {
    fails.push('expected points explanation');
  }
  return fails;
}

async function main() {
  const file = path.join(__dirname, 'eval-chat-cases.json');
  const { cases } = JSON.parse(fs.readFileSync(file, 'utf8'));
  let failed = 0;

  console.log(`Eval ${cases.length} cases → ${BASE}\n`);

  for (const c of cases) {
    const sid = `messenger:eval-${c.id}-${Date.now()}`;
    // Unique phone per case run so saved profiles don't skip address → confirm_saved
    const uniqPhone = `0155${String(Date.now()).slice(-8)}`;
    const replies = [];
    let ok = true;
    for (const step of c.steps) {
      let msg = typeof step === 'string' ? step : step.message;
      if (/^01[0125]\d{8}$/.test(String(msg || '').trim())) msg = uniqPhone;
      const extra = typeof step === 'object' ? { ...(step.extra || {}) } : {};
      if (c.selectedBundle && !extra.selectedBundle) extra.selectedBundle = c.selectedBundle;
      const r = await turn(sid, msg, extra);
      replies.push(r.reply);
      if (!r.ok) {
        ok = false;
        console.log(`[FAIL] ${c.id} HTTP ${r.status}`);
        break;
      }
    }
    if (!ok) {
      failed += 1;
      continue;
    }
    const last = replies[replies.length - 1] || '';
    const fails = check(c.expect || {}, last, replies[replies.length - 2]);
    if (fails.length) {
      failed += 1;
      console.log(`[FAIL] ${c.id}: ${fails.join('; ')}`);
      console.log(`       last: ${last.replace(/\n/g, ' | ').slice(0, 200)}`);
    } else {
      console.log(`[PASS] ${c.id}`);
    }
  }

  console.log(`\n=== ${cases.length - failed}/${cases.length} passed ===`);
  process.exit(failed ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
