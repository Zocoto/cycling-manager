begin;

-- Inscription exceptionnelle demandée par l'administrateur après l'oubli du
-- DS Teton Pointu. Dayo Adegoke, déjà engagé sur le Tour des Hauts Plateaux,
-- est remplacé par Son Hutapea afin de respecter les conflits de créneaux.
do $registration$
declare
  v_director_id constant uuid := '85d06bd7-9ffa-4f56-a604-3a97d4a8dfdc';
  v_team_id constant uuid := '7ba5ff3b-d8cf-46ac-b82b-a53b34fed827';
  v_team_season_id constant uuid := '474a7d8b-cd45-44f7-83b3-10524e61ec0a';
  v_season_id constant uuid := 'afa6551b-3bb4-41a2-b394-0302f4275623';
  v_edition_id constant uuid := '62afe13a-2cad-48c4-9ddf-05a5ecdfbc3b';
  v_rider_ids constant uuid[] := array[
    'd2502834-c99d-45de-93ea-18e6d1708fcf'::uuid, -- Son Hutapea
    '05a86487-e78e-4d61-92c0-74098d36e639'::uuid, -- Erlend Hansen
    '8f849546-b7fa-4730-99c4-2398acfc1d21'::uuid, -- Daniel Kelly
    '057bc040-27bb-4f48-8594-a401da394a2e'::uuid, -- Hazem Abd
    'afb01e9f-919a-4502-93fe-56b0027a42ff'::uuid, -- Hatem Harbi
    '496d06d9-31f8-48d2-8572-cc02605f0f95'::uuid, -- Ilgmars Podzina
    'aaf7d5ee-ebc8-4c12-aa67-09a1073ccc2d'::uuid, -- Kevin Aubame
    'e744d694-3685-4b1f-acdd-56dc2e272783'::uuid  -- Abhinav Rao
  ];
  v_edition public.race_editions%rowtype;
  v_registration_id uuid;
  v_first_departure_at timestamptz;
  v_first_day integer;
  v_last_day integer;
  v_valid_rider_count integer;
  v_registered_team_count integer;
  v_active_roster_count integer;
  v_conflict record;
