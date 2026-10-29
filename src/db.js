// Armazenamento local em IndexedDB. Tudo fica no aparelho; o backup é a exportação JSON.

const DB_NAME = 'nutri-pessoal';
const DB_VERSION = 2;
export const STORES = ['foods', 'entries', 'weights', 'goals', 'kv', 'products'];
// Listas exportadas no backup (kv vai à parte).
const LISTS = ['foods', 'entries', 'weights', 'goals', 'products'];

let dbPromise;

function open() {
  dbPromise ??= new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = req.result;
      if (e.oldVersion < 1) {
        db.createObjectStore('foods', { keyPath: 'id' });
        db.createObjectStore('entries', { keyPath: 'id' }).createIndex('date', 'date');
        db.createObjectStore('weights', { keyPath: 'id' }).createIndex('date', 'date');
        db.createObjectStore('goals', { keyPath: 'id' });
        db.createObjectStore('kv');
      }
      // v2: produtos de marca consultados online, com proveniência e histórico (src/products.js).
      if (e.oldVersion < 2) db.createObjectStore('products', { keyPath: 'id' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

function done(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function store(name, mode = 'readonly') {
  return (await open()).transaction(name, mode).objectStore(name);
}

export async function get(name, id) {
  return done((await store(name)).get(id));
}

export async function getAll(name) {
  return done((await store(name)).getAll());
}

export async function getByDate(name, date) {
  return done((await store(name)).index('date').getAll(date));
}

export async function put(name, value) {
  return done((await store(name, 'readwrite')).put(value));
}

export async function remove(name, id) {
  return done((await store(name, 'readwrite')).delete(id));
}

export async function kvGet(key, fallback) {
  const v = await done((await store('kv')).get(key));
  return v === undefined ? fallback : v;
}

export async function kvSet(key, value) {
  return done((await store('kv', 'readwrite')).put(value, key));
}

// Substitui todo o conteúdo numa única transação (usado ao importar backup).
export async function replaceAll(data) {
  const db = await open();
  const tx = db.transaction(STORES, 'readwrite');
  for (const name of LISTS) {
    const s = tx.objectStore(name);
    s.clear();
    for (const item of data[name] ?? []) s.put(item);
  }
  const kv = tx.objectStore('kv');
  kv.clear();
  for (const [k, v] of Object.entries(data.kv ?? {})) kv.put(v, k);
  return new Promise((resolve, reject) => {
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

export async function exportAll() {
  const out = {};
  for (const name of LISTS) out[name] = await getAll(name);
  const s = await store('kv');
  const [keys, values] = await Promise.all([done(s.getAllKeys()), done(s.getAll())]);
  out.kv = Object.fromEntries(keys.map((k, i) => [k, values[i]]));
  return out;
}
