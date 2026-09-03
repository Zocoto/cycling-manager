begin;

create table public.national_federation_jerseys (
  country_id uuid primary key
    references public.countries(id)
    on delete cascade,
  design jsonb not null,
  version integer not null default 1,
  published_by uuid not null
    references public.sporting_directors(id)
    on delete restrict,
  published_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint national_federation_jerseys_design_object
    check (jsonb_typeof(design) = 'object'),
  constraint national_federation_jerseys_design_size
    check (octet_length(design::text) <= 20000),
  constraint national_federation_jerseys_version_positive
    check (version > 0)
);

create table public.national_federation_jersey_history (
  id uuid primary key default gen_random_uuid(),
  country_id uuid not null
    references public.countries(id)
    on delete cascade,
  version integer not null,
  design jsonb not null,
  published_by uuid not null
    references public.sporting_directors(id)
    on delete restrict,
  published_at timestamptz not null default now(),

  constraint national_federation_jersey_history_design_object
    check (jsonb_typeof(design) = 'object'),
  constraint national_federation_jersey_history_design_size
    check (octet_length(design::text) <= 20000),
  constraint national_federation_jersey_history_version_positive
    check (version > 0),
  constraint national_federation_jersey_history_country_version_unique
    unique (country_id, version)
);

create index national_federation_jersey_history_country_published_idx
  on public.national_federation_jersey_history (country_id, published_at desc);

create table public.federation_chat_messages (
  id uuid primary key default gen_random_uuid(),
  country_id uuid not null
    references public.countries(id)
    on delete cascade,
  sporting_director_id uuid not null
    references public.sporting_directors(id)
    on delete cascade,
  team_id uuid not null
    references public.teams(id)
    on delete cascade,
  author_display_name text not null,
  team_display_name text not null,
  message text not null,
  created_at timestamptz not null default now(),

  constraint federation_chat_author_not_empty
    check (btrim(author_display_name) <> ''),
  constraint federation_chat_team_not_empty
    check (btrim(team_display_name) <> ''),
  constraint federation_chat_message_length
    check (char_length(btrim(message)) between 1 and 500)
);

create index federation_chat_country_created_idx
  on public.federation_chat_messages (country_id, created_at desc, id desc);

create index federation_chat_director_created_idx
  on public.federation_chat_messages (sporting_director_id, created_at desc);

alter table public.national_federation_jerseys enable row level security;
alter table public.national_federation_jersey_history enable row level security;
alter table public.federation_chat_messages enable row level security;

create policy national_federation_jerseys_select_authenticated
on public.national_federation_jerseys
for select
to authenticated
using (true);

create policy national_federation_jersey_history_select_authenticated
on public.national_federation_jersey_history
for select
to authenticated
using (true);

grant select on table public.national_federation_jerseys
to authenticated, service_role;
grant select on table public.national_federation_jersey_history
to authenticated, service_role;
grant select on table public.federation_chat_messages
to authenticated, service_role;
grant all on table public.national_federation_jerseys
to service_role;
grant all on table public.national_federation_jersey_history
to service_role;
grant all on table public.federation_chat_messages
to service_role;

create or replace function public.is_current_team_affiliated_with_country(
  p_country_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.sporting_directors as director
    join public.team_manager_assignments as assignment
      on assignment.sporting_director_id = director.id
     and assignment.role = 'general_manager'
     and assignment.status = 'active'
    join public.teams as team
      on team.id = assignment.team_id
     and team.status = 'active'
    join public.seasons as season
      on season.status = 'active'
    join public.team_seasons as team_season
      on team_season.team_id = team.id
     and team_season.season_id = season.id
     and team_season.status in ('planned', 'active')
    where director.auth_user_id = (select auth.uid())
      and director.status = 'active'
      and team_season.registration_country_id = p_country_id
  );
$$;

revoke all on function public.is_current_team_affiliated_with_country(uuid)
from public, anon;
grant execute on function public.is_current_team_affiliated_with_country(uuid)
to authenticated, service_role;

create policy federation_chat_select_affiliated
on public.federation_chat_messages
for select
to authenticated
using (public.is_current_team_affiliated_with_country(country_id));

