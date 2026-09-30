begin;

alter table public.riders
  add column if not exists height_cm numeric(5, 1),
  add column if not exists weight_kg numeric(5, 1),
  add column if not exists baseline_weight_kg numeric(5, 1),
  add column if not exists physiology_version smallint;

alter table public.riders
  add constraint riders_height_cm_range check (height_cm is null or height_cm between 145 and 210),
  add constraint riders_weight_kg_range check (weight_kg is null or weight_kg between 40 and 120),
  add constraint riders_baseline_weight_kg_range check (baseline_weight_kg is null or baseline_weight_kg between 40 and 120),
  add constraint riders_physiology_version_range check (physiology_version is null or physiology_version between 0 and 1);

alter table public.youth_scouting_candidates
  add column if not exists adult_height_cm numeric(5, 1),
  add column if not exists adult_weight_kg numeric(5, 1),
  add column if not exists growth_pattern text,
  add column if not exists physiology_version smallint;

alter table public.youth_academy_riders
  add column if not exists adult_height_cm numeric(5, 1),
  add column if not exists adult_weight_kg numeric(5, 1),
  add column if not exists growth_pattern text,
  add column if not exists physiology_version smallint;

create or replace function public.physiology_seed_fraction(p_seed text)
returns numeric
language sql
immutable
set search_path = public
as $$
  select (abs(hashtext(coalesce(p_seed, ''))::bigint) % 10000)::numeric / 9999.0;
$$;

create or replace function public.infer_rider_physiology_profile(
  p_mountain numeric,
  p_hills numeric,
  p_flat numeric,
  p_time_trial numeric,
  p_cobbles numeric,
  p_sprint numeric,
  p_acceleration numeric,
  p_endurance numeric,
  p_resistance numeric,
  p_recovery numeric,
  p_breakaway numeric
)
returns text
language sql
immutable
set search_path = public
as $$
  with scores(profile, score) as (
    values
      ('climber', coalesce(p_mountain, 0) * 1.08 + coalesce(p_endurance, 0) * 0.18),
      ('puncheur', coalesce(p_hills, 0) * 1.06 + coalesce(p_acceleration, 0) * 0.20),
      ('stage_racer', coalesce(p_mountain, 0) * 0.52 + coalesce(p_hills, 0) * 0.26 + coalesce(p_time_trial, 0) * 0.16 + coalesce(p_recovery, 0) * 0.12),
      ('northern_classics', coalesce(p_cobbles, 0) * 1.08 + coalesce(p_resistance, 0) * 0.20),
      ('rouleur', coalesce(p_time_trial, 0) * 0.68 + coalesce(p_flat, 0) * 0.42),
      ('breakaway', coalesce(p_breakaway, 0) * 1.02 + coalesce(p_endurance, 0) * 0.18),
      ('sprinter', coalesce(p_sprint, 0) * 1.08 + coalesce(p_acceleration, 0) * 0.20)
  )
  select profile from scores order by score desc, profile limit 1;
$$;

create or replace function public.get_physiology_reference_height(p_profile text)
returns numeric
language sql
immutable
set search_path = public
as $$
  select case p_profile
    when 'climber' then 170 when 'puncheur' then 175
    when 'stage_racer' then 176 when 'northern_classics' then 182
    when 'rouleur' then 183 when 'breakaway' then 176
    when 'sprinter' then 181 else 177 end::numeric;
$$;

create or replace function public.get_physiology_reference_weight(p_profile text)
returns numeric
language sql
immutable
set search_path = public
as $$
  select case p_profile
    when 'climber' then 59 when 'puncheur' then 66
    when 'stage_racer' then 65 when 'northern_classics' then 76
    when 'rouleur' then 74 when 'breakaway' then 66
    when 'sprinter' then 77 else 68 end::numeric;
$$;

create or replace function public.get_country_height_offset(p_country_id uuid)
returns numeric
language sql
stable
set search_path = public
as $$
  select case country.continent_code
    when 'AS' then -1.5
    when 'EU' then 0.5
    when 'OC' then 0.4
    when 'NA' then 0.2
    when 'SA' then -0.4
    else 0
  end::numeric
  from public.countries as country
  where country.id = p_country_id;
