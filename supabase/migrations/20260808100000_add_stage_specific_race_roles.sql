begin;

create table public.race_roster_stage_roles (
  race_registration_id uuid not null,
  rider_id uuid not null,
  stage_id uuid not null
    references public.stages(id)
    on delete cascade,
  race_role text not null,
  updated_at timestamptz not null default now(),

  constraint race_roster_stage_roles_pkey
    primary key (race_registration_id, rider_id, stage_id),

  constraint race_roster_stage_roles_roster_fkey
    foreign key (race_registration_id, rider_id)
    references public.race_rosters(race_registration_id, rider_id)
    on delete cascade,

  constraint race_roster_stage_roles_role_allowed
    check (
      race_role in (
        'auto',
        'leader',
        'sprinter',
        'leadout',
        'free_agent',
        'domestique',
        'mountain_classification'
      )
    )
);

create index race_roster_stage_roles_stage_id_idx
  on public.race_roster_stage_roles (stage_id, rider_id);

create unique index race_roster_stage_roles_one_leader_idx
  on public.race_roster_stage_roles (race_registration_id, stage_id)
  where race_role = 'leader';

create unique index race_roster_stage_roles_one_sprinter_idx
  on public.race_roster_stage_roles (race_registration_id, stage_id)
  where race_role = 'sprinter';

create function public.enforce_race_roster_stage_role_scope()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_registration_edition_id uuid;
  v_stage_edition_id uuid;
  v_race_format text;
begin
  select
    registration.race_edition_id,
    stage.race_edition_id,
    race.race_format
  into
    v_registration_edition_id,
    v_stage_edition_id,
    v_race_format
  from public.race_registrations as registration
  join public.race_editions as edition
    on edition.id = registration.race_edition_id
  join public.races as race
    on race.id = edition.race_id
  cross join public.stages as stage
  where registration.id = new.race_registration_id
    and stage.id = new.stage_id;

  if not found
    or v_registration_edition_id is distinct from v_stage_edition_id
  then
    raise exception using
      errcode = '23514',
      message = 'Le rôle par étape doit appartenir au même tour que l inscription.';
  end if;

  if v_race_format is distinct from 'stage_race' then
    raise exception using
      errcode = '23514',
      message = 'Les rôles par étape sont réservés aux tours.';
  end if;

  return new;
end;
$$;

revoke all on function public.enforce_race_roster_stage_role_scope()
from public, anon, authenticated;

create trigger race_roster_stage_roles_scope_guard
before insert or update of race_registration_id, rider_id, stage_id
on public.race_roster_stage_roles
for each row
execute function public.enforce_race_roster_stage_role_scope();

alter table public.race_roster_stage_roles enable row level security;

revoke all on table public.race_roster_stage_roles
from public, anon, authenticated;

grant all privileges on table public.race_roster_stage_roles
to service_role;

