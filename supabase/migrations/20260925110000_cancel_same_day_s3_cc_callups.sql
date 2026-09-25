begin;

-- The S3 continental championships are held today.  Do not retrofit the new
-- approval workflow onto startlists that had already been produced by the
-- legacy automatic selector: restore those selections and remove only the
-- extra replacement rows created by today's catch-up.
create temporary table s3_cc_rollback_members on commit drop as
select member.id, member.selection_list_id, member.created_at
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
  and member.response_status = 'pending';

-- Remove every notification emitted by the catch-up, including notifications
-- already accepted/refused by a DS.  Their explicit response itself is kept.
delete from public.sporting_director_messages as message
using public.national_federation_selection_members as member,
  public.national_federation_selection_lists as selection_list,
  public.national_federation_selection_slots as slot,
  public.seasons as season
where message.source_reference = 'federation-auto-callup:' || member.id::text
  and selection_list.id = member.selection_list_id
  and slot.slot_key = selection_list.slot_key
  and season.id = selection_list.season_id
  and season.game_year = 3
  and slot.rider_category = 'professional'
  and slot.competition_code = 'continental_championship';

-- Rows born with the catch-up did not exist in the original startlists.
delete from public.national_federation_selection_members as member
using s3_cc_rollback_members as rollback
where member.id = rollback.id
  and rollback.created_at >= timestamptz '2026-09-25 08:00:00+00';

-- Rows created before today's deployment are the former implicit automatic
-- selections.  Restore them exactly to that legacy state for today's CC.
update public.national_federation_selection_members as member
set response_status = 'confirmed',
    responded_at = selection_list.published_at
from s3_cc_rollback_members as rollback,
  public.national_federation_selection_lists as selection_list
where member.id = rollback.id
  and selection_list.id = member.selection_list_id
  and rollback.created_at < timestamptz '2026-09-25 08:00:00+00';

update public.national_federation_selection_lists as selection_list
set status = case when exists (
      select 1
      from public.national_federation_selection_members as member
      where member.selection_list_id = selection_list.id
        and member.response_status = 'pending'
    ) then 'pending_confirmation' else 'finalized' end,
    updated_at = now()
where selection_list.id in (
  select distinct rollback.selection_list_id
  from s3_cc_rollback_members as rollback
);

-- Rebuild only the affected CC startlists.  The sync routine gives the
-- international championship priority over overlapping club registrations.
do $rollback$
declare
  v_list record;
begin
  for v_list in
    select distinct rollback.selection_list_id
    from s3_cc_rollback_members as rollback
  loop
    perform public.sync_national_federation_championship_lineup(
      v_list.selection_list_id
    );
  end loop;
end;
$rollback$;

notify pgrst, 'reload schema';

commit;
