begin;

create table public.race_stage_strategies (
  race_registration_id uuid not null
    references public.race_registrations(id)
    on delete cascade,
  stage_id uuid not null
    references public.stages(id)
    on delete cascade,
  team_id uuid not null
    references public.teams(id)
    on delete cascade,
  objective text not null default 'balanced',
  collective_posture text not null default 'balanced',
  breakaway_policy text not null default 'opportunistic',
  chase_policy text not null default 'dangerous_breakaway',
  lieutenant_rider_id uuid,
  danger_pacer_rider_id uuid,
  protector_rider_id uuid,
  breakaway_rider_id uuid,
  attack_orders jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now(),

  constraint race_stage_strategies_pkey
    primary key (race_registration_id, stage_id),
  constraint race_stage_strategies_team_stage_unique
    unique (team_id, stage_id),
  constraint race_stage_strategies_objective_allowed
    check (
      objective in (
        'balanced',
        'stage_win',
        'general_classification',
        'sprint',
        'mountain_points',
        'breakaway'
      )
    ),
  constraint race_stage_strategies_posture_allowed
    check (collective_posture in ('conservative', 'balanced', 'aggressive')),
  constraint race_stage_strategies_breakaway_policy_allowed
    check (breakaway_policy in ('avoid', 'opportunistic', 'target')),
  constraint race_stage_strategies_chase_policy_allowed
    check (
      chase_policy in (
        'never',
        'dangerous_breakaway',
        'protect_lead',
        'always'
      )
    ),
  constraint race_stage_strategies_attacks_array
    check (
      jsonb_typeof(attack_orders) = 'array'
      and jsonb_array_length(attack_orders) <= 2
    ),
  constraint race_stage_strategies_lieutenant_roster_fkey
    foreign key (race_registration_id, lieutenant_rider_id)
    references public.race_rosters(race_registration_id, rider_id)
    on delete cascade,
  constraint race_stage_strategies_danger_pacer_roster_fkey
    foreign key (race_registration_id, danger_pacer_rider_id)
    references public.race_rosters(race_registration_id, rider_id)
    on delete cascade,
  constraint race_stage_strategies_protector_roster_fkey
    foreign key (race_registration_id, protector_rider_id)
    references public.race_rosters(race_registration_id, rider_id)
    on delete cascade,
  constraint race_stage_strategies_breakaway_rider_roster_fkey
    foreign key (race_registration_id, breakaway_rider_id)
    references public.race_rosters(race_registration_id, rider_id)
    on delete cascade
);

create index race_stage_strategies_stage_id_idx
  on public.race_stage_strategies (stage_id, team_id);

create or replace function public.enforce_race_roster_stage_role_scope()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_registration_edition_id uuid;
  v_stage_edition_id uuid;
begin
  select
    registration.race_edition_id,
    stage.race_edition_id
  into
    v_registration_edition_id,
    v_stage_edition_id
  from public.race_registrations as registration
  cross join public.stages as stage
  where registration.id = new.race_registration_id
    and stage.id = new.stage_id;

  if not found
    or v_registration_edition_id is distinct from v_stage_edition_id
  then
    raise exception using
      errcode = '23514',
      message = 'Le rôle par étape doit appartenir à la même course que l inscription.';
  end if;

  return new;
end;
$$;

create function public.enforce_race_stage_strategy_scope()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_registration_edition_id uuid;
  v_stage_edition_id uuid;
  v_team_id uuid;
begin
  select
    registration.race_edition_id,
    stage.race_edition_id,
    team_season.team_id
  into
    v_registration_edition_id,
    v_stage_edition_id,
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
      message = 'La stratégie doit appartenir à la même course que l inscription.';
  end if;

  new.team_id := v_team_id;
  return new;
end;
$$;

revoke all on function public.enforce_race_stage_strategy_scope()
from public, anon, authenticated;

create trigger race_stage_strategies_scope_guard
before insert or update of race_registration_id, stage_id, team_id
on public.race_stage_strategies
for each row
execute function public.enforce_race_stage_strategy_scope();

alter table public.race_stage_strategies enable row level security;

revoke all on table public.race_stage_strategies
from public, anon, authenticated;

grant all privileges on table public.race_stage_strategies
to service_role;

