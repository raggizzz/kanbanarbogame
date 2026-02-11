-- ArboGame Jira schema for Supabase
-- Execute in Supabase SQL Editor

create table if not exists public.projects (
  id text primary key,
  key text not null unique,
  name text not null,
  description text not null default ''
);

create table if not exists public.users (
  name text primary key,
  created_at timestamptz not null default now()
);

create table if not exists public.sprints (
  id text primary key,
  name text not null,
  goal text not null default '',
  state text not null check (state in ('planned', 'active', 'closed')),
  start_date date not null,
  end_date date not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.issues (
  id text primary key,
  project_id text not null references public.projects(id) on delete cascade,
  title text not null,
  description text not null default '',
  type text not null check (type in ('Story', 'Task', 'Bug', 'Epic')),
  status text not null check (status in ('Backlog', 'To Do', 'In Progress', 'In Review', 'Done')),
  priority text not null check (priority in ('Lowest', 'Low', 'Medium', 'High', 'Highest')),
  assignee text not null default 'Unassigned',
  reporter text not null default 'Antonio - PM',
  labels jsonb not null default '[]'::jsonb,
  story_points integer not null default 0,
  sprint_id text references public.sprints(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.comments (
  id text primary key,
  issue_id text not null references public.issues(id) on delete cascade,
  author text not null,
  body text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_issues_status on public.issues(status);
create index if not exists idx_issues_priority on public.issues(priority);
create index if not exists idx_issues_assignee on public.issues(assignee);
create index if not exists idx_issues_sprint on public.issues(sprint_id);
create index if not exists idx_issues_created_at on public.issues(created_at desc);
create index if not exists idx_comments_issue_id on public.comments(issue_id);

-- Allow anon/authenticated access for this app.
-- (If you need stricter security later, replace with restrictive policies.)
alter table public.projects enable row level security;
alter table public.users enable row level security;
alter table public.sprints enable row level security;
alter table public.issues enable row level security;
alter table public.comments enable row level security;

drop policy if exists projects_full_access_anon on public.projects;
drop policy if exists users_full_access_anon on public.users;
drop policy if exists sprints_full_access_anon on public.sprints;
drop policy if exists issues_full_access_anon on public.issues;
drop policy if exists comments_full_access_anon on public.comments;

create policy projects_full_access_anon on public.projects for all to anon using (true) with check (true);
create policy users_full_access_anon on public.users for all to anon using (true) with check (true);
create policy sprints_full_access_anon on public.sprints for all to anon using (true) with check (true);
create policy issues_full_access_anon on public.issues for all to anon using (true) with check (true);
create policy comments_full_access_anon on public.comments for all to anon using (true) with check (true);

grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on all tables in schema public to anon, authenticated;
grant usage, select on all sequences in schema public to anon, authenticated;

-- Minimal seed (idempotent)
insert into public.projects (id, key, name, description)
values ('project-arbogame', 'ARBO', 'ArboGame', 'Projeto principal do ArboGame')
on conflict (id) do nothing;

insert into public.users (name)
values
  ('Antonio - PM'),
  ('Igor'),
  ('Bruno'),
  ('Arthur'),
  ('Xavier'),
  ('Raissa'),
  ('Jasmine')
on conflict (name) do nothing;

-- Realtime publication setup (idempotente)
do $$
begin
  begin
    alter publication supabase_realtime add table public.projects;
  exception
    when duplicate_object then null;
    when undefined_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.users;
  exception
    when duplicate_object then null;
    when undefined_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.sprints;
  exception
    when duplicate_object then null;
    when undefined_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.issues;
  exception
    when duplicate_object then null;
    when undefined_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.comments;
  exception
    when duplicate_object then null;
    when undefined_object then null;
  end;
end $$;
