begin;

-- Les CM et CC juniors restent simulés par le moteur de la relève, mais leur
-- start-list appartient désormais à la fédération et non aux DevTeams.
alter table public.development_race_editions
  drop constraint if exists development_race_editions_competition_type_allowed;
alter table public.development_race_editions
  add constraint development_race_editions_competition_type_allowed
  check (competition_type in (
    'open', 'national_road', 'national_time_trial',
    'continental_road', 'continental_time_trial',
    'world_road', 'world_time_trial', 'nations_cup_junior'
  ));

alter table public.development_race_editions
  add column championship_continent_code text;
alter table public.development_race_editions
  add constraint development_race_editions_championship_continent_allowed
  check (
    championship_continent_code is null
    or championship_continent_code in (
      'africa', 'america', 'asia', 'europe', 'oceania'
    )
  );
alter table public.development_race_editions
  add constraint development_race_editions_championship_continent_shape
  check (
    (
      competition_type in ('continental_road', 'continental_time_trial')
      and championship_continent_code is not null
    )
    or (
      competition_type not in ('continental_road', 'continental_time_trial')
      and championship_continent_code is null
    )
  );

-- Les Mondiaux juniors conservent le créneau international J26 établi par la
-- migration de séparation du calendrier S3. Le pays hôte devient dynamique
-- lorsque la candidature d'accueil de la saison est attribuée.

insert into public.national_federation_selection_slots (
  slot_key, competition_code, label, rider_category, profile_label,
  host_country_code, host_country_name, day_number, rider_limit
)
values (
  'nc-junior-road', 'nations_cup_junior', 'Nations Cup Juniors · Route',
  'junior', 'Route', 'CH', 'Suisse', 24, 6
)
on conflict (slot_key) do update set
  competition_code = excluded.competition_code,
  label = excluded.label,
  rider_category = excluded.rider_category,
  profile_label = excluded.profile_label,
  host_country_code = excluded.host_country_code,
  host_country_name = excluded.host_country_name,
  day_number = excluded.day_number,
  rider_limit = excluded.rider_limit;

create index development_race_editions_continental_idx
  on public.development_race_editions (
    season_id, championship_continent_code, competition_type
  )
  where championship_continent_code is not null;

create table public.national_federation_junior_race_registrations (
  id uuid primary key default gen_random_uuid(),
  selection_list_id uuid not null unique
    references public.national_federation_selection_lists(id) on delete cascade,
  race_edition_id uuid not null
    references public.development_race_editions(id) on delete cascade,
  country_id uuid not null references public.countries(id) on delete cascade,
  status text not null default 'registered',
  synced_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint national_federation_junior_registration_status_allowed
    check (status in ('registered', 'withdrawn', 'completed')),
  constraint national_federation_junior_registration_unique
    unique (selection_list_id, race_edition_id)
);

create index national_federation_junior_registrations_edition_idx
  on public.national_federation_junior_race_registrations (
    race_edition_id, status
  );

create table public.national_federation_junior_race_registration_riders (
  registration_id uuid not null
    references public.national_federation_junior_race_registrations(id)
    on delete cascade,
  academy_rider_id uuid not null
    references public.youth_academy_riders(id) on delete restrict,
  development_team_id uuid
    references public.development_teams(id) on delete set null,
  selected_at timestamptz not null default now(),
  primary key (registration_id, academy_rider_id)
);

alter table public.national_federation_junior_race_registrations
  enable row level security;
alter table public.national_federation_junior_race_registration_riders
  enable row level security;

create policy national_federation_junior_registrations_read_authenticated
on public.national_federation_junior_race_registrations
for select to authenticated using (true);

create policy national_federation_junior_registration_riders_read_authenticated
on public.national_federation_junior_race_registration_riders
for select to authenticated using (true);

grant select on table public.national_federation_junior_race_registrations
  to authenticated;
grant select on table public.national_federation_junior_race_registration_riders
  to authenticated;
grant all on table public.national_federation_junior_race_registrations
  to service_role;
