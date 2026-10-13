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

As matérias iniciais são sugestões editáveis; nenhuma sessão ou resultado fictício é incluído. Agendamentos concluídos não geram sessões automaticamente: registre o tempo e o desempenho reais usando “Registrar estudo”.
