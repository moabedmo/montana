/**
 * ManyChat ad → bundle offers.
 * Source of truth for messenger/instagram ads: body.selectedBundle
 * (custom field selected_bundle). Keys: post-laser | brightening | face-body
 * Keep productSlugs + prices in sync with js/bundles.js + create_guest_order.
 */

const { expandFrancoAndTypos } = require('./orderContext');

/**
 * Routine offers — price = sum of current website product prices.
 * Perk = free shipping (no second discount on top of storefront prices).
 * Keep productSlugs in sync with js/bundles.js + create_guest_order.
 */
const BUNDLES = [
  {
    key: 'post-laser',
    slug: 'post-laser-glow',
    name: 'عرض عناية ما بعد الليزر',
    bundlePrice: 618,
    listTotal: 618,
    productSlugs: ['post-laser-cream', 'whitening-cream'],
    productLabels: ['كريم ما بعد الليزر', 'كريم التفتيح'],
    pitch: 'كريم ما بعد الليزر + كريم التفتيح بـ **618** جنيه — **شحن مجاني**',
    greeting:
      'أهلاً بيكِ يا فندم 🌿\n' +
      'عرض **عناية ما بعد الليزر**: كريم ما بعد الليزر + كريم التفتيح بـ **618** جنيه.\n' +
      'الشحن **مجاني** على العرض 🎁',
  },
  {
    key: 'brightening',
    slug: 'brightening-routine',
    name: 'روتين التفتيح الكامل',
    bundlePrice: 777,
    listTotal: 777,
    productSlugs: ['whitening-cleanser', 'whitening-cream', 'hand-body-lotion'],
    productLabels: ['غسول التفتيح', 'كريم التفتيح', 'لوشن اليدين والجسم'],
    pitch: 'غسول التفتيح + كريم التفتيح + لوشن اليدين والجسم بـ **777** جنيه — **شحن مجاني**',
    greeting:
      'أهلاً بيكِ في مونتانا 🌿\n' +
      'روتين **التفتيح الكامل**: غسول التفتيح + كريم التفتيح + لوشن اليدين والجسم بـ **777** جنيه.\n' +
      'الشحن **مجاني** على العرض 🎁',
  },
  {
    key: 'face-body',
    slug: 'face-and-body',
    name: 'عرض عناية الوش والجسم',
    bundlePrice: 558,
    listTotal: 558,
    productSlugs: ['acne-facial-cleanser', 'hand-body-lotion'],
    productLabels: ['غسول حب الشباب', 'لوشن اليدين والجسم'],
    pitch: 'غسول حب الشباب + لوشن اليدين والجسم بـ **558** جنيه — **شحن مجاني**',
    greeting:
      'هلاً بيكِ في مونتانا 🌿\n' +
      'عرض **عناية الوش والجسم**: غسول حب الشباب + لوشن اليدين والجسم بـ **558** جنيه.\n' +
      'الشحن **مجاني** على العرض 🎁',
  },
];

const KEY_ALIASES = {
  'post-laser': 'post-laser',
  'post-laser-glow': 'post-laser',
  postlaser: 'post-laser',
  laser: 'post-laser',
  brightening: 'brightening',
  'brightening-routine': 'brightening',
  whitening: 'brightening',
  'face-body': 'face-body',
  'face-and-body': 'face-body',
  faceandbody: 'face-body',
  'face_body': 'face-body',
};

function soft(s) {
  return String(s || '')
    .toLowerCase()
    .trim()
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/[\u064B-\u065F]/g, '')
    .replace(/[_\s]+/g, '-');
}

function getBundleByKey(key) {
  const k = KEY_ALIASES[soft(key)] || soft(key);
  return BUNDLES.find((b) => b.key === k) || null;
}

function getBundleBySlug(slug) {
  return BUNDLES.find((b) => b.slug === slug) || null;
}

/**
 * Map ad title / ManyChat custom field text → bundle.
 * e.g. "روتين التفتيح الكامل - وفري 78 جنيه" → brightening
 */
