begin;

-- Le moteur officiel, la préparation des relais et la scène de course prennent déjà en
-- charge team_time_trial. Cette migration expose enfin ce format dans le
-- calendrier, sans ajouter de requête aux pages et sans toucher aux courses
-- courues. Les profils sont décrits une seule fois puis appliqués ensemblistement.

create temporary table calendar_profile_shape (
  shape_code text primary key,
  stage_type text not null check (
    stage_type in ('road', 'individual_time_trial', 'team_time_trial', 'prologue')
  ),
  profile_type text not null check (
    profile_type in ('flat', 'sprint', 'hilly', 'mountain', 'cobbles', 'time_trial', 'mixed')
  ),
  segments jsonb not null check (
    jsonb_typeof(segments) = 'array' and jsonb_array_length(segments) > 0
  )
) on commit drop;

insert into calendar_profile_shape (
  shape_code,
  stage_type,
  profile_type,
  segments
)
values
  ('ttt-rolling-31', 'team_time_trial', 'time_trial',
   '[{"d":7,"t":"flat"},{"d":4,"t":"climb","g":3.2},{"d":4,"t":"descent","g":-3.0},{"d":8,"t":"flat"},{"d":3,"t":"climb","g":2.4},{"d":2,"t":"descent","g":-2.2},{"d":3,"t":"flat"}]'),
  ('ttt-fast-24', 'team_time_trial', 'time_trial',
   '[{"d":6,"t":"flat"},{"d":6,"t":"flat"},{"d":6,"t":"flat"},{"d":6,"t":"flat"}]'),
  ('ttt-coastal-36', 'team_time_trial', 'time_trial',
   '[{"d":10,"t":"flat"},{"d":4,"t":"climb","g":2.1},{"d":4,"t":"descent","g":-2.0},{"d":10,"t":"flat"},{"d":8,"t":"flat"}]'),
  ('ttt-technical-19', 'team_time_trial', 'time_trial',
   '[{"d":3,"t":"flat"},{"d":3,"t":"flat"},{"d":3,"t":"flat"},{"d":3,"t":"flat"},{"d":3,"t":"flat"},{"d":4,"t":"flat"}]'),
  ('ttt-mountain-27', 'team_time_trial', 'time_trial',
   '[{"d":5,"t":"flat"},{"d":5,"t":"climb","g":3.8},{"d":4,"t":"descent","g":-3.5},{"d":5,"t":"flat"},{"d":4,"t":"climb","g":4.2},{"d":4,"t":"flat"}]'),

  ('short-punchy-78', 'road', 'hilly',
   '[{"d":10,"t":"flat","p":"sprint"},{"d":4,"t":"climb","g":6.5,"p":"3"},{"d":3,"t":"descent","g":-5.8},{"d":8,"t":"flat"},{"d":3,"t":"climb","g":9.5,"p":"3"},{"d":3,"t":"descent","g":-7.2},{"d":10,"t":"flat"},{"d":4,"t":"climb","g":7.8,"p":"3"},{"d":4,"t":"descent","g":-6.8},{"d":12,"t":"flat"},{"d":3,"t":"climb","g":11.0,"p":"2"},{"d":4,"t":"descent","g":-8.5},{"d":10,"t":"flat"}]'),
  ('walls-116', 'road', 'hilly',
   '[{"d":15,"t":"flat"},{"d":5,"t":"climb","g":5.0,"p":"3"},{"d":4,"t":"descent","g":-4.8},{"d":12,"t":"flat","p":"sprint"},{"d":4,"t":"climb","g":8.0,"p":"3"},{"d":4,"t":"descent","g":-7.0},{"d":16,"t":"flat"},{"d":3,"t":"climb","g":12.0,"p":"2"},{"d":3,"t":"descent","g":-9.0},{"d":12,"t":"flat"},{"d":6,"t":"climb","g":7.0,"p":"2"},{"d":5,"t":"descent","g":-6.2},{"d":10,"t":"flat"},{"d":7,"t":"climb","g":5.0,"p":"3"},{"d":10,"t":"flat"}]'),
  ('mountain-summit-112', 'road', 'mountain',
   '[{"d":18,"t":"flat"},{"d":6,"t":"climb","g":4.0,"p":"3"},{"d":5,"t":"descent","g":-4.0},{"d":10,"t":"flat","p":"sprint"},{"d":12,"t":"climb","g":6.5,"p":"1"},{"d":10,"t":"descent","g":-6.0},{"d":14,"t":"flat"},{"d":8,"t":"climb","g":8.0,"p":"1"},{"d":5,"t":"descent","g":-7.0},{"d":8,"t":"flat"},{"d":16,"t":"climb","g":8.5,"p":"HC"}]'),
  ('downhill-146', 'road', 'mountain',
   '[{"d":20,"t":"flat"},{"d":12,"t":"climb","g":5.5,"p":"2"},{"d":10,"t":"descent","g":-5.2},{"d":15,"t":"flat","p":"sprint"},{"d":18,"t":"climb","g":6.2,"p":"1"},{"d":14,"t":"descent","g":-6.0},{"d":12,"t":"flat"},{"d":20,"t":"climb","g":7.0,"p":"HC"},{"d":25,"t":"descent","g":-6.5}]'),
  ('unipuerto-132', 'road', 'mountain',
   '[{"d":28,"t":"flat"},{"d":24,"t":"flat","p":"sprint"},{"d":20,"t":"flat"},{"d":18,"t":"flat"},{"d":12,"t":"climb","g":4.5},{"d":10,"t":"climb","g":6.5},{"d":10,"t":"climb","g":8.0},{"d":10,"t":"climb","g":9.5,"p":"HC"}]'),
  ('marathon-244', 'road', 'mountain',
   '[{"d":30,"t":"flat"},{"d":18,"t":"climb","g":3.5,"p":"2"},{"d":15,"t":"descent","g":-3.8},{"d":24,"t":"flat","p":"sprint"},{"d":20,"t":"climb","g":4.8,"p":"1"},{"d":16,"t":"descent","g":-5.0},{"d":20,"t":"flat"},{"d":14,"t":"climb","g":6.2,"p":"1"},{"d":12,"t":"descent","g":-5.8},{"d":15,"t":"flat"},{"d":18,"t":"climb","g":7.4,"p":"HC"},{"d":12,"t":"descent","g":-6.8},{"d":30,"t":"flat"}]'),
  ('cobbled-204', 'road', 'cobbles',
   '[{"d":20,"t":"flat"},{"d":12,"t":"flat","s":"cobbles"},{"d":8,"t":"climb","g":4.0,"s":"cobbles","p":"3"},{"d":8,"t":"descent","g":-3.8,"s":"cobbles"},{"d":16,"t":"flat"},{"d":14,"t":"flat","s":"cobbles"},{"d":10,"t":"climb","g":5.5,"s":"cobbles","p":"2"},{"d":9,"t":"descent","g":-5.0,"s":"cobbles"},{"d":22,"t":"flat","p":"sprint"},{"d":16,"t":"flat","s":"cobbles"},{"d":6,"t":"climb","g":8.0,"s":"cobbles","p":"2"},{"d":5,"t":"descent","g":-7.0},{"d":20,"t":"flat"},{"d":18,"t":"flat","s":"cobbles"},{"d":20,"t":"flat"}]'),
  ('desert-sky-219', 'road', 'hilly',
   '[{"d":40,"t":"flat"},{"d":35,"t":"flat","p":"sprint"},{"d":20,"t":"climb","g":2.5},{"d":15,"t":"climb","g":4.0},{"d":12,"t":"climb","g":6.0},{"d":10,"t":"climb","g":8.0,"p":"HC"},{"d":12,"t":"flat"},{"d":15,"t":"descent","g":-6.0},{"d":20,"t":"flat"},{"d":40,"t":"flat"}]'),
  ('flanders-266', 'road', 'cobbles',
   '[{"d":25,"t":"flat"},{"d":15,"t":"flat","s":"cobbles"},{"d":8,"t":"climb","g":4.0,"s":"cobbles","p":"3"},{"d":6,"t":"descent","g":-3.8,"s":"cobbles"},{"d":22,"t":"flat"},{"d":18,"t":"flat","s":"cobbles"},{"d":6,"t":"climb","g":7.0,"s":"cobbles","p":"2"},{"d":5,"t":"descent","g":-6.0},{"d":25,"t":"flat","p":"sprint"},{"d":16,"t":"flat","s":"cobbles"},{"d":5,"t":"climb","g":9.0,"s":"cobbles","p":"2"},{"d":4,"t":"descent","g":-8.0},{"d":25,"t":"flat"},{"d":20,"t":"flat","s":"cobbles"},{"d":6,"t":"climb","g":6.0,"s":"cobbles","p":"2"},{"d":5,"t":"descent","g":-5.5},{"d":30,"t":"flat"},{"d":25,"t":"flat"}]'),
  ('tyrol-192', 'road', 'mountain',
   '[{"d":20,"t":"flat"},{"d":16,"t":"climb","g":5.0},{"d":12,"t":"climb","g":7.0,"p":"HC"},{"d":18,"t":"descent","g":-6.5},{"d":10,"t":"flat","p":"sprint"},{"d":20,"t":"climb","g":6.0},{"d":14,"t":"climb","g":8.0,"p":"HC"},{"d":20,"t":"descent","g":-7.0},{"d":12,"t":"flat"},{"d":18,"t":"climb","g":7.5,"p":"HC"},{"d":12,"t":"descent","g":-7.0},{"d":20,"t":"flat"}]'),
  ('patagonia-244', 'road', 'mountain',
   '[{"d":35,"t":"flat"},{"d":25,"t":"flat"},{"d":18,"t":"climb","g":4.0,"p":"2"},{"d":14,"t":"descent","g":-4.2},{"d":25,"t":"climb","g":2.5,"p":"2"},{"d":20,"t":"descent","g":-3.0},{"d":24,"t":"flat","p":"sprint"},{"d":18,"t":"climb","g":5.0,"p":"1"},{"d":15,"t":"descent","g":-5.2},{"d":20,"t":"flat"},{"d":16,"t":"climb","g":7.0,"p":"HC"},{"d":14,"t":"descent","g":-7.0}]'),
  ('ultra-flat-246', 'road', 'flat',
   '[{"d":50,"t":"flat"},{"d":50,"t":"flat","p":"sprint"},{"d":50,"t":"flat"},{"d":50,"t":"flat"},{"d":46,"t":"flat"}]'),
  ('micro-hills-118', 'road', 'hilly',
   '[{"d":8,"t":"flat"},{"d":3,"t":"climb","g":6.0,"p":"4"},{"d":3,"t":"descent","g":-5.0},{"d":7,"t":"flat"},{"d":2,"t":"climb","g":9.0,"p":"4"},{"d":2,"t":"descent","g":-7.0},{"d":8,"t":"flat","p":"sprint"},{"d":3,"t":"climb","g":7.0,"p":"4"},{"d":3,"t":"descent","g":-6.0},{"d":7,"t":"flat"},{"d":2,"t":"climb","g":10.0,"p":"4"},{"d":2,"t":"descent","g":-8.0},{"d":8,"t":"flat"},{"d":4,"t":"climb","g":6.0,"p":"3"},{"d":4,"t":"descent","g":-5.5},{"d":7,"t":"flat"},{"d":3,"t":"climb","g":8.0,"p":"4"},{"d":3,"t":"descent","g":-7.0},{"d":8,"t":"flat"},{"d":4,"t":"climb","g":5.0,"p":"3"},{"d":4,"t":"descent","g":-4.8},{"d":23,"t":"flat"}]'),
  ('coastal-72', 'road', 'sprint',
   '[{"d":10,"t":"flat"},{"d":8,"t":"flat"},{"d":12,"t":"flat","p":"sprint"},{"d":10,"t":"flat"},{"d":8,"t":"climb","g":2.5,"p":"4"},{"d":8,"t":"descent","g":-2.2},{"d":16,"t":"flat"}]'),
  ('hills-gravel-158', 'road', 'hilly',
   '[{"d":20,"t":"flat"},{"d":12,"t":"climb","g":3.0,"p":"3"},{"d":10,"t":"descent","g":-3.0},{"d":15,"t":"flat","s":"cobbles"},{"d":8,"t":"climb","g":5.0,"s":"cobbles","p":"2"},{"d":7,"t":"descent","g":-4.8,"s":"cobbles"},{"d":20,"t":"flat","p":"sprint"},{"d":15,"t":"climb","g":4.0,"p":"2"},{"d":12,"t":"descent","g":-4.0},{"d":10,"t":"flat","s":"cobbles"},{"d":5,"t":"climb","g":9.0,"s":"cobbles","p":"2"},{"d":4,"t":"descent","g":-8.0},{"d":20,"t":"flat"}]'),
  ('short-mountain-104', 'road', 'mountain',
   '[{"d":10,"t":"flat"},{"d":12,"t":"climb","g":5.0,"p":"2"},{"d":10,"t":"descent","g":-5.0},{"d":8,"t":"flat","p":"sprint"},{"d":14,"t":"climb","g":7.0,"p":"1"},{"d":12,"t":"descent","g":-6.5},{"d":8,"t":"flat"},{"d":20,"t":"climb","g":8.5},{"d":10,"t":"climb","g":10.0,"p":"HC"}]'),
  ('long-lakes-251', 'road', 'hilly',
   '[{"d":30,"t":"flat"},{"d":15,"t":"climb","g":4.0,"p":"2"},{"d":12,"t":"descent","g":-4.0},{"d":25,"t":"flat","p":"sprint"},{"d":20,"t":"climb","g":5.0,"p":"1"},{"d":15,"t":"descent","g":-5.0},{"d":30,"t":"flat"},{"d":12,"t":"climb","g":8.0,"p":"1"},{"d":10,"t":"descent","g":-7.5},{"d":25,"t":"flat"},{"d":20,"t":"climb","g":6.0,"p":"1"},{"d":12,"t":"descent","g":-6.0},{"d":25,"t":"flat"}]'),
  ('circuit-91', 'road', 'hilly',
   '[{"d":7,"t":"flat","p":"sprint"},{"d":3,"t":"climb","g":8.0,"p":"4"},{"d":3,"t":"descent","g":-7.0},{"d":7,"t":"flat"},{"d":3,"t":"climb","g":8.5,"p":"4"},{"d":3,"t":"descent","g":-7.5},{"d":7,"t":"flat"},{"d":3,"t":"climb","g":9.0,"p":"4"},{"d":3,"t":"descent","g":-8.0},{"d":7,"t":"flat"},{"d":3,"t":"climb","g":9.5,"p":"3"},{"d":3,"t":"descent","g":-8.5},{"d":7,"t":"flat"},{"d":3,"t":"climb","g":10.0,"p":"3"},{"d":3,"t":"descent","g":-9.0},{"d":7,"t":"flat"},{"d":3,"t":"climb","g":10.5,"p":"3"},{"d":3,"t":"descent","g":-9.5},{"d":7,"t":"flat"},{"d":3,"t":"climb","g":11.0,"p":"2"},{"d":3,"t":"descent","g":-10.0}]'),
  ('arctic-289', 'road', 'hilly',
   '[{"d":40,"t":"flat"},{"d":25,"t":"flat","s":"cobbles"},{"d":30,"t":"flat"},{"d":20,"t":"climb","g":2.5,"p":"2"},{"d":15,"t":"descent","g":-2.8},{"d":35,"t":"flat","p":"sprint"},{"d":25,"t":"flat","s":"cobbles"},{"d":18,"t":"climb","g":4.0,"p":"1"},{"d":15,"t":"descent","g":-4.0},{"d":26,"t":"flat"},{"d":10,"t":"climb","g":6.0,"p":"1"},{"d":10,"t":"descent","g":-5.5},{"d":20,"t":"flat"}]');

