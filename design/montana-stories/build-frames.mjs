/**
 * Turn the .dc.html story artboards into standalone HTML pages that a
 * headless browser can screenshot at 1080x1920.
 *
 * The canvas editor supplies the Design Component runtime; a plain browser
 * doesn't, so we lift the markup out of <x-dc>, promote <helmet> contents
 * into <head>, and drop the <sc-if> wrapper (showPrice defaults to true).
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const outDir = join(here, 'render');
mkdirSync(outDir, { recursive: true });

const FRAMES = [
  ['Main.dc.html', '01-acne-cleanser'],
  ['WhiteningCleanser.dc.html', '02-whitening-cleanser'],
  ['WhiteningCream.dc.html', '03-whitening-cream'],
  ['BodyLotion.dc.html', '04-body-lotion'],
  ['PostLaserCream.dc.html', '05-post-laser-cream'],
  ['Bundles.dc.html', '06-bundles'],
];

const between = (src, open, close) => {
  const a = src.indexOf(open);
  const b = src.indexOf(close);
  if (a === -1 || b === -1) throw new Error(`missing ${open}`);
  return src.slice(a + open.length, b);
};

for (const [file, slug] of FRAMES) {
  const src = readFileSync(join(here, file), 'utf8');
  const dc = between(src, '<x-dc>', '</x-dc>');
  const helmet = between(dc, '<helmet>', '</helmet>');
  const body = dc
    .slice(dc.indexOf('</helmet>') + '</helmet>'.length)
    .replace(/<sc-if[^>]*>/g, '')
    .replace(/<\/sc-if>/g, '');

  const page = `<!doctype html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8">
${helmet.trim()}
<style>
  html, body { margin: 0; padding: 0; width: 1080px; height: 1920px; overflow: hidden; }
</style>
</head>
<body>
${body.trim()}
</body>
</html>
`;
  writeFileSync(join(outDir, `${slug}.html`), page, 'utf8');
  console.log(`wrote render/${slug}.html`);
}
