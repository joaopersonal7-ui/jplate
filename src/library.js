// Biblioteca de produtos no navegador: índice publicado (data/produtos), detalhes sob demanda
// e produtos consultados online, que ficam no aparelho (IndexedDB 'products').
import * as db from './db.js';
import { fromIndexRow, indexRow, mergeProduct, shardOf, canonicalGtin } from './products.js';

let indexPromise = null;
const shards = new Map();

// Carrega o índice só quando a biblioteca é usada (é o arquivo maior do app).
export function loadLibrary() {
  indexPromise ??= (async () => {
    let meta = null;
    let items = [];
    try {
      const r = await fetch('data/produtos/indice.json');
      if (r.ok) ({ meta, items } = await r.json());
    } catch { /* sem índice publicado ou offline sem cache: segue só com o aparelho */ }
    const rows = new Map(items.map((x) => [x.id, fromIndexRow(x)]));
    const local = await db.getAll('products');
    for (const p of local) rows.set(p.id, { ...fromIndexRow(indexRow(p)), onDevice: true });
    return { meta, items: [...rows.values()], published: items.length, onDevice: local.length };
  })();
  return indexPromise;
}

async function publishedProduct(id) {
  const k = shardOf(id);
  if (!shards.has(k)) {
    shards.set(k, fetch(`data/produtos/det/${k}.json`).then((r) => (r.ok ? r.json() : [])).catch(() => []));
  }
  return (await shards.get(k)).find((p) => p.id === id) ?? null;
}

// Versão do aparelho (consulta online mais recente) sobre a publicada, sem perder o histórico.
export async function getProduct(id) {
  const [pub, local] = await Promise.all([publishedProduct(id), db.get('products', id)]);
  if (pub && local) return mergeProduct(pub, local);
  return local ?? pub;
}

export async function findByGtin(code) {
  const gtin = canonicalGtin(code);
  const lib = await loadLibrary();
  const row = lib.items.find((r) => (gtin && r.gtin === gtin) || r.id === `off:${code}`);
  return row ? getProduct(row.id) : null;
}

// Guarda no aparelho um produto consultado online, mesclando com o que já havia.
export async function rememberProduct(p) {
  const prev = await getProduct(p.id);
  const merged = mergeProduct(prev, p);
  await db.put('products', merged);
  const lib = await loadLibrary();
  const row = { ...fromIndexRow(indexRow(merged)), onDevice: true };
  const i = lib.items.findIndex((r) => r.id === p.id);
  if (i >= 0) lib.items[i] = row;
  else { lib.items.push(row); lib.onDevice += 1; }
  return merged;
}

// Depois de importar backup, o índice precisa ser refeito.
export function resetLibrary() {
  indexPromise = null;
}
