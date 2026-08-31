/**
 * Talk to preview deployment with protection bypass.
 * Usage:
 *   set VERCEL_BYPASS=...
 *   set CHAT_URL=https://....vercel.app/api/chat
 *   node scripts/talk-preview-bot.js
 */
const BASE = process.env.CHAT_URL;
const BYPASS = process.env.VERCEL_BYPASS || '';

if (!BASE) {
  console.error('Set CHAT_URL');
  process.exit(1);
}

async function turn(sid, message) {
  const headers = { 'Content-Type': 'application/json; charset=utf-8' };
  if (BYPASS) headers['x-vercel-protection-bypass'] = BYPASS;
  const res = await fetch(BASE, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      message,
      sessionId: sid,
      channel: 'messenger',
    }),
  });
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = { reply: text.slice(0, 500) };
  }
  return {
    status: res.status,
    reply: data.reply || data.error || text.slice(0, 500),
    sessionId: data.sessionId || sid,
  };
}

async function main() {
  const sid = `messenger:show-${Date.now()}`;
  const turns = [
    'كريم بعد الليزر',
    'بيفتح ؟',
    'ولالا',
  ];

  console.log('URL:', BASE);
  console.log('\n=== محادثة حية على النسخة الجديدة ===\n');

  let sessionId = sid;
  for (const msg of turns) {
    console.log('العميلة:', msg);
    const t0 = Date.now();
    const out = await turn(sessionId, msg);
    sessionId = out.sessionId;
    console.log(`البوت (${Date.now() - t0}ms):`);
    console.log(out.reply);
    console.log('---\n');
    await new Promise((r) => setTimeout(r, 600));
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
