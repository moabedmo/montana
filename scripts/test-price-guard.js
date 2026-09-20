// Prices the shop does not charge must not reach a customer.
//
// The bot is told to read prices with its tools and never from memory. In a
// live check it said the whitening cream was 369 — which is a real price, the
// post-laser cream's — the lotion 299 (229) and the acne cleanser 299 (329),
// and quoted a product that does not exist. A prompt cannot enforce
// arithmetic, so the reply is checked against the rows on the way out.
//
// Reads the live catalogue, so it is checking the real thing.
const assert = require('assert');
const { findMispricedProducts, findInventedPrices, allowedPrices, toWestern } = require('../lib/priceGuard');

(async () => {
  // ---- the pairing check, which is the one that matters
  // A bare-number check cannot catch a real price on the wrong product; only
  // the pairing can.
  const bad = await findMispricedProducts(
    'كريم التفتيح بـ 369 جنيه، ولوشن اليدين والجسم بـ 299 جنيه، وغسول حب الشباب بـ 299 جنيه',
    0,
  );
  const slugs = bad.map((b) => b.slug).sort();
  assert.deepStrictEqual(slugs, ['acne-facial-cleanser', 'hand-body-lotion', 'whitening-cream'],
    'all three mispriced products must be caught');
  for (const b of bad) assert.notStrictEqual(b.said, b.actual);

  // one finding per product, even when two name variants both match
  assert.strictEqual(new Set(slugs).size, slugs.length, 'no product reported twice');

  // ---- the correct reply must pass untouched, or the guard is worse than the bug
  const good = await findMispricedProducts(
    '• كريم التفتيح — **249** ج\n'
    + '• غسول التفتيح — **299** ج\n'
    + '• غسول حب الشباب — **329** ج\n'
    + '• لوشن اليدين والجسم — **229** ج\n'
    + '• كريم ما بعد الليزر — **369** ج',
    0,
  );
  assert.deepStrictEqual(good, [], 'the real price list must pass');

  // a struck-through old price is legitimate
  assert.deepStrictEqual(
    await findMispricedProducts('كريم التفتيح سعره 249 جنيه بدلاً من 300 جنيه', 0),
    [], 'old_price must be allowed',
  );

  // with a campaign running, the discounted price is legitimate too
  assert.deepStrictEqual(
    await findMispricedProducts('كريم التفتيح بـ 199 جنيه بعد الخصم', 20),
    [], 'the post-discount price must be allowed while a promo runs',
  );

  // a reply with no prices in it is not the guard's business
  assert.deepStrictEqual(
    await findMispricedProducts('كريم التفتيح مناسب للوش والرقبة والكوع والركبة', 0), [],
  );

  // ---- numbers that sit next to a product name without being its price.
  // Replacing a correct reply with a price list is a worse failure than the
  // one being guarded against, so every one of these must pass clean.
  const notUnitPrices = [
    'تمام يا فندم، كريم التفتيح والغسول مع بعض الإجمالي 548 جنيه شامل الشحن',  // a cart total
    'طلبك: كريم التفتيح × 2 = 498 جنيه',                                        // a quantity
    'كريم التفتيح 249 جنيه والشحن 70 جنيه، الإجمالي 319 جنيه',                  // price + shipping
    'كريم التفتيح متوفر، الشحن لمحافظتك 70 جنيه',                               // shipping alone
    'روتين التفتيح فيه كريم التفتيح وغسول التفتيح بـ 777 جنيه',                 // a routine total
    'كريم التفتيح وكمان غسول التفتيح بـ 299 جنيه',                              // the other product's price
  ];
  for (const c of notUnitPrices) {
    assert.deepStrictEqual(await findMispricedProducts(c, 0), [], `false positive: ${c}`);
  }

  // ---- numbers that are not money
  const allowed = await allowedPrices();
  assert.ok(allowed.size > 0, 'the catalogue must load');
  assert.deepStrictEqual(
    findInventedPrices('غسول 200 مل وكريم 50 مل، شحن مجاني من 3 منتجات، وكل 10 نقاط = 1 ج', allowed),
    [], 'sizes, counts and points are not prices',
  );
  assert.deepStrictEqual(
    findInventedPrices('عندنا خصم 20% على كل المنتجات', allowed), [], 'a percentage is not a price',
  );

  // an unreadable catalogue must not gag the bot: unable to verify is not
  // verified wrong
  assert.deepStrictEqual(findInventedPrices('كريم التفتيح بـ 999 جنيه', new Set()), []);

  // ---- Arabic numerals are checked like any other
  assert.strictEqual(toWestern('٢٤٩'), '249');
  const arabic = await findMispricedProducts('كريم التفتيح بـ ٣٦٩ جنيه', 0);
  assert.strictEqual(arabic.length, 1, 'an Arabic-numeral price must be checked too');

  // the shelf price and the after-discount price must both pass while a
  // campaign runs — a reply states the first and adds the second
  assert.deepStrictEqual(
    await findMispricedProducts('كريم التفتيح سعره 249 جنيه، وبعد الخصم 199 جنيه', 20), [],
  );

  console.log('PASS price guard — pairing, allowances, non-prices, numerals');
})().catch((err) => {
  console.error('FAIL', err.message);
  process.exit(1);
});
