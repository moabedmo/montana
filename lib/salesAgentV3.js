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
const { BUNDLES, getBundleByKey, allocateBundleUnitPrices, resolveBundleFromAdHints, resolveSelectedBundle, resolveBundleFromCustomerText, isRoutineDetailsOrUsageAsk, formatRoutineDetailsAndUsageReply } = require('./adOffers');
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
const { isOrderProblemComplaint, isOrderExchangeRequest, orderExchangeCsReply, orderIssueCsReply, CS_SUPPORT_PHONE, filterChatProducts, isChatExcludedProduct } = require('./orderContext');
const imageUnderstanding = require('./imageUnderstanding');
const {
  isBotPaused,
  isPauseExpired,
  stampBotPaused,
  stripPauseMarkers,
  wantsBotResume,
} = require('./botPause');

const PRODUCT_INFO_BY_SLUG = {
  'post-laser-cream': {
    name: 'كريم ما بعد الليزر والترميم (Montana Post Laser Cream)',
    slug: 'post-laser-cream',
    price: 369,
    routineKey: 'post-laser',
    routineName: 'عرض عناية ما بعد الليزر',
    routinePrice: 549,
    originalPrice: 618,
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
    price: 329,
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
تتحدثين باللهجة المصرية الراقية، الودودة، الذكية والمحترمة (يا فندم، حضرتك، 💜).

أهدافك الأساسية:
1. فهم استفسار العميل تماماً والإجابة المباشرة والواضحة على أسئلته أولاً قبل اقتراح أي منتج أو محاولة بيع.
2. الاستشارة الصادقة والأمانة التجميلية والطبية: ترشيح المنتجات المناسبة لنوع بشرته وحالته فقط، وتوضيح طريقة الاستخدام والمكونات بدقة.
3. عدم ادعاء أي فوائد غير حقيقية أو ضمانات مطلقة (لا تدّعي علاج أمراض جلدية مزمنة، ولا تقولي أبداً "مفيش أي تعارض خالص" أو "مضمون 100%").
4. تسجيل الأوردر بسلاسة وسرعة فور اكتمال بيانات التوصيل دون تعقيد أو طلب تأكيدات مكررة في الشات.

قواعد الأمانة التجميلية والطبية (خطوط حمراء):
- الالتزام الصارم بالأسعار والمنتجات المعتمدة فقط (ممنوع منعاً باتاً ذكر أو اختراع أو تخمين أي أسعار أو نسب خصم أو منتجات من دماغك نهائياً!):
  أ) المنتجات المنفردة الرسمية (إذا طلبت العميلة منتجاً مفرداً، التزمي بسعره المنفرد تماماً ولا تستبدليه بروتين مالم تطلب هي الروتين صراحة):
     • كريم التفتيح المركز (Montana Whitening Cream 50g) = 249 ج.
     • غسول التفتيح اليومي (Montana Whitening Cleanser 200ml) = 299 ج.
     • غسول علاج حب الشباب للوجه (Montana Acne Cleanser 200ml) = 329 ج.
     • لوشن اليدين والجسم 72h (Montana Hand & Body Lotion 200ml) = 229 ج.
     • كريم العناية بعد الليزر والترميم (Montana Post-Laser Cream 50g) = 369 ج.
     • جل السيليكون لعلاج الندبات (AntiScar Silicone Gel) = غير متوفر حالياً (أوت أوف ستوك).
  ب) عروض الروتينات الرسمية الجديدة (جميع عروض الروتينات تشمل شحن مجاني 100% 🎁):
     1. ثنائي تفتيح ونعومة الجسم: 449 ج (كريم التفتيح 249 + لوشن الجسم 229).
     2. ثنائي تفتيح الوجه والتصبغات: 499 ج (غسول التفتيح 299 + كريم التفتيح 249).
     3. ثنائي الحبوب وآثارها: 529 ج (غسول حب الشباب 329 + كريم التفتيح 249).
     4. ثنائي عناية ما بعد الليزر: 549 ج بدل 618 ج (كريم بعد الليزر 369 + كريم التفتيح 249).
     5. روتين نضارة الوجه وترطيب الجسم: 558 ج (غسول حب الشباب 329 + لوشن الجسم 229).
     6. روتين التفتيح الكامل VIP (3 قطع): 777 ج (غسول التفتيح 299 + كريم التفتيح 249 + لوشن الجسم 229).
  ج) قواعد الشحن والدفع الرسمية:
     • مصاريف الشحن: 50 ج للمنتجات المنفردة (قطعة أو قطعتين).
     • الشحن مجاني تماماً 🎁 على أي روتين كامل من العروض، أو أي أوردر يحتوي على 3 منتجات فأكثر!
     • الدفع: 100% كاش عند الاستلام بعد المعاينة وفتح الشحنة، بدون أي عربون أو دفع مسبق نهائياً.

- قواعد التعامل مع تصحيح العميل واعتراضاته وتعديل السلة:
  * إذا قالت العميلة "استني"، "غلط"، "أنا طالبة كذا بس"، "مش عايزة المجموعة"، "انت مش فاهم":
    - اعتذري بلباقة فوراً: «حقك عليا يا فندم وبعتذر لحضرتك جداً على أي لخبطة 💜».
    - اسمعي تصحيحها بالضبط: لو طلبت منتجاً مفرداً (مثل كريم التفتيح بـ 249 ج، أو 3 علب منه بـ 747 ج)، استدعي أداة update_cart لتعديل السلة فوراً بالمنتج والكمية المطلوبة بدقة.
    - ممنوع منعاً باتاً استدعاء أداة create_pending_order أو تأكيد الأوردر طالما العميلة تعترض أو تصحح، حتى ترى السعر الصحيح وتؤكد بنفسها تماماً!
  * إذا قالت العميلة "الغي الاوردر" أو "مش عايزة":
    - احترمي رغبتها فوراً بدون أي إلحاح: «تمام يا فندم، تم إلغاء الطلب تماماً ومفيش أي أوردر هيتشحن لحضرتك 💜 لو احتجتي أي مساعدة في أي وقت أنا تحت أمرك 🌸».
