begin;

-- ---------------------------------------------------------------------------
-- Centre tactique : catalogue de construction d'équipe, réservé à la S3.
-- ---------------------------------------------------------------------------

alter table public.team_infrastructures
  drop constraint if exists team_infrastructures_code_allowed,
  drop constraint if exists team_infrastructures_level_range;

alter table public.team_infrastructures
  add constraint team_infrastructures_code_allowed check (infrastructure_code in (
    'recruitment_data_room', 'staff_academy', 'training_center',
    'fan_club_headquarters', 'club_shop', 'indoor_track',
    'cryotherapy_center', 'wind_tunnel', 'research_lab',
    'international_welcome_center', 'weather_center', 'tactical_center',
    'media_center'
  )),
  add constraint team_infrastructures_level_range check (
    (infrastructure_code = 'recruitment_data_room' and level between 1 and 3)
    or (infrastructure_code = 'research_lab' and level between 1 and 7)
    or (infrastructure_code not in ('recruitment_data_room', 'research_lab')
        and level between 1 and 5)
  );

alter table public.infrastructure_projects
  drop constraint if exists infrastructure_projects_code_allowed,
  drop constraint if exists infrastructure_projects_country_shape,
  drop constraint if exists infrastructure_projects_target_level_range;

alter table public.infrastructure_projects
  add constraint infrastructure_projects_code_allowed check (infrastructure_code in (
    'recruitment_data_room', 'staff_academy', 'training_center',
    'fan_club_headquarters', 'club_shop', 'international_youth_center',
    'indoor_track', 'cryotherapy_center', 'wind_tunnel', 'research_lab',
    'international_welcome_center', 'weather_center', 'tactical_center',
    'media_center'
  )),
  add constraint infrastructure_projects_country_shape check (
    (infrastructure_code = 'international_youth_center' and country_id is not null)
    or (infrastructure_code <> 'international_youth_center' and country_id is null)
  ),
  add constraint infrastructure_projects_target_level_range check (
    (infrastructure_code = 'recruitment_data_room' and target_level between 1 and 3)
    or (infrastructure_code = 'research_lab' and target_level between 1 and 7)
    or (infrastructure_code = 'international_youth_center' and target_level between 1 and 5)
    or (infrastructure_code not in ('recruitment_data_room', 'research_lab', 'international_youth_center')
        and target_level between 1 and 5)
  );

create or replace function public.get_team_infrastructure_base_duration_days(
  p_infrastructure_code text,
  p_target_level integer
)
returns integer
language plpgsql
immutable
strict
set search_path = ''
as $$
declare
  v_durations integer[];
begin
  case p_infrastructure_code
    when 'recruitment_data_room' then v_durations := array[7, 14, 21];
    when 'staff_academy' then v_durations := array[10, 16, 22, 28, 35];
    when 'training_center' then v_durations := array[5, 9, 14, 20, 28];
    when 'fan_club_headquarters' then v_durations := array[6, 10, 15, 21, 28];
    when 'club_shop' then v_durations := array[5, 9, 14, 20, 26];
    when 'international_youth_center' then v_durations := array[10, 16, 22, 28, 35];
    when 'indoor_track' then v_durations := array[7, 11, 16, 22, 28];
    when 'cryotherapy_center' then v_durations := array[6, 10, 15, 21, 28];
    when 'wind_tunnel' then v_durations := array[9, 14, 20, 27, 35];
    when 'weather_center' then v_durations := array[6, 10, 15, 21, 28];
    when 'tactical_center' then v_durations := array[12, 18, 24, 30, 35];
    when 'media_center' then v_durations := array[9, 14, 20, 27, 35];
    when 'international_welcome_center' then v_durations := array[10, 16, 22, 28, 35];
    when 'research_lab' then v_durations := array[10, 15, 20, 25, 30, 33, 35];
    else raise exception 'Cette infrastructure d’équipe n’existe pas.';
  end case;

  if p_target_level < 1 or p_target_level > cardinality(v_durations) then
    raise exception 'Niveau d’infrastructure d’équipe invalide.';
  end if;

  return v_durations[p_target_level];
