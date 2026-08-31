/**
 * Talk to the live /api/chat and print the conversation.
 * Run: node scripts/talk-live-api.js
 */
const BASE = process.env.CHAT_URL || 'https://www.montana.com.eg/api/chat';

async function turn(sid, message) {
  const res = await fetch(BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify({
      message,
      sessionId: sid,
      channel: 'messenger',
    }),
  });
  const data = await res.json().catch(() => ({}));
  return {
    status: res.status,
    reply: data.reply || data.error || JSON.stringify(data).slice(0, 300),
    sessionId: data.sessionId || sid,
  };
}

async function main() {
  const sid = `messenger:demo-show-${Date.now()}`;
  const turns = [
    'كريم بعد الليزر',
    'بيفتح ؟',
    'ولالا',
  ];

  console.log('URL:', BASE);
  console.log('SID:', sid);
  console.log('\n=== محادثة حية ===\n');

  let sessionId = sid;
  for (const msg of turns) {
    console.log('العميلة:', msg);
    const t0 = Date.now();
    const out = await turn(sessionId, msg);
    sessionId = out.sessionId;
    console.log(`البوت (${Date.now() - t0}ms) [HTTP ${out.status}]:`);
    console.log(out.reply);
    console.log('---\n');
    await new Promise((r) => setTimeout(r, 500));
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
