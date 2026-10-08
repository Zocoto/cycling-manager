-- Read-only, one summary row; no player identities or whole-table JSON.
with current_ratings as (
  select distinct on (rating.rider_id) rating.rider_id,
    public.infer_rider_physiology_profile(rating.mountain, rating.hills, rating.flat,
      rating.time_trial, rating.cobbles, rating.sprint, rating.acceleration,
      rating.endurance, rating.resistance, rating.recovery, rating.breakaway) as profile
  from public.rider_season_ratings rating
  join public.seasons season on season.id = rating.season_id
  order by rating.rider_id, case when season.status = 'active' then 0 else 1 end,
    season.game_year desc
), limits as (
  select rider.id, rider.weight_kg, rider.baseline_weight_kg,
    floor((public.get_physiology_reference_weight(rating.profile) /
      power(public.get_physiology_reference_height(rating.profile) / 100.0, 2) +
      case rating.profile when 'climber' then 0.5 when 'puncheur' then 0.7
        when 'stage_racer' then 0.6 when 'northern_classics' then 1
        when 'rouleur' then 1 when 'sprinter' then 1 else 0.8 end) *
      power(rider.height_cm / 100.0, 2) * 10) / 10 as maximum_weight
  from public.riders rider join current_ratings rating on rating.rider_id = rider.id
  where rider.height_cm is not null and rider.weight_kg is not null
    and rider.baseline_weight_kg is not null
), projected as (
  select *, greatest(40, weight_kg - greatest(0, baseline_weight_kg - maximum_weight)) as projected_weight
  from limits
)
select clock_timestamp() as database_time,
  (select game_year from public.seasons where status = 'active' limit 1) as active_season,
  count(*) as riders_with_physiology,
  count(*) filter (where baseline_weight_kg > maximum_weight) as inherited_overweight_baselines,
  count(*) filter (where weight_kg > maximum_weight) as currently_overweight,
  count(*) filter (where weight_kg > maximum_weight and weight_kg <= baseline_weight_kg) as overweight_without_net_gain,
  count(*) filter (where weight_kg > maximum_weight and weight_kg > baseline_weight_kg) as overweight_with_net_gain,
  count(*) filter (where weight_kg > maximum_weight and not exists (
    select 1 from public.rider_weight_events event where event.rider_id = projected.id
      and event.source = 'supplement' and event.weight_after_kg > event.weight_before_kg
  )) as overweight_without_supplement_gain,
  count(*) filter (where projected_weight > maximum_weight) as projected_remaining_overweight,
  count(*) filter (where projected_weight > maximum_weight and not exists (
    select 1 from public.rider_weight_events event where event.rider_id = projected.id
      and event.source = 'supplement' and event.weight_after_kg > event.weight_before_kg
  )) as projected_remaining_without_supplement_gain,
  count(*) filter (where baseline_weight_kg > maximum_weight
    and weight_kg - (baseline_weight_kg - maximum_weight) < 40) as safety_floor_clamps,
  (select count(*) from public.riders rider where rider.height_cm is not null
    and not exists (select 1 from public.rider_season_ratings rating where rating.rider_id = rider.id)) as physiques_without_native_ratings
from projected;
