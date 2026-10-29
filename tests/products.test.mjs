import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  isValidGtin, canonicalGtin, parseQuantity, fromOff, qualityOf, mergeProduct, searchProducts,
  productToFood, fromIndexRow, indexRow, shardOf, coverage,
} from '../src/products.js';
import { scaleNutrients, kcalLabel } from '../src/domain.js';

const fixture = new URL('./fixtures/off-amostra.jsonl', import.meta.url);
const raws = readFileSync(fixture, 'utf8').trim().split('\n').map((l) => JSON.parse(l));
const products = raws.filter((r) => r.countries_tags.includes('en:brazil')).map((r) => fromOff(r, { fetchedAt: '2026-10-29T00:00:00Z' }));
const [lata400, lata800, whey, arroz] = products;

test('GTIN: dígito verificador e forma canônica', () => {
  assert.ok(isValidGtin('7891000100103'));
  assert.ok(!isValidGtin('7891000100104'));
  assert.equal(canonicalGtin('012345678905'), '0012345678905');
  assert.equal(canonicalGtin('2000123'), null);
});

test('quantidade da embalagem guarda o texto e lê só o que é claro', () => {
  assert.deepEqual(parseQuantity('400 g'), { raw: '400 g', value: 400, unit: 'g', packs: null });
  assert.equal(parseQuantity('1,5 L').value, 1500);
  assert.deepEqual(parseQuantity('2 x 200 g'), { raw: '2 x 200 g', value: 400, unit: 'g', packs: 2 });
  assert.deepEqual(parseQuantity('pacote grande'), { raw: 'pacote grande', value: null, unit: null, packs: null });
  assert.equal(parseQuantity(''), null);
});

test('produto do OFF mantém valores, unidades, porção e origem', () => {
  assert.equal(lata400.id, 'gtin:7890000000017');
  assert.equal(lata400.brand, 'Marca Exemplo A');
  assert.equal(lata400.original.brands, 'Marca Exemplo A,Linha X');
  assert.deepEqual(lata400.nutrition.perServing.values.energyKcal, { value: 130, unit: 'kcal' });
  assert.equal(lata400.nutrition.perServing.description, '26 g (2 colheres de sopa)');
  assert.equal(lata400.nutrition.basisOnLabel, 'serving');
  assert.equal(lata400.nutrition.computedBySource, 'per100');
  assert.deepEqual(lata400.allergens, ['milk', 'soybeans']);
  assert.equal(lata400.provenance[0].source, 'off');
  assert.equal(lata400.provenance[0].url, 'https://world.openfoodfacts.org/product/7890000000017');
  assert.equal(lata400.provenance[0].verification, 'enviado por colaboradores, não conferido');
  assert.equal(whey.provenance[0].verification, 'conferido por moderador da fonte');
});

test('qualidade: completo, parcial e pendente, sem preencher ausentes', () => {
  assert.equal(lata400.quality.status, 'completo');
  assert.equal(lata800.quality.status, 'parcial');
  assert.ok(lata800.quality.missing.includes('sodium'));
  assert.equal(lata800.nutrition.per100.values.sodium, null);
  assert.equal(whey.quality.status, 'pendente');
  assert.equal(whey.nutrition.per100, null);
  // Só kJ e kcal vieram; nada é derivado.
  assert.equal(arroz.nutrition.per100.values.protein, null);
});

test('tamanhos diferentes da mesma marca são produtos separados', () => {
  const items = products.map(indexRow).map(fromIndexRow);
  const r = searchProducts(items, 'leite em po');
  assert.equal(r.length, 2);
  assert.deepEqual(r.map((x) => x.quantity.raw), ['400 g', '800 g']);
  assert.equal(searchProducts(items, 'exemplo b')[0].name, 'Whey protein baunilha (teste)');
  assert.equal(searchProducts(items, '7890000000024')[0].id, 'gtin:7890000000024');
  assert.equal(searchProducts(items, '2000123')[0].id, 'off:2000123');
  assert.deepEqual(searchProducts(items, '  '), []);
});

test('uso no diário: só valores por 100 g da fonte, sódio em mg', () => {
  const f = productToFood(lata400);
  assert.equal(f.id, 'off-7890000000017');
  assert.equal(f.n.kcal, 500);
  assert.equal(f.n.sodium, 385);
  assert.equal(f.servings[0].g, 26);
  assert.equal(productToFood(lata800).n.sodium, null);
  assert.equal(productToFood(whey), null);
});

test('atualização guarda o anterior no histórico e expõe divergência entre fontes', () => {
  const newer = fromOff({ ...raws[1], nutriments: { ...raws[1].nutriments, 'proteins_100g': 25 } }, { fetchedAt: '2026-11-01T00:00:00Z' });
  const m = mergeProduct(lata800, newer);
  assert.equal(m.history.length, 1);
  assert.equal(m.history[0].nutrition.per100.values.protein.value, 26);
  assert.equal(m.nutrition.per100.values.protein.value, 25);
  assert.equal(mergeProduct(m, newer).history.length, 1, 'sem mudança, sem novo histórico');

  const label = { ...newer, provenance: [{ source: 'rotulo', ref: 'eu', verification: 'conferido pelo usuário' }],
    nutrition: { ...newer.nutrition, per100: { unit: 'g', values: { ...newer.nutrition.per100.values, protein: { value: 24, unit: 'g' } } } } };
  const both = mergeProduct(m, label);
  assert.equal(both.provenance[0].source, 'rotulo');
  assert.equal(both.alternatives[0].provenance[0].source, 'off');
  assert.deepEqual(both.divergences[0].values.map((v) => v.value), [24, 25]);
});

