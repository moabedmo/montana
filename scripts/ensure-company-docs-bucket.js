const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

function loadEnv(path) {
  const out = {};
  for (const raw of fs.readFileSync(path, 'utf8').split(/\r?\n/)) {
    const l = raw.trim();
    if (!l || l.startsWith('#') || !l.includes('=')) continue;
    const i = l.indexOf('=');
    const key = l.slice(0, i).trim();
    let v = l.slice(i + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    v = v.replace(/\\n/g, '\n').replace(/\\"/g, '"');
    out[key] = v;
  }
  return out;
}

const env = loadEnv('.env.vercel.tmp');
const key = env.SERVICE_ROLE || env.SUPABASE_SERVICE_ROLE_KEY || '';
console.log('SERVICE_ROLE present:', !!key, 'len:', key.length);
console.log('env keys sample:', Object.keys(env).filter((k) => /SERVICE|SUPABASE|ROLE/i.test(k)).join(','));

if (!key) {
  console.error('No SERVICE_ROLE in .env.vercel.tmp');
  process.exit(1);
}

const sb = createClient('https://ikryeyqrithikabwidov.supabase.co', key);
(async () => {
  const { data: b, error: be } = await sb.storage.listBuckets();
  if (be) throw be;
  console.log('buckets', (b || []).map((x) => x.name).join(','));
  const exists = (b || []).some((x) => x.name === 'company-docs');
  if (!exists) {
    const { error } = await sb.storage.createBucket('company-docs', {
      public: false,
      fileSizeLimit: 52428800,
    });
    console.log('create', error ? error.message : 'ok');
  } else console.log('company-docs exists');
  const { error: ie } = await sb.storage.from('company-docs').upload('_index.json', Buffer.from('[]'), {
    contentType: 'application/json',
    upsert: true,
  });
  console.log('index', ie ? ie.message : 'ok');
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
