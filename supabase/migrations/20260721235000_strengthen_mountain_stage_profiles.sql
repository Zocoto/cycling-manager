begin;

-- Les profils de montagne doivent représenter de vrais cols. Chaque arrivée
-- montagneuse planifiée reçoit une ascension finale continue de 3 à 6
-- tronçons (30 à 60 km), précédée d'une descente afin que les massifs restent
-- lisibles dans le calendrier comme dans le simulateur.
with mountain_stages as (
  select
    stage.id as stage_id,
    max(segment.segment_number)::integer as segment_count,
    least(
      max(segment.segment_number)::integer - 1,
      3 + get_byte(decode(md5(stage.id::text), 'hex'), 0) % 4
    )::integer as final_climb_length,
    get_byte(decode(md5(stage.id::text), 'hex'), 1)::integer as stage_seed
  from public.stages as stage
  join public.stage_segments as segment
    on segment.stage_id = stage.id
  where stage.profile_type = 'mountain'
    and stage.status = 'planned'
    and not exists (
      select 1
      from public.stage_results as result
      where result.stage_id = stage.id
    )
  group by stage.id
  having max(segment.segment_number) >= 4
), reshaped_segments as (
  select
    segment.id,
    segment.segment_number,
    mountain.segment_count,
    mountain.final_climb_length,
    mountain.stage_seed,
    mountain.segment_count - mountain.final_climb_length + 1
      as final_climb_start
  from public.stage_segments as segment
  join mountain_stages as mountain
    on mountain.stage_id = segment.stage_id
)
update public.stage_segments as segment
set
  terrain_type = case
    when shaped.segment_number >= shaped.final_climb_start then 'climb'
    when shaped.segment_number >= shaped.final_climb_start - 2 then 'descent'
    when shaped.segment_number = shaped.final_climb_start - 3 then 'flat'
    else segment.terrain_type
  end,
  surface_type = 'asphalt',
  average_gradient_pct = case
    when shaped.segment_number >= shaped.final_climb_start then
      round((
        5.8
        + mod(
          shaped.stage_seed + shaped.segment_number * 37,
          37
        ) / 10.0
      )::numeric, 2)
    when shaped.segment_number >= shaped.final_climb_start - 2 then
      -round((
        5.2
        + mod(
          shaped.stage_seed + shaped.segment_number * 29,
          33
        ) / 10.0
      )::numeric, 2)
    when shaped.segment_number = shaped.final_climb_start - 3 then 0
    else segment.average_gradient_pct
  end
from reshaped_segments as shaped
where segment.id = shaped.id;

-- La longueur du dernier tronçon peut être inférieure à 10 km. Si ce reliquat
-- rendait le sommet final plus bas qu'un sommet précédent, la pente de toute
-- l'ascension finale est ajustée juste assez pour en faire le point culminant,
-- avec une marge visuelle de 100 mètres.
with mountain_stages as (
  select
    stage.id as stage_id,
    max(segment.segment_number)::integer as segment_count,
    least(
      max(segment.segment_number)::integer - 1,
      3 + get_byte(decode(md5(stage.id::text), 'hex'), 0) % 4
    )::integer as final_climb_length
  from public.stages as stage
  join public.stage_segments as segment
    on segment.stage_id = stage.id
  where stage.profile_type = 'mountain'
    and stage.status = 'planned'
    and not exists (
      select 1
      from public.stage_results as result
      where result.stage_id = stage.id
    )
  group by stage.id
  having max(segment.segment_number) >= 4
), elevation_points as (
  select
    segment.stage_id,
    segment.segment_number,
    segment.distance_km,
    sum(
      segment.distance_km * segment.average_gradient_pct * 10
    ) over (
      partition by segment.stage_id
      order by segment.segment_number
    ) as elevation_m,
    mountain.segment_count,
    mountain.segment_count - mountain.final_climb_length + 1
      as final_climb_start
  from public.stage_segments as segment
  join mountain_stages as mountain
    on mountain.stage_id = segment.stage_id
), summit_metrics as (
  select
    point.stage_id,
    point.final_climb_start,
    coalesce(
      max(point.elevation_m) filter (
        where point.segment_number < point.final_climb_start
      ),
      0
    ) as previous_highest_elevation_m,
    max(point.elevation_m) filter (
      where point.segment_number = point.segment_count
    ) as finish_elevation_m,
    sum(point.distance_km) filter (
      where point.segment_number >= point.final_climb_start
    ) as final_climb_distance_km
  from elevation_points as point
  group by point.stage_id, point.final_climb_start
), adjustments as (
  select
    metrics.stage_id,
    metrics.final_climb_start,
    greatest(
      0,
      (
        metrics.previous_highest_elevation_m
        + 100
        - metrics.finish_elevation_m
      ) / nullif(metrics.final_climb_distance_km * 10, 0)
    ) as gradient_adjustment
  from summit_metrics as metrics
)
update public.stage_segments as segment
set average_gradient_pct = round((
  segment.average_gradient_pct + adjustment.gradient_adjustment
)::numeric, 2)
from adjustments as adjustment
where segment.stage_id = adjustment.stage_id
  and segment.segment_number >= adjustment.final_climb_start
  and adjustment.gradient_adjustment > 0;

