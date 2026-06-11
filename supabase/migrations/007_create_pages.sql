create table if not exists public.pages (
  id text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  project_id text,
  title text not null,
  format text not null default 'a4-portrait' check (format in ('a4-portrait')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, id),
  foreign key (user_id, project_id) references public.projects(user_id, id) on delete cascade
);

create table if not exists public.page_items (
  id text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  page_id text not null,
  type text not null check (type in ('image', 'text')),
  source_id text,
  content text,
  x integer not null default 80,
  y integer not null default 80,
  width integer not null default 220,
  height integer not null default 280,
  rotation numeric not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, id),
  foreign key (user_id, page_id) references public.pages(user_id, id) on delete cascade
);

do $$
begin
  if exists (
    select 1
    from information_schema.table_constraints
    where table_schema = 'public'
      and table_name = 'board_items'
      and constraint_name = 'board_items_source_type_check'
  ) then
    alter table public.board_items
      drop constraint board_items_source_type_check;
  end if;
end $$;

alter table public.board_items
  add constraint board_items_source_type_check
  check (source_type in ('media', 'website', 'idea', 'text', 'separator', 'reference', 'page'));

create index if not exists pages_user_id_idx on public.pages(user_id);
create index if not exists pages_project_id_idx on public.pages(project_id);
create index if not exists page_items_user_id_idx on public.page_items(user_id);
create index if not exists page_items_page_id_idx on public.page_items(page_id);

alter table public.pages enable row level security;
alter table public.page_items enable row level security;

grant select, insert, update, delete on public.pages to authenticated;
grant select, insert, update, delete on public.page_items to authenticated;

drop policy if exists "Users manage own pages" on public.pages;
create policy "Users manage own pages"
  on public.pages for all
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists "Users manage own page items" on public.page_items;
create policy "Users manage own page items"
  on public.page_items for all
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
