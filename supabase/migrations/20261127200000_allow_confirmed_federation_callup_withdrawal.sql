begin;
set local lock_timeout = '500ms';
set local statement_timeout = '10s';

alter table public.national_federation_selection_members
  drop constraint national_federation_selection_members_response_allowed,
  add constraint national_federation_selection_members_response_allowed
    check (response_status in ('draft', 'pending', 'confirmed', 'declined', 'ineligible', 'withdrawn')) not valid;

create function private.federation_callup_withdrawal_closes_at(
  p_game_year integer, p_slot_key text, p_competition_code text,
  p_rider_category text, p_departure_at timestamptz, p_selection_closes_at timestamptz
)
returns timestamptz language sql immutable set search_path = ''
as $$
  select case when p_departure_at is not null then least(
    public.get_national_federation_callup_response_closes_at(p_competition_code, p_rider_category, p_departure_at),
    p_departure_at - interval '1 hour',
    case when p_competition_code = 'nations_cup' and p_game_year >= 4 and p_game_year % 4 = 0
      and p_slot_key in ('nc-hills', 'nc-time-trial') then p_selection_closes_at end
  ) end;
$$;

create function private.federation_callup_race_is_editable(p_edition_id uuid, p_category text)
returns boolean language sql stable set search_path = ''
as $$
  select case when p_category = 'junior' then exists (
    select 1 from public.development_race_editions as edition
    where edition.id = p_edition_id and edition.status = 'planned' and edition.simulated_at is null
  ) else exists (
    select 1 from public.race_editions as edition
    where edition.id = p_edition_id and edition.status in ('planned', 'registration_open', 'registration_closed')
      and exists (select 1 from public.stages as stage
        where stage.race_edition_id = edition.id and stage.status <> 'cancelled')
      and not exists (
        select 1 from public.stages as stage
        where stage.race_edition_id = edition.id and stage.status <> 'cancelled'
          and (stage.status in ('in_progress', 'completed')
            or exists (select 1 from public.official_stage_simulations as simulation where simulation.stage_id = stage.id)
            or exists (select 1 from public.official_stage_simulation_claims as claim where claim.stage_id = stage.id))
      )
  ) end;
$$;

-- Reuse the existing junior selection policy. The private form accepts a list
-- to replace a departed rider without touching other nations or dropping any
-- pending members. The public edition-wide worker retains its previous mode.
do $junior_and_manual$
declare
  v_definition text;
  v_anchor text;
  v_list_start integer;
  v_members_start integer;
  v_limit text := E'    limit greatest(0, v_edition.selection_maximum - (\n      select count(*) from public.national_federation_selection_members\n      where selection_list_id = v_list_id and response_status = ''confirmed''));';
  v_sync text := '    perform public.sync_national_federation_junior_lineup(v_list_id);';
begin
  select replace(pg_get_functiondef('public.ensure_automatic_federation_junior_lineups(uuid)'::regprocedure), chr(13), '')
    into v_definition;
  v_list_start := position('    insert into public.national_federation_selection_lists (' in v_definition);
  v_members_start := position('    insert into public.national_federation_selection_members (' in v_definition);
  if position('public.ensure_automatic_federation_junior_lineups(p_race_edition_id uuid)' in v_definition) = 0
    or position('where country.is_active = true' in v_definition) = 0
    or v_list_start = 0 or v_members_start <= v_list_start
    or position('where selection_list_id = v_list_id and response_status in (''draft'', ''pending'');' in v_definition) = 0
    or position(v_limit in v_definition) = 0 or position(v_sync in v_definition) = 0
    or position('kept.selection_list_id = v_list_id and kept.junior_rider_id = academy.id' in v_definition) = 0 then
    raise exception 'Unexpected junior callup rotation definition';
  end if;
  v_definition := overlay(v_definition placing E'    v_list_id := p_selection_list_id;\n\n'
    from v_list_start for v_members_start - v_list_start);
  v_definition := replace(v_definition,
    'public.ensure_automatic_federation_junior_lineups(p_race_edition_id uuid)',
    'private.refill_federation_junior_callup(p_race_edition_id uuid, p_selection_list_id uuid)');
  v_definition := replace(v_definition, 'where country.is_active = true', $target$where country.is_active = true
      and exists (
        select 1 from public.national_federation_selection_lists as target
        where target.id = p_selection_list_id and target.country_id = country.id
          and target.season_id = v_season.id and target.slot_key = v_slot_key
          and target.published_at is not null
      )$target$);
  v_definition := replace(v_definition, v_limit, $count$    limit least(1, greatest(0, v_edition.selection_maximum - (
      select count(*) from public.national_federation_selection_members
      where selection_list_id = v_list_id and response_status in ('pending', 'confirmed')
    )));$count$);
  execute replace(v_definition, v_sync, '');

  select replace(pg_get_functiondef('public.save_national_federation_preselection(text,text,uuid[])'::regprocedure), chr(13), '')
    into v_definition;
  v_anchor := E'  delete from public.national_federation_selection_members\n  where selection_list_id = v_list_id and response_status <> ''confirmed''';
  if position(v_anchor in v_definition) = 0 then raise exception 'Missing preserved selection members guard'; end if;
  execute replace(v_definition, v_anchor, $manual$  if exists (
    select 1 from public.national_federation_selection_members
    where selection_list_id = v_list_id and response_status = 'withdrawn'
      and coalesce(professional_rider_id, junior_rider_id) = any(v_rider_ids)
  ) then
    raise exception 'Un coureur désisté ne peut plus être convoqué pour cette épreuve.';
  end if;
  delete from public.national_federation_selection_members
  where selection_list_id = v_list_id and response_status not in ('confirmed', 'withdrawn')$manual$);
