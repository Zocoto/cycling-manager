begin;

create table if not exists public.pcm_gala_events (
  id uuid primary key default gen_random_uuid(),
  season_id uuid not null references public.seasons(id) on delete cascade,
  event_key text not null,
  display_name text not null,
  discipline text not null check (discipline in ('mountain', 'hilly', 'sprint')),
  pcm_race_id integer not null,
  pcm_stage_id integer not null,
  pcm_stage_filename text not null,
  roster_size smallint not null default 7 check (roster_size between 1 and 9),
  status text not null default 'open' check (status in ('open', 'closed', 'exported')),
  sort_order smallint not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (season_id, event_key)
);

create table if not exists public.pcm_gala_registrations (
  id uuid primary key default gen_random_uuid(),
  gala_event_id uuid not null references public.pcm_gala_events(id) on delete restrict,
  team_id uuid not null references public.teams(id) on delete cascade,
  season_id uuid not null references public.seasons(id) on delete cascade,
  registered_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (team_id, season_id)
);

create table if not exists public.pcm_gala_registration_riders (
  registration_id uuid not null references public.pcm_gala_registrations(id) on delete cascade,
  rider_id uuid not null references public.riders(id) on delete restrict,
  position smallint not null check (position between 1 and 9),
  primary key (registration_id, rider_id),
  unique (registration_id, position)
);

create index if not exists pcm_gala_events_season_status_idx
  on public.pcm_gala_events(season_id, status, sort_order);

create index if not exists pcm_gala_registration_riders_rider_idx
  on public.pcm_gala_registration_riders(rider_id);

alter table public.pcm_gala_events enable row level security;
alter table public.pcm_gala_registrations enable row level security;
alter table public.pcm_gala_registration_riders enable row level security;

insert into public.pcm_gala_events (
  season_id,
  event_key,
  display_name,
  discipline,
  pcm_race_id,
  pcm_stage_id,
  pcm_stage_filename,
  roster_size,
  status,
  sort_order
)
select
  seasons.id,
  seed.event_key,
  seed.display_name,
  seed.discipline,
  seed.pcm_race_id,
  seed.pcm_stage_id,
  seed.pcm_stage_filename,
  7,
  'open',
  seed.sort_order
from public.seasons
cross join (
  values
    ('gala-des-sommets', 'Gala des Sommets', 'mountain', 172, 1172, 'topclas_lombardia', 1),
    ('gala-des-puncheurs', 'Gala des Puncheurs', 'hilly', 15, 1015, 'topclas_fleche', 2),
    ('gala-des-sprinteurs', 'Gala des Sprinteurs', 'sprint', 92, 1092, 'c0_paristours', 3)
) as seed(
  event_key,
  display_name,
  discipline,
  pcm_race_id,
  pcm_stage_id,
  pcm_stage_filename,
  sort_order
)
where seasons.status = 'active'
on conflict (season_id, event_key) do update
set
  display_name = excluded.display_name,
  discipline = excluded.discipline,
  pcm_race_id = excluded.pcm_race_id,
  pcm_stage_id = excluded.pcm_stage_id,
  pcm_stage_filename = excluded.pcm_stage_filename,
  roster_size = excluded.roster_size,
  sort_order = excluded.sort_order,
  updated_at = now();

create or replace function public.get_current_team_pcm_gala_context()
returns table (
  event_key text,
  event_status text,
  roster_size integer,
  selected_event_key text,
  selected_rider_ids uuid[]
)
language sql
security definer
set search_path = public, pg_temp
as $$
  with current_context as (
    select
      teams.id as team_id,
      seasons.id as season_id
    from public.sporting_directors
    inner join public.team_manager_assignments
      on team_manager_assignments.sporting_director_id = sporting_directors.id
      and team_manager_assignments.role = 'general_manager'
      and team_manager_assignments.status = 'active'
    inner join public.teams
      on teams.id = team_manager_assignments.team_id
      and teams.status = 'active'
    inner join public.seasons
      on seasons.status = 'active'
    where sporting_directors.auth_user_id = auth.uid()
      and sporting_directors.status = 'active'
    limit 1
  ),
  current_registration as (
    select
      registrations.id,
      selected_event.event_key
    from current_context
    inner join public.pcm_gala_registrations as registrations
      on registrations.team_id = current_context.team_id
      and registrations.season_id = current_context.season_id
    inner join public.pcm_gala_events as selected_event
      on selected_event.id = registrations.gala_event_id
    limit 1
  ),
  selected_riders as (
    select coalesce(
      array_agg(registration_riders.rider_id order by registration_riders.position)
        filter (where registration_riders.rider_id is not null),
      array[]::uuid[]
    ) as rider_ids
    from current_registration
    left join public.pcm_gala_registration_riders as registration_riders
      on registration_riders.registration_id = current_registration.id
  )
  select
    events.event_key::text,
    events.status::text,
    events.roster_size::integer,
    current_registration.event_key::text,
    coalesce(selected_riders.rider_ids, array[]::uuid[])
  from current_context
  inner join public.pcm_gala_events as events
    on events.season_id = current_context.season_id
  left join current_registration on true
  left join selected_riders on true
  order by events.sort_order;
$$;

