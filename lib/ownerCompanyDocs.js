// Owner-only company documents — each file + meta stored under montana/company-docs/
// via SERVICE_ROLE (no single shared index that can wipe siblings).
const { createClient } = require('@supabase/supabase-js');
const { randomUUID } = require('crypto');

const SUPABASE_URL = 'https://ikryeyqrithikabwidov.supabase.co';
const SUPABASE_ANON =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlrcnlleXFyaXRoaWthYndpZG92Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE3MzY1ODcsImV4cCI6MjA5NzMxMjU4N30.kNfHPxV4fq67cOF8uFsTrLOxPYcLcmmDO3ScIHzI9Uo';
const SERVICE_KEY = process.env.SERVICE_ROLE || process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const BUCKET = 'montana';
const PREFIX = 'company-docs';
const FILES_PREFIX = `${PREFIX}/files`;
const META_PREFIX = `${PREFIX}/meta`;
const LEGACY_INDEX = `${PREFIX}/_index.json`;
const LINKS_PATH = `${PREFIX}/company-links.json`;
const STOCKISTS_PATH = `${PREFIX}/stockist-pharmacies.json`;
const MAX_BYTES = 50 * 1024 * 1024;
const MAX_DIRECT_BYTES = 3.2 * 1024 * 1024;

const DEFAULT_COMPANY_LINKS = [
  { key: 'website', label: 'الموقع', icon: 'fa-globe', url: 'https://www.montana.com.eg' },
  { key: 'facebook', label: 'فيسبوك', icon: 'fa-facebook', url: '' },
  { key: 'instagram', label: 'إنستجرام', icon: 'fa-instagram', url: '' },
  { key: 'amazon', label: 'أمازون', icon: 'fa-amazon', url: '' },
  { key: 'jumia', label: 'جوميا', icon: 'fa-bag-shopping', url: '' },
  { key: 'noon', label: 'نون', icon: 'fa-store', url: '' },
];

/** Default stockist pharmacies (where Montana products are sold). */
const DEFAULT_STOCKIST_SEED = [
  ...['ابوعلي', 'احمد يحيي', 'مصر', 'اسامة', 'وهبي', 'احمد نبوي'].map((name) => ({
    name, region: '6 أكتوبر', link: '', notes: '',
  })),
  ...[
    'آل عمران', 'البيه', 'علي', 'اميرة', 'الاسعاف', 'العساف', 'فاميلي', 'حواس',
    'العريش', 'غادة', 'نوران', 'سفنكس فارمازون', 'الوليد', 'التعاونية',
    'بيشوي صافي', 'عبد الرحمن السايس', 'medicine',
  ].map((name) => ({ name, region: 'فيصل', link: '', notes: '' })),
  ...[
    'الفيروز', 'لطيف', 'نور المحمدي', 'مستشفى الرحاب', 'الزغبي', 'المنيلاوي',
    'مبروك', 'محجبوب', 'زهرة السلام', 'دياسطي', 'احمد مختار', 'برسوم', 'القماح', 'خالد سمير',
  ].map((name) => ({ name, region: 'القاهرة', link: '', notes: '' })),
];

function adminClient() {
  if (!SERVICE_KEY) {
    const err = new Error('SERVICE_ROLE not configured');
    err.status = 503;
    throw err;
  }
  return createClient(SUPABASE_URL, SERVICE_KEY);
}

