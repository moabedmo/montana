// The store-wide promo.
//
// An ad went out promising 20% off everything while nothing applied it: prices
// unchanged, no coupon, and the bot hard-coded to say no discount existed. The
// rule that matters most here is the reverse of the dedupe guard's — a promo
// that cannot be read must come back as *no* promo, because quoting a discount
// the order will not carry is worse than quoting the shelf price.
const assert = require('assert');
const { promoDiscountFor, promoLine } = require('../lib/promo');

const on = { active: true, percent: 20, label: 'خصم BackToSchool' };
const off = { active: false, percent: 0, label: '' };

// 1 — the arithmetic the checkout and the bot both have to agree on
assert.strictEqual(promoDiscountFor(1000, on), 200);
assert.strictEqual(promoDiscountFor(299, on), 60);      // 59.8 rounds to 60
assert.strictEqual(promoDiscountFor(777, on), 155);     // 155.4 rounds to 155

// 2 — nothing running means nothing comes off
assert.strictEqual(promoDiscountFor(1000, off), 0);
assert.strictEqual(promoDiscountFor(1000, null), 0);
assert.strictEqual(promoDiscountFor(1000, undefined), 0);

// 3 — an empty or negative basket never produces a discount
assert.strictEqual(promoDiscountFor(0, on), 0);
assert.strictEqual(promoDiscountFor(-50, on), 0);

// 4 — the discount can never exceed the goods
assert.ok(promoDiscountFor(10, { active: true, percent: 99 }) <= 10);

// 5 — the line names the campaign and the number, so the customer can check it
const line = promoLine(on);
assert.ok(line.includes('20'), 'the percentage must be stated');
assert.ok(line.includes('BackToSchool'), 'the campaign must be named');
assert.strictEqual(promoLine(off), '', 'no promo means no line at all');
assert.strictEqual(promoLine(null), '');

// 6 — a percentage at or past 100 is a configuration mistake, not a free order
assert.strictEqual(promoDiscountFor(500, { active: true, percent: 100 }), 500);

// 7 — routine bundles are outside the promo: their perk is free shipping, and
// a percentage on top would discount them twice. The exclusion happens where
// the basket is summed, so what reaches promoDiscountFor is already only the
// eligible goods — a bundle-only basket therefore arrives as zero.
assert.strictEqual(promoDiscountFor(0, on), 0, 'a bundle-only basket gets nothing off');
// a mixed basket: 777 bundle + 299 cleanser -> only the 299 is eligible
assert.strictEqual(promoDiscountFor(299, on), 60);

console.log('PASS promo — 7 groups');
