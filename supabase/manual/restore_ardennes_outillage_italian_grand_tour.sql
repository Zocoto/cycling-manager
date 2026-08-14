begin;

-- Intervention administrative demandee apres une desinscription accidentelle.
-- La procedure metier officielle reste responsable de tous les controles
-- d'effectif et de conflits. Les delais sont ouverts uniquement dans cette
-- transaction, puis immediatement remis a leur valeur initiale.
do $$
declare
  v_edition_id uuid;
  v_edition_status text;
  v_team_id uuid;
  v_team_season_id uuid;
  v_auth_user_id uuid;
  v_existing_registration_id uuid;
  v_existing_registration_status text;
  v_original_registration_policy text;
  v_original_registration_closes_at timestamptz;
  v_original_withdrawal_closes_at timestamptz;
  v_original_field_limit smallint;
  v_accepted_team_count integer;
  v_rider_ids uuid[] := array[]::uuid[];
  v_matching_rider_ids uuid[];
  v_match_count integer;
  v_requested_rider record;
  v_roster jsonb;
  v_saved_registration_id uuid;
  v_saved_registration_status text;
  v_saved_rider_count integer;
  v_verified_rider_count integer;
  v_verified_rider_ids uuid[];
  v_affected_registration_ids uuid[];
  v_conflicting_registration_id uuid;
  v_conflicting_race_name text;
  v_conflicting_minimum_roster_size integer;
  v_conflicting_active_roster_size integer;
