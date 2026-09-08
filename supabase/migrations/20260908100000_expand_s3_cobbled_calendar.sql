begin;

-- La S3 diversifie les courses de pavés et de chemins blancs sans gonfler le
-- calendrier Elite. Chaque catégorie ouverte aux équipes reçoit cinq courses,
-- réparties sur vingt pays. Les quatre tours mêlent étapes rapides, vallons et
-- plusieurs rendez-vous pavés. Le premier CLM pavé reste un CLM individuel :
-- le moteur combine donc naturellement la note de chrono et celle de pavés.

create temporary table s3_cobbled_profile_shape (
  shape_code text primary key,
  stage_type text not null check (
    stage_type in ('road', 'individual_time_trial')
  ),
  profile_type text not null check (
    profile_type in ('flat', 'sprint', 'hilly', 'cobbles')
  ),
  segments jsonb not null check (
    jsonb_typeof(segments) = 'array' and jsonb_array_length(segments) > 0
  )
) on commit drop;

insert into s3_cobbled_profile_shape (
  shape_code,
  stage_type,
  profile_type,
  segments
)
values
  ('flat-174', 'road', 'flat',
   '[{"d":42,"t":"flat"},{"d":44,"t":"flat","p":"sprint"},{"d":46,"t":"flat"},{"d":42,"t":"flat"}]'),
  ('sprint-188', 'road', 'sprint',
   '[{"d":38,"t":"flat"},{"d":46,"t":"flat"},{"d":52,"t":"flat","p":"sprint"},{"d":52,"t":"flat"}]'),
  ('hilly-166', 'road', 'hilly',
   '[{"d":25,"t":"flat"},{"d":8,"t":"climb","g":4.2,"p":"3"},{"d":7,"t":"descent","g":-3.8},{"d":20,"t":"flat"},{"d":6,"t":"climb","g":6.4,"p":"3"},{"d":5,"t":"descent","g":-5.8},{"d":30,"t":"flat","p":"sprint"},{"d":10,"t":"climb","g":5.1,"p":"2"},{"d":9,"t":"descent","g":-4.8},{"d":46,"t":"flat"}]'),
  ('cobbles-176', 'road', 'cobbles',
   '[{"d":22,"t":"flat"},{"d":18,"t":"flat","s":"cobbles"},{"d":24,"t":"flat"},{"d":16,"t":"flat","s":"cobbles"},{"d":22,"t":"flat","p":"sprint"},{"d":18,"t":"flat","s":"cobbles"},{"d":20,"t":"flat"},{"d":18,"t":"flat","s":"cobbles"},{"d":18,"t":"flat"}]'),
  ('cobbles-188', 'road', 'cobbles',
   '[{"d":24,"t":"flat"},{"d":20,"t":"flat","s":"cobbles"},{"d":26,"t":"flat"},{"d":18,"t":"flat","s":"cobbles"},{"d":22,"t":"flat","p":"sprint"},{"d":16,"t":"flat","s":"cobbles"},{"d":24,"t":"flat"},{"d":20,"t":"flat","s":"cobbles"},{"d":18,"t":"flat"}]'),
  ('cobbles-196', 'road', 'cobbles',
   '[{"d":25,"t":"flat"},{"d":20,"t":"flat","s":"cobbles"},{"d":28,"t":"flat"},{"d":18,"t":"flat","s":"cobbles"},{"d":24,"t":"flat","p":"sprint"},{"d":18,"t":"flat","s":"cobbles"},{"d":24,"t":"flat"},{"d":21,"t":"flat","s":"cobbles"},{"d":18,"t":"flat"}]'),
  ('cobbles-204', 'road', 'cobbles',
   '[{"d":26,"t":"flat"},{"d":22,"t":"flat","s":"cobbles"},{"d":28,"t":"flat"},{"d":20,"t":"flat","s":"cobbles"},{"d":26,"t":"flat","p":"sprint"},{"d":18,"t":"flat","s":"cobbles"},{"d":24,"t":"flat"},{"d":22,"t":"flat","s":"cobbles"},{"d":18,"t":"flat"}]'),
  ('gravel-182', 'road', 'cobbles',
   '[{"d":24,"t":"flat"},{"d":18,"t":"flat","s":"cobbles"},{"d":8,"t":"climb","g":3.1,"s":"cobbles","p":"3"},{"d":7,"t":"descent","g":-2.9,"s":"cobbles"},{"d":20,"t":"flat"},{"d":15,"t":"flat","s":"cobbles"},{"d":7,"t":"climb","g":4.8,"p":"3"},{"d":6,"t":"descent","g":-4.3},{"d":26,"t":"flat","p":"sprint"},{"d":18,"t":"flat","s":"cobbles"},{"d":8,"t":"climb","g":5.6,"s":"cobbles","p":"2"},{"d":7,"t":"descent","g":-5.0},{"d":18,"t":"flat"}]'),
  ('gravel-hilly-186', 'road', 'cobbles',
   '[{"d":20,"t":"flat"},{"d":14,"t":"flat","s":"cobbles"},{"d":8,"t":"climb","g":3.8,"s":"cobbles","p":"3"},{"d":7,"t":"descent","g":-3.4,"s":"cobbles"},{"d":18,"t":"flat"},{"d":16,"t":"flat","s":"cobbles"},{"d":8,"t":"climb","g":5.2,"s":"cobbles","p":"2"},{"d":7,"t":"descent","g":-4.7,"s":"cobbles"},{"d":22,"t":"flat","p":"sprint"},{"d":18,"t":"flat","s":"cobbles"},{"d":10,"t":"climb","g":4.6,"p":"2"},{"d":9,"t":"descent","g":-4.2},{"d":29,"t":"flat"}]'),
  ('cobbled-itt-32', 'individual_time_trial', 'cobbles',
   '[{"d":4,"t":"flat"},{"d":5,"t":"flat","s":"cobbles"},{"d":4,"t":"flat"},{"d":6,"t":"flat","s":"cobbles"},{"d":4,"t":"flat"},{"d":5,"t":"flat","s":"cobbles"},{"d":4,"t":"flat"}]');

