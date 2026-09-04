begin;

create table public.national_federation_race_projects (
  id uuid primary key default gen_random_uuid(),
  country_id uuid not null references public.countries(id) on delete cascade,
  submitted_season_id uuid not null references public.seasons(id) on delete restrict,
  activation_game_year integer not null,
  race_id uuid not null references public.races(id) on delete restrict,
  race_category_id uuid not null references public.race_categories(id) on delete restrict,
  submitted_by_director_id uuid not null
    references public.sporting_directors(id) on delete restrict,
  name text not null,
  short_name text not null,
  race_format text not null,
  category_code text not null,
  start_day_number smallint not null,
  start_day_slot text not null,
  stage_blueprint jsonb not null,
  score_snapshot jsonb not null,
  status text not null default 'scheduled',
  activated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint national_federation_race_projects_name_present
    check (btrim(name) <> '' and btrim(short_name) <> ''),
  constraint national_federation_race_projects_activation_valid
    check (activation_game_year >= 5),
  constraint national_federation_race_projects_format_allowed
    check (race_format in ('one_day', 'stage_race')),
  constraint national_federation_race_projects_category_allowed
    check (category_code in ('continental', 'national', 'regional')),
  constraint national_federation_race_projects_day_valid
    check (start_day_number between 1 and 28),
  constraint national_federation_race_projects_slot_allowed
    check (start_day_slot in ('early', 'late')),
  constraint national_federation_race_projects_blueprint_array
    check (jsonb_typeof(stage_blueprint) = 'array'),
  constraint national_federation_race_projects_status_allowed
    check (status in ('scheduled', 'active', 'cancelled')),
  constraint national_federation_race_projects_one_per_season
    unique (country_id, submitted_season_id)
);

create index national_federation_race_projects_activation_idx
  on public.national_federation_race_projects (activation_game_year, status);

alter table public.national_federation_race_projects enable row level security;
create policy national_federation_race_projects_select_authenticated
on public.national_federation_race_projects
for select to authenticated using (true);
grant select on table public.national_federation_race_projects to authenticated;
grant all on table public.national_federation_race_projects to service_role;

