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
const { BUNDLES, getBundleByKey, allocateBundleUnitPrices } = require('./adOffers');
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
     * غسول التفتيح اليومي (Montana Whitening Cleanser) 200 مل (سعره منفرد 249 ج).
     * كريم التفتيح (Montana Whitening Cream) 50 مل (سعره منفرد 369 ج).
     * لوشن اليدين والجسم (Montana Hand & Body Lotion) 250 مل (سعره منفرد 289 ج).
     (تنبيه حاسم: مونتانيا لا تمتلك كريم ليلي ونهاري منفصلين؛ هو كريم تفتيح واحد متكامل للوجه والرقبة والمناطق الحساسة).
  2. روتين بعد الليزر والنضارة (سعره 618 ج والشحن مجاني): يتكون حصرياً من منتجين:
     * كريم بعد الليزر (Montana Post-Laser Cream) 60 جم (سعره منفرد 249 ج).
     * كريم التفتيح (Montana Whitening Cream) 50 مل (سعره منفرد 369 ج).
  3. روتين الوش والجسم (سعره 558 ج والشحن مجاني): يتكون حصرياً من منتجين:
     * غسول حب الشباب للبشرة الدهنية (Montana Acne Facial Cleanser) 200 مل (سعره منفرد 269 ج).
     * لوشن اليدين والجسم (Montana Hand & Body Lotion) 250 مل (سعره منفرد 289 ج).
  4. المنتجات الفردية:
     * كريم التفتيح: 369 ج.
     * غسول التفتيح: 249 ج.
     * لوشن اليدين والجسم: 289 ج.
     * كريم بعد الليزر: 249 ج.
     * غسول حب الشباب: 269 ج.
