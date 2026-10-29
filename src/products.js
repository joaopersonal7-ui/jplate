// Biblioteca de produtos embalados: modelo, normalização, qualidade, histórico e busca.
// Regras puras (sem DOM e sem banco), usadas pelo app e pelo importador em scripts/.
//
// Princípio: o valor exibido é o valor recebido da fonte. Nada é estimado, calculado ou
// copiado de outro produto, marca, sabor ou tamanho. O que a fonte não traz fica null e
// aparece como "não informado".
import { normalize } from './domain.js';

// Nutrientes da tabela nutricional brasileira (RDC 429/2020 e IN 75/2020).
// `off` é o nome do campo no Open Food Facts; `unit` é a unidade em que o OFF entrega
// os campos _100g/_serving (massa sempre em g, energia em kcal ou kJ).
export const LABEL_NUTRIENTS = [
  { key: 'energyKcal', off: 'energy-kcal', label: 'Valor energético', unit: 'kcal' },
  { key: 'energyKj', off: 'energy-kj', label: 'Valor energético', unit: 'kJ' },
  { key: 'carbs', off: 'carbohydrates', label: 'Carboidratos', unit: 'g' },
  { key: 'sugars', off: 'sugars', label: 'Açúcares totais', unit: 'g' },
  { key: 'addedSugars', off: 'added-sugars', label: 'Açúcares adicionados', unit: 'g' },
  { key: 'protein', off: 'proteins', label: 'Proteínas', unit: 'g' },
  { key: 'fat', off: 'fat', label: 'Gorduras totais', unit: 'g' },
  { key: 'satFat', off: 'saturated-fat', label: 'Gorduras saturadas', unit: 'g' },
  { key: 'transFat', off: 'trans-fat', label: 'Gorduras trans', unit: 'g' },
  { key: 'fiber', off: 'fiber', label: 'Fibra alimentar', unit: 'g' },
  { key: 'sodium', off: 'sodium', label: 'Sódio', unit: 'g' },
];

// Para a tabela ser "completa": energia em kcal e os itens obrigatórios do rótulo brasileiro.
// Açúcares adicionados e kJ não entram porque rótulos antigos não traziam.
export const REQUIRED = ['energyKcal', 'carbs', 'sugars', 'protein', 'fat', 'satFat', 'transFat', 'fiber', 'sodium'];
// Mínimo para lançar no diário com sentido.
export const BASIC = ['energyKcal', 'carbs', 'protein', 'fat'];

export const STATUS_LABEL = {
  completo: 'Tabela completa',
  parcial: 'Tabela parcial',
  pendente: 'Tabela pendente',
};

export const SOURCES = {
  off: {
    name: 'Open Food Facts',
    license: 'ODbL 1.0 (base) · DbCL 1.0 (conteúdo)',
    licenseUrl: 'https://opendatacommons.org/licenses/odbl/1-0/',
    productUrl: (ref) => `https://world.openfoodfacts.org/product/${encodeURIComponent(ref)}`,
  },
  gs1br: { name: 'GS1 Brasil (Cadastro Nacional de Produtos)', license: 'contrato comercial', productUrl: null },
  tbca: { name: 'TBCA/USP', license: 'uso conforme autorização dos coordenadores', productUrl: null },
  rotulo: { name: 'Rótulo conferido pelo usuário', license: 'dado pessoal', productUrl: null },
};

// Se duas fontes divergem, vale a de maior prioridade como principal; a outra continua visível.
const PRIORITY = { rotulo: 3, gs1br: 2, off: 1 };

// ---------- GTIN ----------

// Confere o dígito verificador de GTIN-8/12/13/14.
export function isValidGtin(code) {
  if (!/^\d+$/.test(code ?? '') || ![8, 12, 13, 14].includes(code.length)) return false;
  const digits = [...code].map(Number);
  const check = digits.pop();
  const sum = digits.reverse().reduce((s, d, i) => s + d * (i % 2 === 0 ? 3 : 1), 0);
  return (10 - (sum % 10)) % 10 === check;
}

