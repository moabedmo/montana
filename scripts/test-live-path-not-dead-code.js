/**
 * Three times now a correct handler sat inside `if (!skipScriptedMaze && ...)`
 * — a ~640-line block the LLM-first path skips entirely — so the code read
 * fine, shipped fine, and never ran. The customer-facing rules that MUST hold
 * on every turn have to live outside that block.
 *
 * Run: node scripts/test-live-path-not-dead-code.js
 */
const fs = require('fs');
const path = require('path');

const src = fs.readFileSync(path.join(__dirname, '..', 'lib', 'chatEngine.js'), 'utf8');
const lines = src.split('\n');

let failed = 0;
function assert(cond, label) {
  if (!cond) { failed += 1; console.error('FAIL:', label); } else { console.log('ok:', label); }
}

/** The conditions a given line sits inside, innermost first. */
function enclosingBlocks(lineIndex) {
  let depth = 0;
  const out = [];
  for (let i = lineIndex; i >= 0 && out.length < 6; i--) {
    const line = lines[i];
    for (let j = line.length - 1; j >= 0; j--) {
      if (line[j] === '}') depth += 1;
      else if (line[j] === '{') {
        if (depth === 0) out.push(line.trim());
        else depth -= 1;
      }
    }
  }
  return out;
}

// Handlers that must run on EVERY turn, whatever mode the engine is in.
const mustBeLive = [
  ['order problem → customer service', 'Order problem / late delivery → hand straight'],
  ['caller-number check for money calls', 'verify the caller against our official line'],
  ['walk-away soft close', 'Walk-away / cancel BEFORE checkout wizard'],
  ['empty cart + wants to order', 'عايزة أطلب" with nothing chosen yet'],
  ['lightening degree answer', 'answer the degree question directly'],
  ['dark area → brightening', 'Dark underarm / elbows / knees'],
  ['laser denial → ask concern', 'with nothing else asked → ask what she needs'],
  ['pregnancy & all FAQ answers', 'The FAQ answers — ingredients, benefits, usage'],
];

for (const [label, marker] of mustBeLive) {
  const idx = lines.findIndex((l) => l.includes(marker));
  assert(idx !== -1, `found: ${label}`);
  if (idx === -1) continue;
  const enclosing = enclosingBlocks(idx);
  const dead = enclosing.find((l) => /skipScriptedMaze|isLlmFirstEnabled/.test(l));
  assert(!dead, `${label} is NOT inside the skipped block${dead ? ` (found: ${dead.slice(0, 60)})` : ''}`);
}

if (failed) { console.error(`\n${failed} test(s) failed`); process.exit(1); }
console.log('\nall passed');
