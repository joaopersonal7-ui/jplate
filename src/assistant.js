// SÁ, a assistente offline: responde pelo FAQ, pela Tabela de equivalências e pela base de conhecimento da ConsultoriaJP.
// Não inventa nada: sem resposta no material, encaminha para a equipe. Temas de saúde recebem resposta genérica + equipe.
import { FAQ } from './faq.js';
import { EQ_GROUPS, EQ_SECTIONS } from './equivalencias.js';
import { KB } from './kb.js';
import { KB_BASE } from './kb-base.js';
import { KB_MED } from './kb-med.js';
import { KB_300 } from './kb-300.js';
import { KB_CONCEITOS } from './kb-conceitos.js';
import { KB_NEURAL, KB_NEURAL_FROM } from './kb-neural.js';
import { KB_CANETAS, CANETAS_FECHO } from './kb-canetas.js';
import { healthTopic, TEAM_CLOSE } from './saude.js';
import { CONVERSA, CONTINUAR, CONTINUAR_FALAS, CONTINUAR_SEM, OBJETIVO_FALAS, NAO_ENCONTREI, QUIS_DIZER, CONFLITO } from './conversa.js';

const norm = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9,.]+/g, ' ').trim();
// Plural simples e variações de gênero, para "ovos" achar "ovo" e "cozida" achar "cozido".
const SYN = { suar: 'suor', suei: 'suor', suando: 'suor', suo: 'suor', queimo: 'gasto', queimar: 'gasto', queimei: 'gasto', queimando: 'gasto', queima: 'gasto', gastei: 'gasto', gastar: 'gasto', gasta: 'gasto',
  correr: 'cardio', correndo: 'cardio', corro: 'cardio', corrida: 'cardio', caminhar: 'cardio', caminhada: 'cardio', caminhando: 'cardio', aerobico: 'cardio', musculo: 'muscul', musculos: 'muscul', muscular: 'muscul', massa: 'massa', engordar: 'engorda', engordam: 'engorda',
  paro: 'parar', parei: 'parar', parou: 'parar', parando: 'parar' };
const stem = (w) => {
  w = SYN[w] ?? w;
  if (w.length <= 4) return w.replace(/s$/, '');
  return w.replace(/(imento|amento|mente|coes|cao|ando|endo|indo|ados|idos|ado|ido|ar|er|ir|ou|ei|as|es|os|a|e|o|s)$/, '');
};

const STOP = new Set(`todo toda todos todas consigo consegui conseguir conseguindo a o e de da do das dos em no na nos nas um uma uns umas para pra pro pros por com sem que q se eu meu minha meus minhas ta pq
  me mim voce vc posso pode podem devo deve preciso precisa como qual quais quanto quantos quantas quando onde porque por que
  ou mais menos muito pouco isso esse essa este esta ao aos as os ja tem ter sou estou fazer faco faz e ne la ai so tambem
  dia dias app aplicativo funciona funcionam serve vale bom boa melhor
  tenho estou sinto to quero queria saber gostaria tipo coisa algum alguma quantas quantos
  usa usando usar uso usei ajuda ajudar ajudam relacao interfere interferir atrapalha atrapalhar influencia influenciar afeta`.split(/\s+/));

// Alimentos da tabela: só plural, para "franca" não virar "frances".
const lwords = (s) => norm(s).replace(/[,.]/g, ' ').split(' ').filter((w) => w && !STOP.has(w)).map((w) => (w.length > 3 ? w.replace(/(oes|aes)$/, 'ao').replace(/s$/, '') : w));
const titleKey = (s) => [...new Set(words(s))].join(' ');
const words = (s) => norm(s).replace(/[,.]/g, ' ').split(' ').filter((w) => w && !STOP.has(w)).map(stem);

// ---------- documentos (FAQ + textos da tabela) ----------

