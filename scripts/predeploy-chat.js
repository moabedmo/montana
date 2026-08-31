/**
 * Pre-deploy chat gate: unit fallback + live eval corpus.
 * Usage: node scripts/predeploy-chat.js
 * Optional: CHAT_URL=https://... node scripts/predeploy-chat.js
 */
const { spawnSync } = require('child_process');
const path = require('path');

function run(label, args) {
  console.log(`\n—— ${label} ——`);
  const r = spawnSync(process.execPath, args, {
    cwd: path.join(__dirname, '..'),
    stdio: 'inherit',
    env: process.env,
  });
  if (r.status !== 0) {
    console.error(`\nFAILED: ${label}`);
    process.exit(r.status || 1);
  }
}

run('intent fallback unit', ['scripts/test-intent-fallback.js']);
run('live eval corpus (real customer cases)', ['scripts/eval-chat.js']);

console.log('\n✅ Pre-deploy chat gate passed.');
