begin;

create table public.development_teams (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  season_id uuid not null references public.seasons(id) on delete restrict,
  display_name text not null,
  jersey_pattern text not null default 'classic',
  jersey_primary_color text not null default '#176951',
  jersey_secondary_color text not null default '#FFFDF4',
  jersey_accent_color text not null default '#F2C94C',
  status text not null default 'active',
  roster_locked_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint development_teams_team_season_unique unique (team_id, season_id),
  constraint development_teams_name_not_empty check (btrim(display_name) <> ''),
  constraint development_teams_status_allowed check (status in ('active', 'completed')),
  constraint development_teams_jersey_pattern_allowed check (
    jersey_pattern in (
      'classic', 'diagonal', 'hoops', 'split', 'vertical', 'chevron',
      'quarters', 'cross', 'shoulders', 'checkerboard', 'wave', 'pinstripes'
    )
  ),
  constraint development_teams_jersey_colors_valid check (
    jersey_primary_color ~ '^#[0-9A-F]{6}$'
    and jersey_secondary_color ~ '^#[0-9A-F]{6}$'
    and jersey_accent_color ~ '^#[0-9A-F]{6}$'
    and not (
      jersey_primary_color = jersey_secondary_color
      and jersey_secondary_color = jersey_accent_color
    )
  )
);

create index development_teams_season_status_idx
  on public.development_teams (season_id, status);

create table public.development_team_roster (
  id uuid primary key default gen_random_uuid(),
  development_team_id uuid not null references public.development_teams(id) on delete cascade,
  academy_rider_id uuid not null references public.youth_academy_riders(id) on delete restrict,
  race_number smallint not null,
  joined_at timestamptz not null default now(),
  constraint development_team_roster_member_unique
    unique (development_team_id, academy_rider_id),
  constraint development_team_roster_number_unique
    unique (development_team_id, race_number),
  constraint development_team_roster_number_range check (race_number between 1 and 11)
);

create index development_team_roster_rider_idx
  on public.development_team_roster (academy_rider_id, development_team_id);

create table public.development_race_editions (
  id uuid primary key default gen_random_uuid(),
  season_id uuid not null references public.seasons(id) on delete cascade,
  slug text not null,
  name text not null,
  short_name text not null,
  location_name text not null,
  country_code text not null,
  start_day_number smallint not null,
  end_day_number smallint not null,
  profile_type text not null,
  race_format text not null,
  is_world_championship boolean not null default false,
  selection_minimum smallint not null default 3,
  selection_maximum smallint not null default 6,
  status text not null default 'planned',
  simulated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint development_race_editions_season_slug_unique unique (season_id, slug),
  constraint development_race_editions_slug_format check (slug ~ '^[a-z0-9][a-z0-9-]*$'),
  constraint development_race_editions_days_valid check (
    start_day_number between 8 and 28
    and end_day_number between start_day_number and 28
  ),
  constraint development_race_editions_profile_allowed check (
    profile_type in ('flat', 'sprint', 'hilly', 'mountain', 'cobbles', 'time_trial', 'mixed')
  ),
  constraint development_race_editions_format_allowed check (
    race_format in ('one_day', 'stage_race')
  ),
  constraint development_race_editions_selection_valid check (
    selection_minimum between 1 and selection_maximum
    and selection_maximum <= 6
  ),
  constraint development_race_editions_status_allowed check (
    status in ('planned', 'completed', 'cancelled')
  )
);

create index development_race_editions_calendar_idx
  on public.development_race_editions (season_id, start_day_number, status);

create table public.development_race_stages (
  id uuid primary key default gen_random_uuid(),
  race_edition_id uuid not null references public.development_race_editions(id) on delete cascade,
  stage_number smallint not null,
  day_number smallint not null,
  name text not null,
  stage_type text not null default 'road',
  profile_type text not null,
  distance_km numeric(6, 1) not null,
  created_at timestamptz not null default now(),
  constraint development_race_stages_edition_number_unique
    unique (race_edition_id, stage_number),
  constraint development_race_stages_number_positive check (stage_number > 0),
  constraint development_race_stages_day_range check (day_number between 8 and 28),
  constraint development_race_stages_type_allowed check (
    stage_type in ('road', 'individual_time_trial')
  ),
  constraint development_race_stages_profile_allowed check (
    profile_type in ('flat', 'sprint', 'hilly', 'mountain', 'cobbles', 'time_trial', 'mixed')
  ),
  constraint development_race_stages_distance_positive check (distance_km between 5 and 220)
);

create table public.development_race_registrations (
  id uuid primary key default gen_random_uuid(),
  development_team_id uuid not null references public.development_teams(id) on delete cascade,
  race_edition_id uuid not null references public.development_race_editions(id) on delete cascade,
  status text not null default 'registered',
  registered_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint development_race_registrations_unique
    unique (development_team_id, race_edition_id),
  constraint development_race_registrations_status_allowed check (
    status in ('registered', 'completed', 'withdrawn')
  )
);

create index development_race_registrations_edition_status_idx
  on public.development_race_registrations (race_edition_id, status);

create table public.development_race_registration_riders (
  registration_id uuid not null references public.development_race_registrations(id) on delete cascade,
  academy_rider_id uuid not null references public.youth_academy_riders(id) on delete restrict,
  selected_at timestamptz not null default now(),
  primary key (registration_id, academy_rider_id)
);

