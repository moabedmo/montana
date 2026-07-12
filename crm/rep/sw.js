const CACHE = 'montana-crm-v4';
const OFFLINE_ASSETS = [
  '/crm/rep/',
  '/crm/js/crm-api.js',
  '/crm/css/crm.css'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(OFFLINE_ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys =>
    Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
  ));
  self.clients.claim();
});

// ── Web push (daily plan reminders from send-daily-reminders) ──
self.addEventListener('push', e => {
  let data = {};
  try { data = e.data ? e.data.json() : {}; } catch { data = { body: e.data?.text() }; }
  e.waitUntil(self.registration.showNotification(data.title || 'Montana CRM', {
    body: data.body || '',
    icon: '/images/logo.png',
    badge: '/images/logo.png',
    data: { url: data.url || '/crm/rep/' }
  }));
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = e.notification.data?.url || '/crm/rep/';
  e.waitUntil(clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
    const existing = list.find(c => c.url.includes('/crm/rep'));
    return existing ? existing.focus() : clients.openWindow(url);
  }));
});

self.addEventListener('fetch', e => {
  // Network first for API calls, cache fallback for assets
  if (e.request.url.includes('supabase')) {
    e.respondWith(fetch(e.request).catch(() => new Response('[]', { headers: { 'Content-Type': 'application/json' } })));
    return;
  }
  e.respondWith(
    fetch(e.request)
      .then(res => {
        const clone = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, clone));
        return res;
      })
      .catch(() => caches.match(e.request))
  );
});
