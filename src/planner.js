// Gera um cardápio do dia a partir das metas (kcal, proteína, carboidrato, gordura e fibra),
// dos horários de acordar, dormir e treinar, das intolerâncias e dos alimentos preferidos.
// Puro: recebe os alimentos por id, sem DOM nem banco.
//
// Cada refeição vem de um modelo com alimentos em "papéis":
//   p = fonte de proteína, c = carboidrato, f = gordura, v = fruta/legume (fibra), x = fixo.
// As quantidades de p, c, f e v são multiplicadas por um fator por papel, escolhido para
// chegar perto das metas do dia (fibra conta só quando falta). No fim tudo é arredondado para
// medidas práticas (step, em g).

const WHEY = 'usda-a2bd0l';
const COTTAGE = 'usda-11zpsun';
const PASTA_AMENDOIM = 'usda-1082o20';
const LEITE_D = 'usda-1nnva3f';
const GRANOLA = 'tl-nkd5n7';
const TILAPIA = 'usda-1w3zg7r';
const TOFU = 'usda-2akd6h';
const PERU = 'tl-7no5no';

// [id, papel, gramas base, passo de arredondamento]
const T = {
  breakfast: [
    [['rec-ovo-mexido-sem-oleo', 'p', 90, 45], ['taco-53', 'c', 50, 25], ['taco-226', 'v', 150, 50], ['rec-cafe-com-leite-sem-acucar', 'x', 150, 50]],
    [['rec-crepioca-ovo-e-goma-de-tapioca', 'x', 144, 72], ['taco-449', 'p', 100, 50], ['taco-182', 'c', 70, 35], ['taco-239', 'v', 100, 50]],
    [['taco-449', 'p', 170, 85], [WHEY, 'p', 15, 15], ['taco-7', 'c', 30, 10], ['taco-182', 'c', 70, 35], ['taco-226', 'v', 120, 40]],
    [['taco-533', 'c', 100, 25], ['taco-488', 'p', 100, 50], ['taco-461', 'p', 30, 15], ['taco-225', 'v', 150, 50], ['rec-cafe-com-leite-sem-acucar', 'x', 150, 50]],
    [['taco-52', 'c', 50, 25], ['taco-163', 'f', 60, 20], ['taco-488', 'p', 100, 50], [PERU, 'p', 30, 15], ['taco-239', 'v', 100, 50]],
    [['rec-tapioca-simples-goma', 'c', 63, 21], ['taco-461', 'p', 40, 10], ['taco-226', 'v', 150, 50], ['rec-cafe-com-leite-sem-acucar', 'x', 150, 50]],
  ],
  main: [
    [['taco-3', 'c', 120, 15], ['taco-561', 'c', 100, 20], ['taco-410', 'p', 120, 10], ['taco-546', 'v', 120, 20], ['rec-salada-de-alface-e-tomate-com-azeite', 'v', 80, 20], ['taco-260', 'f', 5, 2]],
    [['taco-1', 'c', 120, 15], ['taco-567', 'c', 100, 20], ['taco-377', 'p', 110, 10], ['taco-100', 'v', 100, 20], ['taco-161', 'v', 80, 20], ['taco-260', 'f', 5, 2]],
    [['taco-88', 'c', 150, 25], ['taco-561', 'c', 80, 20], [TILAPIA, 'p', 130, 10], ['taco-546', 'v', 150, 25], ['taco-260', 'f', 5, 2]],
    [['taco-129', 'c', 120, 20], ['taco-408', 'p', 120, 10], ['taco-116', 'v', 60, 20], ['taco-161', 'v', 80, 20], ['taco-567', 'c', 80, 20], ['taco-260', 'f', 4, 2]],
    [['taco-3', 'c', 120, 15], ['taco-561', 'c', 100, 20], ['taco-317', 'p', 110, 10], ['taco-100', 'v', 100, 20], ['taco-260', 'f', 4, 2]],
    [['taco-91', 'c', 150, 25], [TOFU, 'p', 130, 10], ['taco-546', 'v', 120, 20], ['taco-567', 'c', 80, 20], ['taco-260', 'f', 5, 2]],
  ],
  snack: [
    [['taco-182', 'c', 70, 35], ['taco-52', 'c', 50, 25], [PASTA_AMENDOIM, 'f', 15, 5]],
    [['taco-449', 'p', 170, 85], [GRANOLA, 'c', 25, 5], ['taco-222', 'v', 130, 65]],
    [[WHEY, 'p', 30, 15], [LEITE_D, 'x', 200, 50], ['taco-182', 'c', 70, 35], [PASTA_AMENDOIM, 'f', 10, 5]],
    [['rec-tapioca-simples-goma', 'c', 63, 21], ['taco-461', 'p', 40, 10], ['taco-214', 'v', 130, 65]],
    [['taco-222', 'v', 130, 65], ['taco-589', 'f', 10, 5], ['taco-449', 'p', 170, 85]],
    [['taco-488', 'p', 100, 50], ['taco-222', 'v', 130, 65], ['taco-589', 'f', 10, 5]],
    [[PERU, 'p', 40, 20], ['taco-52', 'c', 50, 25], ['taco-163', 'f', 40, 20]],
    [['taco-52', 'c', 50, 25], ['taco-410', 'p', 60, 10], ['taco-161', 'v', 40, 20]],
  ],
  supper: [
    [['taco-449', 'p', 170, 85], ['taco-7', 'c', 15, 5]],
    [[COTTAGE, 'p', 100, 25], ['taco-589', 'f', 8, 4]],
    [['rec-omelete-simples-2-ovos', 'p', 93, 46], ['taco-161', 'v', 80, 20]],
    [['taco-488', 'p', 100, 50], ['taco-163', 'f', 40, 20]],
    [['taco-410', 'p', 80, 10], ['taco-546', 'v', 100, 20]],
  ],
  // Pré-treino: carboidrato fácil, um pouco de proteína e pouca gordura.
  pre: [
    [['taco-182', 'c', 70, 35], ['taco-7', 'c', 20, 10], ['taco-449', 'p', 170, 85]],
    [['rec-tapioca-simples-goma', 'c', 63, 21], ['taco-461', 'p', 30, 15]],
    [['taco-53', 'c', 50, 25], [PERU, 'p', 30, 15]],
  ],
  // Pós-treino: proteína com carboidrato.
  post: [
    [[WHEY, 'p', 30, 15], ['taco-182', 'c', 70, 35], [LEITE_D, 'x', 200, 50]],
    [['rec-ovo-mexido-sem-oleo', 'p', 90, 45], ['taco-53', 'c', 50, 25], ['taco-226', 'v', 100, 50]],
    [['taco-410', 'p', 100, 10], ['taco-88', 'c', 150, 25]],
  ],
};

