begin;

create table public.cyclogazette_read_receipts (
  sporting_director_id uuid primary key
    references public.sporting_directors(id)
    on delete cascade,
  last_read_edition_id uuid
    references public.cyclogazette_editions(id)
    on delete set null,
  last_read_published_at timestamptz not null,
  last_read_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.cyclogazette_read_receipts
  enable row level security;

grant all on table public.cyclogazette_read_receipts
to service_role;

create or replace function public.has_unread_cyclogazette_editions()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  with current_director as (
    select director.id as sporting_director_id
    from public.sporting_directors as director
    where director.auth_user_id = (select auth.uid())
      and director.status = 'active'
    limit 1
  ),
  latest_edition as (
    select max(edition.published_at) as published_at
    from public.cyclogazette_editions as edition
  )
  select coalesce(
    (
      select latest_edition.published_at >
        coalesce(receipt.last_read_published_at, '-infinity'::timestamptz)
      from current_director
      cross join latest_edition
      left join public.cyclogazette_read_receipts as receipt
        on receipt.sporting_director_id =
          current_director.sporting_director_id
      where latest_edition.published_at is not null
    ),
    false
  );
$$;

create or replace function public.mark_cyclogazette_read(
  p_edition_id uuid default null
)
returns timestamptz
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_director_id uuid;
  v_edition_id uuid;
  v_published_at timestamptz;
begin
  select director.id
  into v_director_id
  from public.sporting_directors as director
  where director.auth_user_id = (select auth.uid())
    and director.status = 'active'
  limit 1;

  if v_director_id is null then
    raise exception
      'Vous devez disposer d''un profil de Directeur Sportif actif.';
  end if;

  select edition.id, edition.published_at
  into v_edition_id, v_published_at
  from public.cyclogazette_editions as edition
  where p_edition_id is null
    or edition.id = p_edition_id
  order by edition.published_at desc
  limit 1;

  if v_edition_id is null or v_published_at is null then
    return null;
  end if;

  insert into public.cyclogazette_read_receipts (
    sporting_director_id,
    last_read_edition_id,
    last_read_published_at,
    last_read_at,
    updated_at
  )
  values (
    v_director_id,
    v_edition_id,
    v_published_at,
    now(),
    now()
  )
  on conflict (sporting_director_id)
  do update set
    last_read_edition_id = case
      when excluded.last_read_published_at >=
        public.cyclogazette_read_receipts.last_read_published_at
      then excluded.last_read_edition_id
      else public.cyclogazette_read_receipts.last_read_edition_id
    end,
    last_read_published_at = greatest(
      public.cyclogazette_read_receipts.last_read_published_at,
      excluded.last_read_published_at
    ),
    last_read_at = now(),
    updated_at = now();

  return v_published_at;
end;
$$;

revoke all on function public.has_unread_cyclogazette_editions()
from public, anon;
revoke all on function public.mark_cyclogazette_read(uuid)
from public, anon;

grant execute on function public.has_unread_cyclogazette_editions()
to authenticated, service_role;
grant execute on function public.mark_cyclogazette_read(uuid)
to authenticated, service_role;

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'cyclogazette_editions'
  ) then
    alter publication supabase_realtime
      add table public.cyclogazette_editions;
  end if;
end;
$$;

comment on table public.cyclogazette_read_receipts is
  'Derniere edition de La Cyclogazette consultee par chaque Directeur Sportif.';

comment on function public.has_unread_cyclogazette_editions() is
  'Indique si une nouvelle Cyclogazette a ete publiee depuis la derniere lecture.';

comment on function public.mark_cyclogazette_read(uuid) is
  'Marque une edition consultee sans jamais faire reculer le dernier numero lu.';

commit;
