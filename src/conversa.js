// Falas de conversa da SÁ: cumprimentos, perguntas sobre ela, ânimo, confirmações e despedidas.
// Seguem o "Banco de informações da SÁ" do Joao: português claro, cordial e profissional, sem gírias e sem inventar
// informações de nutrição (essas vêm só da base). {nome} vira o nome do aluno, {saudacao} vira bom dia/boa tarde/boa noite
// e {assunto} vira o último assunto da conversa. Cada fala tem variações, sorteadas para não repetir.

// Cada item: [id, padrão (texto sem acentos e em minúsculas), falas]. A ordem importa: o primeiro que casar vale.
export const CONVERSA = [
  ['bom-dia', /^(bom dia|bomdia)\b/, [
    'Bom dia, {nome}! Que bom ter você por aqui. Em que posso ajudar hoje?',
    'Bom dia, {nome}! Espero que seu dia esteja começando bem. Qual é a sua dúvida?',
    'Bom dia! Estou à disposição, {nome}. Pode perguntar.',
  ]],
  ['boa-tarde', /^(boa tarde)\b/, [
    'Boa tarde, {nome}! Como posso ajudar?',
    'Boa tarde, {nome}! Fique à vontade para perguntar sobre alimentação, treino ou dieta.',
    'Boa tarde! Estou aqui para ajudar, {nome}. Qual é a sua dúvida?',
  ]],
  ['boa-noite', /^(boa noite)\b/, [
    'Boa noite, {nome}! Em que posso ajudar?',
    'Boa noite, {nome}! Ainda dá tempo de tirar uma dúvida. Pode perguntar.',
    'Boa noite! Que bom falar com você, {nome}. Qual é a sua pergunta?',
  ]],
  ['oi', /^(oi+|ola|ole|opa|eai|e ai|hey|hello|hi|alo|oie|salve|fala sa|oi sa|ola sa)\b/, [
    'Olá, {nome}! {saudacao_cap}. Em que posso ajudar?',
    'Oi, {nome}! Que bom ver você por aqui. Qual é a sua dúvida?',
    'Olá! Estou à disposição, {nome}. Pode perguntar sobre alimentação, treino ou dieta.',
    'Oi, {nome}! {saudacao_cap}. Fique à vontade para perguntar.',
  ]],
  ['tudo-bem', /\b(tudo (bem|bom|certo|tranquilo|joia|ok)|como (vai|voce esta|vc esta|voce ta|vc ta|esta voce)|como (esta|anda)s?|como foi seu dia|ta tudo bem|esta tudo bem)\s*\??$/, [
    'Tudo ótimo por aqui, {nome}, obrigada por perguntar! E com você, tudo bem?',
    'Estou muito bem, obrigada! E você, {nome}, como está?',
    'Tudo certo, {nome}. Fico feliz com a sua pergunta. E por aí, como estão as coisas?',
  ], 'perguntou-bem'],
  ['estou-bem', /^(to|estou|tou|eu to|eu estou|tudo|ta tudo|esta tudo|vou|bem|otimo|otima|tudo otimo|tudo certo|tranquilo|de boa|joia|beleza)\b.*\b(bem|otim[oa]|certo|tranquil[oa]|joia|beleza|bom|boa|de boa|feliz)\b|^(bem|otimo|otima|tudo otimo|tudo certo|tranquilo|joia|beleza|tudo sim|bem e voce|tudo e voce|tudo e com voce)\b/, [
    'Que bom saber disso, {nome}! Em que posso ajudar hoje?',
    'Fico feliz em saber, {nome}. Se tiver alguma dúvida sobre alimentação ou treino, é só perguntar.',
    'Ótimo, {nome}! Estou à disposição para o que precisar.',
  ]],
  ['estou-mal', /\b(to|estou|tou|me sinto|me sentindo|dia)\b.*\b(mal|triste|pra baixo|para baixo|chatead[oa]|estressad[oa]|ansios[oa]|ruim|pessimo|horrivel|nervos[oa])\b/, [
    'Sinto muito que você esteja assim, {nome}. Dias difíceis acontecem com todo mundo. Se quiser, posso tirar alguma dúvida sobre a sua alimentação, e a equipe da ConsultoriaJP também está à disposição para conversar.',
    'Obrigada por me contar, {nome}. Cuide de você com calma hoje: uma refeição tranquila, água e um pouco de descanso já ajudam. Se precisar, fale com a equipe da ConsultoriaJP.',
    'Entendo, {nome}. Nem todo dia é fácil, e está tudo bem. Se algo na dieta estiver pesando, me conte qual é a dúvida ou procure a equipe da ConsultoriaJP.',
  ]],
  ['obrigado', /^(muito )?(obrigad[oa]|obg|brigad[oa]|valeu|vlw|agradeco|grat[oa]|thanks|muito obrigad[oa])\b|\b(obrigad[oa]|valeu)( sa)?[!. ]*$/, [
    'Por nada, {nome}! Estou aqui sempre que precisar.',
    'Disponha, {nome}! Se surgir outra dúvida, é só perguntar.',
    'Foi um prazer ajudar, {nome}. Bons resultados!',
    'Imagina, {nome}! Conte comigo.',
  ]],
  ['tchau', /^(tchau|tchauzinho|ate (logo|mais|amanha|depois|breve|a proxima)|falou|fui|xau|adeus|bye|ate)\b|\b(tchau|ate mais|ate logo|ate amanha)[!. ]*$/, [
    'Até logo, {nome}! Foi ótimo conversar com você.',
    'Tchau, {nome}! Volte sempre que tiver alguma dúvida.',
    'Até mais, {nome}! Siga firme no seu plano.',
  ]],
  ['quem-e-voce', /\b(quem (e|eh) (voce|vc|a sa|tu)|qual (e |eh )?(o )?seu nome|como (voce|vc) se chama|seu nome|quem (ta|esta) falando|se apresent\w*)\b/, [
    'Eu sou a SÁ, a assistente virtual do JPlate. Respondo dúvidas sobre nutrição, alimentação, treino e dieta com base no banco de dados da JP Company.',
    'Muito prazer, {nome}! Meu nome é SÁ. Sou a assistente do JPlate e respondo com as informações cadastradas pela ConsultoriaJP.',
  ]],
  ['e-humana', /\b(voce|vc|tu) (e|eh|é) (humana|humano|gente|pessoa|real|de verdade|robo|uma? robo|uma? ia|inteligencia artificial|maquina|um bot|bot|chatgpt|uma pessoa)\b|\b(e|eh) (uma? )?(robo|ia|bot|pessoa real)\??$/, [
    'Não sou uma pessoa, {nome}. Sou a SÁ, uma assistente virtual que responde com as informações cadastradas pela ConsultoriaJP. Para um atendimento individual, a equipe está à disposição.',
    'Sou uma assistente virtual, não uma pessoa. Funciono com o banco de dados da JP Company, por isso respondo só o que foi cadastrado e aprovado pela equipe.',
  ]],
  ['quem-criou', /\b(quem (te |lhe )?(criou|fez|desenvolveu|programou|inventou)|quem (e|eh) (seu|sua) (criador|criadora|dono|dona|chefe)|de onde voce veio|voce (e|eh) de quem)\b/, [
    'Fui criada para o JPlate, o aplicativo da ConsultoriaJP. Minhas respostas vêm do banco de dados da JP Company.',
    'Sou a assistente do JPlate, da ConsultoriaJP. Tudo o que eu sei foi cadastrado pela equipe da JP Company.',
  ]],
  ['idade', /\b(quantos anos (voce|vc) tem|qual (a )?sua idade|voce (e|eh) (nova|velha)|quando (voce )?nasceu|sua idade)\b/, [
    'Sou bem nova, {nome}! Nasci junto com o JPlate. Mas o meu banco de dados cresce a cada atualização.',
    'Não tenho idade como as pessoas, {nome}. Comecei a trabalhar no JPlate em 2026 e aprendo a cada nova informação que a equipe cadastra.',
  ]],
  ['onde-mora', /\b(onde (voce|vc) (mora|vive|fica|esta)|de onde (voce|vc) (e|eh)|(voce|vc) mora onde)\b/, [
    'Moro dentro do seu celular, {nome}, aqui no JPlate. E funciono até sem internet.',
    'Fico aqui no aplicativo JPlate, sempre à disposição, mesmo sem internet.',
  ]],
  ['o-que-faz', /\b(o que (voce|vc) (faz|sabe|pode fazer|sabe fazer|responde)|como (voce|vc) funciona|como (te|que eu) us\w*|para que (voce|vc) serve|pra que (voce|vc) serve|me ajuda|pode me ajudar|preciso de ajuda|ajuda$|socorro)\b/, [
    'Posso responder dúvidas sobre alimentação, dieta, treino, suplementos, canetas emagrecedoras e trocas de alimentos pela tabela de equivalências. Experimente perguntar, por exemplo, "creatina para que serve?" ou "posso trocar arroz por batata?".',
    'Estou aqui para tirar dúvidas de nutrição e treino com base no material da ConsultoriaJP, {nome}. Pode escrever do seu jeito, como "carboidrato à noite engorda?" ou "o que comer antes do treino?".',
  ]],
  ['pessoal', /\b(voce|vc) (e|eh|é) (casada|solteira|namora|tem namorado|tem filhos?|bonita|linda)\b|\b(voce|vc) (namora|tem namorado|tem familia|tem filhos?)\b/, [
    'Sou uma assistente virtual, {nome}, então meu único compromisso é com a sua alimentação! Em que posso ajudar?',
    'Essa eu deixo para as pessoas, {nome}. Minha especialidade é nutrição e treino. Qual é a sua dúvida?',
  ]],
  ['dorme', /\b(voce|vc) (dorme|come|sente fome|treina|faz dieta|cansa|descansa)\b/, [
    'Eu não durmo nem como, {nome}, mas lembro sempre que sono e boa alimentação são parte importante do resultado.',
    'Não preciso de descanso, por isso estou disponível a qualquer hora. Já você, {nome}, não esqueça de dormir bem!',
  ]],
  ['comida-favorita', /\b((sua|qual) comida (favorita|preferida)|(voce|vc) gosta de (comer|comida)|o que (voce|vc) (gosta de )?come)\b/, [
    'Não como, {nome}, mas admiro um prato colorido, com proteína, carboidrato, verduras e legumes.',
    'Se eu comesse, escolheria uma refeição equilibrada e bem temperada! E você, qual é o seu prato preferido?',
  ]],
  ['te-amo', /\b(te amo|amo voce|amo vc|gosto de (voce|vc)|voce (e|eh) (minha )?amiga|minha amiga)\b/, [
    'Que carinho, {nome}! Também gosto muito de ajudar você. Conte comigo.',
    'Fico muito feliz com isso, {nome}! Estou sempre aqui para ajudar.',
  ]],
  ['elogio', /\b((voce|vc) (e|eh) (otima|incrivel|demais|inteligente|perfeita|muito boa|top|fera|maravilhosa|a melhor)|(muito )?(bom|boa|otim[oa]|perfeit[oa]|show|top|excelente|maravilh\w*) (resposta|explicacao|ajuda)|adorei|amei|gostei|parabens|bom trabalho|mandou bem|muito bom|excelente)\b/, [
    'Muito obrigada, {nome}! Fico feliz em ajudar.',
    'Que bom que gostou, {nome}! Se tiver mais alguma dúvida, estou aqui.',
    'Obrigada pelo elogio, {nome}! Vou continuar me esforçando.',
  ]],
  ['reclamacao', /\b(nao (era|e|foi) (isso|bem isso|o que (eu )?perguntei)|resposta errada|(voce|vc) (nao )?(entendeu|me entendeu)|nao entendeu|nao faz sentido|sem sentido|nada a ver|(voce|vc) (e|eh) (burra|ruim|pessima|inutil|horrivel)|errou|errada|que resposta)\b/, [
    'Desculpe, {nome}. Pode tentar perguntar de outro jeito, com outras palavras? Assim consigo encontrar a resposta certa no meu banco de dados.',
    'Peço desculpas, {nome}. Às vezes eu não encontro a resposta mais adequada. Tente escrever a pergunta com mais detalhes ou fale com a equipe da ConsultoriaJP.',
  ]],
  ['desculpa', /^(desculpa|desculpe|foi mal|perdao|sorry)\b/, [
    'Não precisa se desculpar, {nome}! Em que posso ajudar?',
    'Tudo bem, {nome}! Pode perguntar o que precisar.',
  ]],
  ['risada', /^(k{3,}|(ha){2,}h?|(he){2,}|(rs)+|kk+|hehe+|haha+|lol|rsrs+)[!. ]*$/, [
    'Que bom que você está de bom humor, {nome}! Em que posso ajudar?',
    'Fico feliz em arrancar um sorriso, {nome}!',
  ]],
  ['piada', /\b(piada|me (faz|faca) rir|conta (algo|alguma coisa) engracad\w*|(algo|coisa) engracad\w*|charada)\b/, [
    'Lá vai uma, {nome}: por que o ovo não vai à festa? Porque ele não quer ser frito! Agora, se quiser, posso responder alguma dúvida sobre alimentação.',
    'O que o tomate foi fazer no banco? Tirar extrato! Precisa de ajuda com alguma dúvida?',
    'O que o arroz disse para o feijão? "Juntos somos imbatíveis!" Falando nisso, quer tirar alguma dúvida sobre a sua dieta?',
  ]],
  ['desistir', /\b(quero (desistir|parar tudo|largar)|vou desistir|pensando em desistir|nao aguento mais|cansei (da dieta|de tudo|de tentar)|chutei o balde|joguei tudo pro alto|nao vou conseguir|e dificil demais)\b/, [
    'Entendo que esteja difícil, {nome}. Mudanças levam tempo, e um dia ruim não apaga o seu esforço. Que tal voltar ao plano na próxima refeição? A equipe da ConsultoriaJP pode ajustar o que estiver pesado.',
    'Não desista, {nome}. Resultado vem da constância, não da perfeição. Se a dieta está difícil de seguir, converse com a equipe da ConsultoriaJP para adaptarmos à sua rotina.',
    'Respire, {nome}. Todo mundo passa por fases assim. Escolha uma coisa simples para fazer hoje, como beber água e montar um prato equilibrado, e siga a partir daí.',
  ]],
  ['desanimo', /\b(desanimad[oa]|sem (motivacao|animo|vontade|forca de vontade|foco)|desmotivad[oa]|preguica|to com preguica|nao tenho (motivacao|forca de vontade|disciplina|foco)|me motiva|motivacao)\b/, [
    'Todo mundo tem dias sem motivação, {nome}. Nesses dias, a disciplina e os pequenos passos fazem a diferença: faça só a próxima refeição do plano e um treino curto, se der.',
    'Motivação vai e volta, {nome}. O que mantém o resultado é a rotina. Lembre por que você começou e comemore cada pequena conquista.',
    'Você já chegou até aqui, {nome}, e isso conta muito. Um passo de cada vez. Se quiser, me pergunte algo que esteja travando a sua dieta.',
  ]],
  ['conquista', /\b(perdi \d*\s*(kg|quilos?|kilos?|peso)|emagreci|bati (a|minha) meta|consegui|atingi|cheguei no (meu )?(peso|objetivo)|ganhei massa|to (mais|bem) (magr[oa]|fort[oa])|deu certo)\b/, [
    'Parabéns, {nome}! Que conquista! Continue com a constância que trouxe você até aqui.',
    'Que notícia ótima, {nome}! Seu esforço está dando resultado. Compartilhe também com a equipe da ConsultoriaJP.',
    'Muito bem, {nome}! Cada resultado é fruto da sua dedicação. Siga firme!',
  ]],
  ['cansado', /\b(to|estou|tou) (muito )?(cansad[oa]|exaust[oa]|esgotad[oa]|morto|morta|sem energia)\b/, [
    'Entendo, {nome}. Cansaço pode ter várias causas, como sono ruim, pouca comida ou treino puxado. Descanse, beba água e, se persistir, converse com a equipe da ConsultoriaJP.',
    'Que tal priorizar o descanso hoje, {nome}? Dormir bem e comer nos horários do plano ajudam muito na energia. Se o cansaço continuar, procure a equipe.',
  ]],
  ['pressa', /\b(to|estou) com pressa|rapidinho|resumindo|resume|seja (breve|rapida)\b/, [
    'Claro, {nome}! Escreva a sua dúvida em poucas palavras que eu respondo direto.',
  ]],
  ['teste', /^(teste|testando|test|1 2 3|123)[!. ]*$/, [
    'Estou funcionando, {nome}! Pode fazer a sua pergunta.',
    'Tudo certo por aqui, {nome}. Pode perguntar!',
  ]],
  ['conversa', /\b(vamos conversar|quero conversar|bora conversar|conversa comigo|fala comigo|(voce|vc) conversa)\b/, [
    'Claro, {nome}! Posso conversar sobre alimentação, treino e dieta. Sobre o que quer falar?',
    'Vamos sim, {nome}! Me conte: qual é o seu objetivo hoje, emagrecer, ganhar massa ou manter o peso?',
  ]],
  ['objetivo', /^(quero |meu objetivo (e|eh) )?(emagrecer|perder peso|ganhar massa|hipertrofia|definir|manter o peso|secar)[!. ]*$/, null],
  ['sim', /^(sim|s|claro|com certeza|quero|pode ser|isso|exato|aham|uhum|positivo|yes|ok|okay|blz|beleza|certo|ta bom|ta bem|ta|fechado|combinado|show|perfeito)[!. ]*$/, [
    'Combinado, {nome}! Qual é a próxima dúvida?',
    'Certo, {nome}! Estou à disposição.',
    'Perfeito! Se quiser saber mais, é só perguntar.',
  ], 'sim'],
  ['nao', /^(nao|n|nao obrigad[oa]|agora nao|nada|deixa|deixa pra la|nao precisa|negativo|no)[!. ]*$/, [
    'Tudo bem, {nome}! Se precisar, estou aqui.',
    'Sem problemas, {nome}. Quando quiser, é só chamar.',
  ]],
  ['entendi', /^(entendi|entendido|compreendi|faz sentido|saquei|ah ta|ah sim|agora entendi|hum|hmm|interessante|legal|que legal|nossa|caramba|serio|verdade)[!.? ]*$/, [
    'Que bom, {nome}! Quer saber mais alguma coisa?',
    'Ótimo! Se tiver outra dúvida, pode perguntar.',
    'Fico feliz em ajudar, {nome}. Tem mais alguma pergunta?',
  ], 'sim'],
];

