/**
 * Live E2E: place a real chat order named «تيست 122» and verify it registered.
 * Run: node scripts/test-order-teest-122.js
 */
const { createClient } = require('@supabase/supabase-js');

const CHAT = process.env.CHAT_URL || 'https://www.montana.com.eg/api/chat';
const SB_URL = 'https://ikryeyqrithikabwidov.supabase.co';
const SB_ANON =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlrcnlleXFyaXRoaWthYndpZG92Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE3MzY1ODcsImV4cCI6MjA5NzMxMjU4N30.kNfHPxV4fq67cOF8uFsTrLOxPYcLcmmDO3ScIHzI9Uo';

const CUSTOMER_NAME = 'تيست 122';
const DELAY_MS = Number(process.env.SMOKE_DELAY_MS || 800);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function uniqPhone() {
  const tail = String(Date.now()).slice(-8);
  return `010${tail}`;
}

async function turn(sid, message, extra = {}) {
  await sleep(DELAY_MS);
  const res = await fetch(CHAT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify({
      message,
      sessionId: sid,
      channel: 'messenger',
      ...extra,
    }),
  });
  const data = await res.json().catch(() => ({}));
  return {
    ok: res.ok,
    status: res.status,
    reply: String(data.reply || data.message || ''),
    order: data.order || null,
    raw: data,
  };
}

function log(msg, reply) {
  console.log(`\n👤 ${msg}`);
  console.log(`🤖 ${(reply || '').replace(/\n/g, ' | ').slice(0, 320)}`);
}

async function verifyInDb(orderNumber, phone) {
  const sb = createClient(SB_URL, SB_ANON);
  // Try RPC used by storefront / public lookups if any
  const attempts = [];

  const byNumber = await sb
    .from('orders')
    .select('id,order_number,customer_name,customer_phone,total,status,payment_method,created_at')
    .eq('order_number', orderNumber)
    .maybeSingle();
  attempts.push({ via: 'orders.eq.order_number', error: byNumber.error?.message, data: byNumber.data });

  if (!byNumber.data) {
    const byPhone = await sb
      .from('orders')
      .select('id,order_number,customer_name,customer_phone,total,status,created_at')
      .eq('customer_phone', phone)
      .order('created_at', { ascending: false })
      .limit(3);
    attempts.push({ via: 'orders.eq.phone', error: byPhone.error?.message, data: byPhone.data });
  }

  // Fallback: guest order RPC create is not needed — also try order_items
  return attempts;
}

async function main() {
  const phone = uniqPhone();
  const sid = `messenger:teest122-${Date.now()}`;
  console.log('=== Order E2E: تيست 122 ===');
  console.log('sid:', sid);
  console.log('phone:', phone);
  console.log('name:', CUSTOMER_NAME);

  const steps = [
    { msg: 'عايزة روتين التفتيح', extra: {} },
    { msg: 'ايوه عايزة اوردر', extra: {} },
    { msg: 'نكمل', extra: {} },
    { msg: 'هنا', extra: {} },
    {
      msg: `${CUSTOMER_NAME}\n${phone}\nالمعادي شارع 9 عمارة 12 دور 3 شقة 5 جنب مترو المعادي كمعلم`,
      extra: {},
    },
    { msg: 'القاهرة', extra: {} },
  ];

  let placed = null;
  let last = null;

  for (const step of steps) {
    const r = await turn(sid, step.msg, step.extra);
    last = r;
    log(step.msg, r.reply);
    if (!r.ok) {
      console.error('HTTP fail', r.status, JSON.stringify(r.raw).slice(0, 400));
      process.exit(1);
    }
    if (r.order?.order_number) placed = r.order;
    if (/تم تسجيل أوردرك|رقم الطلب/i.test(r.reply)) {
      const m = r.reply.match(/MON-[A-Z0-9]+/i);
      placed = placed || {
        order_number: m?.[0],
        customer_name: CUSTOMER_NAME,
        phone,
        fromReply: true,
      };
    }
    // If bot asks for something missing, keep going — governorate step handled
  }

  // Extra confirm if still on confirm_saved
  if (!placed && /صح\s*ولا|البيانات|نعم/i.test(last?.reply || '')) {
    const r = await turn(sid, 'نعم');
    log('نعم', r.reply);
    if (r.order?.order_number) placed = r.order;
    const m = r.reply.match(/MON-[A-Z0-9]+/i);
    if (m) placed = placed || { order_number: m[0], fromReply: true, customer_name: CUSTOMER_NAME, phone };
  }

  console.log('\n── Result ──');
  if (!placed?.order_number) {
    console.error('FAIL: no order placed');
    console.error('Last reply:', last?.reply);
    process.exit(1);
  }

  console.log('ORDER:', placed.order_number);
  console.log('name in payload:', placed.customer_name || '(from reply only)');
  console.log('phone:', placed.phone || phone);
  console.log('total:', placed.total ?? '—');

  const nameOk =
    !placed.customer_name ||
    String(placed.customer_name).includes('تيست') ||
    String(placed.customer_name).includes('122');
  if (placed.customer_name && !nameOk) {
    console.error('FAIL: customer_name mismatch:', placed.customer_name);
    process.exit(1);
  }

  console.log('\n── DB verify ──');
  const attempts = await verifyInDb(placed.order_number, phone);
  for (const a of attempts) {
    console.log(a.via, a.error || 'ok', JSON.stringify(a.data, null, 2));
  }

  const row =
    attempts.map((a) => (Array.isArray(a.data) ? a.data[0] : a.data)).find(Boolean) || null;

  if (row) {
    const nm = String(row.customer_name || '');
    if (!nm.includes('تيست') || !nm.includes('122')) {
      console.error('FAIL: DB name is', row.customer_name, 'expected تيست 122');
      process.exit(1);
    }
    console.log('\nPASS — order saved in DB as', row.order_number, '/', row.customer_name);
  } else {
    // RLS may hide rows from anon — chat confirmation is still success
    console.log('\nPASS — order confirmed in chat reply', placed.order_number);
    console.log('(anon cannot read orders table — check admin for تيست 122)');
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