begin
  if not exists (
    select 1
    from public.sporting_directors as director
    join public.team_manager_assignments as assignment
      on assignment.sporting_director_id = director.id
     and assignment.team_id = v_team_id
     and assignment.role = 'general_manager'
     and assignment.status = 'active'
    where director.id = v_director_id
      and director.username = 'Teton Pointu'
      and director.status = 'active'
  ) then
    raise exception 'Le rattachement actif de Teton Pointu à cette équipe est introuvable.';
  end if;

  if not exists (
    select 1
    from public.team_seasons as team_season
    where team_season.id = v_team_season_id
      and team_season.team_id = v_team_id
      and team_season.season_id = v_season_id
      and team_season.status = 'active'
  ) then
    raise exception 'La saison active d’Atlas Racing Lab est introuvable.';
  end if;

  select edition.*
  into v_edition
  from public.race_editions as edition
  where edition.id = v_edition_id
    and edition.season_id = v_season_id
    and edition.display_name = 'Aurora Borealis Tour'
  for update;

  if not found then
    raise exception 'L’édition active d’Aurora Borealis est introuvable.';
  end if;

  if v_edition.status not in ('planned', 'registration_open')
    or v_edition.registration_policy <> 'open' then
    raise exception 'Aurora Borealis ne peut plus accepter cette inscription.';
  end if;

  select
    min(stage.departure_at),
    min(season_day.day_number),
    max(season_day.day_number)
  into
    v_first_departure_at,
    v_first_day,
    v_last_day
  from public.stages as stage
  join public.season_days as season_day
    on season_day.id = stage.season_day_id
  where stage.race_edition_id = v_edition_id;

  if v_first_departure_at is null or now() >= v_first_departure_at then
    raise exception 'Le départ d’Aurora Borealis a déjà eu lieu.';
  end if;

  select count(distinct rider.id)::integer
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
  join public.seasons as target_season
    on target_season.id = v_season_id
  where rider.id = any(v_rider_ids)
    and rider.status = 'active'
    and start_season.game_year <= target_season.game_year
    and end_season.game_year >= target_season.game_year;

  if v_valid_rider_count <> cardinality(v_rider_ids) then
    raise exception 'Un coureur de la startlist ne fait pas partie de l’effectif actif.';
  end if;

  if exists (
    select 1
    from public.rider_injuries as injury
    where injury.rider_id = any(v_rider_ids)
      and injury.status = 'active'
      and injury.started_at < v_first_departure_at
      and injury.expected_recovery_at > v_first_departure_at
  ) then
    raise exception 'Un coureur de la startlist sera encore blessé au départ.';
  end if;

  if exists (
    select 1
    from public.rider_form_camps as camp
    where camp.rider_id = any(v_rider_ids)
      and camp.season_id = v_season_id
      and camp.status in ('planned', 'active')
      and camp.start_day_number <= v_last_day
      and camp.end_day_number >= v_first_day
  ) then
    raise exception 'Un coureur de la startlist est indisponible à cause d’un stage de forme.';
  end if;

  select
    rider.first_name || ' ' || rider.last_name as rider_name,
    other_edition.display_name as race_name
  into v_conflict
  from unnest(v_rider_ids) as selected(rider_id)
  join public.riders as rider
    on rider.id = selected.rider_id
  join public.race_rosters as other_roster
    on other_roster.rider_id = selected.rider_id
   and other_roster.status in ('selected', 'confirmed')
  join public.race_registrations as other_registration
    on other_registration.id = other_roster.race_registration_id
   and other_registration.status in ('accepted', 'pending')
  join public.race_editions as other_edition
    on other_edition.id = other_registration.race_edition_id
   and other_edition.id <> v_edition_id
  where exists (
    select 1
    from public.stages as target_stage
    join public.stages as other_stage
      on other_stage.race_edition_id = other_edition.id
     and other_stage.season_day_id = target_stage.season_day_id
     and other_stage.day_slot = target_stage.day_slot
    where target_stage.race_edition_id = v_edition_id
  )
  limit 1;

  if found then
    raise exception '% est déjà engagé sur % pendant Aurora Borealis.',
      v_conflict.rider_name,
      v_conflict.race_name;
  end if;

  if not exists (
    select 1
    from public.race_registrations as registration
    where registration.race_edition_id = v_edition_id
      and registration.team_season_id = v_team_season_id
      and registration.status = 'accepted'
  ) then
    select count(*)::integer
    into v_registered_team_count
    from public.race_registrations as registration
    where registration.race_edition_id = v_edition_id
      and registration.status = 'accepted';

    if v_edition.field_limit is not null
      and v_registered_team_count >= v_edition.field_limit then
      raise exception 'Le peloton d’Aurora Borealis est désormais complet.';
    end if;
  end if;

  insert into public.race_registrations (
    race_edition_id,
    team_season_id,
    entry_method,
    status,
    registered_at,
    decided_at
  ) values (
    v_edition_id,
    v_team_season_id,
    'invited',
    'accepted',
    now(),
    now()
  )
  on conflict (race_edition_id, team_season_id)
  do update set
    entry_method = 'invited',
    status = 'accepted',
    registered_at = excluded.registered_at,
    decided_at = excluded.decided_at
  returning id into v_registration_id;

  update public.race_rosters as roster
  set status = 'withdrawn'
  where roster.race_registration_id = v_registration_id
    and roster.status in ('selected', 'confirmed')
    and not (roster.rider_id = any(v_rider_ids));

  insert into public.race_rosters (
    race_registration_id,
    rider_id,
    status,
    selected_at,
    race_role,
    withdrawn_by_injury_id
  )
  select
    v_registration_id,
    selected.rider_id,
    'confirmed',
    now(),
    'auto',
    null
  from unnest(v_rider_ids) as selected(rider_id)
  on conflict (race_registration_id, rider_id)
  do update set
    status = 'confirmed',
    selected_at = excluded.selected_at,
    race_role = 'auto',
    withdrawn_by_injury_id = null;

  select count(*)::integer
  into v_active_roster_count
  from public.race_rosters as roster
  where roster.race_registration_id = v_registration_id
    and roster.status in ('selected', 'confirmed')
    and roster.rider_id = any(v_rider_ids);

  if v_active_roster_count <> cardinality(v_rider_ids) then
    raise exception 'La vérification finale de la startlist a échoué.';
  end if;

  raise notice 'Atlas Racing Lab inscrit sur Aurora Borealis avec % coureurs.',
    v_active_roster_count;
end;
$registration$;

commit;
