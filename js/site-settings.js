/** Build wa.me digits with country code (EG: 01xxxxxxxxx → 201xxxxxxxxx). */
export function toWaMeDigits(raw) {
  let d = String(raw || '').replace(/[٠-٩]/g, (ch) => String(ch.charCodeAt(0) - 0x0660)).replace(/\D/g, '');
  if (!d) return '';
  if (d.startsWith('00')) d = d.slice(2);
  if (/^01\d{9}$/.test(d)) return '20' + d.slice(1);
  if (/^1\d{9}$/.test(d)) return '20' + d;
  return d;
}

export function toWaMeHref(raw) {
  const digits = toWaMeDigits(raw);
  return digits ? `https://wa.me/${digits}` : '';
}

// Applies site_settings to footer/contact blocks on any page.
export async function applySiteSettings(root = document) {
  try {
    const { settings } = await import('/js/store-api.js');
    const keys = ['phone', 'email', 'address', 'working_hours', 'facebook_url', 'instagram_url', 'tiktok_url', 'whatsapp', 'site_name'];
    const map = await settings.getMany(keys);
    const waHref = toWaMeHref(map.whatsapp);

    root.querySelectorAll('.contact-info').forEach(block => {
      const ps = block.querySelectorAll('p');
      if (ps[0] && map.phone) ps[0].innerHTML = `<i class="fas fa-phone"></i> ${map.phone}`;
      if (ps[1] && map.email) ps[1].innerHTML = `<i class="fas fa-envelope"></i> ${map.email}`;
      if (ps[2] && map.address) ps[2].innerHTML = `<i class="fas fa-map-marker-alt"></i> ${map.address}`;
      if (ps[3] && map.working_hours) ps[3].innerHTML = `<i class="fas fa-clock"></i> ${map.working_hours}`;
    });

    root.querySelectorAll('.social-links').forEach(social => {
      const urls = [
        map.facebook_url,
        map.instagram_url,
        map.tiktok_url,
        waHref
      ];
      social.querySelectorAll('a').forEach((a, i) => { if (urls[i]) { a.href = urls[i]; a.target = '_blank'; rel = 'noopener noreferrer'; } });
    });

    root.querySelectorAll('.contact-card[href^="tel"]').forEach(a => {
      if (map.phone) {
        a.href = 'tel:' + map.phone.replace(/\s/g, '');
        const span = a.querySelector('span:last-child');
        if (span) span.textContent = map.phone;
      }
    });
    root.querySelectorAll('.contact-card[href*="wa.me"]').forEach(a => {
      if (waHref) a.href = waHref;
    });
    root.querySelectorAll('.contact-card[href^="mailto"]').forEach(a => {
      if (map.email) {
        a.href = 'mailto:' + map.email;
        const span = a.querySelector('span:last-child');
        if (span) span.textContent = map.email;
      }
    });
    root.querySelectorAll('.contact-hours span').forEach(el => {
      if (map.working_hours) el.textContent = map.working_hours;
    });
    root.querySelectorAll('.contact-location p').forEach(el => {
      if (map.address) el.textContent = map.address;
    });
    root.querySelectorAll('.contact-social-links a').forEach((a, i) => {
      const urls = [map.facebook_url, map.instagram_url, map.tiktok_url, waHref];
      if (urls[i]) { a.href = urls[i]; a.target = '_blank'; a.rel = 'noopener noreferrer'; }
    });

    root.querySelectorAll('.promo-slider span').forEach((el, i) => {
      if (i === 1 && map.free_shipping_min) {
        el.textContent = `🚚 شحن من ${map.shipping_cost || '50'} ج.م حسب المحافظة`;
      }
    });
  } catch { /* static fallbacks remain */ }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => applySiteSettings());
} else {
  applySiteSettings();
}