create function public.get_current_team_race_preparation()
returns table (
  race_edition_id uuid,
  race_registration_id uuid,
  team_id uuid,
  stage_id uuid,
  rider_id uuid,
  rider_first_name text,
  rider_last_name text,
  general_role text,
  stage_role text,
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
    roster.race_role,
    stage_role.race_role,
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
  join public.stages as stage
    on stage.race_edition_id = edition.id
   and stage.status <> 'cancelled'
  left join public.race_roster_stage_roles as stage_role
    on stage_role.race_registration_id = registration.id
   and stage_role.rider_id = roster.rider_id
   and stage_role.stage_id = stage.id
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
to authenticated;

create function public.save_current_team_race_preparation(
  p_race_edition_id uuid,
  p_stage_id uuid,
  p_roles jsonb,
  p_strategy jsonb
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
  v_team_id uuid;
  v_stage_number integer;
  v_stage_status text;
  v_departure_at timestamptz;
  v_roster_count integer;
  v_updated_count integer;
  v_objective text;
  v_collective_posture text;
  v_breakaway_policy text;
  v_chase_policy text;
  v_lieutenant_rider_id uuid;
  v_danger_pacer_rider_id uuid;
  v_protector_rider_id uuid;
  v_breakaway_rider_id uuid;
  v_attack_orders jsonb;
  v_duty_rider_ids uuid[];
begin
  if auth.uid() is null then
    raise exception using
      errcode = '42501',
      message = 'Vous devez être connecté pour préparer une course.';
  end if;

  select
    stage.stage_number,
    stage.status,
    stage.departure_at
  into
    v_stage_number,
    v_stage_status,
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
      message = 'Aucune inscription acceptée ne permet de préparer cette course.';
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

  if p_strategy is null or jsonb_typeof(p_strategy) <> 'object' then
    raise exception using
      errcode = 'P0001',
      message = 'Les consignes tactiques transmises sont invalides.';
  end if;

  v_objective := coalesce(p_strategy ->> 'objective', 'balanced');
  v_collective_posture := coalesce(
    p_strategy ->> 'collectivePosture',
    'balanced'
  );
  v_breakaway_policy := coalesce(
    p_strategy ->> 'breakawayPolicy',
    'opportunistic'
  );
  v_chase_policy := coalesce(
    p_strategy ->> 'chasePolicy',
    'dangerous_breakaway'
  );
  v_attack_orders := coalesce(p_strategy -> 'attackOrders', '[]'::jsonb);

  if v_objective not in (
      'balanced',
      'stage_win',
      'general_classification',
      'sprint',
      'mountain_points',
      'breakaway'
    )
    or v_collective_posture not in ('conservative', 'balanced', 'aggressive')
    or v_breakaway_policy not in ('avoid', 'opportunistic', 'target')
    or v_chase_policy not in (
      'never',
      'dangerous_breakaway',
      'protect_lead',
      'always'
    )
  then
    raise exception using
      errcode = 'P0001',
      message = 'Une orientation tactique transmise est invalide.';
  end if;

  if exists (
    select 1
    from jsonb_each(p_strategy) as duty(key, value)
    where duty.key in (
      'lieutenantRiderId',
      'dangerPacerRiderId',
      'protectorRiderId',
      'breakawayRiderId'
    )
      and duty.value <> 'null'::jsonb
      and not (
        trim(both '"' from duty.value::text)
        ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      )
  ) then
    raise exception using
      errcode = 'P0001',
      message = 'Un coureur chargé d une mission est invalide.';
  end if;

  v_lieutenant_rider_id := nullif(p_strategy ->> 'lieutenantRiderId', '')::uuid;
  v_danger_pacer_rider_id := nullif(p_strategy ->> 'dangerPacerRiderId', '')::uuid;
  v_protector_rider_id := nullif(p_strategy ->> 'protectorRiderId', '')::uuid;
  v_breakaway_rider_id := nullif(p_strategy ->> 'breakawayRiderId', '')::uuid;
  v_duty_rider_ids := array_remove(
    array[
      v_lieutenant_rider_id,
      v_danger_pacer_rider_id,
      v_protector_rider_id,
      v_breakaway_rider_id
    ],
    null
  );

  if cardinality(v_duty_rider_ids) <> (
    select count(distinct duty_rider_id)
    from unnest(v_duty_rider_ids) as duty(duty_rider_id)
  ) then
    raise exception using
      errcode = 'P0001',
      message = 'Un même coureur ne peut pas cumuler deux missions spéciales.';
  end if;

  if exists (
    select 1
    from unnest(v_duty_rider_ids) as duty(duty_rider_id)
    left join public.race_rosters as roster
      on roster.race_registration_id = v_registration_id
     and roster.rider_id = duty.duty_rider_id
     and roster.status in ('selected', 'confirmed')
    where roster.id is null
  ) then
    raise exception using
      errcode = 'P0001',
      message = 'Chaque mission doit être confiée à un coureur encore engagé.';
  end if;

  if exists (
    select 1
    from unnest(v_duty_rider_ids) as duty(duty_rider_id)
    join jsonb_array_elements(p_roles) as role_entry(value)
      on (role_entry.value ->> 'riderId')::uuid = duty.duty_rider_id
    where role_entry.value ->> 'role' in ('leader', 'sprinter')
  ) then
    raise exception using
      errcode = 'P0001',
      message = 'Les missions spéciales doivent être confiées à des équipiers.';
  end if;

  if jsonb_typeof(v_attack_orders) <> 'array'
    or jsonb_array_length(v_attack_orders) > 2
  then
    raise exception using
      errcode = 'P0001',
      message = 'Deux ordres d attaque au maximum sont autorisés par étape.';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(v_attack_orders) as attack(value)
    where not (
      attack.value ->> 'riderId'
      ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    )
      or coalesce(attack.value ->> 'segmentNumber', '') !~ '^[1-9][0-9]*$'
      or coalesce(attack.value ->> 'intensity', '') not in (
        'measured',
        'strong',
        'all_in'
      )
      or coalesce(attack.value ->> 'condition', '') not in (
        'always',
        'high_energy',
        'leader_isolated',
        'gc_threat'
      )
  ) then
    raise exception using
      errcode = 'P0001',
      message = 'Un ordre d attaque est incomplet ou invalide.';
  end if;

  if jsonb_array_length(v_attack_orders) <> (
    select count(
      distinct concat(
        attack.value ->> 'riderId',
        ':',
        attack.value ->> 'segmentNumber'
      )
    )
    from jsonb_array_elements(v_attack_orders) as attack(value)
  ) then
    raise exception using
      errcode = 'P0001',
      message = 'Un même ordre d attaque ne peut pas être transmis deux fois.';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(v_attack_orders) as attack(value)
    left join public.race_rosters as roster
      on roster.race_registration_id = v_registration_id
     and roster.rider_id = (attack.value ->> 'riderId')::uuid
     and roster.status in ('selected', 'confirmed')
    left join public.stage_segments as segment
      on segment.stage_id = p_stage_id
     and segment.segment_number = (attack.value ->> 'segmentNumber')::integer
    where roster.id is null or segment.id is null
  ) then
    raise exception using
      errcode = 'P0001',
      message = 'Un ordre d attaque vise un coureur ou un tronçon indisponible.';
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

  insert into public.race_stage_strategies (
    race_registration_id,
    stage_id,
    team_id,
    objective,
    collective_posture,
    breakaway_policy,
    chase_policy,
    lieutenant_rider_id,
    danger_pacer_rider_id,
    protector_rider_id,
    breakaway_rider_id,
    attack_orders,
    updated_at
  )
  values (
    v_registration_id,
    p_stage_id,
    v_team_id,
    v_objective,
    v_collective_posture,
    v_breakaway_policy,
    v_chase_policy,
    v_lieutenant_rider_id,
    v_danger_pacer_rider_id,
    v_protector_rider_id,
    v_breakaway_rider_id,
    v_attack_orders,
    clock_timestamp()
  )
  on conflict on constraint race_stage_strategies_pkey
  do update set
    team_id = excluded.team_id,
    objective = excluded.objective,
    collective_posture = excluded.collective_posture,
    breakaway_policy = excluded.breakaway_policy,
    chase_policy = excluded.chase_policy,
    lieutenant_rider_id = excluded.lieutenant_rider_id,
    danger_pacer_rider_id = excluded.danger_pacer_rider_id,
    protector_rider_id = excluded.protector_rider_id,
    breakaway_rider_id = excluded.breakaway_rider_id,
    attack_orders = excluded.attack_orders,
    updated_at = excluded.updated_at;

  return query
  select p_stage_id, v_stage_number, v_updated_count;
