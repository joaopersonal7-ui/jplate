// Consulta online ao Open Food Facts (base aberta, licença ODbL), só quando o usuário pede.
// Envia apenas o termo buscado ou o código de barras. A resposta vira um Produto (src/products.js),
// com os valores exatamente como vieram e a origem registrada.
import { fromOff } from './products.js';

const API = 'https://world.openfoodfacts.org';
const FIELDS = [
  'code', 'product_name', 'product_name_pt', 'generic_name', 'generic_name_pt', 'brands', 'quantity',
  'product_quantity', 'product_quantity_unit', 'serving_size', 'serving_quantity', 'serving_quantity_unit',
  'nutrition_data_per', 'no_nutrition_data', 'nutriments', 'categories', 'categories_tags',
  'ingredients_text', 'ingredients_text_pt', 'allergens_tags', 'traces_tags', 'states_tags', 'last_modified_t',
  'countries_tags',
].join(',');

async function getJSON(url) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 12000);
  try {
    const r = await fetch(url, { signal: ctrl.signal });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return await r.json();
  } finally {
    clearTimeout(t);
  }
}

// Busca priorizando produtos vendidos no Brasil. Produtos sem tabela também voltam, como "pendente".
export async function searchOnline(query) {
  const q = encodeURIComponent(query);
  const url = `${API}/cgi/search.pl?search_terms=${q}&search_simple=1&action=process&json=1&page_size=40`
    + `&tagtype_0=countries&tag_contains_0=contains&tag_0=brazil&fields=${FIELDS}`;
  const data = await getJSON(url);
  const at = new Date().toISOString();
  const seen = new Set();
  return (data.products ?? []).map((p) => fromOff(p, { fetchedAt: at, via: 'api' }))
    .filter((p) => p && !seen.has(p.id) && seen.add(p.id));
}

export async function productByBarcode(code) {
  const data = await getJSON(`${API}/api/v2/product/${encodeURIComponent(code)}.json?fields=${FIELDS}`);
  return data.status === 1 ? fromOff({ code, ...data.product }, { via: 'api' }) : null;
}

// Leitura pela câmera onde o navegador tem BarcodeDetector (Chrome/Android). No iPhone, digita-se o número.
export function canScan() {
  return 'BarcodeDetector' in globalThis && Boolean(navigator.mediaDevices?.getUserMedia);
}

export function scanBarcode(video, onCode, onError) {
  let stream = null;
  let stopped = false;
  let timer = null;
  const stop = () => {
    stopped = true;
    clearTimeout(timer);
    stream?.getTracks().forEach((t) => t.stop());
  };
  (async () => {
    try {
      const detector = new globalThis.BarcodeDetector({ formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e'] });
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      if (stopped) return stop();
      video.srcObject = stream;
      await video.play();
      const tick = async () => {
        if (stopped) return;
        const codes = await detector.detect(video).catch(() => []);
        if (codes.length) { stop(); return onCode(codes[0].rawValue); }
        timer = setTimeout(tick, 250);
      };
      tick();
    } catch {
      stop();
      onError();
    }
  })();
  return stop;
}
