/**
 * Montana AI Sales Assistant v3.0 — Native Gemini Agent Architecture
 *
 * Replaces brittle legacy regex mazes with an agentic architecture:
 * 1. Semantic Understanding & Dialogue Decisions powered by Gemini 2.5 Flash.
 * 2. Deterministic Server-Side Tool Execution:
 *    - Catalog & Routine verification from authoritative DB tables.
 *    - Cart calculation, stock verification, and free-shipping math.
 *    - Incremental Customer Delivery Data extraction & validation (name, phone, address).
 *    - Exactly-once Idempotent Order Creation with zero chat confirmation requirement.
 * 3. Server-side Safety Enforcement & Claim Sanitization.
 * 4. Full Test-Isolation Mode for automated tests (mock EVAL-XXXXXX, 0 DB writes, 0 Bosta, 0 Telegram).
 */

const { GoogleGenerativeAI, SchemaType } = require('@google/generative-ai');
const { createClient } = require('@supabase/supabase-js');
const { BUNDLES, getBundleByKey, allocateBundleUnitPrices, resolveBundleFromAdHints, resolveSelectedBundle, resolveBundleFromCustomerText } = require('./adOffers');
const {
  loadSession: rawLoadSession,
  saveSession: rawSaveSession,
  historyToGemini,
  appendHistory,
  normalizePhone,
  extractPhoneFromText,
  toWesternDigits,
} = require('./chatSessionStore');
const v2 = require('./salesAssistantV2');
const { notifyTelegramOrder, tgConfigured } = require('./telegramOrderNotify');
const { isOrderProblemComplaint, CS_SUPPORT_PHONE, filterChatProducts, isChatExcludedProduct } = require('./orderContext');
const imageUnderstanding = require('./imageUnderstanding');

const PRODUCT_INFO_BY_SLUG = {
  'post-laser-cream': {
    name: 'كريم ما بعد الليزر والترميم (Montana Post Laser Cream)',
    slug: 'post-laser-cream',
    price: 369,
    routineKey: 'post-laser',
    routineName: 'عرض عناية ما بعد الليزر',
    routinePrice: 618,
    benefit: 'تهدئة فورية للبشرة المتهيجة بعد جلسات الليزر أو إزالة الشعر وترميم حاجز الجلد ومنع الالتهاب والتصبغات، غني بزيت السمسم الطبيعي والبانثينول والشاي الأخضر.',
  },
  'whitening-cream': {
    name: 'كريم التفتيح المركز (Montana Whitening Cream)',
    slug: 'whitening-cream',
    price: 249,
    routineKey: 'brightening',
    routineName: 'روتين التفتيح الكامل',
    routinePrice: 777,
    benefit: 'تفتيح فعال وتوحيد لون البشرة والرقبة والمناطق الحساسة وإزالة التصبغات والبقع وآثار الحبوب بدون تقشير قاسي.',
  },
  'whitening-cleanser': {
    name: 'غسول تفتيح الوجه والجسم (Montana Whitening Cleanser)',
    slug: 'whitening-cleanser',
    price: 299,
    routineKey: 'brightening',
    routineName: 'روتين التفتيح الكامل',
    routinePrice: 777,
    benefit: 'تنظيف لطيف وإشراقة طبيعية وتوحيد اللون بدون سلفات قاسية، ومناسب للبشرة الحساسة.',
  },
  'acne-facial-cleanser': {
    name: 'غسول حب الشباب والمسام (Montana Acne Facial Cleanser)',
    slug: 'acne-facial-cleanser',
    price: 299,
    routineKey: 'face-body',
    routineName: 'روتين نضارة الوجه وترطيب الجسم',
    routinePrice: 558,
    benefit: 'تنقية عميقة للمسام وإذابة الدهون والرؤوس السوداء ومقاومة البكتيريا بدون جفاف بفضل حمض الساليسيليك وزيت شجرة الشاي.',
  },
  'hand-body-lotion': {
    name: 'لوشن اليدين والجسم 72h (Montana Hand & Body Lotion)',
    slug: 'hand-body-lotion',
    price: 229,
    routineKey: 'face-body',
    routineName: 'روتين نضارة الوجه وترطيب الجسم',
    routinePrice: 558,
    benefit: 'ترطيب مخملي مكثف يدوم 72 ساعة بزبدة الشيا والكاكاو وفيتامين E.',
  },
  'anti-scar-silicone-gel': {
    name: 'جل السيليكون للندبات (Montana AntiScar Silicone Gel)',
    slug: 'anti-scar-silicone-gel',
    outOfStock: true,
  },
};

function isAntiScarInquiry({ message = '', adTitle = '', imageRead = null, selectedProduct = null } = {}) {
  if (imageRead?.productSlug === 'anti-scar-silicone-gel') return true;
  if (selectedProduct === 'anti-scar-silicone-gel') return true;
  const t = `${message || ''} ${adTitle || ''} ${imageRead?.text || ''} ${imageRead?.summary || ''}`.toLowerCase();
  return /(?:anti-?scar|antiscar|silicone|سيليكون|سليكون|ندبات|ندبة|ندبه|انتي\s*سكار|انت\s*سكار)/i.test(t);
}

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://ikryeyqrithikabwidov.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlrcnlleXFyaXRoaWthYndpZG92Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE3MzY1ODcsImV4cCI6MjA5NzMxMjU4N30.kNfHPxV4fq67cOF8uFsTrLOxPYcLcmmDO3ScIHzI9Uo';
const SERVICE_ROLE_KEY = process.env.SERVICE_ROLE || process.env.SUPABASE_SERVICE_ROLE_KEY;

let sb = createClient(SUPABASE_URL, SUPABASE_KEY);
let sbService = SERVICE_ROLE_KEY ? createClient(SUPABASE_URL, SERVICE_ROLE_KEY) : null;

// Allow test suites to inject mock clients and models
let _testAdapters = null;
function __setTestAdapters(adapters = null) {
  _testAdapters = adapters;
  if (adapters?.sb) sb = adapters.sb;
  if (adapters?.sbService !== undefined) sbService = adapters.sbService;
}

function getGeminiClient() {
  if (_testAdapters?.genAI) return _testAdapters.genAI;
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  return new GoogleGenerativeAI(apiKey);
}

// ─────────────────────────────────────────────────────────────────────────────
// PROMPTS & INSTRUCTIONS
// ─────────────────────────────────────────────────────────────────────────────