const DOCS = [
  ...FAQ.flatMap(([cat, qs]) => qs.map(([q, a]) => ({ title: q.replace(/^\d+\.\s*/, ''), text: a, from: `Dúvidas frequentes · ${cat}` }))),
  ...EQ_SECTIONS.map((x) => ({ title: x.title, text: x.lines.join(' '), from: 'Tabela de equivalências' })),
  ...KB.map((k) => ({ title: k.pergunta, text: k.resposta, from: `ConsultoriaJP · ${k.categoria}`, refs: k.referencias, keys: k.palavras_chave })),
  ...KB_BASE.map((k) => ({ title: k.pergunta, text: k.resposta, from: `ConsultoriaJP · ${k.categoria}`, refs: k.referencias })),
  ...KB_300.map((k) => ({ title: k.pergunta, text: k.resposta, from: `Banco da SÁ · ${k.categoria}`, keys: k.palavras_chave, autoKeys: true, id: k.id })),
  // 50 conceitos: o título é o nome do conceito; as "perguntas relacionadas" do material ajudam a achar o conceito.
  ...KB_CONCEITOS.map((k) => ({ title: k.conceito, text: k.resposta, from: `Banco de Conhecimento da SÁ · ${k.categoria}`, refs: k.referencias,
    keys: [...k.palavras_chave, k.pergunta, ...k.perguntas_alternativas], autoKeys: true, concept: true, id: k.id })),
  ...KB_NEURAL.map((k) => ({ title: k.pergunta, text: k.resposta, from: `${KB_NEURAL_FROM}`, refs: k.referencias, autoKeys: true, id: k.id })),
];
// Medicamentos para emagrecimento: só respondem quando a pergunta fala de remédio/caneta (ex.: "Preciso tomar whey?" aqui é no contexto da caneta).
const MED_DOCS = [
  ...KB_MED.map((k) => ({ title: k.pergunta, text: k.resposta, from: `ConsultoriaJP · ${k.categoria}`, refs: k.referencias, keys: k.palavras_chave })),
  ...KB_CANETAS.map((k) => ({ title: k.pergunta, text: k.resposta, from: `ConsultoriaJP · ${k.categoria}`, refs: k.referencias, keys: k.palavras_chave, close: CANETAS_FECHO })),
];
const ALL_DOCS = [...DOCS, ...MED_DOCS];

const idf = new Map();
for (const d of ALL_DOCS) {
  d.qw = new Set(words(d.title));
  d.aw = new Set(words(d.text));
  d.kw = new Set((d.keys ?? []).flatMap(words));
  // Palavras-chave geradas da própria pergunta (base de 300) não ganham bônus de frase: só repetiriam o título.
  d.phrases = d.autoKeys ? [] : (d.keys ?? []).map((k) => words(k).join(' ')).filter(Boolean);
  for (const w of new Set([...d.qw, ...d.aw, ...d.kw])) idf.set(w, (idf.get(w) ?? 0) + 1);
}
for (const [w, n] of idf) idf.set(w, Math.log(1 + ALL_DOCS.length / n));
const TITLE_WORDS = new Set(ALL_DOCS.flatMap((d) => [...d.qw, ...d.kw]));

// Conceitos ligados: perguntar de emagrecimento também procura gordura e déficit, e assim por diante.
const EXPAND = {
  emagrec: ['gordur', 'deficit', 'perd'], secar: ['gordur', 'deficit'], atp: ['energi', 'muscul'],
  metabolism: ['gast', 'energi'], hipertrofi: ['muscul', 'massa'], energi: ['atp', 'gast'],
};

// ---------- interpretação: erros de digitação e jeitos informais de perguntar ----------

// Palavra da base mais parecida com uma palavra que a base não conhece ("ozempik" → "ozempic", "caimbra" → "caibra").
const SURFACE = new Map();
for (const d of ALL_DOCS) for (const t of norm(`${d.title} ${(d.keys ?? []).join(' ')} ${d.text}`).replace(/[,.]/g, ' ').split(' ')) if (t.length > 3 && !STOP.has(t) && !SURFACE.has(stem(t))) SURFACE.set(stem(t), t);

function editDistance(a, b, max) {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = cur;
  }
  return prev[b.length];
}