export const PLAN_FOOD_IDS = [...new Set(Object.values(T).flat(2).map((e) => e[0]))];

// Intolerâncias e alergias comuns: termos procurados no nome e nos ingredientes do alimento.
export const INTOLERANCES = [
  { id: 'lactose', label: 'Lactose', terms: ['leite', 'iogurte', 'queijo', 'cottage', 'requeijao', 'whey', 'creme de leite', 'manteiga', 'nata', 'coalhada'] },
  { id: 'gluten', label: 'Glúten', terms: ['trigo', 'pao', 'aveia', 'granola', 'macarrao', 'biscoito', 'bolo', 'centeio', 'cevada', 'torrada'] },
  { id: 'egg', label: 'Ovo', terms: ['ovo', 'omelete', 'crepioca', 'gema', 'clara'] },
  { id: 'nuts', label: 'Amendoim e castanhas', terms: ['amendoim', 'castanha', 'noz', 'nozes', 'amendoa', 'avela', 'pistache', 'macadamia'] },
  { id: 'fish', label: 'Peixe e frutos do mar', terms: ['peixe', 'tilapia', 'atum', 'sardinha', 'salmao', 'camarao', 'bacalhau', 'merluza', 'pescada', 'lula', 'polvo', 'marisco', 'siri'] },
  { id: 'soy', label: 'Soja', terms: ['soja', 'tofu', 'edamame'] },
];

