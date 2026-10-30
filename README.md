# JPlate

Diário alimentar pessoal, inspirado nos fluxos do FatSecret (buscar alimento, escolher porção, lançar por refeição, ver o total do dia), feito do zero. Funciona offline e guarda tudo só no aparelho.

## O que tem

- **Diário** por dia e por refeição (café, almoço, jantar, lanches), com navegação entre dias.
- **Base com cerca de 6.300 itens**: 593 da TACO, 138 pratos brasileiros calculados (crepioca, escondidinho, marmitas fit, cuscuz, PFs etc.) e cerca de 5.600 da USDA traduzidos. Cada item mostra a fonte.
- **Busca** sem acento, que traz as variações separadas ("ovo" mostra ovo cozido, frito, clara, gema, omelete, crepioca), com recentes, favoritos e filtro de pratos prontos.
- **Produtos de marca** pela internet (Open Food Facts), por nome ou código de barras (câmera no Android, número digitado no iPhone).
- **Medidas caseiras** aproximadas (colher, concha, unidade, fatia) nos alimentos comuns.
- **Dieta**: metas pelos *Parâmetros nutricionais consolidados* (ConsultoriaJP). Repouso por Mifflin-St Jeor × fator da rotina (1,20 / 1,30 / 1,40 / 1,525; "muito ativo" 1,65 só se a triagem do trabalho sustentar), com o nível sugerido por perguntas de triagem (dias e horas de esforço no trabalho, tipo de esforço, passos, treinos). Objetivo aplicado uma vez sobre o GET: emagrecer −15% (−20% só com acompanhamento), manter 0%, ganhar +6,5%. Proteína em g/kg sobre o peso de referência (emagrecimento 1,8 a 2,2; hipertrofia 1,6 a 2,2; IMC ≥ 30 sem referência usa peso ajustado e pede revisão), gordura 20 a 30% das kcal (configurável), carboidrato com as calorias restantes, fibra 14 g/1.000 kcal e conferência 4P + 4C + 9G. Nenhum macro passa da meta de calorias: se não couber, o app pede revisão e não gera o cardápio. O cardápio (`src/planner.js`) sai sozinho com pré e pós-treino, sem os alimentos a evitar e com os preferidos, e nunca passa da meta de calorias; com menores de 18 anos ou condição de saúde o app mostra só as metas. Dá para gerar outra opção, editar, lançar no diário e exportar em PDF ou texto.
- **Perfil (área do aluno)**: nome, nascimento, contato, peso de hoje, peso desejado, observações e foto de perfil, tudo guardado no aparelho e incluído no backup.
- **Porções**: quantidade em g/ml ou porções que você salva (ex.: "1 unidade média = 86 g").
- **Lançamento rápido** só com calorias, para restaurante ou estimativa.
- **Meus alimentos**: cadastro de produtos de marca e receitas de casa, em g ou ml.
- **Metas** de calorias, macros e fibras, com anel e barras de progresso. Mudar a meta não altera dias passados.
- **Peso** com gráfico e linha de tendência (média dos últimos 7 registros).
- **Backup** em JSON (exportar e importar) e lembrete a cada 14 dias.

Cada lançamento guarda os nutrientes do momento em que foi feito, então editar um alimento depois não muda o histórico.

## Biblioteca de produtos de marca

Busca por nome, marca ou código de barras em produtos vendidos no Brasil, importados do Open Food Facts (ODbL), com marca, embalagem, porção, valores do rótulo, fonte e situação da tabela (completa, parcial ou pendente). Valores ausentes aparecem como "não informado"; nada é estimado. Detalhes, importação e licenças em [docs/BIBLIOTECA.md](docs/BIBLIOTECA.md).

## Servidor (opcional): dica do dia e IA da SÁ

A pasta `server/` tem um servidor pequeno (Cloudflare Workers, plano gratuito) que envia a dica do dia por notificação e responde pela IA quando a SÁ não tem resposta cadastrada, com limites de gasto. Sem ele o app funciona igual, só offline. Passo a passo em [docs/SERVIDOR.md](docs/SERVIDOR.md).

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