function userClient(token) {
  return createClient(SUPABASE_URL, SUPABASE_ANON, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
}

async function assertOwner(accessToken) {
  if (!accessToken) {
    const err = new Error('Unauthorized');
    err.status = 401;
    throw err;
  }
  const sb = userClient(accessToken);
  const { data, error } = await sb.rpc('is_owner');
  if (error || data !== true) {
    const err = new Error('Owner access required');
    err.status = 403;
    throw err;
  }
  const { data: userData } = await sb.auth.getUser();
  return { userId: userData?.user?.id || null };
}

function sanitizeFileName(name) {
  const base = String(name || 'file');
  const extMatch = base.match(/(\.[A-Za-z0-9]{1,8})$/);
  const ext = extMatch ? extMatch[1].toLowerCase() : '';
  const stem = base.slice(0, base.length - ext.length);
  const ascii = stem
    .normalize('NFKD')
    .replace(/[^\x00-\x7F]/g, '')
    .replace(/[^A-Za-z0-9._-]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 40);
  return `${ascii || 'document'}${ext || ''}`;
}

function buildMeta({ id, title, category, notes, fileName, mimeType, fileSize, storage_path, userId }) {
  return {
    id,
    title: (title || fileName || 'ورقة').trim().slice(0, 120),
    category: (category || 'عام').trim().slice(0, 60),
    notes: notes ? String(notes).trim().slice(0, 200) : null,
    file_name: fileName,
    storage_path,
    mime_type: mimeType || null,
    file_size: fileSize || null,
    uploaded_by: userId || null,
    created_at: new Date().toISOString(),
  };
}

async function writeMeta(admin, meta) {
  const path = `${META_PREFIX}/${meta.id}.json`;
  const { error } = await admin.storage.from(BUCKET).upload(path, JSON.stringify(meta), {
    contentType: 'application/json',
    upsert: true,
  });
  if (error) throw error;
}

async function readMetaFile(admin, name) {
  const { data, error } = await admin.storage.from(BUCKET).download(`${META_PREFIX}/${name}`);
  if (error || !data) return null;
  try {
    return JSON.parse(await data.text());
  } catch {
    return null;
  }
}

async function readLegacyIndex(admin) {
  const { data, error } = await admin.storage.from(BUCKET).download(LEGACY_INDEX);
  if (error || !data) return [];
  try {
    const parsed = JSON.parse(await data.text());
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/** Migrate old single _index.json entries into per-doc meta files (once). */
async function migrateLegacyIndex(admin) {
  const legacy = await readLegacyIndex(admin);
  if (!legacy.length) return;
  for (const row of legacy) {
    if (!row?.id) continue;
    const existing = await readMetaFile(admin, `${row.id}.json`);
    if (existing) continue;
    try {
      await writeMeta(admin, row);
    } catch (e) {
      console.warn('[owner-docs] legacy migrate', row.id, e.message || e);
    }
  }
  // Keep legacy file as backup; listing prefers meta/
}

async function listDocuments() {
  const admin = adminClient();
  await migrateLegacyIndex(admin);

  const { data: files, error } = await admin.storage.from(BUCKET).list(META_PREFIX, {
    limit: 200,
    sortBy: { column: 'name', order: 'asc' },
  });
  if (error) throw error;

  const names = (files || [])
    .map((f) => f.name)
    .filter((n) => n && n.endsWith('.json') && !n.startsWith('.'));

  const rows = [];
  for (const name of names) {
    const meta = await readMetaFile(admin, name);
    if (meta?.id) rows.push(meta);
  }

  // Fallback: if meta empty but legacy has rows
  if (!rows.length) {
    const legacy = await readLegacyIndex(admin);
    if (legacy.length) return legacy.sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')));
  }

  return rows.sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')));
}

async function uploadDocument({
  title,
  category,
  notes,
  fileName,
  mimeType,
  fileBase64,
  userId,
}) {
  if (!fileName || !fileBase64) {
    const err = new Error('الملف مطلوب');
    err.status = 400;
    throw err;
  }
  const buf = Buffer.from(String(fileBase64).replace(/^data:[^;]+;base64,/, ''), 'base64');
  if (!buf.length) {
    const err = new Error('ملف فارغ');
    err.status = 400;
    throw err;
  }
  if (buf.length > MAX_DIRECT_BYTES) {
    const err = new Error('الملف كبير — صغّره لأقل من 3 ميجا (أو ارفع صورة بجودة أقل)');
    err.status = 400;
    throw err;
  }

  const admin = adminClient();
  const id = randomUUID();
  const safe = sanitizeFileName(fileName);
  const storage_path = `${FILES_PREFIX}/${id}_${safe}`;
  const contentType = mimeType || 'application/octet-stream';

  const { error: upErr } = await admin.storage.from(BUCKET).upload(storage_path, buf, {
    contentType,
    upsert: false,
  });
  if (upErr) throw upErr;

  const meta = buildMeta({
    id,
    title,
    category,
    notes,
    fileName,
    mimeType: contentType,
    fileSize: buf.length,
    storage_path,
    userId,
  });

  try {
    await writeMeta(admin, meta);
  } catch (e) {
    await admin.storage.from(BUCKET).remove([storage_path]);
    throw e;
  }
  return meta;
}

async function prepareUpload({ title, category, notes, fileName, mimeType, fileSize, userId }) {
  if (!fileName) {
    const err = new Error('fileName required');
    err.status = 400;
    throw err;
  }
  if (fileSize && fileSize > MAX_BYTES) {
    const err = new Error('الحد الأقصى 50 ميجا');
    err.status = 400;
    throw err;
  }
  const admin = adminClient();
  const id = randomUUID();
  const safe = sanitizeFileName(fileName);
  const storage_path = `${FILES_PREFIX}/${id}_${safe}`;
  const { data, error } = await admin.storage.from(BUCKET).createSignedUploadUrl(storage_path);
  if (error) throw error;
  return {
    id,
    storage_path,
    token: data.token,
    path: data.path || storage_path,
    signedUrl: data.signedUrl,
    meta: buildMeta({
      id,
      title,
      category,
      notes,
      fileName,
      mimeType,
      fileSize,
      storage_path,
      userId,
    }),
  };
}

async function confirmUpload(meta) {
  if (!meta?.id || !meta?.storage_path) {
    const err = new Error('invalid meta');
    err.status = 400;
    throw err;
  }
  const admin = adminClient();
  const { error: signErr } = await admin.storage.from(BUCKET).createSignedUrl(meta.storage_path, 10);
  if (signErr) {
    const err = new Error('الملف لم يُرفع بعد');
    err.status = 400;
    throw err;
  }
  const row = {
    id: meta.id,
    title: meta.title,
    category: meta.category || 'عام',
    notes: meta.notes || null,
    file_name: meta.file_name,
    storage_path: meta.storage_path,
    mime_type: meta.mime_type || null,
    file_size: meta.file_size || null,
    uploaded_by: meta.uploaded_by || null,
    created_at: meta.created_at || new Date().toISOString(),
  };
  await writeMeta(admin, row);
  return row;
}

async function signedDownload(id, asDownload) {
  const admin = adminClient();
  let doc = await readMetaFile(admin, `${id}.json`);
  if (!doc) {
    const legacy = await readLegacyIndex(admin);
    doc = legacy.find((r) => r.id === id) || null;
  }
  if (!doc) {
    const err = new Error('المستند غير موجود');
    err.status = 404;
    throw err;
  }
  const opts = asDownload ? { download: doc.file_name || 'document' } : undefined;
  const { data, error } = await admin.storage
    .from(BUCKET)
    .createSignedUrl(doc.storage_path, 3600, opts);
  if (error) throw error;
  return { url: data.signedUrl, doc };
}

async function deleteDocument(id) {
  const admin = adminClient();
  let doc = await readMetaFile(admin, `${id}.json`);
  if (!doc) {
    const legacy = await readLegacyIndex(admin);
    doc = legacy.find((r) => r.id === id) || null;
  }
  if (!doc) {
    const err = new Error('المستند غير موجود');
    err.status = 404;
    throw err;
  }
  const toRemove = [`${META_PREFIX}/${id}.json`];
  if (doc.storage_path) toRemove.push(doc.storage_path);
  await admin.storage.from(BUCKET).remove(toRemove);
  return { ok: true };
}

function normalizeCompanyLinks(input) {
  const byKey = new Map();
  if (Array.isArray(input)) {
    for (const row of input) {
      if (!row || !row.key) continue;
      byKey.set(String(row.key), {
        key: String(row.key),
        label: String(row.label || row.key).slice(0, 60),
        icon: String(row.icon || 'fa-link').slice(0, 40),
        url: String(row.url || '').trim().slice(0, 500),
      });
    }
  } else if (input && typeof input === 'object') {
    for (const [key, url] of Object.entries(input)) {
      byKey.set(key, { key, label: key, icon: 'fa-link', url: String(url || '').trim().slice(0, 500) });
    }
  }
  return DEFAULT_COMPANY_LINKS.map((def) => {
    const hit = byKey.get(def.key);
    return {
      key: def.key,
      label: hit?.label || def.label,
      icon: hit?.icon || def.icon,
      url: hit?.url != null ? hit.url : def.url,
    };
  });
}

async function getCompanyLinks() {
  const admin = adminClient();
  const { data, error } = await admin.storage.from(BUCKET).download(LINKS_PATH);
  if (error || !data) return normalizeCompanyLinks(DEFAULT_COMPANY_LINKS);
  try {
    const parsed = JSON.parse(await data.text());
    return normalizeCompanyLinks(parsed?.links || parsed);
  } catch {
    return normalizeCompanyLinks(DEFAULT_COMPANY_LINKS);
  }
}

async function saveCompanyLinks(links, userId) {
  const admin = adminClient();
  const normalized = normalizeCompanyLinks(links);
  const payload = JSON.stringify(
    {
      links: normalized,
      updated_at: new Date().toISOString(),
      updated_by: userId || null,
    },
    null,
    2
  );
  const { error } = await admin.storage.from(BUCKET).upload(LINKS_PATH, payload, {
    contentType: 'application/json',
    upsert: true,
  });
  if (error) throw error;
  return normalized;
}

function newStockistId() {
  return randomUUID().replace(/-/g, '').slice(0, 12);
}

function normalizeStockistRow(row, fallbackId) {
  if (!row || typeof row !== 'object') return null;
  const name = String(row.name || '').trim().slice(0, 120);
  if (!name) return null;
  return {
    id: String(row.id || fallbackId || newStockistId()).slice(0, 40),
    name,
    region: String(row.region || 'أخرى').trim().slice(0, 80) || 'أخرى',
    link: String(row.link || row.url || '').trim().slice(0, 500),
    notes: String(row.notes || '').trim().slice(0, 200),
    active: row.active === false ? false : true,
  };
}

function normalizeStockistList(input) {
  const rows = Array.isArray(input) ? input : [];
  const out = [];
  const seen = new Set();
  for (const row of rows) {
    const n = normalizeStockistRow(row);
    if (!n) continue;
    const key = `${n.name.toLowerCase()}|${n.region.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(n);
  }
  return out;
}

function seedDefaultStockists() {
  return normalizeStockistList(
    DEFAULT_STOCKIST_SEED.map((r) => ({ ...r, id: newStockistId(), active: true }))
  );
}

let _stockistCache = { at: 0, list: null };
const STOCKIST_CACHE_MS = 60 * 1000;

function clearStockistCache() {
  _stockistCache = { at: 0, list: null };
}

async function getStockistPharmacies({ force = false } = {}) {
  const now = Date.now();
  if (!force && _stockistCache.list && now - _stockistCache.at < STOCKIST_CACHE_MS) {
    return _stockistCache.list;
  }
  const admin = adminClient();
  const { data, error } = await admin.storage.from(BUCKET).download(STOCKISTS_PATH);
  if (error || !data) {
    const seeded = seedDefaultStockists();
    try {
      await saveStockistPharmacies(seeded, null);
    } catch (e) {
      console.warn('[stockists] seed save failed:', e.message);
    }
    _stockistCache = { at: now, list: seeded };
    return seeded;
  }
  try {
    const parsed = JSON.parse(await data.text());
    const list = normalizeStockistList(parsed?.pharmacies || parsed);
    const finalList = list.length ? list : seedDefaultStockists();
    _stockistCache = { at: now, list: finalList };
    return finalList;
  } catch {
    const seeded = seedDefaultStockists();
    _stockistCache = { at: now, list: seeded };
    return seeded;
  }
}

async function saveStockistPharmacies(pharmacies, userId) {
  const admin = adminClient();
  const normalized = normalizeStockistList(pharmacies);
  const payload = JSON.stringify(
    {
      pharmacies: normalized,
      updated_at: new Date().toISOString(),
      updated_by: userId || null,
    },
    null,
    2
  );
  const { error } = await admin.storage.from(BUCKET).upload(STOCKISTS_PATH, payload, {
    contentType: 'application/json',
    upsert: true,
  });
  if (error) throw error;
  clearStockistCache();
  _stockistCache = { at: Date.now(), list: normalized };
  return normalized;
}

async function upsertStockistPharmacy(row, userId) {
  const list = await getStockistPharmacies({ force: true });
  const next = normalizeStockistRow(row, row?.id);
  if (!next) {
    const err = new Error('اسم الصيدلية مطلوب');
    err.status = 400;
    throw err;
  }
  const idx = list.findIndex((p) => p.id === next.id);
  if (idx >= 0) list[idx] = { ...list[idx], ...next };
  else list.push(next);
  return saveStockistPharmacies(list, userId);
}

async function deleteStockistPharmacy(id, userId) {
  const list = await getStockistPharmacies({ force: true });
  const next = list.filter((p) => p.id !== String(id || ''));
  return saveStockistPharmacies(next, userId);
}

/** Grouped text for chatbot system / turn context. */
function formatStockistsForBot(list) {
  const active = (list || []).filter((p) => p.active !== false);
  if (!active.length) return 'لا توجد صيدليات مسجّلة حالياً في قائمة التوفر.';
  const byRegion = new Map();
  for (const p of active) {
    const r = p.region || 'أخرى';
    if (!byRegion.has(r)) byRegion.set(r, []);
    byRegion.get(r).push(p.name + (p.link ? ` (${p.link})` : ''));
  }
  const lines = ['صيدليات تتوفر فيها منتجات مونتانيا (الحالية — ممنوع تختلقي أسماء زيادة):'];
  for (const [region, names] of byRegion) {
    lines.push(`• ${region}: ${names.join('، ')}`);
  }
  lines.push('لو قالت منطقتها: اذكري صيدليات منطقتها فقط. لو مش منطقتها: قولي المناطق المتاحة واسأليها فين.');
  return lines.join('\n');
}

module.exports = {
  assertOwner,
  listDocuments,
  uploadDocument,
  prepareUpload,
  confirmUpload,
  signedDownload,
  deleteDocument,
  getCompanyLinks,
  saveCompanyLinks,
  getStockistPharmacies,
  saveStockistPharmacies,
  upsertStockistPharmacy,
  deleteStockistPharmacy,
  formatStockistsForBot,
  clearStockistCache,
  DEFAULT_COMPANY_LINKS,
  DEFAULT_STOCKIST_SEED,
  MAX_BYTES,
  MAX_DIRECT_BYTES,
};
