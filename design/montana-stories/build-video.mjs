/**
 * Stitch the rendered story frames into a Reel-ready MP4.
 *
 * Each frame gets a slow Ken Burns push (alternating in/out so consecutive
 * frames don't feel like the same move), joined by short crossfades.
 * Output targets Meta's Reels/ads spec: 1080x1920, H.264 high, yuv420p,
 * 30fps, faststart, plus a silent AAC track (Reels and ad review both
 * behave better with an audio stream present).
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';

const FPS = 30;
const ZOOM = 0.07;
// Slides dip through the brand background instead of cross-dissolving:
// two text-heavy frames overlapping mid-dissolve is unreadable.
const DIP = 0.3;
const BG = '0x342f44';

const FRAMES = [
  { file: '01-acne-cleanser.png', seconds: 3.9 },
  { file: '02-whitening-cleanser.png', seconds: 3.9 },
  { file: '03-whitening-cream.png', seconds: 3.9 },
  { file: '04-body-lotion.png', seconds: 3.9 },
  { file: '05-post-laser-cream.png', seconds: 3.9 },
  { file: '06-bundles.png', seconds: 5.2 },
];

const renderDir = 'render';
const tmpDir = join(renderDir, 'clips');
const outFile = process.argv[2] || '../../ads-out/montana-products-reel.mp4';

rmSync(tmpDir, { recursive: true, force: true });
mkdirSync(tmpDir, { recursive: true });

const ff = (args) => execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...args], { stdio: 'inherit' });

// ── 1. one clip per frame, with the push ──
FRAMES.forEach((frame, i) => {
  const total = Math.round(frame.seconds * FPS);
  const step = ZOOM / total;
  // Even frames push in, odd frames pull out.
  const z = i % 2 === 0
    ? `min(zoom+${step.toFixed(6)},${(1 + ZOOM).toFixed(3)})`
    : `if(eq(on,0),${(1 + ZOOM).toFixed(3)},max(zoom-${step.toFixed(6)},1.0))`;

  ff([
    '-loop', '1', '-i', join(renderDir, frame.file),
    '-vf', [
      // Oversample first so zoompan's integer stepping doesn't shimmer.
      'scale=2160:3840:flags=lanczos',
      `zoompan=z='${z}':d=${total}:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s=1080x1920:fps=${FPS}`,
      `fade=t=in:st=0:d=${DIP}:color=${BG}`,
      `fade=t=out:st=${(frame.seconds - DIP).toFixed(3)}:d=${DIP}:color=${BG}`,
      'setsar=1',
    ].join(','),
    '-frames:v', String(total),
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '16', '-pix_fmt', 'yuv420p',
    join(tmpDir, `clip${i}.mp4`),
  ]);
  console.log(`clip ${i + 1}/${FRAMES.length} — ${frame.file} (${frame.seconds}s)`);
});

// ── 2. join the clips end to end ──
const inputs = FRAMES.flatMap((_, i) => ['-i', join(tmpDir, `clip${i}.mp4`)]);
const running = FRAMES.reduce((sum, f) => sum + f.seconds, 0);
const concat = FRAMES.map((_, i) => `[${i}:v]`).join('') + `concat=n=${FRAMES.length}:v=1:a=0[v]`;

console.log(`stitching — ${running.toFixed(1)}s total`);

ff([
  ...inputs,
  '-f', 'lavfi', '-i', 'anullsrc=channel_layout=stereo:sample_rate=44100',
  '-filter_complex', concat,
  '-map', '[v]', '-map', `${FRAMES.length}:a`,
  '-t', running.toFixed(3),
  '-c:v', 'libx264', '-profile:v', 'high', '-level', '4.1', '-preset', 'slow',
  '-crf', '19', '-maxrate', '9M', '-bufsize', '16M',
  '-pix_fmt', 'yuv420p', '-r', String(FPS),
  '-c:a', 'aac', '-b:a', '128k', '-ar', '44100',
  '-movflags', '+faststart',
  outFile,
]);

rmSync(tmpDir, { recursive: true, force: true });
console.log(`wrote ${outFile}`);
