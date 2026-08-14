begin;

create table public.race_time_trial_rider_plans (
  race_registration_id uuid not null,
  stage_id uuid not null references public.stages(id) on delete cascade,
  rider_id uuid not null,
  team_id uuid not null references public.teams(id) on delete cascade,
  effort_mode text not null default 'normal',
  relay_share_pct numeric(5, 2),
  updated_at timestamptz not null default now(),

  constraint race_time_trial_rider_plans_pkey
    primary key (race_registration_id, stage_id, rider_id),
  constraint race_time_trial_rider_plans_roster_fkey
    foreign key (race_registration_id, rider_id)
    references public.race_rosters(race_registration_id, rider_id)
    on delete cascade,
  constraint race_time_trial_rider_plans_effort_allowed
    check (effort_mode in ('conserve', 'normal', 'all_in')),
  constraint race_time_trial_rider_plans_relay_range
    check (relay_share_pct is null or relay_share_pct between 0 and 100)
);

create index race_time_trial_rider_plans_stage_idx
  on public.race_time_trial_rider_plans (stage_id, team_id);

create function public.enforce_time_trial_rider_plan_scope()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_registration_edition_id uuid;
  v_stage_edition_id uuid;
  v_stage_type text;
  v_team_id uuid;
begin
  select
    registration.race_edition_id,
    stage.race_edition_id,
    stage.stage_type,
    team_season.team_id
  into
    v_registration_edition_id,
    v_stage_edition_id,
    v_stage_type,
    v_team_id
  from public.race_registrations as registration
  join public.team_seasons as team_season
    on team_season.id = registration.team_season_id
  cross join public.stages as stage
  where registration.id = new.race_registration_id
    and stage.id = new.stage_id;

  if not found
    or v_registration_edition_id is distinct from v_stage_edition_id
  then
    raise exception using
      errcode = '23514',
      message = 'La consigne chrono doit appartenir à la même course que l inscription.';
  end if;

  if v_stage_type not in (
    'individual_time_trial',
    'team_time_trial',
    'prologue'
  ) then
    raise exception using
      errcode = '23514',
      message = 'Une consigne chrono ne peut viser qu un contre-la-montre.';
  end if;

  new.team_id := v_team_id;
  if v_stage_type <> 'team_time_trial' then
    new.relay_share_pct := null;
  end if;
  return new;
end;
$$;

revoke all on function public.enforce_time_trial_rider_plan_scope()
from public, anon, authenticated;

create trigger race_time_trial_rider_plans_scope_guard
before insert or update of race_registration_id, stage_id, rider_id, team_id
on public.race_time_trial_rider_plans
for each row
execute function public.enforce_time_trial_rider_plan_scope();

alter table public.race_time_trial_rider_plans enable row level security;

revoke all on table public.race_time_trial_rider_plans
from public, anon, authenticated;

grant all privileges on table public.race_time_trial_rider_plans
to service_role;

drop function public.get_current_team_race_preparation();