function fixTypos(n) {
  return n.split(' ').map((t) => {
    const st = stem(t);
    if (st.length < 6 || STOP.has(t) || idf.has(st) || /\d/.test(t)) return t;
    const max = t.length >= 8 ? 2 : 1;
    let best = null, bd = max + 1;
    for (const [v, surf] of SURFACE) {
      const dist = editDistance(st, v, max);
      if (dist < bd || (dist === bd && best && (idf.get(v) ?? 9) < (idf.get(best[0]) ?? 9))) { bd = dist; best = [v, surf]; }
    }
    return best && bd <= max ? best[1] : t;
  }).join(' ');
}

// Jeitos comuns de perguntar que não usam as palavras da base.
const INTENTS = [
  [/\b(nao (consigo|consegui|to conseguindo|estou conseguindo) (mais )?(emagrec|perder|baixar)|peso (parou|travou|estacionou|nao (cai|desce|baixa)))/, 'plato peso parou de cair'],
  [/\bdormi (mal|pouco)|\bnoite mal dormida|\bsem dormir/, 'fome depois de dormir pouco'],
  [/\b(comer fora|restaurante|lanchonete|marmita fora)/, 'comer fora'],
  [/\b(barat\w*|economiz\w*|sem dinheiro|orcamento|grana)/, 'caro orcamento'],
  [/\b(barriga|pochete|abdominais?|gordura localizada)\b/, 'gordura localizada'],
  [/\bincha(r|m|ndo)?\b|\bretem\b|\breter\b/, 'retencao liquido'],
  [/\bganhar massa\b|\bcrescer\b|\bficar (grande|forte)\b/, 'hipertrofia massa muscular'],
];

const TITLE_KEYS = new Set(ALL_DOCS.map((d) => titleKey(d.title)));

export function interpret(q) {
  const n = fixTypos(norm(q));
  if (TITLE_KEYS.has(titleKey(n))) return n;
  const extra = INTENTS.filter(([re]) => re.test(n)).map(([, w]) => w);
  return extra.length ? `${n} ${extra.join(' ')}` : n;
}

function queryWords(q) {
  const base = [...new Set(words(q))];
  const extra = [...new Set(base.flatMap((w) => EXPAND[w] ?? []))].filter((w) => !base.includes(w));
  return { base, extra };
}

export function searchDocs(q, pool = DOCS) {
  const { base: qw, extra } = queryWords(q);
  if (!qw.length) return [];
  const qs = ` ${qw.join(' ')} `;
  const glossary = /^o que (e|significa) /.test(norm(q));
  const raw = norm(q).replace(/[,.?]/g, '').trim();
  return pool.map((d) => {
    let score = 0;
    for (const w of qw) {
      const k = idf.get(w) ?? 0;
      if (d.qw.has(w) || d.kw.has(w)) score += 2 * k;
      else if (d.aw.has(w)) score += k;
    }
    for (const w of extra) if (d.qw.has(w) || d.aw.has(w)) score += 0.4 * (idf.get(w) ?? 0);
    // Palavra-chave inteira na pergunta (ex.: "fim de semana", "plantão") pesa mais.
    for (const ph of d.phrases ?? []) if (qs.includes(` ${ph} `)) score += 1.5 * ph.split(' ').length;
    // Pergunta igual ao título, ou "o que é X" para os verbetes do glossário.
    if (titleKey(d.title) === qw.join(' ')) score += 50;
    // Duas perguntas que só diferem em "a", "o", "todos"...: fica a escrita igual à do aluno.
    if (raw === norm(d.title).replace(/[,.?]/g, '').trim()) score += 2;
    if (glossary && (/^O que é /.test(d.title) || d.concept)) score *= 1.6;
    return { d, score: score / Math.sqrt(qw.length) };
  }).filter((x) => x.score > 0).sort((a, b) => b.score - a.score);
}

// Uma pergunta que junta assuntos (ex.: "ATP e emagrecimento") recebe até 3 trechos da base, um por assunto.
function covers(d, w) {
  return [w, ...(EXPAND[w] ?? [])].some((x) => d.qw.has(x) || d.kw.has(x) || d.aw.has(x));
}

const MED_CONTEXT = new Set(['caneta', 'remedi', 'medicament', 'emagrec', 'emagrecedor'].map(stem));