create index development_race_registration_riders_rider_idx
  on public.development_race_registration_riders (academy_rider_id);

create table public.development_race_results (
  id uuid primary key default gen_random_uuid(),
  race_edition_id uuid not null references public.development_race_editions(id) on delete cascade,
  stage_id uuid references public.development_race_stages(id) on delete cascade,
  result_scope text not null,
  competitor_key text not null,
  academy_rider_id uuid references public.youth_academy_riders(id) on delete restrict,
  development_team_id uuid references public.development_teams(id) on delete set null,
  rider_name text not null,
  team_name text not null,
  country_code text not null,
  rank integer not null,
  elapsed_time_seconds integer not null,
  gap_to_winner_seconds integer not null,
  points integer not null default 0,
  created_at timestamptz not null default now(),
  constraint development_race_results_scope_allowed check (
    result_scope in ('stage', 'general')
  ),
  constraint development_race_results_stage_shape check (
    (result_scope = 'stage' and stage_id is not null)
    or (result_scope = 'general' and stage_id is null)
  ),
  constraint development_race_results_rank_positive check (rank > 0),
  constraint development_race_results_times_non_negative check (
    elapsed_time_seconds >= 0 and gap_to_winner_seconds >= 0
  )
);

create unique index development_race_results_competitor_unique_idx
  on public.development_race_results (
    race_edition_id,
    result_scope,
    coalesce(stage_id, '00000000-0000-0000-0000-000000000000'::uuid),
    competitor_key
  );

create unique index development_race_results_rank_unique_idx
  on public.development_race_results (
    race_edition_id,
    result_scope,
    coalesce(stage_id, '00000000-0000-0000-0000-000000000000'::uuid),
    rank
  );

create index development_race_results_team_idx
  on public.development_race_results (development_team_id, result_scope, rank);

alter table public.development_teams enable row level security;
alter table public.development_team_roster enable row level security;
alter table public.development_race_editions enable row level security;
alter table public.development_race_stages enable row level security;
alter table public.development_race_registrations enable row level security;
alter table public.development_race_registration_riders enable row level security;
alter table public.development_race_results enable row level security;

create policy development_teams_read_managed
on public.development_teams for select to authenticated
using (public.current_user_manages_team(team_id));

create policy development_team_roster_read_managed
on public.development_team_roster for select to authenticated
using (
  exists (
    select 1 from public.development_teams as development_team
    where development_team.id = development_team_id
      and public.current_user_manages_team(development_team.team_id)
  )
);

create policy development_race_editions_read_authenticated
on public.development_race_editions for select to authenticated using (true);

create policy development_race_stages_read_authenticated
on public.development_race_stages for select to authenticated using (true);

create policy development_race_registrations_read_managed
on public.development_race_registrations for select to authenticated
using (
  exists (
    select 1 from public.development_teams as development_team
    where development_team.id = development_team_id
      and public.current_user_manages_team(development_team.team_id)
  )
);

create policy development_race_registration_riders_read_managed
on public.development_race_registration_riders for select to authenticated
using (
  exists (
    select 1
    from public.development_race_registrations as registration
    join public.development_teams as development_team
      on development_team.id = registration.development_team_id
    where registration.id = registration_id
      and public.current_user_manages_team(development_team.team_id)
  )
);

create policy development_race_results_read_authenticated
on public.development_race_results for select to authenticated using (true);

