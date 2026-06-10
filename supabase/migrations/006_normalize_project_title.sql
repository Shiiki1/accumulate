do $$
begin
  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'projects'
  ) then
    if not exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'projects'
        and column_name = 'title'
    ) then
      alter table public.projects add column title text;
    end if;

    if exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'projects'
        and column_name = 'name'
    ) then
      update public.projects
      set title = coalesce(title, name)
      where title is null;
    end if;

    update public.projects
    set title = coalesce(title, 'Untitled project')
    where title is null;

    alter table public.projects alter column title set not null;
  end if;
end $$;