create or replace function public.get_current_federation_identity(
  p_country_code text
)
returns table (
  country_id uuid,
  sporting_director_id uuid,
  display_name text,
  team_id uuid,
  team_name text
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    country.id,
    director.id,
    director.display_name,
    team.id,
    coalesce(
      nullif(btrim(team_season.display_name), ''),
      nullif(btrim(team.amateur_name), ''),
      team.internal_name
    )
  from public.sporting_directors as director
  join public.team_manager_assignments as assignment
    on assignment.sporting_director_id = director.id
   and assignment.role = 'general_manager'
   and assignment.status = 'active'
  join public.teams as team
    on team.id = assignment.team_id
   and team.status = 'active'
  join public.seasons as season
    on season.status = 'active'
  join public.team_seasons as team_season
    on team_season.team_id = team.id
   and team_season.season_id = season.id
   and team_season.status in ('planned', 'active')
  join public.countries as country
    on country.id = team_season.registration_country_id
   and country.is_active = true
  where director.auth_user_id = (select auth.uid())
    and director.status = 'active'
    and country.iso_alpha2 = upper(btrim(coalesce(p_country_code, '')))
  limit 1;
$$;

create or replace function public.post_federation_chat_message(
  p_country_code text,
  p_message text
)
returns public.federation_chat_messages
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_message text;
  v_country_id uuid;
  v_director_id uuid;
  v_display_name text;
  v_team_id uuid;
  v_team_name text;
  v_result public.federation_chat_messages;
begin
  if (select auth.uid()) is null then
    raise exception 'Vous devez être connecté pour écrire dans le salon fédéral.';
  end if;

  v_message := regexp_replace(btrim(coalesce(p_message, '')), '\s+', ' ', 'g');
  if char_length(v_message) not between 1 and 500 then
    raise exception 'Le message doit contenir entre 1 et 500 caractères.';
  end if;

  select
    identity.country_id,
    identity.sporting_director_id,
    identity.display_name,
    identity.team_id,
    identity.team_name
  into
    v_country_id,
    v_director_id,
    v_display_name,
    v_team_id,
    v_team_name
  from public.get_current_federation_identity(p_country_code) as identity;

  if v_country_id is null or v_director_id is null or v_team_id is null then
    raise exception 'Ce salon est réservé aux équipes affiliées à cette fédération.';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_director_id::text || ':federation-chat', 0)
  );

  if exists (
    select 1
    from public.federation_chat_messages as recent_message
    where recent_message.sporting_director_id = v_director_id
      and recent_message.created_at > now() - interval '2 seconds'
  ) then
    raise exception 'Patientez un instant avant d’envoyer un nouveau message.';
  end if;

  if (
    select count(*)
    from public.federation_chat_messages as recent_message
    where recent_message.sporting_director_id = v_director_id
      and recent_message.created_at > now() - interval '1 minute'
  ) >= 15 then
    raise exception 'Trop de messages ont été envoyés. Réessayez dans une minute.';
  end if;

  insert into public.federation_chat_messages (
    country_id,
    sporting_director_id,
    team_id,
    author_display_name,
    team_display_name,
    message
  )
  values (
    v_country_id,
    v_director_id,
    v_team_id,
    v_display_name,
    v_team_name,
    v_message
  )
  returning * into v_result;

  return v_result;
end;
$$;

create or replace function public.publish_national_federation_jersey(
  p_country_code text,
  p_design jsonb
)
returns table (
  version integer,
  published_at timestamptz
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_country_id uuid;
  v_director_id uuid;
  v_version integer;
  v_published_at timestamptz;
begin
  if (select auth.uid()) is null then
    raise exception 'Vous devez être connecté pour publier un maillot national.';
  end if;

  if upper(btrim(coalesce(p_country_code, ''))) <> 'BE' then
    raise exception 'La publication est limitée à la fédération belge pendant la bêta.';
  end if;

  if p_design is null
     or jsonb_typeof(p_design) <> 'object'
     or octet_length(p_design::text) > 20000
     or coalesce(p_design ->> 'schemaVersion', '') <> '2'
     or jsonb_typeof(p_design -> 'elements') <> 'array'
     or (case
          when jsonb_typeof(p_design -> 'elements') = 'array'
            then jsonb_array_length(p_design -> 'elements')
          else 999
        end) > 16
     or coalesce(p_design ->> 'baseColor', '') !~ '^#[0-9A-F]{6}$' then
    raise exception 'Le maillot transmis est invalide.';
  end if;

  select identity.country_id, identity.sporting_director_id
  into v_country_id, v_director_id
  from public.get_current_federation_identity(p_country_code) as identity;

  if v_country_id is null or v_director_id is null then
    raise exception 'Seule une équipe affiliée peut publier le maillot de cette fédération.';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_country_id::text || ':federation-jersey', 0)
  );

  insert into public.national_federation_jerseys (
    country_id,
    design,
    version,
    published_by,
    published_at,
    updated_at
  )
  values (
    v_country_id,
    p_design,
    1,
    v_director_id,
    now(),
    now()
  )
  on conflict (country_id) do update
  set
    design = excluded.design,
    version = public.national_federation_jerseys.version + 1,
    published_by = excluded.published_by,
    published_at = excluded.published_at,
    updated_at = excluded.updated_at
  returning
    national_federation_jerseys.version,
    national_federation_jerseys.published_at
  into v_version, v_published_at;

  insert into public.national_federation_jersey_history (
    country_id,
    version,
    design,
    published_by,
    published_at
  )
  values (
    v_country_id,
    v_version,
    p_design,
    v_director_id,
    v_published_at
  );

  delete from public.national_federation_jersey_history as history
  where history.country_id = v_country_id
    and history.id not in (
      select retained.id
      from public.national_federation_jersey_history as retained
      where retained.country_id = v_country_id
      order by retained.version desc
      limit 12
    );

  return query select v_version, v_published_at;
end;
$$;

revoke all on function public.get_current_federation_identity(text)
from public, anon;
revoke all on function public.post_federation_chat_message(text, text)
from public, anon;
revoke all on function public.publish_national_federation_jersey(text, jsonb)
from public, anon;

grant execute on function public.get_current_federation_identity(text)
to authenticated, service_role;
grant execute on function public.post_federation_chat_message(text, text)
to authenticated, service_role;
grant execute on function public.publish_national_federation_jersey(text, jsonb)
to authenticated, service_role;

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'federation_chat_messages'
  ) then
    alter publication supabase_realtime
      add table public.federation_chat_messages;
  end if;
end;
$$;

comment on table public.national_federation_jerseys is
  'Version actuellement publiée du maillot porté par chaque sélection nationale.';
comment on table public.national_federation_jersey_history is
  'Historique borné des douze dernières publications de maillot national.';
comment on table public.federation_chat_messages is
  'Salon temps réel privé, cloisonné par nationalité sportive active.';
comment on function public.publish_national_federation_jersey(text, jsonb) is
  'Publie atomiquement le maillot national après contrôle de l’affiliation ; bêta belge uniquement.';

commit;
