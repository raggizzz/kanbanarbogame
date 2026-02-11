# ArboGame Jira Local

Jira local completo para o projeto **ArboGame**, com:

- Board Kanban (`Backlog`, `To Do`, `In Progress`, `In Review`, `Done`)
- CRUD de tickets (criar, editar, mover, excluir)
- Comentarios por ticket
- Filtros por texto, status, prioridade, responsavel e sprint
- Dados persistidos em `data/db.json` (local)
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

## Teste de fumaca (API)

```bash
npm test
```

O teste valida:

- saude da API
- criacao de sprint
- exclusao de sprint
- criacao de ticket
- mudanca de status
- insercao de comentario
- leitura de ticket
- exclusao de ticket

## Deploy na Vercel

- Este repositorio possui `vercel.json` e `api/index.js` para rodar como Serverless Function.
- Em ambiente Vercel, o arquivo de dados usa storage temporario:
  ` /tmp/arbogame-jira/data/db.json`.
- Isso evita crash `FUNCTION_INVOCATION_FAILED`, mas os dados podem ser resetados entre execucoes.
