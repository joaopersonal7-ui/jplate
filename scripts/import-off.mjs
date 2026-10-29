// Importa produtos vendidos no Brasil do Open Food Facts para a biblioteca do app.
//
// Uso:
//   node scripts/import-off.mjs                       # baixa o dump oficial (JSONL .gz) em fluxo
//   node scripts/import-off.mjs caminho/dump.jsonl.gz # usa um arquivo já baixado (.jsonl ou .jsonl.gz)
//   node scripts/import-off.mjs --limit 500 ...       # para testar com poucos produtos
//   node scripts/import-off.mjs --out outra/pasta ... # pasta de saída (padrão: data/produtos)
//
// O dump é lido linha a linha, descompactado em fluxo, sem carregar o arquivo inteiro na memória.
// Só linhas que mencionam "en:brazil" passam pelo JSON.parse; depois o campo countries_tags confirma.
// O Open Food Facts pede o uso do dump (e não milhares de chamadas à API) para importações grandes:
// https://openfoodfacts.github.io/documentation/docs/Product-Opener/api/
//
// Saída (pasta data/produtos):
//   indice.json      busca: uma linha curta por produto
//   det/00..99.json  detalhes completos (nutrição, ingredientes, proveniência, histórico)
//   cobertura.json   números da importação
//   LICENCA.md       atribuição e licença ODbL da base derivada
// Se a pasta já tiver uma importação, os produtos são mesclados: o que mudou vai para o histórico,
// e produtos que sumiram da fonte continuam, marcados como ausentes na última importação.
import { createReadStream, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { createGunzip } from 'node:zlib';
import { createInterface } from 'node:readline';
import { Readable } from 'node:stream';
import { join } from 'node:path';
import { fromOff, mergeProduct, indexRow, shardOf, coverage } from '../src/products.js';

const DUMP_URL = 'https://static.openfoodfacts.org/data/openfoodfacts-products.jsonl.gz';
const USER_AGENT = 'JPlate/1.0 (app pessoal de nutricao; https://github.com/joaopersonal7-ui/jplate)';

const args = process.argv.slice(2);
const opt = (name, fallback) => {
  const i = args.indexOf(name);
  if (i < 0) return fallback;
  const v = args[i + 1];
  args.splice(i, 2);
  return v;
};
const limit = Number(opt('--limit', Infinity));
const outDir = opt('--out', new URL('../data/produtos/', import.meta.url).pathname);
const input = args[0] ?? DUMP_URL;
const startedAt = new Date().toISOString();

async function openInput(src) {
  let stream;
  if (/^https?:/.test(src)) {
    const r = await fetch(src, { headers: { 'User-Agent': USER_AGENT } });
    if (!r.ok) throw new Error(`Falha ao baixar ${src}: HTTP ${r.status}`);
    stream = Readable.fromWeb(r.body);
  } else {
    stream = createReadStream(src);
  }
  return src.endsWith('.gz') ? stream.pipe(createGunzip()) : stream;
}

function loadPrevious(dir) {
  const prev = new Map();
  const det = join(dir, 'det');
  if (!existsSync(det)) return prev;
  for (const f of readdirSync(det).filter((x) => x.endsWith('.json'))) {
    for (const p of JSON.parse(readFileSync(join(det, f), 'utf8'))) prev.set(p.id, p);
  }
  return prev;
}

const previous = loadPrevious(outDir);
const products = new Map();
let lines = 0;
let candidates = 0;
let parseErrors = 0;
let duplicates = 0;
// Diagnóstico do formato do dump: quais campos de nutrição aparecem nos produtos do Brasil.
// Se o Open Food Facts mudar o esquema, isto aparece em diagnostico.json em vez de passar calado.
const schema = { withNutriments: 0, withNutritionObject: 0, nutrimentKeys: {}, nutritionKeys: {}, states: {}, topLevelKeys: {} };
const samples = [];
const bump = (o, k) => { o[k] = (o[k] ?? 0) + 1; };

const rl = createInterface({ input: await openInput(input), crlfDelay: Infinity });
for await (const line of rl) {
  lines += 1;
  if (lines % 500000 === 0) process.stderr.write(`  ${lines.toLocaleString('pt-BR')} linhas lidas, ${products.size} do Brasil\n`);
  if (!line.includes('en:brazil')) continue;
  candidates += 1;
  let raw;
  try { raw = JSON.parse(line); } catch { parseErrors += 1; continue; }
  if (!(raw.countries_tags ?? []).includes('en:brazil')) continue;
  if (raw.nutriments && Object.keys(raw.nutriments).length) schema.withNutriments += 1;
  if (raw.nutrition && typeof raw.nutrition === 'object') schema.withNutritionObject += 1;
  if (schema.withNutriments + schema.withNutritionObject < 3000) {
    for (const k of Object.keys(raw.nutriments ?? {})) bump(schema.nutrimentKeys, k);
    for (const k of Object.keys(raw.nutrition ?? {})) bump(schema.nutritionKeys, k);
    for (const k of Object.keys(raw)) bump(schema.topLevelKeys, k);
  }
  for (const k of raw.states_tags ?? []) if (/nutrition|complete|checked/.test(k)) bump(schema.states, k);
  if (samples.length < 3 && (raw.nutriments || raw.nutrition)) {
    samples.push(Object.fromEntries(Object.entries(raw).filter(([k]) => /code|nutri|serving|quantity|states|product_name|brands/.test(k))));
  }
  const p = fromOff(raw, { fetchedAt: startedAt, via: 'dump' });
  if (!p) continue;
  // O mesmo GTIN pode aparecer com zero à esquerda; fica o registro modificado por último.
  const dup = products.get(p.id);
  if (dup) {
    duplicates += 1;
    if ((dup.provenance[0].sourceModifiedAt ?? '') >= (p.provenance[0].sourceModifiedAt ?? '')) continue;
  }
  products.set(p.id, p);
  if (products.size >= limit) break;
}
rl.close();

// Mescla com a importação anterior sem apagar histórico.
const merged = [];
for (const p of products.values()) merged.push(mergeProduct(previous.get(p.id), p));
let missingNow = 0;
for (const [id, old] of previous) {
  if (products.has(id)) continue;
  // Numa importação parcial (--limit) não dá para saber o que sumiu da fonte.
  if (Number.isFinite(limit)) { merged.push(old); continue; }
  missingNow += 1;
  merged.push({ ...old, provenance: old.provenance.map((x, i) => (i === 0 ? { ...x, missingSince: x.missingSince ?? startedAt } : x)) });
}
merged.sort((a, b) => a.id.localeCompare(b.id));

mkdirSync(join(outDir, 'det'), { recursive: true });
const shards = {};
for (const p of merged) (shards[shardOf(p.id)] ??= []).push(p);
for (let i = 0; i < 100; i++) {
  const k = String(i).padStart(2, '0');
  writeFileSync(join(outDir, 'det', `${k}.json`), JSON.stringify(shards[k] ?? []));
}

const meta = {
  source: 'off',
  sourceName: 'Open Food Facts',
  input: /^https?:/.test(input) ? input : 'arquivo local',
  importedAt: startedAt,
  filter: 'countries_tags contém en:brazil',
  license: 'ODbL 1.0 (base derivada) · DbCL 1.0 (conteúdo)',
};
writeFileSync(join(outDir, 'indice.json'), JSON.stringify({ meta, items: merged.map(indexRow) }));

const cov = {
  ...meta,
  linesRead: lines,
  candidates,
  parseErrors,
  duplicates,
  missingFromSourceNow: missingNow,
  withHistory: merged.filter((p) => p.history?.length).length,
  partialRun: Number.isFinite(limit),
  ...coverage(merged),
};
writeFileSync(join(outDir, 'cobertura.json'), JSON.stringify(cov, null, 2));
const top = (o, n) => Object.fromEntries(Object.entries(o).sort((a, b) => b[1] - a[1]).slice(0, n));
writeFileSync(join(outDir, 'diagnostico.json'), JSON.stringify({
  ...schema,
  nutrimentKeys: top(schema.nutrimentKeys, 80),
  nutritionKeys: top(schema.nutritionKeys, 40),
  topLevelKeys: top(schema.topLevelKeys, 200),
  states: top(schema.states, 30),
  samples,
}, null, 1));

writeFileSync(join(outDir, 'LICENCA.md'), `# Licença dos dados desta pasta

Os arquivos desta pasta são uma base derivada do **Open Food Facts** (https://world.openfoodfacts.org),
filtrada para produtos marcados como vendidos no Brasil e reorganizada para busca no JPlate.

- Base de dados: Open Database License (ODbL) 1.0 — https://opendatacommons.org/licenses/odbl/1-0/
- Conteúdo de cada registro: Database Contents License (DbCL) 1.0 — https://opendatacommons.org/licenses/dbcl/1-0/
- Imagens de produtos **não** foram baixadas nem incluídas (têm licença própria, CC BY-SA, por foto).

Como base derivada, esta pasta também fica sob a ODbL 1.0. Ela pode ser reproduzida com
\`node scripts/import-off.mjs\`, a partir do dump público. Importação: ${startedAt}.

Os dados da TACO, USDA e receitas do app ficam em arquivos separados, com sua própria origem,
e não foram misturados a esta base.
`);

const s = cov.status;
process.stderr.write(`\nImportados ${cov.total} produtos (${cov.brands} marcas) de ${lines.toLocaleString('pt-BR')} linhas.\n`
  + `Tabela completa ${s.completo.pct}% · parcial ${s.parcial.pct}% · pendente ${s.pendente.pct}% · utilizável no diário ${cov.basicForDiary.pct}%\n`);
if (cov.total > 100 && s.pendente.pct > 90) {
  process.stderr.write('ATENÇÃO: mais de 90% sem nutrição. O formato do dump pode ter mudado; confira src/products.js (fromOff).\n');
}
