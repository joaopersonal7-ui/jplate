import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  addDays, localDate, normalize, searchFoods, entryAmount, scaleNutrients, sumTotals, goalFor,
  buildEntry, buildQuickEntry, groupByMeal, weightTrend, validateBackup, servingOptions,
} from '../src/domain.js';

const taco = JSON.parse(readFileSync(new URL('../data/taco.json', import.meta.url))).map((f) => ({ ...f, source: 'taco' }));
const banana = taco.find((f) => f.name === 'Banana, prata, crua');

test('datas usam o calendário local e atravessam meses', () => {
  assert.equal(localDate(new Date(2026, 0, 5, 23, 30)), '2026-01-05');
  assert.equal(addDays('2026-02-28', 1), '2026-03-01');
  assert.equal(addDays('2026-01-01', -1), '2025-12-31');
});

test('normalize ignora acentos e caixa', () => {
  assert.equal(normalize('Açúcar, Cristal'), 'acucar cristal');
});

test('busca encontra sem acento e prioriza favoritos', () => {
  const r = searchFoods(taco, 'feijao');
  assert.ok(r.length > 0 && r.every((f) => normalize(f.name).includes('feijao')));
  const r2 = searchFoods(taco, 'banana prata');
  assert.equal(r2[0].name, 'Banana, prata, crua');
  const fav = searchFoods(taco, 'banana', { favorites: ['taco-' + banana.id.split('-')[1]] });
  assert.equal(fav[0].id, banana.id);
  assert.deepEqual(searchFoods(taco, '   '), []);
});

test('quantidade efetiva com e sem porção', () => {
  assert.equal(entryAmount('150', null), 150);
  assert.equal(entryAmount(2, { amount: 120 }), 240);
  assert.equal(entryAmount(-1, null), 0);
  assert.equal(entryAmount('abc', null), 0);
});

test('nutrientes escalam por 100 g e preservam desconhecidos', () => {
  const n = scaleNutrients({ kcal: 98.25, carbs: 25.96, protein: 1.27, fat: 0.07, fiber: null, sodium: 0 }, 120);
  assert.equal(n.kcal, 117.9);
  assert.equal(n.fiber, null);
  assert.equal(n.sodium, 0);
});

test('totais somam e contam nutrientes ausentes', () => {
  const a = buildEntry({ food: banana, date: '2026-10-28', mealType: 'snack', quantity: 100 });
  const b = buildQuickEntry({ date: '2026-10-28', mealType: 'lunch', kcal: 700 });
  const { totals, missing } = sumTotals([a, b]);
  assert.equal(totals.kcal, Math.round((banana.n.kcal + 700) * 10) / 10);
  assert.equal(missing.carbs, 1);
  assert.equal(missing.kcal, 0);
});

test('snapshot do lançamento não muda quando o alimento muda', () => {
  const food = { id: 'u1', name: 'Pão', source: 'user', baseUnit: 'g', n: { kcal: 300, carbs: 50, protein: 10, fat: 5, fiber: null, sodium: null } };
  const e = buildEntry({ food, date: '2026-10-28', mealType: 'breakfast', quantity: 2, serving: { id: 's', label: 'fatia', amount: 25 } });
  food.n.kcal = 999;
  assert.equal(e.amount, 50);
  assert.equal(e.nutrients.kcal, 150);
});

test('alimentos em ml usam ml como unidade', () => {
  const suco = { id: 'u2', name: 'Suco', baseUnit: 'ml', n: { kcal: 45 } };
  assert.equal(servingOptions(suco)[0].id, 'ml');
  assert.equal(buildEntry({ food: suco, date: '2026-10-28', mealType: 'lunch', quantity: 300 }).unit, 'ml');
});

