// Gera um cardápio do dia a partir das metas (kcal, proteína, carboidrato, gordura e fibra)
// e dos horários de acordar e dormir. Puro: recebe os alimentos por id, sem DOM nem banco.
//
// Cada refeição vem de um modelo com alimentos em "papéis":
//   p = fonte de proteína, c = carboidrato, f = gordura, v = fruta/legume (fibra), x = fixo.
// As quantidades de p, c e f são multiplicadas por três fatores (um por papel) escolhidos para
// chegar perto das metas do dia; v cresce se faltar fibra. No fim tudo é arredondado para
// medidas práticas (step, em g).

const WHEY = 'usda-a2bd0l';
const COTTAGE = 'usda-11zpsun';
const PASTA_AMENDOIM = 'usda-1082o20';
const LEITE_D = 'usda-1nnva3f';
const GRANOLA = 'tl-nkd5n7';
const TILAPIA = 'usda-1w3zg7r';

// [id, papel, gramas base, passo de arredondamento]
const T = {
  breakfast: [
    [['rec-ovo-mexido-sem-oleo', 'p', 90, 45], ['taco-53', 'c', 50, 25], ['taco-226', 'v', 150, 50], ['rec-cafe-com-leite-sem-acucar', 'x', 150, 50]],
    [['rec-crepioca-ovo-e-goma-de-tapioca', 'p', 144, 72], ['taco-449', 'p', 100, 50], ['taco-182', 'c', 70, 35], ['taco-239', 'v', 100, 50]],
    [['taco-449', 'p', 170, 85], [WHEY, 'p', 15, 15], ['taco-7', 'c', 30, 10], ['taco-182', 'c', 70, 35], ['taco-226', 'v', 120, 40]],
    [['taco-533', 'c', 100, 25], ['taco-488', 'p', 100, 50], ['taco-461', 'p', 30, 15], ['taco-225', 'v', 150, 50], ['rec-cafe-com-leite-sem-acucar', 'x', 150, 50]],
  ],
  main: [
    [['taco-3', 'c', 120, 15], ['taco-561', 'c', 100, 20], ['taco-410', 'p', 120, 10], ['taco-546', 'v', 120, 20], ['rec-salada-de-alface-e-tomate-com-azeite', 'v', 80, 20], ['taco-260', 'f', 5, 2]],
    [['taco-1', 'c', 120, 15], ['taco-567', 'c', 100, 20], ['taco-377', 'p', 110, 10], ['taco-100', 'v', 100, 20], ['taco-161', 'v', 80, 20], ['taco-260', 'f', 5, 2]],
    [['taco-88', 'c', 150, 25], ['taco-561', 'c', 80, 20], [TILAPIA, 'p', 130, 10], ['taco-546', 'v', 150, 25], ['taco-260', 'f', 5, 2]],
    [['taco-129', 'c', 120, 20], ['taco-408', 'p', 120, 10], ['taco-116', 'v', 60, 20], ['taco-161', 'v', 80, 20], ['taco-567', 'c', 80, 20], ['taco-260', 'f', 4, 2]],
  ],
  snack: [
    [['taco-182', 'c', 70, 35], ['taco-52', 'c', 50, 25], [PASTA_AMENDOIM, 'f', 15, 5]],
    [['taco-449', 'p', 170, 85], [GRANOLA, 'c', 25, 5], ['taco-222', 'v', 130, 65]],
    [[WHEY, 'p', 30, 15], [LEITE_D, 'x', 200, 50], ['taco-182', 'c', 70, 35]],
    [['rec-tapioca-simples-goma', 'c', 63, 21], ['taco-461', 'p', 40, 10], ['taco-214', 'v', 130, 65]],
    [['taco-222', 'v', 130, 65], ['taco-589', 'f', 10, 5], ['taco-449', 'p', 170, 85]],
  ],
  supper: [
    [['taco-449', 'p', 170, 85], ['taco-7', 'c', 15, 5]],
    [[COTTAGE, 'p', 100, 25], ['taco-589', 'f', 8, 4]],
    [['rec-omelete-simples-2-ovos', 'p', 93, 46], ['taco-161', 'v', 80, 20]],
  ],
};

