/** Reconcile pharmacy invoice Remain vs Excel (old + new). */
'use strict';
const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
const { execSync } = require('child_process');

const URL = 'https://ikryeyqrithikabwidov.supabase.co';
const KEY = fs
  .readFileSync(path.join(__dirname, '../crm/js/crm-api.js'), 'utf8')
  .match(/SUPABASE_KEY = '([^']+)'/)[1];

const PRODUCTS = [
  { sku: 'post-laser', qi: 1, pi: 2 },
  { sku: 'lotion', qi: 3, pi: 4 },
  { sku: 'w-cleanser', qi: 5, pi: 6 },
  { sku: 'acne', qi: 7, pi: 8 },
  { sku: 'w-cream', qi: 9, pi: 10 },
];

function num(v) {
  if (v === '' || v == null) return 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}
function round2(n) {
  return Math.round(Number(n || 0) * 100) / 100;
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
  if (/^(giza|cairo|alex|alexandria|fayoum|fayum)$/i.test(t)) return true;
  if (/مخازن/.test(t)) return true;
  return false;
}

function parseSheet(rows, priceList) {
  const out = [];
  let lastPharmacy = null;
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    let name = String(r[0] ?? '').trim();
    if (/^total$/i.test(name)) break;
    if (name && isRegionHeader(name, r)) {
      lastPharmacy = null;
      continue;
    }
    const total = num(r[14]) || num(r[12]);
    const paid = num(r[15]);
    const remainCol = num(r[16]);
    const bottles = num(r[17]);
    const qtySum = PRODUCTS.reduce((s, p) => s + num(r[p.qi]), 0);
    const hasActivity = bottles > 0 || total > 0 || qtySum > 0 || paid > 0 || remainCol !== 0;
    if (!hasActivity) continue;
    const continued = !name;
    if (continued) {
      if (!lastPharmacy) continue;
      name = lastPharmacy;
    } else lastPharmacy = name;

    const calcRemain = round2(total - paid);
    out.push({
      pharmacy_name: name,
      total: round2(total),
      amount_paid: round2(paid),
      remain_excel: round2(remainCol),
      remain_calc: calcRemain,
      remain_diff: round2(remainCol - calcRemain),
      price_list: priceList,
      row: i + 1,
      continued,
    });
  }
  return out;
}

async function fetchAllDb(sb) {
  // page through invoices
  const all = [];
  let from = 0;
  const page = 500;
  while (true) {
    const { data, error } = await sb
      .from('crm_pharmacy_invoices')
      .select(
        'id,invoice_number,pharmacy_name,region,total,amount_paid,status,price_list,is_legacy',
      )
      .neq('status', 'cancelled')
      .order('invoice_number')
      .range(from, from + page - 1);
    if (error) throw error;
    all.push(...(data || []));
    if (!data || data.length < page) break;
    from += page;
  }
  return all.map((r) => ({
    ...r,
    remaining: round2(Math.max(Number(r.total || 0) - Number(r.amount_paid || 0), 0)),
    remaining_signed: round2(Number(r.total || 0) - Number(r.amount_paid || 0)),
  }));
}