function compose(q, ranked, pool = DOCS) {
  const { base: qw } = queryWords(q);
  // Só assuntos (palavras que aparecem em algum título), não verbos soltos como "interfere".
  // Na base de medicamentos, "caneta"/"remédio"/"emagrecer" são o contexto de tudo, não um assunto a mais.
  const key = qw.filter((w) => (idf.get(w) ?? 0) > 1 && TITLE_WORDS.has(w) && !(pool === MED_DOCS && MED_CONTEXT.has(w)));
  const parts = [ranked[0]];
  const exact = titleKey(ranked[0].d.title) === qw.join(' ');
  const done = (w) => parts.some((p) => covers(p.d, w));
  // Próximo trecho: o que melhor cobre o assunto que falta e ainda conversa com os já usados (ex.: energia + gordura).
  const conceptScore = (d, ws) => ws.reduce((t, w) => t + (idf.get(w) ?? 0) * (d.qw.has(w) || d.kw.has(w) ? 2 : d.aw.has(w) ? 1 : 0)
    + (EXPAND[w] ?? []).reduce((u, x) => u + (idf.get(x) ?? 0) * (d.qw.has(x) ? 1.6 : d.aw.has(x) ? 0.8 : 0), 0), 0);
  while (!exact && parts.length < 3 && key.some((w) => !done(w))) {
    const missing = key.filter((w) => !done(w));
    const have = key.filter((w) => done(w));
    const next = pool.filter((d) => !parts.some((p) => p.d === d) && missing.some((w) => covers(d, w)) && (pool === MED_DOCS || !/^O que é /.test(d.title)))
      .map((d) => ({ d, v: conceptScore(d, missing) + 0.6 * conceptScore(d, have) }))
      .sort((a, b) => b.v - a.v)[0];
    if (!next || next.v < 2) break;
    parts.push({ d: next.d, score: next.v });
  }
  // Verbete curto do glossário fora de "o que é": completa com o texto mais completo sobre o mesmo termo.
  if (!exact && parts.length < 3 && /^O que é /.test(parts[0].d.title) && !/^o que (e|significa) /.test(norm(q))) {
    const term = words(parts[0].d.title).filter((w) => key.includes(w));
    const full = pool.filter((d) => !parts.some((p) => p.d === d) && !/^O que é /.test(d.title) && term.some((w) => d.aw.has(w) || d.qw.has(w)))
      .map((d) => ({ d, v: conceptScore(d, term) + 0.5 * conceptScore(d, key) })).sort((a, b) => b.v - a.v)[0];
    if (full && full.v >= 2) parts.splice(1, 0, { d: full.d, score: full.v });
  }
  // Regra do Joao: uma resposta cadastrada por vez. Os outros assuntos da pergunta viram "Veja também".
  const related = [...parts.slice(1).map((p) => p.d.title), ...ranked.filter((x) => !parts.some((p) => p.d === x.d) && x.score >= 2).map((x) => x.d.title)]
    .filter((t, k, a) => a.indexOf(t) === k && t !== parts[0].d.title).slice(0, 3);
  const d = parts[0].d;
  return { title: d.title, text: d.text, from: d.from, refs: d.refs, related };
}

// ---------- equivalências ----------

const GENERIC_SET = new Set(['cozido', 'grelhado', 'assado', 'pronto', 'pele', 'comum', 'integral', 'branco', 'tradicional', 'fresca',
  'congelada', 'escorrido', 'hidratada', 'torrado', 'sal', 'magra', 'concentrado', 'natural', 'desnatado', 'medio', 'grande', 'agua', 'flocos', 'oliva'].map(stem));

const FOODS = EQ_GROUPS.flatMap((g) => g.rows.map(([portion, name, home, kcal]) => {
  const keys = new Set(lwords(name.replace(/-/g, ' ')).filter((w) => !GENERIC_SET.has(w) && !GENERIC_SET.has(stem(w))));
  const amount = parseFloat(portion.replace(',', '.'));
  const unit = /ml/.test(portion) ? 'ml' : /unid/.test(portion) ? 'unid.' : 'g';
  return { group: g, portion, amount, unit, name, home, kcal, keys };
}));

