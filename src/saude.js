// Respostas genéricas da SÁ para temas de saúde: dão um norte geral, sem diagnóstico, prescrição ou doses,
// e sempre terminam encaminhando para a equipe. A ordem importa: sinais de alerta vêm primeiro.

export const TEAM_CLOSE = 'Para uma orientação específica para o seu caso, entre em contato com a equipe da ConsultoriaJP.';

export const HEALTH_TOPICS = [
  {
    id: 'alerta',
    label: 'Sinais de alerta',
    match: /\b(dor no peito|aperto no peito|falta de ar|desmai\w*|convuls\w*|sangramento|sangue n[ao]s? fezes|vomit\w* sangue)\b/,
    text: 'Esse pode ser um sinal de alerta. Se estiver acontecendo agora, interrompa qualquer atividade e procure atendimento de emergência imediatamente (SAMU 192 ou o pronto-socorro mais próximo). Não espere melhorar sozinho nem tente resolver com mudanças na alimentação.',
  },
  {
    id: 'diabetes',
    label: 'Diabetes e glicemia',
    match: /\b(diabet\w*|glicemia|glicose alta|pre ?diabet\w*|insulina|hipoglicemia|resistencia (a )?insulina)\b/,
    text: 'Quem tem diabetes ou alterações na glicemia pode, sim, ter uma alimentação equilibrada e variada. Em geral ajuda manter horários regulares, priorizar alimentos ricos em fibras (verduras, legumes, feijões, frutas inteiras e cereais integrais), incluir uma fonte de proteína nas refeições e reduzir açúcares e bebidas adoçadas. A quantidade de carboidratos e a distribuição ao longo do dia dependem do tipo de diabetes, dos medicamentos e dos seus exames. Não mude a dose de remédios ou insulina por conta própria, e fique atento a sinais de hipoglicemia, como tremor, suor frio e tontura.',
  },
  {
    id: 'pressao',
    label: 'Pressão alta e coração',
    match: /\b(pressao (alta|baixa)|hipertens\w*|colesterol|triglicer\w*|cardiac\w*|coracao|infarto)\b/,
    text: 'Para quem cuida da pressão ou do coração, costuma ajudar reduzir o sal e os alimentos ultraprocessados (embutidos, temperos prontos, salgadinhos, comidas congeladas prontas), preferir temperos naturais, comer mais frutas, verduras e legumes e manter atividade física regular. Leia os rótulos para comparar a quantidade de sódio. Esses cuidados complementam o tratamento e não substituem os remédios prescritos.',
  },
  {
    id: 'gestacao',
    label: 'Gestação e amamentação',
    match: /\b(gravid\w*|gestant\w*|gestacao|engravid\w*|amament\w*|lactante|lactacao|pos parto|bebe)\b/,
    text: 'Na gestação e na amamentação as necessidades nutricionais mudam, e não é o momento para dietas restritivas ou metas de emagrecimento por conta própria. Em geral, o foco é uma alimentação variada, boa hidratação, higiene cuidadosa dos alimentos e acompanhamento do pré-natal. Suplementos só com orientação do seu médico ou nutricionista, e evite suplementos esportivos sem liberação.',
  },
  {
    id: 'remedios',
    label: 'Medicamentos',
    match: /\b(remedio\w*|medicament\w*|medicacao|ozempic|mounjaro|wegovy|saxenda|semaglutida|tirzepatida|sibutramina|anticoncepcional|antidepressiv\w*|caneta)\b/,
    text: 'Alguns medicamentos podem mudar o apetite, o peso, a digestão ou a forma como certos alimentos e suplementos agem no corpo. Por isso, não comece, pare ou mude a dose de nenhum remédio por conta própria, e avise a equipe sobre todos os medicamentos e suplementos que você usa. Assim o plano alimentar pode ser ajustado com segurança.',
  },
  {
    id: 'tireoide',
    label: 'Tireoide',
    match: /\b(tireoid\w*|hipotireoid\w*|hipertireoid\w*|levotiroxina|puran|euthyrox)\b/,
    text: 'Alterações na tireoide podem influenciar o gasto de energia, o cansaço e o peso, mas com o tratamento em dia a maioria das pessoas consegue seguir um plano alimentar normal. Em geral, vale tomar o remédio sempre do jeito orientado pelo médico (muitas vezes em jejum) e manter uma alimentação equilibrada. Não existe um alimento que "cure" ou "acelere" a tireoide, e suplementos de iodo ou selênio não devem ser usados por conta própria.',
  },
  {
    id: 'rins',
    label: 'Rins e fígado',
    match: /\b(renal|rins?|calculo renal|pedra no rim|figado|hepat\w*|gordura no figado|esteatose)\b/,
    text: 'Em problemas nos rins ou no fígado, a quantidade de proteína, sal, potássio, líquidos e outros nutrientes pode precisar de ajuste específico, que depende do estágio e do tratamento. Por isso, não aplique por conta própria metas de proteína de quem treina nem use suplementos sem liberação. Uma alimentação simples, com menos ultraprocessados e boa hidratação (quando permitida), costuma ser um bom ponto de partida.',
  },
  {
    id: 'alergia',
    label: 'Alergias e intolerâncias',
    match: /\b(alerg\w*|intoleran\w*|lactose|gluten|celiac\w*|reacao (a|ao) alimento)\b/,
    text: 'Sintomas depois de comer um alimento podem ter várias causas e nem sempre são alergia ou intolerância. Em geral, anote o que comeu e o que sentiu, e evite cortar grupos inteiros de alimentos por conta própria. Existem opções sem lactose e sem glúten que podem ajudar quando há diagnóstico. Se tiver inchaço nos lábios ou na garganta, falta de ar ou manchas pelo corpo depois de comer, procure atendimento de emergência.',
  },
  {
    id: 'mal-estar',
    label: 'Tontura e fraqueza',
    match: /\b(tontura|tont\w*|fraqueza|fraco|mal estar|vista escur\w*|pressao caiu)\b/,
    text: 'Tontura ou fraqueza podem ter várias causas, como pouca comida, pouca água, calor, esforço intenso ou queda de pressão. Em geral, pare a atividade, sente ou deite, beba água e faça um lanche se estiver há muito tempo sem comer. Não treine em jejum se isso costuma acontecer. Se os sintomas forem fortes, frequentes ou vierem com desmaio ou dor no peito, procure atendimento médico.',
  },
  {
    id: 'digestao',
    label: 'Sintomas digestivos',
    match: /\b(enjoo|nausea|vomit\w*|diarre\w*|intestino preso|prisao de ventre|constipa\w*|gases|estufad\w*|inchad\w*|azia|refluxo|gastrite)\b/,
    text: 'Desconfortos digestivos são comuns quando a alimentação muda. Em geral ajuda comer devagar, fazer refeições menores, beber água ao longo do dia e aumentar as fibras aos poucos (de uma vez podem piorar gases e inchaço). No intestino preso, água, frutas, verduras e feijões costumam ajudar. Se houver vômitos ou diarreia que não passam, sangue nas fezes, febre ou perda de peso sem querer, procure atendimento médico.',
  },
  {
    id: 'dor',
    label: 'Dores',
    match: /\b(dor|dores|doendo|doi|lesao|lesionad\w*|machuc\w*)\b/,
    text: 'Dor muscular leve um ou dois dias depois de um treino novo é comum e costuma melhorar com descanso, sono e alimentação adequada. Já dor forte, que piora, que aparece nas articulações, que vem com inchaço, urina escura ou que não melhora, precisa ser avaliada por um profissional de saúde antes de continuar treinando. A alimentação ajuda na recuperação, mas não trata lesões.',
  },
  {
    id: 'cirurgia',
    label: 'Cirurgias',
    match: /\b(cirurgi\w*|bariatric\w*|operad\w*|pos operatorio|reducao de estomago)\b/,
    text: 'Depois de uma cirurgia, especialmente a bariátrica, a alimentação segue fases e cuidados próprios: consistência dos alimentos, tamanho das porções, proteína e suplementos definidos pela equipe que fez a cirurgia. Não antecipe fases nem adapte por conta própria planos feitos para outras pessoas.',
  },
  {
    id: 'exames',
    label: 'Exames e deficiências',
    match: /\b(exame\w*|anemia|anemic\w*|ferro baixo|ferritina|vitamina d baixa|b12|deficiencia)\b/,
    text: 'Resultados de exames precisam ser interpretados junto com o seu histórico, por isso o app não consegue dizer o que um valor significa no seu caso. Em geral, uma alimentação variada, com carnes, ovos, feijões, verduras escuras e frutas, ajuda a manter bons níveis de ferro e vitaminas. Suplementos como ferro e vitamina D só devem ser usados com indicação, porque em excesso também fazem mal.',
  },
  {
    id: 'comportamento',
    label: 'Compulsão e relação com a comida',
    match: /\b(compuls\w*|bulimi\w*|anorexi\w*|transtorno alimentar|vomitar de proposito|culpa|ansiedade)\b/,
    text: 'Comer mais em alguns momentos ou sentir culpa com a comida acontece com muitas pessoas, e você não está sozinho(a) nisso. Em geral ajuda não pular refeições, evitar restrições muito rígidas e não compensar com jejum ou exercício em excesso. Se episódios de perda de controle, culpa intensa ou vômitos provocados acontecem com frequência, é importante buscar apoio profissional, inclusive psicológico.',
  },
  {
    id: 'doenca',
    label: 'Outras condições de saúde',
    match: /\b(doenca|sindrome|cancer|quimioterapia|ovario policistico|sop|endometriose|gota|acido urico)\b/,
    text: 'Condições de saúde podem mudar as necessidades de alimentação, e por isso o app não consegue dar uma orientação segura para o seu caso específico. Em geral, uma alimentação variada, com poucos ultraprocessados, boa hidratação e regularidade nas refeições é um bom ponto de partida, sempre seguindo o que o seu médico já orientou.',
  },
];

export function healthTopic(normText) {
  return HEALTH_TOPICS.find((t) => t.match.test(normText)) ?? null;
}