- مواصفات ومكونات الغسول: غسول التفتيح اليومي (Montana Whitening Cleanser) غسول لطيف جداً وخالي من السلفات القاسية (Sulfate-Free)، مناسب لمختلف أنواع البشرة بما فيها البشرة الحساسة، يحتوي على مستخلص العرقسوس والأربوتين وفيتامين سي. وغسول الحبوب يحتوي على حمض الساليسيليك وزيت شجرة الشاي. إذا سألت العميلة عن الغسول أثناء طلبها لروتين التفتيح، وضحّي لها فوراً أنه لطيف، خالي من السلفات القاسية، ومناسب للبشرة الحساسة.
- المكونات الفعالة لكل منتج (اشرحيها بوضوح واحترافية وأمانة عند سؤال العميل عن المكونات):
  • كريم التفتيح المركز: ألفا أربوتين (Alpha Arbutin)، مستخلص العرقسوس، نياسيناميد (Vitamin B3)، حمض اللاكتيك، فيتامين C، فيتامين E، أكسيد الزنك، زيت الورد. (تفتيح التصبغات، إزالة البقع وتوحيد اللون بدون تقشير قاسي).
  • غسول التفتيح: خلاصة العرقسوس، نياسيناميد (B3)، زنك PCA، فيتامين C، زيت شجرة الشاي، زيت جنين القمح، زيت اللوز. (تنظيف لطيف وإشراقة طبيعية وتوحيد اللون وتنقية المسام).
  • كريم بعد الليزر والترميم: زيت السمسم الطبيعي، بانثينول (Vitamin B5)، الألانتوين، شمع العسل، الألوفيرا، مستخلص الشاي الأخضر، النياسيناميد، فيتامين E، اللانولين. (تهدئة فورية للبشرة المتهيجة بعد الليزر أو إزالة الشعر وترميم حاجز الجلد ومنع التصبغات والالتهاب).
  • غسول حب الشباب الطبي: حمض الساليسيليك الطبي، زنك PCA، نياسيناميد (B3)، زيت شجرة الشاي، زيت الأرجان، زيت الجوجوبا. (تنقية عميقة للمسام وإذابة الدهون والرؤوس السوداء ومقاومة البكتيريا بدون جفاف).
  • لوشن اليدين والجسم 72h: زبدة الشيا، زبدة الكاكاو، زيت اللوز، زيت الجوجوبا، زيت جوز الهند، زيت الزيتون، فيتامين E، الجلسرين وشمع العسل. (ترطيب مخملي مكثف يدوم 72 ساعة).
- طريقة الاستخدام الطبية الصحيحة لكل روتين (اشرحيها بوضوح وبساطة واحترافية عند سؤال العميل عن طريقة الاستخدام أو تفاصيل الروتين):
  • ثنائي عناية ما بعد الليزر: أول 3 أيام بعد الجلسة يُستخدم كريم بعد الليزر فقط مرتين لـ 3 مرات يومياً على المنطقة لتهدئة البشرة وترميمها تماماً. ومن اليوم الرابع أو الخامس (بعد هدوء البشرة تماماً) نبدأ نستخدم كريم التفتيح مرة واحدة يومياً مساءً لمنع أي تصبغات وتفتيح وتوحيد لون البشرة.
  • ثنائي تفتيح ونعومة الجسم: لوشن الجسم يومياً بعد الشاور لترطيب وتنعيم الجسم بالكامل. كريم التفتيح مرة لمرتين يومياً على الأماكن المراد تفتيحها بالجسم أو المناطق الحساسة مع تدليك لطيف حتى الامتصاص.
  • ثنائي تفتيح الوجه والتصبغات: الغسول مرتين يومياً صباحاً ومساءً لغسل الوجه وتنظيف البشرة بلطف. كريم التفتيح مرة واحدة يومياً مساءً بعد تجفيف البشرة لتوحيد اللون وتفتيح التصبغات.
  • ثنائي الحبوب وآثارها: غسول حب الشباب الطبي مرتين يومياً صباحاً ومساءً لتنظيف الدهون والمسام. كريم التفتيح يوضع مساءً على آثار وبقع الحبوب لتفتيحها بعد هدوء الحبوب النشطة.
  • روتين نضارة الوجه وترطيب الجسم: غسول الوجه مرتين يومياً صباحاً ومساءً لغسل الوجه وتنظيف المسام والدهون. لوشن الجسم يومياً بعد الشاور لترطيب وتنعيم اليدين والجسم بالكامل.
  • روتين التفتيح الكامل VIP (3 قطع): الغسول صباحاً ومساءً لغسل الوجه. اللوشن يومياً للجسم بعد الشاور. كريم التفتيح مساءً للمناطق المراد تفتيحها (الوجه أو المناطق الحساسة).
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
- الحمل والرضاعة (خط أحمر طبي): ممنوع منعاً باتاً الجزم بأن أي منتج آمن تماماً أثناء الحمل أو الرضاعة أو قول «مفيش منه أي قلق على البيبي»! يجب دائماً نصيحة العميلة باستشارة طبيبها المختص أولاً قبل الاستخدام، مع عرض المكونات فقط لمراجعتها مع الطبيب.
- الأمراض الجلدية (ارتكاريا، إكزيما، صدفية، التهاب جلدي): وضّحي فوراً أن منتجات مونتانيا هي مستحضرات عناية تجميلية (Cosmetic) وليست علاجاً طبياً للأمراض الجلدية، وانصحيها بالرجوع لطبيب الجلدية المختص.
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
   - لو العميل سأل عن سعر الروتين ولم يعاود الرد أو أبدى تردداً أمام السعر (777 ج أو 549 ج):
     اقترحي عليه البدء بمنتج واحد أساسي ككورس تجربة مركّز:
     «لو حابة تبدأي خطوة بخطوة وتجربي النتيجة بنفسك الأول، تقدري تبدأي بـ (كريم التفتيح المركز) منفرد بسعر 249 ج بس، أو (كريم بعد الليزر) بسعر 369 ج، وتجربي النتيجة الأول 🌸 تحبي أجهزهولك؟».