function resolveBundleFromAdHints(...parts) {
  const blob = parts.filter((p) => p != null && String(p).trim() !== '').map(String).join(' ');
  if (!blob) return null;
  // Unresolved ManyChat templates
  if (/^\{\{[^}]+\}\}$/.test(blob.trim()) || /\{\{/.test(blob)) return null;

  // Per-SKU product ads must NOT be coerced into a routine bundle
  if (resolveProductFromAdHints(blob)) return null;

  const byKey = getBundleByKey(blob);
  if (byKey) return byKey;

  // Savings / titles from Meta ads (Inbox shows these even when selectedBundle is missing)
  if (/وفري?\s*78|وفر\s*٧٨|78\s*جنيه|روتين\s*التفتيح|التفتيح\s*الكامل|brightening/i.test(blob) || /٧٧٧|777|699|٦٩٩/.test(blob)) {
    return getBundleByKey('brightening');
  }
  if (/بعد\s*الليزر|ما\s*بعد\s*الليزر|post.?laser|وفري?\s*69|618|549|٥٤٩|٦١٨/i.test(blob)) {
    return getBundleByKey('post-laser');
  }
  if (/الوش\s*والجسم|face.?body|وفري?\s*59|558|499|٤٩٩|٥٥٨/i.test(blob)) {
    return getBundleByKey('face-body');
  }
  return resolveBundleFromCustomerText(blob) || null;
}

/** Normalize ManyChat selectedBundle; empty/missing → null (no crash). */
function resolveSelectedBundle(value) {
  if (value == null) return null;
  const raw = String(value).trim();
  if (!raw) return null;
  // ManyChat sent the template literally instead of the field value
  if (/^\{\{[^}]+\}\}$/.test(raw) || /^cuf_\d+$/i.test(raw)) {
    console.warn('[adOffers] unresolved ManyChat selectedBundle placeholder:', raw);
    return null;
  }
  // sku:post-laser-cream is product context — never coerce to routine "post-laser"
  if (decodeProductSku(raw)) return null;
  const byKey = getBundleByKey(raw);
  if (byKey) return byKey;
  // ManyChat sometimes sends Arabic offer name as the field value
  return resolveBundleFromCustomerText(raw);
}

/** Customer explicitly named another bundle/product than the ad context. */
function resolveBundleFromCustomerText(text) {
  const t = soft(text).replace(/-/g, ' ');
  if (!t) return null;

  const fromOrdinal = resolveBundleFromOrdinal(text);
  if (fromOrdinal) return fromOrdinal;

  // "البوست ليزر لوحده / بس" = the cream SKU, not عرض 618
  const laserAlone =
    /(بعد\s*الليزر|ما\s*بعد\s*الليزر|بوست\s*-?\s*ليزر|البوست\s*ليزر|post\s*-?\s*(laser|ليزر))/.test(t)
    && /(لوحده|لو\s*حده|وحده|(^|[\s])بس([\s!.،؟?]|$)|فقط)/i.test(t)
    && !/(روتين|عرض|كورس|والتفتيح|وكريم\s*التفتيح)/.test(t);
  if (laserAlone) return null;

  // "كريم ما بعد الليزر" alone (benefits/price of the cream) — not the 618 routine
  const laserCreamOnly =
    /(كريم|غسول).{0,12}(بعد\s*الليزر|ما\s*بعد\s*الليزر|بوست)/.test(t)
    && !/(روتين|عرض|كورس|مجموعه|مجموعة|والتفتيح|وكريم\s*التفتيح)/.test(t);
  if (laserCreamOnly) return null;

  if (
    /(بعد\s*الليزر|ما\s*بعد\s*الليزر|post\s*-?\s*(laser|ليزر)|بوست\s*-?\s*ليزر|البوست\s*ليزر)/.test(t)
    || /(^|[^\d])(549|618)([^\d]|$)/.test(t)
    || /٥٤٩|٦١٨/.test(String(text || ''))
  ) {
    return getBundleByKey('post-laser');
  }
  if (
    /(روتين\s*التفتيح|التفتيح\s*الكامل)/.test(t) ||
    /(^|[^\d])(699|777)([^\d]|$)/.test(t) ||
    /٦٩٩|٧٧٧/.test(String(text || '')) ||
    // "عرض البيكيني / تحت الإبط / المناطق الحساسة" → روتين التفتيح
    /(ب\s*ي?\s*كين[يى]|bikini|تحت\s*ال[اإ]بط|اندر\s*ارم|المناطق\s*الحساس|الاماكن\s*الحساس|اماكن\s*حساس)/.test(t) ||
    (/(غسول\s*التفتيح)/.test(t) && /(كريم\s*التفتيح)/.test(t) && /لوشن/.test(t)) ||
    // "بكام الغسول والكريم" / "الغسول والكريم" → brightening routine (ad customers)
    (/غسول/.test(t) && /كريم/.test(t) && !/ليزر/.test(t) && !/حب\s*الشباب|حبوب/.test(t))
  ) {
    return getBundleByKey('brightening');
  }
  if (
    /(عناي[ةه]\s*الوش\s*والجسم|الوش\s*والجسم)/.test(t) ||
    ((/(^|[^\d])(499|558)([^\d]|$)/.test(t) || /٤٩٩|٥٥٨/.test(String(text || ''))) && /(غسول|لوشن|وش|جسم)/.test(t)) ||
    (/(غسول\s*حب\s*الشباب|حب\s*الشباب)/.test(t) && /لوشن/.test(t))
  ) {
    return getBundleByKey('face-body');
  }
  return null;
}

