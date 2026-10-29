import * as db from './db.js';
import {
  MEALS, NUTRIENTS, BACKUP_VERSION, localDate, addDays, parseLocalDate, formatDateLabel, normalize,
  searchFoods, servingOptions, baseUnit, scaleNutrients, entryAmount, sumTotals, groupByMeal, goalFor,
  buildEntry, buildQuickEntry, weightTrend, validateBackup, fmt, round, uid,
  sourceLabel, kcalLabel, calcTargets, planItemNutrients, ACTIVITY, OBJECTIVES, LEVELS, TRAIN_DAYS, TRAIN_TYPES,
  DEFICITS, FAT_PCTS, WORK_DAYS, WORK_HOURS, WORK_EFFORT, suggestActivity,
} from './domain.js';
import { generatePlan, planToText, MEAL_COUNTS, INTOLERANCES, avoidTerms, parseTerms } from './planner.js';
import { searchOnline, productByBarcode, canScan, scanBarcode } from './off.js';
import { LABEL_NUTRIENTS, STATUS_LABEL, SOURCES as PRODUCT_SOURCES, searchProducts, productToFood, fromIndexRow, indexRow } from './products.js';
import { loadLibrary, getProduct, findByGtin, rememberProduct, resetLibrary } from './library.js';
import { EQ_SOURCE, EQ_HOW, EQ_GROUPS, EQ_TIP, EQ_SECTIONS, EQ_FOOTNOTE } from './equivalencias.js';

const $ = (sel, root = document) => root.querySelector(sel);
const view = $('#view');
const topbar = $('#topbar');
const sheet = $('#sheet');

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const planSlots = () => (state.plan.meals?.length ? state.plan.meals : MEALS);
const mealLabel = (id) => MEALS.find((m) => m.id === id)?.label ?? planSlots().find((m) => m.id === id)?.label ?? id;
const icons = {
  left: '<svg viewBox="0 0 24 24"><path d="M15 6l-6 6 6 6"/></svg>',
  right: '<svg viewBox="0 0 24 24"><path d="M9 6l6 6-6 6"/></svg>',
  close: '<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18"/></svg>',
  back: '<svg viewBox="0 0 24 24"><path d="M15 6l-6 6 6 6"/></svg>',
};

const state = {
  tab: 'diary',
  date: localDate(),
  base: [],
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
  plan: { items: [] },
  profile: {},
  water: {},
  shopping: { days: 7, checked: [] },
};

// ---------- carga ----------

async function load() {
  const data = (f) => fetch(`data/${f}`).then((r) => r.json());
  const [taco, receitas, usda, userFoods, goals, weights, favorites, recents, servings, lastBackup, firstUse, plan, profile, water, shopping] = await Promise.all([
    data('taco.json').then((list) => list.map((f) => ({ ...f, source: 'taco' }))),
    data('receitas.json'),
    data('usda.json'),
    db.getAll('foods'),
    db.getAll('goals'),
    db.getAll('weights'),
    db.kvGet('favorites', []),
    db.kvGet('recents', []),
    db.kvGet('servings', {}),
    db.kvGet('lastBackup', null),
    db.kvGet('firstUse', null),
    db.kvGet('plan', { items: [] }),
    db.kvGet('profile', null),
    db.kvGet('water', {}),
    db.kvGet('shopping', { days: 7, checked: [] }),
  ]);
  const base = [...receitas, ...taco, ...usda];
  // Dados do aluno moravam dentro do plano na versão anterior.
  Object.assign(state, { base, userFoods, goals, weights, favorites, recents, servings, lastBackup, firstUse, plan, profile: profile ?? plan.profile ?? {}, water, shopping });
  if (!firstUse) {
    state.firstUse = localDate();
    await db.kvSet('firstUse', state.firstUse);
  }
  indexFoods();
}

function indexFoods() {
  const active = state.userFoods.filter((f) => !f.deletedAt);
  state.foods = [...active, ...state.base];
  for (const f of state.foods) f._norm ??= normalize(f.name + ' ' + (f.brand ?? ''));
  state.foodsById = new Map([...state.userFoods, ...state.base].map((f) => [f.id, f]));
}

// ---------- navegação ----------

// Menu lateral: botão de três linhas no topo abre a gaveta, que vem da esquerda.
const drawer = $('#drawer');
const drawerBackdrop = $('#drawer-backdrop');

function openDrawer() {
  const p = state.profile;
  $('#drawer-head').innerHTML = `<span class="avatar lg">${p.photo ? `<img src="${esc(p.photo)}" alt="">` : `<span>${esc((p.name || '?').trim().charAt(0).toUpperCase() || '?')}</span>`}</span>
    <span class="drawer-name">${esc(p.name || 'Toque para preencher seu perfil')}</span>`;
  $('[data-needs-plan]', drawer).hidden = !hasDiet();
  for (const b of drawer.querySelectorAll('.drawer-list [data-tab]')) {
    if (b.dataset.tab === state.tab) b.setAttribute('aria-current', 'page');
    else b.removeAttribute('aria-current');
  }
  drawerBackdrop.hidden = false;
  drawer.inert = false;
  drawer.setAttribute('aria-hidden', 'false');
  requestAnimationFrame(() => { document.body.classList.add('drawer-open'); });
  drawer.querySelector('[aria-current]')?.focus();
}

function closeDrawer() {
  document.body.classList.remove('drawer-open');
  drawer.inert = true;
  drawer.setAttribute('aria-hidden', 'true');
  setTimeout(() => { if (!document.body.classList.contains('drawer-open')) drawerBackdrop.hidden = true; }, 250);
}

function go(tab) {
  state.tab = tab;
  closeDrawer();
  render();
  window.scrollTo(0, 0);
}

drawer.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-tab]');
  if (btn) go(btn.dataset.tab);
});
drawerBackdrop.addEventListener('click', closeDrawer);
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && document.body.classList.contains('drawer-open')) closeDrawer(); });
topbar.addEventListener('click', (e) => { if (e.target.closest('[data-menu]')) openDrawer(); });
// Arrastar da gaveta para a esquerda fecha.
let touchX = null;
drawer.addEventListener('touchstart', (e) => { touchX = e.touches[0].clientX; }, { passive: true });
drawer.addEventListener('touchend', (e) => {
  if (touchX !== null && touchX - e.changedTouches[0].clientX > 60) closeDrawer();
  touchX = null;
});

async function render() {
  const renderers = { diary: renderDiary, plan: renderPlan, weight: renderWeight, foods: renderFoods, settings: renderSettings, faq: renderFaq, about: renderAbout, eq: renderEquivalences, shopping: renderShopping };
  view.oninput = null;
  view.onchange = null;
  if (state.tab === 'shopping' && !hasDiet()) state.tab = 'plan';
  await renderers[state.tab]();
}

const MENU_BTN = '<button class="icon-btn menu-btn" data-menu aria-label="Abrir menu"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16"/></svg></button>';

function setTopbar(html) {
  topbar.innerHTML = `${MENU_BTN}<div class="topbar-main">${html}</div><span class="topbar-spacer" aria-hidden="true"></span>`;
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
    ${waterHTML()}
    <p class="muted small" style="text-align:center;margin-top:18px">Valores aproximados. Não substitui orientação de nutricionista ou médico.</p>`;

  view.onclick = (e) => {
    const add = e.target.closest('[data-add-meal]');
    if (add) return openAdd(add.dataset.addMeal);
    const row = e.target.closest('[data-entry]');
    if (row) return openEntry(entries.find((x) => x.id === row.dataset.entry));
    if (e.target.closest('[data-go-settings]')) return go('about');
    const water = e.target.closest('[data-water]');
    if (water) return addWater(Number(water.dataset.water));
    if (e.target.closest('[data-go-weight]')) return go('weight');
  };
}

// ---------- hidratação ----------

// Meta: 40 ml por kg do último peso registrado no app (tela Peso ou Perfil). Sem peso, sem meta.
const WATER_ML_PER_KG = 40;

function waterGoal() {
  const kg = latestWeight();
  return kg ? Math.round(kg * WATER_ML_PER_KG) : null;
}

const liters = (ml) => fmt(ml / 1000, 2);

function waterHTML() {
  const ml = state.water[state.date] ?? 0;
  const goal = waterGoal();
  const pct = goal ? Math.round((ml / goal) * 100) : 0;
  const left = goal ? goal - ml : 0;
  const drop = '<svg class="water-art" viewBox="0 0 120 120" aria-hidden="true"><path d="M44 18c-6 20-28 34-28 58a28 28 0 0 0 56 0c0-24-22-38-28-58z"/><path d="M84 8c-4 16-12 24-16 30m16-30c5 20 30 34 30 62a30 30 0 0 1-50 22"/></svg>';
  return `<section class="card water" aria-label="Água">
    ${drop}
    <p class="water-kicker">${state.date === localDate() ? 'Hoje' : esc(parseLocalDate(state.date).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }))} · Água</p>
    <p class="water-total"><b>${liters(ml)}</b> L${goal ? ` <span>de ${liters(goal)} L</span>` : ''}</p>
    <div class="water-bar"><i style="width:${Math.min(pct, 100)}%"></i></div>
    <p class="water-left">${!goal ? 'Registre seu peso em <b>Peso</b> para calcular sua meta (40 ml por kg).' : left > 0 ? `Faltam ${liters(left)} L · ${pct}% da meta` : `Meta batida! ${pct}% da meta`}</p>
    <div class="water-btns">
      <button data-water="250">+ 250 ml</button><button data-water="500">+ 500 ml</button><button data-water="1000">+ 1 L</button>
    </div>
    <div class="water-foot">
      <button class="link" data-water="-250"${ml ? '' : ' disabled'}>− Desfazer 250 ml</button>
      ${goal ? `<span class="water-rule">40 ml × ${fmt(latestWeight())} kg</span>` : '<button class="link" data-go-weight>Registrar peso</button>'}
    </div>
  </section>`;
}

async function addWater(ml) {
  const next = Math.max(0, (state.water[state.date] ?? 0) + ml);
  state.water = { ...state.water, [state.date]: next };
  await db.kvSet('water', state.water);
  const card = $('.water', view);
  if (card) card.outerHTML = waterHTML();
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
      ${macro('fiber', 'Fibras')}
      ${!goal ? '<p class="small muted" style="margin:6px 0 0">Defina suas metas em Minha Dieta.</p>' : ''}
    </div>
  </div>
  ${['carbs', 'protein', 'fat'].some((k) => missing[k]) ? '<p class="small warn" style="margin:10px 0 0">* Total incompleto: algum alimento não informa esse nutriente.</p>' : ''}`;
}

// "P 12 g · C 30 g · G 5 g" a partir de nutrientes (null vira "–").
function macroLine(n, digits = 1) {
  return `<span class="macros"><b class="p">P</b> ${fmt(n.protein, digits)} g · <b class="c">C</b> ${fmt(n.carbs, digits)} g · <b class="g">G</b> ${fmt(n.fat, digits)} g</span>`;
}

