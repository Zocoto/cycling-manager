begin;
set local lock_timeout = '5s';
set local statement_timeout = '60s';

-- One bounded partial credit per objective: the best official achievement wins,
-- never the sum of several jerseys, stages or riders. Preserve legacy 40%.
create or replace function private.sponsor_partial_objective_points(
  p_weight integer, p_details jsonb
)
returns integer language sql immutable set search_path = '' as $$
  select case
    when p_weight > 0 and p_details ->> 'achievementLevel' = 'partial' then
      case coalesce(p_details ->> 'partialCreditPercent', '40')
        when '10' then greatest(1, round(p_weight * 0.10)::integer)
        when '15' then greatest(1, round(p_weight * 0.15)::integer)
        when '20' then greatest(1, round(p_weight * 0.20)::integer)
        when '25' then greatest(1, round(p_weight * 0.25)::integer)
        when '30' then greatest(1, round(p_weight * 0.30)::integer)
        when '40' then greatest(1, round(p_weight * 0.40)::integer)
        else 0
      end
    else 0
  end;
$$;

create or replace function private.get_sponsor_race_partial_achievements(
  p_edition_id uuid, p_team_season_id uuid
)
returns jsonb language sql stable security definer set search_path = '' as $$
  with context as (
    select edition.id, race.race_format
    from public.race_editions as edition
    join public.races as race on race.id = edition.race_id
    join public.team_seasons as team_season
      on team_season.id = p_team_season_id
     and team_season.season_id = edition.season_id
    where edition.id = p_edition_id and edition.status = 'completed'
  ), rosters as (
    select roster.id
    from public.race_rosters as roster
    join public.race_registrations as registration
      on registration.id = roster.race_registration_id
    join context on context.id = registration.race_edition_id
    where registration.team_season_id = p_team_season_id
  ), stage_ranks as (
    -- Best team placing per stage, not one credit per rider. A subsequent DNF
    -- at the general classification does not erase an official stage victory.
    select stage.id, min(result.rank)::integer as rank
    from public.stage_results as result
    join rosters on rosters.id = result.race_roster_id
    join public.stages as stage on stage.id = result.stage_id
    join context on context.id = stage.race_edition_id
    where context.race_format = 'stage_race' and stage.status = 'completed'
      and result.status = 'finished' and result.rank between 1 and 10
    group by stage.id
  ), stage_facts as (
    select case
      when rank = 1 then 'stage_win'
      when rank <= 3 then 'stage_podium'
      when rank <= 5 then 'stage_top5'
      else 'stage_top10' end as code,
      case when rank = 1 then 40 when rank <= 3 then 25
        when rank <= 5 then 15 else 10 end as percent,
      min(rank) as rank, count(*)::integer as count
    from stage_ranks group by 1, 2
  ), secondary_facts as (
    select result.classification_type || '_classification' as code,
      case when min(result.rank) = 1 then 40 else 25 end as percent,
      min(result.rank)::integer as rank, 1 as count
    from public.race_secondary_results as result
    join context on context.id = result.race_edition_id
    where context.race_format = 'stage_race' and result.rank between 1 and 3
      and result.classification_type in ('mountain', 'sprint', 'youth', 'team')
      and (result.classification_type not in ('mountain', 'sprint') or result.points > 0)
      and (
        (result.classification_type = 'team' and result.team_season_id = p_team_season_id)
        or (result.classification_type <> 'team'
          and result.race_roster_id in (select id from rosters))
      )
    group by result.classification_type
  ), combativity_facts as (
    select 'combativity_' || award.award_scope as code,
      case when award.award_scope = 'race' then 30 else 20 end as percent,
      1 as rank, count(*)::integer as count
    from public.race_combativity_awards as award
    join context on context.id = award.race_edition_id
    join rosters on rosters.id = award.race_roster_id
    left join public.stages as stage on stage.id = award.stage_id
    where (award.award_scope = 'race' and context.race_format = 'stage_race')
      or (award.award_scope = 'stage' and stage.status = 'completed'
        and stage.race_edition_id = context.id)
    group by award.award_scope
  ), facts as (
    select * from stage_facts union all
    select * from secondary_facts union all select * from combativity_facts
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'code', code, 'creditPercent', percent, 'rank', rank, 'count', count
  ) order by percent desc, code), '[]'::jsonb) from facts;
$$;

create or replace function private.refresh_sponsor_race_partial_objectives(
  p_contract_id uuid, p_finalize boolean default false
)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_contract record;
  v_objective record;
  v_edition_id uuid;
  v_edition_status text;
  v_rank integer;
  v_target integer;
  v_threshold integer;
  v_percent integer;
  v_level text;
  v_facts jsonb;
  v_details jsonb;