/** "العرض الاول" / "التاني" / "رقم 3" → BUNDLES order (post-laser, brightening, face-body). */
function isOfferOrdinalPick(message) {
  const t = soft(String(message || '').trim()).replace(/-/g, ' ');
  if (!t || t.length > 90) return false;
  if (/(^|\s)(1|٢|2|٣|3|١)(\s|$)/.test(t) && /(عرض|روتين|رقم|اختيار)/.test(t)) return true;
  if (resolveAllBundlesFromOrdinals(message).length >= 2) return true;
  return (
    /(ال)?عرض\s*(الاول|الأول|اول|التاني|الثاني|تاني|التالت|الثالث|تالت|رقم\s*[123١٢٣])/i.test(t)
    || /(اول|تاني|تالت|أول|ثاني|ثالث|الاول|الأول|الثاني|الثالث)\s*(عرض|روتين)/i.test(t)
    || /^(الاول|الأول|اول|التاني|الثاني|تاني|التالت|الثالث|تالت)[\s!.،؟?]*$/i.test(t)
    || /^(العرض|الروتين)\s*(الاول|الأول|اول|التاني|الثاني|التالت|الثالث)[\s!.،؟?]*$/i.test(t)
  );
}

function resolveBundleFromOrdinal(message) {
  const many = resolveAllBundlesFromOrdinals(message);
  if (many.length === 1) return many[0];
  if (many.length > 1) return many[0]; // single-pick callers; multi handled via resolveAllBundlesFromOrdinals
  if (!isOfferOrdinalPick(message)) return null;
  const t = soft(String(message || '').trim()).replace(/-/g, ' ');
  if (/(تالت|ثالث|الثالث|التالت|3|٣)/.test(t)) return BUNDLES[2] || null;
  if (/(تاني|ثاني|الثاني|التاني|2|٢)/.test(t)) return BUNDLES[1] || null;
  if (/(اول|أول|الاول|الأول|1|١|واحد)/.test(t)) return BUNDLES[0] || null;
  return null;
}

/**
 * "العرض الاول والتالت" / "عاوز الاول والتاني" → one or more bundles.
 * Skips pure questions like "والعرض التالت ايه".
 */