test('meta vigente é a mais recente até a data', () => {
  const goals = [{ startsAt: '2026-01-01', kcal: 2000 }, { startsAt: '2026-06-01', kcal: 1800 }];
  assert.equal(goalFor(goals, '2026-05-31').kcal, 2000);
  assert.equal(goalFor(goals, '2026-06-01').kcal, 1800);
  assert.equal(goalFor(goals, '2025-12-31'), null);
});

test('lançamentos são agrupados por refeição', () => {
  const g = groupByMeal([{ mealType: 'lunch', createdAt: 2 }, { mealType: 'lunch', createdAt: 1 }, { mealType: 'xyz', createdAt: 3 }]);
  assert.equal(g.lunch.length, 2);
  assert.equal(g.lunch[0].createdAt, 1);
  assert.equal(g.snack.length, 1);
});

test('tendência de peso é média móvel ordenada por data', () => {
  const t = weightTrend([{ date: '2026-01-03', kg: 80 }, { date: '2026-01-01', kg: 82 }, { date: '2026-01-02', kg: 81 }], 2);
  assert.deepEqual(t.map((x) => x.trend), [82, 81.5, 80.5]);
});

test('backup inválido é recusado', () => {
  assert.ok(validateBackup({}));
  assert.ok(validateBackup({ app: 'nutri-pessoal', version: 99, foods: [], entries: [], weights: [], goals: [] }));
  assert.equal(validateBackup({ app: 'nutri-pessoal', version: 1, foods: [], entries: [], weights: [], goals: [] }), null);
});

test('base TACO não tem linhas sem análise e kcal é numérico', () => {
  assert.ok(taco.length > 550);
  assert.ok(taco.every((f) => typeof f.n.kcal === 'number'));
  assert.ok(!taco.some((f) => f.name === 'Leite, de vaca, integral'));
});

// ---------- base ampliada, medidas, plano e produtos online ----------

import { calcTargets, planItemNutrients, sourceLabel, suggestActivity } from '../src/domain.js';
import { defaultServings } from '../src/measures.js';
import { fromOff, productToFood } from '../src/products.js';

const load = (f) => JSON.parse(readFileSync(new URL(`../data/${f}`, import.meta.url)));
const usda = load('usda.json');
const receitas = load('receitas.json');
const all = [...receitas, ...taco, ...usda].map((f) => ({ ...f, _norm: normalize(f.name) }));

test('base ampliada: ids únicos, kcal numérico e fonte em todo item', () => {
  assert.ok(usda.length > 5000);
  assert.ok(receitas.length > 100);
  const ids = new Set(all.map((f) => f.id));
  assert.equal(ids.size, all.length);
  for (const f of all) {
    assert.equal(typeof f.n.kcal, 'number', f.name);
    assert.ok(['taco', 'usda', 'tempo', 'receita'].includes(f.source), f.name);
  }
  assert.ok(receitas.every((r) => r.recipe && r.servings.length));
});

test('nomes não se repetem entre TACO e USDA', () => {
  const tacoNames = new Set(taco.map((f) => normalize(f.name)));
  assert.ok(!usda.some((f) => tacoNames.has(normalize(f.name))));
});

test('busca por "ovo" traz as variações separadas', () => {
  const names = searchFoods(all, 'ovo', { limit: 40 }).map((f) => f.name);
  for (const want of [/clara/i, /gema/i, /frito/i, /cozid/i, /omelete/i, /mexido/i]) {
    assert.ok(names.some((n) => want.test(n)), `faltou ${want}`);
  }
});

test('medidas caseiras aparecem como porções aproximadas', () => {
  const arroz = all.find((f) => f.name === 'Arroz, tipo 1, cozido');
  assert.ok(defaultServings(arroz).some((s) => s.name === 'colher de servir'));
  const opts = servingOptions(arroz);
  assert.match(opts[1].label, /aprox/);
  const pf = all.find((f) => f.source === 'receita');
  assert.equal(defaultServings(pf)[0].g, pf.servings[0].g);
  assert.deepEqual(defaultServings({ name: 'Arroz cozido', source: 'user', n: {} }), []);
});

