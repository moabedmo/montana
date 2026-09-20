// Speak a reply out loud.
//
// A customer mid-checkout wrote "ماشي كلميني بصوتك عشان ما بعرفش اقرا قوي" and
// received the same written prompt four more times. Not everyone who buys from
// a shop reads comfortably, and a DM is a voice-note medium anyway.
//
// Gemini returns raw PCM, which nothing will play, so a WAV header is written
// around it here — ffmpeg is on no Vercel lambda, and a pure-JS mp3 encoder is
// not worth a dependency for a 24kHz voice note.
//
// Everything fails soft. Audio is an addition to the written reply, never a
// replacement, so a TTS outage must cost the customer nothing.
const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://ikryeyqrithikabwidov.supabase.co';
const SERVICE_KEY = process.env.SERVICE_ROLE || process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const API_KEY = process.env.GEMINI_API_KEY || '';

const BUCKET = 'montana';
const PREFIX = 'voice-replies';
const MODEL = 'gemini-2.5-flash-preview-tts';
const VOICE = 'Kore';                 // warm, mid pitch — matches the shop's tone
const SAMPLE_RATE = 24000;
const MAX_CHARS = 600;                // a voice note, not a podcast
const TIMEOUT_MS = 20_000;

const ANON_KEY = process.env.SUPABASE_ANON_KEY
  || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlrcnlleXFyaXRoaWthYndpZG92Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE3MzY1ODcsImV4cCI6MjA5NzMxMjU4N30.kNfHPxV4fq67cOF8uFsTrLOxPYcLcmmDO3ScIHzI9Uo';

let client = null;
function storage() {
  // Service role in production; the anon key otherwise, which this bucket
  // already accepts — payment proofs upload to it straight from the browser.
  if (!client) client = createClient(SUPABASE_URL, SERVICE_KEY || ANON_KEY);
  return client;
}

/**
 * What the customer should hear, not what she should read.
 *
 * The written replies carry markdown bold and bullet characters that a
 * synthesiser will happily pronounce.
 */
function speakable(text) {
  return String(text || '')
    .replace(/\*\*/g, '')
    // the separator carries spaces either side in the written replies; without
    // absorbing them the comma is read after a pause, "المنطقة ، الشارع"
    .replace(/\s*[•·]\s*/g, '، ')
    .replace(/\s*\n+\s*/g, '. ')
    .replace(/[_`#>]/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim()
    .slice(0, MAX_CHARS);
}

/** PCM carries no format of its own; this is the 44-byte header players expect. */
function wavFromPcm(pcm, sampleRate = SAMPLE_RATE, channels = 1, bits = 16) {
  const byteRate = (sampleRate * channels * bits) / 8;
  const blockAlign = (channels * bits) / 8;
  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);          // PCM chunk size
  header.writeUInt16LE(1, 20);           // format 1 = PCM
  header.writeUInt16LE(channels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bits, 34);
  header.write('data', 36);
  header.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([header, pcm]);
}

async function synthesize(text) {
  if (!API_KEY) return null;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${API_KEY}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        contents: [{ parts: [{ text }] }],
        generationConfig: {
          responseModalities: ['AUDIO'],
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: VOICE } } },
        },
      }),
    });
    if (!res.ok) {
      console.warn('[voice] tts http', res.status);
      return null;
    }
    const json = await res.json();
    const inline = json?.candidates?.[0]?.content?.parts?.[0]?.inlineData;
    if (!inline?.data) return null;
    // the mime type names the real rate, e.g. audio/L16;codec=pcm;rate=24000
    const rate = Number((inline.mimeType || '').match(/rate=(\d+)/)?.[1]) || SAMPLE_RATE;
    return wavFromPcm(Buffer.from(inline.data, 'base64'), rate);
  } catch (err) {
    console.warn('[voice] tts failed:', err.name === 'AbortError' ? 'timeout' : err.message);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * A public URL for this text, spoken.
 *
 * The filename is a hash of what is said, so the stock replies — the address
 * prompt, the shipping line — are synthesised once and then served from
 * storage instead of costing a TTS call per customer.
 */
async function voiceReplyFor(text) {
  const say = speakable(text);
  if (say.length < 4) return null;
  const sb = storage();
  if (!sb) return null;

  const name = `${PREFIX}/${crypto.createHash('sha1').update(say).digest('hex')}.wav`;
  const { data: pub } = sb.storage.from(BUCKET).getPublicUrl(name);
  const publicUrl = pub?.publicUrl || null;

  try {
    // already spoken before?
    const head = await fetch(publicUrl, { method: 'HEAD' });
    if (head.ok) return publicUrl;
  } catch { /* fall through and synthesise */ }

  const wav = await synthesize(say);
  if (!wav) return null;
  const { error } = await sb.storage.from(BUCKET)
    .upload(name, wav, { contentType: 'audio/wav', upsert: true });
  if (error) {
    console.warn('[voice] upload failed:', error.message);
    return null;
  }
  return publicUrl;
}

module.exports = { voiceReplyFor, speakable, wavFromPcm, synthesize };