function resolveAllBundlesFromOrdinals(message) {
  const t = soft(String(message || '').trim()).replace(/-/g, ' ');
  if (!t) return [];

  const isQuestionOnly =
    /(ايه|إيه|اي|يعني|وضح|شرح|كام\s*ده)/i.test(t)
    && !/(عايز|عاوز|عاوزه|عايزة|محتاج|خدو|خدوا|سجلي|سجّلي|اوردر|أوردر|الاتنين|التلات|عوز)/i.test(t);
  if (isQuestionOnly) {
    // Single "التالت ايه" → one bundle for pitch; not a multi-buy.
    if (/(تالت|ثالث|الثالث|التالت)/.test(t)) return BUNDLES[2] ? [BUNDLES[2]] : [];
    if (/(تاني|ثاني|الثاني|التاني)/.test(t)) return BUNDLES[1] ? [BUNDLES[1]] : [];
    if (/(اول|أول|الاول|الأول)/.test(t)) return BUNDLES[0] ? [BUNDLES[0]] : [];
    return [];
  }

  const hits = [];
  const push = (b) => {
    if (b && !hits.some((x) => x.key === b.key)) hits.push(b);
  };

  // Detect ordinals by phrase (avoid bare digits matching year/phone)
  if (/(العرض|الروتين)?\s*(الاول|الأول|اول|الأولاني|اولاني)|عرض\s*(الاول|الأول|اول)|(^|\s)(1|١)(\s|$)/.test(t)
    && /(عرض|روتين|عايز|عاوز|اول|تاني|تالت|و|رقم)/.test(t)) {
    push(BUNDLES[0]);
  } else if (/(^|\s)(الاول|الأول|اولاني|الأولاني)(\s|$|و|,|،)/.test(t)) {
    push(BUNDLES[0]);
  }

  if (/(العرض|الروتين)?\s*(التاني|الثاني|تاني)|عرض\s*(التاني|الثاني|تاني)|(^|\s)(2|٢)(\s|$)/.test(t)
    && /(عرض|روتين|عايز|عاوز|اول|تاني|تالت|و|رقم)/.test(t)) {
    push(BUNDLES[1]);
  } else if (/(^|\s)(التاني|الثاني|تاني)(\s|$|و|,|،)/.test(t)) {
    push(BUNDLES[1]);
  }

  if (/(العرض|الروتين)?\s*(التالت|الثالث|تالت)|عرض\s*(التالت|الثالث|تالت)|(^|\s)(3|٣)(\s|$)/.test(t)
    && /(عرض|روتين|عايز|عاوز|اول|تاني|تالت|و|رقم)/.test(t)) {
    push(BUNDLES[2]);
  } else if (/(^|\s)(التالت|الثالث|تالت)(\s|$|و|,|،)/.test(t)) {
    push(BUNDLES[2]);
  }

  // "الاول والتالت" without repeating كلمة عرض
  if (hits.length < 2) {
    if (/(اول|أول|الاول|الأول)/.test(t)) push(BUNDLES[0]);
    if (/(تاني|ثاني|التاني|الثاني)/.test(t)) push(BUNDLES[1]);
    if (/(تالت|ثالث|التالت|الثالث)/.test(t)) push(BUNDLES[2]);
  }

  return hits;
}

/** Customer wants 2+ offers in one message (اول + تالت). */
function isMultiOfferPick(message) {
  return resolveAllBundlesFromOrdinals(message).length >= 2;
}

/**
 * If the last bot message pitched exactly one of the 3 routines (not the full list),
 * return that bundle — used when customer says "اعمل اوردر" after details.
 */
function resolveSinglePitchedBundle(lastBot) {
  const t = String(lastBot || '');
  if (!t) return null;
  const byName = BUNDLES.filter((b) => t.includes(b.name));
  if (byName.length === 1) return byName[0];
  // Full list reply names all three — do not guess
  if (byName.length > 1) return null;
  const byPrice = BUNDLES.filter((b) => new RegExp(`(?:^|[^\\d])${b.bundlePrice}(?:[^\\d]|$)`).test(t));
  if (byPrice.length === 1) return byPrice[0];
  return null;
}

/** Vague reference to "the offer" / routine / price without naming another product. */
function isVagueOfferQuestion(message) {
  // Expand typos first (ءعر/سغر → سعر) before soft-normalize
  const t = soft(expandFrancoAndTypos(String(message || '').trim())).replace(/-/g, ' ').replace(/بكم/g, 'بكام');
  if (!t) return false;
  // Bare: بكام / بكم / السعر / العرض / الروتين
  if (/^((?:ال)?عرض|(?:ال)?اض؟ر|(?:ال)?أوردر|الطلب|(?:ال)?روتين|روتين|الوتين|بكم|بكام|كام\s*((?:ال)?عرض|(?:ال)?روتين|روتين|ده|دا)?|(?:ال)?سعر|(?:ال)?اسعار|التفاصيل|عايز(ة|ه)?\s*((?:ال)?عرض|(?:ال)?روتين|روتين|ده|دا)|interested|details|price|hm|bkam)[\s!.،؟?]*$/i.test(t)) {
    return true;
  }
  if (/^(عايز(ة|ه)?|محتاج(ة|ه)?)[\s!.،؟?]*$/i.test(t)) return true;
  // "في عروض؟" / "عندكم عروض" / "ايه العروض" — list the 3 real routines (never invent)
  if (isOffersListAsk(t)) return true;
  // سعر الروتين / الروتين بكام / بكام العرض / كام الروتين
  if (/(بكم|بكام|ب\s*كام|(?:ال)?سعر|كام|price|how\s*much).{0,25}((?:ال)?عرض|(?:ال)?روتين|روتين|الوتين|(?:ال)?اض؟ر)/i.test(t)) return true;
  if (/((?:ال)?عرض|(?:ال)?روتين|روتين|الوتين).{0,25}(بكم|بكام|ب\s*كام|(?:ال)?سعر|كام|price)/i.test(t)) return true;
  // بكام الغسول والكريم — treat as asking about the offer, not a catalog dump
  if (/(بكم|بكام|ب\s*كام|(?:ال)?سعر|كام).{0,40}(غسول|كريم)/i.test(t) && /غسول/.test(t) && /كريم/.test(t)) return true;
  return false;
}