grant all on table public.national_federation_junior_race_registration_riders
  to service_role;

create or replace function public.ensure_federation_junior_championship_calendar(
  p_season_id uuid
)
returns integer
language plpgsql
volatile
security definer
set search_path = ''
set statement_timeout = '10s'
as $$
declare
  v_game_year integer;
  v_inserted integer := 0;
  v_row_count integer := 0;
begin
  select season.game_year into v_game_year
  from public.seasons as season
  where season.id = p_season_id;

  if coalesce(v_game_year, 0) < 3 then return 0; end if;

  with hosts (
    continent_code, continent_label, host_code, host_name
  ) as (
    values
      ('africa', 'Afrique', 'MA', 'Marrakech'),
      ('america', 'Amérique', 'CA', 'Québec'),
      ('asia', 'Asie', 'JP', 'Utsunomiya'),
      ('europe', 'Europe', 'NL', 'Limbourg'),
      ('oceania', 'Océanie', 'AU', 'Geelong')
  ), disciplines (
    type_suffix, type_label, competition_type, profile_type,
    selection_minimum, selection_maximum
  ) as (
    values
      ('clm', 'CLM', 'continental_time_trial', 'time_trial', 1, 2),
      ('route', 'Route', 'continental_road', 'hilly', 1, 6)
  )
  insert into public.development_race_editions (
    season_id, slug, name, short_name, location_name, country_code,
    start_day_number, end_day_number, profile_type, race_format,
    is_world_championship, selection_minimum, selection_maximum,
    competition_type, selection_mode, points_scale, reward_pool,
    championship_continent_code
  )
  select
    p_season_id,
    'championnat-continental-junior-' || host.continent_code || '-'
      || discipline.type_suffix,
    'Championnat continental junior ' || host.continent_label || ' — '
      || discipline.type_label,
    'CC junior ' || host.continent_label || ' ' || discipline.type_label,
    host.host_name,
    host.host_code,
    22,
    22,
    discipline.profile_type,
    'one_day',
    false,
    discipline.selection_minimum,
    discipline.selection_maximum,
    discipline.competition_type,
    'automatic',
    'world',
    0,
    host.continent_code
  from hosts as host
  cross join disciplines as discipline
  on conflict (season_id, slug) do update set
    selection_mode = 'automatic',
    competition_type = excluded.competition_type,
    championship_continent_code = excluded.championship_continent_code,
    selection_minimum = excluded.selection_minimum,
    selection_maximum = excluded.selection_maximum,
    reward_pool = 0,
    updated_at = now();
  get diagnostics v_row_count = row_count;
  v_inserted := v_inserted + v_row_count;

  insert into public.development_race_editions (
    season_id, slug, name, short_name, location_name, country_code,
    start_day_number, end_day_number, profile_type, race_format,
    is_world_championship, selection_minimum, selection_maximum,
    competition_type, selection_mode, points_scale, reward_pool,
    championship_continent_code
  ) values (
    p_season_id, 'nations-cup-juniors', 'Nations Cup juniors — Route',
    'Nations Cup juniors', 'Suisse', 'CH', 24, 24, 'hilly', 'one_day',
    false, 1, 6, 'nations_cup_junior', 'automatic', 'world', 0, null
  )
  on conflict (season_id, slug) do update set
    selection_mode = 'automatic',
    competition_type = excluded.competition_type,
    selection_minimum = excluded.selection_minimum,
    selection_maximum = excluded.selection_maximum,
    reward_pool = 0,
    updated_at = now();
  get diagnostics v_row_count = row_count;
  v_inserted := v_inserted + v_row_count;

  update public.development_race_editions
  set selection_mode = 'automatic', updated_at = now()
  where season_id = p_season_id
    and competition_type in ('world_road', 'world_time_trial')
    and selection_mode is distinct from 'automatic';

  insert into public.development_race_stages (
    race_edition_id, stage_number, day_number, name,
    stage_type, profile_type, distance_km
  )
  select
    edition.id,
    1,
    edition.start_day_number,
    edition.name,
    case when edition.competition_type like '%time_trial'
      then 'individual_time_trial' else 'road' end,
    edition.profile_type,
    case when edition.competition_type like '%time_trial'
      then 24 else 132 end
  from public.development_race_editions as edition
  where edition.season_id = p_season_id
    and edition.competition_type in (
      'continental_road', 'continental_time_trial', 'nations_cup_junior'
    )
  on conflict (race_edition_id, stage_number) do update set
    day_number = excluded.day_number,
    name = excluded.name,
    stage_type = excluded.stage_type,
    profile_type = excluded.profile_type,
    distance_km = excluded.distance_km;

  return v_inserted;
