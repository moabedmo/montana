/* Push-only Service Worker — Montana CRM Rep
 *
 * IMPORTANT: Do NOT intercept fetch / cache HTML or JS.
 * Caching documents previously caused soft-refresh hangs
 * (page stuck on "Loading…" until Ctrl+F5).
 * This worker exists only for Web Push notifications.
 */
const SW_VERSION = 'montana-crm-push-v6';

self.addEventListener('install', (e) => {
  self.skipWaiting();
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.map((k) => caches.delete(k))))
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('message', (e) => {
  if (e.data && e.data.type === 'SKIP_WAITING') self.skipWaiting();
});

// No fetch handler — network requests go straight to the browser.

self.addEventListener('push', (e) => {
  let data = {};
  try { data = e.data ? e.data.json() : {}; } catch { data = { body: e.data && e.data.text() }; }
  e.waitUntil(self.registration.showNotification(data.title || 'Montana CRM', {
    body: data.body || '',
    icon: '/images/logo.png',
    badge: '/images/logo.png',
    data: { url: data.url || '/crm/rep/' }
  }));
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || '/crm/rep/';
  e.waitUntil(clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
    const existing = list.find((c) => c.url.includes('/crm/rep'));
    return existing ? existing.focus() : clients.openWindow(url);
  }));
});