$$;

create or replace function public.generate_rider_height_cm(
  p_profile text,
  p_country_id uuid,
  p_seed text
)
returns numeric
language sql
stable
set search_path = public
as $$
  select round(least(202, greatest(154,
    public.get_physiology_reference_height(p_profile)
    + coalesce(public.get_country_height_offset(p_country_id), 0)
    + (public.physiology_seed_fraction(p_seed || ':height') - 0.5) * 10
  )), 1);
$$;

create or replace function public.generate_rider_weight_kg(
  p_profile text,
  p_height_cm numeric,
  p_seed text
)
returns numeric
language sql
immutable
set search_path = public
as $$
  select round(least(102, greatest(48,
    public.get_physiology_reference_weight(p_profile)
    + (p_height_cm - public.get_physiology_reference_height(p_profile)) * 0.35
    + (public.physiology_seed_fraction(p_seed || ':weight') - 0.5) * 5
  )), 1);
$$;

create or replace function public.generate_youth_growth_pattern(p_seed text)
returns text
language sql
immutable
set search_path = public
as $$
  select case
    when public.physiology_seed_fraction(p_seed || ':growth') < 0.15 then 'early_stop'
    when public.physiology_seed_fraction(p_seed || ':growth') < 0.40 then 'early'
    when public.physiology_seed_fraction(p_seed || ':growth') < 0.85 then 'steady'
    else 'late_spurt'
  end;
$$;

create or replace function public.get_youth_current_height_cm(
  p_adult_height_cm numeric,
  p_growth_pattern text,
  p_age integer
)
returns numeric
language sql
immutable
set search_path = public
as $$
  select round(p_adult_height_cm - case
    when p_age >= 17 then 0
    when p_growth_pattern = 'early_stop' then 0
    when p_growth_pattern = 'early' and p_age <= 15 then 2.5
    when p_growth_pattern = 'early' then 0.5
    when p_growth_pattern = 'late_spurt' and p_age <= 15 then 8
    when p_growth_pattern = 'late_spurt' then 5
    when p_age <= 15 then 5
    else 2
  end, 1);
$$;

create or replace function public.get_youth_current_weight_kg(
  p_adult_height_cm numeric,
  p_adult_weight_kg numeric,
  p_growth_pattern text,
  p_age integer
)
returns numeric
language sql
immutable
set search_path = public
as $$
  select round(
    p_adult_weight_kg * power(
      public.get_youth_current_height_cm(p_adult_height_cm, p_growth_pattern, p_age)
      / p_adult_height_cm,
      2
    ),
    1
  );
$$;

-- Neutral backfill: existing riders receive coherent visible measurements,
-- while version 0 cancels their intrinsic morphology at simulation time.
with current_ratings as (
  select distinct on (rating.rider_id)
    rating.*,
    public.infer_rider_physiology_profile(
      rating.mountain, rating.hills, rating.flat, rating.time_trial,
      rating.cobbles, rating.sprint, rating.acceleration, rating.endurance,
      rating.resistance, rating.recovery, rating.breakaway
    ) as profile
  from public.rider_season_ratings as rating
  join public.seasons as season on season.id = rating.season_id
  order by rating.rider_id, season.game_year desc
), generated as (
  select
    rider.id,
    public.generate_rider_height_cm(rating.profile, rider.country_id, rider.id::text) as height_cm,
    rating.profile
  from public.riders as rider
  join current_ratings as rating on rating.rider_id = rider.id
)
update public.riders as rider
set
  height_cm = generated.height_cm,
  weight_kg = public.generate_rider_weight_kg(generated.profile, generated.height_cm, rider.id::text),
  baseline_weight_kg = public.generate_rider_weight_kg(generated.profile, generated.height_cm, rider.id::text),
  physiology_version = 0
from generated
where generated.id = rider.id
  and rider.height_cm is null;

