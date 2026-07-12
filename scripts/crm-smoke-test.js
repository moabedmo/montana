// CRM smoke test — run: node scripts/crm-smoke-test.js
'use strict';
const { createClient } = require('@supabase/supabase-js');

const URL = 'https://ikryeyqrithikabwidov.supabase.co';
const ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlrcnlleXFyaXRoaWthYndpZG92Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE3MzY1ODcsImV4cCI6MjA5NzMxMjU4N30.kNfHPxV4fq67cOF8uFsTrLOxPYcLcmmDO3ScIHzI9Uo';
const ADMIN_EMAIL = 'admin@montana-crm.com';
const ADMIN_PASS = 'Montana@CRM#2026!';

const sb = createClient(URL, ANON);

async function check(label, fn) {
  try {
    await fn();
    console.log('✓', label);
    return true;
  } catch (e) {
    console.error('✗', label, '—', e.message || e);
    return false;
  }
}

(async () => {
  console.log('\nMontana CRM — Smoke Test\n');
  let ok = 0, fail = 0;

  const run = async (label, fn) => (await check(label, fn) ? ok++ : fail++);

  await run('Admin login', async () => {
    const { error } = await sb.auth.signInWithPassword({ email: ADMIN_EMAIL, password: ADMIN_PASS });
    if (error) throw error;
  });

  await run('is_crm_admin RPC', async () => {
    const { data, error } = await sb.rpc('is_crm_admin');
    if (error) throw error;
    if (!data) throw new Error('expected true');
  });

  await run('Bricks loaded (IMS)', async () => {
    const { data, error } = await sb.from('crm_bricks').select('id', { count: 'exact', head: true });
    if (error) throw error;
    if ((data ?? null) === null) { /* head request */ }
    const { count, error: cErr } = await sb.from('crm_bricks').select('*', { count: 'exact', head: true });
    if (cErr) throw cErr;
    if ((count || 0) < 100) throw new Error(`only ${count} bricks — expected ~148`);
  });

  await run('Doctors loaded', async () => {
    const { count, error } = await sb.from('crm_doctors').select('*', { count: 'exact', head: true });
    if (error) throw error;
    if ((count || 0) < 1000) throw new Error(`only ${count} doctors`);
    console.log(`  → ${count} doctors in DB`);
  });

  await run('Leaderboard view', async () => {
    const { data, error } = await sb.from('crm_leaderboard').select('*').limit(5);
    if (error) throw error;
    if (!Array.isArray(data)) throw new Error('no data');
  });

  await run('crm_day_logs table', async () => {
    const { error } = await sb.from('crm_day_logs').select('id').limit(1);
    if (error) throw error;
  });

  await run('crm_generate_plan RPC exists', async () => {
    const { error } = await sb.rpc('crm_generate_plan');
    // may return error "no rep" but function must exist
    if (error && /Could not find the function|schema cache/i.test(error.message)) throw error;
  });

  await run('Visit columns (time_of_day)', async () => {
    const { error } = await sb.from('crm_visits').select('time_of_day, visit_type').limit(1);
    if (error) throw error;
  });

  await run('admin-users function reachable', async () => {
    const { data, error } = await sb.functions.invoke('admin-users', {
      body: { action: 'noop' }
    });
    if (error && !/Unknown action|400/i.test(error.message || '')) {
      const msg = await (async () => { try { return (await error.context?.json())?.error; } catch { return null; } })();
      if (msg !== 'Unknown action') throw error;
    }
    if (data?.error && data.error !== 'Unknown action') throw new Error(data.error);
  });

  console.log(`\nResult: ${ok} passed, ${fail} failed\n`);
  process.exit(fail ? 1 : 0);
})();
