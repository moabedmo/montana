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
    name: 'ثنائي عناية ما بعد الليزر',
    bundlePrice: 618,
    listTotal: 618,
    productSlugs: ['post-laser-cream', 'whitening-cream'],
    productLabels: ['كريم ما بعد الليزر', 'كريم التفتيح'],
    pitch: 'كريم ما بعد الليزر + كريم التفتيح بـ **618** جنيه — **شحن مجاني**',
    greeting:
      'أهلاً بيكِ يا فندم 🌿\n' +
      'عرض **ثنائي عناية ما بعد الليزر**: كريم ما بعد الليزر + كريم التفتيح بـ **618** جنيه.\n' +
      'الشحن **مجاني** على العرض 🎁',
  },
  {
    key: 'body-brightening',
    slug: 'body-brightening-duo',
    name: 'ثنائي تفتيح ونعومة الجسم',
    bundlePrice: 449,
    listTotal: 478,
    productSlugs: ['whitening-cream', 'hand-body-lotion'],
    productLabels: ['كريم التفتيح', 'لوشن اليدين والجسم'],
    pitch: 'كريم التفتيح + لوشن اليدين والجسم بـ **449** جنيه (بدل 478 ج) — **شحن مجاني**',
    greeting:
      'أهلاً بيكِ في مونتانا 🌿\n' +
      'عرض **ثنائي تفتيح ونعومة الجسم والمناطق الحساسة**: كريم التفتيح + لوشن الجسم بـ **449** جنيه (بدل 478 ج).\n' +
      'الشحن **مجاني** على العرض 🎁',
  },
  {
    key: 'face-brightening',
    slug: 'face-brightening-duo',
    name: 'ثنائي تفتيح الوجه والتصبغات',
    bundlePrice: 499,
    listTotal: 548,
    productSlugs: ['whitening-cleanser', 'whitening-cream'],
    productLabels: ['غسول التفتيح', 'كريم التفتيح'],
    pitch: 'غسول التفتيح + كريم التفتيح بـ **499** جنيه (بدل 548 ج) — **شحن مجاني**',
    greeting:
      'أهلاً بيكِ في مونتانا 🌿\n' +
      'عرض **ثنائي تفتيح الوجه والتصبغات**: غسول التفتيح + كريم التفتيح بـ **499** جنيه (بدل 548 ج).\n' +
      'الشحن **مجاني** على العرض 🎁',
  },
  {
    key: 'clear-skin',
    slug: 'clear-skin-duo',
    name: 'ثنائي الحبوب وآثارها',
    bundlePrice: 529,
    listTotal: 578,
    productSlugs: ['acne-facial-cleanser', 'whitening-cream'],
    productLabels: ['غسول حب الشباب', 'كريم التفتيح'],
    pitch: 'غسول حب الشباب + كريم التفتيح لآثار الحبوب بـ **529** جنيه (بدل 578 ج) — **شحن مجاني**',
    greeting:
      'أهلاً بيكِ في مونتانا 🌿\n' +
      'عرض **ثنائي الحبوب وآثارها**: غسول حب الشباب + كريم التفتيح للآثار بـ **529** جنيه (بدل 578 ج).\n' +
      'الشحن **مجاني** على العرض 🎁',
  },
  {
    key: 'brightening',
    slug: 'brightening-routine',
    name: 'روتين التفتيح الكامل (3 قطع)',
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
    name: 'روتين نضارة الوجه وترطيب الجسم',
    bundlePrice: 558,
    listTotal: 558,
    productSlugs: ['acne-facial-cleanser', 'hand-body-lotion'],
    productLabels: ['غسول الوجه وحب الشباب', 'لوشن اليدين والجسم'],
    pitch: 'غسول الوجه وحب الشباب + لوشن اليدين والجسم بـ **558** جنيه — **شحن مجاني**',
    greeting:
      'أهلاً بيكِ في مونتانا 🌿\n' +
      'روتين **نضارة الوجه وترطيب الجسم**: غسول الوجه وحب الشباب + لوشن اليدين والجسم بـ **558** جنيه.\n' +
      'الشحن **مجاني** على العرض 🎁',
  },
];

