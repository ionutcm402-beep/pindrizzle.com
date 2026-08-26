self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { title: "Ping", body: event.data ? event.data.text() : "You have a new local update." };
  }

  const title = payload.title || "Ping";
  const options = {
    body: payload.body || "You have a new local update.",
    tag: payload.notificationId ? `ping-${payload.notificationId}` : "ping-update",
    data: { url: payload.url || "/alerts" },
    renotify: false,
    silent: false,
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = new URL(event.notification.data?.url || "/alerts", self.location.origin).href;

  event.waitUntil((async () => {
    const windows = await clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const client of windows) {
      if ("focus" in client) {
        await client.navigate(targetUrl);
        return client.focus();
      }
    }
    return clients.openWindow(targetUrl);
  })());
});
