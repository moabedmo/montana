// Creates or resets the store owner account (owner.html / admin.html access).
// Canonical owner: owner@montana.com — الاسم: خالد
//
//   $env:SUPABASE_SERVICE_ROLE_KEY="<from Supabase Dashboard → Settings → API>"
//   node setup_owner.js
'use strict';

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://ikryeyqrithikabwidov.supabase.co';

const OWNER_EMAIL    = 'owner@montana.com';
const OWNER_PASSWORD = process.env.OWNER_PASSWORD || 'Mont@na2026';
const OWNER_NAME     = 'خالد';

const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!serviceKey) {
  console.error('✗  Set SUPABASE_SERVICE_ROLE_KEY first (Supabase Dashboard → Settings → API).');
  process.exit(1);
}

const admin = createClient(SUPABASE_URL, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function findUserByEmail(email) {
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
  console.log('\n Montana — Store Owner Setup\n');
  console.log('  Account:', OWNER_EMAIL, '·', OWNER_NAME, '\n');

  let userId;
  const existing = await findUserByEmail(OWNER_EMAIL);

  if (existing) {
    const { data, error } = await admin.auth.admin.updateUserById(existing.id, {
      password: OWNER_PASSWORD,
      email_confirm: true,
      user_metadata: { name: OWNER_NAME, full_name: OWNER_NAME },
    });
    if (error) {
      console.error('✗  Password reset failed:', error.message);
      process.exit(1);
    }
    userId = data.user.id;
    console.log('✓  Password + name updated:', OWNER_EMAIL);
  } else {
    const { data, error } = await admin.auth.admin.createUser({
      email: OWNER_EMAIL,
      password: OWNER_PASSWORD,
      email_confirm: true,
      user_metadata: { name: OWNER_NAME, full_name: OWNER_NAME },
    });
    if (error) {
      console.error('✗  Create user failed:', error.message);
      process.exit(1);
    }
    userId = data.user.id;
    console.log('✓  Auth user created:', OWNER_EMAIL);
  }

  const { error: adminErr } = await admin.from('store_admins').upsert({
    user_id: userId,
    email: OWNER_EMAIL,
    active: true,
  }, { onConflict: 'user_id' });

  if (adminErr) {
    console.error('✗  store_admins upsert failed:', adminErr.message);
    process.exit(1);
  }
  console.log('✓  store_admins row created/updated.');

  const { error: ownerErr } = await admin.from('store_owners').upsert({
    user_id: userId,
    email: OWNER_EMAIL,
    active: true,
  }, { onConflict: 'user_id' });

  if (ownerErr) {
    console.error('✗  store_owners upsert failed:', ownerErr.message);
    process.exit(1);
  }
  console.log('✓  store_owners row created/updated.\n');

  console.log('═══════════════════════════════════════');
  console.log('  Owner login');
  console.log('  Page:     https://www.montana.com.eg/owner-login.html');
  console.log('  Email:    ' + OWNER_EMAIL);
  console.log('  Name:     ' + OWNER_NAME);
  console.log('  Password: ' + OWNER_PASSWORD);
  console.log('═══════════════════════════════════════\n');

  process.exit(0);
})();