- مواصفات ومكونات الغسول: غسول التفتيح اليومي (Montana Whitening Cleanser) غسول لطيف جداً وخالي من السلفات القاسية (Sulfate-Free)، مناسب لمختلف أنواع البشرة بما فيها البشرة الحساسة، يحتوي على مستخلص العرقسوس والأربوتين وفيتامين سي. وغسول الحبوب يحتوي على حمض الساليسيليك وزيت شجرة الشاي. إذا سألت العميلة عن الغسول أثناء طلبها لروتين التفتيح، وضحّي لها فوراً أنه لطيف، خالي من السلفات القاسية، ومناسب للبشرة الحساسة.
- حالات تقشير وجفاف الوجه: الأولوية التامة هي ترميم حاجز البشرة وترطيبها بمرطب طبي ملطف مخصص للوجه وتجنب المقشرات. كريم التفتيح يوفر ترطيباً خفيفاً مع التفتيح، ولكن لا يوضع على بشرة متقشرة ملتهبة. وممنوع نهائياً ترشيح لوشن اليدين والجسم على الوجه (هو للجسم فقط). وممنوع نهائياً ترشيح كريم بعد الليزر للتقشير العادي للوجه (هو مخصص فقط لتهدئة الجلد بعد جلسات الليزر وإزالة الشعر).
- الفراكشنال ليزر والحرقان/الاحمرار الشديد: إذا ذكرت العميلة جلسة فراكشنال ليزر مع حرقان أو احمرار شديد، ممنوع تماماً ترشيح أي منتج تجميلي! انصحيها فوراً بالرجوع للطبيبة أو العيادة المعالجة.
- توافق المنتجات: ممنوع قول «مفيش أي تعارض بينهم خالص». فرّقي بين ليزر إزالة الشعر (يناسبه كريم بعد الليزر لتهدئة البشرة) وبين التقشير أو الفراكشنال (يُمنع استخدام غسول التفتيح أو المقشرات النشطة عليه حتى التعافي).
- الشمس والبحر والمصيف: وضّحي أن منتجات مونتانيا ليست بديلاً عن واقي الشمس (Sunscreen/Sunblock) أثناء التعرض المباشر للشمس نهاراً.
- مدة النتائج: النتائج تظهر تدريجياً خلال 14 إلى 21 يوماً من الاستخدام المنتظم وتختلف حسب نوع البشرة والالتزام بالروتين. لا تقدمي وعوداً قاطعة ولا تدّعي ثبات النتيجة للأبد.

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
}) {
  // If bot is paused for this session, return silence
  if (pauseBot) {
    return { reply: '', reply1: 'NONE', reply2: 'NONE', reply3: 'NONE', botPaused: true };
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

  // If a bundle was clicked/selected from an ad and cart is empty, add it
  if (selectedBundle && !cart.length) {
    const b = getBundleByKey(selectedBundle);
    if (b) {
      cart.push({
        id: `bundle:${b.key}`,
        bundleKey: b.key,
        name: b.name,
        price: b.bundlePrice,
        qty: 1,
        isBundle: true,
        productSlugs: b.productSlugs,
      });
    }
  }

  // Automatic extraction helper to guarantee customer details are captured into state
  const rawMsg = String(message || '').trim();
  const phoneCandidate = extractPhoneFromText(rawMsg);
  if (phoneCandidate && !customer.phone) {
    customer.phone = phoneCandidate;
  }
  const nameCandidateMatch = rawMsg.match(/^(?:أنا|اسمي|الاسم(?:\s*:)?)\s+([^\d\n\r,،.!؟?]{2,30})$/i);
  if (nameCandidateMatch && !customer.name) {
    const candidate = nameCandidateMatch[1].trim();
    if (!/(عايز|عاوز|بكام|سعر|روتين|كريم|غسول|لوشن|ليزر)/i.test(candidate)) {
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

  const model = genAI.getGenerativeModel({
    model: 'gemini-2.5-flash',
    systemInstruction: {
      parts: [{ text: SYSTEM_INSTRUCTION_V3 }]
    },
    tools: TOOL_DECLARATIONS,
    generationConfig: {
      maxOutputTokens: 4096,
      temperature: 0.3,
    },
  });

  // Prepare history for Gemini
  const geminiHistory = historyToGemini(chatHistory || session.history || []);
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
            const snapshotHash = v2.computeCheckoutSnapshot({
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
                  operationId: snapshotHash,
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
                        p_idempotency_key: String(snapshotHash),
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
    const snapshotHash = v2.computeCheckoutSnapshot({
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
    const evalRun = v2.isTestIsolationSession(sid);

    if (evalRun) {
      orderJustCreated = `EVAL-${Date.now().toString().slice(-6)}`;
      v2.recordSalesQualityMetric('order_confirmed', { orderNumber: orderJustCreated });
      cart = [];
    } else {
      try {
        const res = await v2.executeIdempotentOrderCreate({
          operationId: snapshotHash,
          sid,
          createOrderFn: async () => {
            const orderClient = sbService || sb;
            const dbRes = await orderClient.rpc('create_guest_order', {
              p_customer_name: customer.name,
              p_customer_phone: customer.phone,
              p_shipping_address: customer.address,
              p_governorate: gov,
              p_items: cart,
              p_subtotal: totals.subtotal,
              p_shipping_cost: totals.shippingCost,
              p_discount: 0,
              p_total: totals.total,
              p_payment_method: 'cod',
              p_chat_session_id: sid,
              p_chat_channel: channel,
            });
            if (dbRes?.data) {
              const realOrderNumber = dbRes.data?.order?.order_number || dbRes.data?.order_number || `MON-${Date.now().toString().slice(-5)}`;
              return { order_number: realOrderNumber };
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

    if (orderJustCreated && !finalReplyText.includes(orderJustCreated) && !finalReplyText.includes('تم تسجيل')) {
      finalReplyText += `\n\nألف مبروك يا فندم! تم تسجيل طلبك بنجاح برقم **${orderJustCreated}** 🎉. الدفع 100% كاش عند الاستلام بعد المعاينة، ومصاريف الشحن مجانية. فريق خدمة العملاء هيتواصل مع حضرتك تليفونياً لتأكيد موعد التسليم 💜.`;
    }
  }

  // Step 5: Post-Generation Claim Sanitization & Policy Enforcement
  const sanitized = v2.verifyAndSanitizeSalesClaims(finalReplyText, {
    cart,
    activePromo: { active: false, percent: 0 },
  });
  finalReplyText = sanitized.text;

  // Step 6: Persist updated state to Supabase
  const newHistory = appendHistory(session.history || [], [
    { role: 'user', text: message },
    { role: 'model', text: finalReplyText },
  ]);

  const patch = {
    cart,
    history: newHistory,
    customerName: customer.name,
    customerPhone: customer.phone,
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
