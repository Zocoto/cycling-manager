begin;
set local lock_timeout = '2s';
set local statement_timeout = '20s';

create or replace function public.get_rider_initial_minimum_power_weight_kg(p_profile text, p_height_cm numeric)
returns numeric language sql immutable strict set search_path = public as $$
  select case when p_profile in ('rouleur', 'northern_classics', 'sprinter') then
    ceil((public.get_physiology_reference_weight(p_profile) /
      power(public.get_physiology_reference_height(p_profile) / 100.0, 2) - 1) *
      power(p_height_cm / 100.0, 2) * 10) / 10 else null end;
$$;
create or replace function public.get_rider_typical_power_weight_kg(p_profile text, p_height_cm numeric)
returns numeric language sql immutable strict set search_path = public as $$
  select round(public.get_physiology_reference_weight(p_profile) /
    power(public.get_physiology_reference_height(p_profile) / 100.0, 2) *
    power(p_height_cm / 100.0, 2), 1);
$$;

-- Keep 5% modest excess and all deterministic variation, but a newly generated
-- power specialist cannot start below their native profile's lower threshold.
create or replace function public.generate_rider_weight_kg(p_profile text, p_height_cm numeric, p_seed text)
returns numeric language sql immutable set search_path = public as $$
  with physique as (
    select public.get_rider_initial_weight_limit_kg(p_profile, p_height_cm) as healthy_limit,
      coalesce(public.get_rider_initial_minimum_power_weight_kg(p_profile, p_height_cm), 40) as healthy_minimum,
      public.get_rider_initial_overweight_allowance_bmi(p_seed) as excess_bmi,
      public.get_physiology_reference_weight(p_profile) /
        power(public.get_physiology_reference_height(p_profile) / 100.0, 2) +
        case p_profile when 'climber' then 0.5 when 'puncheur' then 0.7
          when 'stage_racer' then 0.6 when 'northern_classics' then 1
          when 'rouleur' then 1 when 'sprinter' then 1 else 0.8 end as threshold_bmi
  )
  select case when excess_bmi > 0 then
    least(120, floor((threshold_bmi + 0.75) * power(p_height_cm / 100.0, 2) * 10) / 10,
      greatest(ceil((threshold_bmi + 0.15) * power(p_height_cm / 100.0, 2) * 10) / 10,
        round((threshold_bmi + excess_bmi) * power(p_height_cm / 100.0, 2), 1)))
  else greatest(healthy_minimum, least(healthy_limit, round(least(102, greatest(48,
    case when p_profile in ('rouleur', 'northern_classics', 'sprinter')
      then public.get_rider_typical_power_weight_kg(p_profile, p_height_cm)
      else public.get_physiology_reference_weight(p_profile) +
        (p_height_cm - public.get_physiology_reference_height(p_profile)) * 0.35 end +
    (public.physiology_seed_fraction(p_seed || ':weight') - 0.5) * 5)), 1))) end from physique;
$$;

create or replace function public.assign_new_professional_physiology()
returns trigger language plpgsql set search_path = public as $$
declare v_rider public.riders%rowtype; v_profile text; v_height numeric; v_weight numeric; v_minimum numeric;
begin
  select * into v_rider from public.riders where id = new.rider_id for update;
  v_profile := public.infer_rider_physiology_profile(new.mountain, new.hills, new.flat,
    new.time_trial, new.cobbles, new.sprint, new.acceleration, new.endurance,
    new.resistance, new.recovery, new.breakaway);
  if v_rider.height_cm is null then
    v_height := public.generate_rider_height_cm(v_profile, v_rider.country_id, v_rider.id::text);
    v_weight := public.generate_rider_weight_kg(v_profile, v_height, v_rider.id::text);
    update public.riders set height_cm = v_height, weight_kg = v_weight,
      baseline_weight_kg = v_weight, physiology_version = 1 where id = new.rider_id;
  elsif not exists (select 1 from public.rider_season_ratings
    where rider_id = new.rider_id and id <> new.id) then
    -- Promotion can copy the youth physique before its native ratings exist.
    -- Only the first native rating checks it; never erase a paid programme at
    -- season renewal, nor force a diet on a rare overweight birth.
    v_minimum := public.get_rider_initial_minimum_power_weight_kg(v_profile, v_rider.height_cm);
    if v_rider.baseline_weight_kg < v_minimum then
      v_weight := public.get_rider_typical_power_weight_kg(v_profile, v_rider.height_cm);
      update public.riders set weight_kg = weight_kg + v_weight - baseline_weight_kg,
        baseline_weight_kg = v_weight where id = new.rider_id;
    end if;
  end if;
  return new;
