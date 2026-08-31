const puppeteer = require('puppeteer');
const path = require('path');

const HTML = process.argv[2];
const OUT = process.argv[3];

(async () => {
  const browser = await puppeteer.launch({
    headless: 'new',
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    args: ['--no-sandbox']
  });
  const page = await browser.newPage();
  await page.goto('file:///' + HTML.replace(/\\/g, '/'), { waitUntil: 'networkidle0' });
  await page.pdf({
    path: OUT,
    format: 'A4',
    printBackground: true,
    preferCSSPageSize: true,
    displayHeaderFooter: true,
    headerTemplate: '<div></div>',
    footerTemplate:
      '<div style="width:100%;font-size:7.5px;color:#8C929D;font-family:Segoe UI,Tahoma,sans-serif;padding:0 16mm;display:flex;justify-content:space-between;direction:rtl">' +
      '<span>Bella Donna — تحليل السيو والسوشيال ميديا</span>' +
      '<span class="pageNumber"></span>' +
      '</div>'
  });
  await browser.close();
  console.log('PDF written: ' + OUT);
})().catch(e => { console.error(e); process.exit(1); });
