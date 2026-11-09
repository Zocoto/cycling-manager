begin;
set local lock_timeout = '500ms';
set local statement_timeout = '8s';

-- The simulator can claim a stage before departure. Use the same safety margin
-- as future-race transfers and keep frozen entries for results and replays.
create or replace function private.lock_editable_naturalization_callup_race(
  p_race_edition_id uuid,
  p_now timestamptz
)
returns boolean
language plpgsql
set search_path = ''
as $$
begin
  perform 1
  from public.race_editions as edition
  where edition.id = p_race_edition_id
    and edition.status in ('planned', 'registration_open', 'registration_closed')
  for update nowait;
  if not found then return false; end if;

  perform 1
  from public.stages as stage
  where stage.race_edition_id = p_race_edition_id and stage.status <> 'cancelled'
  order by stage.id
  for update nowait;
  if not found then return false; end if;

  return not exists (
    select 1
    from public.stages as stage
    where stage.race_edition_id = p_race_edition_id
      and stage.status <> 'cancelled'
      and (
        stage.status in ('in_progress', 'completed')
        or stage.departure_at <= greatest(p_now, clock_timestamp()) + interval '7 minutes'
        or exists (
          select 1 from public.official_stage_simulations as simulation
          where simulation.stage_id = stage.id
        )
        or exists (
          select 1 from public.official_stage_simulation_claims as claim
          where claim.stage_id = stage.id
        )
      )
  );
end;
$$;

create or replace function private.withdraw_naturalization_callup_roster(
  p_registration_id uuid,
  p_rider_id uuid,
  p_now timestamptz
)
returns void
language plpgsql
set search_path = ''
as $$
begin
  perform 1
  from public.race_registrations as registration
  where registration.id = p_registration_id
    and registration.entry_method = 'automatic'
    and registration.status in ('pending', 'accepted')
  for update nowait;
  if not found then return; end if;

  update public.race_rosters as roster
  set status = 'withdrawn'
  where roster.race_registration_id = p_registration_id and roster.rider_id = p_rider_id
    and roster.status in ('selected', 'confirmed');

  if found and not exists (
    select 1 from public.race_rosters as roster
    where roster.race_registration_id = p_registration_id
      and roster.status in ('selected', 'confirmed')
  ) then
    update public.race_registrations
    set status = 'withdrawn', decided_at = p_now
    where id = p_registration_id;
  end if;
end;
$$;

create or replace function private.reconcile_rider_callup_nationality(
  p_professional_rider_id uuid,
  p_junior_rider_id uuid,
  p_old_country_id uuid,
  p_new_country_id uuid,
  p_now timestamptz
)
returns void
language plpgsql
security definer
set search_path = ''
set lock_timeout = '500ms'
as $$
declare
  v_season_id uuid;
  v_member_ids uuid[];
  v_callup record;
  v_edition_id uuid;
  v_registration_id uuid;
