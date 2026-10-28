import * as db from './db.js';
import {
  MEALS, NUTRIENTS, BACKUP_VERSION, localDate, addDays, parseLocalDate, formatDateLabel, normalize,
  searchFoods, servingOptions, baseUnit, scaleNutrients, entryAmount, sumTotals, groupByMeal, goalFor,
  buildEntry, buildQuickEntry, weightTrend, validateBackup, fmt, round, uid,
} from './domain.js';

const $ = (sel, root = document) => root.querySelector(sel);
const view = $('#view');
const topbar = $('#topbar');
const sheet = $('#sheet');

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const mealLabel = (id) => MEALS.find((m) => m.id === id)?.label ?? id;
const icons = {
  left: '<svg viewBox="0 0 24 24"><path d="M15 6l-6 6 6 6"/></svg>',
  right: '<svg viewBox="0 0 24 24"><path d="M9 6l6 6-6 6"/></svg>',
  close: '<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18"/></svg>',
  back: '<svg viewBox="0 0 24 24"><path d="M15 6l-6 6 6 6"/></svg>',
};

const state = {
  tab: 'diary',
  date: localDate(),
  taco: [],
  userFoods: [],
  foods: [],
  foodsById: new Map(),
  favorites: [],
  recents: [],
  servings: {},
  goals: [],
  weights: [],
  lastBackup: null,
  firstUse: null,
};

// ---------- carga ----------

async function load() {
  const [taco, userFoods, goals, weights, favorites, recents, servings, lastBackup, firstUse] = await Promise.all([
    fetch('data/taco.json').then((r) => r.json()).then((list) => list.map((f) => ({ ...f, source: 'taco' }))),
    db.getAll('foods'),
    db.getAll('goals'),
    db.getAll('weights'),
    db.kvGet('favorites', []),
    db.kvGet('recents', []),
    db.kvGet('servings', {}),
    db.kvGet('lastBackup', null),
    db.kvGet('firstUse', null),
  ]);
  Object.assign(state, { taco, userFoods, goals, weights, favorites, recents, servings, lastBackup, firstUse });
  if (!firstUse) {
    state.firstUse = localDate();
    await db.kvSet('firstUse', state.firstUse);
  }
  indexFoods();
}

function indexFoods() {
  const active = state.userFoods.filter((f) => !f.deletedAt);
  state.foods = [...active, ...state.taco];
  for (const f of state.foods) f._norm = normalize(f.name + ' ' + (f.brand ?? ''));
  state.foodsById = new Map([...state.userFoods, ...state.taco].map((f) => [f.id, f]));
}

// ---------- navegação ----------

document.querySelector('.tabbar').addEventListener('click', (e) => {
  const btn = e.target.closest('button[data-tab]');
  if (!btn) return;
  state.tab = btn.dataset.tab;
  for (const b of document.querySelectorAll('.tabbar button')) {
    if (b === btn) b.setAttribute('aria-current', 'page');
    else b.removeAttribute('aria-current');
  }
  render();
  window.scrollTo(0, 0);
});

async function render() {
  const renderers = { diary: renderDiary, weight: renderWeight, foods: renderFoods, settings: renderSettings };
  view.oninput = null;
  await renderers[state.tab]();
}

function setTopbar(html) {
  topbar.innerHTML = html;
}

