// Jumia ↔ Montana inventory compare + push (Montana stock is source of truth).
const { createClient } = require('@supabase/supabase-js');
const {
  listJumiaCatalogStock,
  listJumiaCatalogProducts,
  pushJumiaStockFeed,
  getJumiaFeed,
} = require('./jumiaClient');

const SUPABASE_URL = 'https://ikryeyqrithikabwidov.supabase.co';
const SERVICE_KEY = process.env.SERVICE_ROLE || process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const BUCKET = 'montana';
const MAP_PATH = 'company-docs/jumia-sku-map.json';

/** Known Montana slug ↔ common seller SKU aliases (before live Jumia names). */
const DEFAULT_SKU_ALIASES = {
  'post-laser-cream': ['post-laser-cream', 'post-laser', 'postlaser', 'post_laser'],
  'hand-body-lotion': ['hand-body-lotion', 'lotion', 'handbody', 'hand-body'],
  'acne-facial-cleanser': ['acne-facial-cleanser', 'acne', 'acne-cleanser'],
  'whitening-cleanser': ['whitening-cleanser', 'w-cleanser', 'wcleanser', 'whitening_cleanser'],
  'whitening-cream': ['whitening-cream', 'w-cream', 'wcream', 'whitening_cream'],
};

function adminClient() {
  if (!SERVICE_KEY) {
    const err = new Error('SERVICE_ROLE not configured');
    err.status = 503;
    throw err;
  }
  return createClient(SUPABASE_URL, SERVICE_KEY);
}

function normKey(s) {
  return String(s || '')
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, '-')
    .replace(/[^a-z0-9\u0600-\u06ff-]/gi, '');
}

async function getSkuMap() {
  const admin = adminClient();
  const { data, error } = await admin.storage.from(BUCKET).download(MAP_PATH);
  if (error || !data) return { mappings: [] };
  try {
    const text = await data.text();
    const json = JSON.parse(text);
    const mappings = Array.isArray(json.mappings) ? json.mappings : Array.isArray(json) ? json : [];
    return { mappings, updated_at: json.updated_at || null };
  } catch {
    return { mappings: [] };
  }
}

async function saveSkuMap(mappings, userId) {
  const admin = adminClient();
  const clean = (Array.isArray(mappings) ? mappings : [])
    .map((m) => ({
      slug: String(m.slug || '').trim(),
      sellerSku: String(m.sellerSku || m.seller_sku || '').trim(),
      productSid: m.productSid || m.id || null,
    }))
    .filter((m) => m.slug && m.sellerSku);
  const payload = Buffer.from(
    JSON.stringify(
      {
        mappings: clean,
        updated_at: new Date().toISOString(),
        updated_by: userId || null,
      },
      null,
      2
    ),
    'utf8'
  );
  const { error } = await admin.storage.from(BUCKET).upload(MAP_PATH, payload, {
    contentType: 'application/json',
    upsert: true,
  });
  if (error) throw error;
  return { mappings: clean };
}

async function listMontanaProducts() {
  const admin = adminClient();
  const { data, error } = await admin
    .from('products')
    .select('id,name,slug,stock,is_active')
    .order('name');
  if (error) throw error;
  return data || [];
}

function buildAliasIndex(manualMappings = []) {
  const byAlias = new Map(); // alias -> { slug, productSid?, sellerSku? }
  for (const [slug, aliases] of Object.entries(DEFAULT_SKU_ALIASES)) {
    for (const a of aliases) byAlias.set(normKey(a), { slug, sellerSku: null, productSid: null, source: 'default' });
    byAlias.set(normKey(slug), { slug, sellerSku: null, productSid: null, source: 'default' });
  }
  for (const m of manualMappings) {
    const slug = String(m.slug || '').trim();
    const sellerSku = String(m.sellerSku || '').trim();
    if (!slug || !sellerSku) continue;
    byAlias.set(normKey(sellerSku), {
      slug,
      sellerSku,
      productSid: m.productSid || null,
      source: 'manual',
    });
    byAlias.set(normKey(slug), {
      slug,
      sellerSku,
      productSid: m.productSid || null,
      source: 'manual',
    });
  }
  return byAlias;
}

function matchJumiaToMontana(jumiaRow, montanaBySlug, aliasIndex) {
  const sku = jumiaRow.sellerSku || '';
  const hit = aliasIndex.get(normKey(sku));
  if (hit?.slug && montanaBySlug.has(hit.slug)) {
    return { slug: hit.slug, match: hit.source === 'manual' ? 'manual' : 'alias' };
  }
  // exact slug match
  if (montanaBySlug.has(sku) || montanaBySlug.has(normKey(sku))) {
    const slug = montanaBySlug.has(sku) ? sku : normKey(sku);
    return { slug, match: 'slug' };
  }
  // fuzzy: jumia sku contains montana slug or vice versa
  const nSku = normKey(sku);
  for (const slug of montanaBySlug.keys()) {
    const nSlug = normKey(slug);
    if (!nSlug || nSlug.length < 4) continue;
    if (nSku.includes(nSlug) || nSlug.includes(nSku)) {
      return { slug, match: 'fuzzy' };
    }
  }
  // name contains
  const nName = normKey(jumiaRow.name || '');
  if (nName) {
    for (const [slug, p] of montanaBySlug) {
      const n = normKey(p.name);
      if (n && (nName.includes(n) || n.includes(nName))) {
        return { slug, match: 'name' };
      }
    }
  }
  return { slug: null, match: null };
}

