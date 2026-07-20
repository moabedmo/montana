/** Tag all current PHI-LEGACY invoices as old price list. Requires migration 086. */
'use strict';
const { createClient } = require('@supabase/supabase-js');

const URL = 'https://ikryeyqrithikabwidov.supabase.co';
const ANON =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlrcnlleXFyaXRoaWthYndpZG92Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE3MzY1ODcsImV4cCI6MjA5NzMxMjU4N30.kNfHPxV4fq67cOF8uFsTrLOxPYcLcmmDO3ScIHzI9Uo';

const sb = createClient(URL, ANON);

async function main() {
  const { error: authErr } = await sb.auth.signInWithPassword({
    email: 'admin@montana-crm.com',
    password: 'Montana@CRM#2026!',
  });
  if (authErr) throw authErr;

  const { data: probe, error: pe } = await sb
    .from('crm_pharmacy_invoices')
    .select('id, price_list')
    .limit(1);
  if (pe) {
    console.error('ERROR:', pe.message);
    if (/price_list|column/i.test(pe.message)) {
      console.error('\nRun migration 086_pharmacy_invoice_price_list.sql in Supabase SQL Editor first.');
    }
    process.exit(2);
  }

  // Paginate update via select + update
  let updated = 0;
  for (;;) {
    const { data: rows, error } = await sb
      .from('crm_pharmacy_invoices')
      .select('id, invoice_number, is_legacy, price_list')
      .or('is_legacy.eq.true,invoice_number.like.PHI-LEGACY-%')
      .neq('price_list', 'old')
      .limit(200);
    if (error) throw error;
    if (!rows?.length) break;
    for (const r of rows) {
      const { error: ue } = await sb
        .from('crm_pharmacy_invoices')
        .update({ price_list: 'old' })
        .eq('id', r.id);
      if (ue) throw ue;
      updated++;
    }
  }

  const { data: all, error: ae } = await sb
    .from('crm_pharmacy_invoices')
    .select('price_list, total')
    .limit(1000);
  if (ae) throw ae;
  const oldN = (all || []).filter((r) => r.price_list === 'old').length;
  const newN = (all || []).filter((r) => r.price_list === 'new').length;
  console.log({ updated, old: oldN, new: newN, total: (all || []).length, sample: probe });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
