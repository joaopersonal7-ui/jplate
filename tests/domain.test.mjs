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
