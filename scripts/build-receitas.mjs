// Calcula os nutrientes por 100 g de cada prato a partir dos ingredientes (TACO e USDA).
// Uso: node scripts/build-receitas.mjs > data/receitas.json
import { readFileSync } from 'node:fs';
import { RECEITAS } from './src/receitas.mjs';

const load = (f) => JSON.parse(readFileSync(new URL(`../data/${f}`, import.meta.url), 'utf8'));
const taco = new Map(load('taco.json').map((f) => [Number(f.id.slice(5)), f]));
const usda = new Map(load('usda.json').map((f) => [f.name, f]));
const KEYS = ['kcal', 'carbs', 'protein', 'fat', 'fiber', 'sodium'];
const r = (v, d = 1) => Math.round(v * 10 ** d) / 10 ** d;
const slug = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

const out = [];
for (const rec of RECEITAS) {
  const sum = Object.fromEntries(KEYS.map((k) => [k, 0]));
  let raw = 0;
  const ingredients = [];
  for (const [ref, g] of rec.i) {
    raw += g;
    if (ref === 'agua') { ingredients.push(`água ${g} g`); continue; }
    const food = typeof ref === 'number' ? taco.get(ref) : usda.get(ref);
    if (!food) throw new Error(`${rec.n}: ingrediente não encontrado: ${ref}`);
    ingredients.push(`${food.name} ${g} g`);
    // Fibra e sódio ausentes contam como 0 (são minoria nos ingredientes e não definem o prato).
    for (const k of KEYS) sum[k] += ((food.n[k] ?? 0) * g) / 100;
  }
  const final = raw * (rec.y ?? 1);
  const n = Object.fromEntries(KEYS.map((k) => [k, r((sum[k] / final) * 100, k === 'kcal' || k === 'sodium' ? 0 : 1)]));
  out.push({
    id: `rec-${slug(rec.n)}`,
    name: rec.n,
    group: rec.g,
    source: 'receita',
    recipe: ingredients.join(' · ') + (rec.y && rec.y !== 1 ? ` · rendimento ${Math.round(rec.y * 100)}%` : ''),
    servings: rec.p ? [{ name: rec.p[0], g: rec.p[1] }] : [],
    n,
  });
}
const ids = new Set(out.map((f) => f.id));
if (ids.size !== out.length) throw new Error('ids repetidos');
process.stdout.write(JSON.stringify(out));