function toast(msg) {
  const el = $('#toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toast.t);
  toast.t = setTimeout(() => el.classList.remove('show'), 2200);
}

// ---------- diário ----------

async function renderDiary() {
  const today = localDate();
  setTopbar(`
    <button class="icon-btn" data-nav="-1" aria-label="Dia anterior">${icons.left}</button>
    <h1>${esc(formatDateLabel(state.date, today))}<small>${esc(parseLocalDate(state.date).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' }))}</small></h1>
    <button class="icon-btn" data-nav="1" aria-label="Próximo dia">${icons.right}</button>`);
  topbar.onclick = (e) => {
    const b = e.target.closest('[data-nav]');
    if (b) { state.date = addDays(state.date, Number(b.dataset.nav)); renderDiary(); }
    if (e.target.closest('h1') && state.date !== today) { state.date = today; renderDiary(); }
  };

  const entries = await db.getByDate('entries', state.date);
  const { totals, missing } = sumTotals(entries);
  const goal = goalFor(state.goals, state.date);
  const groups = groupByMeal(entries);

  view.innerHTML = `
    ${backupReminder()}
    <section class="card" aria-label="Resumo do dia">${summaryHTML(totals, missing, goal)}</section>
    ${MEALS.map((m) => mealHTML(m, groups[m.id])).join('')}
    <p class="muted small" style="text-align:center;margin-top:18px">Valores aproximados. Não substitui orientação de nutricionista ou médico.</p>`;

  view.onclick = (e) => {
    const add = e.target.closest('[data-add-meal]');
    if (add) return openAdd(add.dataset.addMeal);
    const row = e.target.closest('[data-entry]');
    if (row) return openEntry(entries.find((x) => x.id === row.dataset.entry));
    if (e.target.closest('[data-go-settings]')) return document.querySelector('[data-tab="settings"]').click();
  };
}

function backupReminder() {
  const since = state.lastBackup ?? state.firstUse;
  if (!since || addDays(since, 14) > localDate()) return '';
  return `<div class="card small"><b>Faça um backup.</b> <span class="muted">Seus dados ficam só neste aparelho. ${state.lastBackup ? `Último backup em ${esc(new Date(state.lastBackup + 'T12:00').toLocaleDateString('pt-BR'))}.` : 'Você ainda não exportou nenhum.'}</span>
    <div class="btn-row"><button class="btn small" data-go-settings>Ir para backup</button></div></div>`;
}

function summaryHTML(totals, missing, goal) {
  const target = goal?.kcal ?? null;
  const pct = target ? Math.min(totals.kcal / target, 1) : 0;
  const C = 2 * Math.PI * 46;
  const over = target && totals.kcal > target;
  const remaining = target ? round(target - totals.kcal) : null;
  const macro = (key, label) => {
    const g = goal?.[key] ?? null;
    const v = totals[key];
    const w = g ? Math.min(v / g, 1) * 100 : 0;
    return `<div class="macro">
      <div class="macro-top"><span>${label}${missing[key] ? ' <span class="warn" title="Algum lançamento não tem este valor">*</span>' : ''}</span>
      <span class="num">${fmt(v, 0)}${g ? ` / ${fmt(g, 0)}` : ''} g</span></div>
      <div class="bar ${key}"><i style="width:${g ? w : 0}%"></i></div></div>`;
  };
  return `<div class="summary">
    <div class="ring${over ? ' over' : ''}">
      <svg viewBox="0 0 112 112"><circle class="track" cx="56" cy="56" r="46"/><circle class="value" cx="56" cy="56" r="46" stroke-dasharray="${C}" stroke-dashoffset="${C * (1 - pct)}"/></svg>
      <div class="label"><b>${fmt(totals.kcal, 0)}</b><span>${target ? (over ? `${fmt(-remaining, 0)} acima` : `faltam ${fmt(remaining, 0)}`) : 'kcal'}</span></div>
    </div>
    <div>
      ${macro('carbs', 'Carboidratos')}
      ${macro('protein', 'Proteínas')}
      ${macro('fat', 'Gorduras')}
      ${!goal ? '<p class="small muted" style="margin:6px 0 0">Defina suas metas em Ajustes.</p>' : ''}
    </div>
  </div>
  ${['carbs', 'protein', 'fat'].some((k) => missing[k]) ? '<p class="small warn" style="margin:10px 0 0">* Total incompleto: algum alimento não informa esse nutriente.</p>' : ''}`;
}

function mealHTML(meal, entries) {
  const kcal = entries.reduce((s, e) => s + (e.nutrients.kcal ?? 0), 0);
  return `<section class="card" aria-label="${esc(meal.label)}">
    <div class="card-head">
      <h2>${esc(meal.label)} <span class="muted small" style="font-weight:400">${entries.length ? `${fmt(kcal, 0)} kcal` : ''}</span></h2>
      <button class="add-btn" data-add-meal="${meal.id}" aria-label="Adicionar em ${esc(meal.label)}">+ Adicionar</button>
    </div>
    ${entries.length ? `<ul class="list">${entries.map((e) => `<li><button class="row" data-entry="${e.id}">
        <span class="grow"><span class="name">${esc(e.label)}</span>
        <span class="muted small">${entryDetail(e)}</span></span>
        <span class="num">${fmt(e.nutrients.kcal, 0)} kcal</span></button></li>`).join('')}</ul>` : ''}
  </section>`;
}

function entryDetail(e) {
  if (!e.foodId) return 'lançamento rápido';
  if (e.servingId === e.unit) return `${fmt(e.amount, 0)} ${e.unit}`;
  return `${fmt(e.quantity)} × ${esc(e.servingLabel)} · ${fmt(e.amount, 0)} ${e.unit}`;
}

// ---------- folha (dialog) genérica ----------

function openSheet({ title, body, onMount, back }) {
  sheet.innerHTML = `<div class="sheet-inner">
    <div class="sheet-head">
      ${back ? `<button class="icon-btn" data-sheet-back aria-label="Voltar">${icons.back}</button>` : ''}
      <h2>${esc(title)}</h2>
      <button class="icon-btn" data-sheet-close aria-label="Fechar">${icons.close}</button>
    </div>
    <div class="sheet-body">${body}</div></div>`;
  $('[data-sheet-close]', sheet).onclick = () => sheet.close();
  if (back) $('[data-sheet-back]', sheet).onclick = back;
  if (!sheet.open) sheet.showModal();
  onMount?.($('.sheet-body', sheet));
}

sheet.addEventListener('click', (e) => { if (e.target === sheet) sheet.close(); });

// ---------- adicionar alimento ----------

function openAdd(mealType, initial = { query: '', filter: 'recent' }) {
  const ui = { ...initial };
  openSheet({
    title: `Adicionar em ${mealLabel(mealType)}`,
    body: `
      <input class="search" type="search" placeholder="Buscar alimento (ex.: arroz, banana)" autocomplete="off" value="${esc(ui.query)}" aria-label="Buscar alimento">
      <div class="chips" role="group" aria-label="Filtro">
        <button class="chip" data-filter="recent">Recentes</button>
        <button class="chip" data-filter="fav">Favoritos</button>
        <button class="chip" data-filter="mine">Meus alimentos</button>
      </div>
      <div class="btn-row"><button class="btn small" data-quick>Lançamento rápido</button><button class="btn small" data-new-food>Novo alimento</button></div>
      <ul class="list" id="results"></ul>`,
    onMount(body) {
      const input = $('.search', body);
      const results = $('#results', body);
      const draw = () => {
        let list;
        const q = ui.query.trim();
        for (const c of body.querySelectorAll('[data-filter]')) c.setAttribute('aria-pressed', String(!q && c.dataset.filter === ui.filter));
        if (q) list = searchFoods(state.foods, q, { favorites: state.favorites, recents: state.recents });
        else if (ui.filter === 'fav') list = state.favorites.map((id) => state.foodsById.get(id));
        else if (ui.filter === 'mine') list = state.userFoods.filter((f) => !f.deletedAt).sort((a, b) => a.name.localeCompare(b.name));
        else list = state.recents.map((id) => state.foodsById.get(id));
        list = list.filter((f) => f && !f.deletedAt);
        const emptyMsg = q ? 'Nada encontrado. Tente outra palavra ou cadastre o alimento.'
          : ui.filter === 'fav' ? 'Marque alimentos com a estrela para vê-los aqui.'
          : ui.filter === 'mine' ? 'Você ainda não cadastrou alimentos.'
          : 'Busque um alimento para começar.';
        results.innerHTML = list.length ? list.map(foodRowHTML).join('') : `<li class="empty">${emptyMsg}</li>`;
      };
      input.addEventListener('input', () => { ui.query = input.value; draw(); });
      body.onclick = (e) => {
        const f = e.target.closest('[data-filter]');
        if (f) { ui.filter = f.dataset.filter; ui.query = ''; input.value = ''; draw(); return; }
        const row = e.target.closest('[data-food]');
        if (row) return openFoodDetail(state.foodsById.get(row.dataset.food), { mealType, back: () => openAdd(mealType, ui) });
        if (e.target.closest('[data-quick]')) return openQuick({ mealType, back: () => openAdd(mealType, ui) });
        if (e.target.closest('[data-new-food]')) return openFoodForm({ name: ui.query }, { afterSave: (food) => openFoodDetail(food, { mealType, back: () => openAdd(mealType, ui) }), back: () => openAdd(mealType, ui) });
      };
      draw();
      if (!matchMedia('(pointer: coarse)').matches || !ui.query) input.focus();
    },
  });
}

function foodRowHTML(f) {
  return `<li><button class="row" data-food="${esc(f.id)}">
    <span class="grow"><span class="name">${esc(f.name)}${f.brand ? ` <span class="muted">· ${esc(f.brand)}</span>` : ''}${f.source === 'user' ? '<span class="badge">meu</span>' : ''}</span>
    <span class="muted small">${esc(f.group ?? 'Meus alimentos')}</span></span>
    <span class="num small muted">${fmt(f.n.kcal, 0)} kcal/100${baseUnit(f)}</span></button></li>`;
}

// ---------- detalhe do alimento (adicionar ou editar lançamento) ----------

function openFoodDetail(food, { mealType, entry, back }) {
  const unit = baseUnit(food);
  const saved = () => state.servings[food.id] ?? [];
  let options = servingOptions(food, saved());
  const sel = { quantity: entry?.quantity ?? 100, servingId: entry?.servingId ?? unit, mealType: entry?.mealType ?? mealType };
  if (!entry && saved().length) { sel.servingId = saved()[0].id; sel.quantity = 1; }
  // Porção usada no lançamento foi apagada: volta para a quantidade em g/ml.
  if (entry && !options.some((o) => o.id === sel.servingId)) { sel.servingId = unit; sel.quantity = entry.amount; }
  const isFav = () => state.favorites.includes(food.id);

  openSheet({
    title: entry ? 'Editar lançamento' : 'Adicionar',
    back,
    body: `
      <div class="card-head" style="margin-top:12px">
        <h3>${esc(food.name)}${food.brand ? ` <span class="muted">· ${esc(food.brand)}</span>` : ''}</h3>
        <button class="icon-btn star" data-fav aria-pressed="${isFav()}" aria-label="Favorito">${isFav() ? '★' : '☆'}</button>
      </div>
      <p class="small muted" style="margin:4px 0 0">${food.source === 'taco' ? `TACO · ${esc(food.group)}` : 'Meu alimento'} · por 100 ${unit}: ${fmt(food.n.kcal, 0)} kcal</p>
      <div class="grid2">
        <label class="field">Quantidade<input type="number" inputmode="decimal" min="0" step="any" name="quantity" value="${esc(sel.quantity)}"></label>
        <label class="field">Unidade<select name="serving"></select></label>
      </div>
      <button class="btn small" data-new-serving style="margin-top:8px">+ Salvar uma porção (ex.: 1 unidade = 120 ${unit})</button>
      <div id="serving-form" hidden>
        <div class="grid2">
          <label class="field">Nome da porção<input name="sLabel" placeholder="1 unidade média"></label>
          <label class="field">Equivale a (${unit})<input name="sAmount" type="number" inputmode="decimal" min="0" step="any"></label>
        </div>
        <div class="btn-row"><button class="btn small" data-save-serving>Salvar porção</button></div>
      </div>
      <label class="field">Refeição<select name="meal">${MEALS.map((m) => `<option value="${m.id}"${m.id === sel.mealType ? ' selected' : ''}>${esc(m.label)}</option>`).join('')}</select></label>
      ${entry ? `<label class="field">Data<input type="date" name="date" value="${esc(entry.date)}"></label>` : ''}
      <table class="nutri-table" id="preview"></table>
      <div class="btn-row">
        ${entry ? '<button class="btn danger" data-delete>Excluir</button>' : ''}
        <button class="btn primary" data-save>${entry ? 'Salvar' : 'Adicionar'}</button>
      </div>`,
    onMount(body) {
      const q = $('[name="quantity"]', body);
      const s = $('[name="serving"]', body);
      const fillServings = () => {
        options = servingOptions(food, saved());
        if (!options.some((o) => o.id === sel.servingId)) sel.servingId = unit;
        s.innerHTML = options.map((o) => `<option value="${esc(o.id)}"${o.id === sel.servingId ? ' selected' : ''}>${esc(o.label)}</option>`).join('');
      };
      const preview = () => {
        const serving = options.find((o) => o.id === s.value);
        const amount = entryAmount(q.value, serving);
        const n = scaleNutrients(food.n, amount);
        $('#preview', body).innerHTML = `<tr><td class="muted">Total</td><td class="muted">${fmt(amount, 0)} ${unit}</td></tr>` +
          NUTRIENTS.map((x) => `<tr><td>${x.label}</td><td>${n[x.key] === null ? '<span class="muted">sem dado</span>' : `${fmt(n[x.key], x.key === 'kcal' ? 0 : 1)} ${x.unit}`}</td></tr>`).join('');
      };
      fillServings();
      preview();
      q.addEventListener('input', preview);
      s.addEventListener('change', () => {
        sel.servingId = s.value;
        // Ao trocar entre gramas e porção, sugere uma quantidade que faz sentido.
        if (s.value === unit && Number(q.value) < 10) q.value = 100;
        if (s.value !== unit && Number(q.value) >= 10) q.value = 1;
        preview();
      });
      body.onclick = async (e) => {
        if (e.target.closest('[data-fav]')) {
          state.favorites = isFav() ? state.favorites.filter((id) => id !== food.id) : [food.id, ...state.favorites];
          await db.kvSet('favorites', state.favorites);
          const star = e.target.closest('[data-fav]');
          star.setAttribute('aria-pressed', String(isFav()));
          star.textContent = isFav() ? '★' : '☆';
          toast(isFav() ? 'Adicionado aos favoritos.' : 'Removido dos favoritos.');
          return;
        }
        if (e.target.closest('[data-new-serving]')) {
          $('#serving-form', body).hidden = false;
          $('[name="sLabel"]', body).focus();
          return;
        }
        if (e.target.closest('[data-save-serving]')) {
          const label = $('[name="sLabel"]', body).value.trim();
          const amount = Number($('[name="sAmount"]', body).value);
          if (!label || !(amount > 0)) return toast('Preencha o nome e a quantidade da porção.');
          const serving = { id: uid(), label, amount };
          state.servings = { ...state.servings, [food.id]: [...saved(), serving] };
          await db.kvSet('servings', state.servings);
          sel.servingId = serving.id;
          q.value = 1;
          fillServings();
          preview();
          $('#serving-form', body).hidden = true;
          return toast('Porção salva.');
        }
        if (e.target.closest('[data-delete]')) {
          await db.remove('entries', entry.id);
          sheet.close();
          toast('Lançamento excluído.');
          return render();
        }
        if (e.target.closest('[data-save]')) {
          const serving = options.find((o) => o.id === s.value);
          if (!(entryAmount(q.value, serving) > 0)) return toast('Informe uma quantidade maior que zero.');
          const date = $('[name="date"]', body)?.value || entry?.date || state.date;
          const built = buildEntry({
            food, date, mealType: $('[name="meal"]', body).value, quantity: q.value,
            serving: serving.id === unit ? null : serving, id: entry?.id, createdAt: entry?.createdAt,
          });
          await db.put('entries', built);
          state.recents = [food.id, ...state.recents.filter((id) => id !== food.id)].slice(0, 40);
          await db.kvSet('recents', state.recents);
          sheet.close();
          toast(entry ? 'Lançamento atualizado.' : `Adicionado em ${mealLabel(built.mealType)}.`);
          return render();
        }
      };
    },
  });
}

function openEntry(entry) {
  if (!entry) return;
  const food = entry.foodId && state.foodsById.get(entry.foodId);
  if (food) return openFoodDetail(food, { entry });
  return openQuick({ entry });
}

// ---------- lançamento rápido ----------

function openQuick({ mealType, entry, back }) {
  const n = entry?.nutrients ?? {};
  const v = (x) => (x === null || x === undefined ? '' : x);
  openSheet({
    title: entry ? 'Editar lançamento rápido' : 'Lançamento rápido',
    back,
    body: `
      <p class="small muted">Para quando você só sabe as calorias (restaurante, rótulo, estimativa).</p>
      <label class="field">Descrição<input name="label" value="${esc(entry?.label ?? '')}" placeholder="Almoço no restaurante"></label>
      <label class="field">Calorias (kcal)<input name="kcal" type="number" inputmode="decimal" min="0" step="any" value="${esc(v(n.kcal))}"></label>
      <div class="grid3">
        <label class="field">Carb. (g)<input name="carbs" type="number" inputmode="decimal" min="0" step="any" value="${esc(v(n.carbs))}"></label>
        <label class="field">Prot. (g)<input name="protein" type="number" inputmode="decimal" min="0" step="any" value="${esc(v(n.protein))}"></label>
        <label class="field">Gord. (g)<input name="fat" type="number" inputmode="decimal" min="0" step="any" value="${esc(v(n.fat))}"></label>
      </div>
      <label class="field">Refeição<select name="meal">${MEALS.map((m) => `<option value="${m.id}"${m.id === (entry?.mealType ?? mealType) ? ' selected' : ''}>${esc(m.label)}</option>`).join('')}</select></label>
      <div class="btn-row">
        ${entry ? '<button class="btn danger" data-delete>Excluir</button>' : ''}
        <button class="btn primary" data-save>${entry ? 'Salvar' : 'Adicionar'}</button>
      </div>`,
    onMount(body) {
      if (!entry) $('[name="kcal"]', body).focus();
      body.onclick = async (e) => {
        if (e.target.closest('[data-delete]')) {
          await db.remove('entries', entry.id);
          sheet.close();
          toast('Lançamento excluído.');
          return render();
        }
        if (!e.target.closest('[data-save]')) return;
        const val = (name) => $(`[name="${name}"]`, body).value;
        if (!(Number(val('kcal')) >= 0) || val('kcal') === '') return toast('Informe as calorias.');
        const built = buildQuickEntry({
          date: entry?.date ?? state.date, mealType: val('meal'), kcal: val('kcal'), label: val('label'),
          carbs: val('carbs'), protein: val('protein'), fat: val('fat'), id: entry?.id, createdAt: entry?.createdAt,
        });
        await db.put('entries', built);
        sheet.close();
        toast('Lançamento salvo.');
        render();
      };
    },
  });
}

// ---------- cadastro de alimento próprio ----------

function openFoodForm(food = {}, { afterSave, back } = {}) {
  const editing = Boolean(food.id);
  const n = food.n ?? {};
  const v = (x) => (x === null || x === undefined ? '' : x);
  openSheet({
    title: editing ? 'Editar alimento' : 'Novo alimento',
    back,
    body: `
      <label class="field">Nome<input name="name" value="${esc(food.name ?? '')}" placeholder="Pão de queijo da padaria"></label>
      <div class="grid2">
        <label class="field">Marca (opcional)<input name="brand" value="${esc(food.brand ?? '')}"></label>
        <label class="field">Medido em<select name="baseUnit"><option value="g">gramas (g)</option><option value="ml"${food.baseUnit === 'ml' ? ' selected' : ''}>mililitros (ml)</option></select></label>
      </div>
      <p class="small muted" style="margin:14px 0 0">Valores por 100 <span data-unit>${baseUnit(food)}</span> (veja no rótulo). Deixe em branco o que não souber.</p>
      <div class="grid2">
        <label class="field">Calorias (kcal)<input name="kcal" type="number" inputmode="decimal" min="0" step="any" value="${esc(v(n.kcal))}"></label>
        <label class="field">Carboidratos (g)<input name="carbs" type="number" inputmode="decimal" min="0" step="any" value="${esc(v(n.carbs))}"></label>
        <label class="field">Proteínas (g)<input name="protein" type="number" inputmode="decimal" min="0" step="any" value="${esc(v(n.protein))}"></label>
        <label class="field">Gorduras (g)<input name="fat" type="number" inputmode="decimal" min="0" step="any" value="${esc(v(n.fat))}"></label>
        <label class="field">Fibras (g)<input name="fiber" type="number" inputmode="decimal" min="0" step="any" value="${esc(v(n.fiber))}"></label>
        <label class="field">Sódio (mg)<input name="sodium" type="number" inputmode="decimal" min="0" step="any" value="${esc(v(n.sodium))}"></label>
      </div>
      <p class="small muted" style="margin:10px 0 0">Rótulo só mostra por porção? Ex.: porção de 30 g com 120 kcal = 400 kcal por 100 g.</p>
      <div class="btn-row">
        ${editing ? '<button class="btn danger" data-delete>Excluir</button>' : ''}
        <button class="btn primary" data-save>Salvar</button>
      </div>`,
    onMount(body) {
      $('[name="baseUnit"]', body).addEventListener('change', (e) => { $('[data-unit]', body).textContent = e.target.value; });
      if (!editing) $('[name="name"]', body).focus();
      body.onclick = async (e) => {
        if (e.target.closest('[data-delete]')) {
          // Exclusão lógica: o histórico continua mostrando o snapshot do lançamento.
          await db.put('foods', { ...stripRuntime(food), deletedAt: Date.now(), updatedAt: Date.now() });
          state.userFoods = await db.getAll('foods');
          indexFoods();
          sheet.close();
          toast('Alimento excluído.');
          return render();
        }
        if (!e.target.closest('[data-save]')) return;
        const val = (name) => $(`[name="${name}"]`, body).value.trim();
        const opt = (name) => (val(name) === '' ? null : Number(val(name)));
        if (!val('name')) return toast('Dê um nome ao alimento.');
        if (val('kcal') === '') return toast('Informe as calorias por 100.');
        const saved = {
          ...stripRuntime(food),
          id: food.id ?? `user-${uid()}`,
          source: 'user',
          name: val('name'),
          brand: val('brand') || null,
          baseUnit: val('baseUnit'),
          n: { kcal: Number(val('kcal')), carbs: opt('carbs'), protein: opt('protein'), fat: opt('fat'), fiber: opt('fiber'), sodium: opt('sodium') },
          createdAt: food.createdAt ?? Date.now(),
          updatedAt: Date.now(),
        };
        await db.put('foods', saved);
        state.userFoods = await db.getAll('foods');
        indexFoods();
        toast('Alimento salvo.');
        if (afterSave) return afterSave(state.foodsById.get(saved.id));
        sheet.close();
        render();
      };
    },
  });
}

function stripRuntime(food) {
  const { _norm, ...rest } = food;
  return rest;
}

// ---------- peso ----------

async function renderWeight() {
  setTopbar('<h1>Peso</h1>');
  topbar.onclick = null;
  const list = weightTrend(state.weights);
  const last = list.at(-1);
  view.innerHTML = `
    <section class="card">
      <h2>Registrar peso</h2>
      <div class="grid2">
        <label class="field">Data<input type="date" name="wdate" value="${localDate()}" max="${localDate()}"></label>
        <label class="field">Peso (kg)<input type="number" name="wkg" inputmode="decimal" min="20" max="400" step="0.1" placeholder="${last ? fmt(last.kg) : '70,0'}"></label>
      </div>
      <div class="btn-row"><button class="btn primary" data-save-weight>Salvar</button></div>
    </section>
    ${list.length >= 2 ? `<section class="card chart"><div class="card-head"><h2>Tendência</h2><span class="small muted">linha = média dos últimos 7 registros</span></div>${weightChart(list)}</section>` : ''}
    <section class="card">
      <h2>Histórico</h2>
      ${list.length ? `<ul class="list">${[...list].reverse().map((w) => `<li><div class="row" style="cursor:default">
        <span class="grow">${esc(parseLocalDate(w.date).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }))}</span>
        <span class="num">${fmt(w.kg)} kg</span>
        <button class="btn small danger" data-del-weight="${esc(w.id)}" aria-label="Excluir registro">Excluir</button></div></li>`).join('')}</ul>` : '<p class="empty">Nenhum registro ainda.</p>'}
    </section>`;

  view.onclick = async (e) => {
    if (e.target.closest('[data-save-weight]')) {
      const date = $('[name="wdate"]', view).value;
      const kg = Number($('[name="wkg"]', view).value.replace(',', '.'));
      if (!date || !(kg >= 20 && kg <= 400)) return toast('Informe um peso válido em kg.');
      // Um registro por dia: salvar de novo na mesma data substitui o anterior.
      const existing = state.weights.find((w) => w.date === date);
      await db.put('weights', { id: existing?.id ?? uid(), date, kg: round(kg, 2), updatedAt: Date.now() });
      state.weights = await db.getAll('weights');
      toast('Peso salvo.');
      return renderWeight();
    }
    const del = e.target.closest('[data-del-weight]');
    if (del) {
      await db.remove('weights', del.dataset.delWeight);
      state.weights = await db.getAll('weights');
      renderWeight();
    }
  };
}

function weightChart(list) {
  const W = 320, H = 180, L = 34, R = 8, T = 10, B = 22;
  const t0 = parseLocalDate(list[0].date).getTime();
  const t1 = parseLocalDate(list.at(-1).date).getTime();
  const span = Math.max(t1 - t0, 1);
  const vals = list.flatMap((w) => [w.kg, w.trend]);
  let min = Math.floor(Math.min(...vals) - 0.5);
  let max = Math.ceil(Math.max(...vals) + 0.5);
  if (max - min < 2) { min -= 1; max += 1; }
  const x = (d) => L + ((parseLocalDate(d).getTime() - t0) / span) * (W - L - R);
  const y = (v) => T + (1 - (v - min) / (max - min)) * (H - T - B);
  const ticks = [min, (min + max) / 2, max];
  const label = (d) => parseLocalDate(d).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Gráfico de peso de ${esc(label(list[0].date))} a ${esc(label(list.at(-1).date))}">
    ${ticks.map((v) => `<line class="axis" x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}"/><text class="tick" x="${L - 4}" y="${y(v) + 3}" text-anchor="end">${fmt(v, 1)}</text>`).join('')}
    ${list.map((w) => `<circle class="raw" cx="${x(w.date)}" cy="${y(w.kg)}" r="3"/>`).join('')}
    <polyline class="trend" points="${list.map((w) => `${x(w.date)},${y(w.trend)}`).join(' ')}"/>
    <text class="tick" x="${L}" y="${H - 6}">${esc(label(list[0].date))}</text>
    <text class="tick" x="${W - R}" y="${H - 6}" text-anchor="end">${esc(label(list.at(-1).date))}</text>
  </svg>`;
}

// ---------- alimentos ----------

function renderFoods() {
  setTopbar('<h1>Alimentos</h1>');
  topbar.onclick = null;
  const mine = state.userFoods.filter((f) => !f.deletedAt).sort((a, b) => a.name.localeCompare(b.name));
  view.innerHTML = `
    <section class="card">
      <div class="card-head"><h2>Meus alimentos</h2><button class="add-btn" data-new-food>+ Novo</button></div>
      ${mine.length ? `<ul class="list">${mine.map(foodRowHTML).join('')}</ul>` : '<p class="empty">Cadastre aqui o que não está na tabela: produtos de marca, receitas de casa, pratos do restaurante.</p>'}
    </section>
    <section class="card">
      <h2>Consultar a tabela</h2>
      <input class="search" type="search" placeholder="Buscar entre ${state.taco.length} alimentos da TACO" aria-label="Buscar na tabela">
      <ul class="list" id="browse"></ul>
    </section>`;
  const input = $('.search', view);
  input.addEventListener('input', () => {
    const list = searchFoods(state.foods, input.value, { favorites: state.favorites, recents: state.recents, limit: 30 });
    $('#browse', view).innerHTML = list.map(foodRowHTML).join('') || (input.value.trim() ? '<li class="empty">Nada encontrado.</li>' : '');
  });
  view.onclick = (e) => {
    if (e.target.closest('[data-new-food]')) return openFoodForm({});
    const row = e.target.closest('[data-food]');
    if (!row) return;
    const food = state.foodsById.get(row.dataset.food);
    if (food.source === 'user' && row.closest('.card') === view.firstElementChild) return openFoodForm(food);
    openFoodDetail(food, { mealType: defaultMeal() });
  };
}

// Refeição sugerida pelo horário, usada quando se adiciona fora do diário.
function defaultMeal(h = new Date().getHours()) {
  if (h < 10) return 'breakfast';
  if (h < 15) return 'lunch';
  if (h >= 18) return 'dinner';
  return 'snack';
}

// ---------- ajustes ----------

async function renderSettings() {
  setTopbar('<h1>Ajustes</h1>');
  topbar.onclick = null;
  const today = localDate();
  const goal = goalFor(state.goals, today) ?? {};
  const v = (x) => (x === null || x === undefined ? '' : x);
  const persisted = await navigator.storage?.persisted?.();
  view.innerHTML = `
    <section class="card">
      <h2>Metas diárias</h2>
      <p class="small muted" style="margin:4px 0 0">Valem a partir de hoje; dias anteriores continuam com a meta da época.</p>
      <div class="grid2">
        <label class="field">Calorias (kcal)<input name="kcal" type="number" inputmode="numeric" min="0" value="${esc(v(goal.kcal))}"></label>
        <label class="field">Carboidratos (g)<input name="carbs" type="number" inputmode="numeric" min="0" value="${esc(v(goal.carbs))}"></label>
        <label class="field">Proteínas (g)<input name="protein" type="number" inputmode="numeric" min="0" value="${esc(v(goal.protein))}"></label>
        <label class="field">Gorduras (g)<input name="fat" type="number" inputmode="numeric" min="0" value="${esc(v(goal.fat))}"></label>
      </div>
      <p class="small muted" id="macro-kcal" style="margin:8px 0 0"></p>
      <div class="btn-row"><button class="btn primary" data-save-goal>Salvar metas</button></div>
    </section>

    <section class="card">
      <h2>Backup</h2>
      <p class="small muted" style="margin:4px 0 0">Seus dados ficam só neste aparelho. Exporte de vez em quando e guarde o arquivo (Drive, e-mail). ${state.lastBackup ? `Último backup: ${esc(new Date(state.lastBackup + 'T12:00').toLocaleDateString('pt-BR'))}.` : 'Nenhum backup feito ainda.'}</p>
      <div class="btn-row">
        <button class="btn" data-export>Exportar backup</button>
        <button class="btn" data-import>Importar backup</button>
        <input type="file" accept="application/json,.json" hidden id="import-file">
      </div>
      <p class="small ${persisted ? 'muted' : 'warn'}" style="margin:10px 0 0">${persisted ? 'Armazenamento protegido: o navegador não apaga os dados sozinho.' : 'O navegador pode apagar os dados se faltar espaço. Instale o app na tela inicial e toque abaixo para proteger.'}</p>
      ${persisted ? '' : '<div class="btn-row"><button class="btn small" data-persist>Proteger armazenamento</button></div>'}
    </section>

    <section class="card small">
      <h2>Sobre</h2>
      <p class="muted">Base de alimentos: Tabela Brasileira de Composição de Alimentos (TACO), 4ª edição, NEPA/UNICAMP, 2011. Valores por 100 g do alimento como descrito; “traços” contam como zero e valores não analisados aparecem como “sem dado”.</p>
      <p class="muted">Os números são estimativas para acompanhamento pessoal e não substituem orientação profissional.</p>
    </section>`;

  const macroKcal = () => {
    const g = (n) => Number($(`[name="${n}"]`, view).value) || 0;
    const sum = g('carbs') * 4 + g('protein') * 4 + g('fat') * 9;
    $('#macro-kcal', view).textContent = sum ? `Os macros somam ${fmt(sum, 0)} kcal (4 kcal/g carb. e prot., 9 kcal/g gord.).` : '';
  };
  macroKcal();
  view.oninput = macroKcal;

  $('#import-file', view).addEventListener('change', importBackup);
  view.onclick = async (e) => {
    if (e.target.closest('[data-save-goal]')) {
      const num = (n) => { const x = $(`[name="${n}"]`, view).value; return x === '' ? null : Number(x); };
      const g = { id: `goal-${today}`, startsAt: today, kcal: num('kcal'), carbs: num('carbs'), protein: num('protein'), fat: num('fat'), updatedAt: Date.now() };
      await db.put('goals', g);
      state.goals = await db.getAll('goals');
      return toast('Metas salvas.');
    }
    if (e.target.closest('[data-export]')) return exportBackup();
    if (e.target.closest('[data-import]')) return $('#import-file', view).click();
    if (e.target.closest('[data-persist]')) {
      const ok = await navigator.storage?.persist?.();
      toast(ok ? 'Armazenamento protegido.' : 'O navegador não permitiu. Instale o app na tela inicial e tente de novo.');
      return renderSettings();
    }
  };
}

async function exportBackup() {
  const data = { app: 'nutri-pessoal', version: BACKUP_VERSION, exportedAt: new Date().toISOString(), ...(await db.exportAll()) };
  const blob = new Blob([JSON.stringify(data, null, 1)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `jplate-backup-${localDate()}.json`;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  state.lastBackup = localDate();
  await db.kvSet('lastBackup', state.lastBackup);
  toast('Backup exportado.');
  renderSettings();
}

async function importBackup(e) {
  const file = e.target.files[0];
  e.target.value = '';
  if (!file) return;
  let data;
  try { data = JSON.parse(await file.text()); } catch { return toast('Arquivo inválido.'); }
  const err = validateBackup(data);
  if (err) return toast(err);
  const total = data.entries.length;
  if (!confirm(`Substituir todos os dados deste aparelho pelo backup (${total} lançamentos)?`)) return;
  await db.replaceAll(data);
  await load();
  toast('Backup importado.');
  render();
}

// ---------- início ----------

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}

load().then(render).catch((err) => {
  view.innerHTML = `<div class="card">Não foi possível abrir o app: ${esc(err.message)}</div>`;
});
