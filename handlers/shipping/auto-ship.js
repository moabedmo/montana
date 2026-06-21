'use strict';

const { createShippingOrder, getShippingSettings } = require('../../lib/shipping');
const { setCors, sendJson, readJsonBody, checkAdmin } = require('../../lib/http');

var pendingCount = 0;
var BATCH_SIZE = Number(process.env.BOSTA_BATCH_SIZE) || 3;

async function registerOrder(order) {
  var settings = await getShippingSettings().catch(function () { return null; });
  if (!settings || settings.status !== 'connected') return { ok: false, error: 'Shipping not connected' };

  var result = await createShippingOrder({
    id: order.id,
    order_id: order.id,
    name: order.name,
    phone: order.phone,
    address: order.address,
    items: (order.items || []).map(function (i) {
      return { name: i.name || i.id, quantity: i.qty || 1, price: i.price || 0 };
    }),
    total: order.total || 0,
    cod: true
  });

  if (result.ok) {
    pendingCount++;
    console.log('[auto-ship] Order ' + order.id + ' registered with Bosta. Tracking: ' + result.tracking_id + ' (' + pendingCount + '/' + BATCH_SIZE + ')');

    if (pendingCount >= BATCH_SIZE) {
      pendingCount = 0;
      console.log('[auto-ship] Batch of ' + BATCH_SIZE + ' reached — pickup request triggered');
      await notifyPickup(order);
    }
  } else {
    console.error('[auto-ship] Failed to register order ' + order.id + ':', result.error);
  }

  return result;
}

async function notifyPickup(lastOrder) {
  try {
    var telegram = require('../../lib/telegram');
    var tgToken = process.env.TELEGRAM_BOT_TOKEN || process.env.TG_BOT_TOKEN;
    var tgChat = process.env.TELEGRAM_CHAT_ID || process.env.TG_CHAT_ID;
    if (tgToken && tgChat) {
      var msg = '📦 تم تجميع ' + BATCH_SIZE + ' أوردرات في بوسطه!\n\nآخر أوردر: #' + (lastOrder.id || '') + '\n\n🚚 المندوب هيتواصل معاك لاستلام الشحنات.';
      await telegram.sendTelegramMessage(tgToken, tgChat, msg);
    }
  } catch (e) {
    console.error('[auto-ship] Telegram notify error:', e.message);
  }
}

async function handler(req, res) {
  setCors(res);

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }

  if (req.method !== 'POST') {
    sendJson(res, 405, { error: 'Method not allowed' });
    return;
  }

  try {
    var body = await readJsonBody(req);
    if (!body.id || !body.name || !body.phone || !body.address) {
      sendJson(res, 400, { error: 'Order must have id, name, phone, address' });
      return;
    }

    var result = await registerOrder(body);
    if (!result.ok) {
      sendJson(res, 502, { ok: false, error: result.error });
      return;
    }

    sendJson(res, 200, {
      ok: true,
      tracking_id: result.tracking_id,
      shipment_id: result.shipment_id,
      batch_count: pendingCount,
      batch_size: BATCH_SIZE
    });
  } catch (err) {
    console.error('[auto-ship]', err);
    sendJson(res, 500, { error: err.message || 'Internal server error' });
  }
}

module.exports = handler;
module.exports.registerOrder = registerOrder;
