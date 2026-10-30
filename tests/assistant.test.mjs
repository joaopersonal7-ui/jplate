import test from 'node:test';
import assert from 'node:assert/strict';
import { answer } from '../src/assistant.js';

test('assistente converte troca dentro do grupo pela tabela', () => {
  assert.match(answer('Posso trocar arroz por batata?').text, /100 g .*arroz.* 200 g .*batata-inglesa/);
  assert.match(answer('posso trocar 150 g de arroz por batata doce?').text, /195 g de batata-doce/);
});

test('assistente não troca entre grupos diferentes', () => {
  assert.match(answer('trocar frango por arroz').text, /não troque alimentos de grupos diferentes/);
});

test('assistente responde pelo FAQ e encaminha saúde para a equipe', () => {
  assert.equal(answer('Posso comer à noite?').title, 'Posso comer à noite sem prejudicar o emagrecimento?');
  assert.match(answer('tenho diabetes, posso comer banana?').text, /entre em contato com a equipe/);
  assert.match(answer('estou com dor no peito').text, /emergência/);
  assert.equal(answer('qual a capital da frança').from, null);
});

test('assistente acha cada pergunta da base e guarda as referências', async () => {
  const { KB } = await import('../src/kb.js');
  for (const k of KB) {
    // Assunto com respostas que se contradizem: a SÁ mostra as opções (incluindo esta) em vez de escolher.
    if (answer(k.pergunta).options?.includes(k.pergunta)) continue;
    const r = answer(k.pergunta);
    assert.equal(r.title, k.pergunta);
    assert.deepEqual(r.refs, k.referencias);
  }
  assert.equal(answer('vou viajar semana que vem').title, 'O que fazer com a dieta quando vou viajar?');
});

test('assistente responde um assunto e oferece os outros (ATP e emagrecimento)', () => {
  // Uma resposta só; os outros assuntos da pergunta aparecem em "Veja também".
  const r = answer('Como o ATP interfere no emagrecimento?');
  assert.equal(r.parts, undefined);
  assert.equal(r.title, 'O que é ATP?');
  assert.ok(r.related.some((t) => /gordura/i.test(t)));
});

test('assistente usa a base de medicamentos e fecha com a equipe', async () => {
  const { KB_MED } = await import('../src/kb-med.js');
  assert.ok(KB_MED.length >= 35);
  assert.ok(KB_MED.every((k) => !/\bA IA\b/.test(k.resposta)));
  const r = answer('estou com náusea com o ozempic');
  assert.equal(r.title, 'Estou com náusea por causa da caneta. O que fazer?');
  assert.match(r.text, /equipe da ConsultoriaJP/);
  assert.equal(r.related[0], 'O que é semaglutida (Ozempic, Wegovy, Rybelsus)?');
  assert.equal(answer('tirzepatida').title, 'O que é tirzepatida (Mounjaro)?');
  assert.equal(answer('o que é mounjaro').title, 'O que é tirzepatida (Mounjaro)?');
  assert.match(answer('o que é mounjaro').text, /equipe da ConsultoriaJP e com o seu médico/);
  // Remédio que não é para emagrecer continua na orientação geral.
  assert.equal(answer('tomo remédio para pressão').title, 'Medicamentos');
  // "Veja também" abre o texto exato da base de medicamentos.
  assert.match(answer('Posso fazer cardio em jejum?', { exact: true }).text, /caneta/);
});

test('SÁ conversa: cumprimenta pelo nome, responde sobre ela e lembra o último assunto', () => {
  const ctx = { name: 'João Paulo' };
  assert.match(answer('oi', ctx).text, /João/);
  assert.match(answer('quem é você?', ctx).text, /SÁ/);
  assert.match(answer('você é humana?', ctx).text, /assistente virtual/);
  const r = answer('oi, creatina funciona?', ctx);
  assert.equal(r.intro, 'Olá, João!');
  assert.equal(r.title, 'Creatina: para que serve?');
  const mais = answer('fala mais', { ...ctx, topic: r });
  assert.ok(mais.options.length >= 1);
  // Mensagens com "não" não viram conquista.
  assert.notEqual(answer('não consegui emagrecer', ctx).conv, 'conquista');
  assert.equal(answer('qual a capital da frança').text, 'Não tenho uma resposta cadastrada para essa pergunta no momento.');
  assert.ok(answer('dieta', ctx).options.length >= 2);
});

test('perguntas de teste: pelo menos 50 de 55 certas', async () => {
  const { avaliar } = await import('./perguntas-teste.mjs');
  assert.ok(avaliar(answer).acertos >= 50);
});

test('base de 300: cada pergunta acha a si mesma ou uma igual da base antiga, e conflito vira opções', async () => {
  const { KB_300 } = await import('../src/kb-300.js');
  assert.equal(KB_300.length, 300);
  let ok = 0;
  for (const k of KB_300) if (answer(k.pergunta).title === k.pergunta) ok++;
  assert.ok(ok >= 295);
  const r = answer('preciso fazer refeição livre?');
  assert.ok(r.options.includes('Refeição livre') && r.options.includes('Preciso fazer refeição livre?'));
  assert.equal(answer('Refeição livre', { exact: true }).title, 'Refeição livre');
});

test('50 conceitos: o nome do conceito abre a definição', async () => {
  const { KB_CONCEITOS } = await import('../src/kb-conceitos.js');
  assert.equal(KB_CONCEITOS.length, 50);
  for (const k of KB_CONCEITOS) assert.equal(answer(k.conceito).title, k.conceito);
  assert.equal(answer('o que é lipólise?').title, 'Lipólise');
});