do $$
declare
  v_shape record;
  v_segment jsonb;
  v_total_distance numeric;
begin
  if (select count(*) from calendar_profile_shape) <> 24 then
    raise exception 'Le catalogue doit contenir exactement 24 profils atypiques.';
  end if;

  for v_shape in select * from calendar_profile_shape loop
    v_total_distance := 0;
    for v_segment in select value from jsonb_array_elements(v_shape.segments) loop
      if coalesce((v_segment ->> 'd')::numeric, 0) <= 0
        or coalesce(v_segment ->> 't', '') not in ('flat', 'climb', 'descent')
        or coalesce(v_segment ->> 's', 'asphalt') not in ('asphalt', 'cobbles')
        or (
          coalesce(v_segment ->> 't', '') = 'flat'
          and coalesce((v_segment ->> 'g')::numeric, 0) <> 0
        )
        or (
          coalesce(v_segment ->> 't', '') = 'climb'
          and coalesce((v_segment ->> 'g')::numeric, 0) <= 0
        )
        or (
          coalesce(v_segment ->> 't', '') = 'descent'
          and coalesce((v_segment ->> 'g')::numeric, 0) >= 0
        )
      then
        raise exception 'Le profil % contient un tronçon invalide.', v_shape.shape_code;
      end if;
      v_total_distance := v_total_distance + (v_segment ->> 'd')::numeric;
    end loop;

    if v_total_distance not between 15 and 300
      or jsonb_array_length(v_shape.segments) > 24
    then
      raise exception 'Le profil % dépasse les garde-fous de volume.', v_shape.shape_code;
    end if;
  end loop;
