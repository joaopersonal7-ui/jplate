// Converte o pacote aberto tempo-food-db (TempoLife, CC-BY-4.0; a parte USDA SR Legacy é domínio público)
// em JSON enxuto com nomes em português.
// Uso: node scripts/build-usda.mjs <tempolife-foods.json> data/taco.json > data/usda.json
// Os nomes traduzidos ficam em scripts/src/usda-pt.tsv (nome original -> nome em português).
// Itens que não estão na tabela de tradução ficam de fora: é ela que define o que entra.
import { readFileSync } from 'node:fs';

const src = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const taco = JSON.parse(readFileSync(process.argv[3], 'utf8'));
const tsv = readFileSync(new URL('./src/usda-pt.tsv', import.meta.url), 'utf8');

const pt = new Map();
for (const line of tsv.split('\n')) {
  if (!line || line.startsWith('#')) continue;
  const [en, name] = line.split('\t');
  pt.set(en, name);
}

const GROUPS = {
  'Liha ja linnuliha': 'Carnes e aves',
  'Köögivili': 'Verduras e legumes',
  'Leivad ja pagarittooted': 'Pães e padaria',
  'Valmistoidud': 'Pratos prontos',
  'Magustoidud ja küpsetised': 'Doces e sobremesas',
  'Puuviljad ja marjad': 'Frutas',
  'Joogid': 'Bebidas',
  'Piimatooted': 'Leite e derivados',
  'Kala ja mereannid': 'Peixes e frutos do mar',
  'Kaunviljad': 'Leguminosas',
  'Rasvad ja õlid': 'Óleos e gorduras',
  'Hommikusöögid': 'Café da manhã',
  'Teravili ja pasta': 'Cereais e massas',
  'Snäkid ja suupisted': 'Petiscos',
  'Supid': 'Sopas',
  'Pähklid ja seemned': 'Castanhas e sementes',
  'Kartulid ja mugulad': 'Batatas e tubérculos',
  'Kastmed ja maitsed': 'Molhos e condimentos',
  'Vürtsid ja maitseained': 'Temperos e especiarias',
  'Munad': 'Ovos',
  'Salatid': 'Saladas',
};

const r = (v, d = 1) => (v == null ? null : Math.round(v * 10 ** d) / 10 ** d);
const norm = (s) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

// FNV-1a: id estável a partir do nome original.
const hash = (s) => {
  let h = 0x811c9dc5;
  for (const c of s) h = Math.imul(h ^ c.codePointAt(0), 0x01000193) >>> 0;
  return h.toString(36);
};

// Agrupa linhas de mesmo nome e fica com a de kcal mais próxima da mediana.
const byName = new Map();
for (const x of src) {
  if (!pt.has(x.name) || x.kcal_per_100g == null) continue;
  if (!byName.has(x.name)) byName.set(x.name, []);
  byName.get(x.name).push(x);
}

const tacoNames = new Set(taco.map((f) => norm(f.name)));
const seen = new Map();
const foods = [];
for (const [en, rows] of byName) {
  rows.sort((a, b) => a.kcal_per_100g - b.kcal_per_100g);
  const x = rows[Math.floor(rows.length / 2)];
  // "(USDA)" e "(2)" na tradução só marcam colisões; a chave de duplicata ignora esses sufixos.
  const base = pt.get(en).replace(/ \((USDA|2)\)$/, '');
  const kcal = r(x.kcal_per_100g, 0);
  const prev = seen.get(norm(base));
  if (prev && Math.abs(prev.n.kcal - kcal) <= Math.max(10, prev.n.kcal * 0.15)) continue;
  let name = prev ? `${base} (variação)` : base;
  if (tacoNames.has(norm(name))) name = `${name} (USDA)`;
  const food = {
    id: `${x.source === 'usda_sr_legacy' ? 'usda' : 'tl'}-${hash(en)}`,
    name,
    group: GROUPS[x.category] ?? 'Outros',
    source: x.source === 'usda_sr_legacy' ? 'usda' : 'tempo',
    n: {
      kcal,
      carbs: r(x.carbs_g),
      protein: r(x.protein_g),
      fat: r(x.fat_g),
      fiber: r(x.fiber_g),
      sodium: x.salt_g == null ? null : r(x.salt_g * 400, 0),
    },
  };
  if (!prev) seen.set(norm(base), food);
  foods.push(food);
}

foods.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
process.stdout.write(JSON.stringify(foods));
