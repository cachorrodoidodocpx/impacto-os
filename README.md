# Impacto OS

Painel simples para a Impacto cadastrar pedidos, acompanhar a produção (corte → costura →
silk → revisão → embalagem → pronto) e gerar um link individual para cada cliente
acompanhar o próprio pedido.

Telas principais:

- **Painel admin** (`/admin`) — login e senha próprios. Cadastra pedidos, marca como pago,
  avança etapas, edita dados, configura a chave Pix, vê o faturamento do mês, exporta os
  pedidos em CSV e gerencia quem mais tem acesso ao painel.
- **Página do cliente** (`/acompanhar/um-codigo-unico`) — pública, sem login. Cada pedido
  tem seu próprio link. O cliente só vê o pedido dele, nada de outros clientes ou do painel.

Os dados ficam num banco **Postgres** (criado direto no Railway, em poucos cliques).

---

## Novidades desta atualização

Se você já estava usando a versão com Postgres, aqui vai o que mudou:

1. **Resumo do mês** — logo no topo do painel aparece quanto já entrou (soma dos pedidos
   marcados como "Pago" dentro do mês atual) e um botão pra baixar todos os pedidos em CSV
   (abre certinho no Excel, com acentos e tudo).
2. **Mais de um usuário** — agora dá pra cadastrar outros logins direto pelo painel, em
   **Usuários**, sem precisar mexer em nada no Railway. Cada um com seu próprio
   usuário/senha.

> **Importante sobre login:** a partir desta atualização, `ADMIN_USERNAME` e
> `ADMIN_PASSWORD` (as variáveis do Railway) só servem pra criar o **primeiro** usuário, na
> primeira vez que o sistema ligar com o banco novo. Isso acontece automaticamente e não
> muda nada pra você: seu login atual continua funcionando igual. Só que, **depois disso**,
> se quiser trocar sua senha ou adicionar/remover alguém, isso passa a ser feito ali dentro
> do painel, na tela **Usuários** — mudar a variável no Railway não vai ter mais efeito.

Pra aplicar esta atualização no seu projeto:

1. Extraia este novo zip e copie os arquivos pra **dentro da mesma pasta** do projeto que
   você já tem (a que já contém a pasta oculta `.git`) — pode sobrescrever quando o Windows
   perguntar.
2. No terminal, dentro da pasta do projeto, rode cada linha separadamente:

   ```
   git add .
   git commit -m "Resumo do mes, exportar CSV e multiplos usuarios"
   git push
   ```

3. O Railway detecta o push e publica sozinho. Depois de uns segundos, acesse o painel de
   novo — seu login de sempre continua funcionando.

---

## Como funciona no dia a dia

1. Julia chega na loja e pede 2 Conjuntos Run na cor Divino.
2. Você entra no painel (`/admin`) → **Novo pedido** → preenche nome, WhatsApp (opcional),
   o pedido, a descrição (cada peça, tamanho e ajuste), o valor total e o prazo → confirma.
3. O sistema gera um link único, por exemplo:
   `https://seu-app.up.railway.app/acompanhar/39814c14-...`
4. Você copia esse link (tem um botão pra isso) e manda pro WhatsApp da Julia — tem até um
   botão "Enviar no WhatsApp" que já monta a mensagem com o link e a chave Pix.
5. Julia paga o Pix e manda o comprovante pra você. Você vai no painel e clica em **Pago**
   (ou "Avançar etapa"). O link dela já atualiza sozinho, e o valor entra automaticamente no
   resumo do mês.
6. Conforme a peça vai passando pela produção, você só vai no pedido dela e clica em
   **Avançar etapa** (Corte → Costura → Silk → Revisão → Embalagem → Pronto). O cliente
   acompanha tudo em tempo real, sem precisar te perguntar "já ficou pronto?".

---

## Rodar no seu computador (opcional)

Precisa de um Postgres pra se conectar, mesmo que seja um teste rápido. Se preferir, pule
direto pro deploy no Railway (seção abaixo) e teste tudo já publicado, é mais simples.

Se ainda assim quiser testar localmente, a forma mais fácil é usar o próprio Postgres do
Railway: na aba **Connect** do serviço Postgres, copie a URL de conexão pública e cole na
variável `DATABASE_URL` do seu `.env`. Depois:

```
cd impacto-os
cp .env.example .env
npm install
npm start
```

Abra `http://localhost:3000`. No primeiríssimo uso (banco vazio), o usuário/senha são os
que estiverem no seu `.env`; depois disso, use a tela **Usuários** pra gerenciar os logins.

---

## Passo 1 — Subir para o GitHub

Pule este passo se seu projeto já está no GitHub.

1. Crie um repositório novo e **vazio** no GitHub (sem README, sem .gitignore — o projeto
   já vem com o dele).
2. Dentro da pasta `impacto-os`, no terminal, rode cada linha separadamente (aperte Enter
   depois de cada uma):

   ```
   git init
   git add .
   git commit -m "Impacto OS - versao inicial"
   git branch -M main
   git remote add origin https://github.com/SEU-USUARIO/SEU-REPOSITORIO.git
   git push -u origin main
   ```

