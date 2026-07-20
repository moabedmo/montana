'use strict';
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
const URL = 'https://ikryeyqrithikabwidov.supabase.co';
const KEY = fs.readFileSync(path.join(__dirname, '../crm/js/crm-api.js'), 'utf8').match(/SUPABASE_KEY = '([^']+)'/)[1];

(async () => {
  const sb = createClient(URL, KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  await sb.auth.signInWithPassword({ email: 'owner@montana.com', password: 'Mont@na2026' });
  const { data: crm } = await sb.from('crm_products').select('id,name,sku,store_product_id');
  console.log('crm', crm);
  const { data: prod } = await sb.from('products').select('id,name,stock').eq('is_active', true);
  console.log('store', prod);
  const { data: inv } = await sb
    .from('crm_pharmacy_invoices')
    .select('invoice_number,pharmacy_name,bottles,line_items')
    .ilike('pharmacy_name', '%Yehia%')
    .limit(3);
  console.log('yehia', JSON.stringify(inv, null, 2));
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
