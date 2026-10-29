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

// Metas pelos "Parâmetros nutricionais consolidados" (ConsultoriaJP), que substituem a versão adaptativa:
// 1. repouso por Mifflin-St Jeor (a diferença entre sexos já está na equação, sem redução extra);
// 2. gasto total (GET) = repouso × fator da rotina inteira, escolhido de forma conservadora;
// 3. objetivo aplicado uma vez sobre o GET; 4. proteína em g/kg sobre o peso de referência;
// 5. gordura em % das kcal; 6. carboidrato com as calorias que sobram; fibra 14 g a cada 1000 kcal.
// Regra central: nenhum macro empurra o dia acima da meta de calorias; se não couber, pede revisão.
// São pontos de partida para adultos, não prescrição.
export const ACTIVITY = [
  { id: 'sedentary', label: 'Sedentário: trabalho sentado, pouco deslocamento', factor: 1.2 },
  { id: 'light', label: 'Baixo / misto: alterna sentado e tarefas físicas ocasionais', factor: 1.3 },
  { id: 'moderate', label: 'Moderado: em pé ou caminhando boa parte do turno', factor: 1.4 },
  { id: 'high', label: 'Ativo: esforço no trabalho frequente, além de treinar', factor: 1.525 },
  { id: 'athlete', label: 'Muito ativo: grande esforço físico todos os dias', factor: 1.65 },
];

// kcal: ajuste sobre o GET. fatPct: gordura padrão em % das kcal (faixa 20 a 30%).
export const OBJECTIVES = [
  { id: 'lose', label: 'Emagrecer', kcal: -0.15, fatPct: 0.25 },
  { id: 'maintain', label: 'Manter o peso', kcal: 0, fatPct: 0.3 },
  { id: 'gain', label: 'Ganhar massa', kcal: 0.065, fatPct: 0.25 },
  { id: 'perform', label: 'Desempenho no treino', kcal: 0, fatPct: 0.25 },
];

export const DEFICITS = [
  { id: '15', label: 'Déficit de 15% (padrão)' },
  { id: '20', label: 'Déficit de 20% (só com acompanhamento)' },
];

