// Stop an invented price reaching a customer.
//
// The bot is told to read prices with its tools and never from memory. It
// mostly does. Once, in a live check, it said the whitening cream was 369
// (it is 249), the lotion 299 (229), the acne cleanser 299 (329), and quoted
// "كريم حب الشباب" — a product that does not exist. The instruction is in the
// prompt; the model disobeyed it anyway. A prompt cannot enforce arithmetic.
//
// So the reply is checked against the database on the way out. Anything that
// looks like a price and is not one the shop actually charges is caught before
// the customer sees it.
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://ikryeyqrithikabwidov.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY
  || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlrcnlleXFyaXRoaWthYndpZG92Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE3MzY1ODcsImV4cCI6MjA5NzMxMjU4N30.kNfHPxV4fq67cOF8uFsTrLOxPYcLcmmDO3ScIHzI9Uo';

const sb = createClient(SUPABASE_URL, SUPABASE_KEY);
const CACHE_MS = 60_000;

// The routine offers, whose prices are sums rather than rows in products.
const BUNDLE_TOTALS = [618, 777, 558];

let cache = null;
let cachedAt = 0;

/**
 * Every number the shop may legitimately say as a price.
 *
 * Current prices and the struck-through old ones, the routine totals, live
 * shipping costs, and — because a promo is taken off at checkout — each price
 * after the discount. An empty set means "could not check", and the guard then
 * lets everything through: a database hiccup must not gag the bot.
 */
async function allowedPrices() {
  const now = Date.now();
  if (cache && now - cachedAt < CACHE_MS) return cache;

  const out = new Set();
  try {
    const [{ data: products }, { data: rates }, { data: settings }] = await Promise.all([
      sb.from('products').select('price, old_price').eq('is_active', true),
      sb.from('shipping_rates').select('cost'),
      sb.from('site_settings').select('key,value').in('key', ['promo_percent', 'shipping_cost', 'express_shipping_cost', 'free_shipping_min']),
    ]);
    if (!products?.length) return new Set();

    const map = Object.fromEntries((settings || []).map((r) => [r.key, String(r.value ?? '').trim()]));
    const pct = Math.round(Number(map.promo_percent) || 0);

    const add = (n) => {
      const v = Math.round(Number(n));
      if (Number.isFinite(v) && v > 0) out.add(v);
    };

    for (const p of products) {
      add(p.price);
      add(p.old_price);
      if (pct > 0 && pct < 100) {
        const off = Math.round((Number(p.price) * pct) / 100);
        add(Number(p.price) - off);       // what she pays at checkout
        add(off);                          // and the discount itself
      }
    }
    for (const t of BUNDLE_TOTALS) {
      add(t);
      if (pct > 0 && pct < 100) add(t - Math.round((t * pct) / 100));
    }
    for (const r of rates || []) add(r.cost);
    for (const k of ['shipping_cost', 'express_shipping_cost', 'free_shipping_min']) add(map[k]);
  } catch (err) {
    console.warn('[price-guard] could not load prices:', err.message);
    return new Set();
  }
  cache = out;
  cachedAt = now;
  return cache;
}

// Only numbers actually presented as money. "200 مل", "10 نقاط", "3 منتجات"
// and "20%" are none of the guard's business.
const PRICE_PATTERNS = [
  /(\d{2,5})\s*\**\s*(?:جنيه|ج\.?م|ج(?![\p{L}\d]))/gu,
  /بـ\s*\*{0,2}\s*(\d{2,5})/gu,
];

/** Western digits, so an Arabic-numeral reply is checked like any other. */
function toWestern(text) {
  return String(text || '').replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)));
}

/**
 * Prices in this reply that the shop does not charge.
 *
 * An empty allowed set returns nothing: unable to verify is not the same as
 * verified wrong, and the customer is better served by a reply than by silence.
 */
function findInventedPrices(text, allowed) {
  if (!allowed || allowed.size === 0) return [];
  const t = toWestern(text);
  const bad = new Set();
  for (const re of PRICE_PATTERNS) {
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(t)) !== null) {
      const n = Number(m[1]);
      if (Number.isFinite(n) && n > 0 && !allowed.has(n)) bad.add(n);
    }
  }
  return [...bad];
}

// How the bot actually names each product, which is rarely the database's own
// wording. Without these the pairing check never matches anything.
const NAME_VARIANTS = {
  'whitening-cream': ['كريم التفتيح', 'كريم تفتيح'],
  'whitening-cleanser': ['غسول التفتيح', 'غسول تفتيح'],
  'acne-facial-cleanser': ['غسول حب الشباب', 'غسول علاج حب الشباب', 'غسول الوجه لعلاج حب الشباب'],
  'hand-body-lotion': ['لوشن اليدين والجسم', 'لوشن اليدين', 'اللوشن'],
  'post-laser-cream': ['كريم ما بعد الليزر', 'كريم بعد الليزر', 'كريم العناية بعد الليزر'],
};

