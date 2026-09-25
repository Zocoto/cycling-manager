begin;

-- Remplace le balayage de toutes les fédérations après un refus par un
-- remplissage strictement limité à la liste concernée.
create or replace function public.refill_national_federation_professional_selection(
  p_selection_list_id uuid,
  p_now timestamptz default now()
)
returns integer
language plpgsql
volatile
security definer
set search_path = ''
set statement_timeout = '5s'
as $$
declare
  v_list public.national_federation_selection_lists%rowtype;
  v_slot public.national_federation_selection_slots%rowtype;
  v_season public.seasons%rowtype;
  v_country public.countries%rowtype;
  v_departure_at timestamptz;
  v_closes_at timestamptz;
  v_automatic boolean;
  v_selected integer := 0;
  v_added integer := 0;
  v_candidate record;
begin
  select * into v_list
  from public.national_federation_selection_lists
  where id = p_selection_list_id
  for update;

  if v_list.id is null then return 0; end if;

  select * into v_slot
  from public.national_federation_selection_slots
  where slot_key = v_list.slot_key;

  select * into v_season
  from public.seasons
  where id = v_list.season_id
    and status = 'active';

  select * into v_country
  from public.countries
  where id = v_list.country_id;

  if v_season.id is null
     or v_season.game_year < 3
     or v_slot.rider_category <> 'professional'
     or v_slot.competition_code not in (
       'continental_championship', 'world_championship', 'nations_cup'
     ) then
    return 0;
  end if;

  select coalesce(preference.automatic_selection, true)
  into v_automatic
  from (select 1) as singleton
  left join public.national_federation_selection_preferences as preference
    on preference.country_id = v_list.country_id
   and preference.season_id = v_list.season_id;

  if not v_automatic then return 0; end if;
  if v_slot.competition_code in (
       'continental_championship', 'world_championship'
     ) and coalesce(v_season.current_day_number, 0) < 8 then
    return 0;
  end if;

  select target.departure_at
  into v_departure_at
  from public.get_national_federation_selection_target(
    v_list.country_id, v_list.season_id, v_list.slot_key
  ) as target;

  if v_departure_at is null then return 0; end if;

  v_closes_at := v_departure_at - case
    when v_slot.competition_code in (
      'continental_championship', 'world_championship'
    ) then interval '24 hours'
    else interval '1 hour'
  end;

  if p_now >= v_closes_at then return 0; end if;
  if v_slot.competition_code = 'nations_cup'
     and public.federation_professional_call_up_is_due(
       v_slot.competition_code, v_departure_at, p_now
     ) is not true then
    return 0;
  end if;

  update public.national_federation_selection_members
  set response_status = 'declined', responded_at = p_now
  where selection_list_id = v_list.id
    and response_status = 'draft';

  select count(*)::integer into v_selected
  from public.national_federation_selection_members as member
  where member.selection_list_id = v_list.id
    and member.response_status in ('pending', 'confirmed');

  while v_selected < v_slot.rider_limit loop
    select
      rider.id as rider_id,
      ownership.team_id,
      ownership.sporting_director_id
    into v_candidate
    from public.riders as rider
    join public.rider_season_ratings as rating
      on rating.rider_id = rider.id
     and rating.season_id = v_season.id
    left join lateral (
      select contract.team_id, assignment.sporting_director_id
      from public.rider_contracts as contract
      left join public.team_manager_assignments as assignment
        on assignment.team_id = contract.team_id
       and assignment.role = 'general_manager'
       and assignment.status = 'active'
      where contract.rider_id = rider.id
        and contract.status = 'active'
      order by
        (assignment.sporting_director_id is not null) desc,
        contract.created_at desc,
        contract.id desc
      limit 1
    ) as ownership on true
    where rider.country_id = v_list.country_id
      and rider.status in ('active', 'free_agent')
      and not exists (
        select 1
        from public.national_federation_selection_members as member
        where member.selection_list_id = v_list.id
          and member.professional_rider_id = rider.id
      )
      and not exists (
        select 1
        from public.rider_injuries as injury
        where injury.rider_id = rider.id
          and injury.status = 'active'
          and injury.started_at < v_departure_at
          and injury.expected_recovery_at > v_departure_at
      )
      and (
        v_slot.competition_code <> 'nations_cup'
        or not exists (
          select 1
          from public.national_federation_selection_members as other_member
          join public.national_federation_selection_lists as other_list
            on other_list.id = other_member.selection_list_id
          join public.national_federation_selection_slots as other_slot
            on other_slot.slot_key = other_list.slot_key
          where other_list.country_id = v_list.country_id
            and other_list.season_id = v_list.season_id
            and other_list.id <> v_list.id
            and other_slot.competition_code = 'nations_cup'
            and other_member.professional_rider_id = rider.id
            and other_member.response_status in ('pending', 'confirmed')
        )
      )
    order by
      case v_slot.profile_label
        when 'Montagne' then rating.mountain * .42
          + rating.endurance * .18 + rating.recovery * .15
          + rating.hills * .15 + rating.resistance * .10
        when 'Vallons' then rating.hills * .42
          + rating.acceleration * .18 + rating.endurance * .15
          + rating.mountain * .15 + rating.resistance * .10
        when 'Sprint' then rating.sprint * .40
          + rating.acceleration * .25 + rating.flat * .15
          + rating.endurance * .10 + rating.resistance * .10
        when 'Pavés' then rating.cobbles * .40
          + rating.flat * .18 + rating.resistance * .17
          + rating.endurance * .15 + rating.acceleration * .10
        when 'Chrono' then rating.time_trial * .55
          + rating.prologue * .15 + rating.flat * .12
          + rating.endurance * .10 + rating.resistance * .08
        else (rating.mountain + rating.hills + rating.flat + rating.sprint
          + rating.cobbles + rating.endurance + rating.resistance) / 7.0
      end desc,
      rider.id
    limit 1;

    if not found then exit; end if;

    insert into public.national_federation_selection_members (
      selection_list_id,
      professional_rider_id,
      owner_team_id,
      owner_director_id,
      response_status,
      responded_at
    ) values (
      v_list.id,
      v_candidate.rider_id,
      v_candidate.team_id,
      v_candidate.sporting_director_id,
      case when v_candidate.sporting_director_id is null
        then 'confirmed' else 'pending' end,
      case when v_candidate.sporting_director_id is null
        then p_now else null end
    );

    v_selected := v_selected + 1;
    v_added := v_added + 1;
  end loop;

  update public.national_federation_selection_lists
  set
    status = case when exists (
      select 1
      from public.national_federation_selection_members as member
      where member.selection_list_id = v_list.id
        and member.response_status = 'pending'
    ) then 'pending_confirmation' else 'finalized' end,
    created_by_director_id = null,
    published_at = coalesce(published_at, p_now),
    updated_at = case when v_added > 0 then p_now else updated_at end
  where id = v_list.id;

  insert into public.sporting_director_messages (
    sporting_director_id,
    season_id,
    message_type,
    sender_name,
    subject,
    preview,
    body,
    action_href,
    action_label,
    source_reference,
    is_important
  )
  select
    member.owner_director_id,
    v_season.id,
    'international_selection',
    v_country.name || ' · Fédération',
    'Convocation internationale à confirmer',
    rider.first_name || ' ' || rider.last_name || ' est convoqué pour '
      || v_slot.label || '.',
    'La fédération propose ce coureur. Confirmez ou refusez avant la date limite ; sans réponse, il ne sera pas mobilisé.',
    '/jeu/selections-internationales',
    'Répondre à la convocation',
    'federation-auto-callup:' || member.id::text,
    true
  from public.national_federation_selection_members as member
  join public.riders as rider on rider.id = member.professional_rider_id
  where member.selection_list_id = v_list.id
    and member.owner_director_id is not null
    and member.response_status = 'pending'
  on conflict (sporting_director_id, source_reference) do nothing;

  if v_added > 0 then
    insert into public.national_federation_journal_entries (
      country_id,
      season_id,
      day_number,
      category,
      title,
      detail,
      source_reference
    ) values (
      v_list.country_id,
      v_season.id,
      v_season.current_day_number,
      'selection',
      'Convocation de remplacement envoyée',
      v_slot.label || ' · ' || v_added::text
        || ' remplaçant(s) convoqué(s).',
      'federation-targeted-refill:' || v_list.id::text || ':'
        || gen_random_uuid()::text
    );
  end if;

  return v_added;
