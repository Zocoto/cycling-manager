begin;
set local lock_timeout = '1s';
set local statement_timeout = '10s';

-- Callups describe permission to represent a nation. They are not a club
-- ownership snapshot: a free agent can sign before the race starts.
create function private.get_quadrennial_games_club_beneficiaries(p_race_edition_id uuid)
returns table (
  race_roster_id uuid, final_rank integer, rider_id uuid, country_id uuid,
  member_id uuid, owner_team_id uuid, owner_director_id uuid, team_season_id uuid
)
language sql stable set search_path = '' as $$
  with event_start as (
    select edition.id, edition.season_id, season.game_year,
      day.day_number, stage.departure_at
    from public.race_editions edition
    join public.seasons season on season.id = edition.season_id
    join public.stages stage on stage.race_edition_id = edition.id
    join public.season_days day on day.id = stage.season_day_id
      and day.season_id = edition.season_id
    where edition.id = p_race_edition_id
    order by stage.stage_number, stage.id limit 1
  )
  select result.race_roster_id, result.final_rank::integer, roster.rider_id,
    selection.country_id, member.id, contract.team_id,
    coalesce(case when contract.team_id = member.owner_team_id then member.owner_director_id end,
      assignment.sporting_director_id), team_season.id
  from event_start event
  join public.race_results result on result.race_edition_id = event.id
    and result.status = 'classified' and result.final_rank > 0
  join public.race_rosters roster on roster.id = result.race_roster_id
  left join public.national_federation_selection_race_links link
    on link.race_registration_id = roster.race_registration_id and link.race_edition_id = event.id
  left join public.national_federation_selection_lists selection
    on selection.id = link.selection_list_id and selection.season_id = event.season_id
  left join public.national_federation_selection_members member
    on member.selection_list_id = selection.id and member.professional_rider_id = roster.rider_id
  left join lateral (
    select c.team_id
    from public.rider_contracts c
    join public.seasons first_season on first_season.id = c.start_season_id
    join public.seasons last_season on last_season.id = coalesce(c.left_season_id, c.end_season_id)
    where c.rider_id = roster.rider_id
      and c.status in ('active', 'completed', 'terminated')
      and coalesce(c.signed_at, c.created_at) <= event.departure_at
      and (first_season.game_year < event.game_year or
        (first_season.game_year = event.game_year and coalesce(c.joined_day_number, 1) <= event.day_number))
      and (last_season.game_year > event.game_year or
        (last_season.game_year = event.game_year and coalesce(c.left_day_number, 28) >= event.day_number))
    order by first_season.game_year desc, coalesce(c.joined_day_number, 1) desc,
      coalesce(c.signed_at, c.created_at) desc, c.id
    limit 1
  ) contract on true
  left join public.team_seasons team_season on team_season.team_id = contract.team_id
    and team_season.season_id = event.season_id
  left join public.team_manager_assignments assignment on assignment.team_id = contract.team_id
    and assignment.status = 'active' and assignment.role = 'general_manager';
$$;
revoke all on function private.get_quadrennial_games_club_beneficiaries(uuid) from public, anon, authenticated;

-- Preserve the original settlement guards, ACLs, timeouts, unique references
-- and federation payment. Only replace the obsolete callup-owner query.
do $$
declare
  v_definition text;
  v_before text := $old$select result.race_roster_id, result.final_rank, roster.rider_id,
      selection.country_id, member.id as member_id, member.owner_team_id, member.owner_director_id,
      team_season.id as team_season_id
    from public.race_results result
    join public.race_rosters roster on roster.id = result.race_roster_id
    left join public.national_federation_selection_race_links link on link.race_registration_id = roster.race_registration_id
      and link.race_edition_id = result.race_edition_id
    left join public.national_federation_selection_lists selection on selection.id = link.selection_list_id
      and selection.season_id = v_event.season_id
    left join public.national_federation_selection_members member on member.selection_list_id = selection.id
      and member.professional_rider_id = roster.rider_id
    left join public.team_seasons team_season on team_season.team_id = member.owner_team_id
      and team_season.season_id = v_event.season_id
    where result.race_edition_id = p_race_edition_id and result.status = 'classified' and result.final_rank > 0
    order by team_season.id, result.race_roster_id$old$;