end;
$$;

create temporary table calendar_new_race_seed (
  slug text primary key,
  name text not null,
  short_name text not null,
  country_code text not null,
  category_code text not null,
  race_format text not null check (race_format in ('one_day', 'stage_race')),
  active_start_day smallint not null,
  planned_start_day smallint not null
) on commit drop;

insert into calendar_new_race_seed values
  ('tour-des-horlogers-helvetiques', 'Tour des Horlogers Helvétiques', 'THH', 'CH', 'world', 'stage_race', 16, 2),
  ('semaine-de-l-adriatique', 'Semaine de l’Adriatique', 'SDA', 'HR', 'continental', 'stage_race', 23, 5),
  ('muraille-de-malte', 'La Muraille de Malte', 'LMM', 'MT', 'national', 'one_day', 20, 4),
  ('arctic-endurance-classic', 'Arctic Endurance Classic', 'AEC', 'NO', 'world', 'one_day', 28, 8);

create temporary table calendar_new_stage_seed (
  race_slug text not null references calendar_new_race_seed(slug),
  stage_number smallint not null,
  active_day smallint not null,
  active_slot text not null check (active_slot in ('early', 'late')),
  planned_day smallint not null,
  planned_slot text not null check (planned_slot in ('early', 'late')),
  shape_code text not null references calendar_profile_shape(shape_code),
  primary key (race_slug, stage_number)
) on commit drop;

