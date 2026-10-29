# JPlate

Diário alimentar pessoal, inspirado nos fluxos do FatSecret (buscar alimento, escolher porção, lançar por refeição, ver o total do dia), feito do zero. Funciona offline e guarda tudo só no aparelho.

## O que tem

- **Diário** por dia e por refeição (café, almoço, jantar, lanches), com navegação entre dias.
- **Base com cerca de 6.300 itens**: 593 da TACO, 138 pratos brasileiros calculados (crepioca, escondidinho, marmitas fit, cuscuz, PFs etc.) e cerca de 5.600 da USDA traduzidos. Cada item mostra a fonte.
- **Busca** sem acento, que traz as variações separadas ("ovo" mostra ovo cozido, frito, clara, gema, omelete, crepioca), com recentes, favoritos e filtro de pratos prontos.
- **Produtos de marca** pela internet (Open Food Facts), por nome ou código de barras (câmera no Android, número digitado no iPhone).
- **Medidas caseiras** aproximadas (colher, concha, unidade, fatia) nos alimentos comuns.
- **Dieta**: com objetivo, horários de acordar e dormir, se já treina, o nível e quantas refeições por dia (2 a 3, 4, 5 ou 6), calcula calorias, proteína, carboidrato, gordura e fibra (Mifflin-St Jeor) e gera sozinho um cardápio completo com horário de cada refeição, ajustado às metas (`src/planner.js`). Dá para gerar outra opção, editar à mão, lançar no diário e exportar em PDF (impressão do navegador) ou texto.
- **Perfil (área do aluno)**: nome, nascimento, contato, peso de hoje, peso desejado, observações e foto de perfil, tudo guardado no aparelho e incluído no backup.
- **Porções**: quantidade em g/ml ou porções que você salva (ex.: "1 unidade média = 86 g").
- **Lançamento rápido** só com calorias, para restaurante ou estimativa.
- **Meus alimentos**: cadastro de produtos de marca e receitas de casa, em g ou ml.
- **Metas** de calorias, macros e fibras, com anel e barras de progresso. Mudar a meta não altera dias passados.
- **Peso** com gráfico e linha de tendência (média dos últimos 7 registros).
- **Backup** em JSON (exportar e importar) e lembrete a cada 14 dias.

Cada lançamento guarda os nutrientes do momento em que foi feito, então editar um alimento depois não muda o histórico.

## Como usar

O app precisa ser servido por HTTP (não abre direto do arquivo por causa do modo offline).

No computador:

```
cd app-nutricao
python3 -m http.server 8080
```

Depois abra `http://localhost:8080`.

No celular, publique a pasta num host estático gratuito (GitHub Pages, Netlify ou Cloudflare Pages), abra o endereço e use "Adicionar à tela inicial". Depois disso funciona sem internet. Em Perfil, toque em "Proteger armazenamento".

## Estrutura

| Arquivo | Papel |
| --- | --- |
| `index.html`, `src/styles.css` | Página e visual (tema claro e escuro) |
| `src/app.js` | Telas e interações |
| `src/domain.js` | Regras puras: datas, busca, porções, totais, metas, tendência, backup |
| `src/db.js` | Armazenamento local (IndexedDB) |
| `data/taco.json` | TACO, gerada por `scripts/build-taco.mjs` |
| `data/usda.json` | USDA/TempoLife em português, gerada por `scripts/build-usda.mjs` com as traduções de `scripts/src/usda-pt.tsv` |
| `data/receitas.json` | Pratos calculados, gerados por `scripts/build-receitas.mjs` a partir de `scripts/src/receitas.mjs` |
| `src/measures.js` | Medidas caseiras |
| `src/off.js` | Busca online no Open Food Facts e leitor de código de barras |
| `sw.js`, `manifest.webmanifest` | Modo offline e instalação |
| `tests/domain.test.mjs` | Testes das regras (`npm test`, Node 20+) |

Ao publicar uma versão nova, troque `VERSION` em `sw.js` para o celular baixar os arquivos novos.

## Dados e limites

- Base de alimentos: Tabela Brasileira de Composição de Alimentos (TACO), 4ª edição, NEPA/UNICAMP, 2011. "Traços" contam como zero; valores não analisados aparecem como "sem dado" e o resumo avisa que o total está incompleto.
- Nenhum dado, texto, marca ou imagem do FatSecret foi usado. O site serviu só de referência para os fluxos.
- USDA FoodData Central SR Legacy (domínio público), recebida pelo pacote aberto tempo-food-db (TempoLife, CC-BY 4.0); nomes traduzidos pela JPlate.
- Produtos de marca: Open Food Facts (ODbL), consultado só quando o usuário pede.
- Medidas caseiras e pratos calculados são estimativas e aparecem marcados como tal.
- Os números são estimativas para acompanhamento pessoal e não substituem orientação profissional.
