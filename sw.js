// Cache do app para funcionar offline. Troque VERSION a cada publicação para atualizar.
const VERSION = 'jplate-v27';
const ASSETS = [
  './',
  'index.html',
  'manifest.webmanifest',
  'assets/logo.jpg',
  'assets/splash.jpg',
  'assets/marca.svg',
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
  'src/equivalencias.js',
  'src/faq.js',
  'src/assistant.js',
  'src/kb.js',
  'src/kb-base.js',
  'src/kb-med.js',
  'src/kb-300.js',
  'src/kb-conceitos.js',
  'src/kb-neural.js',
  'src/kb-canetas.js',
  'src/conversa.js',
  'src/saude.js',
  'src/config.js',
  'src/servidor.js',
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

// Dica do dia enviada pelo servidor (server/). Tocar abre o app na SÁ com a explicação completa.
self.addEventListener('push', (e) => {
  let d = {};
  try { d = e.data?.json() ?? {}; } catch { d = { body: e.data?.text() }; }
  e.waitUntil(self.registration.showNotification(d.title || 'JPlate', {
    body: d.body || '',
    icon: 'icon-192.png',
    badge: 'icon-192.png',
    tag: 'dica-do-dia',
    data: { url: new URL(d.url || './', self.registration.scope).href },
  }));
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const url = e.notification.data?.url || self.registration.scope;
  e.waitUntil((async () => {
    const abertas = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const app = abertas.find((c) => c.url.startsWith(self.registration.scope));
    if (app) {
      await app.focus();
      return app.navigate(url).catch(() => {});
    }
    return self.clients.openWindow(url);
  })());
});
