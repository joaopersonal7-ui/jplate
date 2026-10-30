// Rotas do servidor com um D1 de mentira (SQLite do Node), uma API do Claude de mentira e um serviço de push de mentira.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { createECDH, randomBytes } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import ece from 'http_ece';
import { handle, enviarDicas, dicaDoDia } from '../src/index.js';
import { b64url } from '../src/webpush.js';

function fakeD1() {
  const db = new DatabaseSync(':memory:');
  db.exec(readFileSync(new URL('../schema.sql', import.meta.url), 'utf8'));
  const stmt = (sql, args = []) => ({
    bind: (...a) => stmt(sql, a),
    first: async () => db.prepare(sql).get(...args) ?? null,
    all: async () => ({ results: db.prepare(sql).all(...args) }),
    run: async () => db.prepare(sql).run(...args),
  });
  return { prepare: (sql) => stmt(sql), batch: async (list) => Promise.all(list.map((s) => s.run())), raw: db };
}

// API do Claude de mentira: responde fora do tema quando a pergunta fala de futebol.
const claude = createServer((req, res) => {
  let body = '';
  req.on('data', (c) => { body += c; });
  req.on('end', () => {
    const r = JSON.parse(body);
    claude.ultimo = r;
    const fora = /futebol/.test(r.messages[0].content);
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ id: 'msg_1', type: 'message', role: 'assistant', model: r.model, stop_reason: 'end_turn', stop_sequence: null,
      content: [{ type: 'text', text: fora ? 'FORA_DO_TEMA' : 'Prefira frutas inteiras ao suco, porque a fibra ajuda na saciedade.' }],
      usage: { input_tokens: 400, output_tokens: 100 } }));
  });
});
await new Promise((r) => claude.listen(0, r));
test.after(() => claude.close());

// Serviço de push de mentira: guarda o que chegou; o endpoint "vencido" responde 410.
const entregues = [];
const realFetch = globalThis.fetch;
globalThis.fetch = async (url, init) => {
  const u = String(url instanceof Request ? url.url : url);
  if (u.startsWith('https://push.test/')) {
    if (u.endsWith('/vencido')) return new Response(null, { status: 410 });
    entregues.push({ url: u, init });
    return new Response(null, { status: 201 });
  }
  return realFetch(url, init);
};

const env = (extra = {}) => ({ DB: fakeD1(), ORIGENS: 'https://joaopersonal7-ui.github.io', ANTHROPIC_API_KEY: 'teste', ANTHROPIC_BASE_URL: `http://127.0.0.1:${claude.address().port}`, IA_POR_ALUNO_DIA: '2', IA_TOTAL_DIA: '500', IA_TETO_MES_USD: '5', ...extra });
const post = (e, path, body, now) => handle(new Request(`https://srv${path}`, { method: 'POST', headers: { Origin: 'https://joaopersonal7-ui.github.io', 'Content-Type': 'application/json' }, body: JSON.stringify(body) }), e, now);
const ALUNO = 'aluno-0001-teste';

test('IA responde, conta a cota do aluno e o gasto do mês', async () => {
  const e = env();
  const r = await post(e, '/ia', { aluno: ALUNO, pergunta: 'Suco de fruta é tão bom quanto a fruta?' });
  assert.equal(r.status, 200);
  assert.equal(r.headers.get('Access-Control-Allow-Origin'), 'https://joaopersonal7-ui.github.io');
  const d = await r.json();
  assert.match(d.resposta, /fibra/);
  assert.equal(d.restantes, 1);
  assert.equal(claude.ultimo.model, 'claude-haiku-5-5');
  assert.equal(claude.ultimo.max_tokens, 400);
  const m = e.DB.raw.prepare('SELECT * FROM ia_mes').get();
  assert.equal(m.perguntas, 1);
  assert.ok(Math.abs(m.usd - (400 * 0.1e-6 + 100 * 0.5e-6)) < 1e-12);
});

test('limite por aluno: a terceira pergunta do dia é recusada sem chamar a IA', async () => {
  const e = env();
  await post(e, '/ia', { aluno: ALUNO, pergunta: 'pergunta um' });
  await post(e, '/ia', { aluno: ALUNO, pergunta: 'pergunta dois' });
  claude.ultimo = null;
  const r = await post(e, '/ia', { aluno: ALUNO, pergunta: 'pergunta três' });
  assert.equal(r.status, 429);
  assert.equal((await r.json()).erro, 'limite_aluno');
  assert.equal(claude.ultimo, null);
  // Outro aluno continua podendo perguntar.
  assert.equal((await post(e, '/ia', { aluno: 'aluno-0002-teste', pergunta: 'pergunta' })).status, 200);
});

