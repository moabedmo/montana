/** Sync Excel Bonus column onto existing pharmacy invoices (display only for legacy). */
'use strict';
const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');
const { createClient } = require('@supabase/supabase-js');

const URL = 'https://ikryeyqrithikabwidov.supabase.co';
const KEY = fs.readFileSync(path.join(__dirname, '../crm/js/crm-api.js'), 'utf8').match(/SUPABASE_KEY = '([^']+)'/)[1];
const SRC = process.argv[2] || 'c:/Users/mo-ab/Desktop/new/pharmacies per bottle old prices.xlsx';

function num(v) {
  if (v === '' || v == null) return 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

async function main() {
  const wb = XLSX.readFile(SRC);
  const data = XLSX.utils.sheet_to_json(wb.Sheets.total || wb.Sheets[wb.SheetNames[0]], { header: 1, defval: '' });
  const bonusByName = {};
  for (let i = 1; i < data.length; i++) {
    const r = data[i];
    const name = String(r[0] ?? '').trim();
    if (!name || /^total$/i.test(name)) continue;
    const bonus = num(r[18]);
    if (bonus > 0) bonusByName[name.toLowerCase()] = (bonusByName[name.toLowerCase()] || 0) + bonus;
  }
  console.log('Excel bonus entries', bonusByName);

  const sb = createClient(URL, KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  const { error: loginErr } = await sb.auth.signInWithPassword({
    email: 'owner@montana.com',
    password: 'Mont@na2026',
  });
  if (loginErr) throw loginErr;

  let updated = 0;
  for (const [key, bonus] of Object.entries(bonusByName)) {
    const { data: rows, error } = await sb
      .from('crm_pharmacy_invoices')
      .select('id, pharmacy_name, invoice_number, bonus')
      .ilike('pharmacy_name', key);
    if (error) throw error;
    // Prefer exact case-insensitive match
    const matches = (rows || []).filter((r) => String(r.pharmacy_name || '').trim().toLowerCase() === key);
    const list = matches.length ? matches : rows || [];
    for (const inv of list) {
      const { error: uErr } = await sb
        .from('crm_pharmacy_invoices')
        .update({ bonus, bonus_stock_deducted: false })
        .eq('id', inv.id);
      if (uErr) throw uErr;
      console.log('updated', inv.invoice_number, inv.pharmacy_name, '→', bonus);
      updated++;
    }
  }
  console.log('Done. Updated', updated);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