end;
$$;
create or replace function public.copy_promoted_youth_physiology()
returns trigger language plpgsql set search_path = public as $$
declare v_profile text; v_weight numeric;
begin
  if new.promoted_rider_id is not null and new.promoted_rider_id is distinct from old.promoted_rider_id then
    select public.infer_rider_physiology_profile(rating.mountain, rating.hills, rating.flat,
      rating.time_trial, rating.cobbles, rating.sprint, rating.acceleration, rating.endurance,
      rating.resistance, rating.recovery, rating.breakaway) into v_profile
    from public.rider_season_ratings rating join public.seasons season on season.id = rating.season_id
    where rating.rider_id = new.promoted_rider_id
    order by case when season.status = 'active' then 0 else 1 end, season.game_year desc limit 1;
    v_profile := coalesce(v_profile, new.archetype);
    v_weight := new.adult_weight_kg;
    if v_weight < public.get_rider_initial_minimum_power_weight_kg(v_profile, new.adult_height_cm) then
      v_weight := public.get_rider_typical_power_weight_kg(v_profile, new.adult_height_cm);
    end if;
    update public.riders set height_cm = new.adult_height_cm, weight_kg = v_weight,
      baseline_weight_kg = v_weight, physiology_version = new.physiology_version
    where id = new.promoted_rider_id;
  end if;
  return new;
end;
$$;

-- Recoverable one-off correction of inherited baselines. Preserve every
-- current-minus-baseline delta, including paid affûtage and supplement gains.
create table if not exists public.initial_rider_underweight_corrections (
  entity_kind text not null check (entity_kind in ('rider', 'candidate', 'academy')),
  entity_id uuid not null, natural_profile text not null, height_cm numeric(5,1) not null,
  weight_before_kg numeric(5,1) not null, weight_after_kg numeric(5,1) not null,
  baseline_before_kg numeric(5,1) not null, baseline_after_kg numeric(5,1) not null,
  corrected_at timestamptz not null default now(), primary key(entity_kind, entity_id)
);
alter table public.initial_rider_underweight_corrections enable row level security;
revoke all on public.initial_rider_underweight_corrections from public, anon, authenticated;
grant all on public.initial_rider_underweight_corrections to service_role;
with current_ratings as (
  select distinct on (rating.rider_id) rating.rider_id,
    public.infer_rider_physiology_profile(rating.mountain, rating.hills, rating.flat,
      rating.time_trial, rating.cobbles, rating.sprint, rating.acceleration,
      rating.endurance, rating.resistance, rating.recovery, rating.breakaway) as profile
  from public.rider_season_ratings rating join public.seasons season on season.id = rating.season_id
  order by rating.rider_id, case when season.status = 'active' then 0 else 1 end, season.game_year desc
), targets as (
  select rider.*, rating.profile,
    public.get_rider_typical_power_weight_kg(rating.profile, rider.height_cm) as typical_weight
  from public.riders rider join current_ratings rating on rating.rider_id = rider.id
  where rider.weight_kg is not null and rider.baseline_weight_kg is not null and rider.height_cm is not null
    and rider.baseline_weight_kg < public.get_rider_initial_minimum_power_weight_kg(rating.profile, rider.height_cm)
  for update of rider
), audited as (
  insert into public.initial_rider_underweight_corrections
    (entity_kind, entity_id, natural_profile, height_cm, weight_before_kg, weight_after_kg, baseline_before_kg, baseline_after_kg)
  select 'rider', id, profile, height_cm, weight_kg, weight_kg + typical_weight - baseline_weight_kg,
    baseline_weight_kg, typical_weight from targets
  on conflict (entity_kind, entity_id) do nothing returning *
)
update public.riders rider set weight_kg = audited.weight_after_kg, baseline_weight_kg = audited.baseline_after_kg
from audited where audited.entity_kind = 'rider' and audited.entity_id = rider.id;
with targets as (
  select candidate.*, public.get_rider_typical_power_weight_kg(archetype, adult_height_cm) as typical_weight
  from public.youth_scouting_candidates candidate
  where adult_weight_kg < public.get_rider_initial_minimum_power_weight_kg(archetype, adult_height_cm) for update
), audited as (
  insert into public.initial_rider_underweight_corrections
    (entity_kind, entity_id, natural_profile, height_cm, weight_before_kg, weight_after_kg, baseline_before_kg, baseline_after_kg)
  select 'candidate', id, archetype, adult_height_cm, adult_weight_kg, typical_weight, adult_weight_kg, typical_weight from targets
  on conflict (entity_kind, entity_id) do nothing returning *
)
update public.youth_scouting_candidates candidate set adult_weight_kg = audited.weight_after_kg
from audited where audited.entity_kind = 'candidate' and audited.entity_id = candidate.id;
with targets as (
  select academy.*, public.get_rider_typical_power_weight_kg(archetype, adult_height_cm) as typical_weight
  from public.youth_academy_riders academy
  where adult_weight_kg < public.get_rider_initial_minimum_power_weight_kg(archetype, adult_height_cm) for update
), audited as (
  insert into public.initial_rider_underweight_corrections
    (entity_kind, entity_id, natural_profile, height_cm, weight_before_kg, weight_after_kg, baseline_before_kg, baseline_after_kg)
  select 'academy', id, archetype, adult_height_cm, adult_weight_kg, typical_weight, adult_weight_kg, typical_weight from targets
  on conflict (entity_kind, entity_id) do nothing returning *
)
update public.youth_academy_riders academy set adult_weight_kg = audited.weight_after_kg
from audited where audited.entity_kind = 'academy' and audited.entity_id = academy.id;
notify pgrst, 'reload schema';
commit;
