/**
 * Product bundles — single source of truth for storefront.
 * Offer price = sum of live website product prices (no second discount).
 * Perk = free shipping.
 *
 * Landing-page copy (headline / blurbs) lives here so ads reuse the same
 * config — never a second price source.
 *
 * Keep create_guest_order bundle definitions in sync
 * (supabase/migrations/110_bundle_retail_prices_free_ship.sql).
 */

export const BUNDLES = [
  {
    slug: 'post-laser-glow',
    name: 'عناية ما بعد الليزر',
    productSlugs: ['post-laser-cream', 'whitening-cream'],
    // Fallback if catalog missing — real price = sum of live product.price
    bundlePrice: 618,
    headline: 'بعد جلسة الليزر، بشرتك محتاجة عناية',
    blurbs: {
      'post-laser-cream':
        'كريم خفيف بعد الجلسة — يساعد على تهدئة الإحساس بالسخونة وترطيب البشرة ودعم راحتها خلال أيام التعافي.',
      'whitening-cream':
        'يكمل الروتين بعد ما البشرة تهدأ — يساعد على تحسين مظهر التصبغات وتوحيد لون البشرة مع الاستخدام المنتظم.',
    },
  },
  {
    slug: 'brightening-routine',
    name: 'روتين التفتيح',
    productSlugs: ['whitening-cleanser', 'whitening-cream', 'hand-body-lotion'],
    bundlePrice: 777,
    headline: 'تصبغات وكلف؟ روتين تفتيح كامل',
    blurbs: {
      'whitening-cleanser':
        'غسول يومي يساعد على تنظيف البشرة بلُطف ودعم مظهر أكثر إشراقاً وتجانساً من أول خطوة في الروتين.',
      'whitening-cream':
        'كريم ليلي/يومي يساعد على تحسين مظهر البقع والتصبغات مع الاستمرار — من غير مبالغة ولا وعود سحرية.',
      'hand-body-lotion':
        'لوشن غني يساعد على ترطيب اليدين والجسم يومياً ونعومة ملموسة — يكمل روتين التفتيح للجسم كمان.',
    },
  },
  {
    slug: 'face-and-body',
    name: 'عناية الوش والجسم',
    productSlugs: ['acne-facial-cleanser', 'hand-body-lotion'],
    bundlePrice: 558,
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

/** No second discount — perk is free shipping. Kept for API compat. */
export function calcSavings() {
  return 0;
}

/**
 * Unit prices = website retail prices (same as storefront).
 * @returns {number[]} unit prices in the same order as `products`
 */
export function allocateBundleUnitPrices(products) {
  return (products || []).map((p) => Math.round(Number(p?.price) || 0));
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
  // Offer total = live website prices (fallback to configured bundlePrice)
  const bundlePrice = originalTotal > 0 ? Math.round(originalTotal) : Math.round(Number(bundle.bundlePrice) || 0);
  const savings = 0;
  const unitPrices = allocateBundleUnitPrices(products);
  return { bundle, products, originalTotal, bundlePrice, savings, unitPrices, inStock };
}

export function getBundleBySlug(slug) {
  return BUNDLES.find((b) => b.slug === slug) || null;
}
