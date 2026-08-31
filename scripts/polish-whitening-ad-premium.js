/**
 * Premium polish for whitening cream ad:
 * - remove Gemini watermark
 * - elegant Montana logo treatment
 * - creative Arabic typography (Dubai Bold) — not a cheap white strip
 */
const { createCanvas, loadImage, GlobalFonts } = require('@napi-rs/canvas');
const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const SRC =
  'C:/Users/mo-ab/.cursor/projects/d-montana2/assets/c__Users_mo-ab_AppData_Roaming_Cursor_User_workspaceStorage_empty-window_images_Gemini_Generated_Image_cozw65cozw65cozw-720125cb-d31e-4464-b4f1-95337affbee1.png';
const LOGO = path.join(__dirname, '..', 'images', 'logo-full.png');
const OUT_DIR = path.join(__dirname, '..', 'ads-out');

GlobalFonts.registerFromPath('C:/Windows/Fonts/DUBAI-BOLD.TTF', 'DubaiBold');
GlobalFonts.registerFromPath('C:/Windows/Fonts/DUBAI-MEDIUM.TTF', 'DubaiMedium');
GlobalFonts.registerFromPath('C:/Windows/Fonts/arial.ttf', 'Arial');

function coverGeminiCorner(ctx, w, h) {
  // Soft clone from nearby marble into bottom-right watermark zone
  const cw = Math.round(w * 0.2);
  const ch = Math.round(h * 0.12);
  const sx = Math.max(0, w - cw * 2.2);
  const sy = h - ch;
  ctx.drawImage(ctx.canvas, sx, sy, cw, ch, w - cw, h - ch, cw, ch);
  // feather blend
  const grad = ctx.createLinearGradient(w - cw, 0, w, 0);
  grad.addColorStop(0, 'rgba(245,240,232,0)');
  grad.addColorStop(1, 'rgba(245,240,232,0)'); // no-op; main cover is drawImage
}

(async () => {
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const photo = await loadImage(SRC);
  const logo = await loadImage(LOGO);

  // Work at high res then export 1080x1350
  const W = 1080;
  const H = 1350;
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d');

  // Cover crop of photo to 4:5
  const scale = Math.max(W / photo.width, H / photo.height);
  const dw = photo.width * scale;
  const dh = photo.height * scale;
  const dx = (W - dw) / 2;
  const dy = (H - dh) / 2;
  ctx.drawImage(photo, dx, dy, dw, dh);

  // Remove Gemini sparkle zone — paint warm marble tone + slight blur patch
  const coverW = Math.round(W * 0.24);
  const coverH = Math.round(H * 0.13);
  // sample color from left of watermark area
  const sample = ctx.getImageData(W - coverW - 40, H - coverH - 10, 8, 8).data;
  const r = sample[0];
  const g = sample[1];
  const b = sample[2];
  ctx.fillStyle = `rgb(${r},${g},${b})`;
  ctx.fillRect(W - coverW, H - coverH, coverW, coverH);
  // soft left edge blend
  const edge = ctx.createLinearGradient(W - coverW, 0, W - coverW + 36, 0);
  edge.addColorStop(0, `rgba(${r},${g},${b},0)`);
  edge.addColorStop(1, `rgba(${r},${g},${b},1)`);
  ctx.fillStyle = edge;
  ctx.fillRect(W - coverW, H - coverH, 36, coverH);

  // Top cinematic vignette (brand space) — gradient, not a chunky bar
  const topFade = ctx.createLinearGradient(0, 0, 0, Math.round(H * 0.22));
  topFade.addColorStop(0, 'rgba(28, 24, 38, 0.55)');
  topFade.addColorStop(0.55, 'rgba(28, 24, 38, 0.22)');
  topFade.addColorStop(1, 'rgba(28, 24, 38, 0)');
  ctx.fillStyle = topFade;
  ctx.fillRect(0, 0, W, Math.round(H * 0.22));

  // Logo — luminous on the dark vignette
  const logoW = Math.round(W * 0.5);
  const logoH = (logo.height / logo.width) * logoW;
  const logoX = (W - logoW) / 2;
  const logoY = Math.round(H * 0.045);
  // soft glow behind logo
  ctx.save();
  ctx.shadowColor = 'rgba(255,255,255,0.35)';
  ctx.shadowBlur = 18;
  ctx.drawImage(logo, logoX, logoY, logoW, logoH);
  ctx.restore();

  // Bottom editorial treatment — deep brand purple fade + typography
  const botH = Math.round(H * 0.28);
  const botFade = ctx.createLinearGradient(0, H - botH, 0, H);
  botFade.addColorStop(0, 'rgba(28, 24, 38, 0)');
  botFade.addColorStop(0.35, 'rgba(28, 24, 38, 0.45)');
  botFade.addColorStop(1, 'rgba(28, 24, 38, 0.88)');
  ctx.fillStyle = botFade;
  ctx.fillRect(0, H - botH, W, botH);

  // Thin gold line accent
  const lineY = H - Math.round(H * 0.145);
  ctx.strokeStyle = 'rgba(212, 184, 140, 0.75)';
  ctx.lineWidth = 1.25;
  ctx.beginPath();
  ctx.moveTo(W * 0.28, lineY);
  ctx.lineTo(W * 0.72, lineY);
  ctx.stroke();

  // Arabic product name — Dubai Bold, large, elegant
  ctx.fillStyle = '#F7F1EA';
  ctx.font = '700 54px DubaiBold';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.direction = 'rtl';
  ctx.fillText('كريم التفتيح', W / 2, H - Math.round(H * 0.1));

  // Small English tracking line
  ctx.fillStyle = 'rgba(212, 184, 140, 0.9)';
  ctx.font = '500 18px Arial';
  ctx.direction = 'ltr';
  ctx.letterSpacing = '0.28em';
  // letterSpacing may not work on all canvas — simulate manually
  const eng = 'WHITENING CREAM';
  ctx.font = '500 16px Arial';
  const spacing = 7;
  let total = 0;
  for (const ch of eng) total += ctx.measureText(ch).width + spacing;
  total -= spacing;
  let x = (W - total) / 2;
  const ey = H - Math.round(H * 0.055);
  for (const ch of eng) {
    ctx.fillText(ch, x, ey);
    x += ctx.measureText(ch).width + spacing;
  }

  const pngPath = path.join(OUT_DIR, 'ad-whitening-cream-PREMIUM.png');
  const jpgPath = path.join(OUT_DIR, 'ad-whitening-cream-PREMIUM.jpg');
  const buf = canvas.toBuffer('image/png');
  fs.writeFileSync(pngPath, buf);
  await sharp(buf).jpeg({ quality: 95, chromaSubsampling: '4:4:4' }).toFile(jpgPath);

  console.log('PNG', pngPath);
  console.log('JPG', jpgPath);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
