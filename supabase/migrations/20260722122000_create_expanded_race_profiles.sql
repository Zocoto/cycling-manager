begin;

create temporary table expanded_race_slugs (
  slug text primary key
) on commit drop;

insert into expanded_race_slugs (slug)
values
  ('tour-des-volcans-du-pacifique'),
  ('aurora-borealis-tour'),
  ('classique-du-caucase'),
  ('desert-to-sky-classic'),
  ('patagonia-fin-del-mundo'),
  ('tour-du-rift'),
  ('silk-road-tour'),
  ('caribbean-trade-winds'),
  ('himalayan-gateway-classic'),
  ('tasman-sea-classic'),
  ('dragon-kingdom-tour'),
  ('mekong-delta-tour'),
  ('altiplano-boliviano'),
  ('namib-sun-classic'),
  ('madagascar-red-earth'),
  ('tour-des-hauts-de-laos'),
  ('boucle-de-zanzibar'),
  ('criterium-de-singapour'),
  ('circuit-des-fjords-feroiens'),
  ('route-des-cafes-du-timor');

-- Les nouvelles étapes sont découpées en tronçons de 10 km. Les étapes de
-- montagne se terminent par une ascension continue de 30 à 40 km.
with target_stages as (
  select
    stage.id as stage_id,
    stage.profile_type,
    stage.distance_km,
    ceil(stage.distance_km / 10.0)::integer as segment_count
  from public.stages as stage
  join public.race_editions as edition
    on edition.id = stage.race_edition_id
  join public.races as race
    on race.id = edition.race_id
  join expanded_race_slugs as target_race
    on target_race.slug = race.slug
  where not exists (
    select 1
    from public.stage_segments as existing_segment
    where existing_segment.stage_id = stage.id
  )
), generated as (
  select
    target.*,
    generated.segment_number,
    least(
      10.0,
      target.distance_km - ((generated.segment_number - 1) * 10.0)
    )::numeric(5, 2) as segment_distance_km
  from target_stages as target
  cross join lateral generate_series(
    1,
    target.segment_count
  ) as generated(segment_number)
), shaped as (
  select
    generated.*,
    case
      when generated.profile_type in ('flat', 'sprint', 'time_trial') then
        case
          when generated.segment_number > 2
            and generated.segment_number < generated.segment_count - 1
            and generated.segment_number % 11 = 0
          then 'climb'
          when generated.segment_number > 2
            and generated.segment_number < generated.segment_count - 1
            and generated.segment_number % 11 = 1
          then 'descent'
          else 'flat'
        end
      when generated.profile_type = 'hilly' then
        case generated.segment_number % 7
          when 2 then 'climb'
          when 3 then 'climb'
          when 4 then 'descent'
          when 6 then 'climb'
          when 0 then 'descent'
          else 'flat'
        end
      when generated.profile_type = 'mountain' then
        case
          when generated.segment_number = 1 then 'flat'
          when generated.segment_number >= generated.segment_count - 3 then 'climb'
          when generated.segment_number >= generated.segment_count - 5 then 'descent'
          when generated.segment_number % 6 in (1, 2) then 'climb'
          when generated.segment_number % 6 = 3 then 'descent'
          else 'flat'
        end
      when generated.profile_type = 'cobbles' then
        case generated.segment_number % 5
          when 3 then 'climb'
          when 4 then 'descent'
          else 'flat'
        end
      else
        case generated.segment_number % 7
          when 2 then 'climb'
          when 3 then 'descent'
          when 5 then 'climb'
          when 6 then 'climb'
          when 0 then 'descent'
          else 'flat'
        end
    end as terrain_type,
    case
      when generated.profile_type = 'cobbles'
        and generated.segment_number not in (1, generated.segment_count)
        and generated.segment_number % 3 <> 0
      then 'cobbles'
      else 'asphalt'
    end as surface_type
  from generated
)
insert into public.stage_segments (
  stage_id,
  segment_number,
  distance_km,
  terrain_type,
  surface_type,
  average_gradient_pct
)
select
  shaped.stage_id,
  shaped.segment_number,
  shaped.segment_distance_km,
  shaped.terrain_type,
  shaped.surface_type,
  case
    when shaped.terrain_type = 'flat' then 0
    when shaped.terrain_type = 'climb' then
      round((
        case
          when shaped.profile_type = 'mountain' then 5.8
          when shaped.profile_type in ('hilly', 'mixed') then 2.8
          else 1.5
        end
        + ((shaped.segment_number * 37) % 40) / 10.0
      )::numeric, 2)
    else
      -round((
        case
          when shaped.profile_type = 'mountain' then 5.2
          when shaped.profile_type in ('hilly', 'mixed') then 2.6
          else 1.4
        end
        + ((shaped.segment_number * 29) % 32) / 10.0
      )::numeric, 2)
  end
from shaped
order by shaped.stage_id, shaped.segment_number
on conflict (stage_id, segment_number) do nothing;

-- GPM des nouveaux tours.
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
  join public.race_editions as edition
    on edition.id = stage.race_edition_id
  join public.races as race
    on race.id = edition.race_id
  join expanded_race_slugs as target_race
    on target_race.slug = race.slug
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
where race.race_format = 'stage_race'
on conflict (stage_segment_id, prime_type)
do update set
  mountain_category = excluded.mountain_category,
  points_scale = excluded.points_scale;

-- Sprint intermédiaire proche de 42 % sur chaque étape en ligne d'un tour.
with eligible_segments as (
  select
    segment.id as stage_segment_id,
    segment.stage_id,
    segment.segment_number,
    max(segment.segment_number) over (
      partition by segment.stage_id
    ) as segment_count
  from public.stage_segments as segment
  join public.stages as stage
    on stage.id = segment.stage_id
   and stage.stage_type = 'road'
  join public.race_editions as edition
    on edition.id = stage.race_edition_id
  join public.races as race
    on race.id = edition.race_id
   and race.race_format = 'stage_race'
  join expanded_race_slugs as target_race
    on target_race.slug = race.slug
  where segment.terrain_type = 'flat'
    and segment.segment_number > 1
    and not exists (
      select 1
      from public.stage_segment_primes as existing_prime
      where existing_prime.stage_segment_id = segment.id
    )
), candidates as (
  select
    eligible.stage_segment_id,
    eligible.stage_id,
    row_number() over (
      partition by eligible.stage_id
      order by
        abs(eligible.segment_number - eligible.segment_count * 0.42),
        eligible.segment_number
    ) as preference_rank
  from eligible_segments as eligible
  where eligible.segment_number < eligible.segment_count
)
insert into public.stage_segment_primes (
  stage_segment_id,
  prime_type,
  mountain_category,
  points_scale
)
select
  candidates.stage_segment_id,
  'intermediate_sprint',
  null,
  array[20, 17, 15, 13, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1]::smallint[]
from candidates
where candidates.preference_rank = 1
on conflict (stage_segment_id, prime_type) do nothing;

commit;