do $$
declare
  v_shape record;
  v_segment jsonb;
  v_total_distance numeric;
begin
  if (select count(*) from s3_cobbled_profile_shape) <> 10 then
    raise exception 'Le catalogue pavé S3 doit contenir exactement dix profils.';
  end if;

  for v_shape in select * from s3_cobbled_profile_shape loop
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
        raise exception 'Le profil pavé % contient un tronçon invalide.', v_shape.shape_code;
      end if;
      v_total_distance := v_total_distance + (v_segment ->> 'd')::numeric;
    end loop;

    if v_total_distance not between 15 and 250 then
      raise exception 'Le profil pavé % dépasse les garde-fous de distance.', v_shape.shape_code;
    end if;
  end loop;

  if (
    select count(*)
    from s3_cobbled_profile_shape
    where stage_type = 'individual_time_trial'
      and profile_type = 'cobbles'
  ) <> 1 then
    raise exception 'Le catalogue S3 doit contenir exactement un profil de CLM pavé.';
  end if;
end;
$$;

create temporary table s3_cobbled_race_seed (
  slug text primary key,
  name text not null,
  short_name text not null,
  country_code text not null,
  category_code text not null check (
    category_code in ('world', 'continental', 'national', 'regional')
  ),
  race_format text not null check (race_format in ('one_day', 'stage_race')),
  start_day smallint not null check (start_day between 1 and 28),
  expected_stage_count smallint not null check (expected_stage_count > 0)
) on commit drop;

