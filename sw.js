// ============================================================
// سليم — Service Worker v1.0
// ============================================================

const CACHE = 'selim-v1'
const OFFLINE = '/selim-system/offline.html'

const STATIC = [
  '/selim-system/',
  '/selim-system/index.html',
  '/selim-system/login.html',
  '/selim-system/admin.html',
  '/selim-system/doctor.html',
  '/selim-system/reception.html',
  '/selim-system/admin.js',
  '/selim-system/doctor.js',
  '/selim-system/reception.js',
  '/selim-system/shared/styles.css',
  '/selim-system/offline.html',
  '/selim-system/icons/icon-192.png',
  '/selim-system/icons/icon-512.png',
  'https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@300;400;500;600;700;800&display=swap',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css'
]

// ── Install ──
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(STATIC)).then(() => self.skipWaiting())
  )
})

// ── Activate ──
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  )
})

// ── Fetch ──
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url)

  // Supabase API — لا نخزنه في الـ cache
  if (url.hostname.includes('supabase.co') || url.hostname.includes('esm.sh')) {
    return e.respondWith(fetch(e.request).catch(() => new Response('', {status: 503})))
  }

  // Navigation requests — HTML pages
  if (e.request.mode === 'navigate') {
    return e.respondWith(
      fetch(e.request).catch(() => caches.match(OFFLINE))
    )
  }

  // Static assets — cache first
  e.respondWith(
    caches.match(e.request).then(cached => {
      return cached || fetch(e.request).then(res => {
        if (!res || res.status !== 200) return res
        const clone = res.clone()
        caches.open(CACHE).then(c => c.put(e.request, clone))
        return res
      }).catch(() => new Response('', {status: 503}))
    })
  )
})