function findFoods(q) {
  const qw = new Set(lwords(q.replace(/-/g, ' ')));
  const hits = [];
  for (const f of FOODS) {
    const n = [...f.keys].filter((k) => qw.has(k)).length;
    if (n) hits.push({ f, n });
  }
  // Para cada palavra, fica o alimento que casou mais palavras (ex.: "batata doce" fica com batata-doce).
  hits.sort((a, b) => b.n - a.n);
  const used = new Set();
  const out = [];
  for (const h of hits) {
    const ks = [...h.f.keys].filter((k) => qw.has(k));
    if (ks.some((k) => used.has(k))) continue;
    ks.forEach((k) => used.add(k));
    out.push(h.f);
  }
  // Mantém a ordem em que aparecem na pergunta.
  const pos = (f) => Math.min(...[...f.keys].map((k) => { const i = lwords(q.replace(/-/g, ' ')).indexOf(k); return i < 0 ? 1e9 : i; }));
  return out.sort((a, b) => pos(a) - pos(b));
}

const fmtNum = (n) => (Math.round(n * 10) / 10).toLocaleString('pt-BR', { maximumFractionDigits: 1 });
const round5 = (n) => Math.round(n / 5) * 5;

function quantityIn(q) {
  const m = norm(q).match(/(\d+(?:[,.]\d+)?)\s*(kg|g|gramas?|ml|l|litros?)?\b/);
  if (!m) return null;
  let v = parseFloat(m[1].replace(',', '.'));
  if (m[2] === 'kg' || m[2] === 'l' || m[2]?.startsWith('litro')) v *= 1000;
  return v;
}

function equivalenceAnswer(q) {
  const foods = findFoods(q);
  if (!foods.length) return null;
  const [a, b] = foods;
  if (b && a.group !== b.group) {
    return {
      text: `${a.name} é do grupo ${a.group.title} e ${b.name} é do grupo ${b.group.title}. Pela tabela, não troque alimentos de grupos diferentes: troque só dentro do mesmo grupo, na quantidade indicada.`,
      from: 'Tabela de equivalências',
    };
  }
  if (b) {
    const qty = quantityIn(q);
    const portions = qty && a.unit !== 'unid.' ? qty / a.amount : 1;
    const target = b.unit === 'unid.' ? `${fmtNum(portions)} unidade(s)` : `${round5(portions * b.amount)} ${b.unit}`;
    const from = qty && a.unit !== 'unid.' ? `${fmtNum(qty)} ${a.unit}` : a.portion;
    return {
      text: `Sim, são do mesmo grupo (${a.group.title}). ${from} de ${a.name.toLowerCase()} equivale a ${target} de ${b.name.toLowerCase()}${portions === 1 ? ` (${b.home})` : ''}.\n\nOs pesos são do alimento pronto (cozido), exceto quando indicado.`,
      from: 'Tabela de equivalências',
    };
  }
  const others = a.group.rows.filter((r) => r[1] !== a.name).slice(0, 8).map(([p, n, h]) => `• ${p} de ${n.toLowerCase()} (${h})`).join('\n');
  return {
    text: `${a.portion} de ${a.name.toLowerCase()} (${a.home}) é 1 porção do grupo ${a.group.title} (${a.group.portion.replace('1 porção ', '')}). Você pode trocar por:\n${others}${a.group.rows.length > 9 ? '\n…e outros na Tabela de equivalências.' : ''}`,
    from: 'Tabela de equivalências',
  };
}

// ---------- saúde: sempre para a equipe ----------

export const SUGGESTIONS = [
  'Posso trocar arroz por batata?',
  'Carboidrato à noite engorda?',
  'Creatina: para que serve?',
  'Suar emagrece?',
  'O que é NEAT?',
  'Meu peso parou de baixar',
]

// Remédios e canetas para emagrecer (não "remédio para pressão" ou anticoncepcional, que ficam na orientação geral).
const MED_RE = /\b(caneta\w*|emagrec\w*|ozempic|mounjaro|wegovy|saxenda|victoza|trulicity|rybelsus|semaglutida|liraglutida|tirzepatida|dulaglutida|exenatida|lixisenatida|sibutramina|orlistate?|naltrexona|bupropiona|metformina|glp ?1|retatrutida|peptideos?|olire|lirux|lyrza|wylovol|aribet|embeltah|sevema|zepbound|byetta|lyxumia|bydureon)\b/;

