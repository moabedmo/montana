/**
 * Product bundles — single source of truth for storefront.
 * Calm duo routine offers (with real bundle savings + free shipping) + full brightening course.
 *
 * Landing-page copy (headline / blurbs) lives here so ads reuse the same
 * config — never a second price source.
 *
 * Keep create_guest_order bundle definitions in sync
 * (supabase/migrations/125_calm_duo_bundle_pricing.sql).
 */

export const BUNDLES = [
  {
    slug: 'post-laser-glow',
    name: 'ثنائي عناية ما بعد الليزر',
    productSlugs: ['post-laser-cream', 'whitening-cream'],
    bundlePrice: 549,
    headline: 'تهدئة فورية + تفتيح آمن بعد الليزر بدون اسمرار',
    blurbs: {
      'post-laser-cream':
        'كريم خفيف بعد الجلسة — يهدي الاحمرار والحرقان فوراً ويدعم تعافي البشرة في أول 3 أيام.',
      'whitening-cream':
        'تبدأي بيه بعد ما البشرة تهدأ — يمنع أي اسمرار ويوحد لون المناطق الحساسة بأمان.',
    },
  },
  {
    slug: 'body-brightening-duo',
    name: 'ثنائي تفتيح ونعومة الجسم',
    productSlugs: ['whitening-cream', 'hand-body-lotion'],
    bundlePrice: 449,
    headline: 'تفتيح آمن للمناطق الحساسة والجسم + ترطيب يمنع رجوع الغمقان',
    blurbs: {
      'whitening-cream':
        'بمستخلص العرقسوس والأربوتين وفيتامين C لتفتيح وتوحيد لون المناطق الحساسة والجسم تدريجياً بدون التهاب.',
      'hand-body-lotion':
        'لوشن ترطيب عميق 200 مل يحافظ على نعومة البشرة عشان النتيجة تثبت والغمقان ميرجعش.',
    },
  },
  {
    slug: 'face-brightening-duo',
    name: 'ثنائي تفتيح الوجه والتصبغات',
    productSlugs: ['whitening-cleanser', 'whitening-cream'],
    bundlePrice: 499,
    headline: 'خطوتين بس لبشرة صافية ونضرة بدون بقع',
    blurbs: {
      'whitening-cleanser':
        'غسول تفتيح يومي 200 مل خالي من السلفات القاسية — ينظف المسام ويدي إشراقة بدون جفاف.',
      'whitening-cream':
        'كريم تفتيح مركز لتوحيد لون الوجه والرقبة وتحسين مظهر البقع والتصبغات مع الاستخدام المنتظم.',
    },
  },
  {
    slug: 'clear-skin-duo',
    name: 'ثنائي الحبوب وآثارها',
    productSlugs: ['acne-facial-cleanser', 'whitening-cream'],
    bundlePrice: 529,
    headline: 'تنقية البشرة من الحبوب + تفتيح الآثار القديمة',
    blurbs: {
      'acne-facial-cleanser':
        'غسول 200 مل للبشرة الدهنية والمعرضة للحبوب — ينقي المسام ويقلل الدهون بدون ما ينشف الوش.',
      'whitening-cream':
        'كريم تفتيح لطيف يساعد على توحيد لون البشرة وتخفيف مظهر آثار الحبوب الغامقة.',
    },
  },
  {
    slug: 'brightening-routine',
    name: 'روتين التفتيح الكامل (3 قطع)',
    productSlugs: ['whitening-cleanser', 'whitening-cream', 'hand-body-lotion'],
    bundlePrice: 777,
    headline: 'كورس التفتيح المتكامل — للوجه والجسم (3 عبوات كبيرة)',
    blurbs: {
      'whitening-cleanser':
        'غسول يومي يساعد على تنظيف البشرة بلُطف ودعم مظهر أكثر إشراقاً وتجانساً من أول خطوة.',
      'whitening-cream':
        'كريم مركز يساعد على تحسين مظهر البقع والتصبغات وتوحيد اللون مع الاستمرار.',
      'hand-body-lotion':
        'لوشن غني يساعد على ترطيب اليدين والجسم يومياً ونعومة ملموسة.',
    },
  },
  {
    slug: 'face-and-body',
    name: 'عناية الوش والجسم',
    productSlugs: ['acne-facial-cleanser', 'hand-body-lotion'],
    bundlePrice: 558,
    hiddenFromGrid: true,
    headline: 'عناية كاملة — للوش والجسم',
    blurbs: {
      'acne-facial-cleanser':
        'غسول كريمي يساعد على تنظيف البشرة المعرضة للدهون والحبوب بلُطف، من غير ما ينشف الوش.',
      'hand-body-lotion':
        'لوشن غني يساعد على ترطيب اليدين والجسم يومياً ونعومة ملموسة من أول استخدام.',
    },
  },
];

/** Sum of live retail prices for the bundle's products. */
export function calcOriginalTotal(products) {
  return (products || []).reduce((sum, p) => sum + (Number(p?.price) || 0), 0);
}

/** Real savings = list sum - configured bundlePrice. */
export function calcSavings(originalTotal, bundlePrice) {
  return Math.max(0, Math.round((Number(originalTotal) || 0) - (Number(bundlePrice) || 0)));
}

/**
 * Proportionally allocate bundlePrice across products so line totals equal bundlePrice exactly.
 * @returns {number[]} unit prices in the same order as `products`
 */
export function allocateBundleUnitPrices(products, targetBundlePrice) {
  const list = products || [];
  const orig = calcOriginalTotal(list);
  const target = Number(targetBundlePrice) > 0 && Number(targetBundlePrice) < orig
    ? Math.round(Number(targetBundlePrice))
    : Math.round(orig);
  if (!list.length || orig <= 0) return list.map(() => 0);
  if (target === Math.round(orig)) {
    return list.map((p) => Math.round(Number(p?.price) || 0));
  }
  const alloc = [];
  let head = 0;
  for (let i = 0; i < list.length; i++) {
    if (i < list.length - 1) {
      const unit = Math.round((target * (Number(list[i]?.price) || 0)) / orig);
      alloc.push(unit);
      head += unit;
    } else {
      alloc.push(Math.max(1, target - head));
    }
  }
  return alloc;
}

/**
 * Resolve a bundle against a live catalog map { slug: product }.
 * Returns null if any product is missing.
 * By default also requires stock > 0 (store cards). Pass { allowOos: true }
 * for ad landing pages that still need to render.
 */
export function resolveBundle(bundle, bySlug, opts = {}) {
  if (!bundle || !bySlug) return null;
  const products = bundle.productSlugs.map((s) => bySlug[s]).filter(Boolean);
  if (products.length !== bundle.productSlugs.length) return null;
  const inStock = products.every((p) => (p.stock ?? 0) > 0);
  if (!opts.allowOos && !inStock) return null;
  const originalTotal = calcOriginalTotal(products);
  const configured = Math.round(Number(bundle.bundlePrice) || 0);
  const bundlePrice = configured > 0 && (originalTotal <= 0 || configured <= originalTotal)
    ? configured
    : Math.round(originalTotal);
  const savings = calcSavings(originalTotal, bundlePrice);
  const unitPrices = allocateBundleUnitPrices(products, bundlePrice);
  return { bundle, products, originalTotal, bundlePrice, savings, unitPrices, inStock };
}

export function getBundleBySlug(slug) {
  return BUNDLES.find((b) => b.slug === slug) || null;
}
