/**
 * Read a photo a customer sent and turn it into something the normal reply
 * logic already knows how to answer.
 *
 * The bot used to detect that a photo arrived and answer every one of them with
 * the same canned list of routine offers. That is right often enough to look
 * like it works and wrong often enough to be embarrassing — a customer holding
 * up a bottle and asking "ده بكام؟" got a sales pitch for three other things.
 *
 * What customers actually send, per the owner: a product, an ad or offer they
 * saw, or a screenshot of a chat. So this does not invent a new reply path — it
 * resolves the photo to a product slug, an offer key, or the text written in it,
 * and hands that back for the existing intent flow to answer.
 *
 * Everything here fails soft. No URL, no key, a dead CDN link, a model that
 * times out — all return null, and the caller falls back to the old behaviour.
 */
const { completeVisionJson } = require('./llm');

/** Meta/Instagram CDN and the handful of hosts ManyChat forwards from. */
const ALLOWED_HOST = /(^|\.)(fbcdn\.net|cdninstagram\.com|facebook\.com|instagram\.com|manychat\.com|akamaihd\.net|licdn\.com|amazonaws\.com|googleusercontent\.com)$/i;

const MAX_BYTES = 5 * 1024 * 1024; // Claude's per-image ceiling
const FETCH_TIMEOUT_MS = 8000;

const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

/** Product slugs the vision pass is allowed to return. */
const PRODUCT_SLUGS = [
  'acne-facial-cleanser',
  'whitening-cleanser',
  'whitening-cream',
  'hand-body-lotion',
  'post-laser-cream',
  'anti-scar-silicone-gel',
];

/** Routine keys, matching lib/adOffers.js. */
const OFFER_KEYS = ['post-laser', 'brightening', 'face-body'];

/**
 * Pull an image URL out of whatever shape the caller sent.
 * ManyChat field names are not fixed — they are whatever the owner named the
 * custom field in the flow — so this accepts the plausible spellings rather
 * than one blessed key.
 */
