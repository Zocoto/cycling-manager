begin;
set local lock_timeout = '500ms';
set local statement_timeout = '5s';

-- Keep the application's existing CC/CM and NC final-classification scales.
-- NC uses calculateNationalChampionshipReward; official Games have their own ledger.
create function private.calculate_federation_race_club_reward(
  p_competition_type text, p_game_year integer, p_final_rank integer
)
returns table (reputation_points integer, experience_points integer, cash_prize numeric, uci_points integer)
language sql immutable set search_path = '' as $$
  with scale(competition_type, expanded, max_rank, reputation, experience, cash, uci) as (values
    ('continental_championship', false,  1, 2, 250, 20000, 250),
    ('continental_championship', false,  2, 1, 150, 10000, 150),
    ('continental_championship', false,  3, 0,  90,  5000, 100),
    ('continental_championship', false,  5, 0,  50,  2000,  60),
    ('continental_championship', false, 10, 0,  25,     0,  25),
    ('continental_championship', true,   1, 2, 300, 24000,   0),
    ('continental_championship', true,   2, 1, 190, 13000,   0),
    ('continental_championship', true,   3, 0, 120,  7000,   0),
    ('continental_championship', true,   5, 0,  70,  3000,   0),
    ('continental_championship', true,  10, 0,  40,  1000,   0),
    ('continental_championship', true,  15, 0,  20,   400,   0),
    ('continental_championship', true,  20, 0,  10,   150,   0),
    ('world_championship', false,       1, 5, 625, 50000, 600),
    ('world_championship', false,       2, 3, 375, 25000, 475),
    ('world_championship', false,       3, 2, 225, 12500, 400),
    ('world_championship', false,       5, 1, 125,  5000, 325),
    ('world_championship', false,      10, 0,  60,  2000, 200),
    ('world_championship', true,        1, 5, 700, 60000,   0),
    ('world_championship', true,        2, 3, 450, 32000,   0),
    ('world_championship', true,        3, 2, 300, 18000,   0),
    ('world_championship', true,        5, 1, 175,  8000,   0),
    ('world_championship', true,       10, 0,  90,  3500,   0),
    ('world_championship', true,       15, 0,  45,  1500,   0),
    ('world_championship', true,       20, 0,  20,   500,   0),
    ('nations_cup', false,              1, 1, 125, 10000,   0),
    ('nations_cup', false,              2, 0,  75,  5000,   0),
    ('nations_cup', false,              3, 0,  45,  2500,   0),
    ('nations_cup', false,              5, 0,  25,  1000,   0),
    ('nations_cup', true,               1, 1, 150, 12000,   0),
    ('nations_cup', true,               2, 0, 100,  7000,   0),
    ('nations_cup', true,               3, 0,  70,  4000,   0),
    ('nations_cup', true,               5, 0,  45,  2000,   0),
    ('nations_cup', true,              10, 0,  25,   750,   0),
    ('nations_cup', true,              15, 0,  12,   300,   0),
    ('nations_cup', true,              20, 0,   6,   100,   0)
  ), chosen as (
    select * from scale
    where competition_type = p_competition_type
      and expanded = coalesce(p_game_year >= 4, false)
      and p_final_rank > 0 and p_final_rank <= max_rank
      and not (coalesce(p_game_year = 3, false) and p_competition_type = 'continental_championship')
    order by max_rank limit 1
  )
  select coalesce((select reputation from chosen), 0),
    coalesce((select experience from chosen), 0),
    coalesce((select cash::numeric from chosen), 0),
    case when p_game_year < 4 then coalesce((select uci from chosen), 0) else 0 end;
$$;

