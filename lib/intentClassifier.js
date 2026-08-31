const { completeJson } = require('./llm');

const VALID = new Set([
  'PRICE_ASK',
  'ROUTINE_OR_SET',
  'SELECT_OFFER',
  'PRODUCT_INTEREST',
  'ADD_CONFIRM',
  'CHECKOUT_READY',
  'CHOOSE_CHAT',
  'CHOOSE_SITE',
  'HOW_TO_ORDER',
  'POINTS_ASK',
  'DELIVERY_ETA',
  // FAQ — meaning-based; code answers with fixed facts (never re-pitch offers)
  'ASK_BENEFITS',
  'ASK_INGREDIENTS',
  'ASK_GUARANTEE',
  'ASK_RESULTS',
  'ASK_RETURN',
  'ASK_SUITABILITY',
  'ASK_USAGE',
  'PROVIDE_NAME',
  'PROVIDE_PHONE',
  'PROVIDE_ADDRESS',
  'PROVIDE_GOVERNORATE',
  'PROVIDE_FULL_DETAILS',
  'SEND_CHECKOUT_LINK', // alias → PROVIDE_FULL_DETAILS
  'CANCEL_MODIFY',
  'OTHER',
]);

const FAQ_INTENTS = new Set([
  'ASK_BENEFITS',
  'ASK_INGREDIENTS',
  'ASK_GUARANTEE',
  'ASK_RESULTS',
  'ASK_RETURN',
  'ASK_SUITABILITY',
  'ASK_USAGE',
]);

const OFFER_KEYS = new Set(['post-laser', 'brightening', 'face-body']);

const EMPTY = { intent: 'OTHER', products: [], slots: {} };

function normalizeOfferKey(raw) {
  const k = String(raw || '').toLowerCase().trim().replace(/_/g, '-');
  if (OFFER_KEYS.has(k)) return k;
  if (/(post|laser|ليزر)/i.test(k)) return 'post-laser';
  if (/(bright|white|تفتيح)/i.test(k)) return 'brightening';
  if (/(face|body|وش|جسم)/i.test(k)) return 'face-body';
  return null;
}

function normalizeSlots(parsed) {
  const slots = {};
  if (typeof parsed?.name === 'string' && parsed.name.trim()) {
    slots.name = parsed.name.trim().replace(/\s+/g, ' ').slice(0, 80);
  }
  if (typeof parsed?.phone === 'string' && parsed.phone.trim()) {
    slots.phone = parsed.phone.trim();
  }
  if (typeof parsed?.address === 'string' && parsed.address.trim()) {
    slots.address = parsed.address.trim().replace(/\s+/g, ' ').slice(0, 500);
  }
  if (typeof parsed?.governorate === 'string' && parsed.governorate.trim()) {
    slots.governorate = parsed.governorate.trim().slice(0, 60);
  }
  const offerKey = normalizeOfferKey(parsed?.offerKey || parsed?.offer_key);
  if (offerKey) slots.offerKey = offerKey;
  const idx = Number(parsed?.offerIndex ?? parsed?.offer_index);
  if (idx === 1 || idx === 2 || idx === 3) slots.offerIndex = idx;
  return slots;
}

/**
 * Classify customer intent (Claude primary → Gemini fallback via lib/llm).
 * Understand meaning despite typos / Franco / dialect — do NOT require exact phrases.
 */