const KEY_ALIASES = {
  'post-laser': 'post-laser',
  'post-laser-glow': 'post-laser',
  'post-laser-care-routine': 'post-laser',
  postlaser: 'post-laser',
  laser: 'post-laser',
  'body-brightening': 'body-brightening',
  'body-brightening-duo': 'body-brightening',
  'face-brightening': 'face-brightening',
  'face-brightening-duo': 'face-brightening',
  'clear-skin': 'clear-skin',
  'clear-skin-duo': 'clear-skin',
  brightening: 'brightening',
  'brightening-routine': 'brightening',
  whitening: 'brightening',
  'face-body': 'face-body',
  'face-and-body': 'face-body',
  faceandbody: 'face-body',
  'face_body': 'face-body',
  'روتين-نضارة-الوجه-وترطيب-الجسم': 'face-body',
  'روتين-نضاره-الوجه-وترطيب-الجسم': 'face-body',
  'نضارة-الوجه-وترطيب-الجسم': 'face-body',
  'نضاره-الوجه-وترطيب-الجسم': 'face-body',
  'نضارة-الوجه': 'face-body',
  'نضاره-الوجه': 'face-body',
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
  if (/ثنائي\s*تفتيح\s*(ونعوم[ةه]\s*)?الجسم|body.?brightening|449|٤٤٩/i.test(blob)) {
    return getBundleByKey('body-brightening');
  }
  if (/ثنائي\s*تفتيح\s*(الوجه|الوش)|face.?brightening|499|٤٩٩/i.test(blob)) {
    return getBundleByKey('face-brightening');
  }
  if (/ثنائي\s*(الحبوب|حب\s*الشباب)|clear.?skin|529|٥٢٩/i.test(blob)) {
    return getBundleByKey('clear-skin');
  }
  if (/(?:روتين|عرض|كورس|مجموع[ةه]|ثنائي|عناي[ةه])?\s*(?:ما\s*بعد\s*|بعد\s*|بوست\s*-?\s*|post.?laser)?(?:ال)?(?:ليزر|laser)|وفري?\s*69|618|549|٥٤٩|٦١٨/i.test(blob)) {
    return getBundleByKey('post-laser');
  }
  if (/وفري?\s*78|وفر\s*٧٨|78\s*جنيه|روتين\s*التفتيح|التفتيح\s*الكامل|brightening/i.test(blob) || /٧٧٧|777|699|٦٩٩/.test(blob)) {
    return getBundleByKey('brightening');
  }
  if (/نضار[ةه]\s*(الوجه|الوش)|نضار[ةه]|الوش\s*والجسم|face.?body|وفري?\s*59|558|٥٥٨/i.test(blob)) {
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
  const t = soft(expandFrancoAndTypos(text)).replace(/-/g, ' ');
  if (!t) return null;

  // Comparing two individual products ("ايه الفرق بين كريم التفتيح وكريم ما بعد الليزر") is NOT naming a bundle
  if (/(الفرق\s*بين|مقارن[ةه]\s*بين)/i.test(t) && !/(روتين|عرض)/.test(t)) {
    return null;
  }

  const fromOrdinal = resolveBundleFromOrdinal(text);
  if (fromOrdinal) return fromOrdinal;

  // "البوست ليزر لوحده / بس" = the cream SKU, not عرض 618 / 549
  const laserAlone =
    /(بعد\s*الليزر|ما\s*بعد\s*الليزر|بوست\s*-?\s*ليزر|البوست\s*ليزر|post\s*-?\s*(laser|ليزر)|(?:ال)?ليزر)/.test(t)
    && /(لوحده|لو\s*حده|وحده|(^|[\s])بس([\s!.،؟?]|$)|فقط)/i.test(t)
    && !/(روتين|عرض|كورس|والتفتيح|وكريم\s*التفتيح)/.test(t);
  if (laserAlone) return null;

  // "كريم ما بعد الليزر" alone (benefits/price of the cream) — not the 618 / 549 routine
  const laserCreamOnly =
    /(كريم|غسول).{0,12}(بعد\s*الليزر|ما\s*بعد\s*الليزر|بوست|(?:ال)?ليزر)/.test(t)
    && !/(روتين|عرض|كورس|مجموعه|مجموعة|والتفتيح|وكريم\s*التفتيح)/.test(t);
  if (laserCreamOnly) return null;

  if (
    /(?:روتين|عرض|كورس|مجموع[ةه]|ثنائي|عناي[ةه]|تفاصيل|طريق[ةه]|استخدام|بتاع|جلس[ةه]|جلسات|كريمات).{0,25}(?:ال)?(?:ليزر|laser)/i.test(t)
    || /(?:ال)?(?:ليزر|laser).{0,25}(?:روتين|عرض|كورس|مجموع[ةه]|ثنائي|عناي[ةه]|عبار[ةه]|طريق[ةه]|استخدام|تفاصيل|مكونات|بيستخدم|جلس[ةه]|جلسات)/i.test(t)
    || /(?:ما\s*بعد\s*|بعد\s*|بوست\s*-?\s*|البوست\s*-?\s*|post\s*-?\s*)(?:ال)?(?:ليزر|laser)/i.test(t)
    || /(?:ال)?(?:ليزر|laser)\s*(?:عبار[ةه]\s*عن\s*ايه|بيستخدم\s*ازاي|طريق[ةه]|تفاصيل|بكام|سعره|مكونات)/i.test(t)
    || /(^|[^\d])(549|618)([^\d]|$)/.test(t)
    || /٥٤٩|٦١٨/.test(String(text || ''))
  ) {
    return getBundleByKey('post-laser');
  }
  if (
    /(تفتيح\s*(?:ونعوم[ةه]\s*)?الجسم|تفتيح\s*المناطق\s*الحساس[ةه]|ثنائي\s*الجسم|عرض\s*الجسم|روتين\s*الجسم|كورس\s*الجسم|مجموع[ةه]\s*الجسم)/.test(t)
    || /(^|[^\d])(449)([^\d]|$)/.test(t)
    || /٤٤٩/.test(String(text || ''))
  ) {
    return getBundleByKey('body-brightening');
  }
  if (
    /(تفتيح\s*(?:الوجه|الوش)|تفتيح\s*التصبغات|ثنائي\s*(?:تفتيح\s*)?(?:الوجه|الوش)|ثنائي\s*الوجه|ثنائي\s*الوش|عرض\s*الوجه|عرض\s*الوش|روتين\s*الوجه|روتين\s*الوش|كورس\s*الوجه|كورس\s*الوش)/.test(t)
    || ((/(^|[^\d])(499)([^\d]|$)/.test(t) || /٤٩٩/.test(String(text || ''))) && /(غسول|كريم|وش|وجه|تفتيح)/i.test(t))
  ) {
    return getBundleByKey('face-brightening');
  }
  if (
    /(ثنائي\s*الحبوب|روتين\s*الحبوب|عرض\s*الحبوب|كورس\s*الحبوب|مجموع[ةه]\s*الحبوب|علاج\s*حب\s*الشباب|الحبوب\s*و[اآ]ثار|حب\s*الشباب\s*و[اآ]ثار|اثار\s*الحبوب|آثار\s*الحبوب)/.test(t)
    || /(^|[^\d])(529)([^\d]|$)/.test(t)
    || /٥٢٩/.test(String(text || ''))
  ) {
    return getBundleByKey('clear-skin');
  }
  if (
    /(روتين\s*التفتيح|التفتيح\s*الكامل)/.test(t) ||
    /(^|[^\d])(699|777)([^\d]|$)/.test(t) ||
    /٦٩٩|٧٧٧/.test(String(text || '')) ||
    /(التلات|الثلاث|3|٣)\s*(عبوات|قطع|منتجات|ازايز|علب)/.test(t) ||
    /^(التلات[ةه]|التلات|الثلاث[ةه]|الثلاث)\s*(مع\s*بعض|كلهم|سوا)?[\s!.،؟?]*$/.test(t) ||
    /(عرض|روتين)\s*(التلات[ةه]|الثلاث[ةه]|الـ?\s*[3٣])/i.test(t) ||
    // "عرض البيكيني / روتين تحت الإبط / مجموعة المناطق الحساسة" → روتين التفتيح
    ((/(عرض|روتين|مجموع[ةه]|كورس)/.test(t) || /(عايز[ةه]?|محتاج[ةه]?).{0,20}(عرض|روتين)/.test(t))
      && /(ب\s*ي?\s*كين[يى]|bikini|تحت\s*ال[اإ]بط|اندر\s*ارم|المناطق\s*الحساس|الاماكن\s*الحساس|اماكن\s*حساس)/.test(t)) ||
    (/(غسول\s*التفتيح)/.test(t) && /(كريم\s*التفتيح)/.test(t) && /لوشن/.test(t)) ||
    // "بكام الغسول والكريم" / "الغسول والكريم" → brightening routine (ad customers)
    (/غسول/.test(t) && /كريم/.test(t) && !/ليزر/.test(t) && !/حب\s*الشباب|حبوب/.test(t))
  ) {
    return getBundleByKey('brightening');
  }
  if (
    /(?:روتين|عرض|كورس|مجموع[ةه]|ثنائي|عناي[ةه])\s*(?:نضار[ةه]|الوش\s*والجسم|الوجه\s*والجسم)|نضار[ةه]\s*(?:الوجه|الوش)\s*وترطيب\s*الجسم|روتين\s*(?:ال)?نضار[ةه]|نضار[ةه]\s*(?:الوجه|الوش)|عناي[ةه]\s*الوش\s*والجسم|الوش\s*والجسم/.test(t) ||
    ((/(^|[^\d])(499|558)([^\d]|$)/.test(t) || /٤٩٩|٥٥٨/.test(String(text || ''))) && /(غسول|لوشن|وش|جسم|نضار[ةه])/i.test(t)) ||
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
  // Non-ordinal expressions containing "تانية" / "مرة تانية" / "أول مرة"
  if (/(مر[ةه]\s*(تاني|اخري)|صيدلي[ةه]\s*تاني|حاج[ةه]\s*تاني|شرك[ةه]\s*تاني|مكان\s*تاني|حت[ةه]\s*تاني|حد\s*تاني|طريق[ةه]\s*تاني|اول\s*مر[ةه]|اول\s*ما)/i.test(t)) {
    return false;
  }
  if (/(^|\s)(1|٢|2|٣|3|١)(\s|$)/.test(t) && /(عرض|روتين|رقم|اختيار)/.test(t)) return true;
  if (resolveAllBundlesFromOrdinals(message).length >= 2) return true;
  return (
    /(ال)?عرض\s*(الاول|الأول|اول|التاني|الثاني|التالت|الثالث|تالت|رقم\s*[123١٢٣])/i.test(t)
    || /(اول|أول|ثاني|ثالث|الاول|الأول|الثاني|الثالث)\s*(عرض|روتين)/i.test(t)
    || /^(الاول|الأول|اول|التاني|الثاني|التالت|الثالث)[\s!.،؟?]*$/i.test(t)
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
  if (/(التاني|الثاني|2|٢)/.test(t)) return BUNDLES[1] || null;
  if (/(الاول|الأول|1|١|واحد)/.test(t)) return BUNDLES[0] || null;
  return null;
}

/**
 * "العرض الاول والتالت" / "عاوز الاول والتاني" → one or more bundles.
 * Skips pure questions like "والعرض التالت ايه".
 */
function resolveAllBundlesFromOrdinals(message) {
  const t = soft(expandFrancoAndTypos(String(message || '').trim())).replace(/-/g, ' ');
  if (!t) return [];
  // Delivery addresses / contact info must NEVER be parsed as bundle ordinals
  if (/(شارع|ش\.|برج|عمارة|عقار|دور|شقة|محافظة|ميدان|بلوك|سوبر\s*ماركت|01\d{9})/i.test(t)) return [];

  // Phrases using ordinal words non-nominally (e.g. "صيدلية تانية", "مرة تانية", "أول مرة", "أول ما يوصل")
  if (/(مر[ةه]\s*(تاني|اخري)|صيدلي[ةه]\s*تاني|حاج[ةه]\s*تاني|شرك[ةه]\s*تاني|مكان\s*تاني|حت[ةه]\s*تاني|حد\s*تاني|طريق[ةه]\s*تاني|اول\s*مر[ةه]|اول\s*ما|تاني\s*مر[ةه]|تاني\s*يوم|تالت\s*يوم|اطلب\s*تاني|هطلب\s*تاني|قول\s*تاني)/i.test(t)) {
    return [];
  }

  // Compatibility, suitability, application, or side-effect questions must NEVER be resolved as multi-bundles
  if (/(هل|ينفع|ممكن|يناسب|مناسب|تعارض|ازاي|طريقة|استخدمهم|استعملهم|استخدم|استعمل|سؤال|استفسار)/i.test(t) && !/(عاوز|عايز|هات|اطلب|طلب|سجل|سجلي)/i.test(t)) {
    return [];
  }
  if (/(سوا|مع\s*بعض)/i.test(t) && /(ينفع|ممكن|هل|عادي|ينفعوا)/i.test(t)) {
    return [];
  }
  // If individual unit products are named without routine/bundle keywords, do not resolve as multi-bundles
  if (/(غسول\s*التفتيح|كريم\s*التفتيح|كريم\s*(ما\s*)?بعد\s*الليزر|غسول\s*حب\s*الشباب|لوشن\s*اليدين)/i.test(t) && !/(روتين|عرض|كورس|مجموعه|مجموعة)/i.test(t)) {
    return [];
  }

  const hits = [];
  const push = (b) => {
    if (b && !hits.some((x) => x.key === b.key)) hits.push(b);
  };

  // Direct named multiple bundles: e.g. "هات روتين الليزر وكمان التفتيح" / "روتين الليزر والتفتيح"
  const hasLaser = /(بعد\s*الليزر|ما\s*بعد\s*الليزر|ليزر|post\s*laser)/i.test(t);
  const hasBrightening = /(تفتيح|تفتيج|brightening|الـ?\s*777)/i.test(t);
  const hasFaceBody = /(الوش\s*والجسم|وجه\s*وجسم|حب\s*الشباب|الـ?\s*558)/i.test(t);

  if (hasLaser && hasBrightening) {
    push(BUNDLES.find(b => b.key === 'post-laser') || BUNDLES[0]);
    push(BUNDLES.find(b => b.key === 'brightening') || BUNDLES[1]);
    return hits;
  }
  if (hasBrightening && hasFaceBody) {
    push(BUNDLES.find(b => b.key === 'brightening') || BUNDLES[1]);
    push(BUNDLES.find(b => b.key === 'face-body') || BUNDLES[2]);
    return hits;
  }
  if (hasLaser && hasFaceBody) {
    push(BUNDLES.find(b => b.key === 'post-laser') || BUNDLES[0]);
    push(BUNDLES.find(b => b.key === 'face-body') || BUNDLES[2]);
    return hits;
  }

  // Dual reference: "عاوز الروتينين" / "هات الروتينين" / "الاتنين مع بعض"
  if (/(الروتينين|روتينين|الاتنين\s*(مع\s*بعض|سوا|في\s*اوردر|في\s*طلب)?)/i.test(t) && /(عايز|عاوز|عاوزه|عايزة|محتاج|هات|سجل|سجلي|اطلب|طلب)/i.test(t)) {
    push(BUNDLES.find(b => b.key === 'brightening') || BUNDLES[1]);
    push(BUNDLES.find(b => b.key === 'post-laser') || BUNDLES[0]);
    return hits;
  }

  const isQuestionOnly =
    /(ايه|إيه|اي|يعني|وضح|شرح|كام\s*ده)/i.test(t)
    && !/(عايز|عاوز|عاوزه|عايزة|محتاج|خدو|خدوا|سجلي|سجّلي|اوردر|أوردر|الاتنين|التلات|عوز)/i.test(t);
  if (isQuestionOnly) {
    // Single "التالت ايه" → one bundle for pitch; not a multi-buy.
    if (/(تالت|ثالث|الثالث|التالت)/.test(t)) return BUNDLES[2] ? [BUNDLES[2]] : [];
    if (/(التاني|الثاني)/.test(t)) return BUNDLES[1] ? [BUNDLES[1]] : [];
    if (/(اول|أول|الاول|الأول)/.test(t)) return BUNDLES[0] ? [BUNDLES[0]] : [];
    return [];
  }

  // Detect ordinals by phrase (avoid bare digits matching address/date/phone)
  if (/(العرض|الروتين)?\s*(الاول|الأول|الأولاني|اولاني)|عرض\s*(الاول|الأول|اول)|(عرض|روتين|رقم)\s*(1|١)|(^|\s)(1|١)\s*(عرض|روتين)/.test(t)) {
    push(BUNDLES[0]);
  } else if (/(^|\s)(الاول|الأول|اولاني|الأولاني)(\s|$|و|,|،)/.test(t)) {
    push(BUNDLES[0]);
  }

  if (/(العرض|الروتين)\s*(التاني|الثاني)|عرض\s*(التاني|الثاني)|(عرض|روتين|رقم)\s*(2|٢)|(^|\s)(2|٢)\s*(عرض|روتين)/.test(t)) {
    push(BUNDLES[1]);
  } else if (/(^|\s)(التاني|الثاني)(\s|$|و|,|،)/.test(t)) {
    push(BUNDLES[1]);
  }

  if (/(العرض|الروتين)\s*(التالت|الثالث|تالت)|عرض\s*(التالت|الثالث|تالت)|(عرض|روتين|رقم)\s*(3|٣)|(^|\s)(3|٣)\s*(عرض|روتين)/.test(t)) {
    push(BUNDLES[2]);
  } else if (/(^|\s)(التالت|الثالث|تالت)(\s|$|و|,|،)/.test(t)) {
    push(BUNDLES[2]);
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

/** Customer asks about details, ingredients, or how to use a specific routine. */
function isRoutineDetailsOrUsageAsk(message) {
  const t = soft(expandFrancoAndTypos(String(message || '').trim())).replace(/-/g, ' ');
  if (!t || t.length > 200) return false;
  if (/^(?:ممكن\s*)?(?:ال)?تفاصيل[\s!.،؟?]*$/i.test(t) || /^(?:عايز[ةه]?|عاوز[ةه]?|حاب[ةه]?)?\s*(?:اعرف\s*)?(?:ال)?تفاصيل[\s!.،؟?]*$/i.test(t)) {
    return true;
  }
  const hasRoutineOrBundle = /(?:روتين|عرض|ثنائي|كورس|مجموع|سيت|ليزر|laser|تفتيح|حبوب|جسم|وجه|وش)/i.test(t);
  const hasUsageOrDetails = /(?:تفاصيل|شرح|طريق[ةه]\s*(?:ال)?استخدام|ازاي\s*استخدم|استخدام[هها]?\s*(?:ازاي|إزاي)|استعمل[هها]?\s*(?:ازاي|إزاي)|بيستخدم\s*ازاي|مكونات|عبار[ةه]\s*عن\s*[إا]يه|بيعمل\s*[إا]يه)/i.test(t);
  return hasRoutineOrBundle && hasUsageOrDetails;
}

/**
 * Returns comprehensive, medically accurate details and usage steps for a routine.
 */
function formatRoutineDetailsAndUsageReply(bundleKey) {
  const b = getBundleByKey(bundleKey);
  if (!b) return null;

  if (bundleKey === 'post-laser') {
    return (
      'أهلاً بحضرتك يا فندم 💜\n' +
      'عرض **ثنائي عناية ما بعد الليزر** مخصص لتهدئة البشرة والترميم وحمايتها من أي تصبغات بعد الجلسات، وبيتكون من عبوتين بحجم كبير:\n\n' +
      '1. **كريم بعد الليزر والترميم (Montana Post-Laser)** (50 جم):\n' +
      'غني بالبانثينول، زيت السمسم الطبيعي، الألانتوين، الألوفيرا، وشمع العسل لتهدئة فورية لأي احمرار أو سخونة وترميم حاجز البشرة.\n\n' +
      '2. **كريم التفتيح المركز (Montana Whitening Cream)** (50 جم):\n' +
      'بمستخلص العرقسوس وفيتامين C والأربوتين، للوقاية من التصبغات والاسمرار وتوحيد لون البشرة بعمق ولطف.\n\n' +
      '🌸 **طريقة الاستخدام الصحيحة:**\n' +
      '• **أول 3 أيام بعد الجلسة:** يُستخدم **كريم بعد الليزر** فقط مرتين لـ 3 مرات يومياً على المنطقة لتهدئة البشرة وترميمها تماماً.\n' +
      '• **من اليوم الرابع أو الخامس (بعد هدوء البشرة تماماً):** نبدأ نستخدم **كريم التفتيح** مرة واحدة يومياً مساءً لمنع أي تصبغات وتفتيح وتوحيد لون البشرة.\n\n' +
      `سعر العرض للعبوتين معاً: **${b.bundlePrice || 618} جنيه** ومعاه **شحن مجاني** تماماً لحد باب البيت 🎁\n` +
      'والدفع 100% كاش عند الاستلام بعد المعاينة وفتح الشحنة والتأكد من المنتجات بنفسك 🤝\n\n' +
      'تحبي نجهزهولك وتستفيدي من الشحن المجاني النهاردة يا فندم؟ 💜'
    );
  }

  if (bundleKey === 'body-brightening') {
    return (
      'أهلاً بحضرتك يا فندم 💜\n' +
      'عرض **ثنائي تفتيح ونعومة الجسم والمناطق الحساسة** بيتكون من عبوتين بحجم كبير:\n\n' +
      '1. **كريم التفتيح المركز (Montana Whitening Cream)** (50 جم):\n' +
      'لتفتيح التصبغات وتوحيد لون الجسم والأماكن الحساسة بخلاصة العرقسوس وفيتامين C والأربوتين.\n\n' +
      '2. **لوشن اليدين والجسم 72h (Montana Hand & Body Lotion)** (200 مل):\n' +
      'لترطيب مخملي مكثف وتنعيم فوري يدوم 72 ساعة بتركيبة خفيفة وسريعة الامتصاص.\n\n' +
      '🌸 **طريقة الاستخدام:**\n' +
      '• **لوشن الجسم:** يومياً بعد الشاور لترطيب وتنعيم الجسم بالكامل.\n' +
      '• **كريم التفتيح:** مرة لمرتين يومياً على الأماكن المراد تفتيحها بالجسم أو المناطق الحساسة مع تدليك لطيف حتى الامتصاص.\n\n' +
      `سعر العرض للعبوتين معاً: **${b.bundlePrice || 449} جنيه** بدل 478 ج، والشحن **مجاني تماماً** لحد باب البيت 🎁\n` +
      'والدفع 100% كاش عند الاستلام بعد المعاينة وفتح الشحنة والتأكد من المنتجات بنفسك 🤝\n\n' +
      'تحبي نجهزهولك وتستفيدي من الشحن المجاني النهاردة يا فندم؟ 💜'
    );
  }

  if (bundleKey === 'face-brightening') {
    return (
      'أهلاً بحضرتك يا فندم 💜\n' +
      'عرض **ثنائي تفتيح الوجه والتصبغات** بيتكون من عبوتين بحجم كبير:\n\n' +
      '1. **غسول التفتيح اليومي (Montana Whitening Cleanser)** (200 مل):\n' +
      'غسول طبي خالي من السلفات القاسية لتنظيف لطيف وتنقية المسام وإشراقة طبيعية للوجه.\n\n' +
      '2. **كريم التفتيح المركز (Montana Whitening Cream)** (50 جم):\n' +
      'لتفتيح التصبغات والبقع وتوحيد لون البشرة.\n\n' +
      '🌸 **طريقة الاستخدام:**\n' +
      '• **الغسول:** مرتين يومياً صباحاً ومساءً لغسل الوجه وتنظيف البشرة بلطف.\n' +
      '• **كريم التفتيح:** مرة واحدة يومياً مساءً بعد تجفيف البشرة لتوحيد اللون وتفتيح التصبغات.\n\n' +
      `سعر العرض للعبوتين معاً: **${b.bundlePrice || 499} جنيه** بدل 548 ج، والشحن **مجاني تماماً** لحد باب البيت 🎁\n` +
      'والدفع 100% كاش عند الاستلام بعد المعاينة وفتح الشحنة والتأكد من المنتجات بنفسك 🤝\n\n' +
      'تحبي نجهزهولك وتستفيدي من الشحن المجاني النهاردة يا فندم؟ 💜'
    );
  }

  if (bundleKey === 'clear-skin') {
    return (
      'أهلاً بحضرتك يا فندم 💜\n' +
      'عرض **ثنائي الحبوب وآثارها** بيتكون من عبوتين بحجم كبير:\n\n' +
      '1. **غسول حب الشباب الطبي (Montana Acne Facial Cleanser)** (200 مل):\n' +
      'لتنقية المسام والتحكم في الإفرازات الدهنية ومقاومة الحبوب والرؤوس السوداء بحمض الساليسيليك وشجرة الشاي.\n\n' +
      '2. **كريم التفتيح المركز (Montana Whitening Cream)** (50 جم):\n' +
      'لتفتيح آثار وبقع الحبوب وتوحيد لون البشرة بعد جفاف الحبوب النشطة.\n\n' +
      '🌸 **طريقة الاستخدام:**\n' +
      '• **الغسول:** مرتين يومياً صباحاً ومساءً لغسل الوجه وتنظيف الدهون والمسام.\n' +
      '• **كريم التفتيح:** يوضع مساءً على آثار وبقع الحبوب لتفتيحها.\n\n' +
      `سعر العرض للعبوتين معاً: **${b.bundlePrice || 529} جنيه** بدل 578 ج، والشحن **مجاني تماماً** لحد باب البيت 🎁\n` +
      'والدفع 100% كاش عند الاستلام بعد المعاينة وفتح الشحنة والتأكد من المنتجات بنفسك 🤝\n\n' +
      'تحبي نجهزهولك وتستفيدي من الشحن المجاني النهاردة يا فندم؟ 💜'
    );
  }

  if (bundleKey === 'brightening') {
    return (
      'أهلاً بحضرتك يا فندم 💜\n' +
      'روتين **التفتيح الكامل من مونتانيا (VIP)** كورس متكامل من 3 عبوات بأحجام كبيرة بتكفيكي من شهرين لـ 3 شهور:\n\n' +
      '1. **غسول التفتيح اليومي** (200 مل): لتنظيف لطيف وإشراقة طبيعية وتوحيد اللون.\n' +
      '2. **كريم التفتيح المركز** (50 جم): لتفتيح التصبغات والبقع في الوجه والمناطق الحساسة.\n' +
      '3. **لوشن ترطيب اليدين والجسم 72h** (200 مل): لترطيب وتنعيم عميق للجسم يدوم 72 ساعة.\n\n' +
      '🌸 **طريقة الاستخدام:**\n' +
      '• **الغسول:** صباحاً ومساءً لغسل الوجه.\n' +
      '• **اللوشن:** يومياً للجسم بعد الشاور.\n' +
      '• **كريم التفتيح:** مساءً للمناطق المراد تفتيحها (الوجه أو المناطق الحساسة).\n\n' +
      `سعر الكورس كامل: **${b.bundlePrice || 777} جنيه** والشحن **مجاني تماماً** لحد باب البيت 🎁\n` +
      'والدفع 100% كاش عند الاستلام بعد المعاينة وفتح الشحنة والتأكد من المنتجات بنفسك 🤝\n\n' +
      'تحبي نجهزهولك وتستفيدي من الشحن المجاني النهاردة يا فندم؟ 💜'
    );
  }

  if (bundleKey === 'face-body') {
    return (
      'أهلاً بحضرتك يا فندم 💜\n' +
      'عرض **روتين نضارة الوجه وترطيب الجسم** بيتكون من عبوتين بحجم كبير:\n\n' +
      '1. **غسول حب الشباب الطبي للوجه (Montana Acne Facial Cleanser)** (200 مل):\n' +
      'لتنقية المسام والتحكم في الإفرازات الدهنية والرؤوس السوداء وإعادة النضارة للبشرة.\n\n' +
      '2. **لوشن اليدين والجسم 72h (Montana Hand & Body Lotion)** (200 مل):\n' +
      'لترطيب مخملي عميق وتنعيم يدوم 72 ساعة بتركيبة خفيفة وسريعة الامتصاص.\n\n' +
      '🌸 **طريقة الاستخدام:**\n' +
      '• **غسول الوجه:** مرتين يومياً صباحاً ومساءً لغسل الوجه وتنظيف المسام والدهون.\n' +
      '• **لوشن الجسم:** يومياً بعد الشاور لترطيب وتنعيم اليدين والجسم بالكامل.\n\n' +
      `سعر العرض للعبوتين معاً: **${b.bundlePrice || 558} جنيه** ومعاه **شحن مجاني** تماماً لحد باب البيت 🎁\n` +
      'والدفع 100% كاش عند الاستلام بعد المعاينة والتأكد من المنتجات بنفسك 🤝\n\n' +
      'تحبي نجهزهولك وتستفيدي من الشحن المجاني النهاردة يا فندم؟ 💜'
    );
  }

  return (
    `أهلاً بحضرتك يا فندم 💜\n` +
    `عرض **${b.name}** بيتكون من:\n` +
    `${b.productLabels.map((l, i) => `${i + 1}. **${l}**`).join('\n')}\n\n` +
    `سعر العرض: **${b.bundlePrice} جنيه** والشحن **مجاني تماماً** لحد باب البيت 🎁\n` +
    `والدفع 100% كاش عند الاستلام بعد المعاينة 🤝\n\n` +
    `تحبي نجهزهولك وتستفيدي من الشحن المجاني النهاردة يا فندم؟ 💜`
  );
}

/** Asking whether / which offers exist — must hit the real BUNDLES list. */
function isOffersListAsk(message) {
  const t = soft(expandFrancoAndTypos(String(message || '').trim())).replace(/-/g, ' ');
  if (!t || t.length > 100) return false;
  if (isRoutineDetailsOrUsageAsk(message)) return false;
  if (/(صور|صوره|صورة|صورته|صورتها|شكل|وريني|ورّيني|اشوف|أشوف)/.test(t)) return false;
  if (/(شعر|هير|hair)/i.test(t) && !/(بشر|تفتيح|غسول|كريم|روتين|عرض)/i.test(t)) return false;
  // Specific single routine named (e.g. روتين التفتيح / عرض الليزر) is handled by that bundle's pitch
  if (/(عايز|عاوز|عاوزه|عايزة|محتاج|هات|سجل|سجلي|اطلب|طلب).{0,15}(الروتينين|روتينين|الاتنين)/i.test(t)) {
    return false;
  }
  if (
    /(?:روتين|عرض|ثنائي|كورس)\s*(?:عناية\s*)?(?:ما\s*بعد\s*الليزر|الليزر|بوست\s*ليزر|laser|التفتيح|تفتيح|الحبوب|حب\s*الشباب|الوش\s*والجسم|نضارة\s*الوجه|الجسم)/.test(t)
    && !/(كل|التلات|الثلاث|الاربعه|الأربعة|جميع)/.test(t)
  ) {
    return false;
  }
  if (/(?:ما\s*بعد\s*الليزر|بوست\s*ليزر|جلسات\s*الليزر)/.test(t) && !/(كل|التلات|الثلاث|الاربعه|الأربعة|جميع)/.test(t)) {
    return false;
  }
  if (/(روتين\s*التفتيح|عرض\s*(عناية\s*)?ما\s*بعد\s*الليزر|عرض\s*الليزر|عرض\s*(عناية\s*)?الوش\s*والجسم)/.test(t) && !/(كل|التلات|الثلاث|جميع)/.test(t)) {
    return false;
  }
  // Exposure to sun/sea/heat ("هتعرض للشمس", "بتعرض للبحر") is a skin consultation, NOT promotional offers!
  if (/(?:^|\s)(?:ه?ت?تعرض|اتعرض|تعرضت|التعرض|بتعرض)\s*(?:ل|علي|على|في|من)/i.test(t)) return false;
  // Specific skin concern/condition named (e.g. روتين للحبوب / روتين للتفتيح / روتين للبشرة الدهنية)
  if (/(?:روتين|عرض)\s*(?:ل|بتاع|حق)?\s*(?:الحبوب|حب\s*الشباب|البشرة\s*الدهنية|الدهون|المسام|الهالات|التفتيح|النضارة|التصبغات|الجفاف)/i.test(t)) {
    return false;
  }
  // Specific application / suitability / how-to question
  if (/(?:هل\s*)?(?:ينفع|ممكن|يناسب|مناسب).{0,25}(?:استخدم|استعمل|احط|ادهن|على|في|لل|ظهر|كتف|جسم|وش|وجه)/i.test(t)) {
    return false;
  }
  // Inquiry about specific body areas (back, shoulders, etc.)
  if (/(?:ظهر|كتف|فخذ|ابط|إبط)/i.test(t)) {
    return false;
  }

  return (
    /^(في|فيه|فيه[ااه]?|عندكم|عندك|هل\s*في|هل\s*فيه)\s*(?:عروض|عرض|روتين|روتينات)/i.test(t)
    || /^(ايه|إيه|اي|ما\s*هي|what)\s*(?:ال)?(?:عروض|عرض|روتينات|روتين)/i.test(t)
    || /^(?:العروض|عروض|الروتينات|روتينات)\s*(ايه|إيه|اي|كام|موجود[ةه]?|available)?[\s!.،؟?]*$/i.test(t)
    || /(?:في|فيه|عندكم).{0,12}(?:^|\s)(?:عروض|عرض|روتينات|روتين)(?:\s|$)/i.test(t)
    || /(?:^|\s)(?:عروض|عرض|روتينات)(?:\s|$).{0,15}(?:ايه|إيه|اي|موجود|available|المتاحه|الموجوده)/i.test(t)
    || /(?:ايه|إيه|اي|ما\s*هي).{0,25}(?:^|\s)(?:ال)?(?:عروض|عرض|روتينات|روتين)(?:\s|$)/i.test(t)
    || /(هيا|هي)\s*(ال)?(عروض|روتينات)/i.test(t)
    || /^(offers?|any\s*offers?|what\s*offers?)[\s!.?]*$/i.test(t)
    || /(كل|جميع|ممكن|عا[ييو]ز[اهة]?|محتاج[اهة]?|عرف|اعرف|اعرفهم|أعرض|اشوف|استفسر|استفسار|اسال|اسأل|كلمني|تفاصيل).{0,25}(عن|على)?\s*(?:ال)?(?:روتينات|روتين|عرض|عروض|مجموعات)(?:\s|$)/i.test(t)
    || /(استفسار|استفسر|سؤال|اسال|اسأل).{0,15}(عن|على)?\s*(?:ال)?(?:روتينات|روتين|عروض|عرض)(?:\s|$)/i.test(t)
    || /^(الروتينات|روتينات|عروض\s*الروتين|عروض\s*الروتينات|الروتين|العرض)[\s!.،؟?]*$/i.test(t)
    || /(الروتينات|عروض\s*الروتين)\s*(المتاحة|المتاحه|الموجودة|الموجوده|كلها|كاملة|كامله)/i.test(t)
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
    `الشحن **مجاني** ومعاكي حق المعاينة قبل الدفع 🎁`
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
 * Consultative presentation of all 3 routines: names, verified prices, components,
 * purposes, free shipping, ending with a warm consultative discovery question.
 */
function formatAllRoutineOffersConsultativeReply() {
  const brightening = getBundleByKey('brightening');
  const postLaser = getBundleByKey('post-laser');
  const faceBody = getBundleByKey('face-body');

  return (
    'تحت أمرك يا فندم 💜 دي عروض الروتين المتاحة حالياً بعناية مدروسة (وعليها شحن مجاني 🎁):\n\n' +
    `١. **${brightening?.name || 'روتين التفتيح الكامل'}** (${brightening?.bundlePrice || 777} ج): ${(brightening?.productLabels || ['غسول التفتيح', 'كريم التفتيح', 'لوشن اليدين والجسم']).join(' + ')} (لتفتيح وتوحيد لون الوجه والمناطق الحساسة وترطيب الجسم بالكامل).\n\n` +
    `٢. **${postLaser?.name || 'عرض عناية ما بعد الليزر'}** (${postLaser?.bundlePrice || 618} ج): ${(postLaser?.productLabels || ['كريم ما بعد الليزر', 'كريم التفتيح']).join(' + ')} (لتهدئة وترطيب البشرة بعد جلسات الليزر وإزالة الشعر وتوحيد اللون).\n\n` +
    `٣. **${faceBody?.name || 'عرض عناية الوش والجسم'}** (${faceBody?.bundlePrice || 558} ج): ${(faceBody?.productLabels || ['غسول حب الشباب', 'لوشن الجسم']).join(' + ')} (لتنظيف المسام والتحكم في الدهون والحبوب مع ترطيب ونعومة الجسم).\n\n` +
    'قوليلي حابة تركزي على إيه أكتر في بشرتك، أو أي روتين فيهم حاسة إنه الأقرب ليكي؟ 🌿'
  );
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
      || (/كريم/.test(t) && /مونتان|montana/i.test(t) && !/غسول|شامبو|ليزر|لوشن|حب\s*الشباب/.test(t))
      || (/كريم/.test(t) && /تفتيح|تصبغ|كلف|بقع|نمش/.test(t) && !/غسول|شامبو|ليزر/.test(t)),
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
  // Extra question words, punctuation, or conversational descriptions → not a pure button / headline tap
  if (/[?؟]|(بكام|بكم|كام\s*السعر|ازاي|إزاي|مكونات|تفاصيل|عايز|عاوز|عايزة|طلب|اوردر|شحن\s*بكام|اللي\s*هو|للاماكن|للأماكن|الحساس|شامبو|نتيجة|مضمون|خايف|خايفة|جربت|ينفع|مناسب|بشرتي|هل|ليه|مين)/.test(t)) {
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

/**
 * Dynamically reconciles BUNDLES with current database products to prevent silent divergence.
 * Sums the actual live product prices for each routine bundle.
 */
function syncBundlesWithCatalog(dbProducts = []) {
  if (!Array.isArray(dbProducts) || !dbProducts.length) return BUNDLES;
  const prodMap = new Map();
  for (const p of dbProducts) {
    if (p?.slug && p?.price != null) {
      prodMap.set(p.slug, Math.round(Number(p.price)));
    }
  }
  for (const b of BUNDLES) {
    let sum = 0;
    let allFound = true;
    for (const slug of b.productSlugs) {
      if (prodMap.has(slug)) {
        sum += prodMap.get(slug);
      } else {
        allFound = false;
      }
    }
    if (allFound && sum > 0) {
      b.bundlePrice = sum;
      b.listTotal = sum;
    }
  }
  return BUNDLES;
}

module.exports = {
  BUNDLES,
  AD_OFFERS: BUNDLES, // back-compat alias
  PRODUCT_ADS,
  syncBundlesWithCatalog,
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
  formatAllRoutineOffersConsultativeReply,
  isRoutineDetailsOrUsageAsk,
  formatRoutineDetailsAndUsageReply,
  looksLikeRoutineAdBlob,
  preferredBundleKeyFromProducts,
  // legacy names used by older call sites
  resolveOfferFromSelectedBundle: resolveSelectedBundle,
  resolveOfferFromText: resolveBundleFromCustomerText,
  botAskedAdOfferConfirm: botAskedBundleConfirm,
  getOfferBySlug: getBundleBySlug,
};
