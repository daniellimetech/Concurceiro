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

Os dados são armazenados no `localStorage` do navegador, sem backend ou conta. Não são sincronizados entre dispositivos e podem ser perdidos se os dados do navegador forem apagados. Exporte backups regularmente. Importar um backup substitui os registros atuais.

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