function mealHTML(meal, entries) {
  const { totals } = sumTotals(entries);
  return `<section class="card" aria-label="${esc(meal.label)}">
    <div class="card-head">
      <h2>${esc(meal.label)} <span class="muted small" style="font-weight:400">${entries.length ? `${fmt(totals.kcal, 0)} kcal` : ''}</span></h2>
      <button class="add-btn" data-add-meal="${meal.id}" aria-label="Adicionar em ${esc(meal.label)}">+ Adicionar</button>
    </div>
    ${entries.length ? `<p class="meal-total small">Total da refeição: ${macroLine(totals)}</p>
    <ul class="list">${entries.map((e) => `<li><button class="row" data-entry="${e.id}">
        <span class="grow"><span class="name">${esc(e.label)}</span>
        <span class="muted small">${entryDetail(e)}</span>
        <span class="small">${macroLine(e.nutrients)}</span></span>
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

// mode 'diary' lança no dia aberto; mode 'plan' adiciona ao plano de dieta.
function openAdd(mealType, initial = { query: '', filter: 'recent' }, mode = 'diary') {
  const ui = { online: null, ...initial };
  const back = () => openAdd(mealType, ui, mode);
  const detail = (food) => openFoodDetail(food, { mealType, back, mode });
  openSheet({
    title: `${mode === 'plan' ? 'Plano' : 'Adicionar'}: ${mealLabel(mealType)}`,
    body: `
      <input class="search" type="search" placeholder="Buscar alimentos, pratos e marcas" autocomplete="off" value="${esc(ui.query)}" aria-label="Buscar alimento ou produto de marca">
      <div class="chips" role="group" aria-label="Filtro">
        <button class="chip" data-filter="recent">Recentes</button>
        <button class="chip" data-filter="fav">Favoritos</button>
        <button class="chip" data-filter="dishes">Pratos prontos</button>
        <button class="chip" data-filter="mine">Meus alimentos</button>
      </div>
      <div class="btn-row">
        ${mode === 'diary' ? '<button class="btn small" data-quick>Lançamento rápido</button>' : ''}
        <button class="btn small" data-new-food>Novo alimento</button>
        <button class="btn small" data-barcode>Código de barras</button>
      </div>
      <ul class="list" id="results"></ul>
      <div id="online"></div>`,
    onMount(body) {
      const input = $('.search', body);
      const results = $('#results', body);
      const online = $('#online', body);
      const drawOnline = () => {
        const q = ui.query.trim();
        if (!q) { online.innerHTML = ''; return; }
        if (!ui.online || ui.online.query !== q) {
          online.innerHTML = `<button class="btn small block" data-online>Buscar "${esc(q)}" em produtos de marca (online)</button>
            <p class="small muted" style="margin:6px 0 0">Consulta o Open Food Facts pela internet. Só o termo buscado é enviado.</p>`;
          return;
        }
        const r = ui.online;
        online.innerHTML = `<h3 class="section-title">Produtos de marca · Open Food Facts (online)</h3>` + (r.loading ? '<p class="empty">Buscando…</p>'
          : r.error ? `<p class="empty">${esc(r.error)}</p>`
          : r.items.length ? `<ul class="list">${r.items.map((p, i) => productRowHTML(fromIndexRow(indexRow(p)), `data-off="${i}"`)).join('')}</ul>`
          : '<p class="empty">Nenhum produto encontrado.</p>');
      };
      const draw = () => {
        let list;
        const q = ui.query.trim();
        for (const c of body.querySelectorAll('[data-filter]')) c.setAttribute('aria-pressed', String(!q && c.dataset.filter === ui.filter));
        if (q) {
          drawOnline();
          unifiedSearch(q).then((found) => {
            if (ui.query.trim() !== q) return;
            ui.libItems = [];
            results.innerHTML = found.length ? unifiedRowsHTML(found, ui.libItems)
              : '<li class="empty">Nada encontrado. Tente outra palavra, busque online abaixo ou cadastre o alimento.</li>';
          });
          return;
        }
        if (ui.filter === 'fav') list = state.favorites.map((id) => state.foodsById.get(id));
        else if (ui.filter === 'mine') list = state.userFoods.filter((f) => !f.deletedAt).sort((a, b) => a.name.localeCompare(b.name));
        else if (ui.filter === 'dishes') list = state.base.filter((f) => f.source === 'receita');
        else list = state.recents.map((id) => state.foodsById.get(id));
        list = list.filter((f) => f && !f.deletedAt);
        const emptyMsg = ui.filter === 'fav' ? 'Marque alimentos com a estrela para vê-los aqui.'
          : ui.filter === 'mine' ? 'Você ainda não cadastrou alimentos.'
          : 'Busque um alimento para começar.';
        results.innerHTML = list.length ? list.map((f) => foodRowHTML(f)).join('') : `<li class="empty">${emptyMsg}</li>`;
        drawOnline();
      };
      input.addEventListener('input', () => { ui.query = input.value; draw(); });
      body.onclick = async (e) => {
        const f = e.target.closest('[data-filter]');
        if (f) { ui.filter = f.dataset.filter; ui.query = ''; input.value = ''; draw(); return; }
        const off = e.target.closest('[data-off]');
        if (off) return openProduct(await rememberProduct(ui.online.items[Number(off.dataset.off)]), { mealType, back, mode });
        const lib = e.target.closest('[data-lib]');
        if (lib) return openProductById(ui.libItems[Number(lib.dataset.lib)].id, { mealType, back, mode });
        const row = e.target.closest('[data-food]');
        if (row) return detail(state.foodsById.get(row.dataset.food));
        if (e.target.closest('[data-online]')) {
          const query = ui.query.trim();
          ui.online = { query, loading: true, items: [] };
          drawOnline();
          try {
            ui.online = { query, items: await searchOnline(query) };
          } catch {
            ui.online = { query, items: [], error: 'Sem conexão com o Open Food Facts agora. Tente de novo mais tarde.' };
          }
          if (ui.query.trim() === query) drawOnline();
          return;
        }
        if (e.target.closest('[data-barcode]')) return openBarcode({ mealType, back, mode });
        if (e.target.closest('[data-quick]')) return openQuick({ mealType, back });
        if (e.target.closest('[data-new-food]')) return openFoodForm({ name: ui.query }, { afterSave: detail, back });
      };
      draw();
      if (!matchMedia('(pointer: coarse)').matches || !ui.query) input.focus();
    },
  });
}

function foodRowHTML(f, attr = `data-food="${esc(f.id)}"`) {
  const tag = f.source === 'user' ? '<span class="badge">meu</span>' : f.source === 'off' ? '<span class="badge">marca</span>' : f.source === 'receita' ? '<span class="badge">prato</span>' : '';
  return `<li><button class="row" ${attr}>
    <span class="grow"><span class="name">${esc(f.name)}${f.brand ? ` <span class="muted">· ${esc(f.brand)}</span>` : ''}${tag}</span>
    <span class="muted small">${esc(f.group ?? 'Meus alimentos')} · ${esc(sourceLabel(f))}</span></span>
    <span class="num small muted">${kcalLabel(f)}</span></button></li>`;
}

// Busca única: alimentos (TACO, pratos, USDA, meus) e produtos de marca da biblioteca na mesma lista,
// ordenados pela mesma régua de semelhança com o que foi digitado.
function textScore(name, q) {
  const n = normalize(name ?? '');
  const qn = normalize(q);
  const words = n.split(' ');
  let s = n.startsWith(qn) ? 30 : 0;
  for (const t of qn.split(' ').filter(Boolean)) s += words.some((w) => w.startsWith(t)) ? 10 : n.includes(t) ? 3 : 0;
  return s - n.length / 25;
}

async function unifiedSearch(q, limit = 60) {
  const foods = searchFoods(state.foods, q, { favorites: state.favorites, recents: state.recents, limit }).filter((f) => !f.deletedAt);
  const lib = await loadLibrary();
  const saved = new Set(foods.filter((f) => f.barcode).map((f) => String(f.barcode)));
  const prods = searchProducts(lib.items, q, { limit }).filter((r) => !saved.has(String(r.gtin ?? '')));
  const fav = new Set(state.favorites);
  const rec = new Set(state.recents);
  return [
    ...foods.map((f, i) => ({ f, s: textScore(f.name, q) + (fav.has(f.id) ? 20 : 0) + (rec.has(f.id) ? 8 : 0) + (f.source === 'taco' || f.source === 'receita' ? 4 : 0) - i * 0.05 })),
    ...prods.map((r, i) => ({ r, s: textScore(r.name, q) + (normalize(r.brand ?? '') && normalize(q).includes(normalize(r.brand ?? '')) ? 8 : 0) - i * 0.05 })),
  ].sort((a, b) => b.s - a.s).slice(0, limit);
}

// Linhas da busca única. `libItems` recebe os produtos, para o clique achar o item pelo índice.
function unifiedRowsHTML(list, libItems) {
  return list.map((x) => {
    if (x.f) return foodRowHTML(x.f);
    libItems.push(x.r);
    return productRowHTML(x.r, `data-lib="${libItems.length - 1}"`);
  }).join('');
}

// ---------- biblioteca de produtos ----------

const STATUS_CLASS = { completo: 'ok', parcial: 'part', pendente: 'pend' };

function statusHTML(status) {
  return `<span class="status status-${STATUS_CLASS[status] ?? 'pend'}">${esc(STATUS_LABEL[status] ?? 'Tabela pendente')}</span>`;
}

// Linha de resultado: marca, embalagem, status da tabela e fonte. Cada GTIN é uma linha.
function productRowHTML(r, attr) {
  const meta = [r.quantity?.raw ? `embalagem ${r.quantity.raw}` : 'embalagem não informada', r.onDevice ? 'consultado online' : 'Open Food Facts'];
  return `<li><button class="row" ${attr}>
    <span class="grow"><span class="name">${esc(r.name ?? 'Produto sem nome')}${r.brand ? ` <span class="muted">· ${esc(r.brand)}</span>` : ' <span class="muted">· marca não informada</span>'}<span class="badge">marca</span></span>
    <span class="muted small">${meta.map(esc).join(' · ')}</span> ${statusHTML(r.status)}</span>
    <span class="num small muted">${r.kcal100 != null ? `${fmt(r.kcal100, 0)} kcal/100${r.baseUnit ?? 'g'}` : r.kcalServing != null ? `${fmt(r.kcalServing, 0)} kcal/porção` : 'kcal não informada'}</span></button></li>`;
}

const ALLERGENS_PT = {
  milk: 'leite', gluten: 'glúten', soybeans: 'soja', eggs: 'ovos', nuts: 'castanhas', peanuts: 'amendoim', fish: 'peixe',
  crustaceans: 'crustáceos', molluscs: 'moluscos', 'sesame seeds': 'gergelim', mustard: 'mostarda', celery: 'aipo',
  lupin: 'tremoço', 'sulphur dioxide and sulphites': 'sulfitos', latex: 'látex',
};

function nutrientValue(v, key) {
  if (!v) return '<span class="muted">não informado</span>';
  // Sódio chega em g; mostramos em mg, como no rótulo brasileiro.
  if (key === 'sodium') return `${fmt(v.value * 1000, 0)} mg`;
  return `${fmt(v.value, key.startsWith('energy') ? 0 : 2)} ${esc(v.unit)}`;
}

function dateBR(iso) {
  return iso ? new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }) : 'não informada';
}

async function openProductById(id, ctx) {
  const p = await getProduct(id);
  if (!p) return toast('Produto não encontrado na biblioteca.');
  openProduct(p, ctx);
}

function openProduct(p, { mealType = defaultMeal(), back, mode = 'diary' } = {}) {
  const nut = p.nutrition ?? {};
  const per100 = nut.per100;
  const serving = nut.perServing;
  const unit = per100?.unit ?? serving?.unit ?? 'g';
  const servingHead = serving ? `por porção${serving.description ? `<br><span class="muted small">${esc(serving.description)}</span>` : ''}` : 'por porção';
  const labelCol = { serving: 'por porção', '100g': `por 100 ${unit}`, both: `por 100 ${unit} e por porção` }[nut.basisOnLabel] ?? null;
  const SET_SOURCES = { packaging: 'embalagem', manufacturer: 'fabricante', database: 'outra base de dados' };
  const computed = nut.computedBySource === 'per100' ? `por 100 ${unit}` : nut.computedBySource === 'perServing' ? 'por porção' : null;
  const prov = p.provenance[0];
  const src = PRODUCT_SOURCES[prov.source] ?? { name: prov.source };
  const food = productToFood(p);
  const q = p.quality;
  // kJ e açúcares adicionados só aparecem quando a fonte trouxe (rótulos antigos não tinham).
  const rows = LABEL_NUTRIENTS.filter((x) => !['addedSugars', 'energyKj'].includes(x.key) || per100?.values?.[x.key] || serving?.values?.[x.key]);
  const allergens = p.allergens?.length ? p.allergens.map((a) => ALLERGENS_PT[a] ?? a).join(', ') : null;
  openSheet({
    title: 'Produto',
    back,
    body: `
      <h3 style="margin:12px 0 2px">${esc(p.name ?? 'Produto sem nome')}</h3>
      <p class="small" style="margin:0">${p.brand ? `Marca: <b>${esc(p.brand)}</b>` : '<span class="muted">Marca não informada</span>'}${p.kind === 'generico' ? ' · alimento genérico' : ''}</p>
      <p class="small muted" style="margin:2px 0 0">Embalagem: ${p.quantity?.raw ? esc(p.quantity.raw) : 'não informada'}
        · ${p.gtin ? `GTIN ${esc(p.gtin)}` : `código ${esc(prov.ref)} (não é GTIN válido)`}${p.category ? ` · ${esc(p.category)}` : ''}</p>
      <p style="margin:8px 0 0">${statusHTML(q.status)} <span class="badge">${esc(src.name)}</span></p>
      <table class="nutri-table prod-table">
        <thead><tr><th></th><th>por 100 ${esc(unit)}</th><th>${servingHead}</th></tr></thead>
        <tbody>${rows.map((x) => `<tr><td>${esc(x.label)}${x.unit === 'kJ' ? ' (kJ)' : ''}</td>
          <td>${nutrientValue(per100?.values?.[x.key], x.key)}</td><td>${nutrientValue(serving?.values?.[x.key], x.key)}</td></tr>`).join('')}</tbody>
      </table>
      ${serving?.quantity ? `<p class="small muted recipe">Porção declarada: ${fmt(serving.quantity, 1)} ${esc(serving.unit ?? unit)}.</p>` : '<p class="small muted recipe">Porção do rótulo não informada pela fonte.</p>'}
      <p class="small muted recipe">${labelCol ? `Coluna informada no rótulo: ${esc(labelCol)}.` : 'A fonte não informa qual coluna veio do rótulo.'}
        ${computed ? ` A coluna ${esc(computed)} foi calculada pela própria fonte a partir da porção.` : ''}</p>
      ${q.status === 'parcial' ? `<p class="small warn recipe">Não informado pela fonte: ${q.missing.map((k) => esc(LABEL_NUTRIENTS.find((x) => x.key === k).label.toLowerCase())).join(', ')}.</p>` : ''}
      ${q.status === 'pendente' ? `<p class="small warn recipe">${nut.noDataOnPackaging ? 'A fonte registra que a embalagem não traz tabela nutricional.' : 'Tabela nutricional pendente: a fonte não tem os valores deste produto.'} Nada foi estimado.</p>` : ''}
      ${p.divergences?.length ? `<h3 class="section-title">Divergência entre fontes</h3><ul class="small">${p.divergences.map((d) => `<li>${esc(LABEL_NUTRIENTS.find((x) => x.key === d.nutrient).label)} (${d.column === 'per100' ? 'por 100' : 'por porção'}): ${d.values.map((v) => `${esc(PRODUCT_SOURCES[v.source]?.name ?? v.source)} ${fmt(v.value, 2)}`).join(' × ')}</li>`).join('')}</ul>` : ''}
      <h3 class="section-title">Ingredientes</h3>
      <p class="small" style="margin:0">${p.ingredients ? esc(p.ingredients) : '<span class="muted">não informado</span>'}</p>
      <p class="small" style="margin:6px 0 0">Alérgenos: ${allergens ? esc(allergens) : '<span class="muted">não informado</span>'}</p>
      <h3 class="section-title">Fonte dos dados</h3>
      <ul class="small prov">
        <li>${esc(src.name)} · código ${esc(prov.ref)}${prov.url ? ` · <a href="${esc(prov.url)}" target="_blank" rel="noopener">ver na fonte</a>` : ''}</li>
        <li>${prov.via === 'api' ? 'Consultado online' : 'Importado'} em ${dateBR(prov.fetchedAt)} · última alteração na fonte: ${dateBR(prov.sourceModifiedAt)}</li>
        <li>Licença: ${esc(prov.license ?? 'não informada')}</li>
        <li>Verificação: ${esc(prov.verification ?? 'não informada')}</li>
        ${nut.setSources?.length ? `<li>Origem dos valores na fonte: ${nut.setSources.map((x) => esc(SET_SOURCES[x] ?? x)).join(', ')}</li>` : ''}
        ${prov.missingSince ? `<li class="warn">Não apareceu na importação de ${dateBR(prov.missingSince)}; dados mantidos da versão anterior.</li>` : ''}
        ${p.history?.length ? `<li>${p.history.length} versão(ões) anterior(es) guardada(s): ${p.history.map((h) => `${dateBR(h.provenance[0].fetchedAt)} (${fmt(h.nutrition?.per100?.values?.energyKcal?.value, 0)} kcal/100)`).join('; ')}</li>` : ''}
      </ul>
      <p class="small muted">Confira com o rótulo da embalagem que você tem em mãos: sabores e tamanhos diferentes têm tabelas próprias.</p>
      <div class="btn-row">
        ${prov.source === 'off' && p.gtin ? '<button class="btn" data-refresh>Atualizar pela internet</button>' : ''}
        <button class="btn primary" data-use ${food ? '' : 'disabled'}>${mode === 'plan' ? 'Usar no plano' : 'Usar no diário'}</button>
      </div>
      ${food ? '' : '<p class="small muted">A fonte não tem valores deste produto, então ele não pode ser lançado. Cadastre-o em "Novo alimento" com os valores do seu rótulo.</p>'}
      ${food?.baseUnit === 'porção' ? '<p class="small muted">O rótulo na fonte só traz a coluna por porção: no diário, este produto é lançado em porções, sem conversão para gramas.</p>' : ''}`,
    onMount(body) {
      body.onclick = async (e) => {
        if (e.target.closest('[data-use]') && food) {
          return openFoodDetail(state.foodsById.get(food.id) ?? food, { mealType, back: () => openProduct(p, { mealType, back, mode }), mode });
        }
        if (e.target.closest('[data-refresh]')) {
          try {
            const fresh = await productByBarcode(p.gtin);
            if (!fresh) return toast('A fonte não tem mais este produto. A versão guardada continua.');
            const merged = await rememberProduct(fresh);
            toast(merged.history?.length > (p.history?.length ?? 0) ? 'Atualizado. A versão anterior ficou no histórico.' : 'Sem mudanças na fonte.');
            openProduct(merged, { mealType, back, mode });
          } catch {
            toast('Sem conexão com o Open Food Facts agora.');
          }
        }
      };
    },
  });
}

// ---------- código de barras ----------

function openBarcode({ mealType, back, mode }) {
  const scan = canScan();
  openSheet({
    title: 'Código de barras',
    back,
    body: `
      ${scan ? '<div class="scanner"><video playsinline muted></video><p class="small muted">Aponte a câmera para o código de barras.</p></div>' : '<p class="small muted">Este navegador não lê código pela câmera. Digite os números que ficam embaixo das barras.</p>'}
      <label class="field">Número do código<input name="code" inputmode="numeric" pattern="[0-9]*" placeholder="7891000100103"></label>
      <div class="btn-row"><button class="btn primary" data-lookup>Buscar produto</button></div>
      <p class="small muted" id="bc-status" style="margin:10px 0 0">Procura primeiro na biblioteca do app e depois no Open Food Facts, base aberta mantida por colaboradores. Confira os valores com o rótulo.</p>`,
    onMount(body) {
      const status = $('#bc-status', body);
      let stop = null;
      const lookup = async (code) => {
        code = String(code).replace(/\D/g, '');
        if (code.length < 8) return toast('Digite o código completo (8 a 14 números).');
        status.textContent = 'Buscando…';
        const local = await findByGtin(code);
        if (local) { stop?.(); return openProduct(local, { mealType, back, mode }); }
        try {
          const product = await productByBarcode(code);
          if (!product) { status.textContent = 'Produto não encontrado na biblioteca nem no Open Food Facts. Você pode cadastrá-lo em "Novo alimento" com os valores do rótulo.'; return; }
          stop?.();
          openProduct(await rememberProduct(product), { mealType, back, mode });
        } catch {
          status.textContent = 'Não está na biblioteca do app e não houve conexão com o Open Food Facts. Tente de novo mais tarde.';
        }
      };
      if (scan) {
        stop = scanBarcode($('video', body), (code) => { $('[name="code"]', body).value = code; lookup(code); }, () => {
          status.textContent = 'Não foi possível abrir a câmera. Digite o número do código.';
        });
        sheet.addEventListener('close', () => stop?.(), { once: true });
      }
      body.onclick = (e) => { if (e.target.closest('[data-lookup]')) lookup($('[name="code"]', body).value); };
    },
  });
}

// ---------- detalhe do alimento (adicionar ou editar lançamento) ----------

// Produto vindo da busca online vira "meu alimento" (source 'off') na primeira vez que é usado,
// para ficar disponível offline e no histórico.
async function ensureStored(food) {
  if (food.source !== 'off' || state.foodsById.has(food.id)) return state.foodsById.get(food.id) ?? food;
  await db.put('foods', { ...stripRuntime(food), createdAt: Date.now(), updatedAt: Date.now() });
  state.userFoods = await db.getAll('foods');
  indexFoods();
  return state.foodsById.get(food.id);
}

function sourceHTML(food) {
  const parts = [sourceLabel(food)];
  if (food.group) parts.push(food.group);
  if (food.barcode) parts.push(`código ${food.barcode}`);
  let note = '';
  if (food.source === 'receita') note = `<p class="small muted recipe">Calculado a partir de: ${esc(food.recipe)}. Receita caseira típica; o seu preparo pode variar.</p>`;
  if (food.source === 'off') note = '<p class="small muted recipe">Dados do Open Food Facts (ODbL), enviados por colaboradores. Confira com o rótulo.</p>'
    + `<button class="btn small" data-product="${esc(food.productId ?? `gtin:${food.barcode}`)}">Embalagem, rótulo e fonte</button>`;
  if (food.source === 'usda' || food.source === 'tempo') note = '<p class="small muted recipe">Base americana (USDA) com nome traduzido. Prefira o item da TACO quando houver.</p>';
  return `<p class="small muted" style="margin:4px 0 0">${parts.map(esc).join(' · ')} · ${esc(kcalLabel(food))}</p>${note}`;
}

function openFoodDetail(food, { mealType, entry, back, mode = 'diary', planItem }) {
  const unit = baseUnit(food);
  const saved = () => state.servings[food.id] ?? [];
  let options = servingOptions(food, saved());
  const current = entry ?? planItem;
  const sel = { quantity: current?.quantity ?? (unit === 'porção' ? 1 : 100), servingId: current?.servingId ?? unit, mealType: current?.mealType ?? mealType };
  // Sem lançamento anterior, começa pela primeira porção (salva ou medida caseira).
  if (!current && options.length > 1) { sel.servingId = options[1].id; sel.quantity = 1; }
  // Porção usada no lançamento foi apagada: volta para a quantidade em g/ml.
  if (current && !options.some((o) => o.id === sel.servingId)) { sel.servingId = unit; sel.quantity = current.amount; }
  const isFav = () => state.favorites.includes(food.id);

  openSheet({
    title: mode === 'plan' ? (planItem ? 'Editar item do plano' : 'Adicionar ao plano') : entry ? 'Editar lançamento' : 'Adicionar',
    back,
    body: `
      <div class="card-head" style="margin-top:12px">
        <h3>${esc(food.name)}${food.brand ? ` <span class="muted">· ${esc(food.brand)}</span>` : ''}</h3>
        <button class="icon-btn star" data-fav aria-pressed="${isFav()}" aria-label="Favorito">${isFav() ? '★' : '☆'}</button>
      </div>
      ${sourceHTML(food)}
      <div class="grid2">
        <label class="field">Quantidade<input type="number" inputmode="decimal" min="0" step="any" name="quantity" value="${esc(sel.quantity)}"></label>
        <label class="field">Unidade<select name="serving"></select></label>
      </div>
      ${unit === 'porção' ? '' : `<button class="btn small" data-new-serving style="margin-top:8px">+ Salvar uma porção (ex.: 1 unidade = 120 ${unit})</button>`}
      <div id="serving-form" hidden>
        <div class="grid2">
          <label class="field">Nome da porção<input name="sLabel" placeholder="1 unidade média"></label>
          <label class="field">Equivale a (${unit})<input name="sAmount" type="number" inputmode="decimal" min="0" step="any"></label>
        </div>
        <div class="btn-row"><button class="btn small" data-save-serving>Salvar porção</button></div>
      </div>
      <label class="field">Refeição<select name="meal">${(mode === 'plan' ? planSlots() : MEALS).map((m) => `<option value="${m.id}"${m.id === sel.mealType ? ' selected' : ''}>${esc(m.label)}</option>`).join('')}</select></label>
      ${entry ? `<label class="field">Data<input type="date" name="date" value="${esc(entry.date)}"></label>` : ''}
      <table class="nutri-table" id="preview"></table>
      <div class="btn-row">
        ${current ? '<button class="btn danger" data-delete>Excluir</button>' : ''}
        <button class="btn primary" data-save>${current ? 'Salvar' : 'Adicionar'}</button>
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
        const prod = e.target.closest('[data-product]');
        if (prod) return openProductById(prod.dataset.product, { mealType, back: () => openFoodDetail(food, { mealType, entry, back, mode, planItem }), mode });
        if (e.target.closest('[data-fav]')) {
          food = await ensureStored(food);
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
          food = await ensureStored(food);
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
          if (planItem) {
            await savePlan({ ...state.plan, items: state.plan.items.filter((x) => x.id !== planItem.id) });
            sheet.close();
            toast('Item removido do plano.');
            return render();
          }
          await db.remove('entries', entry.id);
          sheet.close();
          toast('Lançamento excluído.');
          return render();
        }
        if (e.target.closest('[data-save]')) {
          const serving = options.find((o) => o.id === s.value);
          if (!(entryAmount(q.value, serving) > 0)) return toast('Informe uma quantidade maior que zero.');
          food = await ensureStored(food);
          if (mode === 'plan') {
            const item = {
              id: planItem?.id ?? uid(), foodId: food.id, mealType: $('[name="meal"]', body).value,
              quantity: Number(q.value), servingId: serving.id, servingName: serving.id === unit ? unit : serving.name, amount: serving.amount,
            };
            const items = planItem ? state.plan.items.map((x) => (x.id === item.id ? item : x)) : [...state.plan.items, item];
            await savePlan({ ...state.plan, items });
            sheet.close();
            toast(planItem ? 'Plano atualizado.' : `Adicionado ao plano: ${mealLabel(item.mealType)}.`);
            return render();
          }
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

// ---------- plano de dieta ----------

async function savePlan(plan) {
  state.plan = plan;
  await db.kvSet('plan', plan);
}

async function saveProfile(profile) {
  state.profile = profile;
  await db.kvSet('profile', profile);
}

function latestWeight() {
  return [...state.weights].sort((a, b) => a.date.localeCompare(b.date)).at(-1)?.kg ?? null;
}

function planTotals(items) {
  const rows = items.map((item) => {
    const food = state.foodsById.get(item.foodId);
    return food ? { item, food, n: planItemNutrients(food, item) } : null;
  }).filter(Boolean);
  return { rows, ...sumTotals(rows.map((r) => ({ nutrients: r.n }))) };
}

function amountText(item, food) {
  const total = `${fmt(item.quantity * item.amount, 0)} ${baseUnit(food)}`;
  return item.servingName === baseUnit(food) ? total : `${fmt(item.quantity)} × ${item.servingName} · ${total}`;
}

// Gramas do cardápio gerado viram medida caseira quando a conta fecha (ex.: 100 g de ovo = 2 unidades).
function planItemFromGrams(food, slot, grams) {
  const base = { id: uid(), foodId: food.id, mealType: slot, quantity: grams, servingId: baseUnit(food), servingName: baseUnit(food), amount: 1 };
  for (const o of servingOptions(food).slice(1)) {
    const q = grams / o.amount;
    if (q >= 0.5 && q <= 6 && Math.abs(q * 2 - Math.round(q * 2)) < 0.08) {
      return { ...base, quantity: Math.round(q * 2) / 2, servingId: o.id, servingName: o.name, amount: o.amount };
    }
  }
  return base;
}

const PROFILE_FIELDS = ['sex', 'age', 'height', 'weight', 'refWeight', 'activity', 'objective', 'deficit', 'fatPct', 'trains', 'level', 'trainDays', 'trainType', 'trainTime',
  'workDays', 'workHours', 'workEffort', 'steps', 'wake', 'sleep', 'meals', 'health', 'intol', 'intolOther', 'prefer'];

// Situações em que o app não monta cardápio sozinho (regras de segurança dos parâmetros adaptativos).
const HEALTH = [
  { id: 'none', label: 'Nenhuma' },
  { id: 'pregnant', label: 'Gestante ou amamentando' },
  { id: 'kidney', label: 'Doença renal' },
  { id: 'diabetes', label: 'Diabetes com remédio ou insulina' },
  { id: 'eating', label: 'Transtorno alimentar (atual ou passado)' },
  { id: 'other', label: 'Outra condição em tratamento' },
];

function profileComplete(p) {
  const base = ['sex', 'age', 'height', 'weight', 'activity', 'objective', 'trains', 'wake', 'sleep', 'meals', 'workDays'].every((k) => p[k]);
  const work = p.workDays === '0' || (p.workHours && p.workEffort);
  return base && work && (p.trains === 'no' || ['level', 'trainDays', 'trainType', 'trainTime'].every((k) => p[k]));
}

function safetyBlock(p) {
  if (calcTargets(p)?.overflow) return 'Proteína e gordura passam da meta de calorias. Revise com um profissional antes de gerar o cardápio.';
  if (Number(p.age) > 0 && Number(p.age) < 18) return 'Para menores de 18 anos o cardápio precisa de acompanhamento de nutricionista. As metas acima são só referência.';
  if (p.health && p.health !== 'none') return 'Com essa condição de saúde, o cardápio precisa ser montado com um nutricionista ou médico. As metas acima são só referência; você ainda pode montar o seu à mão.';
  return null;
}

function renderPlan() {
  setTopbar('<h1>Minha Dieta</h1>');
  topbar.onclick = null;
  const p = { sex: 'm', activity: 'light', objective: 'maintain', wake: '07:00', sleep: '23:00', ...state.profile };
  if (!p.weight) p.weight = latestWeight() ?? '';
  const v = (x) => (x === null || x === undefined ? '' : x);
  const goal = goalFor(state.goals, localDate()) ?? {};
  const opt = (list, cur) => list.map((x) => `<option value="${x.id}"${x.id === cur ? ' selected' : ''}>${esc(x.label)}</option>`).join('');

  view.innerHTML = `
    <section class="card">
      <h2>1. Seu objetivo${state.profile.name ? `, ${esc(state.profile.name.split(' ')[0])}` : ''}</h2>
      <p class="small muted" style="margin:4px 0 0">Preencha tudo e o app calcula suas metas e monta um cardápio completo para você.</p>
      <div class="form-block">
        <h3>Seu corpo</h3>
        <div class="grid2">
          <label class="field">Sexo<select name="sex"><option value="m"${p.sex === 'm' ? ' selected' : ''}>Masculino</option><option value="f"${p.sex === 'f' ? ' selected' : ''}>Feminino</option></select></label>
          <label class="field">Idade<input name="age" type="number" inputmode="numeric" min="10" max="100" value="${esc(v(p.age))}"></label>
          <label class="field">Altura (cm)<input name="height" type="number" inputmode="numeric" min="100" max="230" value="${esc(v(p.height))}"></label>
          <label class="field">Peso (kg)<input name="weight" type="number" inputmode="decimal" min="30" max="300" step="0.1" value="${esc(v(p.weight))}"></label>
        </div>
        <label class="field">Peso de referência (kg, opcional)<input name="refWeight" type="number" inputmode="decimal" min="30" max="300" step="0.1" placeholder="Definido pelo nutricionista" value="${esc(v(p.refWeight))}"></label>
        <p class="small muted" style="margin:6px 0 0">Usado para a proteína. Importante quando o IMC passa de 30; deixe em branco se não tiver.</p>
      </div>
      <div class="form-block">
        <h3>Sua rotina</h3>
        <div class="grid2">
          <label class="field">Acordo às<input name="wake" type="time" value="${esc(v(p.wake))}"></label>
          <label class="field">Durmo às<input name="sleep" type="time" value="${esc(v(p.sleep))}"></label>
        </div>
        <label class="field">Refeições por dia<select name="meals"><option value="">Escolha</option>${opt(MEAL_COUNTS, p.meals)}</select></label>
      </div>
      <div class="form-block">
        <h3>Trabalho e movimento</h3>
        <label class="field">Dias por semana com esforço físico no trabalho<select name="workDays"><option value="">Escolha</option>${opt(WORK_DAYS, p.workDays)}</select></label>
        <div data-work ${p.workDays && p.workDays !== '0' ? '' : 'hidden'}>
          <div class="grid2">
            <label class="field">Horas em pé ou carregando peso<select name="workHours"><option value="">Escolha</option>${opt(WORK_HOURS, p.workHours)}</select></label>
            <label class="field">Esse esforço é<select name="workEffort"><option value="">Escolha</option>${opt(WORK_EFFORT, p.workEffort)}</select></label>
          </div>
        </div>
        <label class="field">Passos por dia (se souber)<input name="steps" type="number" inputmode="numeric" min="0" max="60000" step="500" placeholder="Ex.: 7000" value="${esc(v(p.steps))}"></label>
        <label class="field">Nível de atividade<select name="activity">${opt(ACTIVITY, p.activity)}</select></label>
        <p class="small muted" id="activity-hint" style="margin:6px 0 0"></p>
      </div>
      <div class="form-block">
        <h3>Treino</h3>
        <label class="field">Já treina?<select name="trains"><option value="">Escolha</option><option value="yes"${p.trains === 'yes' ? ' selected' : ''}>Sim, já treino</option><option value="no"${p.trains === 'no' ? ' selected' : ''}>Ainda não treino</option></select></label>
        <div data-train ${p.trains === 'yes' ? '' : 'hidden'}>
          <div class="grid2">
            <label class="field">Horário do treino<input name="trainTime" type="time" value="${esc(v(p.trainTime))}"></label>
            <label class="field">Vezes por semana<select name="trainDays"><option value="">Escolha</option>${opt(TRAIN_DAYS, p.trainDays)}</select></label>
          </div>
          <label class="field">Tipo de treino<select name="trainType"><option value="">Escolha</option>${opt(TRAIN_TYPES, p.trainType)}</select></label>
          <label class="field">Nível<select name="level"><option value="">Escolha</option>${opt(LEVELS, p.level)}</select></label>
          <p class="small muted" style="margin:6px 0 0">Pelo horário do treino o cardápio encaixa um pré-treino antes e um pós-treino depois.</p>
        </div>
      </div>
      <div class="form-block">
        <h3>Objetivo e saúde</h3>
        <label class="field">Objetivo<select name="objective">${opt(OBJECTIVES, p.objective)}</select></label>
        <label class="field" data-lose ${p.objective === 'lose' ? '' : 'hidden'}>Déficit de calorias<select name="deficit">${opt(DEFICITS, p.deficit ?? '15')}</select></label>
        <label class="field">Gordura na dieta<select name="fatPct">${opt(FAT_PCTS, p.fatPct ?? '')}</select></label>
        <label class="field">Alguma condição de saúde?<select name="health">${opt(HEALTH, p.health ?? 'none')}</select></label>
      </div>
      <div class="form-block">
        <h3>Alimentação</h3>
        <fieldset class="field-set">
          <legend>Intolerância ou alergia a algum alimento?</legend>
          <div class="chips">${INTOLERANCES.map((x) => `<label class="chip check"><input type="checkbox" name="intol" value="${x.id}"${(p.intol ?? []).includes(x.id) ? ' checked' : ''}> ${esc(x.label)}</label>`).join('')}</div>
          <label class="field">Outros que você não come<input name="intolOther" placeholder="Ex.: camarão, pimentão" value="${esc(v(p.intolOther))}"></label>
        </fieldset>
        <label class="field">Alimentos que você prefere<input name="prefer" placeholder="Ex.: frango, batata doce, banana, ovos" value="${esc(v(p.prefer))}"></label>
        <p class="small muted" style="margin:6px 0 0">Separe por vírgula. O cardápio tira o que você não come e coloca seus preferidos.</p>
      </div>
      <div id="targets"></div>
    </section>

    <section class="card">
      <div class="card-head"><h2>2. Seu cardápio</h2></div>
      <p class="small muted" style="margin:4px 0 0">Gere um cardápio automático pelas metas e horários, ou monte o seu. Toque num alimento para trocar a quantidade ou remover.</p>
      <div class="btn-row" id="gen-row"></div>
      <div id="plan-progress"></div>
    </section>
    <div id="plan-meals"></div>
    <details class="card goals-manual"><summary><b>Metas diárias (ajuste manual)</b></summary>

      <p class="small muted" style="margin:4px 0 0">Valem a partir de hoje; dias anteriores continuam com a meta da época.</p>
      <div class="grid2">
        <label class="field">Calorias (kcal)<input name="kcal" type="number" inputmode="numeric" min="0" value="${esc(v(goal.kcal))}"></label>
        <label class="field">Carboidratos (g)<input name="carbs" type="number" inputmode="numeric" min="0" value="${esc(v(goal.carbs))}"></label>
        <label class="field">Proteínas (g)<input name="protein" type="number" inputmode="numeric" min="0" value="${esc(v(goal.protein))}"></label>
        <label class="field">Gorduras (g)<input name="fat" type="number" inputmode="numeric" min="0" value="${esc(v(goal.fat))}"></label>
        <label class="field">Fibras (g)<input name="fiber" type="number" inputmode="numeric" min="0" value="${esc(v(goal.fiber))}"></label>
      </div>
      <p class="small muted" style="margin:6px 0 0">Não sabe quanto? Use o cálculo acima com "Usar como minhas metas diárias". Fibras: em geral 25 a 38 g por dia.</p>
      <p class="small muted" id="macro-kcal" style="margin:8px 0 0"></p>
      <div class="btn-row"><button class="btn primary" data-save-goal>Salvar metas</button></div>
    </details>

    <p class="muted small" style="text-align:center;margin-top:18px">Cálculo de referência (Mifflin-St Jeor e Parâmetros nutricionais consolidados da ConsultoriaJP). Pontos de partida para adultos: acompanhe o peso por algumas semanas e ajuste. Não substitui avaliação de nutricionista.</p>`;

  const readProfile = () => ({
    ...state.profile,
    ...Object.fromEntries(PROFILE_FIELDS.filter((k) => k !== 'intol').map((k) => [k, $(`[name="${k}"]`, view).value])),
    intol: [...view.querySelectorAll('[name="intol"]:checked')].map((x) => x.value),
  });
  const targetsNow = () => goalFor(state.goals, localDate()) ?? calcTargets(readProfile()) ?? {};

  const drawTargets = () => {
    const prof = readProfile();
    for (const el of view.querySelectorAll('[data-train]')) el.hidden = prof.trains !== 'yes';
    for (const el of view.querySelectorAll('[data-work]')) el.hidden = !prof.workDays || prof.workDays === '0';
    for (const el of view.querySelectorAll('[data-lose]')) el.hidden = prof.objective !== 'lose';
    const sug = suggestActivity(prof);
    const sugLabel = ACTIVITY.find((a) => a.id === sug);
    $('#activity-hint', view).innerHTML = sug
      ? `Pelas suas respostas: <b>${esc(sugLabel.label.split(':')[0])}</b> (fator ${fmt(sugLabel.factor, 3)}).${prof.activity !== sug ? ' <button class="btn small" data-use-activity>Usar sugestão</button>' : ''}`
      : 'Responda sobre o trabalho para o app sugerir o nível. Na dúvida, fique no mais baixo.';
    const t = calcTargets(prof);
    $('#targets', view).innerHTML = t ? `
      <div class="targets">
        <div><b>${fmt(t.kcal, 0)}</b><span>kcal/dia</span></div>
        <div><b>${fmt(t.protein, 0)} g</b><span>proteína</span></div>
        <div><b>${fmt(t.carbs, 0)} g</b><span>carboidrato</span></div>
        <div><b>${fmt(t.fat, 0)} g</b><span>gordura</span></div>
        <div><b>${fmt(t.fiber, 0)} g</b><span>fibra</span></div>
      </div>
      <p class="small muted" style="margin:8px 0 0">Gasto em repouso ${fmt(t.bmr, 0)} kcal × fator ${fmt(t.factor, 3)} = gasto total ${fmt(t.tdee, 0)} kcal.
        Conferência: 4 × ${fmt(t.protein, 0)} + 4 × ${fmt(t.carbs, 0)} + 9 × ${fmt(t.fat, 0)} = ${fmt(t.check, 0)} kcal.
        Proteína ${fmt(t.gPerKg)} g/kg${Number(prof.refWeight) > 0 ? ` do peso de referência (${fmt(Number(prof.refWeight), 0)} kg)` : t.adjusted ? ` do peso ajustado (${fmt(t.adjusted, 0)} kg)` : ''} · gordura ${fmt(t.fatPct * 100, 0)}% das kcal · fibra 14 g a cada 1.000 kcal.</p>
      ${t.review.map((r) => `<p class="small warn" style="margin:6px 0 0">${esc(r)}</p>`).join('')}
      <div class="btn-row"><button class="btn" data-use-targets>Usar como minhas metas diárias</button></div>`
      : '<p class="small muted" style="margin:10px 0 0">Preencha idade, altura e peso para ver suas metas.</p>';
    const ok = profileComplete(prof);
    const block = safetyBlock(prof);
    $('#gen-row', view).innerHTML = block ? `<p class="small warn" style="margin:0">${esc(block)}</p>`
      : ok ? `<button class="btn primary" data-generate>${state.plan.generated ? 'Gerar outra opção de cardápio' : 'Gerar meu cardápio'}</button>`
      : '<p class="small warn" style="margin:0">Preencha todos os dados acima (horários, treino e quantas refeições) para gerar o cardápio automático.</p>';
  };

  // O ajuste manual mostra sempre as metas em vigor (também depois de gerar o cardápio).
  const fillGoals = () => {
    const g = goalFor(state.goals, localDate()) ?? {};
    for (const k of ['kcal', 'carbs', 'protein', 'fat', 'fiber']) $(`.goals-manual [name="${k}"]`, view).value = v(g[k]);
    const sum = (g.carbs ?? 0) * 4 + (g.protein ?? 0) * 4 + (g.fat ?? 0) * 9;
    $('#macro-kcal', view).textContent = sum ? `Os macros somam ${fmt(sum, 0)} kcal (4 kcal/g carb. e prot., 9 kcal/g gord.).` : '';
  };

  const drawPlan = () => {
    fillGoals();
    const target = targetsNow();
    const { totals } = planTotals(state.plan.items);
    const bar = (key, label, unit = 'g') => {
      const g = target[key];
      const val = totals[key];
      const w = g ? Math.min(val / g, 1) * 100 : 0;
      const left = g ? g - val : null;
      return `<div class="macro"><div class="macro-top"><span>${label}</span>
        <span class="num">${fmt(val, 0)}${g ? ` / ${fmt(g, 0)}` : ''} ${unit}${left !== null ? ` · ${left >= 0 ? `faltam ${fmt(left, 0)}` : `${fmt(-left, 0)} acima`}` : ''}</span></div>
        <div class="bar ${key}"><i style="width:${w}%"></i></div></div>`;
    };
    const has = state.plan.items.length > 0;
    const notes = state.plan.generated ? state.plan.notes : null;
    const list = (xs) => esc(xs.join(', '));
    const notesHTML = notes ? [
      notes.preferred?.length ? `Seus preferidos no cardápio: ${list(notes.preferred)}.` : '',
      notes.missing?.length ? `Não achei na base ou não coube: ${list(notes.missing)}. Dá para adicionar à mão.` : '',
      notes.replaced?.length ? `Trocados por causa das restrições: ${list([...new Set(notes.replaced)])}.` : '',
    ].filter(Boolean).map((x) => `<p class="small muted" style="margin:6px 0 0">${x}</p>`).join('') : '';
    $('#plan-progress', view).innerHTML = `${notesHTML}<div style="margin-top:10px">${bar('kcal', 'Calorias', 'kcal')}${bar('protein', 'Proteínas')}${bar('carbs', 'Carboidratos')}${bar('fat', 'Gorduras')}${bar('fiber', 'Fibras')}</div>
      ${!target.kcal ? '<p class="small warn" style="margin:8px 0 0">Defina o objetivo acima para comparar com as metas.</p>' : ''}
      ${has ? `<div class="btn-row">
        <button class="btn" data-export="pdf">Exportar PDF</button>
        <button class="btn" data-export="txt">Baixar em texto</button>
      </div>
      <div class="btn-row">
        <button class="btn" data-plan-to-diary="all">Lançar tudo no diário de hoje</button>
        <button class="btn small danger" data-plan-clear>Limpar cardápio</button>
      </div>` : ''}`;
    $('#plan-meals', view).innerHTML = planSlots().map((m) => {
      const { rows, totals: mt } = planTotals(state.plan.items.filter((x) => x.mealType === m.id));
      return `<section class="card" aria-label="${esc(m.label)} no plano">
        <div class="card-head">
          <h2>${m.time ? `<span class="time">${esc(m.time)}</span> ` : ''}${esc(m.label)} <span class="muted small" style="font-weight:400">${rows.length ? `${fmt(mt.kcal, 0)} kcal` : ''}</span></h2>
          <button class="add-btn" data-plan-add="${m.id}">+ Adicionar</button>
        </div>
        ${rows.length ? `<p class="meal-total small">Total da refeição: ${macroLine(mt)}</p>
        <ul class="list">${rows.map(({ item, food, n }) => `<li><button class="row" data-plan-item="${esc(item.id)}">
          <span class="grow"><span class="name">${esc(food.name)}</span>
          <span class="muted small">${esc(amountText(item, food))}</span>
          <span class="small">${macroLine(n)}</span></span>
          <span class="num">${fmt(n.kcal, 0)} kcal</span></button></li>`).join('')}</ul>
        <div class="btn-row"><button class="btn small" data-plan-to-diary="${m.id}">Lançar no diário de hoje</button></div>` : '<p class="empty">Nada planejado ainda.</p>'}
      </section>`;
    }).join('');
  };

  const exportData = () => {
    const rows = planTotals(state.plan.items).rows.map(({ item, food, n }) => ({ slot: item.mealType, name: food.name, amount: amountText(item, food), n }));
    return { name: state.profile.name, targets: targetsNow(), slots: planSlots(), rows, totals: planTotals(state.plan.items).totals, date: new Date().toLocaleDateString('pt-BR') };
  };

  drawTargets();
  drawPlan();

  // As metas calculadas passam a valer, para o diário e o cardápio falarem a mesma língua.
  const generate = async (seed) => {
    const prof = readProfile();
    const t = calcTargets(prof);
    const today = localDate();
    await db.put('goals', { id: `goal-${today}`, startsAt: today, kcal: t.kcal, carbs: t.carbs, protein: t.protein, fat: t.fat, fiber: t.fiber, updatedAt: Date.now() });
    state.goals = await db.getAll('goals');
    const gen = generatePlan({
      targets: t, wake: prof.wake, sleep: prof.sleep, meals: prof.meals, seed,
      train: prof.trains === 'yes' ? prof.trainTime : null,
      avoid: avoidTerms(prof.intol ?? [], prof.intolOther),
      prefer: parseTerms(prof.prefer),
    }, state.foodsById);
    const items = gen.items.map((it) => planItemFromGrams(state.foodsById.get(it.foodId), it.slot, it.grams));
    await savePlan({ meals: gen.slots, items, generated: true, seed, notes: gen.notes });
    drawTargets();
    drawPlan();
  };

  view.oninput = async (e) => {
    if (!e.target.closest('[name]') || !PROFILE_FIELDS.includes(e.target.name)) return;
    await saveProfile(readProfile());
    drawTargets();
    drawPlan();
  };
  // Ao completar os dados (ou mudar objetivo/horários), o cardápio automático é montado de novo.
  // Um cardápio montado à mão não é substituído sem o usuário pedir.
  view.onchange = async (e) => {
    if (!e.target.closest('[name]') || !PROFILE_FIELDS.includes(e.target.name)) return;
    // Nível de atividade segue as respostas da triagem até a pessoa escolher outro à mão.
    if (e.target.name === 'activity') state.profile.activityManual = !e.detail?.auto;
    else if (!state.profile.activityManual) {
      const sug = suggestActivity(readProfile());
      if (sug) $('[name="activity"]', view).value = sug;
    }
    await saveProfile(readProfile());
    if (profileComplete(readProfile()) && !safetyBlock(readProfile()) && (state.plan.generated || !state.plan.items.length)) {
      await generate(state.plan.seed ?? 0);
      return toast('Cardápio montado pelas suas metas.');
    }
    drawTargets();
    drawPlan();
  };

  view.onclick = async (e) => {
    if (e.target.closest('[data-use-activity]')) {
      $('[name="activity"]', view).value = suggestActivity(readProfile());
      $('[name="activity"]', view).dispatchEvent(new CustomEvent('change', { bubbles: true, detail: { auto: true } }));
      return;
    }
    if (e.target.closest('[data-save-goal]')) {
      const today = localDate();
      const num = (n) => { const x = $(`.goals-manual [name="${n}"]`, view).value; return x === '' ? null : Number(x); };
      await db.put('goals', { id: `goal-${today}`, startsAt: today, kcal: num('kcal'), carbs: num('carbs'), protein: num('protein'), fat: num('fat'), fiber: num('fiber'), updatedAt: Date.now() });
      state.goals = await db.getAll('goals');
      drawPlan();
      return toast('Metas salvas.');
    }
    if (e.target.closest('[data-use-targets]')) {
      const t = calcTargets(readProfile());
      const today = localDate();
      await db.put('goals', { id: `goal-${today}`, startsAt: today, kcal: t.kcal, carbs: t.carbs, protein: t.protein, fat: t.fat, fiber: t.fiber, updatedAt: Date.now() });
      state.goals = await db.getAll('goals');
      drawPlan();
      return toast('Metas diárias atualizadas.');
    }
    if (e.target.closest('[data-generate]')) {
      if (safetyBlock(readProfile())) return;
      if (state.plan.items.length && !state.plan.generated && !confirm('Substituir o cardápio que você montou por um gerado automaticamente?')) return;
      await generate(state.plan.generated ? (state.plan.seed ?? 0) + 1 : 0);
      return toast('Cardápio gerado pelas suas metas.');
    }
    if (e.target.closest('[data-plan-clear]')) {
      if (!confirm('Apagar todos os itens do cardápio?')) return;
      await savePlan({ items: [] });
      drawTargets();
      return drawPlan();
    }
    const exp = e.target.closest('[data-export]');
    if (exp) return exportPlan(exp.dataset.export, exportData());
    const add = e.target.closest('[data-plan-add]');
    if (add) return openAdd(add.dataset.planAdd, { query: '', filter: 'recent' }, 'plan');
    const row = e.target.closest('[data-plan-item]');
    if (row) {
      const item = state.plan.items.find((x) => x.id === row.dataset.planItem);
      return openFoodDetail(state.foodsById.get(item.foodId), { mealType: item.mealType, mode: 'plan', planItem: item });
    }
    const toDiary = e.target.closest('[data-plan-to-diary]');
    if (toDiary) {
      const which = toDiary.dataset.planToDiary;
      const { rows } = planTotals(state.plan.items.filter((x) => which === 'all' || x.mealType === which));
      const date = localDate();
      for (const { item, food } of rows) {
        const slot = planSlots().find((m) => m.id === item.mealType);
        const serving = item.servingName === baseUnit(food) ? null : { id: item.servingId, name: item.servingName, amount: item.amount };
        await db.put('entries', buildEntry({ food, date, mealType: slot?.diary ?? item.mealType, quantity: item.quantity, serving }));
      }
      toast(`${rows.length} ${rows.length === 1 ? 'item lançado' : 'itens lançados'} no diário de hoje.`);
    }
  };
}

function exportPlan(kind, data) {
  if (kind === 'txt') {
    const blob = new Blob([planToText(data)], { type: 'text/plain;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `jplate-dieta-${localDate()}.txt`;
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    return toast('Cardápio baixado.');
  }
  // PDF: a página de impressão do navegador tem "Salvar como PDF".
  const f = (x) => fmt(x, 0);
  const t = data.targets ?? {};
  let area = document.getElementById('print-area');
  if (!area) {
    area = document.createElement('div');
    area.id = 'print-area';
    document.body.append(area);
  }
  area.innerHTML = `
    <div class="print-head">
      ${state.profile.photo ? `<img src="${esc(state.profile.photo)}" alt="">` : ''}
      <div><h1>Plano alimentar${data.name ? ` · ${esc(data.name)}` : ''}</h1><p>JPlate by JPCOMPANY · ${esc(data.date)}</p></div>
    </div>
    ${t.kcal ? `<p class="print-goals">Metas do dia: <b>${f(t.kcal)} kcal</b> · Proteína ${f(t.protein)} g · Carboidrato ${f(t.carbs)} g · Gordura ${f(t.fat)} g · Fibra ${f(t.fiber ?? 0)} g</p>` : ''}
    ${data.slots.map((s) => {
      const list = data.rows.filter((r) => r.slot === s.id);
      if (!list.length) return '';
      const mt = sumTotals(list.map((r) => ({ nutrients: r.n }))).totals;
      return `<h2>${s.time ? `${esc(s.time)} · ` : ''}${esc(s.label)} <small>${f(mt.kcal)} kcal · P ${f(mt.protein)} g · C ${f(mt.carbs)} g · G ${f(mt.fat)} g</small></h2>
        <table>${list.map((r) => `<tr><td>${esc(r.name)}</td><td>${esc(r.amount)}</td><td>${f(r.n.kcal)} kcal</td></tr>`).join('')}</table>`;
    }).join('')}
    <p class="print-goals">Total do dia: <b>${f(data.totals.kcal)} kcal</b> · Proteína ${f(data.totals.protein)} g · Carboidrato ${f(data.totals.carbs)} g · Gordura ${f(data.totals.fat)} g · Fibra ${f(data.totals.fiber)} g</p>
    <p class="print-note">Valores aproximados (TACO, USDA e receitas calculadas). Não substitui orientação de nutricionista.</p>`;
  window.print();
}

// ---------- área do aluno ----------

async function renderProfileCard() {
  const p = state.profile;
  const v = (x) => (x === null || x === undefined ? '' : x);
  const w = latestWeight();
  return `<section class="card profile">
      <div class="profile-head">
        <button class="avatar lg" data-photo aria-label="Trocar foto de perfil">${p.photo ? `<img src="${esc(p.photo)}" alt="Foto de perfil">` : `<span>${esc((p.name || '?').trim().charAt(0).toUpperCase() || '?')}</span>`}</button>
        <div><h2>${esc(p.name || 'Área do aluno')}</h2><p class="small muted">${w ? `${fmt(w)} kg` : 'Sem peso registrado'}${p.objective ? ` · ${esc(OBJECTIVES.find((o) => o.id === p.objective)?.label ?? '')}` : ''}</p>
        <button class="btn small" data-photo>${p.photo ? 'Trocar foto' : 'Adicionar foto'}</button>${p.photo ? ' <button class="btn small" data-photo-adjust>Ajustar posição</button> <button class="btn small danger" data-photo-remove>Remover</button>' : ''}</div>
        <input type="file" accept="image/*" hidden id="photo-file">
      </div>
      <label class="field">Nome<input name="pname" value="${esc(v(p.name))}" autocomplete="name"></label>
      <div class="grid2">
        <label class="field">Data de nascimento<input name="pbirth" type="date" value="${esc(v(p.birth))}"></label>
        <label class="field">Sexo<select name="psex"><option value="m"${p.sex !== 'f' ? ' selected' : ''}>Masculino</option><option value="f"${p.sex === 'f' ? ' selected' : ''}>Feminino</option></select></label>
        <label class="field">Altura (cm)<input name="pheight" type="number" inputmode="numeric" min="100" max="230" value="${esc(v(p.height))}"></label>
        <label class="field">Telefone<input name="pphone" type="tel" autocomplete="tel" value="${esc(v(p.phone))}"></label>
      </div>
      <label class="field">E-mail<input name="pemail" type="email" autocomplete="email" value="${esc(v(p.email))}"></label>
      <div class="grid2">
        <label class="field">Peso de hoje (kg)<input name="pweight" type="number" inputmode="decimal" min="20" max="400" step="0.1" placeholder="${w ? fmt(w) : '70,0'}"></label>
        <label class="field">Peso desejado (kg)<input name="pgoalweight" type="number" inputmode="decimal" min="20" max="400" step="0.1" value="${esc(v(p.goalWeight))}"></label>
      </div>
      <label class="field">Observações (restrições, alergias, lesões)<textarea name="pnotes" rows="3">${esc(v(p.notes))}</textarea></label>
      <div class="btn-row"><button class="btn primary" data-save-profile>Salvar dados</button></div>
      <p class="small muted" style="margin:8px 0 0">Seus dados e sua foto ficam só neste aparelho e entram no backup.</p>
    </section>`;
}

// Idade a partir da data de nascimento, no dia de hoje.
function ageFrom(birth) {
  if (!birth) return null;
  const b = parseLocalDate(birth);
  const t = new Date();
  let a = t.getFullYear() - b.getFullYear();
  if (t.getMonth() < b.getMonth() || (t.getMonth() === b.getMonth() && t.getDate() < b.getDate())) a -= 1;
  return a > 0 && a < 120 ? a : null;
}

// Fotos: a original (até 1024 px) fica guardada para reajustar depois; o avatar é o recorte quadrado de 320 px.
function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

async function photoSource(file) {
  const url = URL.createObjectURL(file);
  try {
    const img = await loadImage(url);
    const k = Math.min(1, 1024 / Math.max(img.naturalWidth, img.naturalHeight));
    const c = document.createElement('canvas');
    c.width = Math.round(img.naturalWidth * k);
    c.height = Math.round(img.naturalHeight * k);
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    return c.toDataURL('image/jpeg', 0.85);
  } finally {
    URL.revokeObjectURL(url);
  }
}

// Editor de posição: arraste para mover, pinça ou barra para aproximar. Devolve { photo, photoSrc } ou null.
async function cropPhoto(src) {
  const img = await loadImage(src);
  const W = img.naturalWidth, H = img.naturalHeight;
  const box = document.createElement('div');
  box.className = 'cropper';
  box.innerHTML = `<div class="cropper-inner">
      <h2>Ajuste sua foto</h2>
      <p class="small">Arraste para posicionar e use a barra para aproximar.</p>
      <div class="crop-frame"><img src="${src}" alt="" draggable="false"></div>
      <input class="crop-zoom" type="range" min="1" max="4" step="0.01" value="1" aria-label="Aproximar">
      <div class="btn-row"><button class="btn" data-crop-cancel>Cancelar</button><button class="btn primary" data-crop-ok>Usar foto</button></div>
    </div>`;
  document.body.append(box);
  const frame = $('.crop-frame', box);
  const pic = $('img', frame);
  const zoom = $('.crop-zoom', box);
  const F = () => frame.clientWidth;
  let z = 1, x = 0, y = 0;
  const scale = () => (F() / Math.min(W, H)) * z;
  const clamp = () => {
    const s = scale();
    x = Math.min(0, Math.max(F() - W * s, x));
    y = Math.min(0, Math.max(F() - H * s, y));
  };
  const draw = () => {
    clamp();
    const s = scale();
    pic.style.width = `${W * s}px`;
    pic.style.height = `${H * s}px`;
    pic.style.transform = `translate(${x}px, ${y}px)`;
  };
  const setZoom = (nz) => {
    const s0 = scale();
    const cx = (F() / 2 - x) / s0, cy = (F() / 2 - y) / s0;
    z = Math.min(4, Math.max(1, nz));
    const s1 = scale();
    x = F() / 2 - cx * s1;
    y = F() / 2 - cy * s1;
    zoom.value = z;
    draw();
  };
  { const s = scale(); x = (F() - W * s) / 2; y = (F() - H * s) / 2; }
  draw();

  const pts = new Map();
  let pinch = null;
  frame.addEventListener('pointerdown', (e) => {
    frame.setPointerCapture(e.pointerId);
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pts.size === 2) {
      const [a, b] = [...pts.values()];
      pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), z };
    }
  });
  frame.addEventListener('pointermove', (e) => {
    const prev = pts.get(e.pointerId);
    if (!prev) return;
    const cur = { x: e.clientX, y: e.clientY };
    pts.set(e.pointerId, cur);
    if (pts.size === 1) {
      x += cur.x - prev.x;
      y += cur.y - prev.y;
      draw();
    } else if (pinch) {
      const [a, b] = [...pts.values()];
      setZoom(pinch.z * (Math.hypot(a.x - b.x, a.y - b.y) / pinch.d));
    }
  });
  const up = (e) => { pts.delete(e.pointerId); if (pts.size < 2) pinch = null; };
  frame.addEventListener('pointerup', up);
  frame.addEventListener('pointercancel', up);
  frame.addEventListener('wheel', (e) => { e.preventDefault(); setZoom(z * (e.deltaY < 0 ? 1.08 : 1 / 1.08)); }, { passive: false });
  zoom.addEventListener('input', () => setZoom(Number(zoom.value)));

  return new Promise((resolve) => {
    box.addEventListener('click', (e) => {
      if (e.target.closest('[data-crop-cancel]')) { box.remove(); resolve(null); }
      if (e.target.closest('[data-crop-ok]')) {
        const s = scale();
        const c = document.createElement('canvas');
        c.width = c.height = 320;
        c.getContext('2d').drawImage(img, -x / s, -y / s, F() / s, F() / s, 0, 0, 320, 320);
        box.remove();
        resolve({ photo: c.toDataURL('image/jpeg', 0.85), photoSrc: src });
      }
    });
  });
}

// Escolha de arquivo ou reajuste da foto atual; salva no perfil. Devolve true se mudou.
async function editPhoto(file, extra = {}) {
  let src;
  try {
    src = file ? await photoSource(file) : state.profile.photoSrc || state.profile.photo;
  } catch {
    toast('Não foi possível abrir essa imagem.');
    return false;
  }
  if (!src) return false;
  const res = await cropPhoto(src);
  if (!res) return false;
  await saveProfile({ ...state.profile, ...extra, ...res });
  return true;
}

async function handleProfileClick(e) {
  if (e.target.closest('[data-photo]')) { $('#photo-file', view).click(); return true; }
  if (e.target.closest('[data-photo-adjust]')) {
    if (await editPhoto(null)) {
      $('.avatar', view).innerHTML = `<img src="${esc(state.profile.photo)}" alt="Foto de perfil">`;
      toast('Foto ajustada.');
    }
    return true;
  }
  if (e.target.closest('[data-photo-remove]')) {
    const { photo, photoSrc, ...rest } = state.profile;
    await saveProfile(rest);
    toast('Foto removida.');
    renderSettings();
    return true;
  }
  if (!e.target.closest('[data-save-profile]')) return false;
  const val = (n) => $(`[name="${n}"]`, view).value.trim();
  const num = (n) => (val(n) === '' ? null : Number(val(n).replace(',', '.')));
  const profile = {
    ...state.profile, name: val('pname'), birth: val('pbirth') || null, sex: val('psex'), height: num('pheight'),
    phone: val('pphone'), email: val('pemail'), goalWeight: num('pgoalweight'), notes: val('pnotes'),
  };
  const age = ageFrom(profile.birth);
  if (age) profile.age = age;
  const kg = num('pweight');
  if (kg !== null) {
    if (!(kg >= 20 && kg <= 400)) return toast('Informe um peso válido em kg.'), true;
    const date = localDate();
    const existing = state.weights.find((x) => x.date === date);
    await db.put('weights', { id: existing?.id ?? uid(), date, kg: round(kg, 2), updatedAt: Date.now() });
    state.weights = await db.getAll('weights');
    profile.weight = round(kg, 2);
  }
  await saveProfile(profile);
  toast('Dados salvos.');
  renderSettings();
  return true;
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
  setTopbar('<h1>Biblioteca de Alimentos</h1>');
  topbar.onclick = null;
  const mine = state.userFoods.filter((f) => !f.deletedAt).sort((a, b) => a.name.localeCompare(b.name));
  view.innerHTML = `
    <section class="card">
      <h2>Buscar alimentos</h2>
      <input class="search" type="search" placeholder="Alimento, prato, marca ou código de barras" aria-label="Buscar alimento ou produto de marca" id="unified-search">
      <p class="small muted" id="lib-meta" style="margin:6px 0 0"></p>
      <ul class="list" id="browse"></ul>
    </section>
    <section class="card" data-mine>
      <div class="card-head"><h2>Meus alimentos</h2><button class="add-btn" data-new-food>+ Novo</button></div>
      ${mine.length ? `<ul class="list">${mine.map((f) => foodRowHTML(f)).join('')}</ul>` : '<p class="empty">Cadastre aqui o que não está na tabela: produtos de marca, receitas de casa, pratos do restaurante.</p>'}
    </section>`;
  let libItems = [];
  loadLibrary().then((lib) => {
    const brands = lib.published || lib.onDevice || 0;
    $('#lib-meta', view).textContent = `Uma busca só em ${fmt(state.base.length, 0)} alimentos e pratos (TACO, receitas, USDA)${brands ? ` e ${fmt(brands, 0)} produtos de marca do Open Food Facts` : ''}.`;
  });
  const input = $('#unified-search', view);
  input.addEventListener('input', async () => {
    const q = input.value.trim();
    if (!q) { $('#browse', view).innerHTML = ''; return; }
    const found = await unifiedSearch(q, 40);
    if (input.value.trim() !== q) return;
    libItems = [];
    $('#browse', view).innerHTML = found.length ? unifiedRowsHTML(found, libItems) : '<li class="empty">Nada encontrado. Ao adicionar um alimento no diário, dá para buscar online.</li>';
  });
  view.onclick = (e) => {
    if (e.target.closest('[data-new-food]')) return openFoodForm({});
    const lib = e.target.closest('[data-lib]');
    if (lib) return openProductById(libItems[Number(lib.dataset.lib)].id, {});
    const row = e.target.closest('[data-food]');
    if (!row) return;
    const food = state.foodsById.get(row.dataset.food);
    if (food.source === 'user' && row.closest('[data-mine]')) return openFoodForm(food);
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

// ---------- perfil (só os dados do aluno) ----------

async function renderSettings() {
  setTopbar('<h1>Perfil</h1>');
  topbar.onclick = null;
  view.innerHTML = await renderProfileCard();
  $('#photo-file', view).addEventListener('change', async (e) => {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    if (!(await editPhoto(file))) return;
    // Atualiza só a foto, sem apagar o que já foi digitado nos campos.
    $('.avatar', view).innerHTML = `<img src="${esc(state.profile.photo)}" alt="Foto de perfil">`;
    toast('Foto salva.');
  });
  view.onclick = async (e) => {
    await handleProfileClick(e);
  };
}

// ---------- sobre o app ----------

async function renderAbout() {
  setTopbar('<h1>Sobre o app</h1>');
  topbar.onclick = null;
  const persisted = await navigator.storage?.persisted?.();
  view.innerHTML = `
    <div class="about-hero">
      <img src="assets/logo.jpg" alt="Logo JPCOMPANY">
      <div><h2>JPlate</h2><p>by JPCOMPANY</p></div>
    </div>

    <section class="card about">
      <h3>O app</h3>
      <p>O JPlate é um diário alimentar simples e direto: você busca o alimento, escolhe a porção e acompanha calorias, macros e peso ao longo dos dias. Foi pensado para o uso real do dia a dia, rápido de lançar e fácil de entender.</p>

      <h3>A JPCOMPANY</h3>
      <p>A JPCOMPANY cria ferramentas digitais para quem leva a sério o treino, a alimentação e a evolução física. Cada produto nasce da prática: o que funciona no acompanhamento de verdade vira recurso no app.</p>

      <h3>Nosso propósito</h3>
      <p>Dar clareza sobre o que você come, sem complicação. Quando você enxerga os números, decide melhor, e consistência vira resultado.</p>

      <h3>Seus dados, só seus</h3>
      <ul class="muted small">
        <li>Sem cadastro e sem login.</li>
        <li>Tudo fica guardado neste aparelho; nada é enviado para servidores.</li>
        <li>A busca de produtos de marca e o código de barras consultam o Open Food Facts pela internet, só quando você pede, e enviam apenas o termo ou o código.</li>
        <li>Funciona offline depois de instalado.</li>
        <li>Backup em arquivo, sob o seu controle.</li>
      </ul>

      <h3>Fonte dos dados</h3>
      <p class="muted small">Cada alimento mostra de onde veio:</p>
      <ul class="muted small">
        <li><b>TACO</b>: Tabela Brasileira de Composição de Alimentos, 4ª edição, NEPA/UNICAMP, 2011. “Traços” contam como zero e valores não analisados aparecem como “sem dado”.</li>
        <li><b>Receita calculada</b>: pratos do dia a dia somados ingrediente por ingrediente a partir da TACO (e da USDA quando a TACO não tem o ingrediente). A lista de ingredientes aparece no alimento.</li>
        <li><b>USDA</b>: USDA FoodData Central, SR Legacy (domínio público), com nomes traduzidos pela JPlate.</li>
        <li><b>TempoLife</b>: itens da base aberta tempo-food-db, de TempoLife (tempolife.app), licença CC-BY 4.0. Os dados da USDA também chegaram por esse pacote.</li>
        <li><b>Open Food Facts</b>: produtos de marca buscados online, base aberta sob licença ODbL, mantida por colaboradores.</li>
        <li><b>Medidas caseiras</b> (colher, concha, unidade) são aproximadas e aparecem com “aprox.”.</li>
      </ul>
      <p class="muted small">Os números são estimativas para acompanhamento pessoal e não substituem orientação de nutricionista ou médico.</p>
      <p class="muted small">© ${new Date().getFullYear()} JPCOMPANY. Todos os direitos reservados.</p>
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
    </section>`;
  $('#import-file', view).addEventListener('change', importBackup);
  view.onclick = async (e) => {
    if (e.target.closest('[data-export]')) return exportBackup();
    if (e.target.closest('[data-import]')) return $('#import-file', view).click();
    if (e.target.closest('[data-persist]')) {
      const ok = await navigator.storage?.persist?.();
      toast(ok ? 'Armazenamento protegido.' : 'O navegador não permitiu. Instale o app na tela inicial e tente de novo.');
      return renderAbout();
    }
  };
}

// ---------- dúvidas frequentes ----------

// FAQ de dieta da ConsultoriaJP (texto do Joao, sem alterações) + dúvidas de uso do app.
const FAQ = [
  ["Alimentação e emagrecimento", [
    ["1. Preciso seguir a dieta 100% para ter resultados?", "Não. Os resultados dependem principalmente da consistência ao longo do tempo. Uma refeição fora do planejado não anula seu progresso. O mais importante é manter uma boa adesão na maior parte dos dias e retomar sua rotina normalmente, sem compensações extremas."],
    ["2. Posso comer algo fora da dieta?", "Sim. É possível incluir alimentos de sua preferência dentro de uma alimentação equilibrada. A quantidade e a frequência importam, principalmente quando o objetivo é emagrecer. Você não precisa considerar nenhum alimento isolado como proibido, salvo restrições específicas de saúde ou orientações individuais."],
    ["3. Se eu sair da dieta em uma refeição, o que devo fazer?", "Volte à alimentação habitual na próxima refeição. Não precisa ficar sem comer, fazer cardio excessivo ou reduzir drasticamente as calorias para compensar. Um episódio isolado não determina o resultado, assim como uma única refeição saudável não garante progresso."],
    ["4. Por que meu peso aumenta de um dia para o outro?", "O peso pode variar por retenção de líquidos, quantidade de carboidratos e sódio consumidos, conteúdo intestinal, ciclo menstrual e hidratação. Isso não significa necessariamente que você ganhou gordura. Avalie a tendência do peso ao longo de várias semanas, em condições semelhantes de pesagem."],
    ["5. Posso emagrecer sem cortar carboidratos?", "Sim. O emagrecimento depende principalmente de manter um déficit energético ao longo do tempo. Arroz, batata, aveia, frutas e outros alimentos ricos em carboidratos podem fazer parte da dieta. A quantidade deve ser compatível com suas necessidades, suas preferências e seu planejamento alimentar."],
  ]],
  ["Horários, refeições e substituições", [
    ["6. Preciso comer de três em três horas?", "Não necessariamente. A frequência das refeições pode variar de acordo com sua rotina, fome, preferências e estratégia alimentar. O mais importante é conseguir atingir suas necessidades nutricionais e manter uma alimentação sustentável. Comer em horários fixos pode ajudar algumas pessoas, mas não é uma obrigação universal."],
    ["7. Posso trocar um alimento da dieta por outro?", "Sim, desde que a substituição seja compatível com o planejamento. Alimentos diferentes podem fornecer quantidades distintas de calorias, proteínas, carboidratos, gorduras e fibras. Utilize as substituições disponíveis no aplicativo ou consulte a equipe quando não souber qual alternativa escolher."],
    ["8. Posso trocar arroz por batata ou mandioca?", "Sim. Porém, não é adequado trocar sempre na mesma quantidade em gramas sem considerar a composição nutricional. Arroz cozido, batata cozida e mandioca cozida apresentam diferentes quantidades de água, carboidratos e calorias. Prefira as equivalências indicadas no plano ou no aplicativo."],
    ["9. E se eu não conseguir fazer uma das refeições?", "Se acontecer ocasionalmente, reorganize sua alimentação sem tentar compensar de forma exagerada. Se isso ocorre frequentemente, avise a equipe para que o planejamento seja adaptado à sua rotina. Não é necessário forçar uma refeição quando a estratégia pode ser ajustada de maneira adequada."],
    ["10. Posso comer à noite sem prejudicar o emagrecimento?", "Sim. Comer à noite não provoca ganho de gordura automaticamente. O resultado depende principalmente do balanço energético ao longo do tempo. O horário pode influenciar fome, conforto digestivo e qualidade do sono, então o ideal é organizar as refeições de acordo com sua rotina e suas necessidades."],
  ]],
  ["Quantidades, registro e preparo dos alimentos", [
    ["11. Preciso pesar os alimentos?", "Pesar os alimentos pode ajudar a estimar melhor as porções e seguir o planejamento com mais precisão. Entretanto, a necessidade depende da estratégia definida para você. Se o plano utiliza quantidades em gramas, procure respeitá-las e confira se a medida corresponde ao alimento cru ou cozido."],
    ["12. Devo pesar os alimentos crus ou cozidos?", "Depende de como o alimento está descrito no plano ou no aplicativo. O peso muda durante o preparo devido à absorção ou à perda de água. Por isso, um alimento pesado cru não deve ser registrado como cozido usando a mesma referência nutricional. Siga sempre o estado indicado na porção."],
    ["13. Preciso contar o óleo usado no preparo?", "Sim, quando o objetivo é registrar a ingestão com maior precisão. Óleo, azeite, manteiga, molhos e outros ingredientes adicionam energia à preparação. Considere a quantidade efetivamente utilizada na sua porção, evitando tanto ignorar esses ingredientes quanto contabilizar a mesma quantidade duas vezes."],
    ["14. Posso usar temperos e molhos?", "Sim. Temperos naturais, como alho, cebola, ervas e especiarias, podem ajudar a deixar as refeições mais saborosas. Molhos prontos e ingredientes adicionados em maior quantidade podem contribuir com calorias, sódio, açúcar ou gorduras. Observe os rótulos e registre os itens relevantes conforme o planejamento."],
    ["15. Como faço quando como em restaurante?", "Procure montar uma refeição semelhante à estrutura do seu plano, incluindo fontes de proteína, carboidratos e vegetais conforme suas necessidades. Estime as porções de forma realista e evite se preocupar com uma precisão impossível. Se comer fora for frequente, podemos adaptar o planejamento para facilitar essas escolhas."],
  ]],
  ["Fome, hidratação e consistência", [
    ["16. Sentir fome durante a dieta é normal?", "Alguma variação de fome pode acontecer, mas fome intensa, persistente ou acompanhada de fraqueza não deve ser tratada como sinal obrigatório de que a dieta está funcionando. Avise a equipe para avaliar porções, saciedade, distribuição das refeições e adequação da ingestão energética."],
    ["17. Quanto de água devo beber por dia?", "A necessidade varia conforme peso, clima, atividade física, transpiração e condições de saúde. Mantenha uma hidratação regular ao longo do dia e aumente a atenção em períodos de calor ou exercício. Não existe uma quantidade única adequada para todas as pessoas; algumas condições clínicas exigem orientação individualizada."],
    ["18. Preciso cortar açúcar completamente?", "Não necessariamente. A redução de açúcares adicionados pode ajudar na qualidade da alimentação e no controle da ingestão energética, mas a exclusão total não é obrigatória para todos. A prioridade é manter uma alimentação equilibrada, com quantidades compatíveis com seu objetivo e com suas necessidades."],
    ["19. Posso beber refrigerante zero ou usar adoçante?", "Essas opções podem ser utilizadas por muitas pessoas, se forem bem toleradas e compatíveis com suas necessidades. Bebidas sem açúcar geralmente fornecem pouca ou nenhuma energia, mas água deve continuar sendo uma das principais fontes de hidratação. A escolha também pode considerar preferências e orientações clínicas individuais."],
    ["20. Em quanto tempo vou começar a ver resultados?", "Isso varia conforme o objetivo, a adesão, o ponto de partida, a atividade física, a retenção de líquidos e outros fatores individuais. O peso pode oscilar, e mudanças na composição corporal nem sempre aparecem imediatamente na balança. Acompanhe a evolução ao longo das semanas e use também medidas, fotos padronizadas e desempenho, quando fizer sentido."],
  ]],
  ['Usando o app', [
    ['Como registro o que comi?', 'Em Meu Diário, toque em "+ Adicionar" na refeição, busque o alimento, escolha a porção e salve. Para lançar o dia inteiro do cardápio, use "Lançar tudo no diário de hoje" em Minha Dieta.'],
    ['Como o app calcula minhas metas?', 'Pelo gasto em repouso (equação de Mifflin-St Jeor) multiplicado pelo fator da sua rotina, com o ajuste do objetivo aplicado uma vez sobre esse gasto. Depois vêm a proteína em g/kg, a gordura em % das calorias, o carboidrato com o que sobra e a fibra (14 g a cada 1.000 kcal). Os parâmetros são os da ConsultoriaJP.'],
    ['Por que o app me colocou num nível de atividade mais baixo?', 'As perguntas sobre o trabalho e os passos sugerem o nível de forma conservadora: na dúvida, fica no mais baixo e você ajusta pela evolução do peso. "Muito ativo" só vale quando as respostas confirmam.'],
    ['O cardápio gerado é uma prescrição?', 'Não. É um ponto de partida automático para adultos saudáveis. Para gestantes, menores de 18 anos, doença renal, diabetes com remédio ou transtorno alimentar o app mostra só as metas e recomenda acompanhamento profissional.'],
    ['Onde ficam o pré e o pós-treino?', 'Marque que treina e informe o horário do treino em Minha Dieta. O app encaixa um pré-treino até 2 horas antes e um pós-treino até 2 horas depois.'],
    ['De onde vêm os alimentos?', 'Da TACO (tabela brasileira), de pratos calculados a partir dela, da USDA e de produtos de marca do Open Food Facts. Cada alimento mostra a fonte. Na Biblioteca de Alimentos uma busca só procura em tudo.'],
    ['Não achei um alimento. E agora?', 'Ao adicionar no diário, use "Buscar online" para produtos de marca ou o código de barras. Se ainda não achar, cadastre em "Novo alimento" com os dados do rótulo.'],
    ['Meus dados ficam salvos onde?', 'Só neste aparelho, sem cadastro nem login. Faça backup em Sobre o app de vez em quando e guarde o arquivo; com ele você recupera tudo em outro aparelho.'],
    ['O app funciona sem internet?', 'Sim, depois de aberto uma vez. Só a busca online de marcas e o código de barras precisam de internet. Quando há versão nova, o app se atualiza sozinho ao abrir.'],
  ]],
];
const FAQ_NOTE = [
  "Estas respostas são orientações gerais e não substituem a avaliação individual. Se sua dúvida envolver uma condição de saúde, sintomas, restrições específicas ou necessidade de alteração do plano alimentar, entre em contato com a equipe da ConsultoriaJP.",
  "O planejamento alimentar deve respeitar as necessidades individuais, a rotina, as preferências e as condições de saúde de cada pessoa.",
];

function renderFaq() {
  setTopbar('<h1>Dúvidas frequentes</h1>');
  topbar.onclick = null;
  view.innerHTML = FAQ.map(([cat, qs]) => `<section class="card faq"><h2>${esc(cat)}</h2>${qs.map(([q, a]) => `<details><summary>${esc(q)}</summary><p>${esc(a)}</p></details>`).join('')}</section>`).join('') +
    `<section class="card faq-note"><h2>Orientação geral para os alunos</h2>${FAQ_NOTE.map((t) => `<p>${esc(t)}</p>`).join('')}</section>`;
  view.onclick = null;
}

// ---------- tabela de equivalências ----------

function renderEquivalences() {
  setTopbar('<h1>Tabela de equivalências</h1>');
  topbar.onclick = null;
  view.onclick = null;
  const table = (g) => `<section class="card eq">
    <div class="eq-head"><h2>${esc(g.title)}</h2><span class="eq-portion">${esc(g.portion)}</span></div>
    <ul class="eq-list">${g.rows.map(([w, name, home, kcal]) => `<li>
      <span class="eq-w">${esc(w)}</span>
      <span class="grow"><span class="name">${esc(name)}</span><span class="muted small">${esc(home)}</span></span>
      <span class="eq-kcal">${esc(kcal)}${/\d/.test(kcal) ? '<small> kcal</small>' : ''}</span></li>`).join('')}</ul>
    ${g.note ? `<p class="small muted eq-note">${esc(g.note)}</p>` : ''}
  </section>`;
  view.innerHTML = `
    <section class="card eq-how">
      <h2>Como usar</h2>
      <p>${esc(EQ_HOW.text)}</p>
      <div class="eq-example"><span><small>Na sua dieta</small><b>${esc(EQ_HOW.example[0])}</b></span><span class="eq-eq">=</span><span><small>Pode trocar por</small><b>${esc(EQ_HOW.example[1])}</b></span></div>
    </section>
    <nav class="eq-jump" aria-label="Grupos">${EQ_GROUPS.map((g) => `<a href="#eq-${g.id}">${esc(g.title)}</a>`).join('')}</nav>
    ${EQ_GROUPS.map((g) => `<div id="eq-${g.id}" class="eq-anchor">${table(g)}</div>`).join('')}
    <section class="card eq-tip"><h2>Dica</h2><p>${esc(EQ_TIP)}</p></section>
    ${EQ_SECTIONS.map((x) => `<section class="card eq-text${x.warn ? ' eq-warn' : ''}"><h2>${esc(x.title)}</h2>${x.lines.map((l) => `<p>${esc(l)}</p>`).join('')}</section>`).join('')}
    <p class="muted small eq-foot">${esc(EQ_FOOTNOTE)}</p>
    <p class="muted small eq-foot">${esc(EQ_SOURCE)}</p>`;
}

// ---------- lista de compras ----------

// Só existe depois que o aluno tem um cardápio em Minha Dieta.
function hasDiet() {
  return state.plan.items.length > 0;
}

const SHOP_DAYS = [1, 7, 15, 30];

function shoppingRows(days) {
  const byFood = new Map();
  for (const { item, food } of planTotals(state.plan.items).rows) {
    const cur = byFood.get(food.id) ?? { food, amount: 0, unit: baseUnit(food) };
    cur.amount += item.quantity * item.amount * days;
    byFood.set(food.id, cur);
  }
  return [...byFood.values()];
}

function shopAmount({ amount, unit }) {
  if (unit === 'g') return amount >= 1000 ? `${fmt(amount / 1000, 2)} kg` : `${fmt(Math.ceil(amount / 10) * 10, 0)} g`;
  if (unit === 'ml') return amount >= 1000 ? `${fmt(amount / 1000, 2)} L` : `${fmt(Math.ceil(amount / 10) * 10, 0)} ml`;
  return `${fmt(Math.ceil(amount), 0)} ${amount > 1 ? 'porções' : 'porção'}`;
}

async function renderShopping() {
  setTopbar('<h1>Lista de compras</h1>');
  topbar.onclick = null;
  // Cardápio novo começa com a lista desmarcada.
  const key = state.plan.items.map((x) => `${x.foodId}:${x.quantity * x.amount}`).sort().join('|');
  if (state.shopping.key !== key) {
    state.shopping = { days: state.shopping.days ?? 7, checked: [], key };
    await db.kvSet('shopping', state.shopping);
  }
  const { days, checked } = state.shopping;
  const rows = shoppingRows(days);
  const groups = new Map();
  for (const r of rows.sort((a, b) => a.food.name.localeCompare(b.food.name, 'pt-BR'))) {
    const g = r.food.recipe ? 'Preparações' : r.food.group || 'Outros';
    if (!groups.has(g)) groups.set(g, []);
    groups.get(g).push(r);
  }
  const done = rows.filter((r) => checked.includes(r.food.id)).length;
  view.innerHTML = `
    <section class="card">
      <h2>Comprar para</h2>
      <div class="chips" role="group" aria-label="Dias">${SHOP_DAYS.map((d) => `<button class="chip${d === days ? ' on' : ''}" data-days="${d}" aria-pressed="${d === days}">${d === 1 ? '1 dia' : `${d} dias`}</button>`).join('')}</div>
      <p class="small muted" style="margin:10px 0 0">Feita a partir do seu cardápio de Minha Dieta. As quantidades são do alimento pronto, como no cardápio: compre um pouco a mais do que for cozido em água (arroz, feijão, massas rendem mais depois de prontos).</p>
      <p class="small" style="margin:8px 0 0"><b>${done}</b> de ${rows.length} itens no carrinho</p>
    </section>
    ${[...groups].map(([g, list]) => `<section class="card"><h2>${esc(g)}</h2><ul class="shop-list">${list.map((r) => {
      const on = checked.includes(r.food.id);
      return `<li><label class="shop-item${on ? ' done' : ''}"><input type="checkbox" data-shop="${esc(r.food.id)}"${on ? ' checked' : ''}><span class="grow">${esc(r.food.name)}</span><span class="num">${shopAmount(r)}</span></label></li>`;
    }).join('')}</ul></section>`).join('')}
    <div class="btn-row"><button class="btn" data-shop-share>Compartilhar lista</button>${done ? '<button class="btn" data-shop-clear>Desmarcar tudo</button>' : ''}</div>`;

  view.onclick = async (e) => {
    const d = e.target.closest('[data-days]');
    if (d) {
      state.shopping = { ...state.shopping, days: Number(d.dataset.days) };
      await db.kvSet('shopping', state.shopping);
      return renderShopping();
    }
    if (e.target.closest('[data-shop-clear]')) {
      state.shopping = { ...state.shopping, checked: [] };
      await db.kvSet('shopping', state.shopping);
      return renderShopping();
    }
    if (e.target.closest('[data-shop-share]')) {
      const text = `Lista de compras · ${days === 1 ? '1 dia' : `${days} dias`}\n\n` + [...groups].map(([g, list]) => `${g}\n${list.map((r) => `- ${r.food.name}: ${shopAmount(r)}`).join('\n')}`).join('\n\n');
      if (navigator.share) return navigator.share({ title: 'Lista de compras', text }).catch(() => {});
      await navigator.clipboard?.writeText(text);
      return toast('Lista copiada.');
    }
  };
  view.onchange = async (e) => {
    const box = e.target.closest('[data-shop]');
    if (!box) return;
    const id = box.dataset.shop;
    const set = new Set(state.shopping.checked);
    box.checked ? set.add(id) : set.delete(id);
    state.shopping = { ...state.shopping, checked: [...set] };
    await db.kvSet('shopping', state.shopping);
    box.closest('.shop-item').classList.toggle('done', box.checked);
    $('section.card p.small b', view).textContent = rows.filter((r) => set.has(r.food.id)).length;
  };
}

// ---------- boas-vindas ----------

// Depois da abertura: "Seja bem-vindo(a), nome" e o botão Entrar. Na primeira vez, o aluno preenche nome e foto.
const welcome = $('#welcome');

function showWelcome(editing = false) {
  const p = state.profile;
  const ask = editing || !p.name;
  const avatar = `<span class="avatar xl">${p.photo ? `<img src="${esc(p.photo)}" alt="">` : `<span>${esc((p.name || '?').trim().charAt(0).toUpperCase() || '?')}</span>`}</span>`;
  welcome.innerHTML = ask ? `
    <div class="welcome-box">
      <button class="welcome-photo" data-w-photo aria-label="Escolher foto">${avatar}<span class="small">${p.photo ? 'Trocar foto' : 'Adicionar foto'}</span></button>
      <input type="file" accept="image/*" hidden id="w-photo">
      <h1>Seja bem-vindo(a)!</h1>
      <p class="muted">Como você quer ser chamado(a)?</p>
      <input class="welcome-name" id="w-name" type="text" autocomplete="given-name" maxlength="40" placeholder="Seu nome" value="${esc(p.name ?? '')}">
      <button class="btn primary welcome-enter" data-w-enter ${p.name ? '' : 'disabled'}>Entrar</button>
      ${p.photo ? '<button class="link" data-w-adjust>Ajustar posição da foto</button>' : ''}
    </div>` : `
    <div class="welcome-box">
      ${avatar}
      <h1>Seja bem-vindo(a),<b>${esc(p.name)}</b></h1>
      <button class="btn primary welcome-enter" data-w-enter>Entrar</button>
      <button class="link" data-w-edit>Trocar nome ou foto</button>
    </div>`;
  welcome.hidden = false;
  document.body.classList.add('welcome-on');
  const name = $('#w-name', welcome);
  if (name) {
    name.oninput = () => { $('[data-w-enter]', welcome).disabled = !name.value.trim(); };
    name.onkeydown = (e) => { if (e.key === 'Enter' && name.value.trim()) enter(); };
    $('#w-photo', welcome).onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      e.target.value = '';
      if (await editPhoto(file, { name: name.value.trim() || state.profile.name })) showWelcome(true);
    };
  }
}

async function enter() {
  const name = $('#w-name', welcome);
  if (name) {
    if (!name.value.trim()) return;
    await saveProfile({ ...state.profile, name: name.value.trim() });
  }
  welcome.classList.add('hide');
  document.body.classList.remove('welcome-on');
  setTimeout(() => { welcome.hidden = true; welcome.classList.remove('hide'); }, 300);
  state.tab = 'diary';
  state.date = localDate();
  render();
}

welcome.addEventListener('click', (e) => {
  if (e.target.closest('[data-w-enter]')) return enter();
  if (e.target.closest('[data-w-edit]')) return showWelcome(true);
  if (e.target.closest('[data-w-photo]')) $('#w-photo', welcome).click();
  if (e.target.closest('[data-w-adjust]')) {
    const name = $('#w-name', welcome)?.value.trim();
    editPhoto(null, name ? { name } : {}).then((ok) => ok && showWelcome(true));
  }
});

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
  render();
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
  resetLibrary();
  await load();
  toast('Backup importado.');
  render();
}

// ---------- início ----------

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  // Procura versão nova a cada abertura; quando ela assume, a página recarrega uma vez.
  const hadController = Boolean(navigator.serviceWorker.controller);
  navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' }).then((r) => r.update()).catch(() => {});
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (hadController && !sessionStorage.getItem('jplate-reloaded')) {
      sessionStorage.setItem('jplate-reloaded', '1');
      location.reload();
    }
  });
}

// Abertura: fica até a animação terminar e o app carregar; um toque pula.
const splash = $('#splash');
const hideSplash = () => {
  splash.classList.add('hide');
  setTimeout(() => splash.remove(), 400);
};
splash.addEventListener('click', hideSplash, { once: true });
// 1,65 s de abertura + 0,35 s de saída = 2 s no total.
const splashMin = new Promise((r) => setTimeout(r, 1650));

load().then(() => { showWelcome(); return render(); }).catch((err) => {
  view.innerHTML = `<div class="card">Não foi possível abrir o app: ${esc(err.message)}</div>`;
}).finally(() => splashMin.then(hideSplash));
