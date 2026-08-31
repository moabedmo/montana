/**
 * Regression: named brightening routine must NOT dump all 3 offers.
 * Run: node scripts/test-brightening-named-flow.js
 */
const BASE = process.env.CHAT_URL || 'https://www.montana.com.eg/api/chat';
const DELAY = Number(process.env.SMOKE_DELAY_MS || 700);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function turn(sid, message) {
  await sleep(DELAY);
  const res = await fetch(BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify({ message, sessionId: sid, channel: 'messenger' }),
  });
  const data = await res.json().catch(() => ({}));
  return String(data.reply || '');
}

function listsAllThree(reply) {
  return /618|549/.test(reply) && /777|699/.test(reply) && /558|499/.test(reply)
    && /العروض المتاحة|اختاري بالاسم/.test(reply);
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

async function main() {
  const sid = `messenger:named-bright-${Date.now()}`;
  console.log('sid', sid);

  let r = await turn(sid, 'عاوز المجموعة كاملة');
  console.log('\n1 group:', r.slice(0, 180).replace(/\n/g, ' | '));
  assert(listsAllThree(r), 'step1 should list all 3 offers');

  r = await turn(sid, 'فائدة روتين التفتيح الكامل ؟');
  console.log('\n2 benefits:', r.slice(0, 280).replace(/\n/g, ' | '));
  assert(!listsAllThree(r), 'step2 must NOT dump all 3 offers');
  assert(/777|تفتيح|غسول/.test(r), 'step2 should explain brightening routine');

  r = await turn(sid, 'طيب محتاج روتين التفتيح الكامل');
  console.log('\n3 need:', r.slice(0, 280).replace(/\n/g, ' | '));
  assert(!listsAllThree(r), 'step3 must NOT dump all 3 offers');
  assert(/سجّلت|سجلت|أوردرك|اوردرك|777|نكمل/i.test(r), 'step3 should add routine to cart');

  console.log('\nPASS named brightening flow');
}

main().catch((e) => {
  console.error('FAIL', e.message);
  process.exit(1);
});