test('metas pelo objetivo seguem Mifflin-St Jeor e fecham as calorias', () => {
  const t = calcTargets({ sex: 'm', age: 30, height: 180, weight: 80, activity: 'moderate', objective: 'maintain' });
  assert.equal(t.bmr, 1780);
  assert.equal(t.tdee, 2492);
  assert.equal(t.protein, 128);
  assert.equal(t.fat, Math.round((t.kcal * 0.3) / 9));
  assert.ok(Math.abs(t.check - t.kcal) <= 4);
  assert.equal(t.fiber, Math.round((t.kcal / 1000) * 14));
  assert.equal(calcTargets({ age: '', height: 170, weight: 70 }), null);
});

test('parâmetros consolidados: exemplos do documento', () => {
  // Mulher, 30 anos, 90 kg, 170 cm, sedentária: repouso ~1.652, GET ~1.982, -15% ~1.685, -20% ~1.586.
  const base = { sex: 'f', age: 30, height: 170, weight: 90, activity: 'sedentary', objective: 'lose' };
  const t = calcTargets(base);
  assert.equal(t.bmr, 1652);
  assert.equal(t.tdee, 1982);
  assert.equal(t.kcal, 1685);
  assert.equal(calcTargets({ ...base, deficit: '20' }).kcal, 1585);
  // Distribuição: 1.700 kcal, 130 g de proteína e 50 g de gordura deixam 182,5 g de carboidrato.
  assert.equal((1700 - 130 * 4 - 50 * 9) / 4, 182.5);
});

test('parâmetros consolidados: proteína, gordura, atividade e revisão', () => {
  const base = { sex: 'f', age: 30, height: 165, weight: 65, activity: 'light', objective: 'lose' };
  // Emagrecimento: 1,8 a 2,2 g/kg, com ou sem treino.
  assert.equal(calcTargets({ ...base, trains: 'no' }).gPerKg, 1.8);
  assert.equal(calcTargets({ ...base, trains: 'yes', trainDays: '2-3' }).gPerKg, 2.0);
  assert.equal(calcTargets({ ...base, trains: 'yes', trainDays: '4-6', trainType: 'strength' }).gPerKg, 2.2);
  assert.equal(calcTargets({ ...base, objective: 'gain', trains: 'yes', trainDays: '4-6' }).gPerKg, 1.9);
  // Ganho de massa: superávit conservador entre 5 e 8%.
  const g = calcTargets({ ...base, objective: 'gain' });
  assert.ok(g.kcal / g.tdee > 1.05 && g.kcal / g.tdee < 1.08);
  // Gordura configurável entre 20 e 30%.
  assert.equal(calcTargets({ ...base, fatPct: '20' }).fat, Math.round((calcTargets(base).kcal * 0.2) / 9));
  // Mesmo corpo e rotina: só a constante da equação muda entre sexos.
  assert.equal(calcTargets({ ...base, sex: 'm' }).bmr - calcTargets(base).bmr, 166);
  // IMC >= 30 sem peso de referência: peso ajustado e aviso de revisão; com referência, usa ela.
  const big = calcTargets({ sex: 'm', age: 40, height: 175, weight: 120, activity: 'sedentary', objective: 'lose', trains: 'no' });
  assert.ok(big.adjusted > 76 && big.adjusted < 120 && big.review.length === 1);
  assert.equal(big.protein, Math.round(big.adjusted * 1.8));
  const withRef = calcTargets({ sex: 'm', age: 40, height: 175, weight: 120, activity: 'sedentary', objective: 'lose', trains: 'no', refWeight: 85 });
  assert.equal(withRef.protein, Math.round(85 * 1.8));
  assert.equal(withRef.review.length, 0);
  // "Muito ativo" sem triagem que sustente vira "Ativo" (1,525) e pede revisão.
  const ath = calcTargets({ ...base, activity: 'athlete' });
  assert.equal(ath.factor, 1.525);
  assert.equal(ath.review.length, 1);
  // Regra central: proteína + gordura acima da meta não ultrapassa; sinaliza.
  const tiny = calcTargets({ sex: 'f', age: 60, height: 150, weight: 45, activity: 'sedentary', objective: 'lose', refWeight: 200, fatPct: '30' });
  assert.ok(tiny.overflow && tiny.carbs === 0);
  // Meta abaixo do repouso: não trava, mas pede acompanhamento.
  const t = calcTargets({ sex: 'f', age: 30, height: 170, weight: 90, activity: 'sedentary', objective: 'lose', deficit: '20', refWeight: 70 });
  assert.ok(t.kcal < t.bmr && t.review.some((r) => /repouso/.test(r)));
});

