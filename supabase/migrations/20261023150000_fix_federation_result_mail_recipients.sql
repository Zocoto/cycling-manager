begin;

set local application_name = 'federation-result-mail-migration';
set local lock_timeout = '1s';
set local statement_timeout = '5s';

-- Keep the existing publisher, completion trigger, source keys, deletion guard
-- and club mail rules. Only add the frozen owners of participating CC/CM riders.
-- No scan/backfill, result settlement or recurring job runs in this migration.
do $migration$
declare
  v_definition text := replace(
    pg_get_functiondef('public.publish_director_race_result_messages(uuid)'::regprocedure),
    chr(13), ''
  );
  v_old text[] := array[
    $old$  team_results as (
    select
      registration.team_season_id,$old$,
    $old$    join public.race_registrations as registration
      on registration.id = roster.race_registration_id
    join public.riders as rider on rider.id = roster.rider_id
    where result.race_edition_id = p_race_edition_id
      and registration.team_season_id is not null
    group by registration.team_season_id$old$,
    $old$  join public.team_manager_assignments as assignment
    on assignment.team_id = team_season.team_id
    and assignment.role = 'general_manager'
    and assignment.status = 'active'$old$,
    $old$    on director.id = assignment.sporting_director_id
    and director.status = 'active'$old$
  ];
  v_new text[] := array[
    $new$  result_recipients as (
    -- Resolve ordinary entries to their existing active GM before grouping.
    -- Club/federation entries can then safely share one recipient and source.
    select
      roster.id as race_roster_id,
      registration.team_season_id,
      assignment.sporting_director_id as recipient_director_id
    from public.race_registrations as registration
    join public.race_rosters as roster
      on roster.race_registration_id = registration.id
    join public.team_seasons as club_season
      on club_season.id = registration.team_season_id
    join public.team_manager_assignments as assignment
      on assignment.team_id = club_season.team_id
      and assignment.role = 'general_manager'
      and assignment.status = 'active'
    where registration.race_edition_id = p_race_edition_id
      and registration.team_season_id is not null

    union all

    -- Frozen ownership, not today's contract or federation presidency. The
    -- registration/edition/season links also exclude unselected riders.
    select
      roster.id as race_roster_id,
      owner_season.id as team_season_id,
      member.owner_director_id as recipient_director_id
    from edition_context as context
    join public.race_registrations as registration
      on registration.race_edition_id = context.id
      and registration.team_season_id is null
    join public.race_rosters as roster
      on roster.race_registration_id = registration.id
    join public.national_federation_selection_race_links as link
      on link.race_registration_id = registration.id
      and link.race_edition_id = context.id
    join public.national_federation_selection_lists as selection
      on selection.id = link.selection_list_id
      and selection.season_id = context.season_id
    join public.national_federation_selection_members as member
      on member.selection_list_id = selection.id
      and member.professional_rider_id = roster.rider_id
      and member.response_status = 'confirmed'
    join public.team_seasons as owner_season
      on owner_season.team_id = member.owner_team_id
      and owner_season.season_id = context.season_id
    where context.competition_type in (
      'continental_championship', 'world_championship'
    )
      and member.owner_director_id is not null
  ),
  team_results as (
    select
      recipient.team_season_id,
      recipient.recipient_director_id,$new$,
    $new$    join result_recipients as recipient
      on recipient.race_roster_id = roster.id
    join public.riders as rider on rider.id = roster.rider_id
    where result.race_edition_id = p_race_edition_id
    group by recipient.team_season_id, recipient.recipient_director_id$new$,
    $new$$new$,
    $new$    on director.id = team_result.recipient_director_id
    and director.status = 'active'$new$
  ];
begin
  for i in 1..array_length(v_old, 1) loop
    if array_length(string_to_array(v_definition, v_old[i]), 1) <> 2 then
      raise exception 'Federation result-mail publisher anchor % drifted; no change applied.', i;
    end if;
    v_definition := replace(v_definition, v_old[i], v_new[i]);
  end loop;
  execute v_definition;
end;
$migration$;

commit;