end;
$$;

alter function public.ensure_development_race_calendar(uuid)
  rename to ensure_development_race_calendar_pre_federation_juniors;

create or replace function public.ensure_development_race_calendar(
  p_season_id uuid
)
returns integer
language plpgsql
volatile
security definer
set search_path = ''
set statement_timeout = '15s'
as $$
declare
  v_inserted integer;
begin
  v_inserted := public.ensure_development_race_calendar_pre_federation_juniors(
    p_season_id
  );
  return v_inserted
    + public.ensure_federation_junior_championship_calendar(p_season_id);
end;
$$;

create or replace function public.validate_federation_junior_candidate()
returns trigger
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_category text;
  v_country_id uuid;
  v_status text;
begin
  if new.junior_rider_id is null then return new; end if;

  select slot.rider_category, selection_list.country_id
  into v_category, v_country_id
  from public.national_federation_selection_lists as selection_list
  join public.national_federation_selection_slots as slot
    on slot.slot_key = selection_list.slot_key
  where selection_list.id = new.selection_list_id;

  select academy.status into v_status
  from public.youth_academy_riders as academy
  where academy.id = new.junior_rider_id
    and academy.country_id = v_country_id;

  if v_category <> 'junior'
     or coalesce(v_status, '') not in ('active', 'recruited') then
    raise exception
      'Le junior doit encore appartenir à une école de cyclisme de la nation.';
  end if;
  return new;
end;
$$;

create trigger validate_federation_junior_candidate
before insert or update of junior_rider_id, selection_list_id
on public.national_federation_selection_members
for each row execute function public.validate_federation_junior_candidate();

create or replace function public.sync_national_federation_junior_lineup(
  p_selection_list_id uuid
)
returns integer
language plpgsql
volatile
security definer
set search_path = ''
set statement_timeout = '10s'
as $$
declare
  v_list public.national_federation_selection_lists%rowtype;
  v_slot public.national_federation_selection_slots%rowtype;
  v_country public.countries%rowtype;
  v_season public.seasons%rowtype;
  v_competition_type text;
  v_edition_id uuid;
  v_registration_id uuid;
  v_rider_count integer := 0;
