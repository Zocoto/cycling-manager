begin;

-- Fermer aussi les inscriptions des CC annules. Les listes restent dans
-- l'historique de la federation, mais aucun engagement ne reste actif.
update public.race_rosters as roster
set status = 'withdrawn'
from public.race_registrations as registration,
  public.race_editions as edition,
  public.seasons as season,
  public.races as race
where registration.id = roster.race_registration_id
  and edition.id = registration.race_edition_id
  and season.id = edition.season_id
  and race.id = edition.race_id
  and season.game_year = 3
  and race.competition_type = 'continental_championship'
  and edition.status = 'cancelled'
  and roster.status in ('selected', 'confirmed');

update public.race_registrations as registration
set status = 'withdrawn', decided_at = now()
from public.race_editions as edition,
  public.seasons as season,
  public.races as race
where edition.id = registration.race_edition_id
  and season.id = edition.season_id
  and race.id = edition.race_id
  and season.game_year = 3
  and race.competition_type = 'continental_championship'
  and edition.status = 'cancelled'
  and registration.status <> 'withdrawn';

update public.national_federation_junior_race_registrations as registration
set status = 'withdrawn', synced_at = now()
from public.development_race_editions as edition,
  public.seasons as season
where edition.id = registration.race_edition_id
  and season.id = edition.season_id
  and season.game_year = 3
  and edition.status = 'cancelled'
  and edition.competition_type in (
    'continental_road', 'continental_time_trial'
  )
  and registration.status <> 'withdrawn';

-- Le rattrapage du jour des CC avait temporairement etendu la reponse a H-1
-- pour tous les championnats S3. Les Mondiaux sont encore lointains : ils
-- retrouvent immediatement la vraie cloture H-24.
do $migration$
declare
  v_definition text;
  v_before constant text := E'when season.game_year = 3\n            and slot.competition_code in (\n              ''continental_championship'', ''world_championship''\n            ) then interval ''1 hour''';
  v_after constant text := E'when season.game_year = 3\n            and slot.competition_code = ''continental_championship''\n            then interval ''1 hour''';
begin
  select replace(pg_catalog.pg_get_functiondef(
    'public.get_national_federation_selection_schedule(uuid,uuid)'::regprocedure
  ), chr(13), '') into v_definition;

  if position(v_before in v_definition) = 0 then
    raise exception 'Unexpected S3 international response deadline.';
  end if;

  execute replace(v_definition, v_before, v_after);
end;
$migration$;

-- Une federation ne doit plus voir dans Preparation une epreuve internationale
-- terminee ou annulee. Le meme filtre vaut pour les CC et pour les Mondiaux.
do $migration$
declare
  v_definition text;
  v_before constant text := E'  where selection_list.country_id = v_country_id\n    and selection_list.season_id = v_season_id\n    and selection_list.status in (''pending_confirmation'', ''finalized'')';
  v_after constant text := E'  where selection_list.country_id = v_country_id\n    and selection_list.season_id = v_season_id\n    and selection_list.status in (''pending_confirmation'', ''finalized'')\n    and edition.status not in (''completed'', ''cancelled'')\n    and stage.status = ''planned''\n    and stage.departure_at > now()';
begin
  select replace(pg_catalog.pg_get_functiondef(
    'public.get_current_national_federation_race_preparation(text)'::regprocedure
  ), chr(13), '') into v_definition;

  if position(v_before in v_definition) = 0 then
    raise exception 'Unexpected federation preparation query.';
  end if;

  execute replace(v_definition, v_before, v_after);
end;
$migration$;

-- Le classement junior groupait encore le nom affiche avec l'identifiant de
-- l'equipe. Un changement de nom pouvait donc produire deux lignes portant la
-- meme cle unique et bloquer toute la maintenance, y compris les CM juniors.
do $migration$
declare
  v_definition text;
  v_before constant text := E'    grouped.development_team_id,\n    grouped.display_name,\n    null,\n    null,\n    sum(grouped.points)::integer,\n    sum(grouped.wins)::integer,\n    sum(grouped.podiums)::integer,\n    sum(grouped.race_count)::integer\n  from (\n';
  v_after constant text := E'    grouped.development_team_id,\n    max(grouped.display_name),\n    null,\n    null,\n    sum(grouped.points)::integer,\n    sum(grouped.wins)::integer,\n    sum(grouped.podiums)::integer,\n    sum(grouped.race_count)::integer\n  from (\n';
  v_group_before constant text :=
    '  group by grouped.entity_key, grouped.development_team_id, grouped.display_name;';
  v_group_after constant text :=
    '  group by grouped.entity_key, grouped.development_team_id;';