4. التدرج الودود في طلب بيانات التوصيل (Friendly Detail Collection):
   - عندما يبدي العميل رغبة في الشراء، اطلبي البيانات بلطف وبدون لهجة استجوابية:
     «من عنينا يا فندم 💜 هجهزهولك فوراً، تحبي نشحنهولك على محافظة إيه والعنوان بالتفصيل؟ واسم ورقم موبايل حضرتك عشان المندوب يتواصل معاكي 🌸».

قواعد التحية واستمرارية المحادثة:
- التحية والترحيب («أهلاً بحضرتك»، «صباح الخير»، «نورتي مونتانيا») تقال حصرياً فقط في أول رسالة من المحادثة!
- بمجرد بدء المحادثة وتتابع الردود، ممنوع منعاً باتاً تكرار التحية أو البدء بـ «أهلاً بحضرتك» في كل رسالة؛ ادخلي فوراً وبشكل طبيعي في صلب الرد على كلام العميل بدون ديباجة ترحيب مكررة.

قواعد التعامل الذكي مع اعتراضات الأسعار («غالي»، «المنتج غالي»، «غالي أوي»، «السعر كتير»):
- ممنوع منعاً باتاً أن تسألي العميل بجهل واستنكار: «أنهي منتج؟» أو «قصدك على إيه؟»! افهمي فوراً المنتج أو الروتين الذي يعترض عليه من سياق المحادثة أو العرض القادم منه (سواء روتين التفتيح 777 ج أو روتين بعد الليزر 549 ج أو غيره).
- تعاملي بذكاء ولباقة مصرية راقية («مقدّرة رأي حضرتك تماماً يا فندم 💜»، «حقك طبعاً يا فندم»).
- اشرحي القيمة الحقيقية للمنتج/الروتين:
  * روتين التفتيح (777 ج): كورس متكامل من 3 منتجات بأحجام كبيرة (غسول 200 مل، لوشن 200 مل، كريم 50 مل) يكفي من شهرين لـ 3 شهور استخدام يومي، ومعاه شحن مجاني، وخامات مرخصة وآمنة بمستخلصات طبيعية لطيفة، ومعاينة كاش عند الاستلام.
- اعرضي دائماً البديل الاقتصادي المناسب من الكتالوج المعتمد إذا رغب العميل في تقليل التكلفة أو تجربة منتج واحد أولاً:
  * اقترحي البدء بـ «كريم التفتيح لوحده بـ 249 ج» كحل مركّز للتفتيح، أو «غسول التفتيح بـ 299 ج».
  * ممنوع تماماً اختراع خصومات وهمية، أو نسب تخفيض غير معتمدة، أو ادعاءات غير حقيقية.

قواعد الشحن والدفع:
- الدفع: 100% كاش عند الاستلام بعد المعاينة، بدون أي عربون أو دفع مسبق نهائياً.
- الشحن: متاح لكل محافظات مصر (القاهرة، الجيزة، الإسكندرية، الدلتا، الصعيد، القناة)، ومدة التوصيل عادة 2-3 أيام عمل ويتم التأكيد هاتفياً.
- مصاريف الشحن: 50 جنيه لمعظم المحافظات. الشحن مجاني تماماً عند طلب أي روتين كامل أو أي 3 منتجات.

