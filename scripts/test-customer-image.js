/**
 * The photo a customer sends is a URL handed to us by ManyChat — a third party
 * — and then fetched server-side. That is a request-forgery shape, so the host
 * allowlist and the scheme check are the interesting part of this file, not the
 * happy path.
 *
 * The field-name spread matters too: ManyChat custom fields are named by
 * whoever built the flow, so the extractor has to accept the plausible
 * spellings and, just as importantly, reject an unfilled {{cuf_…}} template —
 * the bot has already been bitten once by a literal template arriving as a
 * value (see lib/adOffers.js).
 *
 * Run: node scripts/test-customer-image.js
 */
process.env.GEMINI_API_KEY = process.env.GEMINI_API_KEY || 'x';
const {
  extractImageUrl, fetchImage, planFromImageRead, PRODUCT_SLUGS, OFFER_KEYS,
} = require('../lib/imageUnderstanding');

let failed = 0;
function assert(cond, label) {
  if (!cond) { failed += 1; console.error('FAIL:', label); } else { console.log('ok:', label); }
}

// ── the URL is found wherever ManyChat put it ──
[
  [{ image_url: 'https://scontent.cdninstagram.com/a.jpg' }, 'image_url'],
  [{ imageUrl: 'https://x.fbcdn.net/a.jpg' }, 'imageUrl'],
  [{ attachment_url: 'https://x.fbcdn.net/a.jpg' }, 'attachment_url'],
  [{ photo_url: 'https://x.fbcdn.net/a.jpg' }, 'photo_url'],
  [{ last_input_attachment_url: 'https://x.fbcdn.net/a.jpg' }, 'last_input_attachment_url'],
  [{ image: 'https://x.fbcdn.net/a.jpg' }, 'image as a bare URL'],
  [{ attachments: [{ type: 'image', payload: { url: 'https://x.fbcdn.net/a.jpg' } }] }, 'Meta attachments[].payload.url'],
  [{ attachments: ['https://x.fbcdn.net/a.jpg'] }, 'attachments[] of bare URLs'],
].forEach(([body, label]) => assert(!!extractImageUrl(body), 'found: ' + label));

// ── and NOT found where there is none ──
[
  [{}, 'empty body'],
  [{ message: 'عايزة كريم التفتيح' }, 'plain text turn'],
  [{ image: '{{cuf_1481684}}' }, 'unfilled ManyChat template'],
  [{ image_url: '{{last_input_attachment_url}}' }, 'unfilled ManyChat variable'],
  [{ image: 'true' }, 'a boolean-ish flag, not a URL'],
  [{ image: '' }, 'empty string'],
  [{ attachments: [{ type: 'audio' }] }, 'attachment with no url'],
].forEach(([body, label]) => assert(extractImageUrl(body) === null, 'no url: ' + label));

// ── the fetch guard ──
(async () => {
  // Anything not on Meta's CDN is refused before a request goes out.
  for (const [url, label] of [
    ['http://scontent.cdninstagram.com/a.jpg', 'plain http is refused'],
    ['https://169.254.169.254/latest/meta-data/', 'cloud metadata IP is refused'],
    ['https://localhost/a.jpg', 'localhost is refused'],
    ['https://127.0.0.1:8080/a.jpg', 'loopback is refused'],
    ['https://evil.example.com/a.jpg', 'unknown host is refused'],
    ['https://cdninstagram.com.evil.com/a.jpg', 'lookalike suffix is refused'],
    ['not a url', 'garbage is refused'],
  ]) {
    assert((await fetchImage(url)) === null, label);
  }

  // The slugs this module may return have to be ones the catalog actually uses;
  // a slug the rest of the engine does not know resolves to nothing and the
  // photo silently does nothing.
  const { PRODUCT_ADS } = (() => {
    try { return require('../lib/adOffers'); } catch { return {}; }
  })();
  if (Array.isArray(PRODUCT_ADS)) {
    const known = new Set(PRODUCT_ADS.map((p) => p.slug));
    for (const slug of PRODUCT_SLUGS) {
      if (slug === 'anti-scar-silicone-gel') continue; // never pitched to customers
      assert(known.has(slug), `catalog knows slug: ${slug}`);
    }
  }

  assert(OFFER_KEYS.length === 3, 'three routine offers');
  ['brightening', 'post-laser', 'face-body'].forEach((k) =>
    assert(OFFER_KEYS.includes(k), 'offer key: ' + k));

  // ── what each kind of photo does to the turn ──
  const read = (o) => ({ kind: 'other', productSlug: null, offerKey: null, text: '', summary: '', ...o });

  // A photographed product answers as that product.
  let p = planFromImageRead(read({ kind: 'product', productSlug: 'whitening-cream' }), {});
  assert(p.selectedProduct === 'whitening-cream', 'product photo selects the product');
  assert(!p.handOverToCs, 'product photo does not hand over');

  // A photographed ad or offer answers as that offer.
  p = planFromImageRead(read({ kind: 'offer', offerKey: 'brightening' }), {});
  assert(p.selectedBundle === 'brightening', 'offer photo selects the routine');
  p = planFromImageRead(read({ kind: 'ad', offerKey: 'post-laser' }), {});
  assert(p.selectedBundle === 'post-laser', 'ad photo selects the routine');

  // A real ad field wins over a guess from the picture.
  p = planFromImageRead(read({ kind: 'product', productSlug: 'whitening-cream' }), { selectedProduct: 'acne-facial-cleanser' });
  assert(p.selectedProduct === 'acne-facial-cleanser', 'ManyChat ad field beats the photo');
  p = planFromImageRead(read({ kind: 'offer', offerKey: 'brightening' }), { selectedBundle: 'face-body' });
  assert(p.selectedBundle === 'face-body', 'ManyChat bundle field beats the photo');

  // A screenshot of a chat becomes the message.
  p = planFromImageRead(read({ kind: 'chat_screenshot', text: 'كريم التفتيح بكام' }), {});
  assert(p.message === 'كريم التفتيح بكام', 'chat screenshot becomes the message');
  assert(!p.handOverToCs, 'chat screenshot does not hand over');

  // ...but never over something she actually typed.
  p = planFromImageRead(read({ kind: 'chat_screenshot', text: 'كلام تاني خالص' }), { message: 'عايزة اطلب' });
  assert(p.message === 'عايزة اطلب', 'her own words beat the screenshot text');

  // An order or payment screenshot goes to a human and sells nothing.
  p = planFromImageRead(read({ kind: 'order_screenshot', text: 'رقم الطلب MON-123' }), {});
  assert(p.handOverToCs, 'order screenshot hands over to customer service');
  assert(p.message === null, 'order screenshot text is NOT fed to the sales flow');

  // Nothing recognised -> the turn is untouched, and the old reply still runs.
  p = planFromImageRead(read({ kind: 'other', text: 'حاجة' }), {});
  assert(!p.handOverToCs && p.message === null && p.selectedProduct === null,
    'unrecognised photo changes nothing');

  // A failed read must never throw.
  p = planFromImageRead(null, { message: 'ازيك' });
  assert(p.message === 'ازيك' && !p.handOverToCs, 'a failed read leaves the turn alone');

  if (failed) { console.error(`\n${failed} test(s) failed`); process.exit(1); }
  console.log('\nall passed');
})();