export const PLAN_FOOD_IDS = [...new Set(Object.values(T).flat(2).filter((x) => typeof x === 'string' && /-/.test(x)))];

const KEYS = ['kcal', 'carbs', 'protein', 'fat', 'fiber'];

const toMin = (hhmm) => {
  const [h, m] = String(hhmm || '').split(':').map(Number);
  return Number.isFinite(h) ? h * 60 + (m || 0) : null;
};
const toHHMM = (min) => {
  const m = ((Math.round(min / 15) * 15) % 1440 + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
};

// Refeições do dia conforme o tempo acordado. `diary` diz em que refeição do diário cada uma cai.
export function mealSlots(wake = '07:00', sleep = '23:00') {
  const w = toMin(wake) ?? 420;
  let s = toMin(sleep) ?? 1380;
  if (s <= w) s += 1440;
  const awake = s - w;
  const breakfast = w + 30;
  const dinner = s - 150;
  const lunch = breakfast + Math.max(180, Math.round((dinner - breakfast) * 0.42));
  const slots = [{ id: 'breakfast', label: 'Café da manhã', time: breakfast, diary: 'breakfast', kind: 'breakfast' }];
  if (lunch - breakfast >= 270) slots.push({ id: 'snack1', label: 'Lanche da manhã', time: (breakfast + lunch) / 2, diary: 'snack', kind: 'snack' });
  slots.push({ id: 'lunch', label: 'Almoço', time: lunch, diary: 'lunch', kind: 'main' });
  slots.push({ id: 'snack2', label: 'Lanche da tarde', time: (lunch + dinner) / 2, diary: 'snack', kind: 'snack' });
  slots.push({ id: 'dinner', label: 'Jantar', time: dinner, diary: 'dinner', kind: 'main' });
  if (awake >= 930) slots.push({ id: 'supper', label: 'Ceia', time: s - 60, diary: 'snack', kind: 'supper' });
  return slots.map((x) => ({ ...x, time: toHHMM(x.time) }));
}

function add(a, b, k = 1) {
  for (const key of KEYS) a[key] += (b[key] ?? 0) * k;
}
const zero = () => Object.fromEntries(KEYS.map((k) => [k, 0]));
const per = (food, g) => Object.fromEntries(KEYS.map((k) => [k, ((food.n[k] ?? 0) * g) / 100]));

// Mínimos quadrados relativos em P, C, G e kcal para os três fatores, com limites.
function solve(groups, fixed, target) {
  const keys = ['protein', 'carbs', 'fat', 'kcal'];
  const w = { protein: 1.5, carbs: 1, fat: 1, kcal: 2 };
  let x = [1, 1, 1];
  const err = (x) => keys.reduce((s, k) => {
    const t = target[k] || 1;
    const v = fixed[k] + groups.reduce((a, g, i) => a + g[k] * x[i], 0);
    return s + w[k] * ((v - t) / t) ** 2;
  }, 0);
  let step = 0.5;
  // Busca por coordenadas: simples e estável para três variáveis.
  for (let it = 0; it < 400 && step > 1e-4; it++) {
    let improved = false;
    for (let i = 0; i < 3; i++) {
      if (!groups[i].kcal) continue;
      for (const d of [step, -step]) {
        const y = [...x];
        y[i] = Math.min(4, Math.max(0.25, y[i] + d));
        if (err(y) < err(x)) { x = y; improved = true; }
      }
    }
    if (!improved) step /= 2;
  }
  return x;
}

// Gera o cardápio. `seed` escolhe outra combinação de modelos ("gerar outra opção").
export function generatePlan({ targets, wake, sleep, seed = 0 }, foodsById) {
  const slots = mealSlots(wake, sleep);
  let snackN = 0;
  let mainN = 0;
  const items = [];
  for (const [si, slot] of slots.entries()) {
    const list = T[slot.kind];
    const offset = slot.kind === 'snack' ? snackN++ * 2 : slot.kind === 'main' ? mainN++ : 0;
    const tpl = list[(seed + si + offset) % list.length];
    for (const [foodId, role, g, step] of tpl) {
      const food = foodsById.get(foodId);
      if (food) items.push({ slot: slot.id, food, role, base: g, step });
    }
  }

  let vMul = 1;
  let x = [1, 1, 1];
  const totalsFor = (x, vMul) => {
    const t = zero();
    for (const it of items) add(t, per(it.food, it.base * mult(it, x, vMul)));
    return t;
  };
  const mult = (it, x, vMul) => (it.role === 'p' ? x[0] : it.role === 'c' ? x[1] : it.role === 'f' ? x[2] : it.role === 'v' ? vMul : 1);
  for (let round = 0; round < 8; round++) {
    const fixed = zero();
    const groups = [zero(), zero(), zero()];
    for (const it of items) {
      const nut = per(it.food, it.base);
      const gi = { p: 0, c: 1, f: 2 }[it.role];
      if (gi === undefined) add(fixed, nut, it.role === 'v' ? vMul : 1);
      else add(groups[gi], nut);
    }
    x = solve(groups, fixed, targets);
    const fiber = totalsFor(x, vMul).fiber;
    if (!targets.fiber || fiber >= targets.fiber * 0.92 || vMul >= 2.5) break;
    vMul = Math.min(2.5, vMul + 0.3);
  }

  const out = items.map((it) => {
    const g = Math.max(it.step, Math.round((it.base * mult(it, x, vMul)) / it.step) * it.step);
    return { slot: it.slot, foodId: it.food.id, grams: g };
  });
  // Mesmo alimento repetido na mesma refeição vira um item só.
  const merged = [];
  for (const it of out) {
    const same = merged.find((m) => m.slot === it.slot && m.foodId === it.foodId);
    if (same) same.grams += it.grams;
    else merged.push({ ...it });
  }
  const totals = zero();
  for (const it of merged) add(totals, per(foodsById.get(it.foodId), it.grams));
  for (const k of KEYS) totals[k] = Math.round(totals[k] * 10) / 10;
  return { slots, items: merged, totals };
}

// Texto simples do plano, para baixar ou compartilhar.
export function planToText({ name, targets, slots, rows, totals, date }) {
  const f = (v) => Math.round(v).toLocaleString('pt-BR');
  const lines = [`PLANO ALIMENTAR${name ? ` - ${name}` : ''}`, `Gerado pelo JPlate em ${date}`, ''];
  if (targets?.kcal) lines.push(`Metas do dia: ${f(targets.kcal)} kcal · Proteína ${f(targets.protein)} g · Carboidrato ${f(targets.carbs)} g · Gordura ${f(targets.fat)} g · Fibra ${f(targets.fiber ?? 0)} g`, '');
  for (const s of slots) {
    const list = rows.filter((r) => r.slot === s.id);
    if (!list.length) continue;
    const t = list.reduce((a, r) => { add(a, r.n); return a; }, zero());
    lines.push(`${s.time ? `${s.time} - ` : ''}${s.label.toUpperCase()} (${f(t.kcal)} kcal · P ${f(t.protein)} g · C ${f(t.carbs)} g · G ${f(t.fat)} g)`);
    for (const r of list) lines.push(`  - ${r.name}: ${r.amount}`);
    lines.push('');
  }
  lines.push(`TOTAL DO DIA: ${f(totals.kcal)} kcal · Proteína ${f(totals.protein)} g · Carboidrato ${f(totals.carbs)} g · Gordura ${f(totals.fat)} g · Fibra ${f(totals.fiber ?? 0)} g`);
  lines.push('', 'Valores aproximados (TACO, USDA e receitas calculadas). Não substitui orientação de nutricionista.');
  return lines.join('\n');
}