async function classifyIntent(messageOrOpts, lastBotMessage, productNames) {
  let message;
  let lastBot;
  let names;
  let wizardStep = null;
  let cartHasItems = false;
  let selectedBundleKey = null;

  if (messageOrOpts && typeof messageOrOpts === 'object' && !Array.isArray(messageOrOpts)) {
    message = messageOrOpts.message;
    lastBot = messageOrOpts.lastBotMessage || '';
    names = Array.isArray(messageOrOpts.productNames) ? messageOrOpts.productNames : [];
    wizardStep = messageOrOpts.wizardStep || null;
    cartHasItems = !!messageOrOpts.cartHasItems;
    selectedBundleKey = messageOrOpts.selectedBundleKey || null;
  } else {
    message = messageOrOpts;
    lastBot = lastBotMessage || '';
    names = Array.isArray(productNames) ? productNames : [];
  }

  try {
    const productList = names.join('\n');
    const wizardHint = wizardStep
      ? `\nCheckout wizard step: "${wizardStep}". Cart has items: ${cartHasItems ? 'yes' : 'no'}.\n`
      : `\nCart has items: ${cartHasItems ? 'yes' : 'no'}.\n`;
    const bundleHint = selectedBundleKey
      ? `Active selected offer key: ${selectedBundleKey}.\n`
      : '';

    const system =
      'You classify Egyptian Arabic customer messages for Montana skincare sales chat.\n' +
      'Montana = FACE/BODY skincare ONLY. NO hair.\n\n' +
      'CRITICAL: Customers write freely — typos, missing letters, Franco (3ayza, bkam), slang. ' +
      'Classify by MEANING, never by exact spelling. Never OTHER if the meaning is clear.\n\n' +
      'The 3 real offers (never invent others):\n' +
      '1) offerKey=post-laser — عناية ما بعد الليزر — 618 (أسعار الموقع + شحن مجاني)\n' +
      '2) offerKey=brightening — روتين التفتيح الكامل — 777 (أسعار الموقع + شحن مجاني)\n' +
      '3) offerKey=face-body — عناية الوش والجسم — 558 (أسعار الموقع + شحن مجاني)\n\n' +
      `Available products:\n${productList}\n` +
      wizardHint +
      bundleHint +
      '\nIntents:\n' +
      '- ROUTINE_OR_SET: asks what offers exist OR wants routines/deals in general WITHOUT picking one ' +
      '(في عروض، ايه العروض، عندكم عروض، عروضكم ايه، فيه حاجة أوفر).\n' +
      '- SELECT_OFFER: picks ONE or MORE of the 3 offers — by number (الأول/التاني/التالت/1/2/3), ' +
      'or by meaning (الليزر، التفتيح، الوش والجسم). Also "العرض الاول والتالت" / "عاوز الاول والتاني" → SELECT_OFFER ' +
      '(code adds all named offers). ' +
      '- Also: asks about bikini/underarm/arm/body brightening or "في تفتيح البكيني" / "تفتيح الارم" without saying single cream only → offerKey=brightening. ' +
      'BUT if they ask whether it WORKS for bikini/underarm after an offer was already discussed ("بينفع للبكيني؟" / "مناسب تحت الإبط؟") → ASK_SUITABILITY, NOT SELECT_OFFER. ' +
      'ALWAYS set offerKey to post-laser|brightening|face-body and offerIndex 1|2|3 when clear.\n' +
      '- PRICE_ASK: asking price (بكام، بكم، السعر، كام، وسعره كام) for a product or in general. ' +
      'If bot JUST listed the 3 offers with prices and customer asks وسعره كام without naming which → still PRICE_ASK (code will ask which offer).\n' +
      '- PRODUCT_INTEREST: curious about a product, not yet ordering. NOT for benefits/ingredients/guarantee/results/suitability questions.\n' +
      '- ASK_BENEFITS: asks benefits / what it does / له فوائد / فايدته ايه / بيعمل ايه (after an offer was pitched → still ASK_BENEFITS, NOT SELECT_OFFER).\n' +
      '- ASK_INGREDIENTS: asks ingredients / مكونات / تركيبة.\n' +
      '- ASK_GUARANTEE: asks guarantee / safety / لو صار فيني حاجة / آمن؟ / مرخص؟ — NOT return policy.\n' +
      '- ASK_RESULTS: asks when results appear / امتى النتائج / امتى يبان / كام يوم.\n' +
      '- ASK_RETURN: explicitly asks about returning/exchanging products (إرجاع / استبدال / أرجع المنتج).\n' +
      '- ASK_SUITABILITY: asks if the product/routine works for an area — بينفع للبكيني؟ / مناسب تحت الإبط؟ / ينفع للجسم؟ (NEVER re-add the offer).\n' +
      '- ASK_USAGE: asks how to use — طريقة الاستخدام / ازاي استخدم / خطوات الاستخدام (answer with steps, NOT product blurbs).\n' +
      '- ADD_CONFIRM: wants to add to order after bot asked to register/add. ' +
      'If bot just pitched a routine offer, prefer CHECKOUT_READY (code adds the whole offer).\n' +
      '- CHECKOUT_READY: wants to place/finish order now (اعمل اوردر، اوك اوردر، يلا نطلب، سجلي، نكمل، تمام خدوا العرض). ' +
      'If an offer was just discussed or selectedBundle is set, still CHECKOUT_READY — code adds the full offer bundle.\n' +
      '- CHOOSE_CHAT / CHOOSE_SITE / HOW_TO_ORDER / POINTS_ASK / DELIVERY_ETA as usual.\n' +
      '- PROVIDE_NAME / PROVIDE_PHONE / PROVIDE_ADDRESS / PROVIDE_GOVERNORATE / PROVIDE_FULL_DETAILS for delivery data.\n' +
      '- CANCEL_MODIFY: change/cancel an EXISTING placed order.\n' +
      '- OTHER: ONLY greetings/unrelated with no clear sales or checkout meaning.\n\n' +
      'Rules:\n' +
      '- After bot pitched an offer, questions about benefits/guarantee/results/suitability/usage → ASK_* (never re-classify as SELECT_OFFER or PRODUCT_INTEREST).\n' +
      '- After bot listed the 3 offers, any pick → SELECT_OFFER (not OTHER, not ROUTINE_OR_SET).\n' +
      '- After bot detailed ONE offer, "اوك/اعمل اوردر/يلا" → CHECKOUT_READY.\n' +
      '- Wizard await_method + name/phone/address → PROVIDE_*.\n' +
      '- Affirmation after chat-vs-site → CHOOSE_CHAT.\n\n' +
      'JSON only: {"intent":"...","products":[],"name":null,"phone":null,"address":null,"governorate":null,"offerKey":null,"offerIndex":null}';

    const user =
      `Bot's last message: "${String(lastBot || 'none').slice(0, 900)}"\n` +
      `Customer's message: "${String(message || '').slice(0, 500)}"`;

    const parsed = await completeJson({ system, user, maxTokens: 600 });
    if (!parsed) return { ...EMPTY };

    let intent = typeof parsed?.intent === 'string' ? parsed.intent.trim().toUpperCase() : '';
    if (intent === 'SEND_CHECKOUT_LINK') intent = 'PROVIDE_FULL_DETAILS';
    if (!VALID.has(intent)) return { ...EMPTY };

    const nameSet = new Set(names);
    const products = Array.isArray(parsed.products)
      ? parsed.products.filter((p) => typeof p === 'string' && nameSet.has(p))
      : [];

    if (intent === 'ADD_CONFIRM' && products.length === 0 && !normalizeOfferKey(parsed?.offerKey)) {
      const slotsEarly = normalizeSlots(parsed);
      if (!slotsEarly.offerKey && !selectedBundleKey) return { ...EMPTY };
    }

    const slots = normalizeSlots(parsed);
    if (!slots.offerKey && slots.offerIndex) {
      const map = ['post-laser', 'brightening', 'face-body'];
      slots.offerKey = map[slots.offerIndex - 1] || null;
    }

    return {
      intent,
      products: intent === 'ADD_CONFIRM' || intent === 'PRODUCT_INTEREST' || intent === 'PRICE_ASK'
        || intent === 'ASK_BENEFITS' || intent === 'ASK_INGREDIENTS'
        ? products
        : [],
      slots,
    };
  } catch {
    return { ...EMPTY };
  }
}

module.exports = { classifyIntent, VALID, FAQ_INTENTS, OFFER_KEYS, normalizeOfferKey };
