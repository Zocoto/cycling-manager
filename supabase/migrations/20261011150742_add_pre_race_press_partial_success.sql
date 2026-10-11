begin;
set local lock_timeout = '5s';
set local statement_timeout = '60s';

alter table public.pre_race_press_conferences
  add column if not exists achievement_level text,
  add column if not exists achievement_percent smallint not null default 0,
  add column if not exists sponsor_bonus_awarded smallint not null default 0;
do $$ begin
  if not exists (select 1 from pg_constraint where conrelid = 'public.pre_race_press_conferences'::regclass
    and conname = 'pre_race_press_partial_result_valid') then
    alter table public.pre_race_press_conferences add constraint pre_race_press_partial_result_valid check (
      coalesce(((achievement_level is null and achievement_percent = 0)
        or (achievement_level = 'full' and achievement_percent = 100)
        or (achievement_level = 'partial' and achievement_percent in (20, 40))
        or (achievement_level = 'missed' and achievement_percent = 0)), false)
      and sponsor_bonus_awarded between 0 and sponsor_bonus
    );
  end if;
end $$;

-- The public promise concerns the named leader, never a teammate's result.
create or replace function private.pre_race_press_achievement_percent(p_ambition text, p_rank integer)
returns integer language sql immutable set search_path = '' as $$
  select case when p_rank is null or p_rank < 1 then 0 else case p_ambition
    when 'victory' then case when p_rank = 1 then 100 when p_rank <= 3 then 40 when p_rank <= 5 then 20 else 0 end
    when 'podium' then case when p_rank <= 3 then 100 when p_rank <= 5 then 40 when p_rank <= 10 then 20 else 0 end
    when 'top_10' then case when p_rank <= 10 then 100 when p_rank <= 15 then 40 when p_rank <= 20 then 20 else 0 end
    when 'visibility' then case when p_rank <= 20 then 100 when p_rank <= 25 then 40 when p_rank <= 30 then 20 else 0 end
    else 0 end end;
$$;

create or replace function private.settle_pre_race_press_conferences(p_race_edition_id uuid)
returns integer language plpgsql security definer set search_path = '' as $$
declare
  v_conference record; v_rank integer; v_percent integer; v_level text;
  v_success integer; v_failure integer; v_requested integer; v_regular numeric;
  v_commitment numeric; v_awarded integer; v_contract uuid; v_year integer;
  v_settled integer := 0;
begin
  select season.game_year into v_year from public.race_editions as edition
  join public.seasons as season on season.id = edition.season_id
  where edition.id = p_race_edition_id and edition.status = 'completed';
  if not found then return 0; end if;

  for v_conference in select * from public.pre_race_press_conferences
    where race_edition_id = p_race_edition_id and status = 'published' order by id for update
  loop
    select result.final_rank into v_rank from public.race_results as result
    join public.race_rosters as roster on roster.id = result.race_roster_id
    join public.race_registrations as registration on registration.id = roster.race_registration_id
      and registration.race_edition_id = p_race_edition_id
      and registration.team_season_id = v_conference.team_season_id
    where result.race_edition_id = p_race_edition_id and result.status = 'classified'
      and result.final_rank > 0 and roster.rider_id = v_conference.leader_rider_id
    order by result.final_rank limit 1;
    v_percent := private.pre_race_press_achievement_percent(v_conference.ambition, v_rank);
    -- Keep pre-S4 historical rules unchanged.
    if v_year < 4 and v_percent < 100 then v_percent := 0; end if;
    v_level := case when v_percent = 100 then 'full' when v_percent > 0 then 'partial' else 'missed' end;
    v_success := case v_conference.ambition when 'victory' then 8 when 'podium' then 5 when 'top_10' then 3 else 2 end;
    v_failure := case v_conference.ambition when 'victory' then -4 when 'podium' then -3 when 'top_10' then -2 else -1 end;
    v_requested := case when v_percent = 100 then v_success
      when v_percent > 0 then greatest(1, round(v_success * v_percent / 100.0)::integer) else v_failure end;
    v_regular := private.apply_reputation_delta(
      v_conference.sporting_director_id, v_conference.season_id, v_requested,
      'pre_race_press', 'pre-race-press-result:' || v_conference.id,
      case v_level when 'full' then 'Objectif médiatique atteint sur '
        when 'partial' then 'Réussite partielle de l’objectif médiatique sur '
        else 'Objectif médiatique manqué sur ' end || v_conference.race_name,
      jsonb_build_object('raceEditionId', p_race_edition_id, 'achievementLevel', v_level, 'achievementPercent', v_percent)
    );
    v_commitment := 0;
    if v_conference.reputation_commitment_id is not null then
      v_commitment := private.settle_reputation_commitment(v_conference.reputation_commitment_id,
        case v_level when 'full' then 'achieved' when 'partial' then 'partial' else 'failed' end,
        1 - v_percent / 100.0);
    end if;

    -- Partial satisfaction belongs to this commitment's dedicated +8 pool,
    -- not the +25 race/UCI pool or a contractual sponsor race objective.
    v_awarded := 0; v_contract := null;
    if v_percent > 0 and v_conference.sponsor_bonus > 0 then
      select contract.id into v_contract from public.team_sponsor_contracts as contract
      join public.seasons as start_season on start_season.id = contract.start_season_id
      where contract.team_id = v_conference.team_id and contract.role = 'principal' and contract.status = 'active'
        and coalesce(contract.objective_season_id, contract.start_season_id) = v_conference.season_id
        and start_season.game_year <= v_year
        and start_season.game_year + contract.contract_duration_seasons - 1 >= v_year
      order by contract.created_at desc limit 1;
      if v_contract is not null then
        v_awarded := round(v_conference.sponsor_bonus * v_percent / 100.0)::integer;
        if v_awarded > 0 then
          insert into public.sponsor_satisfaction_events (
            team_sponsor_contract_id, season_id, event_type, source_key, race_edition_id,
            rider_id, points, title, description, metadata
          ) values (
            v_contract, v_conference.season_id, 'pre_race_commitment',
            'pre-race-commitment:' || v_conference.id, p_race_edition_id,
            v_conference.leader_rider_id, v_awarded,
            case when v_percent = 100 then 'Engagement public tenu' else 'Engagement public partiellement réussi' end,
            'La promesse renforcée sur ' || v_conference.race_name || ' est créditée à ' || v_percent || ' % : +'
              || v_awarded || ' point(s) sur les ' || v_conference.sponsor_bonus || ' prévus.',
            jsonb_build_object('conferenceId', v_conference.id, 'achievementLevel', v_level,
              'achievementPercent', v_percent, 'maximumPoints', v_conference.sponsor_bonus)
          ) on conflict (team_sponsor_contract_id, source_key) do nothing;
        end if;
      end if;
    end if;
    update public.pre_race_press_conferences set status = 'settled', target_met = (v_percent = 100),
      leader_final_rank = v_rank, reputation_delta = round(v_regular + v_commitment)::integer,
      achievement_level = v_level, achievement_percent = v_percent, sponsor_bonus_awarded = v_awarded,
      settled_at = now() where id = v_conference.id;
    v_settled := v_settled + 1;
  end loop;
  return v_settled;
