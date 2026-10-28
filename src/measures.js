// Medidas caseiras aproximadas para alimentos comuns (peso médio da porção, em g ou ml).
// A regra vale pelo nome do alimento; a primeira que bater define as medidas.
// São referências de uso doméstico, não pesagem: o app mostra "aprox." ao lado.

const RULES = [
  [/^arroz.*cozid|^arroz (branco|integral|parboilizado).*cozid|^arroz com |^arroz a grega|^arroz integral com/, [['colher de sopa cheia', 25], ['colher de servir', 45], ['escumadeira', 90]]],
  [/^feijao.*cozid|^feijao com|^feijoada|^feijao tropeiro/, [['concha média', 140], ['colher de sopa', 20]]],
  [/^lentilha.*cozid|^grao de bico.*cozid/, [['colher de sopa', 22], ['concha média', 140]]],
  [/^macarrao.*cozid|^macarrao (ao|alho|com)|^espaguete/, [['pegador', 110], ['prato raso', 220]]],
  [/^pao trigo frances|^pao frances|^pao com|^pao na chapa/, [['unidade', 50]]],
  [/^pao.*forma|^pao de forma|^pao integral|^torrada/, [['fatia', 25]]],
  [/^pao de queijo/, [['unidade média', 25]]],
  [/^ovo de codorna/, [['unidade', 10]]],
  [/^ovo de galinha.*clara|^clara de ovo/, [['clara de 1 ovo', 33]]],
  [/^ovo de galinha.*gema|^gema de ovo/, [['gema de 1 ovo', 17]]],
  [/^ovo(s)? (de galinha|cozido|frito|poche|quente|inteiro|mexido)|^ovo frito|^ovo cozido/, [['unidade', 50]]],
  [/^tapioca|^crepioca/, [['unidade', 70]]],
  [/^cuscuz/, [['fatia', 100], ['colher de sopa', 30]]],
  [/^banana/, [['unidade média', 70]]],
  [/^maca /, [['unidade média', 130]]],
  [/^laranja.*cru/, [['unidade média', 130]]],
  [/^mamao/, [['fatia média', 170]]],
  [/^melancia|^melao/, [['fatia média', 200]]],
  [/^morango/, [['unidade', 12]]],
  [/^uva/, [['cacho pequeno', 100], ['unidade', 5]]],
  [/^abacate/, [['colher de sopa', 30]]],
  [/^tangerina|^mexerica/, [['unidade média', 100]]],
  [/^manga/, [['unidade média', 200]]],
  [/^pera/, [['unidade média', 140]]],
  [/^kiwi/, [['unidade', 75]]],
  [/^batata.*(cozid|assad)/, [['unidade média', 140], ['colher de sopa', 30]]],
  [/^batata.*frita|^batata frita/, [['porção pequena', 80]]],
  [/^mandioca.*(cozid|frita)|^aipim/, [['pedaço médio', 60]]],
  [/^pure de/, [['colher de servir', 60]]],
  [/^frango.*peito.*(grelhad|cozid|assad)|^peito de frango|^file de frango/, [['filé médio', 100]]],
  [/^frango.*coxa/, [['unidade', 70]]],
  [/^frango.*sobrecoxa/, [['unidade', 90]]],
  [/^carne bovina.*(grelhad|frito|bife)|^bife/, [['bife médio', 100]]],
  [/moid/, [['colher de sopa', 25]]],
  [/^hamburguer/, [['unidade', 90]]],
  [/^linguica/, [['gomo', 60]]],
  [/^salsicha/, [['unidade', 45]]],
  [/^presunto|^peito de peru fatiado|^mortadela|^salame|^apresuntado/, [['fatia', 15]]],
  [/^queijo.*(mozarela|mucarela|prato)|^queijo mussarela/, [['fatia', 20]]],
  [/^queijo.*minas|^queijo coalho/, [['fatia média', 30]]],
  [/^queijo.*parmesao/, [['colher de sopa (ralado)', 5]]],
  [/^queijo.*ricota|^ricota/, [['colher de sopa', 30]]],
  [/^queijo cottage/, [['colher de sopa', 30]]],
  [/^iogurte/, [['pote', 170]]],
  [/^leite.*\bpo\b/, [['colher de sopa', 15]]],
  [/^leite condensado/, [['colher de sopa', 20]]],
  [/^creme de leite/, [['colher de sopa', 15]]],
  [/^leite|^bebida de (soja|aveia|arroz|amendoa)/, [['copo americano', 190], ['xícara', 240]]],
  [/^cafe.*infusao|^cafe (com|preto|coado|expresso)/, [['xícara de cafezinho', 50], ['xícara', 100]]],
  [/^suco|^refresco|^limonada|^vitamina|^shake/, [['copo', 250]]],
  [/^refrigerante/, [['lata', 350], ['copo', 250]]],
  [/^cerveja/, [['lata', 350], ['long neck', 355]]],
  [/^cha /, [['xícara', 200]]],
  [/^agua de coco|^coco agua/, [['copo', 250]]],
  [/^azeite|^oleo/, [['colher de sopa', 8], ['colher de chá', 3]]],
  [/^manteiga|^margarina|^creme vegetal/, [['colher de chá', 5], ['ponta de faca', 3]]],
  [/^maionese/, [['colher de sopa', 12]]],
  [/^acucar|^adocante/, [['colher de chá', 5], ['colher de sopa', 12]]],
  [/^mel/, [['colher de sopa', 20]]],
  [/^achocolatado/, [['colher de sopa', 12]]],
  [/^aveia/, [['colher de sopa', 15]]],
  [/^granola/, [['colher de sopa', 10]]],
  [/^chia|^linhaca|^gergelim|^semente/, [['colher de sopa', 10]]],
  [/^farinha.*mandioca|^farofa|^mandioca farofa/, [['colher de sopa', 15]]],
  [/^farinha|^amido|^fecula|^fuba/, [['colher de sopa', 15], ['xícara', 120]]],
  [/^pasta de amendoim/, [['colher de sopa', 15]]],
  [/^whey|proteina isolada|suplemento proteico/, [['scoop', 30]]],
  [/^castanha|^amendoa|^noz|^amendoim|^mix de castanhas|^pistache|^macadamia|^avela/, [['punhado', 30]]],
  [/^alface|^rucula|^agriao|^espinafre.*cru|^couve.*cru/, [['prato raso', 40], ['folha', 10]]],
  [/^tomate.*cru|^tomate cru/, [['unidade média', 100], ['fatia', 15]]],
  [/^cenoura.*crua|^cenoura cozida/, [['colher de sopa (ralada)', 12], ['unidade média', 100]]],
  [/^brocolis|^couve flor/, [['ramo', 30]]],
  [/^chocolate/, [['quadradinho', 5], ['barra pequena', 25]]],
  [/^biscoito/, [['unidade', 7]]],
  [/^bolo/, [['fatia média', 60]]],
  [/^pizza/, [['fatia', 90]]],
  [/^brigadeiro|^beijinho/, [['unidade', 15]]],
  [/^sopa|^caldo verde|^canja/, [['prato fundo', 300], ['concha', 140]]],
];

const norm = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

// Porções prontas do alimento: as que vêm com ele (pratos calculados) e as medidas caseiras.
export function defaultServings(food) {
  const own = (food.servings ?? []).map((s) => ({ name: s.name, g: s.g }));
  if (food.source === 'user' || food.source === 'off') return own;
  const name = food._norm ?? norm(food.name);
  const rule = RULES.find(([re]) => re.test(name));
  const extra = rule ? rule[1].map(([n, g]) => ({ name: n, g })) : [];
  const seen = new Set(own.map((s) => s.name));
  return [...own, ...extra.filter((s) => !seen.has(s.name))];
}
