const sharp = require('sharp');
const path = require('path');

const src =
  'C:/Users/mo-ab/.cursor/projects/d-montana2/assets/c__Users_mo-ab_AppData_Roaming_Cursor_User_workspaceStorage_empty-window_images_Gemini_Generated_Image_cozw65cozw65cozw-720125cb-d31e-4464-b4f1-95337affbee1.png';
const logoPath = path.join(__dirname, '..', 'images', 'logo-full.png');
const outDir = path.join(__dirname, '..', 'ads-out');

(async () => {
  const meta = await sharp(src).metadata();
  const w = meta.width;
  const h = meta.height;

  const barH = Math.round(h * 0.11);
  // Tall enough to fully cover Gemini watermark in bottom-right
  const bottomH = Math.round(h * 0.115);

  const topBar = await sharp({
    create: {
      width: w,
      height: barH,
      channels: 4,
      background: { r: 255, g: 252, b: 248, alpha: 0.9 },
    },
  })
    .png()
    .toBuffer();

  const logoW = Math.round(w * 0.46);
  const logoBuf = await sharp(logoPath).resize({ width: logoW }).png().toBuffer();
  const logoMeta = await sharp(logoBuf).metadata();
  const logoLeft = Math.round((w - logoMeta.width) / 2);
  const logoTop = Math.max(10, Math.round((barH - logoMeta.height) / 2));

  const bottomBar = Buffer.from(`<?xml version="1.0" encoding="UTF-8"?>
<svg width="${w}" height="${bottomH}" xmlns="http://www.w3.org/2000/svg">
  <rect width="100%" height="100%" fill="#FFFAF6"/>
  <text x="${w / 2}" y="${Math.round(bottomH * 0.62)}" text-anchor="middle"
    font-family="Segoe UI, Tahoma, Arial" font-size="${Math.round(bottomH * 0.36)}"
    font-weight="650" fill="#3F3A36">كريم التفتيح</text>
</svg>`);

  const cleaned = path.join(outDir, 'ad-whitening-cream-FACEBOOK.png');
  await sharp(src)
    .composite([
      { input: topBar, left: 0, top: 0 },
      { input: logoBuf, left: logoLeft, top: logoTop },
      { input: bottomBar, left: 0, top: h - bottomH },
    ])
    .png()
    .toFile(cleaned);

  await sharp(cleaned)
    .resize(1080, 1350, { fit: 'cover' })
    .jpeg({ quality: 95, chromaSubsampling: '4:4:4' })
    .toFile(path.join(outDir, 'ad-whitening-cream-FACEBOOK-1080.jpg'));

  await sharp(cleaned)
    .resize(1080, 1350, { fit: 'cover' })
    .png()
    .toFile(path.join(outDir, 'ad-whitening-cream-FACEBOOK-1080.png'));

  console.log('ready', path.join(outDir, 'ad-whitening-cream-FACEBOOK-1080.jpg'));
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