begin
  select replace(pg_catalog.pg_get_functiondef(
    'public.refresh_development_rankings(uuid)'::regprocedure
  ), chr(13), '') into v_definition;

  if position(v_before in v_definition) = 0
     or position(v_group_before in v_definition) = 0 then
    raise exception 'Unexpected development ranking aggregation.';
  end if;

  v_definition := replace(v_definition, v_before, v_after);
  v_definition := replace(v_definition, v_group_before, v_group_after);
  execute v_definition;
end;
$migration$;

-- Un rapport de preflight durable permet de controler a tout moment le flux
-- CM sans exposer de donnees personnelles aux joueurs.
create or replace function private.get_active_world_championship_readiness()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with active_season as (
    select season.id, season.game_year, season.current_day_number
    from public.seasons as season
    where season.status = 'active'
    limit 1
  ), pro_world_editions as (
    select edition.id, edition.status
    from public.race_editions as edition
    join active_season as season on season.id = edition.season_id
    join public.races as race
      on race.id = edition.race_id
     and race.competition_type = 'world_championship'
  ), pro_world_stages as (
    select stage.id, stage.race_edition_id, stage.status, stage.departure_at
    from public.stages as stage
    join pro_world_editions as edition on edition.id = stage.race_edition_id
  ), qualified as (
    select snapshot.country_id
    from public.international_nation_qualification_snapshots as snapshot
    join active_season as season on season.id = snapshot.season_id
    where snapshot.competition_code = 'world_championship'
      and snapshot.is_qualified = true
  ), world_slots as (
    select slot.slot_key, slot.rider_limit
    from public.national_federation_selection_slots as slot
    where slot.rider_category = 'professional'
      and slot.competition_code = 'world_championship'
  ), expected_automatic_lists as (
    select qualified.country_id, slot.slot_key
    from qualified
    cross join world_slots as slot
    cross join active_season as season
    left join public.national_federation_selection_preferences as preference
      on preference.country_id = qualified.country_id
     and preference.season_id = season.id
    where coalesce(preference.automatic_selection, true)
  ), world_lists as (
    select selection_list.*
    from public.national_federation_selection_lists as selection_list
    join active_season as season on season.id = selection_list.season_id
    join world_slots as slot on slot.slot_key = selection_list.slot_key
  ), world_members as (
    select member.*, selection_list.slot_key
    from public.national_federation_selection_members as member
    join world_lists as selection_list
      on selection_list.id = member.selection_list_id
  ), active_world_rosters as (
    select
      link.selection_list_id,
      roster.rider_id,
      roster.race_registration_id,
      link.race_edition_id
    from public.national_federation_selection_race_links as link
    join world_lists as selection_list
      on selection_list.id = link.selection_list_id
    join public.race_rosters as roster
      on roster.race_registration_id = link.race_registration_id
     and roster.status in ('selected', 'confirmed')
  ), all_active_world_rosters as (
    select roster.rider_id, roster.race_registration_id,
      registration.race_edition_id
    from public.race_rosters as roster
    join public.race_registrations as registration
      on registration.id = roster.race_registration_id
    join pro_world_editions as edition
      on edition.id = registration.race_edition_id
    where roster.status in ('selected', 'confirmed')
  )
  select jsonb_build_object(
    'gameYear', (select game_year from active_season),
    'currentDayNumber', (select current_day_number from active_season),
    'professionalEditions', (select count(*) from pro_world_editions),
    'professionalPlannedStages', (
      select count(*) from pro_world_stages where status = 'planned'
    ),
    'firstProfessionalDepartureAt', (
      select min(departure_at) from pro_world_stages
    ),
    'qualifiedCountries', (select count(*) from qualified),
    'professionalSlots', (select count(*) from world_slots),
    'expectedAutomaticLists', (select count(*) from expected_automatic_lists),
    'missingAutomaticLists', (
      select count(*)
      from expected_automatic_lists as expected
      where not exists (
        select 1
        from world_lists as selection_list
        where selection_list.country_id = expected.country_id
          and selection_list.slot_key = expected.slot_key
          and selection_list.created_by_director_id is null
      )
    ),
    'pendingManagedCallups', (
      select count(*) from world_members
      where owner_director_id is not null and response_status = 'pending'
    ),
    'confirmedCallups', (
      select count(*) from world_members where response_status = 'confirmed'
    ),
    'pendingCallupsWithoutMessage', (
      select count(*)
      from world_members as member
      where member.owner_director_id is not null
        and member.response_status = 'pending'
        and not exists (
          select 1
          from public.sporting_director_messages as message
          where message.sporting_director_id = member.owner_director_id
            and message.source_reference =
              'federation-auto-callup:' || member.id::text
        )
    ),
    'pendingOrDeclinedCallupsOnStartlist', (
      select count(*)
      from world_members as member
      join active_world_rosters as roster
        on roster.selection_list_id = member.selection_list_id
       and roster.rider_id = member.professional_rider_id
      where member.response_status in ('pending', 'declined', 'draft')
    ),
    'confirmedCallupsMissingFromStartlist', (
      select count(*)
      from world_members as member
      where member.response_status = 'confirmed'
        and not exists (
          select 1
          from active_world_rosters as roster
          where roster.selection_list_id = member.selection_list_id
            and roster.rider_id = member.professional_rider_id
        )
    ),
    'unlinkedActiveRosters', (
      select count(*)
      from all_active_world_rosters as roster
      where not exists (
        select 1
        from public.national_federation_selection_race_links as link
        where link.race_registration_id = roster.race_registration_id
          and link.race_edition_id = roster.race_edition_id
      )
    ),
    'duplicateRidersWithinAnEvent', (
      select count(*)
      from (
        select race_edition_id, rider_id
        from all_active_world_rosters
        group by race_edition_id, rider_id
        having count(*) > 1
      ) as duplicate
    ),
    'juniorEditions', (
      select count(*)
      from public.development_race_editions as edition
      join active_season as season on season.id = edition.season_id
      where edition.competition_type in ('world_road', 'world_time_trial')
    ),
    'juniorPlannedEditions', (
      select count(*)
      from public.development_race_editions as edition
      join active_season as season on season.id = edition.season_id
      where edition.competition_type in ('world_road', 'world_time_trial')
        and edition.status = 'planned'
    )
  );