const SYSTEM_INSTRUCTION_V3 = `أنتِ مريم، المستشارة التجميلية ومسؤولة المبيعات لبراند "مونتانيا" (Montana Naturals) لمستحضرات العناية بالبشرة في مصر.
تتحدثين باللهجة المصرية الراقية، الودودة، الذكية والمحترمة (يا فندم، حضرتك، ألف سلامة، 💜).

أهدافك الأساسية:
1. فهم استفسار العميل تماماً والإجابة المباشرة والواضحة على أسئلته أولاً قبل اقتراح أي منتج أو محاولة بيع.
2. الاستشارة الصادقة والأمانة التجميلية والطبية: ترشيح المنتجات المناسبة لنوع بشرته وحالته فقط، وتوضيح طريقة الاستخدام والمكونات بدقة.
3. عدم ادعاء أي فوائد غير حقيقية أو ضمانات مطلقة (لا تدّعي علاج أمراض جلدية مزمنة، ولا تقولي أبداً "مفيش أي تعارض خالص" أو "مضمون 100%").
4. تسجيل الأوردر بسلاسة وسرعة فور اكتمال بيانات التوصيل دون تعقيد أو طلب تأكيدات مكررة في الشات.

قواعد الأمانة التجميلية والطبية (خطوط حمراء):
- قائمة منتجات وعروض مونتانيا الرسمية المعتمدة (ممنوع اختراع أي منتج آخر نهائياً):
  1. روتين التفتيح الكامل (سعره 777 ج والشحن مجاني): يتكون حصرياً من 3 منتجات:
     * غسول التفتيح اليومي (Montana Whitening Cleanser) 200 مل (سعره منفرد 299 ج).
     * كريم التفتيح (Montana Whitening Cream) 50 مل (سعره منفرد 249 ج).
     * لوشن اليدين والجسم (Montana Hand & Body Lotion) 250 مل (سعره منفرد 229 ج).
     (تنبيه حاسم: مونتانيا لا تمتلك كريم ليلي ونهاري منفصلين؛ هو كريم تفتيح واحد متكامل للوجه والرقبة والمناطق الحساسة).
  2. روتين بعد الليزر والنضارة (سعره 618 ج والشحن مجاني): يتكون حصرياً من منتجين:
     * كريم بعد الليزر (Montana Post-Laser Cream) 60 جم (سعره منفرد 369 ج).
     * كريم التفتيح (Montana Whitening Cream) 50 مل (سعره منفرد 249 ج).
  3. روتين نضارة الوجه وترطيب الجسم (ويسمى أيضاً روتين الوش والجسم / عناية الوجه والجسم) (سعره 558 ج والشحن مجاني): يتكون حصرياً من منتجين:
     * غسول الوجه وحب الشباب للبشرة الدهنية والمسام (Montana Acne Facial Cleanser) 200 مل (سعره منفرد 299 ج).
     * لوشن اليدين والجسم 72h (Montana Hand & Body Lotion) 250 مل / 50 مل (سعره منفرد 229 ج).
     (تنبيه حاسم: إذا سأل أو طلب العميل «روتين نضارة الوجه وترطيب الجسم» أو «روتين نضارة الوجه» أو «عرض الوش والجسم» أو ذكر 558 ج: هذا هو الروتين المطلوب بالضبط بسعر 558 ج وشحن مجاني! ممنوع منعاً باتاً ترشيح روتين التفتيح 777 ج بدلاً منه أو الادعاء بأنه روتين التفتيح!).
  4. المنتجات الفردية:
     * كريم التفتيح: 249 ج.
     * غسول التفتيح: 299 ج.
     * لوشن اليدين والجسم: 229 ج.
     * كريم بعد الليزر: 369 ج.
     * غسول حب الشباب: 299 ج.
- مواصفات ومكونات الغسول: غسول التفتيح اليومي (Montana Whitening Cleanser) غسول لطيف جداً وخالي من السلفات القاسية (Sulfate-Free)، مناسب لمختلف أنواع البشرة بما فيها البشرة الحساسة، يحتوي على مستخلص العرقسوس والأربوتين وفيتامين سي. وغسول الحبوب يحتوي على حمض الساليسيليك وزيت شجرة الشاي. إذا سألت العميلة عن الغسول أثناء طلبها لروتين التفتيح، وضحّي لها فوراً أنه لطيف، خالي من السلفات القاسية، ومناسب للبشرة الحساسة.
- المكونات الفعالة لكل منتج (اشرحيها بوضوح واحترافية وأمانة عند سؤال العميل عن المكونات):
  • كريم التفتيح المركز: ألفا أربوتين (Alpha Arbutin)، مستخلص العرقسوس، نياسيناميد (Vitamin B3)، حمض اللاكتيك، فيتامين C، فيتامين E، أكسيد الزنك، زيت الورد. (تفتيح التصبغات، إزالة البقع وتوحيد اللون بدون تقشير قاسي).
  • غسول التفتيح: خلاصة العرقسوس، نياسيناميد (B3)، زنك PCA، فيتامين C، زيت شجرة الشاي، زيت جنين القمح، زيت اللوز. (تنظيف لطيف وإشراقة طبيعية وتوحيد اللون وتنقية المسام).
  • كريم بعد الليزر والترميم: زيت السمسم الطبيعي، بانثينول (Vitamin B5)، الألانتوين، شمع العسل، الألوفيرا، مستخلص الشاي الأخضر، النياسيناميد، فيتامين E، اللانولين. (تهدئة فورية للبشرة المتهيجة بعد الليزر أو إزالة الشعر وترميم حاجز الجلد ومنع التصبغات والالتهاب).
  • غسول حب الشباب الطبي: حمض الساليسيليك الطبي، زنك PCA، نياسيناميد (B3)، زيت شجرة الشاي، زيت الأرجان، زيت الجوجوبا. (تنقية عميقة للمسام وإذابة الدهون والرؤوس السوداء ومقاومة البكتيريا بدون جفاف).
  • لوشن اليدين والجسم 72h: زبدة الشيا، زبدة الكاكاو، زيت اللوز، زيت الجوجوبا، زيت جوز الهند، زيت الزيتون، فيتامين E، الجلسرين وشمع العسل. (ترطيب مخملي مكثف يدوم 72 ساعة).
- طلب آراء / ريفيوهات / تجارب العملاء (أو "عاوزة أشوف آراء الناس" / "حد جربه؟"): ابعثي فوراً لينكات صفحاتنا الرسمية لمشاهدة آراء وتجارب العملاء وتقييماتهم الحقيقية:
  • فيسبوك: https://www.facebook.com/montana.com.eg/
  • إنستجرام: https://www.instagram.com/montana.com.eg
  مع طمأنة العميل بأن معاه حق فتح ومعاينة الشحنة بالكامل عند الاستلام والتأكد بنفسه قبل ما يدفع مليم واحد. وممنوع تماماً أن تقولي «أنا ذكاء اصطناعي مقدرش» أو ترفضي المساعدة!
- طلب صور للمنتجات / شكل العبوة: وضّحي محتويات العبوة أو الروتين بدقة وأحجامها (مثل: غسول 200 مل، كريم 50 جم)، وابعثي رابط الصورة المباشر أو رابط صفحة المنتج/العرض، وممنوع رمي رابط الصفحة الرئيسية فقط وممنوع تماماً قول «أنا ذكاء اصطناعي مقدرش أبعت صور»!
- حالات تقشير وجفاف الوجه: الأولوية التامة هي ترميم حاجز البشرة وترطيبها بمرطب طبي ملطف مخصص للوجه وتجنب المقشرات. كريم التفتيح يوفر ترطيباً خفيفاً مع التفتيح، ولكن لا يوضع على بشرة متقشرة ملتهبة. وممنوع نهائياً ترشيح لوشن اليدين والجسم على الوجه (هو للجسم فقط). وممنوع نهائياً ترشيح كريم بعد الليزر للتقشير العادي للوجه (هو مخصص فقط لتهدئة الجلد بعد جلسات الليزر وإزالة الشعر).
- الفراكشنال ليزر والحرقان/الاحمرار الشديد: إذا ذكرت العميلة جلسة فراكشنال ليزر مع حرقان أو احمرار شديد، ممنوع تماماً ترشيح أي منتج تجميلي! انصحيها فوراً بالرجوع للطبيبة أو العيادة المعالجة.
- توافق المنتجات: ممنوع قول «مفيش أي تعارض بينهم خالص». فرّقي بين ليزر إزالة الشعر (يناسبه كريم بعد الليزر لتهدئة البشرة) وبين التقشير أو الفراكشنال (يُمنع استخدام غسول التفتيح أو المقشرات النشطة عليه حتى التعافي).
- الشمس والبحر والمصيف: وضّحي أن منتجات مونتانيا ليست بديلاً عن واقي الشمس (Sunscreen/Sunblock) أثناء التعرض المباشر للشمس نهاراً.
- مدة النتائج: النتائج تظهر تدريجياً خلال 14 إلى 21 يوماً من الاستخدام المنتظم وتختلف حسب نوع البشرة والالتزام بالروتين. لا تقدمي وعوداً قاطعة ولا تدّعي ثبات النتيجة للأبد.
- منتج جل السيليكون للندبات (Montana AntiScar Silicone Gel): هذا المنتج غير متوفر حالياً في مونتانيا. إذا سأل أو أرسل العميل صورة أو بوست عنه، وضحي له فوراً بلطف أنه «غير متوفر حالياً للأسف 💜»، واعرضي عليه الاستشارة إذا كان لديه استفسار عن روتينات العناية المتوفرة (التفتيح، آثار الحبوب، ما بعد الليزر).
- ممنوع منعاً باتاً أن تقولي «أنا مقدرش أشوف الصورة» أو «أنا ذكاء اصطناعي مقدرش»!

قواعد الإيجاز وأسلوب المحادثة الطبيعية (Brevity & Natural Chat):
- تحدثي كبنت مصرية شاطرة، لبقة، ومباشرة في كلامها عند التحدث بالعربية.
- التحدث بنفس لغة العميل (Language Matching):
  * إذا تحدث العميل أو سأل باللغة الإنجليزية (English): يجب الرد عليه باللغة الإنجليزية بطلاقة ولباقة وأسلوب ودود ومختصر (Always respond in natural, friendly, and concise English if the customer writes in English).
  * وضحّي الأسعار والمنتجات بالإنجليزية بدقة (مثال: The full Whitening Routine contains 3 pieces: Cleanser, Cream, and Lotion for 777 EGP with free shipping and Cash on Delivery).
- ممنوع منعاً باتاً الرغي والمط أو كتابة مقالات طويلة مكدسة وكتالوجات في الشات! اجعلي ردك قصيراً ومريحاً للعين (من سطرين إلى 4 أسطر كحد أقصى).
- فرّقي بحسم بين «الاستفسار والأسئلة» وبين «الشراء الفعلي»:
  * إذا سألت العميلة عن تفاصيل الروتين أو النتيجة أو السعر أو المكونات (مثل: «إيه تفاصيل الروتين والنتيجة بتبان بعد أد إيه؟»):
    - جاوبي بإيجاز شديد وبشكل مباشر وواضح في سطرين فقط: اذكري الـ 3 منتجات باختصار (غسول تفتيح، كريم تفتيح، لوشن ترطيب للجسم)، والسعر 777 ج مع شحن مجاني، والنتيجة تبدأ تدريجياً في خلال أسبوعين لـ 3 أسابيع من الاستخدام اليومي.
    - لا تذكري تفاصيل المكونات الكيميائية (العرقسوس، الأربوتين، فيتامين سي، السلفات... إلخ) إلا إذا سألتك العميلة عنها بالتحديد!
    - ممنوع نهائياً إضافة المنتج للسلة أو طلب بيانات الشحن (الاسم والعنوان والموبايل) في نفس الرسالة التي تجيبين فيها على استفسارها! اختمي فقط بسؤال لطيف وموجز: «تحبي نجهزهولك ونبعتهولك بشحن مجاني؟ 💜».
  * فقط عندما تؤكد العميلة رغبتها في الشراء (مثل: «تمام ابعتوهولي»، «عاوزة أطلبه»، «سجليلي أوردر»، أو عندما ترسل اسمها وبياناتها): قومي بإضافة الروتين للسلة واطلبي بيانات التوصيل المتبقية بسلاسة.

قواعد البيع الاستشاري والإغلاق الذكي (Active Consultative Selling):
1. قاعدة الختام البيعي (Always End With an Engaging Next-Step Question):
   - ممنوع نهائياً إنهاء أي رسالة بنقطة وصمت! كل رسالة تشرح منتجاً أو سعراً يجب أن تُختم بسؤال ذكي يدفع العميل للتفاعل:
     * عند ذكر سعر الروتين: «تحبي نجهزهولك وتستفيدي من الشحن المجاني النهاردة يا فندم؟ 💜» أو «تحبي الشحن يوصلك على عنوان البيت ولا الشغل؟».
     * عند السؤال عن مشكلة تجميلية: اسأليها باهتمام عن تفاصيل بشرتها: «حابة تستخدميه لمنطقة معينة ولا للوجه بالكامل؟ عشان أرشحلك الأنسب ليكي بالظبط 💜».
     * عند التردد أو التفكير: طمئنيها بميزة المعاينة: «ومعاكي حق المعاينة وفتح الشحنة عند الاستلام والتأكد من المنتجات بنفسك قبل الدفع كاش 🤝 تحبي نجهزهولك وتجربي النتيجة بنفسك؟».
2. الرد البيعي المحترف على سؤال الصيدليات («متوفر في الصيدلية؟» / «ألاقيه في صيدلية إيه؟»):
   - ممنوع تماماً قول «لأمانة مش متوفر في الصيدليات» بأسلوب سلبي أو محبط!
   - وضّحي بثقة وفخر: «منتجات مونتانيا كلها تركيبات طبية ومرخصة رسمياً من وزارة الصحة 🌿 وإحنا معتمدين البيع والشحن المباشر من مصنعنا لحضرتك على طول عشان نضمنلك منتج أصلي 100% بتاريخ إنتاج طازة جداً وبشحن مجاني لحد باب البيت، ومعاكي حق فتح الشحنة ومعاينتها بالكامل قبل الدفع كاش عند الاستلام 🤝 تحبي نجهزهولك يوصلك خلال يومين؟».
3. الاقتراح البديل عند التردد أو التوقف أمام سعر الروتين (Smart Down-sell):
   - لو العميل سأل عن سعر الروتين ولم يعاود الرد أو أبدى تردداً أمام السعر (777 ج أو 618 ج):
     اقترحي عليه البدء بمنتج واحد أساسي ككورس تجربة مركّز:
     «لو حابة تبدأي خطوة بخطوة وتجربي النتيجة بنفسك الأول، تقدري تبدأي بـ (كريم التفتيح المركز) منفرد بسعر 249 ج بس، أو (كريم بعد الليزر) بسعر 369 ج، وتجربي النتيجة الأول 🌸 تحبي أجهزهولك؟».
4. التدرج الودود في طلب بيانات التوصيل (Friendly Detail Collection):
   - عندما يبدي العميل رغبة في الشراء، اطلبي البيانات بلطف وبدون لهجة استجوابية:
     «من عنينا يا فندم 💜 هجهزهولك فوراً، تحبي نشحنهولك على محافظة إيه والعنوان بالتفصيل؟ واسم ورقم موبايل حضرتك عشان المندوب يتواصل معاكي 🌸».

قواعد التحية واستمرارية المحادثة:
- التحية والترحيب («أهلاً بحضرتك»، «صباح الخير»، «نورتي مونتانيا») تقال حصرياً فقط في أول رسالة من المحادثة!
- بمجرد بدء المحادثة وتتابع الردود، ممنوع منعاً باتاً تكرار التحية أو البدء بـ «أهلاً بحضرتك» في كل رسالة؛ ادخلي فوراً وبشكل طبيعي في صلب الرد على كلام العميل بدون ديباجة ترحيب مكررة.

قواعد التعامل الذكي مع اعتراضات الأسعار («غالي»، «المنتج غالي»، «غالي أوي»، «السعر كتير»):
- ممنوع منعاً باتاً أن تسألي العميل بجهل واستنكار: «أنهي منتج؟» أو «قصدك على إيه؟»! افهمي فوراً المنتج أو الروتين الذي يعترض عليه من سياق المحادثة أو العرض القادم منه (سواء روتين التفتيح 777 ج أو روتين بعد الليزر 618 ج أو غيره).
- تعاملي بذكاء ولباقة مصرية راقية («مقدّرة رأي حضرتك تماماً يا فندم 💜»، «حقك طبعاً يا فندم»).
- اشرحي القيمة الحقيقية للمنتج/الروتين:
  * روتين التفتيح (777 ج): كورس متكامل من 3 منتجات بأحجام كبيرة (غسول 200 مل، لوشن 250 مل، كريم 50 مل) يكفي من شهرين لـ 3 شهور استخدام يومي، وتوفير 130 جنيه عن شراء المنتجات منفردة (مجموعها 907 ج)، ومعاه شحن مجاني، وخامات مرخصة وآمنة بمستخلصات طبيعية لطيفة، ومعاينة كاش عند الاستلام.
- اعرضي دائماً البديل الاقتصادي المناسب من الكتالوج المعتمد إذا رغب العميل في تقليل التكلفة أو تجربة منتج واحد أولاً:
  * اقترحي البدء بـ «كريم التفتيح لوحده بـ 249 ج» كحل مركّز للتفتيح، أو «غسول التفتيح بـ 299 ج».
  * ممنوع تماماً اختراع خصومات وهمية، أو نسب تخفيض غير معتمدة، أو ادعاءات غير حقيقية.

قواعد الشحن والدفع:
- الدفع: 100% كاش عند الاستلام بعد المعاينة، بدون أي عربون أو دفع مسبق نهائياً.
- الشحن: متاح لكل محافظات مصر (القاهرة، الجيزة، الإسكندرية، الدلتا، الصعيد، القناة)، ومدة التوصيل عادة 2-3 أيام عمل ويتم التأكيد هاتفياً.
- مصاريف الشحن: 50 جنيه لمعظم المحافظات. الشحن مجاني تماماً عند طلب أي روتين كامل أو أي 3 منتجات.

قواعد التعامل مع السلة والأوردر:
- عند رغبة العميل في الشراء أو إضافة منتج، استخدمي أداة update_cart فوراً.
- عند إرسال العميل لبياناته أو تعريفه بنفسه (مثل "أنا منى" أو "الاسم سارة" أو رقم الموبايل أو العنوان)، يجب عليك فوراً استدعاء أداة save_customer_details لحفظ هذا البيان، ثم الاستمرار في طلب باقي بيانات التوصيل المتبقية (رقم الموبايل والعنوان بالتفصيل).
- تقبلي الأسماء بأي شكل (اسم مفرد مثل "منى" أو "كريم"، اسم ثنائي، أو اسم ثلاثي).
- رقم الموبايل يجب أن يكون مصرياً (11 رقم يبدأ بـ 01).
- العنوان يجب أن يحتوي على تفاصيل واضحة والمحافظة.
- بمجرد اكتمال البيانات الثلاثة (الاسم، الموبايل الصحيح، العنوان) ووجود منتجات بالسلة: استدعي أداة create_pending_order فوراً في نفس اللحظة! ممنوع منعاً باتاً طلب كلمة تأكيد مثل "قولي نعم" أو "أأكد الأوردر؟".
- بعد نجاح تسجيل الأوردر وظهور رقم الطلب، هنئي العميلة برقم أوردرها، وأكدي لها الإجمالي والشحن والدفع كاش عند الاستلام، وأن فريق خدمة العملاء هيتواصل معها تليفونياً لتأكيد موعد التسليم.`;

