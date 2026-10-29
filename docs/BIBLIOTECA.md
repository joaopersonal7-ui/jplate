# Biblioteca de produtos de marca

Primeira etapa da biblioteca pesquisável de alimentos e suplementos embalados, por nome, marca,
código de barras (GTIN/EAN) e tamanho de embalagem.

## Como o app funcionava antes

- **Tecnologia:** PWA em JavaScript puro (módulos ES), sem etapa de build. `index.html` + `src/*.js`,
  service worker (`sw.js`) para uso offline.
- **Armazenamento:** IndexedDB no aparelho (`src/db.js`). Bases de alimentos genéricos vêm de
  arquivos JSON estáticos em `data/` (TACO, receitas, USDA), carregados na abertura.
- **Busca:** `searchFoods` (`src/domain.js`) percorre a lista em memória, sem acento, com pontuação
  por prefixo, favoritos e recentes. Produtos de marca só existiam pela consulta online ao
  Open Food Facts (`src/off.js`), convertidos direto para o formato do diário.

## O que mudou

| Arquivo | Papel |
| --- | --- |
| `src/products.js` | Modelo do Produto, normalização do OFF, qualidade, histórico/divergência, busca, conversão para o diário, cobertura. Puro, testado. |
| `src/library.js` | Carrega a biblioteca publicada sob demanda e guarda no aparelho os produtos consultados online. |
| `src/db.js` | Banco v2: novo store `products` (incluído no backup). |
| `src/off.js` | A consulta online agora devolve Produtos completos (com origem), sem derivar valores. |
| `src/app.js` | Seção "Produtos de marca" na busca, ficha do produto, leitor de código de barras procura primeiro na biblioteca, cartão da biblioteca na aba Alimentos. |
| `sw.js` | Arquivos de `data/produtos/` entram no cache na primeira vez que são usados (não na instalação). |
| `scripts/import-off.mjs` | Importador reproduzível do dump do Open Food Facts. |
| `scripts/adapters/gs1br.mjs`, `tbca.mjs` | Pontos de integração documentados, inativos (dependem de contrato/autorização). |
| `.github/workflows/importar-produtos.yml` | Roda a importação no GitHub Actions quando acionada manualmente. |
| `tests/products.test.mjs` | Testes do modelo, da busca, do histórico e do importador (com amostra fictícia). |

## Modelo de dados (Produto)

```
id                 'gtin:<GTIN>' (ou 'off:<código>' quando o código não é GTIN válido)
kind               'embalado' | 'generico' (TBCA, sem marca)
gtin               GTIN com dígito verificador conferido; UPC-12 vira 13 dígitos
name, brand        nome e primeira marca, como vieram
quantity           { raw: '400 g', value: 400, unit: 'g', packs } — value null se o texto não é claro
category, ingredients, allergens[], traces[]
nutrition
  basisOnLabel     '100g' | 'serving' | null — qual coluna o rótulo trazia
  per100           { unit: 'g'|'ml', values: { energyKcal: {value, unit}, carbs, ... } }
  perServing       { description: '26 g (2 colheres)', quantity, unit, values }
  computedBySource coluna que a própria fonte calculou a partir da porção
quality            { status: 'completo'|'parcial'|'pendente', basic, present[], missing[], ... }
original           campos originais recebidos (nome, marcas, quantidade, categorias)
provenance[]       { source, ref, url, via: 'dump'|'api', fetchedAt, sourceModifiedAt,
                     license, verification, missingSince? }
history[]          versões anteriores da mesma fonte (quando algo mudou)
alternatives[]     registros de outras fontes para o mesmo GTIN
divergences[]      nutrientes em que as fontes discordam (mais de 1%)
```

Regras:

- Nutriente ausente fica `null` e aparece como **"não informado"**. Nada é calculado, estimado ou
  copiado de outro produto, sabor ou tamanho. kJ não vira kcal; sal não vira sódio.
  A única conversão é de unidade da mesma grandeza (sódio de g para mg na tela).
