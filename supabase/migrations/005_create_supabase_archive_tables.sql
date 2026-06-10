do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'projects'
      and column_name = 'id'
      and data_type = 'uuid'
  ) then
    if not exists (
      select 1
      from information_schema.tables
      where table_schema = 'public'
        and table_name = 'legacy_projects'
    ) then
      alter table public.projects rename to legacy_projects;
    end if;
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'indicators'
      and column_name = 'id'
      and data_type = 'uuid'
  ) then
    if not exists (
      select 1
      from information_schema.tables
      where table_schema = 'public'
        and table_name = 'legacy_indicators'
    ) then
      alter table public.indicators rename to legacy_indicators;
    end if;
  end if;
end $$;

create table if not exists public.projects (
  id text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

create table if not exists public.boards (
  id text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  project_id text not null,
  title text not null,
  "order" integer not null default 0,
  height integer not null default 680,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, id),
  foreign key (user_id, project_id) references public.projects(user_id, id) on delete cascade
);

create table if not exists public.media (
  id text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  image_url text not null,
  display_url text not null,
  image_type text not null default 'upload' check (image_type in ('upload', 'remote')),
  source_url text,
  category text not null default 'Other',
  tags text[] not null default '{}',
  indicator_id text,
  indicator_ids text[] not null default '{}',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

create table if not exists public.resources (
  id text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  description text not null default '',
  saved_reason text not null default '',
  used_for text not null default '',
  source_url text not null,
  domain text,
  categories text[] not null default '{}',
  indicator_id text,
  indicator_ids text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

create table if not exists public.ideas_references (
  id text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  entry_type text not null default 'idea' check (entry_type in ('idea', 'reference')),
  title text not null,
  body text not null,
  indicator_id text,
  indicator_ids text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

create table if not exists public.indicators (
  id text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  color text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

create table if not exists public.board_items (
  id text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  project_id text not null,
  board_id text not null,
  source_type text not null check (
    source_type in ('media', 'website', 'idea', 'text', 'separator', 'reference')
  ),
  source_id text not null,
  content text,
  x integer not null default 96,
  y integer not null default 96,
  width integer not null default 260,
  height integer,
  text_box_enabled boolean,
  text_size integer,
  text_color text,
  separator_orientation text check (
    separator_orientation is null or separator_orientation in ('horizontal', 'vertical')
  ),
  separator_thickness integer,
  separator_color text,
  reference_title text,
  reference_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, id),
  foreign key (user_id, project_id) references public.projects(user_id, id) on delete cascade,
  foreign key (user_id, board_id) references public.boards(user_id, id) on delete cascade
);

create index if not exists projects_user_id_idx on public.projects(user_id);
create index if not exists boards_user_id_idx on public.boards(user_id);
create index if not exists boards_project_id_idx on public.boards(project_id);
create index if not exists media_user_id_idx on public.media(user_id);
create index if not exists resources_user_id_idx on public.resources(user_id);
create index if not exists ideas_references_user_id_idx on public.ideas_references(user_id);
create index if not exists indicators_user_id_idx on public.indicators(user_id);
create index if not exists board_items_user_id_idx on public.board_items(user_id);
create index if not exists board_items_project_id_idx on public.board_items(project_id);
create index if not exists board_items_board_id_idx on public.board_items(board_id);

alter table public.projects enable row level security;
alter table public.boards enable row level security;
alter table public.media enable row level security;
alter table public.resources enable row level security;
alter table public.ideas_references enable row level security;
alter table public.indicators enable row level security;
alter table public.board_items enable row level security;

grant select, insert, update, delete on public.projects to authenticated;
grant select, insert, update, delete on public.boards to authenticated;
grant select, insert, update, delete on public.media to authenticated;
grant select, insert, update, delete on public.resources to authenticated;
grant select, insert, update, delete on public.ideas_references to authenticated;
grant select, insert, update, delete on public.indicators to authenticated;
grant select, insert, update, delete on public.board_items to authenticated;

drop policy if exists "Users manage own projects" on public.projects;
create policy "Users manage own projects"
  on public.projects for all
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists "Users manage own boards" on public.boards;
create policy "Users manage own boards"
  on public.boards for all
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists "Users manage own media" on public.media;
create policy "Users manage own media"
  on public.media for all
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists "Users manage own resources" on public.resources;
create policy "Users manage own resources"
  on public.resources for all
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists "Users manage own ideas and references" on public.ideas_references;
create policy "Users manage own ideas and references"
  on public.ideas_references for all
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists "Users manage own indicators" on public.indicators;
create policy "Users manage own indicators"
  on public.indicators for all
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists "Users manage own board items" on public.board_items;
create policy "Users manage own board items"
  on public.board_items for all
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