test('triagem da rotina sugere atividade de forma conservadora', () => {
  assert.equal(suggestActivity({ workDays: '0' }), 'sedentary');
  assert.equal(suggestActivity({ workDays: '3-4', workHours: '2-4', workEffort: 'occasional' }), 'light');
  assert.equal(suggestActivity({ workDays: '0', trains: 'yes', trainDays: '4-6' }), 'light');
  assert.equal(suggestActivity({ workDays: '5+', workHours: '6+', workEffort: 'continuous' }), 'high');
  assert.equal(suggestActivity({ workDays: '5+', workHours: '6+', workEffort: 'continuous', trains: 'yes', trainDays: '4-6' }), 'athlete');
  assert.equal(suggestActivity({ workDays: '0', steps: 11000 }), 'moderate');
  assert.equal(suggestActivity({}), null);
});

test('item do plano calcula nutrientes pela porção', () => {
  const n = planItemNutrients(banana, { quantity: 2, amount: 70 });
  assert.equal(n.kcal, Math.round(banana.n.kcal * 1.4 * 100) / 100);
});

test('produto do Open Food Facts vira alimento com sódio em mg e fonte, sem derivar valores', () => {
  const f = productToFood(fromOff({
    code: '7890000000001', product_name: 'Biscoito X', brands: 'Marca A, Marca B', quantity: '200 g', serving_quantity: '30',
    nutriments: { 'energy-kcal_100g': 450, carbohydrates_100g: 70, proteins_100g: 7, fat_100g: 16, fiber_100g: 2, sodium_100g: 0.4 },
  }));
  assert.equal(f.id, 'off-7890000000001');
  assert.equal(f.brand, 'Marca A');
  assert.equal(f.n.sodium, 400);
  assert.equal(f.baseUnit, 'g');
  assert.equal(sourceLabel(f), 'Open Food Facts');
  assert.deepEqual(f.servings, [{ name: 'porção do rótulo', g: 30 }]);
  // Só energia em kJ: a kcal fica sem dado em vez de ser convertida por conta própria.
  const suco = productToFood(fromOff({ code: '1', product_name: 'Suco', quantity: '1 L', nutriments: { 'energy-kj_100g': 200 } }));
  assert.equal(suco.baseUnit, 'ml');
  assert.equal(suco.n.kcal, null);
  assert.equal(productToFood(fromOff({ code: '2', product_name: 'Sem dados', nutriments: {} })), null);
});

import { mealSlots, generatePlan, planToText, PLAN_FOOD_IDS } from '../src/planner.js';

const allFoods = [
  ...taco,
  ...JSON.parse(readFileSync(new URL('../data/receitas.json', import.meta.url))),
  ...JSON.parse(readFileSync(new URL('../data/usda.json', import.meta.url))),
];
const byId = new Map(allFoods.map((f) => [f.id, f]));

test('refeições seguem os horários de acordar e dormir', () => {
  const s = mealSlots('06:00', '22:30');
  assert.equal(s[0].id, 'breakfast');
  assert.equal(s[0].time, '06:30');
  assert.equal(s.at(-1).id, 'supper');
  assert.equal(s.find((x) => x.id === 'dinner').time, '20:00');
  const short = mealSlots('10:00', '23:00');
  assert.ok(!short.some((x) => x.id === 'supper'));
  assert.ok(short.every((x) => /^\d\d:\d\d$/.test(x.time)));
});

