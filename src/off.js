// Busca online de produtos de marca no Open Food Facts (base aberta, licença ODbL).
// Só é chamada quando o usuário pede; envia apenas o termo buscado ou o código de barras.

const API = 'https://world.openfoodfacts.org';
const FIELDS = 'code,product_name,product_name_pt,generic_name_pt,brands,nutriments,quantity,serving_quantity,categories_tags';

const num = (v) => {
  const x = typeof v === 'string' ? Number(v.replace(',', '.')) : v;
  return Number.isFinite(x) ? Math.round(x * 100) / 100 : null;
};

// Converte um produto do OFF no formato de alimento do app. Sem calorias por 100 g/ml, fica de fora.
export function offToFood(p) {
  const n = p?.nutriments ?? {};
  let kcal = num(n['energy-kcal_100g']);
  if (kcal === null && num(n.energy_100g) !== null) kcal = Math.round(num(n.energy_100g) / 4.184);
  const name = (p?.product_name_pt || p?.product_name || p?.generic_name_pt || '').trim();
  if (kcal === null || !name || !p.code) return null;
  const sodium = num(n.sodium_100g) ?? (num(n.salt_100g) === null ? null : num(n.salt_100g) / 2.5);
  const liquid = /\b\d+([.,]\d+)?\s*(ml|l|litros?)\b/i.test(p.quantity ?? '');
  const serving = num(p.serving_quantity);
  return {
    id: `off-${p.code}`,
    source: 'off',
    name,
    brand: (p.brands ?? '').split(',')[0].trim() || null,
    barcode: p.code,
    group: 'Produto de marca',
    baseUnit: liquid ? 'ml' : 'g',
    servings: serving > 0 ? [{ name: 'porção do rótulo', g: serving }] : [],
    n: {
      kcal,
      carbs: num(n.carbohydrates_100g),
      protein: num(n.proteins_100g),
      fat: num(n.fat_100g),
      fiber: num(n.fiber_100g),
      sodium: sodium === null ? null : Math.round(sodium * 1000),
    },
  };
}

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

// Busca priorizando produtos vendidos no Brasil.
export async function searchOnline(query) {
  const q = encodeURIComponent(query);
  const url = `${API}/cgi/search.pl?search_terms=${q}&search_simple=1&action=process&json=1&page_size=40`
    + `&tagtype_0=countries&tag_contains_0=contains&tag_0=brazil&fields=${FIELDS}`;
  const data = await getJSON(url);
  const seen = new Set();
  return (data.products ?? []).map(offToFood).filter((f) => f && !seen.has(f.id) && seen.add(f.id));
}

export async function productByBarcode(code) {
  const data = await getJSON(`${API}/api/v2/product/${encodeURIComponent(code)}.json?fields=${FIELDS}`);
  return data.status === 1 ? offToFood({ code, ...data.product }) : null;
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
