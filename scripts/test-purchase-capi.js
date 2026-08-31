/**
 * E2E: create COD order → fire server Purchase via /api/send-telegram
 * then fire browser-style CAPI with same event_id (dedupe check).
 * Run: node scripts/test-purchase-capi.js
 */
const { createClient } = require('@supabase/supabase-js');
const { hashPhone, hash, sendPurchaseEvent, sendCapiEvent } = require('../lib/metaCapi');

const URL = 'https://ikryeyqrithikabwidov.supabase.co';
const ANON =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlrcnlleXFyaXRoaWthYndpZG92Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE3MzY1ODcsImV4cCI6MjA5NzMxMjU4N30.kNfHPxV4fq67cOF8uFsTrLOxPYcLcmmDO3ScIHzI9Uo';
const SITE = 'https://www.montana.com.eg';

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

async function createOrder(label) {
  const sb = createClient(URL, ANON);
  const phone = '010' + String(Math.floor(10000000 + Math.random() * 89999999));
  const { data, error } = await sb.rpc('create_guest_order', {
    p_customer: {
      name: `CAPI Test ${label}`,
      phone,
      email: null,
      address: 'شارع اختبار Meta',
      city: 'القاهرة',
    },
    p_items: [{ id: 3, name: 'كريم التفتيح', image: '', price: 249, qty: 1 }],
    p_payment_method: 'cod',
    p_delivery_method: 'standard',
    p_coupon_code: null,
    p_notes: `purchase-capi-test-${label}`,
    p_subtotal: 249,
    p_shipping_cost: 0,
    p_discount: 0,
    p_total: 249,
    p_governorate: 'cairo',
    p_payment_proof_url: null,
    p_deposit_amount: 0,
    p_points_redeemed: 0,
  });
  if (error) throw error;
  assert(data?.order?.id, 'missing order.id');
  assert(data?.order?.order_number, 'missing order_number');
  return { ...data, phone };
}

async function notifyTelegram(orderPayload) {
  const res = await fetch(`${SITE}/api/send-telegram`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Origin: SITE,
    },
    body: JSON.stringify(orderPayload),
  });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, json };
}

async function main() {
  console.log('--- phone normalize ---');
  const ph = hashPhone('01012345678');
  const expectedDigits = '201012345678';
  const expectedHash = hash(expectedDigits);
  assert(ph === expectedHash, `phone hash mismatch: got ${ph}`);
  console.log('phone ok:', expectedDigits, '→', ph.slice(0, 12) + '…');

  // Need env on this machine for direct sendPurchaseEvent — otherwise hit prod HTTP.
  const hasLocalToken = !!(process.env.FB_CAPI_ACCESS_TOKEN && process.env.NEXT_PUBLIC_FB_PIXEL_ID);
  console.log('local CAPI env:', hasLocalToken);

  console.log('\n--- order 1 (server Purchase via send-telegram) ---');
  const o1 = await createOrder('A');
  console.log('created', o1.order.order_number, 'id', o1.order.id, 'total', o1.order.total);

  const tg1 = await notifyTelegram({
    order_number: o1.order.order_number,
    order_id: o1.order.id,
    total: o1.order.total,
    customer_name: o1.order.customer_name,
    customer_phone: o1.phone,
    city: 'القاهرة',
    governorate: 'cairo',
    payment_method: 'cod',
    content_ids: ['whitening-cream'],
    items: [{ id: 3, slug: 'whitening-cream', qty: 1, price: 249 }],
    event_source_url: `${SITE}/checkout.html`,
  });
  console.log('send-telegram', tg1.status, tg1.json);
  assert(tg1.status === 200 && tg1.json.ok, 'telegram notify failed');

  // Simulate browser confirmation CAPI with SAME event_id (dedupe)
  console.log('\n--- order 1 browser-style CAPI (same event_id) ---');
  const browser1 = await fetch(`${SITE}/api/meta-capi`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: SITE },
    body: JSON.stringify({
      eventName: 'Purchase',
      eventId: `purchase-${o1.order.id}`,
      eventSourceUrl: `${SITE}/order-confirmation.html`,
      customData: {
        content_ids: ['whitening-cream'],
        content_type: 'product',
        value: Number(o1.order.total),
        currency: 'EGP',
        num_items: 1,
      },
      userData: {
        phone: o1.phone,
        firstName: 'CAPI',
        lastName: 'Test',
        city: 'القاهرة',
      },
    }),
  });
  const b1 = await browser1.json();
  console.log('browser CAPI', browser1.status, b1);
  assert(b1.ok, 'browser CAPI failed');

  console.log('\n--- order 2 (server only — FB in-app simulation) ---');
  const o2 = await createOrder('B');
  console.log('created', o2.order.order_number, 'id', o2.order.id);

  const tg2 = await notifyTelegram({
    order_number: o2.order.order_number,
    order_id: o2.order.id,
    total: o2.order.total,
    customer_name: o2.order.customer_name,
    customer_phone: o2.phone,
    city: 'الجيزة',
    payment_method: 'cod',
    content_ids: ['whitening-cream'],
    items: [{ id: 3, slug: 'whitening-cream', qty: 1 }],
  });
  console.log('send-telegram', tg2.status, tg2.json);
  assert(tg2.status === 200 && tg2.json.ok, 'telegram notify 2 failed');

  console.log('\n=== RESULTS ===');
  console.log('1. Order rows created in Supabase: YES', o1.order.order_number, o2.order.order_number);
  console.log('2. Server Purchase fired via send-telegram after insert: YES (check Vercel logs + Events Manager)');
  console.log('3. Browser CAPI with same event_id accepted: YES', `purchase-${o1.order.id}`);
  console.log('4. Two orders → two distinct event_ids:', `purchase-${o1.order.id}`, `purchase-${o2.order.id}`);
  console.log('\nCheck Meta Events Manager Test Events / Overview for Purchase value=249 EGP.');
  console.log('Order1 should show as ONE Purchase (server+browser deduped).');
  console.log('Order2 should show as ONE Purchase (server only).');
}

main().catch((e) => {
  console.error('FAIL', e);
  process.exit(1);
});
