begin;

-- ============================================================
-- CALENDRIER DE SAISON
-- Ajoute les informations publiques nécessaires au calendrier,
-- aux fiches de course et aux futures inscriptions.
-- ============================================================

alter table public.races
add column slug text;

update public.races
set slug =
  'course-' || substr(replace(id::text, '-', ''), 1, 12)
where slug is null;

alter table public.races
alter column slug set not null;

alter table public.races
add constraint races_slug_format
check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$');

create unique index races_slug_unique_idx
  on public.races (slug);

alter table public.race_editions
add column registration_closes_at timestamptz,
add column minimum_reputation integer,
add column registration_policy text not null default 'criteria_pending',
add column field_limit smallint;

alter table public.race_editions
add constraint race_editions_minimum_reputation_non_negative
check (
  minimum_reputation is null
  or minimum_reputation >= 0
),
add constraint race_editions_registration_policy_allowed
check (
  registration_policy in (
    'open',
    'criteria_pending',
    'closed'
  )
),
add constraint race_editions_field_limit_positive
check (
  field_limit is null
  or field_limit > 0
);

alter table public.stages
add column departure_at timestamptz,
add column profile_type text not null default 'mixed';

alter table public.stages
add constraint stages_profile_type_allowed
check (
  profile_type in (
    'flat',
    'sprint',
    'hilly',
    'mountain',
    'cobbles',
    'time_trial',
    'mixed'
  )
);

create table public.season_events (
  id uuid primary key default gen_random_uuid(),

  season_day_id uuid not null
    references public.season_days(id)
    on delete cascade,

  event_type text not null,
  title text not null,
  description text,
  href text,
  is_filter_persistent boolean not null default true,
  participation_rule text not null default 'not_applicable',

  created_at timestamptz not null default now(),

  constraint season_events_type_allowed
    check (
      event_type in (
        'season_opening',
        'sponsor_renewal',
        'national_time_trial_championships',
        'national_road_championships',
        'continental_championships',
        'world_championships'
      )
    ),

  constraint season_events_title_not_empty
    check (btrim(title) <> ''),

  constraint season_events_participation_rule_allowed
    check (
      participation_rule in (
        'not_applicable',
        'rider_nationality_matches_country',
        'national_selection'
      )
    ),

  constraint season_events_day_type_unique
    unique (season_day_id, event_type)
);

create index season_events_season_day_id_idx
  on public.season_events (season_day_id);

alter table public.season_events enable row level security;

-- ============================================================
-- CATÉGORIES DE COURSE
-- Les seuils de réputation supérieurs restent volontairement
-- indéterminés. Ils seront renseignés avant l'ouverture des
-- inscriptions Mondial, Continental et Elite.
-- ============================================================

insert into public.race_categories (
  code,
  name,
  race_format_scope,
  prestige_rank,
  description,
  is_active
)
values
  (
    'elite',
    'Elite',
    'both',
    1,
    'Grands Tours et classiques les plus prestigieuses du calendrier.',
    true
  ),
  (
    'world',
    'Mondial',
    'both',
    2,
    'Courses internationales disputées sur plusieurs continents.',
    true
  ),
  (
    'continental',
    'Continental',
    'both',
    3,
    'Épreuves régionales et continentales de niveau intermédiaire.',
    true
  ),
  (
    'national',
    'National',
    'both',
    4,
    'Courses d''accès initial constituant la base du calendrier.',
    true
  )
on conflict (code)
do update set
  name = excluded.name,
  race_format_scope = excluded.race_format_scope,
  prestige_rank = excluded.prestige_rank,
  description = excluded.description,
  is_active = excluded.is_active;

-- ============================================================
-- CATALOGUE INITIAL
-- 60 épreuves : 12 Elite, 15 Mondial, 16 Continental,
-- 17 National. Une course à étapes possède de 2 à 6 étapes.
-- ============================================================

create temporary table season_race_seed (
  slug text primary key,
  name text not null,
  short_name text,
  country_code text not null,
  category_code text not null,
  race_format text not null,
  start_day smallint not null,
  stage_count smallint not null,
  profile_pattern text[] not null,
  base_distance_km numeric(6, 2) not null
) on commit drop;

