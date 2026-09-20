// The duplicate-reply guard.
//
// A customer sent "تمام" and got the same reply twice. The guard was a Map in
// api/chat.js, which cannot see a repeat that lands on a second lambda
// instance — and a repeat arriving while the first request is still running its
// model call always does. The claim moved to Postgres; this covers the parts
// that hold without a database, including the rule that matters most: every
// failure path lets the message through.
const assert = require('assert');

// no SERVICE_ROLE here, so the module runs its local-only path
delete process.env.SERVICE_ROLE;
delete process.env.SUPABASE_SERVICE_ROLE_KEY;

const { claimInbound, releaseInbound, inboundKey } = require('../lib/inboundDedup');

(async () => {
  const sid = 'instagram:100001';

  // 1 — the same text twice in a row is one answer
  const k = inboundKey(sid, 'تمام');
  assert.strictEqual(await claimInbound(k), true, 'first send must be answered');
  assert.strictEqual(await claimInbound(k), false, 'immediate repeat must be swallowed');

  // 2 — a different customer saying the same thing is their own message
  const other = inboundKey('instagram:100002', 'تمام');
  assert.strictEqual(await claimInbound(other), true, 'another sid must not be blocked');

  // 3 — a different message from the same customer is a new question
  const next = inboundKey(sid, 'عايزة اطلب');
  assert.strictEqual(await claimInbound(next), true, 'different text must be answered');

  // 4 — releasing after a failed turn lets ManyChat's retry through, which is
  // the whole reason release exists
  await releaseInbound(k);
  assert.strictEqual(await claimInbound(k), true, 'retry after release must be answered');

  // 5 — an empty key never blocks
  assert.strictEqual(await claimInbound(''), true, 'empty key must not block');
  assert.strictEqual(await claimInbound(null), true, 'null key must not block');

  // 6 — the key carries both sid and text, so neither alone can collide
  assert.ok(inboundKey(sid, 'تمام').includes(sid));
  assert.ok(inboundKey(sid, 'تمام').includes('تمام'));
  assert.notStrictEqual(inboundKey(sid, 'تمام'), inboundKey(sid, 'تمام '.repeat(2)));

  // 7 — long text is truncated the same way on both sides, so a repeat of a
  // very long message still matches itself
  const long = 'ا'.repeat(1000);
  assert.strictEqual(inboundKey(sid, long), inboundKey(sid, long));
  assert.ok(inboundKey(sid, long).length < 400);

  console.log('PASS inbound dedup — 7 checks');
})().catch((err) => {
  console.error('FAIL', err.message);
  process.exit(1);
});