create or replace function public.get_national_federation_race_creation_score(
  p_country_id uuid,
  p_season_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
set statement_timeout = '15s'
as $$
declare
  v_season public.seasons%rowtype;
  v_country_code text;
  v_previous_season_id uuid;
  v_nation_rank integer := 173;
  v_rank_target integer := 24;
  v_reference_teams integer := 0;
  v_current_teams integer := 0;
  v_member_target integer := 1;
  v_naturalizations integer := 0;
  v_naturalization_target integer := 1;
  v_published_selections integer := 0;
  v_junior_nation_rank integer;
  v_championship_rank integer;
  v_completed_objectives integer := 0;
  v_existing_races integer := 0;
  v_ranking_points integer := 0;
  v_objective_points integer := 0;
  v_calendar_penalty integer := 0;
  v_total integer := 0;
begin
  select * into v_season from public.seasons where id = p_season_id;
  select upper(country.iso_alpha2) into v_country_code
  from public.countries as country
  where country.id = p_country_id and country.is_active = true;
  if v_season.id is null or v_country_code is null then
    raise exception 'La saison ou la fédération est introuvable.';
  end if;

  with country_points as (
    select ranking.country_id, sum(ranking.uci_points)::bigint as points
    from public.get_national_championship_country_rankings(p_season_id) as ranking
    group by ranking.country_id
  ), ranked as (
    select country_id,
      row_number() over (order by points desc, country_id)::integer as rank
    from country_points
  )
  select coalesce(rank, 173) into v_nation_rank
  from ranked where country_id = p_country_id;
  v_nation_rank := coalesce(v_nation_rank, 173);
  v_rank_target := case
    when v_nation_rank <= 16 then 8
    when v_nation_rank <= 48 then 16
    else 24
  end;

  select season.id into v_previous_season_id
  from public.seasons as season
  where season.game_year = v_season.game_year - 1;
  select count(*)::integer into v_reference_teams
  from public.team_seasons as team_season
  where team_season.season_id = coalesce(v_previous_season_id, p_season_id)
    and team_season.registration_country_id = p_country_id
    and team_season.status in ('planned', 'active', 'completed');
  select count(*)::integer into v_current_teams
  from public.team_seasons as team_season
  where team_season.season_id = p_season_id
    and team_season.registration_country_id = p_country_id
    and team_season.status in ('planned', 'active');
  v_member_target := v_reference_teams + case when v_reference_teams >= 8 then 2 else 1 end;
  if v_current_teams >= v_member_target then
    v_completed_objectives := v_completed_objectives + 1;
  end if;

  v_naturalization_target := least(
    3,
    greatest(1, ceil(greatest(1, v_reference_teams)::numeric / 4)::integer)
  );
  select count(*)::integer into v_naturalizations
  from public.rider_naturalizations as naturalization
  where naturalization.season_id = p_season_id
    and naturalization.to_country_id = p_country_id;
  if v_naturalizations >= v_naturalization_target then
    v_completed_objectives := v_completed_objectives + 1;
  end if;

  select count(*)::integer into v_published_selections
  from public.national_federation_selection_lists as selection_list
  where selection_list.country_id = p_country_id
    and selection_list.season_id = p_season_id
    and selection_list.status in ('pending_confirmation', 'finalized');
  if v_published_selections >= 5 then
    v_completed_objectives := v_completed_objectives + 1;
  end if;

  select ranked.rank into v_junior_nation_rank
  from (
    select entry.entity_key,
      row_number() over (
        order by entry.points desc, entry.wins desc, entry.display_name, entry.entity_key
      )::integer as rank
    from public.development_ranking_entries as entry
    where entry.season_id = p_season_id and entry.entity_type = 'nation'
  ) as ranked
  where upper(ranked.entity_key) = v_country_code;
  if v_junior_nation_rank is not null and v_junior_nation_rank <= v_rank_target then
    v_completed_objectives := v_completed_objectives + 1;
  end if;

  select min(result.final_rank)::integer into v_championship_rank
  from public.race_results as result
  join public.race_editions as edition
    on edition.id = result.race_edition_id and edition.season_id = p_season_id
  join public.races as race
    on race.id = edition.race_id
   and race.competition_type in ('world_championship', 'continental_championship')
  join public.race_rosters as roster on roster.id = result.race_roster_id
  join public.riders as rider
    on rider.id = roster.rider_id and rider.country_id = p_country_id
  where result.status = 'classified';
  if v_championship_rank is not null and v_championship_rank <= v_rank_target then
    v_completed_objectives := v_completed_objectives + 1;
  end if;

  select count(*)::integer into v_existing_races
  from public.races as race
  where race.country_id = p_country_id
    and race.competition_type = 'standard'
    and race.status = 'active';

  v_ranking_points := greatest(0, 41 - v_nation_rank);
  v_objective_points := v_completed_objectives * 15;
  v_calendar_penalty := v_existing_races * 10;
  v_total := greatest(
    0,
    least(100, v_ranking_points + v_objective_points - v_calendar_penalty)
  );

  return jsonb_build_object(
    'nationRank', nullif(v_nation_rank, 173),
    'rankingPoints', v_ranking_points,
    'completedObjectiveCount', v_completed_objectives,
    'objectivePoints', v_objective_points,
    'existingRaceCount', v_existing_races,
    'calendarPenalty', v_calendar_penalty,
    'total', v_total,
    'threshold', 60,
    'eligible', v_total >= 60
  );
end;
$$;

create or replace function public.create_national_federation_race(
  p_country_code text,
  p_name text,
  p_short_name text,
  p_race_format text,
  p_category_code text,
  p_start_day_number integer,
  p_start_day_slot text,
  p_stage_blueprint jsonb
)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
set statement_timeout = '30s'
as $$
declare
  v_identity record;
  v_season public.seasons%rowtype;
  v_target_season public.seasons%rowtype;
  v_target_season_id uuid;
  v_category public.race_categories%rowtype;
  v_score jsonb;
  v_stage record;
  v_segment record;
  v_stage_count integer;
  v_segment_count integer;
  v_slot_index integer;
  v_day_number integer;
  v_day_slot text;
  v_stage_distance numeric;
  v_stage_id uuid;
  v_first_departure timestamptz;
  v_race_id uuid := gen_random_uuid();
  v_project_id uuid := gen_random_uuid();
  v_edition_id uuid := gen_random_uuid();
  v_slug text;
  v_terrain text;
  v_gradient numeric;
  v_profile text;
  v_stage_type text;
begin
  if (select auth.uid()) is null then
    raise exception 'Authentification requise.';
  end if;
  select * into v_identity
  from public.get_current_federation_identity(p_country_code);
  select * into v_season from public.seasons where status = 'active' limit 1;
  if v_identity.country_id is null or v_identity.sporting_director_id is null then
    raise exception 'Cette action est réservée à une équipe affiliée à la fédération.';
  end if;
  if v_season.id is null or v_season.game_year < 4 then
    raise exception 'La création de course sera disponible à partir de la Saison 4.';
  end if;
  if not exists (
    select 1 from public.national_federation_terms as term
    where term.country_id = v_identity.country_id
      and term.start_game_year <= v_season.game_year
      and term.end_game_year >= v_season.game_year
      and term.governance_mode = 'elected'
      and term.president_director_id = v_identity.sporting_director_id
  ) then
    raise exception 'Seul le président élu peut homologuer une course.';
  end if;
  if coalesce((
    select infrastructure.level
    from public.national_federation_infrastructures as infrastructure
    where infrastructure.country_id = v_identity.country_id
      and infrastructure.infrastructure_code = 'race_organization_office'
  ), 0) < 1 then
    raise exception 'Le Bureau d’organisation doit atteindre le niveau 1.';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'federation-race:' || v_identity.country_id::text || ':' || v_season.id::text,
      0
    )
  );
  if exists (
    select 1 from public.national_federation_race_projects as project
    where project.country_id = v_identity.country_id
      and project.submitted_season_id = v_season.id
  ) then
    raise exception 'Cette fédération a déjà homologué une course cette saison.';
  end if;

  v_score := public.get_national_federation_race_creation_score(
    v_identity.country_id,
    v_season.id
  );
  if coalesce((v_score ->> 'total')::integer, 0) < 60 then
    raise exception 'L’indice d’homologation doit atteindre 60 points.';
  end if;

  if length(btrim(coalesce(p_name, ''))) not between 4 and 80 then
    raise exception 'Le nom de la course doit contenir entre 4 et 80 caractères.';
  end if;
  if length(btrim(coalesce(p_short_name, ''))) not between 2 and 12
    or btrim(p_short_name) !~ '^[[:alnum:]À-ÖØ-öø-ÿ -]+$' then
    raise exception 'Le sigle de la course est invalide.';
  end if;
  if p_race_format not in ('one_day', 'stage_race') then
    raise exception 'Le format de course est invalide.';
  end if;
  if p_category_code not in ('continental', 'national', 'regional') then
    raise exception 'Les rangs Elite et Mondial ne peuvent pas être créés par une fédération.';
  end if;
  if p_start_day_number not between 1 and 28
    or p_start_day_slot not in ('early', 'late') then
    raise exception 'Le créneau de départ est invalide.';
  end if;
  if jsonb_typeof(p_stage_blueprint) <> 'array' then
    raise exception 'Le profil des étapes est invalide.';
  end if;
  v_stage_count := jsonb_array_length(p_stage_blueprint);
  if (p_race_format = 'one_day' and v_stage_count <> 1)
    or (p_race_format = 'stage_race' and v_stage_count not between 2 and 8) then
    raise exception 'Une classique compte une étape ; un tour en compte de 2 à 8.';
  end if;
  v_slot_index := (p_start_day_number - 1) * 2
    + case p_start_day_slot when 'late' then 1 else 0 end;
  if v_slot_index + v_stage_count - 1 > 55 then
    raise exception 'La dernière étape dépasserait la J28.';
  end if;
  if exists (
    select 1 from public.races as race where lower(race.name) = lower(btrim(p_name))
  ) then
    raise exception 'Une course porte déjà ce nom.';
  end if;

  select * into v_category from public.race_categories
  where code = p_category_code and is_active = true
    and race_format_scope in ('both', p_race_format);
  if v_category.id is null then
    raise exception 'Ce rang de course n’est pas disponible pour ce format.';
  end if;

  for v_stage in
    select value as data, ordinality::integer as stage_number
    from jsonb_array_elements(p_stage_blueprint) with ordinality
  loop
    if length(btrim(coalesce(v_stage.data ->> 'name', ''))) not between 3 and 80 then
      raise exception 'Chaque étape doit posséder un nom valide.';
    end if;
    v_stage_type := v_stage.data ->> 'stageType';
    v_profile := v_stage.data ->> 'profileType';
    if v_stage_type not in (
      'road', 'individual_time_trial', 'team_time_trial', 'prologue'
    ) or v_profile not in (
      'flat', 'sprint', 'hilly', 'mountain', 'cobbles', 'time_trial', 'mixed'
    ) then
      raise exception 'Le type ou le profil d’une étape est invalide.';
    end if;
    if (v_stage_type = 'road' and v_profile = 'time_trial')
      or (v_stage_type <> 'road' and v_profile <> 'time_trial') then
      raise exception 'Le type d’étape et son profil ne correspondent pas.';
    end if;
    if jsonb_typeof(v_stage.data -> 'segments') <> 'array' then
      raise exception 'Les tronçons d’une étape sont invalides.';
    end if;
    v_segment_count := jsonb_array_length(v_stage.data -> 'segments');
    if v_segment_count not between 1 and 12 then
      raise exception 'Une étape doit compter de 1 à 12 tronçons.';
    end if;
    v_stage_distance := 0;
    for v_segment in
      select value as data, ordinality::integer as segment_number
      from jsonb_array_elements(v_stage.data -> 'segments') with ordinality
    loop
      v_terrain := v_segment.data ->> 'terrainType';
      v_gradient := (v_segment.data ->> 'averageGradientPct')::numeric;
      if (v_segment.data ->> 'distanceKm')::numeric not between 2 and 250
        or (v_segment.data ->> 'surfaceType') not in ('asphalt', 'cobbles')
        or v_terrain not in ('flat', 'climb', 'descent')
        or v_gradient not between -30 and 30
        or (v_terrain = 'flat' and v_gradient <> 0)
        or (v_terrain = 'climb' and v_gradient <= 0)
        or (v_terrain = 'descent' and v_gradient >= 0) then
        raise exception 'Un tronçon contient une distance, un relief ou une pente invalide.';
      end if;
      v_stage_distance := v_stage_distance
        + (v_segment.data ->> 'distanceKm')::numeric;
    end loop;
    if v_stage_distance not between 5 and 350
      or (v_stage_type = 'prologue' and v_stage_distance > 30) then
      raise exception 'La distance totale d’une étape est invalide.';
    end if;
  end loop;

  select public.ensure_transfer_next_season(v_season.id)
  into v_target_season_id;
  select * into v_target_season from public.seasons
  where id = v_target_season_id;
  if v_target_season.id is null
    or v_target_season.game_year <> v_season.game_year + 1
    or v_target_season.status <> 'planned' then
    raise exception 'La saison suivante n’est pas prête à recevoir cette course.';
  end if;

  v_slug := 'federation-' || lower(upper(btrim(p_country_code)))
    || '-s' || v_target_season.game_year::text || '-'
    || substr(replace(v_race_id::text, '-', ''), 1, 10);
  insert into public.races (
    id, country_id, name, short_name, race_format, status, slug,
    competition_type, is_monument, is_grand_tour
  ) values (
    v_race_id, v_identity.country_id, btrim(p_name), upper(btrim(p_short_name)),
    p_race_format, 'active', v_slug, 'standard', false, false
  );

  insert into public.race_editions (
    id, race_id, season_id, race_category_id, edition_number, display_name,
    status, minimum_reputation, registration_policy, field_limit
  ) values (
    v_edition_id, v_race_id, v_target_season.id, v_category.id, 1,
    btrim(p_name), 'registration_open',
    case when p_category_code in ('national', 'regional') then 0 else null end,
    case when p_category_code in ('national', 'regional') then 'open'
      else 'criteria_pending' end,
    case when p_category_code = 'regional' then 16 else 24 end
  );

  for v_stage in
    select value as data, ordinality::integer as stage_number
    from jsonb_array_elements(p_stage_blueprint) with ordinality
  loop
    v_slot_index := (p_start_day_number - 1) * 2
      + case p_start_day_slot when 'late' then 1 else 0 end
      + v_stage.stage_number - 1;
    v_day_number := floor(v_slot_index / 2.0)::integer + 1;
    v_day_slot := case mod(v_slot_index, 2) when 0 then 'early' else 'late' end;
    select sum((segment.value ->> 'distanceKm')::numeric)
    into v_stage_distance
    from jsonb_array_elements(v_stage.data -> 'segments') as segment(value);

    v_stage_id := null;
    insert into public.stages (
      race_edition_id, season_day_id, stage_number, name, stage_type,
      distance_km, status, departure_at, profile_type, day_slot
    )
    select
      v_edition_id, season_day.id, v_stage.stage_number,
      btrim(v_stage.data ->> 'name'), v_stage.data ->> 'stageType',
      v_stage_distance, 'planned',
      (
        season_day.calendar_date::timestamp
        + case v_day_slot when 'early' then time '14:00' else time '18:00' end
      ) at time zone 'Europe/Paris',
      v_stage.data ->> 'profileType', v_day_slot
    from public.season_days as season_day
    where season_day.season_id = v_target_season.id
      and season_day.day_number = v_day_number
    returning id, departure_at into v_stage_id, v_first_departure;

    if v_stage_id is null then
      raise exception 'La journée J% est absente de la saison suivante.', v_day_number;
    end if;
    if v_stage.stage_number = 1 then
      update public.race_editions
      set registration_closes_at = v_first_departure - interval '8 hours',
          withdrawal_closes_at = v_first_departure - interval '8 hours'
      where id = v_edition_id;
    end if;

    insert into public.stage_segments (
      stage_id, segment_number, distance_km, terrain_type,
      surface_type, average_gradient_pct
    )
    select
      v_stage_id, segment.ordinality::integer,
      (segment.value ->> 'distanceKm')::numeric,
      segment.value ->> 'terrainType',
      segment.value ->> 'surfaceType',
      (segment.value ->> 'averageGradientPct')::numeric
    from jsonb_array_elements(v_stage.data -> 'segments')
      with ordinality as segment(value, ordinality);
  end loop;

  insert into public.national_federation_race_projects (
    id, country_id, submitted_season_id, activation_game_year,
    race_id, race_category_id, submitted_by_director_id,
    name, short_name, race_format, category_code,
    start_day_number, start_day_slot, stage_blueprint, score_snapshot
  ) values (
    v_project_id, v_identity.country_id, v_season.id,
    v_target_season.game_year, v_race_id, v_category.id,
    v_identity.sporting_director_id, btrim(p_name),
    upper(btrim(p_short_name)), p_race_format, p_category_code,
    p_start_day_number, p_start_day_slot, p_stage_blueprint, v_score
  );

  insert into public.national_federation_journal_entries (
    country_id, season_id, day_number, category, title, detail, source_reference
  ) values (
    v_identity.country_id, v_season.id, v_season.current_day_number,
    'governance', 'Course fédérale homologuée',
    btrim(p_name) || ' · ' || case p_race_format
      when 'one_day' then 'classique' else 'tour' end
      || ' ' || p_category_code || ' · calendrier S'
      || v_target_season.game_year::text || '.',
    'federation-race:' || v_project_id::text
  );

  return v_project_id;
