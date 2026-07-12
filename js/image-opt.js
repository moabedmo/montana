/**
 * Prefer WebP when a sibling .webp file exists (client-side probe).
 * @param {HTMLImageElement|null} el
 * @param {string} url
 */
export function setOptimizedImageSrc(el, url) {
  if (!el || !url) return;
  const raw = String(url);
  if (!/\.(png|jpe?g)(\?.*)?$/i.test(raw)) {
    el.src = raw;
    return;
  }
  const webp = raw.replace(/\.(png|jpe?g)(\?.*)?$/i, '.webp$2');
  const probe = new Image();
  probe.onload = () => { el.src = webp; };
  probe.onerror = () => { el.src = raw; };
  probe.src = webp;
}

/** @param {string} url */
export function webpUrl(url) {
  const raw = String(url || '');
  if (!/\.(png|jpe?g)(\?.*)?$/i.test(raw)) return raw;
  return raw.replace(/\.(png|jpe?g)(\?.*)?$/i, '.webp$2');
}
