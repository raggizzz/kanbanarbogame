# ArboGame Jira Local

Jira local completo para o projeto **ArboGame**, com:

- Board Kanban (`Backlog`, `To Do`, `In Progress`, `In Review`, `Done`)
- CRUD de tickets (criar, editar, mover, excluir)
- Comentários por ticket
- Filtros por texto, status, prioridade, responsável e sprint
- Dados persistidos em `data/db.json`
- Seed inicial do projeto `ARBO`

## Requisitos

- Node.js 18+ (recomendado 20+)

## Como rodar

```bash
npm install
npm start
```

Abra:

```text
http://localhost:3333
```

## Desenvolvimento

```bash
npm run dev
```

## Teste de fumaça (API)

```bash
npm test
```

O teste valida:

- saúde da API
- criação de ticket
- mudança de status
- inserção de comentário
- leitura de ticket
- exclusão de ticket
