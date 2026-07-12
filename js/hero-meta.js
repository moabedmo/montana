/** Per-product hero copy — trust, concerns, cart payloads */
export const HERO_META_BY_SLUG = {
  'acne-facial-cleanser': {
    cartId: 1,
    cartName: 'غسول الوجه لعلاج حب الشباب - 200مل',
    cartImage: 'images/p1-premium.png',
    concerns: 'حب الشباب · البشرة الدهنية · انسداد المسام',
    trust: ['★ 4.9', 'الأكثر مبيعاً', 'خالي من البارابين'],
  },
  'whitening-cleanser': {
    cartId: 2,
    cartName: 'غسول التفتيح والتوحيد - 200مل',
    cartImage: 'images/p2-premium.png',
    concerns: 'عدم توحد اللون · بهتان البشرة · التصبغات',
    trust: ['★ 4.8', 'توحيد فوري', 'للبشرة الحساسة'],
  },
  'whitening-cream': {
    cartId: 3,
    cartName: 'كريم التفتيح بالألفا أربوتين - 50مل',
    cartImage: 'images/p3-premium.png',
    concerns: 'التصبغات · آثار الحبوب · بقع الشمس',
    trust: ['★ 4.9', 'كلف خفيف', 'ألفا أربوتين'],
  },
  'hand-body-lotion': {
    cartId: 4,
    cartName: 'لوشن اليدين والجسم - ترطيب 72 ساعة - 50مل',
    cartImage: 'images/p4-premium.png',
    concerns: 'جفاف الجلد · خشونة · نقص الترطيب',
    trust: ['★ 4.7', 'ترطيب 72 ساعة', 'غير دهني'],
  },
  'post-laser-cream': {
    cartId: 5,
    cartName: 'كريم ما بعد الليزر بزيت السمسم - 50مل',
    cartImage: 'images/p5-premium.png',
    concerns: 'ما بعد الليزر · تهيج · البشرة الحساسة',
    trust: ['★ 4.8', 'تهدئة فورية', 'بعد الإجراءات'],
  },
  'anti-scar-gel': {
    cartId: 6,
    cartName: 'جل السيليكون لعلاج الندبات - 50مل',
    cartImage: 'images/p6-premium.png',
    concerns: 'ندبات جراحية · ندبات حب الشباب · علامات التمدد',
    trust: ['★ 4.9', 'سيليكون طبي', 'ندبات حديثة وقديمة'],
  },
};

export function enrichHeroSlide(slide) {
  const meta = HERO_META_BY_SLUG[slide.slug] || {};
  return {
    ...slide,
    concerns: meta.concerns || slide.concerns || '',
    trust: meta.trust || slide.trust || [],
    cartId: meta.cartId,
    cartName: meta.cartName || slide.name,
    cartImage: meta.cartImage || slide.img,
  };
}
