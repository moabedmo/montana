const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

function loadEnv(path) {
  const out = {};
  if (!fs.existsSync(path)) return out;
  for (const raw of fs.readFileSync(path, 'utf8').split(/\r?\n/)) {
    const l = raw.trim();
    if (!l || l.startsWith('#') || !l.includes('=')) continue;
    const i = l.indexOf('=');
    const key = l.slice(0, i).trim();
    let v = l.slice(i + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    out[key] = v;
  }
  return out;
}

const env = {
  ...loadEnv('.env.local'),
  ...loadEnv('.env.vercel.local'),
  ...loadEnv('.env.runtime.local'),
  ...loadEnv('.env.stock.tmp'),
};

const URL = 'https://ikryeyqrithikabwidov.supabase.co';
const KEY = env.SERVICE_ROLE || env.SUPABASE_SERVICE_ROLE_KEY || '';
const ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlrcnlleXFyaXRoaWthYndpZG92Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE3MzY1ODcsImV4cCI6MjA5NzMxMjU4N30.kNfHPxV4fq67cOF8uFsTrLOxPYcLcmmDO3ScIHzI9Uo';

const STOCK = {
  'post-laser-cream': 852,
  'hand-body-lotion': 738,
  'acne-facial-cleanser': 680,
  'whitening-cleanser': 879,
  'whitening-cream': 808,
};

async function main() {
  if (!KEY) {
    console.error('No SERVICE_ROLE locally — writing migration only path needed');
  }
  const sb = createClient(URL, KEY || ANON);
  const { data: before, error } = await sb
    .from('products')
    .select('id,name,slug,stock')
    .in('slug', Object.keys(STOCK));
  if (error) throw error;
  console.log('BEFORE', before);

  if (!KEY) {
    console.log('Skip live update without SERVICE_ROLE');
    return;
  }

  for (const [slug, stock] of Object.entries(STOCK)) {
    const { data, error: upErr } = await sb
      .from('products')
      .update({ stock })
      .eq('slug', slug)
      .select('slug,name,stock')
      .maybeSingle();
    if (upErr) throw upErr;
    console.log('UPDATED', data);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
