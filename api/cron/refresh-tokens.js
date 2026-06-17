'use strict';

const { refreshExpiringTokens } = require('../lib/token-refresh');
const { sendJson } = require('../lib/http');

function checkCronAuth(req) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true;
  const auth = req.headers['authorization'] || '';
  if (auth === 'Bearer ' + secret) return true;
  if (req.headers['x-cron-secret'] === secret) return true;
  return false;
}

async function handler(req, res) {
  if (req.method === 'GET' || req.method === 'POST') {
    if (!checkCronAuth(req)) {
      sendJson(res, 401, { error: 'Unauthorized' });
      return;
    }

    try {
      const result = await refreshExpiringTokens();
      console.log('[cron/refresh-tokens]', JSON.stringify({
        checked: result.checked,
        refreshed: result.refreshed,
        failed: result.failed
      }));
      sendJson(res, 200, result);
    } catch (err) {
      console.error('[cron/refresh-tokens]', err);
      sendJson(res, 500, { error: err.message || 'Refresh job failed' });
    }
    return;
  }

  sendJson(res, 405, { error: 'Method not allowed' });
}

module.exports = handler;
