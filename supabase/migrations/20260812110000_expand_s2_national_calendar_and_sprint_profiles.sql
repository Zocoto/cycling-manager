begin;

-- Cette extension ne concerne que les saisons futures à partir de la S2.
-- La S1 et ses étapes, courues ou encore au calendrier, restent inchangées.
create temporary table s2_national_race_seed (
  slug text primary key,
  name text not null,
  short_name text not null,
  country_code text not null,
  day_number smallint not null check (day_number between 1 and 28),
  day_slot text not null check (day_slot in ('early', 'late')),
  profile_type text not null check (
    profile_type in ('flat', 'sprint', 'hilly', 'mountain', 'cobbles')
  ),
  distance_km numeric(6, 2) not null check (distance_km > 0)
) on commit drop;

insert into s2_national_race_seed (
  slug,
  name,
  short_name,
  country_code,
  day_number,
  day_slot,
  profile_type,
  distance_km
)
values
  ('ronde-des-polders', 'Ronde des Polders', 'RDP', 'NL', 3, 'late', 'cobbles', 174),
  ('trophee-des-chemins-d-armor', 'Trophée des Chemins d’Armor', 'TCA', 'FR', 7, 'early', 'cobbles', 169),
  ('kasseien-van-limburg', 'Kasseien van Limburg', 'KVL', 'BE', 13, 'late', 'cobbles', 177),
  ('strade-del-monferrato', 'Strade del Monferrato', 'SDM', 'IT', 19, 'early', 'cobbles', 181),
  ('circuit-de-la-costa-brava', 'Circuit de la Costa Brava', 'CCB2', 'ES', 11, 'early', 'sprint', 173),
  ('bergpreis-im-harz', 'Bergpreis im Harz', 'BIH', 'DE', 21, 'late', 'mountain', 176),
  ('wielkopolska-classic', 'Wielkopolska Classic', 'WKC', 'PL', 25, 'early', 'flat', 184),
  ('wachau-hugelklassik', 'Wachau Hügelklassik', 'WHK', 'AT', 27, 'early', 'hilly', 178);

do $$
begin
  if (select count(*) from s2_national_race_seed) <> 8 then
    raise exception 'Le complément S2 doit contenir exactement huit courses nationales.';
  end if;

  if (
    select count(*)
    from s2_national_race_seed
    where profile_type = 'cobbles'
  ) <> 4 then
    raise exception 'Le complément S2 doit contenir exactement quatre classiques pavées.';
  end if;

  if exists (
    select 1
    from s2_national_race_seed as seed
    left join public.countries as country
      on country.iso_alpha2 = seed.country_code
    where country.id is null
  ) then
    raise exception 'Un pays du complément national S2 manque au référentiel.';
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
  'one_day',
  'active',
  seed.slug
from s2_national_race_seed as seed
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
  greatest(1, season.game_year - 1),
  seed.name,
  'registration_open',
  0,
  'open',
  24
from s2_national_race_seed as seed
join public.races as race
  on race.slug = seed.slug
cross join public.seasons as season
cross join public.race_categories as category
where season.game_year >= 2
  and season.status = 'planned'
  and category.code = 'national'
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
  seed.day_slot,
  1,
  seed.name,
  'road',
  seed.distance_km,
  'planned',
  (
    season_day.calendar_date::timestamp
    + case seed.day_slot
        when 'early' then time '14:00'
        else time '18:00'
      end
  ) at time zone 'Europe/Paris',
  seed.profile_type
from s2_national_race_seed as seed
join public.races as race
  on race.slug = seed.slug
join public.race_editions as edition
  on edition.race_id = race.id
join public.seasons as season
  on season.id = edition.season_id
 and season.game_year >= 2
 and season.status = 'planned'
join public.season_days as season_day
  on season_day.season_id = season.id
 and season_day.day_number = seed.day_number
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

-- Les nouvelles classiques reçoivent chacune un profil propre. Les secteurs
-- pavés sont distribués par blocs et non concentrés dans une seule zone.
delete from public.stage_segments as segment
using public.stages as stage,
      public.race_editions as edition,
      public.seasons as season,
      public.races as race,
      s2_national_race_seed as seed
