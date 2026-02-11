# ArboGame Jira

Jira-like board para o projeto ArboGame com:

- Board Kanban
- CRUD de tickets
- Comentarios
- Sprints (criar, editar, excluir)
- Persistencia em Supabase

## 1. Configurar Supabase

1. Abra o SQL Editor do seu projeto Supabase.
2. Execute o script: `supabase/schema.sql`.

Isso cria todas as tabelas, policies e seed inicial.

## 2. Variaveis de ambiente

Crie um `.env` na raiz:

```env
SUPABASE_ENABLED=true
SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY
```

Ja existe `.env.example` como referencia.

## 3. Rodar local

```bash
npm install
npm start
```

Aplicacao:

```text
http://localhost:3333
```

Health check:

```text
http://localhost:3333/api/health
```

## 4. Testes

```bash
npm test
```

Observacao: o teste de fumaca roda em modo local (sem Supabase) para ser deterministico.

## 5. Deploy Vercel

Este repositorio ja inclui:

- `vercel.json`
- `api/index.js`

No deploy, mantenha as mesmas variaveis de ambiente (`SUPABASE_*`) no painel da Vercel.
