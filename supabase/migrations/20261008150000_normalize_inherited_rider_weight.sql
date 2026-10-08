begin;
set local lock_timeout = '2s';
set local statement_timeout = '20s';

-- Match the stable priority of the application's native-rating inference,
-- including exact score ties. Equipment and race roles never enter this rule.
create or replace function public.infer_rider_physiology_profile(
  p_mountain numeric, p_hills numeric, p_flat numeric, p_time_trial numeric,
  p_cobbles numeric, p_sprint numeric, p_acceleration numeric,
  p_endurance numeric, p_resistance numeric, p_recovery numeric, p_breakaway numeric
)
returns text language sql immutable set search_path = public as $$
  with scores(profile, score, priority) as (values
    ('climber', coalesce(p_mountain, 0) * 1.08 + coalesce(p_endurance, 0) * 0.18, 1),
    ('puncheur', coalesce(p_hills, 0) * 1.06 + coalesce(p_acceleration, 0) * 0.20, 2),
    ('stage_racer', coalesce(p_mountain, 0) * 0.52 + coalesce(p_hills, 0) * 0.26 + coalesce(p_time_trial, 0) * 0.16 + coalesce(p_recovery, 0) * 0.12, 3),
    ('northern_classics', coalesce(p_cobbles, 0) * 1.08 + coalesce(p_resistance, 0) * 0.20, 4),
    ('rouleur', coalesce(p_time_trial, 0) * 0.68 + coalesce(p_flat, 0) * 0.42, 5),
    ('breakaway', coalesce(p_breakaway, 0) * 1.02 + coalesce(p_endurance, 0) * 0.18, 6),
    ('sprinter', coalesce(p_sprint, 0) * 1.08 + coalesce(p_acceleration, 0) * 0.20, 7)
  ) select profile from scores order by score desc, priority limit 1;
$$;

create or replace function public.get_rider_initial_weight_limit_kg(
  p_profile text, p_height_cm numeric
)
returns numeric language sql immutable strict set search_path = public as $$
  select floor((public.get_physiology_reference_weight(p_profile) /
    power(public.get_physiology_reference_height(p_profile) / 100.0, 2) +
    case p_profile when 'climber' then 0.5 when 'puncheur' then 0.7
      when 'stage_racer' then 0.6 when 'northern_classics' then 1
      when 'rouleur' then 1 when 'sprinter' then 1 else 0.8 end) *
    power(p_height_cm / 100.0, 2) * 10) / 10;
$$;

-- Preserve the seed, size and variety; only clip a random excess at generation.
create or replace function public.generate_rider_weight_kg(
  p_profile text, p_height_cm numeric, p_seed text
)
returns numeric language sql immutable set search_path = public as $$
  select least(public.get_rider_initial_weight_limit_kg(p_profile, p_height_cm),
    round(least(102, greatest(48,
      public.get_physiology_reference_weight(p_profile) +
      (p_height_cm - public.get_physiology_reference_height(p_profile)) * 0.35 +
      (public.physiology_seed_fraction(p_seed || ':weight') - 0.5) * 5
    )), 1));
$$;

-- Also cover pre-filled physiques and youth whose actual native ratings differ
-- from their scouting archetype. No rating UPDATE trigger: training remains free
-- to change the natural profile without silently changing current body weight.
create or replace function public.assign_new_professional_physiology()
returns trigger language plpgsql set search_path = public as $$
declare
  v_rider public.riders%rowtype;
  v_profile text;
  v_height numeric;
  v_weight numeric;
  v_limit numeric;
begin
  select * into v_rider from public.riders where id = new.rider_id for update;
  v_profile := public.infer_rider_physiology_profile(
    new.mountain, new.hills, new.flat, new.time_trial, new.cobbles,
    new.sprint, new.acceleration, new.endurance, new.resistance,
    new.recovery, new.breakaway);
  if v_rider.height_cm is null then
    v_height := public.generate_rider_height_cm(v_profile, v_rider.country_id, v_rider.id::text);
    v_weight := public.generate_rider_weight_kg(v_profile, v_height, v_rider.id::text);
    update public.riders set height_cm = v_height, weight_kg = v_weight,
      baseline_weight_kg = v_weight, physiology_version = 1 where id = new.rider_id;
  else
    v_limit := public.get_rider_initial_weight_limit_kg(v_profile, v_rider.height_cm);
    if v_rider.baseline_weight_kg > v_limit then
      update public.riders set
        weight_kg = greatest(40, weight_kg - (baseline_weight_kg - v_limit)),
        baseline_weight_kg = v_limit
      where id = new.rider_id;
    end if;
  end if;
  return new;
end;
$$;

create or replace function public.copy_promoted_youth_physiology()
returns trigger language plpgsql set search_path = public as $$
declare
  v_profile text;
  v_weight numeric;