begin
  select
    edition.id,
    edition.status,
    edition.registration_policy,
    edition.registration_closes_at,
    edition.withdrawal_closes_at,
    edition.field_limit
  into strict
    v_edition_id,
    v_edition_status,
    v_original_registration_policy,
    v_original_registration_closes_at,
    v_original_withdrawal_closes_at,
    v_original_field_limit
  from public.race_editions as edition
  join public.races as race
    on race.id = edition.race_id
  join public.seasons as season
    on season.id = edition.season_id
  where race.slug = 'corsa-delle-regioni'
    and season.status = 'active'
  for update of edition;

  if v_edition_status in ('in_progress', 'completed', 'cancelled') then
    raise exception using
      errcode = 'P0001',
      message = 'Le Grand Tour italien a deja commence ou ne peut plus etre inscrit.';
  end if;

  select team_season.team_id, team_season.id
  into strict v_team_id, v_team_season_id
  from public.team_seasons as team_season
  join public.race_editions as edition
    on edition.season_id = team_season.season_id
  where edition.id = v_edition_id
    and lower(btrim(team_season.display_name)) = lower('Ardennes outillage')
    and team_season.status in ('planned', 'active');

  select director.auth_user_id
  into strict v_auth_user_id
  from public.team_manager_assignments as assignment
  join public.sporting_directors as director
    on director.id = assignment.sporting_director_id
  where assignment.team_id = v_team_id
    and assignment.role = 'general_manager'
    and assignment.status = 'active'
    and director.status = 'active'
    and director.auth_user_id is not null;

  select registration.id, registration.status
  into strict v_existing_registration_id, v_existing_registration_status
  from public.race_registrations as registration
  where registration.race_edition_id = v_edition_id
    and registration.team_season_id = v_team_season_id
  for update;

  if v_existing_registration_status <> 'withdrawn' then
    raise exception using
      errcode = 'P0001',
      message = format(
        'L inscription existante d Ardennes outillage est dans l etat %s au lieu de withdrawn.',
        v_existing_registration_status
      );
  end if;

  for v_requested_rider in
    select requested.position, requested.first_name, requested.last_name
    from (
      values
        (1, 'Cédric', 'Fournier'),
        (2, 'Harry', 'Marshall'),
        (3, 'Sébastien', 'Denis'),
        (4, 'Baptiste', 'Martin'),
        (5, 'Daouda', 'Mensah'),
        (6, 'Martin', 'Morel'),
        (7, 'Bart', 'Philippot'),
        (8, 'Armand', 'Zola'),
        (9, 'Abdulhadi', 'Al Hamdi')
    ) as requested(position, first_name, last_name)
    order by requested.position
  loop
    select
      array_agg(distinct rider.id),
      count(distinct rider.id)::integer
    into v_matching_rider_ids, v_match_count
    from public.riders as rider
    join public.rider_contracts as contract
      on contract.rider_id = rider.id
     and contract.team_id = v_team_id
     and contract.status = 'active'
    join public.seasons as start_season
      on start_season.id = contract.start_season_id
    join public.seasons as end_season
      on end_season.id = contract.end_season_id
    join public.race_editions as edition
      on edition.id = v_edition_id
    join public.seasons as race_season
      on race_season.id = edition.season_id
    where regexp_replace(
        lower(btrim(rider.first_name)),
        '[^[:alnum:]]',
        '',
        'g'
      ) = regexp_replace(
        lower(v_requested_rider.first_name),
        '[^[:alnum:]]',
        '',
        'g'
      )
      and regexp_replace(
        lower(btrim(rider.last_name)),
        '[^[:alnum:]]',
        '',
        'g'
      ) = regexp_replace(
        lower(v_requested_rider.last_name),
        '[^[:alnum:]]',
        '',
        'g'
      )
      and rider.status = 'active'
      and start_season.game_year <= race_season.game_year
      and end_season.game_year >= race_season.game_year;

    if v_match_count <> 1 then
      raise exception using
        errcode = 'P0001',
        message = format(
          'Le coureur %s %s correspond a %s contrat(s) actif(s) dans Ardennes outillage.',
          v_requested_rider.first_name,
          v_requested_rider.last_name,
          v_match_count
        );
    end if;

    v_rider_ids := array_append(v_rider_ids, v_matching_rider_ids[1]);
  end loop;

  if cardinality(v_rider_ids) <> 9
    or cardinality(v_rider_ids) <> (
      select count(distinct rider_id)
      from unnest(v_rider_ids) as selected(rider_id)
    )
  then
    raise exception using
      errcode = 'P0001',
      message = 'La selection administrative ne contient pas neuf coureurs distincts.';
  end if;

  select jsonb_agg(
    jsonb_build_object(
      'riderId', selected.rider_id::text,
      'role', 'auto'
    )
    order by selected.ordinality
  )
  into v_roster
  from unnest(v_rider_ids) with ordinality as selected(rider_id, ordinality);

  if exists (
    select 1
    from unnest(v_rider_ids) as selected(rider_id)
    join public.race_rosters as other_roster
      on other_roster.rider_id = selected.rider_id
     and other_roster.status in ('selected', 'confirmed')
    join public.race_registrations as other_registration
      on other_registration.id = other_roster.race_registration_id
     and other_registration.status = 'accepted'
    join public.race_editions as other_edition
      on other_edition.id = other_registration.race_edition_id
     and other_edition.id <> v_edition_id
    where other_registration.team_season_id <> v_team_season_id
      and exists (
        select 1
        from public.stages as target_stage
        join public.stages as other_stage
          on other_stage.season_day_id = target_stage.season_day_id
         and other_stage.race_edition_id = other_edition.id
        where target_stage.race_edition_id = v_edition_id
      )
  ) then
    raise exception using
      errcode = 'P0001',
      message = 'Un coureur est engage par une autre equipe sur une course qui chevauche le Grand Tour italien.';
  end if;

  with conflicting_rosters as (
    select
      other_roster.race_registration_id,
      other_roster.rider_id
    from unnest(v_rider_ids) as selected(rider_id)
    join public.race_rosters as other_roster
      on other_roster.rider_id = selected.rider_id
     and other_roster.status in ('selected', 'confirmed')
    join public.race_registrations as other_registration
      on other_registration.id = other_roster.race_registration_id
     and other_registration.status = 'accepted'
     and other_registration.team_season_id = v_team_season_id
    join public.race_editions as other_edition
      on other_edition.id = other_registration.race_edition_id
     and other_edition.id <> v_edition_id
    where exists (
      select 1
      from public.stages as target_stage
      join public.stages as other_stage
        on other_stage.season_day_id = target_stage.season_day_id
       and other_stage.race_edition_id = other_edition.id
      where target_stage.race_edition_id = v_edition_id
    )
  ), withdrawn_overlaps as (
    update public.race_rosters as roster
    set status = 'withdrawn'
    from conflicting_rosters as conflict
    where roster.race_registration_id = conflict.race_registration_id
      and roster.rider_id = conflict.rider_id
    returning roster.race_registration_id
  )
  select array_agg(distinct withdrawn.race_registration_id)
  into v_affected_registration_ids
  from withdrawn_overlaps as withdrawn;

  for v_conflicting_registration_id in
    select affected.registration_id
    from unnest(
      coalesce(v_affected_registration_ids, array[]::uuid[])
    ) as affected(registration_id)
  loop
    select
      edition.display_name,
      category.minimum_roster_size,
      count(roster.id) filter (
        where roster.status in ('selected', 'confirmed')
      )::integer
    into strict
      v_conflicting_race_name,
      v_conflicting_minimum_roster_size,
      v_conflicting_active_roster_size
    from public.race_registrations as registration
    join public.race_editions as edition
      on edition.id = registration.race_edition_id
    join public.race_categories as category
      on category.id = edition.race_category_id
    left join public.race_rosters as roster
      on roster.race_registration_id = registration.id
    where registration.id = v_conflicting_registration_id
    group by
      edition.display_name,
      category.minimum_roster_size;

    if v_conflicting_minimum_roster_size is null
      or v_conflicting_active_roster_size < v_conflicting_minimum_roster_size
    then
      raise exception using
        errcode = 'P0001',
        message = format(
          'Retirer un coureur de %s ferait tomber la composition a %s coureurs, sous le minimum de %s.',
          v_conflicting_race_name,
          v_conflicting_active_roster_size,
          v_conflicting_minimum_roster_size
        );
    end if;
  end loop;

  select count(*)::integer
  into v_accepted_team_count
  from public.race_registrations as registration
  where registration.race_edition_id = v_edition_id
    and registration.status = 'accepted';

  update public.race_editions
  set
    registration_policy = 'open',
    registration_closes_at = now() + interval '1 hour',
    withdrawal_closes_at = now() + interval '1 hour',
    field_limit = case
      when field_limit is null then null
      else greatest(field_limit::integer, v_accepted_team_count + 1)::smallint
    end
  where id = v_edition_id;

  perform pg_catalog.set_config(
    'request.jwt.claim.sub',
    v_auth_user_id::text,
    true
  );

  select
    saved.registration_id,
    saved.registration_status,
    saved.registered_rider_count
  into strict
    v_saved_registration_id,
    v_saved_registration_status,
    v_saved_rider_count
  from public.save_current_team_competition_roster_with_roles(
    v_edition_id,
    v_roster
  ) as saved;

  update public.race_editions
  set
    registration_policy = v_original_registration_policy,
    registration_closes_at = v_original_registration_closes_at,
    withdrawal_closes_at = v_original_withdrawal_closes_at,
    field_limit = v_original_field_limit
  where id = v_edition_id;

  if v_saved_registration_id <> v_existing_registration_id
    or v_saved_registration_status <> 'accepted'
    or v_saved_rider_count <> 9
  then
    raise exception using
      errcode = 'P0001',
      message = 'La procedure officielle n a pas confirme la reinscription attendue.';
  end if;

  select
    count(*)::integer,
    array_agg(roster.rider_id order by roster.rider_id)
  into v_verified_rider_count, v_verified_rider_ids
  from public.race_rosters as roster
  where roster.race_registration_id = v_existing_registration_id
    and roster.status in ('selected', 'confirmed');

  if v_verified_rider_count <> 9
    or v_verified_rider_ids is distinct from (
      select array_agg(selected.rider_id order by selected.rider_id)
      from unnest(v_rider_ids) as selected(rider_id)
    )
  then
    raise exception using
      errcode = 'P0001',
      message = 'La verification finale de la startlist a echoue.';
  end if;

  raise notice 'Ardennes outillage reinscrite au Grand Tour italien avec 9 coureurs.';
end;
$$;

commit;
