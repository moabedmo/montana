// Shared chatbot "brain" — used by the website's /api/chat AND by the
// WhatsApp/Messenger/Instagram webhooks (api/whatsapp-webhook.js etc).
// Moved out of api/chat.js verbatim (logic unchanged) so every channel
// shares the exact same tools/cart/order-creation code instead of
// forking it per platform.
const { GoogleGenerativeAI, SchemaType } = require('@google/generative-ai');
const { createClient } = require('@supabase/supabase-js');
const { notifyStockCrossings } = require('./stockAlerts');
const { getPromo, promoDiscountFor, promoLine } = require('./promo');
const { loadSession, saveSession, appendHistory, historyToGemini, normalizePhone, extractPhoneFromText, toWesternDigits } = require('./chatSessionStore');
const { tryOrderManageWizard, wantsOrderManagement } = require('./orderManage');
const {
  tryOrderContextReply,
  isProductAddConfirmation,
  wasAskingToAddToCart,
  lastModelMessage,
  resolveProductMentions,
  expandFrancoAndTypos,
  prepareCustomerText,
  softNormalizeAr,
  wantsExistingOrderHelp,
  botAskedForOrderLookupPhone,
  orderNotFoundCsReply,
  orderIssueCsReply,
  isOrderProblemComplaint,
  formatOrdersStatusReply,
  fetchPhoneOrders,
  fetchSessionOrders,
  CS_SUPPORT_PHONE,
  resolveCategoryFollowUp,
  filterChatProducts,
  isChatExcludedProduct,
  isSiliconeOrScarAsk,
} = require('./orderContext');
const { classifyIntent, FAQ_INTENTS } = require('./intentClassifier');
const { readCustomerImage, planFromImageRead } = require('./imageUnderstanding');
const {
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
  getBundleByKey,
  formatBundlePriceReply,
  formatFewProductsShippingTip,
  formatRoutineOffersUpsell,
  formatAllRoutineOffersList,
  preferredBundleKeyFromProducts,
} = require('./adOffers');
const {
  isBotPaused,
  isPauseExpired,
  stampBotPaused,
  stripPauseMarkers,
  wantsBotResume,
} = require('./botPause');

const API_KEY = process.env.GEMINI_API_KEY;
if (!API_KEY) {
  console.warn('[chatEngine] GEMINI_API_KEY is not set — chat will fail until configured.');
}
const genAI = API_KEY ? new GoogleGenerativeAI(API_KEY) : null;

const SUPABASE_URL = 'https://ikryeyqrithikabwidov.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlrcnlleXFyaXRoaWthYndpZG92Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE3MzY1ODcsImV4cCI6MjA5NzMxMjU4N30.kNfHPxV4fq67cOF8uFsTrLOxPYcLcmmDO3ScIHzI9Uo';
const sb = createClient(SUPABASE_URL, SUPABASE_KEY);

// Separate service-role client, used only for calls that must never be
// reachable with the public anon key (e.g. looking up a customer's past
// orders by phone) — the anon key ships in client-side JS, service_role
// only lives in our own server env.
const sbService = process.env.SERVICE_ROLE
  ? createClient(SUPABASE_URL, process.env.SERVICE_ROLE)
  : null;

const SYSTEM_PROMPT = `أنتِ بائعة مونتانيا على الشات — بنت مصرية ودودة، بتبيع ببساطة. العميل لازم يحس إنه بيكلم حد طبيعي، مش بوت ولا كتالوج.

## فهم السياق (حرج — ده شغلك الأساسي):
- إنتِ الدماغ: افهمي القصد من الرسالة + آخر رسائل المحادثة + «سياق السيستم» اللي بيتحط قبل رسالة العميل.
- متابعة قصيرة زي «بيفتح؟» / «والشحن؟» / «طب والكريم» = جاوبِي على **المنتج/العرض اللي اتكلمتوا عنه**، ممنوع تعيدي «أنهي منتج تقصدي» لو السياق واضح.
- كريم بعد الليزر (= بوست ليزر): سعر الوحدة من list_products فقط (حاليًا **369**). ممنوع تخمّني 299 أو أي رقم تاني.
- كريم بعد الليزر: بيحمي من تصبغات بعد الجلسة، **مش** بديل كريم التفتيح للتصبغات الموجودة — وضّحي الفرق لو سألت «بيفتح؟».
- غلط إملائي/فرانكو عادي: غربيه=الغربية، بوست ليزر=بعد الليزر، بكام=السعر.

## قاعدة معمارية (حرج — لا تكسريها):
- الأسعار / الشحن / السلة / تسجيل الأوردر = من الأدوات فقط (list_products / list_governorates / add_to_cart / add_routine_offer / view_cart / start_checkout).
- ممنوع تختلقي رقم سعر أو اسم عرض أو رقم أوردر من ذاكرتك. لو مش متأكدة من رقم: استخدمي الأداة.
- العروض الحقيقية فقط: ما بعد الليزر **618** · التفتيح الكامل **777** · الوش والجسم **558**. أسعار الموقع + شحن مجاني. أي رقم تاني للعروض = خطأ.
- الشحن لـ**كل محافظات مصر** من list_governorates (القاهرة/الجيزة/الإسكندرية/الغربية/القليوبية/… إلخ). ممنوع تفترضي محافظة معينة أو تتكلمي كأننا بنشحن لمكان واحد بس.

## أسلوب الرد (حرج):
- اختصري: عادة سطرين لـ4 أسطر. ممنوع رغي أو قوائم طويلة إلا لو طلبت الأسعار كلها.
- عامية مصرية بس. نداء "يا فندم" فقط (مش حبيبتي/يا قمر). إيموجي خفيف 😊💜.
- افهمي القصد حتى لو فيه غلط إملائي أو فرانكو (bkam=بكام، 3ayza=عايزة، tfteh=تفتيح، ghosol=غسول، 7bob=حبوب). ممنوع "مش فاهمة" لو المعنى قريب.
- أهلاً في أول رسالة فقط، وفي نفس الرد جاوبِي على سؤالها. بعد كده ادخلي في الموضوع مباشرة.
- اسم البراند "مونتانيا" بالعربي دايمًا. ممنوع كلمة "سلة" — قولي "الأوردر".
- منتجاتنا **عناية بشرة وجسم فقط** (غسول/كريم/لوشن). **مفيش منتجات شعر** — ممنوع تسألي "للبشرة ولا للشعر".
- **ممنوع تمامًا** تتكلمي عن جل السيليكون أو منتجات الندبات أو ترشّحيهم أو تقولي سعرهم أو إنهم غير متوفرين. لو سألت عن ندبات/سيليكون: حوّليها لمنتجات التفتيح والعناية (غسول/كريم/لوشن) من غير ما تذكري اسم الجل.
- "مجموعة / المجموعة كلها / الروتين / العرض" = اعرضي **عروض الروتين التلاتة** (مع المنتجات اللي جوه كل عرض) مش أسئلة تشخيص.
- "في عروض؟ / عندكم عروض / ايه العروض" = النظام بيعرض العروض التلاتة الحقيقية فقط. **ممنوع** تختلقي روتينات أو أسعار أو سيرم أو واقي شمس أو منتجات مش في list_products.

## مسار البيع (ثابت):
1) افهمي المشكلة → 2) رشّي **منتج واحد** (فايدة قصيرة من description + السعر) → 3) جاوبِي على أسئلتها بهدوء → 4) سجّلي الأوردر **بس لما تقول صراحة** عايزة أوردر/اطلب/نكمل.
- **ممنوع** تختمي كل رد بـ"تحبي أسجلك/تسجّلي/نكمل/أنهي عرض". الأسلوب ده مستفز. اسألي عن التسجيل مرة واحدة بالكتير وبعد موافقة واضحة.
- لو قالت "اشوف / وريني الشكل / متسجلش": ابعتي لينك الموقع/الباندل **من غير** تسجيل ومن غير سؤال أوردر.
- متغمريهاش بأكتر من منتج إلا لو طلبت مقارنة أو كل الأسعار.
- بعد سعر منتج واحد أو اتنين: السعر، وجملة «الشحن مجاني من 3 منتجات» **مرة واحدة بس في المحادثة كلها**. لو قلتيها قبل كده ممنوع تكرريها — ده مستفز.
- سؤال شحن محافظة: قولي **سعر الشحن بس**. ممنوع تعيدي عرض الشحن المجاني إلا لو سألت صراحة «الشحن مجاني؟» أو «ازاي يبقى مجاني؟».
- سؤال «بكام/السعر» من غير منتج محدد: قائمة أسعار المنتجات المتوفرة فقط. عروض الروتين لما تطلبها هي.
- سؤال تشخيص بس لو الطلب غامض جدًا. مشكلة واضحة = رشّي فورًا.
- بعد الترشيح: تفاصيل/مكونات/شكل = جاوبِي من غير سؤال التسجيل.
- شكوى أو زعل أو "عايزة أكلم حد" = وقفي البيع، اعتذري، وادّي رقم خدمة العملاء ${CS_SUPPORT_PHONE}.
- لو سألت عن أوردر قديم / توصيل / ديبوزيت / دفع ومش لاقيينه في السيستم بعد رقم الموبايل: ادّي رقم خدمة العملاء ${CS_SUPPORT_PHONE} فورًا ووقفي البيع. ممنوع تلفّي أو تقولي "الفريق هيتابع" من غير الرقم. ممنوع تجادليها إن الدفع كاش بس لو بتقول دفعت مقدم — حوّليها للرقم.

## حقائق (ممنوع اختلاق):
- أسعار/أسماء منتجات: list_products فقط. شحن محافظة: list_governorates فقط. حالة طلب: get_order_status. نقاط: get_points_balance.
- عروض الروتين الحقيقية فقط: (1) ما بعد الليزر **618** (2) التفتيح الكامل **777** (3) الوش والجسم **558** — نفس أسعار الموقع + شحن مجاني. **ممنوع** تقولي 549/699/499 أو "بدل 618/777/558". ممنوع سيرم/واقي شمس لو مش في المنتجات.
- الخصم العام: لو فيه عرض شغال هيتقالك في سياق الرسالة. **اذكريه لو اتقالك بس** — ممنوع تخترعي خصم من نفسك، وممنوع تنفي وجود خصم لو العرض شغال. الخصم بيتحسب تلقائي على الطلب، مش محتاج كود.
- stock=0 = "غير متوفر حاليًا" + بديل. ممنوع تقولي عدد القطع.
- مكونات/تفاصيل منتج: جاوبِي عن المنتج ده بس من ingredients/description — ممنوع ترجعي قائمة كل المنتجات.
- old_price أعلى من price = عرض حقيقي. ريفيوهات = لينك المنتج فقط، ممنوع أرقام تقييم أو ريفيو مختلق.
- صور = لينك www.montana.com.eg مش صورة جوه الشات.
- برنامج النقاط (مختصر): كل 10 ج.م من الموقع = نقطة، تخصم لاحقًا. ممنوع شرح طويل.
- إتمام الأوردر: النظام يسأل هنا ولا الموقع. ممنوع تختلقي رقم أوردر أو تقولي هفتح فورم/هبعت لينك من غير النظام. كاش عند الاستلام.
- ممنوع تمامًا تطلبي أي فلوس أو مقدّم أو تحويل، وممنوع تدّي أرقام محافظ إلكترونية. وفي نفس الوقت ممنوع تنفي وجود دفعة تأكيد أو تقولي "مفيش مقدّم" — لو اتسألتِ عن دفعة أو مكالمة طلبت فلوس، حوّلي الموضوع لخدمة العملاء ${CS_SUPPORT_PHONE} من غير نفي ولا تأكيد.
- سياسة الشحن (للمعرفة، **متكرريهاش في كل رد**): مجاني من 3 منتجات أو على عروض الروتين؛ غير كده حسب المحافظة. اذكريها فقط لو سألت عن المجانية أو أثناء تأكيد الأوردر.
- "اوك/تمام" بعد "أسجلك أوردر؟" = add_to_cart مش شراء نهائي.
- بعد إضافة ناجحة: مكمل واحد منطقي مرة واحدة فقط (غسول↔كريم تفتيح، حب شباب→تفتيح، وجه→لوشن) — لو رفضت والأوردر فيه حاجة: "تحبي نكمل الأوردر؟" مرة واحدة.
- إلغاء/تعديل طلب قديم: اطلبي الموبايل المسجّل بيه.
- لو في سياق الجلسة باندل إعلان نشط (selectedBundle) وسألت «العرض/بكام» من غير تحديد: جاوبِي على الباندل ده. لو ذكرت منتج/باندل تاني صراحة، كلامها يغلّب.
- سؤال ضمان / أمان المنتج / "لو صار فيني حاجة": قولي المنتجات واخدة موافقة وزارة الصحة برقم **COSMTOL25117170**. ممنوع تختلقي كلام إرجاع ١٤ يوم كرد على الضمان.
- سؤال "امتى النتائج / امتى يبان الفرق": نتايج ملحوظة خلال **14 يوم** مع الاستخدام المنتظم. ممنوع تعيدي عرض السعر مكان الإجابة.

## سياسات (لو سألت):
توصيل 2-3 أيام · إرجاع 14 يوم (لما تسأل عن الإرجاع صراحة بس) · دفع كاش أو تحويل كامل.
صيدليات التوفر: استخدمي **فقط** قائمة «صيدليات تتوفر فيها منتجات مونتانيا» اللي بتوصلك في سياق الرد (متحدّثة من لوحة المالك). لو قالت منطقتها اذكري صيدليات المنطقة دي؛ لو مش معروف قولي المناطق واسأليها. ممنوع تختلقي أسماء صيدليات مش في القائمة.
ضمان/ترخيص: موافقة وزارة الصحة رقم COSMTOL25117170.`;

const chatSessions = {};

// Server-side cart, keyed by session — the actual source of truth for
// "what does this customer want", instead of relying on the model to
// correctly recall product references across conversation turns
// (which turned out to be unreliable in testing).
const sessionCarts = {};

// Holds the lightweight "await_confirm" step: yes/no on "do you want to
// check out?" before opening the real form (web) or sending the checkout
// link (everywhere else) — see sendCheckoutLink().
const checkoutWizards = {};

// Safety net: the model occasionally formats a multi-product reply as a
// markdown bullet list ("* منتج: ...") instead of the blank-line-separated
// paragraphs the reply1/2/3 splitter in api/chat.js needs to break a reply
// into separate chat bubbles — that left the whole reply as one giant
// unsplit wall of text, with literal "*" characters visible on channels
// that don't render markdown (Facebook/Instagram/WhatsApp). Normalize every
// top-level bullet into its own paragraph (blank line before it) with a
// plain "•" marker; nested/indented bullets stay attached to their parent's
// paragraph instead of splitting further.
function normalizeBulletLists(text) {
  if (!text) return text;
  const lines = String(text).split('\n');
  const out = [];
  for (const line of lines) {
    const topBullet = /^\*\s+/.test(line);
    const subBullet = /^\s+\*\s+/.test(line);
    if (topBullet) {
      if (out.length && out[out.length - 1].trim() !== '') out.push('');
      out.push(line.replace(/^\*\s+/, '• '));
    } else if (subBullet) {
      out.push(line.replace(/^(\s+)\*\s+/, '$1• '));
    } else {
      out.push(line);
    }
  }
  return out.join('\n');
}

// Safety net: the model sometimes ignores the "يا فندم فقط" prompt rule and
// slips in "يا قمر"/"حبيبتي" anyway — enforce it deterministically here too.
function sanitizeReply(text) {
  if (!text) return text;
  const cleaned = normalizeBulletLists(text)
    .replace(/يا\s+قمر\S*/g, 'يا فندم')
    .replace(/يا\s+حبيبتي/g, 'يا فندم')
    .replace(/حبيبتي/g, 'فندم')
    // Legacy ad discounts removed — never show 549/699/499 "بدل" on routines
    .replace(/549\s*بدل\s*618/g, '618')
    .replace(/699\s*بدل\s*777/g, '777')
    .replace(/499\s*بدل\s*558/g, '558')
    .replace(/سعر\s*العرض\s*\*?\*?699\*?\*?\s*جنيه\s*\(بدل\s*777\)/gi, 'سعر العرض **777** جنيه')
    .replace(/بـ\s*\*?\*?699\*?\*?\s*جنيه\s*\(بدل\s*777\)/gi, 'بـ **777** جنيه')
    .replace(/\(بدل\s*777\)/g, '')
    .replace(/\(بدل\s*618\)/g, '')
    .replace(/\(بدل\s*558\)/g, '')
    // "عرض عرض عناية…" when bundle.name already includes عرض
    .replace(/عرض\s+عرض\s+/g, 'عرض ');
  // Never let silicone gel leak into customer-facing replies
  if (/سيليكون|silicone/i.test(cleaned)) {
    return siliconeScarDeflectReply();
  }
  return cleaned;
}

/** LLM invented fake offers/prices — never reach the customer. */
function looksLikeInventedCatalog(text) {
  const t = String(text || '');
  if (/999|٧٤٩|749|سيرم\s*تفتيح|واقي\s*شمس|للبشرة ولا للشعر/.test(t)) return true;
  if (/\b(799|899|1099|1299|1500)\b/.test(t) && /(عرض|روتين|سيرم|جنيه)/.test(t)) return true;
  // Legacy discounted routine prices (no longer sold that way)
  if (/549\s*بدل\s*618|699\s*بدل\s*777|499\s*بدل\s*558/.test(t)) return true;
  if (/سيليكون|silicone/i.test(t)) return true;
  return false;
}

// Soft length cap so Gemini rambling never reaches the customer as a wall
// of text. Never touch order confirmations, checkout links, or cart summaries.
function enforceBriefReply(text) {
  if (!text) return text;
  const raw = String(text);
  // "────" only ever comes from the routine-offers list. It runs ~426 chars,
  // so the 420 cap was silently cutting the third offer off — the customer saw
  // two of the three routines. Never truncate that list.
  if (/(MON-|complete-order\.html|رقم الطلب|تم تسجيل أوردرك|إجمالي المنتجات|تحبي تسجّلي الأوردر معايا|منتجاتنا المتاحة|المكونات:|────|طريقة استخدام|شحن مجاني\) على كل عرض|على أي روتين|montana\.com\.eg|ابعتيلي في \*\*رسالة واحدة\*\*)/i.test(raw)) {
    return raw;
  }
  const maxChars = 420;
  if (raw.length <= maxChars) return raw;

  const parts = raw.split(/\n\s*\n+/).map((p) => p.trim()).filter(Boolean);
  let out = '';
  if (parts.length >= 2) {
    out = parts[0];
    for (let i = 1; i < parts.length; i++) {
      if (out.length + parts[i].length + 2 > maxChars) break;
      out += `\n\n${parts[i]}`;
    }
  } else {
    const sentenceEnd = raw.slice(0, maxChars).match(/^[\s\S]*?[.!?؟\n](?=[^.!?؟\n]*$)/);
    out = (sentenceEnd ? sentenceEnd[0] : raw.slice(0, maxChars)).trim();
    if (out.length < raw.length && !/[.!?؟]$/.test(out)) out += '…';
  }

  if (/تحبي/i.test(raw) && !/تحبي/i.test(out)) {
    const cta = raw.match(/تحبي[^\n]*[؟?]/);
    if (cta) out = `${out.trim()}\n\n${cta[0]}`;
  }
  return out.trim();
}

/**
 * "في حد كلمني وطلب مني فلوس" — our team calls to confirm the order before
 * shipping. The bot must never request money, and must never deny the call
 * happens either (denying it is what made a real call look like a scam).
 * Instead it checks the caller's number against our official line.
 */
function isDepositCallInquiry(message) {
  const t = prepareCustomerText(expandFrancoAndTypos(String(message || '')));
  if (!t) return false;
  const money = /(فلوس|مبلغ|مقدم|مقدّم|عربون|دفع[ةه]|تحويل|فودافون\s*كاش|انستا\s*باي|instapay|٢٠٠|200)/i.test(t);
  const call = /(كلمن|اتصل|مكالم[ةه]|بيتصل|اتصال|حد\s*كلم|رن\s*علي)/i.test(t);
  const doubt = /(نصب|محتال|مضروب|حقيقي|صح\s*ولا|فعلا|منكم|من\s*عندكم|تبعكم|رقمكم)/i.test(t);
  return money && (call || doubt);
}

/** Did we just ask which number called her? Persisted history is the source. */
function botAskedForCallerNumber(chatHistory) {
  return /الرقم اللي كلمك/i.test(String(lastModelMessage(chatHistory) || ''));
}

function askCallerNumberReply() {
  return (
    'طمنيني يا فندم 💜 عشان أتأكدلك: **الرقم اللي كلمك كام؟**\n' +
    'ابعتيهولي وهقولك على طول ده رقمنا الرسمي ولا لأ.\n\n' +
    'ولحد ما نتأكد، من فضلك متدفعيش أي حاجة.'
  );
}

function callerNumberVerdictReply(caller) {
  const official = normalizePhone(CS_SUPPORT_PHONE) || String(CS_SUPPORT_PHONE);
  if (caller && (normalizePhone(caller) || String(caller)) === official) {
    return (
      `أيوه يا فندم ✅ الرقم ده **${CS_SUPPORT_PHONE}** رقمنا الرسمي، والمكالمة من عندنا فعلاً.\n` +
      'زميلنا بيكلمك عشان يأكد الأوردر قبل الشحن، وأي تفاصيل خاصة بالدفع بتتأكد معاه هو مباشرة.\n\n' +
      'وعلامة إن المكالمة منّا: بتذكرلك **رقم أوردرك ومنتجاتك بالظبط** 💜'
    );
  }
  return (
    'الرقم ده **مش من أرقامنا** يا فندم ⚠️\n' +
    `إحنا بنكلم عملاءنا من رقم واحد بس: **${CS_SUPPORT_PHONE}**.\n\n` +
    'من فضلك **متدفعيش أي مبلغ** ومتديش بياناتك لحد، وكلمينا على رقمنا ده ونتأكدلك من أوردرك.'
  );
}

function mentionsShipFrom3(text) {
  const t = String(text || '');
  return /شحن/.test(t) && /((أول\s*)?3\s*منتجات|٣\s*منتجات)/.test(t);
}

/**
 * "الشحن مجاني من 3 منتجات" — owner's rule: say it ONCE per conversation.
 * After every price it reads as pushy; never saying it loses the upsell.
 * Applied at the single exit point so it holds whether the reply came from the
 * model or from a scripted path.
 */
function applyShipFrom3NoteOnce(reply, chatHistory) {
  if (!reply) return reply;
  const alreadySaid = (chatHistory || []).some(
    (t) => t?.role === 'model' && mentionsShipFrom3(t.text || t.parts?.[0]?.text)
  );
  if (alreadySaid) {
    // Drop a repeat, but only when it's its own short line — never cut into
    // a sentence that is also carrying something else.
    return reply
      .split('\n')
      .filter((line) => !(mentionsShipFrom3(line) && line.trim().length < 90))
      .join('\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }
  if (mentionsShipFrom3(reply)) return reply;
  // Only worth saying next to a unit price she just asked about
  if (!/\b(229|249|299|329|369)\b/.test(reply)) return reply;
  // Routine offers already ship free, and checkout/confirmation must stay clean
  if (/\b(558|618|777)\b/.test(reply)) return reply;
  if (/رقم الطلب|تم تسجيل|MON-|ابعتيلي|العنوان|المحافظة/.test(reply)) return reply;
  return `${reply.trimEnd()}\n\nومعلومة كمان: الشحن **مجاني من 3 منتجات** 🎁`;
}

function isHumanHandoffRequest(message) {
  const t = String(message || '').trim();
  if (!t) return false;
  return /(عايز(ة|ه)?\s*(أ?كلم|اتكلم|أكلم)|كلم(ي|و)?\s*(حد|موظف|بشري|بنت|خدمة)|مش\s*(بوت|روبو)|انسان|إنسان|خدمة\s*العملاء|customer\s*service|speak\s*to\s*(a\s*)?human|agent|زعلان|غضبان|نصب|احتيال|محتال|هشتكي|اشتكي|شكوى|مش\s*راض)/i.test(t);
}

function humanHandoffReply() {
  return `تحت أمرك يا فندم 💜 تواصلي مع خدمة العملاء على **${CS_SUPPORT_PHONE}** وهيساعدوكي فورًا.`;
}

/** Job / moderator / hiring asks — not a product sale. */
function isHiringOrStaffAsk(message) {
  const t = prepareCustomerText(expandFrancoAndTypos(message));
  if (!t) return false;
  return (
    /(مودريتور|moderator|موдераيتور|ادمن\s*شات|أدمن\s*شات)/i.test(t)
    || /(توظيف|وظيفة|وظيفه|فرص[ةه]\s*عمل|شغل\s*عندكم|بتوظف|looking\s*for\s*(a\s*)?(job|moderator)|hiring)/i.test(t)
    || /محتاجين\s*(مودر|موظ|ادمن|أدمن|حد\s*للصفحه|حد\s*للصفحة)/i.test(t)
  );
}

function hiringAskReply() {
  return (
    'صباح الخير / مرحباً 🌿\n' +
    'حالياً الشات ده لاستفسارات **المنتجات والطلبات** بس.\n' +
    'لو حابة تقدّمي لشغل، ابعتي رسالة على إنستجرام الصفحة أو الإيميل 💜\n' +
    'ولو عندكِ سؤال عن منتجات مونتانا قوليلي!'
  );
}

/** Last bot already sent the single-SKU ad pitch (don't spam it again). */
function alreadyPitchedProductAd(chatHistory) {
  const last = String(lastModelMessage(chatHistory) || '');
  return /تحبّي تعرفي تفاصيل أكتر، ولا تشوفي أسعار باقي المنتجات/.test(last)
    || /أسعار باقي المنتجات وعروض الروتين/.test(last);
}

function shortProductBenefit(p) {
  const d = String(p?.description || '').trim();
  if (!d) return 'من منتجات مونتانيا للعناية بالبشرة';
  const first = d.split(/[.。!\n؟]/)[0].trim() || d;
  return first.length > 90 ? `${first.slice(0, 87)}…` : first;
}

/** "بيفتح؟" / "يفتح التصبغات؟" — whitening-effect question, not a vague FAQ. */
function isWhiteningEffectAsk(message) {
  const t = softNormalizeAr(expandFrancoAndTypos(String(message || '').trim()));
  if (!t || t.length > 90) return false;
  // Avoid stealing real price asks ("بكام بيفتح؟" rare — still answer effect if بيفتح present)
  if (/^(و\s*)?(ال)?(سعر|بكام|بكم|كام)[\s!.،؟?]*$/i.test(t)) return false;
  return (
    /^(و\s*)?(ال)?(كريم|غسول|لوشن|منتج)?\s*(ده|دا|بي)?\s*(بي)?فتح[\s!.،؟?]*$/i.test(t)
    || /^(هل\s*)?(ب)?يفتح(\s*(التصبغ|الكلف|البشر|اللون|الاماك|الأماك))?[\s!.،؟?]*$/i.test(t)
    || /(بيفتح|بي\s*فتح|بفتح|يفتح)\s*(التصبغ|الكلف|البشر|اللون|الاماك|الأماك|ولا)?/i.test(t)
    || /^(ينفع\s*)?(لل)?تفتيح[\s!.،؟?]*$/i.test(t)
    || /هل\s*(ب)?يفتح/.test(t)
  );
}

/** Soft "no / not really" after a whitening claim — don't re-pitch price. */
function isSoftDisagreement(message) {
  const t = softNormalizeAr(expandFrancoAndTypos(String(message || '').trim()));
  if (!t || t.length > 40) return false;
  return /^(و?\s*)?(لا\s*لا|لالا|ولالا|لأ\s*لأ|مش\s*كده|مش\s*بيفتح|معلهوش|معليش\s*لا)[\s!.،؟?]*$/i.test(t);
}

function resolveWhiteningAskProductKey(message, chatHistory, selectedProductSlug) {
  const t = softNormalizeAr(expandFrancoAndTypos(String(message || '')));
  const blob = softNormalizeAr(
    [
      message,
      selectedProductSlug || '',
      lastModelMessage(chatHistory),
      ...(chatHistory || []).slice(-6).map((h) => h.text || ''),
    ].join('\n')
  );

  if (/تفتيح/.test(t) && /كريم/.test(t) && !/ليزر/.test(t)) return 'whitening-cream';
  if (/غسول/.test(t) && /تفتيح/.test(t)) return 'whitening-cleanser';
  if (/لوشن/.test(t)) return 'hand-body-lotion';
  if (/ليزر|بوست/.test(t) || selectedProductSlug === 'post-laser-cream') return 'post-laser-cream';
  if (selectedProductSlug === 'whitening-cream') return 'whitening-cream';
  if (selectedProductSlug === 'whitening-cleanser') return 'whitening-cleanser';
  if (selectedProductSlug === 'hand-body-lotion') return 'hand-body-lotion';

  if (/كريم\s*العنايه\s*بعد\s*الليزر|بعد\s*الليزر|بوست\s*ليزر/.test(blob) && !/كريم\s*التفتيح/.test(t)) {
    // Prefer post-laser if bot just pitched it (even if offer also mentions whitening cream)
    if (/كريم\s*العنايه\s*بعد\s*الليزر|سعره\s*\*?\*?369|تهيج|احمرار/.test(blob)) {
      return 'post-laser-cream';
    }
  }
  if (/كريم\s*التفتيح|سعره\s*\*?\*?249/.test(blob) && !/بعد\s*الليزر/.test(t)) return 'whitening-cream';
  if (/غسول\s*التفتيح/.test(blob)) return 'whitening-cleanser';
  if (/لوشن\s*اليدين/.test(blob)) return 'hand-body-lotion';
  if (/بعد\s*الليزر|بوست\s*ليزر|post-laser-cream/.test(blob)) return 'post-laser-cream';
  return null;
}

async function productUnitPriceBySlug(slug) {
  if (!slug) return null;
  const { data } = await sb.from('products')
    .select('price')
    .eq('slug', slug)
    .eq('is_active', true)
    .maybeSingle();
  if (!data) return null;
  return Math.round(Number(data.price) || 0) || null;
}

async function formatWhiteningEffectReply(productKey) {
  if (productKey === 'post-laser-cream') {
    const creamPrice = await productUnitPriceBySlug('whitening-cream');
    const creamBit = creamPrice ? ` (**${creamPrice}** جنيه)` : '';
    return (
      'كريم العناية بعد الليزر **مش بديل كريم التفتيح** يا فندم 💜\n\n' +
      'دوره الأساسي: يهدي التهيّج بعد الليزر ويقلل خطر **تصبغات ما بعد الالتهاب** — يعني يساعد بشرتك متغمقش بعد الجلسة.\n\n' +
      `لو عندكِ تصبغات موجودة بالفعل وعايزة تفتيح، أنسب لكِ **كريم التفتيح**${creamBit}، ` +
      'أو **عرض ما بعد الليزر** (كريم الليزر + كريم التفتيح بـ **618** بشحن مجاني) 🎁\n\n' +
      'تحبي أقولكِ عن كريم التفتيح ولا العرض؟'
    );
  }
  if (productKey === 'whitening-cream') {
    const price = await productUnitPriceBySlug('whitening-cream');
    const priceBit = price ? `السعر **${price}** جنيه — ` : '';
    return (
      'أيوه يا فندم 💜 **كريم التفتيح** مخصص لتفتيح الكلف وآثار الحبوب وتفاوت لون البشرة والتصبغات من الشمس.\n' +
      `${priceBit}ولو حابة روتين كامل مع غسول ولوشن بـ **777** بشحن مجاني قوليلي 🎁`
    );
  }
  if (productKey === 'whitening-cleanser') {
    const price = await productUnitPriceBySlug('whitening-cleanser');
    const priceBit = price ? `السعر **${price}** جنيه — ` : '';
    return (
      'غسول التفتيح بيجهّز البشرة وبيساعد على تفتيح تدريجي مع الروتين يا فندم 💜\n' +
      `${priceBit}والنتيجة أحلى مع **كريم التفتيح** أو روتين التفتيح الكامل **777** بشحن مجاني.`
    );
  }
  if (productKey === 'hand-body-lotion') {
    return (
      'لوشن اليدين والجسم بيرطّب وبيساعد على توحيد لون البشرة تدريجيًا يا فندم 💜\n' +
      'للتفتيح الأقوى للتصبغات أنسب **كريم التفتيح** أو روتين التفتيح **777**.'
    );
  }
  return (
    'قصدي أوضحلكِ حسب المنتج 💜\n' +
    '• **كريم التفتيح** → أيوه، للتصبغات والكلف وآثار الحبوب\n' +
    '• **كريم بعد الليزر** → بيحمي من تصبغات بعد الجلسة، مش بديل تفتيح التصبغات الموجودة\n\n' +
    'أنهي واحد تقصدي؟'
  );
}

async function replyWhiteningEffectAsk(message, sid, chatHistory, selectedProductSlug) {
  const key = resolveWhiteningAskProductKey(message, chatHistory, selectedProductSlug);
  return {
    reply: await formatWhiteningEffectReply(key),
    sessionId: sid,
    keepCta: true,
    selectedProduct: key || undefined,
  };
}

// Clear skin need → was a competing single-SKU path. Disabled: intent +
// routines/offers in code own sales turns (see classifyIntent / SELECT_OFFER).
async function tryDirectRecommend() {
  return null;
}


// Matches closing CTAs: "تحبي أسجلك…؟" / "تحبي نكمل…؟" / "تحبي تسجّلي الأوردر معايا…؟"
const CTA_NUDGE_RE =
  /(?:\n+)?[ \t]*(?:تحبي\s*(?:تسجّ?ل[يى]?|أ?سجلك?|نكمّ?ل|تضيف|أضيف|اضيف|أضيفيهم)|قولي\s*اسم\s*العرض\s*و?أسجلهولك|أنهي\s*عرض\s*(?:تحبيه|تقصدي)|تحبي\s*أسجلكِ?\s*أنهي\s*عرض|لو\s*حابة\s*(?:تاخديه|أكمّل\s*الأوردر))[\s\S]{0,120}?[؟?]?\s*[😊💜🛒🌿]*\s*$/u;

// Matches a customer objection/hesitation ("غالي"، "هفكر"...) — see
// stripRepeatedCta below.
const OBJECTION_RE = /(غالي|غاليه|هفكر|هافكر|هفكرها|مش متأكد|مش متاكد|مش حاسة|مش قادرة|مش قادر|too expensive|think about it)/i;

function replyHasCta(text) {
  return CTA_NUDGE_RE.test(String(text || ''));
}

function historyHasRecentCta(chatHistory, lookbackModelTurns = 6) {
  const history = chatHistory || [];
  let seen = 0;
  for (let i = history.length - 1; i >= 0; i--) {
    if (history[i]?.role !== 'model') continue;
    if (replyHasCta(history[i].text)) return true;
    seen += 1;
    if (seen >= lookbackModelTurns) break;
  }
  return false;
}

// Never re-ask "تحبي تسجّلي/أسجلك/نكمل؟" on every reply. Gemini ignores the
// prompt rule; deterministic replies also used to append it. Strip unless
// keepCta (real checkout choice / post-add) or a fresh objection was answered.
function stripRepeatedCta(replyText, chatHistory, opts = {}) {
  if (!replyText || !replyHasCta(replyText)) return replyText;
  if (opts.keepCta) return replyText;

  const history = chatHistory || [];
  let lastCtaIdx = -1;
  for (let i = history.length - 1; i >= 0; i--) {
    if (history[i]?.role === 'model' && replyHasCta(history[i].text)) {
      lastCtaIdx = i;
      break;
    }
  }
  if (lastCtaIdx === -1) return replyText;

  const objectionSince = history
    .slice(lastCtaIdx + 1)
    .some((h) => h.role === 'user' && OBJECTION_RE.test(h.text || ''));
  if (objectionSince) return replyText;

  return String(replyText).replace(CTA_NUDGE_RE, '').trim();
}

// Diagnostic trail only — when a checkout-flow regex below doesn't
// recognize the customer's message, log it (visible in Vercel's function
// logs) instead of silently falling through. Lets us later search real
// conversations for phrasings our patterns are missing, instead of
// guessing which ones to add.
function logUnmatchedIntent(context, sid, message) {
  console.warn('[DIAG unmatched-intent]', JSON.stringify({ context, sid, message }));
}

// Returns the customer's past purchased product names by phone, so a
// returning customer's session can open with "فاكرة إنك جربتِ X" instead of
// starting from zero every time. Uses the service-role client only —
// see get_customer_past_products' grants in migration 075.
async function getPastProducts(phone) {
  if (!sbService || !phone) return [];
  try {
    const { data, error } = await sbService.rpc('get_customer_past_products', { p_phone: phone });
    if (error || !data?.found) return [];
    return data.products || [];
  } catch {
    return [];
  }
}

// Full returning-customer profile (name/address/gov + past products) keyed
// by Egyptian mobile — used for memory greetings and checkout prefills.
async function getCustomerProfile(phone) {
  const normalized = normalizePhone(phone);
  if (!sbService || !normalized) return null;
  try {
    const { data, error } = await sbService.rpc('get_customer_profile_by_phone', { p_phone: normalized });
    if (error || !data?.found) return null;
    return {
      phone: data.phone || normalized,
      name: data.name || null,
      address: data.address || null,
      governorate: data.governorate || null,
      lastOrderNumber: data.last_order_number || null,
      orderCount: data.order_count || 0,
      products: Array.isArray(data.products) ? data.products : [],
    };
  } catch {
    return null;
  }
}

/** WhatsApp Cloud API sids look like whatsapp:2010xxxxxxxx — seed phone from that. */
function phoneFromSessionId(sid) {
  if (!sid || !String(sid).startsWith('whatsapp:')) return null;
  return normalizePhone(String(sid).slice('whatsapp:'.length));
}

// Sums a customer's earned loyalty points across every order tied to her
// phone number (guest checkout creates a fresh customers row per order —
// no shared row to read a single balance off, see migration 078's comment).
// service_role only, same access level as getPastProducts above.
async function getPointsBalance(phone) {
  const normalized = normalizePhone(phone);
  if (!sbService || !normalized) return null;
  try {
    const { data, error } = await sbService.rpc('get_customer_points_by_phone', { p_phone: normalized });
    if (error) return null;
    return data?.points ?? 0;
  } catch {
    return null;
  }
}

// sid convention: web sessions look like "sid_xxxxx" (from
// chat-widget.js's localStorage id); other channels are prefixed
// "whatsapp:", "messenger:", "instagram:" by their webhook handler.
function channelOf(sid) {
  const idx = sid.indexOf(':');
  return idx === -1 ? 'web' : sid.slice(0, idx);
}

const tools = [{
  functionDeclarations: [
    {
      name: 'list_products',
      description: 'يرجع قائمة المنتجات الحقيقية والحالية بأسعارها ووصفها ومكوناتها من قاعدة البيانات. استخدميها قبل ذكر أي سعر أو قبل الإجابة عن فوايد/بيفتح/تفاصيل.',
      parameters: { type: SchemaType.OBJECT, properties: {} }
    },
    {
      name: 'list_governorates',
      description: 'يرجع أسماء كل المحافظات المتاحة للشحن مع سعر الشحن لكل واحدة. استخدميها فورًا لو سألت عن شحن محافظة (حتى لو كتبت غربيه/قاهره من غير ال).',
      parameters: { type: SchemaType.OBJECT, properties: {} }
    },
    {
      name: 'view_cart',
      description: 'يرجع محتوى الأوردر الحالي (أسماء وأسعار وكميات وإجمالي).',
      parameters: { type: SchemaType.OBJECT, properties: {} }
    },
    {
      name: 'add_to_cart',
      description: 'ضيف منتج واحد للأوردر بالـ id من list_products. استخدميها بعد موافقة واضحة أو طلب صريح.',
      parameters: {
        type: SchemaType.OBJECT,
        properties: {
          product_id: { type: SchemaType.NUMBER, description: 'id المنتج من list_products' },
          qty: { type: SchemaType.NUMBER, description: 'الكمية (افتراضي 1)' },
        },
        required: ['product_id'],
      },
    },
    {
      name: 'add_routine_offer',
      description: 'ضيف عرض روتين كامل للأوردر. المفاتيح: post-laser | brightening | face-body',
      parameters: {
        type: SchemaType.OBJECT,
        properties: {
          offer_key: {
            type: SchemaType.STRING,
            description: 'post-laser أو brightening أو face-body',
          },
        },
        required: ['offer_key'],
      },
    },
    {
      name: 'start_checkout',
      description: 'ابدئي تسجيل الأوردر في الشات (طلب الاسم/الموبايل/العنوان). استخدميها فقط بعد موافقة صريحة على الطلب.',
      parameters: { type: SchemaType.OBJECT, properties: {} },
    },
    {
      name: 'get_points_balance',
      description: 'يرجع رصيد نقاط برنامج المكافآت الحقيقي لعميلة معينة برقم موبايلها.',
      parameters: {
        type: SchemaType.OBJECT,
        properties: { phone: { type: SchemaType.STRING, description: 'رقم موبايل العميلة (11 رقم يبدأ بـ 01)' } },
        required: ['phone']
      }
    },
    {
      name: 'get_order_status',
      description: 'يرجع حالة أوردرات العميل. لو found=false ادّي رقم خدمة العملاء ' + CS_SUPPORT_PHONE + ' فورًا.',
      parameters: {
        type: SchemaType.OBJECT,
        properties: {
          phone: { type: SchemaType.STRING, description: 'رقم موبايل العميلة (01xxxxxxxxx) — لو معروف' },
        },
      },
    },
  ]
}];

async function list_products() {
  const { data, error } = await sb.from('products')
    .select('id, name, price, old_price, size, slug, description, ingredients, skin_type, stock, rating, review_count')
    .eq('is_active', true)
    .order('sort_order');
  if (error) return { error: error.message };
  // Never expose silicone/scar gel to the chat model or customers
  return { products: filterChatProducts(data || []) };
}

function siliconeScarDeflectReply() {
  return (
    'حاليًا بنركّز على منتجات التفتيح والعناية بالبشرة يا فندم (غسول · كريم · لوشن) 💜\n' +
    'قوليلي مشكلتك (تصبغات / حب شباب / بعد ليزر) وأرشّحلك الأنسب.'
  );
}

// Used whenever the model itself couldn't produce a real answer — either
// it returned nothing (empty response) or the Gemini API call threw
// (503 overload, rate limit, network blip). Either way the customer asked
// something (often a vague price question like "بكام"/"hm"), so showing
// real prices beats silence or a bare "error, try again" that ManyChat's
// Response Mapping has no `reply` field to send at all.
async function productListFallbackReply(prefix) {
  const { products } = await list_products();
  const list = (products || []).map(p => `• ${p.name} — ${Math.round(p.price)} جنيه`).join('\n');
  return `${prefix}دي منتجاتنا المتاحة:\n\n${list}\n\nقوليلي تحبي تعرفي إيه عن أي منتج منهم 😊`;
}

/** "و الغسول" after talking about كريم التفتيح → pitch the matching cleanser, never dump catalog. */
async function tryCategoryFollowUpReply(message, sid, chatHistory, selectedBundleKey) {
  const { data: rawProducts, error } = await sb.from('products')
    .select('id, name, price, old_price, description, stock, slug')
    .eq('is_active', true);
  const products = filterChatProducts(rawProducts || []);
  if (error || !products?.length) return null;

  let histText = (chatHistory || []).map((h) => h.text || '').join('\n');
  // Ad context helps when ManyChat history is empty / short
  if (selectedBundleKey === 'brightening' || selectedBundleKey === 'post-laser') {
    histText += '\nتفتيح كريم التفتيح';
  } else if (selectedBundleKey === 'face-body') {
    histText += '\nحب الشباب';
  }

  const resolved = resolveCategoryFollowUp(message, histText, products);
  if (!resolved) return null;

  if (resolved.ambiguous === 'cleanser') {
    const w = products.find((x) => x.name === 'غسول التفتيح');
    const a = products.find((x) => /حب الشباب/.test(x.name || ''));
    const wPrice = w ? Math.round(Number(w.price) || 0) : null;
    const aPrice = a ? Math.round(Number(a.price) || 0) : null;
    const wBit = wPrice ? ` (${wPrice} جنيه)` : '';
    const aBit = aPrice ? ` (${aPrice} جنيه)` : '';
    return {
      reply: `قصدك غسول التفتيح${wBit} ولا غسول حب الشباب${aBit} يا فندم؟ 💜`,
      sessionId: sid,
    };
  }
  if (resolved.ambiguous === 'cream') {
    return {
      reply: 'قصدك كريم التفتيح ولا كريم ما بعد الليزر يا فندم؟ 💜',
      sessionId: sid,
    };
  }

  const p = resolved;
  if ((p.stock ?? 0) <= 0) {
    return {
      reply: `${p.name} غير متوفر حاليًا للأسف 😔 قوليلي وأرشّحلك بديل.`,
      sessionId: sid,
    };
  }
  const price = Math.round(p.price);
  const offer = p.old_price && p.old_price > p.price
    ? `${price} جنيه بدل ${Math.round(p.old_price)}`
    : `${price} جنيه`;
  const tip = String(p.description || '').trim().split(/[.。]/)[0] || '';
  return {
    reply:
      (tip ? `${p.name}: ${tip}.\n` : `**${p.name}**\n`) +
      `سعره **${offer}**.`,
    sessionId: sid,
  };
}

function isIngredientsOrDetailsQuestion(message) {
  // Bare "تفاصيل" = pitch the 3 offers, not product-ingredients FAQ
  if (isBareDetailsOrInfoAsk(message)) return false;
  // Usage how-to has its own path (steps), not benefits dump
  if (isUsageHowToAsk(message)) return false;
  const t = prepareCustomerText(expandFrancoAndTypos(message));
  return /(مكونات|مكون|ingredients?|تركيبة|فيه\s*ايه|التركيب|formula|تفاصيل|فايده|فوائد|له\s*(فوايد|فوائد)|فوايده|فائدته|فايدته|بيعمل\s*ايه)/i.test(t)
    || isCompositionOrWhatsInAsk(message);
}

/**
 * "طريقة الاستخدام / ازاي استخدم" — step-by-step how to apply, not product blurbs.
 */
function isUsageHowToAsk(message) {
  const t = prepareCustomerText(expandFrancoAndTypos(message));
  if (!t || t.length > 110) return false;
  return (
    /(طريق[ةه]\s*(ال)?استخدام|ازاي\s*(أ|ا)?ستخدم|إزاي\s*(أ|ا)?ستخدم|كيف\s*(أ|ا)?ستخدم|خطوات\s*(ال)?استخدام|how\s*to\s*use|usage)/i.test(t)
    || /^(و\s*)?(ال)?استخدام[\s!.،؟?]*$/i.test(t)
    || /^(طيب\s*)?(طريق[ةه]\s*(ال)?استخدام)[\s!.،؟?]*$/i.test(t)
  );
}

function formatRoutineUsageReply(sid, chatHistory, message = '') {
  const cart = sessionCarts[sid] || [];
  const cartBundle = cart.find((i) => i?.isBundle || String(i?.id || '').startsWith('bundle:'));
  const lastBot = lastModelMessage(chatHistory);
  const bundle =
    resolveBundleFromCustomerText(message)
    || (cartBundle ? getBundleByKey(cartBundle.bundleKey) : null)
    || resolveSinglePitchedBundle(lastBot)
    || (hasRecentBrighteningContext(chatHistory) ? getBundleByKey('brightening') : null)
    || getBundleByKey('brightening');

  const key = bundle?.key || 'brightening';
  let body;
  if (key === 'post-laser') {
    body =
      'طريقة استخدام **عرض عناية ما بعد الليزر** يا فندم 💜\n\n' +
      '١) **كريم ما بعد الليزر**: على بشرة نظيفة، طبّقي طبقة خفيفة على المنطقة بعد الجلسة (أو يوميًا حسب احتياجك) وسيبيه يتشرب.\n' +
      '٢) **كريم التفتيح**: بعد ما تهدأ البشرة، طبّقي طبقة خفيفة على التصبغات/الأماكن الداكنة صباح ومساء.\n\n' +
      'تجنّبي فرك قوي، ولو حصل تهيّج خفّفي الاستخدام أو استشيري متخصص.';
  } else if (key === 'face-body') {
    body =
      'طريقة استخدام **عرض عناية الوش والجسم** يا فندم 💜\n\n' +
      '١) **غسول حب الشباب**: اغسلي الوجه بلطف مرتين يوميًا (صباح ومساء) واشطفي كويس.\n' +
      '٢) **لوشن اليدين والجسم**: بعد الغسول أو الاستحمام، رطّبي الجسم واليدين باللوشن.\n\n' +
      'التزمي يوميًا عشان النتيجة تبان أوضح.';
  } else {
    // brightening — underarm / bikini / body
    body =
      'طريقة استخدام **روتين التفتيح** يا فندم 💜\n\n' +
      '١) **غسول التفتيح**: اغسلي المنطقة (اندر آرم / بيكيني / جسم أو وش) بلطف **مرتين يوميًا** صباح ومساء، واشطفي كويس.\n' +
      '٢) **كريم التفتيح**: على بشرة نظيفة ناشفة، طبّقي **طبقة خفيفة** على الأماكن الداكنة بس، ودلّكي بلطف لحد ما يتشرب.\n' +
      '٣) **لوشن اليدين والجسم**: في الآخر رطّبي نفس المنطقة باللوشن.\n\n' +
      'مع الانتظام، غالبًا فرق ملحوظ خلال حوالي **14 يوم**. لو حصل تهيّج، خفّفي الاستخدام.';
  }

  const inCart = !!(cartBundle && bundle && cartBundle.bundleKey === bundle.key);
  const closer = inCart ? '\n\nالعرض في أوردرك — تحبي نكمّل التسجيل؟ 💜' : '';

  return {
    reply: body + closer,
    sessionId: sid,
    selectedBundleKey: key,
    keepCta: true,
  };
}

/** "عباره عن ايه" / "معناه ايه" / "بيتكون من ايه" — what's in the pitched routine. */
function isCompositionOrWhatsInAsk(message) {
  const t = prepareCustomerText(expandFrancoAndTypos(message));
  if (!t || t.length > 90) return false;
  return /(عبار[ةه]\s*عن|عبارتها|عبارته|معناه|معناها|يعني\s*ايه|يعني\s*إيه|بيتكون|بتتكون|مكون\s*من|ايه\s*هو|إيه\s*هو|ايه\s*هي|إيه\s*هي|what\s*(is|'s)\s*it|what\s*does\s*it\s*(include|contain))/i.test(t)
    || /^(عبار[ةه]|معناه|معناها|ايه\s*ده|إيه\s*ده|ايه\s*دا|إيه\s*دا)[\s!.،؟?]*$/i.test(t);
}

/**
 * "بينفع للبكيني؟ / مناسب تحت الإبط؟ / للوجه ولا سينسيتيف اريا؟"
 * — suitability FAQ, never re-pitch price-only.
 */
function isAreaSuitabilityQuestion(message) {
  const t = softNormalizeAr(expandFrancoAndTypos(String(message || '')));
  if (!t || t.length > 140) return false;
  const area = /(ب\s*ي?\s*كين[يى]|bikini|تحت\s*ال[إا]بط|اندر\s*ارم|الارم|الأرم|\barm\b|ذراع|دراع|جسم|مناطق\s*حساس|المنطق[ةه]\s*الحساس|اماكن\s*حساس|الأماكن\s*الحساس)/i;
  const faceVsArea =
    /(للوجه|الوجه|وش).{0,40}(ولا|أو|او|ولا\s*ل).{0,40}(مناطق\s*حساس|حساس|جسم|بكين)/i.test(t)
    || /(مناطق\s*حساس|حساس|بكين).{0,40}(ولا|أو|او).{0,40}(وجه|وش)/i.test(t)
    || /(غسول|كريم|لوشن).{0,50}(للوجه|الوجه).{0,30}(ولا|أو|او)/i.test(t);
  if (faceVsArea) return true;
  if (!area.test(t)) return false;
  if (/(ينفع|بينفع|تنفع|بتنفع|مناسب|يصلح|بيصلح|للوجه|ولا)/i.test(t)) return true;
  if (/(برضو|برضوا|برضه|كمان)/i.test(t) && /(ل|على|في)/i.test(t)) return true;
  return false;
}

async function areaSuitabilityReply(sid, chatHistory, message = '') {
  const askBlob = softNormalizeAr(expandFrancoAndTypos(String(message || '')))
    || (() => {
      for (let i = (chatHistory || []).length - 1; i >= 0; i--) {
        if (chatHistory[i]?.role === 'user') {
          return softNormalizeAr(expandFrancoAndTypos(String(chatHistory[i].text || '')));
        }
      }
      return '';
    })();
  const aboutCleanser = /غسول/.test(askBlob);
  const faceVs = /(للوجه|الوجه|وش).{0,40}(ولا|أو|او)/i.test(askBlob)
    || /(مناطق\s*حساس|حساس)/i.test(askBlob);

  if (aboutCleanser && faceVs) {
    const cleanserPrice = await productUnitPriceBySlug('whitening-cleanser');
    const priceLine = cleanserPrice ? `\nسعره **${cleanserPrice}** جنيه.` : '';
    let reply =
      'غسول التفتيح **ينفع للاتنين** يا فندم 💜\n' +
      'تقدري تستخدميه على **الوجه** وعلى **المناطق الحساسة** والجسم حسب المكان اللي محتاج تفتيح.' +
      priceLine;
    const bundle = getBundleByKey('brightening');
    const cart = sessionCarts[sid] || [];
    const inCart = !!(bundle && cart.some((i) => i.bundleKey === bundle.key || i.id === `bundle:${bundle.key}`));
    if (inCart) {
      reply += '\n\nروتين التفتيح موجود في أوردرك — تحبي نكمل؟';
    } else if (bundle) {
      reply += `\n\nولو حابة روتين كامل (غسول + كريم + لوشن) بـ **${bundle.bundlePrice}** مع شحن مجاني قوليلي 💜`;
    }
    return {
      reply,
      sessionId: sid,
      selectedBundleKey: 'brightening',
      keepCta: true,
    };
  }

  const bundle = getBundleByKey('brightening');
  const cart = sessionCarts[sid] || [];
  const inCart = !!(bundle && cart.some((i) => i.bundleKey === bundle.key || i.id === `bundle:${bundle.key}`));
  const pitched = historyAlreadyPitchedBundle(chatHistory, 'brightening');
  let reply =
    'أيوه يا فندم 💜 روتين التفتيح مناسب للبكيني والمناطق الحساسة وتحت الإبط والجسم.';
  if (inCart) {
    reply += '\n\nالعرض موجود في أوردرك — تحبي نكمل التسجيل؟';
  } else if (pitched && bundle) {
    reply +=
      `\n\nنفس **${bundle.name}** بـ **${bundle.bundlePrice}** جنيه (شحن مجاني) — تحبي أسجلكِ الأوردر؟`;
  } else if (bundle) {
    reply += `\n\n${formatBundlePriceReply(bundle)}`;
  }
  return {
    reply,
    sessionId: sid,
    selectedBundleKey: 'brightening',
    keepCta: true,
  };
}

/**
 * Pregnancy FAQ: "نفع للحامل/للحوامل؟"
 * We answer with safe, general advice (no medical claims), never re-pitch offers.
 */
function isPregnancyQuestion(message) {
  const t = prepareCustomerText(expandFrancoAndTypos(String(message || '')));
  if (!t || t.length > 140) return false;
  // Breastfeeding belongs here too — same answer, same reason. And "آمن
  // للحوامل؟" is the plainest form of the question, so the safety word alone
  // has to be enough; requiring a separate "ينفع" missed it.
  const hasPreg = /(حوامل|حامل|الحمل|الحامل|مرضع|بارضع|برضع|الرضاع|رضاعه)/i.test(t);
  if (!hasPreg) return false;
  return /(نفع|ينفع|مناسب|يصلح|تنفع|آمن|امن|ا?مان|سلام[ةه]|استخدام|استخدم|اقدر|ممكن|خطر|يضر|ضرر)/i.test(t);
}

function pregnancySuitabilityReply(sid, chatHistory) {
  // Never says safe or unsafe — that is her doctor's call, not the bot's — and
  // deliberately does not ask for the order. Telling a pregnant customer to see
  // her doctor and pushing the checkout in the same breath undoes the advice.
  const reply =
    'في الحمل والرضاعة يا فندم، ده قرار طبيبك مش قرارنا 💜\n' +
    'استشيري طبيبك أو الصيدلي قبل الاستخدام — هو الوحيد اللي يقدر يقولك المناسب لحالتك.';

  return {
    reply,
    sessionId: sid,
    selectedBundleKey: 'brightening',
    keepCta: true,
  };
}

/** "المنتج طبيعي؟" — ingredients/nature, not MOH dump. */
function isNaturalProductQuestion(message) {
  const t = prepareCustomerText(expandFrancoAndTypos(message));
  if (!t || t.length > 120) return false;
  return /(طبيع[يةي]|natural|عضوي|من\s*مكونات\s*طبيع)/i.test(t)
    && !/(حوامل|حامل|ضمان|ارجاع)/i.test(t);
}

function naturalProductReply() {
  return (
    'المنتجات تركيبتها فيها مكونات طبيعية فعّالة يا فندم (زي مستخلص العرقسوس، فيتامين C، زبدة الشيا…) 💜\n' +
    'وكمان واخدة موافقة وزارة الصحة برقم **COSMTOL25117170**.\n' +
    'لو حابة مكونات منتج معيّن قوليلي اسمه.'
  );
}

/** "لكل الناس ولا ناس وناس / بتنفع مع أشخاص" — results vary. */
function isResultsVaryByPersonQuestion(message) {
  const t = prepareCustomerText(expandFrancoAndTypos(message));
  if (!t || t.length > 160) return false;
  return /(ناس\s*وناس|شخص\s*(ل|و)?شخص|اشخاص|أشخاص|مش\s*كل\s*الناس|لكل\s*الناس|بينفع\s*مع|بتنفع\s*مع|نتائج\s*تختلف|يختلف)/i.test(t);
}

function resultsVaryByPersonReply() {
  return (
    'صح يا فندم 💜 النتايج بتختلف من شخص لشخص حسب طبيعة البشرة والالتزام بالروتين.\n' +
    'مع الاستخدام المنتظم، كتير من العملاء بيشوفوا فرق ملحوظ خلال حوالي **14 يوم**.\n' +
    'مهم إنكِ تستخدمي الروتين يوميًا وتتابعي بشرتك.'
  );
}

const {
  getStockistPharmacies,
  formatStockistsForBot,
} = require('./ownerCompanyDocs');

async function loadStockistBotText() {
  try {
    const list = await getStockistPharmacies();
    return formatStockistsForBot(list);
  } catch (e) {
    console.warn('[chat] stockists load failed:', e.message);
    return '';
  }
}

function isStockistPharmacyAsk(message) {
  const t = prepareCustomerText(expandFrancoAndTypos(message));
  if (!t || t.length > 180) return false;
  if (/^(الصيدليات|صيدليات|pharmacies?)[\s!.؟?]*$/i.test(t)) return true;
  if (/(فين|وين|أين|where).{0,24}(ألاقي|القي|نلاقي|اجيب|أجيب|buy|find|صيدلي)/i.test(t)) return true;
  if (/(متوفر|بتتباع|بتباع|موجود).{0,20}(فين|وين|صيدلي)/i.test(t)) return true;
  if (/(صيدلي[ةاات]|pharmac(y|ies)).{0,30}(فين|وين|قريب|عندكم|تتوفر|موجود)/i.test(t)) return true;
  if (/(عند\s*(أنهي|انهي|انهى|أيه|اي|ايّه)\s*صيدلي)/i.test(t)) return true;
  return false;
}

function matchStockistRegion(message, regions) {
  const t = softNormalizeAr(String(message || ''));
  const aliases = [
    { re: /(6\s*اكتوبر|6\s*أكتوبر|السادس\s*من\s*اكتوبر|السادس\s*من\s*أكتوبر|october)/i, keys: ['6 أكتوبر'] },
    { re: /فيصل/i, keys: ['فيصل'] },
    { re: /(القاهر[ةه]|cairo)/i, keys: ['القاهرة'] },
  ];
  for (const a of aliases) {
    if (a.re.test(t)) {
      const hit = regions.find((r) => a.keys.some((k) => softNormalizeAr(r) === softNormalizeAr(k) || r.includes(k.replace(/^ال/, ''))));
      if (hit) return hit;
      const exact = regions.find((r) => a.keys.includes(r));
      if (exact) return exact;
    }
  }
  for (const r of regions) {
    const rn = softNormalizeAr(r);
    if (rn && t.includes(rn)) return r;
  }
  return null;
}

async function replyStockistPharmacies(message, sid) {
  let list = [];
  try {
    list = (await getStockistPharmacies()).filter((p) => p.active !== false);
  } catch (e) {
    console.warn('[chat] stockists reply failed:', e.message);
  }
  if (!list.length) {
    return {
      reply: `حالياً تقدري تطلبي من الموقع والشحن لكل المحافظات 💜\nولو حابة صيدلية قريبة، كلمينا على ${CS_SUPPORT_PHONE}`,
      sessionId: sid,
    };
  }
  const byRegion = new Map();
  for (const p of list) {
    const r = p.region || 'أخرى';
    if (!byRegion.has(r)) byRegion.set(r, []);
    byRegion.get(r).push(p);
  }
  const regions = [...byRegion.keys()];
  const region = matchStockistRegion(message, regions);
  const lines = ['منتجات مونتانيا متوفرة في الصيدليات دي يا فندم 💜'];
  if (region && byRegion.has(region)) {
    lines.push(`\n**${region}:**`);
    for (const p of byRegion.get(region)) {
      lines.push(p.link ? `• ${p.name} — ${p.link}` : `• ${p.name}`);
    }
  } else {
    for (const [r, rows] of byRegion) {
      lines.push(`\n**${r}:** ${rows.map((p) => p.name).join('، ')}`);
    }
    lines.push('\nقوليلي منطقتك وأرشّحلك الأقرب.');
  }
  lines.push('\nتقدري كمان تطلبي من الموقع بالتوصيل 🛒');
  return { reply: lines.join('\n'), sessionId: sid };
}

/** Guarantee / safety / "لو صار فيني حاجة" — Ministry of Health approval (not return policy). */
function isGuaranteeOrSafetyQuestion(message) {
  const t = prepareCustomerText(expandFrancoAndTypos(message));
  if (!t || t.length > 220) return false;
  // Never treat a delivery address as a guarantee question ("الثامن" contains "امن")
  if (looksLikeAddressOnly(t)) return false;
  if (isNaturalProductQuestion(message) || isResultsVaryByPersonQuestion(message)) return false;
  if (/(ضمان|ضمانه|ضمانة|warranty|guarantee)/i.test(t)) return true;
  if (/(^|[^\u0600-\u06FFa-zA-Z])(آمن|آمنة|آمنين|امن\b|امنه|امنين|safety|مرخص|مرخصة|ترخيص)([^\u0600-\u06FFa-zA-Z]|$)/i.test(t)) {
    return true;
  }
  if (/(وزار[ةه]\s*الصح)/i.test(t)) return true;
  if (/(لو\s*(صار|حصل|حصلي)|صار\s*فيني|حصلي\s*حاج|مسبب|يضرر|يأذي|حساسي[ةه])/i.test(t)) return true;
  // "آثار جانبية / هرش / بشرة حساسة" — safety, NOT silicone gel
  if (/(اثر|اثار|آثار)\s*جانب/.test(t)) return true;
  if (/(هرش|حكه|حكة|تحسس|حساسيه|حساسية)/.test(t) && /(كريم|غسول|لوشن|منتج|استعمل|بستخدم)/.test(t)) {
    return true;
  }
  if (/(بشرتي\s*حساس|بشرة\s*حساس|جلد\s*حساس)/.test(t)) return true;
  return false;
}

function guaranteeMinistryReply() {
  return (
    'المنتجات واخدة موافقة من وزارة الصحة يا فندم برقم **COSMTOL25117170** 💜\n' +
    'آمنة ومرخّصة للاستخدام.\n' +
    'لو بشرتكِ حساسة جدًا، ابدئي بكمية صغيرة على منطقة بسيطة واختبريها أولًا.'
  );
}

/** "امتى النتائج / امتى يبان الفرق" — timeline, never re-pitch the offer. */
function isResultsTimelineQuestion(message) {
  const t = prepareCustomerText(expandFrancoAndTypos(message));
  if (!t || t.length > 140) return false;
  if (/(امتى|إمتى|متى|وقت|كام\s*يوم|كام\s*اسبوع|قد\s*ايه).{0,40}(نتيج|نتائج|يفرق|يبان|يظهر|يطلع)/i.test(t)) {
    return true;
  }
  if (/(نتيج|نتائج|يفرق|يبان|يظهر|يطلع).{0,40}(امتى|إمتى|متى|وقت|كام\s*يوم|كام\s*اسبوع|قد\s*ايه)/i.test(t)) {
    return true;
  }
  if (/^(امتى|إمتى|متى)\s*(يطلع|تطلع|يبان|تبان|تظهر|يظهر)?\s*(ال)?(نتيج|نتائج)/i.test(t)) return true;
  if (/نتيج|نتائج/.test(t) && /(امتى|إمتى|متى|سريع|بسرعه|بسرعة)/i.test(t)) return true;
  return false;
}

function resultsTimelineReply() {
  return (
    'مع الاستخدام المنتظم يا فندم، نتايج ملحوظة عادةً خلال **14 يوم** 💜\n' +
    'وكل ما التزمتي بالروتين يوميًا، النتيجة بتبان أوضح.'
  );
}

/**
 * "بيفتّح قد إيه؟" — how MUCH does it lighten. Different from "امتى تبان
 * النتيجة" (timing) and from "بيستخدم لإيه" (indications). The bot used to
 * answer with what the product treats plus a price, which reads as dodging
 * the question at the exact moment she is deciding whether it suits her.
 *
 * "فاد" for "قد" is a very common phone-keyboard slip and must still match.
 */
function isLighteningDegreeQuestion(message) {
  const t = prepareCustomerText(expandFrancoAndTypos(message));
  if (!t || t.length > 140) return false;
  if (!/(يفتح|بيفتح|هيفتح|تفتيح|فاتح)/i.test(t)) return false;
  return /(قد\s*ا?يه?|فاد\s*ا?يه?|كام\s*درج|كام\s*لون|درجات|ad\s*eh)/i.test(t);
}

function lighteningDegreeReply() {
  return (
    'مع الاستخدام المنتظم **فرق ملحوظ خلال 4 أسابيع** يا فندم 💜\n' +
    'والنتيجة بتختلف من بشرة للتانية حسب نوع التصبغ ودرجته ومدته.\n\n' +
    'دواعي استعمال تجميلية للعناية بالبشرة.'
  );
}

/**
 * A dark body area — underarm, elbows, knees, bikini line. The right answer is
 * the whitening cream, with the brightening routine as the stronger option.
 *
 * Deterministic on purpose. A customer wrote "انا مش بعمل ليزر بس عندي الاندر
 * ارم غامق" and the model latched onto the word "ليزر", ignored the negation
 * right before it, and pitched the 369 post-laser cream to someone who had just
 * ruled laser out. The regex resolver already got this right; only the model
 * was wrong, so the answer must not depend on the model.
 */
function isDarkAreaBrighteningAsk(message) {
  const t = prepareCustomerText(expandFrancoAndTypos(message));
  if (!t || t.length > 200) return false;
  const area = /(تحت\s*ال[اإ]بط|اندر\s*ارم|الاكواع|الاكو[اع]|الركب|الرقبه|الدراع|الذراع|الايد|اليدين|الرجل|الساق|بيكين[يى]|bikini|(مناطق|اماكن)[^\n]{0,6}حساس)/i;
  if (!area.test(t)) return false;
  // "غسول التفتيح ده للوجه ولا للمناطق الحساسة؟" — she named a product and is
  // asking where it may be used. That is a suitability question about that
  // product, not an open request for a recommendation; answering with the
  // generic pitch ignores what she actually asked.
  if (/(غسول|كريم|لوشن)/i.test(t) && /(ولا|للوجه|عل[يى]\s*الوجه)/i.test(t)) return false;
  // Not ours: itching, hair, smell, sweat, pain. Whole words only — as bare
  // substrings "الم" sits inside "المناطق" and "شعر" inside plenty else, which
  // quietly rejected the very messages this exists to serve.
  if (/(^|\s)(بيحك|حكه|هرش|شعر|ازاله|ازالة|ريحه|ريحة|عرق|تعرق|الم|وجع|بيوجع|بيوجعني)(\s|$|[.,،!؟?])/i.test(t)) {
    return false;
  }
  // Colour words settle it. So does simply wanting something for that area —
  // "نا عايزه تحت الابط" and "تفتيح الاماكن الحساسه" are plainly this request,
  // and demanding a separate colour word missed both.
  return /(غامق|غامقه|اسمر|سمرا|تفتيح|يفتح|بيفتح|تصبغ|لون)/i.test(t)
    || /(عايز|عاوز|محتاج|نفس[يى]|ابغى|ممكن)/i.test(t);
}

function darkAreaBrighteningReply() {
  return (
    'لتفتيح المناطق الغامقة زي تحت الإبط والأكواع والركب، المناسب **كريم التفتيح** — **249** ج 💜\n\n' +
    'ولو حابة نتيجة أقوى: **روتين التفتيح الكامل** (غسول التفتيح + كريم التفتيح + لوشن اليدين والجسم) ' +
    'بـ **777** ج والشحن **مجاني** 🎁\n\n' +
    'تحبي الكريم لوحده ولا الروتين؟'
  );
}

/**
 * "مش بعمل ليزر" on its own. She has ruled the post-laser cream out and said
 * nothing about what she does want — so ask, rather than guess. Matching the
 * bare word "ليزر" pitched her the 369 cream she had just excluded.
 */
function deniesDoingLaser(message) {
  const t = prepareCustomerText(expandFrancoAndTypos(message));
  if (!t || t.length > 160) return false;
  if (!/ليزر/.test(t)) return false;
  return /(مش|ما)\s*(ب|ه|هت|بت)?(عمل|عملت|عملش|اعمل|هعمل)\w*\s*(ال)?ليزر/i.test(t)
    || /(مبعملش|معملتش|مش\s*عامل[ةه]?|عمر[يى]\s*ما\s*عملت)\s*(ال)?ليزر/i.test(t)
    || /(مش|ما)\s*(ال)?ليزر/i.test(t);
}

function laserDeniedAskConcernReply() {
  return (
    'تمام يا فندم 💜 يبقى كريم ما بعد الليزر مش اللي محتاجاه.\n\n' +
    'احكيلي بشرتك محتاجة إيه بالظبط — تفتيح؟ تصبغات؟ حبوب؟ ترطيب؟ ' +
    'وأرشحلك المناسب على طول.'
  );
}

/**
 * A named skin condition — eczema, psoriasis, urticaria, rosacea, vitiligo.
 * These are medical, and the bot answered "لوشن اليدين والجسم بتاعنا مناسب
 * جدًا للأكزيما" out of its own head, while ignoring urticaria altogether.
 *
 * Note this is NOT "بشرتي حساسة": ordinary sensitive skin is a cosmetic
 * concern the products speak to, and gets the normal suitability answer.
 */
function namesSkinCondition(message) {
  const t = prepareCustomerText(expandFrancoAndTypos(message));
  if (!t || t.length > 200) return false;
  return /(اكزيما|أكزيما|اكزما|eczema|صدفي[ةه]|psoriasis|ارتكاريا|أرتكاريا|ارتيكاريا|urticaria|شر[ىي]\b|وردي[ةه]\s*الوجه|rosacea|روزاسيا|بهاق|vitiligo|التهاب\s*جلد|حساسي[ةه]\s*جلدي|امراض\s*جلدي|مرض\s*جلدي)/i.test(t);
}

function skinConditionReply() {
  return (
    'منتجاتنا **تجميلية للعناية بالبشرة**، مش منتجات علاجية يا فندم 💜\n\n' +
    'مع حالة زي دي، استشيري **طبيب الجلدية** قبل الاستخدام — هو اللي يقدر يقولك ' +
    'المناسب لحالتك بالظبط.'
  );
}

function isReturnPolicyQuestion(message) {
  const t = prepareCustomerText(expandFrancoAndTypos(message));
  if (!t || t.length > 140) return false;
  // Explicit return/exchange — NOT guarantee/safety
  if (isGuaranteeOrSafetyQuestion(message) && !/(ارجاع|إرجاع|استبدال|مرتجع|أرجع|ارجع|return|exchange)/i.test(t)) {
    return false;
  }
  return /(ارجاع|إرجاع|استبدال|مرتجع|أقدر\s*أرجع|ارجع\s*(ال)?منتج|return|exchange|refund)/i.test(t);
}

function returnPolicyReply() {
  return (
    'لو حابة ترجعي أو تستبدلي المنتج يا فندم: خلال **14 يوم** من الاستلام، ' +
    'بشرط يبقى في حالته الأصلية ومتفتحش/متستخدميش 💜\n' +
    'كلي خدمة العملاء: 01019787225.'
  );
}

/**
 * Intent-first FAQ: classifier meaning OR regex safety net.
 * Overrides wrong PRODUCT_INTEREST / SELECT_OFFER when the customer clearly asked FAQ.
 */
function resolveFaqIntent(classified, message, chatHistory = []) {
  // Hard override: pregnancy questions should NOT be treated as bikini/area suitability,
  // even if the classifier wrongly outputs ASK_SUITABILITY from context.
  if (isPregnancyQuestion(message)) return 'ASK_PREGNANCY';
  if (isShowProductsLookAsk(message)) return null; // handled deterministically with site link
  if (isBareDetailsOrInfoAsk(message)) return null; // → 3 offers, not ingredients FAQ
  if (isWhiteningEffectAsk(message)) return 'ASK_WHITENING_EFFECT';
  if (isUsageHowToAsk(message)) return 'ASK_USAGE';
  if (isCompositionOrWhatsInAsk(message)) return 'ASK_BENEFITS';
  if (isIngredientsContextFollowUp(message, chatHistory)) return 'ASK_INGREDIENTS';
  if (isNaturalProductQuestion(message)) return 'ASK_NATURAL';
  if (isResultsVaryByPersonQuestion(message)) return 'ASK_RESULTS_VARY';
  // Shipping / governorate cost — never suitability or sales FAQ
  if (isShippingCostQuestion(message)) return null;
  // "اسود جدا" after underarm talk → routine pitch, not suitability FAQ
  if (isBrighteningSeverityFollowUp(message, chatHistory)) return null;

  const fromModel = classified?.intent;
  if (FAQ_INTENTS.has(fromModel)) {
    // Classifier often misfires ASK_SUITABILITY on severity / pigmentation intensifiers
    if (fromModel === 'ASK_SUITABILITY' && isBrighteningSeverityFollowUp(message, chatHistory)) {
      return null;
    }
    // "الشحن لبني سويف" must not become ASK_SUITABILITY from prior جسم talk
    if (fromModel === 'ASK_SUITABILITY' && /شحن/.test(prepareCustomerText(expandFrancoAndTypos(message)))) {
      return null;
    }
    return fromModel;
  }
  if (isGuaranteeOrSafetyQuestion(message)) return 'ASK_GUARANTEE';
  if (isStockistPharmacyAsk(message)) return 'ASK_STOCKIST_PHARMACIES';
  if (isResultsTimelineQuestion(message)) return 'ASK_RESULTS';
  if (isReturnPolicyQuestion(message)) return 'ASK_RETURN';
  if (isAreaSuitabilityQuestion(message)) return 'ASK_SUITABILITY';
  if (isIngredientsOrDetailsQuestion(message)) {
    const t = prepareCustomerText(expandFrancoAndTypos(message));
    if (/(مكونات|مكون|تركيبة|ingredients?|formula)/i.test(t) && !/(فايده|فوائد|بيعمل)/i.test(t)) {
      return 'ASK_INGREDIENTS';
    }
    return 'ASK_BENEFITS';
  }
  return null;
}

async function replyForFaqIntent(faqIntent, message, sid, chatHistory, selectedProductSlug = null) {
  if (faqIntent === 'ASK_WHITENING_EFFECT') {
    return replyWhiteningEffectAsk(message, sid, chatHistory, selectedProductSlug);
  }
  if (faqIntent === 'ASK_GUARANTEE') {
    return { reply: guaranteeMinistryReply(), sessionId: sid };
  }
  if (faqIntent === 'ASK_STOCKIST_PHARMACIES') {
    return replyStockistPharmacies(message, sid);
  }
  if (faqIntent === 'ASK_RESULTS') {
    return { reply: resultsTimelineReply(), sessionId: sid };
  }
  if (faqIntent === 'ASK_RETURN') {
    return { reply: returnPolicyReply(), sessionId: sid };
  }
  if (faqIntent === 'ASK_SUITABILITY') {
    return areaSuitabilityReply(sid, chatHistory, message);
  }
  if (faqIntent === 'ASK_PREGNANCY') {
    return pregnancySuitabilityReply(sid, chatHistory);
  }
  if (faqIntent === 'ASK_NATURAL') {
    return { reply: naturalProductReply(), sessionId: sid };
  }
  if (faqIntent === 'ASK_RESULTS_VARY') {
    return { reply: resultsVaryByPersonReply(), sessionId: sid };
  }
  if (faqIntent === 'ASK_USAGE') {
    return formatRoutineUsageReply(sid, chatHistory, message);
  }
  if (faqIntent === 'ASK_BENEFITS' || faqIntent === 'ASK_INGREDIENTS') {
    const namedBundle = resolveBundleFromCustomerText(message);
    // "عباره عن ايه" / named routine benefits → explain that routine
    if (isCompositionOrWhatsInAsk(message) || faqIntent === 'ASK_BENEFITS') {
      const explained = await formatActiveRoutineExplainReply(sid, chatHistory, {
        checkoutNudge: (sessionCarts[sid] || []).some((i) => i?.isBundle || String(i?.id || '').startsWith('bundle:')),
        message,
      });
      if (explained && (
        namedBundle
        || isCompositionOrWhatsInAsk(message)
        || historyAlreadyPitchedBundle(chatHistory, explained.selectedBundleKey)
        || (sessionCarts[sid] || []).some((i) => i?.isBundle)
      )) {
        return explained;
      }
    }
    const details = await tryProductDetailsAnswer(message, sid, chatHistory);
    if (details?.reply) return details;
    if (faqIntent === 'ASK_INGREDIENTS') {
      // Generic follow-up like "والغسول والكريم" after brightening routine context:
      // answer the requested routine parts instead of falling back to a sales pitch.
      if (isIngredientsContextFollowUp(message, chatHistory) && hasRecentBrighteningContext(chatHistory)) {
        const { data: products } = await sb.from('products')
          .select('name, ingredients, slug')
          .in('slug', ['whitening-cleanser', 'whitening-cream', 'hand-body-lotion']);
        const narrowed = narrowProductsByGenericWords(message, products || []);
        if (narrowed.length) {
          return {
            reply: narrowed.map((p) => `**${p.name}**\nالمكونات: ${String(p.ingredients || '').trim() || 'غير متاحة حاليًا'}`).join('\n\n'),
            sessionId: sid,
          };
        }
      }
      return {
        reply: 'قوليلي اسم المنتج أو العرض بالظبط وأقولك المكونات 💜',
        sessionId: sid,
      };
    }
    // Benefits with active routine context — never "أنهي منتج تقصدي"
    const explained = await formatActiveRoutineExplainReply(sid, chatHistory, {
      checkoutNudge: (sessionCarts[sid] || []).some((i) => i?.isBundle || String(i?.id || '').startsWith('bundle:')),
      message,
    });
    if (explained && (
      namedBundle
      || historyAlreadyPitchedBundle(chatHistory, explained.selectedBundleKey)
      || (sessionCarts[sid] || []).some((i) => i?.isBundle)
    )) {
      return explained;
    }
    return {
      reply: 'قوليلي أنهي عرض أو منتج تقصدي وأقولك فوايده 💜',
      sessionId: sid,
    };
  }
  return null;
}

function isPointsProgramQuestion(message) {
  const t = prepareCustomerText(expandFrancoAndTypos(message));
  if (!t || t.length > 120) return false;
  // Explicit points / loyalty
  if (/(نقاط|points|loyalty|مكافآ|مكافا|المكافات)/i.test(t)) {
    return true;
  }
  // "ماشي البرنامج اي" / "البرنامج ايه" — after checkout mentions برنامج النقاط
  // Avoid \b with Arabic (JS word-boundary is ASCII-only and fails on اي).
  if (/(ال)?برنامج/.test(t) && /(ايه|إيه|اي|يعني|شرح|ازاي|إزاي|كام|فايده|فائدة|what|how)/i.test(t)) {
    return true;
  }
  if (/^(ال)?برنامج[\s!.،؟?]*$/i.test(t)) return true;
  return false;
}

// Exact customer-facing checkout choice — do NOT add "say X or Y" scripts.
const CHECKOUT_CHOICE_Q =
  'تحبي تسجّلي الأوردر معايا هنا ولا على الموقع علشان تستفيدي ببرنامج النقاط؟';

function explainPointsShort() {
  return (
    `برنامج النقاط بسيط يا فندم 💜\n` +
    `كل 10 جنيه شراء من الموقع = نقطة، والنقاط تخصم من طلباتك الجاية.\n\n` +
    CHECKOUT_CHOICE_Q
  );
}

function explainPointsPayload() {
  return { reply: explainPointsShort(), keepCta: true };
}

function lastBotOfferedProductCatalog(chatHistory) {
  const last = lastModelMessage(chatHistory);
  return /منتجاتنا المتاحة|تحبي تعرفي إيه عن أي منتج/i.test(last || '');
}

function lastBotSharedIngredients(chatHistory) {
  const last = lastModelMessage(chatHistory);
  return /المكونات\s*:/i.test(last || '');
}

function lastUserAskedIngredients(chatHistory) {
  for (let i = (chatHistory || []).length - 1; i >= 0; i--) {
    if (chatHistory[i]?.role !== 'user') continue;
    return isIngredientsOrDetailsQuestion(chatHistory[i].text || '');
  }
  return false;
}

function isIngredientsContextFollowUp(message, chatHistory) {
  const t = prepareCustomerText(expandFrancoAndTypos(message));
  if (!t || t.length > 80) return false;
  if (!(lastUserAskedIngredients(chatHistory) || lastBotSharedIngredients(chatHistory))) return false;
  if (isExplicitCheckoutIntent(message) || isPriceQuestion(message)) return false;
  return /^(و\s*)?(ال)?(غسول|كريم|لوشن|سيليكون|جل|ليزر)(\s*و\s*(ال)?(غسول|كريم|لوشن|سيليكون|جل|ليزر))*[\s!.،؟?]*$/i.test(t)
    || /(غسول|كريم|لوشن).*(غسول|كريم|لوشن)/i.test(t);
}

function isPluralIngredientsAsk(message) {
  const t = prepareCustomerText(expandFrancoAndTypos(message));
  return /(مكوناتهم|مكوناتها|مكونات\s*دول|الاتنين|الاثنين|كلاهما|الاتنين|both)/i.test(t);
}

function recentContextProductsForDetails(chatHistory, products) {
  const list = Array.isArray(products) ? products : [];
  const picked = new Map();

  const addProducts = (items) => {
    for (const p of items || []) {
      if (p?.id != null) picked.set(String(p.id), p);
    }
  };

  for (let i = (chatHistory || []).length - 1, seen = 0; i >= 0 && seen < 8; i--) {
    const turn = chatHistory[i];
    if (!turn?.text) continue;
    seen += 1;

    addProducts(resolveProductMentions(turn.text, list));

    const bundle =
      resolveSinglePitchedBundle(turn.text)
      || resolveBundleFromCustomerText(turn.text);
    if (bundle?.productSlugs?.length) {
      addProducts(list.filter((p) => bundle.productSlugs.includes(p.slug)));
    }
  }

  return [...picked.values()];
}

function narrowProductsByGenericWords(message, candidates) {
  const t = prepareCustomerText(expandFrancoAndTypos(message));
  const list = Array.isArray(candidates) ? candidates : [];
  if (!t || !list.length) return [];

  const wants = {
    cleanser: /غسول/.test(t),
    cream: /كريم/.test(t),
    lotion: /لوشن/.test(t),
    gel: /(سيليكون|جل|ندب)/.test(t),
    laser: /ليزر/.test(t),
  };

  if (!Object.values(wants).some(Boolean)) return [];

  return list.filter((p) => {
    const pn = softNormalizeAr(p.name);
    if (wants.cleanser && /غسول/.test(pn)) return true;
    if (wants.cream && /كريم/.test(pn)) return true;
    if (wants.lotion && /لوشن/.test(pn)) return true;
    if (wants.gel && /(سيليكون|جل|ندب)/.test(pn)) return true;
    if (wants.laser && /ليزر/.test(pn)) return true;
    return false;
  });
}

function bundleProductsForDetails(message, products, chatHistory, sid = null) {
  const list = Array.isArray(products) ? products : [];
  const fromText = resolveBundleFromCustomerText(message);
  if (fromText?.productSlugs?.length) {
    return list.filter((p) => fromText.productSlugs.includes(p.slug));
  }
  if (sid) {
    const cart = sessionCarts[sid] || [];
    const cartBundle = cart.find((i) => i?.isBundle || String(i?.id || '').startsWith('bundle:'));
    const fromCart = cartBundle ? getBundleByKey(cartBundle.bundleKey) : null;
    if (fromCart?.productSlugs?.length) {
      return list.filter((p) => fromCart.productSlugs.includes(p.slug));
    }
  }
  for (let i = (chatHistory || []).length - 1, seen = 0; i >= 0 && seen < 8; i--) {
    const turn = chatHistory[i];
    if (!turn?.text) continue;
    seen += 1;
    const bundle =
      resolveSinglePitchedBundle(turn.text)
      || resolveBundleFromCustomerText(turn.text);
    if (bundle?.productSlugs?.length) {
      return list.filter((p) => bundle.productSlugs.includes(p.slug));
    }
  }
  return [];
}

/** Explain what's in the active routine (composition / benefits). */
async function formatActiveRoutineExplainReply(sid, chatHistory, { checkoutNudge = false, message = '' } = {}) {
  const cart = sessionCarts[sid] || [];
  const cartBundle = cart.find((i) => i?.isBundle || String(i?.id || '').startsWith('bundle:'));
  const lastBot = lastModelMessage(chatHistory);
  const bundle =
    resolveBundleFromCustomerText(message)
    || (cartBundle ? getBundleByKey(cartBundle.bundleKey) : null)
    || resolveSinglePitchedBundle(lastBot)
    || getBundleByKey('brightening');
  if (!bundle) return null;

  const { data: products } = await sb.from('products')
    .select('name, description, ingredients, slug')
    .in('slug', bundle.productSlugs || []);
  const bySlug = new Map((products || []).map((p) => [p.slug, p]));
  const lines = (bundle.productSlugs || []).map((slug, idx) => {
    const p = bySlug.get(slug);
    const label = bundle.productLabels[idx] || p?.name || slug;
    const tip = String(p?.description || '').trim().split(/[.。]/)[0] || '';
    return tip ? `• **${label}** — ${tip}` : `• **${label}**`;
  });

  const inCart = !!(cartBundle && cartBundle.bundleKey === bundle.key);
  const closer = inCart || checkoutNudge
    ? '\n\nلو حابة نكمّل قولي «نكمل» 💜'
    : '\n\nلو حابة تاخدي الروتين قولي «محتاج العرض» أو «أوردر» 💜';

  return {
    reply:
      `**${bundle.name}** عبارة عن **${bundle.productLabels.length} منتجات** بيكملوا بعض` +
      (bundle.key === 'brightening' ? ' لتفتيح الأماكن الحساسة والجسم والتصبغات' : '') +
      `:\n${lines.join('\n')}\n\n` +
      `السعر **${bundle.bundlePrice}** جنيه — الشحن **مجاني** 🎁` +
      closer,
    sessionId: sid,
    selectedBundleKey: bundle.key,
    keepCta: true,
  };
}

function hasRecentBrighteningContext(chatHistory) {
  for (let i = (chatHistory || []).length - 1, seen = 0; i >= 0 && seen < 8; i--) {
    const turn = chatHistory[i];
    if (!turn?.text) continue;
    seen += 1;
    if (historyAlreadyPitchedBundle([turn], 'brightening')) return true;
    if (/روتين\s*التفتيح|التفتيح\s*الكامل|777|699|غسول\s*التفتيح|كريم\s*التفتيح|لوشن\s*اليدين\s*والجسم/i.test(turn.text)) {
      return true;
    }
  }
  return false;
}

// Deterministic product details/ingredients — Gemini often fails mid-tool-call
// and productListFallbackReply dumps the full catalog (live bug: "ايه مكونات
// المنتج" → قائمة المنتجات، ثم "كريم التفتيح" → نفس القائمة تاني).
// Also: "مكوناتهم" after naming 2 products, then "والغسول" must stay on ingredients
// — not flip to a sales pitch (live Nada transcript).
async function tryProductDetailsAnswer(message, sid, chatHistory) {
  const askingDetails = isIngredientsOrDetailsQuestion(message);
  const ingredientsContext =
    askingDetails ||
    lastUserAskedIngredients(chatHistory) ||
    lastBotSharedIngredients(chatHistory);

  const shortMsg =
    String(message || '').trim().length > 0 &&
    String(message || '').trim().length < 80;

  const followUpPick = shortMsg && (
    lastBotOfferedProductCatalog(chatHistory) ||
    (ingredientsContext && !askingDetails)
  );

  if (!askingDetails && !followUpPick) return null;
  if (followUpPick && (isExplicitCheckoutIntent(message) || isPriceQuestion(message))) {
    return null;
  }

  const { data: products, error } = await sb.from('products')
    .select('id, name, price, description, ingredients, size, skin_type, stock')
    .eq('is_active', true);
  if (error || !products?.length) return null;

  let matched = resolveProductMentions(message, products);
  const t = prepareCustomerText(expandFrancoAndTypos(message));
  const lastBot = lastModelMessage(chatHistory);
  const fromBot = resolveProductMentions(lastBot, products);

  const genericTypeCount = ['غسول', 'كريم', 'لوشن', 'سيليكون', 'جل', 'ليزر']
    .filter((w) => new RegExp(w).test(t)).length;

  // Generic ingredient asks like "الغسول والكريم واللوشن" often match only
  // one explicit catalog name (usually lotion). Expand them from bundle/context.
  if ((askingDetails || ingredientsContext) && genericTypeCount >= 2) {
    const bundleProducts = bundleProductsForDetails(message, products, chatHistory, sid);
    const narrowed = narrowProductsByGenericWords(message, bundleProducts);
    if (narrowed.length > matched.length) matched = narrowed;
  }

  // "مكوناتهم" / plural → every product the bot just mentioned
  if (askingDetails && (isPluralIngredientsAsk(message) || !matched.length) && fromBot.length) {
    if (isPluralIngredientsAsk(message) || !matched.length) {
      matched = fromBot;
    }
  }

  if (!matched.length && /(اختارت|اخترت|اللي\s*في\s*(ال)?أ?وردر|اللي\s*ضفت|المنتج\s*(ده|دا|الي|اللي)?)/i.test(t)) {
    const cart = sessionCarts[sid] || [];
    if (cart.length === 1) {
      matched = products.filter((p) => p.id === cart[0].id);
    } else if (cart.length > 1) {
      return {
        reply: `قصدك أنهي منتج يا فندم؟\n${cart.map((c) => `• ${c.name}`).join('\n')}`,
        sessionId: sid,
      };
    }
  }

  if (!matched.length && askingDetails) {
    for (let i = (chatHistory || []).length - 1; i >= 0; i--) {
      if (chatHistory[i]?.role !== 'user') continue;
      matched = resolveProductMentions(chatHistory[i].text || '', products);
      break;
    }
  }

  if (!matched.length && askingDetails) {
    const pitched = resolveSinglePitchedBundle(lastBot);
    if (pitched?.productSlugs?.length) {
      matched = products.filter((p) => pitched.productSlugs.includes(p.slug));
    }
  }

  // Generic "الغسول والكريم واللوشن" during ingredients flow:
  // use the discussed bundle's products, then narrow by the requested words.
  if (!matched.length && (askingDetails || ingredientsContext)) {
    const bundleProducts = bundleProductsForDetails(message, products, chatHistory, sid);
    const narrowed = narrowProductsByGenericWords(message, bundleProducts);
    if (narrowed.length) matched = narrowed;
    else if (askingDetails && bundleProducts.length && isPluralIngredientsAsk(message)) matched = bundleProducts;
  }

  if (!matched.length && askingDetails) {
    const cart = sessionCarts[sid] || [];
    if (cart.length === 1) matched = products.filter((p) => p.id === cart[0].id);
  }

  // Follow-up "والغسول" after ingredients — resolve against products the bot
  // just talked about (bare "الغسول" won't match full product names alone).
  if (!matched.length && followUpPick && ingredientsContext) {
    matched = resolveProductMentions(message, products);
    if (!matched.length && fromBot.length) {
      const hint = t;
      const narrowed = fromBot.filter((p) => {
        const pn = softNormalizeAr(p.name);
        if (/غسول/.test(hint) && /غسول/.test(pn)) return true;
        if (/كريم/.test(hint) && /كريم/.test(pn)) return true;
        if (/لوشن/.test(hint) && /لوشن/.test(pn)) return true;
        if (/(سيليكون|جل|ندب)/.test(hint) && /(سيليكون|جل|ندب)/.test(pn)) return true;
        if (/ليزر/.test(hint) && /ليزر/.test(pn)) return true;
        return false;
      });
      matched = narrowed.length ? narrowed : matched;
    }
  }

  // "الغسول والكريم واللوشن" then "والغسول والكريم" — recover from recent
  // customer/model context, not just the very last bot turn.
  if (!matched.length && followUpPick && ingredientsContext) {
    const contextProducts = recentContextProductsForDetails(chatHistory, products);
    const narrowed = narrowProductsByGenericWords(message, contextProducts);
    if (narrowed.length) matched = narrowed;
  }

  // Composition / "عباره عن ايه" with pitched or cart routine → all routine products
  if (!matched.length && askingDetails) {
    const bundleProducts = bundleProductsForDetails(message, products, chatHistory, sid);
    if (bundleProducts.length) matched = bundleProducts;
  }

  if (!matched.length) {
    if (askingDetails) {
      // Last resort: explain active routine instead of "قوليلي اسم المنتج"
      if (isCompositionOrWhatsInAsk(message) || hasRecentBrighteningContext(chatHistory)) {
        const explained = await formatActiveRoutineExplainReply(sid, chatHistory, {
          checkoutNudge: (sessionCarts[sid] || []).some((i) => i?.isBundle),
        });
        if (explained) return explained;
      }
      return {
        reply: 'قوليلي اسم المنتج بالظبط وأقولك مكوناته 💜',
        sessionId: sid,
      };
    }
    return null;
  }

  // Stay on ingredients when context is ingredients (including "والغسول")
  const wantIngredients =
    askingDetails ||
    lastUserAskedIngredients(chatHistory) ||
    lastBotSharedIngredients(chatHistory) ||
    lastBotOfferedProductCatalog(chatHistory);

  const compositionAsk = isCompositionOrWhatsInAsk(message);
  const lines = matched.map((p) => {
    const ing = String(p.ingredients || '').trim();
    const desc = String(p.description || '').trim();
    const wantBenefits = compositionAsk || /(فايده|فوائد|له\s*(فوايد|فوائد)|فوايده|فائدته|فايدته|بيعمل)/i.test(t);
    if (wantBenefits) {
      if (desc) return `**${p.name}**\n${desc}`;
      if (ing) return `**${p.name}**\nالمكونات: ${ing}`;
      return `**${p.name}**\nمن روتين مونتانيا للعناية بالبشرة 💜`;
    }
    if (wantIngredients && !compositionAsk) {
      if (ing) return `**${p.name}**\nالمكونات: ${ing}`;
      if (desc) return `**${p.name}**\n${desc}`;
      return `**${p.name}**\nالسعر ${Math.round(p.price)} جنيه`;
    }
    if (ing && desc && /(تفاصيل|فايده|فوائد|بيعمل)/i.test(t)) {
      return `**${p.name}**\n${desc}\n\nالمكونات: ${ing}`;
    }
    const bits = [`**${p.name}**`];
    if (ing) bits.push(`المكونات: ${ing}`);
    else if (desc) bits.push(desc);
    else bits.push(`السعر ${Math.round(p.price)} جنيه`);
    return bits.join('\n');
  });

  const pitchedBundle = resolveSinglePitchedBundle(lastBot);
  const wantBenefitsAsk = compositionAsk || /(فايده|فوائد|له\s*(فوايد|فوائد)|فوايده|فائدته|فايدته|بيعمل)/i.test(t);
  const bundleNote = pitchedBundle && wantBenefitsAsk
    ? `\n\nدول مع بعض في روتين **${pitchedBundle.name}** وبيكمّلوا بعض 💜`
    : '';
  const cartHasBundle = (sessionCarts[sid] || []).some((i) => i?.isBundle || String(i?.id || '').startsWith('bundle:'));
  const checkoutNote = cartHasBundle && compositionAsk ? '\n\nتحبي نكمل الأوردر؟ 💜' : '';

  return {
    reply: lines.join('\n\n') + bundleNote + checkoutNote,
    sessionId: sid,
  };
}

async function smartGeminiFallback(message, sid, chatHistory, prefix, selectedBundleKey) {
  const fromAd = getBundleByKey(selectedBundleKey);
  if (
    fromAd
    && (isPriceQuestion(message) || isVagueOfferQuestion(message) || isRoutineOrOfferPriceAsk(message))
    && !wantsSingleSkuOnly(message)
    && !isFewNamedProductsPriceAsk(message)
    && !isBothOfThemPriceAsk(message)
  ) {
    return formatBundlePriceReply(fromAd);
  }
  if (isExplicitCheckoutIntent(message)) {
    if (fromAd) {
      return formatBundlePriceReply(fromAd);
    }
    if (lastBotHandedOffToCs(lastModelMessage(chatHistory))) {
      return `${prefix}تحت أمرك يا فندم 💜 خدمة العملاء على 01019787225 هتساعدك.`;
    }
    return `${prefix}${askWhatSheNeedsReply('')}`.trim();
  }
  if (isWholeSetOrCollectionAsk(message)) {
    if (fromAd) return formatBundlePriceReply(fromAd);
    return `${prefix}${emptyCartOfferRoutinesReply()}`;
  }
  if (isShippingCostQuestion(message)) {
    return shippingPolicyReply(sid);
  }
  if (isGuaranteeOrSafetyQuestion(message)) {
    return guaranteeMinistryReply();
  }
  if (isResultsTimelineQuestion(message)) {
    return resultsTimelineReply();
  }
  const follow = await tryCategoryFollowUpReply(message, sid, chatHistory, selectedBundleKey);
  if (follow?.reply) return follow.reply;
  const details = await tryProductDetailsAnswer(message, sid, chatHistory);
  if (details) return details.reply;
  if (isIngredientsOrDetailsQuestion(message)) {
    return `${prefix}قوليلي اسم المنتج بالظبط وأقولك مكوناته 💜`;
  }
  if (isPointsProgramQuestion(message)) return explainPointsShort();
  if (isPriceQuestion(message) || isRoutineOrOfferPriceAsk(message) || isVagueOfferQuestion(message)) {
    // Unit SKU asks ("ليزر لوحده") must not become the 618 routine
    if (!wantsSingleSkuOnly(message) && !isFewNamedProductsPriceAsk(message)) {
      const fromText = resolveBundleFromCustomerText(message);
      if (fromText) return formatBundlePriceReply(fromText);
    }
    // Owner's rule: ask which one, rather than reciting a priced list she
    // never asked for. The full list stays for when she does ask for it.
    return `${prefix}` + askWhatSheNeedsReply('').trim();
  }
  return productListFallbackReply(prefix);
}

function isShippingCostQuestion(message) {
  const t = prepareCustomerText(expandFrancoAndTypos(message));
  if (!t || t.length > 120) return false;
  // Course/pair price+shipping is owned by brightening pair path (free ship on 777)
  if (isCleanserCreamPairAsk(message)) return false;
  // "التوصيل لشبرا بكام" = cost, not ETA
  const deliveryCostAsk =
    /(ال)?توصيل.{0,50}(مصاريف|كام|بكام|سعر|قد\s*ايه)/i.test(t)
    || /(مصاريف|تكلفة|تكلفه|سعر|كام|بكام).{0,40}(ال)?توصيل/i.test(t);
  return /^(و\s*)?(ال)?شحن([\s!.،؟?]*)$/i.test(t)
    || /^(و\s*)?(مصاريف|تكلفة|تكلفه)\s*(ال)?شحن/i.test(t)
    || /(مصاريف|تكلفة|تكلفه|سعر|كام|بكام).{0,40}(ال)?شحن/i.test(t)
    || /(ال)?شحن.{0,50}(مصاريف|كام|بكام|سعر|قد\s*ايه|حضرتك|محافظ|مجاني|gratis|free)/i.test(t)
    || /(مجاني|gratis|free).{0,40}(ال)?شحن/i.test(t)
    || /محافظ[ةه].{0,40}(ال)?شحن|(ال)?شحن.{0,40}محافظ[ةه]/i.test(t)
    || /^(كام\s*(ال)?شحن|سعر\s*(ال)?شحن|(ال)?شحن\s*(بكام|كام)|how\s*much\s*(is\s*)?shipping)/i.test(t)
    || deliveryCostAsk
    // "م قلت الشحن مجاني" / "ليه الشحن مش مجاني" / "انا قلت مجاني"
    || (/(م\s*قلت|قلت|قولت|ليه|ازاي|إزاي|مش\s*مجاني|كان\s*مجاني)/i.test(t) && /شحن|مجاني/.test(t));
}

/** Pull a governorate out of "الشحن لمحافظة بني سويف بكام". */
async function extractGovernorateFromShippingAsk(message) {
  const t = prepareCustomerText(expandFrancoAndTypos(message));
  if (!t) return null;
  // Token-only cleanup — never strip bare "ل"/"في" as substrings (breaks الغربية / الفيوم).
  const cleaned = t
    .replace(/(و\s*)?(ال)?شحن/g, ' ')
    .replace(/(و\s*)?(ال)?توصيل/g, ' ')
    .replace(/محافظ[ةه]/g, ' ')
    // "للفيوم" / "للقاهرة" (ل + الـ → لل) → back to الـ
    .replace(/(?:^|\s)لل(?=\S)/g, ' ال')
    .replace(/(?:^|\s)ل(?=ال)/g, ' ')
    .replace(/(?:^|\s)(?:بكام|بكم|كام|سعر|مصاريف|تكلفة|تكلفه|قد\s*ايه|الي|إلى|الى|في|فى|لو|لـ|ل)(?=\s|$)/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (cleaned.length >= 2) {
    const hit = await matchGovernorateName(cleaned);
    if (hit) return hit;
  }
  return matchGovernorateName(t);
}

async function shippingCostReplyForMessage(message, sid) {
  const gov = await extractGovernorateFromShippingAsk(message);
  if (gov) {
    if (cartGetsFreeShipping(sessionCarts[sid] || [])) {
      return `لـ **${gov.governorate}** الشحن عندك **مجاني** 🎁 كاش عند الاستلام.`;
    }
    const cost = Math.round(Number(gov.cost) || 0);
    // Just the number — don't spam "free from 3 products" on every shipping ask
    return `الشحن لـ **${gov.governorate}** بـ **${cost}** جنيه يا فندم 💜`;
  }
  return shippingPolicyReply(sid);
}

async function list_governorates() {
  const { data, error } = await sb.from('shipping_rates')
    .select('governorate, cost')
    .eq('is_active', true)
    .order('sort_order');
  if (error) return { error: error.message };
  return { governorates: data };
}

async function add_to_cart(args, sid) {
  const productId = Number(args.product_id);
  const qty = Math.max(1, Math.floor(Number(args.qty)) || 1);
  const { data: p, error } = await sb.from('products').select('id, name, price, image_url, stock, slug').eq('id', productId).single();
  if (error || !p) return { error: 'منتج غير معروف — استخدمي list_products عشان تاخدي id صحيح' };
  if (isChatExcludedProduct(p)) {
    return { error: 'المنتج ده مش ضمن عروض الشات — رشّحي غسول/كريم/لوشن تفتيح أو عناية' };
  }
  if ((p.stock ?? 0) <= 0) return { error: 'المنتج نفذ من المخزون حاليًا — رشحي منتج تاني بديل' };
  const cappedQty = Math.min(qty, p.stock);

  const cart = sessionCarts[sid] || (sessionCarts[sid] = []);
  const existing = cart.find(i => i.id === p.id);
  if (existing) existing.qty = cappedQty;
  else cart.push({ id: p.id, name: p.name, image: p.image_url, price: p.price, qty: cappedQty });

  return view_cart(sid);
}

async function remove_from_cart(args, sid) {
  const productId = Number(args.product_id);
  const cart = sessionCarts[sid] || [];
  if (!cart.length) {
    return {
      error: 'cart_empty',
      message: 'الأوردر فاضي — لو عاوز تعدّل طلب اتسجّل (MON-xxxxx)، محتاج رقم الموبايل.',
    };
  }
  sessionCarts[sid] = cart.filter(i => i.id !== productId);
  return view_cart(sid);
}

/** Count sellable product pieces in cart (bundles expand to their product lines). */
function cartProductCount(cart) {
  const items = Array.isArray(cart) ? cart : [];
  let n = 0;
  for (const i of items) {
    const qty = Math.max(1, Math.floor(Number(i?.qty) || 1));
    if (i?.isBundle || String(i?.id || '').startsWith('bundle:')) {
      const slugs = Array.isArray(i.productSlugs) ? i.productSlugs.length : 0;
      const ids = Array.isArray(i.productIds) ? i.productIds.length : 0;
      const pieces = Math.max(slugs, ids, 1);
      n += pieces * qty;
    } else {
      n += qty;
    }
  }
  return n;
}

/**
 * Free shipping when:
 * - 3+ products in the order, OR
 * - cart is only one of the 3 ad routine offers (even if that offer has 2 SKUs)
 */
function cartGetsFreeShipping(cart) {
  const items = Array.isArray(cart) ? cart : [];
  if (!items.length) return false;
  if (cartProductCount(items) >= 3) return true;
  return items.every((i) => i?.isBundle || String(i?.id || '').startsWith('bundle:'));
}

function formatOrderShippingPhrase(shipping) {
  const s = Number(shipping) || 0;
  if (s <= 0) return '**شحن مجاني**';
  return `شحن **${Math.round(s)}** جنيه`;
}

function shippingPolicyReply(sid) {
  const cart = sessionCarts[sid] || [];
  if (cartGetsFreeShipping(cart)) {
    const n = cartProductCount(cart);
    if (n >= 3) {
      return 'معاكي **3 منتجات أو أكتر** — الشحن **مجاني** 🎁 كاش عند الاستلام.';
    }
    return 'عشان معاكي عرض روتين من العروض التلاتة، الشحن **مجاني** 🎁 كاش عند الاستلام.';
  }
  if (cart.length) {
    const n = cartProductCount(cart);
    const left = Math.max(0, 3 - n);
    return (
      `صح يا فندم — الشحن **مش** مجاني على منتج واحد أو اتنين.\n` +
      `دلوقتي معاكي **${n}** منتج — الشحن حسب المحافظة.\n` +
      (left
        ? `زوّدي **${left}** كمان ويبقى الشحن **مجاني** (من 3 منتجات) 💜\n`
        : '') +
      'أو اختاري عرض روتين (زي روتين التفتيح **777**) والشحن مجاني برضه.'
    );
  }
  return (
    'الشحن **مجاني** من **3 منتجات** في الأوردر 🎁\n' +
    'وعروض الروتين التلاتة (تفتيح · ما بعد الليزر · الوش والجسم) شحن مجاني برضه.\n' +
    'أقل من 3 منتجات فردية = الشحن حسب المحافظة 💜'
  );
}

function view_cart(sid) {
  const cart = sessionCarts[sid] || [];
  const subtotal = cart.reduce((s, i) => s + i.price * i.qty, 0);
  return {
    cart: cart.map((i) => ({
      id: i.id,
      name: i.name,
      price: i.price,
      qty: i.qty,
      isBundle: !!i.isBundle,
      bundleKey: i.bundleKey || null,
    })),
    subtotal,
    freeShipping: cartGetsFreeShipping(cart),
  };
}

async function create_order(args, sid, channel) {
  const name = args.name;
  const phone = normalizePhone(args.phone) || args.phone;
  const address = args.address;
  const governorate = args.governorate;
  const cart = sessionCarts[sid] || [];
  if (!name || !phone || !address || !governorate) {
    return { error: 'بيانات ناقصة — لازم الاسم والموبايل والعنوان والمحافظة' };
  }
  if (!normalizePhone(phone)) {
    return { error: 'رقم الموبايل مش صحيح — لازم 01xxxxxxxxx' };
  }
  if (!isUsableDeliveryAddress(address)) {
    return { error: 'العنوان ناقص — لازم المنطقة والشارع وعلامة مميزة (مش اسم المحافظة بس)' };
  }
  if (/^(مش\s*(ده|دا)|غلط)/i.test(String(name || '').trim())) {
    return { error: 'الاسم مش واضح — ابعتي الاسم الثلاثي صح' };
  }
  if (!cart.length) {
    return { error: 'الأوردر فاضي — ارجعي للشات وضيفي منتج الأول' };
  }

  // Expand bundle cart entities using website retail unit prices (perk = free shipping).
  const expanded = [];
  for (const it of cart) {
    if (it.isBundle && Array.isArray(it.productSlugs) && it.productSlugs.length) {
      const { data: bProds, error: bErr } = await sb.from('products')
        .select('id, name, price, image_url, slug, stock')
        .in('slug', it.productSlugs)
        .eq('is_active', true);
      if (bErr || !bProds?.length) return { error: 'تعذّر التحقق من منتجات العرض' };
      const ordered = it.productSlugs.map((s) => bProds.find((p) => p.slug === s)).filter(Boolean);
      if (ordered.length !== it.productSlugs.length) return { error: 'منتجات العرض غير مكتملة' };
      if (ordered.some((p) => (p.stock ?? 0) < (it.qty || 1))) {
        return { error: 'مخزون غير كافٍ لأحد منتجات العرض' };
      }
      const units = allocateBundleUnitPrices(ordered, it.price || getBundleByKey(it.bundleKey)?.bundlePrice);
      for (let i = 0; i < ordered.length; i++) {
        const p = ordered[i];
        expanded.push({
          id: p.id,
          name: p.name,
          image: p.image_url,
          price: units[i],
          qty: it.qty || 1,
          bundleSlug: it.bundleSlug || getBundleByKey(it.bundleKey)?.slug,
        });
      }
    } else {
      expanded.push(it);
    }
  }

  const ids = expanded.map((i) => i.id).filter((id) => typeof id === 'number' || /^\d+$/.test(String(id)));
  // stock comes along so create_order can tell the owner when this order
  // pushes a product to low / zero (see lib/stockAlerts.js).
  const { data: products, error: pErr } = await sb.from('products').select('id, name, price, image_url, stock').in('id', ids);
  if (pErr || !products || !products.length) return { error: 'تعذّر التحقق من المنتجات' };

  const orderItems = [];
  let subtotal = 0;
  for (const it of expanded) {
    const p = products.find((x) => String(x.id) === String(it.id));
    if (!p) return { error: `منتج غير معروف: ${it.id}` };
    const unit = it.bundleSlug != null ? Number(it.price) : Number(p.price);
    orderItems.push({
      id: p.id,
      name: p.name,
      image: p.image_url,
      price: unit,
      qty: it.qty,
      ...(it.bundleSlug ? { bundleSlug: it.bundleSlug } : {}),
    });
    subtotal += unit * it.qty;
  }

  const { data: govMatch } = await sb.from('shipping_rates')
    .select('governorate, cost')
    .ilike('governorate', `%${governorate}%`)
    .eq('is_active', true)
    .limit(1)
    .single();
  if (!govMatch) return { error: 'المحافظة دي مش متاحة، لازم تستخدمي list_governorates وتختاري اسم من القائمة بالظبط' };

  // Free shipping: 3+ products OR pure ad-routine cart.
  const shipping = cartGetsFreeShipping(cart) ? 0 : (Number(govMatch.cost) || 0);
  const promo = await getPromo();
  // Routine bundles keep their own perk — free shipping — and are left out of
  // the percentage so they are not discounted twice.
  const promoBase = cart
    .filter((i) => !(i?.isBundle || String(i?.id || '').startsWith('bundle:')))
    .reduce((sum, i) => sum + (Number(i?.price) || 0) * (Number(i?.qty) || 1), 0);
  const promoDiscount = promoDiscountFor(promoBase, promo);
  const total = Math.max(0, subtotal - promoDiscount) + shipping;
  const deposit = 0;

  const { data: order, error: oErr } = await sb.rpc('create_guest_order', {
    p_customer: { name, phone, address, city: govMatch.governorate },
    p_items: orderItems,
    p_payment_method: 'cod',
    p_delivery_method: 'standard',
    p_subtotal: subtotal,
    p_shipping_cost: shipping,
    p_discount: promoDiscount,
    p_total: total,
    p_governorate: govMatch.governorate,
    p_deposit_amount: deposit,
    p_chat_session_id: sid,
    // ManyChat's automations already send an explicit "messenger"/"instagram"
    // hint with every request — channelOf(sid) alone can't tell them apart
    // since ManyChat unifies both under the same "manychat:<contact id>"
    // session prefix. Losing that distinction here (not just in the chat
    // session record, which a prior fix already handles) meant the Telegram
    // "confirm order" button could never tell notifyCustomerOrderConfirmed()
    // an order's customer was actually on Instagram.
    p_chat_channel: ['messenger', 'instagram', 'whatsapp'].includes(channel) ? channel : channelOf(sid),
  });
  if (oErr) return { error: 'حصلت مشكلة أثناء إنشاء الأوردر، حاول تاني' };

  let transferNumber = '', transferName = '';
  try {
    const { data: n } = await sb.from('site_settings').select('value').eq('key', 'instapay_wallet_number').single();
    const { data: nm } = await sb.from('site_settings').select('value').eq('key', 'instapay_wallet_name').single();
    transferNumber = n?.value || ''; transferName = nm?.value || '';
  } catch (e) { /* bot can still confirm the order without the transfer number handy */ }

  sessionCarts[sid] = []; // order placed — start the next one empty

  const orderNumber = order?.order?.order_number || order?.order_number;

  // Telegram notification used to be fired from the BROWSER
  // (checkout.html / complete-order.html / chat-widget.js), so orders placed
  // through Messenger/Instagram — where there is no browser — never reached
  // Telegram at all. Notify from the server, where every order passes.
  // Never let a Telegram failure lose an order that is already saved.
  try {
    const { notifyTelegramOrder, tgConfigured } = require('./telegramOrderNotify');
    if (tgConfigured() && orderNumber) {
      const tg = await notifyTelegramOrder({
        order_number: orderNumber,
        total,
        customer_name: name,
        customer_phone: phone,
        deposit_amount: deposit,
        payment_method: 'cod',
      });
      if (!tg?.ok) console.warn('[telegram] chat order not delivered', orderNumber, tg?.error);
    }
  } catch (e) {
    console.warn('[telegram] chat order notify threw', orderNumber, e.message);
  }

  // Tell the owner when this order pushed something to low / zero stock.
  const stockBefore = {};
  for (const p of products || []) stockBefore[String(p.id)] = p.stock;
  await notifyStockCrossings(orderItems, stockBefore, orderNumber);

  return {
    id: order?.order?.id || null,
    order_number: orderNumber,
    phone,
    customer_name: name,
    shipping,
    free_shipping: shipping <= 0,
    total,
    deposit_amount: deposit,
    transfer_number: transferNumber,
    transfer_name: transferName,
    city: govMatch.governorate,
    payment_method: 'cod',
    items: Array.isArray(order?.items)
      ? order.items
      : orderItems.map((i) => ({
          product_id: i.id,
          product_name: i.name,
          price: i.price,
          quantity: i.qty,
          total: i.price * i.qty,
        })),
  };
}

function show_checkout_form(sid) {
  return { action: 'form_shown', ...view_cart(sid) };
}

// Used by tryExplicitAddToCart below to match an explicit product mention
// (requires its own explicit "add to cart" phrase, unlike the removed
// autoDetectCartAdd which used to match on product-name substrings alone —
// that silently added a product to the customer's order from a bare price
// question or symptom description, with no purchase intent at all).
function bigrams(name) {
  const words = name.split(/\s+/).filter(Boolean);
  const pairs = [];
  for (let i = 0; i < words.length - 1; i++) pairs.push(words[i] + ' ' + words[i + 1]);
  return pairs;
}

// Cross-sell pairing, mirrors the "## البيع" prompt guidance — used only by
// the deterministic fast path below.
const CROSS_SELL_PAIRS = {
  'غسول التفتيح': 'كريم التفتيح',
  'كريم التفتيح': 'غسول التفتيح',
  'غسول علاج حب الشباب للوجه': 'لوشن اليدين والجسم',
};

// "اسم منتج محدد + فعل إضافة صريح" (e.g. "ضيفي غسول التفتيح للسلة") kept
// getting intercepted by the LLM's own diagnostic-question instinct even
// after several prompt rewrites — the model just wouldn't reliably treat
// an explicit named-product command as an exception to the "ask about skin
// type first" rule. Handling this one narrow, unambiguous case in code
// (matching the existing "don't trust the model with the cart" pattern)
// makes it 100% reliable instead of hoping the prompt wins that tug of war.
async function tryExplicitAddToCart(message, sid) {
  const text = message.trim();
  // Requires an explicit cart-action phrase, not just any product mention —
  // otherwise a plain price question ("غسول التفتيح بكام؟") would silently
  // add it to the cart without the customer asking for that.
  if (!/(للسلة|فالسلة|بالسلة|للأوردر|بالأوردر|ضيفي|ضيفلي|حطيلي)/i.test(text)) return null;

  const { data: products, error } = await sb.from('products').select('id, name, price, image_url, stock').eq('is_active', true);
  if (error || !products) return null;

  const matched = products.find((p) => bigrams(p.name).some((bg) => text.includes(bg)));
  if (!matched) return null;

  if ((matched.stock ?? 0) <= 0) {
    return { reply: `للأسف ${matched.name} نفذ من المخزون حاليًا يا فندم 😔 تحبي أرشحلك بديل؟`, sessionId: sid };
  }

  const cart = sessionCarts[sid] || (sessionCarts[sid] = []);
  if (!cart.find((i) => i.id === matched.id)) {
    cart.push({ id: matched.id, name: matched.name, image: matched.image_url, price: matched.price, qty: 1 });
  }

  let crossSellLine = '';
  const pairName = CROSS_SELL_PAIRS[matched.name];
  if (pairName && !cart.find((i) => i.name === pairName)) {
    const pairProduct = products.find((p) => p.name === pairName && (p.stock ?? 0) > 0);
    if (pairProduct) crossSellLine = `\n\nتحبي أضيف معاه **${pairProduct.name}** كمان؟ بيكمل معاه في نفس الروتين 💜`;
  }

  return {
    reply: `تمام يا فندم، **${matched.name}** بسعر ${Math.round(matched.price)} جنيه أضفته لأوردرك 💜${crossSellLine}`,
    sessionId: sid,
  };
}

// Matches a bare price question with no product named in it at all —
// "بكام؟", "سعرهم كام؟", "السعر كام؟" — as opposed to "غسول التفتيح بكام؟"
// (which names a product and is left to the model, which already handles
// "specific product + price" correctly). Anchored to the whole message so
// it only fires on a genuinely bare question, never a longer sentence that
// happens to contain "كام" elsewhere.
function isPriceQuestion(message) {
  const t = prepareCustomerText(expandFrancoAndTypos(message)).replace(/بكم/g, 'بكام');
  if (!t || t.length > 80) return false;
  if (isBarePriceWordAsk(message)) return true;
  if (/^(و\s*)?(بكم|بكام|ب كام|كام|كام\s*ده|كام\s*السعر|السعر\s*كام|سعر(ه|ها|هم)?\s*كام|(?:ال)?اسعار(?:\s*كام)?|ايه\s*(?:ال)?اسعار|سعر(ه|ها|هم)?\s*(كام|إيه|ايه)|كام\s*سعر(ه|ها|هم)?|how\s*much|price\??|hm|bkam)[؟?!.\s]*$/i.test(t)) {
    return true;
  }
  // "سعره كام وحجمه قد ايه" / "والسعر والحجم"
  if (/سعر(ه|ها|هم)?/.test(t) && /(كام|بكام|بكم|قد\s*ايه|حجم)/.test(t)) return true;
  if (/حجم(ه|ها|هم)?/.test(t) && /(كام|قد\s*ايه|مل|ml|سعر)/i.test(t)) return true;
  // سعر الروتين / الروتين بكام / بكام العرض (ad customers)
  if (/(بكم|بكام|ب\s*كام|(?:ال)?سعر|كام|price).{0,30}((?:ال)?عرض|(?:ال)?روتين|روتين|الوتين)/i.test(t)) return true;
  if (/((?:ال)?عرض|(?:ال)?روتين|روتين|الوتين).{0,30}(بكم|بكام|ب\s*كام|(?:ال)?سعر|كام|price)/i.test(t)) return true;
  // بكام الغسول / بكام الكريم / بكام الغسول والكريم / بوست ليزر لوحده بكام
  if (/(بكم|بكام|ب\s*كام|(?:ال)?سعر|كام).{0,40}(غسول|كريم|لوشن|ليزر)/i.test(t)) return true;
  if (/(غسول|كريم|لوشن|ليزر|ما\s*بعد\s*الليزر|بعد\s*الليزر).{0,40}(بكم|بكام|ب\s*كام|(?:ال)?سعر|كام)/i.test(t)) return true;
  if (isBothOfThemPriceAsk(message) || isCleanserCreamPairAsk(message) || isFewNamedProductsPriceAsk(message)) return true;
  return false;
}

/** Follow-up on the product from the ad ("سعره كام"، "حجمه قد ايه") — not a routine dump. */
function isProductAdFollowUpAsk(message) {
  const t = prepareCustomerText(expandFrancoAndTypos(message)).replace(/بكم/g, 'بكام');
  if (!t || t.length > 90) return false;
  // "ما في أقل من السعر" is haggle — not a sticky SKU re-pitch
  if (isPriceHaggleAsk(message)) return false;
  if (/(العرض|الروتين|العروض|التلات|كورس|مجموعه|مجموعة|سعرالعرض)/i.test(t)) return false;
  if (/سعر\s*ال?عرض|بكام\s*ال?عرض/i.test(t)) return false;
  // Named a different product family → let normal resolver handle
  const namedOther =
    (/غسول/.test(t) && !/كريم|ليزر/.test(t))
    || (/لوشن/.test(t) && !/كريم|غسول/.test(t));
  if (namedOther) return false;
  return (
    /سعر(ه|ها|هم)?/.test(t)
    || /حجم(ه|ها|هم)?/.test(t)
    || /احجام|أحجام/.test(t)
    || /^(و\s*)?(بكام|بكم|كام|قد\s*ايه)[\s!.،؟?]*$/i.test(t)
    || /(بكام|بكم|كام|قد\s*ايه).{0,20}(حجم|سعر|مل|احجام|أحجام)/i.test(t)
    || /(تفاصيل|فايده|فوائد|مكونات).{0,15}$/i.test(t)
  );
}

/** "بكام الغسول لوحده" / "عايزه الغسول بس" — unit SKU, never dump the 3 offers. */
function wantsSingleSkuOnly(message) {
  const t = prepareCustomerText(expandFrancoAndTypos(message)).replace(/بكم/g, 'بكام');
  if (!t || t.length > 100) return false;
  // Suitability / face-vs-sensitive is FAQ — not a price ask
  if (isAreaSuitabilityQuestion(message)) return false;
  if (isCleanserCreamPairAsk(message) || isBothOfThemPriceAsk(message)) return false;
  if (/(روتين|عرض|كورس|مجموعه|مجموعة)/.test(t) && !/(بس|فقط|لوحده)/.test(t)) return false;
  const product = /(غسول|كريم|لوشن|ليزر|ما\s*بعد\s*الليزر)/.test(t);
  const alone = /(لوحده|لو\s*حده|وحده|(^|[\s])بس([\s!.،؟?]|$)|فقط)/i.test(t);
  if (product && alone) return true;
  // Named single SKU price clarify — only when clearly asking price, not usage
  if (/غسول\s*التفتيح/.test(t) && !/(روتين|عرض|كورس|والكريم|واللوشن|وجه|حساس|ينفع|مناسب|ولا)/.test(t)) return true;
  if (/كريم\s*التفتيح/.test(t) && alone) return true;
  // "البوست ليزر بكام" / "كريم بعد الليزر بكام" — unit SKU, not the 618 routine
  if (/ليزر/.test(t) && /(بكام|بكم|سعر|كام)/.test(t) && !/(روتين|عرض|كورس|والتفتيح|وكريم\s*التفتيح)/.test(t)) {
    return true;
  }
  return false;
}

/**
 * "اسعار المنتجات لوحدها" / "منتج لوحده" — full unit price list (not the 3 routine offers).
 */
function isUnitProductsPriceListAsk(message) {
  const t = prepareCustomerText(expandFrancoAndTypos(message)).replace(/بكم/g, 'بكام');
  if (!t || t.length > 120) return false;
  if (/(روتين|عرض)\s*(ال)?(كامل|التفتيح|ليزر)/.test(t) && !/(منتج|منتجات|لوحد)/.test(t)) return false;
  return (
    /(اسعار|أسعار|سعر).{0,30}(المنتجات|منتجات|المنتج|منتج)/i.test(t)
    || /(المنتجات|منتجات|المنتج|منتج).{0,30}(اسعار|أسعار|سعر|بكام|كام)/i.test(t)
    || /(المنتجات|منتجات).{0,20}(لوحدها|لوحده|لو\s*حدها|لو\s*حده|بس|فقط|فردي)/i.test(t)
    || /(عايز(ة|ه)?|محتاج(ة|ه)?|اقصد|أقصد).{0,30}(منتج|منتجات).{0,15}(لوحد|لو\s*حد|بس|فقط)/i.test(t)
    || /^(اسعار|أسعار)\s*(ال)?منتجات([\s!.،؟?]|مونتان|montana)*/i.test(t)
    || /منتج\s*(واحد|لوحده|لو\s*حده)/i.test(t)
    || /(اسعار|أسعار|سعر).{0,20}(مونتان|montana)/i.test(t)
  );
}

async function unitProductsPriceListReply(sid) {
  const { data: raw, error } = await sb.from('products')
    .select('id, name, price, stock, slug')
    .eq('is_active', true)
    .order('sort_order');
  const products = filterChatProducts(raw || []);
  if (error || !products.length) {
    return {
      reply: emptyCartOfferRoutinesReply(),
      sessionId: sid,
      keepCta: true,
    };
  }
  const available = products.filter((p) => (p.stock ?? 0) > 0);
  if (!available.length) {
    return {
      reply: emptyCartOfferRoutinesReply(),
      sessionId: sid,
      keepCta: true,
    };
  }
  const shortName = (p) => {
    if (p.slug === 'acne-facial-cleanser') return 'غسول حب الشباب';
    if (p.slug === 'post-laser-cream') return 'كريم ما بعد الليزر';
    return p.name;
  };
  const lines = available.map((p) =>
    `• ${shortName(p)} — **${Math.round(Number(p.price) || 0)}** ج`
  );
  return {
    reply:
      'أسعار منتجات مونتانيا يا فندم 💜\n\n' +
      lines.join('\n') +
      '\n\nتحبي تعرفي عن منتج معيّن أو عروض الروتين؟',
    sessionId: sid,
    keepCta: true,
  };
}

/** Pitch a single SKU from a product ad / icebreaker button. */
async function productAdPitchReply(sid, slug) {
  const { data: p, error } = await sb.from('products')
    .select('id, name, price, old_price, slug, stock, description, size')
    .eq('slug', slug)
    .eq('is_active', true)
    .maybeSingle();
  if (error || !p) {
    return unitProductsPriceListReply(sid);
  }
  if ((p.stock ?? 0) <= 0) {
    return {
      reply:
        'المنتج ده مش متوفر حاليًا للأسف 😔\n' +
        'تحبّي أشوفلكِ أسعار المنتجات المتاحة وعروض الروتين بشحن مجاني؟ 💜',
      sessionId: sid,
      keepCta: true,
    };
  }
  const price = Math.round(Number(p.price) || 0);
  const tip = String(p.description || '').trim().split(/[.。]/)[0] || '';
  return {
    reply:
      `أهلاً بيكِ 🌿\n` +
      `**${p.name}** سعره **${price}** جنيه.` +
      (tip ? `\n${tip}.` : '') +
      `\n\nتحبّي تعرفي تفاصيل أكتر، ولا تشوفي أسعار باقي المنتجات وعروض الروتين بشحن مجاني؟ 💜`,
    sessionId: sid,
    keepCta: true,
  };
}

/** Follow-up on ad product: price and/or size — never dump the 3 routines. */
async function productAdFollowUpReply(sid, slug, message) {
  const { data: p, error } = await sb.from('products')
    .select('id, name, price, old_price, slug, stock, description, size')
    .eq('slug', slug)
    .eq('is_active', true)
    .maybeSingle();
  if (error || !p) {
    return productAdPitchReply(sid, slug);
  }
  if ((p.stock ?? 0) <= 0) {
    return {
      reply: `${p.name} غير متوفر حاليًا للأسف 😔 قوليلي وأرشّحلك بديل.`,
      sessionId: sid,
      keepCta: true,
    };
  }
  const t = prepareCustomerText(expandFrancoAndTypos(message));
  if (isWhiteningEffectAsk(message)) {
    return replyWhiteningEffectAsk(message, sid, [], slug);
  }
  const wantsSize = /حجم|مل\b|ml|قد\s*ايه|وزنه|العلبة|احجام|أحجام/i.test(t);
  const wantsPrice = /سعر|بكام|بكم|كام/.test(t) || !wantsSize;
  const price = Math.round(Number(p.price) || 0);
  const size = String(p.size || '').trim();
  const lines = [`**${p.name}**`];
  if (wantsPrice) lines.push(`السعر **${price}** جنيه.`);
  if (wantsSize) {
    lines.push(size ? `الحجم **${size}**.` : 'الحجم مكتوب على العبوة — قوليلي لو حابة أأكدلك.');
  }
  return {
    reply: lines.join('\n') + '\n\nتحبي تسجلي الأوردر، ولا تعرفي حاجة تانية؟ 💜',
    sessionId: sid,
    keepCta: true,
  };
}

function formatSingleProductPriceLine(p) {
  const offer = p.old_price && p.old_price > p.price
    ? `سعره حاليًا ${Math.round(p.price)} جنيه بدلًا من ${Math.round(p.old_price)} جنيه`
    : `سعره ${Math.round(p.price)} جنيه`;
  const avail = (p.stock ?? 0) <= 0 ? '\nغير متوفر حاليًا 😔' : '';
  return `**${p.name}**\n• ${offer}${avail}`;
}

function singleSkuShippingTip(productCount = 1) {
  return formatFewProductsShippingTip(productCount);
}

/**
 * Named product interest / pitch — always DB price (even without «بكام»).
 * Stops Gemini inventing 229/299 for acne cleanser etc.
 */
async function tryNamedProductPitchReply(message, sid, chatHistory = []) {
  if (!message) return null;
  if (isShippingCostQuestion(message) || isExplicitCheckoutIntent(message)) return null;
  if (isThanksOrReadyToCheckout(message) || isPureGreeting(message)) return null;
  if (isWhiteningEffectAsk(message) || isGuaranteeOrSafetyQuestion(message)) return null;
  if (isResultsTimelineQuestion(message) || isHumanHandoffRequest(message)) return null;
  if (isShowProductsLookAsk(message) || isAreaSuitabilityQuestion(message)) return null;
  // Price-haggle handled separately
  if (isPriceHaggleAsk(message)) return null;
  // "آثار جانبية" must never become silicone gel pitch
  if (/(اثر|اثار|آثار)\s*جانب/.test(prepareCustomerText(expandFrancoAndTypos(message)))) return null;

  const t = prepareCustomerText(expandFrancoAndTypos(message));
  if (!t || t.length > 160) return null;
  // Need a product signal — not a vague "عايزة حاجة للبشرة"
  if (!/(غسول|كريم|لوشن|ليزر|حب\s*الشباب|حبوب|تفتيح|ساليسي)/.test(t)) {
    return null;
  }
  if (isSiliconeOrScarAsk(message)) return null;
  // Routine / all-offers asks stay on offer path
  if (/(العرض|الروتين|العروض|كورس|مجموعه|مجموعة)/.test(t) && !/(غسول|كريم|لوشن).{0,20}(بس|فقط|لوحد)/.test(t)) {
    return null;
  }

  const { data: products, error } = await sb.from('products')
    .select('id, name, price, old_price, slug, stock, description')
    .eq('is_active', true);
  if (error || !products?.length) return null;

  let matched = resolveProductMentions(message, products);
  if (!matched.length && /غسول/.test(t) && /(حب|شباب|حبوب|ساليسي)/.test(t)) {
    const acne = products.find((p) => p.slug === 'acne-facial-cleanser' || /حب الشباب/.test(p.name));
    if (acne) matched = [acne];
  }
  if (matched.length !== 1) return null;

  const p = matched[0];
  if ((p.stock ?? 0) <= 0) {
    return {
      reply: `${p.name} غير متوفر حاليًا للأسف 😔 قوليلي وأرشّحلك بديل.`,
      sessionId: sid,
      selectedProduct: p.slug || undefined,
      keepCta: true,
    };
  }
  const price = Math.round(Number(p.price) || 0);
  const tip = String(p.description || '').trim().split(/[.。]/)[0] || '';
  return {
    reply:
      `**${p.name}** سعره **${price}** جنيه يا فندم 💜` +
      (tip ? `\n${tip}.` : '') +
      `\n\nتحبي تعرفي تفاصيل أكتر، ولا نكمّل الأوردر؟`,
    sessionId: sid,
    selectedProduct: p.slug || undefined,
    keepCta: true,
  };
}

function isPriceHaggleAsk(message) {
  // softNormalizeAr maps أ/إ/آ → ا so patterns must use اقل not أقل
  const t = prepareCustomerText(expandFrancoAndTypos(message));
  if (!t || t.length > 100) return false;
  return /(اقل|ارخص|غالي|غاليه|غالى|ما\s*في\s*اقل|مفيش\s*(اقل|ارخص)|في\s*اقل|خصم|تنزيل)/i.test(t)
    && !/(محافظ|شحن|توصيل)/.test(t);
}

/** "ما في أقل من السعر دا" after a product pitch — correct DB price + real cheaper options. */
async function tryPriceHaggleReply(message, sid, chatHistory = []) {
  if (!isPriceHaggleAsk(message)) return null;

  const { data: products, error } = await sb.from('products')
    .select('id, name, price, slug, stock')
    .eq('is_active', true);
  if (error || !products?.length) return null;

  let discussed = null;
  for (let i = (chatHistory || []).length - 1; i >= 0; i--) {
    const hit = resolveProductMentions(chatHistory[i]?.text || '', products);
    if (hit.length === 1) {
      discussed = hit[0];
      break;
    }
  }
  if (!discussed) {
    // Fall back: last bot mentioned a catalog price + name
    const lastBot = lastModelMessage(chatHistory);
    discussed = resolveProductMentions(lastBot, products)[0] || null;
  }
  if (!discussed) return null;

  const price = Math.round(Number(discussed.price) || 0);
  const cheaper = products
    .filter((p) => (p.stock ?? 0) > 0 && p.id !== discussed.id && Number(p.price) < price)
    .sort((a, b) => Number(a.price) - Number(b.price))
    .slice(0, 2);

  let reply = `**${discussed.name}** سعره **${price}** جنيه يا فندم — ده السعر الحالي على الموقع 💜`;
  if (cheaper.length) {
    reply += '\n\nلو حابة حاجة بسعر أقل:\n' +
      cheaper.map((p) => `• **${p.name}** — **${Math.round(Number(p.price) || 0)}** ج`).join('\n');
  } else {
    reply += '\n\nمفيش منتج أرخص منه متوفر حاليًا.';
  }
  return {
    reply,
    sessionId: sid,
    selectedProduct: discussed.slug || undefined,
    keepCta: true,
  };
}

/**
 * Alone / named-SKU price path — never list all 3 ad offers.
 */
async function trySingleSkuPriceReply(message, sid, chatHistory, selectedBundleKey) {
  const fewNamed = isFewNamedProductsPriceAsk(message);
  if (
    !wantsSingleSkuOnly(message)
    && !fewNamed
    && !(isPriceQuestion(message) && /(غسول|كريم|لوشن)/.test(prepareCustomerText(expandFrancoAndTypos(message))) && !isCleanserCreamPairAsk(message) && !isBothOfThemPriceAsk(message))
  ) {
    return null;
  }
  // Bare بكام with no product word → not this path
  const t = prepareCustomerText(expandFrancoAndTypos(message));
  if (!/(غسول|كريم|لوشن|ليزر)/.test(t)) return null;
  if (isCleanserCreamPairAsk(message) || isBothOfThemPriceAsk(message)) return null;
  if (/(العرض|الروتين|روتين|الوتين)/i.test(t) && !/(بس|فقط|لوحده)/.test(t)) return null;

  const { data: products, error } = await sb.from('products')
    .select('id, name, price, old_price, slug, stock')
    .eq('is_active', true);
  if (error || !products?.length) return null;

  let matched = resolveProductMentions(message, products);
  // "البوست ليزر لوحده" / "ما بعد الليزر بكام" → كريم العناية بعد الليزر (مش عرض 618)
  if (!matched.length && /ليزر/.test(t) && !/غسول|لوشن/.test(t)) {
    const laser = products.find((p) => p.slug === 'post-laser-cream' || /ليزر/.test(p.name));
    if (laser) matched = [laser];
  }
  const histText = (chatHistory || []).map((h) => h.text || '').join('\n');
  if (selectedBundleKey === 'brightening' || selectedBundleKey === 'post-laser') {
    // help context resolve bare غسول → whitening
  }
  if (!matched.length) {
    const cat = resolveCategoryFollowUp(
      /^(ال)?غسول/.test(t) ? 'الغسول' : /كريم/.test(t) ? 'الكريم' : /لوشن/.test(t) ? 'اللوشن' : message,
      histText + (selectedBundleKey === 'brightening' || /تفتيح/.test(t) ? '\nتفتيح غسول التفتيح' : ''),
      products
    );
    if (cat?.ambiguous === 'cleanser') {
      const cleansers = products.filter((p) => /غسول/.test(p.name));
      if (cleansers.length) {
        return {
          reply:
            'عندنا نوعين من الغسول يا فندم:\n\n' +
            cleansers.map((p) => `• **${p.name}** بـ **${Math.round(p.price)}** جنيه.`).join('\n') +
            singleSkuShippingTip(),
          sessionId: sid,
          keepCta: true,
        };
      }
    }
    if (cat?.ambiguous === 'cream') {
      const creams = products.filter((p) => /كريم/.test(p.name) && (p.stock ?? 1) > 0);
      if (creams.length) {
        return {
          reply:
            'عندنا نوعين من الكريم يا فندم:\n\n' +
            creams.map((p) => `• **${p.name}** بـ **${Math.round(p.price)}** جنيه.`).join('\n') +
            singleSkuShippingTip(),
          sessionId: sid,
          keepCta: true,
        };
      }
    }
    if (cat && !cat.ambiguous) matched = [cat];
  }

  // Bare "كريم" price ask with no match yet → creams list (never dump 3 routines)
  if (!matched.length && /كريم/.test(t) && !/غسول|لوشن/.test(t) && !/ليزر/.test(t)) {
    if (/مونتان|montana|تفتيح|تفت/i.test(t)) {
      const p = products.find((x) => x.slug === 'whitening-cream' || x.name === 'كريم التفتيح');
      if (p) matched = [p];
    } else {
      const creams = products.filter((p) => /كريم/.test(p.name) && (p.stock ?? 1) > 0);
      if (creams.length && (fewNamed || isPriceQuestion(message))) {
        return {
          reply:
            'عندنا نوعين من الكريم يا فندم:\n\n' +
            creams.map((p) => `• **${p.name}** بـ **${Math.round(p.price)}** جنيه.`).join('\n') +
            singleSkuShippingTip(),
          sessionId: sid,
          keepCta: true,
        };
      }
    }
  }

  // Bare غسول (+ price) — list both cleansers, never dump the 3 routine offers
  if (!matched.length && /غسول/.test(t) && !/كريم|لوشن/.test(t)) {
    if (/تفتيح|تفت/.test(t) || /غسول\s*التفتيح|تفتيح/.test(histText)) {
      const p = products.find((x) => x.name === 'غسول التفتيح');
      if (p) matched = [p];
    } else if (/حب|شباب|حبوب/.test(t)) {
      const p = products.find((x) => /حب الشباب/.test(x.name));
      if (p) matched = [p];
    } else if (fewNamed || isPriceQuestion(message) || wantsSingleSkuOnly(message)) {
      const cleansers = products.filter((p) => /غسول/.test(p.name) && (p.stock ?? 1) > 0);
      if (cleansers.length) {
        return {
          reply:
            'عندنا نوعين من الغسول يا فندم:\n\n' +
            cleansers.map((p) => `• **${p.name}** بـ **${Math.round(p.price)}** جنيه.`).join('\n') +
            '\n\nأنهي واحد تقصدي؟ 💜',
          sessionId: sid,
          keepCta: true,
        };
      }
    }
  }

  // Fill missing of 1–2 named categories from brightening context
  {
    const wantsC = /غسول/.test(t);
    const wantsCr = /كريم/.test(t);
    const wantsL = /لوشن/.test(t);
    const wantCount = [wantsC, wantsCr, wantsL].filter(Boolean).length;
    if (wantCount >= 1 && wantCount <= 2 && matched.length < wantCount) {
      const brightCtx = selectedBundleKey === 'brightening'
        || historySuggestsBrighteningContext(chatHistory)
        || /تفتيح|اندر|تحت\s*ال[اإ]بط|تصبغ/.test(t + ' ' + histText);
      if (brightCtx || /تفتيح/.test(t)) {
        const pick = (slug, name) => products.find((p) => p.slug === slug || p.name === name);
        const add = [];
        if (wantsC) add.push(pick('whitening-cleanser', 'غسول التفتيح'));
        if (wantsCr) add.push(pick('whitening-cream', 'كريم التفتيح'));
        if (wantsL) add.push(pick('hand-body-lotion', 'لوشن اليدين والجسم'));
        matched = add.filter(Boolean);
      }
    }
  }

  if (matched.length === 1) {
    return {
      reply: formatSingleProductPriceLine(matched[0]) + singleSkuShippingTip(1),
      sessionId: sid,
      keepCta: true,
    };
  }
  if (matched.length > 1) {
    return {
      reply: matched.map(formatSingleProductPriceLine).join('\n\n') + singleSkuShippingTip(Math.min(2, matched.length)),
      sessionId: sid,
      keepCta: true,
    };
  }
  return null;
}

function isRoutineOrOfferPriceAsk(message) {
  const t = prepareCustomerText(expandFrancoAndTypos(message)).replace(/بكم/g, 'بكام');
  return /(العرض|الروتين|روتين|الوتين)/i.test(t) && /(بكم|بكام|ب\s*كام|السعر|كام|price|how\s*much)/i.test(t)
    || /^(بكم|بكام|السعر|كام)[\s!.،؟?]*$/i.test(t)
    || isVagueOfferQuestion(message)
    || isCleanserCreamPairAsk(message)
    || isBothOfThemPriceAsk(message)
    || isFullOfferPackagePriceAsk(message);
}

/** Recent thread talked about underarm / brightening / the cream+cleanser pair. */
function historySuggestsBrighteningContext(chatHistory) {
  const blob = softNormalizeAr(
    (chatHistory || []).slice(-10).map((h) => String(h?.text || '')).join(' ')
  );
  if (!blob) return false;
  if (/(تحت\s*ال[اإ]بط|اندر|بكين|اسمرار|تصبغ|تفتيح\s*الاندر|تفتيح\s*تحت)/i.test(blob)) {
    return true;
  }
  const hasC = /غسول\s*التفتيح/.test(blob);
  const hasCr = /كريم\s*التفتيح/.test(blob);
  const hasL = /لوشن\s*(اليدين|الجسم)|لوشن اليدين والجسم/.test(blob);
  return (hasC && hasCr) || (hasC && hasL) || (hasCr && hasL);
}

/**
 * "اسود جدا جدا" after underarm/brightening talk → full routine, not cream alone.
 */
function isBrighteningSeverityFollowUp(message, chatHistory) {
  const t = softNormalizeAr(expandFrancoAndTypos(String(message || '')));
  if (!t || t.length > 80) return false;
  if (!/(اسود|أسود|غامق|شديد|جدا\s*جدا|قوي\s*جدا|كثير|كتير|very\s*dark)/i.test(t)) {
    return false;
  }
  if (/(بكام|اوردر|طلب|عرض\s*اخر|غسول|كريم|لوشن)/i.test(t) && t.length > 25) {
    return false;
  }
  return historySuggestsBrighteningContext(chatHistory);
}

async function tryPriceQuestion(message, sid, chatHistory, selectedBundleKey, selectedProductSlug) {
  if (
    !isPriceQuestion(message)
    && !isRoutineOrOfferPriceAsk(message)
    && !isCleanserCreamPairAsk(message)
    && !isFewNamedProductsPriceAsk(message)
    && !isBothOfThemPriceAsk(message)
    && !wantsSingleSkuOnly(message)
  ) {
    return null;
  }

  // Sticky product-ad SKU + "سعره/حجمه" → that product only (never dump 3 routines)
  // But NOT when she asked about an offer/routine just pitched
  if (
    selectedProductSlug
    && isProductAdFollowUpAsk(message)
    && !isOfferPriceFollowUpAsk(message, lastModelMessage(chatHistory))
    && !lastBotDescribedRoutine(lastModelMessage(chatHistory))
  ) {
    return productAdFollowUpReply(sid, selectedProductSlug, message);
  }

  // "بكام الغسول لوحده" / named 1–2 products — unit prices BEFORE ad/all-offers dump
  if (wantsSingleSkuOnly(message) || isFewNamedProductsPriceAsk(message)) {
    const alone = await trySingleSkuPriceReply(message, sid, chatHistory, selectedBundleKey);
    if (alone) return alone;
  }

  const { data: products, error } = await sb.from('products')
    .select('id, name, price, old_price, slug, rating, review_count, stock')
    .eq('is_active', true);
  if (error || !products || !products.length) return null;

  const t = prepareCustomerText(expandFrancoAndTypos(message));
  const mentionsRoutine = /(العرض|الروتين|روتين|الوتين|كورس|الكورس)/i.test(t);
  const courseAsk = isCleanserCreamPairAsk(message);
  const bothAsk = isBothOfThemPriceAsk(message);
  const fromAd = getBundleByKey(selectedBundleKey);
  const fromText = resolveBundleFromCustomerText(message);

  const withUnitPricesAndShipTip = (matchedProducts) => {
    const list = (matchedProducts || []).slice(0, 2);
    const lines = list.map(formatSingleProductPriceLine);
    return lines.join('\n\n') + formatFewProductsShippingTip(list.length);
  };

  // كورس / روتين / التلاتة معًا → عرض التفتيح (شحن مجاني)
  if (courseAsk) {
    const bright = getBundleByKey('brightening');
    if (bright && (!fromText || fromText.key === 'brightening')) {
      return {
        reply: formatBundlePriceReply(bright),
        sessionId: sid,
        selectedBundleKey: bright.key,
        keepCta: true,
      };
    }
  }

  // "الاتنين بكام" → أسعار المنتجين من السياق + تنويه الشحن (مش الروتين الكامل)
  if (bothAsk) {
    let matchedBoth = resolveProductMentions(message, products);
    if (matchedBoth.length < 2) {
      for (let i = (chatHistory || []).length - 1; i >= 0; i--) {
        const hit = resolveProductMentions(chatHistory[i].text || '', products);
        if (hit.length >= 2) {
          matchedBoth = hit.slice(0, 2);
          break;
        }
        if (hit.length === 1 && matchedBoth.length === 1 && hit[0].id !== matchedBoth[0].id) {
          matchedBoth = [matchedBoth[0], hit[0]];
          break;
        }
      }
    }
    if (matchedBoth.length >= 2) {
      return {
        reply: withUnitPricesAndShipTip(matchedBoth.slice(0, 2)),
        sessionId: sid,
        keepCta: true,
      };
    }
    if (historySuggestsBrighteningContext(chatHistory) || fromAd?.key === 'brightening') {
      const c = products.find((p) => p.slug === 'whitening-cleanser' || p.name === 'غسول التفتيح');
      const cr = products.find((p) => p.slug === 'whitening-cream' || p.name === 'كريم التفتيح');
      if (c && cr) {
        return {
          reply: withUnitPricesAndShipTip([c, cr]),
          sessionId: sid,
          keepCta: true,
        };
      }
    }
  }

  // Named 1–2 products without كورس/روتين → unit prices (never dump routines)
  if (!mentionsRoutine && !courseAsk) {
    let named = resolveProductMentions(message, products);
    const wantsC = /غسول/.test(t);
    const wantsCr = /كريم/.test(t);
    const wantsL = /لوشن/.test(t);
    const wantCount = [wantsC, wantsCr, wantsL].filter(Boolean).length;
    if (wantCount >= 1 && wantCount <= 2 && named.length < wantCount) {
      const hist = (chatHistory || []).map((h) => h.text || '').join(' ');
      const brightCtx = historySuggestsBrighteningContext(chatHistory)
        || fromAd?.key === 'brightening'
        || /تفتيح|اندر|تحت\s*ال[اإ]بط|تصبغ/.test(t + ' ' + hist);
      if (brightCtx || /تفتيح/.test(t)) {
        const pick = (slug, name) => products.find((p) => p.slug === slug || p.name === name);
        const add = [];
        if (wantsC) add.push(pick('whitening-cleanser', 'غسول التفتيح'));
        if (wantsCr) add.push(pick('whitening-cream', 'كريم التفتيح'));
        if (wantsL) add.push(pick('hand-body-lotion', 'لوشن اليدين والجسم'));
        named = add.filter(Boolean);
      }
    }
    if (named.length >= 1 && named.length <= 2) {
      return {
        reply: withUnitPricesAndShipTip(named),
        sessionId: sid,
        keepCta: true,
      };
    }
  }

  // Ad context: bare "بكام" / "العرض" → THAT offer only
  if (
    fromAd
    && (isPriceQuestion(message) || isVagueOfferQuestion(message) || isRoutineOrOfferPriceAsk(message))
    && !isFewNamedProductsPriceAsk(message)
    && !bothAsk
  ) {
    if (!wantsAllOffersList(message) && (!fromText || fromText.key === fromAd.key)) {
      const namedNow = resolveProductMentions(message, products);
      if (namedNow.length === 0 || mentionsRoutine || isVagueOfferQuestion(message)) {
        return {
          reply: formatBundlePriceReply(fromAd),
          sessionId: sid,
          selectedBundleKey: fromAd.key,
          keepCta: true,
        };
      }
    }
  }

  const bundle = fromAd || fromText || (courseAsk ? getBundleByKey('brightening') : null);
  if (bundle && (courseAsk || mentionsRoutine || (fromText && mentionsRoutine) || (fromAd && isVagueOfferQuestion(message)))) {
    if (courseAsk || mentionsRoutine || fromText) {
      return {
        reply: formatBundlePriceReply(bundle),
        sessionId: sid,
        selectedBundleKey: bundle.key,
        keepCta: true,
      };
    }
  }

  let matched = resolveProductMentions(message, products);

  // 3+ products named → pitch matching routine with free shipping
  if (matched.length >= 3 || (matched.length > 1 && mentionsRoutine)) {
    const preferKey = preferredBundleKeyFromProducts(matched) || fromAd?.key || 'brightening';
    const b = getBundleByKey(preferKey);
    if (b) {
      return {
        reply: formatBundlePriceReply(b),
        sessionId: sid,
        selectedBundleKey: b.key,
        keepCta: true,
      };
    }
  }

  if (matched.length >= 1 && matched.length <= 2) {
    return {
      reply: withUnitPricesAndShipTip(matched),
      sessionId: sid,
      keepCta: true,
    };
  }

  if (!matched.length) {
    for (let i = (chatHistory || []).length - 1; i >= 0; i--) {
      const hit = resolveProductMentions(chatHistory[i].text || '', products);
      if (hit.length) {
        matched = hit;
        break;
      }
    }
  }

  if (matched.length) {
    if (matched.length >= 3 && mentionsRoutine) {
      const preferKey = preferredBundleKeyFromProducts(matched);
      const bright = getBundleByKey(preferKey || 'brightening');
      if (bright) {
        return {
          reply: formatBundlePriceReply(bright),
          sessionId: sid,
          selectedBundleKey: bright.key,
          keepCta: true,
        };
      }
    }
    return {
      reply: withUnitPricesAndShipTip(matched.slice(0, 2)),
      sessionId: sid,
      selectedBundleKey: preferredBundleKeyFromProducts(matched) || undefined,
      keepCta: true,
    };
  }

  if (bundle && (mentionsRoutine || courseAsk || fromAd)) {
    return {
      reply: formatBundlePriceReply(bundle),
      sessionId: sid,
      selectedBundleKey: bundle.key,
      keepCta: true,
    };
  }

  // "بكام الغسول/الكريم/اللوشن" must never fall through to the 3 routine offers
  if (/(غسول|كريم|لوشن|ليزر)/.test(t) && !mentionsRoutine && !courseAsk) {
    if (/غسول/.test(t) && !/كريم|لوشن/.test(t)) {
      const cleansers = products.filter((p) => /غسول/.test(p.name) && (p.stock ?? 1) > 0);
      if (cleansers.length) {
        return {
          reply:
            'عندنا نوعين من الغسول يا فندم:\n\n' +
            cleansers.map((p) => `• **${p.name}** بـ **${Math.round(p.price)}** جنيه.`).join('\n') +
            '\n\nأنهي واحد تقصدي؟ 💜',
          sessionId: sid,
          keepCta: true,
        };
      }
    }
    if (/كريم/.test(t) && !/غسول|لوشن/.test(t) && !/ليزر/.test(t)) {
      const creams = products.filter((p) => /كريم/.test(p.name) && (p.stock ?? 1) > 0);
      if (creams.length) {
        return {
          reply:
            'عندنا نوعين من الكريم يا فندم:\n\n' +
            creams.map((p) => `• **${p.name}** بـ **${Math.round(p.price)}** جنيه.`).join('\n') +
            '\n\nأنهي واحد تقصدي؟ 💜',
          sessionId: sid,
          keepCta: true,
        };
      }
    }
    return {
      reply: 'قصدك سعر أنهي منتج يا فندم؟ قوليلي الاسم (غسول التفتيح / غسول حب الشباب / كريم…) وأقولك السعر 💜',
      sessionId: sid,
      keepCta: true,
    };
  }

  if (isVagueOfferQuestion(message) || isPriceQuestion(message)) {
    return {
      reply: askWhatSheNeedsReply('').trim(),
      sessionId: sid,
    };
  }

  return {
    reply: 'قصدك سعر أنهي عرض أو منتج يا فندم؟ قوليلي الاسم وأقولك السعر بالظبط 💜',
    sessionId: sid,
  };
}

async function buildSymptomNote(message, sid) {
  const { data: products, error } = await sb.from('products')
    .select('id, name')
    .eq('is_active', true);
  if (error || !products || !products.length) return null;

  const matched = resolveProductMentions(message, products);
  if (matched.length !== 1) return null;

  const cart = sessionCarts[sid] || [];
  if (cart.some((i) => i.id === matched[0].id)) return null;

  return `(ملاحظة: المشكلة دي = ${matched[0].name}. رشحيه بدون سؤال تشخيص.)`;
}

// Hint Gemini when the raw message is Franco/typo-heavy so it answers the
// intended meaning instead of asking "مش فاهمة".
function buildUnderstandingNote(message) {
  const raw = String(message || '').trim();
  if (!raw) return null;
  const expanded = expandFrancoAndTypos(raw);
  const hasFranco = /[a-z]/i.test(raw);
  const wasExpanded = expanded.replace(/\s+/g, ' ') !== raw.replace(/\s+/g, ' ');
  if (!hasFranco && !wasExpanded) return null;
  const prepared = prepareCustomerText(expanded);
  return `(ملاحظة فهم: رسالة العميل ممكن تكون متلخبطة/فرانكو/غلط إملائي. افهمي القصد وردّي على المعنى — تقريبًا: «${prepared || expanded}». ممنوع تقولي مش فاهمة لو المعنى واضح تقريبًا.)`;
}

function isCancelCurrentOrderAsk(message) {
  const t = softNormalizeAr(expandFrancoAndTypos(String(message || '')));
  if (!t || t.length > 120) return false;
  // "الغي الأوردر" / "عايزه الغي" / "الغاء الطلب" / "امسح الأوردر"
  // Avoid matching product names like "الغسول"
  return /(الغي|ألغي|الغى|الغاء|إلغاء|cancel)\s*(ال)?(اوردر|أوردر|طلب|order|الشراء|التسجيل)?/i.test(t)
    || /(عا[ييو]ز[اهة]?|محتاج[اهة]?)\s*(الغي|ألغي|الغاء|إلغاء)/i.test(t)
    || /(مش\s*عا[ييو]ز[اهة]?)\s*(ال)?(اوردر|أوردر|طلب|أكمل|اكمل|نكمل|العرض)/i.test(t)
    || /(امسح|افضي|فضي|شيلي?|لغ[يى])\s*(ال)?(اوردر|أوردر|طلب)/i.test(t)
    || /^(الغاء|إلغاء|الغي|ألغي|cancel)[\s!.،؟?]*$/i.test(t);
}

/**
 * Hard walk-away: "غالي جدا متشكره خلاص مش هينفع اطلبه" — clear cart, no checkout nudge.
 */
function isWalkAwayDecline(message) {
  const t = softNormalizeAr(expandFrancoAndTypos(String(message || '')));
  if (!t || t.length > 160) return false;
  if (/(مش\s*ه?ينفع\s*(أ?طلب|اطلب)|مش\s*هطلب|مش\s*هقدر\s*(أ?طلب|اطلب)|مش\s*عا[ييو]ز[اهة]?\s*(أ?طلب|اطلب|اوردر|أوردر))/i.test(t)) {
    return true;
  }
  if (/(غالي|غاليه|غالى).{0,50}(متشكر|شكرا|خلاص|مش\s*ه|مش\s*ينفع)/i.test(t)) return true;
  if (/(متشكر|شكرا).{0,40}(خلاص|مش\s*هطلب|مش\s*هينفع|مش\s*هقدر)/i.test(t)) return true;
  if (/خلا[صص].{0,30}(مش\s*هطلب|مش\s*هينفع|مش\s*عا[ييو]ز|مش\s*هقدر)/i.test(t)) return true;
  return false;
}

/**
 * Haggling / unauthorized discount: "ينفع 600" / "تحسبيه ب 600" / "مينفعش تعمليلي خصم".
 * Never dump offers list; never open checkout.
 */
function isDiscountHaggleAsk(message) {
  const t = softNormalizeAr(toWesternDigits(expandFrancoAndTypos(String(message || '')))).replace(/بكم/g, 'بكام');
  if (!t || t.length > 120) return false;
  if (isAreaSuitabilityQuestion(message)) return false;
  if (isWalkAwayDecline(message)) return false;
  if (/(تعمليلي|تعملي|تعملولي|اعمل(ي|و)?لي|ممكن)\s*خصم|مينفعش.{0,25}خصم|في\s*خصم|عندكم\s*خصم|خصم\s*(عليه|علي|كام|ينفع)/i.test(t)) {
    return true;
  }
  if (/(تحسيب|تحسبيه|تحسّبه|تحسب(يه|ه|ها|و)?)\s*(ب|بـ)?\s*\d{2,4}/i.test(t)) return true;
  if (/ينفع\s*(ب|بـ)?\s*\d{2,4}/i.test(t)) return true;
  if (/(بدل|بدال)\s*(من|عن)?\s*\d{2,4}/i.test(t)) return true;
  if (/(ارخص|أرخص|أرخصلي|ارخصلي|نقص(ي|و)?\s*(السعر|من\s*السعر)|خفّ?ض(ي|و)?\s*السعر)/i.test(t)) return true;
  // Bare counter-offer amount after discussing a routine price
  if (/^(ب|بـ)?\s*\d{3}\s*(ج|جنيه|ج\.?م)?[\s!.،؟?]*$/i.test(t)) return true;
  return false;
}

function discountHaggleReply(sid, chatHistory, selectedBundleKey, promo) {
  const bundle =
    getBundleByKey(selectedBundleKey)
    || resolveSinglePitchedBundle(lastModelMessage(chatHistory))
    || (hasRecentBrighteningContext(chatHistory) ? getBundleByKey('brightening') : null);
  const price = bundle?.bundlePrice || bundle?.listTotal || bundle?.price;
  const priceLine = bundle && price
    ? `سعر **${bundle.name}** ثابت **${price}** جنيه — والشحن مجاني على العرض.`
    : 'أسعار العروض ثابتة زي الموقع — والشحن مجاني على أي روتين.';
  // This denial used to go out even while a campaign was running, so the bot
  // contradicted the ad the customer had just clicked.
  if (promo?.active) {
    return (
      `${promoLine(promo)}\n` +
      `${priceLine}\n\n` +
      `الخصم بيتحسب لوحده على الطلب — لو حابة نكمّل قولي «نكمل» 🌿`
    );
  }
  return (
    `معلش يا فندم 💜 الأسعار زي الموقع ومفيش خصم إضافي على الروتين.\n` +
    `${priceLine}\n\n` +
    `لو حابة نكمّل بالسعر ده قولي «نكمل» — ولو مش مناسب تحت أمرك 🌿`
  );
}

function isExplicitCheckoutIntent(message) {
  const raw = String(message || '').trim();
  if (!raw) return false;
  // "الغي الأوردر" must NEVER count as "عايزه أوردر"
  if (isCancelCurrentOrderAsk(raw)) return false;
  if (isWalkAwayDecline(raw)) return false;
  // "الاوردر موصلش / فين الأوردر" = status lookup, NOT place-order
  if (wantsExistingOrderHelp(raw)) return false;
  // softNormalize: عاوزا/عايزا (common typos) → still match عاوز/عايز + optional tail
  const t = softNormalizeAr(expandFrancoAndTypos(raw));
  // "مش هينفع اطلبه" / "خلاص مش هطلب" — اطلب matches substring; block negatives
  if (/(مش\s*(ه?ينفع|هطلب|هقدر|عا[ييو]ز)|خلا[صص]\s*مش).{0,35}(أ?طلب|اطلب|اوردر|أوردر|طلب)/i.test(t)) {
    return false;
  }
  // Clear "I want to place / finish the order now" — not only the word "نكمل"
  return /(نكمل|نكمّل|نخل[صّ]ص?|نخلّص|كمل(ي|و)?|اكمل(ي|و)?|كمّل(ي|و)?|خل[صّ]ص?(ي|و)?\s*(ال)?(طلب|اوردر|أوردر|شراء)|اعمل(ي|و)?\s*(ال)?(اوردر|أوردر|طلب|order)|سجّ?ل(ي|و)?\s*(ال)?(طلب|اوردر|أوردر)|عا[ييو]ز[اهة]?\s*(أ?طلب|اطلب|الطلب|أوردر|اوردر)|هطلب|هاطلب|أ?[أا]طلب|اطلب(ي|و)?\s*(دلوقتي|الآن|كده)?|جاهز(ة|ه)?(\s*(لل)?(ال)?(دفع|شراء|طلب|اوردر|أوردر))?|نفذ(ي|و)?\s*(ال)?(طلب|اوردر|أوردر)|ابعت(ي|و)?\s*(ال)?(لينك|رابط|فورم)|عا[ييو]ز[اهة]?\s*(ال)?(لينك|رابط)|ابعت(ي|و)?\s*(عنوان|بيانات|رقم)|بيانات\s*(التوصيل|الشحن|الطلب)|عا[ييو]ز[اهة]?\s*أ?[اأ]سجّ?ل|تمم?\s*(ال)?طلب|تم\s*التسجيل|ادفع|الدفع|كاش(\s*عند\s*الاستلام)?|place\s*(the\s*)?order|check\s*out|checkout|order\s*now|nkamel|nkamml|n5allas|5allas|kammel|kamml|yes\s*(i\s*)?(want\s*to\s*)?order)/i.test(t)
    || /(ايوه|أيوه|اه|نعم|تمام|ماشي|يلا|خلاص).{0,25}(اوردر|أوردر|طلب)/i.test(t)
    // "لو سمحت أوردر" / place order — NOT "لو سمحتم الاوردر موصلش" (handled above)
    || (/(لو\s*سمحت[يمو]?).{0,20}(اطلب|أطلب|اوردر|أوردر)/i.test(t)
      && !/(الغي|ألغي|الغاء|إلغاء|cancel|موصل|وصل|فين|وين|تتبع)/i.test(t));
}

/** "مجموعه كلها" / "السيت كله" / "كل العروض" — wants the full list of routines. */
function isWholeSetOrCollectionAsk(message) {
  const t = softNormalizeAr(expandFrancoAndTypos(message));
  if (!t || t.length > 80) return false;
  if (/(شعر|هير|hair)/i.test(t) && !/(بشر|تفتيح|غسول|كريم|روتين|مجموعه|مجموعة)/i.test(t)) {
    return false;
  }
  // "العرض كامل" = singular full package (ad/offer price) — NOT "list all 3"
  if (isFullOfferPackagePriceAsk(message)) return false;
  // Official offer name «روتين التفتيح الكامل» must NEVER mean "show all 3 offers"
  if (/روتين\s*التفتيح(\s*الكامل)?|التفتيح\s*الكامل/.test(t)) return false;
  if (/عناي[ةه]\s*ما\s*بعد\s*الليزر|ما\s*بعد\s*الليزر/.test(t) && !/(كل\s*العروض|التلات)/.test(t)) {
    return false;
  }
  if (/عناي[ةه]\s*الوش\s*والجسم|الوش\s*والجسم/.test(t) && !/(كل\s*العروض|التلات)/.test(t)) {
    return false;
  }
  // Any clearly named single routine → not a "list all" ask
  const named = resolveBundleFromCustomerText(message);
  if (named && !/(كل\s*العروض|العروض\s*كل|التلات\s*عروض|الثلاث\s*عروض)/.test(t)) {
    return false;
  }
  return /(مجموع[ةه]|سيت|set|كوليكشن|collection|باق[ةه]|روتين).{0,20}(كل[هها]|كامل[ةه]?|كاملة|التلات[ةه]|الثلاث)/i.test(t)
    || /(كل\s*العروض|كل\s*الروتينات|العروض\s*كل[هها]|العروض\s*التلات[ةه])/i.test(t)
    || /^(كل\s*(ال)?(مجموع[ةه]|روتين|عرض|سيت)|الكل|كلها|كلو|السيت\s*كله|المجموع[ةه]\s*كل[هها]|عا[ييو]ز[اهة]?\s*(ال)?كل)[\s!.،؟?]*$/i.test(t)
    || /^(مجموع[ةه]|الالمجموع[ةه]|السيت|الروتين)\s*(كل[هها]|كامل[ةه]?)?[\s!.،؟?]*$/i.test(t);
}

/**
 * "العرض كامل بكام" / "لو سمحت العرض الكامل" — price of the complete package
 * (ManyChat ad offer, or ask which if no ad).
 */
function isFullOfferPackagePriceAsk(message) {
  const t = prepareCustomerText(expandFrancoAndTypos(message)).replace(/بكم/g, 'بكام');
  if (!t || t.length > 90) return false;
  if (/(كل\s*العروض|العروض\s*كل|التلات\s*عروض)/.test(t)) return false;
  return /(ال)?عرض\s*(ال)?كامل/.test(t)
    || /^(لو\s*سمحت\s*)?(ال)?عرض\s*(ال)?كامل([\s!.،؟?]*|.{0,20}(بكام|كام|سعر))/i.test(t);
}

function emptyCartOfferRoutinesReply() {
  return (
    formatAllRoutineOffersList('العروض المتاحة يا فندم (**شحن مجاني** على كل عرض):') +
    '\n\nاختاري بالاسم أو الرقم (١ ليزر · ٢ تفتيح · ٣ وش وجسم) 💜'
  );
}

/**
 * We do not know yet what she came for — so ask, instead of reciting the
 * catalogue at her.
 *
 * Owner's rule: find out what the customer wants first. She tells us in one of
 * three ways — she names a product, she names an offer, or she sends a photo
 * of the ad or the product — and any of those is answered directly. Opening
 * with a priced list of everything answers a question she never asked, and
 * reads like a flyer rather than someone helping her.
 *
 * The full list still has its place: when she asks for it (wantsAllOffersList,
 * isUnitProductsPriceListAsk). That is her choosing it, not us leading with it.
 */
function askWhatSheNeedsReply(opening = 'أهلاً بيكِ في مونتانا 🌿') {
  return (
    `${opening}\n`
    + 'قوليلي بس عايزة تحسّني إيه في بشرتك، أو اسم المنتج اللي في بالك — '
    + 'وأنا أظبطلك اللي يناسبك بالظبط 💜'
  );
}

/** A photo we could not resolve to a product or an offer → ask what it is. */
function imageOffersReply() {
  return (
    'وصلتني الصورة يا فندم 💜\n'
    + 'قوليلي بس عايزة إيه منها بالظبط — منتج معيّن؟ ولا عرض شفتيه في إعلان؟'
  );
}

/**
 * Image-only turn: flag from webhook/ManyChat, or message that is only a photo placeholder/URL.
 * Text + image caption still goes through normal text intent.
 */
function isCustomerImageOnlyMessage(message, { hasImage } = {}) {
  const raw = String(message || '').trim();
  if (hasImage && (!raw || raw === '(أرسل صورة)' || raw === '(صورة)')) return true;
  if (!raw || raw.length > 600) return false;
  if (/^(صورة|صوره|image|photo|pic|\[image\]|\(image\)|\[photo\]|sent an? image|user sent an? (image|photo)|user sent a photo|📎|🖼)[\s!.،؟?]*$/i.test(raw)) {
    return true;
  }
  // Lone image / FB CDN URL (ManyChat sometimes forwards the attachment URL as text)
  if (/^https?:\/\/\S+\.(jpe?g|png|gif|webp|heic)(\?\S*)?$/i.test(raw)) return true;
  if (
    /^https?:\/\/(scontent|external|cdninstagram|lookaside|fbcdn)[^\s]*$/i.test(raw)
    && !/\s/.test(raw)
  ) {
    return true;
  }
  return !!hasImage && raw.length < 8;
}

/**
 * Bare "تفاصيل / عايزة التفاصيل / details" (no named product) → list the 3 routine offers.
 * "تفاصيل كريم التفتيح" stays product FAQ.
 */
function isBareDetailsOrInfoAsk(message) {
  const t = prepareCustomerText(expandFrancoAndTypos(message));
  if (!t || t.length > 70) return false;
  // Named SKU → real product details
  if (/(غسول|كريم|لوشن|سيليكون|جل\s*السيليكون|منتج\s+\S+)/.test(t) && !/(عرض|روتين|عروض)/.test(t)) {
    return false;
  }
  if (/(مكونات|تركيبة|ingredients?|formula)/i.test(t)) return false;
  return (
    /^(و\s*)?(ال)?(تفاصيل|تفصيل|معلومات)[\s!.،؟?]*$/i.test(t)
    || /^(عايز(ة|ه)?|محتاج(ة|ه)?|عاوز(ة|ه)?|ابعت[يى]?|قول[يى]?|عاوزين)\s*(ال)?(تفاصيل|تفصيل|معلومات)([\s!.،؟?]|$)/i.test(t)
    || /^(ال)?(تفاصيل|تفصيل|معلومات)\s*(لو\s*سمحت|من\s*فضلك|اكتر|أكثر|العرض|الروتين|بليز)?[\s!.،؟?]*$/i.test(t)
    || /^(more\s*)?(details|info|information|tell\s*me\s*more)[\s!.?]*$/i.test(t)
    || /^(عايز(ة|ه)?|محتاج(ة|ه)?)\s*(اعرف|أعرف)\s*(ال)?(تفاصيل|اكتر|أكثر)[\s!.،؟?]*$/i.test(t)
  );
}

/** First touch (ad / empty chat) — ask what she needs; never recite prices. */
function routinesWelcomeReply() {
  return askWhatSheNeedsReply();
}

function lastBotListedRoutineOffers(lastBot) {
  const t = String(lastBot || '');
  return (/618|549/.test(t) && /777|699/.test(t) && /558|499/.test(t));
}

/** Bot just described a routine (with or without prices) — price follow-ups refer to THAT offer. */
function lastBotDescribedRoutine(lastBot) {
  const t = String(lastBot || '');
  if (!t) return false;
  if (lastBotListedRoutineOffers(t)) return true;
  if (/روتين\s*التفتيح|عرض\s*عناي[ةه]|عناي[ةه]\s*الوش\s*والجسم|ما\s*بعد\s*الليزر/.test(t)) return true;
  if (/غسول\s*التفتيح/.test(t) && /كريم\s*التفتيح/.test(t) && /لوشن/.test(t)) return true;
  if (/\b(618|777|558|549|699|499)\b/.test(t) && /(عرض|روتين|شحن\s*مجاني)/.test(t)) return true;
  return false;
}

function resolveRoutineKeyFromText(text) {
  const t = softNormalizeAr(String(text || ''));
  if (!t) return null;
  if (/روتين\s*التفتيح|التفتيح\s*الكامل|(^|[^\d])(777|699)([^\d]|$)/.test(t)) return 'brightening';
  if (/غسول\s*التفتيح/.test(t) && /كريم\s*التفتيح/.test(t) && /لوشن/.test(t)) return 'brightening';
  if (/بعد\s*الليزر|ما\s*بعد\s*الليزر|(^|[^\d])(618|549)([^\d]|$)/.test(t)) return 'post-laser';
  if (/الوش\s*والجسم|(^|[^\d])(558|499)([^\d]|$)/.test(t)) return 'face-body';
  return null;
}

/**
 * "سعر العرض" / "والسعر كام" after routine pitch — never sticky lotion/cream from the ad.
 * Also handles reply-quotes that paste the routine text + "سعرالعرض ده".
 */
function isOfferPriceFollowUpAsk(message, lastBot) {
  const raw = String(message || '');
  const t = prepareCustomerText(expandFrancoAndTypos(raw)).replace(/بكم/g, 'بكام');
  if (!t) return false;
  // "البوست ليزر لوحده بكام" = unit SKU, never the 618 routine
  if (wantsSingleSkuOnly(message) || isFewNamedProductsPriceAsk(message)) return false;
  // Explicit offer/routine price (allow missing space: سعرالعرض)
  if (/سعر\s*ال?عرض|سعرالعرض|بكام\s*ال?عرض|(ال)?عرض\s*(ده|دا)(\s*(بكام|كام|سعر))?|(ال)?عرض\s*(بكام|كام)|(ال)?روتين\s*(بكام|كام|سعر)/i.test(t)) {
    return true;
  }
  if (/(ال)?عرض.{0,20}(بكام|كام|سعر)|(بكام|كام|سعر).{0,20}(ال)?عرض/i.test(t)) return true;
  if (!lastBotDescribedRoutine(lastBot) && !resolveRoutineKeyFromText(t)) return false;
  // Bare price after routine description
  if (
    isBarePriceWordAsk(message)
    || /^(و\s*)?(ال)?سعر\s*(كام|بكام)?(\s*يا\s*فندم)?[\s!.،؟?]*$/i.test(t)
    || /^(و\s*)?(بكام|كام)(\s*يا\s*فندم)?[\s!.،؟?]*$/i.test(t)
    || /(ال)?سعر\s*كام/i.test(t)
  ) {
    return true;
  }
  // Named product price (كريم/غسول/لوشن/ليزر) is unit SKU — not the routine
  if (/(غسول|كريم|لوشن|ليزر)/.test(t) && /(بكام|بكم|سعر|كام)/.test(t) && !/(روتين|عرض|كورس)/.test(t)) {
    return false;
  }
  if (isPriceQuestion(message) && !/(غسول|كريم|لوشن|ليزر)/.test(t.replace(/غسول\s*التفتيح|كريم\s*التفتيح|لوشن\s*اليدين/g, ''))) {
    // Long quote of routine products + price ask → still offer
    if (resolveRoutineKeyFromText(t) || lastBotDescribedRoutine(lastBot)) return true;
  }
  return false;
}

/**
 * A bare "بكام؟" with nothing named.
 *
 * This used to answer with all three routines and their prices. Owner's rule:
 * find out what she wants first — a priced list nobody asked for reads like a
 * flyer and answers a question she has not asked yet. She tells us by naming a
 * product, naming an offer, or sending a photo, and each of those is answered
 * directly, with a real price.
 */
function whichOfferPriceAskReply() {
  return (
    'عندنا منتجات فردية وعروض روتين كاملة يا فندم 💜\n'
    + 'قوليلي عايزة تحسّني إيه، أو اسم المنتج اللي في بالك — وأقولك سعره على طول.'
  );
}

/** Bare "سعر/ءعر/سغر/بكام" — always the 3 routine offers, never Gemini catalog dump. */
function isBarePriceWordAsk(message) {
  const t = prepareCustomerText(expandFrancoAndTypos(message)).replace(/بكم/g, 'بكام');
  if (!t || t.length > 30) return false;
  return /^(و\s*)?(ما\s*)?(ال)?(سعر|اسعار|الأسعار|بكام|كام|price|hm|bkam)[\s!.،؟?]*$/i.test(t);
}

/** "؟؟؟" / emoji-only — confusion or soft ack, not a product dump. */
function isConfusedOrEmojiOnly(message) {
  const raw = String(message || '').trim();
  if (!raw || raw.length > 40) return false;
  if (/^[؟?\s.!،,]+$/.test(raw)) return true;
  // emoji / stickers only (no Arabic/Latin letters or digits)
  const stripped = raw.replace(/[\s\p{Extended_Pictographic}\uFE0F\u200D]/gu, '');
  return stripped.length === 0 && /[\p{Extended_Pictographic}]/u.test(raw);
}

function checkoutDetailsAskReply(data = {}) {
  const hasPhone = !!(data.phone && isValidEgPhone(data.phone));
  const hasName = !!data.name;
  const hasAddr = !!(data.address && isUsableDeliveryAddress(data.address));
  if (hasName && hasPhone && hasAddr) {
    return 'تمام يا فندم ✍️ آخري حاجة: ابعتي **اسم المحافظة** لو سمحتِ';
  }
  // If we already captured name + phone but the address isn't usable yet,
  // don't re-ask everything; just request the detailed street address.
  if (hasName && hasPhone && !hasAddr) {
    return 'تمام يا فندم ✅ ابعتي **العنوان بالتفصيل** في رسالة (المنطقة · الشارع أو البلوك · علامة مميزة زي سوبر ماركت قريب) 💜';
  }
  const lines = ['تمام يا فندم ✍️ ابعتيلي في **رسالة واحدة**:'];
  if (!hasName) lines.push('• **الاسم الثلاثي**');
  if (!hasPhone) lines.push('• **رقم الموبايل** (01xxxxxxxxx)');
  if (!hasAddr) lines.push('• **العنوان بالكامل** (المنطقة · الشارع · علامة مميزة)');
  lines.push('');
  lines.push(hasPhone ? 'الموبايل عندي خلاص ✅ — ابعتي الباقي في نفس الرسالة 💜' : 'وبعدين هسألكِ عن المحافظة بس 💜');
  return lines.join('\n');
}

/** Explicit ask for the full list of deals (not "بكام" while on an ad). */
function wantsAllOffersList(message) {
  return isOffersListAsk(message) || isWholeSetOrCollectionAsk(message);
}

/**
 * Bare price / "العرض بكام" while ManyChat/session has an active ad → that offer only.
 */
function shouldAnswerWithAdBundle(message, selectedBundleKey) {
  if (!getBundleByKey(selectedBundleKey)) return false;
  if (wantsAllOffersList(message)) return false;
  if (wantsSingleSkuOnly(message)) return false;
  // 1–2 named products → unit prices path, not the ad routine
  if (isFewNamedProductsPriceAsk(message)) return false;
  if (isBothOfThemPriceAsk(message)) return false;
  const t = prepareCustomerText(expandFrancoAndTypos(message));
  if (/(غسول|كريم|لوشن)/.test(t) && !/(روتين|عرض|كورس|مجموعه|مجموعة)/.test(t) && isPriceQuestion(message)) {
    return false;
  }
  const other = resolveBundleFromCustomerText(message);
  if (other && other.key !== selectedBundleKey) return false;
  return (
    isPriceQuestion(message)
    || isVagueOfferQuestion(message)
    || isRoutineOrOfferPriceAsk(message)
    || isFullOfferPackagePriceAsk(message)
  );
}

/**
 * Concern about brightening / bikini / underarms / body pigmentation —
 * pitch the full brightening ROUTINE, not a single cream (unless she said بس/فقط).
 */
function isBrighteningRoutineNeed(message) {
  const t = softNormalizeAr(expandFrancoAndTypos(String(message || '')));
  if (!t || t.length > 140) return false;
  // "بينفع للبكيني؟" is a suitability FAQ — not a fresh routine pitch/buy
  if (isAreaSuitabilityQuestion(message)) return false;
  if (/(بس|فقط)\s*(كريم|غسول|منتج)|كريم\s*(بس|فقط)|غسول\s*(بس|فقط)|منتج\s*واحد|لوحده|لو\s*حده/.test(t)) {
    return false;
  }
  // Named 1–2 SKUs / price asks — unit prices, not full routine
  if (wantsSingleSkuOnly(message) || isFewNamedProductsPriceAsk(message) || isBothOfThemPriceAsk(message)) return false;
  if (isPriceQuestion(message) && /(غسول|كريم|لوشن)/.test(t) && !/(روتين|عرض|كورس|مجموعه|مجموعة)/.test(t)) return false;
  if (/(غسول|كريم)\s*التفتيح/.test(t) && !/(روتين|عرض|كورس|مجموعه|مجموعة|والغسول|والكريم)/.test(t)) {
    return false;
  }
  // Areas: bikini, underarm, arm, body pigmentation (اندر ارم expands to تحت الابط)
  if (/(ب\s*ي?\s*كين[يى]|بكينى|bikini|تحت\s*ال[إا]بط|اسمرار|المناطق\s*الحساسه|المناطق\s*الحساسة|الاماكن\s*الحساسه|الأماكن\s*الحساسة|اماكن\s*حساس|\barm\b|الارم|الأرم|ذراع|دراع|اندر)/i.test(t)) {
    return true;
  }
  if (/تفتيح/.test(t) && /(ب\s*ي?\s*كين|جسم|ابط|إبط|بقع|تصبغ|كلف|مناطق|اماكن|أماكن|ارم|ذراع|دراع|arm|اندر)/i.test(t)) {
    return true;
  }
  if (/^(في|فيه|عندكم|عندك)\s*(تفتيح|روتين\s*تفتيح)/i.test(t)) return true;
  // "منتج للتفتيح" / "حاجة تفتيح فعالة" (بس هنا = لكن، مش "منتج بس")
  if (/منتج/.test(t) && /تفتيح/.test(t) && !/غسول\s*التفتيح|كريم\s*التفتيح/.test(t)) return true;
  if (/تفتيح/.test(t) && /(فعال|فعّال|قوي|ينفع|شغال|نتيجه|نتيجة|حاج[ةه])/.test(t)) return true;
  // "عايزة عرض تفتيح…" / "عايزة تفتيح" (words may sit between)
  if (/(عا[ييو]ز[اهة]?|محتاج[اهة]?).{0,30}(تفتيح|روتين\s*تفتيح)/i.test(t) && !/غسول/.test(t)) {
    return true;
  }
  if (/(عرض|روتين).{0,25}تفتيح/i.test(t) || /تفتيح.{0,25}(عرض|روتين)/i.test(t)) {
    return true;
  }
  return false;
}

/**
 * Concern → which of the 3 routines (null = allow single-product recommend).
 * Explicit "كريم بس / منتج واحد" → null.
 */
function resolveRoutineNeedFromConcern(message) {
  const t = softNormalizeAr(expandFrancoAndTypos(String(message || '')));
  if (!t || t.length > 140) return null;
  if (/(بس|فقط)\s*(كريم|غسول|لوشن|منتج)|كريم\s*(بس|فقط)|غسول\s*(بس|فقط)|منتج\s*واحد/.test(t)) {
    return null;
  }
  // Price of laser cream alone — not the post-laser routine pitch
  if (wantsSingleSkuOnly(message) || isFewNamedProductsPriceAsk(message)) return null;
  if (isBrighteningRoutineNeed(message)) return 'brightening';
  if (/ليزر/.test(t) && !/غسول\s*التفتيح/.test(t) && !/(بكام|بكم|سعر|كام)/.test(t)) return 'post-laser';
  if (/(حبوب|حب\s*الشباب)/.test(t) && /(روتين|عرض|مجموعه|عناي|الوش|جسم)/.test(t)) return 'face-body';
  return null;
}

function pitchBrighteningRoutineReply() {
  const bundle = getBundleByKey('brightening');
  if (!bundle) return emptyCartOfferRoutinesReply();
  return (
    formatBundlePriceReply(bundle) +
    '\n\n(مناسب لتفتيح المناطق الحساسة والجسم والتصبغات — الروتين كامل أوفر من منتج لوحده 💜)'
  );
}

function pitchRoutineByKey(key) {
  const bundle = getBundleByKey(key);
  if (!bundle) return emptyCartOfferRoutinesReply();
  if (key === 'brightening') return pitchBrighteningRoutineReply();
  return formatBundlePriceReply(bundle);
}

/** Did we already pitch this exact routine earlier in the thread? */
function historyAlreadyPitchedBundle(chatHistory, key) {
  if (!key) return false;
  for (const h of chatHistory || []) {
    if (h?.role !== 'model') continue;
    const text = String(h.text || '');
    // Listing all 3 offers is NOT a dedicated pitch of one routine
    if (/618|549/.test(text) && /777|699/.test(text) && /558|499/.test(text)) continue;
    const pitched = resolveSinglePitchedBundle(text);
    if (pitched?.key === key) return true;
    if (getBundleByKey(key) && text.includes(String(getBundleByKey(key).bundlePrice))) {
      const b = getBundleByKey(key);
      if (b && text.includes(b.name)) return true;
    }
  }
  return false;
}

/**
 * Same concern/offer again after we already pitched it → add to cart / soft nudge,
 * never dump the full pitch + CTA a second (or third) time.
 */
async function replyForAlreadyPitchedRoutine(sid, bundle, message, chatHistory = []) {
  const t = softNormalizeAr(expandFrancoAndTypos(String(message || '')));
  // Suitability / FAQ about the same area must NEVER re-add the bundle
  if (isAreaSuitabilityQuestion(message)) {
    return areaSuitabilityReply(sid, chatHistory, message);
  }
  if (isUsageHowToAsk(message)) {
    return formatRoutineUsageReply(sid, chatHistory, message);
  }
  if (isCompositionOrWhatsInAsk(message) || isIngredientsOrDetailsQuestion(message)) {
    const explained = await formatActiveRoutineExplainReply(sid, chatHistory, {
      checkoutNudge: true,
      message,
    });
    if (explained) return explained;
  }
  if (isShowProductsLookAsk(message)) {
    return productLookLinkReply(sid, chatHistory, bundle.key, null);
  }
  const cart = sessionCarts[sid] || [];
  const inCart = cart.some((i) => i.bundleKey === bundle.key || i.id === `bundle:${bundle.key}`);
  const wantsBuy =
    isExplicitCheckoutIntent(message)
    || isProductAddConfirmation(message)
    || /^(اه|ايوه|أيوه|تمام|ماشي|حاضر|يلا|خلاص|ok|اوك)[\s!.،؟?]*$/i.test(String(message || '').trim())
    || /(عا[ييو]ز[اهة]?|محتاج[اهة]?|ابي|أبي).{0,40}(تفتيح|عرض|روتين|اوردر|أوردر|اطلب|الليزر)/i.test(t)
    || /(سجلي|سجّلي|خدو|خدوا|يلا\s*(ن)?اوردر)/i.test(t);

  if (wantsBuy && !inCart) {
    return replyAfterAddingOfferBundle(sid, bundle);
  }
  if (inCart) {
    return {
      reply:
        `العرض **${bundle.name}** موجود في أوردرك يا فندم 💜\n` +
        `المنتجات: ${bundle.productLabels.join(' + ')}.\n` +
        `السعر **${bundle.bundlePrice}** جنيه — الشحن مجاني 🎁\n\n` +
        `لو حابة نكمّل قولي «نكمل»`,
      sessionId: sid,
      selectedBundleKey: bundle.key,
      keepCta: true,
    };
  }
  return {
    reply:
      `العرض ده قدامك يا فندم: **${bundle.name}** بـ **${bundle.bundlePrice}** جنيه — الشحن مجاني 🎁\n` +
      `لو حابة تشوفي الشكل قولي «وريني»، أو قولي «أوردر» لو قررتي`,
    sessionId: sid,
    selectedBundleKey: bundle.key,
  };
}

/** Customer affirming ManyChat's "تحبي تعملي أوردر؟" or explicit order want — NOT bare "تمام". */
function wantsAdBundleOrder(message) {
  if (!message) return false;
  if (isCancelCurrentOrderAsk(message)) return false;
  // Bare "تمام/ايوه" alone is NOT an order ask — only after bot asked about the offer
  // (handled via botAskedBundleConfirm + isAffirmativeShort in tryAdOfferFlow).
  if (isExplicitCheckoutIntent(message)) return true;
  const t = softNormalizeAr(expandFrancoAndTypos(message));
  return /(عا[ييو]ز[اهة]?|محتاج[اهة]?).{0,20}(اوردر|أوردر|طلب|العرض)/i.test(t)
    || /(ايوه|أيوه|اه|نعم|يلا|خلاص).{0,20}(اوردر|أوردر|طلب|العرض)/i.test(t);
}

function lastBotHandedOffToCs(lastBot) {
  const t = String(lastBot || '');
  if (!t) return false;
  return /01019787225|خدمة\s*العملاء|الفريق\s*المختص|هيتواصل|يتواصل\s*معاكي/i.test(t);
}

function isCheckoutConfirmYes(message) {
  const t = String(message || '').trim();
  return isExplicitCheckoutIntent(t)
    || /^(نعم|ايوه|أيوه|اه|آه|أ?[iي]و[ae]|yes|yeah|yep|كمل(ي|و)?|نكمل|اكمل(ي|و)?|نفذ(ي|و)?|جاهز(ة|ه)?|تمام|ماشي|حاضر|موافق|يريت|خلاص|ok|اوك|okay)([\s!.،؟?]|$)/i.test(t)
    || /^(تمام|ماشي|حاضر)\s*(نكمل|كملي|نفذ|يلا|دلوقتي)?[\s!.،؟?]*$/i.test(t);
}

function isAffirmativeShort(message) {
  const t = String(message || '').trim();
  return /^(نعم|ايوه|أيوه|اه|آه|أ?[iي]و[ae]|yes|yeah|yep|تمام|ماشي|ماشيء|ماشى|حاضر|موافق|يريت|خلاص|يلا|ok|اوك|okay|طيب)([!.،؟?\s]|يا\s*فندم)*$/i.test(t);
}

function isAddressCompleteClaim(message) {
  const t = softNormalizeAr(expandFrancoAndTypos(String(message || '')));
  return /(كده\s*كامل|هو\s*(ذا|ده)\s*كامل|ده\s*(ال)?كامل|العنوان\s*كامل|مش\s*ناقص|كامل\s*(كده|يا)?)/i.test(t)
    || /^(لا\s+)?(هو\s+)?(ذا|ده)\s*كامل/i.test(t);
}

function lastLongUserAddress(chatHistory) {
  for (let i = (chatHistory || []).length - 1; i >= 0; i--) {
    if (chatHistory[i]?.role !== 'user') continue;
    const t = String(chatHistory[i].text || '').trim().replace(/\s+/g, ' ');
    if (looksLikeAddressOnly(t) && t.length >= 25) return t.slice(0, 500);
  }
  return null;
}

function lastBotConfirmedOrder(lastBot) {
  return /تم تسجيل أوردرك|رقم الطلب\s*:?\s*\*?MON-|الأوردر\s+\*?MON-|اتسجل بنجاح/i.test(String(lastBot || ''));
}

function historyHasRecentOrderConfirm(chatHistory, lookback = 6) {
  const hist = chatHistory || [];
  let seen = 0;
  for (let i = hist.length - 1; i >= 0 && seen < lookback; i--) {
    if (hist[i]?.role !== 'model') continue;
    seen += 1;
    if (lastBotConfirmedOrder(hist[i].text)) return true;
  }
  return false;
}

function isGreetingOrSoftOpen(message) {
  const t = String(message || '').trim();
  if (!t) return true;
  if (/^(السلام\s*عليكم|سلام|مرحبا|مرحباً|اهلا|أهلاً?|اهلاً|هلا|صباح(\s*الخير)?|مساء(\s*الخير)?|hello|hi|hey|ازيك|إزيك|عامل(ة|ه)?\s*ايه)[\s!.،؟?]*$/i.test(t)) {
    return true;
  }
  // Ice-breaker / interest stubs common after ad welcome
  if (/^(عايز(ة|ه)?|محتاج(ة|ه)?|التفاصيل|التفصيل|العرض|الأوردر|الطلب|interested|info|details)[\s!.،؟?]*$/i.test(t)) {
    return true;
  }
  return false;
}

async function addBundleEntityToCart(sid, bundle) {
  if (!bundle?.productSlugs?.length) return { ok: false, names: [] };
  const { data: products, error } = await sb.from('products')
    .select('id, name, price, image_url, slug, stock')
    .in('slug', bundle.productSlugs)
    .eq('is_active', true);
  if (error || !products?.length) return { ok: false, names: [] };

  const ordered = bundle.productSlugs
    .map((slug) => products.find((p) => p.slug === slug))
    .filter(Boolean);
  if (ordered.length !== bundle.productSlugs.length) return { ok: false, names: [] };
  if (ordered.some((p) => (p.stock ?? 0) <= 0)) {
    return { ok: false, names: ordered.map((p) => p.name), oos: true };
  }

  // One cart entity priced at the bundle total (not list-price sum).
  // Checkout expands to product lines with bundleSlug for create_guest_order.
  const cart = sessionCarts[sid] || (sessionCarts[sid] = []);
  const bundleId = `bundle:${bundle.key}`;
  const existing = cart.find((x) => x.id === bundleId || x.bundleKey === bundle.key);
  if (existing) {
    existing.qty += 1;
    existing.price = bundle.bundlePrice;
    existing.name = bundle.name;
    existing.isBundle = true;
    existing.bundleKey = bundle.key;
    existing.bundleSlug = bundle.slug;
    existing.productSlugs = bundle.productSlugs;
    existing.productIds = ordered.map((p) => p.id);
  } else {
    // Remove overlapping individual lines from the same bundle products
    const ids = new Set(ordered.map((p) => p.id));
    sessionCarts[sid] = cart.filter((i) => !ids.has(i.id) && i.id !== bundleId);
    sessionCarts[sid].push({
      id: bundleId,
      name: bundle.name,
      image: ordered[0].image_url,
      price: bundle.bundlePrice,
      qty: 1,
      isBundle: true,
      bundleKey: bundle.key,
      bundleSlug: bundle.slug,
      productSlugs: bundle.productSlugs,
      productIds: ordered.map((p) => p.id),
    });
  }
  return {
    ok: true,
    names: ordered.map((p) => p.name),
    total: bundle.bundlePrice,
  };
}

/**
 * ManyChat selectedBundle → pitch / confirm the matching ad bundle.
 * Explicit other product/bundle mention wins over ad context.
 */
async function tryAdOfferFlow({ message, sid, chatHistory, selectedBundle, sessionBundleKey }) {
  // Checkout data dump must never re-pitch the ad greeting
  if (
    looksLikeVolunteeredDeliveryDetails(message)
    || isMetaPlatformNoiseMessage(message)
  ) {
    return {
      sessionId: sid,
      selectedBundleKey: getBundleByKey(sessionBundleKey)?.key || resolveSelectedBundle(selectedBundle)?.key || null,
      continue: true,
    };
  }

  const fromRequest = resolveSelectedBundle(selectedBundle);
  const fromSession = getBundleByKey(sessionBundleKey);
  const fromText = resolveBundleFromCustomerText(message);
  const lastBot = lastModelMessage(chatHistory);
  const pitchedFromBot = resolveSinglePitchedBundle(lastBot);
  const cart = sessionCarts[sid] || [];
  const cartBundleItem = cart.find((i) => i?.isBundle || String(i?.id || '').startsWith('bundle:'));
  const fromCart = cartBundleItem ? getBundleByKey(cartBundleItem.bundleKey) : null;

  // Session key: ManyChat request wins, else stored session
  let activeKey = fromRequest?.key || fromSession?.key || null;
  let bundle = fromRequest || fromSession || null;

  // Cart already has a routine — don't let a stale ManyChat selectedBundle
  // swap 699 brightening for 549 post-laser on a bare "ايوه/صح"
  if (
    fromCart
    && bundle
    && fromCart.key !== bundle.key
    && !isOfferOrdinalPick(message)
    && !(fromText && fromText.key === bundle.key)
  ) {
    bundle = fromCart;
    activeKey = fromCart.key;
  }

  // Explicit "عرض 777 / 699 / روتين التفتيح" wins over ad field
  if (fromText && (!bundle || fromText.key !== bundle.key) && /(777|٧٧٧|699|٦٩٩|تفتيح|روتين)/i.test(String(message || ''))) {
    bundle = fromText;
    activeKey = fromText.key;
  }

  // Customer explicitly named another bundle → their words win (no forced ad pitch)
  if (
    fromText &&
    activeKey &&
    fromText.key !== activeKey &&
    message &&
    !isVagueOfferQuestion(message) &&
    !isGreetingOrSoftOpen(message) &&
    !isAffirmativeShort(message) &&
    !botAskedBundleConfirm(lastBot) &&
    !isOfferOrdinalPick(message)
  ) {
    return {
      sessionId: sid,
      selectedBundleKey: fromText.key,
      continue: true,
    };
  }

  // "العرض الاول" / "التاني" → lock that routine and pitch it (never leave to Gemini)
  if (fromText && isOfferOrdinalPick(message)) {
    return {
      reply: formatBundlePriceReply(fromText),
      sessionId: sid,
      selectedBundleKey: fromText.key,
      keepCta: true,
    };
  }

  // No ad context yet, but they named a bundle / "بكام الغسول والكريم"
  if (
    !bundle &&
    fromText &&
    (isVagueOfferQuestion(message) ||
      isGreetingOrSoftOpen(message) ||
      !message ||
      isCleanserCreamPairAsk(message) ||
      isPriceQuestion(message) ||
      isOfferOrdinalPick(message))
  ) {
    bundle = fromText;
    activeKey = fromText.key;
  }

  // After we (or Gemini) detailed exactly one offer, keep that for "اعمل اوردر"
  if (!bundle && pitchedFromBot) {
    bundle = pitchedFromBot;
    activeKey = pitchedFromBot.key;
  }

  if (!bundle) {
    return activeKey
      ? { sessionId: sid, selectedBundleKey: activeKey, continue: true }
      : null;
  }

  // ManyChat often asks "تحبي تعملي أوردر؟" itself — our history has no pitch yet.
  // "ايوه عاوزا اوردر" must still lock the ad bundle and start closing the deal.
  // CRITICAL: if last bot turn pitched a *single product* ("تحبي أسجلك أوردر؟"
  // without بالعرض), "تمام" must add that product — NOT the whole ad bundle.
  const lastPitchedSingleProduct =
    wasAskingToAddToCart(lastBot) &&
    !botAskedBundleConfirm(lastBot) &&
    !/بالعرض|سعر العرض|روتين التفتيح|عرض عناية|ما بعد الليزر|الوش والجسم/i.test(String(lastBot || '')) &&
    !pitchedFromBot;

  // After "وريني الشكل" / site link — never auto-register on "عاوزا اوردر"
  const lastWasBrowseLink = /montana\.com\.eg|شوفي شكل منتجات/i.test(String(lastBot || ''));

  const orderYes =
    !lastPitchedSingleProduct &&
    !lastWasBrowseLink &&
    (wantsAdBundleOrder(message) || isExplicitCheckoutIntent(message)) &&
    (botAskedBundleConfirm(lastBot) ||
      !!pitchedFromBot ||
      /بالعرض|سعر العرض|تحبي\s*تعملي\s*(اوردر|أوردر)|عرض\s*عناي|روتين\s*التفتيح|ما\s*بعد\s*الليزر/i.test(String(lastBot || '')) ||
      (!lastBot && (isExplicitCheckoutIntent(message) || isAffirmativeShort(message))) ||
      (isExplicitCheckoutIntent(message) && !wasAskingToAddToCart(lastBot)));

  if (lastWasBrowseLink && (wantsAdBundleOrder(message) || isExplicitCheckoutIntent(message))) {
    return {
      reply: whichOfferPriceAskReply(),
      sessionId: sid,
      selectedBundleKey: bundle.key,
    };
  }

  // Confirm → add bundle entity at bundle price
  if (
    orderYes ||
    (botAskedBundleConfirm(lastBot) &&
      (isAffirmativeShort(message) ||
        isExplicitCheckoutIntent(message) ||
        /العرض|نفس\s*العرض|عايز(ة|ه)?\s*(ده|دا|كده)/i.test(String(message || ''))))
  ) {
    const cart = sessionCarts[sid] || [];
    const already =
      cart.some((i) => i.bundleKey === bundle.key || i.id === `bundle:${bundle.key}`);
    // Bundle already in cart + "نكمل/اعمل اوردر" → go to checkout choice (don't re-pitch add)
    if (already && (isExplicitCheckoutIntent(message) || wasAskingToCheckout(lastBot) || /نكمل|نكمّل|يلا/.test(String(message || '')))) {
      return {
        ...offerCheckoutChoice(sid, {}),
        selectedBundleKey: bundle.key,
        cart: sessionCarts[sid],
      };
    }
    if (!already) {
      const added = await addBundleEntityToCart(sid, bundle);
      if (added.oos) {
        return {
          reply: `معلش يا فندم، جزء من عرض **${bundle.name}** غير متوفر حاليًا 🙏 قوليلي تحبي بديل؟`,
          sessionId: sid,
          selectedBundleKey: bundle.key,
          cart: sessionCarts[sid],
        };
      }
      if (!added.ok) {
        return {
          reply: `معلش، حصل تعذر في تسجيل عرض **${bundle.name}**. قوليلي المنتجات بالاسم وأسجّلهم 💜`,
          sessionId: sid,
          selectedBundleKey: bundle.key,
        };
      }
    } else {
      // Affirmation while already in cart → checkout
      return {
        ...offerCheckoutChoice(sid, {}),
        selectedBundleKey: bundle.key,
        cart: sessionCarts[sid],
      };
    }
    const names = bundle.productLabels.join('\n• ');
    return {
      reply:
        `تمام يا فندم 💜 سجّلت **${bundle.name}** في أوردرك:\n` +
        `• ${names}\n` +
        `سعر العرض **${bundle.bundlePrice}** جنيه — الشحن مجاني 🎁\n` +
        `الشحن **مجاني** على العرض 🎁\n\n` +
        `تحبي نكمل الأوردر؟`,
      sessionId: sid,
      selectedBundleKey: bundle.key,
      cart: sessionCarts[sid],
      keepCta: true,
    };
  }

  const alreadyPitched = botAskedBundleConfirm(lastBot);
  const shouldPitch =
    !message ||
    isGreetingOrSoftOpen(message) ||
    isVagueOfferQuestion(message) ||
    isCleanserCreamPairAsk(message) ||
    (isPriceQuestion(message) && !isFewNamedProductsPriceAsk(message) && !wantsSingleSkuOnly(message) && !isBothOfThemPriceAsk(message)) ||
    isOfferOrdinalPick(message) ||
    (fromText && fromText.key === bundle.key);

  if (shouldPitch) {
    if (
      alreadyPitched &&
      (isVagueOfferQuestion(message) || isCleanserCreamPairAsk(message) || isPriceQuestion(message))
    ) {
      return {
        reply: formatBundlePriceReply(bundle),
        sessionId: sid,
        selectedBundleKey: bundle.key,
        keepCta: true,
      };
    }
    if (alreadyPitched && isGreetingOrSoftOpen(message) && message) {
      return { sessionId: sid, selectedBundleKey: bundle.key, continue: true };
    }
    if (!alreadyPitched) {
      // Price ask about الغسول والكريم → answer with offer price directly (not only greeting)
      if (isCleanserCreamPairAsk(message) || isPriceQuestion(message)) {
        return {
          reply: formatBundlePriceReply(bundle),
          sessionId: sid,
          selectedBundleKey: bundle.key,
          keepCta: true,
        };
      }
      return {
        reply: bundle.greeting,
        sessionId: sid,
        selectedBundleKey: bundle.key,
        keepCta: true,
      };
    }
  }

  return { sessionId: sid, selectedBundleKey: bundle.key, continue: true };
}

/** Last bot turn was asking to finish / register the order (not just add a product). */
function wasAskingToCheckout(text) {
  // Do NOT match "أسجلك أوردر" — that CTA means add-to-cart, not checkout.
  return /(نكمل\s*(ال)?(طلب|اوردر|أوردر)|نكمّل(\s*(ال)?(طلب|اوردر|أوردر|تسجيل))?|كمّ?ل(ي|و)?\s*(ال)?طلب|نكمّل\s*تسجيل|تسجيل\s*(ال)?أوردر\s*دلوقتي|الطلب\s*دلوقتي|تحبي\s*نكمل)/i.test(text || '');
}

function isCheckoutConfirmNo(message) {
  const t = message.trim();
  // "لا"/"لأ" only count as "no" at the start of the message (its own
  // word) — as a bare substring they matched inside completely unrelated
  // words like "ولا" (the common conjunction "or") or "لازم" (need to),
  // silently derailing the wizard on any question containing them.
  if (/^(لا|لأ|no)([\s,،.!؟?]|$)/i.test(t)) return true;
  // "هضيف"/"اضيف" (customer deferring: "I'll add [it later]") must not
  // match as a bare substring — it also matches inside "ضيفي"/"ضيفيلي"
  // (the customer's own imperative "add it now"), which is the opposite
  // intent. \b doesn't work for Arabic in JS (word-boundary is ASCII-\w
  // based), so require an explicit whitespace/string boundary on both
  // sides instead of relying on \b.
  return /(مش\s*(دلوقتي|دلوقت|عايز|عاوز)|لا\s*شكر|حاج[ةه]\s*تاني|طلب\s*تاني|منتج\s*تاني|عا[يو]ز\s*(حاج[ةه]|منتج)\s*تاني|(^|\s)ه?ا?ضيف($|[\s.،!؟?])|كده\s*خلاص|بعدين|لاحق)/i.test(t);
}

function isThanksOrReadyToCheckout(message) {
  const t = message.trim().replace(/\s+/g, ' ');
  if (!t || t.length > 100) return false;
  if (/(مش دلوقتي|مش دلوقت|بعدين|لاحق|لاحقا|not now|later|لا شكر|no thanks|منتج تاني|حاجة تانية|عايز حاجة|عاوز حاجة)/i.test(t)) {
    return false;
  }
  return /^(شكرا|شكراً|شكرا جزيلا|شكراً جزيلاً|متشكر|متشكرة|thanks|thank you|thank u|تسلم|تسلمي|الله يخليك|الله يخليكي)[!.،؟?\s]*$/i.test(t)
    || /^(شكرا|شكراً|thanks)( جزيلا| جزيلاً| so much)?[!.،?\s]*$/i.test(t);
}

function formatCartSummary(sid) {
  const { cart, subtotal, freeShipping } = view_cart(sid);
  if (!cart.length) return '';
  const lines = cart.map(i => `• ${i.name} × ${i.qty} — ${Math.round(i.price * i.qty)} ج.م`);
  const shipLine = freeShipping
    ? (cartProductCount(cart) >= 3
      ? '*الشحن:* مجاني 🎁 (من 3 منتجات)'
      : '*الشحن:* مجاني 🎁 (عرض الروتين)')
    : '*الشحن:* حسب المحافظة';
  return `${lines.join('\n')}\n\n*إجمالي المنتجات:* ${Math.round(subtotal)} ج.م\n${shipLine}`;
}

function maybeNudgeCheckoutOnThanks(message, sid, knownPhone = null) {
  // Explicit "نكمل / أطلب" — never treat bare "شكرا" as checkout
  if (isExplicitCheckoutIntent(message)) {
    const cart = sessionCarts[sid] || [];
    if (!cart.length) return null;
    return offerCheckoutChoice(sid, { knownPhone });
  }

  if (!isThanksOrReadyToCheckout(message)) return null;

  // Bare thanks = polite close only. Dumping the cart after "شكرا" is pushy
  // (and resurrects stale carts from old Messenger sessions).
  return {
    reply: 'العفو يا فندم 💜 تحت أمرك لو احتجتي أي حاجة.',
    sessionId: sid,
    keepCta: true,
  };
}

function mergeCheckoutSeed(base = {}, slots = {}) {
  const seed = { ...base };
  if (slots.name && !seed.name) seed.name = String(slots.name).trim().replace(/\s+/g, ' ');
  if (slots.address && !seed.address) seed.address = String(slots.address).trim().replace(/\s+/g, ' ');
  if (slots.governorate && !seed.governorate) seed.governorate = String(slots.governorate).trim();
  const phone = normalizePhone(slots.phone) || extractPhoneFromText(slots.phone || '') || null;
  if (phone && !seed.phone) seed.phone = phone;
  return seed;
}

/** Regex-only fallback when Gemini intent is OTHER / failed. */
function regexFallbackIntent(message, { wizardStep } = {}) {
  if (isPointsProgramQuestion(message)) return { intent: 'POINTS_ASK', products: [], slots: {} };
  if (isDeliveryEtaAsk(message)) return { intent: 'DELIVERY_ETA', products: [], slots: {} };
  if (isHowToRegisterAsk(message)) return { intent: 'HOW_TO_ORDER', products: [], slots: {} };

  // Mid-checkout: prefer delivery-data intents before FAQ false-positives
  if (wizardStep === 'await_method' || wizardStep === 'details' || wizardStep === 'name' || wizardStep === 'phone' || wizardStep === 'address' || wizardStep === 'governorate') {
    if (isCheckoutMethodSite(message)) return { intent: 'CHOOSE_SITE', products: [], slots: {} };
    if (isCheckoutMethodChat(message)) return { intent: 'CHOOSE_CHAT', products: [], slots: {} };
    // Name+phone+address dump must win over bare PROVIDE_PHONE (digit-only length ≤ 16)
    if (looksLikeVolunteeredDeliveryDetails(message)) {
      const parsed = parseVolunteeredDeliveryDetails(message);
      return {
        intent: 'PROVIDE_FULL_DETAILS',
        products: [],
        slots: {
          name: parsed?.name || null,
          phone: parsed?.phone || extractPhoneFromText(message) || null,
          address: parsed?.address || null,
        },
      };
    }
    if (wizardStep === 'governorate' || isGovernorateOnlyText(message)) {
      if (isGovernorateOnlyText(message)) {
        return {
          intent: 'PROVIDE_GOVERNORATE',
          products: [],
          slots: { governorate: String(message || '').trim().replace(/\s+/g, ' ') },
        };
      }
    }
    const phone = normalizePhone(message) || extractPhoneFromText(message);
    const digitLen = String(message || '').replace(/[^\d+٠-٩]/g, '').length;
    const nonDigitLen = String(message || '').replace(/[\d+٠-٩\s]/g, '').length;
    // Phone-only (or phone + tiny noise) — not a full details dump
    if (phone && digitLen <= 16 && nonDigitLen <= 8) {
      return { intent: 'PROVIDE_PHONE', products: [], slots: { phone } };
    }
    if (wizardStep === 'address' || looksLikeAddressOnly(message)) {
      if (looksLikeAddressOnly(message) || (wizardStep === 'address' && String(message || '').trim().length >= 10)) {
        return {
          intent: 'PROVIDE_ADDRESS',
          products: [],
          slots: { address: String(message || '').trim().replace(/\s+/g, ' ').slice(0, 500) },
        };
      }
    }
    if (looksLikePersonName(message)) {
      return {
        intent: 'PROVIDE_NAME',
        products: [],
        slots: { name: String(message || '').trim().replace(/\s+/g, ' ') },
      };
    }
  }

  if (isWhiteningEffectAsk(message)) return { intent: 'ASK_WHITENING_EFFECT', products: [], slots: {} };
  if (isGuaranteeOrSafetyQuestion(message)) return { intent: 'ASK_GUARANTEE', products: [], slots: {} };
  if (isResultsTimelineQuestion(message)) return { intent: 'ASK_RESULTS', products: [], slots: {} };
  if (isReturnPolicyQuestion(message)) return { intent: 'ASK_RETURN', products: [], slots: {} };
  if (isAreaSuitabilityQuestion(message)) return { intent: 'ASK_SUITABILITY', products: [], slots: {} };
  if (isUsageHowToAsk(message)) return { intent: 'ASK_USAGE', products: [], slots: {} };
  if (isIngredientsOrDetailsQuestion(message)) {
    const t = prepareCustomerText(expandFrancoAndTypos(message));
    const intent = /(مكونات|مكون|تركيبة|ingredients?)/i.test(t) && !/(فايده|فوائد|بيعمل)/i.test(t)
      ? 'ASK_INGREDIENTS'
      : 'ASK_BENEFITS';
    return { intent, products: [], slots: {} };
  }
  // Brightening concerns before generic "عرض/روتين" list — otherwise "عايزة عرض تفتيح الارم" becomes ROUTINE_OR_SET
  if (isBrighteningRoutineNeed(message)) {
    return { intent: 'SELECT_OFFER', products: [], slots: { offerKey: 'brightening', offerIndex: 2 } };
  }
  if (isWholeSetOrCollectionAsk(message) || isOffersListAsk(message)) {
    return { intent: 'ROUTINE_OR_SET', products: [], slots: {} };
  }
  if (isOfferOrdinalPick(message)) {
    const many = resolveAllBundlesFromOrdinals(message);
    const b = many[0] || resolveBundleFromOrdinal(message) || resolveBundleFromCustomerText(message);
    return {
      intent: 'SELECT_OFFER',
      products: [],
      slots: b ? { offerKey: b.key, offerIndex: ['post-laser', 'brightening', 'face-body'].indexOf(b.key) + 1 } : {},
    };
  }
  const named = resolveBundleFromCustomerText(message);
  if (named && /(عرض|روتين|عا[ييو]ز|محتاج|ده|دا|عاوز)/i.test(String(message || ''))) {
    return {
      intent: 'SELECT_OFFER',
      products: [],
      slots: { offerKey: named.key },
    };
  }
  if (isPriceQuestion(message) || isVagueOfferQuestion(message) || isRoutineOrOfferPriceAsk(message)) {
    return { intent: 'PRICE_ASK', products: [], slots: {} };
  }
  if (isCheckoutMethodSite(message)) return { intent: 'CHOOSE_SITE', products: [], slots: {} };
  if (isCheckoutMethodChat(message)) return { intent: 'CHOOSE_CHAT', products: [], slots: {} };
  if (isCancelCurrentOrderAsk(message)) return { intent: 'OTHER', products: [], slots: {} };
  if (isExplicitCheckoutIntent(message)) return { intent: 'CHECKOUT_READY', products: [], slots: {} };

  if (looksLikeVolunteeredDeliveryDetails(message)) {
    const parsed = parseVolunteeredDeliveryDetails(message);
    return {
      intent: 'PROVIDE_FULL_DETAILS',
      products: [],
      slots: {
        name: parsed?.name || null,
        phone: parsed?.phone || extractPhoneFromText(message) || null,
        address: parsed?.address || null,
      },
    };
  }

  return { intent: 'OTHER', products: [], slots: {} };
}

function resolveEffectiveIntent(classified, message, ctx = {}) {
  // Hard overrides — never trust Gemini on bare price typos / confusion
  if (isBarePriceWordAsk(message)) {
    return { intent: 'PRICE_ASK', products: [], slots: {} };
  }
  if (isBareDetailsOrInfoAsk(message)) {
    return { intent: 'ROUTINE_OR_SET', products: [], slots: {} };
  }
  if (isUnitProductsPriceListAsk(message)) {
    return { intent: 'PRICE_ASK', products: [], slots: {} };
  }
  if (isUsageHowToAsk(message)) {
    return { intent: 'ASK_USAGE', products: [], slots: {} };
  }
  if (isAreaSuitabilityQuestion(message)) {
    return { intent: 'ASK_SUITABILITY', products: [], slots: {} };
  }
  // "الاوردر موصلش" must never become CHECKOUT_READY / PRICE_ASK / offer pick
  if (wantsExistingOrderHelp(message)) {
    return { intent: 'OTHER', products: [], slots: {} };
  }
  if (isWalkAwayDecline(message)) {
    return { intent: 'OTHER', products: [], slots: {} };
  }
  if (isDiscountHaggleAsk(message)) {
    return { intent: 'OTHER', products: [], slots: {} };
  }
  if (
    isPriceQuestion(message)
    && !/(غسول|كريم|لوشن|ليزر|حب\s*الشباب)/.test(prepareCustomerText(expandFrancoAndTypos(message)))
    && prepareCustomerText(expandFrancoAndTypos(message)).length <= 28
  ) {
    return { intent: 'PRICE_ASK', products: [], slots: {} };
  }

  const base = classified && classified.intent && classified.intent !== 'OTHER'
    ? classified
    : null;
  if (base) {
    // Ensure slots object always present
    return { ...base, slots: base.slots || {} };
  }
  const fb = regexFallbackIntent(message, ctx);
  const gemSlots = (classified && classified.slots) || {};
  return {
    ...fb,
    slots: { ...gemSlots, ...(fb.slots || {}) },
    products: (fb.products && fb.products.length) ? fb.products : (classified?.products || []),
  };
}

/** Resolve which of the 3 offers the customer means from intent slots / text / last bot. */
function resolveOfferBundleFromContext(classified, message, lastBot, selectedBundleKey) {
  const slots = classified?.slots || {};
  if (slots.offerKey) {
    const b = getBundleByKey(slots.offerKey);
    if (b) return b;
  }
  if (slots.offerIndex >= 1 && slots.offerIndex <= 3) {
    const keys = ['post-laser', 'brightening', 'face-body'];
    const b = getBundleByKey(keys[slots.offerIndex - 1]);
    if (b) return b;
  }
  const fromText = resolveBundleFromCustomerText(message) || resolveBundleFromOrdinal(message);
  if (fromText) return fromText;
  if (selectedBundleKey) {
    const b = getBundleByKey(selectedBundleKey);
    if (b) return b;
  }
  return resolveSinglePitchedBundle(lastBot);
}

async function replyAfterAddingOfferBundle(sid, bundle) {
  const cart = sessionCarts[sid] || [];
  const already = cart.some((i) => i.bundleKey === bundle.key || i.id === `bundle:${bundle.key}`);
  if (already) {
    const names = bundle.productLabels.join('\n• ');
    return {
      reply:
        `العرض **${bundle.name}** موجود في أوردرك يا فندم 💜\n` +
        `• ${names}\n` +
        `سعره **${bundle.bundlePrice}** جنيه — الشحن مجاني 🎁\n\n` +
        `تحبي نكمل الأوردر؟`,
      sessionId: sid,
      selectedBundleKey: bundle.key,
      cart: sessionCarts[sid],
      keepCta: true,
    };
  }
  if (!already) {
    const added = await addBundleEntityToCart(sid, bundle);
    if (added.oos) {
      return {
        reply: `معلش يا فندم، جزء من عرض **${bundle.name}** غير متوفر حاليًا 🙏 قوليلي تحبي بديل؟`,
        sessionId: sid,
        selectedBundleKey: bundle.key,
        cart: sessionCarts[sid],
      };
    }
    if (!added.ok) {
      return {
        reply: `معلش، حصل تعذر في تسجيل عرض **${bundle.name}**. قوليلي اسم العرض تاني 💜`,
        sessionId: sid,
        selectedBundleKey: bundle.key,
      };
    }
  }
  const names = bundle.productLabels.join('\n• ');
  return {
    reply:
      `تمام يا فندم 💜 سجّلت **${bundle.name}** في أوردرك:\n` +
      `• ${names}\n` +
      `سعر العرض **${bundle.bundlePrice}** جنيه — الشحن مجاني 🎁\n` +
      `الشحن **مجاني** على العرض 🎁\n\n` +
      `تحبي نكمل الأوردر؟`,
    sessionId: sid,
    selectedBundleKey: bundle.key,
    cart: sessionCarts[sid],
    keepCta: true,
  };
}

/** "عاوز العرض الاول والتالت" → add every named offer to cart once. */
async function replyAfterAddingMultipleOfferBundles(sid, bundles) {
  const list = (bundles || []).filter(Boolean);
  if (!list.length) return null;
  if (list.length === 1) return replyAfterAddingOfferBundle(sid, list[0]);

  const lines = [];
  let total = 0;
  for (const bundle of list) {
    const cart = sessionCarts[sid] || [];
    const already = cart.some((i) => i.bundleKey === bundle.key || i.id === `bundle:${bundle.key}`);
    if (!already) {
      const added = await addBundleEntityToCart(sid, bundle);
      if (added.oos) {
        lines.push(`• **${bundle.name}**: جزء منه غير متوفر حاليًا`);
        continue;
      }
      if (!added.ok) {
        lines.push(`• **${bundle.name}**: تعذر التسجيل`);
        continue;
      }
    }
    total += bundle.bundlePrice;
    lines.push(
      `• **${bundle.name}** — ${bundle.productLabels.join(' + ')} — **${bundle.bundlePrice}** ج`
    );
  }

  if (!lines.length) {
    return {
      reply: 'معلش يا فندم، مقدرتش أسجّل العروض. قوليلي أنهي عرض تاني 💜',
      sessionId: sid,
      cart: sessionCarts[sid],
    };
  }

  return {
    reply:
      `تمام يا فندم 💜 سجّلت العروض دي في أوردرك:\n` +
      `${lines.join('\n')}\n` +
      (total ? `الإجمالي التقريبي للعروض **${total}** جنيه.\n` : '') +
      `الشحن **مجاني** من 3 منتجات / على عروض الروتين 🎁\n\n` +
      `تحبي نكمل الأوردر؟`,
    sessionId: sid,
    selectedBundleKey: list[list.length - 1].key,
    cart: sessionCarts[sid],
    keepCta: true,
  };
}

/** "اي حاجه عادي" / "براحتك" while choosing chat vs site → default to chat. */
function isCheckoutMethodIndifferent(message) {
  const t = softNormalizeAr(expandFrancoAndTypos(String(message || '').trim()));
  if (!t || t.length > 40) return false;
  return /^(اي|أي)\s*حاج[هة](\s*عادي[ةه]?)?[\s!.،؟?]*$/i.test(t)
    || /^(عادي|عاديه|عادية|براحتك|براحته|مفيش\s*فرق|زي\s*بعض|ايهما|أيهم|اي\s*واحد)[\s!.،؟?]*$/i.test(t);
}

function isCheckoutMethodChat(message) {
  const t = softNormalizeAr(expandFrancoAndTypos(String(message || '').trim()));
  if (!t) return false;
  if (/^(1|١|واحد)([\s.،!؟?]|$)/.test(t)) return true;
  if (/^(هنا|معاكي|معاك|معاي|الشات|من\s*هنا|من خلالن[ااه]|من\s*خلال(كم|كو|نا)|بالشات)[\s!.،؟?]*$/i.test(t)) return true;
  if (isCheckoutMethodIndifferent(t)) return true;
  if (isAffirmativeShort(t) && !isCheckoutMethodSite(t)) return true;
  return /(هكمل\s*معاك|أكمل\s*معاك|نكمل\s*(هنا|معاك)|تسجّ?ل[يى]?\s*(ال)?أ?وردر\s*معاي|معاي[ااه]?\s*هنا|في\s*الشات|هنا\s*في\s*الشات|ابعت.*(بيانات|هنا)|بياناتي\s*هنا|اكتب.*(هنا|الشات)|بالشات|جوه\s*الشات|تسجيلي?\s*(هنا|معاك)|من\s*خلالن[ااه]|سجّ?ل[يى]?\s*هنا|عا[ييو]ز[اهة]?\s*هنا|خليها?\s*هنا)/i.test(t);
}

function isCheckoutMethodSite(message) {
  const t = softNormalizeAr(expandFrancoAndTypos(String(message || '').trim()));
  if (!t) return false;
  if (/^(2|٢|اتنين|ثنين)([\s.،!؟?]|$)/.test(t)) return true;
  // "ايه برنامج النقاط" is a question — not choosing the website
  if (isPointsProgramQuestion(t)) return false;
  return /(الموقع|اللينك|الرابط|لينك|رابط|على\s*الموقع|سجّ?ل\s*من\s*الموقع|على\s*الويب|checkout|من\s*خلال\s*الموقع)/i.test(t);
}

function isHowToRegisterAsk(message) {
  const t = softNormalizeAr(expandFrancoAndTypos(message));
  if (!t || t.length > 100) return false;
  return /(ازاي|إزاي|كيف|how).{0,25}(اسجل|أسجل|سجّ?ل|تسجيل|اطلب|أوردر|اوردر)/i.test(t)
    || /(اسجل|أسجل|سجّ?ل|تسجيل).{0,20}(ازاي|إزاي|فين|كيف|how)/i.test(t)
    || /^(طيب\s*)?(اسجل|أسجل|ازاي\s*اسجل|إزاي\s*أسجل)[\s!.،؟?]*$/i.test(t);
}

function isDeliveryEtaAsk(message) {
  // softNormalizeAr maps ى→ي so patterns must use ي (امتي/متي) not ى (امتى/متى)
  const t = softNormalizeAr(expandFrancoAndTypos(message));
  if (!t || t.length > 100) return false;
  // Cost to a place ("التوصيل لشبرا بكام") is shipping cost, not ETA
  if (isShippingCostQuestion(message)) return false;
  return /(هسل[تمو]+|ه?ت?وصل|ب?ي?وصل|استلم|توصيل|الشحن|التوصيل).{0,25}(كام|قد\s*ايه|امتي|متي|اي|ايه|وقت|بكره|بكرة|غدا|غداً|النهارده)/i.test(t)
    || /(كام|قد\s*ايه|امتي|متي|بكره|بكرة).{0,25}(ه?ت?وصل|ب?ي?وصل|استلم|توصيل|شحن)/i.test(t)
    || /^(خلال\s*كام|هتوصل\s*امتي|متي\s*ب?ي?وصل)/i.test(t)
    || /(استلم|يوصل|توصيل).{0,15}(بكره|بكرة|غدا|بسرعه|بسرعة)/i.test(t);
}

/** Bare governorate name (القاهرة / الجيزة / غربيه…) — NOT a street address. */
function isGovernorateOnlyText(message) {
  const t = softNormalizeAr(expandFrancoAndTypos(String(message || '').trim()));
  if (!t || t.length > 40) return false;
  // Optional الـ — customers often write "غربيه" / "قاهره" without it
  return /^(محافظ[ةه]\s*)?(ال)?(قاهر[ةه]|جيز[ةه]|اسكندري[ةه]|إسكندري[ةه]|قليوب[يةه]*|شرقي[ةه]|دقهلي[ةه]|بحير[ةه]|منوفي[ةه]|غربي[ةه]|فيوم|اسيوط|أسوان|اسوان|سوهاج|قنا|اقصر|أقصر|بورسعيد|اسماعيلي[ةه]|سويس|دمياط|كفر\s*الشيخ|مطروح|وادي\s*الجديد|شمال\s*سيناء|جنوب\s*سيناء|بحر\s*الاحمر|بحر\s*الأحمر|بني\s*سويف|منيا)[\s!.،؟?]*$/i.test(t);
}

function looksLikeAddressOnly(message) {
  const t = String(message || '').trim().replace(/\s+/g, ' ');
  // Real customers paste multi-line addresses (often 100–400 chars)
  if (t.length < 10 || t.length > 500) return false;
  if (normalizePhone(t)) return false;
  if (isGovernorateOnlyText(t)) return false;
  if (isPointsProgramQuestion(t) || isHowToRegisterAsk(t) || isDeliveryEtaAsk(t)) return false;
  // Short name-like blobs without address signals
  if (
    t.length <= 45
    && t.split(/\s+/).length <= 5
    && !/\d|[٠-٩]/.test(t)
    && !/(شارع|عمارة|عماره|دور|طابق|امام|أمام|حي|فيصل|ميترو|مترو|معلم|علام|بلوك|قري[ةه]|محط[ةه]|كفر)/i.test(t)
  ) {
    return false;
  }
  return /(شارع|ش\.|حي|مجاور[ةه]|عمارة|عماره|عقار|دور|طابق|الطابق|شقه|شقة|برج|حلوان|مشروع|المعادي|مدين[ةه]|منطق[ةه]|امام|أمام|جنب|نزلة|فيصل|اكتوبر|أكتوبر|ميترو|مترو|معلم|علام[ةه]|طريق|مبني|مبنى|نصر|مكرم|بلوك|سوبر\s*ماركت|عماره|الدلتا|قري[ةه]|محط[ةه]|كفر\s+\S)/i.test(t)
    || (t.length >= 14 && /[\u0600-\u06FF]{3,}/.test(t) && /\d|[٠-٩]/.test(t) && !isGovernorateOnlyText(t));
}

/** Street-level address required before create_order — never governorate alone. */
function isUsableDeliveryAddress(address) {
  const t = String(address || '').trim().replace(/\s+/g, ' ');
  if (!t || t.length < 12) return false;
  if (isGovernorateOnlyText(t)) return false;
  if (/(مش\s*ده|غلط|تغيير|نعم|ايوه)/i.test(t) && t.length < 20) return false;
  const hasStreetSignal =
    /(شارع|ش\.|عمارة|عماره|دور|طابق|شقه|شقة|برج|امام|أمام|جنب|ميترو|مترو|معلم|علام|طريق|مبني|مبنى|حي|مدين[ةه]|منطق[ةه]|نصر|مكرم|فيصل|المعادي|بلوك|سوبر\s*ماركت|الدلتا|قري[ةه]|محط[ةه]|كفر\s+\S)/i.test(t)
    || (/\d|[٠-٩]/.test(t) && /[\u0600-\u06FF]{3,}/.test(t) && t.split(/\s+/).length >= 3);
  return hasStreetSignal && (looksLikeAddressOnly(t) || t.length >= 18);
}

function isCheckoutCancelOrOffTopic(message) {
  const t = String(message || '').trim();
  if (!t) return false;
  // A delivery address must NEVER abort the checkout wizard
  if (looksLikeAddressOnly(t) || t.length > 80) return false;
  // Asking about points while choosing chat vs site — stay in wizard, don't bail
  if (isPointsProgramQuestion(t)) return false;
  if (/(إلغ[يى]?|الغي|الغى|مش\s*دلوقت[يى]?|بعدين|بطّ?لت|مش\s*عايز(ة|ه)?\s*(أكمل|اكمل|الطلب|اوردر)|cancel|stop)/i.test(t)) {
    return true;
  }
  // Product / browsing / "what did I order?" must NOT be swallowed mid-checkout
  if (/(منتج|منتجات|مكونات|مكون|سعر|اسعار|أسعار|بكام|كام\b|عرض|عروض|غسول|كريم|لوشن|تفتيح|حبوب|ندبات|ليزر|سيليكون|تصبغ|عندكم|ايه\s*عند|إيه\s*عند|الكتالوج|طلبت|اوردر|أوردر|list|price|product|ingredients)/i.test(t)) {
    return true;
  }
  // Bare greetings (were wrongly saved as customer names — "صباح الخير")
  if (/^(السلام\s*عليكم|سلام|مرحبا|مرحباً|اهلا|أهلاً?|اهلاً|صباح(\s*الخير)?|مساء(\s*الخير)?|hello|hi|hey)[\s!.،؟?]*$/i.test(t)) {
    return true;
  }
  return false;
}

async function beginChatCheckoutCollection(sid, wiz, seed = {}) {
  if (channelOf(sid) === 'web') {
    delete checkoutWizards[sid];
    return {
      reply: `تحت أمرك يا فندم 💜 املي بياناتك تحت بلطف\n\n${formatCartSummary(sid)}`,
      sessionId: sid,
      showOrderForm: show_checkout_form(sid),
    };
  }

  const knownPhone = seed.phone || wiz?.knownPhone || null;
  const data = { ...(seed || {}) };
  if (knownPhone && !data.phone) data.phone = knownPhone;

  // Returning customer with full saved profile and no conflicting seed
  if (knownPhone && !seed.name && !seed.address) {
    const profile = await getCustomerProfile(knownPhone);
    if (
      profile?.name
      && profile?.address
      && profile?.governorate
      && isUsableDeliveryAddress(profile.address)
      && !/^(مش\s*(ده|دا)|غلط)/i.test(String(profile.name || '').trim())
    ) {
      checkoutWizards[sid] = {
        step: 'confirm_saved',
        data: {
          name: profile.name,
          phone: profile.phone,
          address: profile.address,
          governorate: profile.governorate,
        },
      };
      return { reply: formatSavedProfileConfirm(profile), sessionId: sid };
    }
  }

  if (data.name && data.phone && data.address && isUsableDeliveryAddress(data.address)) {
    // Address often already has "محافظة الشرقية" — don't re-ask if we can match it
    const govHint = data.governorate
      ? await matchGovernorateName(data.governorate)
      : await matchGovernorateName(data.address);
    if (govHint) {
      data.governorate = govHint.governorate;
      checkoutWizards[sid] = { step: 'confirm_saved', data };
      // She typed these a moment ago in THIS chat — telling her we "found them
      // from a previous order" reads like the bot lost track of the conversation.
      return {
        reply: formatJustCollectedConfirm({
          name: data.name,
          phone: data.phone,
          address: data.address,
          governorate: data.governorate,
        }),
        sessionId: sid,
      };
    }
    checkoutWizards[sid] = { step: 'governorate', data };
    return {
      reply: 'تمام يا فندم ✍️ آخري حاجة: ابعتي **المحافظة** لو سمحتِ',
      sessionId: sid,
    };
  }
  // Ask name + phone + full address together (one message) — never drip fields
  checkoutWizards[sid] = { step: 'details', data };
  return {
    reply: checkoutDetailsAskReply(data),
    sessionId: sid,
  };
}

const SITE_URL = 'https://www.montana.com.eg';

/** "وريني شكل المنتجات" / "عايزة أشوف الصور" — send storefront link (no chat images). */
function isShowProductsLookAsk(message) {
  const t = prepareCustomerText(expandFrancoAndTypos(message));
  if (!t || t.length > 220) return false;
  // "ابعتيلي صورته" / "صورة منه" / "وريني الصورة"
  if (/(ابعت|ابعث|بعتي|بعتيل|وريني|ورّيني|اشوف|أشوف).{0,20}(صور|صوره|صورة|شكل)/i.test(t)) return true;
  if (/(صور|صوره|صورة|صورته|صورتها).{0,20}(منه|منو|بتاع|بتاعه|بتاعها|المنتج|الكريم|الغسول)/i.test(t)) return true;
  // "ممكن اشوفهم" / "ورهملي" / "وريني" / "اشوف الشكل"
  if (/^(و\s*)?(ممكن\s*)?(وريني|ورّيني|اشوف|أشوف|شوف|شوفلي|شوفهم|اشوفهم|أشوفهم|صور)[\s!.،؟?]*$/i.test(t)) {
    return true;
  }
  if (/(وريني|ورّيني|اشوف|أشوف|شوف|عايز[اهة]?\s*اشوف|ممكن\s*اشوف|صور|شكل|look|photo|image|show)/i.test(t)) {
    return /(منتج|المنتج|العرض|الروتين|صور|شكل|علبه|العلبه|pack|product|هم|دول)/i.test(t)
      || /شكل\s*(ال)?منتج|وريني\s*(ال)?شكل|وريني\s*(ال)?صور|اشوف\s*(ال)?شكل/.test(t);
  }
  return /(شكل\s*(ال)?منتجات|صور\s*(ال)?منتجات|عايز[اهة]?\s*اشوف\s*(ال)?منتج)/i.test(t);
}

/** "متسجلش / عايز اشوف الشكل بس" — cancel register push, show link. */
function isDontRegisterBrowseAsk(message) {
  const t = prepareCustomerText(expandFrancoAndTypos(message));
  if (!t || t.length > 140) return false;
  return /(متسجلش|ما\s*تسجلش|متسجّلش|ماتسجلش|مش\s*عا[ييو]ز[اهة]?\s*(أ?سجل|اسجل|تسجيل|اوردر|أوردر)|انا\s*عا[ييو]ز[اهة]?\s*(اشوف|أشوف|شوف)|بس\s*(اشوف|أشوف|شوف)|عا[ييو]ز[اهة]?\s*اشوف\s*الشكل)/i.test(t);
}

function resolveActiveBundleForLink(sid, chatHistory, selectedBundleKey) {
  const cart = sessionCarts[sid] || [];
  const cartBundle = cart.find((i) => i?.isBundle || String(i?.id || '').startsWith('bundle:'));
  if (cartBundle) {
    const b = getBundleByKey(cartBundle.bundleKey);
    if (b) return b;
  }
  const fromSession = getBundleByKey(selectedBundleKey);
  if (fromSession) return fromSession;
  const pitched = resolveSinglePitchedBundle(lastModelMessage(chatHistory));
  if (pitched) return pitched;
  if (hasRecentBrighteningContext(chatHistory)) return getBundleByKey('brightening');
  return null;
}

async function resolveActiveProductSlugForLink(sid, chatHistory, selectedProductSlug) {
  if (selectedProductSlug) return selectedProductSlug;
  const { data: products } = await sb.from('products')
    .select('id, name, slug')
    .eq('is_active', true);
  if (!products?.length) return null;
  for (let i = (chatHistory || []).length - 1; i >= 0; i--) {
    const hit = resolveProductMentions(chatHistory[i]?.text || '', products);
    if (hit.length === 1 && hit[0].slug) return hit[0].slug;
  }
  return null;
}

async function productLookLinkReply(sid, chatHistory, selectedBundleKey, selectedProductSlug = null) {
  const sku = await resolveActiveProductSlugForLink(sid, chatHistory, selectedProductSlug);
  if (sku) {
    const { data: p } = await sb.from('products')
      .select('name, slug')
      .eq('slug', sku)
      .maybeSingle();
    const name = p?.name || 'المنتج';
    const url = `${SITE_URL}/product.html?slug=${encodeURIComponent(sku)}`;
    return {
      reply:
        `تحت أمرك يا فندم 💜 مقدرش أرفع الصورة جوه الشات، بس شوفي **${name}** وصورته من هنا:\n` +
        `${url}`,
      sessionId: sid,
      selectedProduct: sku,
      keepCta: true,
    };
  }
  const bundle = resolveActiveBundleForLink(sid, chatHistory, selectedBundleKey);
  if (bundle?.slug) {
    const url = `${SITE_URL}/bundle/${bundle.slug}`;
    return {
      reply:
        `تحت أمرك يا فندم 💜\n` +
        `شوفي شكل منتجات **${bundle.name}** من اللينك ده:\n` +
        `${url}`,
      sessionId: sid,
      selectedBundleKey: bundle.key,
    };
  }
  return {
    reply:
      `تحت أمرك يا فندم 💜\n` +
      `شوفي كل المنتجات والصور من هنا:\n` +
      `${SITE_URL}`,
    sessionId: sid,
  };
}

/** Combined: side effects + sensitive areas + photo for the cream in context. */
async function trySafetySuitabilityPhotoReply(message, sid, chatHistory, selectedProductSlug) {
  const t = prepareCustomerText(expandFrancoAndTypos(message));
  if (!t || t.length > 280) return null;
  const safety = isGuaranteeOrSafetyQuestion(message);
  const area = isAreaSuitabilityQuestion(message)
    || /(بيفتح|ينفع|مناسب).{0,30}(حساس|اماكن\s*حساس|مناطق\s*حساس)/.test(t)
    || /(حساس|اماكن\s*حساس|مناطق\s*حساس).{0,30}(بيفتح|ينفع|مناسب|برده|كمان)/.test(t);
  const photo = isShowProductsLookAsk(message);
  if (!safety && !area && !photo) return null;
  // Need at least safety or a sticky cream context for the long multi-ask
  if (!safety && !area && photo) return null; // pure photo handled elsewhere

  // Pure "إيه المنتج اللي بيفتح المناطق الحساسة؟" → full product pitch (not a fragment)
  if (area && !safety && !photo && isSensitiveAreaWhiteningAsk(message)) {
    return sensitiveAreaWhiteningReply(sid);
  }

  const sku = selectedProductSlug
    || (await resolveActiveProductSlugForLink(sid, chatHistory, null))
    || 'whitening-cream';

  const parts = [];
  if (safety) {
    parts.push(
      'المنتجات واخدة موافقة وزارة الصحة برقم **COSMTOL25117170** 💜\n' +
      'لو بشرتكِ حساسة، ابدئي بكمية صغيرة على منطقة بسيطة واختبريها 24 ساعة أولًا. لو حصل هرش شديد وقّفي الاستخدام.'
    );
  }
  if (area || /حساس/.test(t)) {
    parts.push(
      '**كريم التفتيح** مناسب لتفتيح المناطق الحساسة وتحت الإبط والجسم مع الاستخدام المنتظم.'
    );
  }
  if (photo || /صور/.test(t)) {
    const url = `${SITE_URL}/product.html?slug=${encodeURIComponent(sku)}`;
    parts.push(`شوفي صورته وتفاصيله من هنا:\n${url}`);
  }
  if (!parts.length) return null;
  return {
    reply: parts.join('\n\n'),
    sessionId: sid,
    selectedProduct: sku,
    keepCta: true,
  };
}

/** "إيه المنتج / الطريقة اللي بتفتح المناطق الحساسة" */
function isSensitiveAreaWhiteningAsk(message) {
  const t = prepareCustomerText(expandFrancoAndTypos(message));
  if (!t || t.length > 160) return false;
  const area = /(مناطق|اماكن|الاماكن|الأماكن|المنطق[ةه])\s*الحساس|تحت\s*ال[اإ]بط|ب\s*ي?\s*كين|bikini/i.test(t);
  const want = /(بيفتح|تفتيح|منتج|طريق[ةه]|كريم|روتين|اي\s*ه[يى]|ايه\s*ه[يى]|أنهي|انهي)/.test(t);
  return area && want;
}

async function sensitiveAreaWhiteningReply(sid) {
  const bright = getBundleByKey('brightening');
  const creamPrice = await productUnitPriceBySlug('whitening-cream');
  const creamBit = creamPrice ? ` بـ **${creamPrice}** جنيه` : '';
  const routineBit = bright
    ? `\n\nولو حابة نتيجة أقوى: **${bright.name}** (غسول + كريم + لوشن) بـ **${bright.bundlePrice}** والشحن مجاني.`
    : '';
  return {
    reply:
      `لتفتيح المناطق الحساسة أنسب حاجة عندنا **كريم التفتيح**${creamBit} يا فندم 💜` +
      routineBit +
      `\n\nتحبي الكريم لوحده ولا الروتين؟`,
    sessionId: sid,
    selectedProduct: 'whitening-cream',
    selectedBundleKey: bright?.key,
    keepCta: true,
  };
}

function offerCheckoutChoice(sid, opts = {}) {
  const summary = formatCartSummary(sid);
  checkoutWizards[sid] = {
    step: 'await_method',
    knownPhone: opts.knownPhone || null,
  };
  return {
    reply: `تمام يا فندم 💜\n\n${summary}\n\n${CHECKOUT_CHOICE_Q}`,
    sessionId: sid,
    keepCta: true,
  };
}

function sendCheckoutLink(sid) {
  const url = `${SITE_URL}/complete-order.html?sid=${encodeURIComponent(sid)}`;
  const free = cartGetsFreeShipping(sessionCarts[sid] || []);
  const shipNote = free
    ? 'كاش عند الاستلام · شحن مجاني'
    : 'كاش عند الاستلام · الشحن حسب المحافظة (مجاني من 3 منتجات)';
  return {
    reply:
      `تحت أمرك يا فندم 💜\n` +
      `كمّلي من اللينك ده — منتجاتك جاهزة فيه:\n` +
      `${url}\n` +
      shipNote,
    sessionId: sid,
  };
}

function normalizePhoneDigits(raw) {
  return normalizePhone(raw) || String(raw || '').replace(/[^\d]/g, '');
}

function isValidEgPhone(raw) {
  return !!normalizePhone(raw);
}

function isConfirmSavedYes(message) {
  const t = String(message || '').trim();
  // "نعم ازاي وانتوا باعتين بيانات غلط" must NOT confirm
  if (/(غلط|مش\s*(ده|دا|صح)|تصحيح|غير[يى]|تغيير|الاسم|الموبايل|فون|العنوان|بعت)/i.test(t)
    && !/^(نعم|ايوه|أيوه|اه|تمام|موافق)\s*(نفس\s*(ال)?بيانات|كده|صح)?[\s!.،؟?]*$/i.test(t)) {
    return false;
  }
  return /^(نعم|ايوه|أيوه|اه|آه|أ?[iي]و[ae]|yes|تمام|موافق|ماشي|نفس|نفسهم|نفس\s*البيانات)[\s!.،؟?]*$/i.test(t)
    || /^(نعم|ايوه|تمام|موافق)\s*(نفس|كده|صح|بيانات)?[\s!.،؟?]*$/i.test(t);
}

function isConfirmSavedNo(message) {
  const t = String(message || '').trim();
  return /^(لا|لأ|no|تغيير|غيّر|غير|جديد|بيانات\s*جديدة)/i.test(t)
    || /(بيانات\s*(غلط|مش\s*صح|غلط[ةه])|مش\s*(دول|دي|ده)\s*(ال)?بيانات|الاسم\s*غلط|الموبايل\s*غلط)/i.test(t);
}

/**
 * Read-back of details the customer typed in THIS conversation, just before we
 * place the order. Deliberately different from formatSavedProfileConfirm(),
 * which greets a returning customer — using that wording on details she just
 * sent makes the bot sound like it lost the thread.
 */
function formatJustCollectedConfirm(data) {
  return (
    `تمام يا فندم 💜 دي بياناتك — راجعيها بسرعة:\n\n` +
    `• الاسم: ${data.name}\n` +
    `• الموبايل: ${data.phone}\n` +
    `• العنوان: ${data.address}\n` +
    `• المحافظة: ${data.governorate}\n\n` +
    `كله تمام؟ قولي **نعم** وأسجّل الأوردر — أو **تغيير** لو في حاجة غلط`
  );
}

function formatSavedProfileConfirm(profile) {
  return (
    `تشرفنا تاني يا فندم 💜 لقيت بياناتك من طلب سابق:\n\n` +
    `• الاسم: ${profile.name}\n` +
    `• الموبايل: ${profile.phone}\n` +
    `• العنوان: ${profile.address}\n` +
    `• المحافظة: ${profile.governorate}\n\n` +
    `نكمّل بنفس البيانات؟ قولي **نعم** — أو **تغيير** لو حابة تعدّلي حاجة`
  );
}

async function matchGovernorateName(input) {
  const { governorates, error } = await list_governorates();
  if (error || !governorates?.length) return null;
  const t = softNormalizeAr(String(input || '').trim().replace(/\s+/g, ' '));
  if (!t) return null;
  // Compare soft-normalized forms so ه/ة and أ/ا variants match DB names.
  const exact = governorates.find((g) => softNormalizeAr(g.governorate) === t);
  if (exact) return exact;
  const fuzzy = governorates.find((g) => {
    const name = softNormalizeAr(g.governorate || '');
    return !!name && (name.includes(t) || t.includes(name));
  });
  if (fuzzy) return fuzzy;
  // Common chat variants without hamza / typos / missing الـ ("غربيه")
  const aliases = [
    [/(ال)?قاهر[ةه]/, 'القاهرة'],
    [/(ال)?جيز[ةه]/, 'الجيزة'],
    [/6\s*ا?كتوبر|٦\s*ا?كتوبر|اكتوبر|أكتوبر|أكتوبر/, 'الجيزة'],
    [/(ال)?اسكندري[ةه]|(ال)?إسكندري[ةه]|اسكندرية/, 'الإسكندرية'],
    [/(ال)?قليوب/, 'القليوبية'],
    [/شبرا\s*الخيم/, 'القليوبية'],
    [/(ال)?شرقي[ةه]/, 'الشرقية'],
    [/(ال)?دقهلي[ةه]/, 'الدقهلية'],
    [/(ال)?غربي[ةه]/, 'الغربية'],
    [/(ال)?منوفي[ةه]/, 'المنوفية'],
    [/(ال)?بحير[ةه]/, 'البحيرة'],
    [/بن[يى]\s*سويف/, 'بني سويف'],
    [/(ال)?فيوم/, 'الفيوم'],
    [/(ال)?منيا/, 'المنيا'],
    [/(ال)?اسيوط|(ال)?أسيوط/, 'أسيوط'],
  ];
  for (const [re, canonical] of aliases) {
    if (re.test(t)) {
      const hit = governorates.find((g) => g.governorate === canonical);
      if (hit) return hit;
    }
  }
  return null;
}

async function governorateHintList() {
  const { governorates } = await list_governorates();
  const names = (governorates || []).slice(0, 12).map((g) => g.governorate);
  if (!names.length) return 'اكتبي اسم المحافظة';
  return `مثال: ${names.slice(0, 6).join(' · ')}${names.length > 6 ? '…' : ''}`;
}

async function tryAdvanceCheckoutConfirm(sid, message) {
  const wiz = checkoutWizards[sid];
  if (!wiz || wiz.step !== 'await_confirm') return null;

  const cart = sessionCarts[sid] || [];
  if (!cart.length) {
    delete checkoutWizards[sid];
    return { reply: emptyCartOfferRoutinesReply(), sessionId: sid, clearConfirm: true, keepCta: true };
  }

  if (isCheckoutConfirmYes(message)) {
    delete checkoutWizards[sid];
    return { ...offerCheckoutChoice(sid, { knownPhone: wiz.knownPhone || null }), clearConfirm: true };
  }

  if (isCheckoutConfirmNo(message)) {
    delete checkoutWizards[sid];
    // "لا شكرا" = declining checkout, not asking to add more products
    if (/شكر|thanks|no\s*thanks/i.test(String(message || ''))) {
      return {
        reply: 'تحت أمرك يا فندم 💜 أوردرك محفوظ لو حبيتي نكمّل في أي وقت.',
        sessionId: sid,
        clearConfirm: true,
      };
    }
    return {
      reply: 'تمام يا فندم 💜 قولّي تحب تضيف إيه في أوردرك',
      sessionId: sid,
      clearConfirm: true,
    };
  }

  logUnmatchedIntent('checkout_confirm', sid, message);
  delete checkoutWizards[sid];
  return null;
}

function looksLikePersonName(message) {
  const name = String(message || '').trim().replace(/\s+/g, ' ');
  if (name.length < 3 || name.length > 60) return false;
  if (/^(1|2|١|٢)$/.test(name)) return false;
  if (looksLikeAddressOnly(name) || isGovernorateOnlyText(name)) return false;
  if (isCheckoutMethodIndifferent(name) || isCheckoutMethodChat(name) || isCheckoutMethodSite(name)) return false;
  if (/(إلغ[يى]?|الغي|الغى|مش\s*دلوقت|بعدين|cancel|stop)/i.test(name)) return false;
  // Never save complaint / order fragments as a customer name ("مش ده")
  if (/^(مش\s*(ده|دا|كده)|غلط|الاوردر|الأوردر|العرض|اوردر|أوردر)/i.test(name)) return false;
  if (/(مش\s*(ده|دا)|الاوردر|الأوردر|العرض\s*\d|رقم\s*الطلب)/i.test(name)) return false;
  if (/^(السلام\s*عليكم|سلام|مرحبا|مرحباً|اهلا|أهلاً?|اهلاً|صباح(\s*الخير)?|مساء(\s*الخير)?|hello|hi|hey)[\s!.،؟?]*$/i.test(name)) {
    return false;
  }
  if (/(صباح|مساء|الخير|السلام|منتج|بكام|عايز|عاوز|ممكن|فين|ازاي|إزاي|إيه|ايه|تحبي|قولي|حاج[هة]|عادي|براحتك)/i.test(name)) {
    return false;
  }
  // Labels / field titles are not names
  if (/(رقم|موبايل|عنوان|محافظ|ثلاثي\s*:|الاسم\s*ثلاثي|العنوان\s*بالكامل)/i.test(name)) return false;
  if (normalizePhone(name) || /\d{8,}/.test(name)) return false;
  if (!/[a-zA-Z\u0600-\u06FF]/.test(name)) return false;
  // Prefer 2+ name parts (ثلاثي) — single token like "مش" rejected above
  const parts = name.split(/\s+/).filter(Boolean);
  if (parts.length < 2 && name.length < 8) return false;
  return true;
}

/** Instagram / Meta noise that must never drive checkout wizard turns. */
function isMetaPlatformNoiseMessage(message) {
  const t = String(message || '').trim();
  if (!t) return false;
  return (
    /استخدام\s*أحدث\s*تطبيق|استخدم\s*أحدث\s*إصدار|أحدث\s*إصدار\s*من\s*تطبيق\s*instagram|update\s*(the\s*)?app|latest\s*version\s*of\s*(the\s*)?instagram/i.test(t)
    || /^رد\s+\S+\s+على\s+\S+$/i.test(t)
  );
}

/**
 * Strip common form labels customers paste from the checkout prompt.
 * "الاسم ثلاثي : نور…" / "رقم الموبايل : 010…" / "العنوان بالكامل : …"
 */
function stripDeliveryFieldLabels(text) {
  return String(text || '')
    // Labels at line start OR mid-message (one-line paste of the prompt)
    .replace(/(?:^|[\n\r]|(?<=\S)\s+)(?:الاسم\s*الثلاثي|الاسم\s*ثلاثي|اسم\s*ثلاثي|الاسم|اسمي|باسم)\s*[:.\-–]*\s*/gi, '\n')
    .replace(/(?:^|[\n\r]|(?<=\S)\s+)(?:رقم\s*الموبايل|رقم\s*التليفون|رقم\s*الهاتف|الموبايل|التليفون|الهاتف)\s*[:.\-–]*\s*/gi, '\n')
    .replace(/(?:^|[\n\r]|(?<=\S)\s+)(?:العنوان\s*بالكامل|العنوان\s*بالتفصيل|العنوان|عنواني)\s*[:.\-–]*\s*/gi, '\n')
    .replace(/(?:^|[\n\r])\s*(?:المحافظة)\s*[:.\-–]*\s*/gi, '\n')
    .replace(/^\s+|\s+$/g, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{2,}/g, '\n')
    .trim();
}

/**
 * Customer dumps name + phone + address in one message (common after "أضفت
 * لأوردرك") — must NOT be classified as ADD_CONFIRM again.
 */
function looksLikeVolunteeredDeliveryDetails(message) {
  const raw = String(message || '').trim();
  if (!raw || raw.length < 18) return false;
  if (isMetaPlatformNoiseMessage(raw)) return false;
  const phone = extractPhoneFromText(raw);
  if (!phone) return false;
  // Strip phone so we can judge remaining name/address text
  const withoutPhone = toWesternDigits(stripDeliveryFieldLabels(raw))
    .replace(/(?:\+?20|0020)?0?1\d{9}/g, ' ')
    .replace(/[٠-٩۰-۹]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (withoutPhone.length < 8) return false;
  const hasAddressSignal =
    /(شارع|ش\.|ميدان|حي|عمارة|عقار|دور|شقه|شقة|برج|متفرع|امام|أمام|جنب|نزلة|كوبري|محافظة|القاهرة|القاهره|الجيزة|الجيزه|اسكندر|إسكند|مدين[ةه]|منطق[ةه]|بلوك|سوبر\s*ماركت|الدلتا|قري[ةه]|محط[ةه]|كفر\s+\S)/i.test(withoutPhone)
    || /\d{1,4}\s*\S{3,}/.test(withoutPhone);
  const hasNameSignal =
    /(باسم|اسمي|انا|أنا|الاسم)\s+\S{2,}/i.test(withoutPhone)
    || looksLikePersonName(withoutPhone.split(/[\n,،]/)[0] || '')
    || (withoutPhone.split(/\s+/).filter(Boolean).length >= 2 && /[\u0600-\u06FF]{2,}/.test(withoutPhone));
  return hasAddressSignal || (hasNameSignal && withoutPhone.length >= 12);
}

function parseVolunteeredDeliveryDetails(message) {
  const raw = String(message || '').trim();
  if (isMetaPlatformNoiseMessage(raw)) return null;
  const phone = extractPhoneFromText(raw);
  if (!phone) return null;

  // Prefer explicit labeled fields (works for one-line and multi-line pastes)
  const rawWestern = toWesternDigits(raw);
  let name =
    (rawWestern.match(/(?:الاسم\s*الثلاثي|الاسم\s*ثلاثي|اسم\s*ثلاثي|الاسم|اسمي|باسم)\s*[:.\-–]*\s*([^\n\d]{5,60}?)(?=\s*(?:رقم|الموبايل|العنوان|عنوان|$|\d))/i) || [])[1]
    || null;
  if (name) {
    name = name.trim().replace(/\s+/g, ' ');
    if (!looksLikePersonName(name)) name = null;
  }
  let address =
    (rawWestern.match(/(?:العنوان\s*بالكامل|العنوان\s*بالتفصيل|العنوان|عنواني)\s*[:.\-–]*\s*([^\n]{12,400})/i) || [])[1]
    || null;
  if (address) {
    address = address.trim().replace(/\s+/g, ' ').slice(0, 500);
  }

  const western = toWesternDigits(stripDeliveryFieldLabels(raw));
  const lines = western
    .split(/[\n\r]+/)
    .map((l) => l.trim())
    .filter(Boolean);

  let addressParts = [];

  for (const line of lines) {
    const digitsOnly = line.replace(/[^\d+]/g, '');
    // Phone-only / phone+short label line
    if (extractPhoneFromText(line) && digitsOnly.length >= 10 && line.replace(/(?:\+?20|0020)?0?1\d{9}/g, '').trim().length < 12) {
      continue;
    }
    const cleaned = line
      .replace(/(?:\+?20|0020)?0?1\d{9}/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (!cleaned) continue;

    if (!name && looksLikePersonName(cleaned) && cleaned.length <= 60) {
      name = cleaned;
      continue;
    }
    // "ثلاثي نور هانى صالح" left after partial label strip
    const nameFromTri = cleaned.match(/^(?:ثلاثي|الثلاثي)\s*[:.\-–]?\s*([^\d]{5,50})$/i);
    if (!name && nameFromTri && looksLikePersonName(nameFromTri[1].trim())) {
      name = nameFromTri[1].trim().replace(/\s+/g, ' ');
      continue;
    }
    addressParts.push(cleaned);
  }

  // Single-line blob fallback
  if (!name || (!address && !addressParts.length)) {
    const blob = western
      .replace(/(?:\+?20|0020)?0?1\d{9}/g, ' | ')
      .replace(/\s+/g, ' ')
      .trim();
    const chunks = blob.split(/\s*\|\s*/).map((c) => c.trim()).filter(Boolean);
    if (!name && chunks[0]) {
      const head = chunks[0].replace(/^(?:ثلاثي|الثلاثي)\s*[:.\-–]?\s*/i, '').trim();
      const maybeName = head.split(/\s+/).slice(0, 4).join(' ');
      if (looksLikePersonName(maybeName)) {
        name = maybeName;
        const rest = chunks.slice(1).join(' ').trim() || head.slice(name.length).trim();
        if (rest && rest !== name) addressParts.push(rest);
      }
    }
    if (!addressParts.length && chunks.length) {
      const joined = chunks.join(' ');
      const withoutName = name ? joined.replace(name, ' ').replace(/\s+/g, ' ').trim() : joined;
      if (withoutName) addressParts.push(withoutName);
    }
  }

  if (!address) {
    address = addressParts
      .join('، ')
      .replace(/(?:^|،)\s*(?:رقم(?:\s*الموبايل)?|العنوان(?:\s*بالكامل)?|الاسم(?:\s*الثلاثي)?)\s*[:.\-–]*\s*/gi, '، ')
      .replace(/\s+/g, ' ')
      .replace(/^[،\s]+|[،\s]+$/g, '')
      .trim();
  }
  // Drop leading "محافظة X" noise is OK to keep for courier
  if (!phone || !address || address.length < 6) return null;
  if (!name) {
    const m = western.match(/[\u0600-\u06FFa-zA-Z][\u0600-\u06FFa-zA-Z\s]{2,40}/);
    if (m) {
      const guess = m[0]
        .replace(/^(باسم|اسمي|ثلاثي|الثلاثي)\s+/i, '')
        .trim()
        .split(/\s+/)
        .slice(0, 4)
        .join(' ');
      if (looksLikePersonName(guess)) name = guess;
    }
  }
  if (!name) return { phone, name: null, address };

  return { phone, name, address };
}

/**
 * "غسول بس" / "عاوزه الغسول فقط" → replace bundle cart with that one product.
 */
async function maybeDowngradeCartToSingleProduct(message, sid) {
  const t = prepareCustomerText(expandFrancoAndTypos(message));
  if (!t || !/(بس|فقط|وحده|لوحده|غير\s*كده)/i.test(t)) return false;

  const { data: products, error } = await sb.from('products')
    .select('id, name, price, image_url, stock')
    .eq('is_active', true);
  if (error || !products?.length) return false;

  let target = null;
  if (/غسول/.test(t)) {
    if (/حب|شباب|حبوب/.test(t)) {
      target = products.find((p) => /حب الشباب/.test(p.name));
    } else {
      target = products.find((p) => p.name === 'غسول التفتيح');
    }
  } else if (/كريم/.test(t) && /ليزر/.test(t)) {
    target = products.find((p) => /ليزر/.test(p.name));
  } else if (/كريم/.test(t)) {
    target = products.find((p) => p.name === 'كريم التفتيح');
  } else if (/لوشن/.test(t)) {
    target = products.find((p) => /لوشن/.test(p.name));
  } else {
    const matched = resolveProductMentions(message, products);
    if (matched.length === 1) target = matched[0];
  }
  if (!target || (target.stock ?? 0) <= 0) return false;

  sessionCarts[sid] = [{
    id: target.id,
    name: target.name,
    image: target.image_url,
    price: target.price,
    qty: 1,
  }];
  return true;
}

/**
 * Cart has items + customer pasted shipping details → open checkout (never re-ADD).
 * Also honors "غسول بس" / "الكريم بس" in the same message (downgrade from bundle).
 */
async function tryVolunteeredDetailsCheckout(message, sid, knownPhone) {
  const cart = sessionCarts[sid] || [];
  if (!cart.length) return null;
  if (!looksLikeVolunteeredDeliveryDetails(message)) return null;

  // "عاوزه غسول بس" while cart has the brightening bundle → keep cleanser only
  await maybeDowngradeCartToSingleProduct(message, sid);

  const parsed = parseVolunteeredDeliveryDetails(message);
  const phone = parsed?.phone || extractPhoneFromText(message) || knownPhone || null;

  // Prefer jumping into chat collection with what we already have
  if (parsed?.name && parsed?.address && phone) {
    const govHint = await matchGovernorateName(parsed.address);
    if (govHint) {
      checkoutWizards[sid] = {
        step: 'confirm_saved',
        data: {
          name: parsed.name,
          phone,
          address: parsed.address,
          governorate: govHint.governorate,
        },
      };
      return {
        reply: formatSavedProfileConfirm({
          name: parsed.name,
          phone,
          address: parsed.address,
          governorate: govHint.governorate,
        }),
        sessionId: sid,
        keepCta: true,
      };
    }
    checkoutWizards[sid] = {
      step: 'governorate',
      data: { name: parsed.name, phone, address: parsed.address },
    };
    const hint = await governorateHintList();
    return {
      reply:
        `تمام يا فندم 💜 سجّلت الاسم والموبايل والعنوان.\n` +
        `آخر خطوة: اكتبي **اسم المحافظة**\n${hint}`,
      sessionId: sid,
      keepCta: true,
    };
  }

  // Partial details — still force checkout choice, never ADD_CONFIRM
  return offerCheckoutChoice(sid, { knownPhone: phone || knownPhone || null });
}

function asksCurrentOrderContents(message) {
  const t = String(message || '').trim();
  return /(طلبت\s*إ?يه|إ?يه\s*(اللي\s*)?طلبت|طلبي\s*فيه|ايه\s*(في\s*)?(ال)?(طلب|اوردر|أوردر)|أوردر(ي|ك)?\s*(فيه\s*)?إ?يه|كدا\s*طلبت|كذا\s*طلبت|what\s*did\s*i\s*order|my\s*order)/i.test(t);
}

/**
 * The bot promised an order without putting anything in the cart — put the
 * product it named in there, so her details have something to attach to.
 *
 * After an order complaint the model writes its own line, e.g. "تمام يا فندم،
 * أنا هسجلك أوردر جديد لكريم التفتيح", and nothing touches the cart. The
 * customer then sends name, phone and address, the empty-cart guard drops the
 * whole turn, the model asks for them again, and the loop never breaks. One
 * real customer sent her details three times and never got an order.
 *
 * Reads the product out of what the bot itself said, so it can only ever agree
 * with the promise the customer was given.
 *
 * @returns {Promise<object|null>} the product added, or null if none was named
 */
async function seedCartFromPromisedProduct(sid, chatHistory, slugHint) {
  if ((sessionCarts[sid] || []).length) return null;

  const { data: products, error } = await sb
    .from('products')
    .select('id, name, price, image_url, slug, stock')
    .eq('is_active', true);
  if (error || !products?.length) return null;

  let matched = slugHint ? products.find((p) => p.slug === slugHint) : null;

  if (!matched) {
    // The last few things the bot said, newest first.
    const said = (Array.isArray(chatHistory) ? chatHistory : [])
      .filter((t) => t?.role === 'model')
      .slice(-3)
      .reverse()
      .map((t) => String(t.text || t.parts?.[0]?.text || ''));
    for (const text of said) {
      // Only a line that actually promises to register something — otherwise
      // any reply that merely mentions a product would fill the cart.
      if (!/(هسجل|أسجل|اسجل|هضيف|أضيف|اضيف|أوردر جديد|اوردر جديد)/.test(text)) continue;
      matched = products.find((p) => bigrams(p.name).some((bg) => text.includes(bg)));
      if (matched) break;
    }
  }

  if (!matched || (matched.stock ?? 0) <= 0) return null;

  sessionCarts[sid] = [{
    id: matched.id,
    name: matched.name,
    image: matched.image_url,
    price: matched.price,
    qty: 1,
  }];
  console.log('[chat] seeded cart from promised product', sid, matched.slug);
  return matched;
}

/**
 * Recover name / phone / address the customer already sent in earlier turns,
 * so starting checkout collection never re-asks for what we already have.
 * `hist` is the persisted history: [{ role: 'user'|'model', text }].
 */
function harvestSeedFromHistory(hist) {
  const turns = Array.isArray(hist) ? hist : [];
  const seed = {};
  for (let i = turns.length - 1; i >= 0 && i >= turns.length - 12; i--) {
    const turn = turns[i];
    if (turn?.role !== 'user') continue;
    const text = String(turn.text || turn.parts?.[0]?.text || '').trim();
    if (!text) continue;
    if (!seed.phone) {
      const p = extractPhoneFromText(text) || normalizePhone(text);
      if (p) seed.phone = p;
    }
    if (!seed.name && looksLikePersonName(text)) {
      seed.name = text.replace(/\s+/g, ' ');
    }
    if (!seed.address && looksLikeAddressOnly(text)) {
      seed.address = text.replace(/\s+/g, ' ');
    }
  }
  return seed;
}

async function advanceCheckoutWizard(sid, message, channel, classified = null, chatHistory = []) {
  const wiz = checkoutWizards[sid];
  if (!wiz) return null;

  // Instagram platform banners — ignore, keep waiting for real customer data
  if (isMetaPlatformNoiseMessage(message)) {
    if (['details', 'name', 'phone', 'address'].includes(wiz.step)) {
      return {
        reply: checkoutDetailsAskReply(wiz.data || {}),
        sessionId: sid,
      };
    }
    if (wiz.step === 'governorate') {
      return {
        reply: 'تمام يا فندم ✍️ آخري حاجة: ابعتي **المحافظة** لو سمحتِ',
        sessionId: sid,
      };
    }
    // Don't spam on await_method / confirm — soft ack only
    return {
      reply: 'تحت أمرك يا فندم 💜',
      sessionId: sid,
    };
  }

  const cart = sessionCarts[sid] || [];
  if (!cart.length && wiz.step !== 'await_confirm') {
    delete checkoutWizards[sid];
    return { reply: emptyCartOfferRoutinesReply(), sessionId: sid, keepCta: true };
  }

  const effective = resolveEffectiveIntent(classified, message, { wizardStep: wiz.step });
  const intent = effective.intent;
  const slots = effective.slots || {};

  // Intent-first: stay in wizard for checkout-related intents (don't bail to Gemini)
  const checkoutIntents = new Set([
    'POINTS_ASK', 'DELIVERY_ETA', 'HOW_TO_ORDER', 'CHOOSE_CHAT', 'CHOOSE_SITE',
    'PROVIDE_NAME', 'PROVIDE_PHONE', 'PROVIDE_ADDRESS', 'PROVIDE_GOVERNORATE',
    'PROVIDE_FULL_DETAILS', 'CHECKOUT_READY', 'ADD_CONFIRM',
  ]);

  // If customer asks about products / greets / cancels mid-checkout, leave the
  // wizard so Gemini can answer — don't treat "ممكن اعرف المنتجات" as a bad phone.
  const collecting = ['details', 'name', 'phone', 'address', 'governorate', 'confirm_saved', 'await_method'].includes(wiz.step);
  if (collecting && !checkoutIntents.has(intent) && isCheckoutCancelOrOffTopic(message)) {
    // While choosing chat vs site: "طلبت إيه؟" = show cart, stay on this step
    if (wiz.step === 'await_method' && asksCurrentOrderContents(message)) {
      const summary = formatCartSummary(sid);
      return {
        reply: summary
          ? `أوردرك دلوقتي:\n\n${summary}\n\nقولي **هنا** أو **الموقع** عشان نكمّل التسجيل 💜`
          : emptyCartOfferRoutinesReply(),
        sessionId: sid,
        keepCta: true,
      };
    }
    const stillPhone = wiz.step === 'phone' && normalizePhone(message);
    if (!stillPhone) {
      delete checkoutWizards[sid];
      return null;
    }
  }

  // Must read the PERSISTED history (the `chatHistory` argument): the
  // in-memory chatSessions[sid] holds the Gemini ChatSession, whose turns
  // live on a private `_history`, so the old `chatSessions[sid].history`
  // was always undefined — nothing was ever harvested and the bot re-asked
  // for details the customer had already sent.
  function harvestSeedFromRecentUserTurns() {
    return harvestSeedFromHistory(chatHistory);
  }

  // Step: choose chat vs website — intent first
  if (wiz.step === 'await_method') {
    if (isShippingCostQuestion(message)) {
      const ship = await shippingCostReplyForMessage(message, sid);
      return {
        reply: `${ship}\n\nنكمل الأوردر؟ قولي **هنا** أو **الموقع** 💜`,
        sessionId: sid,
        keepCta: true,
      };
    }
    if (intent === 'POINTS_ASK') {
      return { reply: explainPointsShort(), sessionId: sid, keepCta: true };
    }
    if (intent === 'DELIVERY_ETA') {
      return {
        reply:
          'التوصيل عادة **2–3 أيام عمل** حسب المحافظة يا فندم 💜\n' +
          'نكمل تسجيل الأوردر؟ قولي **هنا** عشان أسجّل معاكي في الشات، أو **الموقع** لو حابة اللينك.',
        sessionId: sid,
        keepCta: true,
      };
    }
    if (asksCurrentOrderContents(message)) {
      const summary = formatCartSummary(sid);
      return {
        reply: summary
          ? `أوردرك دلوقتي:\n\n${summary}\n\nقولي **هنا** أو **الموقع** عشان نكمّل التسجيل 💜`
          : emptyCartOfferRoutinesReply(),
        sessionId: sid,
        keepCta: true,
      };
    }

    const harvested = mergeCheckoutSeed(harvestSeedFromRecentUserTurns(), slots);

    if (intent === 'CHOOSE_SITE') {
      delete checkoutWizards[sid];
      return sendCheckoutLink(sid);
    }

    if (
      intent === 'HOW_TO_ORDER' ||
      intent === 'CHOOSE_CHAT' ||
      intent === 'CHECKOUT_READY' ||
      intent === 'PROVIDE_NAME' ||
      intent === 'PROVIDE_PHONE' ||
      intent === 'PROVIDE_ADDRESS' ||
      intent === 'PROVIDE_FULL_DETAILS'
    ) {
      const seed = { ...harvested };
      if (intent === 'PROVIDE_NAME' && slots.name) seed.name = slots.name;
      if (intent === 'PROVIDE_PHONE' && (slots.phone || normalizePhone(message))) {
        seed.phone = normalizePhone(slots.phone) || normalizePhone(message) || seed.phone;
      }
      if (intent === 'PROVIDE_ADDRESS' && slots.address) seed.address = slots.address;
      if (intent === 'PROVIDE_FULL_DETAILS') {
        Object.assign(seed, mergeCheckoutSeed(seed, slots));
      }
      return beginChatCheckoutCollection(sid, wiz, seed);
    }

    // Unclear — short nudge, do NOT spam the full cart again
    return {
      reply:
        'تحت أمرك يا فندم 💜 قولي **هنا** عشان أسجّل الأوردر معاكي في الشات (هطلب الاسم والموبايل والعنوان في رسالة واحدة)،\n' +
        'أو **الموقع** لو حابة كمّلي من اللينك وتستفيدي ببرنامج النقاط.',
      sessionId: sid,
      keepCta: true,
    };
  }

  if (wiz.step === 'confirm_saved') {
    if (isConfirmSavedYes(message)) {
      const data = { ...wiz.data };
      if (!isUsableDeliveryAddress(data.address)) {
        checkoutWizards[sid] = { step: 'address', data: { name: data.name, phone: data.phone } };
        return {
          reply: 'قبل ما نسجّل محتاجين **عنوان بالتفصيل** (المنطقة · الشارع · علامة مميزة) 📍',
          sessionId: sid,
        };
      }
      delete checkoutWizards[sid];
      const order = await create_order(data, sid, channel);
      if (order.error) {
        return { reply: `معلش يا فندم، حصلت مشكلة: ${order.error}\nتحبي تحاولي تاني؟ قولي **نكمل**`, sessionId: sid };
      }
      return {
        reply:
          `تم تسجيل أوردرك بنجاح يا فندم ✅\n` +
          `رقم الطلب: **${order.order_number}**\n` +
          `الإجمالي ${Math.round(order.total)} جنيه — ${formatOrderShippingPhrase(order.shipping)} — الدفع كاش عند الاستلام.\n` +
          `هيظهر عندنا في الأدمن وهنراجع ونكلّمك قريب 💜`,
        sessionId: sid,
        order: {
          order_number: order.order_number,
          total: order.total,
          shipping: order.shipping,
          deposit_amount: 0,
          phone: data.phone,
          customer_name: data.name,
        },
        orderJustPlaced: true,
      };
    }
    if (isConfirmSavedNo(message)) {
      const phone = wiz.data?.phone;
      checkoutWizards[sid] = { step: 'details', data: phone ? { phone } : {} };
      return {
        reply: checkoutDetailsAskReply(phone ? { phone } : {}),
        sessionId: sid,
      };
    }

    // Customer pasted corrected name / phone / address instead of bare نعم
    const phoneNow = normalizePhone(message) || extractPhoneFromText(message);
    const volunteered = looksLikeVolunteeredDeliveryDetails(message)
      ? parseVolunteeredDeliveryDetails(message)
      : null;
    const nameLine = (() => {
      const t = String(message || '').trim().replace(/\s+/g, ' ');
      const m = t.match(/(?:الاسم|اسمي)\s*[:.\-]*\s*([^\n\d]{5,60})/i);
      if (m && looksLikePersonName(m[1].trim())) return m[1].trim().replace(/\s+/g, ' ');
      if (looksLikePersonName(t) && !phoneNow) return t;
      return null;
    })();
    const addrNow = looksLikeAddressOnly(message) && isUsableDeliveryAddress(message)
      ? String(message || '').trim().replace(/\s+/g, ' ').slice(0, 500)
      : (volunteered?.address && isUsableDeliveryAddress(volunteered.address) ? volunteered.address : null);

    if (volunteered?.name || volunteered?.phone || nameLine || phoneNow || addrNow) {
      const data = { ...wiz.data };
      if (volunteered?.name && looksLikePersonName(volunteered.name)) data.name = volunteered.name;
      else if (nameLine) data.name = nameLine;
      if (volunteered?.phone || phoneNow) data.phone = normalizePhone(volunteered?.phone || phoneNow);
      if (addrNow) data.address = addrNow;
      // Reject junk saved names
      if (/^(مش\s*(ده|دا)|غلط)/i.test(String(data.name || ''))) {
        checkoutWizards[sid] = { step: 'name', data: { phone: data.phone } };
        return {
          reply: 'تمام هعدّل البيانات ✍️ ابعتي **اسمك الثلاثي** صح',
          sessionId: sid,
        };
      }
      checkoutWizards[sid] = { step: 'confirm_saved', data };
      return {
        reply: formatSavedProfileConfirm({
          name: data.name,
          phone: data.phone,
          address: data.address,
          governorate: data.governorate,
        }),
        sessionId: sid,
      };
    }

    return {
      reply: 'قولي **نعم** عشان نكمّل بنفس البيانات، أو **تغيير** لو حابة تبعِتي بيانات جديدة',
      sessionId: sid,
    };
  }

  // Side questions while collecting details — answer briefly, stay on step
  if (['details', 'name', 'phone', 'address', 'governorate'].includes(wiz.step)) {
    if (intent === 'POINTS_ASK') {
      return { reply: `${explainPointsShort()}\n\nنكمل؟ ابعتي اللي ناقص من بيانات الأوردر 💜`, sessionId: sid, keepCta: true };
    }
    if (intent === 'DELIVERY_ETA' || isDeliveryEtaAsk(message)) {
      const missing = !wiz.data?.address
        ? 'العنوان بالتفصيل'
        : (!wiz.data?.governorate ? 'اسم المحافظة (زي القاهرة أو الجيزة)' : null);
      return {
        reply: missing
          ? `التوصيل عادة **2–3 أيام عمل** حسب المحافظة 💜\nكمّلي: ابعتي **${missing}** لو سمحتِ.`
          : 'التوصيل عادة **2–3 أيام عمل** حسب المحافظة 💜',
        sessionId: sid,
        keepCta: true,
      };
    }
    if (intent === 'PROVIDE_FULL_DETAILS') {
      const seed = mergeCheckoutSeed({ ...wiz.data }, slots);
      return beginChatCheckoutCollection(sid, wiz, seed);
    }
    // Customer sent governorate while we still think we're on details
    if (
      (intent === 'PROVIDE_GOVERNORATE' || isGovernorateOnlyText(message))
      && wiz.data?.name
      && wiz.data?.phone
      && isUsableDeliveryAddress(wiz.data?.address)
    ) {
      const seed = { ...wiz.data, governorate: slots.governorate || String(message || '').trim() };
      return beginChatCheckoutCollection(sid, wiz, seed);
    }
  }

  // One-shot details: name + phone + address in a single customer message
  if (wiz.step === 'details') {
    // Instagram "use latest app" / reply-header noise — never re-ask from these
    if (isMetaPlatformNoiseMessage(message)) {
      return {
        reply: checkoutDetailsAskReply(wiz.data || {}),
        sessionId: sid,
      };
    }
    // "طب ما انا بعت" / "بعتتت هو دا" — reassure + re-ask only missing fields
    if (/^(طب\s*)?(ما\s*)?(انا\s*)?بعت+|هو\s*دا\s*(اهو|أهو)?|بعت\s*اهو|هو\s*دا\s*رقم/i.test(String(message || '').trim())
      && !extractPhoneFromText(message)
      && String(message || '').trim().length < 80
    ) {
      return {
        reply:
          'حاضر يا فندم 💜 غالبًا الرسالة وصلت متقطعة.\n' +
          checkoutDetailsAskReply(wiz.data || {}),
        sessionId: sid,
      };
    }

    const volunteered = (looksLikeVolunteeredDeliveryDetails(message) || extractPhoneFromText(message))
      ? parseVolunteeredDeliveryDetails(message)
      : null;
    const phoneNow = normalizePhone(slots.phone)
      || normalizePhone(message)
      || extractPhoneFromText(message)
      || volunteered?.phone
      || null;
    const nameNow = (() => {
      if (volunteered?.name && looksLikePersonName(volunteered.name)) return volunteered.name;
      // Only trust classifier name if the message itself looks like a name (not IG noise / "بعت")
      if (
        intent === 'PROVIDE_NAME'
        && slots.name
        && looksLikePersonName(slots.name)
        && looksLikePersonName(String(message || '').trim())
      ) {
        return slots.name;
      }
      const t = stripDeliveryFieldLabels(String(message || '').trim());
      const m = t.match(/(?:الاسم\s*الثلاثي|الاسم\s*ثلاثي|اسم\s*ثلاثي|الاسم|اسمي|باسم)\s*[:.\-–]*\s*([^\n\d]{5,60})/i)
        || String(message || '').match(/(?:الاسم\s*الثلاثي|الاسم\s*ثلاثي|اسم\s*ثلاثي|الاسم|اسمي|باسم)\s*[:.\-–]*\s*([^\n\d]{5,60})/i);
      if (m) {
        const n = m[1].trim().replace(/\s+/g, ' ').replace(/\s*(رقم|موبايل|عنوان).*$/i, '').trim();
        if (looksLikePersonName(n)) return n;
      }
      // Name alone only if no phone/address noise
      if (looksLikePersonName(t) && !phoneNow && t.length <= 60) return t;
      return null;
    })();
    const addrNow = (() => {
      if (volunteered?.address && isUsableDeliveryAddress(volunteered.address)) return volunteered.address;
      if (intent === 'PROVIDE_ADDRESS' && slots.address && isUsableDeliveryAddress(slots.address)) {
        return String(slots.address).trim().replace(/\s+/g, ' ').slice(0, 500);
      }
      // Labeled address line even without full volunteer parse
      const labeled = String(message || '').match(/(?:العنوان\s*بالكامل|العنوان\s*بالتفصيل|العنوان)\s*[:.\-–]*\s*([^\n]{12,400})/i);
      if (labeled) {
        const a = labeled[1].trim().replace(/\s+/g, ' ');
        if (isUsableDeliveryAddress(a)) return a.slice(0, 500);
      }
      const stripped = stripDeliveryFieldLabels(message);
      if (looksLikeAddressOnly(stripped) && isUsableDeliveryAddress(stripped) && !looksLikePersonName(stripped)) {
        return String(stripped).trim().replace(/\s+/g, ' ').slice(0, 500);
      }
      if (looksLikeAddressOnly(message) && isUsableDeliveryAddress(message)) {
        return String(message || '').trim().replace(/\s+/g, ' ').slice(0, 500);
      }
      return null;
    })();

    const data = { ...wiz.data };
    // Never overwrite a good saved name with a label fragment
    if (nameNow) {
      if (!data.name || !looksLikePersonName(data.name) || (looksLikePersonName(nameNow) && nameNow.split(/\s+/).length >= 2)) {
        data.name = nameNow;
      }
    }
    if (phoneNow) data.phone = normalizePhone(phoneNow) || data.phone;
    if (addrNow) data.address = addrNow;

    if (data.name && data.phone && data.address && isUsableDeliveryAddress(data.address)) {
      return beginChatCheckoutCollection(sid, wiz, data);
    }

    // Partial — stay on details, re-ask only what's still missing (still one message)
    checkoutWizards[sid] = { step: 'details', data };
    const gotBits = [
      nameNow && !wiz.data?.name && 'الاسم',
      phoneNow && !wiz.data?.phone && 'الموبايل',
      addrNow && !wiz.data?.address && 'العنوان',
    ].filter(Boolean);
    // If we already had name and this turn only confirmed it again, don't spam "سجّلت الاسم"
    const prefix = gotBits.length
      ? `تمام سجّلت ${gotBits.join(' و ')} ✅\n`
      : '';
    return {
      reply: prefix + checkoutDetailsAskReply(data),
      sessionId: sid,
    };
  }

  if (wiz.step === 'name') {
    // Phone sent while we asked for name → save phone, still need name
    const phoneNow = normalizePhone(slots.phone) || normalizePhone(message) || extractPhoneFromText(message);
    if ((intent === 'PROVIDE_PHONE' || phoneNow) && phoneNow && !looksLikePersonName(message)) {
      checkoutWizards[sid] = { step: 'name', data: { ...wiz.data, phone: phoneNow } };
      return {
        reply: 'تمام سجّلت الموبايل ✅ ابعتي **اسمك الثلاثي** عشان نكمّل',
        sessionId: sid,
      };
    }
    const name = (intent === 'PROVIDE_NAME' && slots.name && looksLikePersonName(slots.name))
      ? slots.name
      : (looksLikePersonName(message) ? String(message || '').trim().replace(/\s+/g, ' ') : null);
    if (!name) {
      return {
        reply: 'لو سمحتِ اكتبي **اسمك الثلاثي** بس (من غير تحية ولا سؤال عن المنتجات) 😊',
        sessionId: sid,
      };
    }
    const data = { ...wiz.data, name };
    if (slots.phone) data.phone = normalizePhone(slots.phone) || data.phone;
    // Phone already known (WhatsApp / earlier in chat / confirm_saved → تغيير)
    if (data.phone && isValidEgPhone(data.phone)) {
      checkoutWizards[sid] = { step: 'address', data };
      return {
        reply: `تشرفنا يا ${name.split(' ')[0]} 💜\nابعتي من فضلك **العنوان بالتفصيل** (المنطقة · الشارع · علامة مميزة قريبة)`,
        sessionId: sid,
      };
    }
    checkoutWizards[sid] = { step: 'phone', data };
    return {
      reply: `تشرفنا يا ${name.split(' ')[0]} 💜\nابعتي من فضلك **رقم موبايلك** (01xxxxxxxxx) عشان نتواصل معاكي للتوصيل`,
      sessionId: sid,
    };
  }

  if (wiz.step === 'phone') {
    // Customer pasted address while we still asked for phone — keep address, re-ask phone
    if (looksLikeAddressOnly(message) && !(normalizePhone(message) || extractPhoneFromText(message))) {
      checkoutWizards[sid] = {
        step: 'phone',
        data: { ...wiz.data, address: String(message || '').trim().replace(/\s+/g, ' ').slice(0, 500) },
      };
      return {
        reply: 'سجّلت العنوان ✅ ابعتي **رقم الموبايل** (01xxxxxxxxx) عشان نكمّل التوصيل',
        sessionId: sid,
      };
    }
    // Never trust model-hallucinated phone when the message itself is an address
    const phoneFromMsg = normalizePhone(message) || extractPhoneFromText(message);
    const phoneFromSlots = (!looksLikeAddressOnly(message) && slots.phone)
      ? normalizePhone(slots.phone)
      : null;
    const phone = phoneFromMsg || phoneFromSlots;
    if (!phone) {
      // Digits that look like a failed phone attempt → nudge; anything else → exit wizard
      const digits = String(message || '').replace(/[^\d٠-٩۰-۹]/g, '');
      if (digits.length >= 8 || intent === 'PROVIDE_PHONE') {
        return {
          reply: 'الرقم محتاج مراجعة بسيطة يا فندم — ابعتي موبايل مصري 11 رقم يبدأ بـ 01 لو سمحتِ',
          sessionId: sid,
        };
      }
      delete checkoutWizards[sid];
      return null;
    }
    const profile = await getCustomerProfile(phone);
    if (
      profile?.name
      && profile?.address
      && profile?.governorate
      && isUsableDeliveryAddress(profile.address)
      && !/^(مش\s*(ده|دا)|غلط)/i.test(String(profile.name || '').trim())
    ) {
      checkoutWizards[sid] = {
        step: 'confirm_saved',
        data: {
          name: profile.name,
          phone: profile.phone,
          address: profile.address,
          governorate: profile.governorate,
        },
      };
      return { reply: formatSavedProfileConfirm(profile), sessionId: sid };
    }
    checkoutWizards[sid] = { step: 'address', data: { ...wiz.data, phone } };
    return {
      reply: 'تمام ✅ ابعتي من فضلك **العنوان بالتفصيل** (المنطقة · الشارع · علامة مميزة قريبة)',
      sessionId: sid,
    };
  }

  if (wiz.step === 'address') {
    // Always prefer the raw message while collecting address (model slots truncate / mis-label)
    let address = String(message || '').trim().replace(/\s+/g, ' ').slice(0, 500);
    if (intent === 'PROVIDE_ADDRESS' && slots.address && String(slots.address).length > address.length) {
      address = String(slots.address).trim().replace(/\s+/g, ' ').slice(0, 500);
    }

    const affirming = isAffirmativeShort(message) || isAddressCompleteClaim(message);

    // "ماشي / تمام / لا هو ذا كامل" after a long address was already sent — reuse it
    if (affirming) {
      const recovered =
        (wiz.data?.pendingAddress && String(wiz.data.pendingAddress).length >= 25
          ? String(wiz.data.pendingAddress)
          : null)
        || lastLongUserAddress(chatHistory);
      if (recovered && recovered.length >= 25) {
        address = recovered;
      } else {
        return {
          reply: 'تمام 💜 ابعتي العنوان تاني في رسالة واحدة: المنطقة والشارع وعلامة مميزة',
          sessionId: sid,
        };
      }
    }

    if (looksLikeAddressOnly(message) && address.length >= 25) {
      wiz.data = { ...(wiz.data || {}), pendingAddress: address };
    }

    const usableAddress = isUsableDeliveryAddress(address);

    if (!usableAddress) {
      if (isGovernorateOnlyText(message) || isGovernorateOnlyText(address)) {
        return {
          reply: 'المحافظة هسجّلها بعدين 💜 دلوقتي ابعتي **العنوان بالتفصيل**: المنطقة · الشارع · علامة مميزة قريبة',
          sessionId: sid,
        };
      }
      return {
        reply: 'العنوان قصير شوية يا فندم — اكتبي المنطقة والشارع وعلامة مميزة لو سمحتِ 📍',
        sessionId: sid,
      };
    }
    // If they sent a phone by mistake on address step, keep waiting for address
    if ((normalizePhone(message) || extractPhoneFromText(message)) && !looksLikeAddressOnly(message) && address.length < 20) {
      return {
        reply: 'تمام الموبايل عندي — ابعتي **العنوان بالتفصيل** (المنطقة · الشارع · علامة مميزة) 📍',
        sessionId: sid,
      };
    }
    const data = { ...wiz.data, address };
    delete data.pendingAddress;
    if (slots.governorate) {
      const gov = await matchGovernorateName(slots.governorate);
      if (gov) {
        data.governorate = gov.governorate;
        if (!isUsableDeliveryAddress(data.address)) {
          checkoutWizards[sid] = { step: 'address', data };
          return {
            reply: 'قبل التسجيل ابعتي **العنوان بالتفصيل** (المنطقة · الشارع · علامة مميزة) 📍',
            sessionId: sid,
          };
        }
        delete checkoutWizards[sid];
        const order = await create_order(data, sid, channel);
        if (order.error) {
          return { reply: `معلش يا فندم، حصلت مشكلة: ${order.error}\nتحبي تحاولي تاني؟ قولي **نكمل**`, sessionId: sid };
        }
        return {
          reply:
            `تم تسجيل أوردرك بنجاح يا فندم ✅\n` +
            `رقم الطلب: **${order.order_number}**\n` +
            `المحافظة: ${gov.governorate}\n` +
            `الإجمالي ${Math.round(order.total)} جنيه — ${formatOrderShippingPhrase(order.shipping)} — الدفع كاش عند الاستلام.\n` +
            `هيظهر عندنا في الأدمن وهنراجع ونكلّمك قريب 💜`,
          sessionId: sid,
          order: {
            order_number: order.order_number,
            total: order.total,
            shipping: order.shipping,
            deposit_amount: 0,
            phone: data.phone,
            customer_name: data.name,
          },
          orderJustPlaced: true,
        };
      }
    }
    checkoutWizards[sid] = { step: 'governorate', data };
    const hint = await governorateHintList();
    return {
      reply: `ممتاز 💜 آخر خطوة: اكتبي **اسم المحافظة**\n${hint}`,
      sessionId: sid,
    };
  }

  if (wiz.step === 'governorate') {
    const rawGov = String(message || '').trim().replace(/\s+/g, ' ');
    // Customer re-pasted the full address instead of governorate name
    if (looksLikeAddressOnly(rawGov) && rawGov.length >= 25) {
      checkoutWizards[sid] = {
        step: 'governorate',
        data: { ...wiz.data, address: rawGov.slice(0, 500) },
      };
      const hint = await governorateHintList();
      return {
        reply:
          `العنوان تمام ✅\n` +
          `دلوقتي ابعتي **اسم المحافظة بس** (مش العنوان تاني)\n` +
          `مثال: القاهرة أو الجيزة\n${hint}`,
        sessionId: sid,
      };
    }
    if (isAffirmativeShort(message)) {
      const hint = await governorateHintList();
      return {
        reply: `قوليلي **اسم المحافظة** لو سمحتِ (زي القاهرة أو الجيزة)\n${hint}`,
        sessionId: sid,
      };
    }
    const govInput = (intent === 'PROVIDE_GOVERNORATE' && slots.governorate) ? slots.governorate : message;
    const gov = await matchGovernorateName(govInput);
    if (!gov) {
      const hint = await governorateHintList();
      return {
        reply: `المحافظة دي مش ظاهرة بنفس الاسم — ابعتي اسم المحافظة بس زي: القاهرة · الجيزة · الإسكندرية\n${hint}`,
        sessionId: sid,
      };
    }
    const data = { ...wiz.data, governorate: gov.governorate };
    if (!isUsableDeliveryAddress(data.address)) {
      checkoutWizards[sid] = { step: 'address', data: { name: data.name, phone: data.phone, governorate: data.governorate } };
      return {
        reply: 'المحافظة تمام ✅ ناقص **العنوان بالتفصيل** (المنطقة · الشارع · علامة مميزة) عشان نقدر نسجّل الأوردر',
        sessionId: sid,
      };
    }
    delete checkoutWizards[sid];
    const order = await create_order(data, sid, channel);
    if (order.error) {
      return { reply: `معلش يا فندم، حصلت مشكلة: ${order.error}\nتحبي تحاولي تاني؟ قولي **نكمل**`, sessionId: sid };
    }
    return {
      reply:
        `تم تسجيل أوردرك بنجاح يا فندم ✅\n` +
        `رقم الطلب: **${order.order_number}**\n` +
        `المحافظة: ${gov.governorate}\n` +
        `الإجمالي ${Math.round(order.total)} جنيه — ${formatOrderShippingPhrase(order.shipping)} — الدفع كاش عند الاستلام.\n` +
        `هيظهر عندنا في الأدمن وهنراجع ونكلّمك قريب 💜`,
      sessionId: sid,
      order: {
        order_number: order.order_number,
        total: order.total,
        shipping: order.shipping,
        deposit_amount: 0,
        phone: data.phone,
        customer_name: data.name,
      },
      orderJustPlaced: true,
    };
  }

  return null;
}

async function runFunctionCall(name, args, sid, opts = {}) {
  if (name === 'list_products') return list_products();
  if (name === 'list_governorates') return list_governorates();
  if (name === 'view_cart') return view_cart(sid);
  if (name === 'add_to_cart') return add_to_cart(args || {}, sid);
  if (name === 'add_routine_offer') {
    const key = String(args?.offer_key || args?.offerKey || '').trim();
    const bundle = getBundleByKey(key);
    if (!bundle) {
      return { error: 'عرض غير معروف — استخدمي post-laser أو brightening أو face-body' };
    }
    const added = await addBundleEntityToCart(sid, bundle);
    if (!added) return { error: 'مقدرناش نضيف العرض — جربي تاني' };
    return {
      ok: true,
      offer: bundle.key,
      name: bundle.name,
      price: bundle.bundlePrice,
      cart: view_cart(sid),
    };
  }
  if (name === 'start_checkout') {
    const knownPhone = opts.knownPhone || null;
    const cart = sessionCarts[sid] || [];
    if (!cart.length) {
      return { error: 'الأوردر فاضي — ضيفي منتج أو عرض الأول بـ add_to_cart / add_routine_offer' };
    }
    // Hand control to deterministic checkout wizard (name/phone/address)
    const started = offerCheckoutChoice(sid, { knownPhone });
    return {
      ok: true,
      mode: 'chat_checkout',
      instruct: 'قولي للعميلة تختار التسجيل هنا أو على الموقع، بنفس نص النظام.',
      bot_reply_hint: started?.reply || null,
    };
  }
  if (name === 'get_points_balance') {
    const points = await getPointsBalance(args?.phone);
    if (points === null) return { error: 'رقم الموبايل مش صحيح أو حصلت مشكلة — اسأليها تبعته تاني' };
    return { points };
  }
  if (name === 'get_order_status') {
    const phone = normalizePhone(args?.phone || '') || null;
    let orders = [];
    if (phone) {
      orders = await fetchPhoneOrders(phone);
    }
    if (!orders.length) {
      orders = await fetchSessionOrders(sid);
    }
    if (!orders.length) {
      const sessionOrder = await getOrderForSid(sid);
      if (sessionOrder) {
        return {
          found: true,
          orders: [sessionOrder],
          support_phone: CS_SUPPORT_PHONE,
        };
      }
      return {
        found: false,
        message: 'مفيش أوردر بالبيانات دي',
        support_phone: CS_SUPPORT_PHONE,
        instruct: `قولي للعميلة تتواصل مع خدمة العملاء على ${CS_SUPPORT_PHONE}`,
      };
    }
    return {
      found: true,
      orders: orders.map((o) => ({
        order_number: o.order_number,
        status: o.status,
        total: o.total,
        created_at: o.created_at,
      })),
      support_phone: CS_SUPPORT_PHONE,
    };
  }
  return { error: 'unknown function' };
}

function buildLlmTurnContextNote({
  selectedProductSlug,
  selectedBundleKey,
  cart,
  customerName,
  customerPhone,
  lastBot,
  exposeCart = false,
}) {
  const items = Array.isArray(cart) ? cart : [];
  const lines = ['(سياق السيستم — مش من العميل: افهمي المتابعة من هنا)'];
  if (selectedProductSlug) lines.push(`- المنتج النشط: ${selectedProductSlug}`);
  if (selectedBundleKey) lines.push(`- العرض النشط: ${selectedBundleKey}`);
  if (customerName) lines.push(`- اسم العميل: ${customerName}`);
  if (customerPhone) lines.push(`- موبايل محفوظ: ${customerPhone}`);
  // Don't surface stale cart on soft turns — Gemini otherwise dumps it unprompted
  if (exposeCart && items.length) {
    lines.push(`- الأوردر الحالي: ${items.map((i) => `${i.name}×${i.qty}`).join('، ')}`);
  } else if (exposeCart) {
    lines.push('- الأوردر الحالي: فاضي');
  }
  if (lastBot) {
    lines.push(`- آخر رد ليكي: ${String(lastBot).replace(/\s+/g, ' ').slice(0, 220)}`);
  }
  lines.push('- لو قالت بيفتح/والشحن/تفاصيل من غير اسم: جاوبِي على المنتج/العرض النشط أو آخر رد.');
  lines.push('- أسعار/شحن: list_products أو list_governorates — الشحن لكل محافظات مصر.');
  lines.push('- تسجيل أوردر بعد موافقة صريحة فقط: start_checkout. ممنوع ترمي ملخص أوردر بعد تحية أو شكرا.');
  lines.push('- «الشحن مجاني من 3 منتجات» تتقال مرة واحدة بس في المحادثة. لو اتقالت قبل كده ممنوع تتكرر بعد كل سعر أو كل محافظة.');
  return lines.join('\n');
}

function shouldExposeCartToLlm(message, sid, chatHistory) {
  const cart = sessionCarts[sid] || [];
  if (!cart.length) return false;
  const wiz = checkoutWizards[sid];
  if (wiz?.step) return true;
  const t = prepareCustomerText(expandFrancoAndTypos(message || ''));
  if (/(اوردر|أوردر|الطلب|السله|السلة|نكمل|نكمّل|اسجل|أسجل|checkout|اطلب|اللي\s*عندي|في\s*الاوردر)/i.test(t)) {
    return true;
  }
  if (isExplicitCheckoutIntent(message)) return true;
  const lastBot = lastModelMessage(chatHistory);
  if (/نكمّل|نكمل|تسجيل الأوردر|تحبي نكمل|في أوردرك/i.test(String(lastBot || ''))) return true;
  return false;
}

/** True greeting only (not ice-breaker stubs like «التفاصيل» / «العرض»). */
function isPureGreeting(message) {
  const t = String(message || '').trim();
  if (!t || t.length > 40) return false;
  return /^(السلام\s*عليكم|سلام|مرحبا|مرحباً|اهلا|أهلاً?|اهلاً|هلا|صباح(\s*الخير)?|مساء(\s*الخير)?|hello|hi|hey|ازيك|إزيك|عامل(ة|ه)?\s*ايه)[\s!.،؟?]*$/i.test(t);
}

/**
 * First name for soft greetings only when it looks like a real person name.
 * Junk / weird single tokens (e.g. «تبتيري») → empty → falls back to «يا فندم».
 */
function safeGreetingFirstName(customerName) {
  const full = String(customerName || '').trim().replace(/\s+/g, ' ');
  if (!full) return '';
  if (!looksLikePersonName(full)) return '';
  const first = full
    .split(/\s+/)[0]
    .replace(/[^\u0600-\u06FFa-zA-Z]/g, '');
  if (first.length < 2 || first.length > 14) return '';
  if (/(غسول|كريم|لوشن|عرض|اوردر|أوردر|montana|montania|test)/i.test(first)) return '';
  return first;
}

function softGreetingReply(message, customerName) {
  const t = String(message || '').trim();
  const name = safeGreetingFirstName(customerName);
  const nameBit = name ? ` يا ${name}` : ' يا فندم';
  if (/مساء/i.test(t)) return `مساء الفل${nameBit} 💜 تحبي أساعدك في إيه؟`;
  if (/صباح/i.test(t)) return `صباح الفل${nameBit} 💜 تحبي أساعدك في إيه؟`;
  if (/سلام|مرحبا|اهلا|أهلا|هلا|hello|hi|hey/i.test(t)) {
    return `أهلاً${nameBit} 💜 قوليلي تحبي تعرفي إيه؟`;
  }
  return `أهلاً${nameBit} 💜 تحت أمرك — قوليلي تحبي مساعدة في إيه؟`;
}

function softAckReply() {
  return 'تحت أمرك يا فندم 💜 لو احتجتي أي حاجة قوليلي.';
}

/** Default ON — set CHAT_LLM_FIRST=0 to restore the old scripted maze. */
function isLlmFirstEnabled() {
  return process.env.CHAT_LLM_FIRST !== '0';
}

// ─────────────────────────────────────────────────────────
// Main entry point — used by api/chat.js (web) and every webhook.
// ─────────────────────────────────────────────────────────
async function handleInboundMessage({
  sid,
  message,
  formSubmit,
  channel,
  selectedBundle,
  selectedProduct,
  adTitle,
  adHint,
  pauseBot,
  resumeBot,
  hasImage,
  imageUrl,
}) {
  const stored = await loadSession(sid);
  // Stale idle session (12h+): drop sticky cart/ad so old orders don't resurface
  const wizBusyOnLoad = !!(stored.checkoutWizard?.step
    && !['await_confirm'].includes(stored.checkoutWizard.step));
  if (stored.stale && !wizBusyOnLoad) {
    sessionCarts[sid] = [];
    if (stored.checkoutWizard) delete checkoutWizards[sid];
  } else {
    sessionCarts[sid] = (stored.cart && stored.cart.length) ? stored.cart : (sessionCarts[sid] || []);
    if (stored.checkoutWizard) checkoutWizards[sid] = stored.checkoutWizard;
  }
  let orderWizard = stored.orderWizard || null;
  let chatHistory = stored.history || [];
  let customerPhone = stored.customerPhone || phoneFromSessionId(sid) || null;
  let customerName = stored.customerName || null;
  let selectedBundleKey = (stored.stale && !wizBusyOnLoad) ? null : (stored.selectedBundle || null);
  let selectedProductSlug = decodeProductSku(selectedBundleKey);
  if (selectedProductSlug) selectedBundleKey = null;
  // Persist the wipe so sticky selected_bundle actually clears in DB
  if (stored.stale && !wizBusyOnLoad && (stored.cart?.length || stored.selectedBundle || stored.checkoutWizard)) {
    await saveSession(sid, {
      cart: [],
      history: chatHistory,
      customerPhone,
      customerName,
      checkoutWizard: null,
      orderWizard,
      chatChannel: channel || undefined,
      selectedBundle: null,
    });
  }

  // ── A photo the customer sent ────────────────────────────────────────────
  // Resolved BEFORE the ad-field logic below, so a photo of a product or of an
  // offer enters the flow through exactly the doors an ad custom field already
  // uses and gets the same answer — rather than needing a second, parallel set
  // of replies that would drift out of step with the first.
  //
  // Fails soft on purpose: no URL, a dead CDN link, a model timeout, an
  // unreadable photo — the turn carries on and lands on the routine-offers
  // reply, which is what every photo used to get.
  let imageRead = null;
  if (imageUrl) {
    try {
      imageRead = await readCustomerImage(imageUrl);
    } catch (e) {
      console.warn('[chat] image read failed:', e.message);
    }
  }
  let imageWantsCs = false;
  if (imageRead) {
    console.log(
      '[chat] image', sid, imageRead.kind,
      imageRead.productSlug || imageRead.offerKey || '', '|', imageRead.summary
    );
    const plan = planFromImageRead(imageRead, { message, selectedProduct, selectedBundle });
    selectedProduct = plan.selectedProduct;
    selectedBundle = plan.selectedBundle;
    message = plan.message;
    imageWantsCs = plan.handOverToCs;
  }

  // Single-SKU product ads first (title / custom field / icebreaker) —
  // otherwise cleanser ads get mis-read as the brightening routine.
  // Do NOT scan full history here (that re-triggers product context on every turn).
  const incomingProduct =
    resolveSelectedProduct(selectedProduct) ||
    resolveSelectedProduct(selectedBundle) ||
    resolveProductAdButton(message) ||
    resolveProductFromAdHints(adTitle, adHint, selectedBundle, selectedProduct);
  if (incomingProduct) {
    selectedProductSlug = incomingProduct;
    selectedBundleKey = null;
  }

  // Sticky product from session (sku:…) — protect from Meta ad-title noise
  // e.g. ad title "بوست ليزر" would otherwise resolve to routine post-laser and wipe SKU.
  const stickyProductSlug = selectedProductSlug;

  // ManyChat may send selectedBundle and/or ad title on every turn
  const incomingBundle = incomingProduct
    ? null
    : (
      resolveSelectedBundle(selectedBundle) ||
      resolveBundleFromAdHints(adTitle, adHint, selectedBundle)
    );
  if (incomingBundle?.key) {
    const msgWantsRoutine =
      /(العرض|الروتين|العروض|كورس|مجموعه|مجموعة)/i.test(String(message || ''))
      || wantsAllOffersList(message);
    if ((stickyProductSlug || selectedProductSlug) && !msgWantsRoutine) {
      // Keep single-SKU ad context; ignore routine guess from ad title
      selectedBundleKey = null;
      selectedProductSlug = stickyProductSlug || selectedProductSlug;
    } else {
      selectedBundleKey = incomingBundle.key;
      selectedProductSlug = null;
    }
  }

  const persist = async (patch = {}) => {
    if (patch.orderWizard !== undefined) orderWizard = patch.orderWizard;
    if (patch.cart !== undefined) sessionCarts[sid] = patch.cart;
    if (patch.checkoutWizard !== undefined) {
      if (patch.checkoutWizard) checkoutWizards[sid] = patch.checkoutWizard;
      else delete checkoutWizards[sid];
    }
    if (patch.history !== undefined) chatHistory = patch.history;
    if (patch.customerPhone !== undefined) customerPhone = patch.customerPhone;
    if (patch.customerName !== undefined) customerName = patch.customerName;
    if (patch.selectedBundle !== undefined) {
      selectedBundleKey = patch.selectedBundle;
      if (selectedBundleKey) selectedProductSlug = null;
    }
    if (patch.selectedProduct !== undefined) {
      selectedProductSlug = patch.selectedProduct;
      if (selectedProductSlug) selectedBundleKey = null;
    }
    // Always write current truth: null/empty clears sticky selected_bundle in DB
    const persistBundle = selectedProductSlug
      ? encodeProductSku(selectedProductSlug)
      : (selectedBundleKey || null);
    await saveSession(sid, {
      cart: sessionCarts[sid] || [],
      history: chatHistory,
      customerPhone,
      customerName,
      checkoutWizard: checkoutWizards[sid] || null,
      orderWizard,
      chatChannel: channel || undefined,
      selectedBundle: persistBundle,
    });
  };

  // Explicit pause / resume from ManyChat or admin tools
  if (pauseBot) {
    chatHistory = stampBotPaused(chatHistory);
    await persist({ history: chatHistory });
    console.warn('[DIAG bot-paused]', JSON.stringify({ sid, reason: 'api_pauseBot' }));
    return { sessionId: sid, botPaused: true, reply: null };
  }
  if (resumeBot || wantsBotResume(message)) {
    chatHistory = stripPauseMarkers(chatHistory);
    await persist({ history: chatHistory });
    console.warn('[DIAG bot-resumed]', JSON.stringify({ sid, reason: resumeBot ? 'api' : 'phrase' }));
    if (resumeBot && !message) {
      return {
        sessionId: sid,
        botPaused: false,
        reply: 'رجع البوت شغّال يا فندم 💜 قوليلي تحبي مساعدة في إيه؟',
      };
    }
    // Fall through so "#bot" / resume + a real question still get answered
  } else if (isPauseExpired(chatHistory)) {
    // Human takeover timed out (1h) — customer messaged again → bot resumes alone
    chatHistory = stripPauseMarkers(chatHistory);
    await persist({ history: chatHistory });
    console.warn('[DIAG bot-resumed]', JSON.stringify({ sid, reason: 'auto_1h' }));
  } else if (isBotPaused(chatHistory)) {
    console.warn('[DIAG bot-paused-skip]', JSON.stringify({
      sid,
      msg: String(message || '').slice(0, 80),
    }));
    return { sessionId: sid, botPaused: true, reply: null };
  }

  // Returning customer: hydrate name from past orders when we only have a phone
  if (customerPhone && !customerName) {
    const profile = await getCustomerProfile(customerPhone);
    if (profile?.name) {
      customerName = profile.name;
      await persist({ customerPhone, customerName });
    } else if (!stored.customerPhone) {
      await persist({ customerPhone, customerName });
    }
  } else if (customerPhone && !stored.customerPhone) {
    await persist({ customerPhone, customerName });
  }

  const finish = async (payload, userMsg = message) => {
    if (payload?.reply) {
      payload.reply = sanitizeReply(payload.reply);
      payload.reply = stripRepeatedCta(payload.reply, chatHistory, { keepCta: !!payload.keepCta });
      payload.reply = enforceBriefReply(payload.reply);
      // After the length cap, so the note never gets truncated away
      payload.reply = applyShipFrom3NoteOnce(payload.reply, chatHistory);
      delete payload.keepCta;
    }
    if (payload?.chatHistory) chatHistory = payload.chatHistory;
    if (payload?.cart) sessionCarts[sid] = payload.cart;
    if (userMsg && payload?.reply) {
      chatHistory = appendHistory(chatHistory, userMsg, payload.reply.replace(/\*\*/g, ''));
    } else if (!userMsg && payload?.reply) {
      // ManyChat selectedBundle-only open (no customer text yet)
      chatHistory = appendHistory(chatHistory, '(دخلت من إعلان)', payload.reply.replace(/\*\*/g, ''));
    }
    await persist({ history: chatHistory, cart: sessionCarts[sid] || [] });
    return payload;
  };

  if (formSubmit) {
    const order = await create_order(formSubmit, sid, channel);
    if (order.error) return finish({ reply: `في مشكلة: ${order.error}`, sessionId: sid });
    customerPhone = formSubmit.phone;
    customerName = formSubmit.name;
    // create_order() runs outside the model's normal tool-calling loop for
    // this branch (formSubmit comes straight from complete-order.html /
    // the website's inline form, not a chat message) — so the Gemini
    // conversation itself never learns the order happened. Left alone,
    // the model kept treating the (already-cleared) cart as still pending
    // in the next chat message on the same session. Record it in history
    // and drop the live chat session so the next message rebuilds it
    // fresh, aware the order is done.
    delete chatSessions[sid];
    chatHistory = appendHistory(
      chatHistory,
      '(النظام: العميل كمّل بيانات التوصيل وتسجّل الأوردر)',
      `تمام، الأوردر ${order.order_number} اتسجل بنجاح والأوردر (السلة) بقى فاضي دلوقتي. لو العميل كلمني تاني، ده يبقى أوردر جديد تمامًا.`
    );
    await persist({ customerPhone, customerName, cart: [] });
    return finish({
      reply: `تم تسجيل أوردرك بنجاح يا فندم ✅ رقم الطلب **${order.order_number}** — الإجمالي ${Math.round(order.total)} جنيه (${formatOrderShippingPhrase(order.shipping)}) — الدفع كاش عند الاستلام. هنراجع الطلب ونكلّمك قريب 💜`,
      sessionId: sid,
      order: {
        id: order.id,
        order_number: order.order_number,
        total: order.total,
        shipping: order.shipping,
        deposit_amount: 0,
        transfer_number: order.transfer_number,
        transfer_name: order.transfer_name,
        phone: formSubmit.phone,
        customer_name: formSubmit.name,
        city: formSubmit.governorate,
        payment_method: 'cod',
        items: order.items || [],
      },
    });
  }

  if (!message && !selectedBundle && !incomingBundle && !selectedProductSlug && !hasImage) {
    throw Object.assign(new Error('Message required'), { status: 400 });
  }

  // Product-ad open with custom field only (no customer text yet)
  if (!message && selectedProductSlug) {
    await persist({ selectedProduct: selectedProductSlug });
    return finish(await productAdPitchReply(sid, selectedProductSlug), '(دخلت من إعلان منتج)');
  }

  // A screenshot of an order, invoice, tracking or payment → straight to a
  // human, same as the owner's rule for order problems typed in words. She
  // sent a picture of her order because something is wrong with it; selling
  // her a routine on top of that is the wrong answer.
  if (imageWantsCs) {
    return finish({
      reply: orderIssueCsReply(),
      sessionId: sid,
      needsHuman: true,
    }, message || '(أرسلت صورة أوردر)');
  }

  // Photo / sticker only → the 3 routine offers (never ignore, never Gemini dump)
  if (isCustomerImageOnlyMessage(message, { hasImage: !!hasImage })) {
    return finish({
      reply: imageOffersReply(),
      sessionId: sid,
      keepCta: true,
    }, message || '(أرسل صورة)');
  }

  // Hiring / moderator asks — never re-pitch the product ad
  if (message && isHiringOrStaffAsk(message)) {
    return finish({ reply: hiringAskReply(), sessionId: sid }, message);
  }

  // Price of the routine/offer just discussed — wins over sticky lotion/cream from the ad
  // Never steal "البوست ليزر لوحده بكام" → that is the unit cream (369), not عرض 618
  if (
    message
    && !wantsSingleSkuOnly(message)
    && !isFewNamedProductsPriceAsk(message)
  ) {
    const lastBotEarly = lastModelMessage(chatHistory);
    const namedEarly = resolveBundleFromCustomerText(message);

    // Benefits / what's-in for a NAMED routine — never dump all 3 offers
    if (
      namedEarly
      && (isIngredientsOrDetailsQuestion(message) || isCompositionOrWhatsInAsk(message))
    ) {
      selectedBundleKey = namedEarly.key;
      await persist({ selectedBundle: namedEarly.key });
      const explained = await formatActiveRoutineExplainReply(sid, chatHistory, {
        message,
        checkoutNudge: false,
      });
      if (explained?.reply) return finish(explained, message);
    }

    // Explicit want/need of a named routine → add to cart (or re-confirm if already in)
    if (namedEarly) {
      const tBuy = softNormalizeAr(expandFrancoAndTypos(String(message || '')));
      const wantsBuyNamed =
        /(عا[ييو]ز[اهة]?|محتاج[اهة]?|ابي|أبي|خدو|خدوا|سجلي|سجّلي|اوردر|أوردر|اطلب)/i.test(tBuy)
        || isExplicitCheckoutIntent(message)
        || isProductAddConfirmation(message);
      if (wantsBuyNamed) {
        selectedBundleKey = namedEarly.key;
        const r = await replyForAlreadyPitchedRoutine(sid, namedEarly, message, chatHistory);
        await persist({ selectedBundle: namedEarly.key, cart: sessionCarts[sid] });
        return finish(r, message);
      }
      // Bare name of a routine after the list ("روتين التفتيح الكامل ؟") → that offer only
      if (
        /(روتين|عرض)/.test(tBuy)
        && !isIngredientsOrDetailsQuestion(message)
        && !isPriceQuestion(message)
        // "ازاي استخدم روتين التفتيح" merely names the routine; she asked for
        // the steps, and answering with its price ignores the question.
        && !isUsageHowToAsk(message)
      ) {
        selectedBundleKey = namedEarly.key;
        await persist({ selectedBundle: namedEarly.key });
        if (historyAlreadyPitchedBundle(chatHistory, namedEarly.key) || lastBotListedRoutineOffers(lastBotEarly)) {
          const r = await replyForAlreadyPitchedRoutine(sid, namedEarly, message, chatHistory);
          await persist({ selectedBundle: namedEarly.key, cart: sessionCarts[sid] });
          return finish(r, message);
        }
        return finish({
          reply: formatBundlePriceReply(namedEarly),
          sessionId: sid,
          selectedBundleKey: namedEarly.key,
          keepCta: true,
        }, message);
      }
    }

    // "ازاي استخدم روتين التفتيح" names the offer, so this read it as a price
    // follow-up and answered with 777 — she asked how to use it, not what it
    // costs. Usage and ingredients belong to the FAQ answers further down.
    const namesOfferButAsksSomethingElse = isUsageHowToAsk(message)
      || isIngredientsOrDetailsQuestion(message);
    if (
      !namesOfferButAsksSomethingElse
      && (isOfferPriceFollowUpAsk(message, lastBotEarly) || wantsAllOffersList(message))
    ) {
      if (wantsAllOffersList(message)) {
        selectedProductSlug = null;
        await persist({ selectedBundle: null, selectedProduct: null });
        return finish({
          reply: emptyCartOfferRoutinesReply(),
          sessionId: sid,
          keepCta: true,
        }, message);
      }
      const key =
        resolveBundleFromCustomerText(message)?.key
        || resolveRoutineKeyFromText(message)
        || resolveRoutineKeyFromText(lastBotEarly)
        || selectedBundleKey
        || 'brightening';
      const bundle = getBundleByKey(key);
      if (bundle) {
        selectedProductSlug = null;
        selectedBundleKey = bundle.key;
        await persist({ selectedBundle: bundle.key });
        return finish({
          reply: formatBundlePriceReply(bundle),
          sessionId: sid,
          selectedBundleKey: bundle.key,
          keepCta: true,
        }, message);
      }
    }
  }

  // After product-ad pitch: "سعره كام" → that SKU only
  // Skip when last bot pitched a routine — "والسعر كام" means the offer, not sticky lotion
  if (message && isProductAdFollowUpAsk(message)) {
    const lastBotForSku = lastModelMessage(chatHistory);
    const routinePriceContext =
      lastBotDescribedRoutine(lastBotForSku)
      && !/(حجم|مل|تفاصيل|مكونات)/i.test(String(message || ''));
    if (!routinePriceContext) {
      let sku = selectedProductSlug;
      if (!sku) {
        const historyBlob = (chatHistory || []).slice(-8).map((h) => h.text || '').join('\n');
        sku = resolveProductFromAdHints(adTitle, adHint, historyBlob);
      }
      if (sku) {
        selectedProductSlug = sku;
        await persist({ selectedProduct: sku });
        return finish(await productAdFollowUpReply(sid, sku, message), message);
      }
    }
  }

  // "حد كلمني وطلب فلوس" — verify the caller against our official line before
  // anything else can swallow it. Never asks for money, never denies the call.
  if (message) {
    const callerNow = extractPhoneFromText(message) || normalizePhone(message);
    if (botAskedForCallerNumber(chatHistory) && callerNow) {
      return finish({ reply: callerNumberVerdictReply(callerNow), sessionId: sid }, message);
    }
    if (isDepositCallInquiry(message)) {
      return finish({
        reply: callerNow ? callerNumberVerdictReply(callerNow) : askCallerNumberReply(),
        sessionId: sid,
      }, message);
    }
  }

  // Order problem / late delivery → hand straight to customer service.
  // This has to sit OUTSIDE the scripted maze: with LLM-first enabled the
  // whole `!skipScriptedMaze` section below never runs, so a copy down there
  // silently did nothing and Gemini answered these on its own.
  // Runs after the caller-number check above, which owns "someone rang me
  // asking for money" — those messages mention a deposit and would match here.
  if (message && (wantsExistingOrderHelp(message) || isOrderProblemComplaint(message))) {
    const cartNow = sessionCarts[sid] || [];
    const lastBotNow = String(lastModelMessage(chatHistory) || '');
    // Never hijack a customer who is mid-checkout handing over her details.
    const deliveringNow = cartNow.length > 0
      && (looksLikeVolunteeredDeliveryDetails(message)
        || /ابعتيلي\s*(الاسم|اسمك)|العنوان|المحافظة/i.test(lastBotNow));
    if (!deliveringNow && !checkoutWizards[sid]) {
      await persist({ orderWizard: null });
      return finish({
        reply: orderIssueCsReply(),
        sessionId: sid,
        needsHuman: true,
      }, message);
    }
  }

  // "عايزة أطلب" with nothing chosen yet → put the three routines in front of
  // her so she can pick. Asking "تحبي أساعدك تختاري؟" first burns a turn and
  // loses people. Outside the scripted maze so it holds with LLM-first on.
  if (
    message
    && !(sessionCarts[sid] || []).length
    && !checkoutWizards[sid]
    && !selectedBundleKey
    && !selectedProductSlug
    && isExplicitCheckoutIntent(message)
  ) {
    return finish({
      reply: askWhatSheNeedsReply('تحت أمرك يا فندم 💜'),
      sessionId: sid,
      keepCta: true,
    }, message);
  }

  // Walk-away / cancel BEFORE checkout wizard (else "مش هينفع اطلبه" gets eaten as name/details)
  if (isWalkAwayDecline(message) || isCancelCurrentOrderAsk(message)) {
    const cart = sessionCarts[sid] || [];
    const hadItems = cart.length > 0;
    const walkAway = isWalkAwayDecline(message);
    sessionCarts[sid] = [];
    delete checkoutWizards[sid];
    selectedBundleKey = null;
    await persist({
      cart: [],
      checkoutWizard: null,
      selectedBundle: null,
    });
    if (!hadItems && !walkAway && wantsOrderManagement(message)) {
      await persist({
        orderWizard: { step: 'phone', phone: null, orderNumber: null, orders: null },
      });
      return finish({
        reply:
          'تمام يا فندم 💜 مفيش أوردر جاري دلوقتي.\n' +
          'لو قصدك إلغاء **طلب قديم** متسجّل، ابعتيلي **رقم الموبايل** اللي اتسجّل بيه وأدور عليه.',
        sessionId: sid,
      }, message);
    }
    return finish({
      reply: walkAway
        ? 'تحت أمرك يا فندم 💜 لو حبيتي في أي وقت، منورانا.'
        : hadItems
          ? 'تمام يا فندم 💜 لغيت الأوردر الحالي ومسحت المنتجات.\nلو حابة تطلبي حاجة تانية قوليلي.'
          : 'تمام يا فندم 💜 مفيش أوردر جاري دلوقتي.\nلو قصدك إلغاء طلب قديم، ابعتيلي رقم الموبايل اللي اتسجّل بيه.',
      sessionId: sid,
    }, message);
  }

  // "بيفتّح قد إيه؟" — answer the degree question directly. Outside the
  // scripted maze, which LLM-first skips.
  if (message && isLighteningDegreeQuestion(message)) {
    return finish({ reply: lighteningDegreeReply(), sessionId: sid, keepCta: true }, message);
  }

  // A named skin condition outranks every other answer: it must not become a
  // suitability pitch, and the model must not get to improvise on it.
  if (message && namesSkinCondition(message)) {
    return finish({ reply: skinConditionReply(), sessionId: sid, needsHuman: false }, message);
  }

  // The FAQ answers — ingredients, benefits, usage, guarantee, returns,
  // results, suitability, stockists — all lived inside the scripted maze,
  // which LLM-first skips. Twelve prepared answers that had never once run,
  // leaving the model to improvise on every one of them. Answer them here,
  // before the maze, but never over an active checkout.
  if (message && !checkoutWizards[sid]) {
    // The classifier hasn't run yet this early in the turn; resolveFaqIntent
    // falls back to its own regexes, which are what decide these anyway.
    const liveFaqIntent = resolveFaqIntent(null, message, chatHistory);
    if (liveFaqIntent) {
      const liveFaqReply = await replyForFaqIntent(
        liveFaqIntent, message, sid, chatHistory, selectedProductSlug
      );
      if (liveFaqReply?.reply) {
        if (liveFaqReply.selectedProduct) {
          selectedProductSlug = liveFaqReply.selectedProduct;
          await persist({ selectedProduct: liveFaqReply.selectedProduct });
        }
        return finish(liveFaqReply, message);
      }
    }
  }

  // "مش بعمل ليزر" with nothing else asked → ask what she needs. Must come
  // before the dark-area check so a denial that also names an area still
  // routes to the area answer, not this one.
  if (message && !checkoutWizards[sid] && deniesDoingLaser(message) && !isDarkAreaBrighteningAsk(message)) {
    return finish({ reply: laserDeniedAskConcernReply(), sessionId: sid, keepCta: true }, message);
  }

  // Dark underarm / elbows / knees → whitening cream, routine as the upsell.
  // Never let the model answer this one: it pitched the post-laser cream to a
  // customer who said "مش بعمل ليزر" in the same sentence.
  // Skipped once she already has something in the cart: at that point the right
  // move is to carry on with her order, not to re-pitch her the same products.
  if (
    message
    && !checkoutWizards[sid]
    && !(sessionCarts[sid] || []).length
    && isDarkAreaBrighteningAsk(message)
  ) {
    return finish({ reply: darkAreaBrighteningReply(), sessionId: sid, keepCta: true }, message);
  }

  // Icebreaker button before intent classify (message = button label)
  {
    const buttonSkuEarly = resolveProductAdButton(message);
    if (buttonSkuEarly) {
      selectedProductSlug = buttonSkuEarly;
      await persist({ selectedProduct: buttonSkuEarly });
      // Same button / headline again after we already pitched → soft ack, don't spam
      if (alreadyPitchedProductAd(chatHistory)) {
        return finish({
          reply: 'تحت أمرك 🌿 قوليلي تحبي تعرفي إيه عن المنتج، أو أسعار المنتجات وعروض الروتين؟ 💜',
          sessionId: sid,
          keepCta: true,
        }, message);
      }
      return finish(await productAdPitchReply(sid, buttonSkuEarly), message);
    }
  }

  // ── LLM-first (default): Gemini يفهم + أدوات للحقيقة. الـ regex للحماية/التسجيل بس.
  // عطّليه بـ CHAT_LLM_FIRST=0 لو حابب ترجع للمتاهة القديمة.
  let skipScriptedMaze = false;
  if (isLlmFirstEnabled() && message) {
    console.warn('[DIAG llm-first]', JSON.stringify({
      sid,
      msg: String(message || '').slice(0, 120),
      product: selectedProductSlug || null,
      bundle: selectedBundleKey || null,
    }));

    // Checkout wizard owns structured collection (name/phone/address/gov)
    const wizStep = checkoutWizards[sid]?.step || null;
    if (wizStep === 'await_confirm') {
      const confirmResult = await tryAdvanceCheckoutConfirm(sid, message);
      if (confirmResult) {
        await persist({
          checkoutWizard: checkoutWizards[sid] || null,
          cart: sessionCarts[sid] || [],
        });
        return finish(confirmResult, message);
      }
    }
    if (
      wizStep
      && ['await_method', 'details', 'name', 'phone', 'address', 'governorate', 'confirm_saved'].includes(wizStep)
    ) {
      if (customerPhone && !checkoutWizards[sid].knownPhone) {
        checkoutWizards[sid].knownPhone = customerPhone;
      }
      const wizResult = await advanceCheckoutWizard(sid, message, channel, null, chatHistory);
      if (wizResult) {
        if (wizResult.orderJustPlaced) {
          customerPhone = wizResult.order?.phone || customerPhone;
          customerName = wizResult.order?.customer_name || customerName;
          delete chatSessions[sid];
          sessionCarts[sid] = [];
          chatHistory = appendHistory(
            chatHistory,
            '(النظام: العميل كمّل بيانات التوصيل في الشات وتسجّل الأوردر)',
            `تمام، الأوردر ${wizResult.order.order_number} اتسجل بنجاح والأوردر بقى فاضي.`
          );
          await persist({ customerPhone, customerName, cart: [], history: chatHistory, checkoutWizard: null });
          return finish({
            reply: wizResult.reply,
            sessionId: sid,
            order: wizResult.order,
            cart: [],
          }, message);
        }
        const wiz = checkoutWizards[sid];
        if (wiz?.data?.phone) customerPhone = normalizePhone(wiz.data.phone) || customerPhone;
        if (wiz?.data?.name) customerName = wiz.data.name;
        await persist({
          customerPhone,
          customerName,
          checkoutWizard: checkoutWizards[sid] || null,
          cart: sessionCarts[sid] || [],
        });
        return finish(wizResult, message);
      }
    }

    // Order modify / cancel wizard
    {
      const orderManageResult = await tryOrderManageWizard(message, sid, orderWizard, persist);
      if (orderManageResult) return finish(orderManageResult, message);
    }

    // Customer pasted name+phone+address.
    //
    // This used to require a non-empty cart. When the bot had promised an
    // order without filling one — the usual shape after an order complaint —
    // her details matched nothing here, fell through to the model, and the
    // model asked for them again. A real customer sent her name, phone and
    // address three times and never got an order.
    //
    // So: if the cart is empty, fill it from the product the bot itself named,
    // and only then run the checkout.
    if (looksLikeVolunteeredDeliveryDetails(message)) {
      await seedCartFromPromisedProduct(sid, chatHistory, selectedProductSlug);
    }
    if ((sessionCarts[sid] || []).length && looksLikeVolunteeredDeliveryDetails(message)) {
      const volunteered = await tryVolunteeredDetailsCheckout(message, sid, customerPhone);
      if (volunteered) {
        if (checkoutWizards[sid]?.data?.phone) {
          customerPhone = checkoutWizards[sid].data.phone;
        }
        if (checkoutWizards[sid]?.data?.name) {
          customerName = checkoutWizards[sid].data.name;
        }
        await persist({
          customerPhone,
          customerName,
          cart: sessionCarts[sid] || [],
          checkoutWizard: checkoutWizards[sid] || null,
        });
        return finish(volunteered, message);
      }
    }

    // Still nothing to attach them to — no cart, and the bot never named a
    // product. Keep what she sent anyway and ask only for the piece that is
    // actually missing. Asking again for details already on screen is what
    // made her repeat herself three times.
    if (looksLikeVolunteeredDeliveryDetails(message) && !(sessionCarts[sid] || []).length) {
      const parsed = parseVolunteeredDeliveryDetails(message) || {};
      const phone = parsed.phone || extractPhoneFromText(message) || customerPhone || null;
      if (phone) customerPhone = phone;
      if (parsed.name) customerName = parsed.name;
      checkoutWizards[sid] = {
        step: 'await_product',
        data: {
          name: parsed.name || customerName || null,
          phone: phone || null,
          address: parsed.address || null,
        },
      };
      await persist({
        customerPhone,
        customerName,
        checkoutWizard: checkoutWizards[sid],
      });
      const first = String(customerName || '').split(' ')[0];
      return finish({
        reply:
          `${first ? `تمام يا ${first} 💜` : 'تمام يا فندم 💜'}\n`
          + 'بياناتك اتسجلت عندي ✅ — مش هسألك عليها تاني.\n\n'
          + 'فاضل حاجة واحدة بس: **الأوردر ده لأنهي منتج؟**',
        sessionId: sid,
        keepCta: true,
      }, message);
    }

    // Hard facts: governorate shipping cost — never Gemini prose / never free-ship spam
    if (isShippingCostQuestion(message)) {
      return finish({
        reply: await shippingCostReplyForMessage(message, sid),
        sessionId: sid,
      }, message);
    }

    // "اسعار منتجات مونتانيا" / all unit prices — list from DB, never ask "أنهي منتج"
    if (isUnitProductsPriceListAsk(message)) {
      return finish(await unitProductsPriceListReply(sid), message);
    }

    // Hard facts: named SKU price ("البوست ليزر لوحده بكام") — DB price only, no Gemini guess
    if (
      wantsSingleSkuOnly(message)
      || isFewNamedProductsPriceAsk(message)
      || (isPriceQuestion(message) && /(غسول|كريم|لوشن|ليزر)/.test(prepareCustomerText(expandFrancoAndTypos(message))))
    ) {
      const priced = await tryPriceQuestion(message, sid, chatHistory, selectedBundleKey, selectedProductSlug);
      if (priced?.reply) return finish(priced, message);
    }

    // Never discuss silicone / scar gel in chat
    if (isSiliconeOrScarAsk(message)) {
      return finish({
        reply: siliconeScarDeflectReply(),
        sessionId: sid,
        keepCta: true,
      }, message);
    }

    // "إيه المنتج اللي بيفتح المناطق الحساسة"
    if (isSensitiveAreaWhiteningAsk(message)) {
      const areaPitch = await sensitiveAreaWhiteningReply(sid);
      if (areaPitch?.selectedProduct) {
        selectedProductSlug = areaPitch.selectedProduct;
        await persist({ selectedProduct: areaPitch.selectedProduct });
      }
      return finish(areaPitch, message);
    }

    // Side effects + sensitive skin + photo (never silicone gel from «آثار جانبية»)
    {
      const safetyCombo = await trySafetySuitabilityPhotoReply(
        message, sid, chatHistory, selectedProductSlug
      );
      if (safetyCombo?.reply) {
        if (safetyCombo.selectedProduct) {
          selectedProductSlug = safetyCombo.selectedProduct;
          await persist({ selectedProduct: safetyCombo.selectedProduct });
        }
        return finish(safetyCombo, message);
      }
    }

    // Named product interest without «بكام» — still DB price (acne cleanser ≠ invent 229/299)
    {
      const pitched = await tryNamedProductPitchReply(message, sid, chatHistory);
      if (pitched?.reply) {
        if (pitched.selectedProduct) {
          selectedProductSlug = pitched.selectedProduct;
          await persist({ selectedProduct: pitched.selectedProduct });
        }
        return finish(pitched, message);
      }
    }

    // "ما في أقل من السعر دا" — correct the discussed SKU from DB + real cheaper options
    {
      const haggle = await tryPriceHaggleReply(message, sid, chatHistory);
      if (haggle?.reply) {
        if (haggle.selectedProduct) {
          selectedProductSlug = haggle.selectedProduct;
          await persist({ selectedProduct: haggle.selectedProduct });
        }
        return finish(haggle, message);
      }
    }

    // "ابعتي صورته / وريني الشكل" → product page link for the cream in context
    if (isShowProductsLookAsk(message)) {
      const look = await productLookLinkReply(sid, chatHistory, selectedBundleKey, selectedProductSlug);
      if (look?.selectedProduct) {
        selectedProductSlug = look.selectedProduct;
        await persist({ selectedProduct: look.selectedProduct });
      }
      return finish(look, message);
    }

    // Bare "شكرا" — polite close only (never dump stale cart / checkout CTA)
    if (isThanksOrReadyToCheckout(message) && !isExplicitCheckoutIntent(message)) {
      return finish({
        reply: 'العفو يا فندم 💜 تحت أمرك لو احتجتي أي حاجة.',
        sessionId: sid,
        keepCta: true,
      }, message);
    }

    // Soft greeting — never Gemini + stale cart dump
    if (isPureGreeting(message) && !isPriceQuestion(message) && !isExplicitCheckoutIntent(message)) {
      // Idle greeting with leftover cart (and no active checkout) → wipe sticky order
      const wiz = checkoutWizards[sid];
      const lastBotGreet = lastModelMessage(chatHistory);
      if (
        (sessionCarts[sid] || []).length
        && !wiz?.step
        && !/نكمّل|نكمل|تسجيل الأوردر|تحبي نكمل|في أوردرك/i.test(String(lastBotGreet || ''))
      ) {
        sessionCarts[sid] = [];
        selectedBundleKey = null;
        selectedProductSlug = null;
        await persist({ cart: [], selectedBundle: null, selectedProduct: null });
      }
      // Drop junk single-token "names" so we don't keep greeting «يا تبتيري»
      if (customerName && !safeGreetingFirstName(customerName)) {
        customerName = null;
        await persist({ customerName: null });
      }
      return finish({
        reply: softGreetingReply(message, customerName),
        sessionId: sid,
        keepCta: true,
      }, message);
    }

    // Bare تمام/ماشي/اوك (not checkout confirm) — soft ack only
    if (
      isAffirmativeShort(message)
      && !checkoutWizards[sid]?.step
      && !wasAskingToAddToCart(lastModelMessage(chatHistory))
      && !botAskedBundleConfirm(lastModelMessage(chatHistory))
      && !/أسجل|اسجل|نكمل|نكمّل|تحبي نكمل/i.test(String(lastModelMessage(chatHistory) || ''))
    ) {
      return finish({
        reply: softAckReply(),
        sessionId: sid,
        keepCta: true,
      }, message);
    }

    // FAQ hard facts (don't leave whitening/guarantee/results to Gemini guess)
    if (isWhiteningEffectAsk(message)) {
      const whitening = await replyWhiteningEffectAsk(message, sid, chatHistory, selectedProductSlug);
      if (whitening?.selectedProduct) {
        selectedProductSlug = whitening.selectedProduct;
        await persist({ selectedProduct: whitening.selectedProduct });
      }
      return finish(whitening, message);
    }
    if (isGuaranteeOrSafetyQuestion(message)) {
      return finish({ reply: guaranteeMinistryReply(), sessionId: sid }, message);
    }
    if (isStockistPharmacyAsk(message)) {
      return finish(await replyStockistPharmacies(message, sid), message);
    }
    if (isResultsTimelineQuestion(message)) {
      return finish({ reply: resultsTimelineReply(), sessionId: sid }, message);
    }

    // Bare «بكام / السعر» with no product → 3 routine offers (not Gemini invent)
    if (
      isBarePriceWordAsk(message)
      && !wantsSingleSkuOnly(message)
      && !isFewNamedProductsPriceAsk(message)
    ) {
      if (selectedBundleKey && getBundleByKey(selectedBundleKey)) {
        return finish({
          reply: formatBundlePriceReply(getBundleByKey(selectedBundleKey)),
          sessionId: sid,
          selectedBundleKey,
          keepCta: true,
        }, message);
      }
      return finish({
        reply: whichOfferPriceAskReply(),
        sessionId: sid,
        keepCta: true,
      }, message);
    }

    if (isHumanHandoffRequest(message)) {
      chatHistory = stampBotPaused(chatHistory);
      await persist({ history: chatHistory });
      return finish({
        reply: humanHandoffReply(),
        sessionId: sid,
        needsHuman: true,
        botPaused: true,
      }, message);
    }

    skipScriptedMaze = true;
  }

  // Bare "تفاصيل / details" / price → product pitch if ad context, else catalog
  if (!skipScriptedMaze && message && (isBareDetailsOrInfoAsk(message) || isBarePriceWordAsk(message))) {
    let sku = selectedProductSlug;
    if (!sku) {
      const historyBlob = (chatHistory || []).slice(-6).map((h) => h.text || '').join('\n');
      sku = resolveProductFromAdHints(adTitle, adHint, historyBlob);
    }
    if (sku) {
      selectedProductSlug = sku;
      await persist({ selectedProduct: sku });
      // Already pitched once → short price/details, never duplicate the full ad pitch
      if (alreadyPitchedProductAd(chatHistory)) {
        return finish(await productAdFollowUpReply(sid, sku, message), message);
      }
      return finish(await productAdPitchReply(sid, sku), message);
    }
    return finish(await unitProductsPriceListReply(sid), message);
  }

  // ── Intent-first (Gemini) once per turn — BEFORE phrase/ad matching ──
  // So any customer wording for offers / pick offer / place order works.
  // Skipped when CHAT_LLM_FIRST is on (default): Gemini owns understanding.
  let classified = { intent: 'OTHER', products: [], slots: {} };
  let allProducts = null;
  let lastBot = lastModelMessage(chatHistory);

  if (!skipScriptedMaze && message) {
    const { data: prods } = await sb.from('products')
      .select('id, name, price, image_url, stock, old_price, slug')
      .eq('is_active', true);
    allProducts = prods;
    const productNames = (allProducts || []).map((p) => p.name);
    const cartHasItems = !!(sessionCarts[sid] || []).length;
    const wizardStep = checkoutWizards[sid]?.step || null;

    const classifiedRaw = await classifyIntent({
      message,
      lastBotMessage: lastBot,
      productNames,
      wizardStep,
      cartHasItems,
      selectedBundleKey,
    });
    classified = resolveEffectiveIntent(classifiedRaw, message, { wizardStep });
    console.log('[DIAG intent]', JSON.stringify({
      sid,
      message: String(message).slice(0, 120),
      raw: classifiedRaw?.intent,
      intent: classified.intent,
      slots: classified.slots || {},
      products: classified.products || [],
      wizardStep,
      selectedBundleKey,
    }));



    // Discount / counter-offer BEFORE wizard — never re-ask phone/address or dump offers
    if (isDiscountHaggleAsk(message)) {
      return finish({
        reply: discountHaggleReply(sid, chatHistory, selectedBundleKey, await getPromo()),
        sessionId: sid,
      }, message);
    }

    // While collecting name/phone/address/gov — wizard owns the turn (before FAQ/sales)
    // Include await_method so "اي حاجه عادي" / details dumps don't skip the wizard
    const collectingNow = ['await_method', 'details', 'name', 'phone', 'address', 'governorate', 'confirm_saved'].includes(wizardStep);
    if (collectingNow && checkoutWizards[sid]) {
      if (customerPhone && !checkoutWizards[sid].knownPhone) {
        checkoutWizards[sid].knownPhone = customerPhone;
      }
      const wizResultEarly = await advanceCheckoutWizard(sid, message, channel, classified, chatHistory);
      if (wizResultEarly) {
        if (wizResultEarly.orderJustPlaced) {
          customerPhone = wizResultEarly.order?.phone || customerPhone;
          customerName = wizResultEarly.order?.customer_name || customerName;
          delete chatSessions[sid];
          sessionCarts[sid] = [];
          chatHistory = appendHistory(
            chatHistory,
            '(النظام: العميل كمّل بيانات التوصيل في الشات وتسجّل الأوردر)',
            `تمام، الأوردر ${wizResultEarly.order.order_number} اتسجل بنجاح والأوردر بقى فاضي.`
          );
          await persist({ customerPhone, customerName, cart: [], history: chatHistory, checkoutWizard: null });
          return finish({
            reply: wizResultEarly.reply,
            sessionId: sid,
            order: wizResultEarly.order,
            cart: [],
          }, message);
        }
        const wizEarly = checkoutWizards[sid];
        if (wizEarly?.data?.phone) customerPhone = normalizePhone(wizEarly.data.phone) || customerPhone;
        if (wizEarly?.data?.name) customerName = wizEarly.data.name;
        await persist({
          customerPhone,
          customerName,
          checkoutWizard: checkoutWizards[sid] || null,
        });
        return finish(wizResultEarly, message);
      }
      if (!checkoutWizards[sid]) {
        await persist({ checkoutWizard: null });
      }
    }

    // After a successful order — soft close BEFORE sales/offers paths ("تمام" ≠ dump offers)
    if (historyHasRecentOrderConfirm(chatHistory)) {
      const t = String(message || '').trim();
      if (
        isAffirmativeShort(t)
        || /^(شكرا|شكراً|thanks|ok|اوك|ماشي|ماشيء|حاضر|طيب|لا\s*عادي)[\s!.،؟?]*$/i.test(t)
      ) {
        return finish({
          reply: 'تحت أمرك يا فندم 💜 لو محتاجة أي حاجة تانية قوليلي.',
          sessionId: sid,
        }, message);
      }
      if (isDeliveryEtaAsk(message) || /امتي|متي|يوصل|توصيل/.test(softNormalizeAr(t))) {
        return finish({
          reply: 'التوصيل عادة **2–3 أيام عمل** حسب المحافظة يا فندم 💜\nرقم طلبك ظاهر فوق — هنتابع معاكِ.',
          sessionId: sid,
        }, message);
      }
    }

    // Existing-order status BEFORE sales/offers ("الاوردر موصلش" ≠ list prices)
    {
      const inStatusLookup = orderWizard?.mode === 'status';
      const lastBotForLookup = lastModelMessage(chatHistory);
      const phoneInMsg = extractPhoneFromText(message);
      const cartNow = sessionCarts[sid] || [];
      const deliveringNow =
        cartNow.length > 0 &&
        (looksLikeVolunteeredDeliveryDetails(message) ||
          /ابعتيلي\s*(الاسم|اسمك)|العنوان|المحافظة/i.test(lastBotForLookup));
      const shouldLookup =
        !deliveringNow &&
        (inStatusLookup
          || wantsExistingOrderHelp(message)
          || isOrderProblemComplaint(message)
          || (phoneInMsg && botAskedForOrderLookupPhone(lastBotForLookup)));

      if (shouldLookup && !(orderWizard && !inStatusLookup)) {
        // Owner's rule: an order problem / late delivery goes straight to a
        // human. No asking for a phone, no lookup, no back-and-forth — those
        // conversations belong to customer service, not the bot.
        await persist({ orderWizard: null });
        return finish({
          reply: orderIssueCsReply(),
          sessionId: sid,
          needsHuman: true,
        }, message);
      }
    }

    const earlyIntent = classified.intent;

    // Meta icebreaker / quick-reply button for a single-SKU ad
    const buttonSku = resolveProductAdButton(message);
    if (buttonSku) {
      selectedProductSlug = buttonSku;
      await persist({ selectedProduct: buttonSku });
      if (alreadyPitchedProductAd(chatHistory)) {
        return finish({
          reply: 'تحت أمرك 🌿 قوليلي تحبي تعرفي إيه عن المنتج، أو أسعار المنتجات وعروض الروتين؟ 💜',
          sessionId: sid,
          keepCta: true,
        }, message);
      }
      return finish(await productAdPitchReply(sid, buttonSku), message);
    }

    // Bare "سعر/بكام" — product-ad context → that SKU; else in-stock catalog + routine tip
    if (isBarePriceWordAsk(message) || isBareDetailsOrInfoAsk(message)) {
      let sku = selectedProductSlug;
      if (!sku) {
        const historyBlob = (chatHistory || []).slice(-6).map((h) => h.text || '').join('\n');
        sku = resolveProductFromAdHints(adTitle, adHint, historyBlob);
      }
      if (sku) {
        selectedProductSlug = sku;
        await persist({ selectedProduct: sku });
        if (alreadyPitchedProductAd(chatHistory)) {
          return finish(await productAdFollowUpReply(sid, sku, message), message);
        }
        return finish(await productAdPitchReply(sid, sku), message);
      }
      return finish(await unitProductsPriceListReply(sid), message);
    }

    // "اسعار المنتجات لوحدها" / "منتج لوحده" → unit catalog (never re-ask which offer)
    if (isUnitProductsPriceListAsk(message)) {
      return finish(await unitProductsPriceListReply(sid), message);
    }

    // "للوجه ولا سينسيتيف اريا؟" — suitability before any price/SKU path
    if (isAreaSuitabilityQuestion(message)) {
      return finish(await areaSuitabilityReply(sid, chatHistory, message), message);
    }

    // "بيفتح؟" after كريم بعد الليزر / كريم التفتيح — answer from context, never re-ask which product
    if (isWhiteningEffectAsk(message)) {
      const whitening = await replyWhiteningEffectAsk(message, sid, chatHistory, selectedProductSlug);
      if (whitening.selectedProduct) {
        selectedProductSlug = whitening.selectedProduct;
        await persist({ selectedProduct: whitening.selectedProduct });
      }
      return finish(whitening, message);
    }

    // "ولالا" after a whitening / post-laser claim — clarify, don't re-pitch price
    if (isSoftDisagreement(message)) {
      const last = String(lastBot || '');
      if (/بعد\s*الليزر|بوست\s*ليزر|تصبغ|تفتيح|بيفتح|369/.test(softNormalizeAr(last))) {
        const whitening = await replyWhiteningEffectAsk('بيفتح كريم بعد الليزر', sid, chatHistory, selectedProductSlug || 'post-laser-cream');
        return finish(whitening, message);
      }
      return finish({
        reply: 'تحت أمرك يا فندم 💜 قوليلي تقصدي إيه بالظبط وأوضّحلك.',
        sessionId: sid,
      }, message);
    }

    // "طريقة الاستخدام" after pitching a routine → real steps (not product blurbs)
    if (isUsageHowToAsk(message)) {
      return finish(formatRoutineUsageReply(sid, chatHistory, message), message);
    }

    // "؟؟؟" / emoji-only after offers or catalog → soft clarify, never re-dump products
    if (isConfusedOrEmojiOnly(message)) {
      const lastWasOffersOrCatalog =
        lastBotListedRoutineOffers(lastBot)
        || lastBotOfferedProductCatalog(chatHistory)
        || /العروض المتاحة|شحن مجاني على كل عرض|منتجاتنا المتاحة|تحبي تعرفي إيه عن أي منتج/i.test(String(lastBot || ''));
      if (lastWasOffersOrCatalog) {
        return finish({
          reply: whichOfferPriceAskReply(),
          sessionId: sid,
          keepCta: true,
        }, message);
      }
      const raw = String(message || '').trim();
      if (/^[؟?\s.!،,]+$/.test(raw)) {
        return finish({
          reply:
            'معلش يا فندم، وضّحيلي أكتر 💜\n' +
            'تحبي أسعار العروض، ولا سعر منتج معيّن؟',
          sessionId: sid,
        }, message);
      }
      // emoji / sticker only
      return finish({
        reply: 'تحت أمرك يا فندم 💜 قوليلي تحبي إيه — العروض، ولا منتج معيّن؟',
        sessionId: sid,
      }, message);
    }

    // Shipping cost before sales dumps ("ومصاريف الشحن" / "شحن بني سويف" ≠ list all offers)
    if (isShippingCostQuestion(message)) {
      return finish({
        reply: await shippingCostReplyForMessage(message, sid),
        sessionId: sid,
      }, message);
    }

    // "الغي الأوردر" — clear in-progress cart (never re-add / checkout)
    if (isCancelCurrentOrderAsk(message)) {
      const cart = sessionCarts[sid] || [];
      const hadItems = cart.length > 0;
      sessionCarts[sid] = [];
      delete checkoutWizards[sid];
      selectedBundleKey = null;
      await persist({
        cart: [],
        checkoutWizard: null,
        selectedBundle: null,
      });
      // Empty cart + cancel wording → likely wants to cancel a placed order
      if (!hadItems && wantsOrderManagement(message)) {
        await persist({
          orderWizard: { step: 'phone', phone: null, orderNumber: null, orders: null },
        });
        return finish({
          reply:
            'تمام يا فندم 💜 مفيش أوردر جاري دلوقتي.\n' +
            'لو قصدك إلغاء **طلب قديم** متسجّل، ابعتيلي **رقم الموبايل** اللي اتسجّل بيه وأدور عليه.',
          sessionId: sid,
        }, message);
      }
      return finish({
        reply: hadItems
          ? 'تمام يا فندم 💜 لغيت الأوردر الحالي ومسحت المنتجات.\nلو حابة تطلبي حاجة تانية قوليلي.'
          : 'تمام يا فندم 💜 مفيش أوردر جاري دلوقتي.\nلو قصدك إلغاء طلب قديم، ابعتيلي رقم الموبايل اللي اتسجّل بيه.',
        sessionId: sid,
      }, message);
    }

    // "وريني / اشوفهم / متسجلش" → site/bundle link (never register / re-pitch)
    if (isShowProductsLookAsk(message) || isDontRegisterBrowseAsk(message)) {
      // If we wrongly added a bundle while they only wanted to look — clear it
      if (isDontRegisterBrowseAsk(message)) {
        const cart = sessionCarts[sid] || [];
        if (cart.some((i) => i?.isBundle || String(i?.id || '').startsWith('bundle:'))) {
          sessionCarts[sid] = cart.filter((i) => !(i?.isBundle || String(i?.id || '').startsWith('bundle:')));
          await persist({ cart: sessionCarts[sid] });
        }
      }
      return finish(
        await productLookLinkReply(sid, chatHistory, selectedBundleKey, selectedProductSlug),
        message
      );
    }

    // بعد ما كان بيتفرّج / شاف قائمة العروض — "عاوزا اوردر" من غير اسم عرض = اسألي أنهي، متسجليش لوحدك
    {
      // مهم: متثقيش في slots.offerKey لوحده — الجيميني بيحطه غلط من سياق اللينك
      const namedPickEarly =
        resolveBundleFromCustomerText(message)
        || resolveBundleFromOrdinal(message);
      const lastWasBrowseOrList =
        lastBotListedRoutineOffers(lastBot)
        || /العروض المتاحة|أنهي عرض|قولي اسم العرض|شوفي شكل|montana\.com\.eg/i.test(String(lastBot || ''));
      if (
        !namedPickEarly
        && lastWasBrowseOrList
        && (isExplicitCheckoutIntent(message) || wantsAdBundleOrder(message))
      ) {
        return finish({
          reply: whichOfferPriceAskReply(),
          sessionId: sid,
        }, message);
      }
    }

    // منتج واحد أو اتنين بكام → أسعار الوحدة + تنويه الشحن (قبل روتين التفتيح)
    if (
      wantsSingleSkuOnly(message)
      || isFewNamedProductsPriceAsk(message)
      || isBothOfThemPriceAsk(message)
      || (isPriceQuestion(message) && /(غسول|كريم|لوشن)/.test(prepareCustomerText(expandFrancoAndTypos(message))) && !isCleanserCreamPairAsk(message))
    ) {
      const priced = await tryPriceQuestion(message, sid, chatHistory, selectedBundleKey, selectedProductSlug);
      if (priced?.reply) return finish(priced, message);
    }

    // FAQ by meaning (classifier) + regex override if model mis-labeled as sales intent
    {
      const faqIntent = resolveFaqIntent(classified, message, chatHistory);
      if (faqIntent) {
        const faqReply = await replyForFaqIntent(faqIntent, message, sid, chatHistory, selectedProductSlug);
        if (faqReply?.reply) {
          if (faqReply.selectedProduct) {
            selectedProductSlug = faqReply.selectedProduct;
            await persist({ selectedProduct: faqReply.selectedProduct });
          }
          return finish(faqReply, message);
        }
      }
    }

    // Brightening / bikini / laser / routine concerns → full ROUTINE (not single cream)
    // Must run before SELECT_OFFER/PRODUCT paths that might pitch كريم التفتيح alone.
    {
      const needKey =
        resolveRoutineNeedFromConcern(message)
        || (isBrighteningRoutineNeed(message) ? 'brightening' : null)
        || (isBrighteningSeverityFollowUp(message, chatHistory) ? 'brightening' : null)
        || (
          classified.slots?.offerKey
          && ['brightening', 'post-laser', 'face-body'].includes(classified.slots.offerKey)
          && earlyIntent === 'PRODUCT_INTEREST'
          && !resolveFaqIntent(classified, message, chatHistory)
            ? classified.slots.offerKey
            : null
        );
      if (
        needKey
        && !resolveFaqIntent(classified, message, chatHistory)
        && !isFewNamedProductsPriceAsk(message)
        && !wantsSingleSkuOnly(message)
        && !isBothOfThemPriceAsk(message)
        && !(isPriceQuestion(message) && /(غسول|كريم|لوشن)/.test(prepareCustomerText(expandFrancoAndTypos(message))) && !isCleanserCreamPairAsk(message))
      ) {
        const bundle = getBundleByKey(needKey);
        if (bundle) {
          selectedBundleKey = bundle.key;
          await persist({ selectedBundle: bundle.key });
          if (historyAlreadyPitchedBundle(chatHistory, needKey)) {
            const r = await replyForAlreadyPitchedRoutine(sid, bundle, message, chatHistory);
            await persist({ selectedBundle: bundle.key, cart: sessionCarts[sid] });
            return finish(r, message);
          }
          return finish({
            reply: pitchRoutineByKey(needKey),
            sessionId: sid,
            selectedBundleKey: bundle.key,
            keepCta: true,
          }, message);
        }
      }
    }

    // PRODUCT_INTEREST without a named single SKU + offer slot → don't fall to Gemini invent
    if (earlyIntent === 'PRODUCT_INTEREST' && classified.slots?.offerKey) {
      const bundle = getBundleByKey(classified.slots.offerKey);
      if (bundle) {
        selectedBundleKey = bundle.key;
        await persist({ selectedBundle: bundle.key });
        if (historyAlreadyPitchedBundle(chatHistory, bundle.key)) {
          const r = await replyForAlreadyPitchedRoutine(sid, bundle, message, chatHistory);
          await persist({ selectedBundle: bundle.key, cart: sessionCarts[sid] });
          return finish(r, message);
        }
        return finish({
          reply: pitchRoutineByKey(bundle.key),
          sessionId: sid,
          selectedBundleKey: bundle.key,
          keepCta: true,
        }, message);
      }
    }

    // Pick one or more of the 3 offers → lock + show / add to cart
    if (earlyIntent === 'SELECT_OFFER') {
      const multi = resolveAllBundlesFromOrdinals(message);
      const wantsMultiBuy =
        multi.length >= 2
        && /(عايز|عاوز|عاوزه|عايزة|محتاج|خدو|خدوا|سجلي|سجّلي|اوردر|أوردر|الاتنين|التلات|عوز)/i.test(String(message || ''));
      if (wantsMultiBuy) {
        const r = await replyAfterAddingMultipleOfferBundles(sid, multi);
        selectedBundleKey = multi[multi.length - 1].key;
        await persist({ selectedBundle: selectedBundleKey, cart: sessionCarts[sid] });
        return finish(r, message);
      }
      if (multi.length >= 2) {
        // Named two offers without clear buy verb — pitch both briefly, ask to register
        const parts = multi.map((b) => formatBundlePriceReply(b)).filter(Boolean);
        selectedBundleKey = multi[0].key;
        await persist({ selectedBundle: selectedBundleKey });
        return finish({
          reply: parts.join('\n\n') + '\n\nتحبي أسجلك الاتنين في أوردر واحد؟',
          sessionId: sid,
          selectedBundleKey,
          keepCta: true,
        }, message);
      }
      const bundle = resolveOfferBundleFromContext(classified, message, lastBot, selectedBundleKey);
      if (bundle) {
        selectedBundleKey = bundle.key;
        await persist({ selectedBundle: bundle.key });
        const tSel = softNormalizeAr(expandFrancoAndTypos(String(message || '')));
        const wantsBuySel =
          /(عا[ييو]ز[اهة]?|محتاج[اهة]?|ابي|أبي|خدو|خدوا|سجلي|سجّلي|اوردر|أوردر|اطلب)/i.test(tSel)
          || isExplicitCheckoutIntent(message)
          || isProductAddConfirmation(message);
        if (wantsBuySel || historyAlreadyPitchedBundle(chatHistory, bundle.key)) {
          const r = await replyForAlreadyPitchedRoutine(sid, bundle, message, chatHistory);
          await persist({ selectedBundle: bundle.key, cart: sessionCarts[sid] });
          return finish(r, message);
        }
        return finish({
          reply: formatBundlePriceReply(bundle),
          sessionId: sid,
          selectedBundleKey: bundle.key,
          keepCta: true,
        }, message);
      }
      return finish({
        reply: emptyCartOfferRoutinesReply(),
        sessionId: sid,
        keepCta: true,
      }, message);
    }

    // "العرض كامل بكام" → ad package price (or list if no ad). Never treat as "كل العروض".
    if (isFullOfferPackagePriceAsk(message)) {
      const fromAd = getBundleByKey(selectedBundleKey);
      if (fromAd) {
        await persist({ selectedBundle: fromAd.key });
        return finish({
          reply: formatBundlePriceReply(fromAd),
          sessionId: sid,
          selectedBundleKey: fromAd.key,
          keepCta: true,
        }, message);
      }
      return finish({
        reply: emptyCartOfferRoutinesReply(),
        sessionId: sid,
        keepCta: true,
      }, message);
    }

    // "ايه العروض / في عروض" → real 3 only (never Gemini invent)
    // Active ad + bare "بكام" → THAT ad's price only (customer came from ManyChat ad)
    if (earlyIntent === 'ROUTINE_OR_SET' || earlyIntent === 'PRICE_ASK') {
      // Product-ad context + price/size follow-up → that SKU only (not after a routine pitch)
      if (
        earlyIntent === 'PRICE_ASK'
        && selectedProductSlug
        && isProductAdFollowUpAsk(message)
        && !isOfferPriceFollowUpAsk(message, lastBot)
        && !lastBotDescribedRoutine(lastBot)
      ) {
        await persist({ selectedProduct: selectedProductSlug });
        return finish(await productAdFollowUpReply(sid, selectedProductSlug, message), message);
      }
      // كورس / روتين / التلاتة معًا فقط → عرض التفتيح (منتج أو اتنين → tryPriceQuestion)
      if (earlyIntent === 'PRICE_ASK' && isCleanserCreamPairAsk(message)) {
        const bright = getBundleByKey('brightening');
        if (bright) {
          selectedBundleKey = bright.key;
          await persist({ selectedBundle: bright.key });
          return finish({
            reply: formatBundlePriceReply(bright),
            sessionId: sid,
            selectedBundleKey: bright.key,
            keepCta: true,
          }, message);
        }
      }
      // 1–2 named products → fall through to tryPriceQuestion (unit prices + ship tip)
      if (earlyIntent === 'PRICE_ASK' && (isFewNamedProductsPriceAsk(message) || isBothOfThemPriceAsk(message) || wantsSingleSkuOnly(message))) {
        // intentionally empty — handled later by tryPriceQuestion
      }
      if (shouldAnswerWithAdBundle(message, selectedBundleKey) && earlyIntent === 'PRICE_ASK'
        && !isFewNamedProductsPriceAsk(message)
        && !wantsSingleSkuOnly(message)
        && !isBothOfThemPriceAsk(message)) {
        const fromAd = getBundleByKey(selectedBundleKey);
        await persist({ selectedBundle: fromAd.key });
        return finish({
          reply: formatBundlePriceReply(fromAd),
          sessionId: sid,
          selectedBundleKey: fromAd.key,
          keepCta: true,
        }, message);
      }
      const namedOffer =
        resolveOfferBundleFromContext(classified, message, lastBot, selectedBundleKey);
      if (namedOffer && (isOfferOrdinalPick(message) || classified.slots?.offerKey || resolveBundleFromCustomerText(message) || shouldAnswerWithAdBundle(message, selectedBundleKey))) {
        selectedBundleKey = namedOffer.key;
        await persist({ selectedBundle: namedOffer.key });
        return finish({
          reply: formatBundlePriceReply(namedOffer),
          sessionId: sid,
          selectedBundleKey: namedOffer.key,
          keepCta: true,
        }, message);
      }
      if (lastBotListedRoutineOffers(lastBot) && !namedOffer && !getBundleByKey(selectedBundleKey)) {
        // After listing offers: "منتجات لوحدها" ≠ pick an offer number
        if (isUnitProductsPriceListAsk(message)) {
          return finish(await unitProductsPriceListReply(sid), message);
        }
        return finish({
          reply: whichOfferPriceAskReply(),
          sessionId: sid,
          keepCta: true,
        }, message);
      }
      // Asking for the full list — even if an ad is set
      // But not when sticky product-ad follow-up ("سعره كام") was mislabeled ROUTINE_OR_SET
      // And not when she named a product ("كريم مونتانا بكام")
      if (
        (earlyIntent === 'ROUTINE_OR_SET' || wantsAllOffersList(message))
        && !(selectedProductSlug && isProductAdFollowUpAsk(message) && !wantsAllOffersList(message))
        && !isFewNamedProductsPriceAsk(message)
        && !wantsSingleSkuOnly(message)
        && !isBothOfThemPriceAsk(message)
      ) {
        return finish({
          reply: emptyCartOfferRoutinesReply(),
          sessionId: sid,
          keepCta: true,
        }, message);
      }
      if (selectedProductSlug && isProductAdFollowUpAsk(message)) {
        await persist({ selectedProduct: selectedProductSlug });
        return finish(await productAdFollowUpReply(sid, selectedProductSlug, message), message);
      }
      // PRICE_ASK without prior list → fall through to tryPriceQuestion later
    }

    // Want order after discussing/selecting an offer → add FULL bundle (not one SKU)
    // Skip while checkout wizard is collecting details (wizard owns those turns).
    const wizBusy = checkoutWizards[sid] && checkoutWizards[sid].step !== 'await_confirm';
    if (!wizBusy && (earlyIntent === 'CHECKOUT_READY' || earlyIntent === 'ADD_CONFIRM')) {
      const multiBuy = resolveAllBundlesFromOrdinals(message);
      if (multiBuy.length >= 2) {
        const r = await replyAfterAddingMultipleOfferBundles(sid, multiBuy);
        selectedBundleKey = multiBuy[multiBuy.length - 1].key;
        await persist({ selectedBundle: selectedBundleKey, cart: sessionCarts[sid] });
        return finish(r, message);
      }
      // مهم: متثقيش في slots.offerKey لوحده بعد browse/list
      const namedPick =
        resolveBundleFromCustomerText(message)
        || resolveBundleFromOrdinal(message);
      const lastWasBrowseOrList =
        lastBotListedRoutineOffers(lastBot)
        || /العروض المتاحة|أنهي عرض|قولي اسم العرض|شوفي شكل|montana\.com\.eg/i.test(String(lastBot || ''));
      if (
        (earlyIntent === 'CHECKOUT_READY' || earlyIntent === 'ADD_CONFIRM')
        && !namedPick
        && lastWasBrowseOrList
      ) {
        return finish({
          reply: whichOfferPriceAskReply(),
          sessionId: sid,
        }, message);
      }
      const bundle = resolveOfferBundleFromContext(classified, message, lastBot, selectedBundleKey);
      const cart = sessionCarts[sid] || [];
      const hasBundle = cart.some((i) => i?.isBundle || String(i?.id || '').startsWith('bundle:'));
      const lastPitchedSingle =
        earlyIntent === 'ADD_CONFIRM' &&
        wasAskingToAddToCart(lastBot) &&
        !botAskedBundleConfirm(lastBot) &&
        !resolveSinglePitchedBundle(lastBot);

      // Already has the offer in cart + wants to continue → checkout choice
      if (bundle && hasBundle && earlyIntent === 'CHECKOUT_READY' && !lastPitchedSingle) {
        selectedBundleKey = bundle.key;
        await persist({ selectedBundle: bundle.key, cart: sessionCarts[sid] });
        return finish(offerCheckoutChoice(sid, { knownPhone: customerPhone }), message);
      }

      if (bundle && !lastPitchedSingle && (!cart.length || !hasBundle)) {
        const r = await replyAfterAddingOfferBundle(sid, bundle);
        selectedBundleKey = bundle.key;
        await persist({ selectedBundle: bundle.key, cart: sessionCarts[sid] });
        return finish(r, message);
      }
    }
  }

  // ManyChat ad bundle context (selectedBundle) — no Meta referral dependency
  // LLM-first skips this: Gemini + tools own the sales turn.
  if (!skipScriptedMaze) {
    const adResult = await tryAdOfferFlow({
      message,
      sid,
      chatHistory,
      // Prefer already-resolved session key (from selectedBundle OR ad title)
      selectedBundle: selectedBundleKey || selectedBundle,
      sessionBundleKey: selectedBundleKey,
    });
    if (adResult?.selectedBundleKey) selectedBundleKey = adResult.selectedBundleKey;
    if (adResult?.cart) sessionCarts[sid] = adResult.cart;
    if (adResult?.reply) {
      console.warn('[DIAG ad-offer]', JSON.stringify({
        sid,
        selectedBundle: selectedBundleKey,
        msg: String(message || '').slice(0, 80),
      }));
      await persist({ selectedBundle: selectedBundleKey });
      return finish(adResult, message || null);
    }
    if (adResult?.continue || selectedBundleKey) {
      await persist({ selectedBundle: selectedBundleKey, history: chatHistory, cart: sessionCarts[sid] || [] });
    }
  }

  if (!message) {
    return finish({
      reply: routinesWelcomeReply(),
      sessionId: sid,
    }, null);
  }

  // Legacy scripted sales maze — skipped when LLM-first (default)
  if (!skipScriptedMaze) {
  // First-touch greeting (ad / cold open, no selectedBundle) → 3 routines + free ship
  {
    const userTurns = (chatHistory || []).filter((h) => h.role === 'user').length;
    const firstTouch = userTurns === 0;
    if (
      firstTouch
      && !getBundleByKey(selectedBundleKey)
      && isGreetingOrSoftOpen(message)
      && !wantsExistingOrderHelp(message)
      && !isPriceQuestion(message)
      && !isBrighteningRoutineNeed(message)
      && !isExplicitCheckoutIntent(message)
      && !isCancelCurrentOrderAsk(message)
      && !isShowProductsLookAsk(message)
    ) {
      return finish({
        reply: routinesWelcomeReply(),
        sessionId: sid,
      }, message);
    }
  }

  if (isHumanHandoffRequest(message)) {
    console.warn('[DIAG human-handoff]', JSON.stringify({ sid, message: String(message).slice(0, 160) }));
    chatHistory = stampBotPaused(chatHistory);
    return finish({ reply: humanHandoffReply(), sessionId: sid, needsHuman: true, botPaused: true });
  }

  // After CS number / "الفريق هيتواصل" — "تمام"/"شكرا" = ack only, never re-pitch offers
  {
    const lastBotCs = lastModelMessage(chatHistory);
    if (lastBotHandedOffToCs(lastBotCs)) {
      const t = String(message || '').trim();
      if (isAffirmativeShort(t) || /^(شكرا|شكراً|thanks|ok|اوك|ماشي|حاضر|طيب)[\s!.،؟?]*$/i.test(t)) {
        return finish({
          reply: /01019787225/.test(lastBotCs)
            ? 'تحت أمرك يا فندم 💜 خدمة العملاء هتساعدك على الرقم.'
            : `تحت أمرك يا فندم 💜 تواصلي مع خدمة العملاء على **${CS_SUPPORT_PHONE}**.`,
          sessionId: sid,
        });
      }
      // "؟؟؟" after vague "الفريق هيتواصل" without a number → give the real CS line
      if (/^[؟?\s]+$/.test(t) && !/01019787225/.test(lastBotCs)) {
        return finish({
          reply: orderNotFoundCsReply(),
          sessionId: sid,
          needsHuman: true,
        });
      }
    }
  }

  // Existing-order status / missing delivery / deposit dispute — look up by
  // phone; if nothing in admin orders → CS number (no "سجّلت رقمك" sales loop).
  {
    const inStatusLookup = orderWizard?.mode === 'status';
    const lastBotForLookup = lastModelMessage(chatHistory);
    const phoneInMsg = extractPhoneFromText(message);
    const cartNow = sessionCarts[sid] || [];
    // Volunteered checkout details with items in cart must NEVER hit status lookup
    const deliveringNow =
      cartNow.length > 0 &&
      (looksLikeVolunteeredDeliveryDetails(message) ||
        /ابعتيلي\s*(الاسم|اسمك)|العنوان|المحافظة/i.test(lastBotForLookup));
    const shouldLookup =
      !deliveringNow &&
      (inStatusLookup
        || wantsExistingOrderHelp(message)
        || isOrderProblemComplaint(message)
        || (phoneInMsg && botAskedForOrderLookupPhone(lastBotForLookup)));

    if (shouldLookup && !(orderWizard && !inStatusLookup)) {
      // Owner's rule: an order problem / late delivery goes straight to a
      // human. No asking for a phone, no lookup, no back-and-forth — those
      // conversations belong to customer service, not the bot.
      await persist({ orderWizard: null });
      return finish({
        reply: orderIssueCsReply(),
        sessionId: sid,
        needsHuman: true,
      });
    }

  }

  // Intent already classified at start of turn (reuse classified / allProducts / lastBot).
  if (!allProducts) {
    const { data: prods } = await sb.from('products')
      .select('id, name, price, image_url, stock, old_price, slug')
      .eq('is_active', true);
    allProducts = prods;
  }
  lastBot = lastModelMessage(chatHistory);

  // Checkout choice / in-chat details wizard — intent-first
  if (checkoutWizards[sid] && checkoutWizards[sid].step !== 'await_confirm') {
    // Keep knownPhone on the wizard if we learned it this session
    if (customerPhone && !checkoutWizards[sid].knownPhone) {
      checkoutWizards[sid].knownPhone = customerPhone;
    }
    const wizResult = await advanceCheckoutWizard(sid, message, channel, classified, chatHistory);
    if (wizResult) {
      if (wizResult.orderJustPlaced) {
        customerPhone = wizResult.order?.phone || customerPhone;
        customerName = wizResult.order?.customer_name || customerName;
        delete chatSessions[sid];
        sessionCarts[sid] = [];
        chatHistory = appendHistory(
          chatHistory,
          '(النظام: العميل كمّل بيانات التوصيل في الشات وتسجّل الأوردر)',
          `تمام، الأوردر ${wizResult.order.order_number} اتسجل بنجاح والأوردر بقى فاضي.`
        );
        await persist({ customerPhone, customerName, cart: [], history: chatHistory, checkoutWizard: null });
        return finish({
          reply: wizResult.reply,
          sessionId: sid,
          order: wizResult.order,
          cart: [],
        }, message);
      }
      // Persist phone/name collected mid-wizard
      const wiz = checkoutWizards[sid];
      if (wiz?.data?.phone) customerPhone = normalizePhone(wiz.data.phone) || customerPhone;
      if (wiz?.data?.name) customerName = wiz.data.name;
      await persist({
        customerPhone,
        customerName,
        checkoutWizard: checkoutWizards[sid] || null,
      });
      return finish(wizResult);
    }
    // Wizard aborted (customer asked about products / greeted) — clear persisted step
    if (!checkoutWizards[sid]) {
      await persist({ checkoutWizard: null });
    }
  }

  // Bind phone from free-text mid-chat (Messenger has no wa_id) — outside
  // active shipping-collection steps so we don't steal the phone reply.
  {
    const extracted = extractPhoneFromText(message);
    if (extracted && extracted !== customerPhone) {
      customerPhone = extracted;
      const profile = await getCustomerProfile(extracted);
      if (profile?.name) customerName = profile.name;
      await persist({ customerPhone, customerName });
      delete chatSessions[sid];
      // Bare phone message → acknowledge memory instead of confusing Gemini
      // (skip when we just finished / are in order-status lookup — that path
      // already answered above).
      if (
        /^[\s+]*(\+?20|0020)?0?1[\d\s-]{8,}\s*$/.test(String(message || '').trim())
        && !botAskedForOrderLookupPhone(lastModelMessage(chatHistory))
      ) {
        const past = await getPastProducts(customerPhone);
        const helloName = safeGreetingFirstName(customerName);
        const hello = helloName ? `أهلاً بيكي يا ${helloName}` : 'تمام';
        const pastNote = past.length ? ` — فاكرة طلباتك السابقة (${past.slice(0, 3).join('، ')})` : '';
        return finish({
          reply: `${hello} 💜 سجّلت رقمك${pastNote}. قوليلي تحبي تطلبي إيه أو نكمّل الأوردر؟`,
          sessionId: sid,
        });
      }
    }
  }

  if (!genAI) {
    throw Object.assign(new Error('Chat service unavailable'), { status: 503 });
  }

  const intent = classified.intent;
  const wantedNames = classified.products || [];

  // Price / routine-set — deterministic (never invent; never re-dump after just listing)
  if (intent === 'PRICE_ASK' || intent === 'ROUTINE_OR_SET') {
    if (shouldAnswerWithAdBundle(message, selectedBundleKey) && intent === 'PRICE_ASK') {
      const fromAd = getBundleByKey(selectedBundleKey);
      return finish({
        reply: formatBundlePriceReply(fromAd),
        sessionId: sid,
        selectedBundleKey: fromAd.key,
        keepCta: true,
      });
    }
    if (
      lastBotListedRoutineOffers(lastBot)
      && !resolveBundleFromCustomerText(message)
      && !isOfferOrdinalPick(message)
      && !getBundleByKey(selectedBundleKey)
    ) {
      if (isUnitProductsPriceListAsk(message)) {
        return finish(await unitProductsPriceListReply(sid));
      }
      return finish({
        reply: whichOfferPriceAskReply(),
        sessionId: sid,
        keepCta: true,
      });
    }
    if (intent === 'ROUTINE_OR_SET' || wantsAllOffersList(message)) {
      // Asking what offers exist → always the real 3, never invent / never truncate to one
      if (wantsAllOffersList(message) || !getBundleByKey(selectedBundleKey)) {
        return finish({
          reply: emptyCartOfferRoutinesReply(),
          sessionId: sid,
          keepCta: true,
        });
      }
      const fromAd = getBundleByKey(selectedBundleKey);
      return finish({
        reply: formatBundlePriceReply(fromAd),
        sessionId: sid,
        selectedBundleKey: fromAd.key,
        keepCta: true,
      });
    }
    const priceQuestionResult = await tryPriceQuestion(message, sid, chatHistory, selectedBundleKey, selectedProductSlug);
    if (priceQuestionResult) {
      if (priceQuestionResult.selectedBundleKey) selectedBundleKey = priceQuestionResult.selectedBundleKey;
      return finish(priceQuestionResult);
    }
    return finish({
      reply: emptyCartOfferRoutinesReply(),
      sessionId: sid,
      keepCta: true,
    });
  }

  if (intent === 'POINTS_ASK') {
    return finish({ reply: explainPointsShort(), sessionId: sid, keepCta: true });
  }

  if (intent === 'DELIVERY_ETA') {
    return finish({
      reply: 'التوصيل عادة **2–3 أيام عمل** حسب المحافظة يا فندم 💜 كاش عند الاستلام.',
      sessionId: sid,
      keepCta: true,
    });
  }

  if (intent === 'HOW_TO_ORDER') {
    const cart = sessionCarts[sid] || [];
    if (cart.length) {
      return finish(offerCheckoutChoice(sid, { knownPhone: customerPhone }));
    }
    return finish({
      reply: emptyCartOfferRoutinesReply(),
      sessionId: sid,
      keepCta: true,
    });
  }

  // Volunteered name+phone+address with a non-empty cart → checkout, never re-ADD.
  if (intent === 'PROVIDE_FULL_DETAILS' || looksLikeVolunteeredDeliveryDetails(message)) {
    const volunteered = await tryVolunteeredDetailsCheckout(message, sid, customerPhone);
    if (volunteered) {
      if (volunteered.sessionId && checkoutWizards[sid]) {
        const phone = checkoutWizards[sid]?.data?.phone || extractPhoneFromText(message);
        if (phone) customerPhone = phone;
        if (checkoutWizards[sid]?.data?.name) customerName = checkoutWizards[sid].data.name;
        await persist({
          customerPhone,
          customerName,
          cart: sessionCarts[sid] || [],
          checkoutWizard: checkoutWizards[sid] || null,
        });
      }
      return finish(volunteered);
    }
  }

  // "غسول بس" / "الكريم فقط" while cart has a bundle → keep that product only
  {
    const cart = sessionCarts[sid] || [];
    const hasBundle = cart.some((i) => i.isBundle || String(i.id || '').startsWith('bundle:'));
    if (hasBundle && /(بس|فقط)/i.test(String(message || '')) && /(غسول|كريم|لوشن)/i.test(String(message || ''))) {
      const changed = await maybeDowngradeCartToSingleProduct(message, sid);
      if (changed) {
        const item = (sessionCarts[sid] || [])[0];
        await persist({ cart: sessionCarts[sid] });
        return finish({
          reply: `تمام يا فندم 💜 خلّيت الأوردر **${item.name}** بس بسعر **${Math.round(item.price)}** جنيه.\n\nتحبي نكمل الأوردر؟`,
          sessionId: sid,
          keepCta: true,
        });
      }
    }
  }

  // "اه/تمام" after "تحبي أسجلك أوردر؟" = add the recommended product — not checkout.
  if (
    (intent === 'ADD_CONFIRM' || isAffirmativeShort(message)) &&
    wasAskingToAddToCart(lastBot) &&
    !wasAskingToCheckout(lastBot)
  ) {
    const matched = wantedNames.length
      ? (allProducts || []).filter((p) => wantedNames.includes(p.name))
      : resolveProductMentions(lastBot, allProducts || []);
    if (matched.length) {
      const cart = sessionCarts[sid] || (sessionCarts[sid] = []);
      const added = [];
      const unavailable = [];
      for (const p of matched) {
        if ((p.stock ?? 0) <= 0) { unavailable.push(p.name); continue; }
        if (!cart.find((i) => i.id === p.id)) {
          cart.push({ id: p.id, name: p.name, image: p.image_url, price: p.price, qty: 1 });
        }
        added.push(p.name);
      }
      await persist({ cart: sessionCarts[sid] });
      const lines = [];
      if (added.length) {
        lines.push(`تمام يا فندم 💜 أضفت ${added.join(' و ')} لأوردرك ✅`);
        lines.push('تحبي نكمل الأوردر؟');
      }
      if (unavailable.length) lines.push(`${unavailable.join(' و ')} غير متوفر حالياً للأسف`);
      if (lines.length) return finish({ reply: lines.join('\n'), sessionId: sid, keepCta: added.length > 0 });
    }
  }

  // Finish-order intent first when the cart already has items
  {
    const cart = sessionCarts[sid] || [];
    const wantsCheckout =
      intent === 'CHECKOUT_READY' ||
      intent === 'CHOOSE_CHAT' ||
      intent === 'CHOOSE_SITE' ||
      intent === 'PROVIDE_FULL_DETAILS' ||
      (cart.length > 0 && isExplicitCheckoutIntent(message)) ||
      (cart.length > 0 && isAffirmativeShort(message) && wasAskingToCheckout(lastBot));
    if (wantsCheckout) {
      if (!cart.length) {
        if (historyHasRecentOrderConfirm(chatHistory)) {
          return finish({
            reply: 'تحت أمرك يا فندم 💜 لو محتاجة أي حاجة تانية قوليلي.',
            sessionId: sid,
          });
        }
        return finish({
          reply: emptyCartOfferRoutinesReply(),
          sessionId: sid,
          keepCta: true,
        });
      }
      if (intent === 'CHOOSE_SITE') {
        return finish(sendCheckoutLink(sid));
      }
      if (intent === 'CHOOSE_CHAT') {
        checkoutWizards[sid] = { step: 'await_method', knownPhone: customerPhone || null };
        const seed = mergeCheckoutSeed({}, classified.slots || {});
        return finish(await beginChatCheckoutCollection(sid, checkoutWizards[sid], seed));
      }
      return finish(offerCheckoutChoice(sid, { knownPhone: customerPhone }));
    }
  }

  if (intent === 'ADD_CONFIRM' && wantedNames.length) {
    const cart = sessionCarts[sid] || (sessionCarts[sid] = []);
    const newlyAdded = [];
    const alreadyHad = [];
    const unavailable = [];
    for (const name of wantedNames) {
      const p = (allProducts || []).find((x) => x.name === name);
      if (!p) continue;
      if ((p.stock ?? 0) <= 0) { unavailable.push(p.name); continue; }
      if (!cart.find((i) => i.id === p.id)) {
        cart.push({ id: p.id, name: p.name, image: p.image_url, price: p.price, qty: 1 });
        newlyAdded.push(p.name);
      } else {
        alreadyHad.push(p.name);
      }
    }
    await persist({ cart: sessionCarts[sid] });

    // Misclassified shipping details / second "عايزاهم" when items already in cart
    // → nudge checkout instead of repeating "أضفت … لأوردرك".
    if (!newlyAdded.length && alreadyHad.length && !unavailable.length) {
      return finish(offerCheckoutChoice(sid, { knownPhone: customerPhone }));
    }

    const lines = [];
    if (newlyAdded.length) {
      lines.push(`تمام يا فندم 💜 أضفت ${newlyAdded.join(' و ')} لأوردرك ✅`);
      lines.push('تحبي نكمل الأوردر؟');
    }
    if (unavailable.length) lines.push(`${unavailable.join(' و ')} غير متوفر حالياً للأسف`);
    if (lines.length) return finish({ reply: lines.join('\n'), sessionId: sid, keepCta: newlyAdded.length > 0 });
  }

  const orderManageResult = await tryOrderManageWizard(message, sid, orderWizard, persist);
  if (orderManageResult) return finish(orderManageResult);

  const orderContextResult = await tryOrderContextReply({
    message,
    sid,
    cart: sessionCarts[sid] || [],
    customerPhone,
    chatHistory,
  });
  if (orderContextResult) {
    if (orderContextResult.startOrderWizard) {
      await persist({
        orderWizard: { step: 'phone', phone: null, orderNumber: null, orders: null },
      });
      delete orderContextResult.startOrderWizard;
    }
    return finish(orderContextResult);
  }

  if (checkoutWizards[sid]) {
    const hadConfirm = checkoutWizards[sid].step === 'await_confirm';
    const confirmResult = await tryAdvanceCheckoutConfirm(sid, message);
    if (confirmResult) {
      // Do NOT persist checkoutWizard:null here — offerCheckoutChoice may
      // have already set await_method on the same turn.
      return finish(confirmResult);
    }
    if (hadConfirm && !checkoutWizards[sid]) await persist({ checkoutWizard: null });
  }

  // const explicitAddResult = await tryExplicitAddToCart(message, sid);
  // if (explicitAddResult) {
  //   await persist({ cart: sessionCarts[sid] || [] });
  //   return finish(explicitAddResult);
  // }

  // Shipping / category / details FAQ — scripted maze only (LLM-first uses Gemini tools)
  if (!skipScriptedMaze && isShippingCostQuestion(message)) {
    return finish({
      reply: await shippingCostReplyForMessage(message, sid),
      sessionId: sid,
    });
  }

    const categoryFollow = await tryCategoryFollowUpReply(message, sid, chatHistory, selectedBundleKey);
    if (categoryFollow) return finish(categoryFollow);

    const productDetailsResult = await tryProductDetailsAnswer(message, sid, chatHistory);
    if (productDetailsResult) return finish(productDetailsResult);

    const directRecommend = await tryDirectRecommend(message, sid, chatHistory);
    if (directRecommend) return finish(directRecommend);
  } // end legacy scripted sales maze

  const agents = ['لايان', 'نوران', 'نور'];
  const agentIndex = Math.floor(Date.now() / (2 * 60 * 60 * 1000)) % agents.length;
  const agentName = agents[agentIndex];

  if (!chatSessions[sid]) {
    const stockistPrompt = await loadStockistBotText();
    const activePromo = await getPromo();
    const promoForPrompt = activePromo.active ? promoLine(activePromo) : '';
    const model = genAI.getGenerativeModel({
      // gemini-pro-latest resolves to Gemini 3.1 Pro, whose free-tier daily
      // quota (250 requests/day) the store's real traffic started exceeding
      // — every request past that cap 429s and the customer got a generic
      // fallback instead of a real answer for the rest of the day.
      // gemini-2.5-pro 404s outright on this key ("no longer available to
      // new users" — Google AI Studio's usage dashboard still lists it with
      // quota, but the API itself refuses it). gemini-2.5-flash has 10,000/
      // day on this account (40x the old cap) and isn't blocked.
      model: 'gemini-2.5-flash',
      systemInstruction: {
        parts: [{
          // The running campaign is appended rather than written into
          // SYSTEM_PROMPT, so switching it off is one row in site_settings and
          // the bot stops mentioning it on the next message, with no deploy.
          text: [
            SYSTEM_PROMPT,
            stockistPrompt || '',
            promoForPrompt ? `## عرض شغال دلوقتي\n${promoForPrompt}` : '',
          ].filter(Boolean).join('\n\n'),
        }],
      },
      tools,
      // The model's internal "thinking" step eats into the same output-
      // token budget as the visible reply, so a generous ceiling avoids an
      // empty final response on tool-calling turns.
      generationConfig: { maxOutputTokens: 8192, temperature: 0.4 },
    });
    const pastProducts = customerPhone ? await getPastProducts(customerPhone) : [];
    const pastProductsNote = pastProducts.length ? ` — اشترى قبل كده: ${pastProducts.join('، ')}` : '';
    const activeBundle = getBundleByKey(selectedBundleKey);
    const bundleNote = geminiBundleContext(activeBundle);
    const memoryIntro = (customerName || customerPhone || bundleNote)
      ? [{
          role: 'user',
          parts: [{
            text:
              `(عميل معروف${customerName ? ': ' + customerName : ''}${customerPhone ? ' — ' + customerPhone : ''} — جلسة سابقة${pastProductsNote}.` +
              (bundleNote ? ` ${bundleNote}` : '') +
              ` لو هتكمّل أوردر وطلبت قبل كده، النظام يقدر يستخدم بياناتها السابقة بعد التأكيد.)`,
          }],
        },
         { role: 'model', parts: [{ text: activeBundle ? `تمام، فاكرة عرض ${activeBundle.name} 💜` : (pastProducts.length ? 'تمام، فاكرة العميل ومنتجاته اللي جربها قبل كده 💜' : 'تمام، فاكرة العميل برقم الموبايل 💜') }] }]
      : [];
    chatSessions[sid] = model.startChat({
      history: [
        { role: 'user', parts: [{ text: `اسمك "${agentName}"` }] },
        { role: 'model', parts: [{ text: `أنا ${agentName} من فريق مونتانيا 💜` }] },
        ...memoryIntro,
        ...historyToGemini(chatHistory),
      ],
    });
  }

  const skipCheckoutNudge =
    isProductAddConfirmation(message) &&
    wasAskingToAddToCart(lastModelMessage(chatHistory));

  if (!skipCheckoutNudge) {
    const thanksNudge = maybeNudgeCheckoutOnThanks(message, sid, customerPhone);
    if (thanksNudge) {
      // Only start checkout wizard on explicit checkout intent — never on bare "شكرا"
      if (thanksNudge.awaitConfirm && isExplicitCheckoutIntent(message)) {
        checkoutWizards[sid] = {
          step: 'await_confirm',
          knownPhone: thanksNudge.knownPhone || customerPhone || null,
        };
        await persist({ checkoutWizard: checkoutWizards[sid] });
      }
      return finish(thanksNudge);
    }
  }

  const symptomNote = await buildSymptomNote(message, sid);
  const understandingNote = buildUnderstandingNote(message);
  const stockistNote = await loadStockistBotText();
  const turnContext = buildLlmTurnContextNote({
    selectedProductSlug,
    selectedBundleKey,
    cart: sessionCarts[sid] || [],
    customerName,
    customerPhone,
    lastBot: lastModelMessage(chatHistory),
    exposeCart: shouldExposeCartToLlm(message, sid, chatHistory),
  });
  const notes = [turnContext, understandingNote, symptomNote, stockistNote ? `(${stockistNote})` : '']
    .filter(Boolean)
    .join('\n');
  const modelInputMessage = notes ? `${message}\n\n${notes}` : message;

  const chat = chatSessions[sid];
  let result, calls;
  let startCheckoutReply = null;
  try {
    result = await chat.sendMessage(modelInputMessage);
    calls = result.response.functionCalls();

    // Gemini occasionally returns an empty response (finishReason STOP, no
    // text, no function call) — a transient model quirk on some prompts, not
    // a real "nothing to say". Retry a couple of times before giving up.
    for (let retry = 0; retry < 2 && !calls?.length && !result.response.text(); retry++) {
      result = await chat.sendMessage(modelInputMessage);
      calls = result.response.functionCalls();
    }
  } catch (e) {
    // The Gemini API call itself failing (503 overload, rate limit, network
    // error — seen live: "This model is currently experiencing high
    // demand") used to propagate uncaught all the way to api/chat.js's
    // outer catch, which returns a bare 500 with no `reply` field at all —
    // ManyChat's Response Mapping has nothing to send, so the customer got
    // total silence instead of an answer. Her message is very often a
    // price/product question, so fall back to the real price list instead.
    console.error('[DIAG gemini-failed]', JSON.stringify({
      sid,
      err: e.message,
      msg: String(message || '').slice(0, 160),
    }));
    return finish({
      reply: await smartGeminiFallback(message, sid, chatHistory, 'معلش يا فندم، ', selectedBundleKey),
      sessionId: sid,
    });
  }

  // Still nothing after retries — rather than leave the customer with an
  // empty non-answer, fall back to real product data directly.
  if (!calls?.length && !result.response.text()) {
    console.error('[DIAG gemini-empty]', JSON.stringify({
      sid,
      msg: String(message || '').slice(0, 160),
    }));
    return finish({
      reply: await smartGeminiFallback(message, sid, chatHistory, '', selectedBundleKey),
      sessionId: sid,
    });
  }

  let orderJustCreated = null;

  let guard = 0;
  while (calls && calls.length && guard < 10) {
    const responses = [];
    for (const call of calls) {
      const output = await runFunctionCall(call.name, call.args, sid, { knownPhone: customerPhone });
      if (call.name === 'create_order' && output?.order_number && !output.error) {
        orderJustCreated = output.order_number;
      }
      if (call.name === 'start_checkout' && output?.bot_reply_hint) {
        startCheckoutReply = output.bot_reply_hint;
      }
      if (call.name === 'add_to_cart' || call.name === 'add_routine_offer') {
        await persist({ cart: sessionCarts[sid] || [] });
      }
      if (call.name === 'start_checkout' && checkoutWizards[sid]) {
        await persist({ checkoutWizard: checkoutWizards[sid], cart: sessionCarts[sid] || [] });
      }
      responses.push({ functionResponse: { name: call.name, response: output } });
    }
    try {
      result = await chat.sendMessage(responses);
      calls = result.response.functionCalls();
    } catch (e) {
      console.error('[DIAG gemini-failed-followup]', JSON.stringify({
        sid,
        err: e.message,
        msg: String(message || '').slice(0, 160),
        toolGuard: guard,
      }));
      return finish({
        reply: await smartGeminiFallback(message, sid, chatHistory, 'معلش يا فندم، ', selectedBundleKey),
        sessionId: sid,
      });
    }
    guard++;
  }

  // Safety net: the model sometimes describes "opening a form"/"sending a
  // link" in prose without actually calling show_checkout_form (seen on
  // ManyChat when a customer volunteers her shipping info unprompted) —
  // there's no real form on non-web channels, so fall back to the real
  // checkout link instead of leaving the customer staring at a form/link
  // that was never actually sent.
  //
  // Real bug (live customer transcript, Mohamed Abed) with the OLD chat-based
  // info-collection flow: this used to match on the bare word "فورم"
  // appearing ANYWHERE in the model's reply, and the system prompt itself
  // discusses "الفورم" extensively — so the model legitimately said the word
  // constantly while reasoning about NOT using one, and every one of those
  // legitimate replies got silently discarded. Narrowed to only match an
  // actual first-person claim of having sent/opened one ("هفتحلك فورم"،
  // "هبعتلك لينك"), not any passing mention of the word.
  if (/(هفتحلك|هبعتلك|بعتلك|فتحتلك|هارسلك|هرسلك)\s*(ال)?(فورم|لينك)/i.test(result.response.text() || '')) {
    const cart = sessionCarts[sid] || [];
    if (cart.length) return finish(offerCheckoutChoice(sid, { knownPhone: customerPhone }));
    return finish({ reply: emptyCartOfferRoutinesReply(), sessionId: sid, keepCta: true });
  }

  const rawText = result.response.text();
  if (!rawText) {
    console.error('[DIAG empty-text]', JSON.stringify({
      guard,
      finishReason: result.response.candidates?.[0]?.finishReason,
      safetyRatings: result.response.candidates?.[0]?.safetyRatings,
      promptFeedback: result.response.promptFeedback,
    }));
  }
  let replyText = rawText || 'تمام يا فندم، ثواني وهرجعلك بكل التفاصيل 😊';

  // Prefer deterministic checkout prompt when the model opened checkout via tool
  if (startCheckoutReply && checkoutWizards[sid]) {
    replyText = startCheckoutReply;
  }

  // Real bug (live test, non-reproducible on retry but confirmed via direct
  // DB check — no order existed): the model can free-text a completely
  // convincing "your order is confirmed, number MON-xxxxx" reply without
  // ever going through create_order — the only path that actually creates a
  // real order is create_order / the web formSubmit branch above.
  // Non-web channels normally use sendCheckoutLink — any order claim without
  // a real create_order this turn is fabricated.
  if (!orderJustCreated && /(MON-[\dA-Za-z]{3,}|اتسجل\s*(طلبك|أوردرك)|تم\s*تسجيل.*(الطلب|الأوردر|طلبك|أوردرك))/i.test(replyText)) {
    console.error('[DIAG fabricated-order-claim]', JSON.stringify({ sid, replyText }));
    replyText = 'تمام يا فندم، بس عايزة أتأكد قبل ما أسجل: البيانات اللي بعتيها صح كده؟ ✅';
  }

  // Never let invented prices/offers reach the customer — fall back to code facts.
  if (looksLikeInventedCatalog(replyText)) {
    console.error('[DIAG invented-catalog]', JSON.stringify({
      sid,
      msg: String(message || '').slice(0, 120),
      reply: String(replyText).slice(0, 200),
    }));
    replyText = await smartGeminiFallback(message, sid, chatHistory, '', selectedBundleKey);
  }

  return finish({ reply: replyText, sessionId: sid });
}

// Used by complete-order.html to show what's actually in a customer's cart
// before she fills in her delivery info — same real cart create_order will
// use, read straight from persistence (no live model turn needed).
async function getCartForSid(sid) {
  const stored = await loadSession(sid);
  const cart = Array.isArray(stored.cart) ? stored.cart : [];
  const subtotal = cart.reduce((s, i) => s + i.price * i.qty, 0);
  return { cart, subtotal, freeShipping: cartGetsFreeShipping(cart) };
}

async function getOrderForSid(sid) {
  if (!sid) return null;

  // A non-empty cart means the customer is building a NEW order — never
  // surface a previous one, or the checkout page shows a stale "confirmed"
  // screen instead of the form.
  const stored = await loadSession(sid);
  if (Array.isArray(stored.cart) && stored.cart.length) return null;

  const client = sbService || sb;
  const { data, error } = await client.from('orders')
    .select('order_number, status, total, deposit_amount, customer_phone, created_at')
    .eq('chat_session_id', sid)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) {
    console.error('[DIAG getOrderForSid]', error.message);
    return null;
  }
  return data || null;
}

module.exports = {
  // Exported for scripts/test-ask-before-listing.js — the owner's rule that
  // the bot asks what she wants before quoting anything is a property of these
  // replies, so the test reads them directly rather than replaying a chat.
  askWhatSheNeedsReply,
  whichOfferPriceAskReply,
  imageOffersReply,
  routinesWelcomeReply,
  emptyCartOfferRoutinesReply,
  handleInboundMessage,
  channelOf,
  chatSessions,
  sessionCarts,
  getCartForSid,
  getOrderForSid,
  getPointsBalance,
  pauseBotForSession,
  resumeBotForSession,
  // Intent-first helpers (smoke / unit tests)
  regexFallbackIntent,
  resolveEffectiveIntent,
  mergeCheckoutSeed,
  cartGetsFreeShipping,
  cartProductCount,
  parseVolunteeredDeliveryDetails,
  looksLikeVolunteeredDeliveryDetails,
  isUsableDeliveryAddress,
  harvestSeedFromHistory,
  namesSkinCondition,
  skinConditionReply,
  formatRoutineUsageReply,
  isUsageHowToAsk,
  isIngredientsOrDetailsQuestion,
  resolveFaqIntent,
  isPregnancyQuestion,
  deniesDoingLaser,
  laserDeniedAskConcernReply,
  isDarkAreaBrighteningAsk,
  darkAreaBrighteningReply,
  isLighteningDegreeQuestion,
  lighteningDegreeReply,
  enforceBriefReply,
  applyShipFrom3NoteOnce,
  mentionsShipFrom3,
  isDepositCallInquiry,
  botAskedForCallerNumber,
  askCallerNumberReply,
  callerNumberVerdictReply,
  isMetaPlatformNoiseMessage,
  stripDeliveryFieldLabels,
  looksLikePersonName,
  isExplicitCheckoutIntent,
  isDiscountHaggleAsk,
  isWalkAwayDecline,
  isWhiteningEffectAsk,
  isSoftDisagreement,
  resolveWhiteningAskProductKey,
  formatWhiteningEffectReply,
};

/** Persist pause without running a full chat turn (used by Meta echo handler). */
async function pauseBotForSession(sid, channel) {
  if (!sid) return;
  const stored = await loadSession(sid);
  const history = stampBotPaused(stored.history || []);
  await saveSession(sid, {
    cart: stored.cart || [],
    history,
    customerPhone: stored.customerPhone,
    customerName: stored.customerName,
    checkoutWizard: stored.checkoutWizard,
    orderWizard: stored.orderWizard,
    chatChannel: channel || undefined,
  });
}

async function resumeBotForSession(sid, channel) {
  if (!sid) return;
  const stored = await loadSession(sid);
  const history = stripPauseMarkers(stored.history || []);
  await saveSession(sid, {
    cart: stored.cart || [],
    history,
    customerPhone: stored.customerPhone,
    customerName: stored.customerName,
    checkoutWizard: stored.checkoutWizard,
    orderWizard: stored.orderWizard,
    chatChannel: channel || undefined,
  });
}
