self.addEventListener('install', event => console.log('ServiceWorker installed'));

self.addEventListener('push', function(event) {
  console.log({ event });

  event.waitUntil(self.registration.showNotification("Grass | Justin Fuller", {
    body: "Today's the day. Water your lawn!",
    icon: "/image/grass.png",
  }));
})

self.addEventListener('notificationclick', function(event) {
  console.log('[Service Worker] Notification click received.');

  event.notification.close();

  event.waitUntil(
    clients.openWindow('https://justindfuller.com/grass')
  );
});