create or replace function public.ensure_development_race_calendar(
  p_season_id uuid
)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_inserted integer := 0;
begin
  if not exists (select 1 from public.seasons where id = p_season_id) then
    raise exception 'La saison demandée est introuvable.';
  end if;

  insert into public.development_race_editions (
    season_id, slug, name, short_name, location_name, country_code,
    start_day_number, end_day_number, profile_type, race_format,
    is_world_championship, selection_minimum, selection_maximum
  ) values
    (p_season_id, 'prix-de-la-releve', 'Prix de la Relève', 'Prix de la Relève', 'Nantes', 'FR', 8, 8, 'mixed', 'one_day', false, 3, 6),
    (p_season_id, 'fleche-des-jeunes', 'Flèche des Jeunes', 'Flèche des Jeunes', 'Namur', 'BE', 10, 10, 'hilly', 'one_day', false, 3, 6),
    (p_season_id, 'paves-du-nord-juniors', 'Pavés du Nord Juniors', 'Pavés du Nord', 'Roubaix', 'FR', 12, 12, 'cobbles', 'one_day', false, 3, 6),
    (p_season_id, 'chrono-europeen-u19', 'Chrono Européen U19', 'Chrono Européen', 'Eindhoven', 'NL', 14, 14, 'time_trial', 'one_day', false, 1, 4),
    (p_season_id, 'col-des-espoirs', 'Col des Espoirs', 'Col des Espoirs', 'Aoste', 'IT', 15, 15, 'mountain', 'one_day', false, 3, 6),
    (p_season_id, 'tour-de-la-releve', 'Tour de la Relève', 'Tour de la Relève', 'Alpes', 'FR', 17, 19, 'mixed', 'stage_race', false, 4, 6),
    (p_season_id, 'coupe-des-sprinteurs', 'Coupe des Sprinteurs', 'Coupe des Sprinteurs', 'Hambourg', 'DE', 21, 21, 'sprint', 'one_day', false, 3, 6),
    (p_season_id, 'classique-des-lacs-juniors', 'Classique des Lacs Juniors', 'Classique des Lacs', 'Annecy', 'FR', 23, 23, 'hilly', 'one_day', false, 3, 6),
    (p_season_id, 'mondial-junior-clm', 'Championnat du monde junior — CLM', 'Mondial junior CLM', 'Zurich', 'CH', 25, 25, 'time_trial', 'one_day', true, 1, 3),
    (p_season_id, 'mondial-junior-route', 'Championnat du monde junior — Route', 'Mondial junior Route', 'Zurich', 'CH', 27, 27, 'hilly', 'one_day', true, 3, 6)
  on conflict (season_id, slug) do nothing;
  get diagnostics v_inserted = row_count;

  insert into public.development_race_stages (
    race_edition_id, stage_number, day_number, name, stage_type,
    profile_type, distance_km
  )
  select edition.id, stage.stage_number, stage.day_number, stage.name,
    stage.stage_type, stage.profile_type, stage.distance_km
  from public.development_race_editions as edition
  join (
    values
      ('prix-de-la-releve', 1::smallint, 8::smallint, 'Prix de la Relève', 'road', 'mixed', 126.0::numeric),
      ('fleche-des-jeunes', 1, 10, 'Flèche des Jeunes', 'road', 'hilly', 118.0),
      ('paves-du-nord-juniors', 1, 12, 'Pavés du Nord Juniors', 'road', 'cobbles', 132.0),
      ('chrono-europeen-u19', 1, 14, 'Contre-la-montre individuel', 'individual_time_trial', 'time_trial', 24.0),
      ('col-des-espoirs', 1, 15, 'Col des Espoirs', 'road', 'mountain', 108.0),
      ('tour-de-la-releve', 1, 17, 'Étape 1 — Plaine des espoirs', 'road', 'sprint', 112.0),
      ('tour-de-la-releve', 2, 18, 'Étape 2 — Chrono du lac', 'individual_time_trial', 'time_trial', 18.0),
      ('tour-de-la-releve', 3, 19, 'Étape 3 — Sommet de la relève', 'road', 'mountain', 96.0),
      ('coupe-des-sprinteurs', 1, 21, 'Coupe des Sprinteurs', 'road', 'sprint', 121.0),
      ('classique-des-lacs-juniors', 1, 23, 'Classique des Lacs Juniors', 'road', 'hilly', 129.0),
      ('mondial-junior-clm', 1, 25, 'Championnat du monde junior — CLM', 'individual_time_trial', 'time_trial', 27.0),
      ('mondial-junior-route', 1, 27, 'Championnat du monde junior — Route', 'road', 'hilly', 142.0)
  ) as stage(slug, stage_number, day_number, name, stage_type, profile_type, distance_km)
    on stage.slug = edition.slug
  where edition.season_id = p_season_id
  on conflict (race_edition_id, stage_number) do nothing;

  return v_inserted;
end;
$$;

