begin;

-- ============================================================
-- SAISON 3 — CIRCUIT JUNIOR
-- Les saisons 1 et 2 continuent d'utiliser intégralement le moteur historique.
-- Toutes les agrégations sont produites à l'écriture, jamais au rendu.
-- ============================================================

alter table public.development_race_editions
  add column competition_type text not null default 'open',
  add column selection_mode text not null default 'manual',
  add column points_scale text not null default 'standard',
  add column reward_pool numeric(12, 2) not null default 0;

alter table public.development_race_editions
  add constraint development_race_editions_competition_type_allowed
    check (competition_type in (
      'open', 'national_road', 'national_time_trial',
      'world_road', 'world_time_trial'
    )),
  add constraint development_race_editions_selection_mode_allowed
    check (selection_mode in ('manual', 'automatic')),
  add constraint development_race_editions_points_scale_allowed
    check (points_scale in ('standard', 'national', 'piccolo', 'world')),
  add constraint development_race_editions_reward_pool_non_negative
    check (reward_pool >= 0);

create index development_race_editions_competition_idx
  on public.development_race_editions (
    season_id, competition_type, start_day_number, status
  );

create table public.development_virtual_riders (
  id uuid primary key default gen_random_uuid(),
  season_id uuid not null references public.seasons(id) on delete cascade,
  pool_key text not null,
  ordinal smallint not null,
  rider_name text not null,
  team_name text not null,
  country_code text not null,
  created_at timestamptz not null default now(),
  constraint development_virtual_riders_pool_unique
    unique (season_id, pool_key, ordinal),
  constraint development_virtual_riders_pool_present
    check (btrim(pool_key) <> ''),
  constraint development_virtual_riders_ordinal_range
    check (ordinal between 1 and 64),
  constraint development_virtual_riders_country_format
    check (country_code ~ '^[A-Z]{2}$')
);

create index development_virtual_riders_season_country_idx
  on public.development_virtual_riders (season_id, country_code, pool_key);

create table public.development_ranking_entries (
  id uuid primary key default gen_random_uuid(),
  season_id uuid not null references public.seasons(id) on delete cascade,
  entity_type text not null,
  entity_key text not null,
  academy_rider_id uuid references public.youth_academy_riders(id) on delete set null,
  development_team_id uuid references public.development_teams(id) on delete set null,
  display_name text not null,
  secondary_name text,
  country_code text,
  points integer not null default 0,
  wins integer not null default 0,
  podiums integer not null default 0,
  race_count integer not null default 0,
  updated_at timestamptz not null default now(),
  constraint development_ranking_entries_unique
    unique (season_id, entity_type, entity_key),
  constraint development_ranking_entries_type_allowed
    check (entity_type in ('individual', 'team', 'nation')),
  constraint development_ranking_entries_values_non_negative
    check (points >= 0 and wins >= 0 and podiums >= 0 and race_count >= 0),
  constraint development_ranking_entries_country_format
    check (country_code is null or country_code ~ '^[A-Z]{2}$')
);

create index development_ranking_entries_leaderboard_idx
  on public.development_ranking_entries (
    season_id, entity_type, points desc, wins desc, display_name
  );

create table public.junior_championship_titles (
  id uuid primary key default gen_random_uuid(),
  academy_rider_id uuid not null
    references public.youth_academy_riders(id) on delete cascade,
  season_id uuid not null references public.seasons(id) on delete cascade,
  development_race_edition_id uuid
    references public.development_race_editions(id) on delete cascade,
  professional_race_edition_id uuid
    references public.race_editions(id) on delete cascade,
  title_level text not null,
  championship_type text not null,
  country_code text not null,
  won_at timestamptz not null default now(),
  constraint junior_championship_titles_source_present check (
    num_nonnulls(development_race_edition_id, professional_race_edition_id) = 1
  ),
  constraint junior_championship_titles_level_allowed
    check (title_level in ('national', 'world')),
  constraint junior_championship_titles_type_allowed
    check (championship_type in ('road', 'time_trial')),
  constraint junior_championship_titles_country_format
    check (country_code ~ '^[A-Z]{2}$')
);

create unique index junior_titles_development_source_idx
  on public.junior_championship_titles (
    development_race_edition_id, championship_type
  ) where development_race_edition_id is not null;

create unique index junior_titles_professional_source_idx
  on public.junior_championship_titles (
    professional_race_edition_id, championship_type
  ) where professional_race_edition_id is not null;

create index junior_championship_titles_rider_season_idx
  on public.junior_championship_titles (
    academy_rider_id, season_id, title_level, championship_type
  );

create table public.development_event_rewards (
  id uuid primary key default gen_random_uuid(),
  race_edition_id uuid not null
    references public.development_race_editions(id) on delete cascade,
  development_team_id uuid not null
    references public.development_teams(id) on delete cascade,
  academy_rider_id uuid not null
    references public.youth_academy_riders(id) on delete restrict,
  final_rank smallint not null,
  cash_prize numeric(12, 2) not null,
  experience_points integer not null,
  reputation_points integer not null,
  awarded_at timestamptz not null default now(),
  constraint development_event_rewards_source_unique
    unique (race_edition_id, final_rank),
  constraint development_event_rewards_rank_range
    check (final_rank between 1 and 3),
  constraint development_event_rewards_values_non_negative
    check (cash_prize >= 0 and experience_points >= 0 and reputation_points >= 0)
);

-- Une identité technique permet à un junior d'entrer dans le moteur pro des
-- CN sans apparaître comme coureur actif, agent libre ou membre du marché.
alter table public.riders drop constraint if exists riders_status_allowed;
alter table public.riders
  add constraint riders_status_allowed check (
    status in ('active', 'free_agent', 'retired', 'suspended', 'academy')
  );