function extractImageUrl(body) {
  if (!body || typeof body !== 'object') return null;

  const isUrl = (v) =>
    typeof v === 'string' && /^https?:\/\/\S+$/i.test(v.trim()) && !/\{\{/.test(v);

  const candidates = [
    body.imageUrl, body.image_url, body.imageURL,
    body.attachmentUrl, body.attachment_url,
    body.photoUrl, body.photo_url,
    body.mediaUrl, body.media_url,
    body.fileUrl, body.file_url,
    body.image, body.photo, body.attachment,
    body.last_input_attachment_url, body.lastInputAttachmentUrl,
  ];

  for (const att of Array.isArray(body.attachments) ? body.attachments : []) {
    if (isUrl(att)) candidates.push(att);
    if (att && typeof att === 'object') {
      candidates.push(att.url, att.payload?.url, att.image_url, att.src);
    }
  }

  for (const c of candidates) if (isUrl(c)) return c.trim();
  return null;
}

/** Download it, with the guards a URL from a third party needs. */
async function fetchImage(url) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  if (parsed.protocol !== 'https:') return null;
  if (!ALLOWED_HOST.test(parsed.hostname)) {
    console.warn('[image] host not allowed:', parsed.hostname);
    return null;
  }

  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: ctl.signal, redirect: 'follow' });
    if (!res.ok) {
      console.warn('[image] fetch failed', res.status);
      return null;
    }
    const type = String(res.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
    if (!ALLOWED_TYPES.has(type)) {
      console.warn('[image] unsupported type', type);
      return null;
    }
    const declared = Number(res.headers.get('content-length') || 0);
    if (declared && declared > MAX_BYTES) {
      console.warn('[image] too large', declared);
      return null;
    }
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length > MAX_BYTES) {
      console.warn('[image] too large after download', buf.length);
      return null;
    }
    return { data: buf.toString('base64'), mediaType: type };
  } catch (e) {
    console.warn('[image] fetch error:', e.message);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

const SYSTEM = `You look at one photo a customer sent to an Egyptian skincare
brand (Montana Naturals) on Instagram or Messenger, and report what is in it.
You never advise, never sell, never diagnose — you only report.

Montana's products, and how to tell them apart by their English label:
- acne-facial-cleanser    "ACNE FACIAL CLEANSER", 200ml tall pump bottle, blue artwork
- whitening-cleanser      "WHITENING CLEANSER", 200ml tall pump bottle, white artwork
- whitening-cream         "WHITENING CREAM", 50ml jar
- hand-body-lotion        "HAND & BODY LOTION" / "72-HOUR", 50ml jar, gold artwork
- post-laser-cream        "POST LASER CREAM", 50ml jar, pink artwork
- anti-scar-silicone-gel  silicone / scar gel

Montana's three routine offers:
- brightening   غسول التفتيح + كريم التفتيح + لوشن اليدين والجسم  (777)
- post-laser    كريم ما بعد الليزر + كريم التفتيح                 (618)
- face-body     غسول + كريم + لوشن للوش والجسم                    (558)`;

const USER = `Report this photo as JSON with exactly these keys:

"kind": one of
  "product"          a Montana product, or any skincare product, photographed
  "ad"               a Montana advertisement or promotional creative
  "offer"            one of the routine offers / bundles above
  "chat_screenshot"  a screenshot of a conversation, DM, or comments
  "order_screenshot" a screenshot of an order, invoice, tracking or payment
  "other"            anything else

"productSlug": the slug from the list above if a Montana product is clearly
  identifiable, else null. Do not guess from colour alone — read the label.

"offerKey": "brightening" | "post-laser" | "face-body" if the photo is about
  one specific routine offer, else null.

"text": every word legible in the photo, verbatim, Arabic kept in Arabic.
  Empty string if there is no text.

"summary": one short Arabic sentence describing the photo, for a human reading
  a log. No advice, no sales language.

JSON only.`;

/**
 * @param {string} url
 * @returns {Promise<{kind: string, productSlug: string|null, offerKey: string|null, text: string, summary: string}|null>}
 */
async function readCustomerImage(url) {
  if (!url) return null;
  const image = await fetchImage(url);
  if (!image) return null;

  const raw = await completeVisionJson({ system: SYSTEM, user: USER, image, maxTokens: 700 });
  if (!raw || typeof raw !== 'object') return null;

  const kind = typeof raw.kind === 'string' ? raw.kind.trim().toLowerCase() : 'other';
  const productSlug = PRODUCT_SLUGS.includes(raw.productSlug) ? raw.productSlug : null;
  const offerKey = OFFER_KEYS.includes(raw.offerKey) ? raw.offerKey : null;

  return {
    kind: ['product', 'ad', 'offer', 'chat_screenshot', 'order_screenshot'].includes(kind)
      ? kind
      : 'other',
    productSlug,
    offerKey,
    // Capped: this text is fed back through the normal intent path, which
    // rejects anything over 2000 chars, and a screenshot of a long thread can
    // run well past that.
    text: typeof raw.text === 'string' ? raw.text.trim().slice(0, 600) : '',
    summary: typeof raw.summary === 'string' ? raw.summary.trim().slice(0, 200) : '',
  };
}

/**
 * What a photo should change about the turn.
 *
 * Split out from the engine so the decision can be tested without a network
 * call: the model's answer is the input, and the routing is the thing that has
 * to stay correct.
 *
 * @param {object|null} read      result of readCustomerImage
 * @param {object} turn           what the caller already told us
 * @returns {{selectedProduct: string|null, selectedBundle: string|null, message: string|null, handOverToCs: boolean}}
 */
function planFromImageRead(read, { message = null, selectedProduct = null, selectedBundle = null } = {}) {
  const plan = { selectedProduct, selectedBundle, message, handOverToCs: false };
  if (!read) return plan;

  // An ad field the caller actually sent beats anything guessed from a picture.
  if (read.productSlug && !plan.selectedProduct) plan.selectedProduct = read.productSlug;
  if (read.offerKey && !plan.selectedBundle) plan.selectedBundle = read.offerKey;

  // She photographed her order because something is wrong with it. Selling her
  // a routine on top of that is the wrong answer, and it is already the owner's
  // rule for the same complaint typed in words.
  if (read.kind === 'order_screenshot') {
    plan.handOverToCs = true;
    return plan;
  }

  // A screenshot of a chat is a message she could not type. Answer the words in
  // it rather than answering "a photo arrived".
  if (!plan.message && read.kind === 'chat_screenshot' && read.text) {
    plan.message = read.text;
  }
  return plan;
}

module.exports = {
  extractImageUrl,
  fetchImage,
  readCustomerImage,
  planFromImageRead,
  PRODUCT_SLUGS,
  OFFER_KEYS,
};