/** Asking whether / which offers exist — must hit the real BUNDLES list. */
function isOffersListAsk(message) {
  const t = soft(String(message || '').trim()).replace(/-/g, ' ');
  if (!t || t.length > 80) return false;
  if (/(شعر|هير|hair)/i.test(t) && !/(بشر|تفتيح|غسول|كريم|روتين|عرض)/i.test(t)) return false;
  return (
    /^(في|فيه|فيه[ااه]?|عندكم|عندك|هل\s*في|هل\s*فيه)\s*(عروض|عرض|روتين|روتينات)/i.test(t)
    || /^(ايه|إيه|اي|ما\s*هي|what)\s*(ال)?(عروض|عرض|روتينات|روتين)/i.test(t)
    || /^(العروض|عروض|الروتينات)\s*(ايه|إيه|اي|كام|موجود[ةه]?|available)?[\s!.،؟?]*$/i.test(t)
    || /(في|فيه|عندكم).{0,12}(عروض|عرض)/i.test(t)
    || /(عروض|عرض).{0,15}(ايه|إيه|اي|موجود|available)/i.test(t)
    // "تمام إيه هيا العروض" / "إيه هي العروض"
    || /(ايه|إيه|اي|ما\s*هي).{0,25}(ال)?(عروض|عرض|روتينات)/i.test(t)
    || /(هيا|هي)\s*(ال)?عروض/i.test(t)
    || /^(offers?|any\s*offers?|what\s*offers?)[\s!.?]*$/i.test(t)
    || /(ممكن|عايز[اهة]?|محتاج[اهة]?|عرف|اعرف|أعرض).{0,20}(ال)?(روتين|عرض|عروض)/i.test(t)
    || /^(الروتين|العرض)[\s!.،؟?]*$/i.test(t)
  );
}

/**
 * كورس / مجموعة / روتين / التلاتة معًا → عرض الروتين الكامل (شحن مجاني).
 * منتج واحد أو اتنين بس (غسول+كريم بدون كورس) = أسعار الوحدة، مش الروتين.
 */
function isCleanserCreamPairAsk(message) {
  const t = soft(expandFrancoAndTypos(String(message || '').trim())).replace(/-/g, ' ');
  if (!t) return false;
  if (/ليزر/.test(t) || /حب\s*الشباب|حبوب/.test(t)) return false;
  const hasProduct = /(غسول|كريم|لوشن)/.test(t);
  // كورس / مجموعة / روتين + منتج → عرض الروتين
  if (/(كورس|الكورس|مجموعه|مجموعة|روتين|الروتين)/.test(t) && hasProduct) {
    return true;
  }
  // الثلاثة معًا صراحة → روتين التفتيح
  const hasCleanser = /غسول/.test(t);
  const hasCream = /كريم/.test(t);
  const hasLotion = /لوشن/.test(t);
  if (hasCleanser && hasCream && hasLotion) {
    return /(بكام|ب\s*كام|(?:ال)?سعر|كام|price|how\s*much|شحن|مصاريف)/i.test(t);
  }
  // غسول+كريم أو غسول+لوشن بدون كورس/روتين = أسعار الوحدة (مش العرض)
  return false;
}

