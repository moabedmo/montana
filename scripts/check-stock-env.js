const fs = require('fs');
const t = fs.readFileSync('.env.stock.tmp', 'utf8');
for (const k of ['SERVICE_ROLE', 'INTERNAL_API_SECRET', 'CRON_SECRET']) {
  const m = t.match(new RegExp('^' + k + '=(.*)$', 'm'));
  let v = m ? m[1].trim() : '';
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
    v = v.slice(1, -1);
  }
  console.log(k, 'len=' + v.length);
}
