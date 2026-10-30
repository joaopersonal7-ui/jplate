// Servidor do JPlate: dica do dia por notificação e IA de reserva da SÁ.
// O app continua funcionando sem ele; o servidor só guarda inscrições de notificação e contadores de uso da IA.
import { newVapidKeys, sendPush } from './webpush.js';
import { perguntar, MODELO } from './ia.js';
import { DICAS } from './dicas.js';

const LOTE = 40; // envios por execução (o plano gratuito limita as chamadas externas por execução)

// Horário de Brasília (UTC−3, sem horário de verão).
const brasilia = (now = Date.now()) => new Date(now - 3 * 3600e3);
const hoje = (now) => brasilia(now).toISOString().slice(0, 10);
const mes = (now) => hoje(now).slice(0, 7);
const horaAgora = (now) => brasilia(now).getUTCHours();

export function dicaDoDia(now = Date.now()) {
  const dias = Math.floor(brasilia(now).getTime() / 86400e3);
  const d = DICAS[dias % DICAS.length];
  return { title: `Dica do dia: ${d.titulo}`, body: d.texto, url: `./?sa=${encodeURIComponent(d.titulo)}` };
}

async function vapid(env) {
  const row = await env.DB.prepare("SELECT v FROM config WHERE k = 'vapid'").first();
  if (row) return JSON.parse(row.v);
  // Primeira vez: cria as chaves e guarda. INSERT OR IGNORE evita duas chaves se duas chamadas chegarem juntas.
  const keys = await newVapidKeys();
  await env.DB.prepare("INSERT OR IGNORE INTO config (k, v) VALUES ('vapid', ?)").bind(JSON.stringify(keys)).run();
  return JSON.parse((await env.DB.prepare("SELECT v FROM config WHERE k = 'vapid'").first()).v);
}

const contato = (env) => env.VAPID_CONTATO || 'https://github.com/joaopersonal7-ui/jplate';