update public.youth_scouting_candidates as candidate
set
  adult_height_cm = public.generate_rider_height_cm(candidate.archetype, candidate.country_id, candidate.id::text),
  adult_weight_kg = public.generate_rider_weight_kg(
    candidate.archetype,
    public.generate_rider_height_cm(candidate.archetype, candidate.country_id, candidate.id::text),
    candidate.id::text
  ),
  growth_pattern = public.generate_youth_growth_pattern(candidate.id::text),
  physiology_version = 0
where candidate.adult_height_cm is null;

update public.youth_academy_riders as academy
set
  adult_height_cm = coalesce(candidate.adult_height_cm, public.generate_rider_height_cm(academy.archetype, academy.country_id, academy.id::text)),
  adult_weight_kg = coalesce(candidate.adult_weight_kg, public.generate_rider_weight_kg(
    academy.archetype,
    public.generate_rider_height_cm(academy.archetype, academy.country_id, academy.id::text),
    academy.id::text
  )),
  growth_pattern = coalesce(candidate.growth_pattern, public.generate_youth_growth_pattern(academy.id::text)),
  physiology_version = 0
from public.youth_scouting_candidates as candidate
where candidate.id = academy.candidate_id
  and academy.adult_height_cm is null;

create or replace function public.assign_youth_candidate_physiology()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.adult_height_cm is null then
    new.adult_height_cm := public.generate_rider_height_cm(new.archetype, new.country_id, new.id::text);
    new.adult_weight_kg := public.generate_rider_weight_kg(new.archetype, new.adult_height_cm, new.id::text);
    new.growth_pattern := public.generate_youth_growth_pattern(new.id::text);
    new.physiology_version := 1;
  end if;
  return new;
end;
$$;

drop trigger if exists assign_youth_candidate_physiology_before_insert
  on public.youth_scouting_candidates;
create trigger assign_youth_candidate_physiology_before_insert
before insert on public.youth_scouting_candidates
for each row execute function public.assign_youth_candidate_physiology();

create or replace function public.copy_candidate_physiology_to_academy()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_candidate public.youth_scouting_candidates%rowtype;
begin
  if new.adult_height_cm is null then
    select * into v_candidate
    from public.youth_scouting_candidates
    where id = new.candidate_id;
    new.adult_height_cm := v_candidate.adult_height_cm;
    new.adult_weight_kg := v_candidate.adult_weight_kg;
    new.growth_pattern := v_candidate.growth_pattern;
    new.physiology_version := v_candidate.physiology_version;
  end if;
  return new;
end;
$$;

drop trigger if exists copy_candidate_physiology_to_academy_before_insert
  on public.youth_academy_riders;
create trigger copy_candidate_physiology_to_academy_before_insert
before insert on public.youth_academy_riders
for each row execute function public.copy_candidate_physiology_to_academy();

create or replace function public.assign_new_professional_physiology()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_rider public.riders%rowtype;
  v_profile text;
  v_height numeric;
  v_weight numeric;
begin
  select * into v_rider from public.riders where id = new.rider_id for update;
  if v_rider.height_cm is not null then return new; end if;
  v_profile := public.infer_rider_physiology_profile(
    new.mountain, new.hills, new.flat, new.time_trial, new.cobbles,
    new.sprint, new.acceleration, new.endurance, new.resistance,
    new.recovery, new.breakaway
  );
  v_height := public.generate_rider_height_cm(v_profile, v_rider.country_id, v_rider.id::text);
  v_weight := public.generate_rider_weight_kg(v_profile, v_height, v_rider.id::text);
  update public.riders set
    height_cm = v_height,
    weight_kg = v_weight,
    baseline_weight_kg = v_weight,
    physiology_version = 1
  where id = new.rider_id;
  return new;
end;
$$;

drop trigger if exists assign_new_professional_physiology_after_rating
  on public.rider_season_ratings;
create trigger assign_new_professional_physiology_after_rating
after insert on public.rider_season_ratings
for each row execute function public.assign_new_professional_physiology();

create or replace function public.copy_promoted_youth_physiology()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.promoted_rider_id is not null
    and new.promoted_rider_id is distinct from old.promoted_rider_id
  then
    update public.riders set
      height_cm = new.adult_height_cm,
      weight_kg = new.adult_weight_kg,
      baseline_weight_kg = new.adult_weight_kg,
      physiology_version = new.physiology_version
    where id = new.promoted_rider_id;
  end if;
  return new;
