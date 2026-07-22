begin;

-- Vingt nouvelles épreuves : cinq par catégorie, dont huit tours utilisant
-- réellement les deux créneaux quotidiens. Les distances des étapes sont
-- adaptées à un format de demi-journée.
create temporary table expanded_race_seed (
  slug text primary key,
  name text not null,
  short_name text,
  country_code text not null,
  category_code text not null,
  race_format text not null,
  start_day smallint not null,
  start_slot text not null check (start_slot in ('early', 'late')),
  stage_count smallint not null,
  profile_pattern text[] not null,
  base_distance_km numeric(6, 2) not null
) on commit drop;

insert into expanded_race_seed (
  slug,
  name,
  short_name,
  country_code,
  category_code,
  race_format,
  start_day,
  start_slot,
  stage_count,
  profile_pattern,
  base_distance_km
)
values
  -- Elite : deux tours et trois classiques de prestige.
  ('tour-des-volcans-du-pacifique', 'Tour des Volcans du Pacifique', 'TVP', 'ID', 'elite', 'stage_race', 7, 'early', 5, array['sprint','hilly','mountain','time_trial','mountain'], 142),
  ('aurora-borealis-tour', 'Aurora Borealis Tour', 'ABT', 'IS', 'elite', 'stage_race', 18, 'early', 6, array['hilly','time_trial','cobbles','mountain','hilly','sprint'], 138),
  ('classique-du-caucase', 'La Classique du Caucase', 'LCC', 'GE', 'elite', 'one_day', 13, 'early', 1, array['mountain'], 214),
  ('desert-to-sky-classic', 'Desert to Sky Classic', 'DSC', 'OM', 'elite', 'one_day', 22, 'late', 1, array['hilly'], 226),
  ('patagonia-fin-del-mundo', 'Patagonia Fin del Mundo', 'PFM', 'AR', 'elite', 'one_day', 25, 'late', 1, array['mountain'], 219),

  -- Mondial : hautes terres africaines, route de la soie et grands horizons.
  ('tour-du-rift', 'Tour du Rift', 'TDR', 'RW', 'world', 'stage_race', 9, 'early', 5, array['hilly','mountain','sprint','time_trial','mountain'], 128),
  ('silk-road-tour', 'Silk Road Tour', 'SRT', 'KZ', 'world', 'stage_race', 16, 'early', 6, array['flat','sprint','hilly','time_trial','mountain','sprint'], 136),
  ('caribbean-trade-winds', 'Caribbean Trade Winds', 'CTW', 'BB', 'world', 'one_day', 12, 'late', 1, array['sprint'], 201),
  ('himalayan-gateway-classic', 'Himalayan Gateway Classic', 'HGC', 'NP', 'world', 'one_day', 24, 'early', 1, array['mountain'], 198),
  ('tasman-sea-classic', 'Tasman Sea Classic', 'TSC', 'NZ', 'world', 'one_day', 27, 'late', 1, array['hilly'], 207),

  -- Continental : royaumes himalayens, Mékong, désert et océan Indien.
  ('dragon-kingdom-tour', 'Dragon Kingdom Tour', 'DKT', 'BT', 'continental', 'stage_race', 13, 'early', 5, array['hilly','mountain','time_trial','mountain','sprint'], 116),
  ('mekong-delta-tour', 'Mekong Delta Tour', 'MDT', 'KH', 'continental', 'stage_race', 21, 'early', 4, array['flat','sprint','hilly','time_trial'], 124),
  ('altiplano-boliviano', 'Altiplano Boliviano', 'ABO', 'BO', 'continental', 'one_day', 10, 'early', 1, array['mountain'], 186),
  ('namib-sun-classic', 'Namib Sun Classic', 'NSC', 'NA', 'continental', 'one_day', 24, 'late', 1, array['sprint'], 191),
  ('madagascar-red-earth', 'Madagascar Red Earth', 'MRE', 'MG', 'continental', 'one_day', 27, 'early', 1, array['hilly'], 184),

  -- National : circuits locaux à l'identité immédiatement reconnaissable.
  ('tour-des-hauts-de-laos', 'Tour des Hauts du Laos', 'THL', 'LA', 'national', 'stage_race', 7, 'early', 3, array['hilly','mountain','sprint'], 108),
  ('boucle-de-zanzibar', 'Boucle de Zanzibar', 'BDZ', 'TZ', 'national', 'stage_race', 15, 'early', 4, array['sprint','flat','hilly','sprint'], 112),
  ('criterium-de-singapour', 'Critérium de Singapour', 'CDS', 'SG', 'national', 'one_day', 11, 'late', 1, array['sprint'], 158),
  ('circuit-des-fjords-feroiens', 'Circuit des Fjords Féroïens', 'CFF', 'FO', 'national', 'one_day', 20, 'early', 1, array['hilly'], 169),
  ('route-des-cafes-du-timor', 'Route des Cafés du Timor', 'RCT', 'TL', 'national', 'one_day', 28, 'late', 1, array['hilly'], 172);