begin
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'federation-junior-startlist:' || p_selection_list_id::text,
      0
    )
  );

  select * into v_list
  from public.national_federation_selection_lists
  where id = p_selection_list_id;
  if v_list.id is null then return 0; end if;

  select * into v_slot
  from public.national_federation_selection_slots
  where slot_key = v_list.slot_key;
  if v_slot.rider_category <> 'junior'
     or v_slot.competition_code not in (
       'continental_championship_junior', 'world_championship_junior',
       'nations_cup_junior'
     ) then
    return 0;
  end if;

  select * into v_country from public.countries where id = v_list.country_id;
  select * into v_season from public.seasons where id = v_list.season_id;
  if v_season.game_year < 3 then return 0; end if;

  perform public.ensure_federation_junior_championship_calendar(v_season.id);

  v_competition_type := case
    when v_slot.competition_code = 'nations_cup_junior'
      then 'nations_cup_junior'
    when v_slot.competition_code = 'world_championship_junior'
      and v_slot.profile_label = 'Chrono' then 'world_time_trial'
    when v_slot.competition_code = 'world_championship_junior'
      then 'world_road'
    when v_slot.profile_label = 'Chrono' then 'continental_time_trial'
    else 'continental_road'
  end;

  select edition.id into v_edition_id
  from public.development_race_editions as edition
  where edition.season_id = v_list.season_id
    and edition.competition_type = v_competition_type
    and (
      v_competition_type like 'world_%'
      or v_competition_type = 'nations_cup_junior'
      or edition.championship_continent_code = v_country.continent_code
    )
  order by edition.start_day_number, edition.id
  limit 1;
  if v_edition_id is null then return 0; end if;

  insert into public.national_federation_junior_race_registrations (
    selection_list_id, race_edition_id, country_id, status, synced_at
  ) values (
    v_list.id, v_edition_id, v_list.country_id,
    case when v_list.status in ('pending_confirmation', 'finalized')
      then 'registered' else 'withdrawn' end,
    now()
  )
  on conflict (selection_list_id) do update set
    race_edition_id = excluded.race_edition_id,
    country_id = excluded.country_id,
    status = excluded.status,
    synced_at = now()
  returning id into v_registration_id;

  delete from public.national_federation_junior_race_registration_riders
  where registration_id = v_registration_id;

  if v_list.status in ('pending_confirmation', 'finalized') then
    insert into public.national_federation_junior_race_registration_riders (
      registration_id, academy_rider_id, development_team_id
    )
    select
      v_registration_id,
      academy.id,
      development_membership.development_team_id
    from public.national_federation_selection_members as member
    join public.youth_academy_riders as academy
      on academy.id = member.junior_rider_id
     and academy.country_id = v_list.country_id
     and academy.status in ('active', 'recruited')
    left join lateral (
      select roster.development_team_id
      from public.development_team_roster as roster
      join public.development_teams as development_team
        on development_team.id = roster.development_team_id
       and development_team.season_id = v_list.season_id
       and development_team.status = 'active'
      where roster.academy_rider_id = academy.id
      order by roster.joined_at desc, roster.id desc
      limit 1
    ) as development_membership on true
    where member.selection_list_id = v_list.id
      and member.response_status = 'confirmed'
    order by member.created_at, member.id;
    get diagnostics v_rider_count = row_count;
  end if;

  if v_rider_count = 0 then
    update public.national_federation_junior_race_registrations
    set status = 'withdrawn', synced_at = now()
    where id = v_registration_id;
  end if;

  -- Toute ancienne inscription automatique ou manuelle de DevTeam est retirée
  -- de ce CM/CC/Nations Cup. Les résultats historiques restent intacts.
  update public.development_race_registrations
  set status = 'withdrawn', updated_at = now()
  where race_edition_id = v_edition_id
    and status = 'registered';

  return v_rider_count;
end;
$$;

create or replace function public.sync_federation_junior_lineup_from_list()
returns trigger
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  perform public.sync_national_federation_junior_lineup(new.id);
  return null;
end;
$$;

create trigger sync_federation_junior_lineup_after_list
after insert or update of status, updated_at
on public.national_federation_selection_lists
for each row execute function public.sync_federation_junior_lineup_from_list();

create or replace function public.sync_federation_junior_lineup_from_member()
returns trigger
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    perform public.sync_national_federation_junior_lineup(
      old.selection_list_id
    );
  else
    perform public.sync_national_federation_junior_lineup(
      new.selection_list_id
    );
  end if;
  return null;
end;
$$;

create trigger sync_federation_junior_lineup_after_member
after insert or update of response_status or delete
on public.national_federation_selection_members
for each row execute function public.sync_federation_junior_lineup_from_member();

create or replace function public.block_development_team_championship_entry()
returns trigger
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if exists (
    select 1
    from public.development_race_editions as edition
    join public.seasons as season on season.id = edition.season_id
    where edition.id = new.race_edition_id
      and season.game_year >= 3
      and edition.competition_type in (
        'continental_road', 'continental_time_trial',
        'world_road', 'world_time_trial', 'nations_cup_junior'
      )
  ) then
    raise exception
      'Les inscriptions internationales juniors sont réservées aux fédérations.';
  end if;
  return new;