-- The canonical Games helper is competition-agnostic. It resolves the contract
-- at the FIRST departure, even after a transfer, using the historical contract
-- season/day bounds; it never substitutes today's club for that club.
create function private.get_federation_race_club_reward_rows(p_race_edition_id uuid)
returns table (
  race_roster_id uuid, rider_id uuid, final_rank integer, country_id uuid,
  member_id uuid, owner_team_id uuid, owner_director_id uuid, team_season_id uuid,
  reputation_points integer, experience_points integer, cash_prize numeric, uci_points integer,
  source_reference text, existing_reward_id uuid, existing_rider_id uuid,
  existing_team_season_id uuid, existing_source_type text, existing_finance_id uuid
)
language sql stable set search_path = '' as $$
  select beneficiary.race_roster_id, beneficiary.rider_id, beneficiary.final_rank, beneficiary.country_id,
    beneficiary.member_id, beneficiary.owner_team_id, beneficiary.owner_director_id, beneficiary.team_season_id,
    case when beneficiary.owner_team_id is null then 0 else prize.reputation_points end,
    case when beneficiary.owner_team_id is null then 0 else prize.experience_points end,
    case when beneficiary.owner_team_id is null then 0 else prize.cash_prize end,
    prize.uci_points,
    'official-race:' || edition.id::text || ':rider:' || beneficiary.rider_id::text || ':v1',
    reward.id, reward.rider_id, reward.team_season_id, reward.source_type, finance.id
  from public.race_editions edition
  join public.races race on race.id = edition.race_id
  join public.seasons season on season.id = edition.season_id
  cross join lateral private.get_quadrennial_games_club_beneficiaries(edition.id) beneficiary
  cross join lateral private.calculate_federation_race_club_reward(
    race.competition_type, season.game_year, beneficiary.final_rank
  ) prize
  left join public.reward_events reward on reward.source_reference =
    'official-race:' || edition.id::text || ':rider:' || beneficiary.rider_id::text || ':v1'
  left join public.team_finance_transactions finance on finance.team_season_id = beneficiary.team_season_id
    and finance.source_reference = 'reward:official-race:' || edition.id::text || ':rider:' || beneficiary.rider_id::text || ':v1'
  where edition.id = p_race_edition_id;
$$;

create function public.get_federation_race_club_reward_audit(p_race_edition_id uuid)
returns jsonb
language plpgsql stable security definer set search_path = ''
set statement_timeout = '5s' set lock_timeout = '500ms' as $$
declare
  v_event record;
  v_counts record;
  v_reasons text[] := '{}';
  v_stage_count integer;
  v_pending_stages integer;
  v_incomplete_results integer;
