begin;

-- The short-run-in variant introduced for future hilly races moved almost the
-- whole final flat sector into the preceding climb. On long final sectors this
-- could turn a hilly championship into a 40+ km mountain ascent. Keep the
-- intended short flat run-in, cap the decisive hill at 12 km, and transfer the
-- remaining neutral distance to the closest preceding flat sector.
create temporary table hilly_short_run_in_repairs on commit drop as
with editable as (
  select
    stage.id as stage_id,
    stage.distance_km as expected_distance_km,
    finish.id as finish_segment_id,
    approach.id as approach_segment_id,
    approach.distance_km as previous_approach_distance_km,
    recipient.id as recipient_segment_id,
    least(12::numeric, approach.distance_km) as repaired_approach_distance_km
  from public.stages as stage
  join public.race_editions as edition on edition.id = stage.race_edition_id
  join public.seasons as season on season.id = edition.season_id
  cross join lateral (
    select segment.*
    from public.stage_segments as segment
    where segment.stage_id = stage.id
    order by segment.segment_number desc
    limit 1
  ) as finish
  cross join lateral (
    select segment.*
    from public.stage_segments as segment
    where segment.stage_id = stage.id
      and segment.segment_number < finish.segment_number
    order by segment.segment_number desc
    limit 1
  ) as approach
  cross join lateral (
    select segment.*
    from public.stage_segments as segment
    where segment.stage_id = stage.id
      and segment.segment_number < approach.segment_number
      and segment.terrain_type = 'flat'
    order by segment.segment_number desc
    limit 1
  ) as recipient
  where stage.stage_type = 'road'
    and stage.profile_type = 'hilly'
    and stage.status = 'planned'
    and edition.status not in ('completed', 'cancelled')
    and season.status in ('active', 'planned')
    and finish.terrain_type = 'flat'
    and finish.distance_km between 1 and 10
    and approach.terrain_type = 'climb'
    and approach.distance_km > 20
    and approach.average_gradient_pct >= 5.5
    and abs((
      select sum(segment.distance_km)
      from public.stage_segments as segment
      where segment.stage_id = stage.id
    ) - stage.distance_km) <= 0.05
    and not exists (
      select 1 from public.stage_results as result
      where result.stage_id = stage.id
    )
    and not exists (
      select 1 from public.official_stage_simulations as simulation
      where simulation.stage_id = stage.id
    )
)
select
  editable.*,
  previous_approach_distance_km - repaired_approach_distance_km
    as transferred_distance_km
from editable
where previous_approach_distance_km > repaired_approach_distance_km;

update public.stage_segments as recipient
set distance_km = recipient.distance_km + repair.transferred_distance_km
from hilly_short_run_in_repairs as repair
where recipient.id = repair.recipient_segment_id;

update public.stage_segments as approach
set distance_km = repair.repaired_approach_distance_km
from hilly_short_run_in_repairs as repair
where approach.id = repair.approach_segment_id;

-- This active S3 classic really contains a sustained 32 km climb at 6.8%.
-- Align its stored label with the detailed route used by the simulation.
update public.stages as stage
set profile_type = 'mountain'
from public.race_editions as edition,
     public.races as race,
     public.seasons as season
where stage.race_edition_id = edition.id
  and edition.race_id = race.id
  and edition.season_id = season.id
  and race.slug = 'arctic-endurance-classic'
  and season.status in ('active', 'planned')
  and stage.status = 'planned'
  and edition.status not in ('completed', 'cancelled')
  and not exists (
    select 1 from public.stage_results as result
    where result.stage_id = stage.id
  )
  and not exists (
    select 1 from public.official_stage_simulations as simulation
    where simulation.stage_id = stage.id
  )
  and exists (
    select 1
    from public.stage_segments as first_climb
    where first_climb.stage_id = stage.id
      and first_climb.terrain_type = 'climb'
      and (
        select coalesce(sum(next_climb.distance_km), 0)
        from public.stage_segments as next_climb
        where next_climb.stage_id = stage.id
          and next_climb.terrain_type = 'climb'
          and next_climb.segment_number >= first_climb.segment_number
          and next_climb.segment_number < (
            select coalesce(min(boundary.segment_number), 2147483647)
            from public.stage_segments as boundary
            where boundary.stage_id = stage.id
              and boundary.segment_number > first_climb.segment_number
              and boundary.terrain_type <> 'climb'
          )
      ) >= 30
  );

do $$
declare
  v_invalid record;
begin
  select
    repair.stage_id,
    measured.distance_km,
    repair.expected_distance_km,
    approach.distance_km as approach_distance_km,
    finish.distance_km as finish_distance_km
  into v_invalid
  from hilly_short_run_in_repairs as repair
  join public.stage_segments as approach
    on approach.id = repair.approach_segment_id
  join public.stage_segments as finish
    on finish.id = repair.finish_segment_id
  cross join lateral (
    select sum(segment.distance_km) as distance_km
    from public.stage_segments as segment
    where segment.stage_id = repair.stage_id
  ) as measured
  where abs(measured.distance_km - repair.expected_distance_km) > 0.05
    or approach.terrain_type <> 'climb'
    or approach.distance_km > 12
    or finish.terrain_type <> 'flat'
    or finish.distance_km > 10
  limit 1;

  if found then
    raise exception 'Invalid repaired hilly profile: %', row_to_json(v_invalid);
  end if;
end;
$$;

commit;
