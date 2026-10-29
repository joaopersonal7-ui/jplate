import * as db from './db.js';
import {
  MEALS, NUTRIENTS, BACKUP_VERSION, localDate, addDays, parseLocalDate, formatDateLabel, normalize,
  searchFoods, servingOptions, baseUnit, scaleNutrients, entryAmount, sumTotals, groupByMeal, goalFor,
  buildEntry, buildQuickEntry, weightTrend, validateBackup, fmt, round, uid,
  sourceLabel, calcTargets, planItemNutrients, ACTIVITY, OBJECTIVES, LEVELS,
} from './domain.js';
import { generatePlan, planToText, MEAL_COUNTS } from './planner.js';
import { searchOnline, productByBarcode, canScan, scanBarcode } from './off.js';
import { LABEL_NUTRIENTS, STATUS_LABEL, SOURCES as PRODUCT_SOURCES, searchProducts, productToFood, fromIndexRow, indexRow } from './products.js';
import { loadLibrary, getProduct, findByGtin, rememberProduct, resetLibrary } from './library.js';

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
};

// ---------- carga ----------

async function load() {
  const data = (f) => fetch(`data/${f}`).then((r) => r.json());
  const [taco, receitas, usda, userFoods, goals, weights, favorites, recents, servings, lastBackup, firstUse, plan, profile] = await Promise.all([
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
  ]);
  const base = [...receitas, ...taco, ...usda];
  // Dados do aluno moravam dentro do plano na versão anterior.
  Object.assign(state, { base, userFoods, goals, weights, favorites, recents, servings, lastBackup, firstUse, plan, profile: profile ?? plan.profile ?? {} });
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
  const renderers = { diary: renderDiary, plan: renderPlan, weight: renderWeight, foods: renderFoods, settings: renderSettings };
  view.oninput = null;
  view.onchange = null;
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
      ${macro('fiber', 'Fibras')}
      ${!goal ? '<p class="small muted" style="margin:6px 0 0">Defina suas metas em Ajustes.</p>' : ''}
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
      <input class="search" type="search" placeholder="Buscar entre ${fmt(state.foods.length, 0)} alimentos e pratos" autocomplete="off" value="${esc(ui.query)}" aria-label="Buscar alimento">
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
      <div id="library"></div>
      <div id="online"></div>`,
    onMount(body) {
      const input = $('.search', body);
      const results = $('#results', body);
      const library = $('#library', body);
      const online = $('#online', body);
      const drawLibrary = async () => {
        const q = ui.query.trim();
        if (!q) { library.innerHTML = ''; return; }
        const lib = await loadLibrary();
        if (ui.query.trim() !== q) return;
        ui.libItems = searchProducts(lib.items, q, { limit: 40 });
        library.innerHTML = ui.libItems.length
          ? `<h3 class="section-title">Produtos de marca · biblioteca</h3><ul class="list">${ui.libItems.map((r, i) => productRowHTML(r, `data-lib="${i}"`)).join('')}</ul>`
          : '';
      };
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
        if (q) list = searchFoods(state.foods, q, { favorites: state.favorites, recents: state.recents });
        else if (ui.filter === 'fav') list = state.favorites.map((id) => state.foodsById.get(id));
        else if (ui.filter === 'mine') list = state.userFoods.filter((f) => !f.deletedAt).sort((a, b) => a.name.localeCompare(b.name));
        else if (ui.filter === 'dishes') list = state.base.filter((f) => f.source === 'receita');
        else list = state.recents.map((id) => state.foodsById.get(id));
        list = list.filter((f) => f && !f.deletedAt);
        const emptyMsg = q ? 'Nada encontrado na base. Tente outra palavra, busque online abaixo ou cadastre o alimento.'
          : ui.filter === 'fav' ? 'Marque alimentos com a estrela para vê-los aqui.'
          : ui.filter === 'mine' ? 'Você ainda não cadastrou alimentos.'
          : 'Busque um alimento para começar.';
        results.innerHTML = list.length ? list.map((f) => foodRowHTML(f)).join('') : `<li class="empty">${emptyMsg}</li>`;
        drawLibrary();
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
    <span class="num small muted">${fmt(f.n.kcal, 0)} kcal/100${baseUnit(f)}</span></button></li>`;
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
    <span class="grow"><span class="name">${esc(r.name ?? 'Produto sem nome')}${r.brand ? ` <span class="muted">· ${esc(r.brand)}</span>` : ' <span class="muted">· marca não informada</span>'}</span>
    <span class="muted small">${meta.map(esc).join(' · ')}</span> ${statusHTML(r.status)}</span>
    <span class="num small muted">${r.kcal100 == null ? 'kcal não informada' : `${fmt(r.kcal100, 0)} kcal/100${r.baseUnit ?? 'g'}`}</span></button></li>`;
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
      ${food ? '' : '<p class="small muted">Sem valores por 100 g/ml, este produto não pode ser lançado por peso. Cadastre-o em "Novo alimento" com os valores do seu rótulo.</p>'}`,
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
  return `<p class="small muted" style="margin:4px 0 0">${parts.map(esc).join(' · ')} · por 100 ${baseUnit(food)}: ${fmt(food.n.kcal, 0)} kcal</p>${note}`;
}