begin
  select edition.id, edition.season_id, edition.status, race.competition_type, season.game_year
  into v_event
  from public.race_editions edition
  join public.races race on race.id = edition.race_id
  join public.seasons season on season.id = edition.season_id
  where edition.id = p_race_edition_id;
  if not found then
    return jsonb_build_object('raceEditionId', p_race_edition_id, 'ready', false,
      'blockingReasons', jsonb_build_array('edition_not_found'));
  end if;
  if v_event.competition_type not in ('continental_championship', 'world_championship', 'nations_cup') then
    v_reasons := array_append(v_reasons, 'unsupported_competition');
  end if;
  if exists (select 1 from public.national_federation_olympic_events event
    where event.season_id = v_event.season_id
      and p_race_edition_id in (event.race_edition_id, event.time_trial_race_edition_id)) then
    v_reasons := array_append(v_reasons, 'official_quadrennial_games');
  end if;
  if v_event.game_year = 3 and v_event.competition_type = 'continental_championship' then
    v_reasons := array_append(v_reasons, 's3_continental_void');
  end if;
  if v_event.status = 'cancelled' then v_reasons := array_append(v_reasons, 'cancelled_edition'); end if;
  -- Do not inspect beneficiaries outside this RPC's scope, especially Games.
  if cardinality(v_reasons) > 0 then
    return jsonb_build_object('raceEditionId', v_event.id, 'competitionType', v_event.competition_type,
      'gameYear', v_event.game_year, 'ready', false, 'blockingReasons', to_jsonb(v_reasons));
  end if;

  select count(*)::integer, count(*) filter (where stage.status <> 'completed'
      or stage.departure_at is null or stage.departure_at > now() or day.id is null)::integer
  into v_stage_count, v_pending_stages
  from public.stages stage
  left join public.season_days day on day.id = stage.season_day_id and day.season_id = v_event.season_id
  where stage.race_edition_id = v_event.id;
  if v_stage_count = 0 or v_pending_stages > 0 then
    v_reasons := array_append(v_reasons, 'stages_not_homologated');
  end if;
  select count(*)::integer into v_incomplete_results
  from public.stages stage
  join public.stage_results result on result.stage_id = stage.id
  where stage.race_edition_id = v_event.id and not exists (
    select 1 from public.race_results final_result
    where final_result.race_edition_id = v_event.id and final_result.race_roster_id = result.race_roster_id
  );
  if v_incomplete_results > 0 then v_reasons := array_append(v_reasons, 'incomplete_final_classification'); end if;
  if exists (
    select 1 from public.race_results result
    join public.race_rosters roster on roster.id = result.race_roster_id
    join public.race_registrations registration on registration.id = roster.race_registration_id
    where result.race_edition_id = v_event.id and registration.race_edition_id <> v_event.id
  ) then v_reasons := array_append(v_reasons, 'invalid_roster_edition'); end if;
  if exists (select 1 from public.race_results result where result.race_edition_id = v_event.id
    and result.status = 'classified' and (result.final_rank is null or result.final_rank < 1)) then
    v_reasons := array_append(v_reasons, 'invalid_final_rank');
  end if;

  select count(*)::integer as classified_count,
    count(*) filter (where row.final_rank = 1)::integer as winner_count,
    count(*) filter (where row.owner_team_id is not null and
      (row.reputation_points > 0 or row.experience_points > 0 or row.cash_prize > 0 or row.uci_points > 0 or row.final_rank = 1))::integer as club_count,
    count(*) filter (where row.owner_team_id is null and row.member_id is not null)::integer as free_count,
    count(*) filter (where row.member_id is null)::integer as missing_selection_count,
    count(*) filter (where row.owner_team_id is not null and row.team_season_id is null)::integer as missing_account_count,
    count(*) filter (where director.id is null and (row.owner_director_id is not null
      or (row.owner_team_id is not null and (row.reputation_points > 0 or row.experience_points > 0))))::integer as missing_director_count,
    count(*) - count(distinct row.rider_id) as duplicate_rider_count,
    count(*) filter (where row.existing_reward_id is not null and (
      row.existing_rider_id is distinct from row.rider_id or row.existing_team_season_id is distinct from row.team_season_id
      or row.existing_source_type is distinct from 'race_result'))::integer as collision_count,
    count(*) filter (where row.existing_reward_id is null and row.existing_finance_id is not null)::integer as orphan_finance_count,
    count(*) filter (where row.existing_reward_id is null and
      (row.reputation_points > 0 or row.experience_points > 0 or row.cash_prize > 0 or row.uci_points > 0 or row.final_rank = 1))::integer as missing_count,
    count(*) filter (where row.existing_reward_id is not null)::integer as existing_count,
    coalesce(sum(row.cash_prize), 0) as cash,
    coalesce(sum(row.experience_points), 0) as experience,
    coalesce(sum(row.reputation_points), 0) as reputation
  into v_counts
  from private.get_federation_race_club_reward_rows(v_event.id) row
  left join public.sporting_directors director on director.id = row.owner_director_id;
  if v_counts.classified_count > 0 and v_counts.winner_count <> 1 then
    v_reasons := array_append(v_reasons, 'winner_not_unique');
  end if;
  if v_counts.missing_selection_count > 0 then v_reasons := array_append(v_reasons, 'missing_official_selection'); end if;
  if v_counts.missing_account_count > 0 then v_reasons := array_append(v_reasons, 'missing_club_account'); end if;
  if v_counts.missing_director_count > 0 then v_reasons := array_append(v_reasons, 'missing_director'); end if;
  if v_counts.duplicate_rider_count > 0 then v_reasons := array_append(v_reasons, 'duplicate_rider'); end if;
  if v_counts.collision_count > 0 then v_reasons := array_append(v_reasons, 'existing_reward_beneficiary_mismatch'); end if;
  if v_counts.orphan_finance_count > 0 then v_reasons := array_append(v_reasons, 'orphan_finance_receipt'); end if;
  return jsonb_build_object(
    'raceEditionId', v_event.id, 'competitionType', v_event.competition_type, 'gameYear', v_event.game_year,
    'ready', cardinality(v_reasons) = 0, 'blockingReasons', to_jsonb(v_reasons),
    'classifiedCount', v_counts.classified_count, 'eligibleClubCount', v_counts.club_count,
    'freeAgentCount', v_counts.free_count, 'missingRewardCount', v_counts.missing_count,
    'existingRewardCount', v_counts.existing_count, 'missingClubAccountCount', v_counts.missing_account_count,
    'missingSelectionCount', v_counts.missing_selection_count, 'expectedCash', v_counts.cash,
    'expectedExperience', v_counts.experience, 'expectedReputation', v_counts.reputation);
end;
$$;

create function public.settle_federation_race_club_rewards(p_race_edition_id uuid)
returns jsonb
language plpgsql security definer set search_path = ''
set statement_timeout = '5s' set lock_timeout = '500ms' as $$
declare
  v_audit jsonb;
  v_event record;
  v_day record;
  v_row record;
  v_reward_id uuid;
  v_source text;
  v_description text;
  v_paid integer := 0;
  v_existing integer := 0;
  v_cash numeric := 0;
  v_xp integer := 0;
  v_rep numeric := 0;
  v_victories integer := 0;
