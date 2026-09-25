begin;

-- A rider who has already started a stage race must remain on that tour.
-- Reinstall the guard removed by the same-day CC hotfix before rebuilding any
-- international startlist, so a later synchronization cannot reproduce the
-- withdrawal.
do $migration$
declare
  v_definition text;
  v_guard constant text := E'  if public.is_rider_protected_by_stage_race_for_international_selection(\n    p_rider_id,\n    p_race_edition_id,\n    now()\n  ) then\n    raise exception using\n      errcode = ''P0001'',\n      message = ''Le coureur est engagé sur un tour déjà verrouillé ou commencé.'';\n  end if;\n\n';
  v_anchor constant text := E'  select min(day.day_number), max(day.day_number)\n  into v_target_start_day, v_target_end_day\n';
begin
  select replace(pg_catalog.pg_get_functiondef(
    'public.prioritize_federation_championship_rider(uuid,uuid)'::regprocedure
  ), chr(13), '') into v_definition;

  if position(v_guard in v_definition) = 0 then
    if position(v_anchor in v_definition) = 0 then
      raise exception
        'Unexpected international priority function; restoration aborted.';
    end if;
    execute replace(v_definition, v_anchor, v_guard || v_anchor);
  end if;
end;
$migration$;

-- These rows are the old automatic confirmations: the selection was produced
-- by the system, the rider belongs to a human DS, and responded_at is exactly
-- the publication timestamp. A real answer has its own later timestamp and is
-- deliberately preserved. Unmanaged riders also remain selected.
create temporary table s3_forced_player_cc_members on commit drop as
select
  member.id as member_id,
  member.selection_list_id,
  member.professional_rider_id
from public.national_federation_selection_members as member
join public.national_federation_selection_lists as selection_list
  on selection_list.id = member.selection_list_id
join public.national_federation_selection_slots as slot
  on slot.slot_key = selection_list.slot_key
join public.seasons as season on season.id = selection_list.season_id
where season.game_year = 3
  and season.status = 'active'
  and slot.rider_category = 'professional'
  and slot.competition_code = 'continental_championship'
  and selection_list.created_by_director_id is null
  and selection_list.published_at is not null
  and member.owner_director_id is not null
  and member.response_status = 'confirmed'
  and member.responded_at = selection_list.published_at;

-- Freeze the exact Tour de Mazovie riders to restore before changing the CC
-- rows. Only riders who finished stage 2, were then withdrawn, and are among
-- the forced automatic confirmations qualify.
create temporary table s3_mazovia_stage3_restore on commit drop as
select distinct roster.id as race_roster_id, roster.rider_id
from public.races as race
join public.race_editions as edition on edition.race_id = race.id
join public.seasons as season on season.id = edition.season_id
join public.stages as stage_two
  on stage_two.race_edition_id = edition.id
 and stage_two.stage_number = 2
join public.stage_results as result
  on result.stage_id = stage_two.id
 and result.status = 'finished'
join public.race_rosters as roster on roster.id = result.race_roster_id
join public.race_registrations as registration
  on registration.id = roster.race_registration_id
where race.slug = 'tour-de-mazovie'
  and season.game_year = 3
  and roster.status = 'withdrawn'
  and registration.status = 'accepted'
  and exists (
    select 1
    from s3_forced_player_cc_members as forced
    where forced.professional_rider_id = roster.rider_id
  )
  and exists (
    select 1
    from public.stages as stage_three
    where stage_three.race_edition_id = edition.id
      and stage_three.stage_number = 3
      and stage_three.status = 'planned'
  );

delete from public.sporting_director_messages as message
using s3_forced_player_cc_members as forced
where message.source_reference =
  'federation-auto-callup:' || forced.member_id::text;

update public.national_federation_selection_members as member
set response_status = 'declined', responded_at = now()
from s3_forced_player_cc_members as forced
where member.id = forced.member_id;

update public.national_federation_selection_lists as selection_list
set status = case when exists (
      select 1
      from public.national_federation_selection_members as member
      where member.selection_list_id = selection_list.id
        and member.response_status = 'pending'
    ) then 'pending_confirmation' else 'finalized' end,
    updated_at = now()
where selection_list.id in (
  select distinct forced.selection_list_id
  from s3_forced_player_cc_members as forced
);

-- Withdraw the cancelled automatic CC riders while preserving explicit DS
-- confirmations and the legitimate automatic selection of unmanaged riders.
do $resync$
declare
  v_list record;
begin
  for v_list in
    select distinct forced.selection_list_id
    from s3_forced_player_cc_members as forced
  loop
    perform public.sync_national_federation_championship_lineup(
      v_list.selection_list_id
    );
  end loop;
end;
$resync$;

-- Restore the exact existing roster rows: bibs, preparation, equipment and
-- the first two stage results therefore remain attached to the same entries.
update public.race_rosters as roster
set status = 'confirmed'
from s3_mazovia_stage3_restore as repair
where roster.id = repair.race_roster_id;

comment on function public.prioritize_federation_championship_rider(uuid,uuid)
is 'Une convocation internationale confirmée peut remplacer une course concurrente, mais ne retire jamais un coureur d’un tour déjà verrouillé ou commencé.';

notify pgrst, 'reload schema';

commit;