$$;

revoke all on function private.get_active_world_championship_readiness()
from public, anon, authenticated;
grant execute on function private.get_active_world_championship_readiness()
to service_role;

-- Recalculer maintenant le classement junior, puis rejouer le producteur et
-- le synchroniseur officiels. Les convocations gerees restent en attente du
-- retour explicite des DS ; seules les confirmations entrent en startlist.
do $preflight$
declare
  v_season_id uuid;
  v_report jsonb;
begin
  select season.id into v_season_id
  from public.seasons as season
  where season.status = 'active'
  limit 1;

  if v_season_id is null then
    raise exception 'No active season for World Championships preflight.';
  end if;

  perform public.refresh_development_rankings(v_season_id);
  perform public.sync_due_national_federation_championship_lineups(now(), true);
  v_report := private.get_active_world_championship_readiness();

  raise notice 'World Championships readiness: %', v_report;

  if (v_report ->> 'professionalEditions')::integer <> 2
     or (v_report ->> 'professionalPlannedStages')::integer <> 2
     or (v_report ->> 'qualifiedCountries')::integer <> 30
     or (v_report ->> 'professionalSlots')::integer <> 2
     or (v_report ->> 'missingAutomaticLists')::integer <> 0
     or (v_report ->> 'pendingCallupsWithoutMessage')::integer <> 0
     or (v_report ->> 'pendingOrDeclinedCallupsOnStartlist')::integer <> 0
     or (v_report ->> 'confirmedCallupsMissingFromStartlist')::integer <> 0
     or (v_report ->> 'unlinkedActiveRosters')::integer <> 0
     or (v_report ->> 'duplicateRidersWithinAnEvent')::integer <> 0
     or (v_report ->> 'juniorEditions')::integer <> 2
     or (v_report ->> 'juniorPlannedEditions')::integer <> 2 then
    raise exception 'World Championships preflight failed: %', v_report;
  end if;
end;
$preflight$;

comment on function private.get_active_world_championship_readiness() is
  'Preflight CM pros/juniors : calendrier, qualifications, convocations, messages et correspondance exacte entre accords DS et startlists.';

comment on function public.get_national_federation_selection_schedule(uuid,uuid) is
  'Selections federales : CM et saisons futures closent a H-24 ; seule la campagne CC S3 annulee conservait la fenetre transitoire H-1.';

notify pgrst, 'reload schema';

commit;