insert into calendar_new_stage_seed values
  ('tour-des-horlogers-helvetiques', 1, 16, 'early', 2, 'early', 'ttt-rolling-31'),
  ('tour-des-horlogers-helvetiques', 2, 16, 'late', 2, 'late', 'walls-116'),
  ('tour-des-horlogers-helvetiques', 3, 17, 'early', 3, 'early', 'coastal-72'),
  ('tour-des-horlogers-helvetiques', 4, 17, 'late', 3, 'late', 'mountain-summit-112'),
  ('semaine-de-l-adriatique', 1, 23, 'early', 5, 'early', 'coastal-72'),
  ('semaine-de-l-adriatique', 2, 23, 'late', 5, 'late', 'hills-gravel-158'),
  ('semaine-de-l-adriatique', 3, 24, 'early', 6, 'early', 'short-mountain-104'),
  ('semaine-de-l-adriatique', 4, 24, 'late', 6, 'late', 'ttt-technical-19'),
  ('muraille-de-malte', 1, 20, 'early', 4, 'late', 'circuit-91'),
  ('arctic-endurance-classic', 1, 28, 'early', 8, 'late', 'arctic-289');

do $$
begin
  if (select count(*) from calendar_new_race_seed) <> 4
    or (select count(*) from calendar_new_stage_seed) <> 10
  then
    raise exception 'Le complément de calendrier doit contenir 4 courses et 10 étapes.';
  end if;

  if exists (
    select 1
    from calendar_new_race_seed as seed
    left join public.countries as country
      on country.iso_alpha2 = seed.country_code
    left join public.race_categories as category
      on category.code = seed.category_code
    where country.id is null or category.id is null
  ) then
    raise exception 'Un pays ou une catégorie du complément est introuvable.';
  end if;