end;
$$;

drop trigger if exists copy_promoted_youth_physiology_after_update
  on public.youth_academy_riders;
create trigger copy_promoted_youth_physiology_after_update
after update of promoted_rider_id on public.youth_academy_riders
for each row execute function public.copy_promoted_youth_physiology();

create table public.rider_weight_events (
  id uuid primary key default gen_random_uuid(),
  rider_id uuid not null references public.riders(id) on delete cascade,
  team_id uuid references public.teams(id) on delete set null,
  season_id uuid references public.seasons(id) on delete set null,
  season_day_id uuid references public.season_days(id) on delete set null,
  game_day_index integer not null,
  source text not null,
  weight_before_kg numeric(5, 1) not null,
  weight_delta_kg numeric(4, 1) not null,
  weight_after_kg numeric(5, 1) not null,
  form_cost numeric(5, 1) not null default 0,
  source_reference text not null,
  applied_at timestamptz not null default now(),
  constraint rider_weight_events_source_allowed check (source in ('supplement', 'weight_cut')),
  constraint rider_weight_events_weight_range check (
    weight_before_kg between 40 and 120 and weight_after_kg between 40 and 120
  ),
  constraint rider_weight_events_reference_unique unique (source_reference)
);

create index rider_weight_events_rider_game_day_idx
  on public.rider_weight_events (rider_id, game_day_index desc);

alter table public.rider_weight_events enable row level security;
create policy rider_weight_events_read_managed_team
on public.rider_weight_events for select to authenticated
using (
  exists (
    select 1
    from public.team_manager_assignments as assignment
    join public.sporting_directors as director
      on director.id = assignment.sporting_director_id
    where assignment.team_id = rider_weight_events.team_id
      and assignment.role = 'general_manager'
      and assignment.status = 'active'
      and director.auth_user_id = auth.uid()
      and director.status = 'active'
  )
);

alter table public.rider_nutrition_interventions
  add column if not exists weight_before_kg numeric(5, 1),
  add column if not exists weight_delta_kg numeric(4, 1) not null default 0,
  add column if not exists weight_after_kg numeric(5, 1);

create or replace function public.apply_supplement_weight_risk()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rider public.riders%rowtype;
  v_team_id uuid;
  v_season_id uuid;
  v_game_year integer;
  v_day_number integer;
  v_risk_pct numeric;
  v_gain numeric;
  v_roll numeric;
begin
  select * into v_rider from public.riders where id = new.rider_id for update;
  if v_rider.weight_kg is null then return new; end if;
  select team_season.team_id, season.id, season.game_year, day.day_number
  into v_team_id, v_season_id, v_game_year, v_day_number
  from public.team_seasons as team_season
  join public.seasons as season on season.id = team_season.season_id
  join public.season_days as day on day.id = new.season_day_id
  where team_season.id = new.team_season_id;

  v_risk_pct := case new.intervention_code
    when 'recovery_snack' then 5
    when 'tailored_plan' then 8
    else 12
  end - greatest(0, new.nutritionist_level - 1) * 0.75;
  v_gain := case new.intervention_code when 'elite_recharge' then 0.2 else 0.1 end;
  v_roll := public.physiology_seed_fraction(new.id::text || ':supplement') * 100;
  new.weight_before_kg := v_rider.weight_kg;
  new.weight_delta_kg := case when v_roll < v_risk_pct then v_gain else 0 end;
  new.weight_after_kg := least(120, v_rider.weight_kg + new.weight_delta_kg);

  if new.weight_delta_kg > 0 then
    update public.riders set weight_kg = new.weight_after_kg where id = new.rider_id;
    insert into public.rider_weight_events (
      rider_id, team_id, season_id, season_day_id, game_day_index, source,
      weight_before_kg, weight_delta_kg, weight_after_kg, source_reference
    ) values (
      new.rider_id, v_team_id, v_season_id, new.season_day_id,
      v_game_year * 28 + v_day_number - 1, 'supplement',
      new.weight_before_kg, new.weight_delta_kg, new.weight_after_kg,
      'nutrition-intervention:' || new.id::text
    );
  end if;
  return new;
