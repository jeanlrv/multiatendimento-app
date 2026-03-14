// Custom service worker code — injetado pelo next-pwa no sw.js gerado
// Handlers de Web Push Notifications

self.addEventListener('push', (event) => {
    const data = event.data?.json?.() ?? { title: 'KSZap', body: 'Nova notificação' };
    event.waitUntil(
        self.registration.showNotification(data.title ?? 'KSZap', {
            body: data.body ?? '',
            icon: '/icon-192x192.png',
            badge: '/icon-192x192.png',
            tag: 'kszap-notification',
            renotify: true,
            data: { url: data.url ?? '/dashboard/tickets' },
        })
    );
});

self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    const url = event.notification.data?.url ?? '/dashboard/tickets';
    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
            for (const client of clientList) {
                if ('focus' in client) {
                    client.navigate(url);
                    return client.focus();
                }
            }
            return clients.openWindow(url);
        })
    );
});
