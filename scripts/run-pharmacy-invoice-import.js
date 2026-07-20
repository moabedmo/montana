/** One-shot: import pharmacy-invoices-legacy.json into Supabase as admin. */
'use strict';
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const URL = 'https://ikryeyqrithikabwidov.supabase.co';
const ANON =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlrcnlleXFyaXRoaWthYndpZG92Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE3MzY1ODcsImV4cCI6MjA5NzMxMjU4N30.kNfHPxV4fq67cOF8uFsTrLOxPYcLcmmDO3ScIHzI9Uo';
const ADMIN_EMAIL = 'admin@montana-crm.com';
const ADMIN_PASS = 'Montana@CRM#2026!';

const sb = createClient(URL, ANON);

async function main() {
  const { error: authErr } = await sb.auth.signInWithPassword({
    email: ADMIN_EMAIL,
    password: ADMIN_PASS,
  });
  if (authErr) throw authErr;
  console.log('logged in');

  const { error: pe } = await sb.from('crm_pharmacy_invoices').select('id').limit(1);
  if (pe) {
    console.error('TABLE ERROR:', pe.message);
    console.error('Run migration 084_crm_pharmacy_invoices.sql in Supabase SQL Editor first.');
    process.exit(2);
  }

  // Delete previous legacy in pages
  let deleted = 0;
  for (;;) {
    const { data: legacy, error: le } = await sb
      .from('crm_pharmacy_invoices')
      .select('id')
      .like('invoice_number', 'PHI-LEGACY-%')
      .limit(200);
    if (le) throw le;
    if (!legacy || !legacy.length) break;
    for (const row of legacy) {
      const { error } = await sb.from('crm_pharmacy_invoices').delete().eq('id', row.id);
      if (error) throw error;
      deleted++;
    }
  }
  console.log('deleted legacy:', deleted);

  const rows = JSON.parse(
    fs.readFileSync(path.join(__dirname, '../crm/data/pharmacy-invoices-legacy.json'), 'utf8'),
  );
  console.log('importing', rows.length);

  let ok = 0;
  let fail = 0;
  const fails = [];
  for (let i = 0; i < rows.length; i++) {
    const inv = rows[i];
    const number = 'PHI-LEGACY-' + String(i + 1).padStart(4, '0');
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
      is_legacy: true,
      notes:
        'Imported from Excel (' +
        inv.sheet +
        ' row ' +
        inv.row +
        (inv.continued ? ' · continuation' : '') +
        ')',
    });
    if (error) {
      fail++;
      fails.push(number + ': ' + error.message);
    } else {
      ok++;
    }
    if ((i + 1) % 25 === 0) console.log('progress', i + 1);
  }

  console.log({ ok, fail });
  if (fails.length) console.log(fails.slice(0, 15));

  const { data: verify, error: ve } = await sb
    .from('crm_pharmacy_invoices')
    .select('total, amount_paid, pharmacy_name, region')
    .like('invoice_number', 'PHI-LEGACY-%')
    .limit(1000);
  if (ve) throw ve;

  const tot = (verify || []).reduce((s, r) => s + Number(r.total || 0), 0);
  const paidSum = (verify || []).reduce((s, r) => s + Number(r.amount_paid || 0), 0);
  const juvia = (verify || []).filter((r) => String(r.pharmacy_name).toLowerCase() === 'juvia');
  const regions = [...new Set((verify || []).map((r) => r.region))];
  console.log('VERIFY', {
    count: verify.length,
    total: Math.round(tot),
    collected: Math.round(paidSum * 10) / 10,
    remain: Math.round(tot - paidSum),
    regions,
    juviaInvoices: juvia.length,
  });

  process.exit(fail ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
