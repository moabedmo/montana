/**
 * Concatenate storefront CSS to reduce HTTP requests.
 * Run: node scripts/build-css-bundle.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import CleanCSS from 'clean-css';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'css');
const cleaner = new CleanCSS({ level: 1 });

const HOME_BUNDLE = [
  'styles.css',
  'app.css',
  'premium-effects.css',
  'col-hero.css',
  'luxury.css',
  'premium.css',
  'home-premium.css',
  'css/perf.css',
  'css/bundles.css',
];

const SHOP_BUNDLE = [
  'styles.css',
  'app.css',
  'pages.css',
  'premium.css',
  'dark-theme.css',
  'shop-premium.css',
  'css/perf.css',
  'css/bundles.css',
];

function bundle(name, files) {
  const parts = files.map((f) => {
    const p = path.join(ROOT, f);
    if (!fs.existsSync(p)) {
      console.warn('skip missing', f);
      return '';
    }
    return fs.readFileSync(p, 'utf8');
  });
  const raw = parts.join('\n');
  const { styles, errors, warnings } = cleaner.minify(raw);
  if (errors?.length) {
    console.error(`clean-css errors in ${name}:`, errors);
    process.exit(1);
  }
  if (warnings?.length) console.warn(`clean-css warnings in ${name}:`, warnings);

  const outPath = path.join(OUT, name);
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(outPath, styles, 'utf8');
  const beforeKb = Math.round(Buffer.byteLength(raw, 'utf8') / 1024);
  const afterKb = Math.round(Buffer.byteLength(styles, 'utf8') / 1024);
  console.log(`Wrote ${name} (${beforeKb} KB -> ${afterKb} KB)`);
}

bundle('home.bundle.css', HOME_BUNDLE);
bundle('shop.bundle.css', SHOP_BUNDLE);