test('fora do tema: resposta padrão e não gasta a cota do aluno', async () => {
  const e = env();
  const d = await (await post(e, '/ia', { aluno: ALUNO, pergunta: 'Quem ganhou o jogo de futebol?' })).json();
  assert.equal(d.fora, true);
  assert.match(d.resposta, /nutrição, alimentação e dieta/);
  assert.equal(d.restantes, 2);
});

test('teto do mês: a IA para e o app fica só com o banco', async () => {
  const e = env({ IA_TETO_MES_USD: '0.00001' });
  await post(e, '/ia', { aluno: ALUNO, pergunta: 'pergunta' });
  const r = await post(e, '/ia', { aluno: 'aluno-0003-teste', pergunta: 'outra' });
  assert.equal((await r.json()).erro, 'teto_mes');
  const st = await (await handle(new Request('https://srv/'), e)).json();
  assert.equal(st.ia, false);
});

test('sem chave da IA, o servidor avisa que a IA está indisponível', async () => {
  const r = await post(env({ ANTHROPIC_API_KEY: '' }), '/ia', { aluno: ALUNO, pergunta: 'pergunta' });
  assert.equal(r.status, 503);
});

test('origem desconhecida não recebe CORS', async () => {
  const r = await handle(new Request('https://srv/', { headers: { Origin: 'https://outro.site' } }), env());
  assert.equal(r.headers.get('Access-Control-Allow-Origin'), null);
});

test('notificações: inscreve, envia a dica na hora escolhida uma vez por dia e remove inscrição vencida', async () => {
  const e = env();
  const chave = (await (await handle(new Request('https://srv/push/chave'), e)).json()).chave;
  assert.equal(chave, (await (await handle(new Request('https://srv/push/chave'), e)).json()).chave, 'a chave não muda');

  const ua = createECDH('prime256v1');
  ua.generateKeys();
  const auth = randomBytes(16);
  const keys = { p256dh: b64url(ua.getPublicKey()), auth: b64url(auth) };
  assert.equal((await post(e, '/push/inscrever', { aluno: ALUNO, hora: 8, inscricao: { endpoint: 'https://push.test/a', keys } })).status, 200);
  assert.equal((await post(e, '/push/inscrever', { aluno: 'aluno-x-0000', hora: 8, inscricao: { endpoint: 'https://push.test/vencido', keys } })).status, 200);
  assert.equal((await post(e, '/push/inscrever', { aluno: ALUNO, hora: 25, inscricao: { endpoint: 'https://push.test/b', keys } })).status, 400);

  // 11h UTC = 8h em Brasília.
  const oito = Date.UTC(2026, 9, 30, 11, 0);
  assert.equal(await enviarDicas(e, Date.UTC(2026, 9, 30, 10, 0)), 0, '7h: ninguém');
  entregues.length = 0;
  assert.equal(await enviarDicas(e, oito), 2);
  assert.equal(entregues.length, 1);
  const aberto = JSON.parse(ece.decrypt(Buffer.from(entregues[0].init.body), { version: 'aes128gcm', privateKey: ua, authSecret: auth }).toString());
  assert.deepEqual(aberto, dicaDoDia(oito));
  assert.match(aberto.url, /^\.\/\?sa=/);
  assert.match(entregues[0].init.headers.Authorization, /^vapid t=.+, k=/);
  assert.equal(e.DB.raw.prepare('SELECT COUNT(*) AS n FROM inscricoes').get().n, 1, 'inscrição vencida removida');
  assert.equal(await enviarDicas(e, oito + 15 * 60e3), 0, 'não repete no mesmo dia');
  assert.equal(await enviarDicas(e, oito + 86400e3), 1, 'dia seguinte envia de novo');

  // Botão "Enviar teste" e cancelamento.
  entregues.length = 0;
  assert.equal((await (await post(e, '/push/teste', { endpoint: 'https://push.test/a' })).json()).ok, true);
  assert.equal(entregues.length, 1);
  await post(e, '/push/cancelar', { endpoint: 'https://push.test/a' });
  assert.equal(e.DB.raw.prepare('SELECT COUNT(*) AS n FROM inscricoes').get().n, 0);
});

test('a dica muda a cada dia', () => {
  assert.notEqual(dicaDoDia(Date.UTC(2026, 9, 30, 12)).title, dicaDoDia(Date.UTC(2026, 9, 31, 12)).title);
});
