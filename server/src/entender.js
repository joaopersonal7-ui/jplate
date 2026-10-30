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
const VERSAO = (() => {
  let h = 0;
  for (const c of BANCO.map((b) => b.texto).join('\n')) h = (Math.imul(h, 31) + c.codePointAt(0)) | 0;
  return `bge-m3:${BANCO.length}:${(h >>> 0).toString(36)}`;
})();
let memoria = null;

const paraTexto = (v) => btoa(String.fromCharCode(...new Uint8Array(Float32Array.from(v).buffer)));
const deTexto = (s) => new Float32Array(Uint8Array.from(atob(s), (c) => c.charCodeAt(0)).buffer);

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
    vetores = salvos.results.flatMap((r) => JSON.parse(r.dados).map(deTexto));
  } else {
    vetores = [];
    const escritas = [env.DB.prepare('DELETE FROM vetores')];
    for (let i = 0; i < lotes; i++) {
      const lote = await vetorizar(env, BANCO.slice(i * LOTE_VETOR, (i + 1) * LOTE_VETOR).map((b) => b.texto));
      vetores.push(...lote.map((v) => Float32Array.from(v)));
      escritas.push(env.DB.prepare('INSERT INTO vetores (versao, lote, dados) VALUES (?, ?, ?)').bind(VERSAO, i, JSON.stringify(lote.map(paraTexto))));
    }
    await env.DB.batch(escritas);
  }
  memoria = { versao: VERSAO, vetores };
  return vetores;
}

function cosseno(a, b) {
  let p = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) { p += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]; }
  return p / Math.sqrt(na * nb);
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
  const porSentido = vetores.map((v, i) => [i, cosseno(q, v)]).sort((a, b) => b[1] - a[1]).slice(0, CANDIDATOS).map(([i]) => BANCO[i].titulo);
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
