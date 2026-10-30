// Gera os dados do servidor a partir do banco da SÁ (rode de novo sempre que o banco mudar):
// - server/src/dicas.js: dica do dia das notificações (começo da resposta de cada um dos 50 conceitos, cortado no fim de uma frase);
// - server/src/banco.js: títulos do banco que a IA usa para interpretar a pergunta do aluno (sem as respostas).
import { writeFileSync } from 'node:fs';
import { KB_CONCEITOS } from '../src/kb-conceitos.js';
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

const dicas = KB_CONCEITOS.map((k) => ({ titulo: k.conceito, texto: resumo(k.resposta) }));
out('dicas.js', 'a partir de src/kb-conceitos.js', 'DICAS', dicas);
out('banco.js', 'a partir de src/assistant.js', 'BANCO', BANCO);
console.log(`${dicas.length} dicas; ${BANCO.length} títulos no banco`);
