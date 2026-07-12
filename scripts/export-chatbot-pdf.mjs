import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import puppeteer from 'puppeteer';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

const files = [
  'lib/chatEngine.js',
  'lib/orderManage.js',
  'lib/chatSessionStore.js',
  'api/chat.js',
];

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

const sections = files.map((rel) => {
  const content = fs.readFileSync(path.join(root, rel), 'utf8');
  const numbered = content.split(/\r?\n/).map((line, i) => {
    const n = String(i + 1).padStart(4, ' ');
    return `<span class="ln">${n}</span> ${escapeHtml(line)}`;
  }).join('\n');
  return `<section class="file"><h1>${escapeHtml(rel)}</h1><pre><code>${numbered}</code></pre></section>`;
}).join('\n');

const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>Montana Chatbot Source Export</title>
<style>
  @page { margin: 14mm 12mm; }
  * { box-sizing: border-box; }
  body {
    font-family: 'Segoe UI', Tahoma, Arial, sans-serif;
    color: #111;
    margin: 0;
    padding: 0;
  }
  .cover {
    page-break-after: always;
    padding: 40px 20px;
  }
  .cover h1 { font-size: 28px; margin: 0 0 8px; }
  .cover p { color: #444; margin: 4px 0; font-size: 13px; }
  .cover ul { margin-top: 24px; padding-left: 20px; line-height: 1.8; }
  .file { page-break-before: always; }
  h1 {
    font-size: 16px;
    margin: 0 0 12px;
    padding-bottom: 6px;
    border-bottom: 2px solid #6b2d5c;
    color: #6b2d5c;
    font-family: Consolas, 'Courier New', monospace;
  }
  pre {
    margin: 0;
    white-space: pre-wrap;
    word-break: break-word;
    font-family: Consolas, 'Courier New', monospace;
    font-size: 8.5px;
    line-height: 1.35;
    background: #fafafa;
    border: 1px solid #e5e5e5;
    border-radius: 4px;
    padding: 10px 8px;
  }
  .ln { color: #999; user-select: none; }
</style>
</head>
<body>
  <div class="cover">
    <h1>Montana Chatbot — Source Export</h1>
    <p>Generated: ${new Date().toISOString().slice(0, 10)}</p>
    <p>Project: montana2</p>
    <ul>
      ${files.map((f) => `<li>${escapeHtml(f)}</li>`).join('')}
    </ul>
  </div>
  ${sections}
</body>
</html>`;

const outHtml = path.join(root, 'chatbot-source-export.html');
const outPdf = path.join(root, 'chatbot-source-export.pdf');
fs.writeFileSync(outHtml, html, 'utf8');

const browser = await puppeteer.launch({
  headless: true,
  args: ['--no-sandbox', '--disable-setuid-sandbox'],
});
const page = await browser.newPage();
const fileUrl = 'file:///' + outHtml.replace(/\\/g, '/');
await page.goto(fileUrl, { waitUntil: 'networkidle0' });
await page.pdf({
  path: outPdf,
  format: 'A4',
  printBackground: true,
  margin: { top: '12mm', bottom: '12mm', left: '10mm', right: '10mm' },
});
await browser.close();
fs.unlinkSync(outHtml);

const sizeKb = Math.round(fs.statSync(outPdf).size / 1024);
console.log(`Created ${outPdf} (${sizeKb} KB)`);
