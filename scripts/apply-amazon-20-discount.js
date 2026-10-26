const { createClient } = require('@supabase/supabase-js');

const URL = 'https://ikryeyqrithikabwidov.supabase.co';
const KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlrcnlleXFyaXRoaWthYndpZG92Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE3MzY1ODcsImV4cCI6MjA5NzMxMjU4N30.kNfHPxV4fq67cOF8uFsTrLOxPYcLcmmDO3ScIHzI9Uo';

const PRODUCTS = [
  { name: 'كريم ما بعد الليزر والترميم (50ml)', sku: 'FI-W69W-ODUJ', type: 'SKIN_MOISTURIZER', oldPrice: 369, newPrice: 295 },
  { name: 'لوشن ترطيب الجسم واليدين (50ml)', sku: '3W-OABS-J13D', type: 'SKIN_MOISTURIZER', oldPrice: 229, newPrice: 183 },
  { name: 'غسول علاج حب الشباب والمسام (200ml)', sku: '38-XWKZ-4HZC', type: 'SKIN_CLEANING_AGENT', oldPrice: 329, newPrice: 263 },
  { name: 'غسول تفتيح ونضارة البشرة (200ml)', sku: 'U7-2W2C-5WPN', type: 'SKIN_CLEANING_AGENT', oldPrice: 299, newPrice: 239 },
  { name: 'كريم تفتيح وإزالة التصبغات (50ml)', sku: 'CG-7HP7-SI29', type: 'SKIN_CLEANING_AGENT', oldPrice: 249, newPrice: 199 },
];

async function applyDiscounts() {
  const sb = createClient(URL, KEY);
  const { data: auth } = await sb.auth.signInWithPassword({
    email: 'owner@montana.com',
    password: 'Mont@na2026',
  });

  console.log('=== APPLYING 20% DISCOUNT ON ALL 5 MONTANA PRODUCTS ON AMAZON EGYPT ===\n');

  for (const p of PRODUCTS) {
    const patchPayload = {
      sku: p.sku,
      productType: p.type,
      patches: [
        {
          op: 'replace',
          path: '/attributes/purchasable_offer',
          value: [
            {
              currency: 'EGP',
              audience: 'ALL',
              our_price: [
                {
                  schedule: [
                    {
                      value_with_tax: p.newPrice
                    }
                  ]
                }
              ],
              marketplace_id: 'ARBP9OOSHTCHU'
            }
          ]
        }
      ]
    };

    const res = await fetch('https://www.montana.com.eg/api/integrations-status?action=amazon-listing-patch', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${auth.session.access_token}`,
        'Content-Type': 'application/json',
        apikey: KEY,
      },
      body: JSON.stringify(patchPayload)
    });

    const data = await res.json();
    console.log(`✔ [${p.name}] ${p.oldPrice} EGP ➔ ${p.newPrice} EGP (-20%) | Status:`, data.result?.status || data.error);
  }

  console.log('\n🎉 ALL 5 PRODUCTS UPDATED WITH 20% DISCOUNT SUCCESSFULLY!');
}

applyDiscounts().catch(console.error);
