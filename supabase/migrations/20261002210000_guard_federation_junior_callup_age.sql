begin;

-- The manual federation pool and the reply RPC must share the same 16-18 rule
-- already enforced by junior international competitions.
do $function_patch$
declare
  v_definition text;
  v_anchor text := $anchor$           and rider.country_id = v_identity.country_id
           and rider.status in ('active', 'recruited', 'free_agent')) <> cardinality(v_rider_ids) then$anchor$;
  v_replacement text := $replacement$           and rider.country_id = v_identity.country_id
           and rider.status in ('active', 'recruited', 'free_agent')
           and v_season.game_year - rider.birth_game_year between 16 and 18) <> cardinality(v_rider_ids) then$replacement$;
begin
  select replace(
    pg_get_functiondef(
      'public.save_national_federation_preselection(text,text,uuid[])'::regprocedure
    ),
    chr(13),
    ''
  ) into v_definition;

  if position(
    'v_season.game_year - rider.birth_game_year between 16 and 18' in v_definition
  ) = 0 then
    if position(v_anchor in v_definition) = 0 then
      raise exception 'Federation junior age eligibility anchor missing.';
    end if;
    execute replace(v_definition, v_anchor, v_replacement);
  end if;
end;
$function_patch$;

-- Remove only unanswered, impossible call-ups from the active season. Valid
-- confirmations and past refusals are deliberately preserved.
create temporary table invalid_pending_federation_junior_callups
on commit drop
as
select
  member.id as member_id,
  member.selection_list_id
from public.seasons as season
join public.national_federation_selection_lists as selection_list
  on selection_list.season_id = season.id
join public.national_federation_selection_slots as slot
  on slot.slot_key = selection_list.slot_key
 and slot.rider_category = 'junior'
join public.national_federation_selection_members as member
  on member.selection_list_id = selection_list.id
join public.youth_academy_riders as rider
  on rider.id = member.junior_rider_id
where season.status = 'active'
  and member.response_status = 'pending'
  and season.game_year - rider.birth_game_year not between 16 and 18;

delete from public.sporting_director_messages as message
using invalid_pending_federation_junior_callups as invalid
where message.message_type = 'international_selection'
  and message.source_reference like '%' || invalid.member_id::text || '%';

delete from public.national_federation_selection_members as member
using invalid_pending_federation_junior_callups as invalid
where member.id = invalid.member_id;

update public.national_federation_selection_lists as selection_list
set
  status = case
    when exists (
      select 1
      from public.national_federation_selection_members as remaining
      where remaining.selection_list_id = selection_list.id
        and remaining.response_status in ('draft', 'pending')
    ) then 'pending_confirmation'
    else 'finalized'
  end,
  updated_at = now()
where selection_list.id in (
  select distinct invalid.selection_list_id
  from invalid_pending_federation_junior_callups as invalid
);

notify pgrst, 'reload schema';
commit;