/** منتج أو اتنين مسمّيين + سؤال سعر — مش كورس/روتين. */
function isFewNamedProductsPriceAsk(message) {
  const t = soft(expandFrancoAndTypos(String(message || '').trim())).replace(/-/g, ' ');
  if (!t || isCleanserCreamPairAsk(message)) return false;
  if (/(كورس|الكورس|مجموعه|مجموعة|روتين|الروتين|(?:ال)?عرض)/.test(t)) return false;
  const hasCleanser = /غسول/.test(t);
  const hasCream = /كريم/.test(t);
  const hasLotion = /لوشن/.test(t);
  const hasLaser = /ليزر/.test(t);
  const n = [hasCleanser, hasCream, hasLotion, hasLaser].filter(Boolean).length;
  if (n < 1 || n > 2) return false;
  return /(بكام|ب\s*كام|(?:ال)?سعر|كام|عامل\s*كام|price|how\s*much)/i.test(t);
}

/** "الاتنين بكام" after discussing two products / the routine. */
function isBothOfThemPriceAsk(message) {
  const t = soft(expandFrancoAndTypos(String(message || '').trim())).replace(/-/g, ' ').replace(/بكم/g, 'بكام');
  if (!t || t.length > 70) return false;
  return /^(و\s*)?(الاتنين|الاثنين|كلاهما|دول)\s*(بكام|كام|سعر)?[\s!.،؟?]*$/i.test(t)
    || /(الاتنين|الاثنين).{0,20}(بكام|كام|سعر)/i.test(t)
    || /(بكام|كام|سعر).{0,20}(الاتنين|الاثنين)/i.test(t);
}

function formatBundlePriceReply(bundle) {
  if (!bundle) return null;
  // Names may already start with "عرض" — avoid "عرض عرض عناية…"
  const label = String(bundle.name || '').replace(/^عرض\s+/i, '').trim() || bundle.name;
  return (
    `عرض **${label}** بـ **${bundle.bundlePrice}** جنيه.\n` +
    `المنتجات في الروتين: ${bundle.productLabels.join(' + ')}.\n` +
    `الشحن **مجاني** على العرض ده 🎁`
  );
}

/** Compact list of all 3 routines with products + prices + free shipping. */
function formatAllRoutineOffersList(intro = null) {
  const header = intro || '🎁 **عروض الروتين** — أسعار الموقع + **شحن مجاني** على العرض:';
  const blocks = BUNDLES.map((b) => (
    `• **${b.name}** — **${b.bundlePrice}** ج (**شحن مجاني**)\n` +
    `  المنتجات: ${b.productLabels.join(' + ')}`
  ));
  return `${header}\n\n${blocks.join('\n\n────────────\n\n')}`;
}

/**
 * After 1–2 unit prices — no automatic free-shipping upsell.
 * (Was spamming "مجاني من 3 منتجات" after every SKU price / shipping ask.)
 */
function formatFewProductsShippingTip(_productCount = 1) {
  return '';
}

/** Optional soft upsell of the 3 routines (only when she asks for offers / full package). */
function formatRoutineOffersUpsell(preferredKey = null) {
  const preferred = preferredKey ? getBundleByKey(preferredKey) : null;
  const ordered = preferred
    ? [preferred, ...BUNDLES.filter((b) => b.key !== preferred.key)]
    : BUNDLES;
  const blocks = ordered.map((b, i) => {
    const bullet = preferred && i === 0 ? '⭐' : '•';
    return (
      `${bullet} **${b.name}** — **${b.bundlePrice}** ج (**شحن مجاني**)\n` +
      `  المنتجات في الروتين: ${b.productLabels.join(' + ')}`
    );
  });
  return (
    `\n\n🎁 **عروض الروتين** — نفس أسعار الموقع و**شحن مجاني** على العرض (وكمان أي أوردر من 3 منتجات):\n\n` +
    `${blocks.join('\n\n────────────\n\n')}\n\n` +
    `الشحن مجاني كمان لو اخترتي عرض روتين أو وصلتي 3 منتجات 💜`
  );
}

