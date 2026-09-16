/*
 * Service worker for browser push (Web Push + VAPID). Shows the notification
 * the server sent and opens its link on click. No caching, no offline: the
 * application itself is served fresh by the host.
 */
self.addEventListener('push', (event) => {
  let payload = { title: 'BCM', body: '', link: '/' }
  try {
    payload = { ...payload, ...event.data.json() }
  } catch {
    payload.body = event.data ? event.data.text() : ''
  }
  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: '/favicon.svg',
      badge: '/favicon.svg',
      tag: payload.id ? `bcm-${payload.id}` : undefined,
      data: { link: payload.link || '/', id: payload.id },
    }),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const target = new URL(event.notification.data?.link || '/', self.location.origin).href
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      const open = clients.find((c) => 'focus' in c)
      if (open) {
        open.navigate(target)
        return open.focus()
      }
      return self.clients.openWindow(target)
    }),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})
