// Shared chatbot "brain" — used by the website's /api/chat AND by the
// WhatsApp/Messenger/Instagram webhooks (api/whatsapp-webhook.js etc).
// Moved out of api/chat.js verbatim (logic unchanged) so every channel
// shares the exact same tools/cart/order-creation code instead of
// forking it per platform.
const { GoogleGenerativeAI, SchemaType } = require('@google/generative-ai');
const { createClient } = require('@supabase/supabase-js');
const { loadSession, saveSession, appendHistory, historyToGemini, normalizePhone } = require('./chatSessionStore');
const { tryOrderManageWizard } = require('./orderManage');
const {
  tryOrderContextReply,
  isProductAddConfirmation,
  wasAskingToAddToCart,
  lastModelMessage,
  resolveProductMentions,
} = require('./orderContext');
const { classifyIntent } = require('./intentClassifier');

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

const SYSTEM_PROMPT = `أنتِ مساعدة مونتانيا الذكية لخدمة العملاء والمبيعات. اسم البراند "مونتانيا" بالعربي دايمًا، ممنوع تكتبيه بحروف إنجليزي خالص (حتى لو جالك مكتوب كده في سؤال العميل) — عشان خلط حروف إنجليزي جوه جملة عربي بيبوّظ اتجاه الكتابة على شاشة العميل. بنت مصرية ودودة ومحترفة. قاعدة عامة: نوّعي صياغتك دايمًا، ردي على كلام العميل الفعلي مش قالب جاهز، وخليكي مختصرة.

## الشخصية:
- ردي بنفس لغة **آخر رسالة** بالكامل (عربي مصري أو إنجليزي)، من غير خلط. اسم المنتج ممكن يفضل عربي، بس الوصف حواليه لازم يتترجم كامل لو الرد إنجليزي (متنسخيش description العربي زي ما هو).
- نداء "يا فندم" بس بالعربي (مش حبيبتي/يا قمر)؛ بالإنجليزي من غير نداء رسمي.
- رد قصير ومباشر، إيموجي خفيف 😊💜، السعر "جنيه" بس من غير "مصري".
- "أهلاً" لأول رسالة في المحادثة بس، وبعدها **في نفس الرد** جاوبي على سؤاله فورًا — الترحيب ممنوع يبقى الرد الوحيد أو يأجل الإجابة. لو أول رسالة فيها سؤال (سعر/منتج/أي حاجة)، رحّبي وجاوبي مع بعض. بعد أول رسالة، ادخلي في الموضوع على طول من غير ترحيب متكرر.
- لو رسالة العميل فيها **أكتر من سؤال أو طلب في نفس الوقت** (شائع جدًا — العميل بيكتب كل حاجته في رسالة واحدة)، جاوبي على كل جزء منها بالترتيب، متسيبيش أي جزء من غير رد حتى لو مركّز على الجزء التاني.

## تسمية مهمة:
ممنوع كلمة "سلة" خالص في أي رد للعميل — اسميها دايمًا "**الأوردر**" أو "أوردرك" (زي "أضفته لأوردرك"، "أوردرك فيه كذا"). كلمة "سلة" دي لغة داخلية في الكود بس (أسماء الأدوات زي add_to_cart)، مش لغة تتقال للعميل.

## الأسعار والمنتجات (حرج):
- ممنوع تقولي سعر/اسم منتج من دماغك — استخدمي list_products فورًا أول أي رد عن منتج/سعر.
- نفس القاعدة على سعر الشحن: ممنوع تقولي سعر شحن محافظة من دماغك أو من ردّ سابق في نفس المحادثة — استخدمي list_governorates فورًا في كل مرة حد يسأل عن سعر توصيل/شحن محافظة معينة، حتى لو سألتِ نفس المحافظة قبل كده في نفس الشات.
- stock=0: ممنوع تضيفيه للأوردر، اعتذري واقترحي بديل متاح. stock رقم داخلي بس (مش للعميل خالص) — ممنوع تمامًا تقولي للعميل عدد القطع المتاحة بالظبط ("متوفر عندنا 95 قطعة")، لو سأل عن التوفر ردي بس "متوفر ✅" أو "غير متوفر حاليًا" من غير رقم.
- **مهم**: القاعدة دي مش بس وقت الإضافة — أي منتج بstock=0 يتذكر في ردك لأي سبب (ترشيح، مقارنة، إجابة عن سؤال عام)، لازم تقولي فورًا إنه "غير متوفر حاليًا" وقت ما تذكريه، مش توصفي مميزاته وكأنه متاح.
- منتج مش موجود بالظبط بس فيه بديل قريب؟ اقترحيه على طول من غير "معندناش منتج اسمه كذا".
- سؤال عناية بشرة عام؟ فرصة بيع — اشرحي بمكونات حقيقية من ingredients ورشحي منتج، من غير "مش متخصصة".
- سؤال سعر عام/غامض ("بكام؟"، "hm")؟ ابعتي كل الأسعار. سؤال عن منتج محدد؟ سعره + باقي المنتجات كفرصة بيع إضافي.
- أكتر من منتج في رد واحد = كل منتج فقرة لوحده + سطر فاضي بينهم، بالشكل ده بالظبط:
**اسم المنتج**
• سعره/وصفه المختصر
(سطر فاضي)
**اسم المنتج التاني**
• سعره/وصفه المختصر
- old_price أعلى من price = عرض حقيقي، اذكريه. ممنوع "معندناش عروض" لو فيه old_price فعلي.
- طلب صور المنتجات؟ قولي إن الصور موجودة على الموقع وابعتيلها اللينك: www.montana.com.eg — ممنوع تدّعي إنك بعتِ صورة فعلية جوه الشات.
- سؤال عن ريفيوهات/تقييمات منتج؟ ممنوع تذكري رقم rating أو review_count خالص — ابعتيلها بس لينك صفحة المنتج المباشر (montana.com.eg/product/{slug}) عشان تقرا الريفيوهات الحقيقية بنفسها. ممنوع تمامًا تختلقي ريفيو أو تقتبسي كلام عميلة مش موجود فعليًا في البيانات.

## عميل قديم:
لو ظهرت ملاحظة "جلسة سابقة" ومعاها منتجات قديمة، استخدميها طبيعي في مكانها المناسب (مش بالقوة كل رد) — زي تسأليه عن تجربته مع المنتج القديم.

## البيع (حفّزي، ومتحطيش ضغط):
- ابدأي بمشكلة العميل، اربطيها بفايدة حقيقية من description (مش سرد مكونات). اذكري مدة/نتيجة لو موجودة في البيانات. ممنوع اختلاق ميزة أو إلحاح كاذب ("كمية محدودة").
- سؤال التشخيص (نوع بشرتك/مشكلتك إيه) بس لما الطلب **فئة عامة غامضة حقيقي** زي "عايزة غسول" (وفيها أكتر من منتج بغرض مختلف) أو كلام عام زي "عايزة حاجة تنفع". **لو سمّى اسم منتج بعينه بالظبط، أو حدد مشكلة بشرة واضحة (زي "تصبغات"، "حب شباب"، "ندبات") وفيها منتج واحد واضح ليها في list_products** — ممنوع تسأليه أي سؤال تشخيصي زيادة، رشحي المنتج المناسب وابدأي الإقفال على طول لأنه حدد اللي محتاجه فعلاً.
- شك في الفعالية/تردد؟ اربطي بمكون حقيقي بيعالج مشكلته + سياسة الاسترجاع 14 يوم لو لسه مقفول (مفيش مخاطرة يجرب).
- "غالي"/"هفكر"؟ اسأليه إيه اللي محتاج يطمن له (السعر؟ الفعالية؟ مقارنة؟) وردي بمنطق حقيقي مبني على مكوناته الحقيقية، مش تكرار السعر، ومن غير ما تذكري أي رقم rating/review_count. **بعد ما تطمنيه، اقفلي الرد بسؤال التسجيل تاني** ("تحبي أسجلك أوردر يا فندم؟") — الطمأنة من غير محاولة إغلاق فعلية بتسيب البيع معلّق من غير داعي.
- **خليكي محفّزة مش ملحّة**: بيعك الأساسي هو الإقناع بالفايدة الحقيقية، مش سؤال بعد كل رد. لما ترشحي منتج أول مرة، اسأليه **مرة واحدة بس** في المحادثة كلها: "تحبي أسجلك أوردر يا فندم؟" (مش "تحبي تضيفيه؟" ولا أي صيغة تانية بتلمّح إنك إنتِ اللي هتضيفي/هتسجلي من غير ما يطلب). بعد المرة دي، لو العميل بيسأل أسئلة متابعة (استخدام/مكونات/مقارنة)، جاوبي وخلاص من غير أي سؤال تسجيل تاني — سيبيه هو اللي يطلب التسجيل بنفسه لما يكون جاهز.
- عميل غضبان/شكوى (طلب متأخر، منتج مش زي المتوقع)؟ وقفي البيع، اعتذري واسأليه التفاصيل، ولا ترشحي حاجة لحد ما تتحل. وخففي الإيموجي والحماس في الصياغة وقت كده (رد هادي ومباشر، من غير 😊💜 زي العادي) — نفس الحماس ده وقت شكوى بيتقرا استهتار مش ود.
- بعد add_to_cart ناجح، اقترحي مكمل منطقي **مرة واحدة بس** (لو موجود، مش عشوائي، ومش لو أصلاً في الأوردر): غسول التفتيح↔كريم التفتيح، غسول حب الشباب→غسول التفتيح، أي منتج وجه→لوشن الجسم.
- لو العميل رفض العرض الإضافي ده ("لا شكرا"، "مش دلوقتي") والأوردر لسه فيه منتج، ماتوقفيش عند "العفو" بس — اسأليه **مرة واحدة**: "تحبي نكمل الأوردر يا فندم؟" (زي قاعدة 5 تحت بالظبط، نفس المنطق).

## إتمام الأوردر (فيه أوردر حقيقي بيتسجل في السيستم، استخدميه):
1. طلب صريح فيه اسم منتج محدد بالظبط + فعل مباشر ("ضيفي X"، "عايزة X") = list_products (لو لسه معملتيهاش) + add_to_cart **فورًا من غير أي سؤال قبلها** — الأمر واضح وصريح، مفيش داعي تسألي عن نوع بشرة أو مشكلة. سؤال التشخيص بس لما الطلب فئة عامة (زي "عايزة غسول" من غير اسم محدد).
2. remove_from_cart بس لو **قبل** إتمام الطلب. طلب اتسجل فعلاً (رقم MON-xxxxx) = ممنوع remove، قوليله يحتاج رقم موبايله للتعديل/الإلغاء.
3. عايز يكمل شراء صراحة ("نكمل الطلب"، "جاهز") = view_cart + show_checkout_form.
4. "اوك"/"تمام" بعد "تحبي أسجلك أوردر يا فندم؟" = موافقة على إضافة بس، مش شراء نهائي — add_to_cart، ممنوع show_checkout_form.
5. "شكراً"/"تسلم" والأوردر فيه حاجة = اسألي "تحبي نكمل الأوردر ولا حاجة تانية؟" بدل ما تفتحي الفورم فورًا — مرة واحدة بس، مش كل رد بعد كده.
6. اتعمل أوردر قبل كده في نفس المحادثة وعايز يطلب تاني = لازم تأكيد صريح قبل show_checkout_form تاني.
7. "طلبت إيه؟" = من رقم MON-xxxxx الحقيقي بس، مش من دماغك. الأوردر (اللي كان فيه منتجات مختارة) بيفضى بعد التأكيد وده طبيعي.
8. **ممنوع** تختمي كل رد بـ"تحبي نكمل الأوردر؟" أو تكرري ملخصه — بس عند قاعدة 5 أو أول مرة بعد إضافة. أسئلة عادية عن المنتج (استخدام/مكونات/حجم) وهو حاطط حاجة في أوردره = جاوبي بس من غير ما تلحقيها بسؤال الإتمام أو تعيدي الملخص.
9. "هبلغكم"/"هشوف وارجعلك" = رحبي بلطف إنك موجودة، من غير ما تعيدي ملخص الأوردر أو "تحبي نكمل؟" تاني.

## برنامج نقاط مونتانيا:
برنامج مكافآت مجاني، العميلة تكسب فيه نقاط مع كل عملية شراء (نقطة لكل 10 ج.م)، وتقدر تستبدل النقاط بخصومات (كل 10 نقاط = 1 ج.م خصم) وهدايا وشحن مجاني. النقاط مربوطة برقم موبايل العميلة. لو سألت عن رصيدها، استخدمي get_points_balance برقم موبايلها (اسأليها عنه لو مش معروف من كلامها قبل كده) وردي بالرقم الحقيقي اللي رجع، مش من دماغك.

## إلغاء/تعديل طلب سابق:
اطلبي رقم الموبايل المسجل بيه الطلب (من غيره مفيش إلغاء/تعديل). الإلغاء قبل الشحن بس، التعديل = عنوان/محافظة. لو بدأ الـwizard سيبيه يكمل.

## بيانات التوصيل (الاسم/العنوان/الموبايل/المحافظة):
البيانات دي مش شغلتك خالص في أي قناة. عايز يكمل الشراء (قاعدة 3 فوق)؟ استخدمي show_checkout_form زي ما هي — النظام لوحده بيقرر يفتح فورم حقيقي (لو الموقع) أو يبعت لينك متجر مونتانيا الحقيقي (لو أي قناة تانية)، وبيتجمعوا فيه بياناتها وترفع صورة الإيصال. ممنوع تمامًا تقولي "هفتح لك الفورم" أو "هبعتلك لينك" بالكلام من غير ما تستخدمي أداة فعليًا — أي ادّعاء بإرسال فورم/لينك لازم يكون نتيجة استخدام حقيقي لأداة، مش جملة من عندك. وممنوع تمامًا تدّعي إن أوردر اتسجل أو تختلقي رقم أوردر — التسجيل الحقيقي بيحصل بس لما هي تكمل بياناتها في الفورم/اللينك بنفسها.

## سياسات المتجر (لو سأل تحديدًا):
توصيل 2-3 أيام (شحن يختلف حسب المحافظة)، إرجاع خلال 14 يوم، دفع: مقدّم 200 ج.م + الباقي كاش أو تحويل كامل مع إيصال.
متوفرين في صيدليات (حسب المنطقة — لو العميلة قالت منطقتها، رشحيلها صيدليات منها بالتحديد):
• 6 أكتوبر: ابوعلي، احمد يحيي، مصر، اسامة، وهبي، احمد نبوي
• فيصل: آل عمران، البيه، علي، اميرة، الاسعاف، العساف، فاميلي، حواس، العريش، غادة، نوران، سفنكس فارمازون، الوليد، التعاونية، بيشوي صافي، عبد الرحمن السايس، medicine
• القاهرة: الفيروز، لطيف، نور المحمدي، مستشفى الرحاب، الزغبي، المنيلاوي، مبروك، محجبوب، زهرة السلام، دياسطي، احمد مختار، برسوم، القماح، خالد سمير`;

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
  return normalizeBulletLists(text)
    .replace(/يا\s+قمر\S*/g, 'يا فندم')
    .replace(/يا\s+حبيبتي/g, 'يا فندم')
    .replace(/حبيبتي/g, 'فندم');
}

