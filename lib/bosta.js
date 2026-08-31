// Bosta courier API — https://api.bosta.co/api/v0
const crypto = require('crypto');

const BASE_URL = process.env.BOSTA_BASE_URL || 'https://api.bosta.co/api/v0';

/** Common governorate / shipping label → Bosta city code */
const GOV_CITY_CODE = {
  cairo: 'EG-01', 'القاهرة': 'EG-01', 'qahira': 'EG-01',
  giza: 'EG-25', 'الجيزة': 'EG-25', 'giz': 'EG-25',
  alex: 'EG-02', alexandria: 'EG-02', 'الإسكندرية': 'EG-02', 'اسكندرية': 'EG-02',
  '6 october': 'EG-25', '6th of october': 'EG-25', october: 'EG-25', 'أكتوبر': 'EG-25',
  fayoum: 'EG-15', 'الفيوم': 'EG-15',
  behira: 'EG-04', 'beheira': 'EG-04', 'البحيرة': 'EG-04',
  dakahlia: 'EG-05', 'الدقهلية': 'EG-05',
  sharqia: 'EG-10', 'الشرقية': 'EG-10',
  gharbia: 'EG-07', 'الغربية': 'EG-07',
  monufia: 'EG-09', 'المنوفية': 'EG-09',
  qalyubia: 'EG-06', 'kalioubia': 'EG-06', 'القليوبية': 'EG-06',
  ismailia: 'EG-11', 'الإسماعيلية': 'EG-11',
  suez: 'EG-12', 'السويس': 'EG-12',
  'port said': 'EG-13', 'بورسعيد': 'EG-13',
  damietta: 'EG-14', 'دمياط': 'EG-14',
  minya: 'EG-19', menya: 'EG-19', 'المنيا': 'EG-19',
  assiut: 'EG-17', assuit: 'EG-17', 'أسيوط': 'EG-17',
  sohag: 'EG-18', 'سوهاج': 'EG-18',
  qena: 'EG-20', 'قنا': 'EG-20',
  luxor: 'EG-22', 'الأقصر': 'EG-22',
  aswan: 'EG-21', 'أسوان': 'EG-21',
  'north coast': 'EG-03', 'الساحل': 'EG-03',
};

function getApiKey() {
  const key = process.env.BOSTA_API_KEY;
  if (!key) throw new Error('BOSTA_API_KEY not configured');
  return key;
}

async function bostaFetch(path, { method = 'GET', body } = {}) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      Authorization: getApiKey(),
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data;
  try { data = text ? JSON.parse(text) : null; } catch { data = { raw: text }; }
  if (!res.ok) {
    const msg = data?.message || data?.error || text || `Bosta HTTP ${res.status}`;
    const err = new Error(msg);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

function normGov(s) {
  return String(s || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function governorateToCityCode(governorate, city) {
  const g = normGov(governorate);
  const c = normGov(city);
  for (const key of [g, c]) {
    if (GOV_CITY_CODE[key]) return GOV_CITY_CODE[key];
    for (const [k, code] of Object.entries(GOV_CITY_CODE)) {
      if (key.includes(k) || k.includes(key)) return code;
    }
  }
  return 'EG-01';
}

function splitName(full) {
  const parts = String(full || 'Customer').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return { firstName: 'Customer', lastName: '.' };
  if (parts.length === 1) return { firstName: parts[0], lastName: '.' };
  return { firstName: parts[0], lastName: parts.slice(1).join(' ') };
}

function normalizePhone(phone) {
  let p = String(phone || '').replace(/\D/g, '');
  if (p.startsWith('20')) p = p.slice(2);
  if (p.startsWith('0')) p = p.slice(1);
  if (p.length === 10) return '0' + p;
  return String(phone || '').trim() || '01000000000';
}

function codAmount(order) {
  if (order.payment_method === 'cod') return Math.max(0, Number(order.total) || 0);
  return 0;
}

function itemsDescription(items) {
  const list = (items || []).slice(0, 5).map(i => `${i.product_name || 'Item'} x${i.quantity || 1}`);
  const extra = (items || []).length > 5 ? ` +${items.length - 5} more` : '';
  return (list.join(', ') || 'Montana order') + extra;
}

function buildDeliveryPayload(order, items, { webhookUrl } = {}) {
  const pickupId = process.env.BOSTA_PICKUP_LOCATION_ID;
  const cityCode = governorateToCityCode(order.governorate, order.city);
  const receiver = splitName(order.customer_name);
  const addressLine = [order.address, order.city, order.governorate].filter(Boolean).join(' — ') || 'Address on file';

  const payload = {
    type: 10,
    specs: {
      packageType: 'Parcel',
      size: 'SMALL',
      packageDetails: {
        itemsCount: Math.max(1, (items || []).reduce((s, i) => s + (Number(i.quantity) || 1), 0)),
        description: itemsDescription(items).slice(0, 200),
      },
    },
    receiver: {
      firstName: receiver.firstName,
      lastName: receiver.lastName,
      phone: normalizePhone(order.customer_phone),
    },
    dropOffAddress: {
      firstLine: addressLine.slice(0, 250),
      city: cityCode,
      buildingNumber: '1',
    },
    cod: codAmount(order),
    businessReference: order.order_number,
    notes: [
      order.notes,
      order.payment_method !== 'cod' ? `Paid: ${order.payment_method}` : null,
    ].filter(Boolean).join(' | ').slice(0, 500) || undefined,
  };

  if (pickupId) payload.businessLocationId = pickupId;
  if (webhookUrl) payload.webhookUrl = webhookUrl;
  return payload;
}

async function createDelivery(order, items, opts = {}) {
  const payload = buildDeliveryPayload(order, items, opts);
  const data = await bostaFetch('/deliveries', { method: 'POST', body: payload });
  const delivery = data?.data || data?.delivery || data;
  return {
    deliveryId: delivery?._id || delivery?.id || null,
    trackingNumber: delivery?.trackingNumber || delivery?.tracking_number || null,
    state: delivery?.state?.value || delivery?.state || null,
    raw: delivery,
  };
}

/** Map Bosta state code → montana order status */
function mapBostaStateToOrderStatus(state) {
  const code = typeof state === 'object' ? (state?.code ?? state?.value) : state;
  const n = Number(code);
  if (n === 45) return 'delivered';
  if ([16, 35, 36, 40].includes(n)) return 'shipped';
  if ([50, 55, 80].includes(n)) return null; // failed/cancelled — don't auto-change
  if ([20, 21, 22, 25, 30].includes(n)) return 'preparing';
  return null;
}

function webhookSecret() {
  return process.env.BOSTA_WEBHOOK_SECRET || '';
}

function verifyWebhookToken(queryToken) {
  const secret = webhookSecret();
  if (!secret) return true;
  return queryToken === secret;
}

function publicWebhookUrl(baseUrl) {
  const secret = webhookSecret();
  const base = (baseUrl || 'https://www.montana.com.eg').replace(/\/$/, '');
  return secret ? `${base}/api/bosta-webhook?token=${encodeURIComponent(secret)}` : `${base}/api/bosta-webhook`;
}

function generateWebhookSecret() {
  return crypto.randomBytes(24).toString('hex');
}

module.exports = {
  bostaFetch,
  createDelivery,
  buildDeliveryPayload,
  governorateToCityCode,
  mapBostaStateToOrderStatus,
  verifyWebhookToken,
  publicWebhookUrl,
  generateWebhookSecret,
  getApiKey,
};
