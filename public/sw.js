/* Cyclo Stratège reste online-first : aucun cache ni intercepteur fetch. */
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { body: event.data ? event.data.text() : "" };
  }

  const title = payload.title || "Cyclo Stratège";
  event.waitUntil(
    self.registration.showNotification(title, {
      body: payload.body || "Une nouvelle information vous attend.",
      icon: payload.icon || "/pwa/icon-192.png",
      badge: payload.badge || "/pwa/icon-192.png",
      tag: payload.tag || "cyclo-stratege",
      renotify: false,
      data: { url: payload.url || "/jeu" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const requestedUrl = event.notification.data?.url || "/jeu";
  const candidateUrl = new URL(requestedUrl, self.location.origin);
  const targetUrl = candidateUrl.origin === self.location.origin
    ? candidateUrl
    : new URL("/jeu", self.location.origin);

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      const matchingClient = clients.find((client) => {
        const clientUrl = new URL(client.url);
        return clientUrl.origin === targetUrl.origin;
      });
      if (matchingClient) {
        return matchingClient.focus().then((client) => {
          if ("navigate" in client) return client.navigate(targetUrl.href);
          return client;
        });
      }
      return self.clients.openWindow(targetUrl.href);
    }),
  );
});