begin
  select replace(pg_get_functiondef('public.settle_quadrennial_games_cash_prizes(uuid)'::regprocedure), E'\r\n', E'\n') into v_definition;
  if position(v_before in v_definition) = 0 then
    raise exception 'Unexpected Games settlement definition; no ownership patch applied.';
  end if;
  execute replace(v_definition, v_before,
    'select * from private.get_quadrennial_games_club_beneficiaries(p_race_edition_id) order by team_season_id, race_roster_id');
end;
$$;

-- One-time recovery of missing receipts on completed, already-paid Games.
-- No redistribution of existing payments and no replay of sporting results.
do $$
declare
  v_event record;
  v_result record;
  v_existing record;
  v_cash numeric;
  v_source text;
  v_reward_id uuid;
  v_description text;
  v_new_count integer;
  v_new_total numeric;
begin
  for v_event in
    select edition.id, edition.season_id, edition.display_name, day.id season_day_id, day.day_number
    from public.quadrennial_games_cash_settlements receipt
    join public.race_editions edition on edition.id = receipt.race_edition_id and edition.status = 'completed'
    join public.races race on race.id = edition.race_id and race.competition_type = 'nations_cup'
    join public.seasons season on season.id = edition.season_id and season.game_year >= 4 and season.game_year % 4 = 0
    join public.national_federation_olympic_events event on event.season_id = edition.season_id
      and edition.id in (event.race_edition_id, event.time_trial_race_edition_id)
    join lateral (
      select stage.season_day_id from public.stages stage
      where stage.race_edition_id = edition.id order by stage.stage_number desc limit 1
    ) final_stage on true
    join public.season_days day on day.id = final_stage.season_day_id and day.season_id = edition.season_id
    order by edition.id
  loop
    perform pg_advisory_xact_lock(hashtextextended('quadrennial-cash:' || v_event.id::text, 0));
    v_new_count := 0;
    v_new_total := 0;
    for v_result in
      select * from private.get_quadrennial_games_club_beneficiaries(v_event.id)
      order by team_season_id, race_roster_id
    loop
      if v_result.member_id is null then raise exception 'Missing official Games selection.'; end if;
      v_source := 'quadrennial-games:' || v_event.id::text || ':roster:' || v_result.race_roster_id::text || ':club:v1';
      v_cash := public.get_quadrennial_games_club_prize(v_result.final_rank);
      select id, team_season_id, cash_prize into v_existing from public.reward_events where source_reference = v_source;
      if found then
        if v_existing.team_season_id is distinct from v_result.team_season_id then
          raise exception 'Existing Games club payment needs manual review; recovery cancelled.';
        end if;
        -- Paid rankings are immutable; a later result edit must not repay cash.
        continue;
      end if;
      if v_result.owner_team_id is null then continue; end if;
      if v_result.team_season_id is null then raise exception 'Missing season account for Games club.'; end if;
      select v_event.display_name || ' · ' || rider.first_name || ' ' || rider.last_name || ' · '
        || v_result.final_rank::text || 'e place · prime au club'
      into strict v_description from public.riders rider where rider.id = v_result.rider_id;
      v_reward_id := null;
      insert into public.reward_events (
        source_reference, source_type, sporting_director_id, team_season_id, rider_id, country_id,
        reputation_points, experience_points, cash_prize, uci_points, description
      ) values (
        v_source, 'race_result', v_result.owner_director_id, v_result.team_season_id, v_result.rider_id,
        v_result.country_id, 0, 0, v_cash, 0, v_description
      ) on conflict (source_reference) do nothing returning id into v_reward_id;
      if v_reward_id is not null then
        update public.team_seasons set cash_balance = cash_balance + v_cash where id = v_result.team_season_id;
        insert into public.team_finance_transactions (
          team_season_id, season_day_id, day_number, amount, category, status, description, source_reference, posted_at
        ) values (
          v_result.team_season_id, v_event.season_day_id, v_event.day_number, v_cash,
          'race_prize', 'posted', v_description, 'reward:' || v_source, now()
        );
        v_new_count := v_new_count + 1;
        v_new_total := v_new_total + v_cash;
      end if;
    end loop;
    update public.quadrennial_games_cash_settlements
    set club_prize_count = club_prize_count + v_new_count,
      club_prize_total = club_prize_total + v_new_total
    where race_edition_id = v_event.id;
  end loop;
end;
$$;

commit;
