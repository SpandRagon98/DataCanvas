-- DataCanvas Phase 5 — Full Schema
-- Run this in your Supabase SQL editor (or via: supabase db push)

-- ── Extensions ────────────────────────────────────────────────────────────────
create extension if not exists "pgcrypto";

-- ── Profiles (mirrors auth.users) ────────────────────────────────────────────
create table if not exists profiles (
  id          uuid references auth.users(id) on delete cascade primary key,
  email       text not null,
  name        text,
  avatar_url  text,
  created_at  timestamptz default now()
);
alter table profiles enable row level security;
create policy "users can read all profiles"    on profiles for select using (true);
create policy "users can update own profile"   on profiles for update using (auth.uid() = id);

-- Auto-create profile on signup
create or replace function handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into profiles (id, email, name, avatar_url)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email,'@',1)),
    new.raw_user_meta_data->>'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();

-- ── Workspaces ────────────────────────────────────────────────────────────────
create table if not exists workspaces (
  id         uuid default gen_random_uuid() primary key,
  name       text not null,
  owner_id   uuid references profiles(id) on delete set null,
  created_at timestamptz default now()
);
alter table workspaces enable row level security;
-- NOTE: policies that reference workspace_members are defined AFTER that table is created below
create policy "owner can update workspace" on workspaces for update using (owner_id = auth.uid());

-- ── Workspace Members ─────────────────────────────────────────────────────────
create table if not exists workspace_members (
  workspace_id uuid references workspaces(id) on delete cascade,
  user_id      uuid references profiles(id) on delete cascade,
  role         text not null check (role in ('viewer','editor','admin')),
  joined_at    timestamptz default now(),
  primary key (workspace_id, user_id)
);
alter table workspace_members enable row level security;
create policy "members can view members" on workspace_members for select
  using (exists (select 1 from workspace_members m2 where m2.workspace_id = workspace_members.workspace_id and m2.user_id = auth.uid()));
create policy "admins can manage members" on workspace_members for all
  using (exists (select 1 from workspace_members m2 where m2.workspace_id = workspace_members.workspace_id and m2.user_id = auth.uid() and m2.role = 'admin'));

-- Workspaces visibility policy (must come after workspace_members exists)
create policy "members can view workspace" on workspaces for select
  using (exists (select 1 from workspace_members where workspace_id = workspaces.id and user_id = auth.uid()));

-- ── Workbooks ─────────────────────────────────────────────────────────────────
create table if not exists workbooks (
  id           uuid default gen_random_uuid() primary key,
  owner_id     uuid references profiles(id) on delete set null,
  workspace_id uuid references workspaces(id) on delete set null,
  name         text not null default 'Untitled Workbook',
  data         jsonb not null default '{}',
  version      integer not null default 1,
  updated_at   timestamptz default now(),
  created_at   timestamptz default now()
);
alter table workbooks enable row level security;
create policy "owner can manage workbook" on workbooks for all using (owner_id = auth.uid());
create policy "workspace members can read workbook" on workbooks for select
  using (workspace_id is not null and exists (
    select 1 from workspace_members where workspace_id = workbooks.workspace_id and user_id = auth.uid()
  ));
create policy "workspace editors can update workbook" on workbooks for update
  using (workspace_id is not null and exists (
    select 1 from workspace_members where workspace_id = workbooks.workspace_id and user_id = auth.uid() and role in ('editor','admin')
  ));

-- ── Workbook Versions (history) ───────────────────────────────────────────────
create table if not exists workbook_versions (
  id          uuid default gen_random_uuid() primary key,
  workbook_id uuid references workbooks(id) on delete cascade,
  data        jsonb not null,
  version     integer not null,
  saved_by    uuid references profiles(id) on delete set null,
  saved_at    timestamptz default now()
);
alter table workbook_versions enable row level security;
create policy "workbook owner can view versions" on workbook_versions for all
  using (exists (select 1 from workbooks where id = workbook_versions.workbook_id and owner_id = auth.uid()));

-- ── Shared Links (public read-only dashboard links) ───────────────────────────
create table if not exists shared_links (
  id           uuid default gen_random_uuid() primary key,
  token        text unique not null default encode(gen_random_bytes(18), 'base64url'),
  workbook_id  uuid references workbooks(id) on delete cascade,
  dashboard_id text not null,
  created_by   uuid references profiles(id) on delete set null,
  expires_at   timestamptz,
  created_at   timestamptz default now()
);
alter table shared_links enable row level security;
create policy "anyone can read non-expired links" on shared_links for select
  using (expires_at is null or expires_at > now());
create policy "owner can manage links" on shared_links for all using (created_by = auth.uid());

-- ── Comments ─────────────────────────────────────────────────────────────────
create table if not exists comments (
  id          uuid default gen_random_uuid() primary key,
  workbook_id uuid references workbooks(id) on delete cascade,
  visual_id   text,
  author_id   uuid references profiles(id) on delete set null,
  text        text not null,
  mentions    text[] default '{}',
  resolved    boolean default false,
  x           float,
  y           float,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);
alter table comments enable row level security;
create policy "workspace members can read comments" on comments for select
  using (exists (select 1 from workbooks wb
    join workspace_members wm on wm.workspace_id = wb.workspace_id
    where wb.id = comments.workbook_id and wm.user_id = auth.uid())
    or exists (select 1 from workbooks where id = comments.workbook_id and owner_id = auth.uid()));
create policy "authenticated users can insert comments" on comments for insert with check (author_id = auth.uid());
create policy "authors can update own comments" on comments for update using (author_id = auth.uid());
create policy "authors can delete own comments" on comments for delete using (author_id = auth.uid());

-- ── Comment Replies ───────────────────────────────────────────────────────────
create table if not exists comment_replies (
  id         uuid default gen_random_uuid() primary key,
  comment_id uuid references comments(id) on delete cascade,
  author_id  uuid references profiles(id) on delete set null,
  text       text not null,
  mentions   text[] default '{}',
  created_at timestamptz default now()
);
alter table comment_replies enable row level security;
create policy "anyone who can see the comment can see replies" on comment_replies for select
  using (exists (select 1 from comments where id = comment_replies.comment_id));
create policy "authenticated users can reply" on comment_replies for insert with check (author_id = auth.uid());
create policy "authors can delete own replies" on comment_replies for delete using (author_id = auth.uid());

-- ── Scheduled Reports ─────────────────────────────────────────────────────────
create table if not exists scheduled_reports (
  id           uuid default gen_random_uuid() primary key,
  workbook_id  uuid references workbooks(id) on delete cascade,
  dashboard_id text not null,
  name         text not null,
  frequency    text not null check (frequency in ('daily','weekly','monthly')),
  recipients   text[] not null,
  filters      jsonb default '{}',
  enabled      boolean default true,
  last_run     timestamptz,
  next_run     timestamptz,
  created_by   uuid references profiles(id) on delete set null,
  created_at   timestamptz default now()
);
alter table scheduled_reports enable row level security;
create policy "owner can manage scheduled reports" on scheduled_reports for all
  using (exists (select 1 from workbooks where id = scheduled_reports.workbook_id and owner_id = auth.uid()));

-- ── Realtime ──────────────────────────────────────────────────────────────────
-- Enable realtime for comments (for live comment notifications)
alter publication supabase_realtime add table comments;
