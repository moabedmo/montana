/**
 * Slim homepage HTML — remove static product grid (loaded via JS).
 * Run: node scripts/slim-index.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const file = path.join(ROOT, 'index.html');
let html = fs.readFileSync(file, 'utf8');

const gridStart = html.indexOf('<div class="products-grid" id="trendingGrid">');
const gridEnd = html.indexOf('<div class="section-footer">', gridStart);
if (gridStart > -1 && gridEnd > gridStart && html.includes('<!-- Acne Facial Cleanser -->')) {
  const replacement = `<div class="products-grid" id="trendingGrid">
            <p class="home-grid-loading" style="grid-column:1/-1;text-align:center;padding:48px 16px;color:rgba(245,240,250,.6);">جارٍ تحميل المنتجات…</p>
        </div>
        `;
  html = html.slice(0, gridStart) + replacement + html.slice(gridEnd);
}

const pngToWebp = [
  ['images/p2.png?v=14', 'images/p2.webp'],
  ['images/p3.png?v=14', 'images/p3.webp'],
  ['images/p5.png?v=14', 'images/p5.webp'],
  ['images/category-skincare.png', 'images/category-skincare.webp'],
];
for (const [from, to] of pngToWebp) {
  html = html.split(from).join(to);
}

html = html.replace(
  /<script src="col-hero\.js" defer><\/script>\s*/,
  ''
);
html = html.replace(
  /<script src="luxury-motion\.js" defer><\/script>\s*/,
  ''
);

// Lazy-load below-fold images (not hero LCP)
html = html.replace(
  /<img(?![^>]*fetchpriority="high")(?![^>]*loading=)([^>]*src="images\/(?!p1\.webp))([^>]*)>/g,
  '<img loading="lazy" decoding="async"$1$2>'
);

fs.writeFileSync(file, html, 'utf8');
console.log('Slimmed index.html —', Math.round(fs.statSync(file).size / 1024), 'KB');
