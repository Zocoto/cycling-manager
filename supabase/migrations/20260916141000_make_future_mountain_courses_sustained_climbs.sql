begin;

-- The earlier Grand Tour templates mixed four or five short cols and often
-- finished downhill. Keep completed/locked races intact and reshape only
-- mountain road stages that are still safely ahead of their start.
create temporary table mountain_profile_targets on commit drop as
select
  stage.id as stage_id,
  stage.distance_km,
  race.race_format,
  season.game_year,
  season.status as season_status,
  count(segment.id)::integer as segment_count,
  sum(greatest(segment.average_gradient_pct, 0) * segment.distance_km * 10)
    as previous_ascent_m,
  exists (
    select 1
    from public.stage_segments as sprint_segment
    join public.stage_segment_primes as prime
      on prime.stage_segment_id = sprint_segment.id
    where sprint_segment.stage_id = stage.id
      and prime.prime_type = 'intermediate_sprint'
  ) as had_intermediate_sprint
from public.stages as stage
join public.race_editions as edition on edition.id = stage.race_edition_id
join public.races as race on race.id = edition.race_id
join public.seasons as season on season.id = edition.season_id
join public.stage_segments as segment on segment.stage_id = stage.id
where stage.stage_type = 'road'
  and stage.profile_type = 'mountain'
  and stage.status = 'planned'
  and stage.distance_km >= 85
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
    select 1 from public.stage_results as result where result.stage_id = stage.id
  )
  and not exists (
    select 1
    from public.official_stage_simulations as simulation
    where simulation.stage_id = stage.id
  )
group by stage.id, race.race_format, season.game_year, season.status
having count(segment.id) >= 8
  and abs(sum(segment.distance_km) - stage.distance_km) <= 0.05;

do $$
declare
  v_current_count integer;
  v_future_count integer;
begin
  select
    count(*) filter (where season_status = 'active'),
    count(*) filter (where season_status = 'planned')
  into v_current_count, v_future_count
  from mountain_profile_targets;

  raise notice 'Mountain courses to reshape: % active-season, % future-season',
    v_current_count, v_future_count;
end;
$$;

-- Use the existing segment boundaries, so race plans and simulation pacing
-- remain stable. Medium mountain gets two long cols; the hardest stages get
-- three. The final 25-45 km are a continuous ascent to the highest summit.
create temporary table mountain_segment_plan on commit drop as
with ordered as (
  select
    target.*,
    segment.id as segment_id,
    segment.segment_number,
    segment.distance_km as segment_distance_km,
    lag(segment.distance_km) over (
      partition by target.stage_id order by segment.segment_number
    ) as previous_distance_km,
    coalesce(
      sum(segment.distance_km) over (
        partition by target.stage_id
        order by segment.segment_number
        rows between unbounded preceding and 1 preceding
      ),
      0
    ) as distance_before_km,
    target.previous_ascent_m >= 4800 and target.segment_count >= 10
      as high_mountain
  from mountain_profile_targets as target
  join public.stage_segments as segment on segment.stage_id = target.stage_id
), finish_boundaries as (
  select distinct on (stage_id)
    stage_id,
    segment_number as final_climb_start,
    case
      when tail_distance_km >= target_distance_km then
        least(tail_distance_km - target_distance_km, greatest(0, segment_distance_km - 1))
      else
        -least(target_distance_km - tail_distance_km, greatest(0, previous_distance_km - 1))
    end as distance_shift_km
  from (
    select
      ordered.*,
      distance_km - distance_before_km as tail_distance_km,
      case
        when high_mountain then least(45, greatest(30, distance_km * 0.24))
        else least(40, greatest(25, distance_km * 0.22))
      end as target_distance_km
    from ordered
    where segment_number > 1
  ) as candidates
  order by stage_id, abs(tail_distance_km - target_distance_km), segment_number desc
), terrain_plan as (
  select
    ordered.*,
    boundary.final_climb_start,
    boundary.distance_shift_km,
    case
      when ordered.segment_number >= boundary.final_climb_start then 'climb'
      when ordered.segment_number = boundary.final_climb_start - 1 then 'flat'
      when ordered.high_mountain then case
        when ordered.segment_number <= greatest(1, floor(ordered.segment_count * 0.12)) then 'flat'
        when ordered.segment_number <= greatest(2, floor(ordered.segment_count * 0.30)) then 'climb'
        when ordered.segment_number <= greatest(3, floor(ordered.segment_count * 0.42)) then 'descent'
        when ordered.segment_number <= greatest(4, floor(ordered.segment_count * 0.49)) then 'flat'
        when ordered.segment_number <= greatest(5, floor(ordered.segment_count * 0.64)) then 'climb'
        when ordered.segment_number <= greatest(6, floor(ordered.segment_count * 0.70)) then 'descent'
        else 'flat'
      end
      when ordered.segment_number <= greatest(1, floor(ordered.segment_count * 0.20)) then 'flat'
      when ordered.segment_number <= greatest(2, floor(ordered.segment_count * 0.39)) then 'climb'
      when ordered.segment_number <= greatest(3, floor(ordered.segment_count * 0.52)) then 'descent'
      else 'flat'
    end as terrain_type
  from ordered
  join finish_boundaries as boundary on boundary.stage_id = ordered.stage_id
)
select
  stage_id,
  segment_id,
  segment_number,
  final_climb_start,
  distance_shift_km,
  terrain_type,
  case
    when terrain_type = 'flat' then 0::numeric
    when terrain_type = 'descent' then
      -5.1 - mod(
        get_byte(decode(md5(stage_id::text), 'hex'), 0) + segment_number * 13,
        9
      ) / 10.0
    when segment_number >= final_climb_start then
      (case when high_mountain then 6.3 else 5.9 end)
      + mod(
        get_byte(decode(md5(stage_id::text), 'hex'), 1) + segment_number * 17,
        9
      ) / 10.0
    when high_mountain then
      5.9 + mod(
        get_byte(decode(md5(stage_id::text), 'hex'), 2) + segment_number * 11,
        9
      ) / 10.0
    else
      5.5 + mod(
        get_byte(decode(md5(stage_id::text), 'hex'), 2) + segment_number * 11,
        8
      ) / 10.0
  end::numeric(5, 2) as average_gradient_pct
