begin;

-- A president may have switched the federation to manual mode after the old
-- automatic producer confirmed a rider.  The exact timestamp signature still
-- proves that no DS answered, irrespective of the current mode preference.
with reopened as (
  select member.id, selection_list.id as selection_list_id
  from public.national_federation_selection_members as member
  join public.national_federation_selection_lists as selection_list
    on selection_list.id = member.selection_list_id
  join public.national_federation_selection_slots as slot
    on slot.slot_key = selection_list.slot_key
  join public.seasons as season on season.id = selection_list.season_id
  cross join lateral public.get_national_federation_selection_target(
    selection_list.country_id, selection_list.season_id,
    selection_list.slot_key
  ) as target
  where season.status = 'active' and season.game_year = 3
    and slot.rider_category = 'professional'
    and slot.competition_code in (
      'continental_championship', 'world_championship'
    )
    and selection_list.created_by_director_id is null
    and member.owner_director_id is not null
    and member.response_status = 'confirmed'
    and member.responded_at = selection_list.published_at
    and target.departure_at > now() + interval '1 hour'
)
update public.national_federation_selection_members as member
set response_status = 'pending', responded_at = null
from reopened
where member.id = reopened.id;

update public.national_federation_selection_lists as selection_list
set status = 'pending_confirmation', updated_at = now()
where exists (
  select 1
  from public.national_federation_selection_members as member
  where member.selection_list_id = selection_list.id
    and member.response_status = 'pending'
);

insert into public.sporting_director_messages (
  sporting_director_id, season_id, message_type, sender_name, subject,
  preview, body, action_href, action_label, source_reference, is_important
)
select member.owner_director_id, selection_list.season_id,
  'international_selection', country.name || ' · Fédération',
  'Convocation internationale à confirmer',
  rider.first_name || ' ' || rider.last_name || ' est convoqué pour '
    || slot.label || '.',
  'Cette participation exige votre validation. Confirmez ou refusez avant la date limite ; sans réponse, le coureur ne sera pas mobilisé.',
  '/jeu/selections-internationales', 'Répondre à la convocation',
  'federation-auto-callup:' || member.id::text, true
from public.national_federation_selection_members as member
join public.national_federation_selection_lists as selection_list
  on selection_list.id = member.selection_list_id
join public.national_federation_selection_slots as slot
  on slot.slot_key = selection_list.slot_key
join public.seasons as season on season.id = selection_list.season_id
join public.countries as country on country.id = selection_list.country_id
join public.riders as rider on rider.id = member.professional_rider_id
cross join lateral public.get_national_federation_selection_target(
  selection_list.country_id, selection_list.season_id,
  selection_list.slot_key
) as target
where season.status = 'active' and season.game_year = 3
  and member.response_status = 'pending'
  and member.owner_director_id is not null
  and target.departure_at > now() + interval '1 hour'
on conflict (sporting_director_id, source_reference) do nothing;

select public.sync_due_national_federation_championship_lineups(now(), true);

notify pgrst, 'reload schema';

commit;
