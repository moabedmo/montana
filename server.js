'use strict';

try {
  require('dotenv').config();
} catch (e) { /* dotenv optional */ }

const http = require('http');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');

const socialHandler = require('./handlers/settings/social');
const geminiSettingsHandler = require('./handlers/settings/gemini');
const chatSettingsHandler = require('./handlers/settings/chat');
const geminiChatHandler = require('./handlers/chat/gemini');
const chatAiHandler = require('./handlers/chat/ai');
const shippingSettingsHandler = require('./handlers/settings/shipping');
const shippingCalculateHandler = require('./handlers/shipping/calculate');
const shippingCreateHandler = require('./handlers/shipping/create');
const shippingTrackHandler = require('./handlers/shipping/track');
const metaWebhookHandler = require('./handlers/webhooks/meta');
const sendMessageHandler = require('./handlers/messages/social');
const depositSettingsHandler = require('./handlers/settings/deposit');
const depositProofHandler = require('./handlers/orders/deposit-proof');
const orderNotifyHandler = require('./handlers/orders/notify');
const telegramSendHandler = require('./handlers/telegram/send');
const refreshTokensHandler = require('./handlers/cron/refresh-tokens');
const { refreshExpiringTokens } = require('./lib/token-refresh');

const PORT = Number(process.env.PORT) || 3000;
const ROOT = path.resolve(__dirname);
const REFRESH_INTERVAL_MS = Number(process.env.TOKEN_REFRESH_INTERVAL_MS) || 24 * 60 * 60 * 1000;

const API_ROUTES = {
  '/api/settings/social': socialHandler,
  '/api/settings/gemini': geminiSettingsHandler,
  '/api/settings/chat': chatSettingsHandler,
  '/api/chat/gemini': geminiChatHandler,
  '/api/chat/ai': chatAiHandler,
  '/api/settings/shipping': shippingSettingsHandler,
  '/api/shipping/calculate': shippingCalculateHandler,
  '/api/shipping/create': shippingCreateHandler,
  '/api/shipping/track': shippingTrackHandler,
  '/api/webhooks/meta': metaWebhookHandler,
  '/api/messages/social': sendMessageHandler,
  '/api/settings/deposit': depositSettingsHandler,
  '/api/orders/deposit-proof': depositProofHandler,
  '/api/orders/notify': orderNotifyHandler,
  '/api/telegram/send': telegramSendHandler,
  '/api/cron/refresh-tokens': refreshTokensHandler
};

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2'
};

function toExpressLikeReq(req, bodyBuffer) {
  const url = new URL(req.url, 'http://localhost');
  return {
    method: req.method,
    url: req.url,
    headers: req.headers,
    query: Object.fromEntries(url.searchParams.entries()),
    body: bodyBuffer && bodyBuffer.length
      ? (function () {
          try { return JSON.parse(bodyBuffer.toString('utf8')); }
          catch (e) { return {}; }
        })()
      : undefined,
    [Symbol.asyncIterator]: async function* () {
      if (bodyBuffer && bodyBuffer.length) yield bodyBuffer;
    }
  };
}

function toExpressLikeRes(res) {
  return {
    statusCode: 200,
    setHeader(key, value) {
      res.setHeader(key, value);
    },
    end(payload) {
      res.statusCode = this.statusCode || 200;
      res.end(payload);
    },
    status(code) {
      this.statusCode = code;
      return this;
    }
  };
}

function serveStatic(filePath, res) {
  fs.readFile(filePath, function (err, data) {
    if (err) {
      res.statusCode = 404;
      res.end('Not found');
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    res.setHeader('Content-Type', MIME[ext] || 'application/octet-stream');
    res.end(data);
  });
}

function serveStaticWithHtmlFallback(filePath, res) {
  fs.stat(filePath, function (err, stat) {
    if (!err && stat.isDirectory()) {
      return serveStatic(path.join(filePath, 'index.html'), res);
    }

    if (!err && stat.isFile()) {
      return serveStatic(filePath, res);
    }

    var ext = path.extname(filePath).toLowerCase();
    if (!ext) {
      var htmlPath = filePath + '.html';
      fs.stat(htmlPath, function (htmlErr, htmlStat) {
        if (!htmlErr && htmlStat.isFile()) {
          return serveStatic(htmlPath, res);
        }
        serveStatic(filePath, res);
      });
      return;
    }

    serveStatic(filePath, res);
  });
}

function runTokenRefreshJob(label) {
  refreshExpiringTokens()
    .then(function (result) {
      console.log('[' + label + '] token refresh:', result.refreshed + ' refreshed, ' + result.failed + ' failed');
    })
    .catch(function (err) {
      console.error('[' + label + '] token refresh error:', err.message);
    });
}

const server = http.createServer(async function (req, res) {
  const url = new URL(req.url, 'http://localhost');
  const pathname = url.pathname;

  if (API_ROUTES[pathname]) {
    const chunks = [];
    req.on('data', function (chunk) { chunks.push(chunk); });
    req.on('end', async function () {
      const bodyBuffer = Buffer.concat(chunks);
      const expressReq = toExpressLikeReq(req, bodyBuffer);
      const expressRes = toExpressLikeRes(res);
      try {
        await API_ROUTES[pathname](expressReq, expressRes);
        if (!res.writableEnded) {
          res.statusCode = expressRes.statusCode || 200;
          res.end();
        }
      } catch (err) {
        console.error('[server]', err);
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  var filePath = path.join(ROOT, pathname === '/' ? 'index.html' : pathname);
  if (!filePath.startsWith(ROOT)) {
    res.statusCode = 403;
    res.end('Forbidden');
    return;
  }

  serveStaticWithHtmlFallback(filePath, res);
});

server.on('error', function (err) {
  if (err.code === 'EADDRINUSE') {
    console.error('\n[!] Port ' + PORT + ' is already in use.');
    console.error('    The server may already be running: http://localhost:' + PORT);
    console.error('    To stop it:  npm run stop');
    console.error('    Then start:   npm start');
    console.error('    Or other port: $env:PORT=3001; npm start\n');
    process.exit(1);
  }
  throw err;
});

server.listen(PORT, function () {
  console.log('Montana server running at http://localhost:' + PORT);
  console.log('API: /api/settings/chat, /api/chat/ai, /api/settings/social, /api/settings/shipping, /api/shipping/*, /api/webhooks/meta');

  var chatProvider = String(process.env.CHAT_PROVIDER || 'gemini').toLowerCase();
  var groqKey = String(process.env.GROQ_API_KEY || '').trim();
  var geminiKey = String(process.env.GEMINI_API_KEY || '').trim();
  if (chatProvider === 'groq') {
    if (!groqKey) {
      console.warn('[!] GROQ_API_KEY missing in .env — get one at https://console.groq.com/keys');
    } else if (groqKey.indexOf('gsk_') !== 0) {
      console.warn('[!] GROQ_API_KEY should start with gsk_');
    } else {
      console.log('[ok] Chat AI: Groq (' + (process.env.GROQ_MODEL || 'allam-2-7b') + ')');
    }
  } else if (!geminiKey) {
    console.warn('[!] GEMINI_API_KEY missing in .env — get one at https://aistudio.google.com/apikey');
  } else {
    console.log('[ok] Chat AI: Gemini (' + (process.env.GEMINI_MODEL || 'gemini-2.0-flash') + ', vision, AI-first)');
  }

  setTimeout(function () {
    runTokenRefreshJob('startup');
  }, 15000);

  setInterval(function () {
    runTokenRefreshJob('interval');
  }, REFRESH_INTERVAL_MS);
});