// GTIN-12 (UPC) e GTIN-13 do mesmo item são o mesmo número com zero à esquerda; guardamos em 13+.
export function canonicalGtin(code) {
  const c = String(code ?? '').replace(/\D/g, '');
  if (!isValidGtin(c)) return null;
  return c.length === 12 ? `0${c}` : c;
}

// ---------- quantidade da embalagem ----------

const UNIT_ALIASES = {
  g: 'g', gr: 'g', grs: 'g', grama: 'g', gramas: 'g', kg: 'kg', quilo: 'kg', quilos: 'kg', mg: 'mg',
  ml: 'ml', l: 'l', lt: 'l', litro: 'l', litros: 'l', cl: 'cl', dl: 'dl',
};
const TO_BASE = { g: ['g', 1], kg: ['g', 1000], mg: ['g', 0.001], ml: ['ml', 1], l: ['ml', 1000], cl: ['ml', 10], dl: ['ml', 100] };

// Lê "400 g", "1,5 L", "2 x 200 g", "6 x 1 L". Devolve o texto original e, se der para ler sem
// adivinhar, o total em g ou ml. Texto que não segue esse padrão fica só como texto.
export function parseQuantity(raw) {
  const text = String(raw ?? '').trim();
  if (!text) return null;
  const m = text.toLowerCase().replace(',', '.')
    .match(/^(?:(\d+)\s*[x×]\s*)?(\d+(?:\.\d+)?)\s*([a-z]+)\.?$/);
  const unit = m && UNIT_ALIASES[m[3]];
  if (!unit) return { raw: text, value: null, unit: null, packs: null };
  const [base, f] = TO_BASE[unit];
  const packs = m[1] ? Number(m[1]) : 1;
  return { raw: text, value: Math.round(Number(m[2]) * f * packs * 1000) / 1000, unit: base, packs: m[1] ? packs : null };
}

// ---------- normalização do Open Food Facts ----------

const num = (v) => {
  if (v === '' || v === null || v === undefined) return null;
  const x = typeof v === 'string' ? Number(v.replace(',', '.')) : v;
  return Number.isFinite(x) ? x : null;
};
const text = (v) => (typeof v === 'string' && v.trim() ? v.trim() : null);
const tagName = (t) => t?.replace(/^[a-z]{2}:/, '').replace(/-/g, ' ') ?? null;

function readNutrients(n, suffix) {
  const out = {};
  let any = false;
  for (const x of LABEL_NUTRIENTS) {
    const v = num(n?.[`${x.off}${suffix}`]);
    out[x.key] = v === null ? null : { value: v, unit: x.unit };
    if (v !== null) any = true;
  }
  return any ? out : null;
}