where segment.stage_id = stage.id
  and stage.race_edition_id = edition.id
  and edition.season_id = season.id
  and edition.race_id = race.id
  and race.slug = seed.slug
  and season.game_year >= 2
  and season.status = 'planned'
  and stage.status = 'planned';

with target_stages as (
  select
    stage.id as stage_id,
    stage.profile_type,
    stage.distance_km,
    ceil(stage.distance_km / 10.0)::integer as segment_count
  from public.stages as stage
  join public.race_editions as edition
    on edition.id = stage.race_edition_id
  join public.seasons as season
    on season.id = edition.season_id
   and season.game_year >= 2
   and season.status = 'planned'
  join public.races as race
    on race.id = edition.race_id
  join s2_national_race_seed as seed
    on seed.slug = race.slug
  where stage.status = 'planned'
), generated as (
  select
    target.*,
    generated.segment_number,
    least(
      10.0,
      target.distance_km - ((generated.segment_number - 1) * 10.0)
    )::numeric(5, 2) as segment_distance_km
  from target_stages as target
  cross join lateral generate_series(1, target.segment_count)
    as generated(segment_number)
), shaped as (
  select
    generated.*,
    case
      when generated.profile_type = 'mountain' then
        case
          when generated.segment_number >= generated.segment_count - 3 then 'climb'
          when generated.segment_number % 7 in (2, 3) then 'climb'
          when generated.segment_number % 7 = 4 then 'descent'
          else 'flat'
        end
      when generated.profile_type = 'hilly' then
        case generated.segment_number % 8
          when 2 then 'climb'
          when 3 then 'descent'
          when 5 then 'climb'
          when 6 then 'descent'
          else 'flat'
        end
      when generated.profile_type = 'cobbles' then
        case generated.segment_number % 9
          when 4 then 'climb'
          when 5 then 'descent'
          else 'flat'
        end
      else 'flat'
    end as terrain_type
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
  case
    when shaped.profile_type = 'cobbles'
      and shaped.segment_number > 1
      and shaped.segment_number < shaped.segment_count
      and shaped.segment_number % 5 in (1, 2)
      then 'cobbles'
    else 'asphalt'
  end,
  case
    when shaped.terrain_type = 'climb' then
      case
        when shaped.profile_type = 'mountain'
          and shaped.segment_number >= shaped.segment_count - 3
          then 5.8 + (shaped.segment_number % 4) * 0.7
        when shaped.profile_type = 'cobbles'
          then 2.6 + (shaped.segment_number % 3) * 0.4
        else 3.4 + (shaped.segment_number % 4) * 0.6
      end
    when shaped.terrain_type = 'descent' then
      case
        when shaped.profile_type = 'cobbles'
          then -(2.4 + (shaped.segment_number % 3) * 0.4)
        else -(3.0 + (shaped.segment_number % 4) * 0.6)
      end
    else 0
  end
from shaped
on conflict (stage_id, segment_number)
do update set
  distance_km = excluded.distance_km,
  terrain_type = excluded.terrain_type,
  surface_type = excluded.surface_type,
  average_gradient_pct = excluded.average_gradient_pct;

update public.race_editions as edition
set
  registration_closes_at = deadline.closes_at,
  withdrawal_closes_at = deadline.closes_at
from (
  select
    target_edition.id as race_edition_id,
    (
      season_day.calendar_date::timestamp
      + case stage.day_slot
          when 'early' then time '08:00'
          else time '12:00'
        end
    ) at time zone 'Europe/Paris' as closes_at
  from public.race_editions as target_edition
  join public.seasons as season
    on season.id = target_edition.season_id
   and season.game_year >= 2
   and season.status = 'planned'
  join public.races as race
    on race.id = target_edition.race_id
  join s2_national_race_seed as seed
    on seed.slug = race.slug
  join public.stages as stage
    on stage.race_edition_id = target_edition.id
   and stage.stage_number = 1
  join public.season_days as season_day
    on season_day.id = stage.season_day_id
) as deadline
where edition.id = deadline.race_edition_id;

-- Trois familles pour les étapes de plaine des tours S2+ :
-- 0 = totalement plate, 1 = une ondulation douce, 2 = deux difficultés
-- courtes. Les 25 derniers kilomètres restent toujours plats.
create temporary table s2_sprint_stage_shape
on commit drop
as
select
  stage.id as stage_id,
  stage.stage_number,
  stage.distance_km,
  race.slug,
  case
    when race.slug = 'ruta-de-las-sierras'
      and stage.stage_number in (1, 4, 8) then 0
    when race.slug = 'ruta-de-las-sierras'
      and stage.stage_number = 12 then 1
    else mod(length(race.slug) + stage.stage_number, 3)
  end as shape_variant
from public.stages as stage
join public.race_editions as edition
  on edition.id = stage.race_edition_id
join public.seasons as season
  on season.id = edition.season_id
 and season.game_year >= 2
 and season.status = 'planned'
join public.races as race
  on race.id = edition.race_id
 and race.race_format = 'stage_race'
where stage.profile_type in ('flat', 'sprint')
  and stage.stage_type = 'road'
  and stage.status = 'planned'
  and not exists (
    select 1
    from public.stage_results as result
    where result.stage_id = stage.id
  );

delete from public.stage_segments as segment
using s2_sprint_stage_shape as target
where segment.stage_id = target.stage_id;

with target_stages as (
  select
    target.*,
    ceil(target.distance_km / 5.0)::integer as segment_count
  from s2_sprint_stage_shape as target
), generated as (
  select
    target.*,
    generated.segment_number,
    least(
      5.0,
      target.distance_km - ((generated.segment_number - 1) * 5.0)
    )::numeric(5, 2) as segment_distance_km,
    greatest(4, floor(target.segment_count * 0.38)::integer) as rolling_climb,
    greatest(4, floor(target.segment_count * 0.27)::integer) as selective_climb_one,
    greatest(8, floor(target.segment_count * 0.61)::integer) as selective_climb_two
  from target_stages as target
  cross join lateral generate_series(1, target.segment_count)
    as generated(segment_number)
), shaped as (
  select
    generated.*,
    case
      when generated.shape_variant = 0 then 'flat'
      when generated.shape_variant = 1
        and generated.segment_number = generated.rolling_climb then 'climb'
      when generated.shape_variant = 1
        and generated.segment_number = generated.rolling_climb + 1 then 'descent'
      when generated.shape_variant = 2
        and generated.segment_number in (
          generated.selective_climb_one,
          generated.selective_climb_two
        ) then 'climb'
      when generated.shape_variant = 2
        and generated.segment_number in (
          generated.selective_climb_one + 1,
          generated.selective_climb_two + 1
        ) then 'descent'
      else 'flat'
    end as terrain_type
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
  'asphalt',
  case
    when shaped.terrain_type = 'climb' and shaped.shape_variant = 1
      then 2.4 + mod(shaped.stage_number + shaped.segment_number, 5) * 0.18
    when shaped.terrain_type = 'climb'
      then 3.0 + mod(shaped.stage_number + shaped.segment_number, 5) * 0.25
    when shaped.terrain_type = 'descent' and shaped.shape_variant = 1
      then -(2.2 + mod(shaped.stage_number + shaped.segment_number, 4) * 0.18)
    when shaped.terrain_type = 'descent'
      then -(2.8 + mod(shaped.stage_number + shaped.segment_number, 4) * 0.25)
    else 0
  end
from shaped
order by shaped.stage_id, shaped.segment_number;

-- Les petites difficultés des étapes sélectives ne dépassent jamais la 4e
-- catégorie. Elles pimentent la journée sans transformer le sprint en étape
-- de montagne.
insert into public.stage_segment_primes (
  stage_segment_id,
  prime_type,
  mountain_category,
  points_scale
)
select
  segment.id,
  'mountain',
  '4',
  array[3,2,1]::smallint[]
from public.stage_segments as segment
join s2_sprint_stage_shape as target
  on target.stage_id = segment.stage_id
where segment.terrain_type = 'climb'
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
  join s2_sprint_stage_shape as target
    on target.stage_id = segment.stage_id
  where segment.terrain_type = 'flat'
    and segment.segment_number > 2
    and not exists (
      select 1
      from public.stage_segment_primes as prime
      where prime.stage_segment_id = segment.id
    )
), preferred_sprints as (
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
from preferred_sprints as sprint
where sprint.preference_rank = 1
on conflict (stage_segment_id, prime_type)
do update set
  mountain_category = excluded.mountain_category,
  points_scale = excluded.points_scale;

commit;
