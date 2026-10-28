// Pratos do dia a dia calculados a partir dos ingredientes.
// Ingrediente: número = id da TACO; texto = nome exato em data/usda.json; 'agua' = água (sem nutrientes).
// y = rendimento: peso final / peso cru somado (perda ou ganho de água no preparo). Padrão 1.
// p = porção típica [nome, gramas]. Valores são estimativas de receita caseira, não análise de laboratório.

const LEITE = 'Leite integral';
const LEITE_D = 'Leite desnatado';
const MACARRAO = 'Macarrão cozido, sem sal';
const WHEY = 'Whey protein em pó (concentrado)';
const PASTA_AMENDOIM = 'Pasta de amendoim lisa';
const CLARA = 'Clara de ovo, crua';
const PAO_HAMB = 'Pão de hambúrguer ou cachorro-quente';
const BACON = 'Bacon assado no forno';
const TORTILHA = 'Tortilha de trigo';
const SUSHI = 'Arroz para sushi cozido';
const NORI = 'Alga nori, crua';
const GRANOLA = 'Granola';
const CHAMPIGNON = 'Champignon, cru';
const VINAGRE = 'Vinagre de álcool';

export const RECEITAS = [
  // ---------- pratos feitos e marmitas ----------
  { n: 'Arroz com feijão', g: 'Pratos feitos', i: [[3, 100], [561, 80]], p: ['prato', 250] },
  { n: 'Prato feito: arroz, feijão, bife e salada', g: 'Pratos feitos', i: [[3, 150], [561, 100], [346, 100], [161, 60]], p: ['prato', 410] },
  { n: 'Prato feito: arroz, feijão, frango grelhado e salada', g: 'Pratos feitos', i: [[3, 150], [561, 100], [410, 120], [161, 60]], p: ['prato', 430] },
  { n: 'Prato feito: arroz, feijão, ovo frito e salada', g: 'Pratos feitos', i: [[3, 150], [561, 100], [490, 50], [161, 60]], p: ['prato', 360] },
  { n: 'Prato feito com bife acebolado e batata frita', g: 'Pratos feitos', i: [[3, 150], [561, 100], [346, 100], [107, 30], [93, 80]], p: ['prato', 460] },
  { n: 'Marmita fit: frango, arroz integral e brócolis', g: 'Marmitas fit', i: [[1, 120], [410, 120], [100, 80]], p: ['marmita', 320] },
  { n: 'Marmita fit: frango, batata-doce e legumes', g: 'Marmitas fit', i: [[88, 150], [410, 120], [109, 50], [100, 50]], p: ['marmita', 370] },
  { n: 'Marmita fit: carne moída, arroz e feijão', g: 'Marmitas fit', i: [[3, 120], [561, 80], [326, 100], [109, 40]], p: ['marmita', 340] },
  { n: 'Marmita fit: patinho, purê de abóbora e vagem', g: 'Marmitas fit', i: [[377, 120], [64, 150], [162, 60], [261, 5]], p: ['marmita', 335] },
  { n: 'Marmita fit: peixe, arroz integral e legumes', g: 'Marmitas fit', i: [[301, 130], [1, 120], [546, 100]], p: ['marmita', 350] },
  { n: 'Marmita fit: frango desfiado, mandioca e couve', g: 'Marmitas fit', i: [[408, 120], [129, 120], [116, 50]], p: ['marmita', 290] },

  // ---------- ovos ----------
  { n: 'Ovo mexido na manteiga', g: 'Ovos', y: 0.9, i: [[489, 100], [261, 5]], p: ['porção (2 ovos)', 95] },
  { n: 'Ovo mexido sem óleo', g: 'Ovos', y: 0.9, i: [[489, 100]], p: ['porção (2 ovos)', 90] },
  { n: 'Ovos mexidos com queijo', g: 'Ovos', y: 0.9, i: [[489, 100], [463, 20], [261, 3]], p: ['porção (2 ovos)', 110] },
  { n: 'Ovo frito sem óleo (frigideira antiaderente)', g: 'Ovos', y: 0.95, i: [[489, 50]], p: ['unidade', 48] },
  { n: 'Omelete simples (2 ovos)', g: 'Ovos', y: 0.9, i: [[489, 100], [272, 3], [517, 0.5]], p: ['unidade', 93] },
  { n: 'Omelete de claras', g: 'Ovos', y: 0.9, i: [[CLARA, 100], [272, 2], [517, 0.5]], p: ['unidade', 92] },
  { n: 'Omelete de legumes', g: 'Ovos', y: 0.9, i: [[489, 100], [157, 20], [107, 10], [145, 10], [272, 3]], p: ['unidade', 129] },
  { n: 'Omelete de frango', g: 'Ovos', y: 0.9, i: [[489, 100], [408, 40], [272, 3]], p: ['unidade', 129] },
  { n: 'Omelete de presunto e queijo', g: 'Ovos', y: 0.9, i: [[489, 100], [439, 20], [463, 20], [272, 3]], p: ['unidade', 129] },
  { n: 'Ovo de codorna cozido', g: 'Ovos', i: [[485, 100]], p: ['unidade', 10] },
  { n: 'Farofa de ovo', g: 'Ovos', i: [[122, 50], [490, 40], [261, 10], [107, 10]], p: ['colher de sopa', 15] },

  // ---------- tapioca, cuscuz e café da manhã ----------
  { n: 'Tapioca simples (goma)', g: 'Café da manhã', y: 0.9, i: [[124, 50], ['agua', 20]], p: ['unidade', 63] },
  { n: 'Tapioca com queijo minas', g: 'Café da manhã', y: 0.92, i: [[124, 50], ['agua', 20], [461, 30]], p: ['unidade', 92] },
  { n: 'Tapioca com ovo', g: 'Café da manhã', y: 0.92, i: [[124, 50], ['agua', 20], [490, 50]], p: ['unidade', 110] },
  { n: 'Tapioca com frango e queijo', g: 'Café da manhã', y: 0.92, i: [[124, 50], ['agua', 20], [408, 40], [463, 20]], p: ['unidade', 120] },
  { n: 'Tapioca com coco e leite condensado', g: 'Café da manhã', y: 0.92, i: [[124, 50], ['agua', 20], [590, 15], [453, 20]], p: ['unidade', 97] },
  { n: 'Tapioca com banana e canela', g: 'Café da manhã', y: 0.92, i: [[124, 50], ['agua', 20], [182, 60]], p: ['unidade', 120] },
  { n: 'Crepioca (ovo e goma de tapioca)', g: 'Café da manhã', y: 0.9, i: [[489, 50], [124, 20], ['agua', 10]], p: ['unidade', 72] },
  { n: 'Crepioca com queijo', g: 'Café da manhã', y: 0.9, i: [[489, 50], [124, 20], ['agua', 10], [463, 20]], p: ['unidade', 90] },
  { n: 'Crepioca com frango', g: 'Café da manhã', y: 0.9, i: [[489, 50], [124, 20], ['agua', 10], [408, 40]], p: ['unidade', 108] },
  { n: 'Pão de queijo de frigideira', g: 'Café da manhã', y: 0.9, i: [[489, 50], [124, 15], [463, 20]], p: ['unidade', 76] },
  { n: 'Cuscuz nordestino com ovo', g: 'Café da manhã', i: [[533, 150], [490, 50]], p: ['prato', 200] },
  { n: 'Cuscuz nordestino com manteiga', g: 'Café da manhã', i: [[533, 150], [261, 10]], p: ['prato', 160] },
  { n: 'Cuscuz com carne seca', g: 'Café da manhã', i: [[533, 150], [384, 60], [261, 5]], p: ['prato', 215] },
  { n: 'Cuscuz com frango desfiado', g: 'Café da manhã', i: [[533, 150], [408, 60], [272, 3]], p: ['prato', 213] },
  { n: 'Pão francês com manteiga', g: 'Café da manhã', i: [[53, 50], [261, 5]], p: ['unidade', 55] },
  { n: 'Pão na chapa', g: 'Café da manhã', i: [[53, 50], [261, 8]], p: ['unidade', 58] },
  { n: 'Pão francês com ovo', g: 'Café da manhã', i: [[53, 50], [490, 50]], p: ['unidade', 100] },
  { n: 'Pão francês com queijo minas', g: 'Café da manhã', i: [[53, 50], [461, 30]], p: ['unidade', 80] },
  { n: 'Misto quente', g: 'Café da manhã', i: [[53, 50], [439, 15], [467, 15], [261, 3]], p: ['unidade', 83] },
  { n: 'Pão integral com pasta de amendoim', g: 'Café da manhã', i: [[52, 50], [PASTA_AMENDOIM, 20]], p: ['2 fatias', 70] },
  { n: 'Pão integral com ovo mexido', g: 'Café da manhã', i: [[52, 50], [489, 50], [261, 3]], p: ['2 fatias', 103] },
  { n: 'Mingau de aveia com leite', g: 'Café da manhã', y: 0.9, i: [[7, 30], [LEITE, 200]], p: ['tigela', 207] },
  { n: 'Mingau de aveia com banana', g: 'Café da manhã', y: 0.9, i: [[7, 30], [LEITE, 200], [182, 60]], p: ['tigela', 260] },
  { n: 'Panqueca de banana com aveia', g: 'Café da manhã', y: 0.9, i: [[489, 50], [182, 80], [7, 20]], p: ['unidade', 135] },
  { n: 'Panqueca proteica (whey, banana e aveia)', g: 'Café da manhã', y: 0.9, i: [[489, 50], [WHEY, 30], [182, 60], [7, 20]], p: ['unidade', 144] },
  { n: 'Iogurte natural com frutas e mel', g: 'Café da manhã', i: [[448, 170], [182, 50], [239, 50], [507, 10]], p: ['tigela', 280] },
  { n: 'Iogurte natural com granola e mel', g: 'Café da manhã', i: [[448, 170], [GRANOLA, 30], [507, 10]], p: ['tigela', 210] },
  { n: 'Salada de frutas', g: 'Café da manhã', i: [[182, 50], [222, 50], [214, 50], [228, 50], [239, 50], [225, 50]], p: ['tigela', 200] },
  { n: 'Açaí na tigela com banana e granola', g: 'Café da manhã', i: [[167, 200], [182, 50], [GRANOLA, 30]], p: ['tigela', 280] },

  // ---------- bebidas ----------
  { n: 'Café com leite e açúcar', g: 'Bebidas preparadas', i: [[471, 100], [LEITE, 100], [492, 8]], p: ['xícara', 200] },
  { n: 'Café com leite sem açúcar', g: 'Bebidas preparadas', i: [[471, 100], [LEITE, 100]], p: ['xícara', 200] },
  { n: 'Café preto com açúcar', g: 'Bebidas preparadas', i: [[471, 100], [492, 8]], p: ['xícara', 100] },
  { n: 'Leite com achocolatado', g: 'Bebidas preparadas', i: [[LEITE, 200], [491, 20]], p: ['copo', 220] },
  { n: 'Vitamina de banana com aveia', g: 'Bebidas preparadas', i: [[LEITE, 200], [182, 100], [7, 15]], p: ['copo', 315] },
  { n: 'Vitamina de abacate', g: 'Bebidas preparadas', i: [[LEITE, 200], [163, 100], [492, 10]], p: ['copo', 310] },
  { n: 'Vitamina de mamão', g: 'Bebidas preparadas', i: [[LEITE, 200], [226, 120], [492, 10]], p: ['copo', 330] },
  { n: 'Vitamina de morango', g: 'Bebidas preparadas', i: [[LEITE, 200], [239, 100], [492, 10]], p: ['copo', 310] },
  { n: 'Shake de whey com leite desnatado', g: 'Bebidas preparadas', i: [[LEITE_D, 250], [WHEY, 30]], p: ['copo', 280] },
  { n: 'Shake de whey com água', g: 'Bebidas preparadas', i: [['agua', 250], [WHEY, 30]], p: ['copo', 280] },
  { n: 'Shake hipercalórico caseiro', g: 'Bebidas preparadas', i: [[LEITE, 300], [182, 100], [7, 40], [PASTA_AMENDOIM, 20], [WHEY, 30]], p: ['copo', 490] },
  { n: 'Limonada com açúcar', g: 'Bebidas preparadas', i: [[219, 30], ['agua', 220], [492, 15]], p: ['copo', 265] },
  { n: 'Suco de laranja com cenoura', g: 'Bebidas preparadas', i: [[215, 200], [110, 50]], p: ['copo', 250] },
  { n: 'Suco verde (couve, abacaxi e limão)', g: 'Bebidas preparadas', i: [[115, 30], [164, 100], [219, 10], ['agua', 150]], p: ['copo', 290] },

  // ---------- lanches ----------
  { n: 'X-burger', g: 'Lanches', i: [[PAO_HAMB, 60], [417, 90], [467, 20], [524, 10]], p: ['unidade', 180] },
  { n: 'X-salada', g: 'Lanches', i: [[PAO_HAMB, 60], [417, 90], [467, 20], [524, 10], [77, 10], [157, 20]], p: ['unidade', 210] },
  { n: 'X-bacon', g: 'Lanches', i: [[PAO_HAMB, 60], [417, 90], [467, 20], [524, 10], [BACON, 20]], p: ['unidade', 200] },
  { n: 'X-tudo', g: 'Lanches', i: [[PAO_HAMB, 60], [417, 90], [467, 20], [524, 10], [BACON, 20], [490, 50], [439, 20], [77, 10], [157, 20]], p: ['unidade', 300] },
  { n: 'Sanduíche natural de frango', g: 'Lanches', i: [[52, 50], [408, 40], [110, 15], [524, 10], [77, 10]], p: ['unidade', 125] },
  { n: 'Sanduíche de atum', g: 'Lanches', i: [[52, 50], [277, 40], [524, 10], [77, 10]], p: ['unidade', 110] },
  { n: 'Wrap de frango', g: 'Lanches', i: [[TORTILHA, 40], [410, 60], [77, 15], [157, 20], [463, 15]], p: ['unidade', 150] },
  { n: 'Esfiha de carne', g: 'Lanches', y: 0.85, i: [[35, 40], [326, 30], [107, 5], [157, 10], [272, 4], ['agua', 20]], p: ['unidade', 92] },
  { n: 'Pizza de muçarela caseira', g: 'Lanches', y: 0.85, i: [[35, 100], ['agua', 55], [272, 5], [159, 40], [463, 60]], p: ['fatia', 80] },
  { n: 'Pizza de calabresa caseira', g: 'Lanches', y: 0.85, i: [[35, 100], ['agua', 55], [272, 5], [159, 40], [463, 40], [422, 40], [107, 15]], p: ['fatia', 85] },
  { n: 'Hambúrguer caseiro de patinho', g: 'Lanches', y: 0.75, i: [[376, 120], [107, 10], [517, 1]], p: ['unidade', 98] },
  { n: 'Temaki de salmão', g: 'Lanches', i: [[SUSHI, 80], [316, 50], [NORI, 3]], p: ['unidade', 133] },
  { n: 'Sushi de salmão (niguiri)', g: 'Lanches', i: [[SUSHI, 20], [316, 10]], p: ['unidade', 30] },

  // ---------- carnes, frangos e peixes ----------
  { n: 'Bife acebolado', g: 'Carnes preparadas', i: [[346, 120], [107, 50], [272, 5]], p: ['porção', 175] },
  { n: 'Carne de panela com batata', g: 'Carnes preparadas', i: [[371, 120], [91, 100], [110, 40], [159, 30]], p: ['porção', 290] },
  { n: 'Picadinho de carne com legumes', g: 'Carnes preparadas', i: [[328, 120], [110, 30], [91, 50], [159, 30]], p: ['porção', 230] },
  { n: 'Carne moída refogada', g: 'Carnes preparadas', i: [[326, 100], [107, 10], [157, 20], [272, 3]], p: ['colher de servir', 50] },
  { n: 'Almôndegas ao molho de tomate', g: 'Carnes preparadas', i: [[331, 100], [159, 60]], p: ['porção', 160] },
  { n: 'Bife à parmegiana', g: 'Carnes preparadas', i: [[340, 150], [159, 50], [463, 30]], p: ['unidade', 230] },
  { n: 'Linguiça acebolada', g: 'Carnes preparadas', i: [[423, 100], [107, 40]], p: ['porção', 140] },
  { n: 'Frango desfiado temperado', g: 'Frangos preparados', i: [[408, 100], [107, 10], [157, 20], [272, 3], [517, 0.8]], p: ['colher de sopa', 25] },
  { n: 'Frango grelhado com legumes', g: 'Frangos preparados', i: [[410, 150], [109, 60], [100, 60], [112, 60]], p: ['prato', 330] },
  { n: 'Frango assado com batata', g: 'Frangos preparados', i: [[403, 150], [91, 150], [272, 5]], p: ['prato', 305] },
  { n: 'Frango xadrez', g: 'Frangos preparados', i: [[410, 100], [144, 30], [107, 30], [558, 10], [518, 10], [272, 5]], p: ['porção', 185] },
  { n: 'Frango ao molho de tomate', g: 'Frangos preparados', i: [[398, 100], [159, 50], [107, 10]], p: ['porção', 160] },
  { n: 'Fricassê de frango', g: 'Frangos preparados', i: [[408, 100], [447, 40], [45, 30], [463, 30]], p: ['porção', 200] },
  { n: 'Frango à parmegiana', g: 'Frangos preparados', i: [[401, 150], [159, 50], [463, 30]], p: ['unidade', 230] },
  { n: 'Estrogonofe de frango light (com iogurte)', g: 'Frangos preparados', y: 0.95, i: [[408, 150], [448, 60], [159, 30], [CHAMPIGNON, 30]], p: ['porção', 160] },
  { n: 'Galinhada', g: 'Frangos preparados', i: [[3, 150], [398, 100], [107, 15], [272, 5], [517, 1]], p: ['prato', 270] },
  { n: 'Moqueca de peixe', g: 'Peixes preparados', y: 0.9, i: [[302, 150], [157, 50], [107, 30], [145, 20], [523, 50], [259, 10]], p: ['porção', 280] },
  { n: 'Bobó de camarão', g: 'Peixes preparados', y: 0.9, i: [[285, 100], [129, 100], [523, 50], [259, 8], [107, 20], [157, 30]], p: ['porção', 270] },
  { n: 'Peixe assado com legumes', g: 'Peixes preparados', i: [[301, 150], [109, 60], [100, 60], [260, 5]], p: ['prato', 275] },

  // ---------- massas, arroz e tortas ----------
  { n: 'Macarrão ao molho de tomate', g: 'Massas e arroz', i: [[MACARRAO, 200], [159, 80], [464, 5]], p: ['prato', 285] },
  { n: 'Macarrão alho e óleo', g: 'Massas e arroz', i: [[MACARRAO, 200], [260, 10], [82, 5]], p: ['prato', 215] },
  { n: 'Macarrão com frango e molho branco', g: 'Massas e arroz', i: [[MACARRAO, 200], [408, 60], [LEITE, 60], [447, 20], [35, 5]], p: ['prato', 345] },
  { n: 'Lasanha à bolonhesa caseira', g: 'Massas e arroz', i: [[37, 80], [326, 80], [159, 60], [463, 40], [439, 20]], p: ['pedaço', 280] },
  { n: 'Nhoque ao sugo', g: 'Massas e arroz', i: [[136, 200], [159, 80]], p: ['prato', 280] },
  { n: 'Panqueca de carne', g: 'Massas e arroz', y: 0.85, i: [[35, 30], [489, 25], [LEITE, 60], [326, 60], [159, 40]], p: ['unidade', 130] },
  { n: 'Arroz de forno', g: 'Massas e arroz', i: [[3, 150], [463, 30], [439, 20], [45, 20], [560, 20], [447, 20]], p: ['porção', 260] },
  { n: 'Arroz à grega', g: 'Massas e arroz', i: [[3, 150], [110, 20], [560, 20], [45, 20], [272, 3]], p: ['colher de servir', 45] },
  { n: 'Arroz integral com legumes', g: 'Massas e arroz', i: [[1, 150], [109, 30], [560, 20], [45, 20]], p: ['colher de servir', 45] },
  { n: 'Risoto de frango', g: 'Massas e arroz', i: [[3, 150], [408, 60], [464, 10], [261, 10], [447, 20]], p: ['prato', 250] },
  { n: 'Escondidinho de carne seca', g: 'Massas e arroz', i: [[129, 200], [261, 10], [447, 20], [384, 80], [107, 15], [272, 5], [463, 30]], p: ['porção', 300] },
  { n: 'Escondidinho de frango', g: 'Massas e arroz', i: [[129, 200], [261, 10], [447, 20], [408, 80], [107, 15], [272, 5], [463, 30]], p: ['porção', 300] },
  { n: 'Escondidinho de carne moída', g: 'Massas e arroz', i: [[129, 200], [261, 10], [447, 20], [326, 80], [107, 15], [272, 5], [463, 30]], p: ['porção', 300] },
  { n: 'Torta salgada de frango (massa de liquidificador)', g: 'Massas e arroz', y: 0.85, i: [[35, 120], [489, 100], [LEITE, 240], [272, 120], [408, 200], [157, 50], [45, 50], [513, 8], [464, 10]], p: ['fatia', 120] },
  { n: 'Polenta frita', g: 'Massas e arroz', y: 0.9, i: [[62, 100], [272, 12]], p: ['pedaço', 30] },

  // ---------- acompanhamentos, sopas e saladas ----------
  { n: 'Purê de batata caseiro', g: 'Acompanhamentos', i: [[91, 200], [261, 10], [LEITE, 50]], p: ['colher de servir', 60] },
  { n: 'Purê de mandioca', g: 'Acompanhamentos', i: [[129, 200], [261, 10], [LEITE, 50]], p: ['colher de servir', 60] },
  { n: 'Purê de abóbora', g: 'Acompanhamentos', i: [[64, 200], [261, 10]], p: ['colher de servir', 60] },
  { n: 'Mandioca cozida com manteiga', g: 'Acompanhamentos', i: [[129, 150], [261, 10]], p: ['pedaço', 60] },
  { n: 'Chuchu refogado', g: 'Acompanhamentos', i: [[112, 150], [272, 5], [107, 10]], p: ['colher de servir', 50] },
  { n: 'Feijão com bacon (caldo engrossado)', g: 'Acompanhamentos', i: [[561, 200], [445, 10], [107, 10], [82, 3]], p: ['concha', 140] },
  { n: 'Grão-de-bico cozido', g: 'Acompanhamentos', i: [[575, 40], ['agua', 60]], p: ['colher de sopa', 22] },
  { n: 'Salada de grão-de-bico', g: 'Saladas', i: [[575, 40], ['agua', 60], [157, 40], [107, 15], [153, 5], [260, 5]], p: ['porção', 160] },
  { n: 'Vinagrete', g: 'Saladas', i: [[157, 60], [107, 30], [144, 20], [VINAGRE, 10], [260, 5]], p: ['colher de sopa', 20] },
  { n: 'Salada de alface e tomate com azeite', g: 'Saladas', i: [[78, 50], [157, 50], [260, 5], [517, 0.5]], p: ['prato', 105] },
  { n: 'Salada verde completa', g: 'Saladas', i: [[78, 30], [152, 20], [157, 40], [142, 30], [107, 10], [260, 5]], p: ['prato', 135] },
  { n: 'Maionese de batata', g: 'Saladas', i: [[91, 200], [524, 40], [110, 30], [560, 20]], p: ['colher de servir', 60] },
  { n: 'Caldo verde', g: 'Sopas', i: [[91, 150], [115, 20], [421, 30], [272, 5], ['agua', 150]], p: ['prato fundo', 300] },
  { n: 'Sopa de legumes caseira', g: 'Sopas', i: [[91, 50], [110, 30], [112, 30], [70, 30], [107, 10], ['agua', 200], [272, 3], [517, 1]], p: ['prato fundo', 300] },
  { n: 'Canja de galinha', g: 'Sopas', i: [[3, 50], [408, 40], [110, 15], ['agua', 200], [517, 1]], p: ['prato fundo', 300] },
  { n: 'Sopa de feijão com macarrão', g: 'Sopas', i: [[561, 150], [MACARRAO, 30], ['agua', 50]], p: ['prato fundo', 300] },
  { n: 'Sopa de lentilha', g: 'Sopas', i: [[577, 150], [110, 20], [107, 10], ['agua', 100]], p: ['prato fundo', 300] },

  // ---------- doces ----------
  { n: 'Bolo de cenoura caseiro', g: 'Doces caseiros', y: 0.85, i: [[110, 100], [489, 100], [272, 60], [492, 120], [35, 150], [513, 8]], p: ['fatia', 60] },
  { n: 'Bolo de cenoura com cobertura de chocolate', g: 'Doces caseiros', y: 0.85, i: [[110, 100], [489, 100], [272, 60], [492, 120], [35, 150], [513, 8], [491, 30], [261, 15], [LEITE, 40]], p: ['fatia', 70] },
  { n: 'Bolo de fubá caseiro', g: 'Doces caseiros', y: 0.85, i: [[43, 120], [35, 60], [492, 150], [489, 100], [272, 60], [LEITE, 200], [513, 8]], p: ['fatia', 60] },
  { n: 'Bolo de banana com aveia (sem açúcar)', g: 'Doces caseiros', y: 0.85, i: [[182, 200], [489, 100], [7, 100], [513, 5]], p: ['fatia', 60] },
  { n: 'Brigadeiro', g: 'Doces caseiros', y: 0.85, i: [[453, 395], [491, 30], [261, 15]], p: ['unidade', 15] },
  { n: 'Beijinho', g: 'Doces caseiros', y: 0.85, i: [[453, 395], [590, 50], [261, 15]], p: ['unidade', 15] },
  { n: 'Pudim de leite condensado', g: 'Doces caseiros', y: 0.95, i: [[453, 395], [LEITE, 400], [489, 150], [492, 100]], p: ['fatia', 100] },
  { n: 'Mousse de maracujá', g: 'Doces caseiros', i: [[453, 395], [447, 200], [234, 150]], p: ['taça', 80] },
  { n: 'Arroz-doce caseiro', g: 'Doces caseiros', y: 0.85, i: [[3, 200], [LEITE, 400], [492, 80], [453, 100]], p: ['taça', 150] },
];