do $$
begin
  if (select count(*) from expanded_race_seed) <> 20 then
    raise exception 'Le catalogue étendu doit contenir exactement 20 courses.';
  end if;

  if exists (
    select 1
    from expanded_race_seed as seed
    left join public.countries as country
      on country.iso_alpha2 = seed.country_code
    where country.id is null
  ) then
    raise exception 'Un pays du calendrier étendu manque au référentiel.';
  end if;

  if exists (
    select 1
    from expanded_race_seed as seed
    left join public.race_categories as category
      on category.code = seed.category_code
    where category.id is null
  ) then
    raise exception 'Une catégorie du calendrier étendu est inconnue.';
  end if;

  if exists (
    select 1
    from expanded_race_seed as seed
    where seed.start_slot not in ('early', 'late')
      or seed.start_day < 1
      or seed.start_day + ((seed.stage_count - 1) / 2) > 28
  ) then
    raise exception 'Un créneau du calendrier étendu sort des 28 jours de saison.';
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
from expanded_race_seed as seed
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
  case
    when seed.category_code = 'national' then 0
    else null
  end,
  case
    when seed.category_code = 'national' then 'open'
    else 'criteria_pending'
  end,
  24
from expanded_race_seed as seed
join public.races as race
  on race.slug = seed.slug
join public.race_categories as category
  on category.code = seed.category_code
cross join public.seasons as season
where season.status = 'active'
on conflict (race_id, season_id)
do update set
  race_category_id = excluded.race_category_id,
  edition_number = excluded.edition_number,
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
    when schedule.profile_type = 'time_trial'
      then 'individual_time_trial'
    else 'road'
  end,
  case
    when schedule.profile_type = 'time_trial' then
      case
        when seed.stage_count > 1
          then greatest(24, round(seed.base_distance_km * 0.24))
        else seed.base_distance_km
      end
    else seed.base_distance_km + ((generated.stage_number - 1) % 3) * 6
  end,
  'planned',
  (
    season_day.calendar_date::timestamp
    + case schedule.day_slot
        when 'early' then time '14:00'
        else time '18:00'
      end
  ) at time zone 'Europe/Paris',
  schedule.profile_type
from expanded_race_seed as seed
join public.races as race
  on race.slug = seed.slug
join public.race_editions as edition
  on edition.race_id = race.id
join public.seasons as season
  on season.id = edition.season_id
cross join lateral generate_series(
  1,
  seed.stage_count
) as generated(stage_number)
cross join lateral (
  select
    case
      when seed.race_format = 'stage_race'
        then case mod(generated.stage_number - 1, 2)
          when 0 then 'early'
          else 'late'
        end
      else seed.start_slot
    end as day_slot,
    seed.profile_pattern[
      ((generated.stage_number - 1) % cardinality(seed.profile_pattern)) + 1
    ] as profile_type,
    case
      when seed.race_format = 'stage_race'
        then seed.start_day + ((generated.stage_number - 1) / 2)
      else seed.start_day
    end as day_number
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
  departure_at = excluded.departure_at,
  profile_type = excluded.profile_type;

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
  join expanded_race_seed as seed
    on seed.slug = race.slug
  order by stage.race_edition_id, stage.stage_number
) as first_stage
where edition.id = first_stage.race_edition_id;

commit;