end;
$$;

create trigger block_development_team_championship_entry
before insert or update of race_edition_id, status
on public.development_race_registrations
for each row
when (new.status = 'registered')
execute function public.block_development_team_championship_entry();

-- L'ancien automatisme fondé exclusivement sur le classement des DevTeams
-- est neutralisé en S3 : le président peut retenir aussi un jeune resté à
-- l'école de cyclisme.
create or replace function public.prepare_development_world_selections(
  p_season_id uuid
)
returns integer
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  update public.development_race_registrations as registration
  set status = 'withdrawn', updated_at = now()
  from public.development_race_editions as edition,
       public.seasons as season
  where edition.id = registration.race_edition_id
    and season.id = edition.season_id
    and edition.season_id = p_season_id
    and season.game_year >= 3
    and edition.competition_type in (
      'continental_road', 'continental_time_trial',
      'world_road', 'world_time_trial', 'nations_cup_junior'
    )
    and registration.status = 'registered';
  return 0;
end;
$$;

alter function public.simulate_development_race(uuid)
  rename to simulate_development_race_pre_federation_juniors;

create or replace function public.simulate_development_race(
  p_race_edition_id uuid
)
returns integer
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_edition public.development_race_editions%rowtype;
  v_result_count integer := 0;
begin
  select * into v_edition
  from public.development_race_editions
  where id = p_race_edition_id;

  if v_edition.id is null then
    raise exception 'Cette épreuve junior est introuvable.';
  end if;
  if v_edition.status in ('completed', 'cancelled') then return 0; end if;
  if v_edition.competition_type not in (
    'continental_road', 'continental_time_trial',
    'world_road', 'world_time_trial', 'nations_cup_junior'
  ) then
    return public.simulate_development_race_pre_federation_juniors(
      p_race_edition_id
    );
  end if;

  perform public.ensure_automatic_federation_junior_lineups(v_edition.id);

  update public.development_race_registrations
  set status = 'withdrawn', updated_at = now()
  where race_edition_id = v_edition.id
    and status = 'registered';

  perform public.simulate_development_race_pre_federation_juniors(
    p_race_edition_id
  );

  -- Le premier passage a fourni le peloton virtuel. Le classement général est
  -- reconstruit après ajout des vrais sélectionnés fédéraux.
  delete from public.development_race_results
  where race_edition_id = v_edition.id
    and result_scope = 'general';

  insert into public.development_race_results (
    race_edition_id, stage_id, result_scope, competitor_key,
    academy_rider_id, development_team_id, rider_name, team_name,
    country_code, rank, elapsed_time_seconds, gap_to_winner_seconds, points
  )
  select
    v_edition.id,
    stage.id,
    'stage',
    'federation-youth:' || academy.id::text,
    academy.id,
    selected.development_team_id,
    academy.first_name || ' ' || academy.last_name,
    country.name,
    country.iso_alpha2,
    1000 + row_number() over (order by academy.id),
    greatest(300, round(
      (stage.distance_km / case
        when stage.stage_type = 'individual_time_trial' then 42
        when stage.profile_type = 'mountain' then 31
        when stage.profile_type = 'cobbles' then 36
        else 39 end) * 3600
      + (8.8 - score.value) * case
        when stage.stage_type = 'individual_time_trial' then 42
        else 68 end
    ))::integer,
    0,
    0
  from public.national_federation_junior_race_registrations as registration
  join public.national_federation_junior_race_registration_riders as selected
    on selected.registration_id = registration.id
  join public.youth_academy_riders as academy
    on academy.id = selected.academy_rider_id
  join public.countries as country on country.id = registration.country_id
  cross join public.development_race_stages as stage
  cross join lateral (
    select (
      case stage.profile_type
        when 'flat' then academy.flat * .34 + academy.sprint * .26
          + academy.acceleration * .18 + academy.endurance * .12
          + academy.resistance * .10
        when 'sprint' then academy.sprint * .34 + academy.acceleration * .24
          + academy.flat * .18 + academy.resistance * .13
          + academy.endurance * .11
        when 'hilly' then academy.hills * .36 + academy.acceleration * .18
          + academy.endurance * .17 + academy.resistance * .14
          + academy.mountain * .10 + academy.sprint * .05
        when 'mountain' then academy.mountain * .42 + academy.recovery * .18
          + academy.endurance * .17 + academy.resistance * .13
          + academy.downhill * .10
        when 'cobbles' then academy.cobbles * .39 + academy.flat * .19
          + academy.resistance * .18 + academy.endurance * .14
          + academy.acceleration * .10
        when 'time_trial' then academy.time_trial * .52 + academy.prologue * .16
          + academy.flat * .14 + academy.endurance * .10
          + academy.resistance * .08
        else academy.hills * .18 + academy.mountain * .16
          + academy.flat * .14 + academy.time_trial * .14
          + academy.endurance * .13 + academy.resistance * .10
          + academy.acceleration * .08 + academy.recovery * .07
      end
      + (public.development_hash_unit(
          v_edition.id::text || ':' || stage.id::text || ':' || academy.id::text
        ) - .5) * .72
    ) as value
  ) as score
  where registration.race_edition_id = v_edition.id
    and registration.status = 'registered'
    and stage.race_edition_id = v_edition.id
  on conflict do nothing;

  -- Les adversaires virtuels portent eux aussi une nation cohérente. Pour un
  -- CC, le tirage reste strictement limité au continent de l'épreuve.
  with virtual_country_mapping as (
    select
      result.id,
      virtual_country.iso_alpha2,
      virtual_country.name
    from public.development_race_results as result
    cross join lateral (
      select country.iso_alpha2, country.name
      from public.countries as country
      where country.is_active = true
        and (
          v_edition.competition_type not in (
            'continental_road', 'continental_time_trial'
          )
          or country.continent_code = v_edition.championship_continent_code
        )
      order by public.development_hash_unit(
        v_edition.id::text || ':' || result.competitor_key || ':'
          || country.id::text
      )
      limit 1
    ) as virtual_country
    where result.race_edition_id = v_edition.id
      and result.result_scope = 'stage'
      and result.competitor_key like 'virtual:%'
  )
  update public.development_race_results as result
  set country_code = mapping.iso_alpha2,
      team_name = mapping.name
  from virtual_country_mapping as mapping
  where result.id = mapping.id;

  update public.development_race_results as result
  set team_name = country.name
  from public.countries as country
  where result.race_edition_id = v_edition.id
    and result.country_code = country.iso_alpha2
    and result.team_name is distinct from country.name;

  update public.development_race_results
  set rank = rank + 10000
  where race_edition_id = v_edition.id
    and result_scope = 'stage';

  with ranked as (
    select
      result.id,
      row_number() over (
        partition by result.stage_id
        order by result.elapsed_time_seconds, result.competitor_key
      )::integer as final_rank,
      min(result.elapsed_time_seconds) over (
        partition by result.stage_id
      )::integer as winner_time
    from public.development_race_results as result
    where result.race_edition_id = v_edition.id
      and result.result_scope = 'stage'
  )
  update public.development_race_results as result
  set
    rank = ranked.final_rank,
    gap_to_winner_seconds = result.elapsed_time_seconds - ranked.winner_time,
    points = public.get_development_result_points(
      v_edition.points_scale,
      v_edition.race_format,
      'stage',
      ranked.final_rank
    )
  from ranked
  where result.id = ranked.id;

  insert into public.development_race_results (
    race_edition_id, result_scope, competitor_key, academy_rider_id,
    development_team_id, rider_name, team_name, country_code, rank,
    elapsed_time_seconds, gap_to_winner_seconds, points
  )
  select
    v_edition.id,
    'general',
    totals.competitor_key,
    totals.academy_rider_id,
    totals.development_team_id,
    totals.rider_name,
    totals.team_name,
    totals.country_code,
    totals.final_rank,
    totals.elapsed_time_seconds,
    totals.elapsed_time_seconds - min(totals.elapsed_time_seconds) over (),
    public.get_development_result_points(
      v_edition.points_scale,
      v_edition.race_format,
      'general',
      totals.final_rank
    )
  from (
    select
      aggregate.*,
      row_number() over (
        order by aggregate.elapsed_time_seconds, aggregate.competitor_key
      )::integer as final_rank
    from (
      select
        result.competitor_key,
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

  update public.national_federation_junior_race_registrations
  set status = 'completed', synced_at = now()
  where race_edition_id = v_edition.id
    and status = 'registered';

  perform public.refresh_development_rankings(v_edition.season_id);
  return v_result_count;
end;
$$;

-- Les dix CC se disputent le même jour. On vide donc les petits lots de deux
-- courses du moteur existant pendant le même passage de maintenance.
alter function public.settle_due_development_races()
  rename to settle_due_development_races_pre_federation_juniors;

create or replace function public.settle_due_development_races()
returns integer
language plpgsql
volatile
security definer
set search_path = ''
set statement_timeout = '50s'
as $$
declare
  v_pass integer;
  v_batch_count integer;
  v_settled_count integer := 0;
begin
  for v_pass in 1..8 loop
    v_batch_count :=
      public.settle_due_development_races_pre_federation_juniors();
    v_settled_count := v_settled_count + v_batch_count;
    exit when v_batch_count = 0;
  end loop;
  return v_settled_count;
end;
$$;

revoke all
on function public.ensure_federation_junior_championship_calendar(uuid)
from public, anon, authenticated;
grant execute
on function public.ensure_federation_junior_championship_calendar(uuid)
to service_role;

revoke all
on function public.sync_national_federation_junior_lineup(uuid)
from public, anon, authenticated;
grant execute
on function public.sync_national_federation_junior_lineup(uuid)
to service_role;

revoke all
on function public.ensure_development_race_calendar(uuid)
from public, anon, authenticated;
grant execute
on function public.ensure_development_race_calendar(uuid)
to service_role;

revoke all
on function public.prepare_development_world_selections(uuid)
from public, anon, authenticated;
grant execute
on function public.prepare_development_world_selections(uuid)
to service_role;

revoke all
on function public.simulate_development_race(uuid)
from public, anon, authenticated;
grant execute
on function public.simulate_development_race(uuid)
to service_role;

revoke all
on function public.settle_due_development_races()
from public, anon, authenticated;
grant execute
on function public.settle_due_development_races()
to service_role;

revoke all
on function public.validate_federation_junior_candidate()
from public, anon, authenticated;
revoke all
on function public.sync_federation_junior_lineup_from_list()
from public, anon, authenticated;
revoke all
on function public.sync_federation_junior_lineup_from_member()
from public, anon, authenticated;
revoke all
on function public.block_development_team_championship_entry()
from public, anon, authenticated;

update public.development_race_registrations as registration
set status = 'withdrawn', updated_at = now()
from public.development_race_editions as edition,
     public.seasons as season
where edition.id = registration.race_edition_id
  and season.id = edition.season_id
  and season.game_year >= 3
  and edition.competition_type in ('world_road', 'world_time_trial')
  and registration.status = 'registered';

select public.ensure_development_race_calendar(season.id)
from public.seasons as season
where season.status in ('active', 'planned');

do $$
declare
  v_list record;
begin
  for v_list in
    select selection_list.id
    from public.national_federation_selection_lists as selection_list
    join public.national_federation_selection_slots as slot
      on slot.slot_key = selection_list.slot_key
    where slot.rider_category = 'junior'
  loop
    perform public.sync_national_federation_junior_lineup(v_list.id);
  end loop;
end;
$$;

notify pgrst, 'reload schema';

commit;