function openFoodDetail(food, { mealType, entry, back, mode = 'diary', planItem }) {
  const unit = baseUnit(food);
  const saved = () => state.servings[food.id] ?? [];
  let options = servingOptions(food, saved());
  const current = entry ?? planItem;
  const sel = { quantity: current?.quantity ?? 100, servingId: current?.servingId ?? unit, mealType: current?.mealType ?? mealType };
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
      <button class="btn small" data-new-serving style="margin-top:8px">+ Salvar uma porção (ex.: 1 unidade = 120 ${unit})</button>
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

const PROFILE_FIELDS = ['sex', 'age', 'height', 'weight', 'activity', 'objective', 'trains', 'level', 'wake', 'sleep', 'meals'];

function profileComplete(p) {
  return ['sex', 'age', 'height', 'weight', 'activity', 'objective', 'trains', 'wake', 'sleep', 'meals'].every((k) => p[k]) && (p.trains === 'no' || p.level);
}

function renderPlan() {
  setTopbar(`<h1>Minha dieta</h1>${state.profile.photo ? `<img class="avatar sm" src="${esc(state.profile.photo)}" alt="">` : ''}`);
  topbar.onclick = null;
  const p = { sex: 'm', activity: 'light', objective: 'maintain', wake: '07:00', sleep: '23:00', ...state.profile };
  if (!p.weight) p.weight = latestWeight() ?? '';
  const v = (x) => (x === null || x === undefined ? '' : x);
  const opt = (list, cur) => list.map((x) => `<option value="${x.id}"${x.id === cur ? ' selected' : ''}>${esc(x.label)}</option>`).join('');

  view.innerHTML = `
    <section class="card">
      <h2>1. Seu objetivo${state.profile.name ? `, ${esc(state.profile.name.split(' ')[0])}` : ''}</h2>
      <p class="small muted" style="margin:4px 0 0">Preencha tudo e o app calcula suas metas e monta um cardápio completo para você.</p>
      <div class="grid2">
        <label class="field">Sexo<select name="sex"><option value="m"${p.sex === 'm' ? ' selected' : ''}>Masculino</option><option value="f"${p.sex === 'f' ? ' selected' : ''}>Feminino</option></select></label>
        <label class="field">Idade<input name="age" type="number" inputmode="numeric" min="10" max="100" value="${esc(v(p.age))}"></label>
        <label class="field">Altura (cm)<input name="height" type="number" inputmode="numeric" min="100" max="230" value="${esc(v(p.height))}"></label>
        <label class="field">Peso (kg)<input name="weight" type="number" inputmode="decimal" min="30" max="300" step="0.1" value="${esc(v(p.weight))}"></label>
        <label class="field">Acordo às<input name="wake" type="time" value="${esc(v(p.wake))}"></label>
        <label class="field">Durmo às<input name="sleep" type="time" value="${esc(v(p.sleep))}"></label>
        <label class="field">Já treina?<select name="trains"><option value="">Escolha</option><option value="yes"${p.trains === 'yes' ? ' selected' : ''}>Sim, já treino</option><option value="no"${p.trains === 'no' ? ' selected' : ''}>Ainda não treino</option></select></label>
        <label class="field" data-level ${p.trains === 'no' ? 'hidden' : ''}>Nível<select name="level"><option value="">Escolha</option>${opt(LEVELS, p.level)}</select></label>
      </div>
      <label class="field">Quantas refeições por dia?<select name="meals"><option value="">Escolha</option>${opt(MEAL_COUNTS, p.meals)}</select></label>
      <label class="field">Atividade física no dia a dia<select name="activity">${opt(ACTIVITY, p.activity)}</select></label>
      <label class="field">Objetivo<select name="objective">${opt(OBJECTIVES, p.objective)}</select></label>
      <div id="targets"></div>
    </section>

    <section class="card">
      <div class="card-head"><h2>2. Seu cardápio</h2></div>
      <p class="small muted" style="margin:4px 0 0">Gere um cardápio automático pelas metas e horários, ou monte o seu. Toque num alimento para trocar a quantidade ou remover.</p>
      <div class="btn-row" id="gen-row"></div>
      <div id="plan-progress"></div>
    </section>
    <div id="plan-meals"></div>
    <p class="muted small" style="text-align:center;margin-top:18px">Cálculo de referência (Mifflin-St Jeor). Não substitui avaliação de nutricionista.</p>`;

  const readProfile = () => ({ ...state.profile, ...Object.fromEntries(PROFILE_FIELDS.map((k) => [k, $(`[name="${k}"]`, view).value])) });
  const targetsNow = () => goalFor(state.goals, localDate()) ?? calcTargets(readProfile()) ?? {};

  const drawTargets = () => {
    const prof = readProfile();
    $('[data-level]', view).hidden = prof.trains === 'no';
    const t = calcTargets(prof);
    $('#targets', view).innerHTML = t ? `
      <div class="targets">
        <div><b>${fmt(t.kcal, 0)}</b><span>kcal/dia</span></div>
        <div><b>${fmt(t.protein, 0)} g</b><span>proteína</span></div>
        <div><b>${fmt(t.carbs, 0)} g</b><span>carboidrato</span></div>
        <div><b>${fmt(t.fat, 0)} g</b><span>gordura</span></div>
        <div><b>${fmt(t.fiber, 0)} g</b><span>fibra</span></div>
      </div>
      <p class="small muted" style="margin:8px 0 0">Gasto em repouso ${fmt(t.bmr, 0)} kcal · gasto total estimado ${fmt(t.tdee, 0)} kcal.</p>
      <div class="btn-row"><button class="btn" data-use-targets>Usar como minhas metas diárias</button></div>`
      : '<p class="small muted" style="margin:10px 0 0">Preencha idade, altura e peso para ver suas metas.</p>';
    const ok = profileComplete(prof);
    $('#gen-row', view).innerHTML = ok
      ? `<button class="btn primary" data-generate>${state.plan.generated ? 'Gerar outra opção de cardápio' : 'Gerar meu cardápio'}</button>`
      : '<p class="small warn" style="margin:0">Preencha todos os dados acima (inclusive horários, se já treina e quantas refeições) para gerar o cardápio automático.</p>';
  };

  const drawPlan = () => {
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
    $('#plan-progress', view).innerHTML = `<div style="margin-top:10px">${bar('kcal', 'Calorias', 'kcal')}${bar('protein', 'Proteínas')}${bar('carbs', 'Carboidratos')}${bar('fat', 'Gorduras')}${bar('fiber', 'Fibras')}</div>
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
    const gen = generatePlan({ targets: t, wake: prof.wake, sleep: prof.sleep, meals: prof.meals, seed }, state.foodsById);
    const items = gen.items.map((it) => planItemFromGrams(state.foodsById.get(it.foodId), it.slot, it.grams));
    await savePlan({ meals: gen.slots, items, generated: true, seed });
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
    await saveProfile(readProfile());
    if (profileComplete(readProfile()) && (state.plan.generated || !state.plan.items.length)) {
      await generate(state.plan.seed ?? 0);
      return toast('Cardápio montado pelas suas metas.');
    }
    drawTargets();
    drawPlan();
  };

  view.onclick = async (e) => {
    if (e.target.closest('[data-use-targets]')) {
      const t = calcTargets(readProfile());
      const today = localDate();
      await db.put('goals', { id: `goal-${today}`, startsAt: today, kcal: t.kcal, carbs: t.carbs, protein: t.protein, fat: t.fat, fiber: t.fiber, updatedAt: Date.now() });
      state.goals = await db.getAll('goals');
      drawPlan();
      return toast('Metas diárias atualizadas.');
    }
    if (e.target.closest('[data-generate]')) {
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
        <button class="btn small" data-photo>${p.photo ? 'Trocar foto' : 'Adicionar foto'}</button>${p.photo ? ' <button class="btn small danger" data-photo-remove>Remover</button>' : ''}</div>
        <input type="file" accept="image/*" hidden id="photo-file">
      </div>
      <div class="grid2">
        <label class="field">Nome<input name="pname" value="${esc(v(p.name))}" autocomplete="name"></label>
        <label class="field">Data de nascimento<input name="pbirth" type="date" value="${esc(v(p.birth))}"></label>
        <label class="field">Sexo<select name="psex"><option value="m"${p.sex !== 'f' ? ' selected' : ''}>Masculino</option><option value="f"${p.sex === 'f' ? ' selected' : ''}>Feminino</option></select></label>
        <label class="field">Altura (cm)<input name="pheight" type="number" inputmode="numeric" min="100" max="230" value="${esc(v(p.height))}"></label>
        <label class="field">Telefone<input name="pphone" type="tel" autocomplete="tel" value="${esc(v(p.phone))}"></label>
        <label class="field">E-mail<input name="pemail" type="email" autocomplete="email" value="${esc(v(p.email))}"></label>
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

// Reduz a foto para 320 px no lado maior antes de guardar (cabe no backup e abre rápido).
function resizePhoto(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const max = 320;
      const k = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * k);
      c.height = Math.round(img.height * k);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(img.src);
      resolve(c.toDataURL('image/jpeg', 0.85));
    };
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}

async function handleProfileClick(e) {
  if (e.target.closest('[data-photo]')) { $('#photo-file', view).click(); return true; }
  if (e.target.closest('[data-photo-remove]')) {
    const { photo, ...rest } = state.profile;
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
  setTopbar('<h1>Alimentos</h1>');
  topbar.onclick = null;
  const mine = state.userFoods.filter((f) => !f.deletedAt).sort((a, b) => a.name.localeCompare(b.name));
  view.innerHTML = `
    <section class="card">
      <div class="card-head"><h2>Meus alimentos</h2><button class="add-btn" data-new-food>+ Novo</button></div>
      ${mine.length ? `<ul class="list">${mine.map((f) => foodRowHTML(f)).join('')}</ul>` : '<p class="empty">Cadastre aqui o que não está na tabela: produtos de marca, receitas de casa, pratos do restaurante.</p>'}
    </section>
    <section class="card">
      <h2>Biblioteca de produtos de marca</h2>
      <p class="small muted" id="lib-meta" style="margin:0">Carregando…</p>
      <input class="search" type="search" placeholder="Nome, marca ou código de barras" aria-label="Buscar produto de marca" id="lib-search">
      <ul class="list" id="lib-results"></ul>
    </section>
    <section class="card">
      <h2>Consultar a tabela</h2>
      <input class="search" type="search" placeholder="Buscar entre ${fmt(state.base.length, 0)} alimentos e pratos" aria-label="Buscar na tabela">
      <ul class="list" id="browse"></ul>
    </section>`;
  const libInput = $('#lib-search', view);
  let libItems = [];
  loadLibrary().then((lib) => {
    $('#lib-meta', view).innerHTML = lib.published
      ? `${fmt(lib.published, 0)} produtos vendidos no Brasil, do Open Food Facts (ODbL), importados em ${dateBR(lib.meta?.importedAt)}${lib.onDevice ? ` · ${fmt(lib.onDevice, 0)} consultados online neste aparelho` : ''}. Não é um catálogo completo: só entra o que colaboradores cadastraram na fonte.`
      : `A biblioteca ainda não foi importada${lib.onDevice ? `; ${fmt(lib.onDevice, 0)} produtos consultados online estão neste aparelho` : ''}. Use a busca online ao adicionar um alimento.`;
  });
  libInput.addEventListener('input', async () => {
    const q = libInput.value;
    const lib = await loadLibrary();
    if (libInput.value !== q) return;
    libItems = searchProducts(lib.items, q, { limit: 40 });
    $('#lib-results', view).innerHTML = libItems.map((r, i) => productRowHTML(r, `data-lib="${i}"`)).join('') || (q.trim() ? '<li class="empty">Nenhum produto na biblioteca. Ao adicionar um alimento, dá para buscar online.</li>' : '');
  });
  const input = $('#browse', view).previousElementSibling;
  input.addEventListener('input', () => {
    const list = searchFoods(state.foods, input.value, { favorites: state.favorites, recents: state.recents, limit: 30 });
    $('#browse', view).innerHTML = list.map((f) => foodRowHTML(f)).join('') || (input.value.trim() ? '<li class="empty">Nada encontrado.</li>' : '');
  });
  view.onclick = (e) => {
    if (e.target.closest('[data-new-food]')) return openFoodForm({});
    const lib = e.target.closest('[data-lib]');
    if (lib) return openProductById(libItems[Number(lib.dataset.lib)].id, {});
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
  setTopbar('<h1>Perfil</h1>');
  topbar.onclick = null;
  const today = localDate();
  const goal = goalFor(state.goals, today) ?? {};
  const v = (x) => (x === null || x === undefined ? '' : x);
  const persisted = await navigator.storage?.persisted?.();
  view.innerHTML = `
    ${await renderProfileCard()}

    <section class="card">
      <h2>Metas diárias</h2>
      <p class="small muted" style="margin:4px 0 0">Valem a partir de hoje; dias anteriores continuam com a meta da época.</p>
      <div class="grid2">
        <label class="field">Calorias (kcal)<input name="kcal" type="number" inputmode="numeric" min="0" value="${esc(v(goal.kcal))}"></label>
        <label class="field">Carboidratos (g)<input name="carbs" type="number" inputmode="numeric" min="0" value="${esc(v(goal.carbs))}"></label>
        <label class="field">Proteínas (g)<input name="protein" type="number" inputmode="numeric" min="0" value="${esc(v(goal.protein))}"></label>
        <label class="field">Gorduras (g)<input name="fat" type="number" inputmode="numeric" min="0" value="${esc(v(goal.fat))}"></label>
        <label class="field">Fibras (g)<input name="fiber" type="number" inputmode="numeric" min="0" value="${esc(v(goal.fiber))}"></label>
      </div>
      <p class="small muted" style="margin:6px 0 0">Não sabe quanto? Calcule pelo seu objetivo em <b>Dieta</b>. Fibras: em geral 25 a 38 g por dia.</p>
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
    </section>`;

  const macroKcal = () => {
    const g = (n) => Number($(`[name="${n}"]`, view).value) || 0;
    const sum = g('carbs') * 4 + g('protein') * 4 + g('fat') * 9;
    $('#macro-kcal', view).textContent = sum ? `Os macros somam ${fmt(sum, 0)} kcal (4 kcal/g carb. e prot., 9 kcal/g gord.).` : '';
  };
  macroKcal();
  view.oninput = macroKcal;

  $('#import-file', view).addEventListener('change', importBackup);
  $('#photo-file', view).addEventListener('change', async (e) => {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    try {
      await saveProfile({ ...state.profile, photo: await resizePhoto(file) });
    } catch {
      return toast('Não foi possível abrir essa imagem.');
    }
    // Atualiza só a foto, sem apagar o que já foi digitado nos campos.
    $('.avatar', view).innerHTML = `<img src="${esc(state.profile.photo)}" alt="Foto de perfil">`;
    toast('Foto salva.');
  });
  view.onclick = async (e) => {
    if (await handleProfileClick(e)) return;
    if (e.target.closest('[data-save-goal]')) {
      const num = (n) => { const x = $(`[name="${n}"]`, view).value; return x === '' ? null : Number(x); };
      const g = { id: `goal-${today}`, startsAt: today, kcal: num('kcal'), carbs: num('carbs'), protein: num('protein'), fat: num('fat'), fiber: num('fiber'), updatedAt: Date.now() };
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
  resetLibrary();
  await load();
  toast('Backup importado.');
  render();
}

// ---------- início ----------

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  navigator.serviceWorker.register('sw.js').catch(() => {});
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

load().then(render).catch((err) => {
  view.innerHTML = `<div class="card">Não foi possível abrir o app: ${esc(err.message)}</div>`;
}).finally(() => splashMin.then(hideSplash));
