begin;

-- ============================================================
-- CHAMPIONNATS NATIONAUX
-- Deux épreuves permanentes par nationalité représentée dans le jeu :
-- contre-la-montre en J8 et route en J9. Elles restent regroupées dans
-- le calendrier derrière les deux temps forts dédiés.
-- ============================================================

alter table public.races
add column competition_type text not null default 'standard';

alter table public.races
add constraint races_competition_type_allowed
check (
  competition_type in (
    'standard',
    'national_road',
    'national_time_trial'
  )
);

create index races_competition_type_idx
  on public.races (competition_type);

create table public.rider_national_championship_titles (
  id uuid primary key default gen_random_uuid(),

  rider_id uuid not null
    references public.riders(id)
    on delete cascade,

  country_id uuid not null
    references public.countries(id)
    on delete restrict,

  season_id uuid not null
    references public.seasons(id)
    on delete cascade,

  race_edition_id uuid not null
    references public.race_editions(id)
    on delete cascade,

  championship_type text not null,
  won_at timestamptz not null default now(),
  relinquished_at timestamptz,
  created_at timestamptz not null default now(),

  constraint rider_national_titles_type_allowed
    check (championship_type in ('road', 'time_trial')),

  constraint rider_national_titles_edition_type_unique
    unique (race_edition_id, championship_type)
);

create unique index rider_national_titles_one_active_per_country_type_idx
  on public.rider_national_championship_titles (
    country_id,
    championship_type
  )
  where relinquished_at is null;

create index rider_national_titles_rider_id_idx
  on public.rider_national_championship_titles (rider_id);

create index rider_national_titles_season_id_idx
  on public.rider_national_championship_titles (season_id);

alter table public.rider_national_championship_titles
enable row level security;

create policy rider_national_titles_select_authenticated
on public.rider_national_championship_titles
for select
to authenticated
using (true);

grant select
on table public.rider_national_championship_titles
to authenticated;

grant all privileges
on table public.rider_national_championship_titles
to service_role;