end;
$$;

drop trigger if exists apply_supplement_weight_risk_before_insert
  on public.rider_nutrition_interventions;
create trigger apply_supplement_weight_risk_before_insert
before insert on public.rider_nutrition_interventions
for each row execute function public.apply_supplement_weight_risk();

create or replace function public.apply_current_team_weight_cut(
  p_rider_id uuid,
  p_weight_loss_kg numeric
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_context record;
  v_rider public.riders%rowtype;
  v_event_id uuid := gen_random_uuid();
  v_form_cost numeric;
  v_form_before numeric;
  v_form_after numeric;
  v_fatigue integer;
  v_minimum_weight numeric;
  v_game_day integer;
begin
  if auth.uid() is null then raise exception 'Authentification requise.'; end if;
  if p_weight_loss_kg not in (0.2, 0.4, 0.6, 0.8, 1.0) then
    raise exception 'Choisissez une perte de poids comprise entre 0,2 et 1 kg.';
  end if;
  perform public.settle_current_health_and_form_throttled();

  select
    assignment.team_id, team_season.id as team_season_id,
    season.id as season_id, season.game_year, season.current_day_number,
    day.id as season_day_id
  into v_context
  from public.sporting_directors as director
  join public.team_manager_assignments as assignment
    on assignment.sporting_director_id = director.id
   and assignment.role = 'general_manager' and assignment.status = 'active'
  join public.seasons as season on season.status = 'active'
  join public.team_seasons as team_season
    on team_season.team_id = assignment.team_id and team_season.season_id = season.id
  join public.season_days as day
    on day.season_id = season.id and day.day_number = season.current_day_number
  join public.rider_contracts as contract
    on contract.team_id = assignment.team_id and contract.rider_id = p_rider_id
   and contract.status = 'active'
  where director.auth_user_id = auth.uid() and director.status = 'active'
    and exists (
      select 1 from public.staff_contracts as staff_contract
      join public.staff_members as member on member.id = staff_contract.staff_member_id
      where staff_contract.team_id = assignment.team_id
        and staff_contract.status = 'active' and member.role = 'nutritionist'
    )
  limit 1;
  if v_context is null then
    raise exception 'Un nutritionniste actif et un coureur de votre effectif sont requis.';
  end if;

  v_game_day := v_context.game_year * 28 + v_context.current_day_number - 1;
  if exists (
    select 1 from public.rider_weight_events as event
    where event.rider_id = p_rider_id and event.source = 'weight_cut'
      and event.game_day_index > v_game_day - 5
  ) then
    raise exception 'Un programme d’affûtage ne peut être réalisé que tous les cinq jours.';
  end if;

  select * into v_rider from public.riders where id = p_rider_id for update;
  if v_rider.weight_kg is null or v_rider.height_cm is null then
    raise exception 'Le physique de ce coureur n’est pas encore disponible.';
  end if;
  v_minimum_weight := greatest(45, round(18 * power(v_rider.height_cm / 100.0, 2), 1));
  if v_rider.weight_kg - p_weight_loss_kg < v_minimum_weight then
    raise exception 'Ce programme ferait descendre le coureur sous son poids de sécurité.';
  end if;

  select state.form, state.fatigue into v_form_before, v_fatigue
  from public.rider_condition_states as state
  join public.season_days as state_day on state_day.id = state.season_day_id
  where state.rider_id = p_rider_id and state_day.season_id = v_context.season_id
    and state_day.day_number <= v_context.current_day_number
  order by state_day.day_number desc, state.updated_at desc limit 1;
  v_form_before := coalesce(v_form_before, 75);
  v_fatigue := coalesce(v_fatigue, 0);
  v_form_cost := p_weight_loss_kg * 20;
  if v_form_before < v_form_cost then
    raise exception 'La forme du coureur est insuffisante pour ce programme.';
  end if;
  v_form_after := v_form_before - v_form_cost;

  update public.riders set weight_kg = round(weight_kg - p_weight_loss_kg, 1)
  where id = p_rider_id;
  insert into public.rider_condition_states (rider_id, season_day_id, form, fatigue, source)
  values (p_rider_id, v_context.season_day_id, v_form_after, v_fatigue, 'nutrition')
  on conflict (rider_id, season_day_id) do update set
    form = greatest(0, public.rider_condition_states.form - v_form_cost),
    source = 'nutrition', updated_at = now();

  insert into public.rider_weight_events (
    id, rider_id, team_id, season_id, season_day_id, game_day_index, source,
    weight_before_kg, weight_delta_kg, weight_after_kg, form_cost, source_reference
  ) values (
    v_event_id, p_rider_id, v_context.team_id, v_context.season_id,
    v_context.season_day_id, v_game_day, 'weight_cut', v_rider.weight_kg,
    -p_weight_loss_kg, round(v_rider.weight_kg - p_weight_loss_kg, 1),
    v_form_cost, 'weight-cut:' || v_event_id::text
  );
  return v_event_id;
end;
$$;

revoke all on function public.apply_current_team_weight_cut(uuid, numeric)
from public, anon;
grant execute on function public.apply_current_team_weight_cut(uuid, numeric)
to authenticated, service_role;

drop function if exists public.get_race_calendar_rider_context(uuid[]);
create function public.get_race_calendar_rider_context(p_rider_ids uuid[])
returns table (
  id uuid, country_id uuid, avatar_profile_key text, avatar_seed bigint,
  career_race_days integer, height_cm numeric, weight_kg numeric,
  baseline_weight_kg numeric, physiology_version smallint,
  special_ability_codes jsonb, performance_preparations jsonb,
  championship_titles jsonb
)
language sql stable security definer set search_path = ''
as $$
  with requested_riders as (
    select distinct requested.id
    from unnest(coalesce(p_rider_ids, array[]::uuid[])) as requested(id)
  )
  select
    rider.id, rider.country_id, rider.avatar_profile_key, rider.avatar_seed,
    rider.career_race_days, rider.height_cm, rider.weight_kg,
    rider.baseline_weight_kg, rider.physiology_version,
    coalesce(abilities.values, '[]'::jsonb),
    coalesce(preparations.values, '[]'::jsonb),
    coalesce(titles.values, '[]'::jsonb)
  from requested_riders as requested
  join public.riders as rider on rider.id = requested.id
  left join lateral (
    select jsonb_agg(ability.ability_code order by ability.ability_code) as values
    from public.rider_special_abilities as ability where ability.rider_id = rider.id
  ) as abilities on true
  left join lateral (
    select jsonb_agg(jsonb_build_object(
      'preparation_type', preparation.preparation_type,
      'bonus_start_game_day', preparation.bonus_start_game_day,
      'bonus_end_game_day', preparation.bonus_end_game_day,
      'rating_bonus', preparation.rating_bonus
    ) order by preparation.bonus_start_game_day, preparation.preparation_type) as values
    from public.rider_performance_preparations as preparation
    where preparation.rider_id = rider.id and preparation.status <> 'cancelled'
  ) as preparations on true
  left join lateral (
    select jsonb_agg(jsonb_build_object(
      'championship_type', title.championship_type,
      'country_code', country.iso_alpha2,
      'country_name', country.name
    ) order by title.championship_type) as values
    from public.rider_national_championship_titles as title
    left join public.countries as country on country.id = title.country_id
    where title.rider_id = rider.id and title.relinquished_at is null
  ) as titles on true
  order by rider.id;
$$;

revoke all on function public.get_race_calendar_rider_context(uuid[])
from public, anon, authenticated;
grant execute on function public.get_race_calendar_rider_context(uuid[])
to service_role;

comment on column public.riders.physiology_version is
  'Version 0 neutralise la morphologie initiale des coureurs existants; les variations de poids restent actives. Version 1 active la loterie morphologique des nouveaux coureurs.';
comment on function public.apply_current_team_weight_cut(uuid, numeric) is
  'Programme d’affûtage réglable de 0,2 à 1 kg, coûtant 4 points de forme par tranche et limité à une fois tous les cinq jours.';

notify pgrst, 'reload schema';

commit;
