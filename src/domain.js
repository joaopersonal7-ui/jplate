// Regras de domínio puras: sem DOM e sem banco, para poderem ser testadas com node:test.
import { defaultServings } from './measures.js';

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

// Palavras que também trazem as variações do alimento (ex.: "ovo" traz omelete, clara e gema).
const RELATED = {
  ovo: ['ovos', 'omelete', 'clara', 'gema', 'crepioca'],
  ovos: ['ovo', 'omelete'],
  frango: ['galinha', 'galinhada', 'chicken'],
  carne: ['bovina', 'bife', 'patinho', 'alcatra', 'picanha', 'acem', 'contra'],
  leite: ['iogurte', 'leitelho'],
  queijo: ['mucarela', 'mozarela', 'ricota', 'cottage', 'parmesao', 'requeijao'],
  mucarela: ['mozarela'],
  mozarela: ['mucarela'],
  porco: ['suina', 'suino', 'lombo', 'bisteca', 'pernil', 'bacon'],
  peixe: ['tilapia', 'salmao', 'merluza', 'pescada', 'atum', 'sardinha', 'bacalhau'],
  aipim: ['mandioca'],
  macaxeira: ['mandioca'],
  mandioca: ['aipim', 'tapioca'],
  pao: ['torrada', 'paozinho'],
  refri: ['refrigerante'],
  whey: ['proteina'],
};

// Todas as palavras da busca precisam aparecer no nome (prefixo de palavra vale mais).
// Uma palavra também casa com seus parentes em RELATED, com pontuação menor.
export function searchFoods(foods, query, { favorites = [], recents = [], limit = 60 } = {}) {
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
      if (name.includes(t)) {
        if (words.some((w) => w.startsWith(t))) score += 10;
        continue;
      }
      const rel = RELATED[t]?.find((r) => words.some((w) => w.startsWith(r)));
      if (!rel) { ok = false; break; }
      score += 6;
    }
    if (!ok) continue;
    const first = [tokens[0], ...(RELATED[tokens[0]] ?? [])];
    if (words[0].startsWith(tokens[0])) score += 15;
    else if (first.some((r) => words[0].startsWith(r))) score += 12;
    if (fav.has(food.id)) score += 30;
    if (rec.has(food.id)) score += 20 - Math.min(rec.get(food.id), 19);
    if (food.source === 'user' || food.source === 'off') score += 5;
    // Base brasileira e pratos do dia a dia primeiro; a USDA completa a lista.
    if (food.source === 'taco' || food.source === 'receita') score += 8;
    score -= name.length / 20;
    out.push({ food, score });
  }
  out.sort((a, b) => b.score - a.score);
  return out.slice(0, limit).map((r) => r.food);
}

export const SOURCES = {
  taco: 'TACO',
  receita: 'Receita calculada',
  usda: 'USDA',
  tempo: 'TempoLife',
  off: 'Open Food Facts',
  user: 'Meu alimento',
};

export function sourceLabel(food) {
  return SOURCES[food.source] ?? 'Meu alimento';
}

// ---------- porções e cálculo ----------

// 'porção' existe para produtos cujo rótulo só traz a tabela por porção: lança-se em porções,
// sem converter para 100 g.
export function baseUnit(food) {
  return food.baseUnit === 'ml' ? 'ml' : food.baseUnit === 'porção' ? 'porção' : 'g';
}

// Texto curto de calorias para listas: por 100 g/ml ou por porção.
export function kcalLabel(food) {
  if (food.n.kcal === null || food.n.kcal === undefined) return 'kcal não informada';
  return baseUnit(food) === 'porção' ? `${fmt(food.n.kcal / 100, 0)} kcal/porção` : `${fmt(food.n.kcal, 0)} kcal/100${baseUnit(food)}`;
}

