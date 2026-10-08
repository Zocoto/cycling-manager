-- Bounded, read-only physique summary. No fixtures or gameplay mutations.
set statement_timeout = '5s';
with profiles as (
  select distinct on (rating.rider_id) rating.rider_id,
    public.infer_rider_physiology_profile(rating.mountain,rating.hills,rating.flat,
      rating.time_trial,rating.cobbles,rating.sprint,rating.acceleration,
      rating.endurance,rating.resistance,rating.recovery,rating.breakaway) as profile
  from public.rider_season_ratings rating join public.seasons season on season.id=rating.season_id
  order by rating.rider_id,case when season.status='active' then 0 else 1 end,season.game_year desc
), physiques as (
  select 'rider'::text as kind, profile, height_cm, weight_kg, baseline_weight_kg
  from public.riders rider join profiles on profiles.rider_id=rider.id
  where profile in ('rouleur','northern_classics','sprinter') and height_cm is not null and weight_kg is not null
  union all select 'candidate',archetype,adult_height_cm,adult_weight_kg,adult_weight_kg
  from public.youth_scouting_candidates where archetype in ('rouleur','northern_classics','sprinter')
  union all select 'academy',archetype,adult_height_cm,adult_weight_kg,adult_weight_kg
  from public.youth_academy_riders where archetype in ('rouleur','northern_classics','sprinter')
), bounds as (
  select *,ceil((public.get_physiology_reference_weight(profile) /
    power(public.get_physiology_reference_height(profile)/100.0,2)-1)*power(height_cm/100.0,2)*10)/10 as minimum
  from physiques
)
select kind,profile,count(*)::integer as physiques,
  count(*) filter(where baseline_weight_kg<minimum)::integer as initial_underweight,
  count(*) filter(where weight_kg<minimum)::integer as current_underweight,
  count(*) filter(where weight_kg<minimum and baseline_weight_kg>=minimum)::integer as underweight_after_player_changes,
  min(weight_kg) as minimum_current_weight,max(weight_kg) as maximum_current_weight
from bounds group by kind,profile order by kind,profile;
