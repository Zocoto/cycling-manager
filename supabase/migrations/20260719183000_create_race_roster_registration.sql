begin;

-- ============================================================
-- INSCRIPTIONS AVEC COMPOSITION DE COUREURS
-- La composition est validée en une transaction, puis verrouillée.
-- Un retrait complet reste possible jusqu'à H-12 et libère aussitôt
-- les coureurs ainsi que la place de l'équipe.
-- ============================================================

alter table public.race_categories
add column minimum_roster_size smallint,
add column maximum_roster_size smallint;

alter table public.race_categories
add constraint race_categories_roster_sizes_valid
check (
  minimum_roster_size is null
  or maximum_roster_size is null
  or (
    minimum_roster_size > 0
    and maximum_roster_size >= minimum_roster_size
  )
);

update public.race_categories
set
  minimum_roster_size = case code
    when 'elite' then 8
    when 'world' then 6
    when 'continental' then 6
    when 'national' then 5
  end,
  maximum_roster_size = case code
    when 'elite' then 9
    when 'world' then 7
    when 'continental' then 7
    when 'national' then 6
  end
where code in ('elite', 'world', 'continental', 'national');

alter table public.race_editions
add column withdrawal_closes_at timestamptz;

update public.race_editions as edition
set withdrawal_closes_at = first_stage.departure_at - interval '12 hours'
from (
  select
    stage.race_edition_id,
    min(stage.departure_at) as departure_at
  from public.stages as stage
  where stage.departure_at is not null
  group by stage.race_edition_id
) as first_stage
where edition.id = first_stage.race_edition_id;

revoke all
on function public.register_current_team_for_race(uuid)
from authenticated;

drop function public.get_current_team_race_registration(uuid);

