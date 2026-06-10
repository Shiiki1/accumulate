alter table public.idea_items
  add column if not exists entry_type text not null default 'idea'
  check (entry_type in ('idea', 'reference'));

do $$
begin
  if exists (
    select 1
    from pg_constraint
    where conname = 'project_board_items_source_type_check'
  ) then
    alter table public.project_board_items
      drop constraint project_board_items_source_type_check;
  end if;
end $$;

alter table public.project_board_items
  add constraint project_board_items_source_type_check
  check (source_type in ('media', 'website', 'idea', 'text', 'separator', 'reference'));

alter table public.website_items
  add column if not exists saved_reason text not null default '';

alter table public.website_items
  add column if not exists used_for text not null default '';

create table if not exists public.collections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  description text not null default '',
  source_ids jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists collections_user_created_at_idx
  on public.collections (user_id, created_at desc);

alter table public.collections enable row level security;

grant select, insert, update, delete on public.collections to authenticated;

drop policy if exists "Users can read their own collections" on public.collections;
drop policy if exists "Users can create their own collections" on public.collections;
drop policy if exists "Users can update their own collections" on public.collections;
drop policy if exists "Users can delete their own collections" on public.collections;

create policy "Users can read their own collections"
  on public.collections for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can create their own collections"
  on public.collections for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Users can update their own collections"
  on public.collections for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Users can delete their own collections"
  on public.collections for delete
  to authenticated
  using ((select auth.uid()) = user_id);
