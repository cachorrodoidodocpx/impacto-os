# Impacto OS

Painel simples para a Impacto cadastrar pedidos, acompanhar a produção (corte → costura →
silk → revisão → embalagem → pronto) e gerar um link individual para cada cliente
acompanhar o próprio pedido — do jeito que você pediu, baseado no que a Custom Stamp faz.

Duas telas:

- **Painel admin** (`/admin`) — só você acessa, com login e senha. Cadastra pedidos, marca
  como pago, avança etapas, edita dados, configura a chave Pix.
- **Página do cliente** (`/acompanhar/um-codigo-unico`) — pública, sem login. Cada pedido
  tem seu próprio link. O cliente só vê o pedido dele, nada de outros clientes ou do painel.

Não usa banco de dados externo nem serviço pago: os dados ficam num arquivo `.json` dentro
do próprio projeto. Isso torna o deploy mais simples (sem precisar configurar Postgres/MySQL),
mas exige um "Volume" no Railway para os dados não se perderem a cada novo deploy — está
tudo explicado no passo a passo abaixo.

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
   (ou "Avançar etapa"). O link dela já atualiza sozinho.
6. Conforme a peça vai passando pela produção, você só vai no pedido dela e clica em
   **Avançar etapa** (Corte → Costura → Silk → Revisão → Embalagem → Pronto). O cliente
   acompanha tudo em tempo real, sem precisar te perguntar "já ficou pronto?".

---

## Rodar no seu computador (opcional, antes de publicar)

Só precisa disso se você quiser testar antes de colocar no ar. Requer o
[Node.js](https://nodejs.org) instalado (versão 18 ou mais recente).

```bash
cd impacto-os
cp .env.example .env
npm install
npm start
```

Depois é só abrir `http://localhost:3000` no navegador. O usuário/senha padrão de teste são
os que estiverem no seu `.env` (por padrão `admin` / `troque-esta-senha`).

---

## Passo 1 — Subir para o GitHub

1. Crie um repositório novo e **vazio** no GitHub (sem README, sem .gitignore — o projeto
   já vem com o dele).
2. Dentro da pasta `impacto-os`, rode:

```bash
git init
git add .
git commit -m "Impacto OS - versao inicial"
git branch -M main
git remote add origin https://github.com/SEU-USUARIO/SEU-REPOSITORIO.git
git push -u origin main
```

O arquivo `.gitignore` já está configurado para não subir o `node_modules` nem o arquivo de
dados local (`data/db.json`) — isso é esperado e correto.

---

## Passo 2 — Deploy no Railway

1. Entre em [railway.app](https://railway.app) e crie um novo projeto: **New Project → Deploy
   from GitHub repo** → selecione o repositório que você acabou de criar.
2. O Railway vai detectar automaticamente que é um projeto Node.js (o arquivo `railway.json`
   já deixa o comando de start configurado: `npm start`). Ele vai tentar fazer o primeiro
   deploy sozinho — mas antes de funcionar direito, faça os passos 3 e 4 abaixo.
3. **Configurar as variáveis de ambiente.** No serviço criado, vá em **Variables** e adicione:

   | Variável          | Valor sugerido                                   |
   |-------------------|---------------------------------------------------|
   | `ADMIN_USERNAME`  | um usuário só seu, ex: `impacto`                  |
   | `ADMIN_PASSWORD`  | uma senha forte, só sua                           |
   | `SESSION_SECRET`  | qualquer frase longa e aleatória                  |
   | `NODE_ENV`        | `production`                                       |
   | `DATA_FILE`       | `/app/data/db.json`                                |

   **Importante:** troque `ADMIN_USERNAME` e `ADMIN_PASSWORD` para algo só seu antes de
   divulgar o link do app. Se essas variáveis não forem definidas, o sistema usa um login
   padrão (`admin` / `impacto123`) que não é seguro para produção.

4. **Adicionar um Volume (para os pedidos não sumirem a cada deploy).** Ainda no serviço,
   vá em **Settings → Volumes → New Volume**. Configure o **Mount path** exatamente como
   `/app/data`. Isso cria um espaço de armazenamento permanente, e é para lá que o arquivo
   `db.json` (definido na variável `DATA_FILE` acima) vai ser salvo.

   > Sem esse Volume o app funciona normalmente, só que toda vez que você fizer um novo
   > deploy (ex: uma atualização de código no futuro) os pedidos cadastrados seriam
   > apagados. Com o Volume, eles ficam salvos para sempre.

5. Vá em **Settings → Networking → Generate Domain** para gerar a URL pública do seu app
   (algo como `impacto-os-production.up.railway.app`). É esse domínio que vai aparecer nos
   links `/acompanhar/...` que você manda pros clientes.
6. Faça um **redeploy** (Railway costuma fazer isso automaticamente ao salvar variáveis
   novas; se não fizer, use o botão **Redeploy** no painel do serviço).
7. Acesse `https://seu-dominio.up.railway.app/login` e entre com o usuário e senha que você
   configurou no passo 3.

Pronto — o sistema está no ar. Daqui pra frente, qualquer atualização de código que você
fizer (`git push`) o Railway já publica sozinho.

---

## Configurações dentro do painel

Depois de logar, vá em **Configurações** para preencher:

- **Chave Pix** (e opcionalmente o nome do titular) — isso aparece automaticamente na
  página do cliente enquanto o pedido estiver "Aguardando pagamento".
- **WhatsApp de suporte** e um **recado** opcional que aparece no rodapé do link do cliente.

---

## Estrutura do projeto

```
impacto-os/
├── src/
│   ├── server.js         # Servidor Express
│   ├── db.js             # Leitura/escrita do banco (arquivo JSON)
│   ├── auth.js           # Login do admin
│   ├── stages.js         # Lista das etapas de produção (fácil de editar)
│   ├── routes/
│   │   ├── auth.js        # /login, /logout
│   │   ├── public.js      # /acompanhar/:id (página do cliente)
│   │   └── admin.js       # /admin/* (painel protegido por login)
│   ├── views/             # Páginas (EJS)
│   └── public/            # CSS e JS que o navegador carrega
├── data/                  # Onde o db.json fica localmente (ignorado pelo git)
├── package.json
├── railway.json
└── .env.example
```

Quer mudar o nome ou a ordem das etapas de produção? É só editar o arquivo
`src/stages.js` — o resto do sistema (painel e página do cliente) se ajusta sozinho.

---

## Limitações conhecidas (e ideias para depois)

- O banco de dados é um arquivo `.json` simples — ótimo para o volume de pedidos de uma
  confecção, mas não é o ideal se um dia você precisar de múltiplos usuários admin
  digitando ao mesmo tempo em alta frequência. Se a Impacto crescer muito, dá pra migrar
  para um banco de verdade (Postgres) depois.
- Não existe upload de comprovante de Pix dentro do sistema — a confirmação de pagamento
  continua manual (o cliente manda o comprovante pelo WhatsApp e você marca "Pago" no
  painel), exatamente como você descreveu que já funciona hoje.
- Um cadastro de clientes recorrentes (histórico de pedidos por pessoa) não foi incluído
  agora, mas é uma extensão natural do sistema se fizer sentido no futuro.