---

## Passo 2 — Deploy no Railway

1. Entre em [railway.app](https://railway.app) e crie um novo projeto: **New Project → Deploy
   from GitHub repo** → selecione o repositório que você criou. (Se o projeto já existe,
   pule para o item 2.)

2. **Adicionar o banco Postgres.** Dentro do mesmo projeto no Railway, clique em **+ New**
   → **Database** → **Add PostgreSQL**. Isso cria um segundo serviço, só pro banco de
   dados, dentro do mesmo projeto.

3. **Conectar o app ao banco.** Clique no serviço do seu app (o Impacto OS, não o
   Postgres) → aba **Variables** → **+ New Variable**. Procure a opção de referenciar uma
   variável de outro serviço (geralmente aparece como **"Add Reference"** ou um ícone de
   link) → selecione o serviço **Postgres** → variável **`DATABASE_URL`**.

   > Se não encontrar essa opção, o caminho manual funciona igual: abra o serviço
   > **Postgres** → aba **Variables** → copie o valor de `DATABASE_URL` → volte no serviço
   > do app → aba **Variables** → crie uma variável de mesmo nome e cole o valor copiado.

4. **Configurar as demais variáveis.** Ainda no serviço do app, em **Variables**, adicione:

   | Variável          | Valor sugerido                                   |
   |-------------------|---------------------------------------------------|
   | `ADMIN_USERNAME`  | um usuário só seu, ex: `impacto`                  |
   | `ADMIN_PASSWORD`  | uma senha forte, só sua                           |
   | `SESSION_SECRET`  | qualquer frase longa e aleatória                  |
   | `NODE_ENV`        | `production`                                       |

   Lembre-se: essas duas primeiras só valem pra criar o usuário inicial (veja a seção
   "Novidades desta atualização" no topo).

5. Vá em **Settings → Networking → Generate Domain** (no serviço do app) para gerar a URL
   pública. É esse domínio que aparece nos links `/acompanhar/...` que você manda pros
   clientes.

6. Faça um **redeploy** do serviço do app, se ele não fizer sozinho.

7. Acesse `https://seu-dominio.up.railway.app/login` e entre com o usuário e senha do
   passo 4.

Não é preciso criar nenhum Volume — o Postgres já guarda os dados para sempre por conta
própria.

---

## Dentro do painel

- **Configurações** — chave Pix (e nome do titular, opcional), WhatsApp de suporte e um
  recado opcional que aparece no rodapé do link do cliente.
- **Usuários** — cadastra ou remove quem tem acesso ao painel. Sempre precisa sobrar pelo
  menos um usuário, e você não consegue remover a si mesmo enquanto estiver logado (pra
  evitar ficar trancado pra fora sem querer).
- **Resumo do mês** (topo da lista de pedidos) — soma de tudo que foi marcado como "Pago"
  dentro do mês corrente. Pedidos cancelados não entram na conta, mesmo que já tivessem
  sido pagos antes.
- **Baixar pedidos (CSV)** — exporta todos os pedidos (cliente, valor, status, datas, link)
  num arquivo que abre direto no Excel, útil como backup ou pra levar pro seu contador.

---

## Estrutura do projeto

```
impacto-os/
├── src/
│   ├── server.js         # Servidor Express (prepara o banco e sobe o app)
│   ├── db.js             # Todas as consultas ao Postgres
│   ├── auth.js           # Confere usuário/senha contra o banco
│   ├── passwords.js       # Hash/verificação de senha (só com o crypto nativo do Node)
│   ├── asyncHandler.js   # Utilitário pra capturar erros das rotas assíncronas
│   ├── stages.js         # Lista das etapas de produção (fácil de editar)
│   ├── routes/
│   │   ├── auth.js        # /login, /logout
│   │   ├── public.js      # /acompanhar/:id (página do cliente)
│   │   └── admin.js       # /admin/* (painel, exportação CSV, usuários)
│   ├── views/             # Páginas (EJS)
│   └── public/            # CSS e JS que o navegador carrega
├── package.json
├── railway.json
└── .env.example
```

Quer mudar o nome ou a ordem das etapas de produção? É só editar o arquivo
`src/stages.js` — o resto do sistema (painel e página do cliente) se ajusta sozinho.

---

## Limitações conhecidas (e ideias para depois)

- Não existe upload de comprovante de Pix dentro do sistema — a confirmação de pagamento
  continua manual (o cliente manda o comprovante pelo WhatsApp e você marca "Pago" no
  painel), exatamente como você descreveu que já funciona hoje.
- Um cadastro de clientes recorrentes (histórico de pedidos por pessoa) não foi incluído
  agora, mas é uma extensão natural do sistema se fizer sentido no futuro.
- Todos os usuários cadastrados em **Usuários** têm o mesmo nível de acesso (não existe
  ainda um perfil "só visualizar" ou permissões separadas por pessoa).
