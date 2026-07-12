self.addEventListener('push', (e) => {
  let data = {};
  try { data = e.data ? e.data.json() : {}; } catch { data = { body: e.data?.text() }; }
  e.waitUntil(self.registration.showNotification(data.title || 'Montana CRM Admin', {
    body: data.body || '',
    icon: '/images/logo.png',
    badge: '/images/logo.png',
    data: { url: data.url || '/crm/admin/' }
  }));
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const url = e.notification.data?.url || '/crm/admin/';
  e.waitUntil(clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
    const existing = list.find((c) => c.url.includes('/crm/admin'));
    return existing ? existing.focus() : clients.openWindow(url);
  }));
});
