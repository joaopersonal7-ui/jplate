// Regras de domínio puras: sem DOM e sem banco, para poderem ser testadas com node:test.

export const MEALS = [
  { id: 'breakfast', label: 'Café da manhã' },
  { id: 'lunch', label: 'Almoço' },
  { id: 'dinner', label: 'Jantar' },
  { id: 'snack', label: 'Lanches' },
];

export const NUTRIENTS = [
  { key: 'kcal', label: 'Calorias', unit: 'kcal' },
  { key: 'carbs', label: 'Carboidratos', unit: 'g' },
  { key: 'protein', label: 'Proteínas', unit: 'g' },
  { key: 'fat', label: 'Gorduras', unit: 'g' },
  { key: 'fiber', label: 'Fibras', unit: 'g' },
  { key: 'sodium', label: 'Sódio', unit: 'mg' },
];

// ---------- datas (sempre no calendário local, nunca UTC) ----------

const pad = (n) => String(n).padStart(2, '0');

export function localDate(d = new Date()) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function parseLocalDate(s) {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(s, n) {
  const d = parseLocalDate(s);
  d.setDate(d.getDate() + n);
  return localDate(d);
}

export function formatDateLabel(s, today = localDate()) {
  if (s === today) return 'Hoje';
  if (s === addDays(today, -1)) return 'Ontem';
  if (s === addDays(today, 1)) return 'Amanhã';
  return parseLocalDate(s).toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short' });
}

// ---------- busca ----------

export function normalize(s) {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

// Todas as palavras da busca precisam aparecer no nome (prefixo de palavra vale mais).
export function searchFoods(foods, query, { favorites = [], recents = [], limit = 50 } = {}) {
  const tokens = normalize(query).split(' ').filter(Boolean);
  if (!tokens.length) return [];
  const fav = new Set(favorites);
  const rec = new Map(recents.map((id, i) => [id, i]));
  const out = [];
  for (const food of foods) {
    const name = food._norm ?? normalize(food.name + ' ' + (food.brand ?? ''));
    const words = name.split(' ');
    let score = 0;
    let ok = true;
    for (const t of tokens) {
      if (!name.includes(t)) { ok = false; break; }
      if (words.some((w) => w.startsWith(t))) score += 10;
    }
    if (!ok) continue;
    if (words[0].startsWith(tokens[0])) score += 15;
    if (fav.has(food.id)) score += 30;
    if (rec.has(food.id)) score += 20 - Math.min(rec.get(food.id), 19);
    if (food.source === 'user') score += 5;
    score -= name.length / 20;
    out.push({ food, score });
  }
  out.sort((a, b) => b.score - a.score);
  return out.slice(0, limit).map((r) => r.food);
}

// ---------- porções e cálculo ----------

export function baseUnit(food) {
  return food.baseUnit === 'ml' ? 'ml' : 'g';
}

// Lista de unidades que o usuário pode escolher: a unidade base e as porções salvas.
export function servingOptions(food, savedServings = []) {
  const u = baseUnit(food);
  return [{ id: u, label: u, amount: 1 }, ...savedServings.map((s) => ({ id: s.id, name: s.label, label: `${s.label} (${fmt(s.amount)} ${u})`, amount: s.amount }))];
}

export function entryAmount(quantity, serving) {
  const q = Number(quantity);
  if (!Number.isFinite(q) || q <= 0) return 0;
  return q * (serving ? serving.amount : 1);
}

// Nutrientes por 100 g/ml escalados para a quantidade efetiva. null continua null.
export function scaleNutrients(per100, amount) {
  const out = {};
  for (const { key } of NUTRIENTS) {
    const v = per100?.[key];
    out[key] = v === null || v === undefined ? null : round(v * amount / 100, 2);
  }
  return out;
}

// Soma os snapshots. `missing[key]` conta lançamentos sem aquele nutriente,
// para a interface avisar que o total está incompleto em vez de mostrar 0.
export function sumTotals(entries) {
  const totals = {};
  const missing = {};
  for (const { key } of NUTRIENTS) { totals[key] = 0; missing[key] = 0; }
  for (const e of entries) {
    for (const { key } of NUTRIENTS) {
      const v = e.nutrients?.[key];
      if (v === null || v === undefined) missing[key] += 1;
      else totals[key] += v;
    }
  }
  for (const { key } of NUTRIENTS) totals[key] = round(totals[key], 1);
  return { totals, missing };
}

export function groupByMeal(entries) {
  const groups = Object.fromEntries(MEALS.map((m) => [m.id, []]));
  for (const e of entries) (groups[e.mealType] ?? groups.snack).push(e);
  for (const list of Object.values(groups)) list.sort((a, b) => (a.time ?? '').localeCompare(b.time ?? '') || a.createdAt - b.createdAt);
  return groups;
}

// Meta vigente numa data: a mais recente com startsAt <= data.
export function goalFor(goals, date) {
  let best = null;
  for (const g of goals) if (g.startsAt <= date && (!best || g.startsAt > best.startsAt)) best = g;
  return best;
}

// Lançamento com snapshot: editar o alimento depois não muda o histórico.
export function buildEntry({ food, date, mealType, quantity, serving, time, id, createdAt }) {
  const amount = entryAmount(quantity, serving);
  return {
    id: id ?? uid(),
    date,
    time: time ?? null,
    mealType,
    foodId: food.id,
    label: food.brand ? `${food.name} (${food.brand})` : food.name,
    quantity: Number(quantity),
    servingId: serving?.id ?? baseUnit(food),
    servingLabel: serving ? serving.name ?? serving.label : baseUnit(food),
    amount: round(amount, 1),
    unit: baseUnit(food),
    nutrients: scaleNutrients(food.n, amount),
    createdAt: createdAt ?? Date.now(),
    updatedAt: Date.now(),
  };
}

export function buildQuickEntry({ date, mealType, kcal, label, carbs, protein, fat, id, createdAt }) {
  const opt = (v) => (v === '' || v === null || v === undefined ? null : Number(v));
  return {
    id: id ?? uid(),
    date,
    time: null,
    mealType,
    foodId: null,
    label: label?.trim() || 'Lançamento rápido',
    quantity: 1,
    servingId: null,
    servingLabel: '',
    amount: 0,
    unit: '',
    nutrients: { kcal: Number(kcal) || 0, carbs: opt(carbs), protein: opt(protein), fat: opt(fat), fiber: null, sodium: null },
    createdAt: createdAt ?? Date.now(),
    updatedAt: Date.now(),
  };
}

// ---------- peso ----------

// Média móvel simples dos últimos `window` registros (suaviza oscilação diária de água).
export function weightTrend(weights, window = 7) {
  const sorted = [...weights].sort((a, b) => a.date.localeCompare(b.date));
  return sorted.map((w, i) => {
    const slice = sorted.slice(Math.max(0, i - window + 1), i + 1);
    return { ...w, trend: round(slice.reduce((s, x) => s + x.kg, 0) / slice.length, 2) };
  });
}

// ---------- backup ----------

export const BACKUP_VERSION = 1;

export function validateBackup(data) {
  if (!data || data.app !== 'nutri-pessoal' || typeof data.version !== 'number') return 'Arquivo não é um backup deste app.';
  if (data.version > BACKUP_VERSION) return 'Backup de uma versão mais nova do app.';
  for (const k of ['foods', 'entries', 'weights', 'goals']) if (!Array.isArray(data[k])) return `Backup sem a lista "${k}".`;
  return null;
}

// ---------- utilitários ----------

export function round(v, digits = 0) {
  const f = 10 ** digits;
  return Math.round(v * f) / f;
}

export function fmt(v, digits = 1) {
  if (v === null || v === undefined) return '–';
  return Number(v).toLocaleString('pt-BR', { maximumFractionDigits: digits });
}

export function uid() {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}
