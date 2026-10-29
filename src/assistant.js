// SÁ, a assistente offline: responde pelo FAQ, pela Tabela de equivalências e pela base de conhecimento da ConsultoriaJP.
// Não inventa nada: sem resposta no material, encaminha para a equipe. Temas de saúde recebem resposta genérica + equipe.
import { FAQ } from './faq.js';
import { EQ_GROUPS, EQ_SECTIONS } from './equivalencias.js';
import { KB } from './kb.js';
import { KB_BASE } from './kb-base.js';
import { healthTopic, TEAM_CLOSE } from './saude.js';

const norm = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9,.]+/g, ' ').trim();
// Plural simples e variações de gênero, para "ovos" achar "ovo" e "cozida" achar "cozido".
const SYN = { suar: 'suor', suei: 'suor', suando: 'suor', suo: 'suor', queimo: 'gasto', queimar: 'gasto', queimei: 'gasto', queimando: 'gasto', queima: 'gasto', gastei: 'gasto', gastar: 'gasto', gasta: 'gasto',
  correr: 'cardio', correndo: 'cardio', corro: 'cardio', corrida: 'cardio', caminhar: 'cardio', caminhada: 'cardio', caminhando: 'cardio', aerobico: 'cardio', musculo: 'muscul', musculos: 'muscul', muscular: 'muscul', massa: 'massa', engordar: 'engorda', engordam: 'engorda' };
const stem = (w) => {
  w = SYN[w] ?? w;
  if (w.length <= 4) return w.replace(/s$/, '');
  return w.replace(/(mente|coes|cao|ando|endo|indo|ados|idos|ado|ido|ar|er|ir|ou|ei|as|es|os|a|e|o|s)$/, '');
};

const STOP = new Set(`a o e de da do das dos em no na nos nas um uma uns umas para pra por com sem que se eu meu minha meus minhas
  me mim voce vc posso pode podem devo deve preciso precisa como qual quais quanto quantos quantas quando onde porque por que
  ou mais menos muito pouco isso esse essa este esta ao aos as os ja tem ter sou estou fazer faco faz e ne la ai so tambem
  dia dias app aplicativo funciona funcionam serve vale bom boa melhor
  tenho estou sinto to quero queria saber gostaria tipo coisa algum alguma quantas quantos`.split(/\s+/));

// Alimentos da tabela: só plural, para "franca" não virar "frances".
const lwords = (s) => norm(s).replace(/[,.]/g, ' ').split(' ').filter((w) => w && !STOP.has(w)).map((w) => (w.length > 3 ? w.replace(/(oes|aes)$/, 'ao').replace(/s$/, '') : w));
const words = (s) => norm(s).replace(/[,.]/g, ' ').split(' ').filter((w) => w && !STOP.has(w)).map(stem);

// ---------- documentos (FAQ + textos da tabela) ----------

const DOCS = [
  ...FAQ.flatMap(([cat, qs]) => qs.map(([q, a]) => ({ title: q.replace(/^\d+\.\s*/, ''), text: a, from: `Dúvidas frequentes · ${cat}` }))),
  ...EQ_SECTIONS.map((x) => ({ title: x.title, text: x.lines.join(' '), from: 'Tabela de equivalências' })),
  ...KB.map((k) => ({ title: k.pergunta, text: k.resposta, from: `ConsultoriaJP · ${k.categoria}`, refs: k.referencias, keys: k.palavras_chave })),
  ...KB_BASE.map((k) => ({ title: k.pergunta, text: k.resposta, from: `ConsultoriaJP · ${k.categoria}`, refs: k.referencias })),
];

const idf = new Map();
for (const d of DOCS) {
  d.qw = new Set(words(d.title));
  d.aw = new Set(words(d.text));
  d.kw = new Set((d.keys ?? []).flatMap(words));
  d.phrases = (d.keys ?? []).map((k) => words(k).join(' ')).filter(Boolean);
  for (const w of new Set([...d.qw, ...d.aw, ...d.kw])) idf.set(w, (idf.get(w) ?? 0) + 1);
}
for (const [w, n] of idf) idf.set(w, Math.log(1 + DOCS.length / n));

function searchDocs(q) {
  const qw = [...new Set(words(q))];
  if (!qw.length) return [];
  const qs = ` ${qw.join(' ')} `;
  const glossary = /^o que (e|significa) /.test(norm(q));
  return DOCS.map((d) => {
    let score = 0;
    for (const w of qw) {
      const k = idf.get(w) ?? 0;
      if (d.qw.has(w) || d.kw.has(w)) score += 2 * k;
      else if (d.aw.has(w)) score += k;
    }
    // Palavra-chave inteira na pergunta (ex.: "fim de semana", "plantão") pesa mais.
    for (const ph of d.phrases ?? []) if (qs.includes(` ${ph} `)) score += 1.5 * ph.split(' ').length;
    // Pergunta igual ao título, ou "o que é X" para os verbetes do glossário.
    if (words(d.title).join(' ') === qw.join(' ')) score += 50;
    if (glossary && /^O que é /.test(d.title)) score *= 1.6;
    return { d, score: score / Math.sqrt(qw.length) };
  }).filter((x) => x.score > 0).sort((a, b) => b.score - a.score);
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

export function answer(q) {
  const n = norm(q);
  if (!n) return null;
  const health = healthTopic(` ${n.replace(/[,.]/g, ' ')} `);
  if (health) {
    // Se a base tem uma resposta feita para essa pergunta, usa ela; senão, a orientação geral. Sempre fecha com a equipe.
    const [top] = searchDocs(q);
    if (health.id !== 'alerta' && top && top.score >= 6 && healthTopic(` ${norm(top.d.title)} `)?.id === health.id) return { title: top.d.title, text: `${top.d.text}\n\n${TEAM_CLOSE}`, from: top.d.from, refs: top.d.refs };
    return { title: health.label, text: `${health.text}\n\n${TEAM_CLOSE}`, from: 'SÁ · Orientação geral de saúde' };
  }
  const wantsSwap = /\b(troc|substitu|equival|no lugar)/.test(n);
  const eq = equivalenceAnswer(q);
  if (eq && (wantsSwap || findFoods(q).length)) {
    if (wantsSwap || !searchDocs(q)[0] || searchDocs(q)[0].score < 3) return eq;
  }
  const [best] = searchDocs(q);
  if (best && best.score >= 1.2) return { title: best.d.title, text: best.d.text, from: best.d.from, refs: best.d.refs };
  if (eq) return eq;
  return {
    text: 'Não encontrei essa resposta no material da ConsultoriaJP. Tente perguntar de outro jeito (por exemplo, "posso trocar arroz por batata?") ou fale com a equipe pelo suporte do app.',
    from: null,
  };
}
