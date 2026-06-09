create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.website_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  description text not null default '',
  source_url text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.idea_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  body text not null,
  created_at timestamptz not null default now()
);

create index if not exists projects_user_created_at_idx
  on public.projects (user_id, created_at desc);

create index if not exists website_items_user_created_at_idx
  on public.website_items (user_id, created_at desc);

create index if not exists idea_items_user_created_at_idx
  on public.idea_items (user_id, created_at desc);

alter table public.projects enable row level security;
alter table public.website_items enable row level security;
alter table public.idea_items enable row level security;

grant select, insert, update, delete on public.projects to authenticated;
grant select, insert, update, delete on public.website_items to authenticated;
grant select, insert, update, delete on public.idea_items to authenticated;

drop policy if exists "Users can read their own projects" on public.projects;
drop policy if exists "Users can create their own projects" on public.projects;
drop policy if exists "Users can update their own projects" on public.projects;
drop policy if exists "Users can delete their own projects" on public.projects;

create policy "Users can read their own projects"
  on public.projects for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can create their own projects"
  on public.projects for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Users can update their own projects"
  on public.projects for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Users can delete their own projects"
  on public.projects for delete
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Users can read their own website items" on public.website_items;
drop policy if exists "Users can create their own website items" on public.website_items;
drop policy if exists "Users can update their own website items" on public.website_items;
drop policy if exists "Users can delete their own website items" on public.website_items;

create policy "Users can read their own website items"
  on public.website_items for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can create their own website items"
  on public.website_items for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Users can update their own website items"
  on public.website_items for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Users can delete their own website items"
  on public.website_items for delete
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Users can read their own idea items" on public.idea_items;
drop policy if exists "Users can create their own idea items" on public.idea_items;
drop policy if exists "Users can update their own idea items" on public.idea_items;
drop policy if exists "Users can delete their own idea items" on public.idea_items;

create policy "Users can read their own idea items"
  on public.idea_items for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can create their own idea items"
  on public.idea_items for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Users can update their own idea items"
  on public.idea_items for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Users can delete their own idea items"
  on public.idea_items for delete
  to authenticated
  using ((select auth.uid()) = user_id);
