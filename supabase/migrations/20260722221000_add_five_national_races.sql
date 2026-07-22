begin;

create temporary table added_national_race_seed (
  slug text primary key,
  name text not null,
  short_name text not null,
  country_code text not null,
  race_format text not null check (race_format in ('one_day', 'stage_race')),
  start_day smallint not null check (start_day between 1 and 28),
  start_slot text not null check (start_slot in ('early', 'late')),
  profiles text[] not null,
  distances numeric[] not null,
  constraint added_national_race_seed_lengths
    check (cardinality(profiles) = cardinality(distances))
) on commit drop;

insert into added_national_race_seed (
  slug,
  name,
  short_name,
  country_code,
  race_format,
  start_day,
  start_slot,
  profiles,
  distances
)
values
  (
    'tour-des-lacs-d-auvergne',
    'Tour des Lacs d’Auvergne',
    'TLA',
    'FR',
    'stage_race',
    10,
    'early',
    array['sprint','hilly','mountain','time_trial','hilly','mountain'],
    array[126,134,148,29,138,152]::numeric[]
  ),
  (
    'tour-des-highlands-de-donegal',
    'Tour des Highlands de Donegal',
    'THD',
    'IE',
    'stage_race',
    21,
    'early',
    array['hilly','sprint','mountain','hilly','time_trial'],
    array[122,131,146,136,31]::numeric[]
  ),
  (
    'classique-des-ardennes-luxembourgeoises',
    'Classique des Ardennes Luxembourgeoises',
    'CAL',
    'LU',
    'one_day',
    7,
    'late',
    array['hilly'],
    array[178]::numeric[]
  ),
  (
    'circuit-des-lacs-de-mazurie',
    'Circuit des Lacs de Mazurie',
    'CLMZ',
    'PL',
    'one_day',
    16,
    'early',
    array['sprint'],
    array[186]::numeric[]
  ),
  (
    'ruta-de-los-pueblos-blancos',
    'Ruta de los Pueblos Blancos',
    'RPB',
    'ES',
    'one_day',
    27,
    'late',
    array['mountain'],
    array[192]::numeric[]
  );

do $$
begin
  if (select count(*) from added_national_race_seed) <> 5 then
    raise exception 'Le complément national doit contenir exactement cinq épreuves.';
  end if;

  if exists (
    select 1
    from added_national_race_seed as seed
    left join public.countries as country
      on country.iso_alpha2 = seed.country_code
    where country.id is null
  ) then
    raise exception 'Un pays du complément national manque au référentiel.';
  end if;

  if exists (
    select 1
    from added_national_race_seed as seed
    where seed.start_day
      + ((case seed.start_slot when 'early' then 0 else 1 end + cardinality(seed.profiles) - 1) / 2)
      > 28
  ) then
    raise exception 'Une épreuve nationale dépasse la fin de saison.';
  end if;
end;
$$;

insert into public.races (
  country_id,
  name,
  short_name,
  race_format,
  status,
  slug
)
select
  country.id,
  seed.name,
  seed.short_name,
  seed.race_format,
  'active',
  seed.slug
from added_national_race_seed as seed
join public.countries as country
  on country.iso_alpha2 = seed.country_code
on conflict (slug)
do update set
  country_id = excluded.country_id,
  name = excluded.name,
  short_name = excluded.short_name,
  race_format = excluded.race_format,
  status = excluded.status;

insert into public.race_editions (
  race_id,
  season_id,
  race_category_id,
  edition_number,
  display_name,
  status,
  minimum_reputation,
  registration_policy,
  field_limit
)
select
  race.id,
  season.id,
  category.id,
  1,
  seed.name,
  'registration_open',
  0,
  'open',
  24
from added_national_race_seed as seed
join public.races as race
  on race.slug = seed.slug
cross join public.seasons as season
cross join public.race_categories as category
where category.code = 'national'
  and season.status in ('active', 'planned')
on conflict (race_id, season_id)
do update set
  race_category_id = excluded.race_category_id,
  display_name = excluded.display_name,
  minimum_reputation = excluded.minimum_reputation,
  registration_policy = excluded.registration_policy,
  field_limit = excluded.field_limit;

insert into public.stages (
  race_edition_id,
  season_day_id,
  day_slot,
  stage_number,
  name,
  stage_type,
  distance_km,
  status,
  departure_at,
  profile_type
)
select
  edition.id,
  season_day.id,
  schedule.day_slot,
  generated.stage_number,
  case
    when seed.race_format = 'one_day' then seed.name
    else 'Étape ' || generated.stage_number
  end,
  case
    when seed.profiles[generated.stage_number] = 'time_trial'
      then 'individual_time_trial'
    else 'road'
  end,
  seed.distances[generated.stage_number],
  'planned',
  (
    season_day.calendar_date::timestamp
    + case schedule.day_slot
        when 'early' then time '14:00'
        else time '18:00'
      end
  ) at time zone 'Europe/Paris',
  seed.profiles[generated.stage_number]
from added_national_race_seed as seed
join public.races as race
  on race.slug = seed.slug
join public.race_editions as edition
  on edition.race_id = race.id
join public.seasons as season
  on season.id = edition.season_id
cross join lateral generate_series(
  1,
  cardinality(seed.profiles)
) as generated(stage_number)
cross join lateral (
  select
    seed.start_day
      + ((case seed.start_slot when 'early' then 0 else 1 end + generated.stage_number - 1) / 2)
      as day_number,
    case mod(
      case seed.start_slot when 'early' then 0 else 1 end + generated.stage_number - 1,
      2
    )
      when 0 then 'early'
      else 'late'
    end as day_slot
) as schedule
join public.season_days as season_day
  on season_day.season_id = season.id
 and season_day.day_number = schedule.day_number