create or replace function public.ensure_national_championship_editions(
  p_country_id uuid,
  p_season_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_country public.countries%rowtype;
  v_season public.seasons%rowtype;
  v_category_id uuid;
  v_kind text;
  v_race_id uuid;
  v_edition_id uuid;
  v_stage_id uuid;
  v_day_number integer;
  v_day_id uuid;
  v_departure_at timestamptz;
  v_slug text;
  v_name text;
  v_short_name text;
  v_profile_type text;
  v_stage_type text;
  v_distance numeric(6, 2);
begin
  select country.*
  into v_country
  from public.countries as country
  where country.id = p_country_id
    and country.is_active = true;

  if not found then
    return;
  end if;

  select season.*
  into v_season
  from public.seasons as season
  where season.id = p_season_id;

  if not found then
    return;
  end if;

  select category.id
  into v_category_id
  from public.race_categories as category
  where category.code = 'national'
    and category.is_active = true;

  if v_category_id is null then
    raise exception 'La catégorie Nationale est introuvable.';
  end if;

  foreach v_kind in array array['national_time_trial', 'national_road']
  loop
    if v_kind = 'national_time_trial' then
      v_day_number := 8;
      v_slug := 'cn-' || lower(v_country.iso_alpha2) || '-clm';
      v_name := 'Championnat de ' || v_country.name || ' - Contre-la-montre';
      v_short_name := 'CN ' || v_country.iso_alpha2 || ' CLM';
      v_profile_type := 'time_trial';
      v_stage_type := 'individual_time_trial';
      v_distance := 38;
    else
      v_day_number := 9;
      v_slug := 'cn-' || lower(v_country.iso_alpha2) || '-route';
      v_name := 'Championnat de ' || v_country.name || ' - Route';
      v_short_name := 'CN ' || v_country.iso_alpha2;
      v_profile_type := 'hilly';
      v_stage_type := 'road';
      v_distance := 178;
    end if;

    select day.id,
      ((day.calendar_date::timestamp + time '20:00') at time zone 'Europe/Paris')
    into v_day_id, v_departure_at
    from public.season_days as day
    where day.season_id = v_season.id
      and day.day_number = v_day_number;

    if v_day_id is null then
      raise exception 'La journée J% est absente de la saison %.', v_day_number, v_season.name;
    end if;

    insert into public.races (
      country_id,
      name,
      short_name,
      race_format,
      status,
      slug,
      competition_type
    )
    values (
      v_country.id,
      v_name,
      v_short_name,
      'one_day',
      'active',
      v_slug,
      v_kind
    )
    on conflict (slug)
    do update set
      country_id = excluded.country_id,
      name = excluded.name,
      short_name = excluded.short_name,
      race_format = excluded.race_format,
      status = excluded.status,
      competition_type = excluded.competition_type
    returning id into v_race_id;

    insert into public.race_editions (
      race_id,
      season_id,
      race_category_id,
      edition_number,
      display_name,
      status,
      registration_closes_at,
      withdrawal_closes_at,
      minimum_reputation,
      registration_policy,
      field_limit
    )
    values (
      v_race_id,
      v_season.id,
      v_category_id,
      greatest(1, v_season.game_year),
      v_name,
      'registration_open',
      v_departure_at - interval '8 hours',
      v_departure_at - interval '12 hours',
      0,
      'open',
      200
    )
    on conflict (race_id, season_id)
    do update set
      race_category_id = excluded.race_category_id,
      edition_number = excluded.edition_number,
      display_name = excluded.display_name,
      registration_closes_at = excluded.registration_closes_at,
      withdrawal_closes_at = excluded.withdrawal_closes_at,
      minimum_reputation = excluded.minimum_reputation,
      registration_policy = excluded.registration_policy,
      field_limit = excluded.field_limit
    returning id into v_edition_id;

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
    values (
      v_edition_id,
      v_day_id,
      1,
      v_name,
      v_stage_type,
      v_distance,
      'planned',
      v_departure_at,
      v_profile_type
    )
    on conflict (race_edition_id, stage_number)
    do update set
      season_day_id = excluded.season_day_id,
      name = excluded.name,
      stage_type = excluded.stage_type,
      distance_km = excluded.distance_km,
      departure_at = excluded.departure_at,
      profile_type = excluded.profile_type
    returning id into v_stage_id;

    if v_kind = 'national_time_trial' then
      insert into public.stage_segments (
        stage_id,
        segment_number,
        distance_km,
        terrain_type,
        surface_type,
        average_gradient_pct
      )
      values
        (v_stage_id, 1, 10, 'flat', 'asphalt', 0),
        (v_stage_id, 2, 10, 'flat', 'asphalt', 0),
        (v_stage_id, 3, 10, 'flat', 'asphalt', 0),
        (v_stage_id, 4, 8, 'flat', 'asphalt', 0)
      on conflict (stage_id, segment_number)
      do update set
        distance_km = excluded.distance_km,
        terrain_type = excluded.terrain_type,
        surface_type = excluded.surface_type,
        average_gradient_pct = excluded.average_gradient_pct;

      delete from public.stage_segments
      where stage_id = v_stage_id
        and segment_number > 4;
    else
      insert into public.stage_segments (
        stage_id,
        segment_number,
        distance_km,
        terrain_type,
        surface_type,
        average_gradient_pct
      )
      values
        (v_stage_id, 1, 25, 'flat', 'asphalt', 0),
        (v_stage_id, 2, 12, 'climb', 'asphalt', 4.5),
        (v_stage_id, 3, 10, 'descent', 'asphalt', -4),
        (v_stage_id, 4, 30, 'flat', 'asphalt', 0),
        (v_stage_id, 5, 8, 'climb', 'asphalt', 6.5),
        (v_stage_id, 6, 8, 'descent', 'asphalt', -6),
        (v_stage_id, 7, 35, 'flat', 'asphalt', 0),
        (v_stage_id, 8, 12, 'climb', 'asphalt', 5),
        (v_stage_id, 9, 38, 'flat', 'asphalt', 0)
      on conflict (stage_id, segment_number)
      do update set
        distance_km = excluded.distance_km,
        terrain_type = excluded.terrain_type,
        surface_type = excluded.surface_type,
        average_gradient_pct = excluded.average_gradient_pct;

      delete from public.stage_segments
      where stage_id = v_stage_id
        and segment_number > 9;
    end if;
  end loop;
end;
$$;

revoke all
on function public.ensure_national_championship_editions(uuid, uuid)
from public, anon, authenticated;

grant execute
on function public.ensure_national_championship_editions(uuid, uuid)
to service_role;

do $$
declare
  v_country_id uuid;
  v_season_id uuid;
begin
  for v_season_id in
    select season.id
    from public.seasons as season
    where season.status = 'active'
  loop
    for v_country_id in
      select distinct rider.country_id
      from public.riders as rider
    loop
      perform public.ensure_national_championship_editions(
        v_country_id,
        v_season_id
      );
    end loop;
  end loop;
end;
$$;

create or replace function public.ensure_rider_country_national_championships()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_season_id uuid;
begin
  for v_season_id in
    select season.id
    from public.seasons as season
    where season.status = 'active'
  loop
    perform public.ensure_national_championship_editions(
      new.country_id,
      v_season_id
    );
  end loop;

  return new;
end;
$$;

create trigger ensure_rider_country_national_championships
after insert or update of country_id
on public.riders
for each row
execute function public.ensure_rider_country_national_championships();

create or replace function public.ensure_active_season_national_championships()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_country_id uuid;
begin
  if new.status <> 'active' then
    return new;
  end if;

  for v_country_id in
    select distinct rider.country_id
    from public.riders as rider
  loop
    perform public.ensure_national_championship_editions(
      v_country_id,
      new.id
    );
  end loop;

  return new;
end;
$$;

create trigger ensure_active_season_national_championships
after insert or update of status
on public.seasons
for each row
when (new.status = 'active')
execute function public.ensure_active_season_national_championships();

update public.season_events
set href = '/jeu/championnats-nationaux/contre-la-montre'
where event_type = 'national_time_trial_championships';

update public.season_events
set href = '/jeu/championnats-nationaux/route'
where event_type = 'national_road_championships';

-- ============================================================
-- INSCRIPTION SPÉCIFIQUE : 1+ coureur éligible par équipe,
-- 200 coureurs maximum au total et nationalité strictement contrôlée.
-- ============================================================

create or replace function public.save_current_team_competition_roster_with_roles(
  p_race_edition_id uuid,
  p_roster jsonb
)
returns table (
  registration_id uuid,
  registration_status text,
  registered_rider_count integer
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_auth_user_id uuid := auth.uid();
  v_director public.sporting_directors%rowtype;
  v_edition public.race_editions%rowtype;
  v_competition_type text;
  v_country_id uuid;
  v_team_id uuid;
  v_team_season_id uuid;
  v_game_year integer;
  v_rider_ids uuid[];
  v_selected_count integer;
  v_valid_rider_count integer;
  v_registered_rider_count integer;
  v_registration public.race_registrations%rowtype;
  v_active_roster_count integer;
  v_rider_id uuid;
  v_conflict record;
begin
  select race.competition_type
  into v_competition_type
  from public.race_editions as edition
  join public.races as race on race.id = edition.race_id
  where edition.id = p_race_edition_id;

  if v_competition_type is null then
    raise exception using
      errcode = 'P0002',
      message = 'Cette édition de course est introuvable.';
  end if;

  if v_competition_type = 'standard' then
    return query
    select saved.*
    from public.save_current_team_race_roster_with_roles(
      p_race_edition_id,
      p_roster
    ) as saved;
    return;
  end if;

  if v_auth_user_id is null then
    raise exception using
      errcode = '42501',
      message = 'Vous devez être connecté pour inscrire une équipe.';
  end if;

  if p_roster is null
    or jsonb_typeof(p_roster) <> 'array'
    or jsonb_array_length(p_roster) = 0
  then
    raise exception using
      errcode = 'P0001',
      message = 'Sélectionnez au moins un coureur éligible.';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_roster) as entry(value)
    where not (entry.value ->> 'riderId' ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$')
      or coalesce(entry.value ->> 'role', 'auto') not in (
        'auto',
        'leader',
        'sprinter',
        'leadout',
        'free_agent',
        'domestique',
        'mountain_classification'
      )
  ) then
    raise exception using
      errcode = 'P0001',
      message = 'Un coureur ou un rôle transmis est invalide.';
  end if;

  select array_agg((entry.value ->> 'riderId')::uuid order by entry.ordinality)
  into v_rider_ids
  from jsonb_array_elements(p_roster) with ordinality as entry(value, ordinality);

  v_selected_count := cardinality(v_rider_ids);

  if v_selected_count <> (
    select count(distinct selected.rider_id)
    from unnest(v_rider_ids) as selected(rider_id)
  ) then
    raise exception using
      errcode = 'P0001',
      message = 'La sélection contient un coureur en double.';
  end if;

  if (
    select count(*)
    from jsonb_array_elements(p_roster) as entry(value)
    where entry.value ->> 'role' = 'leader'
  ) > 1 or (
    select count(*)
    from jsonb_array_elements(p_roster) as entry(value)
    where entry.value ->> 'role' = 'sprinter'
  ) > 1 then
    raise exception using
      errcode = 'P0001',
      message = 'Un seul leader et un seul sprinteur peuvent être désignés.';
  end if;

  select director.*
  into v_director
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
  join public.races as race on race.id = edition.race_id
  where edition.id = p_race_edition_id
    and race.competition_type in ('national_road', 'national_time_trial')
  for update of edition;

  if not found then
    raise exception using
      errcode = 'P0002',
      message = 'Ce championnat national est introuvable.';
  end if;

  select race.country_id
  into v_country_id
  from public.races as race
  where race.id = v_edition.race_id;

  if v_edition.status in ('completed', 'cancelled', 'in_progress')
    or v_edition.registration_policy <> 'open'
    or v_edition.registration_closes_at is null
    or now() >= v_edition.registration_closes_at
  then
    raise exception using
      errcode = 'P0001',
      message = 'Les inscriptions à ce championnat national sont fermées.';
  end if;

  select assignment.team_id
  into v_team_id
  from public.team_manager_assignments as assignment
  where assignment.sporting_director_id = v_director.id
    and assignment.role = 'general_manager'
    and assignment.status = 'active';

  if not found then
    raise exception using
      errcode = '42501',
      message = 'Vous ne dirigez actuellement aucune équipe.';
  end if;

  select team_season.id, season.game_year
  into v_team_season_id, v_game_year
  from public.team_seasons as team_season
  join public.seasons as season on season.id = team_season.season_id
  where team_season.team_id = v_team_id
    and team_season.season_id = v_edition.season_id
    and team_season.status in ('planned', 'active');

  if not found then
    raise exception using
      errcode = '42501',
      message = 'Votre équipe ne participe pas à cette saison.';
  end if;

  select count(distinct rider.id)
  into v_valid_rider_count
  from public.riders as rider
  join public.rider_contracts as contract
    on contract.rider_id = rider.id
   and contract.team_id = v_team_id
   and contract.status = 'active'
  join public.seasons as start_season
    on start_season.id = contract.start_season_id
  join public.seasons as end_season
    on end_season.id = contract.end_season_id
  where rider.id = any(v_rider_ids)
    and rider.status = 'active'
    and rider.country_id = v_country_id
    and start_season.game_year <= v_game_year
    and end_season.game_year >= v_game_year;

  if v_valid_rider_count <> v_selected_count then
    raise exception using
      errcode = '42501',
      message = 'Seuls les coureurs de la nationalité du championnat peuvent être inscrits.';
  end if;

  for v_rider_id in
    select selected.rider_id
    from unnest(v_rider_ids) as selected(rider_id)
    order by selected.rider_id
  loop
    perform pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended(v_rider_id::text, 0)
    );
  end loop;

  select registration.*
  into v_registration
  from public.race_registrations as registration
  where registration.race_edition_id = v_edition.id
    and registration.team_season_id = v_team_season_id
  for update;

  if found then
    select count(*)
    into v_active_roster_count
    from public.race_rosters as roster
    where roster.race_registration_id = v_registration.id
      and roster.status in ('selected', 'confirmed');

    if v_registration.status = 'accepted'
      and v_active_roster_count > 0
    then
      raise exception using
        errcode = 'P0001',
        message = 'La composition validée n est pas modifiable. Retirez toute l équipe avant H-12 pour vous réinscrire.';
    end if;

    if v_registration.status = 'withdrawn'
      and (
        v_edition.withdrawal_closes_at is null
        or now() >= v_edition.withdrawal_closes_at
      )
    then
      raise exception using
        errcode = 'P0001',
        message = 'La limite de douze heures pour réinscrire l équipe est dépassée.';
    end if;
  end if;

  select
    rider.first_name || ' ' || rider.last_name as rider_name,
    other_race.display_name as race_name
  into v_conflict
  from unnest(v_rider_ids) as selected(rider_id)
  join public.riders as rider on rider.id = selected.rider_id
  join public.race_rosters as other_roster
    on other_roster.rider_id = rider.id
   and other_roster.status in ('selected', 'confirmed')
  join public.race_registrations as other_registration
    on other_registration.id = other_roster.race_registration_id
   and other_registration.status = 'accepted'
  join public.race_editions as other_race
    on other_race.id = other_registration.race_edition_id
   and other_race.season_id = v_edition.season_id
   and other_race.id <> v_edition.id
  where exists (
    select 1
    from public.stages as target_stage
    join public.stages as other_stage
      on other_stage.season_day_id = target_stage.season_day_id
     and other_stage.race_edition_id = other_race.id
    where target_stage.race_edition_id = v_edition.id
  )
  limit 1;

  if found then
    raise exception using
      errcode = 'P0001',
      message = format(
        '%s est déjà engagé sur %s pendant cette course.',
        v_conflict.rider_name,
        v_conflict.race_name
      );
  end if;

  select count(*)
  into v_registered_rider_count
  from public.race_rosters as roster
  join public.race_registrations as registration
    on registration.id = roster.race_registration_id
   and registration.status = 'accepted'
  where registration.race_edition_id = v_edition.id
    and roster.status in ('selected', 'confirmed');

  if v_registered_rider_count + v_selected_count > coalesce(v_edition.field_limit, 200) then
    raise exception using
      errcode = 'P0001',
      message = 'La limite de 200 coureurs engagés est atteinte.';
  end if;

  if v_registration.id is null then
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
    returning * into v_registration;
  else
    update public.race_registrations
    set
      status = 'accepted',
      entry_method = 'requested',
      registered_at = now(),
      decided_at = now()
    where id = v_registration.id
    returning * into v_registration;
  end if;

  update public.race_rosters
  set status = 'withdrawn'
  where race_registration_id = v_registration.id;

  insert into public.race_rosters (
    race_registration_id,
    rider_id,
    race_role,
    status,
    selected_at
  )
  select
    v_registration.id,
    (entry.value ->> 'riderId')::uuid,
    coalesce(entry.value ->> 'role', 'auto'),
    'confirmed',
    now()
  from jsonb_array_elements(p_roster) as entry(value)
  on conflict (race_registration_id, rider_id)
  do update set
    race_role = excluded.race_role,
    status = 'confirmed',
    selected_at = excluded.selected_at;

  return query
  select
    v_registration.id,
    v_registration.status,
    v_selected_count;