// ─────────────────────────────────────────────────────────────────────────────
// TOOL DECLARATIONS FOR GEMINI
// ─────────────────────────────────────────────────────────────────────────────

const TOOL_DECLARATIONS = [{
  functionDeclarations: [
    {
      name: 'get_catalog',
      description: 'يرجع قائمة منتجات مونتانيا الرسمية المتاحة حالياً بأسعارها الحقيقية، مكوناتها، أحجامها ودواعي استعمالها من قاعدة البيانات. استخدميها قبل ذكر أي سعر أو معلومة منتج.',
      parameters: { type: SchemaType.OBJECT, properties: {} }
    },
    {
      name: 'get_routine_offers',
      description: 'يرجع عروض الروتين المتكاملة الحالية في مونتانيا (روتين التفتيح الكامل 777 ج، روتين بعد الليزر 618 ج، روتين الوش والجسم 558 ج) مع تفاصيل مكوناتها وميزة الشحن المجاني.',
      parameters: { type: SchemaType.OBJECT, properties: {} }
    },
    {
      name: 'get_cart',
      description: 'يرجع محتويات سلة الأوردر الحالية، الكميات، الأسعار، الإجمالي، حالة الشحن المجاني، والبيانات الشخصية المسجلة حتى الآن.',
      parameters: { type: SchemaType.OBJECT, properties: {} }
    },
    {
      name: 'update_cart',
      description: 'تعديل سلة المشتريات للعميلة (إضافة منتج، إضافة روتين كامل، حذف منتج، أو مسح السلة بالكامل).',
      parameters: {
        type: SchemaType.OBJECT,
        properties: {
          action: { type: SchemaType.STRING, description: 'add | remove | clear' },
          item_identifier: { type: SchemaType.STRING, description: 'اسم أو معرف المنتج أو الروتين (مثل brightening, post-laser, face-body, cream, cleanser, lotion)' },
          quantity: { type: SchemaType.NUMBER, description: 'الكمية المطلوبة (افتراضي 1)' },
        },
        required: ['action']
      }
    },
    {
      name: 'save_customer_details',
      description: 'حفظ وتحديث بيانات التوصيل للعميلة (الاسم، رقم الموبايل، العنوان بالتفصيل، المحافظة). استخدميها فور إرسال العميلة لأي من هذه البيانات.',
      parameters: {
        type: SchemaType.OBJECT,
        properties: {
          name: { type: SchemaType.STRING, description: 'اسم العميل (مفرد، ثنائي، أو ثلاثي)' },
          phone: { type: SchemaType.STRING, description: 'رقم الموبايل المصري (11 رقم يبدأ بـ 01)' },
          address: { type: SchemaType.STRING, description: 'العنوان بالتفصيل (الشارع، المنطقة، رقم العمارة)' },
          governorate: { type: SchemaType.STRING, description: 'المحافظة (مثل القاهرة، الإسكندرية، الجيزة، الغربية)' }
        }
      }
    },
    {
      name: 'create_pending_order',
      description: 'تسجيل الأوردر رسمياً في النظام بحالة PENDING فور اكتمال الاسم والموبايل والعنوان ووجود منتجات بالسلة. ممنوع طلب تأكيد إضافي في الشات.',
      parameters: { type: SchemaType.OBJECT, properties: {} }
    },
    {
      name: 'handover_to_human',
      description: 'تحويل المحادثة إلى خدمة العملاء البشرية لمتابعة مشكلة في أوردر سابق أو استفسار يحتاج تدخلاً بشرياً.',
      parameters: {
        type: SchemaType.OBJECT,
        properties: {
          reason: { type: SchemaType.STRING, description: 'سبب التحويل' }
        },
        required: ['reason']
      }
    }
  ]
}];

// ─────────────────────────────────────────────────────────────────────────────
// DETERMINISTIC SERVER-SIDE HELPERS
// ─────────────────────────────────────────────────────────────────────────────

async function fetchDbCatalog() {
  const { data, error } = await sb.from('products')
    .select('id, name, price, old_price, size, slug, description, ingredients, skin_type, stock, image_url')
    .eq('is_active', true)
    .order('sort_order');
  if (error || !data) return [];
  return filterChatProducts(data);
}

async function expandCartItemsForOrder(cart) {
  const catalog = await fetchDbCatalog();
  const expanded = [];
  for (const item of cart) {
    if (item.isBundle || String(item.id).startsWith('bundle:')) {
      const bundle = BUNDLES.find(b => b.key === item.bundleKey || item.id === `bundle:${b.key}`) || BUNDLES[0];
      const ordered = bundle.productSlugs.map(s => catalog.find(p => p.slug === s)).filter(Boolean);
      const units = allocateBundleUnitPrices(ordered, bundle.bundlePrice);
      for (let i = 0; i < ordered.length; i++) {
        const prod = ordered[i];
        expanded.push({
          id: Number(prod.id),
          name: prod.name,
          price: Number(units[i]),
          qty: Number(item.qty || 1),
          bundleSlug: bundle.slug,
          image: prod.image_url || null,
        });
      }
    } else {
      const prod = catalog.find(p => String(p.id) === String(item.id) || p.slug === item.slug);
      if (prod) {
        expanded.push({
          id: Number(prod.id),
          name: prod.name,
          price: Number(prod.price),
          qty: Number(item.qty || 1),
          image: prod.image_url || null,
        });
      }
    }
  }
  return expanded;
}

function matchGovernorateNameSync(text) {
  if (!text) return null;
  const t = String(text).trim();
  const map = [
    [/(إسكندرية|اسكندرية|الاسكندرية|الإسكندرية|سموحة|ميامي|سيدي\s*بشر|محرم\s*بك|العجمي)/i, 'الإسكندرية'],
    [/(القاهرة|القاهره|مصر\s*الجديدة|مدينة\s*نصر|المعادي|التجمع|الرحاب|الشروق|شبرا|حلوان)/i, 'القاهرة'],
    [/(الجيزة|الجيزه|المهندسين|الدقي|الهرم|فيصل|أكتوبر|اكتوبر|الشيخ\s*زايد)/i, 'الجيزة'],
    [/(الغربية|الغربيه|طنطا|المحلة|المحله|زفتى)/i, 'الغربية'],
    [/(الدقهلية|الدقهليه|المنصورة|المنصوره|ميت\s*غمر)/i, 'الدقهلية'],
    [/(الشرقية|الشرقيه|الزقازيق|العاشر\s*من\s*رمضان|بلبيس)/i, 'الشرقية'],
    [/(القليوبية|القليوبيه|بنها|شبرا\s*الخيمة|العبور)/i, 'القليوبية'],
    [/(البحيرة|البحيره|دمنهور|كفر\s*الدوار)/i, 'البحيرة'],
    [/(المنوفية|المنوفيه|شبين\s*الكوم|قويسنا)/i, 'المنوفية'],
    [/(بورسعيد|بور\s*سعيد)/i, 'بورسعيد'],
    [/(السويس)/i, 'السويس'],
    [/(الإسماعيلية|الاسماعيلية|الإسماعيليه|الاسماعيليه)/i, 'الإسماعيلية'],
    [/(كفر\s*الشيخ)/i, 'كفر الشيخ'],
    [/(الفيوم)/i, 'الفيوم'],
    [/(بني\s*سويف)/i, 'بني سويف'],
    [/(المنيا)/i, 'المنيا'],
    [/(أسيوط|اسيوط)/i, 'أسيوط'],
    [/(سوهاج)/i, 'سوهاج'],
    [/(قنا)/i, 'قنا'],
    [/(الأقصر|الاقصر)/i, 'الأقصر'],
    [/(أسوان|اسوان)/i, 'أسوان'],
    [/(البحر\s*الأحمر|الغردقة)/i, 'البحر الأحمر'],
    [/(مطروح|الساحل)/i, 'مطروح']
  ];
  for (const [regex, gov] of map) {
    if (regex.test(t)) return gov;
  }
  return null;
}

function calculateCartTotals(cart = [], governorate = 'القاهرة') {
  let subtotal = 0;
  let totalItemsCount = 0;
  let hasRoutineBundle = false;

  for (const item of cart) {
    const qty = Number(item.qty) || 1;
    const price = Number(item.price) || 0;
    subtotal += price * qty;
    if (item.isBundle) {
      hasRoutineBundle = true;
      totalItemsCount += (item.productSlugs?.length || 2) * qty;
    } else {
      totalItemsCount += qty;
    }
  }

  const freeShipping = hasRoutineBundle || totalItemsCount >= 3 || subtotal >= 500;
  const shippingCost = freeShipping ? 0 : 50;
  const total = subtotal + shippingCost;

  return {
    subtotal,
    shippingCost,
    freeShipping,
    total,
    totalItemsCount,
  };
}

