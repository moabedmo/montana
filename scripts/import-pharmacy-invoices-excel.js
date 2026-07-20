/**
 * Full import from Excel — master sheet `total` only (all regions).
 * - Includes blank-name continuation rows (inherit previous pharmacy name)
 * - Does NOT import APRIL (already rolled into `total` — would double-count)
 *
 * Real Excel column sums (rows with activity):
 *   Collection ≈ 77,506.7 · Remain ≈ 606,851 · Bottles = 3,456
 *
 * Run: node scripts/import-pharmacy-invoices-excel.js
 */
const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

const SRC = process.argv[2] || 'c:/Users/mo-ab/Desktop/new/pharmacies per bottle old prices.xlsx';
const PRODUCTS = [
  { sku: 'post-laser', name: 'Post-Laser', qi: 1, pi: 2 },
  { sku: 'lotion', name: 'Lotion', qi: 3, pi: 4 },
  { sku: 'w-cleanser', name: 'W.cleanser', qi: 5, pi: 6 },
  { sku: 'acne', name: 'Acne', qi: 7, pi: 8 },
  { sku: 'w-cream', name: 'W.cream', qi: 9, pi: 10 },
];

function num(v) {
  if (v === '' || v == null) return 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}
function esc(s) {
  return String(s || '').replace(/'/g, "''");
}
function round2(n) {
  return Math.round(Number(n || 0) * 100) / 100;
}
function normRegion(name) {
  const t = String(name || '').trim().replace(/\s+/g, ' ');
  if (/^مخازن\s*giza$/i.test(t)) return 'مخازن Giza';
  if (/^مخازن\s*cairo$/i.test(t)) return 'مخازن Cairo';
  if (/^alex/i.test(t)) return 'Alex';
  if (/^fayou?m$/i.test(t)) return 'Fayoum';
  if (/^giza$/i.test(t)) return 'Giza';
  if (/^cairo$/i.test(t)) return 'Cairo';
  return t;
}
function isRegionHeader(name, row) {
  const t = String(name || '').trim();
  if (!t) return false;
  if (/^total$/i.test(t)) return false;
  const bottles = num(row[17]);
  const subtotal = num(row[12]);
  const total = num(row[14]) || subtotal;
  const qtySum = PRODUCTS.reduce((s, p) => s + num(row[p.qi]), 0);
  const paid = num(row[15]);
  const emptyMoney = bottles <= 0 && subtotal <= 0 && total <= 0 && qtySum <= 0 && paid <= 0;
  if (!emptyMoney) return false;
  const key = t.toLowerCase().replace(/\s+/g, ' ');
  if (/^(giza|cairo|alex|alexandria|fayoum|fayum)$/i.test(key)) return true;
  if (/^مخازن\s+/i.test(t) || /مخازن/.test(t)) return true;
  if (/^(delta|assiut|bani|minya)/i.test(t)) return true;
  return false;
}

function buildLines(r, disc) {
  const line_items = [];
  for (const p of PRODUCTS) {
    const qty = num(r[p.qi]);
    if (qty <= 0) continue;
    const lineTot = num(r[p.pi]);
    const afterUnit = lineTot > 0 ? lineTot / qty : 0;
    const unit = disc > 0 && disc < 1 && afterUnit > 0 ? afterUnit / (1 - disc) : afterUnit;
    line_items.push({
      sku: p.sku,
      name: p.name,
      qty,
      unit_price: round2(unit),
      line_total: round2(lineTot),
    });
  }
  return line_items;
}

/**
 * One invoice per activity row. Blank name → previous pharmacy (continuation line).
 */
function parseTotalSheet(data) {
  const out = [];
  let region = 'Other';
  let lastPharmacy = null;

  for (let i = 1; i < data.length; i++) {
    const r = data[i];
    let name = String(r[0] ?? '').trim();
    // Stop at sheet TOTAL row — rows below are summary junk / not pharmacies
    if (/^total$/i.test(name)) break;

    if (name && isRegionHeader(name, r)) {
      region = normRegion(name);
      lastPharmacy = null;
      continue;
    }

    const discount = num(r[11]);
    const subtotal = num(r[12]);
    const tax = num(r[13]);
    const totalWithTax = num(r[14]) || subtotal;
    const paid = num(r[15]);
    const bottles = num(r[17]);
    const bonus = num(r[18]);
    const qtySum = PRODUCTS.reduce((s, p) => s + num(r[p.qi]), 0);
    const hasActivity = bottles > 0 || subtotal > 0 || totalWithTax > 0 || qtySum > 0 || paid > 0 || bonus > 0;
    if (!hasActivity) continue;

    const continued = !name;
    if (continued) {
      if (!lastPharmacy) continue; // orphan — skip
      name = lastPharmacy;
    } else {
      lastPharmacy = name;
    }

    const disc = discount > 1 ? discount / 100 : discount;
    let line_items = buildLines(r, disc);
    if (!line_items.length && totalWithTax > 0) {
      line_items = [{
        sku: 'misc',
        name: 'Miscellaneous',
        qty: bottles || 1,
        unit_price: bottles ? round2(totalWithTax / bottles) : totalWithTax,
        line_total: round2(totalWithTax),
      }];
    }
    if (!line_items.length) continue;

    out.push({
      region,
      pharmacy_name: name,
      discount: disc,
      subtotal: round2(subtotal || totalWithTax),
      tax: round2(tax),
      total: round2(totalWithTax || subtotal),
      amount_paid: round2(paid), // Excel column Collection
      price_list: 'old',
      line_items,
      bottles,
      bonus,
      sheet: 'total',
      row: i,
      continued,
    });
  }
  return out;
}

const wb = XLSX.readFile(SRC);
if (!wb.Sheets.total) {
  console.error('Sheet `total` not found. Sheets:', wb.SheetNames);
  process.exit(1);
}

const all = parseTotalSheet(XLSX.utils.sheet_to_json(wb.Sheets.total, { header: 1, defval: '' }));

const byRegion = {};
all.forEach((r) => {
  byRegion[r.region] = (byRegion[r.region] || 0) + 1;
});

const sumPaid = all.reduce((s, r) => s + r.amount_paid, 0);
const sumTotal = all.reduce((s, r) => s + r.total, 0);
const sumRemain = sumTotal - sumPaid;
const sumBottles = all.reduce((s, r) => s + r.bottles, 0);
const continuedN = all.filter((r) => r.continued).length;

console.log('=== Import summary (total sheet only — real file numbers) ===');
console.log('invoices:', all.length, '(continued rows:', continuedN + ')');
console.log('Regions:', byRegion);
console.log('TOTAL (Total with tax):', round2(sumTotal));
console.log('COLLECTION (محصّل):', round2(sumPaid));
console.log('REMAIN (ليك):', round2(sumRemain));
console.log('BOTTLES:', sumBottles);
console.log('Expected Excel: Collection 77506.7 · Bottles 3456');

const jsonPath = path.join(__dirname, '../crm/data/pharmacy-invoices-legacy.json');
fs.mkdirSync(path.dirname(jsonPath), { recursive: true });
fs.writeFileSync(jsonPath, JSON.stringify(all, null, 2));
fs.writeFileSync(
  path.join(__dirname, '../crm/data/pharmacy-invoice-regions.json'),
  JSON.stringify(Object.keys(byRegion).sort(), null, 2),
);
console.log('Wrote', jsonPath);

const lines = [
  '-- Legacy pharmacy invoices from Excel sheet `total` only (real Collection / Remain).',
  '-- Includes blank continuation rows under previous pharmacy. No APRIL (avoids double-count).',
  '-- Run AFTER 084. Replaces previous PHI-LEGACY-* rows.',
  '',
  "delete from crm_pharmacy_invoices where invoice_number like 'PHI-LEGACY-%';",
  '',
];

all.forEach((inv, idx) => {
  const n = 'PHI-LEGACY-' + String(idx + 1).padStart(4, '0');
  const items = JSON.stringify(inv.line_items).replace(/'/g, "''");
  const paid = inv.amount_paid || 0;
  const total = inv.total || 0;
  let ptype = 'credit';
  if (paid >= total && total > 0) ptype = 'cash';
  else if (paid > 0) ptype = 'partial';
  const contNote = inv.continued ? ' · continuation row' : '';
  lines.push(`insert into crm_pharmacy_invoices (
  invoice_number, pharmacy_name, region, invoice_date, due_date, due_date_manual,
  payment_type, discount, line_items, subtotal, tax, total, amount_paid,
  is_legacy, price_list, notes
) values (
  '${n}', '${esc(inv.pharmacy_name)}', '${esc(inv.region || 'Other')}', current_date, null, false,
  '${ptype}', ${inv.discount || 0}, '${items}'::jsonb, ${inv.subtotal || 0}, ${inv.tax || 0}, ${total}, ${paid},
  true, 'old', 'Imported from Excel (${inv.sheet} row ${inv.row}${contNote}) · أسعار قديمة'
);`);
});

const sqlPath = path.join(__dirname, '../supabase/migrations/085_import_pharmacy_invoices_legacy.sql');
fs.writeFileSync(sqlPath, lines.join('\n'));
console.log('Wrote', sqlPath, 'inserts:', all.length);