end;
$$;

revoke all
on function public.save_current_team_competition_roster_with_roles(uuid, jsonb)
from public, anon;

grant execute
on function public.save_current_team_competition_roster_with_roles(uuid, jsonb)
to authenticated;

-- ============================================================
-- TITRE : le vainqueur remplace automatiquement le champion en titre.
-- Les lignes historiques restent conservées pour le palmarès du coureur.
-- ============================================================

create or replace function public.assign_national_championship_title()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rider_id uuid;
  v_country_id uuid;
  v_season_id uuid;
  v_competition_type text;
  v_championship_type text;
begin
  if new.status <> 'classified' or new.final_rank <> 1 then
    return new;
  end if;

  select
    roster.rider_id,
    race.country_id,
    edition.season_id,
    race.competition_type
  into
    v_rider_id,
    v_country_id,
    v_season_id,
    v_competition_type
  from public.race_rosters as roster
  join public.race_editions as edition on edition.id = new.race_edition_id
  join public.races as race on race.id = edition.race_id
  where roster.id = new.race_roster_id;

  if v_competition_type not in ('national_road', 'national_time_trial') then
    return new;
  end if;

  v_championship_type := case
    when v_competition_type = 'national_road' then 'road'
    else 'time_trial'
  end;

  update public.rider_national_championship_titles
  set relinquished_at = coalesce(relinquished_at, now())
  where country_id = v_country_id
    and championship_type = v_championship_type
    and relinquished_at is null
    and (
      rider_id <> v_rider_id
      or race_edition_id <> new.race_edition_id
    );

  insert into public.rider_national_championship_titles (
    rider_id,
    country_id,
    season_id,
    race_edition_id,
    championship_type,
    won_at,
    relinquished_at
  )
  values (
    v_rider_id,
    v_country_id,
    v_season_id,
    new.race_edition_id,
    v_championship_type,
    now(),
    null
  )
  on conflict (race_edition_id, championship_type)
  do update set
    rider_id = excluded.rider_id,
    country_id = excluded.country_id,
    season_id = excluded.season_id,
    won_at = excluded.won_at,
    relinquished_at = null;

  return new;
end;
$$;

create trigger assign_national_championship_title
after insert or update of status, final_rank
on public.race_results
for each row
execute function public.assign_national_championship_title();

commit;
