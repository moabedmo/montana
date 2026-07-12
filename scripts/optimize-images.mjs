/**
 * Generate WebP versions of PNG/JPG product images.
 * Run: node scripts/optimize-images.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import sharp from 'sharp';

const IMG_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'images');
if (!fs.existsSync(IMG_DIR)) {
  console.log('No images/ folder — skip');
  process.exit(0);
}

const files = fs.readdirSync(IMG_DIR).filter((f) => /\.(png|jpe?g)$/i.test(f));
let done = 0;

// Display-width caps for specific source images, used ONLY where we've
// confirmed (by grepping every .html/.css/.js reference) the image never
// appears larger than this on any page — e.g. the before/after slider
// photos are capped at ~440px CSS width by .ba-grid (styles.css) on every
// breakpoint, yet the source files were full-resolution camera photos
// (~1.1MB each). Everything NOT listed here keeps the previous behavior
// (re-encode to webp at original size, untouched) because several images
// in this same folder are shared with print-collateral pages (poster/
// business-card/voucher/brochure) that need full resolution — resizing
// those would blur print output.
const MAX_WIDTH = {
  'ba1-before': 900, 'ba1-after': 900,
  'ba2-before': 900, 'ba2-after': 900,
  'ba3-before': 900, 'ba3-after': 900,
};

for (const file of files) {
  const src = path.join(IMG_DIR, file);
  const base = file.replace(/\.(png|jpe?g)$/i, '');
  const webp = path.join(IMG_DIR, `${base}.webp`);
  try {
    let img = sharp(src);
    const cap = MAX_WIDTH[base];
    if (cap) {
      const meta = await img.metadata();
      if (meta.width > cap) img = img.resize({ width: cap });
    }
    await img.webp({ quality: 82, effort: 4 }).toFile(webp);
    const before = fs.statSync(src).size;
    const after = fs.statSync(webp).size;
    console.log(`${file} → ${base}.webp (${Math.round(before / 1024)}KB → ${Math.round(after / 1024)}KB)${cap ? ` [capped ${cap}px]` : ''}`);
    done += 1;
  } catch (err) {
    console.warn(`skip ${file}:`, err.message);
  }
}

console.log(`Optimized ${done} image(s)`);
