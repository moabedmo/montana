/* Montana — shipping API client (uses /api/shipping/* with local fallback) */
window.MontanaShipping = (function () {
  function fallbackShipping(subtotal) {
    return subtotal >= 1000 ? 0 : 60;
  }

  async function calculate(options) {
    options = options || {};
    var subtotal = options.subtotal || 0;
    try {
      var r = await fetch('/api/shipping/calculate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subtotal: subtotal,
          address: options.address || '',
          city: options.city || '',
          weight: options.weight || 1,
          items: options.items || [],
          cod: options.cod !== false
        })
      });
      var data = await r.json();
      if (data.ok && data.cost != null) return { ok: true, cost: Number(data.cost), source: 'api' };
    } catch (e) {}
    return { ok: true, cost: fallbackShipping(subtotal), source: 'fallback' };
  }

  async function createShipment(order) {
    try {
      var r = await fetch('/api/shipping/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-key': localStorage.getItem('mn_api_key') || '' },
        body: JSON.stringify(order)
      });
      return await r.json();
    } catch (e) {
      return { ok: false, error: e.message };
    }
  }

  async function track(trackingId) {
    try {
      var r = await fetch('/api/shipping/track?id=' + encodeURIComponent(trackingId), {
        headers: { 'x-admin-key': localStorage.getItem('mn_api_key') || '' }
      });
      return await r.json();
    } catch (e) {
      return { ok: false, error: e.message };
    }
  }

  return { calculate: calculate, createShipment: createShipment, track: track, fallbackShipping: fallbackShipping };
})();