test('quem não treina recebe menos proteína por kg', () => {
  const base = { sex: 'm', age: 30, height: 180, weight: 80, activity: 'light', objective: 'maintain' };
  // (no emagrecimento a faixa é 1,8 a 2,2 g/kg para todos)
  assert.ok(calcTargets({ ...base, trains: 'no' }).protein < calcTargets({ ...base, trains: 'yes' }).protein);
});

test('cardápio gerado usa só alimentos da base e bate as metas', () => {
  for (const id of PLAN_FOOD_IDS) assert.ok(byId.has(id), `falta ${id}`);
  const profiles = [
    { sex: 'm', age: 30, height: 180, weight: 80, activity: 'moderate', objective: 'maintain', trains: 'yes', level: 'intermediate' },
    { sex: 'f', age: 28, height: 163, weight: 62, activity: 'light', objective: 'lose', trains: 'no' },
    { sex: 'm', age: 22, height: 175, weight: 70, activity: 'high', objective: 'gain', trains: 'yes', level: 'beginner' },
  ];
  for (const p of profiles) {
    const targets = calcTargets(p);
    for (const seed of [0, 1, 2]) {
      const plan = generatePlan({ targets, wake: '06:30', sleep: '23:00', seed }, byId);
      assert.ok(plan.items.length >= 10);
      for (const k of ['kcal', 'protein', 'carbs', 'fat']) {
        const err = Math.abs(plan.totals[k] - targets[k]) / targets[k];
        assert.ok(err < 0.12, `${k} ${plan.totals[k]} vs ${targets[k]}`);
      }
      assert.ok(plan.totals.fiber >= targets.fiber * 0.85);
    }
  }
});

test('texto exportado traz metas, horários e total', () => {
  const txt = planToText({
    name: 'Ana', date: '29/10/2026', targets: { kcal: 2000, protein: 120, carbs: 230, fat: 60, fiber: 28 },
    slots: [{ id: 'breakfast', label: 'Café da manhã', time: '07:00' }],
    rows: [{ slot: 'breakfast', name: 'Ovo cozido', amount: '2 unidades', n: { kcal: 146, protein: 13, carbs: 1, fat: 10, fiber: 0 } }],
    totals: { kcal: 146, protein: 13, carbs: 1, fat: 10, fiber: 0 },
  });
  assert.match(txt, /PLANO ALIMENTAR - Ana/);
  assert.match(txt, /07:00 - CAFÉ DA MANHÃ/);
  assert.match(txt, /Ovo cozido: 2 unidades/);
  assert.match(txt, /TOTAL DO DIA: 146 kcal/);
});

test('número de refeições escolhido define o cardápio', () => {
  const targets = calcTargets({ sex: 'f', age: 35, height: 165, weight: 70, activity: 'light', objective: 'lose', trains: 'yes', level: 'beginner' });
  for (const [count, n] of [['3', 3], ['4', 4], ['5', 5], ['6', 6]]) {
    assert.equal(mealSlots('07:00', '23:00', count).length, n);
    for (const seed of [0, 1, 2]) {
      const plan = generatePlan({ targets, wake: '07:00', sleep: '23:00', meals: count, seed }, byId);
      assert.equal(new Set(plan.items.map((i) => i.slot)).size, n);
      for (const k of ['kcal', 'protein', 'carbs', 'fat']) {
        const err = Math.abs(plan.totals[k] - targets[k]) / targets[k];
        assert.ok(err < 0.12, `${count} refeições, ${k} ${plan.totals[k]} vs ${targets[k]}`);
      }
    }
  }
  assert.deepEqual(mealSlots('06:00', '22:00', '3').map((s) => s.time), ['06:30', '12:45', '19:00']);
});

