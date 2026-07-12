// Run after CRM migrations: node setup_admin.js
// Creates or resets the CRM admin (no email link required when SERVICE_ROLE key is set).
//
//   $env:SUPABASE_SERVICE_ROLE_KEY="<from Supabase Dashboard → Settings → API>"
//   node setup_admin.js
'use strict';

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://ikryeyqrithikabwidov.supabase.co';
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlrcnlleXFyaXRoaWthYndpZG92Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE3MzY1ODcsImV4cCI6MjA5NzMxMjU4N30.kNfHPxV4fq67cOF8uFsTrLOxPYcLcmmDO3ScIHzI9Uo';

const ADMIN_EMAIL    = 'admin@montana-crm.com';
const ADMIN_PASSWORD = 'Montana@CRM#2026!';
const ADMIN_NAME     = 'Montana Admin';

const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const sb = createClient(SUPABASE_URL, serviceKey || ANON_KEY);
const admin = serviceKey ? createClient(SUPABASE_URL, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
}) : null;

async function findUserByEmail(email) {
  if (!admin) return null;
  let page = 1;
  while (true) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const hit = data.users.find(u => u.email?.toLowerCase() === email.toLowerCase());
    if (hit) return hit;
    if (data.users.length < 200) return null;
    page += 1;
  }
}

(async () => {
  console.log('\n Montana CRM — Admin Setup\n');

  const { error: tableErr } = await sb.from('crm_reps').select('id').limit(1);
  if (tableErr) {
    console.error('✗  Migration not run yet!');
    console.error('   Open https://supabase.com/dashboard/project/ikryeyqrithikabwidov/sql/new');
    console.error('   Paste supabase/migrations/002_crm_schema.sql and click Run.');
    process.exit(1);
  }
  console.log('✓  Database tables found.');

  let userId;

  if (admin) {
    const existing = await findUserByEmail(ADMIN_EMAIL);
    if (existing) {
      const { data, error } = await admin.auth.admin.updateUserById(existing.id, {
        password: ADMIN_PASSWORD,
        email_confirm: true,
      });
      if (error) {
        console.error('✗  Password reset failed:', error.message);
        process.exit(1);
      }
      userId = data.user.id;
      console.log('✓  Password reset (no email needed):', ADMIN_EMAIL);
    } else {
      const { data, error } = await admin.auth.admin.createUser({
        email: ADMIN_EMAIL,
        password: ADMIN_PASSWORD,
        email_confirm: true,
        user_metadata: { name: ADMIN_NAME },
      });
      if (error) {
        console.error('✗  Create user failed:', error.message);
        process.exit(1);
      }
      userId = data.user.id;
      console.log('✓  Auth user created:', ADMIN_EMAIL);
    }
  } else {
    console.warn('ℹ  No SUPABASE_SERVICE_ROLE_KEY — using anon signUp (may need email confirm).');
    const { error: authErr } = await sb.auth.signUp({
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
    });
    if (authErr && !authErr.message.includes('already registered')) {
      console.error('✗  Auth signUp failed:', authErr.message);
      process.exit(1);
    } else if (authErr) {
      console.log('ℹ  Auth user already exists — set SUPABASE_SERVICE_ROLE_KEY to reset password without email.');
    } else {
      console.log('✓  Auth user created:', ADMIN_EMAIL);
    }

    const { data: signIn, error: signInErr } = await sb.auth.signInWithPassword({
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
    });
    if (signInErr) {
      console.warn('⚠  Could not sign in. Set SUPABASE_SERVICE_ROLE_KEY and re-run this script.');
      process.exit(1);
    }
    userId = signIn.user.id;
    console.log('✓  Auth login verified, user ID:', userId);
  }

  const { error: repErr } = await sb.from('crm_reps').upsert({
    user_id: userId,
    name: ADMIN_NAME,
    email: ADMIN_EMAIL,
    role: 'admin',
    active: true,
  }, { onConflict: 'email' });

  if (repErr) {
    console.error('✗  Failed to upsert crm_reps row:', repErr.message);
    process.exit(1);
  }
  console.log('✓  Admin rep row created/updated.\n');

  console.log('═══════════════════════════════════════');
  console.log('  CRM Admin — sign in directly (no email)');
  console.log('  URL:      https://www.montana.com.eg/crm/');
  console.log('  Tab:      Admin');
  console.log('  Email:    ' + ADMIN_EMAIL);
  console.log('  Password: ' + ADMIN_PASSWORD);
  console.log('═══════════════════════════════════════\n');

  process.exit(0);
})();
