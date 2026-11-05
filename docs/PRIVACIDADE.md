# Deixar o JPlate privado

Objetivo: o código e o banco da SÁ deixam de ficar à mostra no GitHub, e o app só abre para quem você autorizar (login por e-mail).

## O que está exposto hoje

| O quê | Hoje | Depois |
|---|---|---|
| Código e banco da SÁ (`src/kb-*.js`, FAQ, equivalências, parâmetros da dieta) | Qualquer pessoa lê no GitHub, com todo o histórico | Repositório privado |
| Site `joaopersonal7-ui.github.io/jplate` | Abre para qualquer pessoa, que pode baixar todos os arquivos, inclusive o banco da SÁ | Desligado. O app passa a morar no Cloudflare Pages, atrás de login (Cloudflare Access) |
| Servidor (notificações e IA) | Endereço público `…workers.dev`: qualquer um pode chamar e gastar a cota diária da IA | Sem endereço público. Só responde ao site protegido, pelo caminho interno `/api` |
| Dados dos alunos (diário, peso, perfil, foto) | Ficam só no celular de cada um. Não existem no servidor nem no GitHub | Igual |
| Banco do servidor (Cloudflare D1) | Não tem acesso pela internet. Guarda só inscrições de notificação, um código aleatório por aparelho e a contagem de perguntas do dia. Nenhum nome, nenhum diário | Igual |
| Senhas e tokens | Ficam nos segredos do GitHub (não aparecem no código) | Igual |

Por que não só "tornar privado": no plano grátis do GitHub, repositório privado desliga o GitHub Pages. Nos planos pagos (Pro, Team) o Pages volta, mas o site continua aberto para qualquer pessoa. Só o Enterprise fecha o site com login. Por isso o app vai para o Cloudflare Pages com Cloudflare Access, que é grátis até 50 pessoas.

Limite honesto: quem você autorizar consegue ver o banco da SÁ, porque o app precisa baixá-lo para funcionar sem internet. O login impede todo o resto do mundo.

## Passo a passo

### 1. Dar ao token da Cloudflare a permissão do Pages

O mesmo token que publica o servidor publica o site.

1. [dash.cloudflare.com](https://dash.cloudflare.com) → ícone de perfil (canto superior direito) → **Meu perfil** → **Tokens de API**.
2. No token do JPlate, clique em **…** → **Editar**.
3. Em *Permissões*, **+ Adicionar mais** → **Conta** → **Cloudflare Pages** → **Editar**.
4. **Continuar para o resumo** → **Atualizar token**. O valor do token não muda; não precisa mexer no GitHub.

### 2. Publicar o site novo

Ao juntar o pull request no `main`, o GitHub Actions roda **Publicar site protegido (Cloudflare Pages)**. Ele cria o projeto `jplate` e publica o app.

Em **Actions** → a execução → *Summary* aparece o endereço (normalmente `https://jplate.pages.dev`; se o nome estiver ocupado, a Cloudflare acrescenta letras). Nesse momento o endereço ainda abre sem login: não divulgue.

### 3. Ativar o Zero Trust (uma vez)

1. No painel da Cloudflare, menu lateral → **Zero Trust**.
2. Escolha um nome de equipe (ex.: `consultoriajp`) e o plano **Free** (até 50 usuários). A Cloudflare pode pedir um cartão, mas o plano Free não cobra.

### 4. Colocar login no site (Cloudflare Access)

1. Zero Trust → **Access** → **Applications** → **Add an application** → **Self-hosted**.
2. Nome: `JPlate`. **Session duration**: `1 month` (assim o app quase não pede login de novo).
3. Domínios (**+ Add public hostname** duas vezes):
   - `jplate.pages.dev` (o endereço do passo 2);
   - `*.jplate.pages.dev` (cada publicação também ganha um endereço próprio; o `*` fecha todos eles).
4. Política: nome `Alunos`, ação **Allow**, *Include* → **Emails** → digite o seu e-mail e o de cada aluno.
5. Login: **One-time PIN** (a pessoa digita o e-mail e recebe um código). Salve.

Teste numa aba anônima: o endereço deve mostrar a tela de login da Cloudflare. Entre com o seu e-mail, abra a SÁ e faça uma pergunta livre para conferir que a IA responde.

Para incluir ou tirar um aluno depois: Access → Applications → JPlate → política `Alunos` → editar a lista de e-mails.

### 5. Avisar os alunos

Em **Actions** → **Publicar site protegido (Cloudflare Pages)** → **Run workflow**. Agora que o endereço pede login, o workflow grava o endereço novo no app, e a cópia antiga (GitHub Pages) passa a mostrar no Diário o aviso "O JPlate mudou de endereço", com o botão **Exportar backup** e o link do endereço novo.

Os dados de cada aluno ficam presos ao endereço antigo no celular, então cada um precisa: exportar o backup no app antigo, abrir o endereço novo, entrar com o e-mail, instalar na tela inicial e importar o backup. Dê alguns dias para todos fazerem isso.

### 6. Fechar o servidor

Depois que os alunos migrarem, peça para o Claude "fechar o endereço público do servidor". A mudança é `workers_dev = false` em `server/wrangler.toml`: o servidor deixa de ter endereço na internet e só atende o site protegido. O app antigo perde as notificações e a IA nessa hora.

### 7. Tornar o repositório privado

1. GitHub → repositório `jplate` → **Settings** → **General** → no fim, **Danger Zone** → **Change repository visibility** → **Make private** e confirme.
2. O site antigo `joaopersonal7-ui.github.io/jplate` sai do ar sozinho.
3. O GitHub Actions continua funcionando (2.000 minutos por mês grátis em repositório privado; o JPlate usa poucos).

Antes, veja em **Insights** → **Forks** se alguém copiou o repositório. Cópias feitas enquanto ele era público continuam com quem copiou; isso não dá para desfazer.

### 8. Proteger as contas

Quem entra na sua conta do GitHub ou da Cloudflare vê tudo. Ative a verificação em duas etapas nas duas (GitHub: Settings → Password and authentication; Cloudflare: Meu perfil → Autenticação).