end;
$$;

drop function if exists public.get_pre_race_press_conferences(uuid);
create function public.get_pre_race_press_conferences(p_race_edition_id uuid)
returns table (
  conference_id uuid, team_name text, director_name text, leader_rider_id uuid, leader_name text,
  ambition text, race_intent text, public_statement text, status text, target_met boolean,
  leader_final_rank integer, reputation_delta integer, commitment_amount integer, sponsor_bonus smallint,
  submitted_at timestamptz, is_own boolean, achievement_level text, achievement_percent smallint,
  sponsor_bonus_awarded smallint
)
language sql stable security definer set search_path = '' as $$
  select conference.id, conference.team_name, conference.director_name, conference.leader_rider_id,
    conference.leader_name, conference.ambition, conference.race_intent, conference.public_statement,
    conference.status, conference.target_met, conference.leader_final_rank, conference.reputation_delta,
    conference.commitment_amount, conference.sponsor_bonus, conference.submitted_at,
    director.auth_user_id = auth.uid(), conference.achievement_level, conference.achievement_percent,
    conference.sponsor_bonus_awarded
  from public.pre_race_press_conferences as conference
  join public.sporting_directors as director on director.id = conference.sporting_director_id
  where auth.uid() is not null and conference.race_edition_id = p_race_edition_id
    and conference.status <> 'cancelled' order by conference.submitted_at, conference.team_name;
$$;
revoke all on function public.get_pre_race_press_conferences(uuid) from public, anon;
grant execute on function public.get_pre_race_press_conferences(uuid) to authenticated;
revoke all on function private.pre_race_press_achievement_percent(text,integer) from public, anon, authenticated;
revoke all on function private.settle_pre_race_press_conferences(uuid) from public, anon, authenticated;

-- Reviewed real S4 catch-up, not a rehearsal: one already-settled top-10
-- promise with a 15th place, no reinforced stake. Append a compensating ledger
-- entry instead of reopening settlement or rewriting its original ledger.
do $$
declare v_conference record; v_previous numeric; v_correction numeric; v_applied numeric;
begin
  select conference.* into v_conference from public.pre_race_press_conferences as conference
  join public.seasons as season on season.id = conference.season_id and season.status = 'active' and season.game_year = 4
  join public.race_editions as edition on edition.id = conference.race_edition_id and edition.status = 'completed'
  where conference.id = 'feed9099-f880-4273-9378-390213f3617e'
    and conference.status = 'settled' and conference.ambition = 'top_10' and conference.leader_final_rank = 15
    and conference.target_met = false and conference.commitment_amount = 0
    and conference.reputation_commitment_id is null and conference.achievement_level is null
  for update of conference;
  if not found then return; end if;
  select applied_delta into v_previous from public.reputation_ledger
    where source_reference = 'pre-race-press-result:' || v_conference.id
      and sporting_director_id = v_conference.sporting_director_id and source_type = 'pre_race_press';
  if not found then return; end if;
  v_correction := 1 - v_previous;
  v_applied := private.apply_reputation_delta(v_conference.sporting_director_id, v_conference.season_id,
    v_correction, 'pre_race_press_partial', 'pre-race-press-partial-catchup:' || v_conference.id,
    'Réussite partielle de l’objectif médiatique sur ' || v_conference.race_name,
    jsonb_build_object('conferenceId', v_conference.id, 'achievementPercent', 40, 'previousAppliedDelta', v_previous));
  update public.pre_race_press_conferences set achievement_level = 'partial', achievement_percent = 40,
    reputation_delta = round(reputation_delta + v_applied)::integer where id = v_conference.id;
end $$;

notify pgrst, 'reload schema';
commit;
