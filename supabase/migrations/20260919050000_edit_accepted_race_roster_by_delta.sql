begin;

-- Édite une inscription acceptée sans changer son statut ni recréer ses
-- coureurs conservés. Les autres RPC (inscription initiale, WildCard en
-- attente, rattrapage d'un effectif incomplet) gardent leurs règles propres.
create function public.update_current_team_race_roster(
  p_race_edition_id uuid,
  p_rider_ids uuid[],
  p_expected_rider_ids uuid[]
)
returns table (
  registration_id uuid,
  registered_rider_count integer,
  added_rider_count integer,
  removed_rider_count integer
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_edition public.race_editions%rowtype;
  v_competition_type text;
  v_minimum integer;
  v_maximum integer;
  v_team_id uuid;
  v_team_season_id uuid;
  v_game_year integer;
  v_registration public.race_registrations%rowtype;
  v_current_ids uuid[] := '{}'::uuid[];
  v_expected_ids uuid[] := '{}'::uuid[];
  v_added_ids uuid[] := '{}'::uuid[];
  v_removed_ids uuid[] := '{}'::uuid[];
  v_rider_id uuid;
  v_valid_added_count integer;
begin
  if auth.uid() is null then
    raise exception using errcode = '42501',
      message = 'Vous devez être connecté pour modifier cette inscription.';
  end if;

  if p_rider_ids is null or p_expected_rider_ids is null
    or cardinality(p_rider_ids) <> (
      select count(distinct selected.rider_id)
      from unnest(p_rider_ids) as selected(rider_id)
    )
    or cardinality(p_expected_rider_ids) <> (
      select count(distinct expected.rider_id)
      from unnest(p_expected_rider_ids) as expected(rider_id)
    )
  then
    raise exception using errcode = 'P0001',
      message = 'La composition contient un coureur en double ou invalide.';
  end if;

  select edition.*
  into v_edition
  from public.race_editions as edition
  where edition.id = p_race_edition_id
  for update of edition;

  if v_edition.id is null then
    raise exception using errcode = 'P0002',
      message = 'Cette édition de course est introuvable.';
  end if;

  select race.competition_type,
    category.minimum_roster_size,
    category.maximum_roster_size
  into v_competition_type, v_minimum, v_maximum
  from public.races as race
  join public.race_categories as category
    on category.id = v_edition.race_category_id
  where race.id = v_edition.race_id;

  if v_competition_type <> 'standard' then
    raise exception using errcode = 'P0001',
      message = 'Les sélections et championnats ont leur propre gestion des effectifs.';
  end if;

  if v_edition.status <> 'registration_open'
    or v_edition.registration_policy <> 'open'
    or v_edition.registration_closes_at is null
    or v_edition.withdrawal_closes_at is null
    or clock_timestamp() >= v_edition.registration_closes_at
    or clock_timestamp() >= v_edition.withdrawal_closes_at
    or not exists (
      select 1 from public.stages as stage
      where stage.race_edition_id = v_edition.id
    )
    or exists (
      select 1
      from public.stages as stage
      where stage.race_edition_id = v_edition.id
        and (
          stage.status <> 'planned'
          or (stage.departure_at is not null and stage.departure_at <= clock_timestamp())
          or exists (
            select 1
            from public.official_stage_simulations as simulation
            where simulation.stage_id = stage.id
          )
        )
    )
  then
    raise exception using errcode = 'P0001',
      message = 'La startlist est figée ou la course a commencé ; actualisez la fiche de course.';
  end if;

  if v_minimum is null or v_maximum is null
    or cardinality(p_rider_ids) < v_minimum
    or cardinality(p_rider_ids) > v_maximum
    or cardinality(p_expected_rider_ids) > v_maximum
  then
    raise exception using errcode = 'P0001',
      message = format('Sélectionnez entre %s et %s coureurs.', v_minimum, v_maximum);
  end if;

  select assignment.team_id
  into v_team_id
  from public.sporting_directors as director
  join public.team_manager_assignments as assignment
    on assignment.sporting_director_id = director.id
   and assignment.role = 'general_manager'
   and assignment.status = 'active'
  where director.auth_user_id = auth.uid()
    and director.status = 'active'
  limit 1;

  if v_team_id is null then
    raise exception using errcode = '42501',
      message = 'Vous ne dirigez pas cette équipe.';
  end if;

  select team_season.id, season.game_year
  into v_team_season_id, v_game_year
  from public.team_seasons as team_season
  join public.seasons as season on season.id = team_season.season_id
  where team_season.team_id = v_team_id
    and team_season.season_id = v_edition.season_id
    and team_season.status in ('planned', 'active')
  limit 1;

  if v_team_season_id is null then
    raise exception using errcode = '42501',
      message = 'Votre équipe ne participe pas à cette saison.';
  end if;

  -- Même ordre de verrouillage que l'inscription initiale : édition, puis
  -- coureurs triés, puis inscription. Un autre changement ne peut pas glisser
  -- entre la vérification des conflits et l'écriture de la startlist.
  for v_rider_id in
    select distinct rider_id
    from unnest(p_rider_ids || p_expected_rider_ids) as rider(rider_id)
    order by rider_id
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
    and registration.status = 'accepted'
  for update;

  if v_registration.id is null then
    raise exception using errcode = 'P0001',
      message = 'Aucune inscription acceptée ne peut être modifiée.';
  end if;

  select coalesce(array_agg(roster.rider_id order by roster.rider_id), '{}'::uuid[])
  into v_current_ids
  from public.race_rosters as roster
  where roster.race_registration_id = v_registration.id
    and roster.status in ('selected', 'confirmed');

  select coalesce(array_agg(expected.rider_id order by expected.rider_id), '{}'::uuid[])
  into v_expected_ids
  from unnest(p_expected_rider_ids) as expected(rider_id);

  if v_current_ids <> v_expected_ids then
    raise exception using errcode = '40001',
      message = 'La composition a changé entre-temps. Rechargez la page avant de modifier l’inscription.';
  end if;

  -- Une attente sur les verrous ne doit jamais prolonger artificiellement la
  -- fenêtre de modification au-delà du départ ou du gel de l'inscription.
  if clock_timestamp() >= v_edition.registration_closes_at
    or clock_timestamp() >= v_edition.withdrawal_closes_at
    or exists (
      select 1
      from public.stages as stage
      where stage.race_edition_id = v_edition.id
        and (
          stage.status <> 'planned'
          or (stage.departure_at is not null and stage.departure_at <= clock_timestamp())
          or exists (
            select 1 from public.official_stage_simulations as simulation
            where simulation.stage_id = stage.id
          )
        )
    )
  then
    raise exception using errcode = 'P0001',
      message = 'La fenêtre de modification vient de se fermer. Rechargez la fiche de course.';
  end if;

  select coalesce(array_agg(rider_id order by rider_id), '{}'::uuid[])
  into v_added_ids
  from (
    select unnest(p_rider_ids) as rider_id
    except
    select unnest(v_current_ids) as rider_id
  ) as added;

  select coalesce(array_agg(rider_id order by rider_id), '{}'::uuid[])
  into v_removed_ids
  from (
    select unnest(v_current_ids) as rider_id
    except
    select unnest(p_rider_ids) as rider_id
  ) as removed;

  if cardinality(v_added_ids) = 0 and cardinality(v_removed_ids) = 0 then
    return query select v_registration.id, cardinality(v_current_ids), 0, 0;
    return;
  end if;

  -- Les coureurs déjà présents ne sont pas revalidés : une blessure ou une
  -- convocation survenue depuis leur inscription ne doit pas les réinscrire.
  select count(distinct rider.id)
  into v_valid_added_count
  from public.riders as rider
  join public.rider_contracts as contract
    on contract.rider_id = rider.id
   and contract.team_id = v_team_id
   and contract.status = 'active'
  join public.seasons as start_season
    on start_season.id = contract.start_season_id
  join public.seasons as end_season
    on end_season.id = contract.end_season_id
  where rider.id = any(v_added_ids)
    and rider.status = 'active'
    and start_season.game_year <= v_game_year
    and end_season.game_year >= v_game_year;

  if v_valid_added_count <> cardinality(v_added_ids) then
    raise exception using errcode = '42501',
      message = 'Un nouveau coureur ne fait pas partie de votre effectif actif.';
  end if;

  if exists (
    select 1
    from public.pre_race_press_conferences as conference
    where conference.race_edition_id = v_edition.id
      and conference.team_season_id = v_team_season_id
      and conference.leader_rider_id = any(v_removed_ids)
      and conference.status = 'published'
  ) then
    raise exception using errcode = 'P0001',
      message = 'Un leader annoncé en conférence d’avant-course ne peut pas être retiré de la startlist.';
  end if;

  -- Les réglages des coureurs conservés restent intacts. Seuls les plans des
  -- coureurs retirés sont supprimés ou vidés avant le changement de statut.
  delete from public.race_roster_stage_roles
  where race_registration_id = v_registration.id
    and rider_id = any(v_removed_ids);

  delete from public.race_time_trial_rider_plans
  where race_registration_id = v_registration.id
    and rider_id = any(v_removed_ids);

  delete from public.race_stage_equipment_assignments
  where race_edition_id = v_edition.id
    and team_season_id = v_team_season_id
    and rider_id = any(v_removed_ids);

  update public.race_stage_strategies as strategy
  set lieutenant_rider_id = case when strategy.lieutenant_rider_id = any(v_removed_ids)
        then null else strategy.lieutenant_rider_id end,
      danger_pacer_rider_id = case when strategy.danger_pacer_rider_id = any(v_removed_ids)
        then null else strategy.danger_pacer_rider_id end,
      protector_rider_id = case when strategy.protector_rider_id = any(v_removed_ids)
        then null else strategy.protector_rider_id end,
      breakaway_rider_id = case when strategy.breakaway_rider_id = any(v_removed_ids)
        then null else strategy.breakaway_rider_id end
  where strategy.race_registration_id = v_registration.id
    and (
      strategy.lieutenant_rider_id = any(v_removed_ids)
      or strategy.danger_pacer_rider_id = any(v_removed_ids)
      or strategy.protector_rider_id = any(v_removed_ids)
      or strategy.breakaway_rider_id = any(v_removed_ids)
    );

  update public.race_stage_tactical_briefings as briefing
  set primary_rider_ids = array(
        select rider_id
        from unnest(briefing.primary_rider_ids) as selected(rider_id)
        where rider_id <> all(v_removed_ids)
      ),
      backup_rider_ids = array(
        select rider_id
        from unnest(briefing.backup_rider_ids) as selected(rider_id)
        where rider_id <> all(v_removed_ids)
      )
  where briefing.race_registration_id = v_registration.id
    and (
      briefing.primary_rider_ids && v_removed_ids
      or briefing.backup_rider_ids && v_removed_ids
    );

  update public.race_rosters as roster
  set status = 'withdrawn'
  where roster.race_registration_id = v_registration.id
    and roster.rider_id = any(v_removed_ids)
    and roster.status in ('selected', 'confirmed');

  insert into public.race_rosters (
    race_registration_id, rider_id, status, selected_at, race_role
  )
  select v_registration.id, added.rider_id, 'confirmed', clock_timestamp(), 'auto'
  from unnest(v_added_ids) as added(rider_id)
  on conflict (race_registration_id, rider_id)
  do update set status = 'confirmed',
                selected_at = excluded.selected_at,
                race_role = 'auto',
                bib_number = null,
                starting_form = null,
                withdrawn_by_injury_id = null;

  return query
  select v_registration.id,
    cardinality(p_rider_ids),
    cardinality(v_added_ids),
    cardinality(v_removed_ids);
end;
$$;

comment on function public.update_current_team_race_roster(uuid, uuid[], uuid[])
is 'Modifie atomiquement par différence la startlist acceptée d’une course standard avant gel, sans toucher aux coureurs conservés ni au statut de l’inscription.';

revoke all on function public.update_current_team_race_roster(uuid, uuid[], uuid[])
from public, anon;
grant execute on function public.update_current_team_race_roster(uuid, uuid[], uuid[])
to authenticated;

notify pgrst, 'reload schema';

commit;
