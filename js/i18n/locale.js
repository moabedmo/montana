/**
 * Montana locale helpers — detect EN site, localize products, format prices, path prefixing.
 */
import * as EN from './en.js';

const EN_PATH_RE = /^\/en(\/|$)/;

/** @returns {boolean} */
export function isEnglish() {
  if (typeof document !== 'undefined' && document.documentElement.lang === 'en') {
    return true;
  }
  if (typeof location !== 'undefined' && EN_PATH_RE.test(location.pathname)) {
    return true;
  }
  return false;
}

/** @returns {'en'|'ar'} */
export function getLocale() {
  return isEnglish() ? 'en' : 'ar';
}

/**
 * Fix relative asset paths on /en/ pages (images/, css/, etc.).
 * @param {string} url
 * @returns {string}
 */
export function resolveAssetUrl(url) {
  const raw = String(url ?? '').trim();
  if (!raw) return raw;
  if (/^(https?:|\/\/|data:|blob:)/i.test(raw)) return raw;
  if (raw.startsWith('/')) return raw;
  // Root-absolute paths work from /product/slug and /en/product/slug (not ../)
  const path = raw.replace(/^(\.\.\/)+/, '').replace(/^\.\//, '');
  return `/${path}`;
}

/** @param {string | null | undefined} size */
export function localizeSize(size) {
  if (!size || getLocale() !== 'en') return size;
  return String(size)
    .replace(/(\d+)\s*مل/g, '$1ml')
    .replace(/(\d+)\s*جم/g, '$1g');
}

/**
 * Merge English marketing copy over a DB product record.
 * @param {Record<string, unknown> | null | undefined} p
 */
export function localizeProduct(p) {
  if (!p) return p;
  const withMedia = { ...p, image_url: resolveAssetUrl(p.image_url) };
  if (getLocale() !== 'en') return withMedia;

  const copy = EN.PRODUCT_COPY[p.slug];
  if (!copy) return { ...withMedia, size: localizeSize(p.size) };

  return {
    ...withMedia,
    name: copy.name,
    name_en: copy.name,
    size: localizeSize(p.size),
    description: copy.description,
    description_en: copy.description,
    ingredients: copy.ingredients,
    skin_type: copy.skinType,
    tagline: copy.tagline,
    short_name: copy.shortName,
    concerns: copy.concerns,
    trust: copy.trust,
    cart_name: copy.cartName,
  };
}

/**
 * @param {number} n
 * @returns {string}
 */
export function formatPrice(n) {
  const num = Math.round(Number(n) || 0);
  if (getLocale() === 'en') {
    return EN.CURRENCY.format(num);
  }
  return `${num.toLocaleString('ar-EG')} ج.م`;
}

/**
 * Prefix relative paths with `en/` when on the English site.
 * @param {string} relativePath
 * @returns {string}
 */
export function enPath(relativePath) {
  const raw = String(relativePath || '').trim();
  if (!raw) return getLocale() === 'en' ? 'en/' : '';

  if (/^(https?:|mailto:|tel:|#|javascript:)/i.test(raw)) {
    return raw;
  }

  const normalized = raw.replace(/^\//, '');
  if (getLocale() !== 'en') {
    return raw.startsWith('/') ? raw : `/${normalized}`;
  }

  if (normalized === 'en' || normalized.startsWith('en/')) {
    return `/${normalized}`;
  }

  return `/en/${normalized}`;
}

/**
 * Absolute in-site page URL for the active locale (AR at /, EN at /en/).
 * @param {string} relativePath e.g. "category.html"
 * @returns {string}
 */
export function pageUrl(relativePath) {
  const raw = String(relativePath || '').trim();
  if (/^(https?:|\/\/|mailto:|tel:|#|javascript:)/i.test(raw)) return raw;
  if (raw.startsWith('/product/') || raw.startsWith('/en/product/')) return raw;

  let file = raw.replace(/^\.\//, '').replace(/^(\.\.\/)+/, '');
  if (file.startsWith('/')) file = file.slice(1);
  if (file.startsWith('en/')) file = file.slice(3);

  return getLocale() === 'en' ? `/en/${file}` : `/${file}`;
}

/**
 * Clean SEO-friendly product URL (no query parameters).
 * @param {string} slug
 * @returns {string}
 */
export function productUrl(slug) {
  const s = String(slug || '').trim();
  if (!s) return getLocale() === 'en' ? '/en/category.html' : '/category.html';
  return getLocale() === 'en'
    ? `/en/product/${encodeURIComponent(s)}`
    : `/product/${encodeURIComponent(s)}`;
}

export { EN };