- **Completo** = valor energético (kcal), carboidratos, açúcares totais, proteínas, gorduras totais,
  saturadas, trans, fibra e sódio presentes na coluna do rótulo. **Parcial** = algum valor presente.
  **Pendente** = nenhum.
- Cada GTIN é um produto. Marcas, sabores e tamanhos diferentes aparecem como linhas separadas.
- Atualizar nunca apaga: o anterior vai para `history`; outra fonte vai para `alternatives` e as
  diferenças aparecem na ficha. Produto que some da fonte continua, com `missingSince`.
- Prioridade quando há mais de uma fonte: rótulo conferido pelo usuário > GS1 Brasil > Open Food Facts.

## Importar ou atualizar os dados

### Pelo GitHub (recomendado, sem instalar nada)

1. No repositório, abra **Actions → Importar produtos (Open Food Facts) → Run workflow** e escolha o ramo.
2. O fluxo roda os testes, baixa o dump público em fluxo, filtra o Brasil, mescla com a importação
   anterior (guardando histórico) e grava `data/produtos/` no ramo.
3. O resumo da execução mostra a cobertura. Depois é só publicar o ramo (GitHub Pages).

### No computador

Requer Node 20+ e cerca de 10 GB de download (o dump inteiro é lido em fluxo, não fica em disco):

```
node scripts/import-off.mjs                         # baixa e importa
node scripts/import-off.mjs dump.jsonl.gz           # usa um arquivo já baixado
node scripts/import-off.mjs --limit 2000            # teste rápido
```

Saída em `data/produtos/`: `indice.json` (busca), `det/00..99.json` (fichas), `cobertura.json`
e `LICENCA.md`. Ao publicar, troque `VERSION` em `sw.js`.

O importador usa o dump JSONL, como a documentação do Open Food Facts recomenda para importações
grandes, e se identifica com User-Agent próprio. A busca online do app faz uma chamada por ação do
usuário (buscar ou ler código), nunca em lote.

## Licenças e fontes

| Fonte | Situação | Condição |
| --- | --- | --- |
| Open Food Facts | **Em uso** (dump + consulta online) | Base sob ODbL 1.0, conteúdo sob DbCL 1.0. Base derivada publicada também sob ODbL, com atribuição (`data/produtos/LICENCA.md` e ficha do produto). Imagens não são baixadas (licença CC BY-SA por foto). |
| GS1 Brasil | Adaptador inativo | API paga, depende de plano e liberação. Redistribuição depende do contrato. |
| TBCA/USP | Adaptador inativo | Uso comercial exige contato com os coordenadores. Itens seriam genéricos, sem marca. |
| TACO, USDA, receitas | Já existentes | Continuam em arquivos próprios, separados da base do OFF. |

Nenhum varejista é consultado. Nenhuma credencial foi configurada.

## Limitações conhecidas

- O Open Food Facts é colaborativo: cobre o que voluntários cadastraram, com erros possíveis e
  muitos produtos sem tabela. A biblioteca **não é um catálogo completo** do mercado brasileiro.
- O filtro "Brasil" depende do campo `countries_tags` preenchido pelos colaboradores.
- Quando o rótulo traz a tabela por porção, a coluna por 100 g/ml é calculada pelo próprio OFF
  (e vice-versa). A ficha avisa qual coluna veio do rótulo.
- Alérgenos vêm como tags da fonte; só os principais são traduzidos.
- Suplementos aparecem quando cadastrados no OFF como alimento; não há fonte específica de
  suplementos (registro ANVISA) integrada.

## O que depende de você

- **Acesso pago / contrato:** GS1 Brasil (dados verificados por GTIN, em nome do fabricante).
- **Licença / autorização:** TBCA/USP para uso no app (especialmente se o app for comercial).
- **Dados do fabricante:** produtos ausentes ou pendentes só ficam completos com o rótulo
  (cadastro manual no app) ou com dados enviados pelo fabricante/GS1.
- **Publicação:** a base derivada do OFF publicada no GitHub Pages fica sob ODbL (aberta, com
  atribuição). Isso é compatível com um app pessoal; para um app fechado/comercial, revise as
  obrigações de compartilhamento da ODbL.
