import { chromium } from 'playwright';

const url = 'http://localhost:8765/index.html';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));

await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
await page.waitForTimeout(2500);

const before = await page.evaluate(() => ({
  lang: document.documentElement.lang,
  h1: document.querySelector('#ov-open h1')?.innerText?.slice(0, 30),
  ovDisplay: document.getElementById('ov-open')?.style.display,
  ovOpacity: document.getElementById('ov-open')?.style.opacity,
  scroller: getComputedStyle(document.getElementById('scroller')).display,
  appMode: document.body.classList.contains('app-mode'),
  cart: !!window.MontanaCart,
  go: typeof window.go,
}));

await page.click('#btn-ar');
await page.waitForTimeout(500);

const after = await page.evaluate(() => ({
  lang: document.documentElement.lang,
  dir: document.documentElement.dir,
  h1: document.querySelector('#ov-open h1')?.innerText?.slice(0, 40),
  btnArOn: document.getElementById('btn-ar')?.classList.contains('on'),
}));

console.log(JSON.stringify({ before, after, errors }, null, 2));
await browser.close();

if (errors.length) process.exitCode = 1;
