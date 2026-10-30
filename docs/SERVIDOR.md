# Servidor do JPlate: dica do dia e IA da SÁ

O app continua offline e guarda o diário só no aparelho. O servidor (pasta `server/`) faz duas coisas:

1. **Dica do dia por notificação.** O aluno escolhe o horário em *Notificações* (menu). Todo dia chega uma dica tirada dos 50 conceitos do banco da SÁ; tocar nela abre a explicação completa na SÁ.
2. **IA de reserva da SÁ.** A SÁ procura primeiro no banco dela. A IA (Claude Haiku 5.5) só é chamada quando:
   - a SÁ não tem resposta cadastrada (automático), ou
   - o aluno toca em "Não era isso? Perguntar à IA" embaixo de uma resposta do banco.

   Temas de saúde e respostas em conflito nunca vão para a IA. Toda resposta da IA aparece marcada como **"Resposta da IA"**, com o aviso de que não faz parte do banco da JP COMPANY.

## Limites de gasto

| Limite | Valor | Onde mudar |
| --- | --- | --- |
| Perguntas à IA por aluno por dia | 10 | `IA_POR_ALUNO_DIA` em `server/wrangler.toml` |
| Perguntas à IA por dia, no total | 500 | `IA_TOTAL_DIA` |
| Teto de gasto por mês | US$ 5 | `IA_TETO_MES_USD` |

Pergunta fora de nutrição recebe uma resposta padrão e não gasta a cota do aluno. Ao chegar no teto do mês, a IA para e a SÁ segue só com o banco até o mês seguinte. Respostas da IA têm no máximo cerca de 120 palavras.

Custo estimado: cerca de US$ 0,0001 por pergunta (400 tokens de entrada e 100 de saída a US$ 0,10 e US$ 0,50 por milhão). O servidor e as notificações ficam no plano gratuito da Cloudflare.

Para ver o gasto do mês, abra o endereço do servidor no navegador: ele mostra `iaMes` (US$ gastos, perguntas e teto).

## Passo a passo (uma vez só)

### 1. Conta na Cloudflare (grátis)

1. Crie a conta em https://dash.cloudflare.com/sign-up.
2. No menu da esquerda, abra **Compute (Workers)** → **Workers e Pages** uma vez. Isso cria o seu endereço `….workers.dev`.
3. Copie o **Account ID**: ele aparece na página inicial da conta, no menu dos três pontinhos ao lado do nome da conta ("Copiar ID da conta"), ou na lateral direita de Workers e Pages.
4. Crie o token: clique no ícone de perfil (canto superior direito) → **Meu perfil** → **Tokens de API** → **Criar token** → modelo **Editar Cloudflare Workers** → **Usar modelo**. Em *Permissões*, clique em **+ Adicionar mais** e escolha **Conta** → **D1** → **Editar**. Continue até **Criar token** e copie o token (ele só aparece uma vez).

### 2. Conta na Anthropic (IA, paga por uso)

1. Crie a conta em https://platform.claude.com e adicione um cartão em **Billing** (dá para começar com US$ 5 de crédito).
2. Em **Limits**, coloque um limite de gasto mensal (por exemplo US$ 5). É uma segunda trava, além do teto do servidor.
3. Em **API Keys**, crie uma chave chamada "JPlate" e copie.

A IA é opcional: sem essa chave, o servidor envia só as notificações.

### 3. Guardar as chaves no GitHub

No repositório `joaopersonal7-ui/jplate`: **Settings** → **Secrets and variables** → **Actions** → **New repository secret**. Crie três segredos:

| Nome | Valor |
| --- | --- |
| `CLOUDFLARE_API_TOKEN` | o token do passo 1.4 |
| `CLOUDFLARE_ACCOUNT_ID` | o Account ID do passo 1.3 |
| `ANTHROPIC_API_KEY` | a chave do passo 2.3 |

As chaves ficam só no GitHub e no servidor. Elas nunca vão para dentro do app.

### 4. Publicar

**Actions** → **Publicar servidor (notificações e IA)** → **Run workflow**. Em uns 2 minutos o GitHub:

- cria o banco do servidor na Cloudflare;
- publica o servidor e guarda a chave da IA nele;
- grava o endereço do servidor no app (`src/config.js`) e publica uma versão nova do app.

O resumo da execução mostra o endereço do servidor.

### 5. Testar no celular

1. Abra o JPlate e espere atualizar (feche e abra de novo se precisar).
2. **iPhone:** as notificações só funcionam com o app instalado pela tela de início (Compartilhar → Adicionar à Tela de Início), com iOS 16.4 ou mais novo. **Android:** funciona no Chrome, instalado ou não.
3. Menu → **Notificações** → escolha o horário → **Ativar notificações** → permita. Depois toque em **Enviar teste**.
4. Na SÁ, pergunte "Açaí na tigela pode?". Depois da frase "Não tenho uma resposta cadastrada…", aparece a resposta marcada **"Resposta da IA"**.
5. Pergunte "Kiwi tem vitamina C?". A SÁ responde pelo banco (sobre vitamina C e resfriado); toque em **"Não era isso? Perguntar à IA"** para ver a IA responder a pergunta exata.

## Dados

O servidor guarda só: o endereço de notificação de cada aparelho e o horário escolhido; um código aleatório do aparelho com a contagem de perguntas à IA do dia; e o total gasto no mês. O texto da pergunta vai para a IA da Anthropic e não fica guardado no servidor. Diário, peso, perfil e foto nunca saem do aparelho.

## Para o desenvolvedor

- `server/src/index.js`: rotas (`GET /`, `GET /push/chave`, `POST /push/inscrever|cancelar|teste`, `POST /ia`) e o envio agendado (a cada 15 min, em lotes de 40).
- `server/src/webpush.js`: Web Push sem bibliotecas (VAPID + aes128gcm). As chaves VAPID são criadas pelo próprio servidor na primeira vez e ficam no banco.
- `server/src/ia.js`: chamada ao Claude e regras da IA.
- `server/src/dicas.js`: gerado por `node scripts/dicas-from-kb.mjs` a partir de `src/kb-conceitos.js`.
- Testes: `cd server && npm test`.