/** Guess which routine to highlight from matched product slugs/names. */
function preferredBundleKeyFromProducts(products) {
  const slugs = new Set((products || []).map((p) => p.slug).filter(Boolean));
  const names = (products || []).map((p) => String(p.name || '')).join(' ');
  const hasWhiteningCleanser = slugs.has('whitening-cleanser') || /غسول\s*التفتيح/.test(names);
  const hasWhiteningCream = slugs.has('whitening-cream') || /كريم\s*التفتيح/.test(names);
  const hasPostLaser = slugs.has('post-laser-cream') || /بعد\s*الليزر|ما\s*بعد\s*الليزر/.test(names);
  const hasAcne = slugs.has('acne-facial-cleanser') || /حب\s*الشباب/.test(names);
  const hasLotion = slugs.has('hand-body-lotion') || /لوشن/.test(names);
  if (hasWhiteningCleanser && hasWhiteningCream) return 'brightening';
  if (hasWhiteningCleanser && hasLotion) return 'brightening';
  if (hasWhiteningCream && hasLotion) return 'brightening';
  if (hasPostLaser && hasWhiteningCream) return 'post-laser';
  if (hasAcne && hasLotion) return 'face-body';
  if (hasWhiteningCleanser || hasWhiteningCream) return 'brightening';
  if (hasPostLaser) return 'post-laser';
  if (hasAcne || hasLotion) return 'face-body';
  return null;
}

function geminiBundleContext(bundle) {
  if (!bundle) return null;
  return (
    `(سياق إعلان نشط: الباندل «${bundle.name}» — المفتاح ${bundle.key} — ` +
    `المنتجات: ${bundle.productLabels.join(' + ')} — السعر ${bundle.bundlePrice} جنيه (نفس أسعار الموقع) + شحن مجاني. ` +
    `لو قالت «العرض» أو «بكام» من غير تحديد، اقصدِي الباندل ده. ` +
    `لو ذكرت منتج/باندل تاني صراحة، كلامها يغلّب.)`
  );
}

/**
 * Single-SKU Meta ads (icebreaker / quick-reply button / ad title).
 * Persist as selected_bundle = "sku:<slug>" so session survives.
 */
const PRODUCT_ADS = [
  {
    slug: 'whitening-cream',
    // Meta button: «كريم مونتانيا للتفتيح» — also bare «كريم مونتانا بكام»
    match: (t) =>
      /كريم\s*مونتان[اايي]*\s*(لل)?تفتيح/.test(t)
      || /كريم\s*montana\s*(لل)?تفتيح/i.test(t)
      || (/كريم/.test(t) && /مونتان|montana/i.test(t) && !/غسول|ليزر|لوشن|حب\s*الشباب/.test(t))
      || (/كريم/.test(t) && /تفتيح|تصبغ|كلف|بقع|نمش/.test(t) && !/غسول|ليزر/.test(t)),
  },
  {
    slug: 'whitening-cleanser',
    match: (t) =>
      /غسول\s*مونتان[اايي]*\s*(لل)?تفتيح/.test(t)
      || /غسول\s*التفتيح(\s*و\s*التوحيد)?/.test(t)
      || (/غسول/.test(t) && /(تفتيح|توحيد|اشراقه)/.test(t) && !/كريم\s*التفتيح|غسول\s*حب\s*الشباب/.test(t)),
  },
  {
    slug: 'post-laser-cream',
    match: (t) =>
      /كريم\s*مونتان[اايي]*.{0,12}(بعد\s*)?الليزر/.test(t)
      || (/كريم/.test(t) && /(ما\s*)?بعد\s*الليزر/.test(t) && !/غسول/.test(t)),
  },
  {
    slug: 'acne-facial-cleanser',
    match: (t) =>
      /غسول\s*مونتان[اايي]*.{0,12}حب\s*الشباب/.test(t)
      || (/غسول\s*(علاج\s*)?حب\s*الشباب/.test(t) && !/تفتيح|توحيد/.test(t)),
  },
  {
    slug: 'hand-body-lotion',
    match: (t) =>
      /لوشن\s*مونتان[اايي]*/.test(t)
      || (/لوشن/.test(t) && /(يدين|ايدين|جسم)/.test(t) && !/غسول|كريم/.test(t)),
  },
];