on conflict (race_edition_id, stage_number)
do update set
  season_day_id = excluded.season_day_id,
  day_slot = excluded.day_slot,
  name = excluded.name,
  stage_type = excluded.stage_type,
  distance_km = excluded.distance_km,
  status = excluded.status,
  departure_at = excluded.departure_at,
  profile_type = excluded.profile_type;

delete from public.stage_segments as segment
using public.stages as stage,
      public.race_editions as edition,
      public.races as race,
      added_national_race_seed as seed
where segment.stage_id = stage.id
  and stage.race_edition_id = edition.id
  and edition.race_id = race.id
  and race.slug = seed.slug;

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
  join added_national_race_seed as seed
    on seed.slug = race.slug
), generated_segments as (
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
), shaped_segments as (
  select
    generated.*,
    case
      when generated.profile_type = 'mountain' then
        case
          when generated.segment_number >= generated.segment_count - 3 then 'climb'
          when generated.segment_number % 6 in (1, 2) then 'climb'
          when generated.segment_number % 6 = 3 then 'descent'
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
      else 'flat'
    end as terrain_type
  from generated_segments as generated
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
  'asphalt',
  case shaped.terrain_type
    when 'climb' then
      case
        when shaped.profile_type = 'mountain'
          and shaped.segment_number >= shaped.segment_count - 3
        then 6.0 + ((shaped.segment_number + shaped.segment_count) % 4) * 0.8
        else 3.5 + (shaped.segment_number % 4) * 0.7
      end
    when 'descent' then -(3.0 + (shaped.segment_number % 4) * 0.8)
    else 0
  end
from shaped_segments as shaped
on conflict (stage_id, segment_number)
do update set
  distance_km = excluded.distance_km,
  terrain_type = excluded.terrain_type,
  surface_type = excluded.surface_type,
  average_gradient_pct = excluded.average_gradient_pct;

with climb_summits as (
  select
    segment.id as stage_segment_id,
    stage.profile_type,
    segment.segment_number,
    max(segment.segment_number) over (partition by segment.stage_id) as segment_count,
    segment.average_gradient_pct,
    lead(segment.terrain_type) over (
      partition by segment.stage_id
      order by segment.segment_number
    ) as next_terrain
  from public.stage_segments as segment
  join public.stages as stage
    on stage.id = segment.stage_id
  join public.race_editions as edition
    on edition.id = stage.race_edition_id
  join public.races as race
    on race.id = edition.race_id
  join added_national_race_seed as seed
    on seed.slug = race.slug
  where segment.terrain_type = 'climb'
)
insert into public.stage_segment_primes (
  stage_segment_id,
  prime_type,
  mountain_category,
  points_scale
)
select
  summit.stage_segment_id,
  'mountain',
  case
    when summit.profile_type = 'mountain'
      and summit.segment_number = summit.segment_count then 'HC'
    when summit.average_gradient_pct >= 6 then '1'
    when summit.average_gradient_pct >= 4.5 then '2'
    else '3'
  end,
  case
    when summit.profile_type = 'mountain'
      and summit.segment_number = summit.segment_count
      then array[20,16,12,8,4,2]::smallint[]
    when summit.average_gradient_pct >= 6
      then array[12,8,5,3,2,1]::smallint[]
    else array[6,4,2,1]::smallint[]
  end
from climb_summits as summit
where summit.next_terrain is distinct from 'climb'
on conflict (stage_segment_id, prime_type)
do update set
  mountain_category = excluded.mountain_category,
  points_scale = excluded.points_scale;

with sprint_candidates as (
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
  join public.race_editions as edition
    on edition.id = stage.race_edition_id
  join public.races as race
    on race.id = edition.race_id
   and race.race_format = 'stage_race'
  join added_national_race_seed as seed
    on seed.slug = race.slug
  where segment.terrain_type = 'flat'
    and segment.segment_number > 1
    and not exists (
      select 1
      from public.stage_segment_primes as existing_prime
      where existing_prime.stage_segment_id = segment.id
    )
), eligible_sprints as (
  select
    candidate.stage_segment_id,
    row_number() over (
      partition by candidate.stage_id
      order by abs(
        candidate.segment_number - (candidate.segment_count * 0.55)
      )
    ) as preference_rank
  from sprint_candidates as candidate
)
insert into public.stage_segment_primes (
  stage_segment_id,
  prime_type,
  mountain_category,
  points_scale
)
select
  sprint.stage_segment_id,
  'intermediate_sprint',
  null,
  array[20,17,15,13,11,10,9,8,7,6,5,4,3,2,1]::smallint[]
from eligible_sprints as sprint
where sprint.preference_rank = 1
on conflict (stage_segment_id, prime_type)
do update set
  mountain_category = excluded.mountain_category,
  points_scale = excluded.points_scale;

update public.race_editions as edition
set
  registration_closes_at = first_stage.closes_at,
  withdrawal_closes_at = first_stage.closes_at
from (
  select distinct on (stage.race_edition_id)
    stage.race_edition_id,
    (
      season_day.calendar_date::timestamp
      + case stage.day_slot
          when 'early' then time '08:00'
          else time '12:00'
        end
    ) at time zone 'Europe/Paris' as closes_at
  from public.stages as stage
  join public.season_days as season_day
    on season_day.id = stage.season_day_id
  join public.race_editions as target_edition
    on target_edition.id = stage.race_edition_id
  join public.races as race
    on race.id = target_edition.race_id
  join added_national_race_seed as seed
    on seed.slug = race.slug
  order by stage.race_edition_id, stage.stage_number
) as first_stage
where edition.id = first_stage.race_edition_id;

commit;