end;
$$;

revoke all
on function public.refill_national_federation_professional_selection(
  uuid, timestamptz
)
from public, anon, authenticated;

grant execute
on function public.refill_national_federation_professional_selection(
  uuid, timestamptz
)
to service_role;

-- Une liste déjà synchronisée ne doit pas réappliquer les arbitrages de
-- calendrier à chacun de ses coureurs après chaque réponse.
do $migration$
declare
  v_definition text;
  v_anchor constant text := E'      and member.response_status = ''confirmed''\n      and rider.country_id = v_list.country_id';
  v_replacement constant text := E'      and member.response_status = ''confirmed''\n      and not exists (\n        select 1\n        from public.race_rosters as existing_roster\n        where existing_roster.race_registration_id = v_registration_id\n          and existing_roster.rider_id = member.professional_rider_id\n          and existing_roster.status in (''selected'', ''confirmed'')\n      )\n      and rider.country_id = v_list.country_id';
begin
  select replace(pg_catalog.pg_get_functiondef(
    'public.sync_national_federation_championship_lineup(uuid)'::regprocedure
  ), chr(13), '')
  into v_definition;

  if position(v_anchor in v_definition) = 0 then
    raise exception 'Unexpected federation startlist sync definition.';
  end if;

  execute replace(v_definition, v_anchor, v_replacement);
end;
$migration$;

-- La réponse reste atomique : en cas de refus, le remplaçant de cette seule
-- liste est convoqué, puis cette seule start-list est resynchronisée.
do $migration$
declare
  v_definition text;
  v_anchor constant text := E'  perform public.sync_national_federation_championship_lineup(v_list.id);\n  if p_accept and v_member.professional_rider_id is not null and not exists (';
  v_replacement constant text := E'  if not p_accept and v_member.professional_rider_id is not null then\n    perform public.refill_national_federation_professional_selection(\n      v_list.id, now()\n    );\n  end if;\n\n  perform public.sync_national_federation_championship_lineup(v_list.id);\n  if p_accept and v_member.professional_rider_id is not null and not exists (';
begin
  select replace(pg_catalog.pg_get_functiondef(
    'public.respond_to_national_federation_preselection(uuid,boolean)'::regprocedure
  ), chr(13), '')
  into v_definition;

  if position(v_anchor in v_definition) = 0 then
    raise exception 'Unexpected federation response definition.';
  end if;

  execute replace(v_definition, v_anchor, v_replacement);
end;
$migration$;

comment on function public.refill_national_federation_professional_selection(
  uuid, timestamptz
) is
  'Complète uniquement la liste automatique concernée après un refus, sans balayer toutes les fédérations.';

notify pgrst, 'reload schema';

commit;