// Pedidos de continuação ("fala mais", "explica melhor"): usam o último assunto da conversa.
export const CONTINUAR = /^(e (ai|depois|entao|agora)|fala mais|me (explica|explique|conta) (melhor|mais)|explica (melhor|mais|de novo)|pode explicar (melhor|mais)|como assim|nao entendi|quero saber mais|mais detalhes|detalha|continua|continue|e isso|sobre isso)[?!. ]*$/;

export const CONTINUAR_FALAS = [
  'Sobre "{assunto}", também posso falar destes pontos:',
  'Para entender melhor "{assunto}", veja também:',
];
export const CONTINUAR_SEM = [
  'Ainda não falamos de nenhum assunto, {nome}. Qual é a sua dúvida?',
];

export const OBJETIVO_FALAS = [
  'Ótimo objetivo, {nome}! Aqui estão alguns assuntos que ajudam nesse caminho:',
];

export const NAO_ENCONTREI = 'Não tenho uma resposta cadastrada para essa pergunta no momento.';
export const QUIS_DIZER = 'Não tenho certeza se entendi, {nome}. Você quis dizer:';

// Quantidade de falas cadastradas (para mostrar ao Joao).
export const TOTAL_FALAS = CONVERSA.reduce((t, c) => t + (c[2]?.length ?? 0), 0)
  + CONTINUAR_FALAS.length + CONTINUAR_SEM.length + OBJETIVO_FALAS.length;
