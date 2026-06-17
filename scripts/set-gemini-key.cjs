const fs = require('fs');
const path = require('path');

const key = process.argv[2];
if (!key || !key.startsWith('AIza')) {
  console.error('Usage: node scripts/set-gemini-key.cjs AIzaSy...');
  process.exit(1);
}

const file = path.join(__dirname, '..', 'js', 'montana-config.js');
const content =
  '/* Montana — Gemini key (auto-updated) */\n' +
  'window.MONTANA_CONFIG = window.MONTANA_CONFIG || {\n' +
  '  geminiKey: ' + JSON.stringify(key) + '\n' +
  '};\n';

fs.writeFileSync(file, content, 'utf8');
console.log('OK — saved to js/montana-config.js');
