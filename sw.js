// Moodlog service worker — works offline, but always tries the network first so updates arrive on the next open.
// The GitHub Action in .github/workflows bumps CACHE_VERSION whenever app files change.
const CACHE_VERSION = 'moodlog-v20261110-0000';

const STATIC_ASSETS = [
  './', './index.html', './manifest.webmanifest', './css/app.css',
  './js/util.js', './js/store.js', './js/theme.js', './js/ui.js', './js/lock.js', './js/dial.js', './js/checkin.js',
  './js/journal.js', './js/voice.js', './js/habits.js', './js/trends.js', './js/sync.js', './js/reminders.js',
  './js/settings.js', './js/app.js',
  './icons/icon-180.png', './icons/icon-192.png', './icons/icon-512.png', './icons/icon-maskable-512.png'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_VERSION)
      .then(cache => Promise.all(STATIC_ASSETS.map(u => cache.add(new Request(u, { cache: 'reload' })).catch(() => {}))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE_VERSION).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== 'GET') return; // never touch backups / uploads
  const isFonts = url.hostname.includes('fonts.googleapis.com') || url.hostname.includes('fonts.gstatic.com');
  if (url.origin !== self.location.origin && !isFonts) return;

  if (isFonts) { // fonts never change: cache first
    e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(res => {
      const copy = res.clone(); caches.open(CACHE_VERSION).then(c => c.put(req, copy)); return res;
    })));
    return;
  }

  // app files: network first, fall back to the cached copy when offline
  e.respondWith(
    fetch(req).then(res => {
      if (res && res.status === 200) { const copy = res.clone(); caches.open(CACHE_VERSION).then(c => c.put(req, copy)); }
      return res;
    }).catch(() => caches.match(req).then(hit => hit || (req.mode === 'navigate' ? caches.match('./index.html') : undefined)))
  );
});
