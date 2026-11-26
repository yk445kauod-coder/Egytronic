/* Operations console worker: receives push messages and shows them as system
   notifications. The console registers this file from /admin/. */

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { body: event.data ? event.data.text() : "" };
  }
  event.waitUntil(
    self.registration.showNotification(data.title || "Egytronic", {
      body: data.body || "",
      icon: "/favicon.ico",
      badge: "/favicon.ico",
      tag: data.tag || "egytronic-ops",
      dir: "rtl",
      lang: "ar",
      data: { url: data.url || "/admin/" },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = event.notification.data?.url || "/admin/";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      const open = list.find((client) => client.url.includes("/admin/"));
      return open ? open.focus() : self.clients.openWindow(target);
    })
  );
});