// Converte um documento de produto do OFF (linha do JSONL ou resposta da API) num Produto.
// Devolve null só quando não há código. Produtos sem tabela entram como "pendente".
export function fromOff(p, { fetchedAt = new Date().toISOString(), via = 'dump' } = {}) {
  const code = String(p?.code ?? '').trim();
  if (!code) return null;
  const gtin = canonicalGtin(code);
  const n = p.nutriments ?? {};
  const quantity = parseQuantity(p.quantity);
  // Quando o OFF já leu a quantidade, usamos o número dele (e guardamos o texto original).
  if (quantity && num(p.product_quantity) !== null && ['g', 'ml'].includes(p.product_quantity_unit)) {
    quantity.value = num(p.product_quantity);
    quantity.unit = p.product_quantity_unit;
  }
  const brands = (p.brands ?? '').split(',').map((b) => b.trim()).filter(Boolean);
  const name = text(p.product_name_pt) ?? text(p.product_name) ?? text(p.generic_name_pt) ?? text(p.generic_name);
  const per100 = p.no_nutrition_data === 'on' ? null : readNutrients(n, '_100g');
  const perServing = p.no_nutrition_data === 'on' ? null : readNutrients(n, '_serving');
  // O rótulo traz a tabela por 100 g/ml ou por porção; a outra coluna o OFF calcula pela porção.
  const basis = p.nutrition_data_per === 'serving' ? 'serving' : p.nutrition_data_per === '100g' ? '100g' : null;
  const liquid = quantity?.unit === 'ml' || /\bml\b/i.test(p.serving_size ?? '');
  const states = p.states_tags ?? [];
  const nutrition = {
    basisOnLabel: basis,
    per100: per100 && { unit: liquid ? 'ml' : 'g', values: per100 },
    perServing: perServing && {
      description: text(p.serving_size),
      quantity: num(p.serving_quantity),
      unit: text(p.serving_quantity_unit) ?? (liquid ? 'ml' : 'g'),
      values: perServing,
    },
    // Coluna que não veio do rótulo, e sim de conta feita pela própria fonte.
    computedBySource: basis === 'serving' ? 'per100' : basis === '100g' && perServing ? 'perServing' : null,
  };
  if (!nutrition.perServing && (text(p.serving_size) || num(p.serving_quantity))) {
    nutrition.perServing = { description: text(p.serving_size), quantity: num(p.serving_quantity), unit: text(p.serving_quantity_unit), values: null };
  }
  const product = {
    id: gtin ? `gtin:${gtin}` : `off:${code}`,
    kind: 'embalado',
    gtin,
    name,
    brand: brands[0] ?? null,
    quantity,
    // Categoria no texto que o colaborador digitou (costuma estar em português); senão, a tag da fonte.
    category: text((p.categories ?? '').split(',').at(-1)?.replace(/^[a-z]{2}:/, '')) ?? tagName((p.categories_tags ?? []).at(-1)),
    ingredients: text(p.ingredients_text_pt) ?? text(p.ingredients_text),
    allergens: (p.allergens_tags ?? []).map(tagName),
    traces: (p.traces_tags ?? []).map(tagName),
    nutrition,
    original: {
      code,
      product_name_pt: text(p.product_name_pt),
      product_name: text(p.product_name),
      brands: text(p.brands),
      quantity: text(p.quantity),
      categories: text(p.categories),
      nutrition_data_per: p.nutrition_data_per ?? null,
    },
    provenance: [{
      source: 'off',
      ref: code,
      url: SOURCES.off.productUrl(code),
      via,
      fetchedAt,
      sourceModifiedAt: num(p.last_modified_t) ? new Date(num(p.last_modified_t) * 1000).toISOString() : null,
      license: SOURCES.off.license,
      verification: states.includes('en:checked') ? 'conferido por moderador da fonte' : 'enviado por colaboradores, não conferido',
      sourceStates: states.filter((s) => /complete|to-be|checked/.test(s)),
    }],
  };
  product.quality = qualityOf(product);
  return product;
}

// ---------- qualidade ----------

// Confirmado: valor presente na coluna que veio do rótulo. Ausente: null em todas as colunas.
export function qualityOf(product) {
  const nut = product.nutrition ?? {};
  const label = nut.basisOnLabel === 'serving' ? nut.perServing?.values : nut.per100?.values ?? nut.perServing?.values;
  const has = (k) => label?.[k] != null;
  const present = LABEL_NUTRIENTS.filter((x) => has(x.key)).map((x) => x.key);
  const missing = REQUIRED.filter((k) => !has(k));
  const status = !present.length ? 'pendente' : missing.length ? 'parcial' : 'completo';
  return {
    status,
    basic: BASIC.every(has),
    present,
    missing,
    servingDeclared: Boolean(nut.perServing?.description || nut.perServing?.quantity),
    packageDeclared: product.quantity?.value != null,
  };
}

// ---------- histórico e divergência ----------

function nutritionSignature(nut) {
  const pick = (col) => col?.values && Object.fromEntries(Object.entries(col.values).filter(([, v]) => v).map(([k, v]) => [k, v.value]));
  return JSON.stringify([pick(nut?.per100), pick(nut?.perServing), nut?.perServing?.quantity ?? null]);
}

const TRACKED = ['name', 'brand', 'quantity', 'ingredients'];

