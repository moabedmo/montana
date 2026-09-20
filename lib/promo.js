// The store-wide promo, read from site_settings.
//
// Checkout and the bot have to agree on this to the piastre. If the bot quotes
// a discount the checkout does not apply — or the other way round — the
// customer catches it at the worst possible moment, which is exactly the
// problem this was written to fix.
//
// Kept deliberately small and cached: it is read on every order and every time
// the bot answers a price question.
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://ikryeyqrithikabwidov.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY
  || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlrcnlleXFyaXRoaWthYndpZG92Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE3MzY1ODcsImV4cCI6MjA5NzMxMjU4N30.kNfHPxV4fq67cOF8uFsTrLOxPYcLcmmDO3ScIHzI9Uo';

const sb = createClient(SUPABASE_URL, SUPABASE_KEY);
const CACHE_MS = 60_000;

let cache = null;
let cachedAt = 0;

/**
 * { active, percent, label, endsAt } — never throws.
 *
 * A failure to read returns "no promo". Quoting a discount that cannot be
 * confirmed is worse than quoting the shelf price.
 */
async function getPromo() {
  const now = Date.now();
  if (cache && now - cachedAt < CACHE_MS) return cache;
  const off = { active: false, percent: 0, label: '', endsAt: null };
  try {
    const { data, error } = await sb
      .from('site_settings')
      .select('key,value')
      .in('key', ['promo_percent', 'promo_label', 'promo_ends_at']);
    if (error) throw error;
    const map = Object.fromEntries((data || []).map((r) => [r.key, String(r.value ?? '').trim()]));
    const percent = Math.round(Number(map.promo_percent) || 0);
    const endsAt = map.promo_ends_at ? new Date(map.promo_ends_at) : null;
    const expired = endsAt && !Number.isNaN(endsAt.getTime()) && endsAt.getTime() < now;
    cache = percent > 0 && percent < 100 && !expired
      ? { active: true, percent, label: map.promo_label || `خصم ${percent}%`, endsAt }
      : off;
  } catch (err) {
    console.warn('[promo] could not read settings, treating as no promo:', err.message);
    cache = off;
  }
  cachedAt = now;
  return cache;
}

/** Piastres are not a thing here — orders are whole pounds. */
function promoDiscountFor(subtotal, promo) {
  if (!promo?.active || !(subtotal > 0)) return 0;
  return Math.min(Math.round((subtotal * promo.percent) / 100), subtotal);
}

/**
 * One line the bot says to a customer, or '' when nothing is running.
 *
 * "على المنتجات" and not "على كل المنتجات": checkout excludes the routine
 * bundles, and the wording has to leave no room for the other reading.
 */
function promoLine(promo) {
  if (!promo?.active) return '';
  return `عندنا دلوقتي **${promo.label}** — **${promo.percent}%** على المنتجات الفردية، بيتحسب تلقائي على الطلب 💜`;
}

/**
 * The same campaign, written for the model rather than the customer.
 *
 * Told only that 20% was running, the bot offered a customer the 777 routine
 * for 621.6 — a discount checkout refuses, and a figure in piastres, which
 * this shop does not deal in. She would have found out at the worst possible
 * moment, which is the thing this file exists to prevent. It was also reading
 * the whole catalogue out at people who had asked something else.
 *
 * Kept apart from promoLine() because that one is said out loud, and an
 * instruction that reaches a customer is its own kind of bug.
 */
function promoPromptBlock(promo) {
  if (!promo?.active) return '';
  return [
    promoLine(promo),
    `الخصم ده **مش** على عروض الروتين (777 / 618 / 558) — دي سعرها ثابت ومعاها شحن مجاني.`,
    'متقوليش إن العرض عليه خصم، ومتحسبيش نسبة على سعر العرض.',
    'الأسعار المكتوبة في الموقع هي أسعار المنتجات — الخصم بيتشال على الأوردر، مش تنزيل في السعر.',
    'ومتعدّيش الأسعار كلها من نفسك؛ قولي سعر اللي سألت عنه بس.',
  ].join('\n');
}

module.exports = { getPromo, promoDiscountFor, promoLine, promoPromptBlock };