begin
  select contract.id, contract.sponsor_offer_id,
    coalesce(contract.objective_season_id, contract.start_season_id) as season_id,
    team_season.id as team_season_id
  into v_contract
  from public.team_sponsor_contracts as contract
  join public.team_seasons as team_season on team_season.team_id = contract.team_id
    and team_season.season_id = coalesce(contract.objective_season_id, contract.start_season_id)
  where contract.id = p_contract_id and contract.status in ('active', 'completed')
    and contract.sponsor_offer_id is not null;
  if not found then return; end if;

  for v_objective in
    select objective.id, objective.target_details, objective.satisfaction_points,
      progress.id as progress_id, progress.current_value, progress.details
    from public.sponsor_objectives as objective
    join public.objective_progress as progress on progress.sponsor_objective_id = objective.id
      and progress.team_sponsor_contract_id = v_contract.id
      and progress.season_id = v_contract.season_id
    where objective.sponsor_offer_id = v_contract.sponsor_offer_id
      and objective.season_id = v_contract.season_id
      and objective.objective_type = 'race_result' and objective.status <> 'cancelled'
      and (progress.settled_at is null or p_finalize)
    order by objective.display_order, objective.id for update of progress
  loop
    v_target := greatest(1, coalesce(nullif(v_objective.target_details ->> 'targetRank', '')::integer, 1));
    v_threshold := greatest(3, ceil(v_target * 1.5)::integer);
    v_edition_id := case when coalesce(v_objective.target_details ->> 'raceEditionId', '') ~*
      '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      then (v_objective.target_details ->> 'raceEditionId')::uuid else null end;
    if v_edition_id is null or not exists (
      select 1 from public.race_editions where id = v_edition_id and season_id = v_contract.season_id
    ) then
      select edition.id into v_edition_id from public.race_editions as edition
      where edition.season_id = v_contract.season_id and edition.race_id = case
        when coalesce(v_objective.target_details ->> 'raceId', '') ~*
          '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
        then (v_objective.target_details ->> 'raceId')::uuid else null end
      order by edition.created_at, edition.id limit 1;
    end if;
    select status into v_edition_status from public.race_editions where id = v_edition_id;
    v_rank := nullif(round(v_objective.current_value)::integer, 0);
    v_level := null; v_percent := 0; v_facts := '[]'::jsonb;
    if v_edition_status = 'completed' then
      if v_rank is not null and v_rank <= v_target then
        v_level := 'full';
      else
        v_facts := private.get_sponsor_race_partial_achievements(v_edition_id, v_contract.team_season_id);
        if v_rank is not null and v_rank <= v_threshold then
          v_facts := jsonb_build_array(jsonb_build_object(
            'code', 'near_target', 'rank', v_rank, 'creditPercent', 40, 'count', 1
          )) || v_facts;
        end if;
        select coalesce(max((fact ->> 'creditPercent')::integer), 0)
          into v_percent from jsonb_array_elements(v_facts) as fact;
        v_level := case when v_percent > 0 then 'partial' else 'missed' end;
      end if;
    end if;
    v_details := coalesce(v_objective.details, '{}'::jsonb) || jsonb_build_object(
      'resultRank', v_rank, 'targetRank', v_target, 'partialThresholdRank', v_threshold,
      'achievementLevel', v_level, 'partialCreditPercent', v_percent,
      'partialAchievements', v_facts
    );
    v_details := v_details || jsonb_build_object('partialSatisfactionPoints',
      private.sponsor_partial_objective_points(v_objective.satisfaction_points, v_details));
    update public.objective_progress set details = v_details, updated_at = now()
    where id = v_objective.progress_id and details is distinct from v_details;
  end loop;
  update public.team_sponsor_contracts set
    satisfaction_score = public.get_sponsor_objective_satisfaction_score(id),
    satisfaction_updated_at = now() where id = v_contract.id;
end;
$$;

-- Retain the existing evaluator, objectives, budgets and reputation rules.
create or replace function public.evaluate_sponsor_objectives_for_contract(
  p_contract_id uuid, p_finalize boolean default false
)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform public.evaluate_sponsor_objectives_pre_partial_success_20260927(p_contract_id, p_finalize);
  perform private.refresh_sponsor_race_partial_objectives(p_contract_id, p_finalize);
end;
$$;

create or replace function public.get_sponsor_objective_satisfaction_score(p_contract_id uuid)
returns integer language sql stable security definer set search_path = '' as $$
  select least(100, round(coalesce(sum(case
    when objective.status = 'completed' then objective.satisfaction_points
    when objective.objective_type = 'race_result' and objective.status = 'failed'
      then private.sponsor_partial_objective_points(objective.satisfaction_points, progress.details)
    else 0 end), 0) * (1 + 0.10 * public.get_team_specialization_power(
      contract.team_id, 'media_center', 'community_media'))))::integer
  from public.team_sponsor_contracts as contract
  left join public.sponsor_objectives as objective on objective.sponsor_offer_id = contract.sponsor_offer_id
    and objective.season_id = coalesce(contract.objective_season_id, contract.start_season_id)
  left join public.objective_progress as progress on progress.sponsor_objective_id = objective.id
    and progress.team_sponsor_contract_id = contract.id and progress.season_id = objective.season_id
  where contract.id = p_contract_id group by contract.team_id;