end;
$$;

create or replace function public.activate_scheduled_national_federation_races()
returns trigger
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if new.status = 'active' and old.status is distinct from 'active' then
    update public.national_federation_race_projects
    set status = 'active', activated_at = now(), updated_at = now()
    where activation_game_year = new.game_year and status = 'scheduled';
  end if;
  return new;
end;
$$;

create trigger activate_scheduled_national_federation_races
after update of status on public.seasons
for each row execute function public.activate_scheduled_national_federation_races();

revoke all on function public.get_national_federation_race_creation_score(uuid, uuid)
  from public, anon;
grant execute on function public.get_national_federation_race_creation_score(uuid, uuid)
  to authenticated, service_role;
revoke all on function public.create_national_federation_race(
  text, text, text, text, text, integer, text, jsonb
) from public, anon;
grant execute on function public.create_national_federation_race(
  text, text, text, text, text, integer, text, jsonb
) to authenticated, service_role;
revoke all on function public.activate_scheduled_national_federation_races()
  from public, anon, authenticated;

comment on table public.national_federation_race_projects is
  'Homologations exceptionnelles décidées en S4 ou après et matérialisées au calendrier de la saison suivante.';
comment on function public.get_national_federation_race_creation_score(uuid, uuid) is
  'Indice sur 100 : classement national, cinq objectifs fédéraux et pénalité liée aux courses existantes.';
comment on function public.create_national_federation_race(
  text, text, text, text, text, integer, text, jsonb
) is
  'Valide le président, le Bureau d’organisation et le score avant de créer une course standard non-Elite pour la saison suivante.';

notify pgrst, 'reload schema';

commit;