// Matches the "تحبي أسجلك أوردر/تضيفيه/أضيفهم/نكمل الأوردر؟" nudge in any phrasing.
const CTA_NUDGE_RE = /[.\n]?\s*تحبي[^.؟!\n]{0,12}(تضيف|أضيف|اضيف|نكمل|سجل)[^.؟!\n]{0,45}[؟?]\s*[😊💜🛒]*\s*$/u;

// Matches a customer objection/hesitation ("غالي"، "هفكر"...) — see
// stripRepeatedCta below.
const OBJECTION_RE = /(غالي|غاليه|هفكر|هافكر|هفكرها|مش متأكد|مش متاكد|مش حاسة|مش قادرة|مش قادر|too expensive|think about it)/i;

// Safety net: rewriting this prompt rule several times ("only ask once")
// never fully stopped the model from re-asking "تحبي تضيفيه لأوردرك؟" after
// almost every reply — trusting the model's own restraint here proved
// unreliable in real conversations. Enforce it deterministically instead:
// scan this session's own history (not the model's memory of its own
// rules) for a prior occurrence, and strip the nudge if it already fired.
//
// Exception: if the customer raised an objection ("غالي"/"هفكر") *after*
// that prior nudge, this new one is a fresh close attempt following the
// bot's answer to that objection — not a repeat of the same ask — so it's
// allowed through. Blanket-suppressing here would silence the bot at
// exactly the moment right after resolving a doubt, which is the most
// natural point to actually ask for the close.
function stripRepeatedCta(replyText, chatHistory) {
  if (!CTA_NUDGE_RE.test(replyText)) return replyText;
  const history = chatHistory || [];
  let lastCtaIdx = -1;
  for (let i = history.length - 1; i >= 0; i--) {
    if (history[i]?.role === 'model' && CTA_NUDGE_RE.test(history[i].text || '')) {
      lastCtaIdx = i;
      break;
    }
  }
  if (lastCtaIdx === -1) return replyText;
  const objectionSince = history
    .slice(lastCtaIdx + 1)
    .some((h) => h.role === 'user' && OBJECTION_RE.test(h.text || ''));
  if (objectionSince) return replyText;
  return replyText.replace(CTA_NUDGE_RE, '').trim();
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
      description: 'يرجع قائمة المنتجات الحقيقية والحالية بأسعارها من قاعدة البيانات. استخدميها دايمًا قبل ذكر أي سعر أو اسم منتج.',
      parameters: { type: SchemaType.OBJECT, properties: {} }
    },
    {
      name: 'list_governorates',
      description: 'يرجع أسماء كل المحافظات المتاحة للشحن مع سعر الشحن لكل واحدة.',
      parameters: { type: SchemaType.OBJECT, properties: {} }
    },
    {
      name: 'add_to_cart',
      description: 'يضيف منتج للسلة الحقيقية (أو يحدّث الكمية لو موجود بالفعل). استخدميها فورًا أول ما العميل يذكر منتج عايزه.',
      parameters: {
        type: SchemaType.OBJECT,
        properties: {
          product_id: { type: SchemaType.NUMBER, description: 'رقم المنتج من list_products' },
          qty: { type: SchemaType.NUMBER, description: 'الكمية المطلوبة' }
        },
        required: ['product_id', 'qty']
      }
    },
    {
      name: 'remove_from_cart',
      description: 'يشيل منتج من السلة.',
      parameters: {
        type: SchemaType.OBJECT,
        properties: { product_id: { type: SchemaType.NUMBER } },
        required: ['product_id']
      }
    },
    {
      name: 'view_cart',
      description: 'يرجع محتوى السلة الحالي بالتفصيل (أسماء حقيقية وأسعار وكميات وإجمالي). استخدميها قبل show_checkout_form عشان تأكدي للعميل الطلب.',
      parameters: { type: SchemaType.OBJECT, properties: {} }
    },
    {
      name: 'show_checkout_form',
      description: 'تفتح فورم حقيقي على الموقع ياخد فيه العميل بياناته (اسم/موبايل/عنوان/محافظة) ويأكد الطلب بنفسه. استخدميها بس لو القناة هي الموقع — لو مش الموقع، النظام بيبعت لينك المتجر تلقائيًا من غير ما تعملي حاجة إنتِ.',
      parameters: { type: SchemaType.OBJECT, properties: {} }
    },
    {
      name: 'get_points_balance',
      description: 'يرجع رصيد نقاط برنامج المكافآت الحقيقي لعميلة معينة برقم موبايلها. استخدميها لو سألت عن رصيد نقاطها — لو رقمها مش معروف من كلامها في المحادثة، اسأليها عنه الأول.',
      parameters: {
        type: SchemaType.OBJECT,
        properties: { phone: { type: SchemaType.STRING, description: 'رقم موبايل العميلة (11 رقم يبدأ بـ 01)' } },
        required: ['phone']
      }
    }
  ]
}];