// Junta um registro novo ao que já existe sem apagar nada:
// - mesma fonte: o registro anterior vai para `history` se algo mudou;
// - outra fonte: fica guardada em `alternatives`; a de maior prioridade é a principal, e cada
//   diferença de nutriente vira uma entrada em `divergences`.
export function mergeProduct(existing, incoming, { keepHistory = 10 } = {}) {
  if (!existing) return incoming;
  const src = incoming.provenance[0].source;
  const prevSrc = existing.provenance[0].source;
  if (src === prevSrc) {
    const changed = nutritionSignature(existing.nutrition) !== nutritionSignature(incoming.nutrition)
      || TRACKED.some((k) => JSON.stringify(existing[k]) !== JSON.stringify(incoming[k]));
    const history = [...(existing.history ?? [])];
    if (changed) history.unshift(snapshot(existing));
    return {
      ...incoming,
      history: history.slice(0, keepHistory),
      alternatives: existing.alternatives ?? [],
      divergences: computeDivergences(incoming, existing.alternatives ?? []),
    };
  }
  const [primary, other] = (PRIORITY[src] ?? 0) >= (PRIORITY[prevSrc] ?? 0) ? [incoming, existing] : [existing, incoming];
  const alternatives = [snapshot(other), ...(existing.alternatives ?? []).filter((a) => a.provenance[0].source !== other.provenance[0].source)];
  const merged = { ...primary, history: existing.history ?? [], alternatives };
  merged.divergences = computeDivergences(merged, alternatives);
  return merged;
}

function snapshot(p) {
  return { name: p.name, brand: p.brand, quantity: p.quantity, ingredients: p.ingredients, nutrition: p.nutrition, quality: p.quality, provenance: p.provenance };
}

export function computeDivergences(primary, alternatives) {
  const out = [];
  for (const alt of alternatives) {
    for (const col of ['per100', 'perServing']) {
      for (const x of LABEL_NUTRIENTS) {
        const a = primary.nutrition?.[col]?.values?.[x.key]?.value;
        const b = alt.nutrition?.[col]?.values?.[x.key]?.value;
        if (a == null || b == null) continue;
        if (Math.abs(a - b) > Math.max(0.05, Math.abs(a) * 0.01)) {
          out.push({ nutrient: x.key, column: col, values: [
            { source: primary.provenance[0].source, value: a },
            { source: alt.provenance[0].source, value: b },
          ] });
        }
      }
    }
  }
  return out;
}

// ---------- índice compacto para busca ----------

// Linha do índice publicado em data/produtos/indice.json. Chaves curtas para o arquivo ficar leve.
export function indexRow(p) {
  const kcal = p.nutrition?.per100?.values?.energyKcal?.value ?? null;
  return {
    id: p.id,
    n: p.name,
    b: p.brand,
    q: p.quantity?.raw ?? null,
    v: p.quantity?.value ?? null,
    u: p.quantity?.unit ?? null,
    c: p.category,
    s: p.quality.status,
    k: kcal,
    bu: p.nutrition?.per100?.unit ?? null,
  };
}

export function fromIndexRow(r) {
  return {
    id: r.id, name: r.n, brand: r.b, gtin: r.id.startsWith('gtin:') ? r.id.slice(5) : null,
    quantity: r.q ? { raw: r.q, value: r.v, unit: r.u } : null,
    category: r.c, status: r.s, kcal100: r.k, baseUnit: r.bu,
  };
}

// Arquivo de detalhes de um produto: os dois últimos dígitos do código (100 arquivos).
export function shardOf(id) {
  const digits = id.replace(/\D/g, '');
  if (digits.length >= 2) return digits.slice(-2);
  let h = 0;
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) % 100;
  return String(h).padStart(2, '0');
}

// ---------- busca ----------

