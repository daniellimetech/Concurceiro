# Concurceiro

Aplicativo em português para acompanhar a preparação para concursos.

## Desenvolvimento

Requer Node.js 22 ou superior e npm.

```sh
npm ci
npm run dev -- --port 5173
```

## Build

```sh
npm run build
npm run preview -- --port 4173
```

## Funcionalidades

- Painel com tempo acumulado, questões resolvidas, taxa de acertos e atividade dos últimos sete dias.
- Cadastro de matérias e desempenho por matéria.
- Registro de sessões com duração, questões, acertos e observações.
- Cronograma com data, horário, duração e marcação de conclusão.
- Histórico de resultados de simulados por matéria.
- Exportação e importação de backup JSON em Configurações.

O app suporta banco PostgreSQL e login via Supabase. Consulte [Ativar banco e login](docs/SUPABASE.md) para criar o projeto, executar o SQL e configurar a Vercel. Sem essa configuração, os dados continuam apenas no `localStorage` do navegador. No modo conectado, cada conta tem seus próprios registros e o app mantém uma cópia local por usuário para preservar alterações pendentes. Exporte backups regularmente. Importar um backup substitui os registros atuais.

As matérias iniciais são sugestões editáveis; nenhuma sessão ou resultado fictício é incluído. Ao concluir um agendamento, informe o tempo, as questões e os acertos: o resultado é registrado automaticamente no desempenho, sem precisar registrar a mesma sessão novamente.


## Cronograma e revisões espaçadas

Na primeira abertura desta versão, o app cria quatro semanas de estudos, preservando os dados anteriores e os horários já ocupados. A geração pode ser ampliada na aba Cronograma, com início e número de semanas selecionáveis; gerar novamente o mesmo período não duplica horários.

- Segunda e quarta: estudos novos às 16h30 e 17h30; revisões das 18h30 às 19h30.
- Terça, quinta e sexta: estudo novo às 16h30; revisões das 17h30 às 18h30.
- Cada estudo: 35 minutos de videoaula, 10 de revisão ativa e 15 de questões.
- Distribuição por matéria proporcional a `questões × peso` do edital, com rotação para incluir as matérias de menor prioridade. É uma heurística de planejamento; não representa a fórmula oficial de pontuação.

Apenas **Concluir e salvar resultado** gera a próxima etapa: estudo → +1 dia (10 questões) → +7 dias (revisão ativa + 10 questões) → +30 dias (revisão ativa + 10 questões). O último passo encerra o ciclo. Os intervalos são em dias de calendário a partir da **conclusão real da etapa anterior**, no fuso de Brasília. Não são três revisões geradas de uma vez. Exemplo: revisão de 24h com data-alvo em 20/10 e realizada em 24/10 gera a próxima data-alvo em 31/10; como é sábado, o horário é reservado na segunda, 02/11, conforme disponibilidade.

Por padrão, revisões de fim de semana vão para o próximo dia de segunda a sexta. Feriados não são tratados separadamente. Revisão de 24h ocupa 15 minutos; de 7/30 dias ocupa 25 minutos. Essas preferências podem ser ajustadas na aba Cronograma e valem para as próximas revisões geradas.

A alocação respeita a hora diária de revisão e agendamentos existentes. Se não houver espaço, usa o primeiro dia com um espaço livre e mostra a data-alvo original. Uma etapa em atraso continua pendente; não avança o ciclo sozinha. Atividades passam a aparecer em vermelho após o fim do horário planejado. Avisos são internos ao app, sem notificações push ou envio de mensagens. Etapas concluídas ficam no histórico; não há botão de conclusão reversível que possa duplicar revisões.

Agendamentos avulsos podem ser criados sem iniciar ciclos. Cada novo estudo possui um ciclo independente, com o tópico informado na conclusão, para distinguir conteúdos da mesma matéria.

## Testes

```sh
npm test
```

Os testes de lógica cobrem geração proporcional, horários, preservação de registros, repetição de geração/conclusão, encadeamento com atraso real, fim de semana, capacidade da hora de revisões, fuso horário e validação dos resultados.

## Cronômetro e timer

A aba **Foco** tem dois controles independentes, que podem ser usados ao mesmo tempo:

- **Cronômetro:** mede o tempo efetivamente estudado, descontando pausas. Escolha a matéria antes de iniciar. Use **Salvar tempo estudado** para registrar o resultado; nada é somado automaticamente só por deixar o relógio rodar. O registro guarda segundos inteiros em `durationSeconds` e minutos proporcionais em `minutes`, preservando a precisão do desempenho.
- **Timer:** regressivo de 1 a 180 minutos, com atalhos e aviso sonoro opcional. Serve exclusivamente como alerta; não salva sessões, não soma horas, não para o cronômetro e não conclui agendamentos. O aviso visual aparece ao terminar; a execução do som depende do navegador.

No cronograma, o ícone de relógio abre o cronômetro vinculado àquela atividade. **Salvar tempo e concluir estudo** registra o tempo medido e conclui o agendamento em uma única atualização, gerando somente a próxima revisão. A conclusão nunca é automática. Se preferir apenas medir uma sessão avulsa, desvincule-a antes de salvar.

As contagens em andamento ficam neste navegador, separadas por conta, e sobrevivem à navegação e ao recarregamento. O cronômetro tem limite de 24 horas por sessão. A contagem usa horários de início/pausa, sem depender da frequência dos intervalos do navegador. Pause antes de interromper o estudo. Somente os resultados salvos são sincronizados pelo Supabase; não há sincronização de relógios em andamento entre dispositivos. Não é necessário executar novo SQL para usar esta funcionalidade.