async function list_products() {
  const { data, error } = await sb.from('products')
    .select('id, name, price, old_price, size, slug, description, ingredients, skin_type, stock, rating, review_count')
    .eq('is_active', true)
    .order('sort_order');
  if (error) return { error: error.message };
  return { products: data };
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
  const { data: p, error } = await sb.from('products').select('id, name, price, image_url, stock').eq('id', productId).single();
  if (error || !p) return { error: 'منتج غير معروف — استخدمي list_products عشان تاخدي id صحيح' };
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

function view_cart(sid) {
  const cart = sessionCarts[sid] || [];
  const subtotal = cart.reduce((s, i) => s + i.price * i.qty, 0);
  return { cart: cart.map(i => ({ id: i.id, name: i.name, price: i.price, qty: i.qty })), subtotal };
}

async function create_order(args, sid, channel) {
  const { name, phone, address, governorate } = args;
  const cart = sessionCarts[sid] || [];
  if (!name || !phone || !address || !governorate) {
    return { error: 'بيانات ناقصة — لازم الاسم والموبايل والعنوان والمحافظة' };
  }
  if (!cart.length) {
    return { error: 'الأوردر فاضي — ارجعي للشات وضيفي منتج الأول' };
  }

  // Re-fetch every price/name from the real table by id right before
  // committing the order — never trust cached values, even our own
  // server-side cart's, in case a product changed since it was added.
  const ids = cart.map(i => i.id);
  const { data: products, error: pErr } = await sb.from('products').select('id, name, price, image_url').in('id', ids);
  if (pErr || !products || !products.length) return { error: 'تعذّر التحقق من المنتجات' };

  const orderItems = [];
  let subtotal = 0;
  for (const it of cart) {
    const p = products.find(x => x.id === it.id);
    if (!p) return { error: `منتج غير معروف: ${it.id}` };
    orderItems.push({ id: p.id, name: p.name, image: p.image_url, price: p.price, qty: it.qty });
    subtotal += p.price * it.qty;
  }

  const { data: govMatch } = await sb.from('shipping_rates')
    .select('governorate, cost')
    .ilike('governorate', `%${governorate}%`)
    .eq('is_active', true)
    .limit(1)
    .single();
  if (!govMatch) return { error: 'المحافظة دي مش متاحة، لازم تستخدمي list_governorates وتختاري اسم من القائمة بالظبط' };

  const shipping = govMatch.cost;
  const total = subtotal + shipping;
  const deposit = 200;

  const { data: order, error: oErr } = await sb.rpc('create_guest_order', {
    p_customer: { name, phone, address, city: govMatch.governorate },
    p_items: orderItems,
    p_payment_method: 'cod',
    p_delivery_method: 'standard',
    p_subtotal: subtotal,
    p_shipping_cost: shipping,
    p_discount: 0,
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

  return {
    order_number: order?.order?.order_number || order?.order_number,
    phone,
    customer_name: name,
    total,
    deposit_amount: deposit,
    transfer_number: transferNumber,
    transfer_name: transferName
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
  'غسول علاج حب الشباب للوجه': 'غسول التفتيح',
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
  const t = String(message || '').trim();
  if (!t || t.length > 40) return false;
  return /^(بكام|كام|كام\s*ده|كام\s*السعر|السعر\s*كام|الاسعار\s*كام|ايه\s*الاسعار|سعر(ه|ها|هم)?\s*(كام|إيه|ايه)|كام\s*سعر(ه|ها|هم)?|how\s*much|price\??)[؟?!.\s]*$/i.test(t);
}

// Real bug (live customer transcript): a customer named two products in one
// message ("بسأل عن كريم الليزر وكريم التصبغات"), then asked "سعرهم كام؟" in
// her next message — a plain pronoun referring back to what she'd just
// named. The model ignored her prior message entirely and asked "which
// product exactly?", even though she'd already answered that. Rather than
// hope a prompt rule makes the model check its own history reliably (it
// already has one for the "first message" case and still doesn't always
// follow it — see productListFallbackReply above), resolve this
// deterministically: match named products in her current message first,
// fall back to her immediately preceding message if this one is a bare
// pronoun, and only show the full price list if neither names anything.
async function tryPriceQuestion(message, sid, chatHistory) {
  if (!isPriceQuestion(message)) return null;

  const { data: products, error } = await sb.from('products')
    .select('id, name, price, old_price, slug, rating, review_count, stock')
    .eq('is_active', true);
  if (error || !products || !products.length) return null;

  let matched = resolveProductMentions(message, products);

  if (!matched.length) {
    for (let i = (chatHistory || []).length - 1; i >= 0; i--) {
      if (chatHistory[i]?.role !== 'user') continue;
      matched = resolveProductMentions(chatHistory[i].text || '', products);
      break; // only the immediately preceding customer message counts
    }
  }

  if (matched.length) {
    const lines = matched.map((p) => {
      const offer = p.old_price && p.old_price > p.price
        ? `سعره حاليًا ${Math.round(p.price)} جنيه بدلًا من ${Math.round(p.old_price)} جنيه (عرض لفترة محدودة!)`
        : `سعره ${Math.round(p.price)} جنيه`;
      const avail = (p.stock ?? 0) <= 0 ? '\nغير متوفر حاليًا 😔' : '';
      return `**${p.name}**\n• ${offer}${avail}`;
    });
    return {
      reply: `${lines.join('\n\n')}\n\nتحبي أضيفه لأوردرك يا فندم؟ 💜`,
      sessionId: sid,
    };
  }

  const greet = (chatHistory || []).length === 0 ? 'أهلاً بيكي يا فندم 😊 ' : '';
  return { reply: await productListFallbackReply(greet), sessionId: sid };
}

// Real bug (live customer transcript): "عندي تصبغات في وشي عايزة حاجة
// تفيد" names one specific, unambiguous skin concern that maps to exactly
// one real product (كريم التفتيح) — yet the model still asked "نوع بشرتك
// إيه؟" instead of recommending it directly, even after the prompt was
// tightened to say diagnostic questions are only for genuinely vague asks.
// Tightening the prompt text alone didn't reliably fix it (verified live —
// same lesson as the price questions above), so ground this deterministically
// using the same PRODUCT_ALIAS_RULES: when exactly one real product matches
// what she said and it isn't already in her cart, inject a system note into
// this turn only (never persisted to chatHistory, never sent on any other
// turn) telling the model plainly which product this maps to.
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

function isExplicitCheckoutIntent(message) {
  const t = message.trim();
  return /(نكمل|نكمّل|كمل(ي|و)?\s*(ال)?(طلب|اوردر|أورder|order)?|اكمل(ي|و)?|اعمل(ي|و)?\s*(ال)?(اوردر|أورder|طلب|order)|جاهز(ة)?(\s*(لل)?(ال)?(دفع|الشراء|التاكيد|الطلب))?|نفذ(ي|و)?\s*(ال)?(طلب|اورder)|place\s*(the\s*)?order|checkout|نعم\s*(نكمل|كملي|كمّلي)|أ?[iي]و[ae]\s*(نكمل|كملي|تمام))/i.test(t);
}

function isCheckoutConfirmYes(message) {
  const t = message.trim();
  return isExplicitCheckoutIntent(t)
    || /^(نعم|أ?[iي]و[ae]|yes|yeah|yep|كمل(ي|و)?|نكمل|اكمل(ي|و)?|نفذ(ي|و)?|جاهز(ة)?|تمام\s*(نكمل|كملي|نفذ)|ماشي\s*(نكمل|كملي))[\s!.،؟?]*$/i.test(t);
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
  const { cart, subtotal } = view_cart(sid);
  if (!cart.length) return '';
  const lines = cart.map(i => `• ${i.name} × ${i.qty} — ${Math.round(i.price * i.qty)} ج.م`);
  return `${lines.join('\n')}\n\n*الإجمالي:* ${Math.round(subtotal)} ج.م (قبل الشحن)`;
}

function maybeNudgeCheckoutOnThanks(message, sid) {
  const cart = sessionCarts[sid] || [];
  if (!cart.length) return null;

  if (isExplicitCheckoutIntent(message)) {
    const summary = formatCartSummary(sid);
    if (channelOf(sid) === 'web') {
      return {
        reply: `تمام يا فندم 💜\n\n${summary}\n\nهفتحلك الفورم دلوقتي — املي بياناتك 👇`,
        sessionId: sid,
        showOrderForm: show_checkout_form(sid),
      };
    }
    return sendCheckoutLink(sid);
  }

  if (!isThanksOrReadyToCheckout(message)) return null;

  const summary = formatCartSummary(sid);
  return {
    reply: `العفو يا فندم 💜\n\n${summary}\n\nتحبي **نكمل الطلب دلوقتي** 🛒 ولا **تضيف حاجة تانية**؟`,
    sessionId: sid,
    awaitConfirm: true,
  };
}

async function tryAdvanceCheckoutConfirm(sid, message) {
  const wiz = checkoutWizards[sid];
  if (!wiz || wiz.step !== 'await_confirm') return null;

  const cart = sessionCarts[sid] || [];
  if (!cart.length) {
    delete checkoutWizards[sid];
    return { reply: 'الأوردر فاضي دلوقتي — قوليلي تحبي تطلبي إيه 💜', sessionId: sid, clearConfirm: true };
  }

  if (isCheckoutConfirmYes(message)) {
    delete checkoutWizards[sid];
    const summary = formatCartSummary(sid);
    if (channelOf(sid) === 'web') {
      return {
        reply: `تمام! 👇 املي بيانات التوصيل\n\n${summary}`,
        sessionId: sid,
        showOrderForm: show_checkout_form(sid),
        clearConfirm: true,
      };
    }
    return { ...sendCheckoutLink(sid), clearConfirm: true };
  }

  if (isCheckoutConfirmNo(message)) {
    delete checkoutWizards[sid];
    return {
      reply: 'تمام يا فندم 💜 قولّي تحب تضيف إيه في أوردرك',
      sessionId: sid,
      clearConfirm: true,
    };
  }

  // Anything else (a price question, a new product, "تفاصيل"...) isn't a
  // yes/no answer to "do you want to check out?" — forcing the cart
  // summary back at the customer here used to bury real questions like
  // "بكام؟" under an unrelated re-ask (and that re-ask text could itself
  // get silently stripped by stripRepeatedCta if a similar nudge already
  // fired earlier, making it look like the bot ignored the customer
  // entirely). Drop the pending confirm and let the real message reach
  // the model instead.
  logUnmatchedIntent('checkout_confirm', sid, message);
  delete checkoutWizards[sid];
  return null;
}

async function runFunctionCall(name, args, sid) {
  if (name === 'list_products') return list_products();
  if (name === 'list_governorates') return list_governorates();
  if (name === 'add_to_cart') return add_to_cart(args, sid);
  if (name === 'remove_from_cart') return remove_from_cart(args, sid);
  if (name === 'view_cart') return view_cart(sid);
  if (name === 'show_checkout_form') return show_checkout_form(sid);
  if (name === 'get_points_balance') {
    const points = await getPointsBalance(args?.phone);
    if (points === null) return { error: 'رقم الموبايل مش صحيح أو حصلت مشكلة — اسأليها تبعته تاني' };
    return { points };
  }
  return { error: 'unknown function' };
}

const SITE_URL = 'https://www.montana.com.eg';

// ─────────────────────────────────────────────────────────
// Non-web checkout hand-off (WhatsApp/Messenger/Instagram) — these channels
// have no HTML form to render, and collecting name/address/phone/governorate
// in plain chat (the old submit_checkout_info flow) turned out unreliable in
// real use (the model could stall in a loop re-asking the same question, or
// even fabricate a fake "order confirmed" reply with no real order behind
// it — see the fabricated-order-claim guard below). Sending the customer's
// own real cart, tied via her existing sid, straight to the site's own
// checkout form sidesteps all of that: the same real HTML form, validation,
// and receipt upload the website already uses. Deterministic and hardcoded
// (never model-generated), like every other "start of a consequential step"
// reply in this file.
// ─────────────────────────────────────────────────────────
function sendCheckoutLink(sid) {
  const url = `${SITE_URL}/complete-order.html?sid=${encodeURIComponent(sid)}`;
  return {
    reply: `تمام يا فندم 💜 هبعت لحضرتك لينك متجر مونتانيا لإتمام الطلب، هتلاقي المنتجات اللي اخترتيها جاهزة، تكمّلي بياناتك بسهولة، وكمان تستفيدي من برنامج نقاط مونتانيا 🎁:\n${url}`,
    sessionId: sid,
  };
}

// ─────────────────────────────────────────────────────────
// Main entry point — used by api/chat.js (web) and every webhook.
// ─────────────────────────────────────────────────────────
async function handleInboundMessage({ sid, message, formSubmit, channel }) {
  const stored = await loadSession(sid);
  sessionCarts[sid] = (stored.cart && stored.cart.length) ? stored.cart : (sessionCarts[sid] || []);
  if (stored.checkoutWizard) checkoutWizards[sid] = stored.checkoutWizard;
  let orderWizard = stored.orderWizard || null;
  let chatHistory = stored.history || [];
  let customerPhone = stored.customerPhone || null;
  let customerName = stored.customerName || null;

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
    await saveSession(sid, {
      cart: sessionCarts[sid] || [],
      history: chatHistory,
      customerPhone,
      customerName,
      checkoutWizard: checkoutWizards[sid] || null,
      orderWizard,
      chatChannel: channel || undefined,
    });
  };

  const finish = async (payload, userMsg = message) => {
    if (payload?.reply) {
      payload.reply = sanitizeReply(payload.reply);
      payload.reply = stripRepeatedCta(payload.reply, chatHistory);
    }
    if (userMsg && payload?.reply) {
      chatHistory = appendHistory(chatHistory, userMsg, payload.reply.replace(/\*\*/g, ''));
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
      reply: `تمام يا فندم! ✅ اتسجل طلبك برقم **${order.order_number}**، والإجمالي ${Math.round(order.total)} جنيه (شامل مقدّم حجز ${Math.round(order.deposit_amount)} جنيه هيتخصم منه). حوّلي المقدّم على ${order.transfer_number} (${order.transfer_name}) وارفعي صورة الإيصال تحت وهنأكدلك الحجز على طول 💜`,
      sessionId: sid,
      awaitingProof: { order_number: order.order_number, phone: formSubmit.phone },
      order: {
        order_number: order.order_number,
        total: order.total,
        deposit_amount: order.deposit_amount,
        transfer_number: order.transfer_number,
        transfer_name: order.transfer_name,
      },
    });
  }

  if (!message) throw Object.assign(new Error('Message required'), { status: 400 });

  if (!genAI) {
    throw Object.assign(new Error('Chat service unavailable'), { status: 503 });
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
      if (confirmResult.clearConfirm) await persist({ checkoutWizard: null });
      return finish(confirmResult);
    }
    // tryAdvanceCheckoutConfirm bowed out (unmatched message) and already
    // cleared the in-memory wizard — persist that so the next message
    // (possibly on a different serverless instance) doesn't reload the
    // stale await_confirm state from storage and re-hijack it again.
    if (hadConfirm && !checkoutWizards[sid]) await persist({ checkoutWizard: null });
  }

  // Intent classifier: catch implicit purchase confirmations the regex
  // paths miss ("تمام", "تمم", "اوكيه", "ماشي", "ها", etc.) when the bot's
  // last message was offering to add a product. The regex-based
  // isProductAddConfirmation only matches a narrow set of exact spellings.
  const lastBot = lastModelMessage(chatHistory);
  const intent = await classifyIntent(message, lastBot);
  console.log('[DIAG intent]', JSON.stringify({ sid, message, intent }));

  if (intent === 'ADD_CONFIRM' && wasAskingToAddToCart(lastBot)) {
    const { data: products } = await sb.from('products')
      .select('id, name, price, image_url, stock')
      .eq('is_active', true);
    const mentioned = resolveProductMentions(lastBot || '', products || []);
    if (mentioned.length === 1 && (mentioned[0].stock ?? 0) > 0) {
      const p = mentioned[0];
      const cart = sessionCarts[sid] || (sessionCarts[sid] = []);
      if (!cart.find((i) => i.id === p.id)) {
        cart.push({ id: p.id, name: p.name, image: p.image_url, price: p.price, qty: 1 });
      }
      await persist({ cart: sessionCarts[sid] });
      return finish({
        reply: `تمام يا فندم 💜 أضفت **${p.name}** لأوردرك ✅`,
        sessionId: sid,
      });
    }
  }

  const explicitAddResult = await tryExplicitAddToCart(message, sid);
  if (explicitAddResult) {
    await persist({ cart: sessionCarts[sid] || [] });
    return finish(explicitAddResult);
  }

  const priceQuestionResult = await tryPriceQuestion(message, sid, chatHistory);
  if (priceQuestionResult) return finish(priceQuestionResult);

  const agents = ['لايان', 'نوران', 'نور'];
  const agentIndex = Math.floor(Date.now() / (2 * 60 * 60 * 1000)) % agents.length;
  const agentName = agents[agentIndex];

  if (!chatSessions[sid]) {
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
      systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
      tools,
      // The model's internal "thinking" step eats into the same output-
      // token budget as the visible reply, so a generous ceiling avoids an
      // empty final response on tool-calling turns.
      generationConfig: { maxOutputTokens: 16384 },
    });
    const pastProducts = customerPhone ? await getPastProducts(customerPhone) : [];
    const pastProductsNote = pastProducts.length ? ` — اشترى قبل كده: ${pastProducts.join('، ')}` : '';
    const memoryIntro = customerName
      ? [{ role: 'user', parts: [{ text: `(العميل ${customerName}${customerPhone ? ' — ' + customerPhone : ''} — جلسة سابقة${pastProductsNote})` }] },
         { role: 'model', parts: [{ text: pastProducts.length ? 'تمام، فاكرة العميل ومنتجاته اللي جربها قبل كده 💜' : 'تمام، فاكرة العميل 💜' }] }]
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
    const thanksNudge = maybeNudgeCheckoutOnThanks(message, sid);
    if (thanksNudge) {
      if (thanksNudge.awaitConfirm) {
        checkoutWizards[sid] = { step: 'await_confirm' };
        await persist({ checkoutWizard: checkoutWizards[sid] });
      }
      return finish(thanksNudge);
    }
  }

  const symptomNote = await buildSymptomNote(message, sid);
  const modelInputMessage = symptomNote ? `${message}\n\n${symptomNote}` : message;

  const chat = chatSessions[sid];
  let result, calls;
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
    console.error('[DIAG gemini-failed]', e.message);
    return finish({ reply: await productListFallbackReply('معلش يا فندم، حصل تأخير بسيط 🙏 '), sessionId: sid });
  }

  // Still nothing after retries — rather than leave the customer with an
  // empty non-answer, fall back to real product data directly.
  if (!calls?.length && !result.response.text()) {
    return finish({ reply: await productListFallbackReply('يا فندم، '), sessionId: sid });
  }

  let formTriggered = null;
  let awaitingProof = null;

  let guard = 0;
  while (calls && calls.length && guard < 10) {
    const responses = [];
    for (const call of calls) {
      const output = await runFunctionCall(call.name, call.args, sid);
      if (call.name === 'show_checkout_form') formTriggered = output;
      if (call.name === 'create_order' && output?.order_number && !output.error) {
        awaitingProof = {
          order_number: output.order_number,
          phone: output.phone || call.args?.phone || customerPhone,
          customer_name: output.customer_name || call.args?.name || customerName,
        };
      }
      responses.push({ functionResponse: { name: call.name, response: output } });
    }
    try {
      result = await chat.sendMessage(responses);
      calls = result.response.functionCalls();
    } catch (e) {
      console.error('[DIAG gemini-failed-followup]', e.message);
      return finish({ reply: await productListFallbackReply('معلش يا فندم، حصل تأخير بسيط 🙏 '), sessionId: sid });
    }
    guard++;
  }

  if (formTriggered) {
    if (!isExplicitCheckoutIntent(message) && !isCheckoutConfirmYes(message)) {
      checkoutWizards[sid] = { step: 'await_confirm' };
      await persist({ checkoutWizard: checkoutWizards[sid] });
      const summary = formatCartSummary(sid);
      // Never use the model's own free-form text here — no order exists
      // yet at this point (that's exactly what this branch means), and
      // the model has fabricated "order prepared, we'll call you soon"
      // -style claims in this exact spot before. Fixed, honest copy only.
      return finish({
        reply: `تمام يا فندم 💜\n\n${summary}\n\nتحبي **نكمل الطلب** 🛒 ولا **حاجة تانية**؟`,
        sessionId: sid,
      });
    }
    delete checkoutWizards[sid];
    await persist({ checkoutWizard: null });
    if (channelOf(sid) === 'web') {
      const replyText = result.response.text() || 'تمام يا فندم، ثواني وهرجعلك بكل التفاصيل 😊';
      return finish({ reply: replyText, sessionId: sid, showOrderForm: formTriggered });
    }
    return finish(sendCheckoutLink(sid));
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
  if (channelOf(sid) !== 'web' && /(هفتحلك|هبعتلك|بعتلك|فتحتلك|هارسلك|هرسلك)\s*(ال)?(فورم|لينك)/i.test(result.response.text() || '')) {
    return finish(sendCheckoutLink(sid));
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

  // Real bug (live test, non-reproducible on retry but confirmed via direct
  // DB check — no order existed): the model can free-text a completely
  // convincing "your order is confirmed, number MON-xxxxx" reply without
  // ever going through create_order — the only path that actually creates a
  // real order is the web formSubmit branch above, which sets
  // `awaitingProof`. Non-web channels never create an order in-chat at all
  // now (see sendCheckoutLink) — any order claim there is by definition
  // fabricated. If a reply claims an order was just registered but this turn
  // never actually produced one, never let it reach the customer as if a
  // real order/deposit now exists.
  if (!awaitingProof && /(MON-[\dA-Za-z]{3,}|اتسجل\s*(طلبك|أوردرك)|تم\s*تسجيل.*(الطلب|الأوردر|طلبك|أوردرك))/i.test(replyText)) {
    console.error('[DIAG fabricated-order-claim]', JSON.stringify({ sid, replyText }));
    replyText = 'تمام يا فندم، بس عايزة أتأكد قبل ما أسجل: البيانات اللي بعتيها صح كده؟ ✅';
  }

  return finish({ reply: replyText, sessionId: sid, awaitingProof: awaitingProof || undefined });
}

// Used by complete-order.html to show what's actually in a customer's cart
// before she fills in her delivery info — same real cart create_order will
// use, read straight from persistence (no live model turn needed).
async function getCartForSid(sid) {
  const stored = await loadSession(sid);
  const cart = Array.isArray(stored.cart) ? stored.cart : [];
  const subtotal = cart.reduce((s, i) => s + i.price * i.qty, 0);
  return { cart, subtotal };
}

module.exports = { handleInboundMessage, channelOf, chatSessions, sessionCarts, getCartForSid, getPointsBalance };
