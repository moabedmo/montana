const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '..', '.env.jumia.tmp');
for (const line of fs.readFileSync(envPath, 'utf8').split(/\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (!m) continue;
  let v = m[2].trim();
  if (
    (v.startsWith('"') && v.endsWith('"')) ||
    (v.startsWith("'") && v.endsWith("'"))
  ) {
    v = v.slice(1, -1);
  }
  process.env[m[1]] = v;
}

const { listJumiaOrders, listJumiaShops, getJumiaAccessToken } = require('../lib/jumiaClient');

(async () => {
  const t = await getJumiaAccessToken();
  console.log('token_ok', !!t, 'len', t.length);
  try {
    const shops = await listJumiaShops();
    console.log('shops_count', Array.isArray(shops) ? shops.length : 'not-array');
    if (Array.isArray(shops) && shops[0]) {
      console.log('shop0_keys', Object.keys(shops[0]));
    } else if (shops && typeof shops === 'object') {
      console.log('shops_keys', Object.keys(shops));
    }
  } catch (e) {
    console.log('shops_err', e.status, e.message, JSON.stringify(e.data || {}).slice(0, 400));
  }
  const r = await listJumiaOrders({ days: 30, size: 10 });
  console.log('orders', r.orders.length, 'next', !!r.nextToken, 'meta', r.rawMeta);
  if (r.orders[0]) {
    const o = { ...r.orders[0] };
    delete o.raw;
    console.log('order0', JSON.stringify(o));
    console.log('raw_keys', Object.keys(r.orders[0].raw || {}));
  }
})().catch((e) => {
  console.error('FAIL', e.status, e.message, JSON.stringify(e.data || {}).slice(0, 800));
  process.exit(1);
});
