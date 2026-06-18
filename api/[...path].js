'use strict';

const ROUTES = {
  'settings/social': require('../handlers/settings/social'),
  'settings/gemini': require('../handlers/settings/gemini'),
  'settings/chat': require('../handlers/settings/chat'),
  'settings/shipping': require('../handlers/settings/shipping'),
  'chat/gemini': require('../handlers/chat/gemini'),
  'chat/ai': require('../handlers/chat/ai'),
  'shipping/calculate': require('../handlers/shipping/calculate'),
  'shipping/create': require('../handlers/shipping/create'),
  'shipping/track': require('../handlers/shipping/track'),
  'webhooks/meta': require('../handlers/webhooks/meta'),
  'messages/social': require('../handlers/messages/social'),
  'settings/deposit': require('../handlers/settings/deposit'),
  'orders/deposit-proof': require('../handlers/orders/deposit-proof'),
  'orders/deposit-status': require('../handlers/orders/deposit-status'),
  'orders/notify': require('../handlers/orders/notify'),
  'webhooks/telegram': require('../handlers/webhooks/telegram'),
  'telegram/send': require('../handlers/telegram/send'),
  'cron/refresh-tokens': require('../handlers/cron/refresh-tokens')
};

module.exports = async function vercelApiRouter(req, res) {
  var parts = req.query && req.query.path;
  var pathKey = Array.isArray(parts) ? parts.join('/') : String(parts || '');
  if (!pathKey) {
    var raw = (req.url || '').split('?')[0].replace(/^\/api\/?/, '');
    pathKey = decodeURIComponent(raw);
  }
  var routeHandler = ROUTES[pathKey];

  if (!routeHandler) {
    res.statusCode = 404;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify({ ok: false, error: 'Not found' }));
    return;
  }

  return routeHandler(req, res);
};
