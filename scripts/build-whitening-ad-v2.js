const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const productSrc =
  'C:/Users/mo-ab/.cursor/projects/d-montana2/assets/c__Users_mo-ab_AppData_Roaming_Cursor_User_workspaceStorage_empty-window_images_p3-fd0fc9b4-4b7e-4c28-9513-49e1b128a298.png';
const outDir = path.join(__dirname, '..', 'ads-out', 'v2');
fs.mkdirSync(outDir, { recursive: true });

const CREAM = { r: 243, g: 237, b: 228 };

function escapeXml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

async function productOnCream(height) {
  // Load, make near-black background transparent, then flatten onto cream
  const { data, info } = await sharp(productSrc)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    // near-black background → transparent
    if (r < 28 && g < 28 && b < 28) data[i + 3] = 0;
  }

  const cutout = await sharp(data, {
    raw: { width: info.width, height: info.height, channels: 4 },
  })
    .resize({ height, fit: 'inside' })
    .png()
    .toBuffer();

  return cutout;
}

function svgFrame(lines, { w = 1080, h = 1920, yStart = 220, fontSize = 54 } = {}) {
  const spans = lines
    .map((t, i) => {
      const y = yStart + i * (fontSize + 28);
      return `<text x="540" y="${y}" text-anchor="middle" font-family="Segoe UI, Tahoma, Arial" font-size="${fontSize}" font-weight="700" fill="#1C1917">${escapeXml(t)}</text>`;
    })
    .join('');
  return Buffer.from(`<?xml version="1.0" encoding="UTF-8"?>
<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#F7F1E8"/>
      <stop offset="100%" stop-color="#E6DCCE"/>
    </linearGradient>
  </defs>
  <rect width="100%" height="100%" fill="url(#g)"/>
  ${spans}
</svg>`);
}

async function frame(name, { lines, productTop, productHeight, textY, fontSize }) {
  const bg = await sharp(svgFrame(lines, { yStart: textY, fontSize }))
    .png()
    .toBuffer();
  const prod = await productOnCream(productHeight);
  const meta = await sharp(prod).metadata();
  const left = Math.round((1080 - meta.width) / 2);
  const out = path.join(outDir, name);
  await sharp(bg)
    .composite([{ input: prod, top: productTop, left }])
    .jpeg({ quality: 95 })
    .toFile(out);
  console.log('ok', name, meta.width, 'x', meta.height);
}

(async () => {
  await frame('01.jpg', {
    lines: ['تصبغ؟', 'ابدئي بخطوة واحدة'],
    textY: 280,
    fontSize: 62,
    productTop: 560,
    productHeight: 1000,
  });
  await frame('02.jpg', {
    lines: ['كريم التفتيح', 'من مونتانا'],
    textY: 240,
    fontSize: 58,
    productTop: 500,
    productHeight: 1080,
  });
  await frame('03.jpg', {
    lines: ['منتج واحد بس', 'ابعتي رسالة واسألي السعر'],
    textY: 260,
    fontSize: 48,
    productTop: 560,
    productHeight: 1000,
  });

  console.log('frames ready');
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
