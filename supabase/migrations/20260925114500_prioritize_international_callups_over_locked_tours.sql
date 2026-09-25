begin;

-- An accepted international call-up has explicit priority over an overlapping
-- club engagement, including a tour whose roster is already locked/started.
-- The existing cleanup below withdraws only the selected rider and keeps the
-- other team's riders registered.
do $migration$
declare
  v_definition text;
  v_guard constant text := E'  if public.is_rider_protected_by_stage_race_for_international_selection(\n    p_rider_id,\n    p_race_edition_id,\n    now()\n  ) then\n    raise exception using\n      errcode = ''P0001'',\n      message = ''Le coureur est engagé sur un tour déjà verrouillé ou commencé.'';\n  end if;\n\n';
begin
  select replace(pg_catalog.pg_get_functiondef(
    'public.prioritize_federation_championship_rider(uuid,uuid)'::regprocedure
  ), chr(13), '') into v_definition;

  if position(v_guard in v_definition) = 0 then
    raise exception 'Unexpected international priority function; migration aborted.';
  end if;

  execute replace(v_definition, v_guard, '');
end;
$migration$;

-- Complete the same-day rollback: no member created by the S3 CC catch-up
-- may remain in the selection, regardless of its transient response state.
create temporary table s3_cc_lists_to_resync on commit drop as
select distinct selection_list.id as selection_list_id
from public.national_federation_selection_lists as selection_list
join public.national_federation_selection_slots as slot
  on slot.slot_key = selection_list.slot_key
join public.seasons as season on season.id = selection_list.season_id
where season.game_year = 3
  and season.status = 'active'
  and slot.rider_category = 'professional'
  and slot.competition_code = 'continental_championship';

delete from public.sporting_director_messages as message
using public.national_federation_selection_members as member,
  s3_cc_lists_to_resync as affected
where member.selection_list_id = affected.selection_list_id
  and message.source_reference = 'federation-auto-callup:' || member.id::text;

delete from public.national_federation_selection_members as member
using s3_cc_lists_to_resync as affected
where member.selection_list_id = affected.selection_list_id
  and member.created_at >= timestamptz '2026-09-25 08:00:00+00';

update public.national_federation_selection_lists as selection_list
set status = case when exists (
      select 1
      from public.national_federation_selection_members as member
      where member.selection_list_id = selection_list.id
        and member.response_status = 'pending'
    ) then 'pending_confirmation' else 'finalized' end,
    updated_at = now()
from s3_cc_lists_to_resync as affected
where selection_list.id = affected.selection_list_id;

do $resync$
declare
  v_list record;
begin
  for v_list in
    select affected.selection_list_id
    from s3_cc_lists_to_resync as affected
  loop
    perform public.sync_national_federation_championship_lineup(
      v_list.selection_list_id
    );
  end loop;
end;
$resync$;

comment on function public.prioritize_federation_championship_rider(uuid,uuid)
is 'Une convocation internationale confirmée prime tout engagement de club concurrent, y compris un tour verrouillé ou commencé ; seul le coureur convoqué est désengagé.';

notify pgrst, 'reload schema';

commit;
