// Rotas do servidor com um D1 de mentira (SQLite do Node), uma API do Claude de mentira e um serviço de push de mentira.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createECDH, randomBytes } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import ece from 'http_ece';
import { handle, enviarDicas, dicaDaVez, horariosDoDia, proximoEnvio, JANELAS } from '../src/index.js';
import { b64url } from '../src/webpush.js';
import { BANCO } from '../src/banco.js';

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

// Workers AI de mentira. Vetores: um eixo por palavra-chave, para "sentido" parecido dar vetor parecido.
// Modelo de texto: escolhe o primeiro item da lista que fala de caloria, ou 0 quando a pergunta fala de futebol.
const EIXOS = ['caloria', 'agua', 'proteina', 'sono', 'futebol'];
const ai = {
  chamadas: [],
  async run(model, input) {
    this.chamadas.push({ model, input });
    if (model === '@cf/baai/bge-m3') return { data: input.text.map((t) => EIXOS.map((e) => (t.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').includes(e) ? 1 : 0.01))) };
    const msg = input.messages[1].content;
    if (/futebol/.test(msg)) return { response: '0' };
    const linha = msg.split('\n').find((l) => /^\d+\. .*[Cc]aloria/.test(l));
    return { response: linha ? linha.split('.')[0] : '0' };
  },
};
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

const env = (extra = {}) => ({ DB: fakeD1(), AI: ai, ORIGENS: 'https://joaopersonal7-ui.github.io', IA_POR_ALUNO_DIA: '2', IA_TOTAL_DIA: '500', ...extra });
const post = (e, path, body, now) => handle(new Request(`https://srv${path}`, { method: 'POST', headers: { Origin: 'https://joaopersonal7-ui.github.io', 'Content-Type': 'application/json' }, body: JSON.stringify(body) }), e, now);
const ALUNO = 'aluno-0001-teste';

test('IA interpreta a pergunta e devolve só um título do banco, nunca uma resposta', async () => {
  const e = env();
  const r = await post(e, '/entender', { aluno: ALUNO, pergunta: 'Quanta caloria eu gasto por dia?', candidatos: ['Suar significa queimar mais gordura?', 'título que não existe'] });
  assert.equal(r.status, 200);
  assert.equal(r.headers.get('Access-Control-Allow-Origin'), 'https://joaopersonal7-ui.github.io');
  const { titulo, ...resto } = await r.json();
  assert.deepEqual(resto, {}, 'só o título, nenhum texto de resposta');
  assert.ok(BANCO.some((b) => b.titulo === titulo) && /caloria/i.test(titulo), titulo);
  const lista = ai.chamadas.at(-1).input.messages[1].content;
  assert.match(lista, /\d+\. Suar significa queimar mais gordura\?/, 'candidato do app entra na lista');
  assert.doesNotMatch(lista, /título que não existe/, 'título fora do banco é ignorado');
  assert.equal(e.DB.raw.prepare('SELECT n FROM ia_dia').get().n, 1);
});

test('sem pergunta parecida no banco, devolve null', async () => {
  const d = await (await post(env(), '/entender', { aluno: ALUNO, pergunta: 'Quem ganhou o jogo de futebol?' })).json();
  assert.deepEqual(d, { titulo: null });
});

test('vetores do banco são calculados uma vez e reaproveitados', async () => {
  ai.chamadas.length = 0;
  const e = env();
  await post(e, '/entender', { aluno: ALUNO, pergunta: 'agua' });
  await post(e, '/entender', { aluno: ALUNO, pergunta: 'sono' });
  const vet = ai.chamadas.filter((c) => c.model === '@cf/baai/bge-m3');
  // Banco já em memória: só a pergunta é vetorizada.
  assert.ok(vet.every((c) => c.input.text.length === 1));
});

test('limite por aluno: a terceira pergunta do dia é recusada sem chamar a IA', async () => {
  const e = env();
  await post(e, '/entender', { aluno: ALUNO, pergunta: 'pergunta um' });
  await post(e, '/entender', { aluno: ALUNO, pergunta: 'pergunta dois' });
  ai.chamadas.length = 0;
  const r = await post(e, '/entender', { aluno: ALUNO, pergunta: 'pergunta três' });
  assert.equal(r.status, 429);
  assert.equal((await r.json()).erro, 'limite_aluno');
  assert.equal(ai.chamadas.length, 0);
  assert.equal((await post(e, '/entender', { aluno: 'aluno-0002-teste', pergunta: 'pergunta' })).status, 200);
});

test('limite total do dia', async () => {
  const e = env({ IA_TOTAL_DIA: '1' });
  await post(e, '/entender', { aluno: ALUNO, pergunta: 'um' });
  assert.equal((await (await post(e, '/entender', { aluno: 'aluno-0003-teste', pergunta: 'dois' })).json()).erro, 'limite_total');
});

test('sem a IA ligada, o servidor avisa que está indisponível', async () => {
  const r = await post(env({ AI: undefined }), '/entender', { aluno: ALUNO, pergunta: 'pergunta' });
  assert.equal(r.status, 503);
});

test('origem desconhecida não recebe CORS', async () => {
  const r = await handle(new Request('https://srv/', { headers: { Origin: 'https://outro.site' } }), env());
  assert.equal(r.headers.get('Access-Control-Allow-Origin'), null);
});

test('notificações: inscreve, envia três dicas por dia em horários sorteados e remove inscrição vencida', async () => {
  const e = env();
  const chave = (await (await handle(new Request('https://srv/push/chave'), e)).json()).chave;
  assert.equal(chave, (await (await handle(new Request('https://srv/push/chave'), e)).json()).chave, 'a chave não muda');

  const ua = createECDH('prime256v1');
  ua.generateKeys();
  const auth = randomBytes(16);
  const keys = { p256dh: b64url(ua.getPublicKey()), auth: b64url(auth) };
  const meiaNoite = Date.UTC(2026, 9, 30, 3, 0); // 0h em Brasília
  assert.equal((await post(e, '/push/inscrever', { aluno: ALUNO, inscricao: { endpoint: 'https://push.test/a', keys } }, meiaNoite)).status, 200);
  assert.equal((await post(e, '/push/inscrever', { aluno: 'aluno-x-0000', hora: 8, inscricao: { endpoint: 'https://push.test/vencido', keys } }, meiaNoite)).status, 200, 'app antigo ainda manda a hora');
  assert.equal((await post(e, '/push/inscrever', { aluno: ALUNO, hora: 25, inscricao: { endpoint: 'https://push.test/b', keys } }, meiaNoite)).status, 400);

  // Simula o cron a cada 15 minutos durante dois dias.
  entregues.length = 0;
  const horas = [];
  for (let t = meiaNoite; t < meiaNoite + 2 * 86400e3; t += 15 * 60e3) {
    const n0 = entregues.length;
    await enviarDicas(e, t);
    for (let i = n0; i < entregues.length; i++) horas.push(t);
  }
  assert.equal(entregues.length, 6, 'três por dia, só para o aparelho válido');
  assert.equal(e.DB.raw.prepare('SELECT COUNT(*) AS n FROM inscricoes').get().n, 1, 'inscrição vencida removida');
  assert.equal(e.DB.raw.prepare('SELECT COUNT(*) AS n FROM agenda').get().n, 1);
  const hb = horas.map((t) => { const d = new Date(t - 3 * 3600e3); return d.getUTCHours() * 60 + d.getUTCMinutes(); });
  hb.forEach((m, i) => { const [de, ate] = JANELAS[i % 3]; assert.ok(m >= de && m <= ate, `envio ${i} às ${m / 60}h`); });
  assert.deepEqual(horas.slice(0, 3), horariosDoDia('https://push.test/a', meiaNoite));
  assert.notDeepEqual(hb.slice(0, 3), hb.slice(3), 'os horários mudam de um dia para o outro');

  const abertos = entregues.map((x) => JSON.parse(ece.decrypt(Buffer.from(x.init.body), { version: 'aes128gcm', privateKey: ua, authSecret: auth }).toString()));
  assert.equal(new Set(abertos.map((a) => a.title)).size, 6, 'seis dicas diferentes em dois dias');
  assert.deepEqual(abertos[0], dicaDaVez(horas[0]));
  assert.match(abertos[0].url, /^\.\/\?sa=/);
  assert.match(entregues[0].init.headers.Authorization, /^vapid t=.+, k=/);

  // Botão "Enviar teste" e cancelamento.
  entregues.length = 0;
  assert.equal((await (await post(e, '/push/teste', { endpoint: 'https://push.test/a' })).json()).ok, true);
  assert.equal(entregues.length, 1);
  await post(e, '/push/cancelar', { endpoint: 'https://push.test/a' });
  assert.equal(e.DB.raw.prepare('SELECT COUNT(*) AS n FROM inscricoes').get().n, 0);
  assert.equal(e.DB.raw.prepare('SELECT COUNT(*) AS n FROM agenda').get().n, 0);
});

test('inscrição antiga (sem agenda) entra na agenda sem receber fora de hora, e servidor parado não manda dica atrasada', async () => {
  const e = env();
  const keys = { p256dh: 'x'.repeat(87), auth: 'y'.repeat(22) };
  e.DB.raw.prepare('INSERT INTO inscricoes (endpoint, aluno, p256dh, auth, hora, criado) VALUES (?, ?, ?, ?, 8, ?)').run('https://push.test/velho', ALUNO, keys.p256dh, keys.auth, 'x');
  const noite = Date.UTC(2026, 9, 31, 1, 0); // 22h em Brasília
  entregues.length = 0;
  assert.equal(await enviarDicas(e, noite), 0);
  const prox = e.DB.raw.prepare('SELECT proximo FROM agenda').get().proximo;
  assert.equal(prox, proximoEnvio('https://push.test/velho', noite));
  assert.ok(prox > noite);
  // Servidor volta 5 h depois do horário: não envia, só reagenda.
  assert.equal(await enviarDicas(e, prox + 5 * 3600e3), 0);
  assert.equal(entregues.length, 0);
  assert.ok(e.DB.raw.prepare('SELECT proximo FROM agenda').get().proximo > prox + 5 * 3600e3);
});

test('as três dicas do dia são diferentes e mudam no dia seguinte', () => {
  const dia = [Date.UTC(2026, 9, 30, 12), Date.UTC(2026, 9, 30, 16), Date.UTC(2026, 9, 30, 21)].map((t) => dicaDaVez(t).title);
  assert.equal(new Set(dia).size, 3);
  assert.notEqual(dicaDaVez(Date.UTC(2026, 9, 31, 12)).title, dia[0]);
});

test('vetores guardados em 1 byte por número voltam iguais e mantêm a ordem por sentido', async () => {
  const { quantizar, paraTexto, deTexto } = await import('../src/entender.js');
  const a = quantizar([0.9, 0.1, -0.3, 0.2]);
  const b = quantizar([-0.5, 0.8, 0.1, 0]);
  const [a2, b2] = deTexto(paraTexto([a, b]), 4);
  assert.deepEqual([...a2], [...a]);
  assert.deepEqual([...b2], [...b]);
  assert.ok(a.every((x) => x >= -127 && x <= 127));
  const q = [1, 0.1, -0.2, 0.2];
  const dot = (v) => v.reduce((t, x, i) => t + x * q[i], 0);
  assert.ok(dot(a2) > dot(b2));
});