create function public.get_current_team_race_preparation()
returns table (
  race_edition_id uuid,
  race_registration_id uuid,
  team_id uuid,
  stage_id uuid,
  rider_id uuid,
  rider_first_name text,
  rider_last_name text,
  mountain integer,
  hills integer,
  flat integer,
  time_trial integer,
  cobbles integer,
  sprint integer,
  acceleration integer,
  downhill integer,
  endurance integer,
  resistance integer,
  recovery integer,
  breakaway integer,
  prologue integer,
  general_role text,
  stage_role text,
  time_trial_effort text,
  relay_share_pct numeric,
  time_trial_updated_at timestamptz,
  objective text,
  collective_posture text,
  breakaway_policy text,
  chase_policy text,
  lieutenant_rider_id uuid,
  danger_pacer_rider_id uuid,
  protector_rider_id uuid,
  breakaway_rider_id uuid,
  attack_orders jsonb,
  strategy_updated_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    edition.id,
    registration.id,
    team_season.team_id,
    stage.id,
    roster.rider_id,
    rider.first_name,
    rider.last_name,
    rating.mountain::integer,
    rating.hills::integer,
    rating.flat::integer,
    rating.time_trial::integer,
    rating.cobbles::integer,
    rating.sprint::integer,
    rating.acceleration::integer,
    rating.downhill::integer,
    rating.endurance::integer,
    rating.resistance::integer,
    rating.recovery::integer,
    rating.breakaway::integer,
    rating.prologue::integer,
    roster.race_role,
    stage_role.race_role,
    time_plan.effort_mode,
    time_plan.relay_share_pct,
    time_plan.updated_at,
    coalesce(strategy.objective, 'balanced'),
    coalesce(strategy.collective_posture, 'balanced'),
    coalesce(strategy.breakaway_policy, 'opportunistic'),
    coalesce(strategy.chase_policy, 'dangerous_breakaway'),
    strategy.lieutenant_rider_id,
    strategy.danger_pacer_rider_id,
    strategy.protector_rider_id,
    strategy.breakaway_rider_id,
    coalesce(strategy.attack_orders, '[]'::jsonb),
    strategy.updated_at
  from public.sporting_directors as director
  join public.team_manager_assignments as assignment
    on assignment.sporting_director_id = director.id
   and assignment.role = 'general_manager'
   and assignment.status = 'active'
  join public.team_seasons as team_season
    on team_season.team_id = assignment.team_id
  join public.seasons as season
    on season.id = team_season.season_id
   and season.status = 'active'
  join public.race_registrations as registration
    on registration.team_season_id = team_season.id
   and registration.status = 'accepted'
  join public.race_editions as edition
    on edition.id = registration.race_edition_id
   and edition.season_id = season.id
   and edition.status <> 'cancelled'
  join public.race_rosters as roster
    on roster.race_registration_id = registration.id
   and roster.status in ('selected', 'confirmed')
  join public.riders as rider
    on rider.id = roster.rider_id
  join public.rider_season_ratings as rating
    on rating.rider_id = roster.rider_id
   and rating.season_id = season.id
  join public.stages as stage
    on stage.race_edition_id = edition.id
   and stage.status <> 'cancelled'
  left join public.race_roster_stage_roles as stage_role
    on stage_role.race_registration_id = registration.id
   and stage_role.rider_id = roster.rider_id
   and stage_role.stage_id = stage.id
  left join public.race_time_trial_rider_plans as time_plan
    on time_plan.race_registration_id = registration.id
   and time_plan.rider_id = roster.rider_id
   and time_plan.stage_id = stage.id
  left join public.race_stage_strategies as strategy
    on strategy.race_registration_id = registration.id
   and strategy.stage_id = stage.id
  where director.auth_user_id = auth.uid()
  order by stage.departure_at nulls last, stage.stage_number,
    roster.bib_number nulls last, roster.rider_id;
$$;

revoke all on function public.get_current_team_race_preparation()
from public, anon;

grant execute on function public.get_current_team_race_preparation()
to authenticated, service_role;

create function public.save_current_team_time_trial_preparation(
  p_race_edition_id uuid,
  p_stage_id uuid,
  p_plan jsonb
)
returns table (
  saved_stage_id uuid,
  stage_number integer,
  updated_rider_count integer
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_registration_id uuid;
  v_team_id uuid;
  v_stage_number integer;
  v_stage_status text;
  v_stage_type text;
  v_departure_at timestamptz;
  v_roster_count integer;
  v_updated_count integer;
  v_relay_total numeric;
begin
  if auth.uid() is null then
    raise exception using
      errcode = '42501',
      message = 'Vous devez être connecté pour préparer un contre-la-montre.';
  end if;

  select
    stage.stage_number,
    stage.status,
    stage.stage_type,
    stage.departure_at
  into
    v_stage_number,
    v_stage_status,
    v_stage_type,
    v_departure_at
  from public.stages as stage
  join public.race_editions as edition
    on edition.id = stage.race_edition_id
   and edition.id = p_race_edition_id
  where stage.id = p_stage_id
  for update of stage;

  if not found then
    raise exception using
      errcode = 'P0002',
      message = 'Cette étape est introuvable pour cette course.';
  end if;

  if v_stage_type not in (
    'individual_time_trial',
    'team_time_trial',
    'prologue'
  ) then
    raise exception using
      errcode = 'P0001',
      message = 'Cette étape n est pas un contre-la-montre.';
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
      message = 'Cette étape a déjà commencé. Les nouvelles consignes s appliquent à une étape suivante.';
  end if;

  select registration.id, team_season.team_id
  into v_registration_id, v_team_id
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
      message = 'Aucune inscription acceptée ne permet de préparer ce chrono.';
  end if;

  if p_plan is null
    or jsonb_typeof(p_plan) <> 'array'
    or jsonb_array_length(p_plan) = 0
  then
    raise exception using
      errcode = 'P0001',
      message = 'Le plan du contre-la-montre est invalide.';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_plan) as entry(value)
    where not (
      entry.value ->> 'riderId'
      ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    )
      or coalesce(entry.value ->> 'effortMode', '') not in (
        'conserve',
        'normal',
        'all_in'
      )
  ) then
    raise exception using
      errcode = 'P0001',
      message = 'Un coureur ou un niveau d effort transmis est invalide.';
  end if;

  if jsonb_array_length(p_plan) <> (
    select count(distinct (entry.value ->> 'riderId')::uuid)
    from jsonb_array_elements(p_plan) as entry(value)
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

  if jsonb_array_length(p_plan) <> v_roster_count
    or exists (
      select 1
      from jsonb_array_elements(p_plan) as entry(value)
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

  if v_stage_type = 'team_time_trial' then
    if exists (
      select 1
      from jsonb_array_elements(p_plan) as entry(value)
      where jsonb_typeof(entry.value -> 'relaySharePct') is distinct from 'number'
        or (entry.value ->> 'relaySharePct')::numeric not between 0 and 100
    ) then
      raise exception using
        errcode = 'P0001',
        message = 'Un pourcentage de relais est invalide.';
    end if;

    select sum((entry.value ->> 'relaySharePct')::numeric)
    into v_relay_total
    from jsonb_array_elements(p_plan) as entry(value);

    if v_relay_total is distinct from 100 then
      raise exception using
        errcode = 'P0001',
        message = 'La répartition des relais doit totaliser exactement 100 %.';
    end if;
  end if;

  delete from public.race_time_trial_rider_plans as plan
  where plan.race_registration_id = v_registration_id
    and plan.stage_id = p_stage_id;

  insert into public.race_time_trial_rider_plans (
    race_registration_id,
    stage_id,
    rider_id,
    team_id,
    effort_mode,
    relay_share_pct,
    updated_at
  )
  select
    v_registration_id,
    p_stage_id,
    (entry.value ->> 'riderId')::uuid,
    v_team_id,
    entry.value ->> 'effortMode',
    case
      when v_stage_type = 'team_time_trial'
        then (entry.value ->> 'relaySharePct')::numeric
      else null
    end,
    clock_timestamp()
  from jsonb_array_elements(p_plan) as entry(value);

  get diagnostics v_updated_count = row_count;

  return query
  select p_stage_id, v_stage_number, v_updated_count;
end;
$$;

revoke all on function public.save_current_team_time_trial_preparation(
  uuid,
  uuid,
  jsonb
) from public, anon;

grant execute on function public.save_current_team_time_trial_preparation(
  uuid,
  uuid,
  jsonb
) to authenticated, service_role;

create function public.calculate_prepared_stage_form_cost(
  p_stage_id uuid,
  p_rider_id uuid,
  p_recovery numeric default 50
)
returns numeric
language plpgsql
stable
set search_path = public
as $$
declare
  v_stage_type text;
  v_base_cost numeric;
  v_effort_mode text := 'normal';
  v_effort_multiplier numeric := 1;
  v_relay_share numeric;
  v_roster_count integer;
  v_relay_multiplier numeric := 1;
begin
  v_base_cost := public.calculate_stage_form_cost(p_stage_id, p_recovery);

  select stage.stage_type
  into v_stage_type
  from public.stages as stage
  where stage.id = p_stage_id;

  if v_stage_type not in (
    'individual_time_trial',
    'team_time_trial',
    'prologue'
  ) then
    return v_base_cost;
  end if;

  select plan.effort_mode, plan.relay_share_pct
  into v_effort_mode, v_relay_share
  from public.race_time_trial_rider_plans as plan
  where plan.stage_id = p_stage_id
    and plan.rider_id = p_rider_id;

  v_effort_multiplier := case coalesce(v_effort_mode, 'normal')
    when 'conserve' then 0.7
    when 'all_in' then 1.35
    else 1
  end;

  if v_stage_type = 'team_time_trial' and v_relay_share is not null then
    select count(*)::integer
    into v_roster_count
    from public.race_time_trial_rider_plans as teammate_plan
    where teammate_plan.stage_id = p_stage_id
      and teammate_plan.race_registration_id = (
        select own_plan.race_registration_id
        from public.race_time_trial_rider_plans as own_plan
        where own_plan.stage_id = p_stage_id
          and own_plan.rider_id = p_rider_id
        limit 1
      );

    v_relay_multiplier := greatest(
      0.55,
      least(
        1.8,
        0.65 + (v_relay_share * greatest(1, v_roster_count) / 100) * 0.35
      )
    );
  end if;

  return round(greatest(1, v_base_cost * v_effort_multiplier * v_relay_multiplier), 1);
end;
$$;

do $migration$
declare
  v_definition text;
  v_old_call constant text :=
    'form_loss := public.calculate_stage_form_cost(' || chr(10) ||
    '        target_stage.id,' || chr(10) ||
    '        target_roster.recovery' || chr(10) ||
    '      );';
  v_new_call constant text :=
    'form_loss := public.calculate_prepared_stage_form_cost(' || chr(10) ||
    '        target_stage.id,' || chr(10) ||
    '        target_roster.rider_id,' || chr(10) ||
    '        target_roster.recovery' || chr(10) ||
    '      );';
begin
  select pg_get_functiondef(
    'public.settle_finished_race_conditions()'::regprocedure
  ) into v_definition;

  if position(v_new_call in v_definition) = 0 then
    if position(v_old_call in v_definition) = 0 then
      raise exception 'Appel du coût de forme de course introuvable.';
    end if;
    execute replace(v_definition, v_old_call, v_new_call);
  end if;
end;
$migration$;

revoke all on function public.calculate_prepared_stage_form_cost(
  uuid,
  uuid,
  numeric
) from public, anon;

grant execute on function public.calculate_prepared_stage_form_cost(
  uuid,
  uuid,
  numeric
) to authenticated, service_role;

comment on table public.race_time_trial_rider_plans is
  'Consignes d effort et de relais figées par coureur et par contre-la-montre.';

comment on function public.save_current_team_time_trial_preparation(
  uuid,
  uuid,
  jsonb
) is
  'Enregistre atomiquement un plan CLM complet et impose 100 % de relais pour un chrono par équipes.';

comment on function public.calculate_prepared_stage_form_cost(
  uuid,
  uuid,
  numeric
) is
  'Applique l effort CLM et la charge de relais au coût individuel de forme.';

notify pgrst, 'reload schema';

commit;
