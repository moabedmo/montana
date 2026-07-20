/** Set bottles from Excel JSON (Total Bottles) onto PHI-LEGACY / PHI-NEW rows. */
'use strict';
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const URL = 'https://ikryeyqrithikabwidov.supabase.co';
const KEY = fs
  .readFileSync(path.join(__dirname, '../crm/js/crm-api.js'), 'utf8')
  .match(/SUPABASE_KEY = '([^']+)'/)[1];

async function main() {
  const legacy = JSON.parse(
    fs.readFileSync(path.join(__dirname, '../crm/data/pharmacy-invoices-legacy.json'), 'utf8'),
  );
  const neu = JSON.parse(
    fs.readFileSync(path.join(__dirname, '../crm/data/pharmacy-invoices-new.json'), 'utf8'),
  );

  const sb = createClient(URL, KEY);
  const { error: loginErr } = await sb.auth.signInWithPassword({
    email: 'owner@montana.com',
    password: 'Mont@na2026',
  });
  if (loginErr) throw loginErr;

  const { data: oldRows, error: e1 } = await sb
    .from('crm_pharmacy_invoices')
    .select('id, invoice_number, pharmacy_name, bottles')
    .like('invoice_number', 'PHI-LEGACY-%')
    .order('invoice_number');
  if (e1) throw e1;

  const { data: newRows, error: e2 } = await sb
    .from('crm_pharmacy_invoices')
    .select('id, invoice_number, pharmacy_name, bottles')
    .like('invoice_number', 'PHI-NEW-%')
    .order('invoice_number');
  if (e2) throw e2;

  if ((oldRows || []).length !== legacy.length) {
    console.warn('LEGACY count mismatch', oldRows?.length, legacy.length);
  }
  if ((newRows || []).length !== neu.length) {
    console.warn('NEW count mismatch', newRows?.length, neu.length);
  }

  let updated = 0;
  async function apply(dbRows, excelRows, label) {
    for (let i = 0; i < Math.min(dbRows.length, excelRows.length); i++) {
      const bottles = Number(excelRows[i].bottles || 0);
      const id = dbRows[i].id;
      if (Number(dbRows[i].bottles || 0) === bottles) continue;
      const { error } = await sb.from('crm_pharmacy_invoices').update({ bottles }).eq('id', id);
      if (error) throw error;
      updated++;
    }
    const sum = excelRows.reduce((s, r) => s + Number(r.bottles || 0), 0);
    console.log(label, 'excel bottles sum', sum, 'rows', excelRows.length);
  }

  await apply(oldRows || [], legacy, 'OLD');
  await apply(newRows || [], neu, 'NEW');

  const { data: check } = await sb
    .from('crm_pharmacy_invoices')
    .select('bottles, price_list')
    .neq('status', 'cancelled');
  const sumAll = (check || []).reduce((s, r) => s + Number(r.bottles || 0), 0);
  const sumOld = (check || [])
    .filter((r) => (r.price_list || 'new') === 'old')
    .reduce((s, r) => s + Number(r.bottles || 0), 0);
  const sumNew = (check || [])
    .filter((r) => (r.price_list || 'new') === 'new')
    .reduce((s, r) => s + Number(r.bottles || 0), 0);
  console.log('Updated rows:', updated);
  console.log('DB bottles:', { sumAll, sumOld, sumNew, expectOld: 3456, expectNew: 202 });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