create function public.get_current_team_stage_role_plan(
  p_race_edition_id uuid
)
returns table (
  rider_id uuid,
  stage_id uuid,
  general_role text,
  stage_role text
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    roster.rider_id,
    stage.id,
    roster.race_role,
    stage_role.race_role
  from public.sporting_directors as director
  join public.team_manager_assignments as assignment
    on assignment.sporting_director_id = director.id
   and assignment.role = 'general_manager'
   and assignment.status = 'active'
  join public.race_editions as edition
    on edition.id = p_race_edition_id
  join public.races as race
    on race.id = edition.race_id
   and race.race_format = 'stage_race'
  join public.team_seasons as team_season
    on team_season.team_id = assignment.team_id
   and team_season.season_id = edition.season_id
  join public.race_registrations as registration
    on registration.team_season_id = team_season.id
   and registration.race_edition_id = edition.id
   and registration.status = 'accepted'
  join public.race_rosters as roster
    on roster.race_registration_id = registration.id
   and roster.status in ('selected', 'confirmed')
  join public.stages as stage
    on stage.race_edition_id = edition.id
  left join public.race_roster_stage_roles as stage_role
    on stage_role.race_registration_id = registration.id
   and stage_role.rider_id = roster.rider_id
   and stage_role.stage_id = stage.id
  where director.auth_user_id = auth.uid()
  order by stage.stage_number, roster.bib_number nulls last, roster.rider_id;
$$;

revoke all on function public.get_current_team_stage_role_plan(uuid)
from public, anon;

grant execute on function public.get_current_team_stage_role_plan(uuid)
to authenticated;

create function public.save_current_team_stage_role_plan(
  p_race_edition_id uuid,
  p_stage_id uuid,
  p_roles jsonb
)
returns table (
  stage_id uuid,
  stage_number integer,
  updated_rider_count integer
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_registration_id uuid;
  v_stage_number integer;
  v_stage_status text;
  v_departure_at timestamptz;
  v_race_format text;
  v_roster_count integer;
  v_updated_count integer;
begin
  if auth.uid() is null then
    raise exception using
      errcode = '42501',
      message = 'Vous devez être connecté pour modifier les rôles du tour.';
  end if;

  select
    stage.stage_number,
    stage.status,
    stage.departure_at,
    race.race_format
  into
    v_stage_number,
    v_stage_status,
    v_departure_at,
    v_race_format
  from public.stages as stage
  join public.race_editions as edition
    on edition.id = stage.race_edition_id
   and edition.id = p_race_edition_id
  join public.races as race
    on race.id = edition.race_id
  where stage.id = p_stage_id
  for update of stage;

  if not found then
    raise exception using
      errcode = 'P0002',
      message = 'Cette étape est introuvable pour ce tour.';
  end if;

  if v_race_format is distinct from 'stage_race' then
    raise exception using
      errcode = 'P0001',
      message = 'Les rôles par étape sont réservés aux tours.';
  end if;

  if v_stage_status is distinct from 'planned'
    or (v_departure_at is not null and v_departure_at <= clock_timestamp())
    or exists (
      select 1
      from public.official_stage_simulations as simulation
      where simulation.stage_id = p_stage_id
    )
  then
    raise exception using
      errcode = 'P0001',
      message = 'Cette étape a déjà commencé. Les nouveaux rôles s appliquent à une étape suivante.';
  end if;

  select registration.id
  into v_registration_id
  from public.sporting_directors as director
  join public.team_manager_assignments as assignment
    on assignment.sporting_director_id = director.id
   and assignment.role = 'general_manager'
   and assignment.status = 'active'
  join public.race_editions as edition
    on edition.id = p_race_edition_id
  join public.team_seasons as team_season
    on team_season.team_id = assignment.team_id
   and team_season.season_id = edition.season_id
  join public.race_registrations as registration
    on registration.team_season_id = team_season.id
   and registration.race_edition_id = edition.id
   and registration.status = 'accepted'
  where director.auth_user_id = auth.uid()
  for update of registration;

  if not found then
    raise exception using
      errcode = '42501',
      message = 'Aucune inscription acceptée ne permet de modifier ces rôles.';
  end if;

  if p_roles is null
    or jsonb_typeof(p_roles) <> 'array'
    or jsonb_array_length(p_roles) = 0
  then
    raise exception using
      errcode = 'P0001',
      message = 'Le plan de rôles transmis est invalide.';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_roles) as entry(value)
    where not (
      entry.value ->> 'riderId'
      ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    )
      or coalesce(entry.value ->> 'role', '') not in (
        'auto',
        'leader',
        'sprinter',
        'leadout',
        'free_agent',
        'domestique',
        'mountain_classification'
      )
  ) then
    raise exception using
      errcode = 'P0001',
      message = 'Un coureur ou un rôle transmis est invalide.';
  end if;

  if jsonb_array_length(p_roles) <> (
    select count(distinct (entry.value ->> 'riderId')::uuid)
    from jsonb_array_elements(p_roles) as entry(value)
  ) then
    raise exception using
      errcode = 'P0001',
      message = 'Le plan contient un coureur en double.';
  end if;

  select count(*)::integer
  into v_roster_count
  from public.race_rosters as roster
  where roster.race_registration_id = v_registration_id
    and roster.status in ('selected', 'confirmed');

  if jsonb_array_length(p_roles) <> v_roster_count
    or exists (
      select 1
      from jsonb_array_elements(p_roles) as entry(value)
      left join public.race_rosters as roster
        on roster.race_registration_id = v_registration_id
       and roster.rider_id = (entry.value ->> 'riderId')::uuid
       and roster.status in ('selected', 'confirmed')
      where roster.id is null
    )
  then
    raise exception using
      errcode = 'P0001',
      message = 'Le plan doit couvrir exactement les coureurs encore engagés.';
  end if;

  if (
    select count(*)
    from jsonb_array_elements(p_roles) as entry(value)
    where entry.value ->> 'role' = 'leader'
  ) > 1
    or (
      select count(*)
      from jsonb_array_elements(p_roles) as entry(value)
      where entry.value ->> 'role' = 'sprinter'
    ) > 1
  then
    raise exception using
      errcode = 'P0001',
      message = 'Un seul leader et un seul sprinteur peuvent être désignés par étape.';
  end if;

  delete from public.race_roster_stage_roles as stage_role
  where stage_role.race_registration_id = v_registration_id
    and stage_role.stage_id = p_stage_id;

  insert into public.race_roster_stage_roles (
    race_registration_id,
    rider_id,
    stage_id,
    race_role,
    updated_at
  )
  select
    v_registration_id,
    (entry.value ->> 'riderId')::uuid,
    p_stage_id,
    entry.value ->> 'role',
    clock_timestamp()
  from jsonb_array_elements(p_roles) as entry(value);

  get diagnostics v_updated_count = row_count;

  return query
  select p_stage_id, v_stage_number, v_updated_count;
end;
$$;

revoke all on function public.save_current_team_stage_role_plan(uuid, uuid, jsonb)
from public, anon;

grant execute on function public.save_current_team_stage_role_plan(uuid, uuid, jsonb)
to authenticated;

comment on table public.race_roster_stage_roles is
  'Surcharges tactiques par étape. Le rôle général de race_rosters reste le choix par défaut du tour.';

comment on function public.save_current_team_stage_role_plan(uuid, uuid, jsonb) is
  'Enregistre les rôles d une étape future pour l équipe authentifiée ; une étape partie ou déjà verrouillée reste immuable.';

commit;
