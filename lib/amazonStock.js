// Amazon ↔ Montana inventory compare + push (Montana stock is source of truth).
const { createClient } = require('@supabase/supabase-js');
const {
  listAmazonListings,
  pushAmazonStockUpdates,
} = require('./amazonClient');

const SUPABASE_URL = 'https://ikryeyqrithikabwidov.supabase.co';
const SERVICE_KEY = process.env.SERVICE_ROLE || process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const BUCKET = 'montana';
const MAP_PATH = 'company-docs/amazon-sku-map.json';

/** Known Montana slug ↔ common seller SKU aliases on Amazon. */
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
      asin: m.asin || null,
      productType: m.productType || null,
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
  const byAlias = new Map();
  for (const [slug, aliases] of Object.entries(DEFAULT_SKU_ALIASES)) {
    for (const a of aliases) {
      byAlias.set(normKey(a), { slug, sellerSku: null, source: 'default' });
    }
    byAlias.set(normKey(slug), { slug, sellerSku: null, source: 'default' });
  }
  for (const m of manualMappings) {
    const slug = String(m.slug || '').trim();
    const sellerSku = String(m.sellerSku || '').trim();
    if (!slug || !sellerSku) continue;
    byAlias.set(normKey(sellerSku), { slug, sellerSku, source: 'manual' });
    byAlias.set(normKey(slug), { slug, sellerSku, source: 'manual' });
  }
  return byAlias;
}

function matchAmazonToMontana(amazonRow, montanaBySlug, aliasIndex) {
  const sku = amazonRow.sellerSku || '';
  const hit = aliasIndex.get(normKey(sku));
  if (hit?.slug && montanaBySlug.has(hit.slug)) {
    return { slug: hit.slug, match: hit.source === 'manual' ? 'manual' : 'alias' };
  }
  if (montanaBySlug.has(sku) || montanaBySlug.has(normKey(sku))) {
    const slug = montanaBySlug.has(sku) ? sku : normKey(sku);
    return { slug, match: 'slug' };
  }
  const nSku = normKey(sku);
  for (const slug of montanaBySlug.keys()) {
    const nSlug = normKey(slug);
    if (!nSlug || nSlug.length < 4) continue;
    if (nSku.includes(nSlug) || nSlug.includes(nSku)) {
      return { slug, match: 'fuzzy' };
    }
  }
  const nName = normKey(amazonRow.name || '');
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

async function compareInventory() {
  const [{ mappings }, montana] = await Promise.all([getSkuMap(), listMontanaProducts()]);
  let amazonPack = { items: [], sellerId: null, marketplaceId: null };
  let listingsError = null;
  try {
    amazonPack = await listAmazonListings({ pageSize: 20, maxPages: 10 });
  } catch (e) {
    listingsError = e.message;
  }

  const aliasIndex = buildAliasIndex(mappings);
  const montanaBySlug = new Map(montana.map((p) => [p.slug, p]));
  const usedSlugs = new Set();
  const rows = [];

  for (const a of amazonPack.items || []) {
    const { slug, match } = matchAmazonToMontana(a, montanaBySlug, aliasIndex);
    const m = slug ? montanaBySlug.get(slug) : null;
    if (slug) usedSlugs.add(slug);
    const montanaStock = m ? Number(m.stock) || 0 : null;
    const amazonStock = a.stock != null ? Number(a.stock) : null;
    rows.push({
      slug: slug || null,
      montana_id: m?.id || null,
      montana_name: m?.name || null,
      montana_stock: montanaStock,
      montana_active: m ? !!m.is_active : null,
      amazon_sellerSku: a.sellerSku,
      amazon_asin: a.asin,
      amazon_name: a.name,
      amazon_stock: amazonStock,
      amazon_productType: a.productType || 'PRODUCT',
      match,
      delta: montanaStock != null && amazonStock != null ? montanaStock - amazonStock : null,
      can_push: !!(m && a.sellerSku),
    });
  }

  for (const p of montana) {
    if (usedSlugs.has(p.slug)) continue;
    const manual = mappings.find((m) => m.slug === p.slug);
    rows.push({
      slug: p.slug,
      montana_id: p.id,
      montana_name: p.name,
      montana_stock: Number(p.stock) || 0,
      montana_active: !!p.is_active,
      amazon_sellerSku: manual?.sellerSku || null,
      amazon_asin: manual?.asin || null,
      amazon_name: null,
      amazon_stock: null,
      amazon_productType: manual?.productType || 'PRODUCT',
      match: manual ? 'manual-unresolved' : null,
      delta: null,
      can_push: !!manual?.sellerSku,
    });
  }

  rows.sort((a, b) => {
    const ad = a.delta == null ? 0 : Math.abs(a.delta);
    const bd = b.delta == null ? 0 : Math.abs(b.delta);
    if (bd !== ad) return bd - ad;
    return String(a.montana_name || a.amazon_name || '').localeCompare(
      String(b.montana_name || b.amazon_name || ''),
      'ar'
    );
  });

  const mismatched = rows.filter((r) => r.delta != null && r.delta !== 0).length;
  const matched = rows.filter((r) => r.match).length;
  return {
    rows,
    summary: {
      montana_count: montana.length,
      amazon_count: (amazonPack.items || []).length,
      matched,
      mismatched,
      pushable: rows.filter((r) => r.can_push).length,
      seller_id: amazonPack.sellerId || null,
      marketplace_id: amazonPack.marketplaceId || null,
    },
    mappings,
    errors: {
      listings: listingsError,
    },
  };
}

async function pushMontanaStockToAmazon({ slugs = null, onlyMismatched = true } = {}) {
  const cmp = await compareInventory();
  if (cmp.errors?.listings) {
    const err = new Error(cmp.errors.listings);
    err.status = 502;
    throw err;
  }
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
      failed: 0,
      message: 'لا يوجد أصناف تحتاج تحديث على أمازون',
      rows: [],
    };
  }
  const feed = await pushAmazonStockUpdates(
    targets.map((r) => ({
      sellerSku: r.amazon_sellerSku,
      stock: r.montana_stock,
      productType: r.amazon_productType || 'PRODUCT',
    }))
  );
  return {
    ok: true,
    pushed: feed.pushed,
    failed: feed.failed,
    sellerId: feed.sellerId,
    rows: targets.map((r) => ({
      slug: r.slug,
      sellerSku: r.amazon_sellerSku,
      from: r.amazon_stock,
      to: r.montana_stock,
    })),
    results: feed.results,
  };
}

module.exports = {
  compareInventory,
  pushMontanaStockToAmazon,
  getSkuMap,
  saveSkuMap,
  DEFAULT_SKU_ALIASES,
};