end;
$junior_and_manual$;

create function public.withdraw_confirmed_national_federation_callup(p_member_id uuid)
returns text language plpgsql volatile security definer set search_path = ''
set lock_timeout = '500ms' set statement_timeout = '8s'
as $$
declare
  v_auth_user_id uuid := auth.uid();
  v_list_id uuid;
  v_rider_category text;
  v_list public.national_federation_selection_lists%rowtype;
  v_member public.national_federation_selection_members%rowtype;
  v_slot public.national_federation_selection_slots%rowtype;
  v_season public.seasons%rowtype;
  v_schedule record;
  v_edition_id uuid;
  v_day_id uuid;
  v_president_id uuid;
  v_country_code text;
  v_rider_name text;
  v_now timestamptz;
  v_deadline timestamptz;
  v_reference text;
  v_description text;
  v_metadata jsonb;
begin
  -- Match the startlist writer's advisory→list order, then lock the member.
  -- Ordinary responses already holding the list must never wait on us:
  -- acquire our locks without waiting and let the DS retry a busy selection.
  select list.id, slot.rider_category into v_list_id, v_rider_category
  from public.national_federation_selection_members as member
  join public.national_federation_selection_lists as list on list.id = member.selection_list_id
  join public.national_federation_selection_slots as slot on slot.slot_key = list.slot_key
  join public.seasons as season on season.id = list.season_id and season.status = 'active'
  join public.sporting_directors as director on director.id = member.owner_director_id
    and director.auth_user_id = v_auth_user_id and director.status = 'active'
  join public.team_manager_assignments as assignment on assignment.sporting_director_id = director.id
    and assignment.team_id = member.owner_team_id and assignment.role = 'general_manager' and assignment.status = 'active'
  join public.teams as team on team.id = assignment.team_id and team.status = 'active'
  where member.id = p_member_id and list.published_at is not null;
  if not found then raise exception 'Cette demande ne concerne pas votre équipe.' using errcode = '42501'; end if;

  -- Every member change invokes the junior trigger, even on a pro list.
  -- Follow the naturalization flow: take junior first, then pro if needed.
  if not pg_catalog.pg_try_advisory_xact_lock(pg_catalog.hashtextextended('federation-junior-startlist:' || v_list_id::text, 0)) then
    raise lock_not_available;
  end if;
  if v_rider_category = 'professional' and not pg_catalog.pg_try_advisory_xact_lock(
    pg_catalog.hashtextextended('federation-startlist:' || v_list_id::text, 0)
  ) then
    raise lock_not_available;
  end if;
  select list.* into v_list from public.national_federation_selection_lists as list
  where list.id = v_list_id and list.published_at is not null for update nowait;
  if not found then raise exception 'Cette demande ne concerne pas votre équipe.' using errcode = '42501'; end if;

  select * into v_member from public.national_federation_selection_members as member
  where member.id = p_member_id and member.selection_list_id = v_list.id
    and exists (
      select 1 from public.sporting_directors as director
      join public.team_manager_assignments as assignment on assignment.sporting_director_id = director.id
        and assignment.team_id = member.owner_team_id and assignment.role = 'general_manager' and assignment.status = 'active'
      join public.teams as team on team.id = assignment.team_id and team.status = 'active'
      where director.id = member.owner_director_id and director.auth_user_id = v_auth_user_id and director.status = 'active'
    )
  for update nowait;
  if not found then raise exception 'Cette demande ne concerne pas votre équipe.' using errcode = '42501'; end if;
  if v_member.response_status = 'withdrawn' then return 'withdrawn'; end if;
  if v_member.response_status is distinct from 'confirmed' then
    raise exception 'Seule une participation confirmée peut faire l’objet d’un désistement.';
  end if;

  select * into strict v_season from public.seasons where id = v_list.season_id;
  select * into strict v_slot from public.national_federation_selection_slots where slot_key = v_list.slot_key;
  select schedule.* into v_schedule
  from public.get_national_federation_selection_schedule(v_list.country_id, v_list.season_id) as schedule
  where schedule.slot_key = v_list.slot_key;
  v_edition_id := v_schedule.race_edition_id;
  v_now := clock_timestamp();
  v_deadline := private.federation_callup_withdrawal_closes_at(
    v_season.game_year, v_slot.slot_key, v_slot.competition_code, v_slot.rider_category,
    v_schedule.departure_at, v_schedule.closes_at);
  if v_edition_id is null or v_deadline is null or v_now >= v_deadline then
    raise exception 'Le délai de désistement est dépassé ou le calendrier est indisponible.';
  end if;

  if v_slot.rider_category = 'junior' then
    perform 1 from public.development_race_editions as edition
    where edition.id = v_edition_id and edition.season_id = v_season.id
      and edition.status = 'planned' and edition.simulated_at is null for update nowait;
    if not found then raise exception 'La startlist est déjà verrouillée.'; end if;
  elsif not private.lock_editable_naturalization_callup_race(v_edition_id, v_now) then
    raise exception 'La startlist est déjà verrouillée.';
  end if;

  -- Calendar updates or a changed heat assignment can race the first read.
  -- Validate the same edition and its deadline again with the race locked.
  select schedule.* into v_schedule
  from public.get_national_federation_selection_schedule(v_list.country_id, v_list.season_id) as schedule
  where schedule.slot_key = v_list.slot_key;
  v_deadline := private.federation_callup_withdrawal_closes_at(
    v_season.game_year, v_slot.slot_key, v_slot.competition_code, v_slot.rider_category,
    v_schedule.departure_at, v_schedule.closes_at);
  v_now := clock_timestamp();
  if v_schedule.race_edition_id is distinct from v_edition_id or v_deadline is null or v_now >= v_deadline then
    raise exception 'Le délai de désistement est dépassé ou le calendrier est indisponible.';
  end if;
  if public.get_federation_callup_ineligibility_reason(v_member.id, v_schedule.departure_at) is not null then
    raise exception 'Cette convocation n’est plus valable : le coureur n’est plus éligible.';
  end if;

  select day.id into strict v_day_id from public.season_days as day
  where day.season_id = v_season.id and day.day_number = v_season.current_day_number;
  update public.national_federation_selection_members
  set response_status = 'withdrawn', responded_at = v_now where id = v_member.id;

  v_reference := 'international-callup-withdrawal:' || v_schedule.race_edition_id::text;
  v_description := 'Désistement après confirmation — ' || v_schedule.label;
  v_metadata := jsonb_build_object('selectionMemberId', v_member.id, 'selectionListId', v_list.id,
    'raceEditionId', v_schedule.race_edition_id, 'slotKey', v_slot.slot_key, 'decision', 'withdrawn');
  if v_member.professional_rider_id is not null then
    perform public.apply_rider_morale_event(v_member.professional_rider_id, v_day_id,
      'international_callup_refusal', v_reference, -10, v_description, v_metadata);
    perform public.refill_national_federation_professional_selection(v_list.id, v_now);
    perform public.sync_national_federation_championship_lineup(v_list.id);
  else
    perform public.apply_youth_rider_morale_event(v_member.junior_rider_id, v_day_id,
      'international_callup_refusal', v_reference, -10, v_description, v_metadata);
    perform private.refill_federation_junior_callup(v_schedule.race_edition_id, v_list.id);
  end if;

  update public.national_federation_selection_lists as list
  set status = case when exists (select 1 from public.national_federation_selection_members as member
      where member.selection_list_id = list.id and member.response_status = 'pending')
    then 'pending_confirmation' else 'finalized' end,
    updated_at = v_now
  where list.id = v_list.id;

  -- Junior trigger synchronization uses the same parent list and edition.
  -- Do not report success if either startlist still includes the departed rider.
  if v_member.professional_rider_id is not null and exists (
    select 1 from public.national_federation_selection_race_links as link
    join public.race_rosters as roster on roster.race_registration_id = link.race_registration_id
    where link.selection_list_id = v_list.id and roster.rider_id = v_member.professional_rider_id
      and roster.status in ('selected', 'confirmed')
  ) or v_member.junior_rider_id is not null and exists (
    select 1 from public.national_federation_junior_race_registrations as registration
    join public.national_federation_junior_race_registration_riders as roster on roster.registration_id = registration.id
    where registration.selection_list_id = v_list.id and roster.academy_rider_id = v_member.junior_rider_id
  ) then
    raise exception 'Le désistement n’a pas pu être répercuté sur la startlist.';
  end if;

  -- Preserve the invitation as mail history and clear its unread alert.
  update public.sporting_director_messages as message set read_at = v_now
  where message.sporting_director_id = v_member.owner_director_id and message.season_id = v_season.id
    and message.message_type = 'international_selection' and message.read_at is null
    and (message.source_reference = 'federation-auto-callup:' || v_member.id::text
      or message.source_reference like 'federation-selection:' || v_member.id::text || ':revision:%');

  select country.iso_alpha2 into strict v_country_code from public.countries as country where country.id = v_list.country_id;
  select coalesce(
    (select rider.first_name || ' ' || rider.last_name from public.riders as rider where rider.id = v_member.professional_rider_id),
    (select rider.first_name || ' ' || rider.last_name from public.youth_academy_riders as rider where rider.id = v_member.junior_rider_id),
    'Le coureur') into v_rider_name;
  select term.president_director_id into v_president_id from public.national_federation_terms as term
  where term.country_id = v_list.country_id and v_season.game_year between term.start_game_year and term.end_game_year
  order by term.start_game_year desc limit 1;
  v_reference := 'federation-selection:' || v_member.id::text || ':withdrawn';
  if v_president_id is not null and v_president_id <> v_member.owner_director_id then
    insert into public.sporting_director_messages (sporting_director_id, season_id, message_type, sender_name,
      subject, preview, body, action_href, action_label, source_reference, is_important)
    values (v_president_id, v_season.id, 'international_selection', 'Sélections internationales',
      'Désistement après confirmation', v_rider_name || ' se désiste pour ' || v_schedule.label || '.',
      'Le coureur a été retiré de la startlist. Consultez la sélection pour suivre son remplacement.',
      '/jeu/federations/' || lower(v_country_code) || '?onglet=selections', 'Voir la sélection', v_reference, true)
    on conflict (sporting_director_id, source_reference) do nothing;
  end if;
  insert into public.national_federation_journal_entries (country_id, season_id, day_number, category, title, detail, source_reference)
  values (v_list.country_id, v_season.id, v_season.current_day_number, 'selection', 'Désistement après confirmation',
    v_rider_name || ' · ' || v_schedule.label, v_reference)
  on conflict (source_reference) do nothing;
  return 'withdrawn';
