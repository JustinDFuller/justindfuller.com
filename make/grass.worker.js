self.addEventListener("install", (event) =>
  console.log("ServiceWorker installed"),
);

self.addEventListener("push", (event) => {
  const data = event?.data?.json();

  event.waitUntil(
    self.registration.showNotification("Remember to water your lawn!", {
      body: data?.minutes
        ? `Water for ${data?.minutes} minutes. Click to see your schedule.`
        : "Click to see today's watering times.",
      icon: "/image/grass.png",
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  console.log("[Service Worker] Notification click received.");

  event.notification.close();

  event.waitUntil(clients.openWindow("https://justindfuller.com/grass"));
});
