// Tabela de equivalências da JP Team (PDF "Tabela de Equivalências", CRN-4 24103832).
// Texto e valores como no documento; * = não consta na TACO (USDA ou rótulo).

export const EQ_SOURCE = 'JP Team · Nutrição: CRN-4 24103832';

export const EQ_HOW = {
  text: 'Troque apenas alimentos do mesmo grupo, usando a quantidade indicada na tabela. Os pesos são de alimentos prontos (cozidos), exceto quando indicado.',
  example: ['100 g de arroz', '200 g de batata'],
};

export const EQ_GROUPS = [
  { id: 'proteinas', title: 'Proteínas', portion: '1 porção ≈ 25 g de proteína', rows: [
    ['100 g', 'Peito de frango grelhado ou cozido', '1 filé médio', '160'],
    ['100 g', 'Sobrecoxa de frango sem pele, assada', '1 unidade grande', '235'],
    ['100 g', 'Carne vermelha magra patinho, lagarto ou músculo', '1 bife médio', '210'],
    ['100 g', 'Lombo suíno assado ou grelhado', '1 fatia grande', '210'],
    ['130 g', 'Filé de peixe magro tilápia ou merluza', '1 filé grande', '160'],
    ['130 g', 'Camarão cozido', '1 xícara', '115'],
    ['120 g', 'Atum em água escorrido', '1 lata', '140*'],
    ['220 g', 'Ovos 2 inteiros + 4 claras', '2 ovos e 4 claras', '215'],
    ['35 g', 'Whey protein concentrado', 'conforme o scoop', '140*'],
    ['35 g', 'Albumina', 'conforme o scoop', '130*'],
  ] },
  { id: 'carboidratos', title: 'Carboidratos', portion: '1 porção ≈ 25 g de carboidrato', rows: [
    ['100 g', 'Arroz branco ou integral cozido', '4 col. de sopa cheias', '125'],
    ['100 g', 'Macarrão comum ou integral cozido', '1 pegador', '155*'],
    ['100 g', 'Cuscuz de milho pronto', '1 pedaço médio', '115'],
    ['120 g', 'Quinoa cozida', '5 col. de sopa', '145*'],
    ['100 g', 'Mandioca cozida', '1 pedaço médio', '125'],
    ['120 g', 'Inhame ou cará cozido', '1 unidade pequena', '95'],
    ['200 g', 'Batata-inglesa cozida', '1 unidade grande', '105'],
    ['130 g', 'Batata-doce cozida', '1 unidade pequena', '100'],
    ['200 g', 'Abóbora cabotiá cozida', '1 xícara e meia', '95'],
    ['200 g', 'Feijão, lentilha ou ervilha cozidos', '2 conchas médias', '160'],
    ['100 g', 'Grão-de-bico cozido', '5 col. de sopa', '165*'],
    ['50 g', 'Tapioca goma hidratada', '3 col. de sopa cheias', '120*'],
    ['40 g', 'Aveia em flocos', '4 col. de sopa', '160'],
    ['50 g', 'Pão de forma tradicional ou integral', '2 fatias', '130'],
    ['50 g', 'Pão francês', '1 unidade', '150'],
    ['1 unid.', 'Fap10 integral', '1 unidade', 'rótulo'],
    ['36 g', 'Biscoito de arroz', '4 unidades', '140*'],
  ], note: 'Batatas, abóbora e feijões têm mais água, por isso a porção em gramas é maior.' },
  { id: 'laticinios', title: 'Laticínios', portion: '1 porção', rows: [
    ['200 ml', 'Leite desnatado', '1 copo', '70*'],
    ['170 g', 'Iogurte natural desnatado', '1 pote', '70'],
    ['20 g', 'Leite em pó desnatado', '2 col. de sopa', '70'],
  ] },
  { id: 'frutas', title: 'Frutas', portion: '1 porção ≈ 10 g de carboidrato', rows: [
    ['100 g', 'Mamão ou abacaxi', '1 fatia média', '45'],
    ['75 g', 'Maçã ou pera', 'meia unidade média', '40'],
    ['100 g', 'Laranja', '1 unidade pequena', '35'],
    ['75 g', 'Uva', '10 unidades', '40'],
    ['150 g', 'Morango ou melão', '10 morangos ou 1 fatia', '45'],
    ['50 g', 'Banana prata ou nanica', 'meia unidade', '50'],
    ['80 g', 'Manga Tommy', 'meia xícara picada', '40'],
    ['80 g', 'Kiwi', '1 unidade', '40'],
    ['100 g', 'Frutas vermelhas frescas ou congeladas', '1 xícara', '50*'],
  ] },
  { id: 'gorduras', title: 'Gorduras', portion: '1 porção ≈ 10 g de gordura', rows: [
    ['10 g', 'Azeite de oliva', '1 col. de sopa', '90'],
    ['100 g', 'Abacate', '3 col. de sopa cheias', '95'],
    ['15 g', 'Castanha-do-pará', '3 unidades', '95'],
    ['15 g', 'Amêndoas ou nozes', '10 amêndoas ou 4 nozes', '90'],
    ['18 g', 'Amendoim torrado sem sal', '1 punhado pequeno', '105'],
    ['20 g', 'Pasta de amendoim integral', '1 col. de sopa cheia', '120*'],
    ['30 g', 'Chia ou linhaça', '3 col. de sopa', '150'],
    ['34 g', 'Gemas de ovo', '2 unidades', '120'],
  ] },
];

export const EQ_TIP = 'Use uma balança de cozinha nas primeiras semanas. Depois de pesar algumas vezes, fica fácil estimar as porções pelas medidas caseiras.';

export const EQ_SECTIONS = [
  { title: 'Vegetais', lines: ['As quantidades da dieta são o mínimo. Você pode acrescentar à vontade:', 'Folhas verdes, brócolis, couve-flor, abobrinha, chuchu, vagem, pepino, tomate, pimentão, espinafre, cenoura e beterraba.'] },
  { title: 'Itens livres', lines: ['Café e chá sem açúcar, adoçante, água com gás, temperos naturais (alho, cebola, ervas, limão, vinagre) e refrigerante zero com moderação.'] },
  { title: 'Refeição livre', lines: ['1x por semana, substitua 2 refeições do dia de carboidrato alto por uma refeição livre.', 'Ela existe para dar flexibilidade social e psicológica, não é uma liberação total.', 'Coma com atenção e pare quando estiver satisfeito: exageros frequentes atrasam seus resultados.'] },
  { title: 'Comendo fora', lines: ['Restaurante por quilo: monte o prato como na dieta (proteína, carboidrato e vegetais).', 'Churrasco: prefira cortes magros e frango, e tire a gordura aparente.', 'Lanchonete: escolha grelhados e evite frituras e molhos.'] },
  { title: 'Atenção', warn: true, lines: ['Óleo, molhos e açúcar também contam: use o mínimo no preparo.', 'Não troque alimentos de grupos diferentes.', 'Não pule refeições para "guardar" para depois.', 'Frutas não são livres: siga a quantidade da dieta.'] },
];

export const EQ_FOOTNOTE = 'Calorias da porção calculadas pela Tabela TACO (NEPA/Unicamp, 4ª edição). Itens com * não constam na TACO: valores da USDA FoodData Central ou de rótulos comuns, que variam conforme a marca. Em caso de dúvida, as quantidades da sua dieta prevalecem. Fale com a equipe pelo suporte do app.';
