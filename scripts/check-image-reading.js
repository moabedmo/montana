/**
 * Ask the vision model to read real Montana pictures and print what it
 * concluded, so the prompt can be judged against the actual photos and ad
 * creatives instead of hoped about.
 *
 * This is the half of the photo feature that unit tests cannot cover. The
 * routing is pinned by scripts/test-customer-image.js; whether the model can
 * tell a whitening cleanser from an acne cleanser is a question only the model
 * can answer, and it changes when the prompt or the model changes.
 *
 * Needs ANTHROPIC_API_KEY or GEMINI_API_KEY. It reads local files directly and
 * skips the fetch guard — that part is already covered by the unit tests.
 *
 * Paced at one image every PAUSE_MS: the Gemini free tier allows five requests
 * a minute, and without a gap the run reports the last four images as
 * unreadable when the model never actually saw them.
 *
 * Run: node scripts/check-image-reading.js
 */
const fs = require('fs');
const path = require('path');

// Load the runtime env the same way the deployed function gets it.
for (const f of ['.env.runtime.local', '.env.local']) {
  const p = path.join(__dirname, '..', f);
  if (!fs.existsSync(p)) continue;
  for (const line of fs.readFileSync(p, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)="?(.*?)"?$/);
    if (m && m[2] && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}

if (!process.env.ANTHROPIC_API_KEY && !process.env.GEMINI_API_KEY) {
  console.error('No ANTHROPIC_API_KEY or GEMINI_API_KEY.');
  console.error('Put one in .env.runtime.local and run again.');
  process.exit(1);
}

const { completeVisionJson } = require('../lib/llm');
const iu = require('../lib/imageUnderstanding');

// The prompt lives in lib/imageUnderstanding.js; pull it in rather than
// keeping a second copy here that can drift out of step with the real one.
const src = fs.readFileSync(path.join(__dirname, '..', 'lib', 'imageUnderstanding.js'), 'utf8');
const grab = (name) => {
  const m = src.match(new RegExp(`const ${name} = \`([\\s\\S]*?)\`;`));
  if (!m) throw new Error(`could not read ${name} out of imageUnderstanding.js`);
  return m[1];
};
const SYSTEM = grab('SYSTEM');
const USER = grab('USER');

/** what each picture SHOULD come back as */
const CASES = [
  ['images/new-photos/2.jpeg', 'product', 'acne-facial-cleanser'],
  ['images/new-photos/WhatsApp Image 2026-09-13 at 5.46.36 PM.jpeg', 'product', 'whitening-cleanser'],
  ['images/new-photos/4.jpeg', 'product', 'whitening-cream'],
  ['images/new-photos/5.jpeg', 'product', 'hand-body-lotion'],
  ['images/new-photos/3.jpeg', 'product', 'post-laser-cream'],
  ['ads-out/stories/montana-01-acne-cleanser.jpg', 'ad', 'acne-facial-cleanser'],
  ['ads-out/stories/montana-03-whitening-cream.jpg', 'ad', 'whitening-cream'],
  ['ads-out/stories/montana-06-bundles.jpg', 'offer', null],
  ['images/p1-premium.webp', 'product', 'acne-facial-cleanser'],
];

/** Gemini's free tier is 5 requests/minute; leave room under it. */
const PAUSE_MS = Number(process.env.IMAGE_CHECK_PAUSE_MS || 13000);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const TYPES = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp' };

(async () => {
  let checked = 0;
  let right = 0;

  // Optional substring filter, so a quota-limited free key can be spent on
  // just the images still in question: node scripts/check-image-reading.js ads
  const only = process.argv[2];

  for (const [file, wantKind, wantSlug] of CASES) {
    if (only && !file.includes(only)) continue;
    const p = path.join(__dirname, '..', file);
    if (!fs.existsSync(p)) { console.log(`skip (missing): ${file}`); continue; }
    if (checked) await sleep(PAUSE_MS);

    const image = {
      data: fs.readFileSync(p).toString('base64'),
      mediaType: TYPES[path.extname(p).toLowerCase()] || 'image/jpeg',
    };
    const out = await completeVisionJson({ system: SYSTEM, user: USER, image, maxTokens: 700 });

    checked += 1;
    const kindOk = out && out.kind === wantKind;
    // A product slug is what drives the answer; on an ad, either the slug or
    // the offer key is enough to route it.
    const idOk = wantSlug
      ? out && (out.productSlug === wantSlug || out.offerKey)
      : !!(out && (out.offerKey || out.productSlug));
    if (kindOk && idOk) right += 1;

    console.log(`\n${path.basename(file)}`);
    console.log(`  want   kind=${wantKind}  ${wantSlug || '(any offer)'}`);
    if (!out) { console.log('  got    (no answer from the model)'); continue; }
    console.log(`  got    kind=${out.kind}  slug=${out.productSlug}  offer=${out.offerKey}  ${kindOk && idOk ? 'OK' : '<-- MISMATCH'}`);
    if (out.summary) console.log(`  says   ${out.summary}`);
    if (out.text) console.log(`  text   ${String(out.text).replace(/\s+/g, ' ').slice(0, 90)}`);
  }

  console.log(`\n${right}/${checked} read correctly`);
  // Deliberately no non-zero exit: this talks to a model and is a judgement
  // aid, not a gate. Read the mismatches rather than trusting the number.
})();