export const FAT_PCTS = [
  { id: '', label: 'Padrão do objetivo' },
  { id: '20', label: '20% das calorias' },
  { id: '25', label: '25% das calorias' },
  { id: '30', label: '30% das calorias' },
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

// Perguntas de triagem da rotina (o fator não sobe só porque o trabalho "exige esforço").
export const WORK_DAYS = [
  { id: '0', label: 'Nenhum' },
  { id: '1-2', label: '1 a 2 dias' },
  { id: '3-4', label: '3 a 4 dias' },
  { id: '5+', label: '5 dias ou mais' },
];
export const WORK_HOURS = [
  { id: '<2', label: 'Menos de 2 horas' },
  { id: '2-4', label: '2 a 4 horas' },
  { id: '4-6', label: '4 a 6 horas' },
  { id: '6+', label: 'Mais de 6 horas' },
];
export const WORK_EFFORT = [
  { id: 'occasional', label: 'Ocasional' },
  { id: 'frequent', label: 'Frequente' },
  { id: 'continuous', label: 'Contínuo' },
];

const LEVEL_IDS = ACTIVITY.map((a) => a.id);

// Sugestão conservadora de atividade pelas respostas. Na dúvida, fica no nível mais baixo.
// "Muito ativo" só com esforço contínuo 5+ dias, mais de 6 h por turno e treino 4+ vezes.
export function suggestActivity({ workDays, workHours, workEffort, steps, trains, trainDays }) {
  if (!workDays) return null;
  let lvl = 0;
  const days = { '0': 0, '1-2': 1, '3-4': 2, '5+': 3 }[workDays] ?? 0;
  const hours = { '<2': 0, '2-4': 1, '4-6': 2, '6+': 3 }[workHours] ?? 0;
  if (days >= 3 && hours >= 2 && workEffort !== 'occasional') lvl = workEffort === 'continuous' && hours >= 3 ? 3 : 2;
  else if (days >= 2 && hours >= 1) lvl = workEffort === 'occasional' ? 1 : 2;
  else if (days >= 1 && hours >= 1) lvl = 1;
  const st = Number(steps) || 0;
  if (st >= 10000) lvl = Math.max(lvl, 2);
  else if (st >= 7500) lvl = Math.max(lvl, 1);
  // Treino soma no máximo um nível e não leva sozinho ao "Ativo".
  if (trains === 'yes') lvl = Math.min(Math.max(lvl, lvl + (trainDays === '4-6' ? 1 : lvl === 0 ? 1 : 0)), Math.max(lvl, 2));
  if (lvl === 3 && days === 3 && hours === 3 && workEffort === 'continuous' && trains === 'yes' && trainDays === '4-6') lvl = 4;
  return LEVEL_IDS[lvl];
}

// Proteína em g/kg: [ponto de partida, mínimo, máximo] de cada situação.
function proteinRange({ objective, trains, trainDays, trainType }) {
  // Emagrecimento: faixa operacional pedida para o app, 1,8 a 2,2 g/kg, com ou sem musculação.
  if (objective === 'lose') {
    if (trains !== 'yes') return [1.8, 1.8, 2.2];
    return trainDays === '4-6' && trainType !== 'endurance' ? [2.2, 1.8, 2.2] : [2.0, 1.8, 2.2];
  }
  if (trains === 'no') return { maintain: [1.0, 0.8, 1.2], gain: [1.2, 1.0, 1.4], perform: [1.2, 1.0, 1.4] }[objective] ?? [1.0, 0.8, 1.2];
  if (trainType === 'endurance') return [1.6, 1.2, 2.0];
  if (objective === 'gain') return [1.9, 1.6, 2.2];
  if (objective === 'perform') return [1.7, 1.4, 2.0];
  return [1.6, 1.2, 2.0];
}

export function calcTargets(p) {
  const { sex, age, height, weight, activity, objective, trains, level, trainDays, trainType, deficit, fatPct, refWeight } = p;
  const a = Number(age), h = Number(height), w = Number(weight);
  if (!(a > 0 && h > 0 && w > 0)) return null;
  const review = [];
  let act = ACTIVITY.find((x) => x.id === activity) ?? ACTIVITY[0];
  // Acima de 1,60 só com a rotina confirmando: sem triagem que sustente, usa "Ativo".
  if (act.id === 'athlete' && suggestActivity(p) !== 'athlete') {
    act = ACTIVITY.find((x) => x.id === 'high');
    review.push('"Muito ativo" precisa ser confirmado pela rotina. Até lá o cálculo usa "Ativo" (1,525). Responda as perguntas do trabalho ou valide com um profissional.');
  }
  const obj = OBJECTIVES.find((x) => x.id === objective) ?? OBJECTIVES[1];
  const bmr = 10 * w + 6.25 * h - 5 * a + (sex === 'f' ? -161 : 5);
  const tdee = bmr * act.factor;
  const adj = obj.id === 'lose' ? -(Number(deficit) === 20 ? 0.2 : 0.15) : obj.kcal;
  // Déficit aplicado uma vez, sobre o GET (nunca sobre o repouso).
  const kcal = Math.round((tdee * (1 + adj)) / 5) * 5;
  if (kcal < bmr) review.push('A meta ficou abaixo do seu gasto em repouso. Use esse déficit só com acompanhamento profissional.');
  const [base, min, max] = proteinRange({ objective: obj.id, trains, trainDays, trainType });
  const step = trains === 'no' || obj.id === 'lose' ? 0 : { beginner: -0.1, advanced: 0.1 }[level] ?? 0;
  const gPerKg = Math.round(Math.min(max, Math.max(min, base + step)) * 10) / 10;
  // Peso de referência para a proteína: o informado pelo profissional; senão, com IMC 30 ou mais,
  // peso ajustado (IMC 25 + 40% do excesso) e aviso de revisão.
  const bmi = w / (h / 100) ** 2;
  const ref = 25 * (h / 100) ** 2;
  let proteinWeight = w;
  let adjusted = null;
  if (Number(refWeight) > 0) proteinWeight = Number(refWeight);
  else if (bmi >= 30) {
    proteinWeight = ref + 0.4 * (w - ref);
    adjusted = Math.round(proteinWeight);
    review.push(`IMC ${bmi.toFixed(1).replace('.', ',')}: a proteína usa um peso ajustado (${adjusted} kg). Defina o peso de referência com seu nutricionista.`);
  }
  const fp = Number(fatPct) >= 20 && Number(fatPct) <= 30 ? Number(fatPct) / 100 : obj.fatPct;
  const protein = Math.round(proteinWeight * gPerKg);
  const fat = Math.round((kcal * fp) / 9);
  const left = kcal - protein * 4 - fat * 9;
  const carbs = Math.max(0, Math.round(left / 4));
  const fiber = Math.round((kcal / 1000) * 14);
  // Regra central: se proteína e gordura não cabem na meta, não ultrapassa; pede revisão.
  const overflow = left < 0;
  if (overflow) review.push('Proteína e gordura juntas passam da meta de calorias. O cardápio automático fica parado até revisar esses valores com um profissional.');
  return {
    bmr: Math.round(bmr), tdee: Math.round(tdee), kcal, protein, fat, carbs, fiber,
    gPerKg, fatPct: fp, factor: act.factor, activityUsed: act.id, adjusted, overflow, review,
    check: protein * 4 + carbs * 4 + fat * 9,
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