$$;

-- Use NEW's annual season, including during rollover; looking up the old
-- contract row in this BEFORE trigger would retain last season's partials.
create or replace function public.synchronize_s3_sponsor_satisfaction_score()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_year integer; v_objective integer; v_sport integer;
begin
  if new.role <> 'principal' or new.sponsor_offer_id is null then return new; end if;
  select game_year into v_year from public.seasons where status = 'active' order by game_year desc limit 1;
  if coalesce(v_year, 0) < 3 then return new; end if;
  select least(100, round(coalesce(sum(case
    when objective.status = 'completed' then objective.satisfaction_points
    when objective.objective_type = 'race_result' and objective.status = 'failed'
      then private.sponsor_partial_objective_points(objective.satisfaction_points, progress.details)
    else 0 end), 0) * (1 + 0.10 * public.get_team_specialization_power(
      new.team_id, 'media_center', 'community_media'))))::integer into v_objective
  from public.sponsor_objectives as objective
  left join public.objective_progress as progress on progress.sponsor_objective_id = objective.id
    and progress.team_sponsor_contract_id = new.id and progress.season_id = objective.season_id
  where objective.sponsor_offer_id = new.sponsor_offer_id
    and objective.season_id = coalesce(new.objective_season_id, new.start_season_id);
  select (least(25, coalesce(sum(points) filter (where event_type in ('race_result','uci_ranking')), 0))
    + least(8, coalesce(sum(points) filter (where event_type = 'pre_race_commitment'), 0)))::integer into v_sport
  from public.sponsor_satisfaction_events where team_sponsor_contract_id = new.id
    and season_id = coalesce(new.objective_season_id, new.start_season_id);
  new.satisfaction_score := least(100, coalesce(v_objective, 0) + coalesce(v_sport, 0));
  new.satisfaction_updated_at := now(); return new;
end;
$$;

-- Combativity is persisted after homologation. Refresh only the targeted,
-- unsettled objectives, not the global financial/settlement engines.
create or replace function private.refresh_sponsor_partials_after_combativity()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_edition uuid; v_contract uuid;
begin
  for v_edition in select distinct id from unnest(array[
    case when tg_op <> 'INSERT' then old.race_edition_id end,
    case when tg_op <> 'DELETE' then new.race_edition_id end
  ]) as editions(id) where id is not null loop
    for v_contract in
      select distinct contract.id
      from public.race_editions as edition
      join public.sponsor_objectives as objective on objective.season_id = edition.season_id
        and objective.objective_type = 'race_result' and objective.status <> 'cancelled'
      join public.objective_progress as progress on progress.sponsor_objective_id = objective.id
        and progress.season_id = edition.season_id and progress.settled_at is null
      join public.team_sponsor_contracts as contract on contract.id = progress.team_sponsor_contract_id
        and contract.sponsor_offer_id = objective.sponsor_offer_id
        and coalesce(contract.objective_season_id, contract.start_season_id) = edition.season_id
        and contract.status = 'active'
      where edition.id = v_edition and edition.status = 'completed'
        and (objective.target_details ->> 'raceEditionId' = edition.id::text
          or objective.target_details ->> 'raceId' = edition.race_id::text)
    loop
      perform private.refresh_sponsor_race_partial_objectives(v_contract, false);
    end loop;
  end loop;
  return null;
end;
$$;
drop trigger if exists refresh_sponsor_partials_after_combativity on public.race_combativity_awards;
create trigger refresh_sponsor_partials_after_combativity
after insert or update or delete on public.race_combativity_awards
for each row execute function private.refresh_sponsor_partials_after_combativity();

revoke all on function private.sponsor_partial_objective_points(integer,jsonb) from public, anon, authenticated;
revoke all on function private.get_sponsor_race_partial_achievements(uuid,uuid) from public, anon, authenticated;
revoke all on function private.refresh_sponsor_race_partial_objectives(uuid,boolean) from public, anon, authenticated;
revoke all on function private.refresh_sponsor_partials_after_combativity() from public, anon, authenticated;
revoke all on function public.evaluate_sponsor_objectives_for_contract(uuid,boolean) from public, anon, authenticated;
grant execute on function public.evaluate_sponsor_objectives_for_contract(uuid,boolean) to service_role;
revoke all on function public.get_sponsor_objective_satisfaction_score(uuid) from public, anon, authenticated;
grant execute on function public.get_sponsor_objective_satisfaction_score(uuid) to service_role;
revoke all on function public.synchronize_s3_sponsor_satisfaction_score() from public, anon, authenticated;

comment on function public.evaluate_sponsor_objectives_for_contract(uuid,boolean) is
  'Réussite partielle sur la course visée : général proche, étapes, classements annexes et combativité. Un seul crédit de 10 à 40 %, sans valider le général manqué.';
notify pgrst, 'reload schema';
commit;