const norm = (s) => String(s ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const escRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Lista de termos digitados ("frango, batata doce") em termos normalizados.
export function parseTerms(text) {
  return [...new Set(String(text ?? '').split(/[,;\n]+/).map(norm).filter((t) => t.length >= 3))];
}

// Termos a evitar a partir das intolerâncias marcadas e do texto livre.
export function avoidTerms(ids = [], other = '') {
  return [...new Set([...INTOLERANCES.filter((x) => ids.includes(x.id)).flatMap((x) => x.terms), ...parseTerms(other)])];
}

// Plural simples: "ovos" acha "ovo"; "bananas" acha "banana".
const termRe = (t) => new RegExp(`\\b${escRe(t.replace(/s$/, ''))}`);
const textOf = (food) => ` ${norm(food.name)} ${norm(food.recipe)} `;
export const matchesAny = (food, terms) => terms.some((t) => termRe(t).test(textOf(food)));

const KEYS = ['kcal', 'carbs', 'protein', 'fat', 'fiber'];

const toMin = (hhmm) => {
  const [h, m] = String(hhmm || '').split(':').map(Number);
  return Number.isFinite(h) ? h * 60 + (m || 0) : null;
};
const toHHMM = (min) => {
  const m = ((Math.round(min / 15) * 15) % 1440 + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
};

// Refeições do dia conforme o tempo acordado e, se escolhido, o número de refeições (3 a 6).
// Sem número escolhido, decide pelo tempo acordado. `diary` diz em que refeição do diário cada uma cai.
export const MEAL_COUNTS = [
  { id: '3', label: '2 a 3 refeições' },
  { id: '4', label: '4 refeições' },
  { id: '5', label: '5 refeições' },
  { id: '6', label: '6 refeições' },
];

export function mealSlots(wake = '07:00', sleep = '23:00', count = null, train = null) {
  const w = toMin(wake) ?? 420;
  let s = toMin(sleep) ?? 1380;
  if (s <= w) s += 1440;
  const awake = s - w;
  const n = Number(count) || null;
  const breakfast = w + 30;
  // Com 3 refeições o jantar fica mais cedo e o almoço no meio do dia.
  const dinner = n === 3 ? s - 180 : s - 150;
  const lunch = n === 3 ? (breakfast + dinner) / 2 : breakfast + Math.max(180, Math.round((dinner - breakfast) * 0.42));
  const want = {
    snack1: n ? n >= 5 : lunch - breakfast >= 270,
    snack2: n ? n >= 4 : true,
    supper: n ? n >= 6 : awake >= 930,
  };
  let slots = [{ id: 'breakfast', label: 'Café da manhã', time: breakfast, diary: 'breakfast', kind: 'breakfast' }];
  if (want.snack1) slots.push({ id: 'snack1', label: 'Lanche da manhã', time: (breakfast + lunch) / 2, diary: 'snack', kind: 'snack' });
  slots.push({ id: 'lunch', label: 'Almoço', time: lunch, diary: 'lunch', kind: 'main' });
  if (want.snack2) slots.push({ id: 'snack2', label: 'Lanche da tarde', time: (lunch + dinner) / 2, diary: 'snack', kind: 'snack' });
  slots.push({ id: 'dinner', label: 'Jantar', time: dinner, diary: 'dinner', kind: 'main' });
  if (want.supper) slots.push({ id: 'supper', label: 'Ceia', time: Math.max(dinner + 60, s - 60), diary: 'snack', kind: 'supper' });

  let t = toMin(train);
  if (t !== null) {
    if (t < w) t += 1440;
    if (t >= w && t <= s) slots = withTraining(slots, t, w, n);
  }
  return slots.map((x) => ({ ...x, time: toHHMM(x.time) }));
}

// Encaixa pré-treino (até 2 h antes) e pós-treino (até 2 h depois de ~1 h de treino).
// Uma refeição que já cai na janela vira o pré ou o pós; senão entra uma refeição nova.
// Se assim passar do número de refeições escolhido, sai um lanche comum.
function withTraining(slots, t, wake, n) {
  slots = slots.map((x) => ({ ...x }));
  // Refeição que cairia durante o treino (ou colada antes dele) passa para logo depois e vira o pós.
  // Ex.: treino ao acordar, o café vira pós-treino e entra um pré leve ao acordar.
  for (const x of slots) if (x.time > t - 30 && x.time < t + 60) x.time = t + 75;
  const mark = (from, to, ideal, kind, label, id) => {
    const inWindow = slots.filter((x) => !x.training && x.time >= from && x.time <= to);
    const hit = inWindow.sort((a, b) => Math.abs(a.time - ideal) - Math.abs(b.time - ideal))[0];
    if (hit) {
      hit.training = kind;
      if (hit.kind === 'snack' || hit.kind === 'supper') { hit.kind = kind; hit.label = label; } else hit.label = `${hit.label} (${label.toLowerCase()})`;
      return;
    }
    slots.push({ id, label, time: ideal, diary: 'snack', kind, training: kind });
  };
  mark(Math.max(wake, t - 120), t - 30, Math.max(wake, t - 60), 'pre', 'Pré-treino', 'pre');
  mark(t + 60, t + 180, t + 90, 'post', 'Pós-treino', 'post');
  slots.sort((a, b) => a.time - b.time);
  // Lanches comuns colados (menos de 1 h) numa refeição de treino saem.
  slots = slots.filter((x) => x.training || x.kind !== 'snack' || !slots.some((y) => y.training && Math.abs(y.time - x.time) < 60));
  for (const id of ['snack1', 'snack2', 'supper']) {
    if (!n || slots.length <= n) break;
    const i = slots.findIndex((x) => x.id === id && !x.training);
    if (i >= 0) slots.splice(i, 1);
  }
  return slots.map(({ training, ...x }) => x);
}

function add(a, b, k = 1) {
  for (const key of KEYS) a[key] += (b[key] ?? 0) * k;
}
const zero = () => Object.fromEntries(KEYS.map((k) => [k, 0]));
const per = (food, g) => Object.fromEntries(KEYS.map((k) => [k, ((food.n[k] ?? 0) * g) / 100]));

// Mínimos quadrados relativos em P, C, G e kcal para os quatro fatores (p, c, f, v), com limites.
// Fibra só pesa quando fica abaixo da meta: passar dela não é problema.
// Com poucas refeições cada uma precisa comportar mais comida (`big`).
function solve(groups, fixed, target, big = 2.5) {
  const LIMITS = [[0.25, big], [0.25, big], [0.25, 5], [0.4, 2.5]];
  const keys = ['protein', 'carbs', 'fat', 'kcal'];
  const w = { protein: 2, carbs: 1, fat: 1, kcal: 2 };
  let x = [1, 1, 1, 1];
  const sum = (x, k) => fixed[k] + groups.reduce((a, g, i) => a + g[k] * x[i], 0);
  const err = (x) => {
    // Passar da meta de calorias pesa 4× mais que ficar abaixo (regra central dos parâmetros).
    let e = keys.reduce((s, k) => {
      const t = target[k] || 1;
      const d = (sum(x, k) - t) / t;
      return s + w[k] * (k === 'kcal' && d > 0 ? 4 : 1) * d ** 2;
    }, 0);
    if (target.fiber) {
      const short = Math.max(0, target.fiber - sum(x, 'fiber')) / target.fiber;
      e += 0.8 * short ** 2;
    }
    return e;
  };
  let step = 0.5;
  // Busca por coordenadas: simples e estável para poucas variáveis.
  for (let it = 0; it < 600 && step > 1e-4; it++) {
    let improved = false;
    for (let i = 0; i < 4; i++) {
      if (!groups[i].kcal && !groups[i].fiber) continue;
      for (const d of [step, -step]) {
        const y = [...x];
        y[i] = Math.min(LIMITS[i][1], Math.max(LIMITS[i][0], y[i] + d));
        if (err(y) < err(x)) { x = y; improved = true; }
      }
    }
    if (!improved) step /= 2;
  }
  return x;
}

// Outro alimento do mesmo papel, de modelos da mesma refeição (ou de qualquer uma), que não seja evitado.
function substitute(kind, role, foodsById, bad, tpl, seed) {
  const inTpl = new Set(tpl.map((e) => e[0]));
  const pool = (kinds) => kinds.flatMap((k) => T[k].flat()).filter(([id, r]) => r === role && !inTpl.has(id))
    .map(([id, , base, step]) => ({ food: foodsById.get(id), base, step })).filter((x) => x.food && !bad(x.food));
  const list = pool([kind]).length ? pool([kind]) : pool(Object.keys(T));
  return list.length ? list[seed % list.length] : null;
}

// Papel pelo perfil de calorias: proteína, gordura, fruta/legume (pouca caloria) ou carboidrato.
function roleOf(food) {
  const { kcal = 0, protein = 0, fat = 0, carbs = 0 } = food.n;
  if (!kcal) return 'v';
  if ((protein * 4) / kcal >= 0.4 || protein >= 18) return 'p';
  if ((fat * 9) / kcal >= 0.6) return 'f';
  if (kcal < 90 && (carbs * 4) / kcal > 0.5) return 'v';
  return 'c';
}

// Melhor alimento da base para um termo preferido: tabelas brasileiras e preparo pronto primeiro.
function findFood(foodsById, term, bad) {
  const re = new RegExp(`\\b${escRe(term.replace(/s$/, ''))}`);
  let best = null, bestScore = -Infinity;
  for (const f of foodsById.values()) {
    if (!f.n?.kcal || bad(f) || f.source === 'off') continue;
    const name = norm(f.name);
    if (!re.test(name)) continue;
    const score = ({ taco: 30, receita: 25, user: 20 }[f.source] ?? 0) + (name.startsWith(term.replace(/s$/, '')) ? 20 : 0)
      + (/cozid|grelhad|assad|cru\b|crua\b/.test(name) ? 15 : 0) + (/sem gordura|sem pele|magr/.test(name) ? 5 : 0)
      - (/frit|empanad|acucar|calda|cru\b.*(carne|frango|peixe)|^(carne|frango|peixe|salmao|tilapia).*\bcru/.test(name) ? 20 : 0)
      - name.length / 10;
    if (score > bestScore) { best = f; bestScore = score; }
  }
  return best;
}

// Gera o cardápio. `seed` escolhe outra combinação de modelos ("gerar outra opção").
// `avoid`: termos a excluir (intolerâncias). `prefer`: termos de alimentos preferidos.
export function generatePlan({ targets, wake, sleep, meals = null, train = null, avoid = [], prefer = [], seed = 0 }, foodsById) {
  const slots = mealSlots(wake, sleep, meals, train);
  const bad = (food) => avoid.length > 0 && matchesAny(food, avoid);
  const liked = (food) => prefer.length > 0 && matchesAny(food, prefer);
  const notes = { replaced: [], preferred: [], missing: [] };
  let snackN = 0;
  let mainN = 0;
  const items = [];
  const used = new Set();
  for (const [si, slot] of slots.entries()) {
    const list = T[slot.kind];
    const offset = slot.kind === 'snack' ? snackN++ * 2 : slot.kind === 'main' ? mainN++ : 0;
    // Ordem de rodízio, depois os modelos sem alimento a evitar e com mais preferidos na frente.
    const start = (seed + si + offset) % list.length;
    // Modelo já usado no dia perde pontos, para almoço e jantar não repetirem.
    const score = (tpl) => (used.has(tpl) ? -4 : 0) + tpl.reduce((a, [id]) => {
      const f = foodsById.get(id);
      return a + (!f ? 0 : bad(f) ? -10 : liked(f) ? 3 : 0);
    }, 0);
    const tpl = list.map((_, i) => list[(start + i) % list.length])
      .map((tp, i) => ({ tp, i, sc: score(tp) }))
      .sort((a, b) => b.sc - a.sc || a.i - b.i)[0].tp;
    used.add(tpl);
    for (const [foodId, role, g, step] of tpl) {
      let food = foodsById.get(foodId);
      let base = g, st = step;
      if (food && bad(food)) {
        const alt = substitute(slot.kind, role, foodsById, bad, tpl, seed + si);
        notes.replaced.push(food.name);
        if (!alt) continue;
        [food, base, st] = [alt.food, alt.base, alt.step];
      }
      if (food) items.push({ slot: slot.id, kind: slot.kind, food, role, base, step: st, pref: liked(food) });
    }
  }

  // Preferido que nenhum modelo trouxe: troca um alimento do mesmo papel numa refeição que combine.
  for (const term of prefer) {
    if (items.some((it) => matchesAny(it.food, [term]))) { notes.preferred.push(term); continue; }
    const food = findFood(foodsById, term, bad);
    if (!food) { notes.missing.push(term); continue; }
    const role = roleOf(food);
    const kinds = role === 'p' || role === 'c' ? ['main', 'post', 'breakfast'] : role === 'v' ? ['snack', 'breakfast', 'main'] : ['breakfast', 'snack', 'main', 'supper'];
    const target = kinds.map((k) => items.find((it) => it.kind === k && it.role === role && !it.pref)).find(Boolean);
    if (!target) { notes.missing.push(term); continue; }
    // Mesmas calorias do alimento trocado, em passos práticos.
    const k = (target.food.n.kcal || 1) / (food.n.kcal || 1);
    target.base = Math.max(5, Math.min(400, target.base * k));
    target.step = target.base < 40 ? 5 : 10;
    target.food = food;
    target.pref = true;
    notes.preferred.push(term);
  }

  const fixed = zero();
  const groups = [zero(), zero(), zero(), zero()];
  for (const it of items) {
    const gi = { p: 0, c: 1, f: 2, v: 3 }[it.role];
    add(gi === undefined ? fixed : groups[gi], per(it.food, it.base));
  }
  const big = slots.length <= 3 ? 3.5 : slots.length === 4 ? 3 : 2.5;
  const x = solve(groups, fixed, targets, big);
  const mult = (it) => ({ p: x[0], c: x[1], f: x[2], v: x[3] }[it.role] ?? 1);

  const out = items.map((it) => ({
    slot: it.slot, foodId: it.food.id, role: it.role, step: it.step, food: it.food, base: it.base, pref: it.pref,
    grams: Math.max(it.step, Math.round((it.base * mult(it)) / it.step) * it.step),
  }));
  // Ajuste fino depois do arredondamento: sobe ou desce uma medida por vez (ou tira um item, se a
  // refeição tiver mais de dois) enquanto isso aproximar o dia das metas.
  const keys = ['protein', 'carbs', 'fat', 'kcal'];
  const wts = { protein: 2, carbs: 1, fat: 1, kcal: 2 };
  const tot = zero();
  for (const it of out) add(tot, per(it.food, it.grams));
  const errOf = (t) => keys.reduce((e, k) => {
    if (!targets[k]) return e;
    const d = (t[k] - targets[k]) / targets[k];
    return e + wts[k] * (k === 'kcal' && d > 0 ? 4 : 1) * d ** 2;
  }, 0)
    + (targets.fiber ? 0.8 * (Math.max(0, targets.fiber - t.fiber) / targets.fiber) ** 2 : 0);
  for (let guard = 0; guard < 80; guard++) {
    const base = errOf(tot);
    let best = null;
    for (const it of out) {
      if (it.role === 'x') continue;
      const meal = out.filter((o) => o.slot === it.slot).length;
      for (const d of [it.step, -it.step]) {
        const g = it.grams + d;
        // Teto por item: até `big`× a porção do modelo (fruta/legume 2,5×, gordura 5×), para não virar prato irreal.
        if (g < 0 || (g === 0 && (meal <= 2 || it.pref)) || g > Math.max(it.step, it.base * (it.role === 'f' ? 5 : it.role === 'v' ? 2.5 : big))) continue;
        const t = { ...tot };
        add(t, per(it.food, d));
        const e = errOf(t);
        if (e < base - 1e-6 && (!best || e < best.e)) best = { it, d, e };
      }
    }
    if (!best) break;
    best.it.grams += best.d;
    add(tot, per(best.it.food, best.d));
    if (best.it.grams === 0) out.splice(out.indexOf(best.it), 1);
  }
  // Mesmo alimento repetido na mesma refeição vira um item só.
  const merged = [];
  for (const it of out) {
    const same = merged.find((m) => m.slot === it.slot && m.foodId === it.foodId);
    if (same) same.grams += it.grams;
    else merged.push({ slot: it.slot, foodId: it.foodId, grams: it.grams });
  }
  const totals = zero();
  for (const it of merged) add(totals, per(foodsById.get(it.foodId), it.grams));
  for (const k of KEYS) totals[k] = Math.round(totals[k] * 10) / 10;
  return { slots, items: merged, totals, notes };
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