async function fetchJumiaInventory() {
  let stockRows = [];
  let productRows = [];
  let stockError = null;
  let productError = null;
  try {
    const s = await listJumiaCatalogStock({ size: 100 });
    stockRows = s.products || [];
  } catch (e) {
    stockError = e.message;
  }
  try {
    const p = await listJumiaCatalogProducts({ size: 50 });
    productRows = p.products || [];
  } catch (e) {
    productError = e.message;
  }

  // Merge: prefer stock endpoint for qty/id, products for name
  const bySku = new Map();
  for (const p of productRows) {
    if (!p.sellerSku) continue;
    bySku.set(p.sellerSku, {
      id: p.id,
      sellerSku: p.sellerSku,
      name: p.name,
      stock: p.stock,
    });
  }
  for (const s of stockRows) {
    if (!s.sellerSku) continue;
    const prev = bySku.get(s.sellerSku) || {};
    bySku.set(s.sellerSku, {
      id: s.id || prev.id || null,
      sellerSku: s.sellerSku,
      name: prev.name || s.name || null,
      stock: s.stock != null ? s.stock : prev.stock,
      lastStockUpdatedAt: s.lastStockUpdatedAt || null,
    });
  }
  return {
    jumia: [...bySku.values()],
    stockError,
    productError,
  };
}

async function compareInventory() {
  const [{ mappings }, montana, jumiaPack] = await Promise.all([
    getSkuMap(),
    listMontanaProducts(),
    fetchJumiaInventory(),
  ]);
  const aliasIndex = buildAliasIndex(mappings);
  const montanaBySlug = new Map(montana.map((p) => [p.slug, p]));
  const usedSlugs = new Set();
  const rows = [];

  for (const j of jumiaPack.jumia) {
    const { slug, match } = matchJumiaToMontana(j, montanaBySlug, aliasIndex);
    const m = slug ? montanaBySlug.get(slug) : null;
    if (slug) usedSlugs.add(slug);
    const montanaStock = m ? Number(m.stock) || 0 : null;
    const jumiaStock = j.stock != null ? Number(j.stock) : null;
    rows.push({
      slug: slug || null,
      montana_id: m?.id || null,
      montana_name: m?.name || null,
      montana_stock: montanaStock,
      montana_active: m ? !!m.is_active : null,
      jumia_sellerSku: j.sellerSku,
      jumia_productSid: j.id,
      jumia_name: j.name,
      jumia_stock: jumiaStock,
      match,
      delta: montanaStock != null && jumiaStock != null ? montanaStock - jumiaStock : null,
      can_push: !!(m && j.sellerSku && j.id),
    });
  }

  // Montana products with no Jumia match
  for (const p of montana) {
    if (usedSlugs.has(p.slug)) continue;
    const manual = mappings.find((m) => m.slug === p.slug);
    rows.push({
      slug: p.slug,
      montana_id: p.id,
      montana_name: p.name,
      montana_stock: Number(p.stock) || 0,
      montana_active: !!p.is_active,
      jumia_sellerSku: manual?.sellerSku || null,
      jumia_productSid: manual?.productSid || null,
      jumia_name: null,
      jumia_stock: null,
      match: manual ? 'manual-unresolved' : null,
      delta: null,
      can_push: !!(manual?.sellerSku && manual?.productSid),
    });
  }

  rows.sort((a, b) => {
    const ad = a.delta == null ? 0 : Math.abs(a.delta);
    const bd = b.delta == null ? 0 : Math.abs(b.delta);
    if (bd !== ad) return bd - ad;
    return String(a.montana_name || a.jumia_name || '').localeCompare(
      String(b.montana_name || b.jumia_name || ''),
      'ar'
    );
  });

  const mismatched = rows.filter((r) => r.delta != null && r.delta !== 0).length;
  const matched = rows.filter((r) => r.match).length;
  return {
    rows,
    summary: {
      montana_count: montana.length,
      jumia_count: jumiaPack.jumia.length,
      matched,
      mismatched,
      pushable: rows.filter((r) => r.can_push).length,
    },
    mappings,
    errors: {
      stock: jumiaPack.stockError,
      products: jumiaPack.productError,
    },
  };
}

async function pushMontanaStockToJumia({ slugs = null, onlyMismatched = true } = {}) {
  const cmp = await compareInventory();
  let targets = cmp.rows.filter((r) => r.can_push && r.montana_stock != null);
  if (Array.isArray(slugs) && slugs.length) {
    const set = new Set(slugs.map(String));
    targets = targets.filter((r) => set.has(r.slug));
  } else if (onlyMismatched) {
    targets = targets.filter((r) => r.delta != null && r.delta !== 0);
  }
  if (!targets.length) {
    return {
      ok: true,
      pushed: 0,
      feedId: null,
      message: 'لا يوجد أصناف تحتاج تحديث على جوميا',
      rows: [],
    };
  }
  const feed = await pushJumiaStockFeed(
    targets.map((r) => ({
      sellerSku: r.jumia_sellerSku,
      id: r.jumia_productSid,
      stock: r.montana_stock,
    }))
  );
  return {
    ok: true,
    pushed: feed.pushed,
    feedId: feed.feedId,
    rows: targets.map((r) => ({
      slug: r.slug,
      sellerSku: r.jumia_sellerSku,
      from: r.jumia_stock,
      to: r.montana_stock,
    })),
    raw: feed.raw,
  };
}

module.exports = {
  getSkuMap,
  saveSkuMap,
  compareInventory,
  pushMontanaStockToJumia,
  getJumiaFeed,
  DEFAULT_SKU_ALIASES,
};
