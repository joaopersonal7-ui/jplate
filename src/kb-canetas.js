// Fichas das canetas citadas na base de medicamentos, escritas a partir de bulas e páginas da Anvisa, FDA e EMA
// (consultadas em 29/10/2026). Sem doses nem esquemas de aumento. Pedidas e liberadas pelo Joao para entrar direto na SÁ.

export const CANETAS_FECHO = 'Para uma orientação específica para o seu caso, fale com a equipe da ConsultoriaJP e com o seu médico.';

const ALIMENTACAO = 'Alimentação e treino: com menos fome, é fácil comer pouca proteína e beber pouca água. Prefira refeições menores, com uma fonte de proteína, beba água ao longo do dia e mantenha o treino de força para proteger a massa muscular.';

const ANVISA_MOUNJARO = 'Anvisa. Mounjaro (tirzepatida): nova indicação. https://www.gov.br/anvisa/pt-br/assuntos/medicamentos/novos-medicamentos-e-indicacoes/mounjaro-r-tirzepatida-nova-indicacao';
const ANVISA_5 = 'Anvisa. Anvisa aprova cinco novas canetas de GLP-1 (29/10/2026). https://www.gov.br/anvisa/pt-br/assuntos/noticias-anvisa/2026/anvisa-aprova-cinco-novas-canetas-de-glp-1';
const ANVISA_GEN = 'Anvisa. Anvisa aprova dois genéricos de liraglutida (08/09/2026). https://www.gov.br/anvisa/pt-br/assuntos/noticias-anvisa/anvisa-aprova-dois-genericos-de-liraglutida';