create or replace function public.create_current_development_team(
  p_academy_rider_ids uuid[],
  p_jersey_pattern text,
  p_jersey_primary_color text,
  p_jersey_secondary_color text,
  p_jersey_accent_color text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_auth_user_id uuid := auth.uid();
  v_team_id uuid;
  v_season_id uuid;
  v_day_number integer;
  v_team_name text;
  v_development_team_id uuid;
  v_count integer;
  v_pattern text := lower(btrim(coalesce(p_jersey_pattern, '')));
  v_primary text := upper(btrim(coalesce(p_jersey_primary_color, '')));
  v_secondary text := upper(btrim(coalesce(p_jersey_secondary_color, '')));
  v_accent text := upper(btrim(coalesce(p_jersey_accent_color, '')));
begin
  if v_auth_user_id is null then
    raise exception 'Vous devez être authentifié.';
  end if;

  select assignment.team_id, season.id, coalesce(season.current_day_number, 1),
    team_season.display_name
  into v_team_id, v_season_id, v_day_number, v_team_name
  from public.sporting_directors as director
  join public.team_manager_assignments as assignment
    on assignment.sporting_director_id = director.id
   and assignment.role = 'general_manager'
   and assignment.status = 'active'
  join public.seasons as season on season.status = 'active'
  join public.team_seasons as team_season
    on team_season.team_id = assignment.team_id
   and team_season.season_id = season.id
  where director.auth_user_id = v_auth_user_id
    and director.status = 'active'
  limit 1;

  if v_team_id is null then
    raise exception 'Aucune équipe active ne peut créer de Development Team.';
  end if;
  if v_day_number not between 1 and 7 then
    raise exception 'La Development Team doit être composée entre J1 et J7.';
  end if;
  if exists (
    select 1 from public.development_teams
    where team_id = v_team_id and season_id = v_season_id
  ) then
    raise exception 'La Development Team de cette saison est déjà constituée.';
  end if;

  v_count := coalesce(array_length(p_academy_rider_ids, 1), 0);
  if v_count < 1 or v_count > 11 then
    raise exception 'Sélectionnez entre 1 et 11 juniors.';
  end if;
  if (select count(distinct rider_id) from unnest(p_academy_rider_ids) as rider_id) <> v_count then
    raise exception 'Un même junior ne peut pas être sélectionné plusieurs fois.';
  end if;
  if (
    select count(*)
    from public.youth_academy_riders as youth
    where youth.id = any(p_academy_rider_ids)
      and youth.team_id = v_team_id
      and youth.status in ('active', 'recruited')
  ) <> v_count then
    raise exception 'Un ou plusieurs juniors ne sont pas éligibles.';
  end if;

  if v_pattern not in (
    'classic', 'diagonal', 'hoops', 'split', 'vertical', 'chevron',
    'quarters', 'cross', 'shoulders', 'checkerboard', 'wave', 'pinstripes'
  ) then
    raise exception 'Le motif du maillot est invalide.';
  end if;
  if v_primary !~ '^#[0-9A-F]{6}$'
    or v_secondary !~ '^#[0-9A-F]{6}$'
    or v_accent !~ '^#[0-9A-F]{6}$'
  then
    raise exception 'Une ou plusieurs couleurs du maillot sont invalides.';
  end if;
  if v_primary = v_secondary and v_secondary = v_accent then
    raise exception 'Le maillot doit utiliser au moins deux couleurs.';
  end if;

  insert into public.development_teams (
    team_id, season_id, display_name, jersey_pattern,
    jersey_primary_color, jersey_secondary_color, jersey_accent_color
  ) values (
    v_team_id, v_season_id, btrim(v_team_name) || ' Dev Team', v_pattern,
    v_primary, v_secondary, v_accent
  ) returning id into v_development_team_id;

  insert into public.development_team_roster (
    development_team_id, academy_rider_id, race_number
  )
  select v_development_team_id, selected.rider_id,
    row_number() over (order by youth.last_name, youth.first_name, youth.id)::smallint
  from unnest(p_academy_rider_ids) as selected(rider_id)
  join public.youth_academy_riders as youth on youth.id = selected.rider_id;

  perform public.ensure_development_race_calendar(v_season_id);

  return jsonb_build_object(
    'developmentTeamId', v_development_team_id,
    'displayName', btrim(v_team_name) || ' Dev Team',
    'rosterCount', v_count
  );
end;
$$;

create or replace function public.update_current_development_team_jersey(
  p_jersey_pattern text,
  p_jersey_primary_color text,
  p_jersey_secondary_color text,
  p_jersey_accent_color text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_auth_user_id uuid := auth.uid();
  v_development_team public.development_teams%rowtype;
  v_pattern text := lower(btrim(coalesce(p_jersey_pattern, '')));
  v_primary text := upper(btrim(coalesce(p_jersey_primary_color, '')));
  v_secondary text := upper(btrim(coalesce(p_jersey_secondary_color, '')));
  v_accent text := upper(btrim(coalesce(p_jersey_accent_color, '')));
begin
  if v_auth_user_id is null then raise exception 'Vous devez être authentifié.'; end if;
  if v_pattern not in (
    'classic', 'diagonal', 'hoops', 'split', 'vertical', 'chevron',
    'quarters', 'cross', 'shoulders', 'checkerboard', 'wave', 'pinstripes'
  ) then raise exception 'Le motif du maillot est invalide.'; end if;
  if v_primary !~ '^#[0-9A-F]{6}$' or v_secondary !~ '^#[0-9A-F]{6}$'
    or v_accent !~ '^#[0-9A-F]{6}$'
  then raise exception 'Une ou plusieurs couleurs du maillot sont invalides.'; end if;
  if v_primary = v_secondary and v_secondary = v_accent then
    raise exception 'Le maillot doit utiliser au moins deux couleurs.';
  end if;

  select development_team.* into v_development_team
  from public.development_teams as development_team
  join public.seasons as season on season.id = development_team.season_id
  where season.status = 'active'
    and public.current_user_manages_team(development_team.team_id)
  limit 1
  for update;

  if v_development_team.id is null then
    raise exception 'Aucune Development Team active n’a été trouvée.';
  end if;

  update public.development_teams
  set jersey_pattern = v_pattern,
    jersey_primary_color = v_primary,
    jersey_secondary_color = v_secondary,
    jersey_accent_color = v_accent,
    updated_at = now()
  where id = v_development_team.id;

  return jsonb_build_object(
    'developmentTeamId', v_development_team.id,
    'jerseyPattern', v_pattern,
    'primaryColor', v_primary,
    'secondaryColor', v_secondary,
    'accentColor', v_accent
  );
end;
$$;

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
  v_auth_user_id uuid := auth.uid();
  v_development_team public.development_teams%rowtype;
  v_edition public.development_race_editions%rowtype;
  v_day_number integer;
  v_registration_id uuid;
  v_count integer;
begin
  if v_auth_user_id is null then raise exception 'Vous devez être authentifié.'; end if;

  select development_team, coalesce(season.current_day_number, 1)
  into v_development_team, v_day_number
  from public.development_teams as development_team
  join public.seasons as season on season.id = development_team.season_id
  where season.status = 'active'
    and development_team.status = 'active'
    and public.current_user_manages_team(development_team.team_id)
  limit 1;

  if v_development_team.id is null then
    raise exception 'Constituez d’abord votre Development Team.';
  end if;

  select * into v_edition
  from public.development_race_editions
  where id = p_race_edition_id
    and season_id = v_development_team.season_id
  for update;

  if v_edition.id is null then raise exception 'Cette épreuve junior est introuvable.'; end if;
  if v_edition.status <> 'planned' then raise exception 'Cette épreuve est déjà terminée.'; end if;
  if v_day_number >= v_edition.start_day_number then
    raise exception 'Les inscriptions sont closes depuis le début de J%.', v_edition.start_day_number;
  end if;

  v_count := coalesce(array_length(p_academy_rider_ids, 1), 0);
  if v_count < v_edition.selection_minimum or v_count > v_edition.selection_maximum then
    raise exception 'Cette épreuve demande entre % et % coureurs.',
      v_edition.selection_minimum, v_edition.selection_maximum;
  end if;
  if (select count(distinct rider_id) from unnest(p_academy_rider_ids) as rider_id) <> v_count then
    raise exception 'Un même junior ne peut pas être engagé plusieurs fois.';
  end if;
  if (
    select count(*)
    from public.development_team_roster as roster
    where roster.development_team_id = v_development_team.id
      and roster.academy_rider_id = any(p_academy_rider_ids)
  ) <> v_count then
    raise exception 'La sélection contient un junior extérieur à votre Development Team.';
  end if;

  insert into public.development_race_registrations (
    development_team_id, race_edition_id, status
  ) values (v_development_team.id, v_edition.id, 'registered')
  on conflict (development_team_id, race_edition_id) do update set
    status = 'registered', updated_at = now()
  returning id into v_registration_id;

  delete from public.development_race_registration_riders
  where registration_id = v_registration_id;

  insert into public.development_race_registration_riders (
    registration_id, academy_rider_id
  ) select v_registration_id, rider_id
  from unnest(p_academy_rider_ids) as rider_id;

  return jsonb_build_object(
    'registrationId', v_registration_id,
    'raceName', v_edition.name,
    'riderCount', v_count
  );
end;
$$;

create or replace function public.development_hash_unit(p_value text)
returns numeric
language sql
immutable
strict
parallel safe
as $$
  select (('x' || substr(md5(p_value), 1, 8))::bit(32)::bigint)::numeric
    / 4294967295::numeric;
$$;

create or replace function public.simulate_development_race(
  p_race_edition_id uuid
)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_edition public.development_race_editions%rowtype;
  v_stage public.development_race_stages%rowtype;
  v_real_count integer;
  v_virtual_count integer;
  v_result_count integer := 0;
begin
  perform pg_advisory_xact_lock(hashtextextended('development-race:' || p_race_edition_id::text, 0));

  select * into v_edition
  from public.development_race_editions
  where id = p_race_edition_id
  for update;

  if v_edition.id is null then raise exception 'Cette épreuve junior est introuvable.'; end if;
  if v_edition.status = 'completed' then return 0; end if;
  if v_edition.status = 'cancelled' then return 0; end if;
  if not exists (
    select 1 from public.seasons
    where id = v_edition.season_id
      and coalesce(current_day_number, 1) >= v_edition.end_day_number
  ) then
    raise exception 'Cette épreuve n’est pas encore arrivée à son terme.';
  end if;

  delete from public.development_race_results
  where race_edition_id = v_edition.id;

  select count(*)::integer into v_real_count
  from public.development_race_registrations as registration
  join public.development_race_registration_riders as selected
    on selected.registration_id = registration.id
  where registration.race_edition_id = v_edition.id
    and registration.status = 'registered';
  v_virtual_count := greatest(0, 48 - v_real_count);

  create temporary table if not exists pg_temp.development_stage_scores (
    competitor_key text primary key,
    academy_rider_id uuid,
    development_team_id uuid,
    rider_name text not null,
    team_name text not null,
    country_code text not null,
    performance_score numeric not null,
    elapsed_time_seconds integer not null
  ) on commit drop;

  for v_stage in
    select * from public.development_race_stages
    where race_edition_id = v_edition.id
    order by stage_number
  loop
    truncate table pg_temp.development_stage_scores;

    insert into pg_temp.development_stage_scores (
      competitor_key, academy_rider_id, development_team_id,
      rider_name, team_name, country_code, performance_score,
      elapsed_time_seconds
    )
    select
      'youth:' || youth.id::text,
      youth.id,
      development_team.id,
      youth.first_name || ' ' || youth.last_name,
      case when v_edition.is_world_championship then country.name
        else development_team.display_name end,
      country.iso_alpha2,
      score.value,
      greatest(300, round(
        (v_stage.distance_km / case
          when v_stage.stage_type = 'individual_time_trial' then 42
          when v_stage.profile_type = 'mountain' then 31
          when v_stage.profile_type = 'cobbles' then 36
          else 39 end) * 3600
        + (8.8 - score.value) * case
          when v_stage.stage_type = 'individual_time_trial' then 42
          else 68 end
      ))::integer
    from public.development_race_registrations as registration
    join public.development_teams as development_team
      on development_team.id = registration.development_team_id
    join public.development_race_registration_riders as selected
      on selected.registration_id = registration.id
    join public.youth_academy_riders as youth
      on youth.id = selected.academy_rider_id
    join public.countries as country on country.id = youth.country_id
    cross join lateral (
      select (
        case v_stage.profile_type
          when 'flat' then youth.flat * .34 + youth.sprint * .26 + youth.acceleration * .18 + youth.endurance * .12 + youth.resistance * .10
          when 'sprint' then youth.sprint * .34 + youth.acceleration * .24 + youth.flat * .18 + youth.resistance * .13 + youth.endurance * .11
          when 'hilly' then youth.hills * .36 + youth.acceleration * .18 + youth.endurance * .17 + youth.resistance * .14 + youth.mountain * .10 + youth.sprint * .05
          when 'mountain' then youth.mountain * .42 + youth.recovery * .18 + youth.endurance * .17 + youth.resistance * .13 + youth.downhill * .10
          when 'cobbles' then youth.cobbles * .39 + youth.flat * .19 + youth.resistance * .18 + youth.endurance * .14 + youth.acceleration * .10
          when 'time_trial' then youth.time_trial * .52 + youth.prologue * .16 + youth.flat * .14 + youth.endurance * .10 + youth.resistance * .08
          else youth.hills * .18 + youth.mountain * .16 + youth.flat * .14 + youth.time_trial * .14 + youth.endurance * .13 + youth.resistance * .10 + youth.acceleration * .08 + youth.recovery * .07
        end
        + (public.development_hash_unit(v_edition.id::text || ':' || v_stage.id::text || ':' || youth.id::text) - .5) * .72
      ) as value
    ) as score
    where registration.race_edition_id = v_edition.id
      and registration.status = 'registered';

    insert into pg_temp.development_stage_scores (
      competitor_key, rider_name, team_name, country_code,
      performance_score, elapsed_time_seconds
    )
    select
      'virtual:' || generated.ordinal,
      (array['Luca','Noah','Milan','Arthur','Mateo','Jonas','Oscar','Tomas','Felix','Hugo','Emil','Nils','Tiago','Adam','Sven','Leo'])[
        1 + floor(public.development_hash_unit(v_edition.id::text || ':first:' || generated.ordinal) * 16)::integer
      ] || ' ' ||
      (array['Rossi','Van Aertsen','Dubois','Schmidt','Costa','Nielsen','Garcia','Kovac','Novak','Andersson','De Smet','Bianchi','Martin','Müller','Jansen','Silva'])[
        1 + floor(public.development_hash_unit(v_edition.id::text || ':last:' || generated.ordinal) * 16)::integer
      ],
      case when v_edition.is_world_championship then
        (array['France','Belgique','Italie','Espagne','Pays-Bas','Danemark','Allemagne','Portugal'])[
          1 + floor(public.development_hash_unit(v_edition.id::text || ':nation:' || generated.ordinal) * 8)::integer
        ]
      else
        (array['Alpine Youth','North Sea Academy','Lombardia U19','Iberia Futures','Baltic Talent','Rhine Development'])[
          1 + floor(public.development_hash_unit(v_edition.id::text || ':team:' || generated.ordinal) * 6)::integer
        ]
      end,
      (array['FR','BE','IT','ES','NL','DK','DE','PT'])[
        1 + floor(public.development_hash_unit(v_edition.id::text || ':nation:' || generated.ordinal) * 8)::integer
      ],
      virtual_score.value,
      greatest(300, round(
        (v_stage.distance_km / case
          when v_stage.stage_type = 'individual_time_trial' then 42
          when v_stage.profile_type = 'mountain' then 31
          when v_stage.profile_type = 'cobbles' then 36
          else 39 end) * 3600
        + (8.8 - virtual_score.value) * case
          when v_stage.stage_type = 'individual_time_trial' then 42
          else 68 end
      ))::integer
    from generate_series(1, v_virtual_count) as generated(ordinal)
    cross join lateral (
      select 4.15
        + public.development_hash_unit(v_edition.id::text || ':base:' || generated.ordinal) * 3.45
        + (public.development_hash_unit(v_stage.id::text || ':stage:' || generated.ordinal) - .5) * .58
        as value
    ) as virtual_score;

    insert into public.development_race_results (
      race_edition_id, stage_id, result_scope, competitor_key,
      academy_rider_id, development_team_id, rider_name, team_name,
      country_code, rank, elapsed_time_seconds, gap_to_winner_seconds, points
    )
    select v_edition.id, v_stage.id, 'stage', ranked.competitor_key,
      ranked.academy_rider_id, ranked.development_team_id,
      ranked.rider_name, ranked.team_name, ranked.country_code,
      ranked.rank, ranked.elapsed_time_seconds,
      ranked.elapsed_time_seconds - min(ranked.elapsed_time_seconds) over (),
      greatest(0, 51 - ranked.rank)
    from (
      select scores.*,
        row_number() over (
          order by scores.elapsed_time_seconds, scores.performance_score desc,
            scores.competitor_key
        )::integer as rank
      from pg_temp.development_stage_scores as scores
    ) as ranked;
  end loop;

  insert into public.development_race_results (
    race_edition_id, result_scope, competitor_key, academy_rider_id,
    development_team_id, rider_name, team_name, country_code, rank,
    elapsed_time_seconds, gap_to_winner_seconds, points
  )
  select v_edition.id, 'general', totals.competitor_key,
    totals.academy_rider_id, totals.development_team_id,
    totals.rider_name, totals.team_name, totals.country_code,
    totals.rank, totals.elapsed_time_seconds,
    totals.elapsed_time_seconds - min(totals.elapsed_time_seconds) over (),
    greatest(0, 101 - totals.rank)
  from (
    select aggregate.*,
      row_number() over (
        order by aggregate.elapsed_time_seconds, aggregate.competitor_key
      )::integer as rank
    from (
      select result.competitor_key,
        max(result.academy_rider_id::text)::uuid as academy_rider_id,
        max(result.development_team_id::text)::uuid as development_team_id,
        max(result.rider_name) as rider_name,
        max(result.team_name) as team_name,
        max(result.country_code) as country_code,
        sum(result.elapsed_time_seconds)::integer as elapsed_time_seconds
      from public.development_race_results as result
      where result.race_edition_id = v_edition.id
        and result.result_scope = 'stage'
      group by result.competitor_key
    ) as aggregate
  ) as totals;

  get diagnostics v_result_count = row_count;

  update public.development_race_registrations
  set status = 'completed', updated_at = now()
  where race_edition_id = v_edition.id and status = 'registered';

  update public.development_race_editions
  set status = 'completed', simulated_at = now(), updated_at = now()
  where id = v_edition.id;

  return v_result_count;
end;
$$;

create or replace function public.settle_due_development_races()
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_season public.seasons%rowtype;
  v_edition record;
  v_count integer := 0;
begin
  select * into v_season
  from public.seasons
  where status = 'active'
  limit 1;

  if v_season.id is null then return 0; end if;
  perform public.ensure_development_race_calendar(v_season.id);

  for v_edition in
    select id
    from public.development_race_editions
    where season_id = v_season.id
      and status = 'planned'
      and end_day_number <= coalesce(v_season.current_day_number, 1)
    order by end_day_number, id
  loop
    perform public.simulate_development_race(v_edition.id);
    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

create or replace function public.complete_development_teams_with_season()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if old.status is distinct from 'completed' and new.status = 'completed' then
    update public.development_teams
    set status = 'completed', updated_at = now()
    where season_id = new.id and status = 'active';
  end if;
  return new;
end;
$$;

drop trigger if exists development_teams_season_closure on public.seasons;
create trigger development_teams_season_closure
after update of status on public.seasons
for each row execute function public.complete_development_teams_with_season();

do $$
begin
  if to_regprocedure(
    'public.calculate_game_objective_progress_pre_development(text,uuid,uuid,numeric)'
  ) is null then
    alter function public.calculate_game_objective_progress(text, uuid, uuid, numeric)
      rename to calculate_game_objective_progress_pre_development;
  end if;
end;
$$;

create or replace function public.calculate_game_objective_progress(
  p_metric_key text,
  p_director_id uuid,
  p_current_team_id uuid,
  p_experience_points numeric
)
returns integer
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_value integer;
begin
  case p_metric_key
    when 'development_teams_created' then
      select count(*)::integer into v_value
      from public.development_teams as development_team
      where exists (
        select 1 from public.team_manager_assignments as assignment
        where assignment.sporting_director_id = p_director_id
          and assignment.role = 'general_manager'
          and assignment.team_id = development_team.team_id
      );

    when 'development_roster_size' then
      select coalesce(max(roster_count), 0)::integer into v_value
      from (
        select development_team.id, count(roster.id) as roster_count
        from public.development_teams as development_team
        left join public.development_team_roster as roster
          on roster.development_team_id = development_team.id
        where exists (
          select 1 from public.team_manager_assignments as assignment
          where assignment.sporting_director_id = p_director_id
            and assignment.role = 'general_manager'
            and assignment.team_id = development_team.team_id
        )
        group by development_team.id
      ) as roster_sizes;

    when 'development_race_registrations' then
      select count(*)::integer into v_value
      from public.development_race_registrations as registration
      join public.development_teams as development_team
        on development_team.id = registration.development_team_id
      where registration.status in ('registered', 'completed')
        and exists (
          select 1 from public.team_manager_assignments as assignment
          where assignment.sporting_director_id = p_director_id
            and assignment.role = 'general_manager'
            and assignment.team_id = development_team.team_id
        );

    when 'development_race_wins' then
      select count(*)::integer into v_value
      from public.development_race_results as result
      join public.development_teams as development_team
        on development_team.id = result.development_team_id
      where result.result_scope = 'general' and result.rank = 1
        and exists (
          select 1 from public.team_manager_assignments as assignment
          where assignment.sporting_director_id = p_director_id
            and assignment.role = 'general_manager'
            and assignment.team_id = development_team.team_id
        );

    when 'development_world_titles' then
      select count(*)::integer into v_value
      from public.development_race_results as result
      join public.development_race_editions as edition
        on edition.id = result.race_edition_id
      join public.development_teams as development_team
        on development_team.id = result.development_team_id
      where result.result_scope = 'general' and result.rank = 1
        and edition.is_world_championship
        and exists (
          select 1 from public.team_manager_assignments as assignment
          where assignment.sporting_director_id = p_director_id
            and assignment.role = 'general_manager'
            and assignment.team_id = development_team.team_id
        );

    when 'development_tour_wins' then
      select count(*)::integer into v_value
      from public.development_race_results as result
      join public.development_race_editions as edition
        on edition.id = result.race_edition_id
      join public.development_teams as development_team
        on development_team.id = result.development_team_id
      where result.result_scope = 'general' and result.rank = 1
        and edition.race_format = 'stage_race'
        and exists (
          select 1 from public.team_manager_assignments as assignment
          where assignment.sporting_director_id = p_director_id
            and assignment.role = 'general_manager'
            and assignment.team_id = development_team.team_id
        );

    else
      return public.calculate_game_objective_progress_pre_development(
        p_metric_key, p_director_id, p_current_team_id, p_experience_points
      );
  end case;

  return greatest(0, coalesce(v_value, 0));
end;
$$;

insert into public.game_objective_definitions (
  objective_key, objective_type, objective_group, title, description,
  metric_key, target_value, reward_cash, reward_experience,
  reward_reputation, reward_inventory_item_key,
  reward_equipment_catalog_key, reward_random_special_ability,
  display_order, is_active
)
values
  ('development_team_created', 'secondary', 'development_team', 'La relève prend un maillot', 'Créer une première Development Team entre J1 et J7.', 'development_teams_created', 1, 10000, 40, 2, null, null, false, 1460, true),
  ('development_roster_full', 'secondary', 'development_team', 'Onze talents, un projet', 'Constituer une Development Team avec onze juniors.', 'development_roster_size', 11, 25000, 90, 4, null, null, false, 1470, true),
  ('development_races_5', 'secondary', 'development_team', 'Le calendrier des espoirs', 'Engager vos juniors sur cinq épreuves de Development Team.', 'development_race_registrations', 5, 20000, 75, 3, null, null, false, 1480, true),
  ('development_first_win', 'secondary', 'development_team', 'Première victoire junior', 'Remporter une épreuve avec un coureur de votre Development Team.', 'development_race_wins', 1, 40000, 140, 6, null, null, true, 1490, true),
  ('development_tour_win', 'secondary', 'development_team', 'Patron de la relève', 'Remporter le classement général du Tour de la Relève.', 'development_tour_wins', 1, 100000, 320, 12, null, null, true, 1495, true),
  ('development_world_title', 'secondary', 'development_team', 'Arc-en-ciel junior', 'Former un champion du monde junior, sur route ou contre-la-montre.', 'development_world_titles', 1, 125000, 400, 15, null, null, true, 1498, true)
on conflict (objective_key) do update set
  objective_type = excluded.objective_type,
  objective_group = excluded.objective_group,
  title = excluded.title,
  description = excluded.description,
  metric_key = excluded.metric_key,
  target_value = excluded.target_value,
  reward_cash = excluded.reward_cash,
  reward_experience = excluded.reward_experience,
  reward_reputation = excluded.reward_reputation,
  reward_inventory_item_key = excluded.reward_inventory_item_key,
  reward_equipment_catalog_key = excluded.reward_equipment_catalog_key,
  reward_random_special_ability = excluded.reward_random_special_ability,
  display_order = excluded.display_order,
  is_active = excluded.is_active,
  updated_at = now();

select public.ensure_development_race_calendar(season.id)
from public.seasons as season
where season.status in ('active', 'planned');

revoke all on table public.development_teams from anon, authenticated;
revoke all on table public.development_team_roster from anon, authenticated;
revoke all on table public.development_race_editions from anon, authenticated;
revoke all on table public.development_race_stages from anon, authenticated;
revoke all on table public.development_race_registrations from anon, authenticated;
revoke all on table public.development_race_registration_riders from anon, authenticated;
revoke all on table public.development_race_results from anon, authenticated;

grant select on table public.development_teams to authenticated;
grant select on table public.development_team_roster to authenticated;
grant select on table public.development_race_editions to authenticated;
grant select on table public.development_race_stages to authenticated;
grant select on table public.development_race_registrations to authenticated;
grant select on table public.development_race_registration_riders to authenticated;
grant select on table public.development_race_results to authenticated;

grant all privileges on table public.development_teams to service_role;
grant all privileges on table public.development_team_roster to service_role;
grant all privileges on table public.development_race_editions to service_role;
grant all privileges on table public.development_race_stages to service_role;
grant all privileges on table public.development_race_registrations to service_role;
grant all privileges on table public.development_race_registration_riders to service_role;
grant all privileges on table public.development_race_results to service_role;

revoke all on function public.ensure_development_race_calendar(uuid)
  from public, anon, authenticated;
revoke all on function public.create_current_development_team(uuid[], text, text, text, text)
  from public, anon;
revoke all on function public.update_current_development_team_jersey(text, text, text, text)
  from public, anon;
revoke all on function public.register_current_development_race(uuid, uuid[])
  from public, anon;
revoke all on function public.development_hash_unit(text)
  from public, anon, authenticated;
revoke all on function public.simulate_development_race(uuid)
  from public, anon, authenticated;
revoke all on function public.settle_due_development_races()
  from public, anon, authenticated;
revoke all on function public.complete_development_teams_with_season()
  from public, anon, authenticated;
revoke all on function public.calculate_game_objective_progress(text, uuid, uuid, numeric)
  from public, anon, authenticated;

grant execute on function public.create_current_development_team(uuid[], text, text, text, text)
  to authenticated;
grant execute on function public.update_current_development_team_jersey(text, text, text, text)
  to authenticated;
grant execute on function public.register_current_development_race(uuid, uuid[])
  to authenticated;
grant execute on function public.ensure_development_race_calendar(uuid)
  to service_role;
grant execute on function public.development_hash_unit(text)
  to service_role;
grant execute on function public.simulate_development_race(uuid)
  to service_role;
grant execute on function public.settle_due_development_races()
  to service_role;
grant execute on function public.calculate_game_objective_progress(text, uuid, uuid, numeric)
  to service_role;

comment on table public.development_teams is
  'Identité saisonnière et maillot de la structure junior d’une équipe professionnelle.';
comment on table public.development_team_roster is
  'Effectif junior verrouillé entre J1 et J7, limité à onze coureurs.';
comment on table public.development_race_results is
  'Classements bruts et idempotents des épreuves Development Team, opposition virtuelle incluse.';

notify pgrst, 'reload schema';

commit;