insert into season_race_seed (
  slug,
  name,
  short_name,
  country_code,
  category_code,
  race_format,
  start_day,
  stage_count,
  profile_pattern,
  base_distance_km
)
values
  -- Elite : trois Grands Tours de six étapes.
  ('corsa-delle-regioni', 'Corsa delle Regioni', 'CDR', 'IT', 'elite', 'stage_race', 2, 6, array['sprint','hilly','mountain','time_trial','mountain','sprint'], 178),
  ('boucle-des-provinces', 'Boucle des Provinces', 'BDP', 'FR', 'elite', 'stage_race', 10, 6, array['hilly','sprint','time_trial','mountain','hilly','sprint'], 181),
  ('ruta-de-las-sierras', 'Ruta de las Sierras', 'RDS', 'ES', 'elite', 'stage_race', 16, 6, array['sprint','hilly','mountain','mountain','time_trial','hilly'], 176),

  -- Elite : neuf courses d'un jour.
  ('enfer-des-dunes', 'L''Enfer des Dunes', 'EDD', 'BE', 'elite', 'one_day', 8, 1, array['cobbles'], 248),
  ('paves-de-zelande', 'Les Pavés de Zélande', 'PDZ', 'NL', 'elite', 'one_day', 9, 1, array['cobbles'], 233),
  ('couronne-des-ardennes', 'La Couronne des Ardennes', 'CDA', 'BE', 'elite', 'one_day', 12, 1, array['hilly'], 242),
  ('classique-des-lacs', 'La Classique des Lacs', 'CDL', 'IT', 'elite', 'one_day', 18, 1, array['hilly'], 251),
  ('traversee-des-flandres', 'La Traversée des Flandres', 'TDFL', 'BE', 'elite', 'one_day', 23, 1, array['cobbles'], 262),
  ('mur-de-catalogne', 'Le Mur de Catalogne', 'MDC', 'ES', 'elite', 'one_day', 24, 1, array['hilly'], 238),
  ('cime-du-tyrol', 'La Cime du Tyrol', 'CDT', 'AT', 'elite', 'one_day', 25, 1, array['mountain'], 215),
  ('chrono-des-fjords', 'Le Chrono des Fjords', 'CDF', 'NO', 'elite', 'one_day', 27, 1, array['time_trial'], 54),
  ('grand-prix-du-littoral', 'Le Grand Prix du Littoral', 'GPL', 'FR', 'elite', 'one_day', 28, 1, array['sprint'], 198),

  -- Mondial : cinq tours.
  ('tour-du-sakura', 'Tour du Sakura', 'TDS', 'JP', 'world', 'stage_race', 2, 3, array['sprint','hilly','mountain'], 156),
  ('tour-du-saint-laurent', 'Tour du Saint-Laurent', 'TSL', 'CA', 'world', 'stage_race', 6, 4, array['flat','hilly','time_trial','sprint'], 164),
  ('andes-del-sur', 'Andes del Sur', 'ADS', 'CL', 'world', 'stage_race', 11, 4, array['hilly','mountain','mountain','time_trial'], 159),
  ('tour-des-hauts-plateaux', 'Tour des Hauts Plateaux', 'THP', 'ET', 'world', 'stage_race', 16, 4, array['hilly','mountain','flat','mountain'], 168),
  ('southern-coast-tour', 'Southern Coast Tour', 'SCT', 'AU', 'world', 'stage_race', 23, 3, array['sprint','hilly','time_trial'], 171),

  -- Mondial : dix classiques.
  ('volta-do-atlantico', 'Volta do Atlântico', 'VDA', 'PT', 'world', 'one_day', 4, 1, array['hilly'], 216),
  ('cape-wind-classic', 'Cape Wind Classic', 'CWC', 'ZA', 'world', 'one_day', 5, 1, array['sprint'], 205),
  ('grand-prix-du-bosphore', 'Grand Prix du Bosphore', 'GPB', 'TR', 'world', 'one_day', 7, 1, array['hilly'], 221),
  ('great-lakes-classic', 'Great Lakes Classic', 'GLC', 'US', 'world', 'one_day', 10, 1, array['sprint'], 212),
  ('kyoto-hills-classic', 'Kyoto Hills Classic', 'KHC', 'JP', 'world', 'one_day', 13, 1, array['hilly'], 204),
  ('desert-pearl-classic', 'Desert Pearl Classic', 'DPC', 'AE', 'world', 'one_day', 15, 1, array['sprint'], 197),
  ('cordillera-challenge', 'Cordillera Challenge', 'CC', 'CO', 'world', 'one_day', 18, 1, array['mountain'], 209),
  ('baltic-cobbles', 'Baltic Cobbles', 'BC', 'EE', 'world', 'one_day', 20, 1, array['cobbles'], 218),
  ('chrono-du-cap', 'Chrono du Cap', 'CDC', 'NZ', 'world', 'one_day', 24, 1, array['time_trial'], 48),
  ('prague-karlovy', 'Prague–Karlovy', 'PK', 'CZ', 'world', 'one_day', 27, 1, array['hilly'], 229),

  -- Continental : cinq tours.
  ('volta-das-serras', 'Volta das Serras', 'VDS', 'PT', 'continental', 'stage_race', 2, 2, array['hilly','mountain'], 147),
  ('tour-de-han', 'Tour de Han', 'TDH', 'KR', 'continental', 'stage_race', 5, 3, array['sprint','hilly','time_trial'], 151),
  ('route-de-l-atlas', 'Route de l''Atlas', 'RDA', 'MA', 'continental', 'stage_race', 9, 3, array['flat','mountain','hilly'], 158),
  ('tour-de-mazovie', 'Tour de Mazovie', 'TDM', 'PL', 'continental', 'stage_race', 14, 3, array['sprint','flat','time_trial'], 153),
  ('vuelta-de-los-cafetales', 'Vuelta de los Cafetales', 'VLC', 'CO', 'continental', 'stage_race', 18, 3, array['hilly','mountain','sprint'], 149),

  -- Continental : onze classiques.
  ('grand-prix-de-la-meuse', 'Grand Prix de la Meuse', 'GPM', 'BE', 'continental', 'one_day', 2, 1, array['flat'], 184),
  ('classic-riviera-croate', 'Classic Riviera Croate', 'CRC', 'HR', 'continental', 'one_day', 4, 1, array['hilly'], 192),
  ('sprint-de-busan', 'Sprint de Busan', 'SDB', 'KR', 'continental', 'one_day', 6, 1, array['sprint'], 176),
  ('trophee-des-volcans', 'Trophée des Volcans', 'TDV', 'KE', 'continental', 'one_day', 8, 1, array['mountain'], 188),
  ('danube-classic', 'Danube Classic', 'DC', 'HU', 'continental', 'one_day', 10, 1, array['flat'], 201),
  ('chrono-de-l-algarve', 'Chrono de l''Algarve', 'CDA2', 'PT', 'continental', 'one_day', 12, 1, array['time_trial'], 39),
  ('grand-prix-des-carpathes', 'Grand Prix des Carpathes', 'GPC', 'RO', 'continental', 'one_day', 14, 1, array['hilly'], 196),
  ('cape-cobbles', 'Cape Cobbles', 'CCB', 'ZA', 'continental', 'one_day', 17, 1, array['cobbles'], 187),
  ('classic-du-pacifique', 'Classic du Pacifique', 'CDP', 'NZ', 'continental', 'one_day', 19, 1, array['flat'], 194),
  ('route-des-cedres', 'Route des Cèdres', 'RDC', 'LB', 'continental', 'one_day', 23, 1, array['hilly'], 183),
  ('grand-prix-du-mekong', 'Grand Prix du Mékong', 'GPMK', 'VN', 'continental', 'one_day', 28, 1, array['sprint'], 181),

  -- National : cinq tours.
  ('tour-des-provinces-belges', 'Tour des Provinces Belges', 'TPB', 'BE', 'national', 'stage_race', 2, 2, array['cobbles','hilly'], 133),
  ('boucle-de-l-hexagone', 'Boucle de l''Hexagone', 'BDH', 'FR', 'national', 'stage_race', 5, 2, array['flat','hilly'], 141),
  ('ruta-de-castilla', 'Ruta de Castilla', 'RDCAS', 'ES', 'national', 'stage_race', 9, 2, array['sprint','hilly'], 138),
  ('giro-dell-appennino', 'Giro dell''Appennino', 'GDA', 'IT', 'national', 'stage_race', 14, 2, array['hilly','mountain'], 136),
  ('deutschland-regional-tour', 'Deutschland Regional Tour', 'DRT', 'DE', 'national', 'stage_race', 18, 2, array['flat','time_trial'], 144),

  -- National : douze classiques.
  ('criterium-de-namur', 'Critérium de Namur', 'CDN', 'BE', 'national', 'one_day', 2, 1, array['hilly'], 161),
  ('grand-prix-de-bretagne', 'Grand Prix de Bretagne', 'GPBR', 'FR', 'national', 'one_day', 4, 1, array['hilly'], 174),
  ('trofeo-de-valencia', 'Trofeo de Valencia', 'TDV2', 'ES', 'national', 'one_day', 6, 1, array['sprint'], 168),
  ('coppa-di-toscana', 'Coppa di Toscana', 'CDT2', 'IT', 'national', 'one_day', 8, 1, array['hilly'], 179),
  ('rheinland-klassik', 'Rheinland Klassik', 'RK', 'DE', 'national', 'one_day', 10, 1, array['flat'], 172),
  ('fleche-du-brabant', 'Flèche du Brabant', 'FDB', 'BE', 'national', 'one_day', 12, 1, array['cobbles'], 166),
  ('circuit-des-cevennes', 'Circuit des Cévennes', 'CDC2', 'FR', 'national', 'one_day', 14, 1, array['mountain'], 177),
  ('clasica-de-navarra', 'Clásica de Navarra', 'CDN2', 'ES', 'national', 'one_day', 16, 1, array['hilly'], 171),
  ('trofeo-del-veneto', 'Trofeo del Veneto', 'TDV3', 'IT', 'national', 'one_day', 18, 1, array['sprint'], 169),
  ('sachsen-sprint', 'Sachsen Sprint', 'SS', 'DE', 'national', 'one_day', 20, 1, array['sprint'], 164),
  ('chronometre-de-l-ile', 'Chronomètre de l''Île', 'CDI', 'FR', 'national', 'one_day', 24, 1, array['time_trial'], 31),
  ('gran-premio-de-murcia', 'Gran Premio de Murcia', 'GPMU', 'ES', 'national', 'one_day', 28, 1, array['flat'], 182);

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
from season_race_seed as seed
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
from season_race_seed as seed
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
  status = excluded.status,
  minimum_reputation = excluded.minimum_reputation,
  registration_policy = excluded.registration_policy,
  field_limit = excluded.field_limit;

