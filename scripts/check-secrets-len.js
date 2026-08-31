const fs = require('fs');
const t = fs.readFileSync('.env.local', 'utf8') + '\n' + (fs.existsSync('.env.stock.tmp') ? fs.readFileSync('.env.stock.tmp', 'utf8') : '');
for (const k of ['INTERNAL_API_SECRET', 'MONTANA_CHAT_SECRET', 'SERVICE_ROLE']) {
  const m = t.match(new RegExp('^' + k + '=(.*)$', 'm'));
  let v = m ? m[1].trim() : '';
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
  console.log(k, v ? ('len=' + v.length) : 'missing');
}
