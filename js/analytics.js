/**
 * Google Analytics 4 — loads only when MONTANA_GA_ID is set in analytics-config.js
 */
(function () {
  const id = String(window.MONTANA_GA_ID || '').trim();
  if (!id || !/^G-[A-Z0-9]+$/i.test(id)) return;

  window.dataLayer = window.dataLayer || [];
  function gtag() { window.dataLayer.push(arguments); }
  window.gtag = gtag;
  gtag('js', new Date());
  gtag('config', id, { anonymize_ip: true, send_page_view: true });

  const s = document.createElement('script');
  s.async = true;
  s.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(id)}`;
  document.head.appendChild(s);
})();
