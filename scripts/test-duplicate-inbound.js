/**
 * ManyChat fired the same inbound twice (~3s apart) and the customer got the
 * same reply twice. /api/chat must swallow the repeat BEFORE any state moves,
 * answering with the "send nothing" sentinel — but must never mute the website
 * widget, a different customer, or a genuinely different message.
 *
 * Run: node scripts/test-duplicate-inbound.js
 */
process.env.GEMINI_API_KEY = process.env.GEMINI_API_KEY || 'x';
process.env.SUPABASE_URL = process.env.SUPABASE_URL || 'https://example.supabase.co';

const path = require('path');
const chatModulePath = path.join(__dirname, '..', 'api', 'chat.js');
const src = require('fs').readFileSync(chatModulePath, 'utf8');

let failed = 0;
function assert(cond, label) {
  if (!cond) { failed += 1; console.error('FAIL:', label); } else { console.log('ok:', label); }
}

// ── the guard must sit before the engine runs, or a repeat still moves state
const guardAt = src.indexOf('markInbound(dupKey)');
const engineAt = src.indexOf('await handleInboundMessage(');
assert(guardAt !== -1, 'duplicate guard exists');
assert(engineAt !== -1, 'engine call found');
assert(guardAt < engineAt, 'guard runs BEFORE handleInboundMessage (no state advanced)');

// ── it must answer with the sentinel ManyChat understands, not an empty body
const guardBlock = src.slice(guardAt, engineAt);
assert(/reply1: 'NONE'/.test(guardBlock), "duplicate reply uses the 'NONE' sentinel");
assert(/reply: ''/.test(guardBlock), 'duplicate reply text is empty');

// ── web must be exempt (the widget renders inline; silence looks broken)
assert(/channelOf\(sid\) !== 'web'/.test(src), 'web channel is exempt from dedup');

// ── a failed turn must not mute the retry
assert(/recentInbound\.delete\(dupKey\)/.test(src.slice(src.indexOf('catch (err)'))), 'error path clears the key');

// ── behaviour of the window itself
const DUPLICATE_WINDOW_MS = 12_000;
const recentInbound = new Map();
const inboundKey = (sid, message) => `${sid}|${String(message).trim().slice(0, 300)}`;
function markInbound(key) {
  const now = Date.now();
  const prev = recentInbound.get(key);
  recentInbound.set(key, now);
  return !!prev && now - prev < DUPLICATE_WINDOW_MS;
}

const sid = 'instagram:123';
assert(!markInbound(inboundKey(sid, 'اسعار منتجات مونتانيا')), 'first send goes through');
assert(markInbound(inboundKey(sid, 'اسعار منتجات مونتانيا')), 'immediate repeat is swallowed');
assert(!markInbound(inboundKey(sid, 'عايزة اطلب')), 'a different message still goes through');
assert(
  !markInbound(inboundKey('instagram:999', 'اسعار منتجات مونتانيا')),
  'same text from ANOTHER customer goes through'
);

// whitespace-only differences are the same message
recentInbound.clear();
markInbound(inboundKey(sid, 'نعم'));
assert(markInbound(inboundKey(sid, '  نعم  ')), 'padding does not defeat the check');

// outside the window it is a new message again
recentInbound.set(inboundKey(sid, 'نعم'), Date.now() - (DUPLICATE_WINDOW_MS + 1000));
assert(!markInbound(inboundKey(sid, 'نعم')), 'same text after the window goes through');

if (failed) { console.error(`\n${failed} test(s) failed`); process.exit(1); }
console.log('\nall passed');
