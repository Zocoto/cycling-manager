CREATE OR REPLACE FUNCTION public.prepare_due_automatic_federation_professional_lineups(p_now timestamp with time zone DEFAULT now())
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
 SET statement_timeout TO '150s'
AS $function$
declare
  v_season public.seasons%rowtype;
  v_slot record;
  v_country record;
  v_expired record;
  v_edition_id uuid;
  v_departure_at timestamptz;
  v_closes_at timestamptz;
  v_automatic boolean;
  v_list public.national_federation_selection_lists%rowtype;
  v_selected integer;
  v_added integer;
  v_candidate record;
  v_total integer := 0;
begin
  -- callup_eligibility_v1
  perform public.reconcile_federation_callup_eligibility(p_now);
  select * into v_season
  from public.seasons as season
  where season.status = 'active'
  limit 1;
  if v_season.id is null or v_season.game_year < 3 then return 0; end if;

  perform public.ensure_professional_nations_cup(v_season.id);
  perform public.freeze_due_international_nation_qualifications(p_now);

  -- Expire unresolved calls before looking for replacements.  They are not
  -- selected, and are retained in history as declined for auditability.
  for v_expired in
    select selection_list.id
    from public.national_federation_selection_lists as selection_list
    join public.national_federation_selection_slots as slot
      on slot.slot_key = selection_list.slot_key
    cross join lateral public.get_national_federation_selection_target(
      selection_list.country_id,
      selection_list.season_id,
      selection_list.slot_key
    ) as target
    where selection_list.season_id = v_season.id
      and slot.rider_category = 'professional'
      and public.get_national_federation_callup_response_closes_at(
        slot.competition_code,
        slot.rider_category,
        target.departure_at
      ) <= p_now
      and exists (
        select 1
        from public.national_federation_selection_members as member
        where member.selection_list_id = selection_list.id
          and member.response_status = 'pending'
      )
  loop
    update public.national_federation_selection_members
    set response_status = 'declined', responded_at = p_now
    where selection_list_id = v_expired.id
      and response_status = 'pending';
    update public.national_federation_selection_lists
    set status = 'finalized', updated_at = p_now
    where id = v_expired.id;
  end loop;

  for v_slot in
    select slot.*
    from public.national_federation_selection_slots as slot
    where slot.rider_category = 'professional'
      and slot.competition_code in (
        'continental_championship', 'world_championship', 'nations_cup'
      )
      and slot.active_from_game_year <= v_season.game_year
      and public.federation_selection_slot_is_available(slot.slot_key, v_season.game_year)
    order by slot.day_number, slot.slot_key
  loop
    if v_slot.competition_code in (
      'continental_championship', 'world_championship'
    ) and coalesce(v_season.current_day_number, 0) < 8 then
      continue;
    end if;

    for v_country in
      select country.id, country.name, country.iso_alpha2,
        country.continent_code
      from public.countries as country
      where country.is_active = true
        and exists (
          select 1 from public.riders as rider
          join public.rider_season_ratings as rating
            on rating.rider_id = rider.id and rating.season_id = v_season.id
          where rider.country_id = country.id
            and rider.status in ('active', 'free_agent')
        )
      order by country.id
    loop
      v_edition_id := null;
      v_departure_at := null;
      select target.race_edition_id, target.departure_at
      into v_edition_id, v_departure_at
      from public.get_national_federation_selection_target(
        v_country.id, v_season.id, v_slot.slot_key
      ) as target;
      if v_edition_id is null then continue; end if;

      v_closes_at :=
        public.get_national_federation_callup_response_closes_at(
          v_slot.competition_code,
          v_slot.rider_category,
          v_departure_at
        );
      if p_now >= v_closes_at then continue; end if;
      if v_slot.competition_code = 'nations_cup'
         and public.federation_selection_automatic_callup_is_due(
           v_season.id,v_slot.slot_key,v_slot.competition_code,v_departure_at,p_now
         ) is not true then
        continue;
      end if;

      select coalesce(preference.automatic_selection, true)
      into v_automatic
      from (select 1) as singleton
      left join public.national_federation_selection_preferences as preference
        on preference.country_id = v_country.id
       and preference.season_id = v_season.id;
      if not v_automatic then continue; end if;

      v_list.id := null;
      select * into v_list
      from public.national_federation_selection_lists as selection_list
      where selection_list.country_id = v_country.id
        and selection_list.season_id = v_season.id
        and selection_list.slot_key = v_slot.slot_key
      for update;

      if v_list.id is null then
        insert into public.national_federation_selection_lists (
          country_id, season_id, slot_key, status, revision,
          created_by_director_id, published_at, updated_at
        ) values (
          v_country.id, v_season.id, v_slot.slot_key,
          'pending_confirmation', 1, null, p_now, p_now
        ) returning * into v_list;
      else
        -- A draft cannot silently become a federation decision when automatic
        -- mode takes over.  Confirmed and already pending calls are preserved.
        update public.national_federation_selection_members
        set response_status = 'declined', responded_at = p_now
        where selection_list_id = v_list.id
          and response_status = 'draft';
      end if;

      select count(*)::integer into v_selected
      from public.national_federation_selection_members as member
      where member.selection_list_id = v_list.id
        and member.response_status in ('pending', 'confirmed');
      v_added := 0;

      while v_selected < public.get_federation_selection_rider_limit(v_country.id,v_season.id,v_slot.slot_key) loop
        select rider.id as rider_id, ownership.team_id,
          ownership.sporting_director_id
        into v_candidate
        from public.riders as rider
        join public.rider_season_ratings as rating
          on rating.rider_id = rider.id and rating.season_id = v_season.id
        left join lateral (
          select contract.team_id, assignment.sporting_director_id
          from public.rider_contracts as contract
          left join public.team_manager_assignments as assignment
            on assignment.team_id = contract.team_id
           and assignment.role = 'general_manager'
           and assignment.status = 'active'
          where contract.rider_id = rider.id and contract.status = 'active'
          order by (assignment.sporting_director_id is not null) desc,
            contract.created_at desc, contract.id desc
          limit 1
        ) as ownership on true
        where rider.country_id = v_country.id
          and rider.status in ('active', 'free_agent')
          and not exists (
            select 1
            from public.national_federation_selection_members as member
            where member.selection_list_id = v_list.id
              and member.professional_rider_id = rider.id
          )
          and not exists (
            select 1 from public.rider_injuries as injury
            where injury.rider_id = rider.id and injury.status = 'active'
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
              where other_list.country_id = v_country.id
                and other_list.season_id = v_season.id
                and other_list.id <> v_list.id
                and public.federation_selection_slot_is_available(other_list.slot_key, v_season.game_year)
                and other_slot.competition_code = 'nations_cup'
                and other_member.professional_rider_id = rider.id
                and other_member.response_status in ('pending', 'confirmed')
            )
          )
        order by
          case (case when v_season.game_year % 4 = 0 and v_slot.slot_key = 'nc-hills' then 'Olympique' else v_slot.profile_label end)
            when 'Olympique' then rating.mountain * .26 + rating.hills * .18 + rating.cobbles * .16
          + rating.endurance * .15 + rating.resistance * .10 + rating.sprint * .09 + rating.acceleration * .06
        when 'Montagne' then rating.mountain * .42 + rating.endurance * .18 + rating.recovery * .15 + rating.hills * .15 + rating.resistance * .10
            when 'Vallons' then rating.hills * .42 + rating.acceleration * .18 + rating.endurance * .15 + rating.mountain * .15 + rating.resistance * .10
            when 'Sprint' then rating.sprint * .40 + rating.acceleration * .25 + rating.flat * .15 + rating.endurance * .10 + rating.resistance * .10
            when 'Pavés' then rating.cobbles * .40 + rating.flat * .18 + rating.resistance * .17 + rating.endurance * .15 + rating.acceleration * .10
            when 'Chrono' then rating.time_trial * .55 + rating.prologue * .15 + rating.flat * .12 + rating.endurance * .10 + rating.resistance * .08
            else (rating.mountain + rating.hills + rating.flat + rating.sprint + rating.cobbles + rating.endurance + rating.resistance) / 7.0
          end desc,
          rider.id
        limit 1;
        if v_candidate.rider_id is null then exit; end if;

        insert into public.national_federation_selection_members (
          selection_list_id, professional_rider_id, owner_team_id,
          owner_director_id, response_status, responded_at
        ) values (
          v_list.id, v_candidate.rider_id, v_candidate.team_id,
          v_candidate.sporting_director_id,
          case when v_candidate.sporting_director_id is null
            then 'confirmed' else 'pending' end,
          case when v_candidate.sporting_director_id is null
            then p_now else null end
        );
        v_selected := v_selected + 1;
        v_added := v_added + 1;
        v_total := v_total + 1;
      end loop;

      update public.national_federation_selection_lists
      set status = case when exists (
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
        sporting_director_id, season_id, message_type, sender_name, subject,
        preview, body, action_href, action_label, source_reference,
        is_important
      )
      select member.owner_director_id, v_season.id,
        'international_selection', v_country.name || ' · Fédération',
        'Convocation internationale à confirmer',
        rider.first_name || ' ' || rider.last_name || ' est convoqué pour '
          || public.federation_selection_slot_label(v_slot.slot_key, v_slot.label, v_season.game_year) || '.',
        'La fédération propose ce coureur. Confirmez ou refusez avant la date limite ; sans réponse, il ne sera pas mobilisé.',
        '/jeu/selections-internationales', 'Répondre à la convocation',
        'federation-auto-callup:' || member.id::text, true
      from public.national_federation_selection_members as member
      join public.riders as rider on rider.id = member.professional_rider_id
      where member.selection_list_id = v_list.id
        and member.owner_director_id is not null
        and member.response_status = 'pending'
      on conflict (sporting_director_id, source_reference) do nothing;

      if v_added > 0 then
        insert into public.national_federation_journal_entries (
          country_id, season_id, day_number, category, title, detail,
          source_reference
        ) values (
          v_country.id, v_season.id, v_season.current_day_number,
          'selection', 'Convocations automatiques envoyées',
          public.federation_selection_slot_label(v_slot.slot_key, v_slot.label, v_season.game_year) || ' · ' || v_added::text
            || ' nouvelle(s) convocation(s), sans validation implicite.',
          'federation-auto-callups:' || v_list.id::text || ':'
            || extract(epoch from p_now)::bigint::text
        ) on conflict (source_reference) do nothing;
      end if;
    end loop;
  end loop;
  return v_total;
end;
$function$
