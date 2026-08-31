/**
 * The site's product cutouts are 1024x1024 with a lot of transparent padding
 * (the storefront hero scales them up to compensate). For the story frames we
 * want them tight, so find each image's alpha bounding box and crop to it.
 */
import { execFileSync } from 'node:child_process';

const SIZE = 1024;
const NAMES = ['p1', 'p2', 'p3', 'p4', 'p5'];
const THRESHOLD = 8; // alpha below this counts as empty

for (const name of NAMES) {
  const alpha = execFileSync('ffmpeg', [
    '-v', 'error', '-i', `${name}.webp`,
    '-vf', 'alphaextract', '-pix_fmt', 'gray', '-f', 'rawvideo', '-',
  ], { maxBuffer: 1 << 28 });

  let top = SIZE, bottom = -1, left = SIZE, right = -1;
  for (let y = 0; y < SIZE; y++) {
    const row = y * SIZE;
    for (let x = 0; x < SIZE; x++) {
      if (alpha[row + x] > THRESHOLD) {
        if (y < top) top = y;
        if (y > bottom) bottom = y;
        if (x < left) left = x;
        if (x > right) right = x;
      }
    }
  }

  const pad = 6;
  const x0 = Math.max(0, left - pad);
  const y0 = Math.max(0, top - pad);
  const w = Math.min(SIZE - x0, right - left + 1 + pad * 2);
  const h = Math.min(SIZE - y0, bottom - top + 1 + pad * 2);

  execFileSync('ffmpeg', [
    '-v', 'error', '-y', '-i', `${name}.webp`,
    '-vf', `crop=${w}:${h}:${x0}:${y0}`,
    `${name}-tight.png`,
  ]);
  console.log(`${name}: ${SIZE}x${SIZE} -> ${w}x${h} (was ${Math.round((1 - (w * h) / (SIZE * SIZE)) * 100)}% padding)`);
}
