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
  assert.match(answer('tenho diabetes, posso comer banana?').text, /fale com a equipe/);
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
