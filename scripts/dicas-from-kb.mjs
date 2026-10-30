// Gera server/src/dicas.js (dica do dia das notificações) a partir dos 50 conceitos da SÁ.
// O texto é o começo da resposta cadastrada, cortado no fim de uma frase; tocar na notificação abre a resposta completa na SÁ.
import { writeFileSync } from 'node:fs';
import { KB_CONCEITOS } from '../src/kb-conceitos.js';

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

const dicas = KB_CONCEITOS.map((k) => ({ titulo: k.conceito, texto: resumo(k.resposta), pergunta: k.pergunta }));
writeFileSync(new URL('../server/src/dicas.js', import.meta.url),
  `// Gerado por scripts/dicas-from-kb.mjs a partir de src/kb-conceitos.js (não editar à mão).\nexport const DICAS = ${JSON.stringify(dicas, null, 1)};\n`);
console.log(`${dicas.length} dicas; maior texto: ${Math.max(...dicas.map((d) => d.texto.length))} caracteres`);
