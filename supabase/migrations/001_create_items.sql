create table if not exists public.items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  image_url text not null,
  image_type text not null default 'upload' check (image_type in ('upload', 'remote')),
  source_url text,
  category text not null default 'Other' check (
    category in (
      'Fashion',
      'Furniture',
      'Interior',
      'Art',
      'Digital Art',
      'Objects',
      'Other'
    )
  ),
  tags text[] not null default '{}',
  notes text,
  created_at timestamptz not null default now()
);

alter table public.items
  add column if not exists image_type text not null default 'upload';

alter table public.items
  alter column user_id drop default;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'items_image_type_check'
  ) then
    alter table public.items
      add constraint items_image_type_check
      check (image_type in ('upload', 'remote'));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'items_user_id_fkey'
  ) and not exists (
    select 1
    from public.items i
    left join auth.users u on u.id = i.user_id
    where u.id is null
  ) then
    alter table public.items
      add constraint items_user_id_fkey
      foreign key (user_id) references auth.users(id) on delete cascade;
  end if;
end $$;

create index if not exists items_user_created_at_idx
  on public.items (user_id, created_at desc);

create index if not exists items_user_category_idx
  on public.items (user_id, category);

alter table public.items enable row level security;

grant usage on schema public to authenticated;
revoke all on public.items from anon;
grant select, insert, update, delete on public.items to authenticated;

drop policy if exists "Pin mode can read items" on public.items;
drop policy if exists "Pin mode can create items" on public.items;
drop policy if exists "Pin mode can update items" on public.items;
drop policy if exists "Pin mode can delete items" on public.items;
drop policy if exists "Users can read their own items" on public.items;
drop policy if exists "Users can create their own items" on public.items;
drop policy if exists "Users can update their own items" on public.items;
drop policy if exists "Users can delete their own items" on public.items;

create policy "Users can read their own items"
  on public.items for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can create their own items"
  on public.items for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Users can update their own items"
  on public.items for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Users can delete their own items"
  on public.items for delete
  to authenticated
  using ((select auth.uid()) = user_id);

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
) values (
  'item-images',
  'item-images',
  true,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Pin mode can view item images" on storage.objects;
drop policy if exists "Pin mode can upload item images" on storage.objects;
drop policy if exists "Pin mode can update item images" on storage.objects;
drop policy if exists "Pin mode can delete item images" on storage.objects;
drop policy if exists "Users can view item images" on storage.objects;
drop policy if exists "Users can upload item images" on storage.objects;
drop policy if exists "Users can update item images" on storage.objects;
drop policy if exists "Users can delete item images" on storage.objects;

create policy "Users can view item images"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'item-images'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "Users can upload item images"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'item-images'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "Users can update item images"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'item-images'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  )
  with check (
    bucket_id = 'item-images'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "Users can delete item images"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'item-images'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
