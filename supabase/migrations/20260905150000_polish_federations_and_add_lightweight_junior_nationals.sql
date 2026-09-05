begin;

-- ============================================================
-- AFFILIATION NATIONALE DES STRUCTURES AMATEURS
-- ============================================================

create table public.team_national_affiliation_changes (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  season_id uuid not null references public.seasons(id) on delete cascade,
  previous_country_id uuid not null references public.countries(id) on delete restrict,
  new_country_id uuid not null references public.countries(id) on delete restrict,
  changed_by uuid not null references public.sporting_directors(id) on delete restrict,
  changed_at timestamptz not null default now(),
  constraint team_national_affiliation_change_distinct
    check (previous_country_id <> new_country_id),
  constraint team_national_affiliation_change_once_per_season
    unique (team_id, season_id)
);

create index team_national_affiliation_changes_country_idx
  on public.team_national_affiliation_changes (new_country_id, season_id);

alter table public.team_national_affiliation_changes enable row level security;

create policy team_national_affiliation_changes_read_managed
on public.team_national_affiliation_changes for select to authenticated
using (public.current_user_manages_team(team_id));

grant select on table public.team_national_affiliation_changes to authenticated;
grant all on table public.team_national_affiliation_changes to service_role;

create or replace function public.change_current_amateur_team_national_affiliation(
  p_country_id uuid
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
set statement_timeout = '10s'
as $$
declare
  v_director public.sporting_directors%rowtype;
  v_team public.teams%rowtype;
  v_season public.seasons%rowtype;
  v_team_season public.team_seasons%rowtype;
  v_previous_country public.countries%rowtype;
  v_new_country public.countries%rowtype;
begin
  if (select auth.uid()) is null then
    raise exception 'Vous devez être connecté pour transférer une affiliation.';
  end if;

  select director.* into v_director
  from public.sporting_directors as director
  where director.auth_user_id = (select auth.uid())
    and director.status = 'active'
  limit 1;

  select team.* into v_team
  from public.teams as team
  join public.team_manager_assignments as assignment
    on assignment.team_id = team.id
   and assignment.sporting_director_id = v_director.id
   and assignment.role = 'general_manager'
   and assignment.status = 'active'
  where team.status = 'active'
  limit 1;

  select season.* into v_season
  from public.seasons as season
  where season.status = 'active'
  limit 1;

  if v_director.id is null or v_team.id is null or v_season.id is null then
    raise exception 'Aucune équipe active ne peut être rattachée à votre compte.';
  end if;
  if nullif(btrim(v_team.amateur_name), '') is null then
    raise exception 'Finalisez d’abord l’identité de votre équipe amateur.';
  end if;
  if exists (
    select 1
    from public.team_sponsor_contracts as contract
    where contract.team_id = v_team.id
      and contract.role = 'principal'
      and contract.status in ('active', 'planned')
  ) then
    raise exception 'Le transfert est réservé aux équipes sans sponsor principal signé.';
  end if;

  select country.* into v_new_country
  from public.countries as country
  where country.id = p_country_id
    and country.is_active = true;
  if v_new_country.id is null then
    raise exception 'La fédération sélectionnée est invalide.';
  end if;

  select team_season.* into v_team_season
  from public.team_seasons as team_season
  where team_season.team_id = v_team.id
    and team_season.season_id = v_season.id
    and team_season.status in ('planned', 'active')
  limit 1;
  if v_team_season.id is null then
    raise exception 'La saison sportive de votre équipe est introuvable.';
  end if;
  if v_team_season.registration_country_id = v_new_country.id
     and v_team.home_country_id = v_new_country.id then
    raise exception 'Votre équipe est déjà affiliée à cette fédération.';
  end if;

  select country.* into v_previous_country
  from public.countries as country
  where country.id = v_team_season.registration_country_id;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_team.id::text || ':national-affiliation', 0)
  );
  if exists (
    select 1
    from public.team_national_affiliation_changes as change
    where change.team_id = v_team.id
      and change.season_id = v_season.id
  ) then
    raise exception 'Le transfert d’affiliation a déjà été utilisé cette saison.';
  end if;

  update public.teams
  set home_country_id = v_new_country.id
  where id = v_team.id;

  update public.team_seasons
  set registration_country_id = v_new_country.id
  where id = v_team_season.id;

  insert into public.team_national_affiliation_changes (
    team_id, season_id, previous_country_id, new_country_id, changed_by
  ) values (
    v_team.id, v_season.id, v_previous_country.id, v_new_country.id, v_director.id
  );

  insert into public.national_federation_journal_entries (
    country_id, season_id, day_number, category, title, detail,
    source_reference, metadata
  ) values (
    v_new_country.id,
    v_season.id,
    v_season.current_day_number,
    'system',
    'Nouvelle affiliation amateur',
    coalesce(v_team.amateur_name, v_team.internal_name) ||
      ' rejoint durablement la fédération de ' || v_new_country.name || '.',
    'team-affiliation-change:' || v_team.id::text || ':' || v_season.id::text,
    jsonb_build_object(
      'teamId', v_team.id,
      'previousCountryId', v_previous_country.id,
      'newCountryId', v_new_country.id
    )
  ) on conflict (source_reference) do nothing;

  return jsonb_build_object(
    'teamId', v_team.id,
    'countryId', v_new_country.id,
    'countryCode', v_new_country.iso_alpha2,
    'countryName', v_new_country.name
  );