end;
$$;

insert into public.races (
  country_id,
  name,
  short_name,
  race_format,
  status,
  slug,
  competition_type,
  is_grand_tour
)
select
  country.id,
  seed.name,
  seed.short_name,
  seed.race_format,
  'active',
  seed.slug,
  'standard',
  false
from calendar_new_race_seed as seed
join public.countries as country
  on country.iso_alpha2 = seed.country_code
on conflict (slug)
do update set
  country_id = excluded.country_id,
  name = excluded.name,
  short_name = excluded.short_name,
  race_format = excluded.race_format,
  status = excluded.status,
  competition_type = excluded.competition_type,
  is_grand_tour = excluded.is_grand_tour;

with active_context as (
  select id, game_year, current_day_number
  from public.seasons
  where status = 'active'
  limit 1
), target_seasons as (
  select
    seed.slug as race_slug,
    season.id,
    season.game_year,
    season.status,
    case
      when season.status = 'active' then seed.active_start_day
      else seed.planned_start_day
    end as start_day
  from calendar_new_race_seed as seed
  cross join active_context
  join public.seasons as season
    on season.game_year in (
      active_context.game_year,
      active_context.game_year + 1
    )
   and season.status in ('active', 'planned')
  where season.status = 'planned'
     or seed.active_start_day > active_context.current_day_number
)
insert into public.race_editions as current_edition (
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
  target.id,
  category.id,
  case target.status when 'active' then 1 else 2 end,
  seed.name,
  'registration_open',
  case seed.category_code
    when 'world' then 200
    when 'continental' then 100
    else 0
  end,
  'open',
  24
from calendar_new_race_seed as seed
join public.races as race on race.slug = seed.slug
join public.race_categories as category on category.code = seed.category_code
join target_seasons as target
  on target.race_slug = seed.slug
 and target.start_day = case
    when target.status = 'active' then seed.active_start_day
    else seed.planned_start_day
  end
on conflict (race_id, season_id)
do update set
  race_category_id = excluded.race_category_id,
  display_name = excluded.display_name,
  status = case
    when current_edition.status in ('planned', 'registration_open')
      then excluded.status
    else current_edition.status
  end,
  minimum_reputation = excluded.minimum_reputation,
  registration_policy = excluded.registration_policy,
  field_limit = excluded.field_limit;

with active_context as (
  select game_year, current_day_number
  from public.seasons
  where status = 'active'
  limit 1
), target_stages as (
  select
    edition.id as race_edition_id,
    season.id as season_id,
    season.status as season_status,
    race.race_format,
    seed.stage_number,
    seed.shape_code,
    case when season.status = 'active' then seed.active_day else seed.planned_day end as day_number,
    case when season.status = 'active' then seed.active_slot else seed.planned_slot end as day_slot
  from calendar_new_stage_seed as seed
  join public.races as race on race.slug = seed.race_slug
  join public.race_editions as edition on edition.race_id = race.id
  join public.seasons as season on season.id = edition.season_id
  cross join active_context
  where (
      season.status = 'active'
      and season.game_year = active_context.game_year
      and seed.active_day > active_context.current_day_number
    ) or (
      season.status = 'planned'
      and season.game_year = active_context.game_year + 1
    )
)
insert into public.stages as current_stage (
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
  target.race_edition_id,
  season_day.id,
  target.day_slot,
  target.stage_number,
  case
    when target.race_format = 'one_day' then edition.display_name
    else 'Étape ' || target.stage_number
  end,
  shape.stage_type,
  distance.total_distance,
  'planned',
  (
    season_day.calendar_date::timestamp
    + case target.day_slot when 'early' then time '14:00' else time '18:00' end
  ) at time zone 'Europe/Paris',
  shape.profile_type
from target_stages as target
join public.race_editions as edition on edition.id = target.race_edition_id
join public.season_days as season_day
  on season_day.season_id = target.season_id
 and season_day.day_number = target.day_number
join calendar_profile_shape as shape on shape.shape_code = target.shape_code
cross join lateral (
  select sum((segment.value ->> 'd')::numeric) as total_distance
  from jsonb_array_elements(shape.segments) as segment(value)
) as distance
on conflict (race_edition_id, stage_number)
do update set
  season_day_id = excluded.season_day_id,
  day_slot = excluded.day_slot,
  name = excluded.name,
  stage_type = excluded.stage_type,
  distance_km = excluded.distance_km,
  status = case
    when current_stage.status = 'planned' then excluded.status
    else current_stage.status
  end,
  departure_at = excluded.departure_at,
  profile_type = excluded.profile_type;

update public.race_editions as edition
set
  registration_closes_at = deadline.closes_at,
  withdrawal_closes_at = deadline.closes_at
from (
  select distinct on (target_edition.id)
    target_edition.id,
    (
      season_day.calendar_date::timestamp
      + case stage.day_slot when 'early' then time '08:00' else time '12:00' end
    ) at time zone 'Europe/Paris' as closes_at
  from public.race_editions as target_edition
  join public.races as race on race.id = target_edition.race_id
  join calendar_new_race_seed as seed on seed.slug = race.slug
  join public.stages as stage on stage.race_edition_id = target_edition.id
  join public.season_days as season_day on season_day.id = stage.season_day_id
  order by target_edition.id, stage.stage_number
) as deadline
where edition.id = deadline.id;

create temporary table calendar_stage_profile_target (
  season_scope text not null check (
    season_scope in ('active_future', 'planned_early')
  ),
  race_slug text not null,
  stage_number smallint not null,
  shape_code text not null references calendar_profile_shape(shape_code),
  primary key (season_scope, race_slug, stage_number)
) on commit drop;

-- S2 : sept chronos d'étapes deviennent des CLM par équipes. Les chronos
-- individuels de la Ruta et du Tour des Hauts Plateaux restent en place.
insert into calendar_stage_profile_target values
  ('active_future', 'tour-de-mazovie', 3, 'ttt-rolling-31'),
  ('active_future', 'silk-road-tour', 4, 'ttt-fast-24'),
  ('active_future', 'aurora-borealis-tour', 2, 'ttt-coastal-36'),
  ('active_future', 'deutschland-regional-tour', 2, 'ttt-technical-19'),
  ('active_future', 'mekong-delta-tour', 4, 'ttt-rolling-31'),
  ('active_future', 'tour-des-highlands-de-donegal', 5, 'ttt-mountain-27'),
  ('active_future', 'southern-coast-tour', 4, 'ttt-coastal-36'),

  -- S2 : profils routiers volontairement dissemblables.
  ('active_future', 'boucle-de-zanzibar', 3, 'micro-hills-118'),
  ('active_future', 'tour-des-hauts-plateaux', 1, 'unipuerto-132'),
  ('active_future', 'classique-des-lacs', 1, 'long-lakes-251'),
  ('active_future', 'ruta-de-las-sierras', 1, 'short-punchy-78'),
  ('active_future', 'ruta-de-las-sierras', 3, 'mountain-summit-112'),
  ('active_future', 'ruta-de-las-sierras', 5, 'marathon-244'),
  ('active_future', 'ruta-de-las-sierras', 7, 'hills-gravel-158'),
  ('active_future', 'ruta-de-las-sierras', 9, 'unipuerto-132'),
  ('active_future', 'ruta-de-las-sierras', 10, 'downhill-146'),
  ('active_future', 'ruta-de-las-sierras', 12, 'circuit-91'),
  ('active_future', 'strade-del-monferrato', 1, 'cobbled-204'),
  ('active_future', 'desert-to-sky-classic', 1, 'desert-sky-219'),
  ('active_future', 'traversee-des-flandres', 1, 'flanders-266'),
  ('active_future', 'mur-de-catalogne', 1, 'walls-116'),
  ('active_future', 'wielkopolska-classic', 1, 'ultra-flat-246'),
  ('active_future', 'cime-du-tyrol', 1, 'tyrol-192'),
  ('active_future', 'patagonia-fin-del-mundo', 1, 'patagonia-244'),
  ('active_future', 'wachau-hugelklassik', 1, 'micro-hills-118'),
  ('active_future', 'grand-prix-du-littoral', 1, 'coastal-72'),
  ('active_future', 'route-des-cafes-du-timor', 1, 'hills-gravel-158'),

  -- S3 : CLM par équipes dès le premier tiers du calendrier.
  ('planned_early', 'corsa-delle-regioni', 4, 'ttt-rolling-31'),
  ('planned_early', 'boucle-des-provinces', 4, 'ttt-coastal-36'),
  ('planned_early', 'tour-des-lacs-d-auvergne', 4, 'ttt-technical-19'),
  ('planned_early', 'andes-del-sur', 4, 'ttt-mountain-27'),
  ('planned_early', 'dragon-kingdom-tour', 3, 'ttt-fast-24'),
  ('planned_early', 'tour-du-saint-laurent', 3, 'ttt-coastal-36'),
  ('planned_early', 'tour-de-han', 3, 'ttt-technical-19'),
  ('planned_early', 'tour-des-volcans-du-pacifique', 4, 'ttt-rolling-31'),

  -- S3 : mêmes principes de variété sur les épreuves de début de saison.
  ('planned_early', 'corsa-delle-regioni', 1, 'short-punchy-78'),
  ('planned_early', 'corsa-delle-regioni', 3, 'mountain-summit-112'),
  ('planned_early', 'corsa-delle-regioni', 5, 'marathon-244'),
  ('planned_early', 'corsa-delle-regioni', 7, 'hills-gravel-158'),
  ('planned_early', 'corsa-delle-regioni', 9, 'unipuerto-132'),
  ('planned_early', 'corsa-delle-regioni', 12, 'coastal-72'),
  ('planned_early', 'tour-du-sakura', 1, 'coastal-72'),
  ('planned_early', 'tour-du-sakura', 2, 'micro-hills-118'),
  ('planned_early', 'tour-du-sakura', 3, 'downhill-146'),
  ('planned_early', 'tour-des-volcans-du-pacifique', 1, 'walls-116'),
  ('planned_early', 'tour-des-volcans-du-pacifique', 3, 'short-mountain-104'),
  ('planned_early', 'tour-des-volcans-du-pacifique', 5, 'downhill-146');

insert into calendar_stage_profile_target (
  season_scope,
  race_slug,
  stage_number,
  shape_code
)
select 'active_future', seed.race_slug, seed.stage_number, seed.shape_code
from calendar_new_stage_seed as seed
union all
select 'planned_early', seed.race_slug, seed.stage_number, seed.shape_code
from calendar_new_stage_seed as seed;

do $$
begin
  if (
    select count(*)
    from calendar_stage_profile_target
    where season_scope = 'active_future'
      and shape_code like 'ttt-%'
  ) <> 9 then
    raise exception 'La S2 doit recevoir neuf CLM par équipes, nouveaux tours inclus.';
  end if;

  if (
    select count(*)
    from calendar_stage_profile_target
    where season_scope = 'planned_early'
      and shape_code like 'ttt-%'
  ) <> 10 then
    raise exception 'La S3 doit recevoir dix CLM par équipes précoces, nouveaux tours inclus.';
  end if;
end;
$$;

create temporary table resolved_calendar_profile_target
on commit drop
as
with active_context as (
  select game_year, current_day_number
  from public.seasons
  where status = 'active'
  limit 1
)
select
  target.season_scope,
  stage.id as stage_id,
  stage.stage_type as previous_stage_type,
  edition.id as race_edition_id,
  race.race_format,
  target.shape_code
from calendar_stage_profile_target as target
join public.races as race on race.slug = target.race_slug
join public.race_editions as edition on edition.race_id = race.id
join public.seasons as season on season.id = edition.season_id
join public.stages as stage
  on stage.race_edition_id = edition.id
 and stage.stage_number = target.stage_number
join public.season_days as season_day on season_day.id = stage.season_day_id
cross join active_context
where stage.status = 'planned'
  and not exists (
    select 1 from public.stage_results as result where result.stage_id = stage.id
  )
  and not exists (
    select 1
    from public.official_stage_simulations as simulation
    where simulation.stage_id = stage.id
  )
  and (
    (
      target.season_scope = 'active_future'
      and season.status = 'active'
      and season.game_year = active_context.game_year
      and season_day.day_number >= 15
      and season_day.day_number > active_context.current_day_number
    ) or (
      target.season_scope = 'planned_early'
      and season.status = 'planned'
      and season.game_year = active_context.game_year + 1
      and season_day.day_number <= 14
    )
  );

do $$
begin
  if (
    select count(*)
    from resolved_calendar_profile_target
    where season_scope = 'active_future'
  ) <> 37 then
    raise exception 'La S2 doit résoudre exactement 37 profils futurs.';
  end if;

  if (
    select count(*)
    from resolved_calendar_profile_target
    where season_scope = 'planned_early'
  ) <> 30 then
    raise exception 'La S3 doit résoudre exactement 30 profils précoces.';
  end if;

  if exists (
    select 1
    from resolved_calendar_profile_target as target
    join calendar_profile_shape as shape on shape.shape_code = target.shape_code
    where shape.stage_type = 'team_time_trial'
      and target.previous_stage_type not in (
        'individual_time_trial',
        'team_time_trial'
      )
  ) then
    raise exception 'Un CLM par équipes cible une étape qui n’était pas un chrono.';
  end if;
end;
$$;

-- Les consignes individuelles déjà saisies sur un chrono converti sont
-- conservées. Leur charge de relais est répartie exactement à 100 % afin que
-- la simulation collective soit valide, sans forcer une nouvelle saisie.
with converted_stages as (
  select target.stage_id
  from resolved_calendar_profile_target as target
  join calendar_profile_shape as shape on shape.shape_code = target.shape_code
  where shape.stage_type = 'team_time_trial'
    and target.previous_stage_type <> 'team_time_trial'
), plan_counts as (
  select
    plan.race_registration_id,
    plan.stage_id,
    count(*)::integer as plan_count,
    (
      select count(*)::integer
      from public.race_rosters as roster
      where roster.race_registration_id = plan.race_registration_id
        and roster.status in ('selected', 'confirmed')
    ) as roster_count
  from public.race_time_trial_rider_plans as plan
  join converted_stages as converted on converted.stage_id = plan.stage_id
  group by plan.race_registration_id, plan.stage_id
)
delete from public.race_time_trial_rider_plans as plan
using plan_counts as counts
where plan.race_registration_id = counts.race_registration_id
  and plan.stage_id = counts.stage_id
  and counts.plan_count <> counts.roster_count;

with converted_stages as (
  select target.stage_id
  from resolved_calendar_profile_target as target
  join calendar_profile_shape as shape on shape.shape_code = target.shape_code
  where shape.stage_type = 'team_time_trial'
    and target.previous_stage_type <> 'team_time_trial'
), ranked_plans as (
  select
    plan.race_registration_id,
    plan.stage_id,
    plan.rider_id,
    row_number() over (
      partition by plan.race_registration_id, plan.stage_id
      order by plan.rider_id
    ) as rider_rank,
    count(*) over (
      partition by plan.race_registration_id, plan.stage_id
    ) as rider_count
  from public.race_time_trial_rider_plans as plan
  join converted_stages as converted on converted.stage_id = plan.stage_id
), relay_shares as (
  select
    ranked.*,
    floor(10000.0 / ranked.rider_count)::integer as base_share_cents
  from ranked_plans as ranked
)
update public.race_time_trial_rider_plans as plan
set
  relay_share_pct = (
    case
      when share.rider_rank = share.rider_count
        then 10000 - share.base_share_cents * (share.rider_count - 1)
      else share.base_share_cents
    end
  )::numeric / 100,
  updated_at = clock_timestamp()
from relay_shares as share
where plan.race_registration_id = share.race_registration_id
  and plan.stage_id = share.stage_id
  and plan.rider_id = share.rider_id;

update public.stages as stage
set
  stage_type = shape.stage_type,
  profile_type = shape.profile_type,
  distance_km = distance.total_distance
from resolved_calendar_profile_target as target
join calendar_profile_shape as shape on shape.shape_code = target.shape_code
cross join lateral (
  select sum((segment.value ->> 'd')::numeric) as total_distance
  from jsonb_array_elements(shape.segments) as segment(value)
) as distance
where stage.id = target.stage_id;

delete from public.stage_segments as segment
using resolved_calendar_profile_target as target
where segment.stage_id = target.stage_id;

with expanded_segments as (
  select
    target.stage_id,
    segment.ordinality::smallint as segment_number,
    (segment.value ->> 'd')::numeric(5, 2) as distance_km,
    segment.value ->> 't' as terrain_type,
    coalesce(segment.value ->> 's', 'asphalt') as surface_type,
    coalesce((segment.value ->> 'g')::numeric, 0)::numeric(5, 2)
      as average_gradient_pct,
    segment.value ->> 'p' as prime_code
  from resolved_calendar_profile_target as target
  join calendar_profile_shape as shape on shape.shape_code = target.shape_code
  cross join lateral jsonb_array_elements(shape.segments)
    with ordinality as segment(value, ordinality)
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
  expanded.stage_id,
  expanded.segment_number,
  expanded.distance_km,
  expanded.terrain_type,
  expanded.surface_type,
  expanded.average_gradient_pct
from expanded_segments as expanded
order by expanded.stage_id, expanded.segment_number;

with expanded_primes as (
  select
    target.stage_id,
    segment.ordinality::smallint as segment_number,
    segment.value ->> 'p' as prime_code
  from resolved_calendar_profile_target as target
  join calendar_profile_shape as shape on shape.shape_code = target.shape_code
  cross join lateral jsonb_array_elements(shape.segments)
    with ordinality as segment(value, ordinality)
  where segment.value ? 'p'
    and target.race_format = 'stage_race'
)
insert into public.stage_segment_primes (
  stage_segment_id,
  prime_type,
  mountain_category,
  points_scale
)
select
  segment.id,
  case when prime.prime_code = 'sprint' then 'intermediate_sprint' else 'mountain' end,
  case when prime.prime_code = 'sprint' then null else prime.prime_code end,
  case prime.prime_code
    when 'sprint' then array[20,17,15,13,11,10,9,8,7,6,5,4,3,2,1]::smallint[]
    when 'HC' then array[20,15,12,10,8,6,4,2]::smallint[]
    when '1' then array[10,8,6,4,2,1]::smallint[]
    when '2' then array[5,3,2,1]::smallint[]
    when '3' then array[2,1]::smallint[]
    else array[1]::smallint[]
  end
from expanded_primes as prime
join public.stage_segments as segment
  on segment.stage_id = prime.stage_id
 and segment.segment_number = prime.segment_number
on conflict (stage_segment_id, prime_type)
do update set
  mountain_category = excluded.mountain_category,
  points_scale = excluded.points_scale;

do $$
declare
  v_targeted_segment_count integer;
begin
  if exists (
    select 1
    from resolved_calendar_profile_target as target
    join public.stages as stage on stage.id = target.stage_id
    left join (
      select segment.stage_id, sum(segment.distance_km) as segment_distance
      from public.stage_segments as segment
      group by segment.stage_id
    ) as distance on distance.stage_id = stage.id
    where distance.segment_distance is distinct from stage.distance_km
  ) then
    raise exception 'Un profil ne totalise pas exactement la distance de son étape.';
  end if;

  select count(*)
  into v_targeted_segment_count
  from public.stage_segments as segment
  join resolved_calendar_profile_target as target on target.stage_id = segment.stage_id;

  if v_targeted_segment_count <> 700 then
    raise exception
      'Le calendrier enrichi doit contenir exactement 700 tronçons ciblés.';
  end if;

  if v_targeted_segment_count > 720 then
    raise exception 'Le budget maximal de 720 tronçons ciblés est dépassé.';
  end if;
end;
$$;

comment on table public.race_time_trial_rider_plans is
  'Consignes d’effort et de relais par coureur, désormais utilisées par les CLM par équipes du calendrier officiel.';

notify pgrst, 'reload schema';

commit;
