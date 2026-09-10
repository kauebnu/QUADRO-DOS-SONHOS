/// <reference lib="webworker" />
import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute } from 'workbox-precaching'
import { NavigationRoute, registerRoute } from 'workbox-routing'
import { CacheFirst, StaleWhileRevalidate } from 'workbox-strategies'
import { ExpirationPlugin } from 'workbox-expiration'
import { CacheableResponsePlugin } from 'workbox-cacheable-response'

declare const self: ServiceWorkerGlobalScope

/* ------------------------------------------------------------ precache */

precacheAndRoute(self.__WB_MANIFEST)
cleanupOutdatedCaches()

// SPA: qualquer navegação cai no index.html (menos APIs e arquivos do storage)
registerRoute(
  new NavigationRoute(createHandlerBoundToURL('index.html'), {
    denylist: [/^\/api\//, /^\/storage\//, /^\/auth\//, /\.[^/]+$/],
  }),
)

/* ------------------------------------------------- cache em tempo de uso */

// Fotos dos sonhos (URLs assinadas do Supabase Storage)
registerRoute(
  ({ url, request }) =>
    request.destination === 'image' &&
    (url.pathname.includes('/storage/v1/object') || url.pathname.includes('/dream-images/')),
  new CacheFirst({
    cacheName: 'wedream-fotos',
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({ maxEntries: 250, maxAgeSeconds: 60 * 60 * 24 * 30, purgeOnQuotaError: true }),
    ],
  }),
)

// Fontes auto-hospedadas
registerRoute(
  ({ request }) => request.destination === 'font',
  new CacheFirst({
    cacheName: 'wedream-fontes',
    plugins: [new ExpirationPlugin({ maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 365 })],
  }),
)

// Config em tempo de execução — sempre revalida
registerRoute(
  ({ url }) => url.pathname === '/config.js',
  new StaleWhileRevalidate({ cacheName: 'wedream-config' }),
)

/* ------------------------------------------------------------ mensagens */

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') void self.skipWaiting()
})

self.addEventListener('install', () => {
  void self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})

/* ---------------------------------------------------- notificações push */

type PushPayload = {
  title?: string
  body?: string
  url?: string
  tag?: string
}

self.addEventListener('push', (event) => {
  let payload: PushPayload = {}
  try {
    payload = event.data?.json() ?? {}
  } catch {
    payload = { body: event.data?.text() ?? '' }
  }

  const title = payload.title || 'WE DREAM ✨'
  const options: NotificationOptions = {
    body: payload.body || 'Olhe seus sonhos hoje. Eles estão esperando por você.',
    icon: '/icons/icon-192.png',
    badge: '/icons/badge-72.png',
    tag: payload.tag || 'wedream-diario',
    data: { url: payload.url || '/' },
    requireInteraction: false,
  }

  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const target = (event.notification.data as { url?: string } | undefined)?.url ?? '/'

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ('focus' in client) {
          void client.navigate(target)
          return client.focus()
        }
      }
      return self.clients.openWindow(target)
    }),
  )
})

export {}
