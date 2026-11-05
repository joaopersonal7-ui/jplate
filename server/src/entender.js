// Interpretação da pergunta com a IA gratuita da Cloudflare (Workers AI).
// A IA só escolhe qual pergunta cadastrada no banco da SÁ tem o mesmo sentido; ela nunca escreve respostas.
// O app mostra o texto cadastrado do título escolhido, exatamente como está no banco.
import { BANCO } from './banco.js';

export const MODELO_VETOR = '@cf/baai/bge-m3';
export const MODELO_TEXTO = '@cf/meta/llama-3.3-70b-instruct-fp8-fast';
const LOTE_VETOR = 100;
const CANDIDATOS = 10;

// Vetores dos títulos do banco: calculados na primeira pergunta, guardados no D1 e na memória.
// A chave muda quando o banco muda, e aí os vetores são recalculados.
// Cada vetor é normalizado e guardado em 1 byte por número (int8): 4 vezes menor e rápido de ler,
// o que importa com mais de mil títulos no limite de processamento do plano gratuito.
const VERSAO = (() => {
  let h = 0;
  for (const c of BANCO.map((b) => b.texto).join('\n')) h = (Math.imul(h, 31) + c.codePointAt(0)) | 0;
  return `bge-m3-i8:${BANCO.length}:${(h >>> 0).toString(36)}`;
})();
let memoria = null;

export function quantizar(v) {
  const n = Math.sqrt(v.reduce((t, x) => t + x * x, 0)) || 1;
  return Int8Array.from(v, (x) => Math.round((x / n) * 127));
}

export function paraTexto(vetores) {
  let s = '';
  for (const v of vetores) for (const b of new Uint8Array(v.buffer, v.byteOffset, v.length)) s += String.fromCharCode(b);
  return btoa(s);
}

export function deTexto(s, dim) {
  const bin = atob(s);
  const bytes = new Int8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = (bin.charCodeAt(i) << 24) >> 24;
  const out = [];
  for (let i = 0; i < bytes.length; i += dim) out.push(bytes.subarray(i, i + dim));
  return out;
}

async function vetorizar(env, textos) {
  const r = await env.AI.run(MODELO_VETOR, { text: textos });
  return r.data ?? r.response;
}

async function vetoresDoBanco(env) {
  if (memoria?.versao === VERSAO) return memoria.vetores;
  const salvos = await env.DB.prepare('SELECT lote, dados FROM vetores WHERE versao = ? ORDER BY lote').bind(VERSAO).all();
  const lotes = Math.ceil(BANCO.length / LOTE_VETOR);
  let vetores;
  if (salvos.results.length === lotes) {
    vetores = salvos.results.flatMap((r) => { const [dim, dados] = r.dados.split(':'); return deTexto(dados, Number(dim)); });
  } else {
    vetores = [];
    const escritas = [env.DB.prepare('DELETE FROM vetores')];
    for (let i = 0; i < lotes; i++) {
      const lote = (await vetorizar(env, BANCO.slice(i * LOTE_VETOR, (i + 1) * LOTE_VETOR).map((b) => b.texto))).map(quantizar);
      vetores.push(...lote);
      escritas.push(env.DB.prepare('INSERT INTO vetores (versao, lote, dados) VALUES (?, ?, ?)').bind(VERSAO, i, `${lote[0].length}:${paraTexto(lote)}`));
    }
    await env.DB.batch(escritas);
  }
  memoria = { versao: VERSAO, vetores };
  return vetores;
}

// Os vetores do banco já estão normalizados: o produto escalar ordena igual ao cosseno.
function produto(q, v) {
  let p = 0;
  for (let i = 0; i < v.length; i++) p += q[i] * v[i];
  return p;
}

const SISTEMA = `Você ajuda a SÁ, assistente de nutrição de um app. Ela só pode responder com textos já cadastrados.
Você recebe a pergunta de um aluno e uma lista numerada de perguntas cadastradas.
Escolha a pergunta cadastrada cuja resposta responde a dúvida do aluno, mesmo que ele tenha escrito com outras palavras, gírias ou erros de digitação.
Se nenhuma responde (assunto diferente ou só parecido), escolha 0.
Responda apenas com o número, sem nenhum outro texto.`;

// Devolve o título escolhido do banco, ou null quando nenhum responde a pergunta.
export async function entender(env, pergunta, locais = []) {
  const vetores = await vetoresDoBanco(env);
  const [q] = await vetorizar(env, [pergunta]);
  const porSentido = vetores.map((v, i) => [i, produto(q, v)]).sort((a, b) => b[1] - a[1]).slice(0, CANDIDATOS).map(([i]) => BANCO[i].titulo);
  const titulos = new Set(BANCO.map((b) => b.titulo));
  const lista = [...new Set([...porSentido, ...locais.filter((t) => titulos.has(t))])];
  const r = await env.AI.run(env.MODELO_IA || MODELO_TEXTO, {
    messages: [
      { role: 'system', content: SISTEMA },
      { role: 'user', content: `Pergunta do aluno: ${pergunta}\n\nPerguntas cadastradas:\n${lista.map((t, i) => `${i + 1}. ${t}`).join('\n')}\n\nNúmero:` },
    ],
    max_tokens: 8,
    temperature: 0,
  });
  const n = Number(String(r.response ?? '').match(/\d+/)?.[0] ?? 0);
  return n >= 1 && n <= lista.length ? lista[n - 1] : null;
}
