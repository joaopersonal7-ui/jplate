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
    const r = answer(k.pergunta);
    assert.equal(r.title, k.pergunta);
    assert.deepEqual(r.refs, k.referencias);
  }
  assert.equal(answer('vou viajar semana que vem').title, 'O que fazer com a dieta quando vou viajar?');
});

test('assistente junta assuntos numa resposta só (ATP e emagrecimento)', () => {
  const r = answer('Como o ATP interfere no emagrecimento?');
  assert.ok(r.parts.length >= 2);
  assert.equal(r.parts[0].title, 'O que é ATP?');
  assert.ok(r.parts.some((p) => /gordura/i.test(p.title)));
});

test('assistente usa a base de medicamentos e fecha com a equipe', async () => {
  const { KB_MED } = await import('../src/kb-med.js');
  assert.ok(KB_MED.length >= 40);
  assert.ok(KB_MED.every((k) => !/\bA IA\b/.test(k.resposta)));
  const r = answer('estou com náusea com o ozempic');
  assert.equal(r.title, 'Estou com náusea por causa da caneta. O que fazer?');
  assert.match(r.text, /entre em contato com a equipe/);
  assert.equal(answer('o que é mounjaro').title, 'O que é tirzepatida?');
  // Remédio que não é para emagrecer continua na orientação geral.
  assert.equal(answer('tomo remédio para pressão').title, 'Medicamentos');
  // "Veja também" abre o texto exato da base de medicamentos.
  assert.match(answer('Posso fazer cardio em jejum?', { exact: true }).text, /caneta/);
});