insert into s3_cobbled_race_seed values
  ('vuelta-de-los-caminos-blancos', 'Vuelta de los Caminos Blancos', 'VCB', 'UY', 'world', 'stage_race', 3, 6),
  ('gotland-gravel-classic', 'Gotland Gravel Classic', 'GGC', 'SE', 'world', 'one_day', 8, 1),
  ('route-de-pierre-du-the', 'Classique de la Route de Pierre du Thé', 'RPT', 'CN', 'world', 'one_day', 13, 1),
  ('clasica-de-barichara', 'Clásica de Barichara', 'CBA', 'CO', 'world', 'one_day', 19, 1),
  ('routes-blanches-de-maurice', 'Routes Blanches de Maurice', 'RBM', 'MU', 'world', 'one_day', 27, 1),

  ('tour-des-paves-baltiques', 'Tour des Pavés Baltiques', 'TPB', 'LV', 'continental', 'stage_race', 10, 5),
  ('mur-de-kigali', 'Mur de Kigali', 'MUK', 'RW', 'continental', 'one_day', 6, 1),
  ('classique-des-routes-de-basalte', 'Classique des Routes de Basalte', 'CRB', 'AM', 'continental', 'one_day', 17, 1),
  ('clasica-empedrada-de-trinidad', 'Clásica Empedrada de Trinidad', 'CET', 'CU', 'continental', 'one_day', 21, 1),
  ('ceylon-white-roads', 'Ceylon White Roads', 'CWR', 'LK', 'continental', 'one_day', 25, 1),

  ('tour-de-la-voie-royale-de-boheme', 'Tour de la Voie Royale de Bohême', 'TVR', 'CZ', 'national', 'stage_race', 7, 4),
  ('ronde-du-jutland', 'Ronde du Jutland', 'RDJ', 'DK', 'national', 'one_day', 12, 1),
  ('caminos-blancos-de-tandil', 'Caminos Blancos de Tandil', 'CBT', 'AR', 'national', 'one_day', 18, 1),
  ('estrada-real-de-minas', 'Estrada Real de Minas', 'ERM', 'BR', 'national', 'one_day', 22, 1),
  ('kalldremi-i-beratit', 'Kalldrëmi i Beratit', 'KDB', 'AL', 'national', 'one_day', 28, 1),

  ('vuelta-de-los-caminos-rojos', 'Vuelta de los Caminos Rojos', 'VCR', 'PY', 'regional', 'stage_race', 16, 4),
  ('clasica-empedrada-de-antigua', 'Clásica Empedrada de Antigua', 'CEA', 'GT', 'regional', 'one_day', 5, 1),
  ('kathmandu-stone-classic', 'Kathmandu Stone Classic', 'KSC', 'NP', 'regional', 'one_day', 9, 1),
  ('kaldrma-de-sumadija', 'Kaldrma de Šumadija', 'KDS', 'RS', 'regional', 'one_day', 20, 1),
  ('otago-gravel-classic', 'Otago Gravel Classic', 'OGC', 'NZ', 'regional', 'one_day', 23, 1);

create temporary table s3_cobbled_stage_seed (
  race_slug text not null references s3_cobbled_race_seed(slug),
  stage_number smallint not null,
  stage_name text not null,
  day_number smallint not null check (day_number between 1 and 28),
  day_slot text not null check (day_slot in ('early', 'late')),
  shape_code text not null references s3_cobbled_profile_shape(shape_code),
  primary key (race_slug, stage_number)
) on commit drop;

