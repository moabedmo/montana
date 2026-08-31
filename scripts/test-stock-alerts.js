/**
 * Stock alerts must fire on the CROSSING, not on the level — otherwise every
 * order of an already-low product sends another alert, the owner stops reading
 * them, and the one that matters gets missed.
 *
 * Run: node scripts/test-stock-alerts.js
 */
const {
  LOW_STOCK_THRESHOLD,
  stockCrossings,
  formatStockAlert,
} = require('../lib/stockAlerts');

let failed = 0;
function assert(cond, label) {
  if (!cond) { failed += 1; console.error('FAIL:', label); } else { console.log('ok:', label); }
}

const item = (id, name, qty) => ({ id, name, qty });

assert(LOW_STOCK_THRESHOLD === 50, 'threshold matches get_low_stock_products (50)');

// ── crossing down into "low" ──
let c = stockCrossings([item(1, 'كريم التفتيح', 3)], { 1: 52 });
assert(c.length === 1 && c[0].level === 'low' && c[0].after === 49, '52 → 49 alerts low');

// ── already low: must stay quiet ──
c = stockCrossings([item(1, 'كريم التفتيح', 3)], { 1: 40 });
assert(c.length === 0, 'already below the line does NOT re-alert');

// ── landing exactly on the line counts ──
c = stockCrossings([item(1, 'غسول', 1)], { 1: 51 });
assert(c.length === 1 && c[0].level === 'low', '51 → 50 alerts (boundary)');

// ── running out ──
c = stockCrossings([item(1, 'لوشن', 2)], { 1: 2 });
assert(c.length === 1 && c[0].level === 'out' && c[0].after === 0, '2 → 0 alerts out of stock');

c = stockCrossings([item(1, 'لوشن', 5)], { 1: 3 });
assert(c[0].level === 'out' && c[0].after === 0, 'oversell still reports 0, never negative');

// ── out beats low: one alert, not two ──
c = stockCrossings([item(1, 'كريم', 60)], { 1: 60 });
assert(c.length === 1 && c[0].level === 'out', 'a big order that empties stock reports out only');

// ── already zero stays quiet ──
assert(stockCrossings([item(1, 'كريم', 1)], { 1: 0 }).length === 0, 'already zero does not re-alert');

// ── several products in one order ──
c = stockCrossings(
  [item(1, 'غسول التفتيح', 1), item(2, 'كريم التفتيح', 1), item(3, 'لوشن', 1)],
  { 1: 51, 2: 1, 3: 900 }
);
assert(c.length === 2, 'only the two that crossed are reported');
assert(c.some((x) => x.level === 'low') && c.some((x) => x.level === 'out'), 'both kinds captured');

// ── unknown / missing stock is skipped, never guessed ──
assert(stockCrossings([item(9, 'مجهول', 1)], {}).length === 0, 'unknown product is skipped');
assert(stockCrossings([item(9, 'مجهول', 1)], { 9: null }).length === 0, 'null stock is skipped');
assert(stockCrossings(null, null).length === 0, 'no items → no crossings');

// ── the message ──
assert(formatStockAlert([], 'MON-12345') === null, 'nothing crossed → no message at all');
const text = formatStockAlert(
  [{ name: 'لوشن اليدين', after: 0, level: 'out' }, { name: 'كريم التفتيح', after: 12, level: 'low' }],
  'MON-12345'
);
assert(/خلص من المخزون/.test(text) && /لوشن اليدين/.test(text), 'out-of-stock section present');
assert(/قرب يخلص/.test(text) && /فاضل 12/.test(text), 'low-stock section shows what is left');
assert(/MON-12345/.test(text), 'message references the order');

if (failed) { console.error(`\n${failed} test(s) failed`); process.exit(1); }
console.log('\nall passed');
