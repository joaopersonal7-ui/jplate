# Servidor do JPlate: dica do dia e SÁ que entende a pergunta

O app continua offline e guarda o diário só no aparelho. O servidor (pasta `server/`) roda de graça na Cloudflare e faz duas coisas:

1. **Dica do dia por notificação.** O aluno escolhe o horário em *Notificações* (menu). Todo dia chega uma dica tirada dos 50 conceitos do banco da SÁ; tocar nela abre a explicação completa na SÁ.
2. **A SÁ entende a pergunta.** Com internet, uma IA gratuita da Cloudflare (Workers AI) lê a pergunta do aluno e escolhe qual pergunta cadastrada no banco tem o mesmo sentido. A SÁ mostra o texto cadastrado, exatamente como está no banco. **A IA nunca escreve respostas.** Se nenhuma pergunta do banco responde, a SÁ diz com sinceridade que não tem a resposta e pede para o aluno falar com a equipe, para ela ser preparada para perguntas como essa.

Ficam só no app, sem passar pela IA: toques em perguntas sugeridas, conversa (oi, obrigado…), temas de saúde (vão para a equipe), respostas em conflito, contas da Tabela de equivalências e perguntas escritas igual a um título do banco. Sem internet, ou se o servidor falhar, a SÁ usa a busca do próprio app, como antes.

## Como a IA escolhe

1. O servidor compara o sentido da pergunta com os 557 títulos do banco (modelo `@cf/baai/bge-m3`) e separa os 10 mais próximos, junto com os que a busca do app achou.
2. Um modelo de texto (`@cf/meta/llama-3.3-70b-instruct-fp8-fast`) recebe a pergunta e essa lista e devolve só o número da pergunta que responde a dúvida, ou 0 se nenhuma serve.
3. O app abre o texto cadastrado daquele título.

O servidor recebe só os títulos do banco, nunca as respostas. Quando o banco muda, rode `node scripts/gerar-servidor.mjs` para atualizar `server/src/banco.js` e `server/src/dicas.js`.

## Limites (tudo gratuito)

| Limite | Valor | Onde mudar |
| --- | --- | --- |
| Perguntas interpretadas por aluno por dia | 20 | `IA_POR_ALUNO_DIA` em `server/wrangler.toml` |
| Perguntas interpretadas por dia, no total | 400 | `IA_TOTAL_DIA` |

O plano gratuito da Cloudflare dá uma cota diária de uso da IA (10 mil "neurons" por dia, algo como 400 a 500 perguntas). Passando dela, a Cloudflare não cobra nada no plano gratuito: a IA só para até o dia seguinte, e a SÁ segue com a busca do app. Não há cartão nem conta paga envolvidos.

Para ver o uso do dia, abra o endereço do servidor no navegador: ele mostra `perguntasHoje` e quantos aparelhos estão inscritos nas notificações.

## Passo a passo (uma vez só)

### 1. Conta na Cloudflare (grátis)

1. Crie a conta em https://dash.cloudflare.com/sign-up.
2. No menu da esquerda, abra **Workers e Pages** uma vez. Isso cria o seu endereço `….workers.dev`.
3. Copie o **Account ID** (ID da conta). Ele aparece na lateral direita de Workers e Pages, ou no menu de três pontinhos ao lado do nome da conta ("Copiar ID da conta").
4. Crie o token: ícone de perfil (canto superior direito) → **Meu perfil** → **Tokens de API** → **Criar token** → modelo **Editar Cloudflare Workers** → **Usar modelo**. Em *Permissões*, clique em **+ Adicionar mais** duas vezes e escolha:
   - **Conta** → **D1** → **Editar**
   - **Conta** → **Workers AI** → **Editar**

   Continue até **Criar token** e copie o token (ele só aparece uma vez).

### 2. Guardar as chaves no GitHub

No repositório `joaopersonal7-ui/jplate`: **Settings** → **Secrets and variables** → **Actions** → **New repository secret**. Crie dois segredos:

| Nome | Valor |
| --- | --- |
| `CLOUDFLARE_API_TOKEN` | o token do passo 1.4 |
| `CLOUDFLARE_ACCOUNT_ID` | o Account ID do passo 1.3 |

As chaves ficam só no GitHub. Elas nunca vão para dentro do app.

### 3. Publicar

1. Aprove o pedido de mudança (pull request) do servidor: **Merge pull request**.
2. **Actions** → **Publicar servidor (notificações e IA)** → **Run workflow**.

Em uns 2 minutos o GitHub cria o banco do servidor, publica o servidor, prepara o banco da SÁ na IA e grava o endereço do servidor no app (`src/config.js`), publicando uma versão nova do app. O resumo da execução mostra o endereço do servidor.

### 4. Testar no celular

1. Abra o JPlate e espere atualizar (feche e abra de novo se precisar).
2. **iPhone:** as notificações só funcionam com o app instalado pela tela de início (Compartilhar → Adicionar à Tela de Início), com iOS 16.4 ou mais novo. **Android:** funciona no Chrome.
3. Menu → **Notificações** → escolha o horário → **Ativar notificações** → permita. Depois toque em **Enviar teste**.
4. Na SÁ, escreva perguntas do jeito que um aluno escreveria, por exemplo "to sem fome de manhã, posso pular o café?" ou "quanto de agua tenho que beber". A SÁ mostra "Pensando…" e depois a resposta cadastrada.
5. Pergunte algo fora do banco, por exemplo "Kiwi tem vitamina C?". A SÁ responde que não tem a resposta cadastrada e indica a equipe.

## Dados

O servidor guarda só: o endereço de notificação de cada aparelho e o horário escolhido; um código aleatório do aparelho com a contagem de perguntas do dia. O texto da pergunta passa pela IA da Cloudflare para ser interpretado e não fica guardado. Diário, peso, perfil e foto nunca saem do aparelho.

## Para o desenvolvedor

- `server/src/index.js`: rotas (`GET /`, `GET /push/chave`, `POST /push/inscrever|cancelar|teste`, `POST /entender`) e o envio agendado (a cada 15 min, em lotes de 40).
- `server/src/entender.js`: interpretação (vetores dos títulos guardados no D1 e em memória, recalculados quando o banco muda; modelo de texto escolhe o número).
- `server/src/webpush.js`: Web Push sem bibliotecas (VAPID + aes128gcm). As chaves VAPID são criadas pelo próprio servidor na primeira vez e ficam no banco.
- `server/src/banco.js` e `server/src/dicas.js`: gerados por `node scripts/gerar-servidor.mjs`.
- Testes: `cd server && npm test`.
