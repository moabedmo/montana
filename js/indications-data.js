/** Cosmetic indications & product protocols — sourced from indications.docx */

export const PRODUCT_NAMES = {
  'acne-facial-cleanser': 'غسول حب الشباب',
  'whitening-cleanser': 'غسول التفتيح',
  'whitening-cream': 'كريم التفتيح',
  'hand-body-lotion': 'لوشن اليدين والجسم',
  'post-laser-cream': 'كريم ما بعد الليزر',
  'anti-scar-gel': 'جل السيليكون',
};

export const COSMETIC_DISCLAIMER =
  'دواعي استعمال تجميلية للعناية بالبشرة — وليست ادعاءات علاجية. استشيري طبيب الجلدية عند الحاجة.';

/** Homepage: shop by skin concern */
export const CONCERNS = [
  {
    id: 'acne',
    icon: 'fa-droplet',
    title: 'حب الشباب',
    indication:
      'يساعد على تنظيف البشرة الدهنية والمعرضة لحب الشباب، وإزالة الدهون الزائدة، والحفاظ على مظهر بشرة أكثر نقاءً.',
    products: ['acne-facial-cleanser', 'whitening-cream', 'anti-scar-gel'],
  },
  {
    id: 'pih',
    icon: 'fa-circle-half-stroke',
    title: 'آثار الحبوب',
    indication:
      'يساعد على تحسين مظهر التصبغات وآثار حب الشباب وتوحيد لون البشرة.',
    products: ['acne-facial-cleanser', 'whitening-cream', 'anti-scar-gel'],
  },
  {
    id: 'uneven-tone',
    icon: 'fa-sun',
    title: 'عدم توحيد اللون',
    indication:
      'يساعد على تفتيح البشرة الباهتة وتعزيز توحيد لون البشرة.',
    products: ['whitening-cleanser', 'whitening-cream', 'hand-body-lotion'],
  },
  {
    id: 'hyperpigmentation',
    icon: 'fa-moon',
    title: 'التصبغات والبقع',
    indication:
      'يساعد على تقليل مظهر البقع الداكنة والتصبغات الجلدية.',
    products: ['whitening-cleanser', 'whitening-cream', 'post-laser-cream'],
  },
  {
    id: 'melasma',
    icon: 'fa-cloud-sun',
    title: 'دعم الكلف',
    indication:
      'يساعد على تحسين مظهر البشرة المصابة بالكلف وتعزيز توحيد لونها.',
    products: ['whitening-cleanser', 'whitening-cream', 'post-laser-cream'],
  },
  {
    id: 'post-laser',
    icon: 'fa-wand-magic-sparkles',
    title: 'ما بعد الليزر',
    indication:
      'يساعد على تهدئة البشرة وترطيبها ودعم تعافيها بعد إجراءات الليزر التجميلية.',
    products: ['post-laser-cream', 'hand-body-lotion', 'anti-scar-gel'],
  },
  {
    id: 'dry-skin',
    icon: 'fa-hand-sparkles',
    title: 'الجفاف والترطيب',
    indication:
      'يساعد على استعادة الترطيب وتحسين نعومة البشرة وراحتها.',
    products: ['whitening-cleanser', 'hand-body-lotion', 'post-laser-cream'],
  },
  {
    id: 'scars',
    icon: 'fa-bandage',
    title: 'الندبات',
    indication:
      'يساعد على تحسين مظهر الندبات الجراحية وندبات الحروق وعلامات التمدد.',
    products: ['anti-scar-gel', 'post-laser-cream', 'hand-body-lotion'],
  },
  {
    id: 'body-dark',
    icon: 'fa-person',
    title: 'مناطق داكنة بالجسم',
    indication:
      'يساعد على تقليل مظهر المناطق الداكنة (الإبط، الركبة، المرفق) وتحسين توحيد لون البشرة.',
    products: ['whitening-cleanser', 'whitening-cream', 'hand-body-lotion'],
  },
];