function cors(req, env) {
  const origin = req.headers.get('Origin') ?? '';
  const ok = (env.ORIGENS ?? '').split(',').map((s) => s.trim()).includes(origin);
  return ok ? { 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Max-Age': '86400', Vary: 'Origin' } : {};
}

const json = (data, status, headers) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', ...headers } });

const texto = (v, min, max) => typeof v === 'string' && v.trim().length >= min && v.length <= max;

async function uso(env, now) {
  const m = await env.DB.prepare('SELECT usd, perguntas FROM ia_mes WHERE mes = ?').bind(mes(now)).first();
  return { usd: m?.usd ?? 0, perguntas: m?.perguntas ?? 0, teto: Number(env.IA_TETO_MES_USD ?? 5) };
}

async function rotaIA(body, env, now) {
  if (!texto(body.aluno, 8, 64) || !texto(body.pergunta, 2, 500)) return [{ erro: 'pedido_invalido' }, 400];
  if (!env.ANTHROPIC_API_KEY) return [{ erro: 'indisponivel' }, 503];
  const u = await uso(env, now);
  if (u.usd >= u.teto) return [{ erro: 'teto_mes' }, 429];
  const dia = hoje(now);
  const porAluno = Number(env.IA_POR_ALUNO_DIA ?? 10);
  const n = (await env.DB.prepare('SELECT n FROM ia_dia WHERE aluno = ? AND dia = ?').bind(body.aluno, dia).first())?.n ?? 0;
  if (n >= porAluno) return [{ erro: 'limite_aluno', limite: porAluno }, 429];
  const total = (await env.DB.prepare('SELECT COALESCE(SUM(n), 0) AS t FROM ia_dia WHERE dia = ?').bind(dia).first()).t;
  if (total >= Number(env.IA_TOTAL_DIA ?? 500)) return [{ erro: 'limite_total' }, 429];

  let r;
  try {
    r = await perguntar(env, body.pergunta.trim());
  } catch (err) {
    console.error('IA falhou', err?.status, err?.message);
    return [{ erro: 'indisponivel' }, 502];
  }
  const writes = [env.DB.prepare('INSERT INTO ia_mes (mes, usd, perguntas) VALUES (?, ?, 1) ON CONFLICT (mes) DO UPDATE SET usd = usd + excluded.usd, perguntas = perguntas + 1').bind(mes(now), r.usd)];
  // Pergunta fora do tema não gasta a cota do aluno.
  if (!r.fora) writes.push(env.DB.prepare('INSERT INTO ia_dia (aluno, dia, n) VALUES (?, ?, 1) ON CONFLICT (aluno, dia) DO UPDATE SET n = n + 1').bind(body.aluno, dia));
  await env.DB.batch(writes);
  return [{ resposta: r.texto, fora: r.fora, restantes: Math.max(0, porAluno - n - (r.fora ? 0 : 1)), modelo: MODELO }, 200];
}

async function rotaInscrever(body, env, now) {
  const s = body.inscricao;
  const hora = Number(body.hora);
  if (!texto(body.aluno, 8, 64) || !s || !texto(s.endpoint, 10, 1000) || !/^https:\/\//.test(s.endpoint) || !texto(s.keys?.p256dh, 40, 200) || !texto(s.keys?.auth, 10, 100)
    || !Number.isInteger(hora) || hora < 0 || hora > 23) return [{ erro: 'pedido_invalido' }, 400];
  await env.DB.prepare(`INSERT INTO inscricoes (endpoint, aluno, p256dh, auth, hora, criado) VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT (endpoint) DO UPDATE SET aluno = excluded.aluno, p256dh = excluded.p256dh, auth = excluded.auth, hora = excluded.hora`)
    .bind(s.endpoint, body.aluno, s.keys.p256dh, s.keys.auth, hora, new Date(now).toISOString()).run();
  return [{ ok: true }, 200];
}

async function enviar(env, sub, dado) {
  const status = await sendPush(sub, dado, await vapid(env), contato(env)).catch(() => 0);
  // 404/410: o aparelho cancelou ou o app foi removido. A inscrição sai da lista.
  if (status === 404 || status === 410) await env.DB.prepare('DELETE FROM inscricoes WHERE endpoint = ?').bind(sub.endpoint).run();
  return status;
}

async function rotaTeste(body, env, now) {
  if (!texto(body.endpoint, 10, 1000)) return [{ erro: 'pedido_invalido' }, 400];
  const sub = await env.DB.prepare('SELECT * FROM inscricoes WHERE endpoint = ?').bind(body.endpoint).first();
  if (!sub) return [{ erro: 'nao_inscrito' }, 404];
  const status = await enviar(env, sub, dicaDoDia(now));
  return [{ ok: status >= 200 && status < 300, status }, 200];
}

export async function handle(req, env, now = Date.now()) {
  const h = cors(req, env);
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: h });
  const { pathname } = new URL(req.url);
  try {
    if (req.method === 'GET' && pathname === '/') {
      const u = await uso(env, now);
      return json({ app: 'JPlate', ia: Boolean(env.ANTHROPIC_API_KEY) && u.usd < u.teto, iaMes: { usd: Math.round(u.usd * 10000) / 10000, perguntas: u.perguntas, teto: u.teto } }, 200, h);
    }
    if (req.method === 'GET' && pathname === '/push/chave') return json({ chave: (await vapid(env)).publicKey }, 200, h);
    if (req.method === 'POST') {
      const body = await req.json().catch(() => ({}));
      const rotas = { '/ia': rotaIA, '/push/inscrever': rotaInscrever, '/push/teste': rotaTeste };
      if (pathname === '/push/cancelar') {
        if (texto(body.endpoint, 10, 1000)) await env.DB.prepare('DELETE FROM inscricoes WHERE endpoint = ?').bind(body.endpoint).run();
        return json({ ok: true }, 200, h);
      }
      if (rotas[pathname]) {
        const [data, status] = await rotas[pathname](body, env, now);
        return json(data, status, h);
      }
    }
    return json({ erro: 'nao_encontrado' }, 404, h);
  } catch (err) {
    console.error(err);
    return json({ erro: 'falha' }, 500, h);
  }
}

// Envia a dica do dia a quem escolheu a hora atual e ainda não recebeu hoje.
export async function enviarDicas(env, now = Date.now()) {
  const dia = hoje(now);
  const { results } = await env.DB.prepare('SELECT * FROM inscricoes WHERE hora = ? AND (ultimo IS NULL OR ultimo < ?) LIMIT ?').bind(horaAgora(now), dia, LOTE).all();
  if (!results.length) return 0;
  const dado = dicaDoDia(now);
  await Promise.all(results.map((s) => enviar(env, s, dado)));
  await env.DB.batch(results.map((s) => env.DB.prepare('UPDATE inscricoes SET ultimo = ? WHERE endpoint = ?').bind(dia, s.endpoint)));
  return results.length;
}

export default {
  fetch: (req, env) => handle(req, env),
  scheduled: (event, env, ctx) => ctx.waitUntil(enviarDicas(env, event.scheduledTime)),
};