insert into s3_cobbled_stage_seed values
  ('vuelta-de-los-caminos-blancos', 1, 'Montevideo – Colonia', 3, 'early', 'flat-174'),
  ('vuelta-de-los-caminos-blancos', 2, 'Pavés de Colonia', 3, 'late', 'cobbles-188'),
  ('vuelta-de-los-caminos-blancos', 3, 'Chrono des Caminos Blancos', 4, 'early', 'cobbled-itt-32'),
  ('vuelta-de-los-caminos-blancos', 4, 'Mercedes – Paysandú', 4, 'late', 'sprint-188'),
  ('vuelta-de-los-caminos-blancos', 5, 'Sierras de Minas', 5, 'early', 'hilly-166'),
  ('vuelta-de-los-caminos-blancos', 6, 'Chemins blancs de Maldonado', 5, 'late', 'cobbles-204'),

  ('tour-des-paves-baltiques', 1, 'Riga – Jelgava', 10, 'early', 'sprint-188'),
  ('tour-des-paves-baltiques', 2, 'Pavés de Kurzeme', 10, 'late', 'cobbles-188'),
  ('tour-des-paves-baltiques', 3, 'La route des plaines', 11, 'early', 'flat-174'),
  ('tour-des-paves-baltiques', 4, 'Collines de Vidzeme', 11, 'late', 'hilly-166'),
  ('tour-des-paves-baltiques', 5, 'Finale des Pavés de Riga', 12, 'early', 'cobbles-204'),

  ('tour-de-la-voie-royale-de-boheme', 1, 'Prague – Kutná Hora', 7, 'early', 'flat-174'),
  ('tour-de-la-voie-royale-de-boheme', 2, 'Pavés de Bohême', 7, 'late', 'cobbles-176'),
  ('tour-de-la-voie-royale-de-boheme', 3, 'Collines de Moravie', 8, 'early', 'hilly-166'),
  ('tour-de-la-voie-royale-de-boheme', 4, 'Circuit royal de Prague', 8, 'late', 'cobbles-196'),

  ('vuelta-de-los-caminos-rojos', 1, 'Asunción – Paraguarí', 16, 'early', 'sprint-188'),
  ('vuelta-de-los-caminos-rojos', 2, 'Pistes rouges du Chaco', 16, 'late', 'gravel-182'),
  ('vuelta-de-los-caminos-rojos', 3, 'Cordillère de Ybytyruzú', 17, 'early', 'hilly-166'),
  ('vuelta-de-los-caminos-rojos', 4, 'Chemins de pierre de Cordillera', 17, 'late', 'cobbles-196'),

  ('gotland-gravel-classic', 1, 'Gotland Gravel Classic', 8, 'late', 'gravel-182'),
  ('route-de-pierre-du-the', 1, 'Classique de la Route de Pierre du Thé', 13, 'late', 'gravel-hilly-186'),
  ('clasica-de-barichara', 1, 'Clásica de Barichara', 19, 'late', 'gravel-hilly-186'),
  ('routes-blanches-de-maurice', 1, 'Routes Blanches de Maurice', 27, 'late', 'gravel-182'),

  ('mur-de-kigali', 1, 'Mur de Kigali', 6, 'late', 'gravel-hilly-186'),
  ('classique-des-routes-de-basalte', 1, 'Classique des Routes de Basalte', 17, 'early', 'cobbles-196'),
  ('clasica-empedrada-de-trinidad', 1, 'Clásica Empedrada de Trinidad', 21, 'late', 'cobbles-188'),
  ('ceylon-white-roads', 1, 'Ceylon White Roads', 25, 'early', 'gravel-182'),

  ('ronde-du-jutland', 1, 'Ronde du Jutland', 12, 'late', 'cobbles-204'),
  ('caminos-blancos-de-tandil', 1, 'Caminos Blancos de Tandil', 18, 'early', 'gravel-182'),
  ('estrada-real-de-minas', 1, 'Estrada Real de Minas', 22, 'late', 'gravel-hilly-186'),
  ('kalldremi-i-beratit', 1, 'Kalldrëmi i Beratit', 28, 'early', 'cobbles-176'),

  ('clasica-empedrada-de-antigua', 1, 'Clásica Empedrada de Antigua', 5, 'early', 'cobbles-188'),
  ('kathmandu-stone-classic', 1, 'Kathmandu Stone Classic', 9, 'late', 'gravel-hilly-186'),
  ('kaldrma-de-sumadija', 1, 'Kaldrma de Šumadija', 20, 'early', 'cobbles-176'),
  ('otago-gravel-classic', 1, 'Otago Gravel Classic', 23, 'early', 'gravel-182');