/** Per-product indications for product pages */
export const PRODUCT_INDICATIONS = {
  'acne-facial-cleanser': {
    usage:
      'حب الشباب، آثار الحبوب، والندبات الناتجة عن الحبوب — غسول يومي للبشرة الدهنية والمعرضة للحبوب.',
    tags: [
      'حب الشباب',
      'البشرة الدهنية',
      'الرؤوس السوداء والبيضاء',
      'البشرة المعرضة لحب الشباب',
      'انسداد المسام',
    ],
    combo: ['whitening-cream', 'anti-scar-gel'],
    story:
      'سارة، 19 سنة، بدأت تعاني من حبوب متكررة في الجبهة والذقن مع زيادة الدهون. بدأت بغسول حب الشباب يوميًا للمساعدة على تنظيف المسام وإزالة الدهون الزائدة.',
  },
  'whitening-cleanser': {
    usage: 'الكلف الخفيف والتصبغات والبقع الداكنة وتفاوت اللون — غسول يومي لإشراقة أكثر تجانسًا.',
    tags: [
      'فرط التصبغ',
      'التصبغات بعد الالتهابات',
      'عدم توحد لون البشرة',
      'التصبغات الناتجة عن الشمس',
      'بهتان البشرة',
    ],
    combo: ['whitening-cream'],
    story:
      'نور، 28 سنة، لاحظت أن لون بشرتها أصبح غير موحد بسبب الشمس والإجهاد. أضافت غسول التفتيح إلى روتينها اليومي.',
  },
  'whitening-cream': {
    usage: 'الكلف والتصبغات وآثار الحبوب — لتحسين مظهر البقع وتوحيد لون البشرة.',
    tags: ['الكلف', 'التصبغات', 'آثار حب الشباب', 'بقع الشمس', 'عدم توحد لون البشرة'],
    combo: ['whitening-cleanser', 'post-laser-cream'],
    story:
      'دينا، 32 سنة، كانت تعاني من بقع داكنة وآثار حبوب قديمة. بدأت باستخدام كريم التفتيح بشكل منتظم لتحسين مظهر التصبغات.',
  },
  'post-laser-cream': {
    usage:
      'بعد جلسات الليزر والتقشير — تهدئة وترطيب ودعم التعافي بعد الإجراءات التجميلية.',
    tags: [
      'العناية بعد الليزر',
      'العناية بعد التقشير',
      'تهيج البشرة',
      'الاحمرار',
      'البشرة الحساسة',
    ],
    combo: ['whitening-cream'],
    story:
      'مريم خضعت لجلسة ليزر لإزالة التصبغات. استخدمت كريم ما بعد الليزر لتهدئة البشرة وترطيبها خلال فترة التعافي.',
  },
  'hand-body-lotion': {
    usage: 'الجفاف الشديد والخشونة — ترطيب يومي لليدين والجسم ودعم الحاجز الجلدي.',
    tags: ['جفاف الجلد', 'خشونة الجلد', 'نقص الترطيب', 'ضعف الحاجز الجلدي', 'الجفاف المصاحب للبشرة الأكزيمية'],
    combo: ['post-laser-cream'],
    story:
      'أحمد يعمل في بيئة تتطلب غسل اليدين باستمرار. أصبح لوشن اليدين والجسم جزءًا أساسيًا من روتينه اليومي.',
  },
  'anti-scar-gel': {
    usage: 'تحسين مظهر الندبات الحديثة والقديمة — جراحية، حروق، حب شباب، أو قيصرية.',
    tags: [
      'الندبات المتضخمة',
      'الندبات الجراحية',
      'ندبات الحروق',
      'ندبات الإصابات',
      'ندبات حب الشباب',
      'ندبات الولادة القيصرية',
    ],
    combo: ['post-laser-cream'],
    story:
      'ليلى، بعد عملية جراحية بسيطة، بدأت باستخدام جل السيليكون بانتظام لتحسين مظهر الندبة وجعلها أكثر نعومة.',
  },
};

export function getProductIndications(slug) {
  return PRODUCT_INDICATIONS[slug] || null;
}

export function getConcernsForProduct(slug) {
  return CONCERNS.filter((c) => c.products.includes(slug));
}
