// Cache do app para funcionar offline. Troque VERSION a cada publicação para atualizar.
const VERSION = 'jplate-v10';
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

// cache: 'reload' pula o cache HTTP do navegador (o GitHub Pages guarda arquivos por 10 min);
// sem isso a versão nova podia ser instalada com o app.js antigo.
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION)
    .then((c) => c.addAll(ASSETS.map((u) => new Request(u, { cache: 'reload' }))))
    .then(() => self.skipWaiting()));
});

// Numa atualização, apaga a versão velha e recarrega as abas abertas para já mostrar a nova.
self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    const old = (await caches.keys()).filter((k) => k !== VERSION);
    await Promise.all(old.map((k) => caches.delete(k)));
    await self.clients.claim();
    if (old.length) {
      for (const c of await self.clients.matchAll({ type: 'window' })) c.navigate(c.url).catch(() => {});
    }
  })());
});

// Rede primeiro (revalidando com o servidor, que responde 304 se nada mudou) e cache sem internet.
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
  e.respondWith((async () => {
    try {
      const r = await fetch(e.request, { cache: 'no-cache' });
      if (r.ok && !e.request.url.includes('?')) (await caches.open(VERSION)).put(e.request, r.clone());
      return r;
    } catch {
      const hit = await caches.match(e.request, { ignoreSearch: true });
      if (hit) return hit;
      throw new Error('offline');
    }
  })());
});
