// The eval must not place real orders.
//
// scripts/eval-chat.js replays 74 conversations against the live site, and
// several of them run to checkout. Every one of those was a real row: it
// showed up in the admin beside actual customers, it woke the owner's Telegram
// at whatever hour the eval ran, and it took its quantities out of
// products.stock — which deleting the order afterwards does not give back.
//
// The guard is one predicate and three branches around it, so what this test
// checks is that they are all still there and still wired to each other.
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const engine = fs.readFileSync(path.join(__dirname, '../lib/chatEngine.js'), 'utf8');
const evalScript = fs.readFileSync(path.join(__dirname, 'eval-chat.js'), 'utf8');

// 1 — the eval still names its sessions the way the guard recognises
const sidLine = evalScript.match(/const sid = `([^`]+)`/);
assert.ok(sidLine, 'eval-chat.js must build its session id from a template');
assert.ok(/eval-/.test(sidLine[1]),
  `the guard matches on "eval-"; eval-chat.js builds ${sidLine[1]}`);

// 2 — the predicate exists and matches what the eval produces
const isEvalSession = (sid) => /(^|:)eval-/.test(String(sid || ''));
assert.ok(engine.includes('function isEvalSession'), 'isEvalSession must exist in the engine');
assert.ok(isEvalSession('messenger:eval-bkam-1758400000000'));
assert.ok(isEvalSession('eval-local-1'));

// and does not catch a real customer — ManyChat contact ids, web sids, and a
// person whose session merely contains the letters
assert.ok(!isEvalSession('manychat:123456789'));
assert.ok(!isEvalSession('sid_a8f3c1'));
assert.ok(!isEvalSession('instagram:17841400000'));
assert.ok(!isEvalSession('messenger:retrieval-99'), 'must anchor, not match mid-word');
assert.ok(!isEvalSession(''));
assert.ok(!isEvalSession(null));

// 3 — the three consequences are each behind the guard
const body = engine.slice(engine.indexOf('async function create_order'));
assert.ok(/const evalRun = isEvalSession\(sid\)/.test(body),
  'create_order must decide once whether this is an eval run');
assert.ok(/evalRun\s*\?[\s\S]{0,200}?create_guest_order/.test(body),
  'the order insert must be skipped for an eval session');
assert.ok(/orderNumber && !evalRun/.test(body),
  'Telegram must not be told about an eval order');
assert.ok(/if \(!evalRun\) \{[\s\S]{0,300}?notifyStockCrossings/.test(body),
  'stock alerts must not fire for an eval order');

console.log('PASS eval orders are not real — sid shape, predicate, three consequences');