export const KB_CANETAS = [
  {
    categoria: 'Fichas das canetas',
    pergunta: 'O que é semaglutida (Ozempic, Wegovy, Rybelsus)?',
    palavras_chave: ['semaglutida', 'ozempic', 'wegovy', 'rybelsus', 'embeltah', 'sevema'],
    resposta: [
      'O que é: um agonista do receptor GLP-1. Imita um hormônio do intestino que aumenta a saciedade e diminui a fome, a quantidade de comida e a vontade de comer.',
      'Para que é aprovada: Wegovy é para controle do peso, junto com dieta e atividade física, em adultos com obesidade (IMC 30 ou mais) ou sobrepeso (IMC 27 ou mais) com algum problema ligado ao peso, e em adolescentes a partir de 12 anos. Ozempic (caneta) e Rybelsus (comprimido) são para diabetes tipo 2. Em 2026 a Anvisa aprovou outras canetas de semaglutida para diabetes, como Embeltah e Sevema.',
      'Como se usa, em linhas gerais: a caneta é aplicada embaixo da pele (barriga, coxa ou braço) uma vez por semana. O comprimido é tomado uma vez por dia, em jejum. A dose é aumentada aos poucos pelo médico.',
      'Efeitos mais comuns: náusea, vômito, diarreia, intestino preso, dor de barriga e dor de cabeça, mais comuns no início e nos aumentos de dose.',
      'Cuidados importantes: pode haver pancreatite, problemas na vesícula e desidratação com vômitos ou diarreia. Quem usa insulina ou sulfonilureia tem mais risco de hipoglicemia. Não é indicada para quem tem histórico pessoal ou familiar de carcinoma medular de tireoide ou MEN 2. A agência europeia registrou como efeito muito raro uma perda súbita de visão (NAION). Se parar o remédio, o peso pode voltar.',
      ALIMENTACAO,
    ].join('\n\n'),
    referencias: [
      'EMA. Wegovy: resumo para o público. https://www.ema.europa.eu/en/documents/overview/wegovy-epar-medicine-overview_en.pdf',
      'EMA. Ozempic. https://www.ema.europa.eu/en/medicines/human/EPAR/ozempic',
      'EMA. Rybelsus. https://www.ema.europa.eu/en/medicines/human/EPAR/rybelsus',
      'FDA. Bula do Wegovy. https://www.accessdata.fda.gov/drugsatfda_docs/label/2026/215256s033lbl.pdf',
      ANVISA_5,
    ],
  },
  {
    categoria: 'Fichas das canetas',
    pergunta: 'O que é tirzepatida (Mounjaro)?',
    palavras_chave: ['tirzepatida', 'mounjaro', 'zepbound'],
    resposta: [
      'O que é: age em dois receptores de hormônios do intestino, o GIP e o GLP-1. Aumenta a saciedade, diminui a fome e ajuda a controlar a glicose.',
      'Para que é aprovada: no Brasil, o Mounjaro é aprovado para diabetes tipo 2 e, desde junho de 2025, para controle crônico do peso. A indicação de peso é para adultos com IMC 30 ou mais, ou IMC 27 ou mais com alguma doença ligada ao peso (pressão alta, colesterol alto, apneia do sono, doença do coração, pré-diabetes ou diabetes tipo 2). Sempre junto com dieta de menos calorias e mais atividade física. Não foi estudada para emagrecimento em menores de 18 anos.',
      'Como se usa, em linhas gerais: caneta aplicada embaixo da pele (barriga, coxa ou braço) uma vez por semana, trocando o local. A dose é aumentada aos poucos pelo médico. Não deve ser usada junto com outra caneta de GLP-1.',
      'Efeitos mais comuns: náusea, diarreia, vômito, intestino preso, dor de barriga, má digestão, reação no local da aplicação, cansaço, refluxo e queda de cabelo.',
      'Cuidados importantes: pode haver pancreatite, problemas na vesícula, desidratação e reações alérgicas. Com insulina ou sulfonilureia, aumenta o risco de hipoglicemia. Não é indicada para quem tem histórico pessoal ou familiar de carcinoma medular de tireoide ou MEN 2. Pode diminuir o efeito do anticoncepcional oral, então quem usa precisa conversar com o médico sobre outro método.',
      ALIMENTACAO,
    ].join('\n\n'),
    referencias: [ANVISA_MOUNJARO, 'FDA. Bula do Zepbound (tirzepatida). https://www.accessdata.fda.gov/drugsatfda_docs/label/2026/217806s042lbl.pdf'],
  },
  {
    categoria: 'Fichas das canetas',
    pergunta: 'O que é liraglutida (Saxenda, Victoza e similares)?',
    palavras_chave: ['liraglutida', 'saxenda', 'victoza', 'olire', 'lirux', 'lyrza', 'wylovol', 'aribet'],
    resposta: [
      'O que é: um agonista do receptor GLP-1, como a semaglutida. Regula o apetite e a quantidade de calorias ingeridas.',
      'Para que é aprovada: Saxenda é para controle do peso, junto com dieta e atividade física, em adultos com obesidade ou sobrepeso com alguma doença ligada ao peso, e em adolescentes a partir de 12 anos com obesidade e mais de 60 kg. Victoza é para diabetes tipo 2. Desde 2025 há versões nacionais (Olire, para obesidade, e Lirux, para diabetes), genéricos aprovados em 2026 e outras marcas, como Lyrza e Wylovol (obesidade) e Aribet (diabetes).',
      'Como se usa, em linhas gerais: caneta aplicada embaixo da pele (barriga, coxa ou braço) uma vez por dia, a qualquer hora, com ou sem comida. A dose é aumentada aos poucos pelo médico. As versões para diabetes e para peso têm esquemas diferentes e não devem ser trocadas por conta própria.',
      'Efeitos mais comuns: náusea, diarreia, intestino preso, vômito, reação no local da aplicação, dor de cabeça, má digestão, cansaço e tontura.',
      'Cuidados importantes: pode haver pancreatite, problemas na vesícula, aumento dos batimentos do coração e piora da função dos rins com desidratação. Não deve ser usada na gravidez nem por quem tem histórico pessoal ou familiar de carcinoma medular de tireoide ou MEN 2. A bula pede atenção a mudanças de humor e pensamentos de autoagressão.',
      ALIMENTACAO,
    ].join('\n\n'),
    referencias: ['FDA. Bula do Saxenda. https://www.accessdata.fda.gov/drugsatfda_docs/label/2023/206321s016lbl.pdf', ANVISA_GEN, ANVISA_5],
  },
  {
    categoria: 'Fichas das canetas',
    pergunta: 'O que é dulaglutida (Trulicity)?',
    palavras_chave: ['dulaglutida', 'trulicity'],
    resposta: [
      'O que é: um agonista do receptor GLP-1. Faz o pâncreas liberar mais insulina depois das refeições, o que ajuda a baixar a glicose.',
      'Para que é aprovada: diabetes tipo 2, em adultos e em crianças a partir de 10 anos, junto com dieta e exercício. Não é aprovada como caneta para emagrecer.',
      'Como se usa, em linhas gerais: caneta aplicada embaixo da pele (barriga, coxa ou braço) uma vez por semana, com receita.',
      'Efeitos mais comuns: náusea, vômito e diarreia.',
      'Cuidados importantes: usada com insulina ou sulfonilureia, aumenta o risco de hipoglicemia. Os cuidados com pancreatite, vesícula e desidratação são os mesmos das outras canetas de GLP-1.',
      'Alimentação e treino: mantenha refeições regulares com uma fonte de proteína, beba água ao longo do dia e conheça os sinais de hipoglicemia (tremor, suor frio, tontura) antes de treinar.',
    ].join('\n\n'),
    referencias: ['EMA. Trulicity: resumo para o público. https://www.ema.europa.eu/en/documents/overview/trulicity-epar-medicine-overview_en.pdf'],
  },
  {
    categoria: 'Fichas das canetas',
    pergunta: 'O que são exenatida e lixisenatida (Byetta, Lyxumia)?',
    palavras_chave: ['exenatida', 'lixisenatida', 'byetta', 'lyxumia', 'bydureon'],
    resposta: [
      'O que são: agonistas do receptor GLP-1 mais antigos, de ação mais curta.',
      'Para que são aprovadas: diabetes tipo 2 em adultos, somadas a outros remédios para diabetes ou à insulina. Não são aprovadas para emagrecer. O Lyxumia não está mais autorizado na União Europeia.',
      'Como se usam, em linhas gerais: caneta aplicada embaixo da pele. A exenatida (Byetta) é aplicada duas vezes por dia, antes do café da manhã e do jantar, nunca depois da refeição. A lixisenatida é aplicada uma vez por dia, antes da mesma refeição.',
      'Efeitos mais comuns: náusea, vômito, diarreia e dor de cabeça.',
      'Cuidados importantes: usadas com sulfonilureia ou insulina, aumentam o risco de hipoglicemia.',
      'Alimentação e treino: como a aplicação está ligada a refeições, mantenha os horários combinados com o médico, coma uma fonte de proteína nas refeições e conheça os sinais de hipoglicemia antes de treinar.',
    ].join('\n\n'),
    referencias: ['EMA. Byetta. https://www.ema.europa.eu/en/medicines/human/EPAR/byetta', 'EMA. Lyxumia: resumo para o público. https://www.ema.europa.eu/en/documents/overview/lyxumia-epar-summary-public_en.pdf'],
  },
];