-- Le libellé doit refléter les coureurs capables de gagner : un grand col de
-- 30 km ou davantage fait une étape de montagne, et une côte d'arrivée d'au
-- moins 3 km à 4,5 % transforme même une journée plate en étape vallonnée.
with ordered_segments as (
  select
    segment.stage_id,
    segment.segment_number,
    segment.distance_km,
    segment.terrain_type,
    segment.average_gradient_pct,
    sum(
      case when segment.terrain_type <> 'climb' then 1 else 0 end
    ) over (
      partition by segment.stage_id
      order by segment.segment_number
    ) as climb_group,
    max(segment.segment_number) over (
      partition by segment.stage_id
    ) as final_segment_number
  from public.stage_segments as segment
), climb_blocks as (
  select
    ordered.stage_id,
    ordered.climb_group,
    max(ordered.segment_number) as finish_segment_number,
    max(ordered.final_segment_number) as final_segment_number,
    sum(ordered.distance_km) as climb_distance_km,
    sum(
      ordered.distance_km * ordered.average_gradient_pct
    ) / nullif(sum(ordered.distance_km), 0) as average_gradient_pct
  from ordered_segments as ordered
  where ordered.terrain_type = 'climb'
  group by ordered.stage_id, ordered.climb_group
), stage_difficulty as (
  select
    stage.id as stage_id,
    bool_or(
      climb.climb_distance_km >= 30
      and climb.average_gradient_pct >= 5.5
    ) as has_major_mountain_ascent,
    bool_or(
      climb.finish_segment_number = climb.final_segment_number
      and climb.climb_distance_km >= 15
      and climb.average_gradient_pct >= 5.5
    ) as has_mountain_finish,
    bool_or(
      climb.finish_segment_number = climb.final_segment_number
      and climb.climb_distance_km >= 3
      and climb.average_gradient_pct >= 4.5
    ) as has_hilly_finish
  from public.stages as stage
  join climb_blocks as climb
    on climb.stage_id = stage.id
  where stage.status = 'planned'
    and stage.stage_type = 'road'
    and stage.profile_type not in ('time_trial', 'cobbles', 'mountain')
    and not exists (
      select 1
      from public.stage_results as result
      where result.stage_id = stage.id
    )
  group by stage.id
)
update public.stages as stage
set profile_type = case
  when difficulty.has_major_mountain_ascent
    or difficulty.has_mountain_finish
  then 'mountain'
  when difficulty.has_hilly_finish then 'hilly'
  else stage.profile_type
end
from stage_difficulty as difficulty
where stage.id = difficulty.stage_id
  and (
    difficulty.has_major_mountain_ascent
    or difficulty.has_mountain_finish
    or difficulty.has_hilly_finish
  );

-- Les GPM des étapes futures sont recalculés après le remodelage pour rester
-- exactement placés aux nouveaux sommets. Les SI, positionnés en plaine au
-- milieu de l'étape, ne sont pas déplacés.
delete from public.stage_segment_primes as prime
using public.stage_segments as segment, public.stages as stage
where prime.stage_segment_id = segment.id
  and segment.stage_id = stage.id
  and prime.prime_type = 'mountain'
  and stage.status = 'planned'
  and not exists (
    select 1
    from public.stage_results as result
    where result.stage_id = stage.id
  );

with ordered_segments as (
  select
    segment.*,
    stage.race_edition_id,
    sum(
      case when segment.terrain_type <> 'climb' then 1 else 0 end
    ) over (
      partition by segment.stage_id
      order by segment.segment_number
    ) as climb_group
  from public.stage_segments as segment
  join public.stages as stage
    on stage.id = segment.stage_id
  where stage.status = 'planned'
    and not exists (
      select 1
      from public.stage_results as result
      where result.stage_id = stage.id
    )
), climbs as (
  select
    ordered.stage_id,
    ordered.race_edition_id,
    ordered.climb_group,
    max(ordered.segment_number) as summit_segment_number,
    sum(ordered.distance_km) as climb_distance_km,
    max(ordered.average_gradient_pct) as maximum_gradient_pct
  from ordered_segments as ordered
  where ordered.terrain_type = 'climb'
  group by
    ordered.stage_id,
    ordered.race_edition_id,
    ordered.climb_group
), categorized as (
  select
    climbs.*,
    case
      when climbs.climb_distance_km * climbs.maximum_gradient_pct >= 260 then 'HC'
      when climbs.climb_distance_km * climbs.maximum_gradient_pct >= 180 then '1'
      when climbs.climb_distance_km * climbs.maximum_gradient_pct >= 110 then '2'
      when climbs.climb_distance_km * climbs.maximum_gradient_pct >= 55 then '3'
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
 and summit.segment_number = categorized.summit_segment_number
join public.race_editions as edition
  on edition.id = categorized.race_edition_id
join public.races as race
  on race.id = edition.race_id
where race.race_format = 'stage_race';

commit;