end;
$$;

create or replace function public.enforce_tactical_center_s3()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_game_year integer;
begin
  if new.infrastructure_code <> 'tactical_center' then
    return new;
  end if;

  select season.game_year
  into v_game_year
  from public.seasons as season
  where season.id = new.started_season_id;

  if coalesce(v_game_year, 0) < 3 then
    raise exception 'Le Centre tactique ouvre avec la saison 3.';
  end if;

  return new;
end;
$$;

revoke all on function public.enforce_tactical_center_s3()
from public, anon, authenticated;

drop trigger if exists infrastructure_projects_tactical_center_s3_guard
on public.infrastructure_projects;
create trigger infrastructure_projects_tactical_center_s3_guard
before insert or update of infrastructure_code, started_season_id
on public.infrastructure_projects
for each row execute function public.enforce_tactical_center_s3();

-- Étend sans dupliquer les règles financières et architectes du RPC courant.
do $migration$
declare
  v_definition text;
  v_allowlist_needle text := E'    ''weather_center'',\n    ''media_center''';
  v_case_needle text := E'    when ''media_center'' then\n      v_base_cost := 650000;';
begin
  select replace(pg_catalog.pg_get_functiondef(
    'public.start_current_team_infrastructure_project(text,uuid,uuid)'::regprocedure
  ), chr(13), '') into v_definition;

  if position('''tactical_center''' in v_definition) = 0 then
    if position(v_allowlist_needle in v_definition) = 0
      or position(v_case_needle in v_definition) = 0
    then
      raise exception 'Catalogue courant des infrastructures inattendu.';
    end if;

    v_definition := replace(
      v_definition,
      v_allowlist_needle,
      E'    ''weather_center'',\n    ''tactical_center'',\n    ''media_center'''
    );
    v_definition := replace(
      v_definition,
      v_case_needle,
      E'    when ''tactical_center'' then\n'
        || E'      v_base_cost := 3000000;\n'
        || E'      v_base_duration := (array[12,18,24,30,35]::integer[])[v_target_level];\n'
        || E'      v_description := ''Centre tactique'';\n'
        || v_case_needle
    );
    execute v_definition;
  end if;
end;
$migration$;

do $migration$
declare
  v_definition text;
  v_list_needle text := E'        ''international_welcome_center'', ''weather_center'', ''media_center''';
  v_name_needle text := E'      when ''weather_center'' then ''Centre météo''\n      else ''Média Center'' end;';
begin
  select replace(pg_catalog.pg_get_functiondef(
    'public.settle_due_infrastructure_projects()'::regprocedure
  ), chr(13), '') into v_definition;

  if position('''tactical_center''' in v_definition) = 0 then
    if position(v_list_needle in v_definition) = 0
      or position(v_name_needle in v_definition) = 0
    then
      raise exception 'Règlement courant des chantiers inattendu.';
    end if;

    v_definition := replace(
      v_definition,
      v_list_needle,
      E'        ''international_welcome_center'', ''weather_center'', ''tactical_center'', ''media_center'''
    );
    v_definition := replace(
      v_definition,
      v_name_needle,
      E'      when ''weather_center'' then ''Centre météo''\n'
        || E'      when ''tactical_center'' then ''Centre tactique''\n'
        || E'      else ''Média Center'' end;'
    );
    execute v_definition;
  end if;
end;
$migration$;

-- ---------------------------------------------------------------------------
-- Briefing par équipe et par étape. Les affectations sont figées avec le
-- niveau du bâtiment afin que l'entrée officielle reste explicable.
-- ---------------------------------------------------------------------------

