begin;

-- Preserve every started or locked race. Only future hilly road stages with a
-- complete editable profile are reshaped. Three deterministic families out of
-- four finish uphill; the fourth keeps a short flat run-in after the last hill.
create temporary table hilly_finish_targets on commit drop as
with eligible as (
  select
    stage.id as stage_id,
    stage.distance_km,
    race.race_format,
    get_byte(decode(md5(stage.id::text), 'hex'), 0) as shape_seed
  from public.stages as stage
  join public.race_editions as edition on edition.id = stage.race_edition_id
  join public.races as race on race.id = edition.race_id
  join public.seasons as season on season.id = edition.season_id
  where stage.stage_type = 'road'
    and stage.profile_type = 'hilly'
    and stage.status = 'planned'
    and stage.distance_km >= 40
    and edition.status not in ('completed', 'cancelled')
    and season.game_year >= 3
    and (
      season.status = 'planned'
      or (
        season.status = 'active'
        and stage.departure_at > now() + interval '48 hours'
      )
    )
    and not exists (
      select 1
      from public.stage_results as result
      where result.stage_id = stage.id
    )
    and not exists (
      select 1
      from public.official_stage_simulations as simulation
      where simulation.stage_id = stage.id
    )
), boundaries as (
  select
    eligible.*,
    finish.id as finish_segment_id,
    finish.segment_number as finish_segment_number,
    finish.distance_km as previous_finish_distance_km,
    approach.id as approach_segment_id,
    approach.segment_number as approach_segment_number,
    approach.distance_km as previous_approach_distance_km,
    mod(eligible.shape_seed, 4) < 3 as uphill_finish,
    case
      when mod(eligible.shape_seed, 4) < 3
        then 4 + mod(eligible.shape_seed, 5)
      else 6 + mod(eligible.shape_seed, 5)
    end::numeric as desired_finish_distance_km
  from eligible
  cross join lateral (
    select segment.*
    from public.stage_segments as segment
    where segment.stage_id = eligible.stage_id
    order by segment.segment_number desc
    limit 1
  ) as finish
  cross join lateral (
    select segment.*
    from public.stage_segments as segment
    where segment.stage_id = eligible.stage_id
      and segment.segment_number < finish.segment_number
    order by segment.segment_number desc
    limit 1
  ) as approach
  where abs((
    select sum(segment.distance_km)
    from public.stage_segments as segment
    where segment.stage_id = eligible.stage_id
  ) - eligible.distance_km) <= 0.05
), planned as (
  select
    boundaries.*,
    least(
      previous_approach_distance_km + previous_finish_distance_km - 1,
      greatest(1, desired_finish_distance_km)
    ) as finish_distance_km
  from boundaries
)
select
  planned.*,
  finish_distance_km - previous_finish_distance_km as distance_shift_km
from planned;

do $$
declare
  v_uphill_count integer;
  v_run_in_count integer;
begin
  select
    count(*) filter (where uphill_finish),
    count(*) filter (where not uphill_finish)
  into v_uphill_count, v_run_in_count
  from hilly_finish_targets;

  raise notice 'Hilly profiles reshaped: % uphill finishes, % short run-ins',
    v_uphill_count, v_run_in_count;
end;
$$;

update public.stage_segments as segment
set
  distance_km = case
    when segment.id = target.finish_segment_id
      then target.finish_distance_km
    else target.previous_approach_distance_km - target.distance_shift_km
  end,
  terrain_type = case
    when segment.id = target.finish_segment_id
      then case when target.uphill_finish then 'climb' else 'flat' end
    else case when target.uphill_finish then 'flat' else 'climb' end
  end,
  average_gradient_pct = case
    when segment.id = target.finish_segment_id and target.uphill_finish
      then 6.2 + mod(target.shape_seed * 7 + 3, 32) / 10.0
    when segment.id = target.approach_segment_id and not target.uphill_finish
      then 6.2 + mod(target.shape_seed * 11 + 5, 32) / 10.0
    else 0
  end
from hilly_finish_targets as target
where segment.id in (target.approach_segment_id, target.finish_segment_id);

-- Any former summit marker on the rewritten pair is stale. Stage races get a
-- fresh GPM on the decisive hill; one-day races keep their existing rule of no
-- mountain classification.
delete from public.stage_segment_primes as prime
using hilly_finish_targets as target
where prime.stage_segment_id in (
  target.approach_segment_id,
  target.finish_segment_id
)
  and prime.prime_type = 'mountain';

with decisive_climbs as (
  select
    target.stage_id,
    case
      when target.uphill_finish then target.finish_segment_id
      else target.approach_segment_id
    end as segment_id,
    segment.distance_km * segment.average_gradient_pct as difficulty
  from hilly_finish_targets as target
  join public.stage_segments as segment
    on segment.id = case
      when target.uphill_finish then target.finish_segment_id
      else target.approach_segment_id
    end
  where target.race_format = 'stage_race'
)
insert into public.stage_segment_primes (
  stage_segment_id,
  prime_type,
  mountain_category,
  points_scale
)
select
  climb.segment_id,
  'mountain',
  case when climb.difficulty >= 55 then '3' else '4' end,
  case
    when climb.difficulty >= 55 then array[2, 1]::smallint[]
    else array[1]::smallint[]
  end
from decisive_climbs as climb
where not exists (
  select 1
  from public.stage_segment_primes as existing
  where existing.stage_segment_id = climb.segment_id
    and existing.prime_type = 'mountain'
);

do $$
declare
  v_invalid record;
begin
  select
    target.stage_id,
    target.uphill_finish,
    finish.distance_km as finish_distance_km,
    finish.terrain_type as finish_terrain,
    finish.average_gradient_pct as finish_gradient,
    approach.terrain_type as approach_terrain,
    approach.average_gradient_pct as approach_gradient,
    measured.distance_km as measured_distance_km,
    target.distance_km as expected_distance_km
  into v_invalid
  from hilly_finish_targets as target
  join public.stage_segments as finish on finish.id = target.finish_segment_id
  join public.stage_segments as approach on approach.id = target.approach_segment_id
  cross join lateral (
    select sum(segment.distance_km) as distance_km
    from public.stage_segments as segment
    where segment.stage_id = target.stage_id
  ) as measured
  where abs(measured.distance_km - target.distance_km) > 0.05
    or (
      target.uphill_finish
      and (
        finish.terrain_type <> 'climb'
        or finish.distance_km not between 4 and 8
        or finish.average_gradient_pct < 6.2
        or approach.terrain_type <> 'flat'
      )
    )
    or (
      not target.uphill_finish
      and (
        finish.terrain_type <> 'flat'
        or finish.distance_km not between 6 and 10
        or approach.terrain_type <> 'climb'
        or approach.average_gradient_pct < 6.2
      )
    )
  order by target.stage_id
  limit 1;

  if found then
    raise exception 'Invalid hilly finish for stage %: %',
      v_invalid.stage_id,
      row_to_json(v_invalid);
  end if;
end;
$$;

commit;