do $$
begin
  if (select count(*) from s3_cobbled_race_seed) <> 20
    or (select count(distinct country_code) from s3_cobbled_race_seed) <> 20
    or (select count(*) from s3_cobbled_stage_seed) <> 35
  then
    raise exception 'Le complément pavé S3 doit contenir 20 courses, 20 pays et 35 étapes.';
  end if;

  if exists (
    select 1
    from (
      select category_code, count(*) as race_count
      from s3_cobbled_race_seed
      group by category_code
    ) as category_totals
    where category_totals.race_count <> 5
  ) or (select count(distinct category_code) from s3_cobbled_race_seed) <> 4 then
    raise exception 'Chaque catégorie hors Elite doit recevoir exactement cinq courses pavées.';
  end if;

  if (select count(*) from s3_cobbled_race_seed where race_format = 'stage_race') <> 4
    or exists (
      select 1
      from (
        select category_code, count(*) filter (where race_format = 'stage_race') as tour_count
        from s3_cobbled_race_seed
        group by category_code
      ) as category_tours
      where category_tours.tour_count <> 1
    )
  then
    raise exception 'Chaque catégorie hors Elite doit recevoir exactement un tour pavé.';
  end if;

  if exists (
    select 1
    from s3_cobbled_race_seed as race_seed
    left join (
      select race_slug, count(*) as stage_count
      from s3_cobbled_stage_seed
      group by race_slug
    ) as stage_totals on stage_totals.race_slug = race_seed.slug
    where stage_totals.stage_count is distinct from race_seed.expected_stage_count
  ) then
    raise exception 'Une course pavée S3 ne contient pas le nombre d’étapes attendu.';
  end if;

  if exists (
    select 1
    from s3_cobbled_race_seed as race_seed
    join (
      select race_slug, min(day_number) as first_day
      from s3_cobbled_stage_seed
      group by race_slug
    ) as stage_days on stage_days.race_slug = race_seed.slug
    where stage_days.first_day <> race_seed.start_day
  ) then
    raise exception 'Le premier jour d’une course pavée S3 est incohérent.';
  end if;

  if exists (
    select 1
    from s3_cobbled_race_seed as race_seed
    left join (
      select
        stage_seed.race_slug,
        count(*) filter (
          where shape.profile_type = 'cobbles'
            and shape.stage_type = 'road'
        ) as cobbled_road_stage_count,
        count(*) filter (
          where shape.profile_type in ('flat', 'sprint')
        ) as fast_stage_count,
        count(*) filter (
          where shape.profile_type = 'hilly'
        ) as hilly_stage_count
      from s3_cobbled_stage_seed as stage_seed
      join s3_cobbled_profile_shape as shape
        on shape.shape_code = stage_seed.shape_code
      group by stage_seed.race_slug
    ) as tour_profiles on tour_profiles.race_slug = race_seed.slug
    where race_seed.race_format = 'stage_race'
      and (
        tour_profiles.cobbled_road_stage_count < 2
        or tour_profiles.fast_stage_count < 1
        or tour_profiles.hilly_stage_count < 1
      )
  ) then
    raise exception 'Chaque tour doit mêler vitesse, vallons et au moins deux étapes pavées.';
  end if;

  if exists (
    select 1
    from s3_cobbled_race_seed as race_seed
    join s3_cobbled_stage_seed as stage_seed
      on stage_seed.race_slug = race_seed.slug
    join s3_cobbled_profile_shape as shape
      on shape.shape_code = stage_seed.shape_code
    where race_seed.race_format = 'one_day'
      and shape.profile_type <> 'cobbles'
  ) then
    raise exception 'Chaque nouvelle classique doit être identifiée comme pavée.';
  end if;

  if exists (
    select 1
    from s3_cobbled_race_seed as seed
    left join public.countries as country on country.iso_alpha2 = seed.country_code
    left join public.race_categories as category on category.code = seed.category_code
    where country.id is null or category.id is null
  ) then
    raise exception 'Un pays ou une catégorie du complément pavé S3 est introuvable.';
  end if;

  if exists (
    select 1
    from s3_cobbled_stage_seed
    where day_number in (15, 24, 26)
  ) then
    raise exception 'Les journées CC, Nations Cup et CM doivent rester libres.';
  end if;

  if not exists (
    select 1
    from public.seasons
    where game_year = 3
      and status in ('active', 'planned')
  ) then
    raise exception 'La saison 3 active ou planifiée est introuvable.';
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
from s3_cobbled_race_seed as seed
join public.countries as country on country.iso_alpha2 = seed.country_code
on conflict (slug)
do update set
  country_id = excluded.country_id,
  name = excluded.name,
  short_name = excluded.short_name,
  race_format = excluded.race_format,
  status = excluded.status,
  competition_type = excluded.competition_type,
  is_grand_tour = excluded.is_grand_tour;

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
  season.id,
  category.id,
  greatest(1, season.game_year - 2),
  seed.name,
  case
    when season.status = 'active'
      and seed.start_day <= coalesce(season.current_day_number, 0)
      then 'cancelled'
    else 'registration_open'
  end,
  case seed.category_code
    when 'world' then 200
    when 'continental' then 100
    else 0
  end,
  'open',
  case seed.category_code
    when 'regional' then 16
    when 'world' then 24
    else 30
  end