test('cobertura conta status e campos', () => {
  const c = coverage(products);
  assert.equal(c.total, 4);
  assert.equal(c.status.completo.n, 1);
  assert.equal(c.status.pendente.n, 1);
  assert.equal(c.withGtin.n, 3);
  assert.equal(shardOf('gtin:7890000000017'), '17');
});

test('importador processa o dump em fluxo e filtra o Brasil', () => {
  const out = mkdtempSync(join(tmpdir(), 'jplate-'));
  execFileSync(process.execPath, [new URL('../scripts/import-off.mjs', import.meta.url).pathname, fixture.pathname, '--out', out], { stdio: 'pipe' });
  const idx = JSON.parse(readFileSync(join(out, 'indice.json'), 'utf8'));
  assert.equal(idx.items.length, 4);
  assert.ok(idx.items.every((x) => !x.n.includes('francês')));
  assert.ok(existsSync(join(out, 'det', '17.json')));
  const cov = JSON.parse(readFileSync(join(out, 'cobertura.json'), 'utf8'));
  assert.equal(cov.total, 4);
  // Segunda importação de uma fonte sem um dos produtos: ele continua, marcado como ausente.
  execFileSync(process.execPath, [new URL('../scripts/import-off.mjs', import.meta.url).pathname, '/dev/null', '--out', out], { stdio: 'pipe' });
  const again = JSON.parse(readFileSync(join(out, 'det', '17.json'), 'utf8'))[0];
  assert.ok(again.provenance[0].missingSince);
});

test('esquema atual do OFF (input_sets): só valores digitados da embalagem, sem estimativas', () => {
  const p = fromOff({
    code: '7890000000048', product_name_pt: 'Molho (teste)', brands: 'Marca C', quantity: '60ml', serving_size: '5ml',
    nutrition: {
      input_sets: [
        { source: 'packaging', preparation: 'as_sold', per: '100ml', per_quantity: 100, per_unit: 'ml', nutrients: {
          'energy-kcal': { value: 19, value_string: '19', value_computed: 19.3, unit: 'kcal' },
          'energy-kj': { value_computed: 80.5, unit: 'kJ' },
          sodium: { value: 687, value_string: '687', unit: 'mg' },
          proteins: { value: 1, value_string: '1', unit: 'g' },
        } },
        { source: 'packaging', preparation: 'as_sold', per: 'serving', per_quantity: 5, per_unit: 'ml', nutrients: {
          'energy-kcal': { value: 1, value_string: '1', unit: 'kcal' },
        } },
        { source: 'estimate', preparation: 'as_sold', per: '100g', nutrients: { 'added-sugars': { value: 4.7, value_string: '4.7', unit: 'g', modifier: '~' } } },
        { source: 'packaging', preparation: 'prepared', per: '100ml', nutrients: { fat: { value: 9, value_string: '9', unit: 'g' } } },
      ],
      aggregated_set: { nutrients: { 'energy-kj': { value: 81, unit: 'kJ' } } },
    },
  });
  const v = p.nutrition.per100.values;
  assert.equal(p.nutrition.per100.unit, 'ml');
  assert.equal(p.nutrition.basisOnLabel, 'both');
  assert.equal(v.energyKcal.value, 19);
  assert.equal(v.energyKj, null, 'kJ só calculado pela fonte não entra');
  assert.deepEqual(v.sodium, { value: 0.687, unit: 'g', original: '687 mg' });
  assert.equal(v.addedSugars, null, 'estimativa por ingredientes não entra');
  assert.equal(v.fat, null, 'valor do produto preparado não entra');
  assert.equal(p.nutrition.perServing.quantity, 5);
  assert.equal(p.nutrition.perServing.values.energyKcal.value, 1);
  assert.deepEqual(p.nutrition.setSources, ['packaging']);
  assert.equal(p.quality.status, 'parcial');
  assert.equal(productToFood(p).n.sodium, 687);
  const none = fromOff({ code: '7890000000055', product_name: 'Água (teste)', nutrition: { no_nutrition_data_on_packaging: true } });
  assert.equal(none.quality.status, 'pendente');
  assert.ok(none.nutrition.noDataOnPackaging);
});

test('rótulo só por porção: lança em porções, sem converter para 100 g', () => {
  const p = fromOff({
    code: '7890000000062', product_name: 'Whey (teste)', brands: 'Marca D', serving_size: '30 g',
    nutrition: { input_sets: [{ source: 'packaging', preparation: 'as_sold', per: 'serving', per_quantity: 30, per_unit: 'g', nutrients: {
      'energy-kcal': { value: 120, value_string: '120', unit: 'kcal' },
      proteins: { value: 24, value_string: '24', unit: 'g' },
      sodium: { value: 50, value_string: '50', unit: 'mg' },
    } }] },
  });
  assert.equal(p.nutrition.per100, null);
  const f = productToFood(p);
  assert.equal(f.baseUnit, 'porção');
  const n = scaleNutrients(f.n, 1);
  assert.equal(n.kcal, 120);
  assert.equal(n.protein, 24);
  assert.equal(n.sodium, 50);
  assert.equal(n.carbs, null);
  assert.equal(kcalLabel(f), '120 kcal/porção');
  assert.equal(indexRow(p).ks, 120);
});