create function public.get_current_team_race_registration(
  p_race_edition_id uuid
)
returns table (
  registration_id uuid,
  registration_status text,
  registration_registered_at timestamptz,
  roster_count integer,
  withdrawal_closes_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    registration.id,
    registration.status,
    registration.registered_at,
    count(roster.id)::integer,
    edition.withdrawal_closes_at
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
  left join public.race_rosters as roster
    on roster.race_registration_id = registration.id
   and roster.status in ('selected', 'confirmed')
  where director.auth_user_id = auth.uid()
  group by registration.id, edition.withdrawal_closes_at
  limit 1;
$$;

revoke all
on function public.get_current_team_race_registration(uuid)
from public, anon;

grant execute
on function public.get_current_team_race_registration(uuid)
to authenticated;

create or replace function public.save_current_team_race_roster(
  p_race_edition_id uuid,
  p_rider_ids uuid[]
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
  v_team_id uuid;
  v_team_season_id uuid;
  v_game_year integer;
  v_minimum_roster_size integer;
  v_maximum_roster_size integer;
  v_selected_count integer;
  v_valid_rider_count integer;
  v_registered_team_count integer;
  v_registration public.race_registrations%rowtype;
  v_active_roster_count integer;
  v_rider_id uuid;
  v_conflict record;
begin
  if v_auth_user_id is null then
    raise exception using
      errcode = '42501',
      message = 'Vous devez être connecté pour inscrire une équipe.';
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
  where edition.id = p_race_edition_id
  for update;

  if not found then
    raise exception using
      errcode = 'P0002',
      message = 'Cette édition de course est introuvable.';
  end if;

  select
    category.minimum_roster_size,
    category.maximum_roster_size
  into
    v_minimum_roster_size,
    v_maximum_roster_size
  from public.race_categories as category
  where category.id = v_edition.race_category_id;

  if v_edition.status in ('completed', 'cancelled', 'in_progress')
    or v_edition.registration_policy = 'closed'
  then
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

  if v_edition.registration_closes_at is null
    or now() >= v_edition.registration_closes_at
  then
    raise exception using
      errcode = 'P0001',
      message = 'La limite de huit heures avant le départ est dépassée.';
  end if;

  if v_director.reputation_points < v_edition.minimum_reputation then
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
  join public.seasons as season
    on season.id = team_season.season_id
  where team_season.team_id = v_team_id
    and team_season.season_id = v_edition.season_id
    and team_season.status in ('planned', 'active');

  if not found then
    raise exception using
      errcode = '42501',
      message = 'Votre équipe ne participe pas à cette saison.';
  end if;

  v_selected_count := cardinality(coalesce(p_rider_ids, array[]::uuid[]));

  if v_selected_count <> (
    select count(distinct rider_id)
    from unnest(coalesce(p_rider_ids, array[]::uuid[])) as selected(rider_id)
  ) then
    raise exception using
      errcode = 'P0001',
      message = 'La sélection contient un coureur en double.';
  end if;

  if v_minimum_roster_size is null
    or v_maximum_roster_size is null
    or v_selected_count < v_minimum_roster_size
    or v_selected_count > v_maximum_roster_size
  then
    raise exception using
      errcode = 'P0001',
      message = format(
        'Vous devez sélectionner entre %s et %s coureurs.',
        v_minimum_roster_size,
        v_maximum_roster_size
      );
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
  where rider.id = any(p_rider_ids)
    and rider.status = 'active'
    and start_season.game_year <= v_game_year
    and end_season.game_year >= v_game_year;

  if v_valid_rider_count <> v_selected_count then
    raise exception using
      errcode = '42501',
      message = 'Un coureur sélectionné ne fait pas partie de votre effectif actif.';
  end if;

  for v_rider_id in
    select selected.rider_id
    from unnest(p_rider_ids) as selected(rider_id)
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
    rider.id as rider_id,
    rider.first_name || ' ' || rider.last_name as rider_name,
    other_race.display_name as race_name
  into v_conflict
  from unnest(p_rider_ids) as selected(rider_id)
  join public.riders as rider
    on rider.id = selected.rider_id
  join public.race_rosters as other_roster
    on other_roster.rider_id = rider.id
   and other_roster.status in ('selected', 'confirmed')
  join public.race_registrations as other_registration
    on other_registration.id = other_roster.race_registration_id
   and other_registration.status = 'accepted'
  join public.race_editions as other_edition
    on other_edition.id = other_registration.race_edition_id
   and other_edition.season_id = v_edition.season_id
   and other_edition.id <> v_edition.id
  join public.races as other_race
    on other_race.id = other_edition.race_id
  where exists (
    select 1
    from public.stages as target_stage
    join public.stages as other_stage
      on other_stage.season_day_id = target_stage.season_day_id
     and other_stage.race_edition_id = other_edition.id
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

  if v_registration.id is null or v_registration.status <> 'accepted' then
    if v_edition.field_limit is not null then
      select count(*)
      into v_registered_team_count
      from public.race_registrations as registration
      where registration.race_edition_id = v_edition.id
        and registration.status = 'accepted';

      if v_registered_team_count >= v_edition.field_limit then
        raise exception using
          errcode = 'P0001',
          message = 'Le nombre maximal de 24 équipes inscrites est atteint.';
      end if;
    end if;
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
    status,
    selected_at
  )
  select
    v_registration.id,
    selected.rider_id,
    'confirmed',
    now()
  from unnest(p_rider_ids) as selected(rider_id)
  on conflict (race_registration_id, rider_id)
  do update set
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
on function public.save_current_team_race_roster(uuid, uuid[])
from public, anon;

grant execute
on function public.save_current_team_race_roster(uuid, uuid[])
to authenticated;

create or replace function public.withdraw_current_team_from_race(
  p_race_edition_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_auth_user_id uuid := auth.uid();
  v_edition public.race_editions%rowtype;
  v_registration public.race_registrations%rowtype;
begin
  if v_auth_user_id is null then
    raise exception using
      errcode = '42501',
      message = 'Vous devez être connecté pour retirer une équipe.';
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

  if v_edition.withdrawal_closes_at is null
    or now() >= v_edition.withdrawal_closes_at
  then
    raise exception using
      errcode = 'P0001',
      message = 'Le retrait est fermé à partir de douze heures avant le départ.';
  end if;

  select registration.*
  into v_registration
  from public.sporting_directors as director
  join public.team_manager_assignments as assignment
    on assignment.sporting_director_id = director.id
   and assignment.role = 'general_manager'
   and assignment.status = 'active'
  join public.team_seasons as team_season
    on team_season.team_id = assignment.team_id
   and team_season.season_id = v_edition.season_id
  join public.race_registrations as registration
    on registration.team_season_id = team_season.id
   and registration.race_edition_id = v_edition.id
  where director.auth_user_id = v_auth_user_id
    and registration.status = 'accepted'
  for update of registration;

  if not found then
    raise exception using
      errcode = 'P0001',
      message = 'Aucune inscription active ne peut être retirée.';
  end if;

  update public.race_rosters
  set status = 'withdrawn'
  where race_registration_id = v_registration.id
    and status in ('selected', 'confirmed');

  update public.race_registrations
  set
    status = 'withdrawn',
    decided_at = now()
  where id = v_registration.id;
end;
$$;

revoke all
on function public.withdraw_current_team_from_race(uuid)
from public, anon;

grant execute
on function public.withdraw_current_team_from_race(uuid)
to authenticated;

create or replace function public.get_current_team_race_roster_options(
  p_race_edition_id uuid
)
returns table (
  rider_id uuid,
  first_name text,
  last_name text,
  country_name text,
  country_iso_alpha2 text,
  age integer,
  mountain integer,
  hills integer,
  flat integer,
  time_trial integer,
  cobbles integer,
  sprint integer,
  is_selected boolean,
  is_available boolean,
  conflicting_race_slug text,
  conflicting_race_name text,
  conflicting_start_day integer,
  conflicting_end_day integer
)
language sql
stable
security definer
set search_path = ''
as $$
  with current_context as (
    select
      assignment.team_id,
      edition.season_id,
      season.game_year,
      registration.id as registration_id
    from public.sporting_directors as director
    join public.team_manager_assignments as assignment
      on assignment.sporting_director_id = director.id
     and assignment.role = 'general_manager'
     and assignment.status = 'active'
    join public.race_editions as edition
      on edition.id = p_race_edition_id
    join public.seasons as season
      on season.id = edition.season_id
    left join public.team_seasons as team_season
      on team_season.team_id = assignment.team_id
     and team_season.season_id = edition.season_id
    left join public.race_registrations as registration
      on registration.team_season_id = team_season.id
     and registration.race_edition_id = edition.id
    where director.auth_user_id = auth.uid()
    limit 1
  )
  select
    rider.id,
    rider.first_name,
    rider.last_name,
    country.name,
    country.iso_alpha2,
    rating.age::integer,
    rating.mountain::integer,
    rating.hills::integer,
    rating.flat::integer,
    rating.time_trial::integer,
    rating.cobbles::integer,
    rating.sprint::integer,
    coalesce(current_roster.status in ('selected', 'confirmed'), false),
    conflict.race_slug is null,
    conflict.race_slug,
    conflict.race_name,
    conflict.start_day,
    conflict.end_day
  from current_context as context
  join public.rider_contracts as contract
    on contract.team_id = context.team_id
   and contract.status = 'active'
  join public.seasons as start_season
    on start_season.id = contract.start_season_id
   and start_season.game_year <= context.game_year
  join public.seasons as end_season
    on end_season.id = contract.end_season_id
   and end_season.game_year >= context.game_year
  join public.riders as rider
    on rider.id = contract.rider_id
   and rider.status = 'active'
  join public.countries as country
    on country.id = rider.country_id
  join public.rider_season_ratings as rating
    on rating.rider_id = rider.id
   and rating.season_id = context.season_id
  left join public.race_rosters as current_roster
    on current_roster.race_registration_id = context.registration_id
   and current_roster.rider_id = rider.id
  left join lateral (
    select
      race.slug as race_slug,
      other_edition.display_name as race_name,
      min(other_day.day_number)::integer as start_day,
      max(other_day.day_number)::integer as end_day
    from public.race_rosters as other_roster
    join public.race_registrations as other_registration
      on other_registration.id = other_roster.race_registration_id
     and other_registration.status = 'accepted'
    join public.race_editions as other_edition
      on other_edition.id = other_registration.race_edition_id
     and other_edition.season_id = context.season_id
     and other_edition.id <> p_race_edition_id
    join public.races as race
      on race.id = other_edition.race_id
    join public.stages as other_stage
      on other_stage.race_edition_id = other_edition.id
    join public.season_days as other_day
      on other_day.id = other_stage.season_day_id
    where other_roster.rider_id = rider.id
      and other_roster.status in ('selected', 'confirmed')
      and exists (
        select 1
        from public.stages as target_stage
        where target_stage.race_edition_id = p_race_edition_id
          and target_stage.season_day_id = other_stage.season_day_id
      )
    group by race.slug, other_edition.display_name
    order by min(other_day.day_number)
    limit 1
  ) as conflict on true
  order by rider.last_name, rider.first_name;
$$;

revoke all
on function public.get_current_team_race_roster_options(uuid)
from public, anon;

grant execute
on function public.get_current_team_race_roster_options(uuid)
to authenticated;

create or replace function public.get_race_engaged_riders(
  p_race_edition_id uuid
)
returns table (
  team_id uuid,
  team_name text,
  team_short_name text,
  rider_id uuid,
  rider_first_name text,
  rider_last_name text,
  country_iso_alpha2 text
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    team_season.team_id,
    team_season.display_name,
    team_season.short_name,
    rider.id,
    rider.first_name,
    rider.last_name,
    country.iso_alpha2
  from public.race_registrations as registration
  join public.team_seasons as team_season
    on team_season.id = registration.team_season_id
  join public.race_rosters as roster
    on roster.race_registration_id = registration.id
   and roster.status in ('selected', 'confirmed')
  join public.riders as rider
    on rider.id = roster.rider_id
  join public.countries as country
    on country.id = rider.country_id
  where registration.race_edition_id = p_race_edition_id
    and registration.status = 'accepted'
  order by team_season.display_name, rider.last_name, rider.first_name;
$$;

revoke all
on function public.get_race_engaged_riders(uuid)
from public, anon;

grant execute
on function public.get_race_engaged_riders(uuid)
to authenticated;

create or replace function public.get_current_team_calendar_registrations()
returns table (
  race_edition_id uuid,
  registration_status text,
  roster_count integer
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    registration.race_edition_id,
    registration.status,
    count(roster.id)::integer
  from public.sporting_directors as director
  join public.team_manager_assignments as assignment
    on assignment.sporting_director_id = director.id
   and assignment.role = 'general_manager'
   and assignment.status = 'active'
  join public.team_seasons as team_season
    on team_season.team_id = assignment.team_id
  join public.seasons as season
    on season.id = team_season.season_id
   and season.status = 'active'
  join public.race_registrations as registration
    on registration.team_season_id = team_season.id
  left join public.race_rosters as roster
    on roster.race_registration_id = registration.id
   and roster.status in ('selected', 'confirmed')
  where director.auth_user_id = auth.uid()
  group by registration.id;
$$;

revoke all
on function public.get_current_team_calendar_registrations()
from public, anon;

grant execute
on function public.get_current_team_calendar_registrations()
to authenticated;

drop function public.get_race_past_winners(uuid);

create function public.get_race_past_winners(
  p_race_id uuid
)
returns table (
  game_year integer,
  season_name text,
  final_rank integer,
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
    result.final_rank,
    rider.id,
    rider.first_name,
    rider.last_name,
    team_season.display_name
  from public.race_editions as edition
  join public.seasons as season
    on season.id = edition.season_id
  join public.race_results as result
    on result.race_edition_id = edition.id
   and result.final_rank between 1 and 3
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
  order by season.game_year desc, result.final_rank;
$$;

revoke all
on function public.get_race_past_winners(uuid)
from public, anon;

grant execute
on function public.get_race_past_winners(uuid)
to authenticated;

comment on column public.race_categories.minimum_roster_size is
  'Nombre minimal de coureurs à engager pour une course de cette catégorie.';

comment on column public.race_categories.maximum_roster_size is
  'Nombre maximal de coureurs à engager pour une course de cette catégorie.';

comment on column public.race_editions.withdrawal_closes_at is
  'Date limite de retrait complet et de réinscription, fixée douze heures avant le départ.';

comment on function public.save_current_team_race_roster(uuid, uuid[]) is
  'Valide atomiquement la composition verrouillée de l équipe, sa capacité et les conflits de jours.';

comment on function public.withdraw_current_team_from_race(uuid) is
  'Retire toute l équipe et ses coureurs jusqu à douze heures avant le départ.';

notify pgrst, 'reload schema';

commit;
