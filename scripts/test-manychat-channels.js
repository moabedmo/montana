// One endpoint, three platforms, told apart only by content.type.
//
// ManyChat's send API takes Messenger, Instagram and WhatsApp on the same URL
// and decides which by a marker inside the payload. Leave the marker off and
// the send is treated as Facebook Messenger: the subscriber gets nothing and
// the call returns 200, so nothing anywhere reports a failure.
//
// That already happened once to Instagram. This test exists so adding a third
// platform cannot quietly repeat it — and so that every function which sends
// through ManyChat carries the marker, not just the one that was fixed.
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const src = fs.readFileSync(path.join(__dirname, '../lib/manychatApi.js'), 'utf8');
const engine = fs.readFileSync(path.join(__dirname, '../lib/chatEngine.js'), 'utf8');

// 1 — both senders set the marker for both non-Messenger platforms
const senders = ['sendManyChatMessage', 'sendManyChatAudio'];
for (const fn of senders) {
  const at = src.indexOf(`function ${fn}`);
  assert.ok(at > -1, `${fn} must exist`);
  const body = src.slice(at, src.indexOf('\n}', at));
  assert.ok(/channel === 'instagram'\)\s*content\.type = 'instagram'/.test(body),
    `${fn} must mark Instagram sends`);
  assert.ok(/channel === 'whatsapp'\)\s*content\.type = 'whatsapp'/.test(body),
    `${fn} must mark WhatsApp sends`);
}

// 2 — a Messenger tag must not ride along on a WhatsApp send. WhatsApp has no
// message tags; outside its own window a send needs an approved template
// through sendFlow, which sendContent cannot do.
assert.ok(/tag && channel !== 'whatsapp'/.test(src),
  'the Messenger message_tag must be withheld from WhatsApp sends');

// 3 — the engine must pass the channel through rather than dropping it.
// An allow-list that names two platforms out of three sends the third as
// undefined, which lands it back on Messenger.
for (const m of engine.match(/\['messenger',\s*'instagram'[^\]]*\]/g) || []) {
  assert.ok(/whatsapp/.test(m),
    `channel allow-list drops WhatsApp: ${m}`);
}

console.log('PASS manychat channels — markers, tag, engine allow-lists');