قواعد التعامل مع السلة والأوردر:
- ممنوع نهائياً استخدام كلمة «ألف سلامة» إلا إذا ذكرت العميلة صراحة أنها مريضة، أو تعاني من حروق أو جروح أو ألم صحي شديد! ممنوع تماماً قول «ألف سلامة» عند البيع أو عند الاعتذار أو عند إضافة منتج للسلة.
- ممنوع منعاً باتاً ذكر أي أخطاء برمجية أو تقنية للعميل، مثل «فيه مشكلة في اسم الروتين اللي دخلته» أو «عشان أضيفه للسلة»! السلة والأدوات شأن داخلي بحت لا يراه العميل، وإذا طلبت العميلة روتيناً أو عرضاً أضيفيه للسلة فوراً واطلبي بيانات الشحن.
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
      description: 'يرجع عروض الروتين المتكاملة الحالية في مونتانيا (روتين التفتيح الكامل 777 ج، روتين بعد الليزر 549 ج، روتين الوش والجسم 558 ج) مع تفاصيل مكوناتها وميزة الشحن المجاني.',
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

  // 1. Order complaints & problem inquiries -> straight to human support (pause bot)
  if (isOrderProblemComplaint(t)) {
    return {
      reply: `حقك علينا يا فندم وبعتذر لحضرتك جداً 💜\nلمتابعة مشكلة أو تأخير الأوردر فوراً، فريق خدمة العملاء متاح لمساعدتك تليفونياً على رقم: **${CS_SUPPORT_PHONE}** ومتابعة شحنتك لحلها في أسرع وقت.`,
      needsHuman: true,
      pauseBot: true,
      engineSource: 'deterministic_safety',
    };
  }

  // 1b. Order exchange / wrong item ordered yesterday -> straight to human support (pause bot)
  if (isOrderExchangeRequest(t)) {
    return {
      reply: orderExchangeCsReply(),
      needsHuman: true,
      pauseBot: true,
      engineSource: 'deterministic_order_exchange',
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

  // 4. Job / UGC creator / modeling / collaboration inquiries
  const isJobOrUgcInquiry = /(?:شغل|وظيفة|وظا[يئ]ف|توظيف|أشتغل|اشتغل|موديل|موديلز|موديلنج|ugc|يو\s*جي\s*سي|كولاب|كولابريشن|collaboration|صانع[ةه]\s*محتو[يى]|صناع\s*محتو[يى]|content\s*creator|بلوجر|انفلونسر|انفلونسرز|pr\s*package|بارتر|اعملكم\s*فيديو|أعملكم\s*فيديو|فيديوهات|اعلانات\s*معاكم)/i.test(t)
    && !/(شغال|شغالة|بيشتغل|طريقة|استخدام|ازاي)/i.test(t);
  if (isJobOrUgcInquiry) {
    return {
      reply: `أهلاً بحضرتك يا فندم 💜\nالشات هنا مخصص حصرياً لطلبات الشراء واستشارات العناية بالبشرة لعملاء مونتانيا.\nلأي استفسارات خاصة بالتوظيف أو التعاون التسويقي وصناع المحتوى (UGC / PR)، يرجى إرسال السيرة الذاتية وسابقة الأعمال على إيميل الإدارة:\n📧 info@montana.com.eg\nوسيتم مراجعتها من الفريق المختص في حال توفر شواغر مناسبة 🌸`,
      engineSource: 'deterministic_job_ugc_filter',
    };
  }

  // 5. Order cancellation / decline / walk away
  if (isCancelCurrentOrderAsk(t) || isWalkAwayDecline(t)) {
    return {
      reply: 'تمام يا فندم 💜 تم إلغاء الطلب وتفريغ السلة بالكامل، ومفيش أي أوردر هيتشحن لحضرتك 🌸 لو احتجتي أي استفسار أو مساعدة في أي وقت، أنا تحت أمرك دايماً.',
      engineSource: 'deterministic_order_cancel',
      clearCart: true,
      cancelOrder: true,
    };
  }

  return null;
}

function isCancelCurrentOrderAsk(message) {
  const t = String(message || '').trim();
  if (!t || t.length > 120) return false;
  return /(الغي|ألغي|الغى|الغاء|إلغاء|كنسل|cancel)\s*(ال)?(اوردر|أوردر|طلب|order|الشراء|التسجيل)?/i.test(t)
    || /(عا[ييو]ز[اهة]?|محتاج[اهة]?)\s*(الغي|ألغي|الغاء|إلغاء|كنسل)/i.test(t)
    || /(مش\s*عا[ييو]ز[اهة]?)\s*(ال)?(اوردر|أوردر|طلب|أكمل|اكمل|نكمل|العرض)/i.test(t)
    || /(امسح|افضي|فضي|شيلي?|لغ[يى])\s*(ال)?(اوردر|أوردر|طلب)/i.test(t)
    || /^(الغاء|إلغاء|الغي|ألغي|كنسل|cancel)[\s!.،؟?]*$/i.test(t);
}

function isWalkAwayDecline(message) {
  const t = String(message || '').trim();
  if (!t || t.length > 160) return false;
  if (/^(لا|لأ|لا\s*والله)\s*(شكرا+|متشكر[ةه]?|خلاص|كتر\s*خيرك|تسلم(ي|يلي)?|مش\s*عا[ييو]ز[اهة]?|مش\s*ه?ينفع)(\s*يا\s*فندم|\s*جدا|\s*حبيبتي|\s*شكرا)*[\s!.،؟?]*$/i.test(t)) {
    return true;
  }
  if (/^(شكرا+|متشكر[ةه]?)\s*(مش\s*عا[ييو]ز[اهة]?|خلاص|مش\s*ه?ينفع|مش\s*دلوقت[يى]?)[\s!.،؟?]*$/i.test(t)) {
    return true;
  }
  if (/^(لا|لأ)\s*خلاص[\s!.،؟?]*$/i.test(t)) {
    return true;
  }
  if (/(مش\s*ه?ينفع\s*(أ?طلب|اطلب)|مش\s*هطلب|مش\s*هقدر\s*(أ?طلب|اطلب)|مش\s*عا[ييو]ز[اهة]?\s*(أ?طلب|اطلب|اوردر|أوردر))/i.test(t)) {
    return true;
  }
  return false;
}

function looksLikePersonName(message) {
  const name = String(message || '').trim().replace(/\s+/g, ' ');
  if (name.length < 3 || name.length > 50) return false;
  if (/^(1|2|١|٢)$/.test(name)) return false;
  if (/[?؟0-9]/.test(name)) return false;
  if (/(سعر|بكام|كام|شحن|توصيل|عرض|روتين|كريم|غسول|لوشن|ليزر|غالي|شكرا|فين|معلش|عايز|عاوز|طلب|اوردر|أوردر|الغي|cancel)/i.test(name)) return false;
  const words = name.split(' ').filter(Boolean);
  return words.length >= 1 && words.length <= 4;
}

function isCustomerObjectionOrCorrection(text) {
  const t = String(text || '').trim();
  if (!t) return false;
  return /(?:غلط|انت غلط|مش فاهم|مش ده|مش دا|مش ده الاوردر|لاء لاء|لا غلط|استني|استنى|وقف|ثانية|لحظة|اية السعر|ايه السعر|ليه السعر|ليه كدا|ليه كده|مش الكريم|مش ب\s*\d+|مطلبتش|ماطلبتش|مش عايز[ةه]?\s*المجموع|مش عايز[ةه]?\s*الروتين|بس|لوحده|فقط|الغي|ألغي|كنسل)/i.test(t);
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
  // Human takeover / Meta Page Inbox agent response in message text
  const isHumanTakeoverMsg = /(?:تم\s*الإرسال\s*بواسطة|تم\s*تسجيل\s*(?:ال)?(?:اوردر|أوردر)|سجلتلك\s*(?:ال)?(?:اوردر|أوردر)|سجلنا\s*(?:ال)?(?:اوردر|أوردر)|الاوردر\s*اتسجل|معاك[يى]?\s*خدمة\s*العملاء)/i.test(String(message || ''));
  if (isHumanTakeoverMsg) {
    const rawSession = _testAdapters?.loadSession
      ? await _testAdapters.loadSession(sid)
      : await rawLoadSession(sid, sbService || sb).catch(() => null);
    const hist = stampBotPaused(rawSession?.history || chatHistory || []);
    const saveFn = _testAdapters?.saveSession || rawSaveSession;
    await saveFn(sid, { ...(rawSession || {}), cart: [], history: hist }, sbService || sb).catch(() => {});
    if (sbService) {
      await sbService.rpc('mark_cart_reminder_sent', { p_session_id: sid }).catch(() => {});
      await sbService.from('chat_bot_sessions').update({ cart_json: [] }).eq('session_id', sid).catch(() => {});
    }
    return { reply: '', reply1: 'NONE', reply2: 'NONE', reply3: 'NONE', botPaused: true, needsHuman: true };
  }

  // If bot is paused for this session, return silence
  if (pauseBot) {
    return { reply: '', reply1: 'NONE', reply2: 'NONE', reply3: 'NONE', botPaused: true };
  }

  // Step 2: Load persistent session state
  const rawSession = _testAdapters?.loadSession
    ? await _testAdapters.loadSession(sid)
    : await rawLoadSession(sid, sbService || sb).catch(() => null);
  const session = rawSession || {};
  let currentHistory = session.history || chatHistory || [];

  if (wantsBotResume(message)) {
    currentHistory = stripPauseMarkers(currentHistory);
    const saveFn = _testAdapters?.saveSession || rawSaveSession;
    await saveFn(sid, { ...session, history: currentHistory }, sbService || sb).catch(() => {});
  } else if (isPauseExpired(currentHistory)) {
    currentHistory = stripPauseMarkers(currentHistory);
  } else if (isBotPaused(currentHistory)) {
    return { reply: '', reply1: 'NONE', reply2: 'NONE', reply3: 'NONE', botPaused: true, sessionId: sid };
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
    if (safetyOverride.clearCart) {
      const patch = {
        cart: [],
        checkoutWizard: null,
      };
      if (_testAdapters?.saveSession) {
        await _testAdapters.saveSession(sid, patch);
      } else {
        await rawSaveSession(sid, patch, sbService || sb).catch(e => console.error('[salesAgentV3] Cancel clear session failed:', e.message));
      }
      // If there was an order just placed in this session, mark cancelled in DB
      const recentOrderNum = session.checkoutWizard?.lastOrderNumber;
      if (recentOrderNum && sbService) {
        sbService
          .from('orders')
          .update({ status: 'cancelled' })
          .eq('order_number', recentOrderNum)
          .then(() => console.log(`[salesAgentV3] Order ${recentOrderNum} marked as cancelled by customer`))
          .catch(e => console.warn('[salesAgentV3] Order cancel update failed:', e.message));
      }
    }
    if (safetyOverride.pauseBot) {
      const pausedHist = stampBotPaused(appendHistory(currentHistory, String(message || '').trim(), safetyOverride.reply));
      const saveFn = _testAdapters?.saveSession || rawSaveSession;
      await saveFn(sid, { ...session, history: pausedHist }, sbService || sb).catch(() => {});
    }
    return {
      ...safetyOverride,
      sessionId: sid,
      reply1: safetyOverride.reply,
      reply2: 'NONE',
      reply3: 'NONE',
    };
  }

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
    const hasLaserHint = /(?:ليزر|laser|ما\s*بعد\s*الليزر|بوست\s*ليزر|618|٦١٨|549|٥٤٩)/i.test(historyText) || imageProductSlug === 'post-laser-cream';
    const hasBodyDuoHint = /(?:تفتيح\s*(?:ونعوم[ةه]\s*)?الجسم|449|٤٤٩)/i.test(historyText);
    const hasFaceDuoHint = /(?:تفتيح\s*(?:الوجه|الوش)|499|٤٩٩)/i.test(historyText);
    const hasClearSkinHint = /(?:ثنائي\s*الحبوب|الحبوب\s*وآثار|529|٥٢٩)/i.test(historyText);
    const hasFaceBodyHint = /(?:نضار[ةه]|المسام|558|٥٥٨)/i.test(historyText);
    if (hasLaserHint) {
      targetOffer = getBundleByKey('post-laser');
    } else if (hasBodyDuoHint) {
      targetOffer = getBundleByKey('body-brightening');
    } else if (hasFaceDuoHint) {
      targetOffer = getBundleByKey('face-brightening');
    } else if (hasClearSkinHint) {
      targetOffer = getBundleByKey('clear-skin');
    } else if (hasFaceBodyHint) {
      targetOffer = getBundleByKey('face-body');
    } else if (/(?:روتين\s*التفتيح\s*الكامل|الـ?\s*3\s*قطع|777|٧٧٧)/i.test(historyText)) {
      targetOffer = getBundleByKey('brightening');
    } else if (/(?:تفتيح|تبييض|بقع|تصبغ)/i.test(historyText)) {
      targetOffer = getBundleByKey('face-brightening');
    }
  }

  // Only track into session cart if customer explicitly expressed a pure order intent without questions
  const hasQuestionWord = /(?:إيه|ايه|ليه|بكام|كام|سعر|ازاي|إزاي|شغال|مكونات|حوامل|مناسب|نتيجة|نتائج|تفاصيل|أستفسر|استفسار|تعارض|\?|؟|how\s*much|price|cost|what|when|where|is\s*it|can\s*i|details)/i.test(rawMsg);
  const isPureOrderIntent = /(?:أنا\s*(?:عاوزة|عايزة|عاوز|عايز)\s*أطلب|(?:عاوزة|عايزة|عاوز|عايز)\s*أطلب|م?ممكن\s*(?:أطلب|اطلب)|اطلبلي|سجل[يى]لي?\s*أوردر|احجز[يى]لي?|هات[يى]لي?\s*العرض|أطلب\s*العرض|محتاج[اهة]|عايز[اهة]|عاوز[اهة]|حاب[ةب][هة]?\s*(?:أطلب|اطلب)|ابعت[يى]ه?|ابعتول[يى]|تمام\s*(?:الروتين|العرض|\d+|٦١٨|777|٧٧٧|558|٥٥٨)?|اعتمد[يى]?\s*(?:الأوردر|الطلب)?|أكد[يى]?\s*(?:الأوردر|الطلب)?)/i.test(rawMsg);

  if (targetOffer && !cart.length && isPureOrderIntent && !hasQuestionWord) {
    // Only auto-add the bundle if customer explicitly named the bundle/routine/offer.
    // If customer mentions a single product (كريم, غسول, لوشن) without bundle keywords, let Gemini handle it.
    const mentionsSingleProduct = /(كريم(?!\s*(بعد|ما بعد))|غسول|لوشن|cream|cleanser|lotion)/i.test(rawMsg)
      && !/(روتين|عرض|ثنائي|باندل|bundle|مجموع|كورس|3\s*قطع|الكامل|vip)/i.test(rawMsg);
    if (!mentionsSingleProduct) {
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
  }

  // Automatic extraction helper to guarantee customer details are captured into state
  let parseVolunteeredDeliveryDetails, looksLikeVolunteeredDeliveryDetails, isUsableDeliveryAddress;
  try {
    const ce = require('./chatEngine');
    parseVolunteeredDeliveryDetails = ce.parseVolunteeredDeliveryDetails;
    looksLikeVolunteeredDeliveryDetails = ce.looksLikeVolunteeredDeliveryDetails;
    isUsableDeliveryAddress = ce.isUsableDeliveryAddress;
    if (looksLikeVolunteeredDeliveryDetails && looksLikeVolunteeredDeliveryDetails(rawMsg)) {
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
  if (phoneCandidate) {
    customer.phone = phoneCandidate;
  }
  const nameCandidateMatch = rawMsg.match(/^(?:أنا|اسمي|الاسم(?:\s*:)?)\s+([^\d\n\r,،.!؟?]{2,30})$/i);
  if (nameCandidateMatch) {
    const candidate = nameCandidateMatch[1].trim();
    if (!/(عايز|عاوز|بكام|سعر|روتين|كريم|غسول|لوشن|ليزر|غالي)/i.test(candidate)) {
      customer.name = candidate;
    }
  } else if (!customer.name && looksLikePersonName(rawMsg) && !isCustomerObjectionOrCorrection(rawMsg)) {
    customer.name = rawMsg.trim().replace(/\s+/g, ' ');
  }

  const govCandidate = matchGovernorateNameSync(rawMsg);
  if (govCandidate && !/(سعر|بكام|شحن|كام)/i.test(rawMsg)) {
    customer.governorate = govCandidate;
    if (!customer.address || customer.address.length < 5) {
      customer.address = govCandidate;
    } else if (!customer.address.includes(govCandidate)) {
      customer.address = `${customer.address} (${govCandidate})`;
    }
  }

  if (/^(?:العنوان|عنواني|عنوان\s*التوصيل)(?:\s*:)?\s+(.+)$/i.test(rawMsg) && !/[?؟]/.test(rawMsg)) {
    const addr = rawMsg.replace(/^(?:العنوان|عنواني|عنوان\s*التوصيل)(?:\s*:)?\s+/i, '').trim();
    if (addr.length >= 5) {
      customer.address = addr;
      customer.governorate = matchGovernorateNameSync(addr) || customer.governorate || 'القاهرة';
    }
  }

  // NOTE: Auto-populating cart with targetOffer on delivery details volunteered REMOVED.
  // Gemini alone decides what goes into the cart via update_cart tool call.

  // Specific routine details or usage inquiry (e.g. "ممكن تفاصيل وطريقة استخدام روتين ما بعد الليزر؟")
  const explicitTextBundle = resolveBundleFromCustomerText(rawMsg);
  if (explicitTextBundle) {
    targetOffer = explicitTextBundle;
  }
  const routineForDetails = explicitTextBundle || targetOffer;
  if (routineForDetails && isRoutineDetailsOrUsageAsk(rawMsg)) {
    const routineDetailsReply = formatRoutineDetailsAndUsageReply(routineForDetails.key);
    if (routineDetailsReply) {
      return {
        reply: routineDetailsReply,
        reply1: routineDetailsReply,
        reply2: 'NONE',
        reply3: 'NONE',
        sessionId: sid,
        engineSource: 'v3_routine_details_and_usage',
      };
    }
  }

  // Customer sending closing courtesy / gratitude after order confirmation or human handover
  const isPostOrderCourtesyOrGratitude = (m) => {
    const t = String(m || '').replace(/[^\u0621-\u064A\s]/g, ' ').replace(/\s+/g, ' ').trim();
    if (!t || t.length > 50) return false;
    return /^(تمام\s*)?(تسلم[يى]|تسلميل[يى]|شكرا|شكراً|فى\s*انتظاره|في\s*انتظاره|مستنيا[هة]|مستنيين|الله\s*يسلمك|ربنا\s*يخليك[يى]?|تسلم\s*ايدك|ميرسي|الف\s*شكر|جزاكم\s*الله\s*خيرا?|بالانتظار|منتظرا[هة]|باذن\s*الله)(\s*(يارب|يا\s*رب|يا\s*فندم|يافندم|حبيبتي|يا\s*قمر))?[\s!.،؟?]*$/i.test(t);
  };
  if (isPostOrderCourtesyOrGratitude(rawMsg)) {
    const thankReply = 'العفو يا فندم، أنا تحت أمرك دايماً 💜 وبإذن الله يوصلك في أسرع وقت وتنورينا دايماً في مونتانيا 🌸';
    return {
      reply: thankReply,
      reply1: thankReply,
      reply2: 'NONE',
      reply3: 'NONE',
      sessionId: sid,
      engineSource: 'v3_courtesy_handler',
    };
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
        `${SITE_URL}/bundle/post-laser-glow\n\n` +
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
        `${SITE_URL}/bundle/face-and-body\n\n` +
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

  if (isCustomerObjectionOrCorrection(rawMsg)) {
    turnContext += `\n- تنبيه حاسم لاعتراض أو تصحيح العميل («${rawMsg}»):
العميل يعترض على الأوردر السابق أو يصحح خطأ في المنتجات أو السعر أو الكمية!
تعليمات إلزامية:
1. اعتذري للعميل فوراً بلباقة مصرية شديدة («حقك عليا يا فندم وبعتذر لحضرتك جداً على أي لخبطة 💜»).
2. افهمي طلب العميل بدقة: لو طلب منتجاً مفرداً فقط (مثل «كريم التفتيح بس بـ 249 ج» أو «3 علب منه بـ 747 ج بالشحن المجاني») فاستدعي أداة update_cart لتعديل السلة فوراً.
3. ممنوع منعاً باتاً استدعاء أداة create_pending_order أثناء اعتراض العميل حتى يتأكد من السعر والمنتجات تماماً!`;
  } else if (customer.name && customer.phone && customer.address) {
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
    if (isRoutineDetailsOrUsageAsk(rawMsg)) {
      turnContext += `\n- توجيه خاص ومحدد لاستفسار تفاصيل واستخدام الروتين («${targetOffer.name}»):
العميل يسأل تحديداً عن تفاصيل أو طريقة استخدام أو مكونات «${targetOffer.name}» (سعره ${targetOffer.bundlePrice} ج مع شحن مجاني 🎁 والدفع 100% كاش عند الاستلام بعد المعاينة).
تعليمات الإجابة:
1. وضحي محتويات الروتين (${targetOffer.productLabels.join(' + ')}) بأحجامها الكبيرة.
2. اشرحي خطوات طريقة الاستخدام الطبية الصحيحة بدقة وأمانة وفق تعليماتك الطبية المحددة في البرومبت.
3. اذكري السعر (${targetOffer.bundlePrice} ج بدل ${targetOffer.listTotal} ج) وميزة الشحن المجاني والمعاينة كاش عند الاستلام بدون أي عربون.
4. اختمي بسؤال بيعي لطيف يشجع العميل على تجهيز الأوردر والاستفادة من الشحن المجاني.`;
    }
  } else if (isPriceInquiry) {
    turnContext += `\n- تنبيه حاسم: العميل يسأل عن السعر («${rawMsg}») بدون تحديد منتج أو روتين معين.
ممنوع منعاً باتاً تسألي «بكم إيه بالظبط؟» أو تطلبي منه يوضح قبل ما تردي!
اعرضي فوراً وبشكل مرتب بدون نجوم (*) عروض الروتينات الرسمية الجديدة كلها بشحن مجاني 🎁:
1. ثنائي تفتيح ونعومة الجسم: 449 ج (كريم التفتيح + لوشن الجسم)
2. ثنائي تفتيح الوجه والتصبغات: 499 ج (غسول التفتيح + كريم التفتيح)
3. ثنائي الحبوب وآثارها: 529 ج (غسول حب الشباب + كريم التفتيح)
4. ثنائي عناية ما بعد الليزر: 549 ج بدل 618 ج (كريم بعد الليزر + كريم التفتيح)
5. روتين نضارة الوجه وترطيب الجسم: 558 ج (غسول حب الشباب + لوشن الجسم)
6. روتين التفتيح الكامل VIP (3 قطع): 777 ج (غسول التفتيح + كريم التفتيح + لوشن الجسم)
وبعدها اسأليها بلطف إيه المشكلة اللي حابة نركز عليها عشان نرشحلها الأنسب.`;
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
تعاملي بلباقة وتفهم مصري راقٍ («مقدّرة رأي حضرتك تماماً يا فندم 💜»)، واشرحي القيمة الحقيقية للروتين (كورس متكامل من 3 عبوات بأحجام كبيرة 200 مل و200 مل و50 مل يكفي 2 إلى 3 شهور استخدام يومي، وشحن مجاني ومعاينة كاش عند الاستلام)، ثم اعرضي البديل الاقتصادي للبدء بمنتج واحد فقط من الكتالوج (كريم التفتيح بـ 249 ج أو غسول التفتيح بـ 299 ج) لتجربة النتيجة أولاً دون إحراج.`;
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
              original_price: b.listTotal,
              products: b.productLabels,
              shipping: 'مجاني تماماً 🎁',
              purpose: b.key === 'brightening'
                ? 'تفتيح وتوحيد لون الوجه والمناطق الحساسة وترطيب الجسم بالكامل'
                : b.key === 'post-laser'
                ? 'تهدئة وترميم البشرة بعد جلسات الليزر وإزالة الشعر ومنع التصبغات'
                : b.key === 'body-brightening'
                ? 'تفتيح وتوحيد لون الجسم والأماكن الحساسة وترطيب عميق يدوم 72 ساعة'
                : b.key === 'face-brightening'
                ? 'تنظيف مسام الوجه وتفتيح التصبغات وتوحيد لون البشرة'
                : b.key === 'clear-skin'
                ? 'تنقية المسام ومقاومة حب الشباب وتفتيح الآثار والبقع'
                : 'نضارة الوجه وتنقية المسام مع ترطيب وتنعيم الجسم 72 ساعة',
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
            const isExplicitBundleAsk = /(عرض|روتين|باندل|offer|bundle|routine|كورس|مجموع|سيت|ثنائي|تلات|3 قطع|كامل|vip)/i.test(target);
            const isSingleProductAsk = /(كريم|غسول|لوشن|cream|cleanser|lotion|قطعة|علبة|واحدة|واحد)/i.test(target) && !isExplicitBundleAsk;

            // If customer explicitly wants single products or says "كريم التفتيح بس", clear any conflicting bundle first
            if (isSingleProductAsk || /(بس|فقط|لوحده|مش المجموعة|مش الروتين)/i.test(rawMsg)) {
              cart = cart.filter(item => !item.isBundle);
            }

            let matchedBundle = null;
            if (!isSingleProductAsk) {
              matchedBundle = getBundleByKey(target) || resolveBundleFromCustomerText(target);
              if (!matchedBundle) {
                if (target.includes('vip') || target.includes('3 قطع') || target.includes('كامل') || target.includes('777')) {
                  matchedBundle = getBundleByKey('brightening');
                } else if (target.includes('laser') || target.includes('ليزر') || target.includes('549')) {
                  matchedBundle = getBundleByKey('post-laser');
                } else if ((target.includes('جسم') && target.includes('تفتيح')) || target.includes('449') || target.includes('body-brightening')) {
                  matchedBundle = getBundleByKey('body-brightening');
                } else if ((target.includes('وجه') && target.includes('تفتيح')) || (target.includes('وش') && target.includes('تفتيح')) || target.includes('499') || target.includes('face-brightening')) {
                  matchedBundle = getBundleByKey('face-brightening');
                } else if (target.includes('حبوب') || target.includes('آثار') || target.includes('اثار') || target.includes('529') || target.includes('clear-skin')) {
                  matchedBundle = getBundleByKey('clear-skin');
                } else if (target.includes('نضار') || target.includes('558') || (target.includes('وش') && target.includes('جسم'))) {
                  matchedBundle = getBundleByKey('face-body');
                } else if (isExplicitBundleAsk && (target.includes('bright') || target.includes('تفتيح'))) {
                  matchedBundle = getBundleByKey('brightening');
                } else if (/(عرض|روتين|باندل|offer|bundle|routine|all|كله|الاتنين|التلاتة|التلاته)/i.test(target) && targetOffer) {
                  matchedBundle = targetOffer;
                }
              }
            }

            // Fallback to active targetOffer if still not matched and customer asked for the offer
            if (!matchedBundle && !isSingleProductAsk && targetOffer && (target.length < 3 || /(عرض|روتين|نعم|اه|ايوه|عاوزه|عاوزاه|موافق|اوك|تمام)/i.test(target))) {
              matchedBundle = targetOffer;
            }

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
                if (target.includes('حبوب') || target.includes('حب الشباب')) return s.includes('acne') || n.includes('حب الشباب');
                if (target.includes('clean') || target.includes('غسول')) return s.includes('whitening-cleanser') || (s.includes('cleanser') && !s.includes('acne')) || n.includes('غسول التفتيح');
                if (target.includes('laser') || target.includes('ليزر') || target.includes('تقشير')) return s.includes('laser') || n.includes('ليزر');
                if (target.includes('cream') || target.includes('كريم')) return s.includes('whitening-cream') || (s.includes('cream') && !s.includes('laser')) || n.includes('كريم التفتيح');
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
                toolResult = { success: true, added: prod.name, price: prod.price, qty, cart: formatCartSummary(cart, customer) };
              } else if (targetOffer && !isSingleProductAsk) {
                cart.push({
                  id: `bundle:${targetOffer.key}`,
                  bundleKey: targetOffer.key,
                  name: targetOffer.name,
                  price: targetOffer.bundlePrice,
                  qty,
                  isBundle: true,
                  productSlugs: targetOffer.productSlugs,
                });
                toolResult = { success: true, added: targetOffer.name, price: targetOffer.bundlePrice, cart: formatCartSummary(cart, customer) };
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

          toolResult = {
            success: true,
            currentCustomerDetails: customer,
            cart: formatCartSummary(cart, customer),
            isReadyToCreateOrder: !!(cart.length && customer.name && customer.phone && customer.address),
          };
        } else if (name === 'create_pending_order') {
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

  // NOTE: Auto-order fallback REMOVED — Gemini is the sole authority for order creation via create_pending_order tool.
  // No procedural code will ever override Gemini's reply text or force-create orders.

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
  let newHistory = appendHistory(session.history || [], rawMsg, finalReplyText);
  if (needsHumanFlag) {
    newHistory = stampBotPaused(newHistory);
  }

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
  let cleanReply = finalReplyText.trim();
  const hasMedicalPainContext = /(حرق|حروق|تعبان|مريض|الم|ألم|وجع|التهاب\s*شديد|صديد|نزيف|عملية|جرح)/i.test(String(rawMsg||'') + ' ' + (Array.isArray(chatHistory) ? chatHistory : []).slice(-8).map(h => (h && h.text) || '').join(' '));
  if (!hasMedicalPainContext) {
    cleanReply = cleanReply
      .replace(/ألف\s*سلامة\s*(?:يا\s*فندم|عل[يى]ك[يي]?)?[،,.\s]*/gi, '')
      .replace(/الف\s*سلامة\s*(?:يا\s*فندم|عل[يى]ك[يي]?)?[،,.\s]*/gi, '');
  }
  cleanReply = cleanReply
    .replace(/يبدو\s*إن\s*فيه\s*مشكلة\s*بسيطة\s*في\s*اسم\s*الروتين\s*اللي\s*دخلته[،,.\s]*/gi, '')
    .replace(/عشان\s*أقدر\s*أضيفه\s*للسلة\s*بشكل\s*صحيح\s*/gi, '')
    .trim();
  if (!cleanReply) {
    cleanReply = 'تحت أمرك يا فندم 💜 لو محتاجة أي مساعدة أو تفاصيل إضافية أنا معاكي 🌸';
  }
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