// Lista de unidades que o usuário pode escolher: a unidade base, as porções salvas e as medidas caseiras.
export function servingOptions(food, savedServings = []) {
  const u = baseUnit(food);
  const saved = savedServings.map((s) => ({ id: s.id, name: s.label, label: `${s.label} (${fmt(s.amount)} ${u})`, amount: s.amount }));
  const names = new Set(saved.map((s) => s.name));
  const defaults = defaultServings(food).filter((s) => !names.has(s.name))
    .map((s, i) => ({ id: `d${i}`, name: s.name, label: `${s.name} (${fmt(s.g)} ${u}, aprox.)`, amount: s.g }));
  return [{ id: u, label: u, amount: 1 }, ...saved, ...defaults];
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

// ---------- plano de dieta ----------

// Metas pelos "Parâmetros nutricionais adaptativos" (ConsultoriaJP):
// 1. repouso por Mifflin-St Jeor (a diferença entre sexos já está na equação, sem redução extra);
// 2. gasto total = repouso × fator da rotina inteira (trabalho, passos e treino juntos, sem somar treino de novo);
// 3. objetivo aplicado sobre o gasto total; 4. proteína em g/kg pelo perfil; gordura em % das kcal;
// carboidrato completa as calorias; fibra 14 g a cada 1000 kcal.
// São pontos de partida para adultos, não prescrição.
export const ACTIVITY = [
  { id: 'sedentary', label: 'Muito baixo: trabalho sentado, pouco deslocamento, sem treino', factor: 1.2 },
  { id: 'light', label: 'Levemente ativo: rotina sentada, caminhadas leves e/ou 1 a 3 treinos leves', factor: 1.325 },
  { id: 'moderate', label: 'Moderadamente ativo: mais movimento no dia e/ou 3 a 5 treinos', factor: 1.5 },
  { id: 'high', label: 'Muito ativo: trabalho físico e/ou treino frequente e exigente', factor: 1.7 },
  { id: 'athlete', label: 'Extremamente ativo: trabalho físico intenso e treino de alto volume', factor: 1.9 },
];

// kcal: ajuste sobre o gasto total. fatPct: gordura em % das kcal (faixa geral 20 a 35%).
export const OBJECTIVES = [
  { id: 'lose', label: 'Emagrecer', kcal: -0.15, fatPct: 0.25 },
  { id: 'maintain', label: 'Manter o peso', kcal: 0, fatPct: 0.3 },
  { id: 'gain', label: 'Ganhar massa', kcal: 0.075, fatPct: 0.28 },
  { id: 'perform', label: 'Desempenho no treino', kcal: 0, fatPct: 0.25 },
];

export const LEVELS = [
  { id: 'beginner', label: 'Iniciante (menos de 6 meses)' },
  { id: 'intermediate', label: 'Intermediário (6 meses a 2 anos)' },
  { id: 'advanced', label: 'Avançado (mais de 2 anos)' },
];

export const TRAIN_DAYS = [
  { id: '2-3', label: '2 a 3 vezes por semana' },
  { id: '4-6', label: '4 a 6 vezes por semana' },
];

export const TRAIN_TYPES = [
  { id: 'strength', label: 'Musculação / força' },
  { id: 'endurance', label: 'Corrida, ciclismo, natação (resistência)' },
  { id: 'mixed', label: 'Misto (força e aeróbico)' },
];

// Proteína em g/kg: [ponto de partida, mínimo, máximo] de cada perfil da tabela.
function proteinRange({ objective, trains, trainDays, trainType }) {
  if (trains === 'no') {
    return { lose: [1.4, 1.2, 1.6], maintain: [1.0, 0.8, 1.2], gain: [1.2, 1.0, 1.4], perform: [1.2, 1.0, 1.4] }[objective] ?? [1.0, 0.8, 1.2];
  }
  if (trainType === 'endurance') return [1.6, 1.2, 2.0];
  if (objective === 'lose') return trainDays === '4-6' ? [1.9, 1.6, 2.2] : [1.7, 1.4, 2.0];
  if (objective === 'gain') return [1.9, 1.6, 2.2];
  if (objective === 'perform') return [1.7, 1.4, 2.0];
  return [1.6, 1.2, 2.0];
}

export function calcTargets({ sex, age, height, weight, activity, objective, trains, level, trainDays, trainType }) {
  const a = Number(age), h = Number(height), w = Number(weight);
  if (!(a > 0 && h > 0 && w > 0)) return null;
  const act = ACTIVITY.find((x) => x.id === activity) ?? ACTIVITY[0];
  const obj = OBJECTIVES.find((x) => x.id === objective) ?? OBJECTIVES[1];
  const bmr = 10 * w + 6.25 * h - 5 * a + (sex === 'f' ? -161 : 5);
  const tdee = bmr * act.factor;
  // Segurança: a meta nunca fica abaixo do gasto em repouso.
  const kcal = Math.round(Math.max(bmr, tdee * (1 + obj.kcal)) / 10) * 10;
  const [base, min, max] = proteinRange({ objective: obj.id, trains, trainDays, trainType });
  const step = trains === 'no' ? 0 : { beginner: -0.1, advanced: 0.1 }[level] ?? 0;
  const gPerKg = Math.round(Math.min(max, Math.max(min, base + step)) * 10) / 10;
  // Com IMC 30 ou mais, a proteína usa peso ajustado: referência (IMC 25) + 40% do excesso.
  const bmi = w / (h / 100) ** 2;
  const ref = 25 * (h / 100) ** 2;
  const proteinWeight = bmi >= 30 ? ref + 0.4 * (w - ref) : w;
  const protein = Math.round(proteinWeight * gPerKg);
  const fat = Math.round((kcal * obj.fatPct) / 9);
  const carbs = Math.max(0, Math.round((kcal - protein * 4 - fat * 9) / 4));
  const fiber = Math.round((kcal / 1000) * 14);
  return {
    bmr: Math.round(bmr), tdee: Math.round(tdee), kcal, protein, fat, carbs, fiber,
    gPerKg, fatPct: obj.fatPct, adjusted: bmi >= 30 ? Math.round(proteinWeight) : null, floored: kcal <= Math.round(bmr / 10) * 10 && obj.kcal < 0,
  };
}

// Itens do plano viram nutrientes pelo mesmo cálculo do diário.
export function planItemNutrients(food, item) {
  return scaleNutrients(food.n, entryAmount(item.quantity, { amount: item.amount }));
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