insert into public.stages (
  race_edition_id,
  season_day_id,
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
  stage_index,
  case
    when seed.race_format = 'one_day' then seed.name
    else 'Étape ' || stage_index
  end,
  case
    when seed.profile_pattern[
      ((stage_index - 1) % cardinality(seed.profile_pattern)) + 1
    ] = 'time_trial'
      then 'individual_time_trial'
    else 'road'
  end,
  case
    when seed.profile_pattern[
      ((stage_index - 1) % cardinality(seed.profile_pattern)) + 1
    ] = 'time_trial'
      then case
        when seed.stage_count > 1
          then greatest(
            24,
            round(seed.base_distance_km * 0.24)
          )
        else seed.base_distance_km
      end
    else seed.base_distance_km + ((stage_index - 1) % 3) * 7
  end,
  'planned',
  (
    season_day.calendar_date::timestamp
    + time '20:00'
  ) at time zone 'Europe/Paris',
  seed.profile_pattern[
    ((stage_index - 1) % cardinality(seed.profile_pattern)) + 1
  ]
from season_race_seed as seed
join public.races as race
  on race.slug = seed.slug
join public.race_editions as edition
  on edition.race_id = race.id
join public.seasons as season
  on season.id = edition.season_id
cross join lateral generate_series(
  1,
  seed.stage_count
) as stage_index
join public.season_days as season_day
  on season_day.season_id = season.id
 and season_day.day_number =
   seed.start_day + stage_index - 1
on conflict (race_edition_id, stage_number)
do update set
  season_day_id = excluded.season_day_id,
  name = excluded.name,
  stage_type = excluded.stage_type,
  distance_km = excluded.distance_km,
  status = excluded.status,
  departure_at = excluded.departure_at,
  profile_type = excluded.profile_type;

update public.race_editions as edition
set registration_closes_at = first_stage.departure_at - interval '8 hours'
from (
  select
    stage.race_edition_id,
    min(stage.departure_at) as departure_at
  from public.stages as stage
  group by stage.race_edition_id
) as first_stage
where edition.id = first_stage.race_edition_id
  and edition.season_id = (
    select season.id
    from public.seasons as season
    where season.status = 'active'
  );

-- ============================================================
-- TEMPS FORTS FIXES
-- ============================================================

insert into public.season_events (
  season_day_id,
  event_type,
  title,
  description,
  href,
  is_filter_persistent,
  participation_rule
)
select
  season_day.id,
  event.event_type,
  event.title,
  event.description,
  event.href,
  true,
  event.participation_rule
from public.seasons as season
join public.season_days as season_day
  on season_day.season_id = season.id
join (
  values
    (1, 'season_opening', 'Ouverture de la saison', 'Présentation des équipes et lancement officiel. Aucune course.', '/jeu', 'not_applicable'),
    (8, 'national_time_trial_championships', 'Championnats nationaux contre-la-montre', 'Chaque pays organise son championnat. Seuls les coureurs de la nationalité concernée peuvent participer.', null, 'rider_nationality_matches_country'),
    (9, 'national_road_championships', 'Championnats nationaux sur route', 'Chaque pays organise son championnat. Seuls les coureurs de la nationalité concernée peuvent participer.', null, 'rider_nationality_matches_country'),
    (21, 'sponsor_renewal', 'Renouvellement des sponsors', 'Ouverture des décisions de sponsoring pour la saison suivante.', '/jeu/sponsoring', 'not_applicable'),
    (22, 'continental_championships', 'Championnats continentaux', 'Événement international fixe. Les sélections nationales seront ajoutées ultérieurement.', null, 'national_selection'),
    (26, 'world_championships', 'Championnats du monde', 'Événement international fixe. Les sélections nationales seront ajoutées ultérieurement.', null, 'national_selection')
) as event(
  day_number,
  event_type,
  title,
  description,
  href,
  participation_rule
)
  on event.day_number = season_day.day_number
where season.status = 'active'
on conflict (season_day_id, event_type)
do update set
  title = excluded.title,
  description = excluded.description,
  href = excluded.href,
  is_filter_persistent = excluded.is_filter_persistent,
  participation_rule = excluded.participation_rule;

-- ============================================================
-- LECTURE AUTHENTIFIÉE DU CALENDRIER
-- ============================================================

grant usage on schema public to authenticated;

grant select
on table
  public.seasons,
  public.season_days,
  public.season_events,
  public.race_categories,
  public.races,
  public.race_editions,
  public.stages,
  public.stage_segments,
  public.race_results,
  public.stage_results
to authenticated;

create policy seasons_select_authenticated
on public.seasons
for select
to authenticated
using (true);

create policy season_days_select_authenticated
on public.season_days
for select
to authenticated
using (true);

create policy season_events_select_authenticated
on public.season_events
for select
to authenticated
using (true);

create policy race_categories_select_authenticated
on public.race_categories
for select
to authenticated
using (is_active = true);

create policy races_select_authenticated
on public.races
for select
to authenticated
using (status <> 'inactive');

create policy race_editions_select_authenticated
on public.race_editions
for select
to authenticated
using (true);

create policy stages_select_authenticated
on public.stages
for select
to authenticated
using (true);

create policy stage_segments_select_authenticated
on public.stage_segments
for select
to authenticated
using (true);

create policy race_results_select_authenticated
on public.race_results
for select
to authenticated
using (true);

create policy stage_results_select_authenticated
on public.stage_results
for select
to authenticated
using (true);

-- ============================================================
-- INSCRIPTION SÉCURISÉE DE L'ÉQUIPE COURANTE
-- La nationalité du DS, de l'équipe, du sponsor ou de la course
-- n'intervient jamais dans l'éligibilité. Seules la réputation,
-- la catégorie, la capacité et l'échéance sont contrôlées.
-- ============================================================

create or replace function public.register_current_team_for_race(
  p_race_edition_id uuid
)
returns table (
  registration_id uuid,
  registration_status text,
  registration_registered_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_auth_user_id uuid := auth.uid();
  v_sporting_director public.sporting_directors%rowtype;
  v_edition public.race_editions%rowtype;
  v_team_id uuid;
  v_team_season_id uuid;
  v_existing_registration public.race_registrations%rowtype;
  v_registered_count integer;
  v_created_registration public.race_registrations%rowtype;
begin
  if v_auth_user_id is null then
    raise exception using
      errcode = '42501',
      message = 'Vous devez être connecté pour inscrire une équipe.';
  end if;

  select director.*
  into v_sporting_director
  from public.sporting_directors as director
  where director.auth_user_id = v_auth_user_id
    and director.status = 'active';

  if not found then
    raise exception using
      errcode = '42501',
      message = 'Aucun Directeur Sportif actif n est associé à ce compte.';
  end if;

  select edition.*
  into v_edition
  from public.race_editions as edition
  where edition.id = p_race_edition_id
  for update;

  if not found then
    raise exception using
      errcode = 'P0002',
      message = 'Cette édition de course est introuvable.';
  end if;

  if v_edition.status in ('completed', 'cancelled', 'in_progress') then
    raise exception using
      errcode = 'P0001',
      message = 'Cette course n accepte plus de nouvelles inscriptions.';
  end if;

  if v_edition.registration_policy = 'criteria_pending'
    or v_edition.minimum_reputation is null
  then
    raise exception using
      errcode = 'P0001',
      message = 'Les critères d inscription de cette catégorie ne sont pas encore ouverts.';
  end if;

  if v_edition.registration_policy = 'closed' then
    raise exception using
      errcode = 'P0001',
      message = 'Les inscriptions de cette course sont fermées.';
  end if;

  if v_edition.registration_closes_at is null
    or now() >= v_edition.registration_closes_at
  then
    raise exception using
      errcode = 'P0001',
      message = 'La date limite d inscription est dépassée.';
  end if;

  if v_sporting_director.reputation_points <
    v_edition.minimum_reputation
  then
    raise exception using
      errcode = 'P0001',
      message = format(
        'Cette course nécessite %s points de réputation.',
        v_edition.minimum_reputation
      );
  end if;

  select assignment.team_id
  into v_team_id
  from public.team_manager_assignments as assignment
  where assignment.sporting_director_id = v_sporting_director.id
    and assignment.role = 'general_manager'
    and assignment.status = 'active';

  if not found then
    raise exception using
      errcode = '42501',
      message = 'Vous ne dirigez actuellement aucune équipe.';
  end if;

  select team_season.id
  into v_team_season_id
  from public.team_seasons as team_season
  where team_season.team_id = v_team_id
    and team_season.season_id = v_edition.season_id
    and team_season.status in ('planned', 'active');

  if not found then
    raise exception using
      errcode = '42501',
      message = 'Votre équipe ne participe pas à cette saison.';
  end if;

  select registration.*
  into v_existing_registration
  from public.race_registrations as registration
  where registration.race_edition_id = v_edition.id
    and registration.team_season_id = v_team_season_id;

  if found then
    if v_existing_registration.status = 'withdrawn' then
      raise exception using
        errcode = 'P0001',
        message = 'Cette inscription a été retirée et ne peut pas être réactivée automatiquement.';
    end if;

    return query
    select
      v_existing_registration.id,
      v_existing_registration.status,
      v_existing_registration.registered_at;
    return;
  end if;

  if v_edition.field_limit is not null then
    select count(*)
    into v_registered_count
    from public.race_registrations as registration
    where registration.race_edition_id = v_edition.id
      and registration.status = 'accepted';

    if v_registered_count >= v_edition.field_limit then
      raise exception using
        errcode = 'P0001',
        message = 'Le nombre maximal d équipes inscrites est atteint.';
    end if;
  end if;

  insert into public.race_registrations (
    race_edition_id,
    team_season_id,
    entry_method,
    status,
    registered_at,
    decided_at
  )
  values (
    v_edition.id,
    v_team_season_id,
    'requested',
    'accepted',
    now(),
    now()
  )
  returning *
  into v_created_registration;

  return query
  select
    v_created_registration.id,
    v_created_registration.status,
    v_created_registration.registered_at;
end;
$$;

revoke all
on function public.register_current_team_for_race(uuid)
from public, anon;

grant execute
on function public.register_current_team_for_race(uuid)
to authenticated;

create or replace function public.get_current_team_race_registration(
  p_race_edition_id uuid
)
returns table (
  registration_id uuid,
  registration_status text,
  registration_registered_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    registration.id,
    registration.status,
    registration.registered_at
  from public.sporting_directors as director
  join public.team_manager_assignments as assignment
    on assignment.sporting_director_id = director.id
   and assignment.role = 'general_manager'
   and assignment.status = 'active'
  join public.team_seasons as team_season
    on team_season.team_id = assignment.team_id
  join public.race_registrations as registration
    on registration.team_season_id = team_season.id
   and registration.race_edition_id = p_race_edition_id
  join public.race_editions as edition
    on edition.id = registration.race_edition_id
   and edition.season_id = team_season.season_id
  where director.auth_user_id = auth.uid()
  limit 1;
$$;

revoke all
on function public.get_current_team_race_registration(uuid)
from public, anon;

grant execute
on function public.get_current_team_race_registration(uuid)
to authenticated;

create or replace function public.get_race_past_winners(
  p_race_id uuid
)
returns table (
  game_year integer,
  season_name text,
  rider_id uuid,
  rider_first_name text,
  rider_last_name text,
  team_name text
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    season.game_year,
    season.name,
    rider.id,
    rider.first_name,
    rider.last_name,
    team_season.display_name
  from public.race_editions as edition
  join public.seasons as season
    on season.id = edition.season_id
  join public.race_results as result
    on result.race_edition_id = edition.id
   and result.final_rank = 1
   and result.status = 'classified'
  join public.race_rosters as roster
    on roster.id = result.race_roster_id
  join public.riders as rider
    on rider.id = roster.rider_id
  join public.race_registrations as registration
    on registration.id = roster.race_registration_id
  join public.team_seasons as team_season
    on team_season.id = registration.team_season_id
  where edition.race_id = p_race_id
    and edition.status = 'completed'
  order by season.game_year desc;
$$;

revoke all
on function public.get_race_past_winners(uuid)
from public, anon;

grant execute
on function public.get_race_past_winners(uuid)
to authenticated;

comment on table public.season_events is
  'Temps forts fixes d une saison, affichés indépendamment des filtres du calendrier.';

comment on column public.races.slug is
  'Identifiant public stable utilisé dans l URL de la fiche de course.';

comment on column public.race_editions.registration_closes_at is
  'Date limite d inscription, fixée huit heures avant le départ de la première étape.';

comment on column public.race_editions.registration_policy is
  'État de disponibilité des règles d inscription de cette édition.';

comment on column public.stages.departure_at is
  'Heure de départ et de simulation de l étape.';

comment on column public.stages.profile_type is
  'Profil sportif synthétique utilisé avant le tracé détaillé des segments.';

comment on function public.register_current_team_for_race(uuid) is
  'Inscrit automatiquement l équipe dirigée par le joueur lorsque la réputation et l échéance le permettent.';

comment on function public.get_current_team_race_registration(uuid) is
  'Retourne l inscription de l équipe actuellement dirigée pour une édition donnée.';

comment on function public.get_race_past_winners(uuid) is
  'Retourne les vainqueurs publics des éditions terminées d une course.';

notify pgrst, 'reload schema';

commit;
