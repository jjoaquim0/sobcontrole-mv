// Service worker do SobControle — exclusivamente para Web Push.
// Não implementa cache/offline (fora do escopo desta story); apenas recebe
// eventos `push` do navegador e exibe a notificação, e trata o clique
// navegando até a Central de Notificações (ou o link específico enviado).

self.addEventListener('push', (event) => {
  let payload = { title: 'SobControle', body: 'Você tem uma nova notificação.' };

  if (event.data) {
    try {
      payload = event.data.json();
    } catch {
      payload.body = event.data.text();
    }
  }

  const title = payload.title || 'SobControle';
  const options = {
    body: payload.body || payload.message || '',
    icon: '/favicon.svg',
    badge: '/favicon.svg',
    data: { url: payload.url || '/notifications' },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || '/notifications';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) {
          client.navigate(targetUrl);
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});