begin
  if (p_professional_rider_id is null) = (p_junior_rider_id is null)
     or p_old_country_id is null or p_new_country_id is null
     or p_old_country_id = p_new_country_id or p_now is null then
    return;
  end if;

  select season.id into v_season_id from public.seasons as season
  where season.status = 'active' order by season.game_year desc limit 1;
  if v_season_id is null then return; end if;

  select array_agg(member.id) into v_member_ids
  from public.national_federation_selection_lists as list
  join public.national_federation_selection_members as member on member.selection_list_id = list.id
  where list.country_id = p_old_country_id and list.season_id = v_season_id
    and (member.professional_rider_id = p_professional_rider_id or member.junior_rider_id = p_junior_rider_id)
    and member.response_status in ('draft', 'pending', 'confirmed');

  if v_member_ids is not null then
    for v_callup in
      with schedule as materialized (
        select * from public.get_national_federation_selection_schedule(p_old_country_id, v_season_id)
      )
      select member.id, member.selection_list_id, schedule.race_edition_id, schedule.departure_at
      from public.national_federation_selection_members as member
      join public.national_federation_selection_lists as list on list.id = member.selection_list_id
      left join schedule on schedule.slot_key = list.slot_key
      where member.id = any(v_member_ids)
      order by list.id, member.id
    loop
      -- Updating either kind of list runs the existing junior lineup trigger.
      -- Avoid waiting here while the naturalization already holds the rider lock.
      if not pg_catalog.pg_try_advisory_xact_lock(pg_catalog.hashtextextended(
        'federation-junior-startlist:' || v_callup.selection_list_id::text, 0
      )) or (
        p_professional_rider_id is not null
        and not pg_catalog.pg_try_advisory_xact_lock(pg_catalog.hashtextextended(
          'federation-startlist:' || v_callup.selection_list_id::text, 0
        ))
      ) then
        raise lock_not_available;
      end if;

      perform 1
      from public.national_federation_selection_lists as list
      where list.id = v_callup.selection_list_id
      for update nowait;
      if not found then continue; end if;

      -- Read links after acquiring the writer locks. A concurrent response may
      -- have created a lineup since we identified the affected member.
      if p_professional_rider_id is not null then
        select link.race_edition_id, link.race_registration_id
        into v_edition_id, v_registration_id
        from public.national_federation_selection_race_links as link
        where link.selection_list_id = v_callup.selection_list_id;
      else
        select junior.race_edition_id into v_edition_id
        from public.national_federation_junior_race_registrations as junior
        where junior.selection_list_id = v_callup.selection_list_id;
        v_registration_id := null;
      end if;

      v_edition_id := coalesce(v_edition_id, v_callup.race_edition_id);
      if v_edition_id is null then
        if v_callup.departure_at is null
           or v_callup.departure_at <= greatest(p_now, clock_timestamp()) + interval '7 minutes' then
          continue;
        end if;
      elsif p_professional_rider_id is not null then
        if not private.lock_editable_naturalization_callup_race(v_edition_id, p_now) then
          continue;
        end if;
      else
        perform 1
        from public.development_race_editions as edition
        join public.season_days as day on day.season_id = edition.season_id
          and day.day_number = edition.start_day_number
        where edition.id = v_edition_id and edition.season_id = v_season_id
          and edition.status = 'planned' and edition.simulated_at is null
          and (day.calendar_date::timestamp at time zone 'Europe/Paris')
            > greatest(p_now, clock_timestamp()) + interval '7 minutes'
        for update of edition nowait;
        if not found then continue; end if;
      end if;

      update public.national_federation_selection_members as member
      set response_status = 'ineligible', responded_at = p_now
      where member.id = v_callup.id and member.response_status in ('draft', 'pending', 'confirmed');
      if not found then continue; end if;

      -- The junior trigger syncs its roster. For the pro lineup, remove the
      -- affected entry immediately and leave replacements to the usual sync.
      if v_registration_id is not null then
        perform private.withdraw_naturalization_callup_roster(
          v_registration_id, p_professional_rider_id, p_now
        );
      end if;

      update public.national_federation_selection_lists as list
      set status = case
            when list.status = 'draft' then 'draft'
            when exists (
              select 1 from public.national_federation_selection_members as member
              where member.selection_list_id = list.id and member.response_status = 'pending'
            ) then 'pending_confirmation'
            else 'finalized'
          end,
          updated_at = clock_timestamp()
      where list.id = v_callup.selection_list_id;
    end loop;
  end if;

  if p_professional_rider_id is null then return; end if;

  -- Legacy invitations are no longer generated, but a surviving future
  -- invitation must not be confirmable or leave an automatic club entry.
  for v_callup in
    select candidate.id, candidate.team_id, nation.id as nation_id, nation.race_edition_id
    from public.international_championship_rider_selections as candidate
    join public.international_championship_nation_selections as nation on nation.id = candidate.nation_selection_id
    join public.race_editions as edition on edition.id = nation.race_edition_id
    where candidate.rider_id = p_professional_rider_id and nation.country_id = p_old_country_id
      and edition.season_id = v_season_id
      and candidate.response_status in ('pending', 'confirmed', 'automatic')
    order by nation.race_edition_id, candidate.id
  loop
    if not private.lock_editable_naturalization_callup_race(v_callup.race_edition_id, p_now) then
      continue;
    end if;

    perform 1 from public.international_championship_nation_selections
    where id = v_callup.nation_id for update nowait;

    update public.international_championship_rider_selections as candidate
    set response_status = 'unavailable', is_selected = false, responded_at = p_now
    where candidate.id = v_callup.id and candidate.response_status in ('pending', 'confirmed', 'automatic');
    if not found then continue; end if;

    for v_registration_id in
      select registration.id
      from public.race_registrations as registration
      join public.team_seasons as team_season on team_season.id = registration.team_season_id
      where registration.race_edition_id = v_callup.race_edition_id
        and team_season.season_id = v_season_id and team_season.team_id = v_callup.team_id
        and registration.entry_method = 'automatic'
      order by registration.id
    loop
      perform private.withdraw_naturalization_callup_roster(v_registration_id, p_professional_rider_id, p_now);
    end loop;
  end loop;
exception when lock_not_available then
  raise exception 'Une opération sur les courses de ces coureurs est en cours. Réessayez dans quelques secondes.'
    using errcode = '55P03';
end;
$$;

revoke all on function private.lock_editable_naturalization_callup_race(uuid, timestamptz)
  from public, anon, authenticated, service_role;
revoke all on function private.withdraw_naturalization_callup_roster(uuid, uuid, timestamptz)
  from public, anon, authenticated, service_role;
revoke all on function private.reconcile_rider_callup_nationality(uuid, uuid, uuid, uuid, timestamptz)
  from public, anon, authenticated, service_role;

commit;
