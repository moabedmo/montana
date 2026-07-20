/**
 * Import NEW price list from Excel into Supabase as price_list='new'.
 * Does NOT touch PHI-LEGACY-* (old prices).
 *
 * Run: node scripts/import-pharmacy-invoices-new-prices.js [path-to-xlsx]
 */
'use strict';
const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const SRC =
  process.argv[2] ||
  'c:/Users/mo-ab/Desktop/new/pharmacies per bottle new prices.xlsx';

const URL = 'https://ikryeyqrithikabwidov.supabase.co';
const ANON =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlrcnlleXFyaXRoaWthYndpZG92Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE3MzY1ODcsImV4cCI6MjA5NzMxMjU4N30.kNfHPxV4fq67cOF8uFsTrLOxPYcLcmmDO3ScIHzI9Uo';
const ADMIN_EMAIL = 'admin@montana-crm.com';
const ADMIN_PASS = 'Montana@CRM#2026!';

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
  if (!t || /^total$/i.test(t)) return false;
  const bottles = num(row[17]);
  const subtotal = num(row[12]);
  const total = num(row[14]) || subtotal;
  const qtySum = PRODUCTS.reduce((s, p) => s + num(row[p.qi]), 0);
  const paid = num(row[15]);
  const emptyMoney = bottles <= 0 && subtotal <= 0 && total <= 0 && qtySum <= 0 && paid <= 0;
  if (!emptyMoney) return false;
  const key = t.toLowerCase().replace(/\s+/g, ' ');
  if (/^(giza|cairo|alex|alexandria|fayoum|fayum)$/i.test(key)) return true;
  if (/مخازن/.test(t)) return true;
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

function pickSheet(wb) {
  if (wb.Sheets.total) return { name: 'total', sheet: wb.Sheets.total };
  if (wb.Sheets.Sheet1) return { name: 'Sheet1', sheet: wb.Sheets.Sheet1 };
  const first = wb.SheetNames.find((n) => wb.Sheets[n]);
  return { name: first, sheet: wb.Sheets[first] };
}

function parseSheet(data, sheetName) {
  const out = [];
  let region = 'Other';
  let lastPharmacy = null;

  for (let i = 1; i < data.length; i++) {
    const r = data[i];
    let name = String(r[0] ?? '').trim();
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
    const qtySum = PRODUCTS.reduce((s, p) => s + num(r[p.qi]), 0);
    const hasActivity = bottles > 0 || subtotal > 0 || totalWithTax > 0 || qtySum > 0 || paid > 0;
    if (!hasActivity) continue;

    const continued = !name;
    if (continued) {
      if (!lastPharmacy) continue;
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
      amount_paid: round2(paid),
      price_list: 'new',
      line_items,
      bottles,
      sheet: sheetName,
      row: i,
      continued,
    });
  }
  return out;
}

async function main() {
  const wb = XLSX.readFile(SRC);
  const { name: sheetName, sheet } = pickSheet(wb);
  const data = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
  const all = parseSheet(data, sheetName);

  const byRegion = {};
  all.forEach((r) => {
    byRegion[r.region] = (byRegion[r.region] || 0) + 1;
  });
  const sumPaid = all.reduce((s, r) => s + r.amount_paid, 0);
  const sumTotal = all.reduce((s, r) => s + r.total, 0);

  console.log('=== NEW prices import ===');
  console.log('file:', SRC);
  console.log('sheet:', sheetName);
  console.log('invoices:', all.length);
  console.log('Regions:', byRegion);
  console.log('TOTAL:', round2(sumTotal));
  console.log('COLLECTION:', round2(sumPaid));
  console.log('REMAIN:', round2(sumTotal - sumPaid));

  const jsonPath = path.join(__dirname, '../crm/data/pharmacy-invoices-new.json');
  fs.mkdirSync(path.dirname(jsonPath), { recursive: true });
  fs.writeFileSync(jsonPath, JSON.stringify(all, null, 2));
  console.log('Wrote', jsonPath);

  const sb = createClient(URL, ANON);
  const { error: authErr } = await sb.auth.signInWithPassword({
    email: ADMIN_EMAIL,
    password: ADMIN_PASS,
  });
  if (authErr) throw authErr;
  console.log('logged in');

  // Remove previous NEW-price imports only
  let deleted = 0;
  for (;;) {
    const { data: legacy, error: le } = await sb
      .from('crm_pharmacy_invoices')
      .select('id')
      .like('invoice_number', 'PHI-NEW-%')
      .limit(200);
    if (le) throw le;
    if (!legacy?.length) break;
    for (const row of legacy) {
      const { error } = await sb.from('crm_pharmacy_invoices').delete().eq('id', row.id);
      if (error) throw error;
      deleted++;
    }
  }
  console.log('deleted previous PHI-NEW-*:', deleted);

  let ok = 0;
  let fail = 0;
  const fails = [];
  for (let i = 0; i < all.length; i++) {
    const inv = all[i];
    const number = 'PHI-NEW-' + String(i + 1).padStart(4, '0');
    const paid = Number(inv.amount_paid) || 0;
    const total = Number(inv.total) || 0;
    let payment_type = 'credit';
    if (paid >= total && total > 0) payment_type = 'cash';
    else if (paid > 0) payment_type = 'partial';

    const { error } = await sb.from('crm_pharmacy_invoices').insert({
      invoice_number: number,
      pharmacy_name: inv.pharmacy_name,
      region: inv.region || 'Other',
      invoice_date: new Date().toISOString().slice(0, 10),
      due_date: null,
      due_date_manual: false,
      discount: Number(inv.discount) || 0,
      line_items: inv.line_items || [],
      subtotal: Number(inv.subtotal) || 0,
      tax: Number(inv.tax) || 0,
      total,
      amount_paid: paid,
      payment_type,
      is_legacy: false,
      price_list: 'new',
      notes:
        'Imported from Excel new prices (' +
        inv.sheet +
        ' row ' +
        inv.row +
        (inv.continued ? ' · continuation' : '') +
        ') · أسعار جديدة',
    });
    if (error) {
      fail++;
      fails.push(number + ': ' + error.message);
    } else {
      ok++;
    }
  }

  console.log({ ok, fail });
  if (fails.length) console.log(fails);

  const { data: verify, error: ve } = await sb
    .from('crm_pharmacy_invoices')
    .select('price_list, total, amount_paid, pharmacy_name, region')
    .like('invoice_number', 'PHI-NEW-%');
  if (ve) throw ve;
  console.log('VERIFY new:', {
    count: verify.length,
    total: Math.round(verify.reduce((s, r) => s + Number(r.total || 0), 0)),
    collected: Math.round(verify.reduce((s, r) => s + Number(r.amount_paid || 0), 0) * 10) / 10,
    pharmacies: verify.map((r) => r.pharmacy_name + ' (' + r.region + ')'),
  });

  const { count: oldCount } = await sb
    .from('crm_pharmacy_invoices')
    .select('id', { count: 'exact', head: true })
    .eq('price_list', 'old');
  console.log('old prices still in DB:', oldCount);

  process.exit(fail ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