const FICHA_WORDS = new Set(KB_CANETAS.flatMap((k) => k.palavras_chave.map(stem)));

function medAnswer(q, ranked) {
  // "Náusea com Ozempic": primeiro o assunto (náusea), depois a ficha da caneta citada.
  const ficha = ranked.find((x) => x.d.close);
  const rest = norm(q).replace(/[,.]/g, ' ').split(' ').filter((w) => w && !STOP.has(w) && !FICHA_WORDS.has(stem(w)) && !MED_CONTEXT.has(stem(w))).join(' ');
  // Só o nome da caneta ("tirzepatida", "o que é Mounjaro"): a ficha inteira, sem misturar outros textos.
  if (ficha && ranked[0] === ficha && (!rest || /^o que (e|sao|significa) /.test(norm(q)))) {
    return { title: ficha.d.title, text: ficha.d.text, from: ficha.d.from, refs: ficha.d.refs, related: ranked.filter((x) => x !== ficha && x.score >= 2).slice(0, 2).map((x) => x.d.title) };
  }
  // Pergunta sobre um assunto citando a caneta: responde o assunto e oferece a ficha da caneta em "Veja também".
  if (ficha && ranked[0] === ficha && rest) {
    const [topic] = searchDocs(rest, MED_DOCS.filter((d) => !d.close));
    if (topic && topic.score >= 3) {
      const related = [ficha.d.title, ...ranked.filter((x) => x !== ficha && x.d !== topic.d && x.score >= 2).map((x) => x.d.title)].slice(0, 2);
      return { title: topic.d.title, text: topic.d.text, from: topic.d.from, refs: topic.d.refs, related };
    }
  }
  const a = compose(q, ranked, MED_DOCS);
  // "Náusea com Ozempic": primeiro a náusea, depois o verbete da substância.
  if (!a.parts || !/^O que (é|são) /.test(a.parts[0].title) || /^o que (e|sao|significa) /.test(norm(q))) return a;
  const parts = [...a.parts.slice(1), a.parts[0]];
  return { ...a, title: parts[0].title, parts, text: parts.map((p) => p.text).join('\n\n') };
}

// ---------- conversa ----------

const lastPick = new Map();
function pick(id, falas) {
  // Sorteia uma fala diferente da última usada para o mesmo assunto.
  let i = Math.floor(Math.random() * falas.length);
  if (falas.length > 1 && i === lastPick.get(id)) i = (i + 1) % falas.length;
  lastPick.set(id, i);
  return falas[i];
}

function saudacao(h = new Date().getHours()) {
  return h >= 5 && h < 12 ? 'bom dia' : h >= 12 && h < 18 ? 'boa tarde' : 'boa noite';
}

function fill(t, { name, last } = {}) {
  const s = saudacao();
  t = t.replace(/\{saudacao_cap\}/g, s[0].toUpperCase() + s.slice(1)).replace(/\{saudacao\}/g, s).replace(/\{assunto\}/g, last?.title ?? '');
  return name ? t.replace(/\{nome\}/g, name.split(' ')[0]) : t.replace(/,? \{nome\}/g, '').replace(/\{nome\},? ?/g, '');
}

// Falas que só valem em mensagens curtas, para não confundir "não consegui emagrecer" com uma conquista.
const SHORT_ONLY = 7;
const LONG_OK = new Set(['estou-mal', 'desistir', 'desanimo', 'quem-e-voce', 'e-humana', 'quem-criou', 'o-que-faz']);
const NEGATION_SKIP = new Set(['conquista', 'elogio', 'estou-bem', 'te-amo']);

