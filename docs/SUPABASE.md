# Ativar o banco e o login

O código já contém a integração com Supabase. Criar o projeto, executar o SQL e configurar a Vercel são etapas externas: enviar o código ao GitHub não cria um banco remoto.

## 1. Criar o projeto Supabase

1. Em https://supabase.com/dashboard, crie um projeto na sua organização.
2. Defina e guarde uma senha forte para o banco. O aplicativo não precisa receber essa senha.
3. Aguarde o projeto ficar disponível.
4. Abra **SQL Editor → New query**. Cole e execute todo o arquivo [202610140001_study_workspaces.sql](../supabase/migrations/202610140001_study_workspaces.sql).

O SQL cria `public.study_workspaces` e a função `public.save_study_workspace`. Pode ser executado novamente sem apagar os dados existentes. Ele pressupõe a estrutura padrão de autenticação do Supabase (`auth.users`, `auth.uid()` e os papéis `anon`/`authenticated`).

## 2. Configurar login por e-mail

Em **Authentication**, habilite o provedor **Email** e o cadastro de novos usuários.

Em **URL Configuration**:

- **Site URL**: o endereço HTTPS real do seu app na Vercel.
- **Redirect URLs**: inclua o endereço exato usado para abrir o app (incluindo a barra final quando utilizada). Inclua `http://localhost:5173/` apenas se for testar localmente.

O app tem criação de conta, confirmação por e-mail, login, logout, pedido de recuperação e formulário de nova senha ao abrir o link de recuperação. Com confirmação habilitada, é necessário clicar no e-mail de confirmação antes de entrar. O envio de e-mails usa a configuração do projeto Supabase.

## 3. Configurar a Vercel

No projeto Vercel, abra **Settings → Environment Variables** e adicione:

| Nome | Valor |
| --- | --- |
| `VITE_SUPABASE_URL` | Project URL, por exemplo `https://seu-projeto.supabase.co` |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Publishable key (`sb_publishable_…`) ou a chave legada `anon` |

Você encontra esses valores em **Project Settings / Connect → API Keys / Data API**, conforme a interface do Supabase. A URL e a chave pública identificam o projeto; a proteção dos dados está no login e nas regras do SQL.

**Nunca use `service_role`, `sb_secret_…`, senha do PostgreSQL ou connection string em uma variável `VITE_`.** Variáveis com esse prefixo entram no JavaScript público do site.

Selecione os ambientes em que o app será usado e faça um **novo build/deploy da branch `main`**. Como o Vite incorpora essas variáveis no build, alterar apenas as variáveis sem reconstruir o app não ativa a conexão.

Sem as duas variáveis, o app continua no modo local, preservando os registros. Com apenas uma variável ou uma configuração inválida, ele mostra uma tela de conexão pendente.

## 4. Transferir os registros existentes

1. Abra o endereço original do app no mesmo navegador e perfil em que você estudava.
2. Crie e confirme sua conta e faça login.
3. Se a conta ainda não tiver dados, o app oferece **Transferir meus registros para minha conta** ou **Começar com um novo cronograma**.
4. Escolha transferir somente se os registros encontrados forem seus. A cópia local original é preservada, sem migração automática para outras contas.
5. Aguarde **Salvo na sua conta**. Abra o app em outro dispositivo e entre com o mesmo e-mail para verificar os registros.

Dados de `localStorage` pertencem a um endereço específico. Se você mudou de domínio ou URL de preview, abra a versão antiga e exporte o backup; depois importe-o em **Configurações** no endereço novo, após entrar na conta desejada. Importar substitui os dados da conta atual, então exporte uma cópia antes.

## Como os dados são salvos

Cada conta tem uma linha com o estado de estudos em JSONB: matérias, sessões, simulados, cronograma e preferências. Isso mantém a conclusão de um estudo, o desempenho e a criação da revisão em uma única gravação atômica. É compatível com os backups atuais, sem redesenhar o histórico existente.

- A chave `user_id` referencia `auth.users` e é protegida por Row Level Security para leitura.
- Escritas só são permitidas pela função RPC, que verifica `auth.uid()` e o usuário solicitado.
- A função exige a revisão atual do registro e incrementa a versão: uma aba antiga não sobrescreve silenciosamente outra.
- O cliente guarda primeiro uma cópia por usuário neste dispositivo e serializa as gravações na nuvem.
- Falhas mostram um aviso e mantêm alterações pendentes. É possível tentar novamente ou exportar a cópia. Se a página for recarregada, a versão pendente só é reenviada se a revisão no banco ainda for a mesma.
- Conflitos exigem escolha explícita: exporte a cópia local e carregue a versão do banco. A cópia pendente também é preservada localmente em uma chave de backup de conflito. O app não mistura automaticamente resultados e cronogramas divergentes.
- Para atualizar um dispositivo que ficou aberto enquanto outro foi usado, recarregue a página quando não houver alterações pendentes. Não há atualização em tempo real de todas as abas.
- Ao sair, outra conta não recebe o cache privado da conta anterior. O salvamento também valida o identificador do usuário no servidor, inclusive em trocas de sessão.

## Desenvolvimento e verificação

Copie `.env.example` para `.env.local` e preencha somente a URL e a chave pública do seu projeto. Esse arquivo é ignorado pelo Git. Reinicie o Vite após alterar as variáveis.

```sh
npm ci
npm test
npm run build
npm run dev -- --port 5173
```

Os testes executam a migração em um PostgreSQL local via PGlite, simulando o esquema de autenticação do Supabase. Verificam isolamento entre usuários, acesso anônimo negado, escrita atômica, conflitos de revisão e preservação de dados em erros. Isso valida a lógica SQL; não comprova que o seu projeto Supabase remoto e o envio de e-mails já estejam configurados. Depois da ativação, valide cadastro, confirmação de e-mail, login, transferência e acesso em um segundo dispositivo no ambiente real.
