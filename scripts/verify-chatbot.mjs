import { chromium } from 'playwright';

const url = 'http://localhost:8765/index.html';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));

await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
await page.waitForTimeout(1500);

const ui = await page.evaluate(() => ({
  name: document.querySelector('#chat-header .name')?.textContent,
  status: document.getElementById('chat-status')?.textContent,
  placeholder: document.getElementById('chat-input')?.placeholder,
  send: document.getElementById('chat-send')?.textContent,
  avatar: document.querySelector('#chat-header .avatar')?.textContent,
  products: (window.MONTANA_PRODUCTS || []).length,
  chatbot: typeof window.MontanaChatbot !== 'undefined'
}));

await page.click('#chat-btn');
await page.waitForTimeout(800);

const chat = await page.evaluate(() => {
  const msgs = [...document.querySelectorAll('#chat-messages .msg')].map(m => m.textContent.slice(0, 50));
  const qrs = [...document.querySelectorAll('.qr-btn')].map(b => b.textContent);
  return { msgs, qrs };
});

console.log(JSON.stringify({ ui, chat, errors }, null, 2));
await browser.close();
if (errors.length || (ui.name && ui.name.includes('?'))) process.exitCode = 1;
