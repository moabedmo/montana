/** Escape text for safe HTML insertion (XSS prevention). */
export function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Escape for use inside HTML attribute values. */
export function escapeAttr(value) {
  return escapeHtml(value);
}

if (typeof window !== 'undefined') {
  window.MONTANA_escapeHtml = escapeHtml;
  window.MONTANA_escapeAttr = escapeAttr;
}