async function main() {
  const oldPath = 'c:/Users/mo-ab/Desktop/new/pharmacies per bottle old prices.xlsx';
  const newPath = 'c:/Users/mo-ab/Desktop/new/pharmacies per bottle new prices.xlsx';

  const oldWb = XLSX.readFile(oldPath);
  const newWb = XLSX.readFile(newPath);
  const oldRows = XLSX.utils.sheet_to_json(oldWb.Sheets.total, { header: 1, defval: '' });
  const newSheet = newWb.Sheets.total || newWb.Sheets.Sheet1 || newWb.Sheets[newWb.SheetNames[0]];
  const newRows = XLSX.utils.sheet_to_json(newSheet, { header: 1, defval: '' });

  const excelOld = parseSheet(oldRows, 'old');
  const excelNew = parseSheet(newRows, 'new');
  const excel = [...excelOld, ...excelNew];

  const sum = (arr, k) => round2(arr.reduce((s, r) => s + Number(r[k] || 0), 0));

  console.log('=== EXCEL (from Remain column) ===');
  console.log({
    old: {
      n: excelOld.length,
      total: sum(excelOld, 'total'),
      collection: sum(excelOld, 'amount_paid'),
      remain_col: sum(excelOld, 'remain_excel'),
      remain_calc: sum(excelOld, 'remain_calc'),
    },
    new: {
      n: excelNew.length,
      total: sum(excelNew, 'total'),
      collection: sum(excelNew, 'amount_paid'),
      remain_col: sum(excelNew, 'remain_excel'),
      remain_calc: sum(excelNew, 'remain_calc'),
    },
    all: {
      n: excel.length,
      total: sum(excel, 'total'),
      collection: sum(excel, 'amount_paid'),
      remain_col: sum(excel, 'remain_excel'),
      remain_calc: sum(excel, 'remain_calc'),
    },
  });

  const excelRemainMismatch = excel.filter((r) => Math.abs(r.remain_diff) > 0.02);
  console.log('Excel rows where Remain ≠ Total-Collection:', excelRemainMismatch.length);
  if (excelRemainMismatch.length) {
    console.log(excelRemainMismatch.slice(0, 15));
  }

  const sb = createClient(URL, KEY);
  const { error: loginErr } = await sb.auth.signInWithPassword({
    email: 'owner@montana.com',
    password: 'Mont@na2026',
  });
  if (loginErr) throw loginErr;

  const db = await fetchAllDb(sb);
  const dbOld = db.filter((r) => (r.price_list || 'new') === 'old');
  const dbNew = db.filter((r) => (r.price_list || 'new') === 'new');

  console.log('\n=== DATABASE ===');
  console.log({
    old: {
      n: dbOld.length,
      total: sum(dbOld, 'total'),
      collection: sum(dbOld, 'amount_paid'),
      remain_pos: sum(dbOld, 'remaining'),
      remain_signed: sum(dbOld, 'remaining_signed'),
    },
    new: {
      n: dbNew.length,
      total: sum(dbNew, 'total'),
      collection: sum(dbNew, 'amount_paid'),
      remain_pos: sum(dbNew, 'remaining'),
      remain_signed: sum(dbNew, 'remaining_signed'),
    },
    all: {
      n: db.length,
      total: sum(db, 'total'),
      collection: sum(db, 'amount_paid'),
      remain_pos: sum(db, 'remaining'),
      remain_signed: sum(db, 'remaining_signed'),
      status_paid: db.filter((r) => r.status === 'paid').length,
      overpaid: db.filter((r) => r.remaining_signed < -0.02).length,
    },
  });

  const { data: dash } = await sb.rpc('get_owner_dashboard', { p_year: 2026, p_month: 7 });
  console.log('\n=== OWNER DASH pharmacy_ar ===', dash?.pharmacy_ar);

  // Match by pharmacy+total+paid roughly
  const key = (r) =>
    `${String(r.pharmacy_name || '').toLowerCase().trim()}|${round2(r.total)}|${round2(r.amount_paid)}`;

  const excelMap = new Map();
  for (const r of excel) {
    const k = key(r);
    if (!excelMap.has(k)) excelMap.set(k, []);
    excelMap.get(k).push(r);
  }
  const dbMap = new Map();
  for (const r of db) {
    const k = key(r);
    if (!dbMap.has(k)) dbMap.set(k, []);
    dbMap.get(k).push(r);
  }

  const onlyExcel = [];
  const onlyDb = [];
  const remainMismatches = [];

  for (const [k, list] of excelMap) {
    const dlist = dbMap.get(k) || [];
    if (dlist.length !== list.length) {
      onlyExcel.push({ k, excelN: list.length, dbN: dlist.length, sample: list[0] });
    } else {
      for (let i = 0; i < list.length; i++) {
        const ex = list[i];
        const d = dlist[i];
        const wantRemain = ex.remain_excel; // trust Excel Remain column
        if (Math.abs(d.remaining_signed - wantRemain) > 0.05 && Math.abs(d.remaining - Math.max(wantRemain, 0)) > 0.05) {
          remainMismatches.push({
            pharmacy: ex.pharmacy_name,
            excelRemain: wantRemain,
            dbRemain: d.remaining_signed,
            dbPos: d.remaining,
            total: ex.total,
            paid: ex.amount_paid,
            inv: d.invoice_number,
            status: d.status,
          });
        }
      }
    }
  }
  for (const [k, list] of dbMap) {
    if (!excelMap.has(k)) onlyDb.push({ k, n: list.length, sample: list[0] });
  }

  console.log('\n=== MATCH ISSUES ===');
  console.log('key count mismatches excel vs db:', onlyExcel.length);
  console.log(onlyExcel.slice(0, 20));
  console.log('db rows without excel key:', onlyDb.length);
  console.log(onlyDb.slice(0, 20));
  console.log('remain mismatches (matched keys):', remainMismatches.length);
  console.log(remainMismatches.slice(0, 30));

  // Overpaid in DB
  const over = db.filter((r) => r.remaining_signed < -0.02);
  console.log('\nOverpaid DB invoices:', over.length);
  over.slice(0, 20).forEach((r) =>
    console.log(r.invoice_number, r.pharmacy_name, 'tot', r.total, 'paid', r.amount_paid, 'signed', r.remaining_signed),
  );

  // KPI formula check
  const excelRemainCol = sum(excel, 'remain_excel');
  const dashRemain = Number(dash?.pharmacy_ar?.remaining_all || 0);
  console.log('\n=== KPI TARGET ===');
  console.log({
    excel_remain_column_sum: excelRemainCol,
    dash_remaining_all: dashRemain,
    diff: round2(dashRemain - excelRemainCol),
    note: 'Owner KPI should match Excel Remain column sum',
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