from s3_cobbled_race_seed as seed
join public.races as race on race.slug = seed.slug
join public.race_categories as category on category.code = seed.category_code
cross join public.seasons as season
where season.game_year >= 3
  and season.status in ('active', 'planned')
on conflict (race_id, season_id)
do update set
  race_category_id = excluded.race_category_id,
  edition_number = excluded.edition_number,
  display_name = excluded.display_name,
  status = case
    when current_edition.status in ('planned', 'registration_open', 'cancelled')
      then excluded.status
    else current_edition.status
  end,
  minimum_reputation = excluded.minimum_reputation,
  registration_policy = excluded.registration_policy,
  field_limit = excluded.field_limit;

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
  edition.id,
  season_day.id,
  stage_seed.day_slot,
  stage_seed.stage_number,
  stage_seed.stage_name,
  shape.stage_type,
  distance.total_distance,
  case
    when season.status = 'active'
      and stage_seed.day_number <= coalesce(season.current_day_number, 0)
      then 'cancelled'
    else 'planned'
  end,
  (
    season_day.calendar_date::timestamp
    + case stage_seed.day_slot when 'early' then time '14:00' else time '18:00' end
  ) at time zone 'Europe/Paris',
  shape.profile_type
from s3_cobbled_stage_seed as stage_seed
join public.races as race on race.slug = stage_seed.race_slug
join public.race_editions as edition on edition.race_id = race.id
join public.seasons as season
  on season.id = edition.season_id
 and season.game_year >= 3
 and season.status in ('active', 'planned')
join public.season_days as season_day
  on season_day.season_id = season.id
 and season_day.day_number = stage_seed.day_number
join s3_cobbled_profile_shape as shape on shape.shape_code = stage_seed.shape_code
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
    when current_stage.status in ('planned', 'cancelled') then excluded.status
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
  join s3_cobbled_race_seed as seed on seed.slug = race.slug
  join public.seasons as season
    on season.id = target_edition.season_id
   and season.game_year >= 3
   and season.status in ('active', 'planned')
  join public.stages as stage on stage.race_edition_id = target_edition.id
  join public.season_days as season_day on season_day.id = stage.season_day_id
  order by
    target_edition.id,
    season_day.day_number,
    case stage.day_slot when 'early' then 0 else 1 end
) as deadline
where edition.id = deadline.id;