let pairCache = null;
let pairCachedAt = 0;

async function productPrices() {
  const now = Date.now();
  if (pairCache && now - pairCachedAt < CACHE_MS) return pairCache;
  try {
    const { data } = await sb.from('products').select('slug, price, old_price').eq('is_active', true);
    if (!data?.length) return null;
    pairCache = Object.fromEntries(data.map((p) => [p.slug, p]));
    pairCachedAt = now;
    return pairCache;
  } catch (err) {
    console.warn('[price-guard] could not load product prices:', err.message);
    return null;
  }
}

// A number near a product name is only that product's price when nothing
// between them says otherwise. A cart total, a quantity, a shipping cost and a
// routine's total all sit next to a product name in perfectly good replies —
// flagging those would replace correct answers with a price list, which is a
// worse failure than the one this guards against.
const NOT_A_UNIT_PRICE = /إجمال|مجموع|شحن|توصيل|شامل|روتين|باقة|بوكس|×|[xX]\s*\d|=|قطعة|قطع|عدد/;
// Where a sentence stops being about the product just named.
const BOUNDARY = /[\n،,.؟!؛:]|[•·]/;

/**
 * Prices attached to the wrong product.
 *
 * A bare-number check cannot catch this: when the bot said the whitening cream
 * was 369 it named a real price — the post-laser cream's. Only the pairing is
 * wrong, so the pairing is what gets checked.
 *
 * The price has to be the next thing after the name, with only filler between
 * — "بـ", an em dash, markdown bold. Anything else and the pairing is not
 * clear enough to act on, and the reply is left alone.
 */
async function findMispricedProducts(text, promoPercent = 0) {
  const prices = await productPrices();
  if (!prices) return [];
  const t = toWestern(text);
  const found = [];
  const allNames = Object.values(NAME_VARIANTS).flat();

  for (const [slug, variants] of Object.entries(NAME_VARIANTS)) {
    const row = prices[slug];
    if (!row) continue;
    const ok = new Set([Math.round(Number(row.price))]);
    if (row.old_price) ok.add(Math.round(Number(row.old_price)));
    if (promoPercent > 0 && promoPercent < 100) {
      ok.add(Math.round(Number(row.price)) - Math.round((Number(row.price) * promoPercent) / 100));
    }

    for (const name of variants) {
      if (found.some((f) => f.slug === slug)) break;
      let from = 0;
      for (;;) {
        const at = t.indexOf(name, from);
        if (at === -1) break;
        from = at + name.length;

        // A line about a routine or a total is not quoting a unit price
        const lineStart = t.lastIndexOf('\n', at) + 1;
        const lineEnd = t.indexOf('\n', at) === -1 ? t.length : t.indexOf('\n', at);
        if (NOT_A_UNIT_PRICE.test(t.slice(lineStart, lineEnd))) continue;

        // everything up to the end of this clause
        let window = t.slice(from, from + 40);
        const stop = window.search(BOUNDARY);
        if (stop !== -1) window = window.slice(0, stop);

        const m = window.match(/(\d{2,5})\s*\**\s*(?:جنيه|ج\.?م|ج(?![\p{L}\d]))|بـ\s*\*{0,2}\s*(\d{2,5})/u);
        if (!m) continue;
        // whatever sits between the name and the number has to be filler
        const gap = window.slice(0, m.index);
        if (gap.length > 20) continue;
        if (allNames.some((n) => gap.includes(n))) continue;   // a different product's price

        const said = Number(m[1] || m[2]);
        if (Number.isFinite(said) && !ok.has(said)) {
          found.push({ slug, name, said, actual: Math.round(Number(row.price)) });
          break;   // one finding per product
        }
      }
    }
  }
  return found;
}

/** The real list, for when the model's own has to be thrown away. */
async function truePriceListReply(promoPercent = 0) {
  const prices = await productPrices();
  if (!prices) return null;
  const LABEL = {
    'whitening-cream': 'كريم التفتيح',
    'whitening-cleanser': 'غسول التفتيح',
    'acne-facial-cleanser': 'غسول حب الشباب',
    'hand-body-lotion': 'لوشن اليدين والجسم',
    'post-laser-cream': 'كريم ما بعد الليزر',
  };
  const lines = Object.entries(LABEL)
    .filter(([slug]) => prices[slug])
    .map(([slug, label]) => `• ${label} — **${Math.round(Number(prices[slug].price))}** ج`);
  if (!lines.length) return null;
  const tail = promoPercent > 0 && promoPercent < 100
    ? `\n\nوعليهم **${promoPercent}%** خصم بيتحسب تلقائي على الأوردر 💜`
    : '';
  return `أسعار منتجات مونتانيا يا فندم 💜\n\n${lines.join('\n')}${tail}`;
}

module.exports = {
  allowedPrices, findInventedPrices, findMispricedProducts, truePriceListReply,
  toWestern, BUNDLE_TOTALS, NAME_VARIANTS,
};