begin
  if new.promoted_rider_id is not null
    and new.promoted_rider_id is distinct from old.promoted_rider_id then
    select public.infer_rider_physiology_profile(
      rating.mountain, rating.hills, rating.flat, rating.time_trial, rating.cobbles,
      rating.sprint, rating.acceleration, rating.endurance, rating.resistance,
      rating.recovery, rating.breakaway) into v_profile
    from public.rider_season_ratings rating
    join public.seasons season on season.id = rating.season_id
    where rating.rider_id = new.promoted_rider_id
    order by case when season.status = 'active' then 0 else 1 end,
      season.game_year desc limit 1;
    v_weight := least(new.adult_weight_kg,
      public.get_rider_initial_weight_limit_kg(coalesce(v_profile, new.archetype), new.adult_height_cm));
    update public.riders set height_cm = new.adult_height_cm,
      weight_kg = v_weight, baseline_weight_kg = v_weight,
      physiology_version = new.physiology_version
    where id = new.promoted_rider_id;
  end if;
  return new;
end;
$$;

-- Retain recoverable before/after values without inventing supplement doses or
-- weight cuts (which would affect their histories, cooldowns or season totals).
create table if not exists public.initial_rider_weight_corrections (
  entity_kind text not null check (entity_kind in ('rider', 'candidate', 'academy')),
  entity_id uuid not null,
  natural_profile text not null,
  height_cm numeric(5,1) not null,
  weight_before_kg numeric(5,1) not null,
  weight_after_kg numeric(5,1) not null,
  baseline_before_kg numeric(5,1) not null,
  baseline_after_kg numeric(5,1) not null,
  corrected_at timestamptz not null default now(),
  primary key (entity_kind, entity_id)
);
alter table public.initial_rider_weight_corrections enable row level security;
revoke all on table public.initial_rider_weight_corrections from public, anon, authenticated;
grant all on table public.initial_rider_weight_corrections to service_role;

with current_ratings as (
  select distinct on (rating.rider_id) rating.rider_id,
    public.infer_rider_physiology_profile(rating.mountain, rating.hills, rating.flat,
      rating.time_trial, rating.cobbles, rating.sprint, rating.acceleration,
      rating.endurance, rating.resistance, rating.recovery, rating.breakaway) as profile
  from public.rider_season_ratings rating
  join public.seasons season on season.id = rating.season_id
  order by rating.rider_id, case when season.status = 'active' then 0 else 1 end,
    season.game_year desc
), targets as (
  select rider.*, rating.profile,
    public.get_rider_initial_weight_limit_kg(rating.profile, rider.height_cm) as maximum_weight
  from public.riders rider join current_ratings rating on rating.rider_id = rider.id
  where rider.weight_kg is not null and rider.baseline_weight_kg is not null
    and rider.height_cm is not null
    and rider.baseline_weight_kg > public.get_rider_initial_weight_limit_kg(rating.profile, rider.height_cm)
  for update of rider
), audited as (
  insert into public.initial_rider_weight_corrections
    (entity_kind, entity_id, natural_profile, height_cm, weight_before_kg,
      weight_after_kg, baseline_before_kg, baseline_after_kg)
  select 'rider', id, profile, height_cm, weight_kg,
    greatest(40, weight_kg - (baseline_weight_kg - maximum_weight)),
    baseline_weight_kg, maximum_weight from targets
  on conflict (entity_kind, entity_id) do nothing
  returning *
)
update public.riders rider set weight_kg = audited.weight_after_kg,
  baseline_weight_kg = audited.baseline_after_kg
from audited where audited.entity_kind = 'rider' and audited.entity_id = rider.id;

with targets as (
  select candidate.*, public.get_rider_initial_weight_limit_kg(archetype, adult_height_cm) as maximum_weight
  from public.youth_scouting_candidates candidate
  where adult_weight_kg > public.get_rider_initial_weight_limit_kg(archetype, adult_height_cm)
  for update
), audited as (
  insert into public.initial_rider_weight_corrections
    (entity_kind, entity_id, natural_profile, height_cm, weight_before_kg,
      weight_after_kg, baseline_before_kg, baseline_after_kg)
  select 'candidate', id, archetype, adult_height_cm, adult_weight_kg,
    maximum_weight, adult_weight_kg, maximum_weight from targets
  on conflict (entity_kind, entity_id) do nothing returning *
)
update public.youth_scouting_candidates candidate set adult_weight_kg = audited.weight_after_kg
from audited where audited.entity_kind = 'candidate' and audited.entity_id = candidate.id;

with targets as (
  select academy.*, public.get_rider_initial_weight_limit_kg(archetype, adult_height_cm) as maximum_weight
  from public.youth_academy_riders academy
  where adult_weight_kg > public.get_rider_initial_weight_limit_kg(archetype, adult_height_cm)
  for update
), audited as (
  insert into public.initial_rider_weight_corrections
    (entity_kind, entity_id, natural_profile, height_cm, weight_before_kg,
      weight_after_kg, baseline_before_kg, baseline_after_kg)
  select 'academy', id, archetype, adult_height_cm, adult_weight_kg,
    maximum_weight, adult_weight_kg, maximum_weight from targets
  on conflict (entity_kind, entity_id) do nothing returning *
)
update public.youth_academy_riders academy set adult_weight_kg = audited.weight_after_kg
from audited where audited.entity_kind = 'academy' and audited.entity_id = academy.id;

notify pgrst, 'reload schema';
commit;
