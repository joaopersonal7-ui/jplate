# JPlate

Diário alimentar pessoal, inspirado nos fluxos do FatSecret (buscar alimento, escolher porção, lançar por refeição, ver o total do dia), feito do zero. Funciona offline e guarda tudo só no aparelho.

## O que tem

- **Diário** por dia e por refeição (café, almoço, jantar, lanches), com navegação entre dias.
- **Busca** em 593 alimentos da TACO, sem precisar de acento ("acucar" acha "Açúcar"), com recentes e favoritos.
- **Porções**: quantidade em g/ml ou porções que você salva (ex.: "1 unidade média = 86 g").
- **Lançamento rápido** só com calorias, para restaurante ou estimativa.
- **Meus alimentos**: cadastro de produtos de marca e receitas de casa, em g ou ml.
- **Metas** de calorias e macros, com anel e barras de progresso. Mudar a meta não altera dias passados.
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

No celular, publique a pasta num host estático gratuito (GitHub Pages, Netlify ou Cloudflare Pages), abra o endereço e use "Adicionar à tela inicial". Depois disso funciona sem internet. Em Ajustes, toque em "Proteger armazenamento".

## Estrutura

| Arquivo | Papel |
| --- | --- |
| `index.html`, `src/styles.css` | Página e visual (tema claro e escuro) |
| `src/app.js` | Telas e interações |
| `src/domain.js` | Regras puras: datas, busca, porções, totais, metas, tendência, backup |
| `src/db.js` | Armazenamento local (IndexedDB) |
| `data/taco.json` | Base de alimentos gerada por `scripts/build-taco.mjs` |
| `sw.js`, `manifest.webmanifest` | Modo offline e instalação |
| `tests/domain.test.mjs` | Testes das regras (`npm test`, Node 20+) |

Ao publicar uma versão nova, troque `VERSION` em `sw.js` para o celular baixar os arquivos novos.

## Dados e limites

- Base de alimentos: Tabela Brasileira de Composição de Alimentos (TACO), 4ª edição, NEPA/UNICAMP, 2011. "Traços" contam como zero; valores não analisados aparecem como "sem dado" e o resumo avisa que o total está incompleto.
- Nenhum dado, texto, marca ou imagem do FatSecret foi usado. O site serviu só de referência para os fluxos.
- A TACO não traz medidas caseiras (colher, unidade); por isso as porções são cadastradas por você.
- Os números são estimativas para acompanhamento pessoal e não substituem orientação profissional.
