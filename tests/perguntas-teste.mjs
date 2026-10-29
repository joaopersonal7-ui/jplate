// Perguntas de teste da SÁ (curtas, informais e com erros de digitação) e os títulos aceitos como resposta certa.
// Uso: node tests/perguntas-teste.mjs  → mostra a taxa de acerto.
export const CASOS = [
  ['tirzepatida', ['O que é tirzepatida (Mounjaro)?']],
  ['mounjaro', ['O que é tirzepatida (Mounjaro)?']],
  ['ozempic', ['O que é semaglutida (Ozempic, Wegovy, Rybelsus)?']],
  ['ozempik', ['O que é semaglutida (Ozempic, Wegovy, Rybelsus)?']],
  ['saxenda', ['O que é liraglutida (Saxenda, Victoza e similares)?']],
  ['trulicity emagrece?', ['O que é dulaglutida (Trulicity)?']],
  ['to com enjoo por causa do mounjaro', ['Estou com náusea por causa da caneta. O que fazer?']],
  ['a caneta queima gordura', ['A caneta queima gordura?']],
  ['parei o ozempic e engordei', ['O que acontece quando paro a caneta ou o remédio para emagrecer?']],
  ['intestino preso com a caneta', ['A caneta pode deixar o intestino preso?']],
  ['creatina', ['Creatina: para que serve?', 'O que é creatina?']],
  ['creatina incha?', ['Creatina causa retenção de líquido?']],
  ['creatina retem liquido', ['Creatina retém líquido?', 'Creatina causa retenção de líquido?']],
  ['whey', ['Whey protein é obrigatório?', 'Whey engorda?']],
  ['whey engorda', ['Whey engorda?']],
  ['cafeina', ['Cafeína melhora o treino?']],
  ['queimador de gordura funciona?', ['Queimadores de gordura funcionam?']],
  ['carbo a noite engorda', ['Carboidratos à noite engordam?']],
  ['comer carboidrato de noite engorda?', ['Carboidratos à noite engordam?']],
  ['fruta engorda', ['Frutas engordam?']],
  ['ovo faz mal pro colesterol', ['Ovo aumenta o colesterol?']],
  ['detox funciona', ['Detox elimina toxinas e acelera o emagrecimento?']],
  ['sal rosa', ['Sal rosa é mais saudável que o sal comum?']],
  ['jejum intermitente', ['Jejum intermitente é melhor que uma dieta tradicional?']],
  ['pizza', ['Posso comer pizza e ainda emagrecer?']],
  ['pao ou tapioca', ['Pão é pior que tapioca?']],
  ['arroz e feijao engorda', ['Arroz e feijão engordam?']],
  ['refri zero', ['Posso beber refrigerante zero ou usar adoçante?', 'Posso substituir água por refrigerante zero?']],
  ['meu peso parou', ['Platô: quando o peso para de cair', 'Meu peso parou de baixar. Preciso reduzir mais as calorias?']],
  ['nao consigo emagrecer mais', ['Platô: quando o peso para de cair', 'Meu peso parou de baixar. Preciso reduzir mais as calorias?']],
  ['quanto de proteina pra ganhar massa', ['Quanto de proteína ajuda na hipertrofia']],
  ['como ganhar musculo', ['O que é necessário para ganhar massa muscular']],
  ['perder barriga fazendo abdominal', ['Gordura localizada e exercícios específicos']],
  ['o que comer antes do treino', ['O que comer antes de treinar']],
  ['pos treino', ['O que comer depois de treinar', 'É obrigatório tomar proteína logo após o treino?']],
  ['treinar em jejum', ['Treinar em jejum queima mais gordura?', 'Exercício em jejum', 'Preciso fazer cardio em jejum para perder gordura?']],
  ['cardio atrapalha hipertrofia', ['Cardio atrapalha a hipertrofia?']],
  ['suar emagrece', ['Se suei muito, queimei mais gordura?', 'Suor, temperatura e perda de peso imediata']],
  ['caimbra', ['Cãibras significam falta de potássio?', 'Cãibras, dor muscular e recuperação']],
  ['vontade de doce', ['O que fazer quando sinto vontade de doce todos os dias?']],
  ['to com muita fome', ['Estou sentindo muita fome durante a dieta. O que devo fazer?', 'Como lidar com fome entre refeições?', 'Estou com muita fome. O que fazer?']],
  ['festa no fim de semana', ['Como manter a dieta no fim de semana?', 'Como lidar com festas e eventos sociais?']],
  ['bioimpedancia', ['A balança de bioimpedância mede gordura com precisão?']],
  ['peso varia todo dia', ['Por que meu peso varia mesmo quando sigo a dieta?', 'Por que o peso varia de um dia para outro']],
  ['o que e neat', ['O que é NEAT?']],
  ['atp', ['O que é ATP?']],
  ['hiit ou cardio normal', ['HIIT versus cardio contínuo']],
  ['glicogenio', ['O que é Glicogênio?']],
  ['dormi mal e to com fome', ['Por que sinto mais fome depois de dormir pouco?']],
  ['posso comer fora de casa', ['Preciso evitar comer fora para ter resultado?']],
  ['rotulo dos alimentos', ['Como interpretar o rótulo de um alimento?']],
  ['dieta barata', ['Comer saudável precisa ser caro?', 'Como adaptar a dieta ao orçamento do mês?']],
  ['bcaa', ['BCAA e glutamina são necessários para ganhar músculo?']],
  ['vitamina d', ['Para que serve vitamina D?', 'Como saber se preciso de vitamina D, ferro ou B12?']],
  ['gluten engorda', ['Preciso cortar glúten para emagrecer?']],
];

const titleOf = (a) => a?.parts?.[0]?.title ?? a?.title;

export function avaliar(answer) {
  const erros = [];
  for (const [q, ok] of CASOS) {
    const a = answer(q);
    if (!ok.includes(titleOf(a))) erros.push(`${q} → ${titleOf(a) ?? (a?.options ? 'Você quis dizer: ' + a.options.join(' | ') : '(sem resposta)')}`);
  }
  return { acertos: CASOS.length - erros.length, total: CASOS.length, erros };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const dir = process.argv[2] ?? '../src';
  const { answer } = await import(`${dir}/assistant.js`);
  const r = avaliar(answer);
  console.log(`${r.acertos}/${r.total}`);
  console.log(r.erros.join('\n'));
}
