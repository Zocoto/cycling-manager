begin;

-- Transitional S3 repair: the correction lands on the day of some CC races.
-- Those invitations cannot respect the future H-24 rule retroactively, so S3
-- gets a one-off H-1 response window.  S4+ keeps the permanent H-24 cutoff.
do $migration$
declare
  v_definition text;
  v_before constant text := E'when slot.competition_code in (\n            ''continental_championship'', ''world_championship''\n          ) then interval ''24 hours''\n          else interval ''1 hour''';
  v_after constant text := E'when season.game_year = 3\n            and slot.competition_code in (\n              ''continental_championship'', ''world_championship''\n            ) then interval ''1 hour''\n          when slot.competition_code in (\n            ''continental_championship'', ''world_championship''\n          ) then interval ''24 hours''\n          else interval ''1 hour''';
begin
  select replace(pg_catalog.pg_get_functiondef(
    'public.get_national_federation_selection_schedule(uuid,uuid)'::regprocedure
  ), chr(13), '') into v_definition;
  if position(v_before in v_definition) = 0 then
    raise exception 'Unexpected federation selection deadline; migration aborted.';
  end if;
  execute replace(v_definition, v_before, v_after);
end;
$migration$;

-- The old producer wrote responded_at and published_at with the exact same
-- timestamp.  This signature cannot be produced by a later human response.
with reopened as (
  select member.id
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
  left join public.national_federation_selection_preferences as preference
    on preference.country_id = selection_list.country_id
   and preference.season_id = selection_list.season_id
  where season.status = 'active' and season.game_year = 3
    and slot.rider_category = 'professional'
    and slot.competition_code in (
      'continental_championship', 'world_championship'
    )
    and selection_list.created_by_director_id is null
    and coalesce(preference.automatic_selection, true)
    and member.owner_director_id is not null
    and member.response_status = 'confirmed'
    and member.responded_at = selection_list.published_at
    and target.departure_at > now() + interval '1 hour'
)
update public.national_federation_selection_members as member
set response_status = 'pending', responded_at = null
from reopened
where member.id = reopened.id;

-- If less than one hour remains, fail closed instead of mobilising a rider
-- who was never asked.  The record remains visible in call-up history.
with closed_without_consent as (
  select member.id
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
    and slot.competition_code in (
      'continental_championship', 'world_championship'
    )
    and selection_list.created_by_director_id is null
    and member.owner_director_id is not null
    and member.response_status = 'confirmed'
    and member.responded_at = selection_list.published_at
    and target.departure_at > now()
    and target.departure_at <= now() + interval '1 hour'
)
update public.national_federation_selection_members as member
set response_status = 'declined', responded_at = now()
from closed_without_consent
where member.id = closed_without_consent.id;

update public.national_federation_selection_lists as selection_list
set status = case when exists (
      select 1
      from public.national_federation_selection_members as member
      where member.selection_list_id = selection_list.id
        and member.response_status = 'pending'
    ) then 'pending_confirmation' else 'finalized' end,
  updated_at = now()
where selection_list.created_by_director_id is null
  and exists (
    select 1 from public.seasons as season
    where season.id = selection_list.season_id
      and season.status = 'active' and season.game_year = 3
  )
  and exists (
    select 1
    from public.national_federation_selection_members as member
    where member.selection_list_id = selection_list.id
      and member.owner_director_id is not null
      and member.response_status in ('pending', 'declined')
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

-- Lists from countries outside the frozen shortlist must not retain an old
-- registration produced before the qualification guard existed.
with ineligible_future_lists as (
  select distinct selection_list.id
  from public.national_federation_selection_lists as selection_list
  join public.national_federation_selection_race_links as link
    on link.selection_list_id = selection_list.id
  join public.national_federation_selection_slots as slot
    on slot.slot_key = selection_list.slot_key
  join public.seasons as season on season.id = selection_list.season_id
  where season.status = 'active' and season.game_year = 3
    and slot.competition_code in (
      'continental_championship', 'world_championship'
    )
    and exists (
      select 1 from public.stages as stage
      where stage.race_edition_id = link.race_edition_id
      group by stage.race_edition_id
      having min(stage.departure_at) > now()
    )
    and not exists (
      select 1
      from public.international_nation_qualification_snapshots as snapshot
      where snapshot.season_id = selection_list.season_id
        and snapshot.competition_code = slot.competition_code
        and snapshot.country_id = selection_list.country_id
        and snapshot.is_qualified = true
    )
)
update public.national_federation_selection_members as member
set response_status = 'declined', responded_at = now()
from ineligible_future_lists as ineligible
where member.selection_list_id = ineligible.id
  and member.response_status in ('draft', 'pending', 'confirmed');

with ineligible_future_registrations as (
  select distinct link.race_registration_id
  from public.national_federation_selection_race_links as link
  join public.national_federation_selection_lists as selection_list
    on selection_list.id = link.selection_list_id
  join public.national_federation_selection_slots as slot
    on slot.slot_key = selection_list.slot_key
  join public.seasons as season on season.id = selection_list.season_id
  where season.status = 'active' and season.game_year = 3
    and slot.competition_code in (
      'continental_championship', 'world_championship'
    )
    and exists (
      select 1 from public.stages as stage
      where stage.race_edition_id = link.race_edition_id
      group by stage.race_edition_id
      having min(stage.departure_at) > now()
    )
    and not exists (
      select 1
      from public.international_nation_qualification_snapshots as snapshot
      where snapshot.season_id = selection_list.season_id
        and snapshot.competition_code = slot.competition_code
        and snapshot.country_id = selection_list.country_id
        and snapshot.is_qualified = true
    )
)
update public.race_rosters as roster
set status = 'withdrawn'
from ineligible_future_registrations as ineligible
where roster.race_registration_id = ineligible.race_registration_id
  and roster.status in ('selected', 'confirmed');

with ineligible_future_registrations as (
  select distinct link.race_registration_id
  from public.national_federation_selection_race_links as link
  join public.national_federation_selection_lists as selection_list
    on selection_list.id = link.selection_list_id
  join public.national_federation_selection_slots as slot
    on slot.slot_key = selection_list.slot_key
  join public.seasons as season on season.id = selection_list.season_id
  where season.status = 'active' and season.game_year = 3
    and slot.competition_code in (
      'continental_championship', 'world_championship'
    )
    and exists (
      select 1 from public.stages as stage
      where stage.race_edition_id = link.race_edition_id
      group by stage.race_edition_id
      having min(stage.departure_at) > now()
    )
    and not exists (
      select 1
      from public.international_nation_qualification_snapshots as snapshot
      where snapshot.season_id = selection_list.season_id
        and snapshot.competition_code = slot.competition_code
        and snapshot.country_id = selection_list.country_id
        and snapshot.is_qualified = true
    )
)
update public.race_registrations as registration
set status = 'withdrawn', decided_at = now()
from ineligible_future_registrations as ineligible
where registration.id = ineligible.race_registration_id
  and registration.status = 'accepted';

-- Remove reopened riders from the startlist immediately, fill any vacancy
-- with the next candidate and notify that candidate in the same deployment.
select public.sync_due_national_federation_championship_lineups(now(), true);

comment on function public.get_national_federation_selection_schedule(uuid,uuid) is
  'Sélections fédérales : clôture H-24 dès S4 ; fenêtre transitoire H-1 en S3 pour recueillir les accords manquants après correction.';

notify pgrst, 'reload schema';

commit;
