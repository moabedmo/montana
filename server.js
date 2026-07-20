const express = require('express');
const path = require('path');
const {
  setSecurityHeaders,
  isBlockedPath,
  corsMiddleware,
} = require('./lib/security');

const app = express();
app.use(corsMiddleware);
app.use(express.json({ limit: '256kb' }));
app.use((req, res, next) => {
  setSecurityHeaders(res);
  if (req.path.startsWith('/crm/')) {
    res.setHeader('Cache-Control', 'no-store');
  }
  next();
});
app.use((req, res, next) => {
  if (isBlockedPath(req.path)) return res.status(404).end();
  next();
});
app.use(express.static(path.join(__dirname), {
  dotfiles: 'deny',
  index: ['index.html'],
  setHeaders(res, filePath) {
    // Keep CRM assets uncacheable so soft refresh never gets stale HTML/JS.
    // (express.static would otherwise overwrite earlier Cache-Control.)
    const norm = filePath.replace(/\\/g, '/');
    if (norm.includes('/crm/')) {
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
    }
  },
}));

// ===== AGENT NAME =====
app.get('/api/agent', (req, res) => {
    const agents = [
        { name: 'لايان', letter: 'ل', emoji: '💜' },
        { name: 'نوران', letter: 'ن', emoji: '🌸' },
        { name: 'نور', letter: 'ن', emoji: '✨' },
    ];
    const index = Math.floor(Date.now() / (2 * 60 * 60 * 1000)) % agents.length;
    res.json(agents[index]);
});

// ===== CHAT ENDPOINT =====
const chatHandler = require('./api/chat.js');
app.post('/api/chat', chatHandler);

app.post('/api/send-telegram', require('./api/send-telegram.js'));
app.post('/api/telegram-webhook', require('./api/telegram-webhook.js'));
app.get('/api/chat-notify', require('./api/chat-notify.js'));
app.get('/api/paymob-create', require('./api/paymob-create.js'));
app.post('/api/paymob-create', require('./api/paymob-create.js'));
app.post('/api/paymob-webhook', require('./api/paymob-webhook.js'));
app.get('/api/integrations-status', require('./api/integrations-status.js'));

// ===== MESSAGING WEBHOOKS (WhatsApp/Messenger/Instagram) =====
app.all('/api/whatsapp-webhook', require('./api/whatsapp-webhook.js'));
app.all('/api/messenger-webhook', require('./api/messenger-webhook.js'));
app.all('/api/instagram-webhook', require('./api/instagram-webhook.js'));

// ===== DEV-ONLY ENDPOINTS (disabled in production) =====
if (process.env.NODE_ENV !== 'production' && !process.env.VERCEL) {
  const fs = require('fs');

  app.post('/api/bake-settings', (req, res) => {
      try {
          const data = req.body.localStorage || {};
          let html = fs.readFileSync(path.join(__dirname, 'brochure.html'), 'utf8');

          const marker = '/* BAKED */';
          const block = `${marker}\nvar BAKED = ${JSON.stringify(data)};\n${marker}`;

          if (html.includes(marker)) {
              html = html.replace(/\/\* BAKED \*\/[\s\S]*?\/\* BAKED \*\//, block);
          } else {
              html = html.replace('var currentImg = 0;', block + '\nvar currentImg = 0;');
          }

          fs.writeFileSync(path.join(__dirname, 'brochure.html'), html, 'utf8');
          res.json({ ok: true });
      } catch (err) {
          res.status(500).json({ error: err.message });
      }
  });

  const puppeteer = require('puppeteer');

  app.post('/api/export-pdf', async (req, res) => {
      let browser;
      try {
          const settings = req.body.settings || {};
          browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
          const page = await browser.newPage();
          const serverPort = req.socket.localPort;
          await page.goto(`http://localhost:${serverPort}/brochure.html`, { waitUntil: 'networkidle0', timeout: 30000 });
          await page.evaluate((s) => {
              document.querySelectorAll('.no-print').forEach(el => el.style.display = 'none');
              Object.keys(s).forEach(k => {
                  localStorage.setItem('brochure_img_' + k, JSON.stringify(s[k]));
              });
              var coverEl = document.querySelector('.cover-img');
              var allBgs = document.querySelectorAll('.pp-bg, .p3-bg, .back-bg');
              function gs(k) { return s[k] || null; }
              var s0 = gs(0);
              if (s0 && coverEl) { coverEl.style.setProperty('--bg-x', s0.x+'%'); coverEl.style.setProperty('--bg-y', s0.y+'%'); }
              for (var i = 0; i < allBgs.length; i++) {
                  var bg = gs(i+1);
                  if (bg && allBgs[i]) { allBgs[i].style.setProperty('--bg-x', bg.x+'%'); allBgs[i].style.setProperty('--bg-y', bg.y+'%'); }
              }
              var girl = document.querySelector('.pp2-girl');
              var s6 = gs(6);
              if (s6 && girl) { girl.style.setProperty('--girl-size', s6.size+'%'); girl.style.setProperty('--girl-x', s6.x+'%'); girl.style.setProperty('--girl-y', (50-s6.y)+'%'); }
              var p3girl = document.querySelector('.p3-bottom-img');
              var s7 = gs(7);
              if (s7 && p3girl) { p3girl.style.setProperty('--p3girl-size', s7.size+'%'); p3girl.style.setProperty('--p3girl-x', s7.x+'%'); p3girl.style.setProperty('--p3girl-y', (50-s7.y)+'%'); }
              var p3top = document.querySelector('.p3-top-img');
              var s8 = gs(8);
              if (s8 && p3top) { p3top.style.setProperty('--p3top-size', s8.size+'%'); p3top.style.setProperty('--p3top-x', s8.x+'%'); p3top.style.setProperty('--p3top-y', (50-s8.y)+'%'); }
          }, settings);
          await new Promise(r => setTimeout(r, 500));
          const pdfBuffer = await page.pdf({
              format: 'A4',
              printBackground: true,
              margin: { top: 0, right: 0, bottom: 0, left: 0 }
          });
          res.setHeader('Content-Type', 'application/pdf');
          res.setHeader('Content-Disposition', 'attachment; filename=Montana_Brochure.pdf');
          res.send(pdfBuffer);
      } catch (err) {
          res.status(500).json({ error: err.message });
      } finally {
          if (browser) await browser.close();
      }
  });
}

// ===== START SERVER =====
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
    console.log(`Montana server running on http://localhost:${PORT}`);
});
