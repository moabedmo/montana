'use strict';

/** Default homepage copy — source of truth when nothing saved in Supabase */
function getDefaultHomepageContent() {
  return {
    S: {
      pre: ['Montana Naturals · A skin story in six acts', 'مونتانا ناتشورالز · قصة بشرتك في ستة فصول'],
      sub: ['Six clinically-developed formulas.<br>One complete transformation.', 'ست تركيبات طبية متطورة.<br>لأن بشرتك تستاهل أحسن حكاية.'],
      fq: ['"Your skin has a story.<br>We wrote the <em>ending.</em>"', '«بشرتك تستاهل أحسن حكاية<br>إحنا كتبنا <em>نهايتها الحلوة.</em>»'],
      ftag: ['The Montana Promise', 'وعد مونتانا'],
      fcta: ['Begin Your Skin Story <span>→</span>', 'ابدأي قصة بشرتك <span>→</span>'],
      h1: ['<s>Breakouts.</s> <s>Scars.</s> <s>Dull skin.</s><br><em>Your skin,</em> rewritten.', 'بشرتك مش لازم تكون حكاية وجع<br><em>خليها حكاية تفتخري بيها</em>']
    },
    T: {
      'pp-act': [
        ['Combined to Oily skin · Blackheads · Whiteheads · Mild acne / congested pores', 'البشرة المختلطة إلى الدهنية · الرؤوس السوداء · الرؤوس البيضاء · حب الشباب الخفيف / انسداد المسام'],
        ['Dark spots · Uneven tone · Dull and pigmented skin · Post-acne marks · Loss of radiance', 'البقع الداكنة · عدم توحّد لون البشرة · البشرة الباهتة والمُصطبغة · آثار ما بعد حب الشباب · فقدان الإشراقة'],
        ['Melasma · Acne marks · Uneven skin tone · Dark underarms · Sensitive areas · Face overall brightening · Body pigmentation · Dark spots from sun', 'الكلف · آثار الحبوب · تفاوت لون البشرة · اسمرار تحت الإبط · المناطق الحساسة · تفتيح وإشراقة الوجه · تصبغات الجسم · البقع الناتجة عن الشمس'],
        ['Rough and uneven skin texture · Daily hydration · Softening and smoothing skin · Skin exposed to frequent washing · Maintaining healthy comfortable skin', 'البشرة الخشنة وغير المتساوية · الترطيب اليومي · تنعيم البشرة · البشرة المعرضة للغسل المتكرر · الحفاظ على بشرة صحية ومريحة'],
        ['Skin irritation and redness after laser · Post-procedure sensitivity · Burning or tight feeling after laser · Supporting faster recovery · Strengthening skin barrier · Reducing post-inflammatory hyperpigmentation', 'تهيّج واحمرار البشرة بعد جلسات الليزر · حساسية وعدم راحة الجلد · الحرقان أو الوخز أو شد البشرة · دعم سرعة التعافي · تقوية حاجز البشرة · تقليل خطر التصبغات بعد الالتهاب'],
        ['Old & New Scars', 'ندوب قديمة وجديدة']
      ],
      'pp-problem': [
        ['"Acne changed my skin, but it also changed how I treat myself."', '«حب الشباب غيّر بشرتي، بس كمان غيّر طريقة تعاملي مع نفسي.»'],
        ['"My skin has lost its glow and looks visibly fatigued."', '«بشرتي فقدت إشراقتها وبتبان تعبانة.»'],
        ['"The spots from last year. Still there."', '«البقع اللي من السنة اللي فاتت… لسه موجودة.»'],
        ['"By midday, my skin feels tight and dry again."', '«مع نص اليوم… بشرتي بترجع تحس بالجفاف الشديد.»'],
        ['"The redness after my laser session. The sensitivity."', '«بعد الجلسة بشرتي بتعذبني»'],
        ['"The scar from three years ago. I thought it was permanent."', '«الندبة دي بقت جزء مني وأنا مش عايزاها»']
      ],
      'pp-result': [
        ['"Clear skin in 14 days. My skin actually breathe."', '"بشرة أكثر صفاءً خلال 14 يومًا. حاسة كأن بشرتي رجعت تتنفس من جديد."'],
        ['"Finally, a cleanser that reveals my natural glow."', '"أخيرًا، غسول بيرجع لبشرتي إشراقتها من تاني."'],
        ['"My underarm tone is finally even. Instant visible difference."', '"لون تحت الإبط بقى موحد أخيرًا… فرق ملحوظ من أول استخدام."'],
        ['"Applied once in the morning. Skin felt hydrated all night."', '"استخدمته مرة الصبح… وبشرتي فضلت مرطبة طول اليوم."'],
        ['"Redness gone in 2 days instead of a week."', '"الاحمرار اختفى في يومين بدل أسبوع."'],
        ['"My keloid from surgery is finally flattening. Three months in."', '«بعد ٣ شهور الندبة بدأت تنبسط. كنت متأكدة إنها مستحيلة.»']
      ],
      'pp-vol': [
        ['200 ml · 6.76 fl oz', '200 ml · 6.76 أونصة سائلة'],
        ['200 ml · 6.76 fl oz', '200 ml · 6.76 أونصة سائلة'],
        ['50 ml · 1.69 fl oz · Face, Neck, Underarm, Elbows & Knees', '50 ml · 1.69 أونصة سائلة · الوجه، الرقبة، تحت الإبط، الأكواع والركب'],
        ['50 ml · 1.69 fl oz · Non-Greasy', '50 ml · 1.69 أونصة سائلة · غير دهني'],
        ['50 ml · 1.69 fl oz · Smoothes · Heals · Repairs', '50 ml · 1.69 أونصة سائلة · ينعّم · يلتئم · يُصلّح'],
        ['50 ml · 1.69 fl oz · Old & New Scars', '50 ml · 1.69 أونصة سائلة · للندوب القديمة والجديدة']
      ],
      'pp-body': [
        ['First Creamy Cleanser Formula in Egypt that Prevents Dehydration and Inflammation.', 'أول تركيبة غسول كريمية في مصر تساعد على الوقاية من جفاف البشرة والالتهابات.'],
        ['When dullness hides your natural glow, and your skin is ready to be revealed.', 'لما البهتان يسرق إشراقتك، وبشرتك تستنى ترجع تتنفس من جديد.'],
        ['Alpha-Arbutin blocks tyrosinase — the enzyme that creates dark spots. Vitamin C & E neutralize the oxidative damage beneath. Niacinamide rebuilds the barrier so spots fade and stay faded.', 'مش لازم تخبيها — خليها تختفي. ألفا أربوتين بيحجب الإنزيم اللي بيعمل البقع. فيتامين C وE بيعالجوا الضرر من تحت. والنياسيناميد بيضمن إن البقع تختفي وتفضل مختفية.'],
        ['72-Hour Hydration · Hand & Body · All Skin Types', 'ترطيب حتى 72 ساعة · لليدين والجسم · لجميع أنواع البشرة'],
        ['Post-Procedure Recovery', 'بعد الإجراءات التجميلية'],
        ['Scars begin to soften and post-acne marks are visibly reduced.', 'الندبات تبدأ في التخفيف وآثار حب الشباب تقل بشكل واضح.']
      ],
      'pp-h': [
        ['<em>Montaña</em> Acne Facial<br>Cleanser', 'غسول مونتانيا<br><em>لعلاج حب الشباب للوجه</em>'],
        ['<em>Montaña</em> Whitening<br>Cleanser', 'غسول مونتانيا<br><em>للتفتيح</em>'],
        ['<em>Montaña</em> Whitening<br>Cream', 'كريم مونتانا<br><em>للتفتيح</em>'],
        ['Montaña Hand & Body<br><em>Lotion</em>', 'لوشن مونتانا<br><em>لليدين والجسم</em>'],
        ['<em>Montaña</em> Post Laser<br>Cream', 'كريم مونتانا<br><em>للعناية بعد الليزر</em>'],
        ['<em>Montaña</em> Anti-Scar<br>Gel', 'جل مونتانا<br><em>لعلاج الندبات</em>']
      ],
      'ch-act': [
        ['Act 01 · Tranquility', 'الفصل الأول · الهدوء'],
        ['Act 02 · Illumina', 'الفصل التاني · الإشراق'],
        ['Act 03 · Eclipse', 'الفصل التالت · الكسوف'],
        ['Act 04 · Harmony', 'الفصل الرابع · التناغم'],
        ['Act 05 · Rebirth', 'الفصل الخامس · ولادة جديدة'],
        ['Act 06 · Erasion', 'الفصل السادس · المحو']
      ],
      'ch-t': [
        ['When your skin is<br><em>fighting itself.</em>', 'لما بشرتك بتحارب<br><em>نفسها كل يوم.</em>'],
        ['When your glow is<br><em>buried beneath the surface.</em>', 'لما توهجك<br><em>مستخبي تحت السطح.</em>'],
        ['When your past<br><em>writes itself on your skin.</em>', 'لما ماضيك<br><em>بيفضل يكتب على بشرتك.</em>'],
        ['When your skin<br><em>is asking for more.</em>', 'لما بشرتك<br><em>بتطلب أكتر.</em>'],
        ['When your skin needs<br><em>to heal, quietly.</em>', 'لما بشرتك<br><em>محتاجة ترتاح بعد المعركة.</em>'],
        ['When scars become<br><em>the story you rewrite.</em>', 'لما الندبة بقت جزء منك<br><em>وإنتي مش عايزاها.</em>']
      ],
      fsl: [['Formulas', 'تركيبة'], ['Hydration', 'ترطيب'], ['Tested', 'اختبار جلدي'], ['Results', 'ثقة']]
    },
    ppIngr: [
      {
        en: ['Salicylic Acid', 'Zinc PCA', 'Niacinamide (Vitamin B3)', 'Argan Oil', 'Olive Oil', 'Jojoba Oil'],
        ar: ['حمض الساليسيليك', 'زنك PCA', 'النياسيناميد (فيتامين B3)', 'زيت الأرجان', 'زيت الزيتون', 'زيت الجوجوبا']
      },
      {
        en: ['Licorice Extract', 'Niacinamide', 'Salicylic Acid', 'Tea Tree Oil', 'Zinc PCA', 'Vitamin C', 'Wheat Germ Oil', 'Almond Oil'],
        ar: ['مستخلص العرقسوس', 'النياسيناميد', 'حمض الساليسيليك', 'زيت شجرة الشاي', 'زنك PCA', 'فيتامين C', 'زيت جنين القمح', 'زيت اللوز']
      },
      {
        en: ['Alpha-arbutin', 'Licorice Extract', 'Niacinamide', 'Lactic Acid', 'Zinc Oxide', 'Vitamin C', 'Vitamin E', 'Rose Oil'],
        ar: ['ألفا أربوتين', 'مستخلص العرقسوس', 'نياسيناميد', 'حمض اللاكتيك', 'أكسيد الزنك', 'فيتامين C', 'فيتامين E', 'زيت الورد']
      },
      {
        en: ['Glycerin', 'Olive Oil', 'Almond Oil', 'Jojoba Oil', 'Coconut Oil', 'Cocoa Butter', 'Shea Butter', 'Beeswax', 'Vitamin E'],
        ar: ['الجليسرين', 'زيت الزيتون', 'زيت اللوز', 'زيت الجوجوبا', 'زيت جوز الهند', 'زبدة الكاكاو', 'زبدة الشيا', 'شمع العسل', 'فيتامين E']
      },
      {
        en: ['Sesame Oil', 'Panthenol (Pro-Vitamin B5)', 'Allantoin', 'Beeswax', 'Glycerin', 'Aloe Vera', 'Vitamin E', 'Niacinamide', 'Green Tea Extract', 'Lanolin'],
        ar: ['زيت السمسم', 'بانثينول (فيتامين B5)', 'الألانتوين', 'شمع العسل', 'الجليسرين', 'الألوفيرا', 'فيتامين E', 'النياسيناميد', 'مستخلص الشاي الأخضر', 'اللانولين']
      },
      {
        en: ['Medical-Grade Silicone', 'Vitamin E'],
        ar: ['سيليكون طبي', 'فيتامين E']
      }
    ]
  };
}

module.exports = { getDefaultHomepageContent };