create table public.race_stage_tactical_briefings (
  race_registration_id uuid not null references public.race_registrations(id) on delete cascade,
  stage_id uuid not null references public.stages(id) on delete cascade,
  team_id uuid not null references public.teams(id) on delete cascade,
  primary_doctrine text not null check (primary_doctrine in (
    'breakaway_control', 'crosswind_offensive', 'satellite_rider',
    'sprint_train', 'mountain_tempo'
  )),
  primary_rider_ids uuid[] not null,
  backup_doctrine text check (backup_doctrine in (
    'breakaway_control', 'crosswind_offensive', 'satellite_rider',
    'sprint_train', 'mountain_tempo'
  )),
  backup_rider_ids uuid[] not null default '{}',
  center_level_snapshot smallint not null check (center_level_snapshot between 1 and 5),
  updated_at timestamptz not null default now(),

  constraint race_stage_tactical_briefings_pkey
    primary key (race_registration_id, stage_id),
  constraint race_stage_tactical_briefings_backup_shape check (
    (backup_doctrine is null and cardinality(backup_rider_ids) = 0)
    or (backup_doctrine is not null and backup_doctrine <> primary_doctrine)
  )
);

create index race_stage_tactical_briefings_stage_idx
on public.race_stage_tactical_briefings (stage_id, team_id);

alter table public.race_stage_tactical_briefings enable row level security;
revoke all on table public.race_stage_tactical_briefings
from public, anon, authenticated;
grant all privileges on table public.race_stage_tactical_briefings
to service_role;

