const fs = require('fs');
const path = require('path');

const indexPath = path.join(__dirname, '../index.html');
const assetsDir = path.join(__dirname, '../assets');
let html = fs.readFileSync(indexPath, 'utf8');

if (!fs.existsSync(assetsDir)) fs.mkdirSync(assetsDir);

const productAlts = [
  'Acne Facial Cleanser — Montana Naturals',
  'Whitening Cleanser — Montana Naturals',
  'Whitening Cream — Montana Naturals',
  'Hand & Body Lotion — Montana Naturals',
  'Post Laser Cream — Montana Naturals',
  'Anti-Scar Silicone Gel — Montana Naturals'
];

const imgs = [...html.matchAll(/class="pp-img" src="(data:image[^"]+)"/g)];
imgs.forEach((m, i) => {
  const parts = m[1].match(/^data:image\/(\w+);base64,(.+)$/);
  if (!parts) return;
  const ext = parts[1] === 'jpeg' ? 'jpg' : parts[1];
  const filename = `p${i + 1}.${ext}`;
  fs.writeFileSync(path.join(assetsDir, filename), Buffer.from(parts[2], 'base64'));
  const assetSrc = `assets/${filename}`;
  html = html.replace(m[0], `class="pp-img" src="${assetSrc}" alt="${productAlts[i] || 'Montana Naturals product'}"`);
  console.log(filename);
});

const logo = [...html.matchAll(/id="nlogo" src="(data:image[^"]+)"/g)][0];
if (logo) {
  const p = logo[1].match(/^data:image\/(\w+);base64,(.+)$/);
  if (p) {
    const ext = p[1] === 'jpeg' ? 'jpg' : p[1];
    fs.writeFileSync(path.join(assetsDir, `logo.${ext}`), Buffer.from(p[2], 'base64'));
    html = html.replace(logo[0], 'id="nlogo" src="assets/logo.' + ext + '" alt="Montana Naturals logo"');
    console.log('logo.' + ext);
  }
}

fs.writeFileSync(indexPath, html);
const kb = Math.round(Buffer.byteLength(html, 'utf8') / 1024);
console.log('index.html updated —', kb, 'KB');
