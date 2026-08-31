/**
 * Live conversation demo against local chatEngine (LLM-first).
 * Loads .env.local / .env.vercel.local then runs Maryam-style turns.
 *
 * Run: node scripts/talk-bot-demo.js
 */
const fs = require('fs');
const path = require('path');

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  const raw = fs.readFileSync(filePath, 'utf8');
  for (const line of raw.split(/\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq < 1) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"'))
      || (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = val;
  }
}

loadEnvFile(path.join(__dirname, '../.env.local'));
loadEnvFile(path.join(__dirname, '../.env.vercel.local'));
loadEnvFile(path.join(__dirname, '../.env.runtime.local'));

// Normalize common Vercel names
if (!process.env.SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_URL) {
  process.env.SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
}
if (!process.env.SUPABASE_ANON_KEY && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
  process.env.SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
}

process.env.CHAT_LLM_FIRST = process.env.CHAT_LLM_FIRST || '1';

async function main() {
  console.log('=== إعداد ===');
  console.log('CHAT_LLM_FIRST =', process.env.CHAT_LLM_FIRST);
  console.log('GEMINI_API_KEY =', process.env.GEMINI_API_KEY ? 'موجود' : 'مش موجود');
  console.log('SUPABASE_URL =', process.env.SUPABASE_URL ? 'موجود' : 'مش موجود');

  if (!process.env.GEMINI_API_KEY) {
    console.error('\nمفيش GEMINI_API_KEY — مش هقدر أكلّم البوت من هنا.');
    process.exit(1);
  }

  const { handleInboundMessage } = require('../lib/chatEngine');
  const sid = `messenger:demo-maryam-${Date.now()}`;

  const turns = [
    'كريم بعد الليزر',
    'بيفتح ؟',
    'ولالا',
  ];

  console.log('\n=== محادثة تجريبية (مريم) ===\n');

  for (const msg of turns) {
    console.log('العميلة:', msg);
    const t0 = Date.now();
    let out;
    try {
      out = await handleInboundMessage({
        sid,
        message: msg,
        channel: 'messenger',
      });
    } catch (e) {
      console.log('البوت: [ERROR]', e.message);
      console.log('---');
      continue;
    }
    const ms = Date.now() - t0;
    console.log(`البوت (${ms}ms):\n${out?.reply || '(فاضي)'}`);
    console.log('---\n');
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