exception when lock_not_available then
  raise exception 'La sélection est en cours de mise à jour. Réessayez dans un instant.' using errcode = '55P03';
end;
$$;

-- Keep the reader's existing scoped schedules and eligibility CTE. Extending
-- its composite return type requires recreation and explicit ACL restoration.
do $reader$
declare
  v_definition text;
  v_signature text := 'conflicting_race_names text[])';
  v_columns text := '    coalesce(conflicts.race_names, array[]::text[])';
  v_join text := ') as response_deadline';
begin
  select replace(pg_get_functiondef('public.get_current_director_federation_callups()'::regprocedure), chr(13), '')
    into v_definition;
  if position(v_signature in v_definition) = 0 or position(v_columns in v_definition) = 0
    or position(v_join in v_definition) = 0 or position('callup_eligibility_v1' in v_definition) = 0 then
    raise exception 'Unexpected callup reader definition';
  end if;
  v_definition := replace(v_definition, v_signature,
    'conflicting_race_names text[], race_edition_id uuid, withdrawal_closes_at timestamp with time zone, can_withdraw boolean)');
  v_definition := replace(v_definition, v_columns, $columns$    coalesce(conflicts.race_names, array[]::text[]),
    schedule.race_edition_id, withdrawal_deadline.closes_at,
    case when member.response_status = 'confirmed' and eligibility.reason is null
      and now() < withdrawal_deadline.closes_at then
      private.federation_callup_race_is_editable(schedule.race_edition_id, slot.rider_category)
    else false end$columns$);
  v_definition := replace(v_definition, v_join, $join$) as response_deadline
  cross join lateral (
    select private.federation_callup_withdrawal_closes_at(season.game_year, slot.slot_key,
      slot.competition_code, slot.rider_category, schedule.departure_at, schedule.closes_at) as closes_at
  ) as withdrawal_deadline$join$);
  drop function public.get_current_director_federation_callups();
  execute v_definition;
end;
$reader$;

revoke all on function private.federation_callup_withdrawal_closes_at(integer, text, text, text, timestamptz, timestamptz)
  from public, anon, authenticated, service_role;
revoke all on function private.federation_callup_race_is_editable(uuid, text),
  private.refill_federation_junior_callup(uuid, uuid) from public, anon, authenticated, service_role;
revoke all on function public.withdraw_confirmed_national_federation_callup(uuid),
  public.get_current_director_federation_callups() from public, anon, authenticated, service_role;
grant execute on function public.withdraw_confirmed_national_federation_callup(uuid) to authenticated;
grant execute on function public.get_current_director_federation_callups() to authenticated, service_role;

notify pgrst, 'reload schema';
commit;
