self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});
self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const subscription =
        await self.registration.pushManager?.getSubscription();
      if (subscription) await subscription.unsubscribe();
      await self.registration.unregister();
    })(),
  );
});