create or replace function public.save_current_team_tactical_briefing(
  p_race_edition_id uuid,
  p_stage_id uuid,
  p_primary_doctrine text,
  p_primary_rider_ids uuid[],
  p_backup_doctrine text default null,
  p_backup_rider_ids uuid[] default '{}'
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_context record;
  v_primary_count integer;
  v_backup_count integer;
begin
  if auth.uid() is null then
    raise exception 'Vous devez être connecté pour enregistrer un briefing tactique.';
  end if;

  select
    registration.id as registration_id,
    assignment.team_id,
    season.game_year,
    stage.stage_type,
    stage.profile_type,
    stage.status as stage_status,
    stage.departure_at,
    race.competition_type,
    coalesce(infrastructure.level, 0) as center_level
  into v_context
  from public.sporting_directors as director
  join public.team_manager_assignments as assignment
    on assignment.sporting_director_id = director.id
   and assignment.role = 'general_manager'
   and assignment.status = 'active'
  join public.race_editions as edition
    on edition.id = p_race_edition_id
  join public.seasons as season
    on season.id = edition.season_id
   and season.status = 'active'
  join public.team_seasons as team_season
    on team_season.team_id = assignment.team_id
   and team_season.season_id = season.id
  join public.race_registrations as registration
    on registration.team_season_id = team_season.id
   and registration.race_edition_id = edition.id
   and registration.status = 'accepted'
  join public.stages as stage
    on stage.id = p_stage_id
   and stage.race_edition_id = edition.id
  join public.races as race
    on race.id = edition.race_id
  left join public.team_infrastructures as infrastructure
    on infrastructure.team_id = assignment.team_id
   and infrastructure.infrastructure_code = 'tactical_center'
  where director.auth_user_id = auth.uid()
    and director.status = 'active'
  for update of registration, stage;

  if v_context is null then
    raise exception 'Aucune inscription acceptée ne permet de préparer cette étape.';
  end if;
  if v_context.game_year < 3 then
    raise exception 'Le Centre tactique ouvre avec la saison 3.';
  end if;
  if v_context.center_level < 1 then
    raise exception 'Construisez d’abord le Centre tactique.';
  end if;
  if v_context.stage_type <> 'road'
    or v_context.competition_type in ('continental_championship', 'world_championship')
  then
    raise exception 'Ce briefing est réservé aux courses en ligne de club.';
  end if;
  if v_context.stage_status <> 'planned'
    or (v_context.departure_at is not null and v_context.departure_at <= clock_timestamp())
    or exists (
      select 1 from public.official_stage_simulations as simulation
      where simulation.stage_id = p_stage_id
    )
  then
    raise exception 'Cette étape a déjà commencé : le briefing est verrouillé.';
  end if;

  if p_primary_doctrine not in (
    'breakaway_control', 'crosswind_offensive', 'satellite_rider',
    'sprint_train', 'mountain_tempo'
  ) then
    raise exception 'La doctrine principale est invalide.';
  end if;

  if v_context.center_level < (case p_primary_doctrine
    when 'breakaway_control' then 1
    when 'crosswind_offensive' then 2
    else 3
  end) then
    raise exception 'Le niveau du Centre tactique est insuffisant pour cette doctrine.';
  end if;

  if not (
    p_primary_doctrine = 'breakaway_control'
    or (p_primary_doctrine in ('crosswind_offensive', 'sprint_train')
        and v_context.profile_type in ('flat', 'sprint'))
    or (p_primary_doctrine = 'satellite_rider'
        and v_context.profile_type in ('hilly', 'mountain', 'mixed'))
    or (p_primary_doctrine = 'mountain_tempo'
        and v_context.profile_type = 'mountain')
  ) then
    raise exception 'Cette doctrine ne correspond pas au profil de l’étape.';
  end if;

  v_primary_count := case p_primary_doctrine
    when 'breakaway_control' then 2
    when 'crosswind_offensive' then 2
    when 'satellite_rider' then 2
    when 'sprint_train' then 4
    else 3
  end;

  if cardinality(coalesce(p_primary_rider_ids, '{}')) <> v_primary_count
    or (select count(distinct selected.rider_id) from unnest(p_primary_rider_ids) as selected(rider_id)) <> v_primary_count
    or exists (
      select 1
      from unnest(p_primary_rider_ids) as selected(rider_id)
      left join public.race_rosters as roster
        on roster.race_registration_id = v_context.registration_id
       and roster.rider_id = selected.rider_id
       and roster.status in ('selected', 'confirmed')
      where roster.id is null
    )
  then
    raise exception 'Les affectations de la doctrine principale sont invalides.';
  end if;

  if p_backup_doctrine is not null then
    if v_context.center_level < 4 then
      raise exception 'Le plan de repli exige le niveau 4 du Centre tactique.';
    end if;
    if p_backup_doctrine = p_primary_doctrine
      or p_backup_doctrine not in (
        'breakaway_control', 'crosswind_offensive', 'satellite_rider',
        'sprint_train', 'mountain_tempo'
      )
    then
      raise exception 'La doctrine de repli est invalide.';
    end if;
    if v_context.center_level < (case p_backup_doctrine
      when 'breakaway_control' then 1
      when 'crosswind_offensive' then 2
      else 3
    end) then
      raise exception 'Le niveau du Centre tactique est insuffisant pour le plan de repli.';
    end if;
    if not (
      p_backup_doctrine = 'breakaway_control'
      or (p_backup_doctrine in ('crosswind_offensive', 'sprint_train')
          and v_context.profile_type in ('flat', 'sprint'))
      or (p_backup_doctrine = 'satellite_rider'
          and v_context.profile_type in ('hilly', 'mountain', 'mixed'))
      or (p_backup_doctrine = 'mountain_tempo'
          and v_context.profile_type = 'mountain')
    ) then
      raise exception 'Le plan de repli ne correspond pas au profil de l’étape.';
    end if;

    v_backup_count := case p_backup_doctrine
      when 'breakaway_control' then 2
      when 'crosswind_offensive' then 2
      when 'satellite_rider' then 2
      when 'sprint_train' then 4
      else 3
    end;

    if cardinality(coalesce(p_backup_rider_ids, '{}')) <> v_backup_count
      or (select count(distinct selected.rider_id) from unnest(p_backup_rider_ids) as selected(rider_id)) <> v_backup_count
      or exists (
        select 1
        from unnest(p_backup_rider_ids) as selected(rider_id)
        left join public.race_rosters as roster
          on roster.race_registration_id = v_context.registration_id
         and roster.rider_id = selected.rider_id
         and roster.status in ('selected', 'confirmed')
        where roster.id is null
      )
    then
      raise exception 'Les affectations du plan de repli sont invalides.';
    end if;
  elsif cardinality(coalesce(p_backup_rider_ids, '{}')) <> 0 then
    raise exception 'Un plan de repli absent ne peut contenir d’affectation.';
  end if;

  insert into public.race_stage_tactical_briefings (
    race_registration_id,
    stage_id,
    team_id,
    primary_doctrine,
    primary_rider_ids,
    backup_doctrine,
    backup_rider_ids,
    center_level_snapshot,
    updated_at
  ) values (
    v_context.registration_id,
    p_stage_id,
    v_context.team_id,
    p_primary_doctrine,
    p_primary_rider_ids,
    p_backup_doctrine,
    coalesce(p_backup_rider_ids, '{}'),
    v_context.center_level,
    clock_timestamp()
  )
  on conflict (race_registration_id, stage_id) do update set
    team_id = excluded.team_id,
    primary_doctrine = excluded.primary_doctrine,
    primary_rider_ids = excluded.primary_rider_ids,
    backup_doctrine = excluded.backup_doctrine,
    backup_rider_ids = excluded.backup_rider_ids,
    center_level_snapshot = excluded.center_level_snapshot,
    updated_at = excluded.updated_at;

  return p_stage_id;
end;
$$;

revoke all on function public.save_current_team_tactical_briefing(
  uuid, uuid, text, uuid[], text, uuid[]
) from public, anon;
grant execute on function public.save_current_team_tactical_briefing(
  uuid, uuid, text, uuid[], text, uuid[]
) to authenticated, service_role;

create or replace function public.get_team_race_tactical_briefings(
  p_team_id uuid
)
returns table (
  stage_id uuid,
  team_id uuid,
  primary_doctrine text,
  primary_rider_ids uuid[],
  backup_doctrine text,
  backup_rider_ids uuid[],
  center_level_snapshot integer,
  updated_at timestamptz,
  tactical_report jsonb
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    briefing.stage_id,
    briefing.team_id,
    briefing.primary_doctrine,
    briefing.primary_rider_ids,
    briefing.backup_doctrine,
    briefing.backup_rider_ids,
    briefing.center_level_snapshot::integer,
    briefing.updated_at,
    (
      select report.value
      from jsonb_array_elements(
        coalesce(simulation.simulation_data -> 'tacticalReports', '[]'::jsonb)
      ) as report(value)
      where report.value ->> 'teamId' = briefing.team_id::text
      limit 1
    )
  from public.race_stage_tactical_briefings as briefing
  join public.race_registrations as registration
    on registration.id = briefing.race_registration_id
  join public.team_seasons as team_season
    on team_season.id = registration.team_season_id
   and team_season.team_id = p_team_id
  join public.seasons as season
    on season.id = team_season.season_id
   and season.status = 'active'
  left join public.official_stage_simulations as simulation
    on simulation.stage_id = briefing.stage_id
  where briefing.team_id = p_team_id
  order by briefing.updated_at desc;
$$;

revoke all on function public.get_team_race_tactical_briefings(uuid)
from public, anon, authenticated;
grant execute on function public.get_team_race_tactical_briefings(uuid)
to service_role;

comment on table public.race_stage_tactical_briefings is
  'Briefing conditionnel du Centre tactique, figé avant la simulation officielle.';
comment on function public.save_current_team_tactical_briefing(uuid, uuid, text, uuid[], text, uuid[]) is
  'Valide le bâtiment S3, le profil, les niveaux et chaque coureur avant d’enregistrer le briefing.';
comment on function public.get_team_race_tactical_briefings(uuid) is
  'Lecture service-role des briefings actifs avec leur seul débrief extrait du JSON officiel.';

notify pgrst, 'reload schema';

commit;