create temporary table s3_cobbled_stage_target
on commit drop
as
select
  season.id as season_id,
  stage.id as stage_id,
  race.race_format,
  shape.stage_type,
  shape.profile_type,
  shape.segments
from s3_cobbled_stage_seed as stage_seed
join s3_cobbled_profile_shape as shape on shape.shape_code = stage_seed.shape_code
join public.races as race on race.slug = stage_seed.race_slug
join public.race_editions as edition on edition.race_id = race.id
join public.seasons as season
  on season.id = edition.season_id
 and season.game_year >= 3
 and season.status in ('active', 'planned')
join public.stages as stage
  on stage.race_edition_id = edition.id
 and stage.stage_number = stage_seed.stage_number
where stage.status in ('planned', 'cancelled')
  and not exists (
    select 1 from public.stage_results as result where result.stage_id = stage.id
  )
  and not exists (
    select 1
    from public.official_stage_simulations as simulation
    where simulation.stage_id = stage.id
  );

delete from public.stage_segment_primes as prime
using public.stage_segments as segment,
      s3_cobbled_stage_target as target
where prime.stage_segment_id = segment.id
  and segment.stage_id = target.stage_id;

delete from public.stage_segments as segment
using s3_cobbled_stage_target as target
where segment.stage_id = target.stage_id;

with expanded_segments as (
  select
    target.stage_id,
    segment.ordinality::smallint as segment_number,
    (segment.value ->> 'd')::numeric(5, 2) as distance_km,
    segment.value ->> 't' as terrain_type,
    coalesce(segment.value ->> 's', 'asphalt') as surface_type,
    coalesce((segment.value ->> 'g')::numeric, 0)::numeric(5, 2)
      as average_gradient_pct
  from s3_cobbled_stage_target as target
  cross join lateral jsonb_array_elements(target.segments)
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
  from s3_cobbled_stage_target as target
  cross join lateral jsonb_array_elements(target.segments)
    with ordinality as segment(value, ordinality)
  where segment.value ? 'p'
    and target.race_format = 'stage_race'
    and target.stage_type = 'road'
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
begin
  if exists (
    select 1
    from (
      select season_id, count(*) as stage_count
      from s3_cobbled_stage_target
      group by season_id
    ) as season_totals
    where season_totals.stage_count <> 35
  ) then
    raise exception 'Chaque saison ciblée doit résoudre exactement 35 nouvelles étapes pavées.';
  end if;

  if exists (
    select 1
    from s3_cobbled_stage_target as target
    join public.stages as stage on stage.id = target.stage_id
    left join (
      select segment.stage_id, sum(segment.distance_km) as segment_distance
      from public.stage_segments as segment
      group by segment.stage_id
    ) as distance on distance.stage_id = stage.id
    where distance.segment_distance is distinct from stage.distance_km
  ) then
    raise exception 'Un profil pavé S3 ne totalise pas exactement la distance de son étape.';
  end if;

  if exists (
    select 1
    from s3_cobbled_stage_target as target
    where target.profile_type = 'cobbles'
      and not exists (
        select 1
        from public.stage_segments as segment
        where segment.stage_id = target.stage_id
          and segment.surface_type = 'cobbles'
      )
  ) then
    raise exception 'Une étape annoncée pavée ne contient aucun secteur pavé.';
  end if;

  if exists (
    select 1
    from (
      select
        season_id,
        count(*) filter (
          where stage_type = 'individual_time_trial'
            and profile_type = 'cobbles'
        ) as itt_count
      from s3_cobbled_stage_target
      group by season_id
    ) as season_chronos
    where season_chronos.itt_count <> 1
  ) then
    raise exception 'Chaque saison ciblée doit contenir exactement un CLM pavé.';
  end if;
end;
$$;

-- Les éditions suivantes recopient ensuite ce lot depuis la S3 via la fonction
-- normale de provisionnement du calendrier saisonnier.

commit;
