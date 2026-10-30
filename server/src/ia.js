// IA da SÁ: só é chamada quando a SÁ não tem resposta cadastrada. Respostas curtas, só nutrição e dieta.
import Anthropic from '@anthropic-ai/sdk';

export const MODELO = 'claude-haiku-5-5';
// Preço do Haiku 5.5 em US$ por token (entrada e saída), para controlar o teto do mês.
const PRECO = { entrada: 0.10 / 1e6, saida: 0.50 / 1e6 };
const FORA = 'FORA_DO_TEMA';

export const FORA_DO_TEMA = 'Eu respondo só dúvidas sobre nutrição, alimentação e dieta. Pode me perguntar algo sobre esses assuntos?';

const SISTEMA = `Você é a SÁ, assistente de nutrição do app JPlate, da consultoria JP COMPANY. Você responde alunos que seguem um plano alimentar com acompanhamento da equipe.

Regras:
- Responda só sobre nutrição, alimentação, dieta, hidratação, suplementos alimentares e a relação da alimentação com treino e composição corporal. Para qualquer outro assunto, responda exatamente: ${FORA}
- Escreva em português do Brasil, com tom cordial e profissional, sem gírias e sem emojis.
- Seja breve: no máximo 120 palavras, em texto corrido, sem títulos e sem markdown.
- Use só informação consolidada. Se não tiver certeza, diga que não sabe e recomende falar com a equipe. Nunca invente números, estudos ou referências.
- Não faça diagnóstico, não indique remédio nem dose, não monte dieta individual e não mude o plano do aluno. Em temas de doença, gestação, remédios, canetas para emagrecer, sintomas ou exames, oriente de forma geral e recomende falar com a equipe e com o médico.`;

export function custo(usage) {
  return (usage.input_tokens ?? 0) * PRECO.entrada + (usage.output_tokens ?? 0) * PRECO.saida;
}

export async function perguntar(env, pergunta) {
  const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY, ...(env.ANTHROPIC_BASE_URL ? { baseURL: env.ANTHROPIC_BASE_URL } : {}) });
  const r = await client.messages.create({
    model: MODELO,
    max_tokens: 400,
    thinking: { type: 'disabled' },
    system: SISTEMA,
    messages: [{ role: 'user', content: pergunta }],
  });
  const texto = r.content.filter((b) => b.type === 'text').map((b) => b.text).join('').trim();
  const fora = r.stop_reason === 'refusal' || !texto || texto.includes(FORA);
  return { texto: fora ? FORA_DO_TEMA : texto, fora, usd: custo(r.usage) };
}
