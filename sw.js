// Cache do app para funcionar offline. Troque VERSION a cada publicação para atualizar.
const VERSION = 'jplate-v5';
const ASSETS = [
  './',
  'index.html',
  'manifest.webmanifest',
  'assets/logo.jpg',
  'assets/splash.jpg',
  'icon-192.png',
  'icon-512.png',
  'src/styles.css',
  'src/app.js',
  'src/db.js',
  'src/domain.js',
  'src/measures.js',
  'src/off.js',
  'src/planner.js',
  'src/products.js',
  'src/library.js',
  'data/taco.json',
  'data/receitas.json',
  'data/usda.json',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

// Cache primeiro; a rede só para o que não estiver no cache.
self.addEventListener('fetch', (e) => {
  // Busca online (Open Food Facts) vai sempre para a rede.
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return;
  // Biblioteca de produtos (data/produtos): grande demais para baixar na instalação.
  // Guarda cada arquivo na primeira vez que é usado e atualiza em segundo plano.
  if (new URL(e.request.url).pathname.includes('/data/produtos/')) {
    e.respondWith(caches.open(VERSION).then(async (c) => {
      const hit = await c.match(e.request);
      const net = fetch(e.request).then((r) => { if (r.ok) c.put(e.request, r.clone()); return r; });
      if (hit) { net.catch(() => {}); return hit; }
      return net;
    }));
    return;
  }
  e.respondWith(caches.match(e.request, { ignoreSearch: true }).then((hit) => hit ?? fetch(e.request)));
});
