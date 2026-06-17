/* Montana chatbot — product, ingredient & skincare terminology knowledge base */
window.MontanaChatKnowledge = (function () {
  var GLOSSARY = [
    { id: 'zinc-pca', name: 'Zinc PCA', aliases: ['زنك', 'زنك pca', 'زنك بي سي ايه'], cat: 'active', role: { ar: 'منظّم للزهم', en: 'Sebum regulator' }, products: ['acne-cleanser', 'whitening-cleanser'], what: { ar: 'ملح زنك بيظبط إفراز الزهم في البشرة.', en: 'A zinc salt that regulates sebum production.' }, why: { ar: 'بيقلّل الدهون وبيمنع الحبوب من أصلها.', en: 'Reduces oiliness and helps prevent breakouts at the source.' }, skin: { ar: 'بشرة دهنية ومعرضة للحبوب', en: 'Oily & acne-prone' } },
    { id: 'salicylic', name: 'Salicylic Acid', aliases: ['ساليسيليك', 'ساليسيلك', 'حمض الساليسيليك', 'bha', 'بي اتش ايه'], cat: 'active', role: { ar: 'BHA · يصفّي المسام', en: 'BHA · Pore refiner' }, products: ['acne-cleanser'], what: { ar: 'حمض BHA بينفذ جوه المسام.', en: 'A BHA that penetrates inside pores.' }, why: { ar: 'بيفك الانسداد وبيصفّي المسام من جوا.', en: 'Dissolves clogged pores and clears congestion.' }, skin: { ar: 'بشرة دهنية ومسام مسدودة', en: 'Oily, congested skin' } },
    { id: 'licorice', name: 'Licorice Extract', aliases: ['عرق السوس', 'عرقسوس', 'سوس'], cat: 'botanical', role: { ar: 'نباتي للتفتيح', en: 'Brightening botanical' }, products: ['whitening-cleanser'], what: { ar: 'مستخلص عرق السوس بيقلّل نقل الميلانين.', en: 'A botanical that inhibits melanin transfer.' }, why: { ar: 'بينوّر البشرة ويوحّد اللون بشكل طبيعي.', en: 'Brightens and evens skin tone naturally.' }, skin: { ar: 'كل أنواع البشرة', en: 'All skin types' } },
    { id: 'niacinamide', name: 'Niacinamide', aliases: ['نياسيناميد', 'نياكيناميد', 'فيتامين ب3', 'فيتامين b3', 'b3'], cat: 'vitamin', role: { ar: 'فيتامين B3 · حاجز', en: 'Vitamin B3 · Barrier' }, products: ['whitening-cleanser', 'whitening-cream'], what: { ar: 'فيتامين B3 بيقوّي حاجز البشرة.', en: 'Vitamin B3 that strengthens the skin barrier.' }, why: { ar: 'بيوحّد اللون، بيقلّل الاحمرار، وبيساعد التعافي.', en: 'Unifies tone, reduces redness, and supports repair.' }, skin: { ar: 'كل أنواع البشرة', en: 'All skin types' } },
    { id: 'alpha-arbutin', name: 'Alpha-Arbutin', aliases: ['الفا اربوتين', 'ألفا أربوتين', 'الفا ارجوتين', 'اربوتين', 'alpha arbutin'], cat: 'active', role: { ar: 'يخفّي البقع', en: 'Spot fader' }, products: ['whitening-cream'], what: { ar: 'مادة تفتيح بتوقف إنزيم التيروزيناز اللي بيعمل الميلانين.', en: 'A depigmenting agent that blocks tyrosinase.' }, why: { ar: 'بتخفّي البقع وتمنع ظهور جديد.', en: 'Fades dark spots and prevents new ones.' }, skin: { ar: 'بقع واسمرار', en: 'Hyperpigmentation' } },
    { id: 'glycerin', name: 'Glycerin', aliases: ['جليسرين', 'جلسرين', 'جلسرين'], cat: 'active', role: { ar: 'مرطّب', en: 'Humectant' }, products: ['body-lotion'], what: { ar: 'مرطّب بيسحب المية لجوا البشرة.', en: 'A humectant that draws moisture into skin.' }, why: { ar: 'بيوفّر ترطيب عميق يدوم.', en: 'Delivers deep, lasting hydration.' }, skin: { ar: 'بشرة جافة وعطشانة', en: 'Dry & dehydrated' } },
    { id: 'green-tea', name: 'Green Tea Extract', aliases: ['شاي اخضر', 'الشاي الاخضر', 'شاي أخضر'], cat: 'botanical', role: { ar: 'مضاد للالتهاب', en: 'Anti-inflammatory' }, products: ['post-laser'], what: { ar: 'مضاد أكسدة قوي بيقلّل الالتهاب.', en: 'A powerful antioxidant with anti-inflammatory action.' }, why: { ar: 'بيهدّي الاحمرار ويهدّي البشرة بعد الإجراءات.', en: 'Soothes redness and calms post-procedure skin.' }, skin: { ar: 'بشرة حساسة وبعد علاج', en: 'Sensitive, post-treatment' } },
    { id: 'silicone', name: 'Medical Silicone', aliases: ['سيليكون', 'سيليكون طبي', 'جل سيليكون', 'medical silicone'], cat: 'clinical', role: { ar: 'علاج الندوب', en: 'Scar therapy' }, products: ['anti-scar'], what: { ar: 'جل سيليكون طبي لعلاج الندوب.', en: 'Clinical-grade silicone gel for scar management.' }, why: { ar: 'بيظبط الكولاجين عشان الندبة تنبسط وتخف.', en: 'Regulates collagen to flatten and fade scars.' }, skin: { ar: 'ندوب وجرح', en: 'Scars & keloids' } },
    { id: 'argan-oil', name: 'Argan Oil', aliases: ['ارغان', 'زيت ارغان', 'أرغان'], cat: 'botanical', role: { ar: 'زيت للحاجز', en: 'Barrier oil' }, products: ['acne-cleanser'], what: { ar: 'زيت مغذّي غني بفيتامين E والأحماض الدهنية.', en: 'A nourishing oil rich in vitamin E and fatty acids.' }, why: { ar: 'بيرجّع حاجز البشرة من غير ما يسد المسام.', en: 'Restores the skin barrier without clogging pores.' }, skin: { ar: 'بشرة جافة وحاجز ضعيف', en: 'Dry & compromised barrier' } },
    { id: 'jojoba-oil', name: 'Jojoba Oil', aliases: ['جوجوبا', 'زيت جوجوبا'], cat: 'botanical', role: { ar: 'يوازن الدهون', en: 'Sebum mimic' }, products: ['acne-cleanser'], what: { ar: 'شمع نباتي شبيه بالزهم الطبيعي للبشرة.', en: "A plant wax that mimics skin's natural sebum." }, why: { ar: 'بيوازن الدهون ويهدّي التهيّج.', en: 'Balances oil production and soothes irritation.' }, skin: { ar: 'بشرة دهنية ومختلطة', en: 'Oily & combination' } },
    { id: 'vitamin-c', name: 'Vitamin C', aliases: ['فيتامين سي', 'فيتامين سى', 'فيتامين c', 'vit c'], cat: 'vitamin', role: { ar: 'مضاد أكسدة للتفتيح', en: 'Antioxidant brightener' }, products: ['whitening-cleanser'], what: { ar: 'مضاد أكسدة قوي بينوّر وبيحمي.', en: 'A potent antioxidant that brightens and protects.' }, why: { ar: 'بيمسح البهتان وبيحمي من عوامل البيئة.', en: 'Fades dullness and shields against environmental damage.' }, skin: { ar: 'بهتان ولون مش موحّد', en: 'Dull & uneven tone' } },
    { id: 'vitamin-c-e', name: 'Vitamin C & E', aliases: ['فيتامين سي واي', 'فيتامين c و e'], cat: 'vitamin', role: { ar: 'ثنائي مضادات أكسدة', en: 'Antioxidant duo' }, products: ['whitening-cream'], what: { ar: 'ثنائي مضادات أكسدة بيعالج الجذور الحرة.', en: 'Antioxidant duo that neutralizes free radicals.' }, why: { ar: 'بيحمي البشرة ويساعد البقع تخف.', en: 'Protects skin while supporting spot fading.' }, skin: { ar: 'بقع واسمرار', en: 'Hyperpigmentation' } },
    { id: 'shea-butter', name: 'Shea Butter', aliases: ['شيا', 'زبدة الشيا', 'زبدة شيا'], cat: 'botanical', role: { ar: 'مرطّب غني', en: 'Rich emollient' }, products: ['body-lotion'], what: { ar: 'مرطّب غني من جوز شجرة الشيا.', en: 'A rich emollient from shea tree nuts.' }, why: { ar: 'بيحبس الرطوبة وينعّم البشرة الخشنة.', en: 'Seals moisture and softens rough skin.' }, skin: { ar: 'بشرة جسم جافة', en: 'Dry body skin' } },
    { id: 'coconut-oil', name: 'Coconut Oil', aliases: ['جوز هند', 'زيت جوز الهند', 'جوز الهند'], cat: 'botanical', role: { ar: 'يحبس الترطيب', en: 'Lipid seal' }, products: ['body-lotion'], what: { ar: 'دهون خفيفة بتقوّي حاجز الترطيب.', en: 'A lightweight lipid that reinforces the moisture barrier.' }, why: { ar: 'بتقفل الترطيب لراحة تدوم.', en: 'Locks hydration for long-lasting comfort.' }, skin: { ar: 'بشرة عطشانة', en: 'Dehydrated skin' } },
    { id: 'vitamin-e', name: 'Vitamin E', aliases: ['فيتامين اي', 'فيتامين e'], cat: 'vitamin', role: { ar: 'يحمي الخلايا', en: 'Cell defender' }, products: ['body-lotion', 'anti-scar'], what: { ar: 'مضاد أكسدة يذوب في الدهون وبيدافع عن خلايا البشرة.', en: 'A fat-soluble antioxidant that defends skin cells.' }, why: { ar: 'بيساعد التعافي وبيمنع علامات التعب المبكرة.', en: 'Supports repair and prevents premature aging.' }, skin: { ar: 'كل أنواع البشرة', en: 'All skin types' } },
    { id: 'sesame-oil', name: 'Sesame Oil', aliases: ['سمسم', 'زيت السمسم'], cat: 'botanical', role: { ar: 'زيت للتعافي', en: 'Recovery oil' }, products: ['post-laser'], what: { ar: 'زيت تقليدي غني بالسيسامين والأحماض الدهنية.', en: 'A traditional oil rich in sesamin and fatty acids.' }, why: { ar: 'بيرجّع الحاجز الدهني بعد التوتر أو العلاج.', en: 'Rebuilds the lipid barrier after stress or treatment.' }, skin: { ar: 'بشرة حساسة وبعد علاج', en: 'Sensitive & post-treatment' } },
    { id: 'vitamin-e-b3', name: 'Vitamin E & B3', aliases: ['فيتامين اي وب3'], cat: 'vitamin', role: { ar: 'مركّب للتعافي', en: 'Repair complex' }, products: ['post-laser'], what: { ar: 'فيتامينات للتعافي بتهدّي وتبني من جديد.', en: 'Repair-focused vitamins that calm and rebuild.' }, why: { ar: 'بتسرّع التعافي وتقوّي حاجز البشرة.', en: 'Accelerates recovery and strengthens the barrier.' }, skin: { ar: 'بعد الإجراءات', en: 'Post-procedure' } }
  ];

  var PRODUCT_ALIASES = {
    'acne-cleanser': ['غسول الحبوب', 'غسول وش للحبوب', 'غسول حبوب', 'غسول الوجه للحبوب', 'acne cleanser', 'acne wash'],
    'whitening-cleanser': ['غسول التفتيح', 'غسول تفتيح', 'غسول الاشراق', 'whitening cleanser', 'brightening cleanser'],
    'whitening-cream': ['كريم التفتيح', 'كريم تفتيح', 'كريم البقع', 'كريم البقع الداكنه', 'whitening cream', 'brightening cream'],
    'body-lotion': ['لوشن الجسم', 'لوشن الايدين', 'لوشن ايدين وجسم', 'لوشن', 'body lotion', 'hand lotion'],
    'post-laser': ['كريم الليزر', 'كريم بعد الليزر', 'بعد الليزر', 'post laser', 'laser cream'],
    'anti-scar': ['جل الندوب', 'سيليكون الندوب', 'كريم الندوب', 'علاج الندوب', 'anti scar', 'scar gel', 'silicone gel']
  };

  var CONCERN_MAP = {
    acne: { products: ['acne-cleanser'], area: 'face', pitch: { ar: 'للحبوب والبشرة الدهنية، الخطوة الأولى غسول يوازن الزهم ويفتح المسام من جوا.', en: 'For breakouts and oily skin, start with a cleanser that regulates sebum and clears pores from within.' } },
    oily: { products: ['acne-cleanser'], area: 'face', pitch: { ar: 'البشرة الدهنية محتاجة تنظيف عميق من غير ما تجفّفها — غسول الحبوب بيوازن الزهم ويحمي الحاجز.', en: 'Oily skin needs deep cleansing without stripping — our acne cleanser balances sebum and protects the barrier.' } },
    pores: { products: ['acne-cleanser'], area: 'face', pitch: { ar: 'المسام المسدودة محتاجة ساليسيليك يدخل جواها — غسول الحبوب بيصفّي المسام ويقلّل الدهون.', en: 'Clogged pores need salicylic acid that goes inside — our acne cleanser refines pores and reduces oil.' } },
    whiten: { products: ['whitening-cleanser', 'whitening-cream'], area: 'face', pitch: { ar: 'للتفتيح والبقع: غسول يومي للإشراق + كريم مركّز بالليل بألفا أربوتين — ثنائي قوي يوحّد اللون.', en: 'For brightening: daily illuminating cleanser + concentrated night cream with alpha-arbutin — a powerful brightening duo.' } },
    dull: { products: ['whitening-cleanser', 'whitening-cream'], area: 'face', pitch: { ar: 'البهتان محتاج فيتامين C وعرق السوس في الغسول، وكريم تفتيح بالليل يثبّت النتيجة.', en: 'Dullness needs vitamin C and licorice in the cleanser, plus a brightening night cream to lock in results.' } },
    spots: { products: ['whitening-cream'], area: 'face', pitch: { ar: 'البقع والمناطق الداكنة (إبط، ركبة، مرافق) محتاجة كريم تفتيح بألفا أربوتين — نتائج خلال ٢–٤ أسابيع.', en: 'Dark spots and sensitive areas need alpha-arbutin cream — visible results in 2–4 weeks.' } },
    dry: { products: ['body-lotion'], area: 'body', pitch: { ar: 'الجفاف محتاج ترطيب يدوم — لوشن الجسم بيجليسرين وشيا بيحبس الرطوبة ٧٢ ساعة من غير دهون.', en: 'Dryness needs lasting hydration — body lotion with glycerin and shea locks moisture for 72 hours, non-greasy.' },
      facePitch: { ar: 'لو وشك ناشف، غسول التفتيح لطيف ومناسب للاستخدام اليومي — وللجسم والإيدين لوشن الجسم بيترطّب ٧٢ ساعة.', en: 'For dry face, whitening cleanser is gentle for daily use — for body and hands, body lotion hydrates for 72 hours.' } },
    scar: { products: ['anti-scar'], area: 'clinical', pitch: { ar: 'الندوب محتاجة سيليكون طبي يظبط الكولاجين — الجل بينبسط الندبة ويخفّي لونها مع الاستخدام المنتظم.', en: 'Scars need medical silicone to regulate collagen — the gel flattens and fades with consistent use.' } },
    laser: { products: ['post-laser'], area: 'clinical', pitch: { ar: 'بعد الليزر أو أي إجراء، البشرة محتاجة تهدية فورية — كريم الشاي الأخضر بيقلّل الاحمرار ويسرّع التعافي.', en: 'After laser or procedures, skin needs immediate soothing — green tea cream reduces redness and speeds recovery.' } },
    sensitive: { products: ['post-laser'], area: 'face', pitch: { ar: 'البشرة الحساسة بعد العلاج محتاجة منتج لطيف — كريم بعد الليزر مهدئ ومضاد التهاب من غير قسوة.', en: 'Sensitive post-treatment skin needs gentle care — post-laser cream soothes without harsh actives.' } }
  };

  var ROUTINES = {
    whiten: { ar: 'روتين التفتيح: صباحًا غسول التفتيح → واقي شمس. مساءً غسول التفتيح → كريم التفتيح على البقع.', en: 'Brightening routine: AM whitening cleanser → SPF. PM whitening cleanser → brightening cream on spots.' },
    acne: { ar: 'روتين الحبوب: غسول الحبوب صباحًا ومساءً على وش مبلول، دلّكي ٣٠–٦٠ ثانية، اشطفي وكمّلي بمرطّب خفيف.', en: 'Acne routine: acne cleanser AM & PM on damp skin, massage 30–60 sec, rinse, follow with light moisturizer.' },
    scar: { ar: 'روتين الندوب: نظّفي المنطقة وجفّفيها، طبقة رفيعة من جل السيليكون مرتين يوميًا، استمري ٨–١٢ أسبوع للندوب القديمة.', en: 'Scar routine: clean and dry area, thin silicone gel layer twice daily, 8–12 weeks for old scars.' }
  };

  var TERMS = {
    'زهم': { ar: 'الزهم ده الزيت الطبيعي للبشرة — لما يزيد بيسد المسام ويعمل حبوب. منتجاتنا بتوازنه من غير ما تجفّف.', en: 'Sebum is your skin\'s natural oil — excess clogs pores and causes breakouts. Our products balance it without drying.' },
    'مسام': { ar: 'المسام قنوات صغيرة في البشرة — لما تتسد بتظهر حبوب ورؤوس سوداء. الساليسيليك بيدخل جواها ويفك الانسداد.', en: 'Pores are tiny skin channels — when clogged they cause breakouts. Salicylic acid penetrates and clears them.' },
    'حاجز البشرة': { ar: 'حاجز البشرة الطبقة اللي بتحميكي — لما يتضرر البشرة بتجف وتتحسس. نياسيناميد والزيوت الطبيعية بترجّعه.', en: 'The skin barrier protects you — when damaged, skin gets dry and sensitive. Niacinamide and botanical oils restore it.' },
    'ميلانين': { ar: 'الميلانين اللي بيدي لون البشرة — لما يزيد بيعمل بقع واسمرار. عرق السوس وألفا أربوتين بيوقفوا زيادته.', en: 'Melanin gives skin its color — excess causes spots. Licorice and alpha-arbutin inhibit overproduction.' },
    'كولاجين': { ar: 'الكولاجين بيدي البشرة نعومتها — في الندوب بيتكون زيادة ويرفعها. السيليكون الطبي بيظبط إنتاجه.', en: 'Collagen gives skin firmness — in scars it overgrows and raises. Medical silicone regulates its production.' },
    'bha': { ar: 'BHA زي الساليسيليك — حمض دهني يدخل جوه المسام ويفك الانسداد. موجود في غسول الحبوب.', en: 'BHA like salicylic acid — oil-soluble acid that enters pores and clears congestion. In our acne cleanser.' },
    'spf': { ar: 'واقي الشمس ضروري مع أي منتج تفتيح — الصبح دايمًا SPF عشان البقع مترجعش.', en: 'SPF is essential with brightening products — always use morning SPF so spots don\'t return.' },
    'cod': { ar: 'الدفع عند الاستلام متاح — بتدفعي لما الأوردر يوصلك.', en: 'Cash on delivery available — pay when your order arrives.' }
  };

  var SHIPPING = {
    ar: 'التوصيل: القاهرة والجيزة ٢–٤ أيام. شحن مجاني فوق ١٠٠٠ جنيه. الدفع عند الاستلام متاح.',
    en: 'Delivery: Cairo & Giza 2–4 days. Free shipping over EGP 1,000. Cash on delivery available.'
  };

  var PAIRS = {
    'acne-cleanser': 'whitening-cleanser',
    'whitening-cleanser': 'whitening-cream',
    'whitening-cream': 'whitening-cleanser',
    'post-laser': 'anti-scar',
    'anti-scar': 'post-laser'
  };

  function fld(obj, lang) {
    if (!obj) return '';
    if (typeof obj === 'string') return obj;
    return lang === 'ar' ? (obj.ar || obj.en || '') : (obj.en || obj.ar || '');
  }

  function normalize(normFn, text) {
    return normFn ? normFn(text) : String(text || '').toLowerCase();
  }

  function findIngredient(text, norm) {
    var t = norm || String(text || '').toLowerCase();
    for (var i = 0; i < GLOSSARY.length; i++) {
      var g = GLOSSARY[i];
      if (t.indexOf(normalize(null, g.name)) > -1) return g;
      for (var j = 0; j < (g.aliases || []).length; j++) {
        if (t.indexOf(normalize(null, g.aliases[j])) > -1) return g;
      }
    }
    return null;
  }

  var PRODUCT_KEYWORDS = [
    { id: 'whitening-cream', patterns: [/كريم\s*الت?فتيح/, /كريم تفتيح/, /whitening cream/, /brightening cream/] },
    { id: 'whitening-cleanser', patterns: [/غسول\s*الت?فتيح/, /غسول تفتيح/, /whitening cleanser/] },
    { id: 'acne-cleanser', patterns: [/غسول\s*ال?حبوب/, /غسول حبوب/, /غسول وش/, /للحبوب/, /والحبوب/, /وحبوب/, /\bحبوب\b/, /acne cleanser/] },
    { id: 'body-lotion', patterns: [/لوشن/, /body lotion/, /ناشف/, /جاف/, /جفاف/, /ترطيب/, /dry skin/, /\bdry\b/] },
    { id: 'post-laser', patterns: [/كريم الليزر/, /بعد الليزر/, /post laser/] },
    { id: 'anti-scar', patterns: [/جل الندوب/, /سيليكون/, /anti scar/, /scar gel/] }
  ];

  var MULTI_CONCERN_SETS = {
    'acne+whiten': {
      products: ['acne-cleanser', 'whitening-cream'],
      pitch: {
        ar: 'عندك حبوب وتفتيح مع بعض — ده طبيعي! أنصحك بـ غسول الحبوب للوش صباحًا ومساءً، وكريم التفتيح بالليل على البقع. الاتنين يشتغلوا مع بعض من غير ما يضايقوا بشرتك.',
        en: 'Acne and brightening together is common! Use acne cleanser AM/PM on face, and brightening cream at night on spots — they work well together.'
      }
    },
    'acne+dull': { products: ['acne-cleanser', 'whitening-cream'], pitch: { ar: 'للحبوب والبهتان: غسول الحبوب + كريم التفتيح — روتين متكامل.', en: 'For acne and dullness: acne cleanser + brightening cream.' } },
    'acne+dry': {
      products: ['acne-cleanser', 'body-lotion'],
      pitch: {
        ar: 'جفاف مع حبوب — غسول الحبوب للوش صباحًا ومساءً، ولوشن الجسم للترطيب ٧٢ ساعة. الاتنين يكملوا بعض.',
        en: 'Dry skin with breakouts — acne cleanser for face, body lotion for 72-hour hydration. They work together.'
      }
    }
  };

  function addProductUnique(list, product) {
    if (!product) return list;
    if (!list.some(function (p) { return p.id === product.id; })) list.push(product);
    return list;
  }

  function findAllProductsByKnowledge(text, norm, products) {
    products = products || [];
    var n = norm || String(text || '').toLowerCase();
    var found = [];
    var seen = {};

    function pushId(id) {
      if (seen[id]) return;
      var p = products.find(function (x) { return x.id === id; });
      if (p) { seen[id] = true; found.push(p); }
    }

    for (var i = 0; i < products.length; i++) {
      var p = products[i];
      if (String(text).indexOf(p.nameAr) > -1 || String(text).indexOf(p.nameEn) > -1) pushId(p.id);
      if (n.indexOf(normalize(null, p.nameAr)) > -1) pushId(p.id);
    }

    var keys = Object.keys(PRODUCT_ALIASES);
    for (var k = 0; k < keys.length; k++) {
      var id = keys[k];
      var aliases = PRODUCT_ALIASES[id];
      for (var a = 0; a < aliases.length; a++) {
        if (n.indexOf(normalize(null, aliases[a])) > -1) pushId(id);
      }
    }

    for (var ki = 0; ki < PRODUCT_KEYWORDS.length; ki++) {
      var rule = PRODUCT_KEYWORDS[ki];
      for (var pi = 0; pi < rule.patterns.length; pi++) {
        if (rule.patterns[pi].test(n)) { pushId(rule.id); break; }
      }
    }

    if (!found.length) {
      var ing = findIngredient(text, n);
      if (ing && ing.products && ing.products.length) {
        ing.products.forEach(function (pid) { pushId(pid); });
      }
    }

    if (!found.length) {
      if (/ناشف|جاف|جفاف|ترطيب|تقشر|dry|dehydrat|moistur/.test(n)) pushId('body-lotion');
      else if (/حبوب|دهن|زيت|بثور|acne|pimple|oily|breakout/.test(n)) pushId('acne-cleanser');
      else if (/كريم.*تفتيح|تفتيح|تبييض|بقع|كالح|بهت|whiten|brighten|dark spot/.test(n)) pushId('whitening-cream');
      else if (/غسول.*تفتيح|غسول تفتيح/.test(n)) pushId('whitening-cleanser');
      else if (/ندوب|اثار|scar|keloid/.test(n)) pushId('anti-scar');
      else if (/ليزر|post laser|after laser/.test(n)) pushId('post-laser');
    }

    return found;
  }

  function findProductByKnowledge(text, norm, products) {
    var all = findAllProductsByKnowledge(text, norm, products);
    return all.length ? all[0] : null;
  }

  function resolveMultiConcernIds(concerns) {
    concerns = concerns || [];
    var hasAcne = concerns.some(function (c) { return c === 'acne' || c === 'oily' || c === 'pores'; });
    var hasWhiten = concerns.some(function (c) { return c === 'whiten' || c === 'dull' || c === 'spots'; });
    var hasDry = concerns.some(function (c) { return c === 'dry'; });
    if (hasAcne && hasWhiten) return MULTI_CONCERN_SETS['acne+whiten'].products.slice();
    if (hasAcne && hasDry) return MULTI_CONCERN_SETS['acne+dry'].products.slice();
    var ids = [];
    concerns.forEach(function (c) {
      recommendProducts(c).forEach(function (id) {
        if (ids.indexOf(id) === -1) ids.push(id);
      });
    });
    return ids;
  }

  function buildMultiConsultationReply(concerns, lang, products) {
    products = products || [];
    var hasAcne = concerns.some(function (c) { return c === 'acne' || c === 'oily' || c === 'pores'; });
    var hasWhiten = concerns.some(function (c) { return c === 'whiten' || c === 'dull' || c === 'spots'; });
    var hasDry = concerns.some(function (c) { return c === 'dry'; });
    var preset = hasAcne && hasWhiten ? MULTI_CONCERN_SETS['acne+whiten']
      : (hasAcne && hasDry ? MULTI_CONCERN_SETS['acne+dry'] : null);
    var ids = preset ? preset.products.slice() : resolveMultiConcernIds(concerns);
    if (ids.length < 2) return null;

    var parts = [];
    if (preset) parts.push(fld(preset.pitch, lang));
    else parts.push(lang === 'en' ? 'Based on what you told me, I recommend this combination:' : 'من كلامك، أنصحك بالتوليفة دي:');

    ids.forEach(function (id) {
      var p = products.find(function (x) { return x.id === id; });
      if (p) parts.push('\n' + buildProductExpertReply(p, lang, { offerOrder: false }));
    });

    parts.push('\n' + (lang === 'en' ? 'Would you like to order both?' : 'عايزة نعمل أوردر بالاتنين؟'));
    return parts.join('\n');
  }

  function getRawProduct(id) {
    return (window.MONTANA_PRODUCTS || []).find(function (p) { return p.id === id; }) || null;
  }

  function usageLines(productId, lang) {
    var raw = getRawProduct(productId);
    if (!raw || !raw.usage) return [];
    var u = raw.usage;
    return lang === 'ar' ? (u.ar || u.en || []) : (u.en || u.ar || []);
  }

  function ingredientList(productId, lang) {
    var raw = getRawProduct(productId);
    if (!raw || !raw.ingredients) return [];
    var ing = raw.ingredients;
    return lang === 'ar' ? (ing.ar || ing.en || []) : (ing.en || ing.ar || []);
  }

  function recommendProducts(concern) {
    var c = CONCERN_MAP[concern];
    return c ? c.products.slice() : [];
  }

  function resolveConcernProduct(concern, norm, products) {
    products = products || [];
    norm = norm || '';
    if (/كريم\s*(ال)?تفتيح|كريم\s*تفتيح|كريم\s*البقع/.test(norm)) {
      return products.find(function (p) { return p.id === 'whitening-cream'; }) || null;
    }
    if (/غسول\s*(ال)?تفتيح|غسول\s*تفتيح/.test(norm)) {
      return products.find(function (p) { return p.id === 'whitening-cleanser'; }) || null;
    }
    if (/غسول\s*(ال)?حبوب|غسول\s*حبوب/.test(norm)) {
      return products.find(function (p) { return p.id === 'acne-cleanser'; }) || null;
    }
    if (concern === 'dry' && /وش|وجه|face|فيس/.test(norm) && !/جسم|ايد|ايدين|body|hand/.test(norm)) {
      return products.find(function (p) { return p.id === 'whitening-cleanser'; }) ||
        products.find(function (p) { return p.id === 'body-lotion'; }) || null;
    }
    var ids = recommendProducts(concern);
    return ids.length ? products.find(function (p) { return p.id === ids[0]; }) || null : null;
  }

  function concernPitch(concern, norm, lang) {
    var c = CONCERN_MAP[concern];
    if (!c) return '';
    if (concern === 'dry' && /وش|وجه|face|فيس/.test(norm || '') && c.facePitch) {
      return fld(c.facePitch, lang);
    }
    return fld(c.pitch, lang);
  }

  function buildGuideMenu(lang) {
    if (lang === 'en') {
      return 'Tell me what you need — I\'ll recommend the right product:\n\n' +
        '• Acne or oily skin\n• Dullness & brightening\n• Dark spots\n• Dry skin\n• Scars\n• After laser\n\n' +
        'Or say "I want to order" anytime.';
    }
    return 'قوليلي إيه اللي محتاجاه وأنا هرشّحلك الأنسب:\n\n' +
      '• عندي حبوب / بشرة دهنية\n• بشرتي كالحة وعايزة تفتيح\n• عندي بقع أو اسمرار\n• بشرتي ناشفة\n• عندي ندوب أو آثار\n• بعد الليزر محتاجة عناية\n\n' +
      'أو قولي «عايزة أطلب» في أي وقت.';
  }

  function buildSmartFallback(lang, ctx) {
    ctx = ctx || {};
    var products = ctx.products || [];
    if (ctx.concerns && ctx.concerns.length >= 2) {
      var multi = buildMultiConsultationReply(ctx.concerns, lang, products);
      if (multi) return multi;
    }
    if (ctx.concern) {
      var consult = buildConsultationReply(ctx.concern, lang, products, ctx.norm);
      if (consult) return consult;
    }
    if (ctx.product) {
      return buildProductExpertReply(ctx.product, lang, { offerOrder: true });
    }
    return buildGuideMenu(lang);
  }

  function professionalPitch(concern, lang) {
    var c = CONCERN_MAP[concern];
    if (!c) return '';
    return fld(c.pitch, lang);
  }

  function buildIngredientReply(ing, lang, products) {
    products = products || [];
    var names = (ing.products || []).map(function (pid) {
      var p = products.find(function (x) { return x.id === pid; });
      return p ? (lang === 'en' ? p.nameEn : p.nameAr) : '';
    }).filter(Boolean);

    if (lang === 'en') {
      return ing.name + ' — ' + fld(ing.role, lang) + '.\n\n' +
        fld(ing.what, lang) + '\n' + fld(ing.why, lang) + '\n\n' +
        'Best for: ' + fld(ing.skin, lang) +
        (names.length ? '\n\nFound in: ' + names.join(', ') + '.' : '');
    }
    return ing.name + ' — ' + fld(ing.role, lang) + '.\n\n' +
      fld(ing.what, lang) + '\n' + fld(ing.why, lang) + '\n\n' +
      'مناسب لـ: ' + fld(ing.skin, lang) +
      (names.length ? '\n\nموجود في: ' + names.join('، ') + '.' : '');
  }

  function buildProductExpertReply(product, lang, opts) {
    opts = opts || {};
    var ing = ingredientList(product.id, lang).join(lang === 'en' ? ', ' : '، ');
    var lines = [];

    if (lang === 'en') {
      lines.push(product.nameEn + ' — ' + (product.pfor || '') + '.');
      lines.push(product.descEn || product.desc);
      if (ing) lines.push('Key actives: ' + ing + '.');
      lines.push('Price: ' + product.price + ' EGP · ' + product.sizeEn);
      if (opts.usage) {
        var steps = usageLines(product.id, lang);
        if (steps.length) lines.push('\nHow to use:\n• ' + steps.join('\n• '));
      }
      if (opts.offerOrder !== false) lines.push('\nWould you like to place an order?');
    } else {
      lines.push(product.nameAr + ' — ' + (product.pfor || '') + '.');
      lines.push(product.desc);
      if (ing) lines.push('المكونات الفعّالة: ' + ing + '.');
      lines.push('السعر: ' + product.price + ' جنيه · ' + product.size);
      if (opts.usage) {
        var stepsAr = usageLines(product.id, lang);
        if (stepsAr.length) lines.push('\nطريقة الاستخدام:\n• ' + stepsAr.join('\n• '));
      }
      if (opts.offerOrder !== false) lines.push('\nعايزة نعمل أوردر؟');
    }
    return lines.join('\n');
  }

  function buildConsultationReply(concern, lang, products, norm) {
    products = products || [];
    var ids = recommendProducts(concern);
    if (!ids.length) return null;
    var pitch = concernPitch(concern, norm, lang);
    var main = resolveConcernProduct(concern, norm, products) ||
      products.find(function (p) { return p.id === ids[0]; });
    if (!main) return null;

    var parts = [pitch, '', buildProductExpertReply(main, lang, { offerOrder: false })];
    var explicitProduct = /كريم|غسول|لوشن/.test(norm || '');
    if (ids.length > 1 && !explicitProduct) {
      var second = products.find(function (p) { return p.id === ids[1]; });
      if (second) {
        parts.push('');
        parts.push(lang === 'en'
          ? 'I also recommend ' + second.nameEn + ' (' + second.price + ' EGP) to complete your routine.'
          : 'كمان أنصحك بـ ' + second.nameAr + ' (' + second.price + ' جنيه) عشان تكملي الروتين.');
      }
    }
    parts.push('');
    parts.push(lang === 'en' ? 'Would you like to place an order?' : 'عايزة نعمل أوردر؟');
    return parts.join('\n');
  }

  function buildCompareReply(productA, productB, lang) {
    if (!productA || !productB) return null;
    if (lang === 'en') {
      return productA.nameEn + ' (' + productA.price + ' EGP) — ' + (productA.pfor || '') + '.\n' +
        productB.nameEn + ' (' + productB.price + ' EGP) — ' + (productB.pfor || '') + '.\n\n' +
        productA.nameEn + ': ' + (productA.descEn || productA.desc) + '\n\n' +
        productB.nameEn + ': ' + (productB.descEn || productB.desc) + '\n\n' +
        'Tell me your main concern and I\'ll recommend the best fit.';
    }
    return productA.nameAr + ' (' + productA.price + ' جنيه) — ' + (productA.pfor || '') + '.\n' +
      productB.nameAr + ' (' + productB.price + ' جنيه) — ' + (productB.pfor || '') + '.\n\n' +
      productA.nameAr + ': ' + productA.desc + '\n\n' +
      productB.nameAr + ': ' + productB.desc + '\n\n' +
      'قوليلي مشكلتك الأساسية وأنا أرشّحلك الأنسب.';
  }

  function buildRoutineReply(concern, lang) {
    var r = ROUTINES[concern];
    if (!r) return null;
    return fld(r, lang);
  }

  function buildTermReply(termKey, lang) {
    var t = TERMS[termKey];
    if (!t) return null;
    return fld(t, lang);
  }

  function matchTerm(norm) {
    var keys = Object.keys(TERMS);
    for (var i = 0; i < keys.length; i++) {
      if (norm.indexOf(normalize(null, keys[i])) > -1) return keys[i];
    }
    if (/واقي شمس|spf|sunscreen/.test(norm)) return 'spf';
    if (/دفع عند الاستلام|كاش|cod/.test(norm)) return 'cod';
    return null;
  }

  function buildFullCatalogReply(lang, products) {
    products = products || [];
    var intro = lang === 'en'
      ? 'Here are all our Montana products:\n\n'
      : 'دي كل منتجات Montana عندنا:\n\n';
    var outro = lang === 'en'
      ? '\n\nTell me your skin concern or which product you want — I\'ll help you choose!'
      : '\n\nقوليلي مشكلة بشرتك أو أي منتج عايزاه — وأنا أساعدك تختاري!';
    return intro + catalogExpert(lang, products) + outro;
  }

  function catalogExpert(lang, products) {
    return products.map(function (p) {
      var ing = ingredientList(p.id, lang).slice(0, 3).join(lang === 'en' ? ', ' : '، ');
      if (lang === 'en') {
        return '• ' + p.nameEn + ' — ' + p.price + ' EGP · ' + p.sizeEn + '\n  ' + (p.pfor || '') + (ing ? ' · ' + ing : '');
      }
      return '• ' + p.nameAr + ' — ' + p.price + ' جنيه · ' + p.size + '\n  ' + (p.pfor || '') + (ing ? ' · ' + ing : '');
    }).join('\n\n');
  }

  function aiKnowledgeBlock(lang, products) {
    var lines = [
      lang === 'en' ? '=== MONTANA PRODUCT EXPERTISE ===' : '=== خبرة منتجات Montana ===',
      '',
      catalogExpert(lang, products),
      '',
      lang === 'en' ? '=== SALES APPROACH ===' : '=== أسلوب البيع ===',
      lang === 'en'
        ? '- Consult first: understand concern (acne, dullness, spots, dryness, scars, post-laser) then recommend 1–2 products.\n- Brightening: cleanser AM + cream PM + SPF.\n- Acne: cleanser twice daily, don\'t skip moisturizer.\n- Scars: silicone gel twice daily, 8–12 weeks for old scars.\n- Post-laser: wait for doctor OK, gentle application.\n- Upsell pairs: whitening cleanser → whitening cream; post-laser → anti-scar.\n- Shipping: Cairo/Giza 2–4 days, free over 1000 EGP, COD available.'
        : '- اسألي الأول عن المشكلة (حبوب، بهتان، بقع، جفاف، ندوب، بعد ليزر) وبعدين ارشّحي ١–٢ منتج.\n- التفتيح: غسول صباحًا + كريم مساءً + واقي شمس.\n- الحبوب: غسول مرتين يوميًا + مرطّب خفيف.\n- الندوب: جل سيليكون مرتين يوميًا، ٨–١٢ أسبوع للقديمة.\n- بعد الليزر: بعد موافقة الدكتور، استخدام لطيف.\n- بيع مكمّل: غسول تفتيح → كريم تفتيح؛ بعد ليزر → جل ندوب.\n- الشحن: القاهرة والجيزة ٢–٤ أيام، مجاني فوق ١٠٠٠ جنيه، دفع عند الاستلام.',
      '',
      lang === 'en' ? '=== KEY INGREDIENTS ===' : '=== المكونات الأساسية ==='
    ];
    GLOSSARY.forEach(function (g) {
      lines.push('- ' + g.name + ': ' + fld(g.why, lang));
    });
    return lines.join('\n');
  }

  return {
    GLOSSARY: GLOSSARY,
    CONCERN_MAP: CONCERN_MAP,
    findIngredient: findIngredient,
    findProductByKnowledge: findProductByKnowledge,
    findAllProductsByKnowledge: findAllProductsByKnowledge,
    resolveMultiConcernIds: resolveMultiConcernIds,
    buildMultiConsultationReply: buildMultiConsultationReply,
    recommendProducts: recommendProducts,
    professionalPitch: professionalPitch,
    buildIngredientReply: buildIngredientReply,
    buildProductExpertReply: buildProductExpertReply,
    buildConsultationReply: buildConsultationReply,
    buildCompareReply: buildCompareReply,
    buildRoutineReply: buildRoutineReply,
    buildTermReply: buildTermReply,
    buildGuideMenu: buildGuideMenu,
    buildSmartFallback: buildSmartFallback,
    resolveConcernProduct: resolveConcernProduct,
    concernPitch: concernPitch,
    matchTerm: matchTerm,
    buildFullCatalogReply: buildFullCatalogReply,
    catalogExpert: catalogExpert,
    aiKnowledgeBlock: aiKnowledgeBlock,
    shippingReply: function (lang) { return fld(SHIPPING, lang); },
    usageLines: usageLines,
    ingredientList: ingredientList,
    getPair: function (productId) { return PAIRS[productId] || null; },

    polishSalesReply: function (reply, lang, ctx) {
      ctx = ctx || {};
      reply = String(reply || '').trim();
      if (!reply || lang === 'en') return reply;
      if (ctx.isOrderStep || ctx.skipPolish) return reply;
      if (/^(أهلا|اهلا|مرحب|تمام حبيبتي|حبيبتي|يا جميلة|سؤال حلو|من تجربتي)/.test(reply)) return reply;

      if (ctx.concern === 'acne' || ctx.concern === 'oily' || ctx.concern === 'pores') {
        return 'فاهمةك — الحبوب والبشرة الدهنية محتاجة صبر ومنتج صح.\n\n' + reply;
      }
      if (ctx.concern === 'whiten' || ctx.concern === 'dull' || ctx.concern === 'spots') {
        return 'سؤال مهم! التفتيح محتاج استمرارية ومنتجات تكمّل بعض.\n\n' + reply;
      }
      if (ctx.concern === 'scar') {
        return 'الندوب محتاجة وقت واهتمام — وأنا هوجّهك للي يناسبك.\n\n' + reply;
      }
      if (ctx.concern === 'laser' || ctx.concern === 'sensitive') {
        return 'بعد الليزر أو العلاج لازم منتج لطيف — صح إنك سألت.\n\n' + reply;
      }
      if (ctx.concern === 'dry') {
        return 'البشرة الناشفة محتاجة ترطيب يفضل — خليني أساعدك.\n\n' + reply;
      }
      if (ctx.isIngredients || ctx.isUsage) {
        return 'سؤال ذكي! 💜\n\n' + reply;
      }
      if (ctx.isPrice) {
        return 'أكيد — السعر مهم.\n\n' + reply;
      }
      if (ctx.isGreeting || ctx.isGoodbye) return reply;
      return reply;
    }
  };
})();