end;
$$;

revoke all on function public.change_current_amateur_team_national_affiliation(uuid)
  from public, anon;
grant execute on function public.change_current_amateur_team_national_affiliation(uuid)
  to authenticated, service_role;

-- ============================================================
-- GOUVERNANCE ET MAILLOTS : FIN DU BRIDAGE BÊTA BELGE
-- ============================================================

do $migration$
declare
  v_definition text;
begin
  select pg_catalog.pg_get_functiondef(
    'public.settle_due_federation_elections()'::regprocedure
  ) into v_definition;
  v_definition := replace(
    v_definition,
    'on country.id = team_season.registration_country_id' || chr(10) ||
      '       and country.iso_alpha2 = ''BE''' || chr(10) ||
      '       and country.is_active = true',
    'on country.id = team_season.registration_country_id' || chr(10) ||
      '       and country.is_active = true'
  );
  if position('country.iso_alpha2 = ''BE''' in v_definition) > 0 then
    raise exception 'Le bridage belge subsiste dans settle_due_federation_elections.';
  end if;
  execute v_definition;

  select pg_catalog.pg_get_functiondef(
    'public.submit_national_federation_candidacy(text,text)'::regprocedure
  ) into v_definition;
  v_definition := replace(
    v_definition,
    'upper(btrim(coalesce(p_country_code, ''''))) <> ''BE''',
    'false'
  );
  if position('<> ''BE''' in v_definition) > 0 then
    raise exception 'Le bridage belge subsiste dans submit_national_federation_candidacy.';
  end if;
  execute v_definition;

  select pg_catalog.pg_get_functiondef(
    'public.vote_national_federation_president(text,uuid)'::regprocedure
  ) into v_definition;
  v_definition := replace(
    v_definition,
    'upper(btrim(coalesce(p_country_code, ''''))) <> ''BE''',
    'false'
  );
  if position('<> ''BE''' in v_definition) > 0 then
    raise exception 'Le bridage belge subsiste dans vote_national_federation_president.';
  end if;
  execute v_definition;

  select pg_catalog.pg_get_functiondef(
    'public.publish_national_federation_jersey(text,jsonb)'::regprocedure
  ) into v_definition;
  v_definition := replace(
    v_definition,
    'upper(btrim(coalesce(p_country_code, ''''))) <> ''BE''',
    'false'
  );
  if position('<> ''BE''' in v_definition) > 0 then
    raise exception 'Le bridage belge subsiste dans publish_national_federation_jersey.';
  end if;
  execute v_definition;
end;
$migration$;

-- Ouvre immédiatement les élections qui auraient dû l’être avant ce correctif.
select public.settle_due_federation_elections();

-- ============================================================
-- CHAMPIONNATS NATIONAUX JUNIORS LÉGERS
-- Une passe SQL unique, déterministe et idempotente remplace le moteur complet.
-- ============================================================

alter table public.development_race_editions
  drop constraint development_race_editions_days_valid;
alter table public.development_race_editions
  add constraint development_race_editions_days_valid check (
    start_day_number between 7 and 28
    and end_day_number between start_day_number and 28
  );

alter table public.development_race_stages
  drop constraint development_race_stages_day_range;
alter table public.development_race_stages
  add constraint development_race_stages_day_range
    check (day_number between 7 and 28);

create or replace function public.refresh_development_rankings_after_race()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if old.status is distinct from 'completed' and new.status = 'completed'
     and coalesce(current_setting('app.skip_development_ranking_refresh', true), 'false') <> 'true'
  then
    perform public.refresh_development_rankings(new.season_id);
  end if;
  return new;
end;
$$;