function smallTalk(n, ctx) {
  const t = n.replace(/[,.!?]+/g, ' ').replace(/\s+/g, ' ').trim();
  const nw = t.split(' ').length;
  const neg = /\bnao\b/.test(t);
  for (const [id, re, falas] of CONVERSA) {
    if (!re.test(t)) continue;
    if (nw > SHORT_ONLY && !LONG_OK.has(id)) continue;
    if (neg && NEGATION_SKIP.has(id)) continue;
    if (id === 'objetivo') {
      const opts = searchDocs(interpret(t)).slice(0, 3).map((x) => x.d.title);
      return { text: fill(pick(id, OBJETIVO_FALAS), ctx), options: opts, conv: id, from: null };
    }
    // "Sim" logo depois de a SÁ perguntar "e com você, tudo bem?" é resposta à pergunta dela.
    if (id === 'sim' && ctx.last?.conv === 'tudo-bem') {
      const bem = CONVERSA.find((c) => c[0] === 'estou-bem');
      return { text: fill(pick('estou-bem', bem[2]), ctx), conv: 'estou-bem', from: null };
    }
    return { text: fill(pick(id, falas), ctx), conv: id, from: null };
  }
  if (CONTINUAR.test(t)) {
    const last = ctx.topic ?? ctx.last;
    if (!last?.title) return { text: fill(pick('continuar-sem', CONTINUAR_SEM), ctx), conv: 'continuar', from: null };
    const opts = [...(last.related ?? []), ...searchDocs(interpret(last.title), ALL_DOCS).map((x) => x.d.title)]
      .filter((x, i, a) => x !== last.title && !(last.parts ?? []).some((p) => p.title === x) && a.indexOf(x) === i).slice(0, 3);
    return { text: fill(pick('continuar', CONTINUAR_FALAS), { ...ctx, last }), options: opts, conv: 'continuar', from: null };
  }
  return null;
}

// Cumprimento antes da pergunta ("oi, creatina funciona?"): guarda o cumprimento e responde a pergunta.
const GREETING_PREFIX = /^(oi+|ola|opa|bom dia|boa tarde|boa noite|e ai|eai|hey|sa|oi sa|ola sa)\b[\s,!.]*(sa\b[\s,!.]*)?/;

const BROAD_DOCS = 40;

// Respostas cadastradas que se contradizem (aguardando a decisão do Joao): a SÁ mostra as opções em vez de escolher.
const CONFLITOS = [
  { tema: 'refeição livre', titulos: ['Refeição livre', 'Preciso fazer refeição livre?', 'Posso fazer uma refeição livre durante a dieta?', 'Preciso fazer uma refeição livre para acelerar o metabolismo?'] },
];

function conflictCheck(a, ctx) {
  const c = a?.title && CONFLITOS.find((x) => x.titulos.includes(a.title));
  return c ? { text: fill(CONFLITO.replace('{tema}', c.tema), ctx), options: c.titulos, from: null } : a;
}

// ---------- interpretação pelo servidor (IA da Cloudflare) ----------

// Banco que o servidor usa para interpretar a pergunta: só os títulos (o servidor nunca recebe nem escreve respostas).
// Os conceitos levam também a pergunta e as perguntas relacionadas, para a IA entender melhor o assunto.
export const BANCO = [...new Map(DOCS.map((d) => [d.title, d.concept ? [d.title, ...(({ pergunta, perguntas_alternativas }) => [pergunta, ...perguntas_alternativas])(KB_CONCEITOS.find((k) => k.conceito === d.title))].join(' | ') : d.title])).entries()]
  .map(([titulo, texto]) => ({ titulo, texto }));

// A pergunta já é igual a um título do banco: não precisa do servidor.
export const isTitle = (q) => TITLE_KEYS.has(titleKey(q));

// Títulos mais próximos pela busca local, que o servidor junta aos que ele acha pelo sentido.
export const candidates = (q) => [...new Set(searchDocs(interpret(q)).slice(0, 6).map((x) => x.d.title))];

// Resposta cadastrada de um título escolhido pelo servidor, exatamente como no banco.
export function answerTitle(title, ctx = {}) {
  return conflictCheck(answerRaw(title, { ...ctx, exact: true }), ctx);
}

export function answer(q, ctx = {}) {
  const a = answerRaw(q, ctx);
  return ctx.exact ? a : conflictCheck(a, ctx);
}

