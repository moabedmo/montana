const {
  resolveSelectedBundle,
  resolveBundleFromCustomerText,
  isVagueOfferQuestion,
  allocateBundleUnitPrices,
  getBundleByKey,
  geminiBundleContext,
} = require('../lib/adOffers');

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

assert(resolveBundleFromCustomerText('روتين التفتيح الكامل بـ ٧٧٧').key === 'brightening', '777 text');
assert(resolveBundleFromCustomerText('روتين التفتيح الكامل بـ ٦٩٩ بدل ٧٧٧').key === 'brightening', 'legacy 699 text');
assert(resolveBundleFromCustomerText('عرض ما بعد الليزر بـ 618').key === 'post-laser', '618 text');
assert(resolveBundleFromCustomerText('عرض ما بعد الليزر بـ 549').key === 'post-laser', 'legacy 549 text');
assert(resolveBundleFromCustomerText('عناية الوش والجسم غسول حب الشباب + لوشن بـ 558').key === 'face-body', '558 text');

assert(resolveSelectedBundle('post-laser').key === 'post-laser', 'selectedBundle post-laser');
assert(resolveSelectedBundle('brightening').key === 'brightening', 'selectedBundle brightening');
assert(resolveSelectedBundle('face-body').key === 'face-body', 'selectedBundle face-body');
assert(resolveSelectedBundle('face-and-body').key === 'face-body', 'alias face-and-body');
assert(resolveSelectedBundle('') === null, 'empty string');
assert(resolveSelectedBundle(null) === null, 'null');
assert(resolveSelectedBundle(undefined) === null, 'undefined');

assert(isVagueOfferQuestion('بكام'), 'vague بكام');
assert(isVagueOfferQuestion('العرض'), 'vague العرض');
assert(!isVagueOfferQuestion('عايزة غسول التفتيح لوحده'), 'not vague product');

assert(getBundleByKey('post-laser').bundlePrice === 618, 'price post-laser');
assert(getBundleByKey('brightening').bundlePrice === 777, 'price brightening');
assert(getBundleByKey('face-body').bundlePrice === 558, 'price face-body');

const units = allocateBundleUnitPrices([{ price: 369 }, { price: 249 }]);
assert(units[0] === 369 && units[1] === 249, 'allocate uses website retail');
assert(units.reduce((a, b) => a + b, 0) === 618, 'allocate sums to retail total');
assert(!!geminiBundleContext(getBundleByKey('brightening')), 'gemini context');

console.log('adOffers tests OK');
