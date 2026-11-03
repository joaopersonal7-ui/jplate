// Gera os dados do servidor a partir do banco da SÁ (rode de novo sempre que o banco mudar):
// - server/src/dicas.js: dicas das notificações (começo da resposta dos 50 conceitos e das perguntas comuns sobre frutas
//   e vitaminas, cortado no fim de uma frase, em ordem misturada fixa). Das frutas ficam fora a parte técnica
//   (perguntas 101 a 200) e as situações especiais (diabetes, doença renal, gestação...), que não cabem num aviso para todos;
// - server/src/banco.js: títulos do banco que a IA usa para interpretar a pergunta do aluno (sem as respostas).
import { writeFileSync } from 'node:fs';
import { KB_CONCEITOS } from '../src/kb-conceitos.js';
import { KB_FRUTAS } from '../src/kb-frutas.js';
import { BANCO } from '../src/assistant.js';

const MAX = 180;

function resumo(texto) {
  const p = texto.split('\n')[0].trim();
  const frases = p.match(/[^.!?]+[.!?]+/g) ?? [p];
  let out = '';
  for (const f of frases) {
    if ((out + f).trim().length > MAX) break;
    out += f;
  }
  return (out || frases[0]).trim();
}

const out = (file, head, name, data) => writeFileSync(new URL(`../server/src/${file}`, import.meta.url),
  `// Gerado por scripts/gerar-servidor.mjs ${head} (não editar à mão).\nexport const ${name} = ${JSON.stringify(data, null, 1)};\n`);

// Embaralha sempre do mesmo jeito (a ordem só muda quando o banco muda), para não vir um assunto só por vários dias.
function misturar(lista) {
  const a = [...lista];
  let semente = 20261103;
  const rnd = () => (semente = (Math.imul(semente, 1103515245) + 12345) >>> 0) / 2 ** 32;
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const dicas = misturar([
  ...KB_CONCEITOS.map((k) => ({ titulo: k.conceito, texto: resumo(k.resposta) })),
  ...KB_FRUTAS.filter((k) => Number(k.id.slice(-3)) <= 100 && k.categoria !== 'Situações especiais').map((k) => ({ titulo: k.pergunta, texto: resumo(k.resposta) })),
]);
out('dicas.js', 'a partir de src/kb-conceitos.js e src/kb-frutas.js', 'DICAS', dicas);
out('banco.js', 'a partir de src/assistant.js', 'BANCO', BANCO);
console.log(`${dicas.length} dicas; ${BANCO.length} títulos no banco`);