function answerRaw(q, ctx = {}) {
  const { exact = false } = ctx;
  let n = norm(q);
  if (!n) return null;
  const g = !exact && n.match(GREETING_PREFIX);
  const greetingOnly = !g || n.slice(g[0].length).replace(/[,.!?\s]/g, '').length <= 3;
  const talk = !exact && greetingOnly && smallTalk(n, ctx);
  // Uma pergunta que é exatamente um título da base vale mais que a conversa.
  if (talk && !healthTopic(` ${n.replace(/[,.]/g, ' ')} `) && !TITLE_KEYS.has(titleKey(n))) return talk;
  if (g && !greetingOnly) {
    const rest = answer(n.slice(g[0].length), { ...ctx, exact: false });
    const hi = /^bom dia/.test(n) ? 'Bom dia' : /^boa tarde/.test(n) ? 'Boa tarde' : /^boa noite/.test(n) ? 'Boa noite' : 'Olá';
    return { ...rest, intro: fill(`${hi}, {nome}!`, ctx) };
  }
  // "Veja também": abre exatamente o texto do título tocado.
  const hit = exact && ALL_DOCS.find((d) => d.title === q);
  if (hit) {
    const med = MED_DOCS.includes(hit);
    const team = med ? hit.close ?? TEAM_CLOSE : undefined;
    return { title: hit.title, text: team ? `${hit.text}\n\n${team}` : hit.text, from: hit.from, refs: hit.refs, team };
  }
  q = interpret(q);
  n = norm(q);
  const health = healthTopic(` ${n.replace(/[,.]/g, ' ')} `);
  if (health) {
    // Se a base tem uma resposta feita para essa pergunta, usa ela; senão, a orientação geral. Sempre fecha com a equipe.
    const med = searchDocs(q, MED_DOCS);
    const exact = med[0] && titleKey(med[0].d.title) === queryWords(q).base.join(' ');
    if (health.id !== 'alerta' && med[0] && (exact || (health.id === 'remedios' && MED_RE.test(` ${n} `) && med[0].score >= 3))) {
      const a = medAnswer(q, med);
      // Fichas das canetas fecham com "equipe e médico"; o resto da base, com a equipe.
      const titles = a.parts ? a.parts.map((p) => p.title) : [a.title];
      const team = MED_DOCS.find((d) => d.close && titles.includes(d.title))?.close ?? TEAM_CLOSE;
      return { ...a, text: `${a.text}\n\n${team}`, team };
    }
    const [top] = searchDocs(q);
    if (health.id !== 'alerta' && top && top.score >= 6 && healthTopic(` ${norm(top.d.title)} `)?.id === health.id) return { title: top.d.title, text: `${top.d.text}\n\n${TEAM_CLOSE}`, from: top.d.from, refs: top.d.refs };
    return { title: health.label, text: `${health.text}\n\n${TEAM_CLOSE}`, from: 'SÁ · Orientação geral de saúde' };
  }
  const wantsSwap = /\b(troc|substitu|equival|no lugar)/.test(n);
  const eq = equivalenceAnswer(q);
  if (eq && !TITLE_KEYS.has(titleKey(q)) && (wantsSwap || findFoods(q).length)) {
    if (wantsSwap || !searchDocs(q)[0] || searchDocs(q)[0].score < 3) return eq;
  }
  const ranked = searchDocs(q);
  // Uma palavra só e muito comum ("dieta", "treino"): pergunta qual assunto, em vez de chutar.
  const qw = queryWords(q).base;
  const broad = qw.length === 1 && ALL_DOCS.length / (Math.exp(idf.get(qw[0]) ?? 9) - 1) >= BROAD_DOCS && !TITLE_KEYS.has(qw[0]);
  if (ranked[0] && ranked[0].score >= 4 && !broad) return compose(q, ranked);
  if (eq) return eq;
  // Pouca certeza: em vez de chutar, oferece as perguntas mais próximas.
  if (ranked[0] && ranked[0].score >= 1.2) return { text: fill(QUIS_DIZER, ctx), options: [...new Set(ranked.slice(0, 3).map((x) => x.d.title))], from: null };
  return { text: NAO_ENCONTREI, from: null };
}