create table public.academy_competition_rider_links (
  academy_rider_id uuid not null
    references public.youth_academy_riders(id) on delete cascade,
  season_id uuid not null references public.seasons(id) on delete cascade,
  rider_id uuid not null unique references public.riders(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (academy_rider_id, season_id)
);

create index academy_competition_links_season_idx
  on public.academy_competition_rider_links (season_id, academy_rider_id);

alter table public.development_virtual_riders enable row level security;
alter table public.development_ranking_entries enable row level security;
alter table public.junior_championship_titles enable row level security;
alter table public.development_event_rewards enable row level security;
alter table public.academy_competition_rider_links enable row level security;

create policy development_virtual_riders_read_authenticated
on public.development_virtual_riders for select to authenticated using (true);

create policy development_rankings_read_authenticated
on public.development_ranking_entries for select to authenticated using (true);

create policy junior_titles_read_authenticated
on public.junior_championship_titles for select to authenticated using (true);

create policy development_event_rewards_read_managed
on public.development_event_rewards for select to authenticated
using (
  exists (
    select 1 from public.development_teams as development_team
    where development_team.id = development_team_id
      and public.current_user_manages_team(development_team.team_id)
  )
);

create policy academy_competition_links_read_managed
on public.academy_competition_rider_links for select to authenticated
using (
  exists (
    select 1 from public.youth_academy_riders as academy
    where academy.id = academy_rider_id
      and public.current_user_manages_team(academy.team_id)
  )
);

grant select on table public.development_virtual_riders to authenticated;
grant select on table public.development_ranking_entries to authenticated;
grant select on table public.junior_championship_titles to authenticated;
grant select on table public.development_event_rewards to authenticated;
grant select on table public.academy_competition_rider_links to authenticated;

grant all privileges on table public.development_virtual_riders to service_role;
grant all privileges on table public.development_ranking_entries to service_role;
grant all privileges on table public.junior_championship_titles to service_role;
grant all privileges on table public.development_event_rewards to service_role;
grant all privileges on table public.academy_competition_rider_links to service_role;

-- ============================================================
-- ADVERSAIRES PERSISTANTS ET BARÈMES
-- ============================================================

create or replace function public.ensure_development_virtual_pool(
  p_season_id uuid
)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_inserted integer := 0;
  v_row_count integer := 0;
begin
  if not exists (
    select 1 from public.seasons
    where id = p_season_id and game_year >= 3
  ) then
    return 0;
  end if;

  insert into public.development_virtual_riders (
    season_id, pool_key, ordinal, rider_name, team_name, country_code
  )
  select
    p_season_id,
    'open',
    generated.ordinal,
    (array[
      'Luca','Noah','Milan','Arthur','Mateo','Jonas','Oscar','Tomas',
      'Felix','Hugo','Emil','Nils','Tiago','Adam','Sven','Leo'
    ])[1 + floor(public.development_hash_unit(
      p_season_id::text || ':s3:first:' || generated.ordinal
    ) * 16)::integer]
    || ' ' ||
    (array[
      'Rossi','Van Aertsen','Dubois','Schmidt','Costa','Nielsen','Garcia','Kovac',
      'Novak','Andersson','De Smet','Bianchi','Martin','Muller','Jansen','Silva'
    ])[1 + floor(public.development_hash_unit(
      p_season_id::text || ':s3:last:' || generated.ordinal
    ) * 16)::integer],
    (array[
      'Alpine Youth','North Sea Academy','Lombardia U19','Iberia Futures',
      'Baltic Talent','Rhine Development','Flanders Next','Scandinavia Juniors'
    ])[1 + floor(public.development_hash_unit(
      p_season_id::text || ':s3:team:' || generated.ordinal
    ) * 8)::integer],
    (array['FR','BE','IT','ES','NL','DK','DE','PT'])[
      1 + floor(public.development_hash_unit(
        p_season_id::text || ':s3:nation:' || generated.ordinal
      ) * 8)::integer
    ]
  from generate_series(1, 64) as generated(ordinal)
  on conflict (season_id, pool_key, ordinal) do nothing;
  get diagnostics v_row_count = row_count;
  v_inserted := v_inserted + v_row_count;

  insert into public.development_virtual_riders (
    season_id, pool_key, ordinal, rider_name, team_name, country_code
  )
  select
    p_season_id,
    'national:' || country.iso_alpha2,
    generated.ordinal,
    (array[
      'Louis','Gabriel','Jules','Mathis','Victor','Elias','Simon','Anton',
      'Marco','Pablo','Bram','Mads','Nico','Rui','Theo','Max'
    ])[1 + floor(public.development_hash_unit(
      p_season_id::text || ':' || country.iso_alpha2 || ':first:' || generated.ordinal
    ) * 16)::integer]
    || ' ' ||
    (array[
      'Bernard','Lambert','Moreau','Peters','Conti','Romero','Visser','Larsen',
      'Weber','Santos','Ricci','Durand','Smet','Costa','Meyer','Nielsen'
    ])[1 + floor(public.development_hash_unit(
      p_season_id::text || ':' || country.iso_alpha2 || ':last:' || generated.ordinal
    ) * 16)::integer],
    country.name,
    country.iso_alpha2
  from (
    select distinct country.id, country.name, country.iso_alpha2
    from public.development_teams as development_team
    join public.development_team_roster as roster
      on roster.development_team_id = development_team.id
    join public.youth_academy_riders as academy
      on academy.id = roster.academy_rider_id
    join public.countries as country on country.id = academy.country_id
    where development_team.season_id = p_season_id
  ) as country
  cross join generate_series(1, 64) as generated(ordinal)
  on conflict (season_id, pool_key, ordinal) do nothing;
  get diagnostics v_row_count = row_count;

  return v_inserted + v_row_count;
end;
$$;

create or replace function public.get_development_result_points(
  p_points_scale text,
  p_race_format text,
  p_result_scope text,
  p_rank integer
)
returns integer
language sql
immutable
strict
parallel safe
set search_path = public
as $$
  select case
    when p_result_scope = 'stage' and p_race_format = 'one_day' then 0
    when p_result_scope = 'stage' then
      coalesce((array[6,5,4,3,2,1]::integer[])[p_rank], 0)
    when p_points_scale = 'world' then
      coalesce((array[50,40,32,26,22,19,16,14,12,10,8,6,5,4,3,2]::integer[])[p_rank], 0)
    when p_points_scale = 'piccolo' then
      coalesce((array[40,35,30,26,23,20,18,16,14,12,10,8,7,6,5,4,3,2,1]::integer[])[p_rank], 0)
    when p_points_scale = 'national' then
      coalesce((array[30,25,20,17,15,13,11,9,7,5,4,3,2,1]::integer[])[p_rank], 0)
    when p_race_format = 'stage_race' then
      coalesce((array[30,25,20,17,16,15,14,13,12,11,10,9,8,7,6,5,4,3,2,1]::integer[])[p_rank], 0)
    else
      coalesce((array[20,17,15,13,11,10,9,8,7,6,5,4,3,2,1]::integer[])[p_rank], 0)
  end;
$$;

create or replace function public.prepare_season_three_development_result()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_edition public.development_race_editions%rowtype;
  v_game_year integer;
  v_pool_key text;
  v_ordinal integer;
  v_virtual public.development_virtual_riders%rowtype;
  v_country_name text;
begin
  select edition.* into v_edition
  from public.development_race_editions as edition
  where edition.id = new.race_edition_id;
  select season.game_year into v_game_year
  from public.seasons as season
  where season.id = v_edition.season_id;

  if v_game_year < 3 then
    return new;
  end if;

  if new.competitor_key ~ '^virtual:[0-9]+$' then
    v_ordinal := split_part(new.competitor_key, ':', 2)::integer;
    v_pool_key := case
      when v_edition.competition_type in ('national_road', 'national_time_trial')
        then 'national:' || v_edition.country_code
      else 'open'
    end;

    select * into v_virtual
    from public.development_virtual_riders
    where season_id = v_edition.season_id
      and pool_key = v_pool_key
      and ordinal = v_ordinal;

    if v_virtual.id is not null then
      new.competitor_key := 'virtual:' || v_virtual.id::text;
      new.rider_name := v_virtual.rider_name;
      new.country_code := v_virtual.country_code;
      if v_edition.competition_type in (
        'national_road', 'national_time_trial', 'world_road', 'world_time_trial'
      ) then
        select country.name into v_country_name
        from public.countries as country
        where country.iso_alpha2 = v_virtual.country_code
        limit 1;
        new.team_name := coalesce(v_country_name, v_virtual.country_code);
      else
        new.team_name := v_virtual.team_name;
      end if;
    end if;
  end if;

  new.points := public.get_development_result_points(
    v_edition.points_scale,
    v_edition.race_format,
    new.result_scope,
    new.rank
  );
  return new;
end;
$$;

create trigger prepare_season_three_development_result
before insert on public.development_race_results
for each row execute function public.prepare_season_three_development_result();

-- ============================================================
-- CALENDRIER : BRANCHE S3, AVEC REPLI IDENTIQUE POUR S1/S2
-- ============================================================

alter function public.ensure_development_race_calendar(uuid)
  rename to ensure_development_race_calendar_pre_season_three;

create or replace function public.ensure_development_race_calendar(
  p_season_id uuid
)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_game_year integer;
  v_inserted integer := 0;
  v_row_count integer := 0;
begin
  select season.game_year into v_game_year
  from public.seasons as season
  where season.id = p_season_id;

  if v_game_year is null then
    raise exception 'La saison demandée est introuvable.';
  end if;
  if v_game_year < 3 then
    return public.ensure_development_race_calendar_pre_season_three(p_season_id);
  end if;

  insert into public.development_race_editions (
    season_id, slug, name, short_name, location_name, country_code,
    start_day_number, end_day_number, profile_type, race_format,
    is_world_championship, selection_minimum, selection_maximum,
    competition_type, selection_mode, points_scale, reward_pool
  ) values
    (p_season_id, 'prix-de-la-releve', 'Prix de la Relève', 'Prix de la Relève', 'Nantes', 'FR', 9, 9, 'mixed', 'one_day', false, 3, 6, 'open', 'manual', 'standard', 30000),
    (p_season_id, 'fleche-des-jeunes', 'Flèche des Jeunes', 'Flèche des Jeunes', 'Namur', 'BE', 10, 10, 'hilly', 'one_day', false, 3, 6, 'open', 'manual', 'standard', 32000),
    (p_season_id, 'tulpen-jeugdronde', 'Tulpen Jeugdronde', 'Tulpen Jeugdronde', 'Utrecht', 'NL', 11, 11, 'sprint', 'one_day', false, 3, 6, 'open', 'manual', 'standard', 30000),
    (p_season_id, 'paves-du-nord-juniors', 'Pavés du Nord Juniors', 'Pavés du Nord', 'Roubaix', 'FR', 12, 12, 'cobbles', 'one_day', false, 3, 6, 'open', 'manual', 'standard', 38000),
    (p_season_id, 'nordlys-junior-classic', 'Nordlys Junior Classic', 'Nordlys Classic', 'Aarhus', 'DK', 13, 13, 'mixed', 'one_day', false, 3, 6, 'open', 'manual', 'standard', 32000),
    (p_season_id, 'chrono-europeen-u19', 'Chrono Européen U19', 'Chrono Européen', 'Eindhoven', 'NL', 14, 14, 'time_trial', 'one_day', false, 1, 4, 'open', 'manual', 'standard', 36000),
    (p_season_id, 'col-des-espoirs', 'Col des Espoirs', 'Col des Espoirs', 'Aoste', 'IT', 15, 15, 'mountain', 'one_day', false, 3, 6, 'open', 'manual', 'standard', 42000),
    (p_season_id, 'sakura-rising-race', 'Sakura Rising Race', 'Sakura Rising', 'Kyoto', 'JP', 16, 16, 'hilly', 'one_day', false, 3, 6, 'open', 'manual', 'standard', 40000),
    (p_season_id, 'piccolo-giro-juniores', 'Piccolo Giro Juniores', 'Piccolo Giro', 'Dolomites', 'IT', 17, 21, 'mixed', 'stage_race', false, 4, 6, 'open', 'manual', 'piccolo', 120000),
    (p_season_id, 'vuelta-de-la-cantera', 'Vuelta de la Cantera', 'Vuelta Cantera', 'Bilbao', 'ES', 22, 22, 'hilly', 'one_day', false, 3, 6, 'open', 'manual', 'standard', 40000),
    (p_season_id, 'atlas-des-jeunes', 'Atlas des Jeunes', 'Atlas des Jeunes', 'Ifrane', 'MA', 23, 23, 'mountain', 'one_day', false, 3, 6, 'open', 'manual', 'standard', 42000),
    (p_season_id, 'coupe-des-sprinteurs', 'Coupe des Sprinteurs', 'Coupe Sprinteurs', 'Hambourg', 'DE', 24, 24, 'sprint', 'one_day', false, 3, 6, 'open', 'manual', 'standard', 38000),
    (p_season_id, 'mondial-junior-clm', 'Championnat du monde junior — CLM', 'Mondial junior CLM', 'Zurich', 'CH', 25, 25, 'time_trial', 'one_day', true, 1, 3, 'world_time_trial', 'automatic', 'world', 160000),
    (p_season_id, 'mondial-junior-route', 'Championnat du monde junior — Route', 'Mondial junior Route', 'Zurich', 'CH', 27, 27, 'hilly', 'one_day', true, 3, 6, 'world_road', 'automatic', 'world', 180000)
  on conflict (season_id, slug) do nothing;
  get diagnostics v_row_count = row_count;
  v_inserted := v_inserted + v_row_count;

  -- Deux CN juniors par nation réellement représentée dans une Dev Team.
  insert into public.development_race_editions (
    season_id, slug, name, short_name, location_name, country_code,
    start_day_number, end_day_number, profile_type, race_format,
    is_world_championship, selection_minimum, selection_maximum,
    competition_type, selection_mode, points_scale, reward_pool
  )
  select p_season_id,
    'championnat-junior-' || lower(country.iso_alpha2) || '-clm',
    'Championnat junior ' || country.name || ' — CLM',
    'CN junior ' || country.iso_alpha2 || ' CLM',
    country.name, country.iso_alpha2, 8, 8, 'time_trial', 'one_day',
    false, 1, 4, 'national_time_trial', 'manual', 'national', 18000
  from (
    select distinct country.name, country.iso_alpha2
    from public.development_teams as development_team
    join public.development_team_roster as roster
      on roster.development_team_id = development_team.id
    join public.youth_academy_riders as academy
      on academy.id = roster.academy_rider_id
    join public.countries as country on country.id = academy.country_id
    where development_team.season_id = p_season_id
  ) as country
  on conflict (season_id, slug) do nothing;
  get diagnostics v_row_count = row_count;
  v_inserted := v_inserted + v_row_count;

  insert into public.development_race_editions (
    season_id, slug, name, short_name, location_name, country_code,
    start_day_number, end_day_number, profile_type, race_format,
    is_world_championship, selection_minimum, selection_maximum,
    competition_type, selection_mode, points_scale, reward_pool
  )
  select p_season_id,
    'championnat-junior-' || lower(country.iso_alpha2) || '-route',
    'Championnat junior ' || country.name || ' — Route',
    'CN junior ' || country.iso_alpha2 || ' Route',
    country.name, country.iso_alpha2, 8, 8, 'mixed', 'one_day',
    false, 1, 6, 'national_road', 'manual', 'national', 25000
  from (
    select distinct country.name, country.iso_alpha2
    from public.development_teams as development_team
    join public.development_team_roster as roster
      on roster.development_team_id = development_team.id
    join public.youth_academy_riders as academy
      on academy.id = roster.academy_rider_id
    join public.countries as country on country.id = academy.country_id
    where development_team.season_id = p_season_id
  ) as country
  on conflict (season_id, slug) do nothing;
  get diagnostics v_row_count = row_count;
  v_inserted := v_inserted + v_row_count;

  insert into public.development_race_stages (
    race_edition_id, stage_number, day_number, name, stage_type,
    profile_type, distance_km
  )
  select edition.id, stage.stage_number, stage.day_number, stage.name,
    stage.stage_type, stage.profile_type, stage.distance_km
  from public.development_race_editions as edition
  join (
    values
      ('prix-de-la-releve', 1::smallint, 9::smallint, 'Prix de la Relève', 'road', 'mixed', 126.0::numeric),
      ('fleche-des-jeunes', 1, 10, 'Flèche des Jeunes', 'road', 'hilly', 118.0),
      ('tulpen-jeugdronde', 1, 11, 'Tulpen Jeugdronde', 'road', 'sprint', 124.0),
      ('paves-du-nord-juniors', 1, 12, 'Pavés du Nord Juniors', 'road', 'cobbles', 132.0),
      ('nordlys-junior-classic', 1, 13, 'Nordlys Junior Classic', 'road', 'mixed', 128.0),
      ('chrono-europeen-u19', 1, 14, 'Contre-la-montre individuel', 'individual_time_trial', 'time_trial', 24.0),
      ('col-des-espoirs', 1, 15, 'Col des Espoirs', 'road', 'mountain', 108.0),
      ('sakura-rising-race', 1, 16, 'Sakura Rising Race', 'road', 'hilly', 121.0),
      ('piccolo-giro-juniores', 1, 17, 'Étape 1 — Vento giovane', 'road', 'sprint', 112.0),
      ('piccolo-giro-juniores', 2, 18, 'Étape 2 — Strade bianche', 'road', 'hilly', 126.0),
      ('piccolo-giro-juniores', 3, 19, 'Étape 3 — Crono delle promesse', 'individual_time_trial', 'time_trial', 19.0),
      ('piccolo-giro-juniores', 4, 20, 'Étape 4 — Dolomiti giovani', 'road', 'mountain', 104.0),
      ('piccolo-giro-juniores', 5, 21, 'Étape 5 — Festa della gioventù', 'road', 'mixed', 118.0),
      ('vuelta-de-la-cantera', 1, 22, 'Vuelta de la Cantera', 'road', 'hilly', 130.0),
      ('atlas-des-jeunes', 1, 23, 'Atlas des Jeunes', 'road', 'mountain', 114.0),
      ('coupe-des-sprinteurs', 1, 24, 'Coupe des Sprinteurs', 'road', 'sprint', 121.0),
      ('mondial-junior-clm', 1, 25, 'Championnat du monde junior — CLM', 'individual_time_trial', 'time_trial', 27.0),
      ('mondial-junior-route', 1, 27, 'Championnat du monde junior — Route', 'road', 'hilly', 142.0)
  ) as stage(slug, stage_number, day_number, name, stage_type, profile_type, distance_km)
    on stage.slug = edition.slug
  where edition.season_id = p_season_id
  on conflict (race_edition_id, stage_number) do nothing;

  insert into public.development_race_stages (
    race_edition_id, stage_number, day_number, name, stage_type,
    profile_type, distance_km
  )
  select edition.id, 1, 8, edition.name,
    case when edition.competition_type = 'national_time_trial'
      then 'individual_time_trial' else 'road' end,
    edition.profile_type,
    case when edition.competition_type = 'national_time_trial'
      then 22.0 else 128.0 end
  from public.development_race_editions as edition
  where edition.season_id = p_season_id
    and edition.competition_type in ('national_road', 'national_time_trial')
  on conflict (race_edition_id, stage_number) do nothing;

  perform public.ensure_development_virtual_pool(p_season_id);
  return v_inserted;
end;
$$;

-- Les CN juniors sont réservés aux 16 ans et plus de la nation concernée.
create or replace function public.validate_season_three_development_selection()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_competition_type text;
  v_country_code text;
  v_game_year integer;
  v_birth_game_year integer;
  v_rider_country_code text;
begin
  select edition.competition_type, edition.country_code, season.game_year,
    academy.birth_game_year, country.iso_alpha2
  into v_competition_type, v_country_code, v_game_year,
    v_birth_game_year, v_rider_country_code
  from public.development_race_registrations as registration
  join public.development_race_editions as edition
    on edition.id = registration.race_edition_id
  join public.seasons as season on season.id = edition.season_id
  join public.youth_academy_riders as academy
    on academy.id = new.academy_rider_id
  join public.countries as country on country.id = academy.country_id
  where registration.id = new.registration_id;

  if v_game_year >= 3
    and v_competition_type in ('national_road', 'national_time_trial')
  then
    if v_game_year - v_birth_game_year < 16 then
      raise exception 'Les championnats juniors sont accessibles à partir de 16 ans.';
    end if;
    if v_rider_country_code <> v_country_code then
      raise exception 'Ce junior ne peut représenter que sa propre nation.';
    end if;
  end if;
  return new;
end;
$$;

create trigger validate_season_three_development_selection
before insert on public.development_race_registration_riders
for each row execute function public.validate_season_three_development_selection();

alter function public.register_current_development_race(uuid, uuid[])
  rename to register_current_development_race_pre_season_three;

create or replace function public.register_current_development_race(
  p_race_edition_id uuid,
  p_academy_rider_ids uuid[]
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_game_year integer;
  v_selection_mode text;
begin
  select season.game_year, edition.selection_mode
  into v_game_year, v_selection_mode
  from public.development_race_editions as edition
  join public.seasons as season on season.id = edition.season_id
  where edition.id = p_race_edition_id;

  if v_game_year >= 3 and v_selection_mode = 'automatic' then
    raise exception 'Cette sélection nationale est composée automatiquement selon le classement junior.';
  end if;

  return public.register_current_development_race_pre_season_three(
    p_race_edition_id,
    p_academy_rider_ids
  );
end;
$$;

revoke all on function public.register_current_development_race(uuid, uuid[])
  from public, anon;
grant execute on function public.register_current_development_race(uuid, uuid[])
  to authenticated, service_role;

-- ============================================================
-- CLASSEMENTS PRÉ-AGRÉGÉS
-- Individuel : tous les points. Nation : cinq meilleurs juniors.
-- ============================================================

create or replace function public.refresh_development_rankings(
  p_season_id uuid
)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_game_year integer;
  v_count integer := 0;
begin
  select game_year into v_game_year
  from public.seasons where id = p_season_id;
  if coalesce(v_game_year, 0) < 3 then return 0; end if;

  delete from public.development_ranking_entries
  where season_id = p_season_id;

  insert into public.development_ranking_entries (
    season_id, entity_type, entity_key, academy_rider_id,
    development_team_id, display_name, secondary_name, country_code,
    points, wins, podiums, race_count
  )
  select
    p_season_id,
    'individual',
    result.competitor_key,
    max(result.academy_rider_id::text)::uuid,
    max(result.development_team_id::text)::uuid,
    max(result.rider_name),
    max(coalesce(development_team.display_name, virtual.team_name, result.team_name)),
    max(result.country_code),
    sum(result.points)::integer,
    count(*) filter (
      where result.result_scope = 'general' and result.rank = 1
    )::integer,
    count(*) filter (
      where result.result_scope = 'general' and result.rank <= 3
    )::integer,
    count(distinct result.race_edition_id) filter (
      where result.result_scope = 'general'
    )::integer
  from public.development_race_results as result
  join public.development_race_editions as edition
    on edition.id = result.race_edition_id
   and edition.season_id = p_season_id
   and edition.status = 'completed'
  left join public.development_teams as development_team
    on development_team.id = result.development_team_id
  left join public.development_virtual_riders as virtual
    on result.competitor_key = 'virtual:' || virtual.id::text
  group by result.competitor_key;

  insert into public.development_ranking_entries (
    season_id, entity_type, entity_key, development_team_id,
    display_name, secondary_name, country_code,
    points, wins, podiums, race_count
  )
  select
    p_season_id,
    'team',
    grouped.entity_key,
    grouped.development_team_id,
    grouped.display_name,
    null,
    null,
    sum(grouped.points)::integer,
    sum(grouped.wins)::integer,
    sum(grouped.podiums)::integer,
    sum(grouped.race_count)::integer
  from (
    select
      case when individual.development_team_id is not null
        then individual.development_team_id::text
        else 'virtual-team:' || coalesce(individual.secondary_name, 'Indépendants')
      end as entity_key,
      individual.development_team_id,
      coalesce(individual.secondary_name, 'Indépendants') as display_name,
      individual.points,
      individual.wins,
      individual.podiums,
      individual.race_count
    from public.development_ranking_entries as individual
    where individual.season_id = p_season_id
      and individual.entity_type = 'individual'
  ) as grouped
  group by grouped.entity_key, grouped.development_team_id, grouped.display_name;

  insert into public.development_ranking_entries (
    season_id, entity_type, entity_key, display_name, secondary_name,
    country_code, points, wins, podiums, race_count
  )
  select
    p_season_id,
    'nation',
    ranked.country_code,
    coalesce(country.name, ranked.country_code),
    'Top 5 juniors',
    ranked.country_code,
    sum(ranked.points) filter (where ranked.nation_rank <= 5)::integer,
    sum(ranked.wins) filter (where ranked.nation_rank <= 5)::integer,
    sum(ranked.podiums) filter (where ranked.nation_rank <= 5)::integer,
    count(*) filter (where ranked.nation_rank <= 5)::integer
  from (
    select individual.*,
      row_number() over (
        partition by individual.country_code
        order by individual.points desc, individual.wins desc,
          individual.display_name, individual.entity_key
      ) as nation_rank
    from public.development_ranking_entries as individual
    where individual.season_id = p_season_id
      and individual.entity_type = 'individual'
      and individual.country_code is not null
  ) as ranked
  left join public.countries as country
    on country.iso_alpha2 = ranked.country_code
  group by ranked.country_code, country.name;

  select count(*)::integer into v_count
  from public.development_ranking_entries
  where season_id = p_season_id;
  return v_count;
end;
$$;

create or replace function public.refresh_development_rankings_after_race()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if old.status is distinct from 'completed' and new.status = 'completed' then
    perform public.refresh_development_rankings(new.season_id);
  end if;
  return new;
end;
$$;

create trigger refresh_development_rankings_after_race
after update of status on public.development_race_editions
for each row execute function public.refresh_development_rankings_after_race();

-- ============================================================
-- TITRES JUNIORS ET POOL DE RÉCOMPENSES
-- ============================================================

create or replace function public.award_season_three_development_result()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_edition public.development_race_editions%rowtype;
  v_game_year integer;
  v_team_id uuid;
  v_team_season_id uuid;
  v_season_day_id uuid;
  v_director_id uuid;
  v_reward_id uuid;
  v_cash numeric(12, 2);
  v_experience integer;
  v_reputation integer;
  v_title_level text;
  v_championship_type text;
begin
  if new.result_scope <> 'general' or new.academy_rider_id is null then
    return new;
  end if;

  select edition.* into v_edition
  from public.development_race_editions as edition
  where edition.id = new.race_edition_id;
  select season.game_year into v_game_year
  from public.seasons as season
  where season.id = v_edition.season_id;
  if coalesce(v_game_year, 0) < 3 then return new; end if;

  if new.rank = 1 and v_edition.competition_type in (
    'national_road', 'national_time_trial', 'world_road', 'world_time_trial'
  ) then
    v_title_level := case when v_edition.competition_type like 'world_%'
      then 'world' else 'national' end;
    v_championship_type := case when v_edition.competition_type like '%time_trial'
      then 'time_trial' else 'road' end;

    insert into public.junior_championship_titles (
      academy_rider_id, season_id, development_race_edition_id,
      title_level, championship_type, country_code
    ) values (
      new.academy_rider_id, v_edition.season_id, v_edition.id,
      v_title_level, v_championship_type, new.country_code
    ) on conflict do nothing;
  end if;

  if new.rank not between 1 and 3
    or new.development_team_id is null
    or v_edition.reward_pool <= 0
  then
    return new;
  end if;

  v_cash := round(v_edition.reward_pool * case new.rank
    when 1 then .50 when 2 then .30 else .20 end, 2);
  v_experience := (case new.rank when 1 then 45 when 2 then 25 else 15 end)
    * (case when v_edition.points_scale = 'world' then 2 else 1 end);
  v_reputation := (case new.rank when 1 then 3 when 2 then 2 else 1 end)
    * (case when v_edition.points_scale = 'world' then 2 else 1 end);

  insert into public.development_event_rewards (
    race_edition_id, development_team_id, academy_rider_id,
    final_rank, cash_prize, experience_points, reputation_points
  ) values (
    v_edition.id, new.development_team_id, new.academy_rider_id,
    new.rank, v_cash, v_experience, v_reputation
  ) on conflict (race_edition_id, final_rank) do nothing
  returning id into v_reward_id;
  if v_reward_id is null then return new; end if;

  select development_team.team_id into v_team_id
  from public.development_teams as development_team
  where development_team.id = new.development_team_id;

  select team_season.id into v_team_season_id
  from public.team_seasons as team_season
  where team_season.team_id = v_team_id
    and team_season.season_id = v_edition.season_id
  limit 1;

  select day.id into v_season_day_id
  from public.season_days as day
  where day.season_id = v_edition.season_id
    and day.day_number = v_edition.end_day_number;

  select assignment.sporting_director_id into v_director_id
  from public.team_manager_assignments as assignment
  where assignment.team_id = v_team_id
    and assignment.role = 'general_manager'
    and assignment.status = 'active'
  limit 1;

  update public.team_seasons
  set cash_balance = cash_balance + v_cash
  where id = v_team_season_id;

  update public.sporting_directors
  set experience_points = experience_points + v_experience,
    reputation_points = reputation_points + v_reputation
  where id = v_director_id;

  insert into public.team_finance_transactions (
    team_season_id, season_day_id, day_number, amount, category,
    status, description, source_reference, posted_at
  ) values (
    v_team_season_id, v_season_day_id, v_edition.end_day_number, v_cash,
    'race_prize', 'posted',
    'Prime junior — ' || v_edition.name || ' (' || new.rank || 'e)',
    'development-event-reward:' || v_reward_id::text, now()
  ) on conflict (team_season_id, source_reference) do nothing;

  return new;
end;
$$;

create trigger award_season_three_development_result
after insert on public.development_race_results
for each row execute function public.award_season_three_development_result();

-- Les Mondiaux utilisent le classement publié : six route, trois CLM par
-- nation. Les inscriptions sont régénérées de façon idempotente à partir de J24.
create or replace function public.prepare_development_world_selections(
  p_season_id uuid
)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_game_year integer;
  v_day_number integer;
  v_edition record;
  v_registration_id uuid;
  v_team record;
  v_count integer := 0;
begin
  select game_year, coalesce(current_day_number, 1)
  into v_game_year, v_day_number
  from public.seasons where id = p_season_id;
  if coalesce(v_game_year, 0) < 3 or v_day_number < 24 then return 0; end if;

  for v_edition in
    select * from public.development_race_editions
    where season_id = p_season_id
      and competition_type in ('world_road', 'world_time_trial')
      and status = 'planned'
  loop
    for v_team in
      with ranked as (
        select ranking.academy_rider_id, roster.development_team_id,
          row_number() over (
            partition by ranking.country_code
            order by ranking.points desc,
              case when v_edition.competition_type = 'world_time_trial'
                then academy.time_trial else academy.hills + academy.mountain end desc,
              ranking.display_name
          ) as nation_rank
        from public.development_ranking_entries as ranking
        join public.youth_academy_riders as academy
          on academy.id = ranking.academy_rider_id
        join public.development_team_roster as roster
          on roster.academy_rider_id = academy.id
        join public.development_teams as development_team
          on development_team.id = roster.development_team_id
         and development_team.season_id = p_season_id
        where ranking.season_id = p_season_id
          and ranking.entity_type = 'individual'
          and ranking.academy_rider_id is not null
      )
      select ranked.development_team_id,
        array_agg(ranked.academy_rider_id order by ranked.nation_rank) as rider_ids
      from ranked
      where ranked.nation_rank <= case
        when v_edition.competition_type = 'world_time_trial' then 3 else 6 end
      group by ranked.development_team_id
    loop
      insert into public.development_race_registrations (
        development_team_id, race_edition_id, status, updated_at
      ) values (
        v_team.development_team_id, v_edition.id, 'registered', now()
      ) on conflict (development_team_id, race_edition_id) do update set
        status = 'registered', updated_at = now()
      returning id into v_registration_id;

      delete from public.development_race_registration_riders
      where registration_id = v_registration_id;

      insert into public.development_race_registration_riders (
        registration_id, academy_rider_id
      )
      select v_registration_id, rider_id
      from unnest(v_team.rider_ids) as rider_id;
      v_count := v_count + coalesce(array_length(v_team.rider_ids, 1), 0);
    end loop;
  end loop;
  return v_count;
end;
$$;

alter function public.settle_due_development_races()
  rename to settle_due_development_races_pre_season_three;

create or replace function public.settle_due_development_races()
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_season_id uuid;
  v_game_year integer;
  v_settled integer;
begin
  select id, game_year into v_season_id, v_game_year
  from public.seasons where status = 'active' limit 1;
  if v_season_id is null then return 0; end if;

  perform public.ensure_development_race_calendar(v_season_id);
  if v_game_year >= 3 then
    perform public.prepare_development_world_selections(v_season_id);
  end if;

  v_settled := public.settle_due_development_races_pre_season_three();

  if v_game_year >= 3 then
    perform public.prepare_development_world_selections(v_season_id);
  end if;
  return v_settled;
end;
$$;

-- ============================================================
-- PASSERELLE CN PRO
-- Route : renfort jusqu'à 8 partants nationaux ; CLM : jusqu'à 4.
-- Seuls les juniors âgés d'au moins 16 ans peuvent être appelés.
-- ============================================================

create or replace function public.ensure_academy_competition_rider(
  p_academy_rider_id uuid,
  p_season_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_academy public.youth_academy_riders%rowtype;
  v_season public.seasons%rowtype;
  v_rider_id uuid;
  v_day_id uuid;
begin
  select rider_id into v_rider_id
  from public.academy_competition_rider_links
  where academy_rider_id = p_academy_rider_id
    and season_id = p_season_id;
  if v_rider_id is not null then return v_rider_id; end if;

  select * into v_academy
  from public.youth_academy_riders
  where id = p_academy_rider_id
  for update;
  select * into v_season from public.seasons where id = p_season_id;

  if v_academy.id is null or v_season.id is null
    or v_season.game_year < 3
    or v_season.game_year - v_academy.birth_game_year < 16
  then
    raise exception 'Ce junior ne peut pas être appelé en championnat professionnel.';
  end if;

  insert into public.riders (
    country_id, first_name, last_name, status, potential_steps,
    avatar_profile_key, avatar_seed
  ) values (
    v_academy.country_id, v_academy.first_name, v_academy.last_name,
    'academy', v_academy.potential_steps,
    v_academy.avatar_profile_key, v_academy.avatar_seed
  ) returning id into v_rider_id;

  insert into public.academy_competition_rider_links (
    academy_rider_id, season_id, rider_id
  ) values (v_academy.id, v_season.id, v_rider_id);

  insert into public.rider_season_ratings (
    rider_id, season_id, age, mountain, hills, flat, time_trial, cobbles,
    sprint, acceleration, downhill, endurance, resistance, recovery,
    breakaway, prologue
  ) values (
    v_rider_id, v_season.id,
    (v_season.game_year - v_academy.birth_game_year)::smallint,
    least(100, greatest(0, round(34 + v_academy.mountain * 8)))::smallint,
    least(100, greatest(0, round(34 + v_academy.hills * 8)))::smallint,
    least(100, greatest(0, round(34 + v_academy.flat * 8)))::smallint,
    least(100, greatest(0, round(34 + v_academy.time_trial * 8)))::smallint,
    least(100, greatest(0, round(34 + v_academy.cobbles * 8)))::smallint,
    least(100, greatest(0, round(34 + v_academy.sprint * 8)))::smallint,
    least(100, greatest(0, round(34 + v_academy.acceleration * 8)))::smallint,
    least(100, greatest(0, round(34 + v_academy.downhill * 8)))::smallint,
    least(100, greatest(0, round(34 + v_academy.endurance * 8)))::smallint,
    least(100, greatest(0, round(34 + v_academy.resistance * 8)))::smallint,
    least(100, greatest(0, round(34 + v_academy.recovery * 8)))::smallint,
    least(100, greatest(0, round(34 + v_academy.breakaway * 8)))::smallint,
    least(100, greatest(0, round(34 + v_academy.prologue * 8)))::smallint
  ) on conflict (rider_id, season_id) do nothing;

  insert into public.rider_season_summaries (rider_id, season_id)
  values (v_rider_id, v_season.id)
  on conflict (rider_id, season_id) do nothing;

  select day.id into v_day_id
  from public.season_days as day
  where day.season_id = v_season.id
    and day.day_number = coalesce(v_season.current_day_number, 1);
  if v_day_id is not null then
    insert into public.rider_condition_states (
      rider_id, season_day_id, form, fatigue, source
    ) values (v_rider_id, v_day_id, 75, 0, 'academy_championship_callup')
    on conflict (rider_id, season_day_id) do nothing;
  end if;

  return v_rider_id;
end;
$$;

create or replace function public.sync_junior_pro_national_fallback(
  p_now timestamptz default now()
)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_season public.seasons%rowtype;
  v_edition record;
  v_candidate record;
  v_link record;
  v_needed integer;
  v_threshold integer;
  v_pro_count integer;
  v_rider_id uuid;
  v_selected integer := 0;
begin
  select * into v_season
  from public.seasons where status = 'active' limit 1;
  if v_season.id is null or v_season.game_year < 3 then return 0; end if;

  create temporary table if not exists pg_temp.junior_cn_desired (
    race_edition_id uuid not null,
    rider_id uuid not null,
    team_season_id uuid not null,
    primary key (race_edition_id, rider_id)
  ) on commit drop;
  truncate table pg_temp.junior_cn_desired;

  for v_edition in
    select edition.id, race.country_id, race.competition_type,
      stage.departure_at
    from public.race_editions as edition
    join public.races as race on race.id = edition.race_id
    join public.stages as stage
      on stage.race_edition_id = edition.id and stage.stage_number = 1
    where edition.season_id = v_season.id
      and edition.status not in ('completed', 'cancelled')
      and race.competition_type in ('national_road', 'national_time_trial')
      and stage.departure_at > p_now
  loop
    v_threshold := case
      when v_edition.competition_type = 'national_time_trial' then 4 else 8 end;

    select count(*)::integer into v_pro_count
    from public.riders as rider
    join public.rider_season_ratings as rating
      on rating.rider_id = rider.id and rating.season_id = v_season.id
    where rider.country_id = v_edition.country_id
      and rider.status in ('active', 'free_agent');
    v_needed := greatest(0, v_threshold - v_pro_count);
    if v_needed = 0 then continue; end if;

    for v_candidate in
      select academy.id as academy_rider_id, team_season.id as team_season_id
      from public.youth_academy_riders as academy
      join public.development_team_roster as roster
        on roster.academy_rider_id = academy.id
      join public.development_teams as development_team
        on development_team.id = roster.development_team_id
       and development_team.season_id = v_season.id
      join public.team_seasons as team_season
        on team_season.team_id = development_team.team_id
       and team_season.season_id = v_season.id
      left join public.development_ranking_entries as ranking
        on ranking.season_id = v_season.id
       and ranking.entity_type = 'individual'
       and ranking.academy_rider_id = academy.id
      where academy.country_id = v_edition.country_id
        and academy.status in ('active', 'recruited')
        and v_season.game_year - academy.birth_game_year >= 16
      order by coalesce(ranking.points, 0) desc,
        case when v_edition.competition_type = 'national_time_trial'
          then academy.time_trial
          else academy.hills + academy.mountain + academy.endurance end desc,
        academy.last_name, academy.first_name
      limit v_needed
    loop
      v_rider_id := public.ensure_academy_competition_rider(
        v_candidate.academy_rider_id, v_season.id
      );
      insert into pg_temp.junior_cn_desired (
        race_edition_id, rider_id, team_season_id
      ) values (
        v_edition.id, v_rider_id, v_candidate.team_season_id
      ) on conflict do nothing;
      v_selected := v_selected + 1;
    end loop;
  end loop;

  -- Une préférence explicite empêche les renforts route supplémentaires de
  -- partir aussi en CLM lorsque seul le seuil route est incomplet.
  for v_link in
    select edition.id as race_edition_id, link.rider_id,
      team_season.id as team_season_id
    from public.academy_competition_rider_links as link
    join public.youth_academy_riders as academy
      on academy.id = link.academy_rider_id
    join public.team_seasons as team_season
      on team_season.team_id = academy.team_id
     and team_season.season_id = link.season_id
    join public.races as race
      on race.country_id = academy.country_id
     and race.competition_type in ('national_road', 'national_time_trial')
    join public.race_editions as edition
      on edition.race_id = race.id and edition.season_id = link.season_id
    join public.stages as stage
      on stage.race_edition_id = edition.id and stage.stage_number = 1
    where link.season_id = v_season.id
      and edition.status not in ('completed', 'cancelled')
      and stage.departure_at > p_now
  loop
    insert into public.national_championship_rider_preferences (
      race_edition_id, rider_id, team_season_id, is_selected, updated_at
    ) values (
      v_link.race_edition_id, v_link.rider_id, v_link.team_season_id,
      exists (
        select 1 from pg_temp.junior_cn_desired as desired
        where desired.race_edition_id = v_link.race_edition_id
          and desired.rider_id = v_link.rider_id
      ),
      now()
    ) on conflict (race_edition_id, rider_id) do update set
      team_season_id = excluded.team_season_id,
      is_selected = excluded.is_selected,
      updated_at = excluded.updated_at;
  end loop;

  return v_selected;
end;
$$;

-- Le classement national reconnaît uniquement les identités academy déjà
-- créées par la passerelle, et leur rattache l'équipe parente sans contrat pro.
create or replace function public.get_national_championship_country_rankings(
  p_season_id uuid
)
returns table (
  rider_id uuid,
  country_id uuid,
  team_season_id uuid,
  national_rank integer,
  uci_points integer
)
language sql
stable
security definer
set search_path = ''
as $$
  select rider.id, rider.country_id,
    coalesce(contract_ownership.team_season_id, academy_ownership.team_season_id),
    row_number() over (
      partition by rider.country_id
      order by coalesce(summary.points, 0) desc,
        round(((rating.mountain + rating.hills + rating.flat + rating.time_trial
          + rating.cobbles + rating.sprint + rating.acceleration + rating.downhill
          + rating.endurance + rating.resistance + rating.recovery
          + rating.breakaway + rating.prologue)::numeric / 13), 2) desc,
        rider.last_name, rider.first_name, rider.id
    )::integer,
    coalesce(summary.points, 0)::integer
  from public.riders as rider
  join public.rider_season_ratings as rating
    on rating.rider_id = rider.id and rating.season_id = p_season_id
  left join public.rider_season_summaries as summary
    on summary.rider_id = rider.id and summary.season_id = p_season_id
  left join lateral (
    select team_season.id as team_season_id
    from public.rider_contracts as contract
    join public.team_seasons as team_season
      on team_season.team_id = contract.team_id
     and team_season.season_id = p_season_id
     and team_season.status in ('planned', 'active')
    where contract.rider_id = rider.id and contract.status = 'active'
    order by contract.created_at desc, team_season.id limit 1
  ) as contract_ownership on true
  left join lateral (
    select team_season.id as team_season_id
    from public.academy_competition_rider_links as link
    join public.youth_academy_riders as academy
      on academy.id = link.academy_rider_id
    join public.team_seasons as team_season
      on team_season.team_id = academy.team_id
     and team_season.season_id = p_season_id
     and team_season.status in ('planned', 'active')
    where link.rider_id = rider.id and link.season_id = p_season_id
    limit 1
  ) as academy_ownership on true
  where rider.status in ('active', 'free_agent', 'academy')
    and rider.country_id is not null;
$$;

create or replace function public.mirror_academy_professional_national_title()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_link public.academy_competition_rider_links%rowtype;
  v_country_code text;
  v_game_year integer;
begin
  select * into v_link
  from public.academy_competition_rider_links
  where rider_id = new.rider_id and season_id = new.season_id;
  if v_link.rider_id is null then return new; end if;
  select game_year into v_game_year from public.seasons where id = new.season_id;
  if coalesce(v_game_year, 0) < 3 then return new; end if;
  select iso_alpha2 into v_country_code
  from public.countries where id = new.country_id;

  insert into public.junior_championship_titles (
    academy_rider_id, season_id, professional_race_edition_id,
    title_level, championship_type, country_code
  ) values (
    v_link.academy_rider_id, new.season_id, new.race_edition_id,
    'national', new.championship_type, v_country_code
  ) on conflict do nothing;
  return new;
end;
$$;

create trigger mirror_academy_professional_national_title
after insert or update of rider_id on public.rider_national_championship_titles
for each row execute function public.mirror_academy_professional_national_title();

-- À la promotion, le palmarès CN de l'identité technique suit le vrai coureur.
create or replace function public.merge_academy_competition_identity_on_promotion()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_shadow_rider_id uuid;
begin
  if new.promoted_rider_id is null
    or new.promoted_rider_id is not distinct from old.promoted_rider_id
  then return new; end if;

  select rider_id into v_shadow_rider_id
  from public.academy_competition_rider_links
  where academy_rider_id = new.id
  order by created_at desc limit 1;
  if v_shadow_rider_id is null or v_shadow_rider_id = new.promoted_rider_id then
    return new;
  end if;

  delete from public.race_rosters as shadow_roster
  where shadow_roster.rider_id = v_shadow_rider_id
    and exists (
      select 1 from public.race_rosters as promoted_roster
      where promoted_roster.race_registration_id = shadow_roster.race_registration_id
        and promoted_roster.rider_id = new.promoted_rider_id
    );
  update public.race_rosters
  set rider_id = new.promoted_rider_id
  where rider_id = v_shadow_rider_id;

  update public.rider_national_championship_titles
  set rider_id = new.promoted_rider_id
  where rider_id = v_shadow_rider_id;

  update public.academy_competition_rider_links
  set rider_id = new.promoted_rider_id
  where academy_rider_id = new.id and rider_id = v_shadow_rider_id;

  update public.riders set status = 'retired'
  where id = v_shadow_rider_id;
  return new;
end;
$$;

create trigger merge_academy_competition_identity_on_promotion
after update of promoted_rider_id on public.youth_academy_riders
for each row execute function public.merge_academy_competition_identity_on_promotion();

revoke all on function public.ensure_development_virtual_pool(uuid)
  from public, anon, authenticated;
revoke all on function public.ensure_development_race_calendar(uuid)
  from public, anon, authenticated;
revoke all on function public.settle_due_development_races()
  from public, anon, authenticated;
revoke all on function public.refresh_development_rankings(uuid)
  from public, anon, authenticated;
revoke all on function public.prepare_development_world_selections(uuid)
  from public, anon, authenticated;
revoke all on function public.ensure_academy_competition_rider(uuid, uuid)
  from public, anon, authenticated;
revoke all on function public.sync_junior_pro_national_fallback(timestamptz)
  from public, anon, authenticated;

grant execute on function public.ensure_development_virtual_pool(uuid)
  to service_role;
grant execute on function public.ensure_development_race_calendar(uuid)
  to service_role;
grant execute on function public.settle_due_development_races()
  to service_role;
grant execute on function public.refresh_development_rankings(uuid)
  to service_role;
grant execute on function public.prepare_development_world_selections(uuid)
  to service_role;
grant execute on function public.ensure_academy_competition_rider(uuid, uuid)
  to service_role;
grant execute on function public.sync_junior_pro_national_fallback(timestamptz)
  to service_role;

comment on table public.development_ranking_entries is
  'Classements juniors S3 pré-agrégés à la clôture de chaque épreuve : individuel, équipes et nations (cinq meilleurs).';
comment on table public.development_virtual_riders is
  'Adversaires juniors virtuels persistants pendant toute une saison, afin de conserver noms, nations et équipes.';
comment on table public.academy_competition_rider_links is
  'Identités techniques invisibles permettant aux juniors de renforcer un CN professionnel sans intégrer les écrans pro.';

notify pgrst, 'reload schema';

commit;