function formatCartSummary(cart = [], customer = {}) {
  const totals = calculateCartTotals(cart, customer.governorate);
  return {
    items: cart.map(i => ({
      name: i.name,
      price: i.price,
      quantity: i.qty,
      isBundle: !!i.isBundle,
    })),
    subtotal: totals.subtotal,
    shipping: totals.freeShipping ? 'مجاني (0 ج)' : `${totals.shippingCost} ج`,
    total: totals.total,
    freeShipping: totals.freeShipping,
    customerDetails: {
      name: customer.name || 'لم يحدد بعد',
      phone: customer.phone || 'لم يحدد بعد',
      address: customer.address || 'لم يحدد بعد',
      governorate: customer.governorate || 'لم تحدد بعد',
      readyToOrder: !!(cart.length && customer.name && customer.phone && customer.address),
    }
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// DETERMINISTIC SAFETY PRE-CHECKS (BEFORE GEMINI)
// ─────────────────────────────────────────────────────────────────────────────

function checkDeterministicSafetyPrechecks(message, sid) {
  const t = String(message || '').trim();
  if (!t) return null;

  // 1. Order complaints & problem inquiries -> straight to human support
  if (isOrderProblemComplaint(t)) {
    return {
      reply: `ألف سلامة وحقك علينا يا فندم 💜\nلمتابعة مشكلة أو تأخير الأوردر فوراً، فريق خدمة العملاء متاح لمساعدتك تليفونياً على رقم: **${CS_SUPPORT_PHONE}** ومتابعة شحنتك لحلها في أسرع وقت.`,
      needsHuman: true,
      engineSource: 'deterministic_safety',
    };
  }

  // 2. Suspicious deposit / money scam phone verification (must be about a suspicious caller/message demanding money)
  const isScamQuery = /(?:كلمني|رقم\s*غريب|اتصل|طلب\s*(مني)?|بيطلبوا|طالبين).*(?:عربون|فلوس|مبلغ)|(?:عربون|فلوس).*(?:على\s*فودافون|انستاباي|تحويل|مسبق|قبل\s*الشحن)/i.test(t);
  const isCallerCheck = /(رقم\s*(غريب|تاني)|رقمكم|رقم\s*الخدمة)/i.test(t) && /01\d{9}/.test(t);
  if (isScamQuery || isCallerCheck) {
    const callerMatch = t.match(/01\d{9}/);
    const caller = callerMatch ? callerMatch[0] : null;
    const official = normalizePhone(CS_SUPPORT_PHONE);
    if (caller && (normalizePhone(caller) === official)) {
      return {
        reply: `أيوة يا فندم ✅ الرقم ده **${CS_SUPPORT_PHONE}** رقم خدمة عملاء مونتانيا الرسمي، والمكالمة من عندنا لتأكيد الأوردر وميعاد التسليم.`,
        engineSource: 'deterministic_safety',
      };
    }
    return {
      reply: `الرقم ده **مش من أرقام مونتانيا** يا فندم ⚠️\nإحنا بنكلم عملاءنا من رقم واحد بس: **${CS_SUPPORT_PHONE}**.\nودايماً كل أوردراتنا **100% كاش عند الاستلام** بدون أي عربون أو دفع مسبق نهائياً! من فضلك متدفعيش أي مبلغ لأي حد 💜`,
      engineSource: 'deterministic_safety',
    };
  }

  // 3. Acute medical emergency
  if (/(حرق\s*كيميائي\s*شديد|صديد|نزيف|جرح\s*مفتوح|حروق\s*شديدة)/i.test(t)) {
    return {
      reply: `ألف سلامة عليكي يا فندم 💜 هذه الحالة طبية طارئة وتتطلب التوجه فوراً لأقرب طبيب جلدية أو مستشفى لتلقي العلاج الطبي المتخصص، وممنوع استخدام أي مستحضرات تجميلية عليها نهائياً لسلامتك.`,
      needsHuman: true,
      engineSource: 'deterministic_safety',
    };
  }

  return null;
}

function stripLeadingGreeting(text) {
  if (!text) return '';
  let s = String(text).trim();
  const greetingRegex = /^(?:(?:أهلاً|اهلا|مرحباً|مرحبا|هاي|hello|hi)\s*(?:و\s*سهلاً|وسهلا)?(?:\s*ب[يى]ك[يى]?|\s*بحضرتك)?(?:\s*يا\s*فندم)?(?:\s*💜|\s*🌸|\s*😊)?[\s!،,.]*)*(?:(?:و?\s*نورت[يى]?(?:\s*مونتانيا)?(?:\s*يا\s*فندم)?(?:\s*💜|\s*🌸|\s*😊)?[\s!،,.]*)*)/i;
  for (let i = 0; i < 3; i++) {
    const prev = s;
    s = s.replace(greetingRegex, '').trim();
    if (s === prev) break;
  }
  return s;
}

function isReviewsOrOpinionsAsk(message) {
  const t = String(message || '').toLowerCase().trim();
  if (!t || t.length > 220) return false;
  if (/ر[أا]يك\s*(ايه|إيه|في|فيما|بالنسبة)/i.test(t) && !/(ريفيو|تجارب|تقييم|ناس|عملاء|بنات)/i.test(t)) {
    return false;
  }
  if (/(ريفيو|ريفيوهات|review|reviews|feedback)/i.test(t)) return true;
  if (/(تجارب|تجربة|تجربه)\s*(العملاء|الناس|البنات|قبل|سابقة|حقيقية|سابق)?/i.test(t)) return true;
  if (/(اراء|آراء|راي|رأي)\s*(العملاء|الناس|البنات|عنه|عنكم|فيكم|عن\s*المنتج)?/i.test(t)) return true;
  if (/(تقييم|تقييمات)\s*(العملاء|الناس|المنتج)?/i.test(t)) return true;
  if (/(حد\s*جرب[هو]?|شفت\s*حد\s*جرب|في\s*حد\s*استخدم|حد\s*استعمل[هو]?)/i.test(t)) return true;
  return false;
}

function isShowProductsLookAsk(message) {
  const t = String(message || '').toLowerCase().trim();
  if (!t || t.length > 220) return false;
  if (/(ابعت|ابعث|بعتي|بعتيل|وريني|ورّيني|اشوف|أشوف).{0,20}(صور|صوره|صورة|شكل)/i.test(t)) return true;
  if (/(صور|صوره|صورة|صورته|صورتها).{0,20}(منه|منو|بتاع|بتاعه|بتاعها|المنتج|الكريم|الغسول)/i.test(t)) return true;
  if (/(صور|صوره|صورة|شكل).{0,15}(منتج|منتجات|عبو[ةه]|علب[ةه])/i.test(t)) return true;
  if (/(صور|صوره|صورة).{0,15}(طبيع[ةه]|حقيق)/i.test(t)) return true;
  if (/^(و\s*)?(ممكن\s*)?(عا[ييو]ز[اهة]?\s*)?(صور|صوره|صورة|شكل)\s*(ل?لمنتج(ات)?)?[\s!.،؟?]*$/i.test(t)) return true;
  if (/^(و\s*)?(ممكن\s*)?(وريني|ورّيني|اشوف|أشوف|شوف|شوفلي|شوفهم|اشوفهم|أشوفهم|صور)[\s!.،؟?]*$/i.test(t)) return true;
  if (/(وريني|ورّيني|اشوف|أشوف|شوف|عايز[اهة]?\s*اشوف|ممكن\s*اشوف|صور|شكل|look|photo|image|show)/i.test(t)) {
    return /(منتج|المنتج|العرض|الروتين|صور|شكل|علبه|العلبه|pack|product|هم|دول)/i.test(t)
      || /شكل\s*(ال)?منتج|وريني\s*(ال)?شكل|وريني\s*(ال)?صور|اشوف\s*(ال)?شكل/.test(t);
  }
  return /(شكل\s*(ال)?منتجات|صور\s*(ال)?منتجات|عايز[اهة]?\s*اشوف\s*(ال)?منتج)/i.test(t);
}

// ─────────────────────────────────────────────────────────────────────────────
// CORE AGENT TURN RUNNER
// ─────────────────────────────────────────────────────────────────────────────

async function handleInboundSalesMessage({
  sid,
  message,
  channel = 'web',
  chatHistory = [],
  pauseBot = false,
  trustedCaller = false,
  selectedBundle = null,
  selectedProduct = null,
  adTitle = null,
  hasImage = false,
  imageUrl = null,
  hasAudio = false,
  _leaseOwnerId = null,
}) {
  // If bot is paused for this session, return silence
  if (pauseBot) {
    return { reply: '', reply1: 'NONE', reply2: 'NONE', reply3: 'NONE', botPaused: true };
  }

  // Vision understanding pass if customer sent a photo / screenshot
  let imageRead = null;
  if (imageUrl) {
    try {
      const readFn = _testAdapters?.readCustomerImage || imageUnderstanding.readCustomerImage;
      imageRead = await readFn(imageUrl);
      if (imageRead) {
        console.log('[salesAgentV3] Customer image read result:', JSON.stringify(imageRead));
      }
    } catch (e) {
      console.warn('[salesAgentV3] Failed to read customer image:', e.message);
    }
  }

  // If customer sent an order/complaint screenshot -> straight to human support
  if (imageRead && imageRead.kind === 'order_screenshot') {
    const csReply = `أهلاً بحضرتك يا فندم 💜\nواضح من الصورة إنها بخصوص أوردر أو شحنة سابقة. عشان نساعد حضرتك ونحل أي مشكلة في أسرع وقت، تقدري تتواصلي مباشرة مع فريق خدمة العملاء على رقم:\n📞 ${CS_SUPPORT_PHONE}\nوهيتابعوا مع حضرتك فوراً خطوة بخطوة 🤝`;
    return {
      reply: csReply,
      reply1: csReply,
      reply2: 'NONE',
      reply3: 'NONE',
      sessionId: sid,
      needsHuman: true,
      engineSource: 'v3_image_order_screenshot',
    };
  }

  // Step 1: Deterministic safety pre-checks
  const safetyOverride = checkDeterministicSafetyPrechecks(message, sid);
  if (safetyOverride) {
    return {
      ...safetyOverride,
      sessionId: sid,
      reply1: safetyOverride.reply,
      reply2: 'NONE',
      reply3: 'NONE',
    };
  }

  // Step 2: Load persistent session state
  const rawSession = _testAdapters?.loadSession
    ? await _testAdapters.loadSession(sid)
    : await rawLoadSession(sid, sbService || sb).catch(() => null);
  const session = rawSession || {};
  let cart = Array.isArray(session.cart) ? [...session.cart] : [];
  let customer = {
    name: session.customerName || session.checkoutWizard?.details?.name || null,
    phone: session.customerPhone || session.checkoutWizard?.details?.phone || null,
    address: session.checkoutWizard?.details?.address || null,
    governorate: session.checkoutWizard?.details?.governorate || null,
  };

  const rawMsg = String(message || '').trim();

  // Resolve product and bundle from image if detected
  const imageProductSlug = imageRead?.productSlug || null;
  const identifiedProd = imageProductSlug ? PRODUCT_INFO_BY_SLUG[imageProductSlug] : null;
  const effectiveProduct = selectedProduct || imageProductSlug;
  const effectiveBundle = selectedBundle || imageRead?.offerKey || (identifiedProd ? identifiedProd.routineKey : null);

  // AntiScar / Silicone Gel check (Owner decision: always clarify it is currently out of stock)
  if (isAntiScarInquiry({ message: rawMsg, adTitle, imageRead, selectedProduct: effectiveProduct })) {
    const antiScarReply =
      `أهلاً بحضرتك يا فندم في مونتانيا 💜\n` +
      `بخصوص جل السيليكون للندبات (Montana AntiScar Silicone Gel)، هو غير متوفر حالياً للأسف.\n\n` +
      `منتجات مونتانيا المتوفرة حالياً للعناية بالبشرة هي كورس العناية المتكامل (روتين التفتيح، روتين بعد الليزر والترميم، غسول حب الشباب والمسام، ولوشن الجسم) 🌸\n` +
      `لو حابة تستشيرينا في أي مشكلة تانية بالبشرة أو العناية بالوجه وتوحيد اللون، تحت أمرك في أي وقت 💜`;
    return {
      reply: antiScarReply,
      reply1: antiScarReply,
      reply2: 'NONE',
      reply3: 'NONE',
      sessionId: sid,
      engineSource: 'v3_antiscar_out_of_stock',
    };
  }

  // Voice note / audio clip check
  if (/audioclip-|\.(mp4|m4a|aac|ogg|opus|wav|amr)(\?|$)/i.test(rawMsg) || /^(audio|voice|voice_note|voicenote|تسجيل\s*صوتي|فويس)$/i.test(rawMsg)) {
    const voiceReply =
      `أهلاً بحضرتك يا فندم نورتي مونتانيا 💜\n\n` +
      `الشات هنا بيستقبل رسائل كتابية ومابيقدرش يشغل الفويسات والتسجيلات الصوتية.\n` +
      `اكتبيلي استفسارك أو طلبك في رسالة مكتوبة، وهجاوبك على كل التفاصيل والأسعار فوراً 🌸`;
    return {
      reply: voiceReply,
      reply1: voiceReply,
      reply2: 'NONE',
      reply3: 'NONE',
      sessionId: sid,
      engineSource: 'v3_voice_note_handler',
    };
  }

  // Resolve bundle explicitly named by customer or active ad offer
  const textBundle = resolveBundleFromCustomerText(rawMsg);
  const adBundle = textBundle ||
    resolveSelectedBundle(effectiveBundle) ||
    resolveBundleFromAdHints(adTitle, effectiveBundle, session.selectedBundle) ||
    (session.selectedBundle ? getBundleByKey(session.selectedBundle) : null);

  const isPriceObjection = /(?:غالي|غالية|السعر\s*(?:عالي|مرتفع|غالي|كتير)|كتير\s*أوي|كتير\s*كده|مفيش\s*(?:أرخص|تخفيض|خصم)|ليه\s*كده|ليه\s*بكام|مبلغ\s*كبير|المنتج\s*غالي)/i.test(rawMsg);
  const isPriceInquiry = /(?:بكام|كام|السعر|سعر|price|cost|how\s*much)/i.test(rawMsg);
  const isEnglishMessage = /^[a-z0-9\s.,!?'"()#@%&+\-\/:;]+$/i.test(rawMsg) && /[a-z]{2,}/i.test(rawMsg);

  // If customer came from ad or cart has a bundle, or if customer objects/inquires about price
  let targetOffer = adBundle;
  if (!targetOffer && identifiedProd?.routineKey) {
    targetOffer = getBundleByKey(identifiedProd.routineKey);
  }
  if (!targetOffer && cart.length) {
    const bItem = cart.find(i => i.isBundle);
    targetOffer = bItem ? getBundleByKey(bItem.bundleKey) : null;
  }
  if (!targetOffer) {
    const historyText = JSON.stringify(chatHistory || session.history || []) + ' ' + rawMsg;
    const hasLaserHint = /(?:ليزر|laser|ما\s*بعد\s*الليزر|بوست\s*ليزر|618|٦١٨)/i.test(historyText) || imageProductSlug === 'post-laser-cream';
    const hasFaceBodyHint = /(?:نضار[ةه]|حب\s*الشباب|المسام|558|٥٥٨)/i.test(historyText);
    if (hasLaserHint) {
      targetOffer = getBundleByKey('post-laser');
    } else if (hasFaceBodyHint) {
      targetOffer = getBundleByKey('face-body');
    } else if (isPriceObjection || isPriceInquiry || effectiveBundle || /(?:تفتيح|تبييض|777|٧٧٧)/i.test(historyText)) {
      targetOffer = getBundleByKey('brightening');
    }
  }

  // Only track into session cart if customer explicitly expressed a pure order intent without questions
  const hasQuestionWord = /(?:إيه|ايه|ليه|بكام|كام|سعر|ازاي|إزاي|شغال|مكونات|حوامل|مناسب|نتيجة|نتائج|تفاصيل|أستفسر|استفسار|تعارض|\?|؟|how\s*much|price|cost|what|when|where|is\s*it|can\s*i|details)/i.test(rawMsg);
  const isPureOrderIntent = /(?:أنا\s*(?:عاوزة|عايزة|عاوز|عايز)\s*أطلب|(?:عاوزة|عايزة|عاوز|عايز)\s*أطلب|م?ممكن\s*(?:أطلب|اطلب)|اطلبلي|سجل[يى]لي?\s*أوردر|احجز[يى]لي?|هات[يى]لي?\s*العرض|أطلب\s*العرض|محتاج[اهة]|عايز[اهة]|عاوز[اهة]|حاب[ةب][هة]?\s*(?:أطلب|اطلب)|ابعت[يى]ه?|ابعتول[يى]|تمام\s*(?:الروتين|العرض|\d+|٦١٨|777|٧٧٧|558|٥٥٨)?|اعتمد[يى]?\s*(?:الأوردر|الطلب)?|أكد[يى]?\s*(?:الأوردر|الطلب)?)/i.test(rawMsg);

  if (targetOffer && !cart.length && isPureOrderIntent && !hasQuestionWord) {
    cart.push({
      id: `bundle:${targetOffer.key}`,
      bundleKey: targetOffer.key,
      name: targetOffer.name,
      price: targetOffer.bundlePrice,
      qty: 1,
      isBundle: true,
      productSlugs: targetOffer.productSlugs,
    });
  }

  // Automatic extraction helper to guarantee customer details are captured into state
  try {
    const { parseVolunteeredDeliveryDetails, looksLikeVolunteeredDeliveryDetails, isUsableDeliveryAddress } = require('./chatEngine');
    if (looksLikeVolunteeredDeliveryDetails(rawMsg)) {
      const volunteered = parseVolunteeredDeliveryDetails(rawMsg, customer.phone);
      if (volunteered) {
        if (volunteered.phone && !customer.phone) customer.phone = volunteered.phone;
        if (volunteered.name && !customer.name) customer.name = volunteered.name;
        if (volunteered.address && isUsableDeliveryAddress(volunteered.address) && !customer.address) {
          customer.address = volunteered.address;
        }
        if (customer.address) {
          const explicitGovMatch = rawMsg.match(/(?:محافظ[ةه]|المحافظ[ةه])\s*[:.\-–]*\s*([^\n,،.!؟?]{2,30})/i);
          const explicitCityMatch = rawMsg.match(/(?:مدين[ةه]|المدين[ةه]|مركز)\s*[:.\-–]*\s*([^\n,،.!؟?]{2,30})/i);
          if (explicitGovMatch && !customer.governorate) {
            customer.governorate = matchGovernorateNameSync(explicitGovMatch[1].trim()) || explicitGovMatch[1].trim();
          }
          if (!customer.governorate) {
            customer.governorate = matchGovernorateNameSync(customer.address) || matchGovernorateNameSync(rawMsg) || 'القاهرة';
          }
          const extra = [];
          if (explicitCityMatch && !customer.address.includes(explicitCityMatch[1].trim())) {
            extra.push(explicitCityMatch[1].trim());
          }
          if (explicitGovMatch && !customer.address.includes(explicitGovMatch[1].trim())) {
            extra.push(explicitGovMatch[1].trim());
          }
          if (extra.length) {
            customer.address = `${customer.address}، ${extra.join('، ')}`;
          }
        }
      }
    }
  } catch (err) {
    console.warn('[salesAgentV3] parseVolunteeredDeliveryDetails error:', err.message);
  }

  const phoneCandidate = extractPhoneFromText(rawMsg);
  if (phoneCandidate && !customer.phone) {
    customer.phone = phoneCandidate;
  }
  const nameCandidateMatch = rawMsg.match(/^(?:أنا|اسمي|الاسم(?:\s*:)?)\s+([^\d\n\r,،.!؟?]{2,30})$/i);
  if (nameCandidateMatch && !customer.name) {
    const candidate = nameCandidateMatch[1].trim();
    if (!/(عايز|عاوز|بكام|سعر|روتين|كريم|غسول|لوشن|ليزر|غالي)/i.test(candidate)) {
      customer.name = candidate;
    }
  }
  if (!customer.address && /^(?:العنوان|عنواني|عنوان\s*التوصيل)(?:\s*:)?\s+(.+)$/i.test(rawMsg) && !/[?؟]/.test(rawMsg)) {
    const addr = rawMsg.replace(/^(?:العنوان|عنواني|عنوان\s*التوصيل)(?:\s*:)?\s+/i, '').trim();
    if (addr.length >= 8) {
      customer.address = addr;
      customer.governorate = matchGovernorateNameSync(addr) || customer.governorate || 'القاهرة';
    }
  }

  // If customer provided delivery details and cart is still empty, auto-populate cart with targetOffer
  if (!cart.length && targetOffer && (customer.address || (customer.name && customer.phone))) {
    cart.push({
      id: `bundle:${targetOffer.key}`,
      bundleKey: targetOffer.key,
      name: targetOffer.name,
      price: targetOffer.bundlePrice,
      qty: 1,
      isBundle: true,
      productSlugs: targetOffer.productSlugs,
    });
  }

  // Reviews & opinions ask -> direct official social links
  if (isReviewsOrOpinionsAsk(rawMsg)) {
    const revReply =
      `تحت أمرك يا فندم 💜\n` +
      `تقدري تشوفي آراء وتجارب عميلاتنا الحقيقية وتقييماتهم على صفحاتنا الرسمية:\n\n` +
      `🔗 فيسبوك: https://www.facebook.com/montana.com.eg/\n` +
      `🔗 إنستجرام: https://www.instagram.com/montana.com.eg\n\n` +
      `ومعاكي كمان حق معاينة وفتح الشحنة عند الاستلام والتأكد من المنتجات بنفسك قبل الدفع كاش 🤝`;
    return {
      reply: revReply,
      reply1: revReply,
      reply2: 'NONE',
      reply3: 'NONE',
      sessionId: sid,
      engineSource: 'v3_reviews_handler',
    };
  }

  // Photos & packaging ask -> official image + details + link
  if (isShowProductsLookAsk(rawMsg)) {
    const { resolveProductMentions } = require('./orderContext');
    let matchedProds = resolveProductMentions(rawMsg, [
      { name: 'غسول التفتيح', slug: 'whitening-cleanser' },
      { name: 'كريم التفتيح', slug: 'whitening-cream' },
      { name: 'لوشن اليدين والجسم', slug: 'hand-body-lotion' },
      { name: 'كريم العناية بعد الليزر', slug: 'post-laser-cream' },
      { name: 'غسول علاج حب الشباب للوجه', slug: 'acne-facial-cleanser' },
    ]);
    if (!matchedProds.length) {
      const recentUser = (chatHistory || []).slice(-4).map(h => h.text || '').join(' ');
      matchedProds = resolveProductMentions(recentUser, [
        { name: 'غسول التفتيح', slug: 'whitening-cleanser' },
        { name: 'كريم التفتيح', slug: 'whitening-cream' },
        { name: 'لوشن اليدين والجسم', slug: 'hand-body-lotion' },
        { name: 'كريم العناية بعد الليزر', slug: 'post-laser-cream' },
        { name: 'غسول علاج حب الشباب للوجه', slug: 'acne-facial-cleanser' },
      ]);
    }

    const asksBundle = /(روتين|عرض|مجموع|سيت|كورس)/i.test(rawMsg);
    const sku = (!asksBundle && matchedProds.length === 1) ? matchedProds[0].slug : null;

    let photoReply = '';
    const SITE_URL = 'https://www.montana.com.eg';

    if (sku) {
      const pInfo = {
        'whitening-cream': {
          name: 'كريم التفتيح المركز من مونتانيا',
          size: '50 جم',
          desc: 'كريم تفتيح طبي للوجه والمناطق الحساسة بتركيبة العرقسوس وفيتامين سي والأربوتين',
          img: `${SITE_URL}/images/p3.png`,
        },
        'whitening-cleanser': {
          name: 'غسول التفتيح اليومي من مونتانيا',
          size: '200 مل',
          desc: 'غسول طبي لطيف خالي من السلفات القاسية لتنظيف وتفتيح البشرة وتنقية المسام',
          img: `${SITE_URL}/images/p2.png`,
        },
        'hand-body-lotion': {
          name: 'لوشن ترطيب اليدين والجسم',
          size: '200 مل',
          desc: 'لوشن ترطيب وتنعيم للجسم بملمس خفيف وسريع الامتصاص',
          img: `${SITE_URL}/images/p4.png`,
        },
        'post-laser-cream': {
          name: 'كريم العناية بعد الليزر والتقشير',
          size: '50 جم',
          desc: 'كريم ملطف ومرمم لتهدئة البشرة ومنع الاحمرار والتصبغات بعد الجلسات',
          img: `${SITE_URL}/images/p5.png`,
        },
        'acne-facial-cleanser': {
          name: 'غسول علاج حب الشباب للوجه',
          size: '200 مل',
          desc: 'غسول للبشرة الدهنية والمعرضة للحبوب لتنقية المسام وتقليل الإفرازات الدهنية',
          img: `${SITE_URL}/images/p1.png`,
        },
      }[sku];

      photoReply =
        `تحت أمرك يا فندم 💜\n` +
        `المنتج اللي هتوصلك عبوته هو:\n` +
        `• **${pInfo?.name || 'المنتج'}** (حجم ${pInfo?.size || 'كبير'}) — ${pInfo?.desc || ''}.\n\n` +
        `ودي صورة المنتج وشكل العبوة على الطبيعة:\n` +
        `${pInfo?.img || `${SITE_URL}/images/p2.png`}\n\n` +
        `وتقدري كمان تشوفي كامل تفاصيله وطريقة استخدامه من هنا:\n` +
        `${SITE_URL}/product.html?slug=${encodeURIComponent(sku)}\n\n` +
        `ومعاكي حق فتح الشحنة ومعاينة المنتج بنفسك عند الاستلام قبل ما تدفعي مليم واحد 🎁`;
    } else if (targetOffer?.key === 'post-laser') {
      photoReply =
        `تحت أمرك يا فندم 💜\n` +
        `عرض **روتين العناية بعد الليزر** بيتكون من عبوتين:\n` +
        `1. **كريم بعد الليزر والتقشير** (حجم 50 جم) لتهدئة وترميم البشرة.\n` +
        `2. **كريم التفتيح المركز** (حجم 50 جم) لمنع أي تصبغات بعد الجلسات.\n\n` +
        `ودي صورة المنتجات وشكل العبوة:\n` +
        `${SITE_URL}/images/p5.png\n\n` +
        `وتقدري تشوفي تفاصيل العرض على موقعنا:\n` +
        `${SITE_URL}/bundle/post-laser-care-routine\n\n` +
        `ومعاكي حق فتح الشحنة ومعاينة المنتجات بنفسك عند الاستلام قبل ما تدفعي مليم واحد 🎁`;
    } else if (targetOffer?.key === 'face-body') {
      photoReply =
        `تحت أمرك يا فندم 💜\n` +
        `عرض **روتين نضارة الوجه وترطيب الجسم** بيتكون من عبوتين بحجم كبير:\n` +
        `1. **غسول علاج حب الشباب للوجه** (حجم 200 مل).\n` +
        `2. **لوشن ترطيب اليدين والجسم** (حجم 200 مل).\n\n` +
        `ودي صورة المنتجات وشكل العبوة:\n` +
        `${SITE_URL}/images/p1.png\n\n` +
        `وتقدري تشوفي تفاصيل العرض على موقعنا:\n` +
        `${SITE_URL}/bundle/face-body-care-routine\n\n` +
        `ومعاكي حق فتح الشحنة ومعاينة المنتجات بنفسك عند الاستلام قبل ما تدفعي مليم واحد 🎁`;
    } else {
      photoReply =
        `تحت أمرك يا فندم 💜\n` +
        `الروتين اللي هيوصلك هو **روتين التفتيح الكامل** (3 عبوات بأحجام كبيرة بتكفيكي من شهرين لـ 3 شهور):\n` +
        `1. **غسول التفتيح اليومي** (حجم 200 مل)\n` +
        `2. **كريم التفتيح المركز** للوجه والمناطق الحساسة (حجم 50 جم)\n` +
        `3. **لوشن ترطيب ونعومة اليدين والجسم** (حجم 200 مل)\n\n` +
        `ودي صورة الروتين وشكل العبوات كلها مع بعض:\n` +
        `${SITE_URL}/images/brightening-bundle-hero.png\n\n` +
        `وتقدري تشوفي تفاصيل العرض على موقعنا:\n` +
        `${SITE_URL}/bundle/brightening-routine\n\n` +
        `ومعاكي حق فتح الشحنة والمعاينة بنفسك عند الاستلام قبل ما تدفعي مليم واحد 🎁`;
    }

    return {
      reply: photoReply,
      reply1: photoReply,
      reply2: 'NONE',
      reply3: 'NONE',
      sessionId: sid,
      engineSource: 'v3_photos_handler',
    };
  }

  // Step 3: Initialize Gemini Model & Chat
  const genAI = getGeminiClient();
  if (!genAI) {
    console.error('[salesAgentV3] GEMINI_API_KEY is not configured');
    const fb = v2.safeModelFailureFallback({ cart, customer });
    return {
      reply: fb,
      reply1: fb,
      reply2: 'NONE',
      reply3: 'NONE',
      sessionId: sid,
      engineSource: 'model_failure_fallback',
    };
  }

  // Prepare sanitized history for Gemini
  const rawHistory = (Array.isArray(chatHistory) && chatHistory.length > 0) ? chatHistory : (session.history || []);
  const geminiHistory = historyToGemini(rawHistory);
  const isOngoingConversation = (rawHistory.length > 0 || geminiHistory.length > 0);

  // Build dynamic turn context to steer Gemini cleanly
  let turnContext = `\n--- سياق المحادثة الحالي ---`;
  if (isOngoingConversation) {
    turnContext += `\n- حالة المحادثة: هذه محادثة مستمرة جارية بالفعل (رسالة متابعة من العميل). تنبيه حاسم: ممنوع منعاً باتاً تكرار التحية أو البدء بـ «أهلاً بحضرتك» أو «نورتي»! ادخلي فوراً وبطبيعية في صلب الرد على كلام العميل.`;
  } else {
    turnContext += `\n- حالة المحادثة: هذه أول رسالة من العميل في المحادثة. يمكنك الترحيب بلباقة في أول سطر.`;
  }

  if (customer.name && customer.phone && customer.address) {
    turnContext += `\n- بيانات الشحن والتوصيل مكتملة بالكامل لدى العميل: الاسم «${customer.name}»، الموبايل «${customer.phone}»، العنوان «${customer.address}»، المحافظة «${customer.governorate || 'القاهرة'}».
تعليمات حاسمة ومشددة:
1. العميل أرسل بيانات الشحن بالكامل ويريد إتمام الأوردر فوراً.
2. ممنوع منعاً باتاً طلب الاسم أو رقم الموبايل أو العنوان مرة أخرى لأنها مسجلة ومكتملة!
3. قومي فوراً باستدعاء أداة create_pending_order لإنشاء الطلب وتأكيد رقم الأوردر والشحن المجاني والدفع 100% كاش عند الاستلام بعد المعاينة.`;
  }

  if (cart.length > 0) {
    turnContext += `\n- المنتجات الموجودة في السلة حالياً: ${cart.map(i => `${i.name} (${i.price} ج)`).join('، ')}.`;
  } else if (targetOffer) {
    if (customer.address || (customer.name && customer.phone) || isPureOrderIntent) {
      turnContext += `\n- العرض/المنتج المعني الأساسي: «${targetOffer.name}» بسعر ${targetOffer.bundlePrice} جنيه مع شحن مجاني.`;
    } else {
      turnContext += `\n- العرض/المنتج المعني الأساسي: «${targetOffer.name}» بسعر ${targetOffer.bundlePrice} جنيه مع شحن مجاني (السلة فارغة حالياً — العميل يستفسر ويسأل فقط ولم يطلب الشراء بعد. جاوبي على سؤاله بإيجاز تام مع توضيح المنتجات والسعر والشحن المجاني، واختمي دائماً بسؤال إغلاق بيعي لطيف مثل: «تحبي نجهزهولك وتستفيدي من الشحن المجاني النهاردة يا فندم؟ 💜» أو «تحبي الشحن يوصلك على عنوان البيت ولا الشغل؟»، ولا تطلبي بيانات الشحن حتى يؤكد رغبته في الشراء).`;
    }
  }

  const isShippingInquiry = /(?:شحن|الشحن|توصيل|التوصيل|مصاريف)/i.test(rawMsg);
  const recentHistoryText = (chatHistory || []).slice(-6).map(h => h.text || '').join(' ');
  const recentSingleProdInquiry = /(?:ابو\s*299|299|ابو\s*249|249|229|لوحده|وحده|مش\s*عايز[ةه]?\s*التلات[ةه]|مش\s*عايزه\s*الكل|منتج\s*واحد)/i.test(recentHistoryText);

  if (isShippingInquiry) {
    turnContext += `\n- تنبيه حاسم لاستفسار الشحن: العميل يسأل عن الشحن والتوصيل.`;
    if (recentSingleProdInquiry) {
      turnContext += `\n  • لاحظي أن الحديث الأخير كان عن منتج مفرد (مثل غسول 299 أو كريم 249 أو رغبة العميل في منتج واحد فقط): وضحي فوراً أن شحن المنتج المفرد يكون بمصاريف (50 جنيه لمعظم المحافظات)، وأن الشحن يكون مجانياً بالكامل 🎁 عند طلب الروتين الكامل (أو أي 3 منتجات). ممنوع منعاً باتاً الادعاء بأن الشحن مجاني لمجرد وجود روتين التفتيح كعرض افتراضي!`;
    }
  }

  if (identifiedProd) {
    turnContext += `\n- تنبيه صورة العميل: العميل أرسل صورة لمنتج «${identifiedProd.name}» (سعره منفرد ${identifiedProd.price} ج).
تعليمات الرد على الصورة:
1. وضّحي للعميل فوراً وبشكل صريح ومباشر أن المنتج الموجود في الصورة هو «${identifiedProd.name}» من مونتانيا.
2. سعره منفرد: ${identifiedProd.price} ج.
3. فوايده واستخدامه باختصار: ${identifiedProd.benefit}.
4. اعرضي عليه بذكاء العرض الأوفر الخاص به: «${identifiedProd.routineName}» (${identifiedProd.routinePrice} ج والشحن مجاني تماماً 🎁).
5. إذا سأل العميل أي سؤال في رسالته (مثل السعر أو طريقة الاستخدام أو مناسب لإيه)، جاوبي عليه تحديداً وبدقة بخصوص هذا المنتج.
6. إذا كانت رسالة العميل مجرد إرسال الصورة بدون سؤال أو استفسار: عرّفيه بالمنتج وسعره وفائدته، واسأليه بلطف إذا كان حابب يطلبه أو يستفيد من عرض الروتين بالشحن المجاني، أو حابب يستشيرنا في مشكلة معينة بالبشرة.`;
  } else if (imageRead?.offerKey) {
    const off = getBundleByKey(imageRead.offerKey);
    if (off) {
      turnContext += `\n- تنبيه صورة العميل: العميل أرسل سكرين شوت لعرض/روتين «${off.name}» (سعره ${off.bundlePrice} ج والشحن مجاني 🎁).
وضّحي له فوراً أن هذا هو عرض «${off.name}» ومكوناته، واسأليه إن كان حابب يطلبه أو يستفسر عن تفاصيل أكثر.`;
    }
  } else if (imageRead?.text) {
    turnContext += `\n- تنبيه سكرين شوت من العميل: العميل أرسل لقطة شاشة (سكرين شوت) تتضمن النص التالي:
«${imageRead.text}»
ملخص الصورة: ${imageRead.summary || 'سكرين شوت من بوست أو محادثة'}
افهمي سياق هذه الصورة وأجيبي العميل مباشرة بخصوص ما ورد فيها.`;
  } else if (hasImage || imageUrl) {
    turnContext += `\n- تنبيه صورة العميل: العميل أرسل صورة أو بوست بدون نص مرفق.
تعليمات حاسمة ومشددة:
1. ممنوع منعاً باتاً أن تقولي «أنا مقدرش أشوف الصورة» أو «للأسف مقدرش أفتح الصورة» أو تذكري أنك ذكاء اصطناعي أو غير قادرة على رؤية الصورة!
2. رحّبي بالعميلة بلطف واسأليها بإيجاز وبطبيعية شديدة: «تحت أمرك يا فندم 💜 حابة تستفسري عن سعر أو طريقة استخدام منتج معين، ولا حابة تستشيرينا في مشكلة بالبشرة؟»`;
  }

  if (isPriceObjection) {
    turnContext += `\n- توجيه خاص لاعتراض السعر: العميل يعتبر السعر مرتفعاً أو غالي («${rawMsg}»).
ممنوع نهائياً أن تسألي «أنهي منتج؟» أو «قصدك على إيه؟»!
افهمي فوراً أنه يتكلم عن «${targetOffer ? targetOffer.name : 'روتين التفتيح الكامل'}».
تعاملي بلباقة وتفهم مصري راقٍ («مقدّرة رأي حضرتك تماماً يا فندم 💜»)، واشرحي القيمة الحقيقية للروتين (كورس علاجي متكامل من 3 عبوات بأحجام كبيرة 200 مل و250 مل و50 مل يكفي 2 إلى 3 شهور استخدام يومي، وتوفير 130 جنيه عن الشراء المنفرد 907 ج، وشحن مجاني ومعاينة كاش عند الاستلام)، ثم اعرضي البديل الاقتصادي للبدء بمنتج واحد فقط من الكتالوج (كريم التفتيح بـ 369 ج أو غسول التفتيح بـ 249 ج) ليجرب النتيجة بنفسه دون إحراج.`;
  }

  if (isEnglishMessage) {
    turnContext += `\n- تنبيه لغة العميل: العميل يتحدث باللغة الإنجليزية (The customer writes in English: «${rawMsg}»).
ممنوع منعاً باتاً الرد بالعربية!
يجب أن يكون الرد بالكامل باللغة الإنجليزية بأسلوب ودود وموجز جداً ولبق (Respond strictly in clear, friendly, and concise English).
سعر الروتين المعني: The complete ${targetOffer ? targetOffer.name : 'Whitening Routine'} is ${targetOffer ? targetOffer.bundlePrice : 777} EGP with free shipping.
Payment is 100% Cash on Delivery upon inspection.
اختمي بسؤال: Would you like us to prepare it for you? 💜`;
  }

  const model = genAI.getGenerativeModel({
    model: 'gemini-2.5-flash',
    systemInstruction: {
      parts: [{ text: `${SYSTEM_INSTRUCTION_V3}\n${turnContext}` }]
    },
    tools: TOOL_DECLARATIONS,
    generationConfig: {
      maxOutputTokens: 4096,
      temperature: 0.3,
    },
  });

  const chat = model.startChat({
    history: geminiHistory,
  });

  // Turn variables
  let orderJustCreated = null;
  let needsHumanFlag = false;
  let finalReplyText = '';

  // Multi-turn tool execution loop
  let toolLoopGuard = 0;
  let currentSendPayload = message || 'أهلاً بحضرتك';
  if (!rawMsg || /^(?:\(أرسل صورة\)|\(صورة\)|صورة|أرسل صورة)$/i.test(rawMsg)) {
    if (identifiedProd) {
      currentSendPayload = `[العميل أرسل صورة لمنتج: ${identifiedProd.name}]`;
    } else if (imageRead?.offerKey) {
      currentSendPayload = `[العميل أرسل سكرين شوت لعرض: ${targetOffer?.name || imageRead.offerKey}]`;
    } else if (imageRead?.text) {
      currentSendPayload = `[العميل أرسل سكرين شوت تتضمن النص: ${imageRead.text}]`;
    } else if (hasImage || imageUrl) {
      currentSendPayload = `[العميل أرسل صورة بدون نص]`;
    }
  }

  try {
    let result = await chat.sendMessage(currentSendPayload);
    let calls = result.response.functionCalls();

    while (calls && calls.length && toolLoopGuard < 6) {
      toolLoopGuard++;
      const responses = [];

      for (const call of calls) {
        const { name, args } = call;
        let toolResult = null;

        if (name === 'get_catalog') {
          const catalog = await fetchDbCatalog();
          toolResult = {
            products: catalog.map(p => ({
              id: p.id,
              name: p.name,
              price: p.price,
              slug: p.slug,
              size: p.size,
              description: p.description,
              ingredients: p.ingredients,
              skin_type: p.skin_type,
            }))
          };
        } else if (name === 'get_routine_offers') {
          toolResult = {
            routines: BUNDLES.map(b => ({
              key: b.key,
              name: b.name,
              price: b.bundlePrice,
              products: b.productLabels,
              shipping: 'مجاني تماماً 🎁',
              purpose: b.key === 'brightening'
                ? 'تفتيح وتوحيد لون الوجه والمناطق الحساسة وترطيب الجسم'
                : b.key === 'post-laser'
                ? 'تهدئة وترطيب البشرة بعد جلسات الليزر وإزالة الشعر وتقليل الاحمرار'
                : 'تنظيف مسام البشرة الدهنية والتحكم في الحبوب مع ترطيب الجسم',
            }))
          };
        } else if (name === 'get_cart') {
          toolResult = formatCartSummary(cart, customer);
        } else if (name === 'update_cart') {
          const action = String(args?.action || '').trim().toLowerCase();
          const target = String(args?.item_identifier || '').trim().toLowerCase();
          const qty = Math.max(1, Math.floor(Number(args?.quantity)) || 1);

          if (action === 'clear') {
            cart = [];
            toolResult = { success: true, message: 'تم تفريغ السلة بالكامل', cart: formatCartSummary(cart, customer) };
          } else if (action === 'remove') {
            cart = cart.filter(item => {
              const iname = (item.name || '').toLowerCase();
              const islug = (item.slug || '').toLowerCase();
              const ibundle = (item.bundleKey || '').toLowerCase();
              if (target.includes('laser') || target.includes('ليزر')) {
                if (ibundle === 'post-laser' || islug.includes('laser') || iname.includes('ليزر')) return false;
              }
              if (target.includes('bright') || target.includes('تفتيح')) {
                if (ibundle === 'brightening' || islug.includes('brightening') || iname.includes('تفتيح')) return false;
              }
              if (target.includes('body') || target.includes('وش') || target.includes('جسم')) {
                if (ibundle === 'face-body' || islug.includes('body') || iname.includes('جسم')) return false;
              }
              if (target.includes('lotion') || target.includes('لوشن')) {
                if (islug.includes('lotion') || iname.includes('لوشن')) return false;
              }
              if (target.includes('cream') || target.includes('كريم')) {
                if (islug.includes('cream') || iname.includes('كريم')) return false;
              }
              if (target.includes('clean') || target.includes('غسول')) {
                if (islug.includes('clean') || iname.includes('غسول')) return false;
              }
              return true;
            });
            toolResult = { success: true, removed: target, cart: formatCartSummary(cart, customer) };
          } else if (action === 'add') {
            // Check bundle match first
            let matchedBundle = null;
            if (target.includes('bright') || target.includes('تفتيح')) matchedBundle = getBundleByKey('brightening');
            else if (target.includes('laser') || target.includes('ليزر')) matchedBundle = getBundleByKey('post-laser');
            else if (target.includes('face') || target.includes('جسم') || target.includes('وش')) matchedBundle = getBundleByKey('face-body');

            if (matchedBundle) {
              cart.push({
                id: `bundle:${matchedBundle.key}`,
                bundleKey: matchedBundle.key,
                name: matchedBundle.name,
                price: matchedBundle.bundlePrice,
                qty,
                isBundle: true,
                productSlugs: matchedBundle.productSlugs,
              });
              toolResult = { success: true, added: matchedBundle.name, price: matchedBundle.bundlePrice, cart: formatCartSummary(cart, customer) };
            } else {
              // Match product from catalog
              const catalog = await fetchDbCatalog();
              const prod = catalog.find(p => {
                const s = p.slug.toLowerCase();
                const n = p.name.toLowerCase();
                if (target.includes('lotion') || target.includes('لوشن')) return s.includes('lotion') || n.includes('لوشن');
                if (target.includes('clean') || target.includes('غسول')) return s.includes('cleanser') || n.includes('غسول');
                if (target.includes('cream') || target.includes('كريم')) return s.includes('whitening') || n.includes('كريم');
                return s.includes(target) || n.includes(target);
              });

              if (prod) {
                cart.push({
                  id: prod.id,
                  slug: prod.slug,
                  name: prod.name,
                  price: prod.price,
                  qty,
                  isBundle: false,
                });
                toolResult = { success: true, added: prod.name, price: prod.price, cart: formatCartSummary(cart, customer) };
              } else {
                toolResult = { error: `لم يتم العثور على منتج يطابق: ${target}` };
              }
            }
          }
        } else if (name === 'save_customer_details') {
          if (args.name && String(args.name).trim().length >= 2) {
            customer.name = String(args.name).trim();
          }
          if (args.phone) {
            const p = normalizePhone(args.phone);
            if (p) customer.phone = p;
          }
          if (args.address && String(args.address).trim().length >= 5) {
            customer.address = String(args.address).trim();
            if (!customer.governorate) {
              customer.governorate = matchGovernorateNameSync(customer.address);
            }
          }
          if (args.governorate) {
            customer.governorate = matchGovernorateNameSync(args.governorate) || String(args.governorate).trim();
          }

          if (!cart.length && targetOffer) {
            cart.push({
              id: `bundle:${targetOffer.key}`,
              bundleKey: targetOffer.key,
              name: targetOffer.name,
              price: targetOffer.bundlePrice,
              qty: 1,
              isBundle: true,
              productSlugs: targetOffer.productSlugs,
            });
          }

          toolResult = {
            success: true,
            currentCustomerDetails: customer,
            cart: formatCartSummary(cart, customer),
            isReadyToCreateOrder: !!(cart.length && customer.name && customer.phone && customer.address),
          };
        } else if (name === 'create_pending_order') {
          if (!cart.length && targetOffer) {
            cart.push({
              id: `bundle:${targetOffer.key}`,
              bundleKey: targetOffer.key,
              name: targetOffer.name,
              price: targetOffer.bundlePrice,
              qty: 1,
              isBundle: true,
              productSlugs: targetOffer.productSlugs,
            });
          }
          // Validate required fields
          if (!cart.length) {
            toolResult = { error: 'السلة فارغة، يجب إضافة منتجات أولاً قبل إنشاء الطلب' };
          } else if (!customer.name) {
            toolResult = { error: 'اسم العميل مطلوب لإنشاء الطلب' };
          } else if (!customer.phone || !normalizePhone(customer.phone)) {
            toolResult = { error: 'رقم الموبايل غير صحيح، مطلوب 11 رقم يبدأ بـ 01' };
          } else if (!customer.address || customer.address.length < 5) {
            toolResult = { error: 'عنوان التوصيل غير مكتمل' };
          } else {
            const gov = customer.governorate || matchGovernorateNameSync(customer.address) || 'القاهرة';
            customer.governorate = gov;
            const totals = calculateCartTotals(cart, gov);

            // Snapshot hash for idempotency
            const snapshotResult = v2.computeCheckoutSnapshot({
              cart,
              subtotal: totals.subtotal,
              shipping: totals.shippingCost,
              discount: 0,
              total: totals.total,
              name: customer.name,
              phone: customer.phone,
              address: customer.address,
              governorate: gov,
            });
            const hashStr = (snapshotResult && typeof snapshotResult === 'object' && snapshotResult.hash)
              ? snapshotResult.hash
              : String(snapshotResult || '');
            const operationId = `op_${String(sid).replace(/[^a-zA-Z0-9_-]/g, '_')}_${hashStr.slice(0, 16) || Date.now()}`;

            const isEval = /(^|:)eval-/.test(sid) || Boolean(_testAdapters && !_testAdapters.useRealRpc);

            if (isEval) {
              const mockOrderNumber = `EVAL-${Date.now().toString().slice(-6)}`;
              orderJustCreated = mockOrderNumber;
              v2.recordSalesQualityMetric('order_confirmed', { orderNumber: mockOrderNumber });
              cart = []; // Empty cart after successful placement
              toolResult = {
                success: true,
                order_number: mockOrderNumber,
                total: totals.total,
                free_shipping: totals.freeShipping,
                payment_method: '100% Cash on Delivery upon inspection',
              };
            } else {
              try {
                const res = await v2.executeIdempotentOrderCreate({
                  operationId,
                  sid,
                  createOrderFn: async () => {
                    const orderItems = await expandCartItemsForOrder(cart);
                    const isInternalTest = String(sid).startsWith('test:') || v2.isTestIsolationSession(sid);
                    const orderPayload = {
                      p_customer: {
                        name: isInternalTest ? `[اختبار داخلي] ${customer.name}` : customer.name,
                        phone: customer.phone,
                        address: isInternalTest ? `${customer.address} [طلب تجريبي - لا تشحن]` : customer.address,
                        city: gov,
                      },
                      p_items: orderItems,
                      p_payment_method: 'cod',
                      p_delivery_method: 'standard',
                      p_subtotal: totals.subtotal,
                      p_shipping_cost: totals.shippingCost,
                      p_discount: 0,
                      p_total: totals.total,
                      p_governorate: gov,
                      p_deposit_amount: 0,
                      p_chat_session_id: sid,
                      p_chat_channel: channel || 'web',
                    };

                    let dbRes;
                    if (sbService) {
                      dbRes = await sbService.rpc('create_chat_order_idempotent', {
                        p_idempotency_key: operationId,
                        ...orderPayload,
                      });
                    } else {
                      dbRes = await sb.rpc('create_guest_order', orderPayload);
                    }

                    if (dbRes.error || !dbRes.data) {
                      console.error('[salesAgentV3] order RPC error:', dbRes.error);
                      throw new Error(dbRes.error?.message || 'Database order creation failed');
                    }
                    const realOrder = dbRes.data;
                    const realOrderNumber = realOrder?.order?.order_number || realOrder?.order_number || `MON-${Date.now().toString().slice(-5)}`;
                    return { order_number: realOrderNumber, idempotentReplay: Boolean(realOrder?.idempotent_replay) };
                  }
                });

                const realOrderNumber = res.order_number;
                orderJustCreated = realOrderNumber;

                // Server-side Telegram notification (only for real customer orders, never for internal tests or replays)
                const isInternalTest = String(sid).startsWith('test:') || v2.isTestIsolationSession(sid);
                if (tgConfigured() && !isInternalTest && !res.idempotentReplay) {
                  await notifyTelegramOrder({
                    order_number: realOrderNumber,
                    total: totals.total,
                    customer_name: customer.name,
                    customer_phone: customer.phone,
                    governorate: gov,
                    address: customer.address,
                    items: cart.map(i => `${i.name} x${i.qty}`).join(', '),
                  }).catch(e => console.error('[salesAgentV3] Telegram alert failed:', e.message));
                }

                v2.recordSalesQualityMetric('order_confirmed', { orderNumber: realOrderNumber });
                cart = []; // Empty cart after successful placement
                toolResult = {
                  success: true,
                  order_number: realOrderNumber,
                  total: totals.total,
                  free_shipping: totals.freeShipping,
                  payment_method: '100% Cash on Delivery upon inspection',
                  is_replay: !!res.idempotentReplay,
                };
              } catch (dbErr) {
                console.error('[salesAgentV3] Order creation error:', dbErr.message);
                toolResult = { error: 'تعذر تسجيل الأوردر في قاعدة البيانات حالياً، يرجى المحاولة بعد لحظات' };
              }
            }
          }
        } else if (name === 'handover_to_human') {
          needsHumanFlag = true;
          toolResult = {
            success: true,
            message: 'تم تحويل المحادثة لفريق الدعم، وسيقوم ممثل خدمة العملاء بالمتابعة.',
            support_phone: CS_SUPPORT_PHONE,
          };
        }

        responses.push({
          functionResponse: {
            name,
            response: toolResult || { ok: true }
          }
        });
      }

      // Send tool outputs back to Gemini
      result = await chat.sendMessage(responses);
      calls = result.response.functionCalls();
    }

    finalReplyText = result.response.text();
  } catch (err) {
    console.error('[salesAgentV3] Gemini chat execution failed:', err.message);
    const fb = v2.safeModelFailureFallback({ cart, customer });
    return {
      reply: fb,
      reply1: fb,
      reply2: 'NONE',
      reply3: 'NONE',
      sessionId: sid,
      engineSource: 'model_failure_fallback',
    };
  }

  // Automatic deterministic order creation if all fields are complete but tool call wasn't invoked
  if (!orderJustCreated && cart.length > 0 && customer.name && customer.phone && customer.address) {
    const gov = customer.governorate || matchGovernorateNameSync(customer.address) || 'القاهرة';
    customer.governorate = gov;
    const totals = calculateCartTotals(cart, gov);
    const snapshotResult = v2.computeCheckoutSnapshot({
      cart,
      subtotal: totals.subtotal,
      shipping: totals.shippingCost,
      discount: 0,
      total: totals.total,
      name: customer.name,
      phone: customer.phone,
      address: customer.address,
      governorate: gov,
    });
    const hashStr = (snapshotResult && typeof snapshotResult === 'object' && snapshotResult.hash)
      ? snapshotResult.hash
      : String(snapshotResult || '');
    const operationId = `op_${String(sid).replace(/[^a-zA-Z0-9_-]/g, '_')}_${hashStr.slice(0, 16) || Date.now()}`;
    const evalRun = /(^|:)eval-/.test(sid) || Boolean(_testAdapters && !_testAdapters.useRealRpc) || v2.isTestIsolationSession(sid);

    if (evalRun) {
      orderJustCreated = `EVAL-${Date.now().toString().slice(-6)}`;
      v2.recordSalesQualityMetric('order_confirmed', { orderNumber: orderJustCreated });
      cart = [];
    } else {
      try {
        const res = await v2.executeIdempotentOrderCreate({
          operationId,
          sid,
          createOrderFn: async () => {
            const orderItems = await expandCartItemsForOrder(cart);
            const isInternalTest = String(sid).startsWith('test:') || v2.isTestIsolationSession(sid);
            const orderPayload = {
              p_customer: {
                name: isInternalTest ? `[اختبار داخلي] ${customer.name}` : customer.name,
                phone: customer.phone,
                address: isInternalTest ? `${customer.address} [طلب تجريبي - لا تشحن]` : customer.address,
                city: gov,
              },
              p_items: orderItems,
              p_payment_method: 'cod',
              p_delivery_method: 'standard',
              p_subtotal: totals.subtotal,
              p_shipping_cost: totals.shippingCost,
              p_discount: 0,
              p_total: totals.total,
              p_governorate: gov,
              p_deposit_amount: 0,
              p_chat_session_id: sid,
              p_chat_channel: channel || 'web',
            };

            let dbRes;
            if (sbService) {
              dbRes = await sbService.rpc('create_chat_order_idempotent', {
                p_idempotency_key: operationId,
                ...orderPayload,
              });
            } else {
              dbRes = await sb.rpc('create_guest_order', orderPayload);
            }
            if (dbRes?.data) {
              const realOrderNumber = dbRes.data?.order?.order_number || dbRes.data?.order_number || `MON-${Date.now().toString().slice(-5)}`;
              return { order_number: realOrderNumber, idempotentReplay: Boolean(dbRes.data?.idempotent_replay) };
            }
            throw new Error(dbRes?.error?.message || 'DB create failed');
          }
        });
        if (res?.order_number) {
          orderJustCreated = res.order_number;
          v2.recordSalesQualityMetric('order_confirmed', { orderNumber: orderJustCreated });
          cart = [];
        }
      } catch (e) {
        console.error('[salesAgentV3] Auto order creation failed:', e.message);
      }
    }

    if (orderJustCreated) {
      const bName = (cart.find(i => i.isBundle)?.name) || (targetOffer?.name) || 'أوردر منتجات مونتانيا';
      const orderSummary =
        `تمام يا فندم 💜 تم تسجيل طلبك بنجاح برقم **${orderJustCreated}** 🎉\n\n` +
        `📦 **تفاصيل الأوردر:** ${bName}\n` +
        `💰 **الإجمالي:** ${totals.total} جنيه فقط (الشحن مجاني 🎁)\n` +
        `🤝 **طريقة الدفع:** 100% كاش عند الاستلام بعد المعاينة والتأكد من المنتجات\n` +
        `📍 **عنوان التوصيل المسجل:** ${customer.name} - ${customer.phone} - ${customer.address} (${customer.governorate})\n\n` +
        `فريق خدمة العملاء هيتواصل مع حضرتك تليفونياً لتأكيد موعد التسليم 💜`;

      if (!finalReplyText.includes(orderJustCreated) || /(?:ممكن\s*أطلب|الاسم\s*الكريم|رقم\s*الموبايل|العنوان\s*بالتفصيل)/.test(finalReplyText)) {
        finalReplyText = orderSummary;
      }
    }
  }

  // Step 5: Post-Generation Claim Sanitization & Policy Enforcement
  const sanitized = v2.verifyAndSanitizeSalesClaims(finalReplyText, {
    cart,
    activePromo: { active: false, percent: 0 },
  });
  finalReplyText = sanitized.text;

  // Suppress repeated greetings if this is an ongoing conversation
  if (isOngoingConversation) {
    finalReplyText = stripLeadingGreeting(finalReplyText);
  }

  // Step 6: Persist updated state to Supabase
  const newHistory = appendHistory(session.history || [], rawMsg, finalReplyText);

  const patch = {
    cart,
    history: newHistory,
    customerName: customer.name,
    customerPhone: customer.phone,
    selectedBundle: targetOffer?.key || session.selectedBundle || null,
    checkoutWizard: {
      details: customer,
      lastOrderNumber: orderJustCreated,
    },
    chatChannel: channel,
  };

  if (_testAdapters?.saveSession) {
    await _testAdapters.saveSession(sid, patch);
  } else {
    await rawSaveSession(sid, patch, sbService || sb).catch(e => console.error('[salesAgentV3] Save session failed:', e.message));
  }

  // Step 7: Split bubbles for ManyChat
  const cleanReply = finalReplyText.trim();
  let reply1 = cleanReply;
  let reply2 = 'NONE';
  let reply3 = 'NONE';

  if (cleanReply.length > 380) {
    const paras = cleanReply.split(/\n\s*\n+/).filter(Boolean);
    if (paras.length > 1) {
      reply1 = paras[0].trim();
      reply2 = paras.slice(1, 3).join('\n\n').trim() || 'NONE';
      if (paras.length > 3) {
        reply3 = paras.slice(3).join('\n\n').trim() || 'NONE';
      }
    }
  }

  return {
    reply: cleanReply,
    reply1,
    reply2,
    reply3,
    sessionId: sid,
    engineSource: 'gemini_agent_v3',
    order: orderJustCreated ? { order_number: orderJustCreated } : null,
    needsHuman: needsHumanFlag,
  };
}

module.exports = {
  handleInboundSalesMessage,
  SYSTEM_INSTRUCTION_V3,
  TOOL_DECLARATIONS,
  __setTestAdapters,
};