begin
  -- Independent editions can settle simultaneously; retries of one edition serialize.
  perform pg_advisory_xact_lock(hashtextextended('federation-club-rewards:' || p_race_edition_id::text, 0));
  select edition.id, edition.season_id, edition.display_name
  into v_event from public.race_editions edition where edition.id = p_race_edition_id for update;
  if not found then raise exception 'Federation reward edition not found.' using errcode = '22023'; end if;
  v_audit := public.get_federation_race_club_reward_audit(p_race_edition_id);
  if not coalesce((v_audit ->> 'ready')::boolean, false) then
    raise exception 'Federation race rewards are not ready: %', v_audit -> 'blockingReasons' using errcode = '22023';
  end if;
  select day.id, day.day_number into strict v_day
  from public.stages stage
  join public.season_days day on day.id = stage.season_day_id and day.season_id = v_event.season_id
  where stage.race_edition_id = v_event.id order by stage.stage_number desc, stage.id desc limit 1;

  -- Stable account order also serializes different races sharing clubs/directors.
  perform director.id from public.sporting_directors director
  where director.id in (select row.owner_director_id from private.get_federation_race_club_reward_rows(v_event.id) row)
  order by director.id for update;
  perform account.id from public.team_seasons account
  where account.id in (select row.team_season_id from private.get_federation_race_club_reward_rows(v_event.id) row)
  order by account.id for update;

  for v_row in select * from private.get_federation_race_club_reward_rows(v_event.id)
    where reputation_points > 0 or experience_points > 0 or cash_prize > 0 or uci_points > 0 or final_rank = 1
    order by team_season_id nulls last, rider_id
  loop
    if v_row.existing_reward_id is not null then v_existing := v_existing + 1; continue; end if;
    v_source := v_row.source_reference;
    v_description := v_event.display_name || ' — ' || case when v_row.final_rank = 1 then 'Victoire' else v_row.final_rank::text || 'e place' end;
    v_reward_id := null;
    insert into public.reward_events (
      source_reference, source_type, sporting_director_id, team_season_id, rider_id, country_id,
      reputation_points, experience_points, cash_prize, uci_points, description
    ) values (
      v_source, 'race_result', v_row.owner_director_id, v_row.team_season_id, v_row.rider_id, v_row.country_id,
      v_row.reputation_points, v_row.experience_points, v_row.cash_prize, v_row.uci_points, v_description
    ) on conflict (source_reference) do nothing returning id into v_reward_id;
    if v_reward_id is null then v_existing := v_existing + 1; continue; end if;

    -- reward_events triggers continue to apply equipment, staff and reputation bonuses.
    update public.sporting_directors
    set reputation_points = reputation_points + v_row.reputation_points,
      experience_points = experience_points + v_row.experience_points
    where id = v_row.owner_director_id;
    update public.team_seasons
    set cash_balance = cash_balance + v_row.cash_prize, points = points + v_row.uci_points
    where id = v_row.team_season_id;
    insert into public.rider_season_summaries (rider_id, season_id, victories, points)
    values (v_row.rider_id, v_event.season_id, case when v_row.final_rank = 1 then 1 else 0 end, v_row.uci_points)
    on conflict (rider_id, season_id) do update set
      victories = coalesce(rider_season_summaries.victories, 0) + excluded.victories,
      points = coalesce(rider_season_summaries.points, 0) + excluded.points, updated_at = now();
    if v_row.cash_prize > 0 then
      insert into public.team_finance_transactions (
        team_season_id, season_day_id, day_number, amount, category, status, description, source_reference, posted_at
      ) values (
        v_row.team_season_id, v_day.id, v_day.day_number, v_row.cash_prize, 'race_prize', 'posted',
        v_description, 'reward:' || v_source, now()
      );
    end if;
    v_paid := v_paid + 1;
    v_cash := v_cash + v_row.cash_prize;
    v_xp := v_xp + v_row.experience_points;
    v_rep := v_rep + v_row.reputation_points;
    if v_row.final_rank = 1 then v_victories := v_victories + 1; end if;
  end loop;
  return jsonb_build_object('raceEditionId', v_event.id, 'competitionType', v_audit ->> 'competitionType',
    'gameYear', (v_audit ->> 'gameYear')::integer, 'classifiedCount', (v_audit ->> 'classifiedCount')::integer,
    'eligibleClubCount', (v_audit ->> 'eligibleClubCount')::integer, 'freeAgentCount', (v_audit ->> 'freeAgentCount')::integer,
    'paidCount', v_paid, 'alreadyPaidCount', v_existing, 'cashAwarded', v_cash,
    'experienceAwarded', v_xp, 'reputationAwarded', v_rep, 'victoriesAwarded', v_victories);
end;
$$;

revoke all on function private.calculate_federation_race_club_reward(text, integer, integer),
  private.get_federation_race_club_reward_rows(uuid) from public, anon, authenticated, service_role;
revoke all on function public.get_federation_race_club_reward_audit(uuid),
  public.settle_federation_race_club_rewards(uuid) from public, anon, authenticated;
grant execute on function public.get_federation_race_club_reward_audit(uuid),
  public.settle_federation_race_club_rewards(uuid) to service_role;

notify pgrst, 'reload schema';
commit;