// Busca por nome, marca, categoria e GTIN. Cada GTIN é um resultado: marcas, sabores e tamanhos
// diferentes aparecem separados. Um número (6+ dígitos) procura pelo código de barras.
export function searchProducts(items, query, { limit = 80 } = {}) {
  const q = String(query ?? '').trim();
  const digits = q.replace(/\D/g, '');
  if (digits.length >= 6 && /^[\d\s.-]+$/.test(q)) {
    const want = canonicalGtin(digits) ?? digits;
    return items.filter((r) => r.gtin === want || r.gtin?.endsWith(digits) || r.id === `off:${digits}`).slice(0, limit);
  }
  const tokens = normalize(q).split(' ').filter(Boolean);
  if (!tokens.length) return [];
  const out = [];
  for (const r of items) {
    r._name ??= normalize(r.name ?? '');
    r._brand ??= normalize(r.brand ?? '');
    r._all ??= `${r._name} ${r._brand} ${normalize(r.category ?? '')} ${normalize(r.quantity?.raw ?? '')}`;
    let score = 0;
    let ok = true;
    for (const t of tokens) {
      if (!r._all.includes(t)) { ok = false; break; }
      if (r._name.split(' ').some((w) => w.startsWith(t))) score += 10;
      else if (r._brand.includes(t)) score += 8;
      else score += 3;
    }
    if (!ok) continue;
    if (r._name.startsWith(tokens[0])) score += 6;
    score += { completo: 6, parcial: 3, pendente: 0 }[r.status] ?? 0;
    out.push({ r, score });
  }
  // Mesma pontuação: agrupa por marca e ordena pelo tamanho da embalagem.
  out.sort((a, b) => b.score - a.score
    || (a.r.brand ?? '').localeCompare(b.r.brand ?? '', 'pt-BR')
    || (a.r.quantity?.value ?? 0) - (b.r.quantity?.value ?? 0));
  return out.slice(0, limit).map((x) => x.r);
}

// ---------- uso no diário ----------

// Converte para o formato de alimento do diário (valores por 100 g/ml).
// Só usa números da fonte; sódio passa de g para mg (mesma grandeza, outra unidade).
// Sem nenhum valor por 100 g/ml, não dá para lançar por peso: devolve null.
export function productToFood(p) {
  const v = p.nutrition?.per100?.values;
  if (!v || !Object.values(v).some(Boolean)) return null;
  const val = (k) => v[k]?.value ?? null;
  const serving = p.nutrition.perServing?.quantity;
  return {
    id: `off-${p.gtin ?? p.provenance[0].ref}`,
    source: 'off',
    productId: p.id,
    name: p.name ?? 'Produto sem nome',
    brand: p.brand,
    barcode: p.gtin ?? p.provenance[0].ref,
    group: 'Produto de marca',
    baseUnit: p.nutrition.per100.unit,
    package: p.quantity?.raw ?? null,
    status: p.quality.status,
    servings: serving > 0 ? [{ name: `porção do rótulo${p.nutrition.perServing.description ? ` (${p.nutrition.perServing.description})` : ''}`, g: serving }] : [],
    n: {
      kcal: val('energyKcal'),
      carbs: val('carbs'),
      protein: val('protein'),
      fat: val('fat'),
      fiber: val('fiber'),
      sodium: val('sodium') === null ? null : Math.round(val('sodium') * 100000) / 100,
    },
  };
}

// ---------- cobertura ----------

export function coverage(products) {
  const total = products.length;
  const count = (f) => products.filter(f).length;
  const pct = (x) => (total ? Math.round((x / total) * 1000) / 10 : 0);
  const byStatus = Object.fromEntries(['completo', 'parcial', 'pendente'].map((s) => [s, count((p) => p.quality.status === s)]));
  const basic = count((p) => p.quality.basic);
  const withGtin = count((p) => p.gtin);
  const withBrand = count((p) => p.brand);
  const withName = count((p) => p.name);
  const withPackage = count((p) => p.quality.packageDeclared);
  const withServing = count((p) => p.quality.servingDeclared);
  const checked = count((p) => p.provenance[0].verification.startsWith('conferido'));
  return {
    total,
    status: Object.fromEntries(Object.entries(byStatus).map(([k, v]) => [k, { n: v, pct: pct(v) }])),
    basicForDiary: { n: basic, pct: pct(basic) },
    withGtin: { n: withGtin, pct: pct(withGtin) },
    withName: { n: withName, pct: pct(withName) },
    withBrand: { n: withBrand, pct: pct(withBrand) },
    withPackageSize: { n: withPackage, pct: pct(withPackage) },
    withServing: { n: withServing, pct: pct(withServing) },
    checkedBySource: { n: checked, pct: pct(checked) },
    brands: new Set(products.map((p) => p.brand && normalize(p.brand)).filter(Boolean)).size,
  };
}
