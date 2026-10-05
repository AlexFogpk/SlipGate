'use strict';
// Сервис-воркер SLIPGATE: держит игру в кэше телефона, чтобы она запускалась без интернета.
// Сборка (node tools/build.js --app) подставляет версию и список файлов. Новая версия
// на сайте скачивается в фоне при запуске; в меню появляется «Обновить игру».
const VERSION = '__VERSION__';
const CACHE = 'slipgate-' + VERSION;
const FONTS = 'slipgate-fonts';
const FILES = __FILES__;

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys()
    .then((keys) => Promise.all(keys.filter((k) => k.startsWith('slipgate-') && k !== CACHE && k !== FONTS).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // шрифты Google: из кэша, а в фоне обновляем; без сети — что успели сохранить
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    e.respondWith(caches.open(FONTS).then(async (c) => {
      const hit = await c.match(req);
      const net = fetch(req).then((r) => { if (r.ok || r.type === 'opaque') c.put(req, r.clone()); return r; });
      if (hit) { net.catch(() => {}); return hit; }
      return net;
    }));
    return;
  }
  if (url.origin !== self.location.origin) return;
  // игра — из кэша своей версии; страница открывается и по адресу папки, и с параметрами
  e.respondWith((async () => {
    const c = await caches.open(CACHE);
    const hit = await c.match(req, { ignoreSearch: true }) || (req.mode === 'navigate' ? await c.match('./') : undefined);
    return hit || fetch(req);
  })());
});