end;
$$;

revoke all on function public.save_current_team_race_preparation(
  uuid,
  uuid,
  jsonb,
  jsonb
)
from public, anon;

grant execute on function public.save_current_team_race_preparation(
  uuid,
  uuid,
  jsonb,
  jsonb
)
to authenticated;

create table public.official_stage_simulation_claims (
  stage_id uuid primary key
    references public.stages(id)
    on delete cascade,
  race_edition_id uuid not null
    references public.race_editions(id)
    on delete cascade,
  claim_token uuid not null unique,
  claimed_at timestamptz not null default now()
);

create index official_stage_simulation_claims_age_idx
  on public.official_stage_simulation_claims (claimed_at);

alter table public.official_stage_simulation_claims enable row level security;

revoke all on table public.official_stage_simulation_claims
from public, anon, authenticated;

grant all privileges on table public.official_stage_simulation_claims
to service_role;

comment on table public.race_stage_strategies is
  'Une ligne compacte par équipe et par étape ; elle est chargée avec la startlist puis figée dans le scénario officiel.';

comment on table public.official_stage_simulation_claims is
  'Jeton court empêchant plusieurs fonctions serveur de calculer simultanément le même scénario officiel.';

comment on function public.save_current_team_race_preparation(
  uuid,
  uuid,
  jsonb,
  jsonb
) is
  'Enregistre atomiquement rôles, missions et ordres d attaque d une étape future pour l équipe authentifiée.';

commit;
