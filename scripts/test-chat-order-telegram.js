/**
 * Orders placed through the chat never reached Telegram.
 *
 * The notification was fired from the BROWSER (checkout.html), so any order
 * created server-side by create_order() — Messenger, Instagram, the chat's
 * complete-order.html link, the site widget's order form — was saved to the
 * admin but never announced. create_order() must notify, and must never let a
 * Telegram failure lose an order that is already in the database.
 *
 * Run: node scripts/test-chat-order-telegram.js
 */
const fs = require('fs');
const path = require('path');

const engine = fs.readFileSync(path.join(__dirname, '..', 'lib', 'chatEngine.js'), 'utf8');

let failed = 0;
function assert(cond, label) {
  if (!cond) { failed += 1; console.error('FAIL:', label); } else { console.log('ok:', label); }
}

const start = engine.indexOf('async function create_order(');
assert(start !== -1, 'create_order found');
const body = engine.slice(start, engine.indexOf('\n}', engine.indexOf('return {', start)));

assert(/notifyTelegramOrder\(/.test(body), 'create_order notifies Telegram');
assert(/tgConfigured\(\)/.test(body), 'it checks Telegram is configured first');

// The notify must be wrapped so a Telegram outage cannot throw away a saved order
const notifyAt = body.indexOf('notifyTelegramOrder(');
const tryAt = body.lastIndexOf('try {', notifyAt);
const catchAt = body.indexOf('catch', notifyAt);
assert(tryAt !== -1 && catchAt !== -1 && tryAt < notifyAt && notifyAt < catchAt,
  'the notify call is inside try/catch');

// It must run AFTER the order row exists, never before
const insertAt = body.indexOf("sb.rpc('create_guest_order'");
assert(insertAt !== -1 && insertAt < notifyAt, 'notify runs after the order is created');

// And the payload must carry what the Telegram card needs
['order_number', 'total', 'customer_name', 'customer_phone'].forEach((field) => {
  const seg = body.slice(notifyAt, notifyAt + 420);
  assert(seg.includes(field), `notify payload includes ${field}`);
});

// checkout.html notifies from the browser on its own path — it must not also
// go through create_order, or the owner would get two messages per order.
const checkout = fs.readFileSync(path.join(__dirname, '..', 'checkout.html'), 'utf8');
assert(/send-telegram/.test(checkout), 'checkout.html still notifies on its own');
assert(!/formSubmit/.test(checkout), 'checkout.html does NOT go through create_order (no double notify)');

if (failed) { console.error(`\n${failed} test(s) failed`); process.exit(1); }
console.log('\nall passed');
