create table if not exists public.indicators (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  color text not null default '#8f7b5f',
  created_at timestamptz not null default now()
);

create table if not exists public.project_board_items (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  board_id uuid,
  source_type text not null check (source_type in ('media', 'website', 'idea', 'text', 'separator')),
  source_id uuid not null,
  content text,
  x numeric not null default 72,
  y numeric not null default 92,
  width numeric not null default 260,
  height numeric,
  created_at timestamptz not null default now()
);

create table if not exists public.pinboards (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  title text not null default 'Pinboard',
  "order" integer not null default 0,
  created_at timestamptz not null default now()
);

alter table public.items
  add column if not exists indicator_id uuid references public.indicators(id) on delete set null;

alter table public.items
  add column if not exists indicator_ids uuid[] not null default '{}';

alter table public.website_items
  add column if not exists indicator_id uuid references public.indicators(id) on delete set null;

alter table public.website_items
  add column if not exists indicator_ids uuid[] not null default '{}';

alter table public.idea_items
  add column if not exists indicator_id uuid references public.indicators(id) on delete set null;

alter table public.idea_items
  add column if not exists indicator_ids uuid[] not null default '{}';

create index if not exists indicators_user_created_at_idx
  on public.indicators (user_id, created_at desc);

create index if not exists project_board_items_project_idx
  on public.project_board_items (project_id, created_at desc);

create index if not exists pinboards_project_order_idx
  on public.pinboards (project_id, "order");

alter table public.indicators enable row level security;
alter table public.project_board_items enable row level security;
alter table public.pinboards enable row level security;

grant select, insert, update, delete on public.indicators to authenticated;
grant select, insert, update, delete on public.project_board_items to authenticated;
grant select, insert, update, delete on public.pinboards to authenticated;

drop policy if exists "Users can read their own indicators" on public.indicators;
drop policy if exists "Users can create their own indicators" on public.indicators;
drop policy if exists "Users can update their own indicators" on public.indicators;
drop policy if exists "Users can delete their own indicators" on public.indicators;

create policy "Users can read their own indicators"
  on public.indicators for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can create their own indicators"
  on public.indicators for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Users can update their own indicators"
  on public.indicators for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Users can delete their own indicators"
  on public.indicators for delete
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Users can read their own pinboards" on public.pinboards;
drop policy if exists "Users can create their own pinboards" on public.pinboards;
drop policy if exists "Users can update their own pinboards" on public.pinboards;
drop policy if exists "Users can delete their own pinboards" on public.pinboards;

create policy "Users can read their own pinboards"
  on public.pinboards for select
  to authenticated
  using (
    exists (
      select 1
      from public.projects p
      where p.id = project_id
      and p.user_id = (select auth.uid())
    )
  );

create policy "Users can create their own pinboards"
  on public.pinboards for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.projects p
      where p.id = project_id
      and p.user_id = (select auth.uid())
    )
  );

create policy "Users can update their own pinboards"
  on public.pinboards for update
  to authenticated
  using (
    exists (
      select 1
      from public.projects p
      where p.id = project_id
      and p.user_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1
      from public.projects p
      where p.id = project_id
      and p.user_id = (select auth.uid())
    )
  );

create policy "Users can delete their own pinboards"
  on public.pinboards for delete
  to authenticated
  using (
    exists (
      select 1
      from public.projects p
      where p.id = project_id
      and p.user_id = (select auth.uid())
    )
  );

drop policy if exists "Users can read their own board items" on public.project_board_items;
drop policy if exists "Users can create their own board items" on public.project_board_items;
drop policy if exists "Users can update their own board items" on public.project_board_items;
drop policy if exists "Users can delete their own board items" on public.project_board_items;

create policy "Users can read their own board items"
  on public.project_board_items for select
  to authenticated
  using (
    exists (
      select 1
      from public.projects p
      where p.id = project_id
      and p.user_id = (select auth.uid())
    )
  );

create policy "Users can create their own board items"
  on public.project_board_items for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.projects p
      where p.id = project_id
      and p.user_id = (select auth.uid())
    )
  );

create policy "Users can update their own board items"
  on public.project_board_items for update
  to authenticated
  using (
    exists (
      select 1
      from public.projects p
      where p.id = project_id
      and p.user_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1
      from public.projects p
      where p.id = project_id
      and p.user_id = (select auth.uid())
    )
  );

create policy "Users can delete their own board items"
  on public.project_board_items for delete
  to authenticated
  using (
    exists (
      select 1
      from public.projects p
      where p.id = project_id
      and p.user_id = (select auth.uid())
    )
  );