function softProductText(s) {
  return soft(String(s || ''))
    .replace(/[-_—–]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Encode / decode sku context stored in selected_bundle column. */
function encodeProductSku(slug) {
  if (!slug) return null;
  return `sku:${String(slug).trim()}`;
}
function decodeProductSku(value) {
  const raw = String(value || '').trim();
  const m = /^sku:(.+)$/i.exec(raw);
  return m ? m[1].trim() : null;
}

/** True when text looks like a full routine ad (not a single-SKU product ad). */
function looksLikeRoutineAdBlob(t) {
  if (!t) return false;
  if (/روتين\s*التفتيح|التفتيح\s*الكامل|عروض?\s*الروتين/.test(t)) return true;
  if (/(^|[^\d])(618|777|558|699|549|499)([^\d]|$)/.test(t)) return true;
  if (/غسول/.test(t) && /كريم/.test(t) && /لوشن/.test(t)) return true;
  if (/غسول/.test(t) && /كريم\s*التفتيح/.test(t) && !/غسول\s*التفتيح\s*و/.test(t)) return true;
  return false;
}

/**
 * Map Meta ad title / body / ManyChat field → single product slug.
 * Prefer this over bundle hints for per-SKU ads.
 */
function resolveProductFromAdHints(...parts) {
  const blob = softProductText(parts.filter((p) => p != null && String(p).trim()).join(' '));
  if (!blob || blob.length < 4) return null;
  if (/^\{\{[^}]+\}\}$/.test(blob) || /\{\{/.test(blob)) return null;
  if (looksLikeRoutineAdBlob(blob)) return null;

  // Explicit PRODUCT_ADS matchers (order: cream before generic)
  for (const p of PRODUCT_ADS) {
    if (p.match(blob)) return p.slug;
  }
  return null;
}

/** ManyChat custom field selectedProduct / selected_product / productSlug. */
function resolveSelectedProduct(value) {
  if (value == null) return null;
  const raw = String(value).trim();
  if (!raw || /^\{\{[^}]+\}\}$/.test(raw) || /^cuf_\d+$/i.test(raw)) return null;
  const fromSku = decodeProductSku(raw);
  if (fromSku) return fromSku;
  const softRaw = softProductText(raw);
  const bySlug = PRODUCT_ADS.find((p) => softProductText(p.slug) === softRaw);
  if (bySlug) return bySlug.slug;
  return resolveProductFromAdHints(raw);
}

/**
 * Icebreaker / quick-reply / ad headline click.
 * Allows longer Meta titles like «غسول التفتيح والتوحيد — إشراقة طبيعية 299 ج.م».
 */
function resolveProductAdButton(message) {
  const raw = String(message || '').trim();
  if (!raw || raw.length > 90) return null;
  const t = softProductText(expandFrancoAndTypos(raw));
  if (!t) return null;
  // Extra question words → not a pure button / headline tap
  if (/(بكام|بكم|كام\s*السعر|ازاي|إزاي|مكونات|تفاصيل|عايز|عاوز|عايزة|طلب|اوردر|شحن\s*بكام)/.test(t)) {
    return null;
  }
  return resolveProductFromAdHints(t);
}

function botAskedBundleConfirm(lastBot) {
  return /تحبي\s*أ?سجلكِ?\s*(ال)?أوردر\s*بالعرض/i.test(String(lastBot || ''));
}

/** Unit prices = website retail (no proportional discount split). */
function allocateBundleUnitPrices(products) {
  return (products || []).map((p) => Math.round(Number(p?.price) || 0));
}

module.exports = {
  BUNDLES,
  AD_OFFERS: BUNDLES, // back-compat alias
  PRODUCT_ADS,
  getBundleByKey,
  getBundleBySlug,
  resolveSelectedBundle,
  resolveBundleFromAdHints,
  resolveBundleFromCustomerText,
  resolveSelectedProduct,
  resolveProductAdButton,
  resolveProductFromAdHints,
  encodeProductSku,
  decodeProductSku,
  isVagueOfferQuestion,
  isOffersListAsk,
  isOfferOrdinalPick,
  resolveBundleFromOrdinal,
  resolveAllBundlesFromOrdinals,
  isMultiOfferPick,
  resolveSinglePitchedBundle,
  isCleanserCreamPairAsk,
  isFewNamedProductsPriceAsk,
  isBothOfThemPriceAsk,
  geminiBundleContext,
  botAskedBundleConfirm,
  allocateBundleUnitPrices,
  formatBundlePriceReply,
  formatFewProductsShippingTip,
  formatRoutineOffersUpsell,
  formatAllRoutineOffersList,
  preferredBundleKeyFromProducts,
  // legacy names used by older call sites
  resolveOfferFromSelectedBundle: resolveSelectedBundle,
  resolveOfferFromText: resolveBundleFromCustomerText,
  botAskedAdOfferConfirm: botAskedBundleConfirm,
  getOfferBySlug: getBundleBySlug,
};