create or replace function public.settle_due_lightweight_junior_national_championships()
returns jsonb
language plpgsql
volatile
security definer
set search_path = public, pg_temp
set statement_timeout = '30s'
as $$
declare
  v_season public.seasons%rowtype;
  v_result_count integer := 0;
  v_edition_count integer := 0;
begin
  if not pg_try_advisory_xact_lock(
    hashtextextended('lightweight-junior-national-championships', 0)
  ) then
    return jsonb_build_object('editions', 0, 'results', 0, 'locked', true);
  end if;

  select * into v_season
  from public.seasons
  where status = 'active'
  limit 1;
  if v_season.id is null
     or v_season.game_year < 3
     or coalesce(v_season.current_day_number, 1) < 7
  then
    return jsonb_build_object('editions', 0, 'results', 0);
  end if;

  insert into public.development_race_editions (
    season_id, slug, name, short_name, location_name, country_code,
    start_day_number, end_day_number, profile_type, race_format,
    is_world_championship, selection_minimum, selection_maximum,
    competition_type, selection_mode, points_scale, reward_pool
  )
  select
    v_season.id,
    'championnat-junior-' || lower(country.iso_alpha2) || suffix.slug,
    'Championnat junior ' || country.name || suffix.name,
    'CN junior ' || country.iso_alpha2 || suffix.short_name,
    country.name,
    country.iso_alpha2,
    7,
    7,
    suffix.profile_type,
    'one_day',
    false,
    1,
    6,
    suffix.competition_type,
    'automatic',
    'national',
    0
  from public.countries as country
  cross join (
    values
      ('-clm', ' — CLM', ' CLM', 'time_trial', 'national_time_trial'),
      ('-route', ' — Route', ' Route', 'hilly', 'national_road')
  ) as suffix(slug, name, short_name, profile_type, competition_type)
  where country.is_active = true
  on conflict (season_id, slug) do update set
    start_day_number = 7,
    end_day_number = 7,
    profile_type = excluded.profile_type,
    selection_mode = 'automatic',
    reward_pool = 0
  where public.development_race_editions.status = 'planned';

  update public.development_race_editions
  set start_day_number = 7,
      end_day_number = 7,
      profile_type = case
        when competition_type = 'national_time_trial' then 'time_trial'
        else 'hilly'
      end,
      selection_mode = 'automatic',
      reward_pool = 0
  where season_id = v_season.id
    and competition_type in ('national_road', 'national_time_trial')
    and status = 'planned';

  insert into public.development_race_stages (
    race_edition_id, stage_number, day_number, name, stage_type,
    profile_type, distance_km
  )
  select edition.id, 1, 7, edition.name,
    case when edition.competition_type = 'national_time_trial'
      then 'individual_time_trial' else 'road' end,
    edition.profile_type,
    case when edition.competition_type = 'national_time_trial'
      then 22.0 else 128.0 end
  from public.development_race_editions as edition
  where edition.season_id = v_season.id
    and edition.competition_type in ('national_road', 'national_time_trial')
    and edition.status = 'planned'
  on conflict (race_edition_id, stage_number) do update set
    day_number = 7,
    name = excluded.name,
    stage_type = excluded.stage_type,
    profile_type = excluded.profile_type,
    distance_km = excluded.distance_km;

  create temporary table if not exists pg_temp.lightweight_junior_cn_results (
    race_edition_id uuid not null,
    stage_id uuid not null,
    academy_rider_id uuid not null,
    development_team_id uuid,
    rider_name text not null,
    team_name text not null,
    country_code text not null,
    rank integer not null,
    elapsed_time_seconds integer not null,
    gap_to_winner_seconds integer not null,
    primary key (race_edition_id, academy_rider_id)
  ) on commit drop;
  truncate table pg_temp.lightweight_junior_cn_results;

  insert into pg_temp.lightweight_junior_cn_results
  with candidates as (
    select
      edition.id as race_edition_id,
      stage.id as stage_id,
      academy.id as academy_rider_id,
      development_team.id as development_team_id,
      academy.first_name || ' ' || academy.last_name as rider_name,
      country.name as team_name,
      country.iso_alpha2 as country_code,
      case
        when edition.competition_type = 'national_time_trial' then
          academy.time_trial * .52 + academy.prologue * .16
            + academy.flat * .12 + academy.endurance * .11
            + academy.resistance * .09
        else
          academy.hills * .46 + academy.endurance * .18
            + academy.resistance * .14 + academy.acceleration * .10
            + academy.mountain * .07 + academy.breakaway * .05
      end
      + (public.development_hash_unit(
          edition.id::text || ':' || academy.id::text || ':junior-cn'
        ) - .5) * 1.35 as performance
    from public.development_race_editions as edition
    join public.development_race_stages as stage
      on stage.race_edition_id = edition.id
     and stage.stage_number = 1
    join public.countries as country
      on country.iso_alpha2 = edition.country_code
    join public.youth_academy_riders as academy
      on academy.country_id = country.id
     and academy.status in ('active', 'recruited', 'free_agent')
     and v_season.game_year - academy.birth_game_year between 16 and 18
    left join lateral (
      select development_team.id
      from public.development_teams as development_team
      join public.development_team_roster as roster
        on roster.development_team_id = development_team.id
       and roster.academy_rider_id = academy.id
      where development_team.season_id = v_season.id
      limit 1
    ) as development_team on true
    where edition.season_id = v_season.id
      and edition.status = 'planned'
      and edition.end_day_number <= coalesce(v_season.current_day_number, 1)
      and edition.competition_type in ('national_road', 'national_time_trial')
  ),
  ranked as (
    select candidates.*,
      row_number() over (
        partition by race_edition_id
        order by performance desc, academy_rider_id
      )::integer as final_rank,
      max(performance) over (partition by race_edition_id) as winner_performance
    from candidates
  )
  select
    race_edition_id,
    stage_id,
    academy_rider_id,
    development_team_id,
    rider_name,
    team_name,
    country_code,
    final_rank,
    greatest(1800, round(7600 + (7.5 - performance) * 145))::integer,
    greatest(0, round((winner_performance - performance) * 145))::integer
  from ranked;

  insert into public.development_race_results (
    race_edition_id, stage_id, result_scope, competitor_key,
    academy_rider_id, development_team_id, rider_name, team_name,
    country_code, rank, elapsed_time_seconds, gap_to_winner_seconds, points
  )
  select race_edition_id, stage_id, 'stage',
    'federation-youth:' || academy_rider_id::text,
    academy_rider_id, development_team_id, rider_name, team_name,
    country_code, rank, elapsed_time_seconds, gap_to_winner_seconds, 0
  from pg_temp.lightweight_junior_cn_results
  on conflict do nothing;

  insert into public.development_race_results (
    race_edition_id, result_scope, competitor_key,
    academy_rider_id, development_team_id, rider_name, team_name,
    country_code, rank, elapsed_time_seconds, gap_to_winner_seconds, points
  )
  select race_edition_id, 'general',
    'federation-youth:' || academy_rider_id::text,
    academy_rider_id, development_team_id, rider_name, team_name,
    country_code, rank, elapsed_time_seconds, gap_to_winner_seconds, 0
  from pg_temp.lightweight_junior_cn_results
  on conflict do nothing;
  get diagnostics v_result_count = row_count;

  perform set_config('app.skip_development_ranking_refresh', 'true', true);
  update public.development_race_editions as edition
  set status = 'completed', simulated_at = now()
  where edition.season_id = v_season.id
    and edition.status = 'planned'
    and edition.competition_type in ('national_road', 'national_time_trial')
    and exists (
      select 1
      from pg_temp.lightweight_junior_cn_results as result
      where result.race_edition_id = edition.id
    );
  get diagnostics v_edition_count = row_count;

  update public.development_race_editions as edition
  set status = 'cancelled', simulated_at = now()
  where edition.season_id = v_season.id
    and edition.status = 'planned'
    and edition.competition_type in ('national_road', 'national_time_trial')
    and edition.end_day_number <= coalesce(v_season.current_day_number, 1)
    and not exists (
      select 1
      from pg_temp.lightweight_junior_cn_results as result
      where result.race_edition_id = edition.id
    );

  if v_edition_count > 0 then
    perform public.refresh_development_rankings(v_season.id);
  end if;

  return jsonb_build_object(
    'editions', v_edition_count,
    'results', v_result_count
  );
end;
$$;

revoke all on function public.settle_due_lightweight_junior_national_championships()
  from public, anon, authenticated;
grant execute on function public.settle_due_lightweight_junior_national_championships()
  to service_role;

select public.settle_due_lightweight_junior_national_championships();

comment on function public.change_current_amateur_team_national_affiliation(uuid) is
  'Transfère une fois par saison le pays fondateur et sportif d’une équipe sans sponsor principal.';
comment on function public.settle_due_lightweight_junior_national_championships() is
  'Simule en une passe SQL les CN juniors route et CLM à J7, avec dominante vallons et aléa déterministe.';

notify pgrst, 'reload schema';

commit;