from terrain_plan;

-- Move the boundary within its existing two segments (both keep at least
-- 1 km). This keeps the summit climb near its intended length even when the
-- old Grand Tour template used unusually long segments.
update public.stage_segments as segment
set distance_km = segment.distance_km + case
  when plan.segment_number = plan.final_climb_start then -plan.distance_shift_km
  else plan.distance_shift_km
end
from mountain_segment_plan as plan
where segment.id = plan.segment_id
  and plan.segment_number in (plan.final_climb_start - 1, plan.final_climb_start)
  and plan.distance_shift_km <> 0;

update public.stage_segments as segment
set
  terrain_type = plan.terrain_type,
  average_gradient_pct = plan.average_gradient_pct
from mountain_segment_plan as plan
where segment.id = plan.segment_id;

-- A short remainder at the end of a stage must not leave the finish below
-- an earlier summit. Raise only the final climb, with a 250 m margin.
with elevation as (
  select
    plan.stage_id,
    plan.segment_number,
    plan.final_climb_start,
    target.segment_count,
    segment.distance_km,
    sum(segment.distance_km * segment.average_gradient_pct * 10) over (
      partition by plan.stage_id order by plan.segment_number
    ) as elevation_m
  from mountain_segment_plan as plan
  join mountain_profile_targets as target on target.stage_id = plan.stage_id
  join public.stage_segments as segment on segment.id = plan.segment_id
), metrics as (
  select
    stage_id,
    final_climb_start,
    greatest(0, coalesce(max(elevation_m) filter (
      where segment_number < final_climb_start
    ), 0)) as previous_summit_m,
    max(elevation_m) filter (where segment_number = segment_count) as finish_m,
    sum(distance_km) filter (
      where segment_number >= final_climb_start
    ) as final_climb_km
  from elevation
  group by stage_id, final_climb_start
), adjustments as (
  select
    stage_id,
    final_climb_start,
    greatest(0, (previous_summit_m + 250 - finish_m) / nullif(final_climb_km * 10, 0))
      as gradient_adjustment
  from metrics
)
update public.stage_segments as segment
set average_gradient_pct = round(
  (segment.average_gradient_pct + adjustment.gradient_adjustment)::numeric, 2
)
from mountain_segment_plan as plan
join adjustments as adjustment on adjustment.stage_id = plan.stage_id
where segment.id = plan.segment_id
  and plan.segment_number >= adjustment.final_climb_start
  and adjustment.gradient_adjustment > 0;

-- Mountain points belong to the new summits, not to the old short hills.
-- Keep the presence of the intermediate sprint, relocating it to a valley.
delete from public.stage_segment_primes as prime
using public.stage_segments as segment, mountain_profile_targets as target
where prime.stage_segment_id = segment.id
  and segment.stage_id = target.stage_id
  and prime.prime_type in ('mountain', 'intermediate_sprint');

