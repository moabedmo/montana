/**
 * Quick unit checks for volunteered delivery-details parsing.
 * Run: node scripts/test-chat-delivery-parse.js
 */
const {
  /* not exported — reimplement minimal checks by requiring chatEngine internals via eval of helpers */
} = {};

// Inline copies of the pure helpers (keep in sync with chatEngine.js) for a
// lightweight regression without spinning Gemini.
const { extractPhoneFromText, toWesternDigits, normalizePhone } = require('../lib/chatSessionStore');

function looksLikePersonName(message) {
  const name = String(message || '').trim().replace(/\s+/g, ' ');
  if (name.length < 3 || name.length > 60) return false;
  if (normalizePhone(name) || /\d{8,}/.test(name)) return false;
  if (!/[a-zA-Z\u0600-\u06FF]/.test(name)) return false;
  return true;
}

function looksLikeVolunteeredDeliveryDetails(message) {
  const raw = String(message || '').trim();
  if (!raw || raw.length < 18) return false;
  const phone = extractPhoneFromText(raw);
  if (!phone) return false;
  const withoutPhone = toWesternDigits(raw)
    .replace(/(?:\+?20|0020)?0?1\d{9}/g, ' ')
    .replace(/[٠-٩۰-۹]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (withoutPhone.length < 8) return false;
  const hasAddressSignal =
    /(شارع|ش\.|ميدان|حي|عمارة|عقار|دور|شقه|شقة|برج|متفرع|امام|أمام|جنب|نزلة|كوبري|محافظة|القاهرة|القاهره|الجيزة|الجيزه|اسكندر|إسكند)/i.test(withoutPhone)
    || /\d{1,4}\s*\S{3,}/.test(withoutPhone);
  const hasNameSignal =
    /(باسم|اسمي|انا|أنا)\s+\S{2,}/i.test(withoutPhone)
    || looksLikePersonName(withoutPhone.split(/[\n,،]/)[0] || '')
    || (withoutPhone.split(/\s+/).filter(Boolean).length >= 2 && /[\u0600-\u06FF]{2,}/.test(withoutPhone));
  return hasAddressSignal || (hasNameSignal && withoutPhone.length >= 12);
}

function parseVolunteeredDeliveryDetails(message) {
  const raw = String(message || '').trim();
  const phone = extractPhoneFromText(raw);
  if (!phone) return null;

  const western = toWesternDigits(raw);
  const lines = western
    .split(/[\n\r]+/)
    .map((l) => l.trim())
    .filter(Boolean);

  let name = null;
  let addressParts = [];

  for (const line of lines) {
    if (extractPhoneFromText(line) && line.replace(/[^\d+]/g, '').length >= 10 && line.length < 20) {
      continue;
    }
    const cleaned = line
      .replace(/(?:\+?20|0020)?0?1\d{9}/g, ' ')
      .replace(/^(باسم|اسمي|الاسم)\s*[:\-]?\s*/i, '')
      .replace(/\s+/g, ' ')
      .trim();
    if (!cleaned) continue;

    if (!name && looksLikePersonName(cleaned) && cleaned.length <= 60) {
      name = cleaned;
      continue;
    }
    addressParts.push(cleaned);
  }

  if (!name || !addressParts.length) {
    const blob = western
      .replace(/(?:\+?20|0020)?0?1\d{9}/g, ' | ')
      .replace(/^(باسم|اسمي|الاسم)\s*[:\-]?\s*/i, '')
      .replace(/\s+/g, ' ')
      .trim();
    const chunks = blob.split(/\s*\|\s*/).map((c) => c.trim()).filter(Boolean);
    if (!name && chunks[0] && looksLikePersonName(chunks[0].slice(0, 60))) {
      name = chunks[0].split(/\s+/).slice(0, 4).join(' ');
      const rest = chunks.slice(1).join(' ').trim() || chunks[0].slice(name.length).trim();
      if (rest && rest !== name) addressParts.push(rest);
    } else if (!addressParts.length && chunks.length) {
      addressParts.push(chunks.join(' '));
    }
  }

  const address = addressParts.join('، ').replace(/\s+/g, ' ').trim();
  if (!phone || !address || address.length < 6) return null;
  return { phone, name, address };
}

const sample = `باسم فريدة صفوت
٠١١٥٤٢٤٦١٧٨
٣٣ شارع النواوي متفرع من ش السد السيدة زينب القاهره`;

const assert = (c, m) => { if (!c) throw new Error(m); };

assert(looksLikeVolunteeredDeliveryDetails(sample), 'should detect delivery dump');
assert(!looksLikeVolunteeredDeliveryDetails('تمام عايزاهم'), 'should not treat want-them as delivery');
assert(!looksLikeVolunteeredDeliveryDetails('كريم التفتيح'), 'product name alone');

const parsed = parseVolunteeredDeliveryDetails(sample);
console.log(parsed);
assert(parsed.phone === '01154246178', 'phone ' + parsed.phone);
assert(parsed.name && /فريدة/.test(parsed.name), 'name ' + parsed.name);
assert(/شارع النواوي/.test(parsed.address), 'address ' + parsed.address);

console.log('OK');