create or replace function public.save_current_team_pcm_gala_registration(
  p_event_key text,
  p_rider_ids uuid[]
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  authenticated_user_id uuid := auth.uid();
  current_team_id uuid;
  current_season_id uuid;
  target_event_id uuid;
  required_roster_size integer;
  valid_rider_count integer;
  saved_registration_id uuid;
begin
  if authenticated_user_id is null then
    raise exception 'Utilisateur non authentifie.';
  end if;

  select teams.id, seasons.id
  into current_team_id, current_season_id
  from public.sporting_directors
  inner join public.team_manager_assignments
    on team_manager_assignments.sporting_director_id = sporting_directors.id
    and team_manager_assignments.role = 'general_manager'
    and team_manager_assignments.status = 'active'
  inner join public.teams
    on teams.id = team_manager_assignments.team_id
    and teams.status = 'active'
  inner join public.seasons
    on seasons.status = 'active'
  where sporting_directors.auth_user_id = authenticated_user_id
    and sporting_directors.status = 'active'
  limit 1;

  if current_team_id is null or current_season_id is null then
    raise exception 'Aucune equipe active ne peut etre inscrite.';
  end if;

  select events.id, events.roster_size
  into target_event_id, required_roster_size
  from public.pcm_gala_events as events
  where events.season_id = current_season_id
    and events.event_key = p_event_key
    and events.status = 'open'
  limit 1;

  if target_event_id is null then
    raise exception 'Cette course de gala est inconnue ou fermee.';
  end if;

  if p_rider_ids is null
    or cardinality(p_rider_ids) <> required_roster_size
    or (
      select count(distinct selected.rider_id)
      from unnest(p_rider_ids) as selected(rider_id)
    )
      <> required_roster_size then
    raise exception 'Selectionnez exactement % coureurs differents.', required_roster_size;
  end if;

  select count(distinct riders.id)::integer
  into valid_rider_count
  from public.riders
  inner join public.rider_contracts
    on rider_contracts.rider_id = riders.id
    and rider_contracts.team_id = current_team_id
    and rider_contracts.status = 'active'
  inner join public.seasons as contract_start
    on contract_start.id = rider_contracts.start_season_id
  inner join public.seasons as contract_end
    on contract_end.id = rider_contracts.end_season_id
  inner join public.seasons as active_season
    on active_season.id = current_season_id
  inner join public.rider_season_ratings
    on rider_season_ratings.rider_id = riders.id
    and rider_season_ratings.season_id = current_season_id
  where riders.status = 'active'
    and riders.id = any(p_rider_ids)
    and contract_start.game_year <= active_season.game_year
    and contract_end.game_year >= active_season.game_year;

  if valid_rider_count <> required_roster_size then
    raise exception 'La selection contient un coureur hors de votre effectif actif.';
  end if;

  insert into public.pcm_gala_registrations (
    gala_event_id,
    team_id,
    season_id,
    registered_at,
    updated_at
  )
  values (
    target_event_id,
    current_team_id,
    current_season_id,
    now(),
    now()
  )
  on conflict (team_id, season_id) do update
  set
    gala_event_id = excluded.gala_event_id,
    updated_at = now()
  returning id into saved_registration_id;

  delete from public.pcm_gala_registration_riders
  where registration_id = saved_registration_id;

  insert into public.pcm_gala_registration_riders (
    registration_id,
    rider_id,
    position
  )
  select
    saved_registration_id,
    selected.rider_id,
    selected.position::smallint
  from unnest(p_rider_ids) with ordinality as selected(rider_id, position);

  return saved_registration_id;
end;
$$;

create or replace function public.withdraw_current_team_pcm_gala_registration()
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  deleted_count integer;
begin
  delete from public.pcm_gala_registrations as registrations
  using public.sporting_directors,
    public.team_manager_assignments,
    public.teams,
    public.seasons,
    public.pcm_gala_events
  where sporting_directors.auth_user_id = auth.uid()
    and sporting_directors.status = 'active'
    and team_manager_assignments.sporting_director_id = sporting_directors.id
    and team_manager_assignments.role = 'general_manager'
    and team_manager_assignments.status = 'active'
    and teams.id = team_manager_assignments.team_id
    and teams.status = 'active'
    and seasons.status = 'active'
    and registrations.team_id = teams.id
    and registrations.season_id = seasons.id
    and pcm_gala_events.id = registrations.gala_event_id
    and pcm_gala_events.status = 'open';

  get diagnostics deleted_count = row_count;
  return deleted_count > 0;
end;
$$;

revoke all on table public.pcm_gala_events from public, anon, authenticated;
revoke all on table public.pcm_gala_registrations from public, anon, authenticated;
revoke all on table public.pcm_gala_registration_riders from public, anon, authenticated;

revoke all on function public.get_current_team_pcm_gala_context() from public, anon;
revoke all on function public.save_current_team_pcm_gala_registration(text, uuid[]) from public, anon;
revoke all on function public.withdraw_current_team_pcm_gala_registration() from public, anon;

grant execute on function public.get_current_team_pcm_gala_context() to authenticated;
grant execute on function public.save_current_team_pcm_gala_registration(text, uuid[]) to authenticated;
grant execute on function public.withdraw_current_team_pcm_gala_registration() to authenticated;

comment on table public.pcm_gala_registrations is
  'Inscriptions isolees des courses officielles, destinees uniquement a l export des startlists PCM26.';

comment on function public.save_current_team_pcm_gala_registration(text, uuid[]) is
  'Remplace atomiquement l unique inscription gala de l equipe active sans modifier forme, preparation, equipement ou classement.';

notify pgrst, 'reload schema';

commit;
