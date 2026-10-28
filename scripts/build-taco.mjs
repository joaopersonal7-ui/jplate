// Converte a TACO (4ª ed., NEPA/UNICAMP) em JSON enxuto para o app.
// Uso: node scripts/build-taco.mjs <tabela_alimentos.json> > data/taco.json
// Marcadores da TACO: "Tr" (traços) vira 0; "NA", "*" e vazio viram null (desconhecido).
import { readFileSync } from 'node:fs';

const src = JSON.parse(readFileSync(process.argv[2], 'utf8'));

const num = (v) => {
  if (typeof v === 'number') return Math.round(v * 100) / 100;
  if (v === 'Tr') return 0;
  return null;
};

const foods = [];
for (const x of src) {
  const kcal = num(x.energy_kcal);
  // Linhas sem análise (ex.: "Leite, de vaca, integral" vem com 0 e "*") ficam de fora.
  if (kcal === null || (kcal === 0 && x.protein_g === '*')) continue;
  foods.push({
    id: `taco-${x.id}`,
    name: x.description,
    group: x.category,
    n: {
      kcal,
      carbs: num(x.carbohydrate_g),
      protein: num(x.protein_g),
      fat: num(x.lipid_g),
      fiber: num(x.fiber_g),
      sodium: num(x.sodium_mg),
    },
  });
}

process.stdout.write(JSON.stringify(foods));