with ordered as (
  select
    segment.*,
    target.race_format,
    sum(case when segment.terrain_type <> 'climb' then 1 else 0 end) over (
      partition by segment.stage_id order by segment.segment_number
    ) as climb_group
  from public.stage_segments as segment
  join mountain_profile_targets as target on target.stage_id = segment.stage_id
), climbs as (
  select
    stage_id,
    climb_group,
    max(segment_number) as summit_segment_number,
    sum(distance_km * average_gradient_pct) as difficulty
  from ordered
  where terrain_type = 'climb' and race_format = 'stage_race'
  group by stage_id, climb_group
), categorized as (
  select
    climbs.*,
    case
      when difficulty >= 260 then 'HC'
      when difficulty >= 180 then '1'
      when difficulty >= 110 then '2'
      when difficulty >= 55 then '3'
      else '4'
    end as category
  from climbs
)
insert into public.stage_segment_primes (
  stage_segment_id,
  prime_type,
  mountain_category,
  points_scale
)
select
  summit.id,
  'mountain',
  categorized.category,
  case categorized.category
    when 'HC' then array[20, 15, 12, 10, 8, 6, 4, 2]::smallint[]
    when '1' then array[10, 8, 6, 4, 2, 1]::smallint[]
    when '2' then array[5, 3, 2, 1]::smallint[]
    when '3' then array[2, 1]::smallint[]
    else array[1]::smallint[]
  end
from categorized
join public.stage_segments as summit
  on summit.stage_id = categorized.stage_id
 and summit.segment_number = categorized.summit_segment_number;

with flat_candidates as (
  select
    segment.id,
    row_number() over (
      partition by target.stage_id
      order by abs(segment.segment_number - target.segment_count * 0.46),
        segment.segment_number
    ) as priority
  from mountain_profile_targets as target
  join public.stage_segments as segment on segment.stage_id = target.stage_id
  where target.had_intermediate_sprint
    and segment.terrain_type = 'flat'
    and segment.segment_number < target.segment_count
)
insert into public.stage_segment_primes (
  stage_segment_id,
  prime_type,
  mountain_category,
  points_scale
)
select
  candidate.id,
  'intermediate_sprint',
  null,
  array[20, 17, 15, 13, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1]::smallint[]
from flat_candidates as candidate
where candidate.priority = 1;

do $$
declare
  v_bad_shape record;
begin
  if exists (
    with elevation as (
      select
        target.stage_id,
        target.distance_km,
        target.segment_count,
        segment.segment_number,
        segment.terrain_type,
        segment.average_gradient_pct,
        sum(segment.distance_km * segment.average_gradient_pct * 10) over (
          partition by target.stage_id order by segment.segment_number
        ) as height_m,
        sum(segment.distance_km) over (partition by target.stage_id) as measured_distance_km
      from mountain_profile_targets as target
      join public.stage_segments as segment on segment.stage_id = target.stage_id
    )
    select 1
    from elevation
    where abs(measured_distance_km - distance_km) > 0.05
      or abs(average_gradient_pct) > 12
      or (
        segment_number = segment_count
        and (
          terrain_type <> 'climb'
          or height_m < (
            select max(other.height_m)
            from elevation as other
            where other.stage_id = elevation.stage_id
          )
        )
      )
  ) then
    raise exception 'A planned mountain stage lost its distance or summit finish.';
  end if;

  if exists (
    select 1
    from mountain_profile_targets as target
    where target.had_intermediate_sprint
      and not exists (
        select 1
        from public.stage_segments as segment
        join public.stage_segment_primes as prime
          on prime.stage_segment_id = segment.id
        where segment.stage_id = target.stage_id
          and prime.prime_type = 'intermediate_sprint'
      )
  ) then
    raise exception 'A mountain stage lost its intermediate sprint.';
  end if;

  with ordered as (
      select
        target.stage_id,
        target.segment_count,
        target.previous_ascent_m,
        segment.segment_number,
        segment.distance_km,
        segment.terrain_type,
        sum(case when segment.terrain_type <> 'climb' then 1 else 0 end) over (
          partition by target.stage_id order by segment.segment_number
        ) as climb_group
      from mountain_profile_targets as target
      join public.stage_segments as segment on segment.stage_id = target.stage_id
    ), climbs as (
      select
        stage_id,
        climb_group,
        max(segment_number) as summit_segment_number,
        sum(distance_km) as climb_distance_km
      from ordered
      where terrain_type = 'climb'
      group by stage_id, climb_group
    ), summary as (
      select
        target.stage_id,
        count(climb.climb_group) as climb_count,
        max(climb.climb_distance_km) filter (
          where climb.summit_segment_number = target.segment_count
        ) as final_climb_km,
        case
          when target.previous_ascent_m >= 4800 and target.segment_count >= 10
            then 3
          else 2
        end as expected_climbs
      from mountain_profile_targets as target
      left join climbs as climb on climb.stage_id = target.stage_id
      group by target.stage_id, target.segment_count, target.previous_ascent_m
    )
  select * into v_bad_shape
  from summary
  where climb_count <> expected_climbs
    or final_climb_km not between 25 and 50
  order by stage_id
  limit 1;

  if found then
    raise exception 'Mountain stage % has % cols (expected %) and % km at the finish.',
      v_bad_shape.stage_id,
      v_bad_shape.climb_count,
      v_bad_shape.expected_climbs,
      v_bad_shape.final_climb_km;
  end if;
end;
$$;

commit;