import { avoidTerms, parseTerms, matchesAny } from '../src/planner.js';

test('pré e pós-treino entram pelo horário do treino', () => {
  const noon = mealSlots('06:00', '22:30', '4', '12:00');
  assert.equal(noon.length, 4);
  assert.deepEqual(noon.map((s) => s.time), ['06:30', '11:00', '13:15', '20:00']);
  assert.equal(noon[1].label, 'Pré-treino');
  assert.match(noon[2].label, /Almoço \(pós-treino\)/);
  // Treino ao acordar: pré leve ao acordar e o café vira pós-treino.
  const early = mealSlots('06:00', '22:30', '5', '06:00');
  assert.equal(early[0].label, 'Pré-treino');
  assert.match(early[1].label, /pós-treino/);
  assert.ok(!mealSlots('06:00', '22:30', '5').some((s) => /treino/i.test(s.label)));
});

test('intolerâncias tiram os alimentos do cardápio, inclusive em receitas', () => {
  assert.ok(matchesAny({ name: 'Crepioca', recipe: 'Ovo, de galinha 50 g' }, avoidTerms(['egg'])));
  assert.ok(matchesAny({ name: 'Café com leite sem açúcar' }, avoidTerms(['lactose'])));
  assert.deepEqual(parseTerms('Camarão,  pimentão; ab'), ['camarao', 'pimentao']);
  const targets = calcTargets({ sex: 'm', age: 30, height: 178, weight: 80, activity: 'moderate', objective: 'maintain', trains: 'yes', trainDays: '4-6', level: 'intermediate' });
  for (const ids of [['lactose'], ['egg', 'gluten'], ['fish', 'nuts', 'soy']]) {
    const avoid = avoidTerms(ids, 'pimentão');
    for (const seed of [0, 1, 2]) {
      const plan = generatePlan({ targets, wake: '06:30', sleep: '23:00', meals: '5', train: '18:00', avoid, seed }, byId);
      for (const it of plan.items) assert.ok(!matchesAny(byId.get(it.foodId), avoid), `${ids}: ${byId.get(it.foodId).name}`);
      for (const k of ['kcal', 'protein', 'carbs', 'fat']) assert.ok(Math.abs(plan.totals[k] - targets[k]) / targets[k] < 0.12, `${ids} ${k}`);
    }
  }
});

test('alimentos preferidos aparecem no cardápio', () => {
  const targets = calcTargets({ sex: 'f', age: 35, height: 165, weight: 70, activity: 'light', objective: 'lose', trains: 'yes', trainDays: '2-3', level: 'beginner' });
  const prefer = parseTerms('salmão, abacate, ovos, morango, cuscuz, picanha');
  const plan = generatePlan({ targets, wake: '06:00', sleep: '22:30', meals: '5', train: '18:30', prefer, avoid: avoidTerms(['lactose']) }, byId);
  const names = plan.items.map((i) => byId.get(i.foodId).name);
  for (const t of ['Salmão', 'Abacate', 'Ovo', 'Morango', 'Cuscuz', 'picanha']) assert.ok(names.some((n) => n.includes(t)), t);
  assert.deepEqual(plan.notes.missing, []);
  assert.ok(plan.items.every((i) => i.grams > 0));
});

test('cardápio gerado nunca passa da meta de calorias', () => {
  const targets = calcTargets({ sex: 'f', age: 30, height: 170, weight: 90, activity: 'sedentary', objective: 'lose', trains: 'yes', trainDays: '2-3' });
  for (const meals of ['3', '4', '5', '6']) for (const seed of [0, 1, 2]) {
    const plan = generatePlan({ targets, wake: '06:00', sleep: '22:30', meals, train: '18:30', seed }, byId);
    assert.ok(plan.totals.kcal <= targets.kcal * 1.02, `${meals}: ${plan.totals.kcal} > ${targets.kcal}`);
  }
});
