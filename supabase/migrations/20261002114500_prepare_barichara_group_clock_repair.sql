begin;

-- Explicit user-authorized historical replay, restricted to this one-day race.
-- The saved source and all persisted rows must match the audited input. Every
-- mutation, accounting delta and backup is committed together or rolled back.
create or replace function public.repair_barichara_group_clocks_20261002(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_key constant text := 'barichara-s3-group-clocks-20261002';
  v_edition constant uuid := '696634c3-b04e-45cc-afb1-56494cde3102';
  v_stage constant uuid := '894e7bf7-ad24-406e-8e45-39be91ba4b09';
  v_lock public.official_stage_simulations%rowtype;
  v_row record;
  v_event public.reward_events%rowtype;
  v_context record;
  v_day record;
  v_morale_day uuid;
  v_snapshot jsonb;
  v_old_morale numeric;
  v_new_morale numeric;
  v_summary jsonb;
begin
  if p_payload->>'editionId' is distinct from v_edition::text
    or p_payload->>'stageId' is distinct from v_stage::text
    or p_payload->>'oldEngineVersion' is distinct from '2026.09-leadout-selective-finishes-v36'
    or p_payload->>'newEngineVersion' is distinct from '2026.10-validated-road-group-clocks-v41'
    or jsonb_typeof(p_payload->'simulation') is distinct from 'object'
    or jsonb_typeof(p_payload->'rewardChanges') is distinct from 'array'
    or jsonb_typeof(p_payload->'attackAfter') is distinct from 'array'
    or jsonb_typeof(p_payload->'newsAfter') is distinct from 'array' then
    raise exception 'Périmètre du replay Barichara invalide.';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(v_key, 0));
  if exists (select 1 from public.official_race_historical_corrections where correction_key=v_key) then
    return jsonb_build_object('alreadyApplied', true);
  end if;
  select * into v_lock from public.official_stage_simulations
  where stage_id=v_stage and race_edition_id=v_edition for update;
  if not found or v_lock.engine_version is distinct from p_payload->>'oldEngineVersion'
    or v_lock.simulation_data is distinct from p_payload->'sourceSimulation' then
    raise exception 'La simulation source a changé depuis l audit.';
  end if;
  if (select count(*) from public.stages where race_edition_id=v_edition) <> 1
    or not exists (select 1 from public.race_editions e join public.races r on r.id=e.race_id
      where e.id=v_edition and e.status='completed' and r.race_format='one_day')
    or exists (select 1 from public.race_secondary_results where race_edition_id=v_edition) then
    raise exception 'Course source hors périmètre.';
  end if;
  perform 1 from public.stage_results where stage_id=v_stage for update;
  perform 1 from public.race_results where race_edition_id=v_edition for update;
  perform 1 from public.reward_events where source_reference like 'official-race:'||v_edition||':%' for update;
  if (select jsonb_agg(to_jsonb(r) order by r.id) from public.stage_results r where stage_id=v_stage)
      is distinct from p_payload->'stageBefore'
    or (select jsonb_agg(to_jsonb(r) order by r.id) from public.race_results r where race_edition_id=v_edition)
      is distinct from p_payload->'raceBefore'
    or (select jsonb_agg(to_jsonb(r) order by r.id) from public.reward_events r
      where source_reference like 'official-race:'||v_edition||':%') is distinct from p_payload->'rewardsBefore' then
    raise exception 'Classements ou récompenses modifiés depuis l audit.';
  end if;
  if (select count(*) from public.stage_results where stage_id=v_stage) <> 74
    or (select count(*) from public.race_results where race_edition_id=v_edition) <> 74
    or jsonb_array_length(p_payload#>'{simulation,results}') <> 74
    or jsonb_array_length(p_payload->'rewardChanges') <> 74
    or p_payload#>>'{simulation,stageId}' is distinct from v_stage::text
    or p_payload#>>'{simulation,seed}' is distinct from v_lock.seed
    or exists (select 1 from public.stage_results where stage_id=v_stage
      and (status<>'finished' or injury_id is not null or time_bonus_seconds<>0 or time_penalty_seconds<>0)) then
    raise exception 'Startlist, état sportif ou graine modifiés.';
  end if;
  create temporary table pg_temp.barichara_results on commit drop as
  select roster.id as roster_id, r.*
  from jsonb_to_recordset(p_payload#>'{simulation,results}') as r(
    "riderId" uuid, rank smallint, status text, "elapsedTimeSeconds" bigint,
    "gapToWinnerSeconds" bigint, injury jsonb, abandonment jsonb
  ) join public.race_rosters roster on roster.rider_id=r."riderId"
  join public.race_registrations registration on registration.id=roster.race_registration_id
  where registration.race_edition_id=v_edition;
  if (select count(*) from pg_temp.barichara_results) <> 74
    or (select count(distinct "riderId") from pg_temp.barichara_results) <> 74
    or (select count(distinct rank) from pg_temp.barichara_results) <> 74
    or (select min(rank) from pg_temp.barichara_results) <> 1
    or (select max(rank) from pg_temp.barichara_results) <> 74
    -- jsonb_to_recordset converts a JSON null into SQL NULL, not jsonb 'null'.
    or exists (select 1 from pg_temp.barichara_results r where status is distinct from 'finished'
      or injury is not null or abandonment is not null
      or "elapsedTimeSeconds" is null or "gapToWinnerSeconds" is null
      or "elapsedTimeSeconds"<=0 or "gapToWinnerSeconds"<0
      or "gapToWinnerSeconds" <> "elapsedTimeSeconds"-(select "elapsedTimeSeconds" from pg_temp.barichara_results where rank=1))
    or exists (select 1 from pg_temp.barichara_results a join pg_temp.barichara_results b on b.rank=a.rank+1
      where b."elapsedTimeSeconds"<a."elapsedTimeSeconds")
    or (select race_roster_id from public.race_results where race_edition_id=v_edition and final_rank=1)
      is distinct from (select roster_id from pg_temp.barichara_results where rank=1)
    or not exists (select 1 from pg_temp.barichara_results
      where "riderId"='2066c4b8-36d2-4912-85fb-a49305a2b892' and rank=3 and "gapToWinnerSeconds"=0) then
    raise exception 'Replay incomplet ou classement incohérent.';
  end if;
  create temporary table pg_temp.barichara_rewards on commit drop as
  select * from jsonb_to_recordset(p_payload->'rewardChanges') as r(
    "riderId" uuid, "rosterId" uuid, "teamSeasonId" uuid, "oldRank" smallint, "newRank" smallint,
    source text, "oldCash" numeric, "newCash" numeric, "oldUci" integer, "newUci" integer,
    "oldXp" integer, "newXp" integer, "oldRep" numeric, "newRep" numeric, description text
  );
  if (select count(distinct "riderId") from pg_temp.barichara_rewards) <> 74
    or exists (select 1 from pg_temp.barichara_rewards p
      left join pg_temp.barichara_results r on r."riderId"=p."riderId" and r.roster_id=p."rosterId"
      left join public.race_results old on old.race_roster_id=p."rosterId" and old.race_edition_id=v_edition
      left join public.race_registrations reg on reg.id=(select race_registration_id from public.race_rosters where id=p."rosterId")
      where r."riderId" is null or p."newRank" is distinct from r.rank or p."oldRank" is distinct from old.final_rank
        or p."teamSeasonId" is distinct from reg.team_season_id
        or source is distinct from 'official-race:'||v_edition||':rider:'||p."riderId"||':v1'
        or "oldCash" is null or "newCash" is null or "oldUci" is null or "newUci" is null
        or "oldXp" is null or "newXp" is null or "oldRep" is null or "newRep" is null
        or least("newCash","newUci","newXp","newRep")<0 or description is null)
    or (select sum("newCash"-"oldCash") from pg_temp.barichara_rewards)<>0
    or (select sum("newUci"-"oldUci") from pg_temp.barichara_rewards)<>0 then
    raise exception 'Plan des récompenses incohérent.';
  end if;
  select s.season_day_id, d.day_number, d.season_id into v_day
  from public.stages s join public.season_days d on d.id=s.season_day_id where s.id=v_stage;
  select d.id into v_morale_day from public.season_days d join public.seasons s on s.id=d.season_id
  where d.season_id=v_day.season_id and d.day_number<=s.current_day_number order by d.day_number desc limit 1;

  select jsonb_build_object(
    'officialLock',to_jsonb(v_lock), 'stageResults',p_payload->'stageBefore',
    'raceResults',p_payload->'raceBefore', 'rewardEvents',p_payload->'rewardsBefore',
    'attackParticipants',(select jsonb_agg(to_jsonb(r)) from public.stage_attack_participants r where stage_id=v_stage),
    'postRaceNews',(select jsonb_agg(to_jsonb(r)) from public.post_race_news_events r where stage_id=v_stage),
    'teamSeasons',(select jsonb_agg(to_jsonb(r)) from public.team_seasons r where id in(select "teamSeasonId" from pg_temp.barichara_rewards)),
    'riderSummaries',(select jsonb_agg(to_jsonb(r)) from public.rider_season_summaries r where season_id=v_day.season_id and rider_id in(select "riderId" from pg_temp.barichara_rewards)),
    'directors',(select jsonb_agg(to_jsonb(r)) from public.sporting_directors r where id in(select sporting_director_id from public.team_manager_assignments where status='active' and team_id in(select team_id from public.team_seasons where id in(select "teamSeasonId" from pg_temp.barichara_rewards)))),
    'conditionStates',(select jsonb_agg(to_jsonb(r)) from public.rider_condition_states r where rider_id in(select "riderId" from pg_temp.barichara_rewards) and season_day_id in(v_day.season_day_id,v_morale_day)),
    'moraleEvents',(select jsonb_agg(to_jsonb(r)) from public.rider_morale_events r where source_type='stage_result' and source_reference in(select id::text from public.stage_results where stage_id=v_stage)),
    'sponsorEvents',(select jsonb_agg(to_jsonb(r)) from public.sponsor_satisfaction_events r where race_edition_id=v_edition),
    'finance',(select jsonb_agg(to_jsonb(r)) from public.team_finance_transactions r where source_reference in(select 'reward:'||source from pg_temp.barichara_rewards))
  ) into v_snapshot;
  insert into public.official_race_historical_corrections(correction_key,race_edition_id,stage_id,payload_md5,before_snapshot)
  values(v_key,v_edition,v_stage,md5(p_payload::text),v_snapshot);

  -- Reserve ranks to avoid transient unique-index collisions; triggers are INSERT-only.
  update public.stage_results set rank=rank+1000 where stage_id=v_stage;
  update public.race_results set final_rank=final_rank+1000 where race_edition_id=v_edition;
  update public.stage_results s set rank=r.rank, elapsed_time_ms=r."elapsedTimeSeconds"*1000,
    gap_to_winner_ms=r."gapToWinnerSeconds"*1000,
    mountain_points=coalesce((p_payload#>>array['simulation','mountainPoints',r."riderId"::text])::integer,0),
    sprint_points=coalesce((p_payload#>>array['simulation','sprintPoints',r."riderId"::text])::integer,0), updated_at=now()
  from pg_temp.barichara_results r where s.stage_id=v_stage and s.race_roster_id=r.roster_id;
  update public.race_results s set final_rank=r.rank, total_time_ms=r."elapsedTimeSeconds"*1000,
    gap_to_winner_ms=r."gapToWinnerSeconds"*1000, updated_at=now()
  from pg_temp.barichara_results r where s.race_edition_id=v_edition and s.race_roster_id=r.roster_id;
  update public.official_stage_simulations set engine_version=p_payload->>'newEngineVersion',
    simulation_data=p_payload->'simulation' where stage_id=v_stage;
  delete from public.stage_attack_participants where stage_id=v_stage;
  insert into public.stage_attack_participants(stage_id,race_roster_id,participation_type,first_segment_number)
  select v_stage,"rosterId","participationType","firstSegmentNumber"
  from jsonb_to_recordset(p_payload->'attackAfter') as r("rosterId" uuid,"participationType" text,"firstSegmentNumber" smallint);
  delete from public.post_race_news_events where stage_id=v_stage;
  insert into public.post_race_news_events(id,race_edition_id,stage_id,event_kind,title,detail,featured_rider_id,featured_team_id,happened_at)
  select id,v_edition,v_stage,"eventKind",title,detail,"featuredRiderId","featuredTeamId","happenedAt"
  from jsonb_to_recordset(p_payload->'newsAfter') as r(id text,"eventKind" text,title text,detail text,
    "featuredRiderId" uuid,"featuredTeamId" uuid,"happenedAt" timestamptz);

  for v_row in select * from pg_temp.barichara_rewards loop
    select team.team_id, rider.country_id, coalesce(event.sporting_director_id,assignment.sporting_director_id) as director_id
    into v_context from public.team_seasons team join public.riders rider on rider.id=v_row."riderId"
    left join public.reward_events event on event.source_reference=v_row.source
    left join public.team_manager_assignments assignment on assignment.team_id=team.team_id
      and assignment.role='general_manager' and assignment.status='active'
    where team.id=v_row."teamSeasonId" limit 1;
    select * into v_event from public.reward_events where source_reference=v_row.source;
    if found then
      if v_event.rider_id is distinct from v_row."riderId" or v_event.team_season_id is distinct from v_row."teamSeasonId"
        or v_event.cash_prize is distinct from v_row."oldCash" or v_event.uci_points is distinct from v_row."oldUci"
        or v_event.experience_points is distinct from v_row."oldXp" or v_event.reputation_points is distinct from v_row."oldRep" then
        raise exception 'Gains sources divergents pour %.',v_row."riderId";
      end if;
      update public.reward_events set cash_prize=v_row."newCash",uci_points=v_row."newUci",
        experience_points=v_row."newXp",reputation_points=v_row."newRep",description=v_row.description where id=v_event.id;
    elsif v_row."oldCash"<>0 or v_row."oldUci"<>0 or v_row."oldXp"<>0 or v_row."oldRep"<>0 then
      raise exception 'Récompense source absente.';
    elsif v_row."newCash"<>0 or v_row."newUci"<>0 or v_row."newXp"<>0 or v_row."newRep"<>0 then
      insert into public.reward_events(source_reference,source_type,sporting_director_id,team_season_id,rider_id,
        country_id,cash_prize,uci_points,experience_points,reputation_points,description)
      values(v_row.source,'race_result',v_context.director_id,v_row."teamSeasonId",v_row."riderId",
        v_context.country_id,v_row."newCash",v_row."newUci",v_row."newXp",0,v_row.description);
      update public.reward_events set reputation_points=v_row."newRep" where source_reference=v_row.source;
    end if;
    update public.team_seasons set cash_balance=cash_balance+v_row."newCash"-v_row."oldCash",
      points=coalesce(points,0)+v_row."newUci"-v_row."oldUci" where id=v_row."teamSeasonId";
    if v_row."newUci"<>v_row."oldUci" then
      update public.rider_season_summaries set points=coalesce(points,0)+v_row."newUci"-v_row."oldUci",updated_at=now()
      where rider_id=v_row."riderId" and season_id=v_day.season_id;
      if not found then
        if v_row."oldUci"<>0 then raise exception 'Palmarès source absent.'; end if;
        insert into public.rider_season_summaries(rider_id,season_id,victories,points)
        values(v_row."riderId",v_day.season_id,0,v_row."newUci");
      end if;
    end if;
    update public.sporting_directors set reputation_points=reputation_points+v_row."newRep"-v_row."oldRep",
      experience_points=experience_points+v_row."newXp"-v_row."oldXp" where id=v_context.director_id;
    if v_row."newCash"<>v_row."oldCash" then
      insert into public.team_finance_transactions(team_season_id,season_day_id,day_number,amount,category,status,description,source_reference,posted_at)
      values(v_row."teamSeasonId",v_day.season_day_id,v_day.day_number,v_row."newCash"-v_row."oldCash",'race_prize','posted',
        v_row.description,'historical-correction:'||v_key||':'||v_row.source,now());
    end if;
    -- At the time of this S3 race the podium earned +2 morale (+4 for the winner).
    -- Append the persistent correction today, preserving later interviews/training.
    select coalesce(sum(applied_delta),0) into v_old_morale from public.rider_morale_events
    where rider_id=v_row."riderId" and source_type='stage_result'
      and source_reference=(select id::text from public.stage_results where stage_id=v_stage and race_roster_id=v_row."rosterId");
    v_new_morale:=case when v_row."newRank"=1 then v_old_morale when v_row."newRank"<=3 then 2 else 0 end;
    if v_new_morale<>v_old_morale then
      perform public.apply_rider_morale_event(v_row."riderId",v_morale_day,'manual_adjustment',v_key,
        v_new_morale-v_old_morale,'Rectification du podium — Clásica de Barichara',
        jsonb_build_object('correctionKey',v_key,'oldRank',v_row."oldRank",'rank',v_row."newRank"));
    end if;
  end loop;
  perform public.refresh_race_edition_uci_rankings(v_edition);
  -- Rebuild only the satisfaction events attributable to this race, within the cap.
  delete from public.sponsor_satisfaction_events where source_key='race:'||v_edition;
  perform public.award_s3_sponsor_performance_satisfaction(v_edition);
  for v_row in select distinct "teamSeasonId" from pg_temp.barichara_rewards loop
    perform public.evaluate_team_sponsor_objectives(v_row."teamSeasonId",false);
  end loop;
  v_summary:=p_payload->'summary'||jsonb_build_object('status','applied','backupBytes',octet_length(v_snapshot::text));
  update public.official_race_historical_corrections set after_summary=v_summary where correction_key=v_key;
  return v_summary;
end;
$$;
revoke all on function public.repair_barichara_group_clocks_20261002(jsonb) from public,anon,authenticated;
grant execute on function public.repair_barichara_group_clocks_20261002(jsonb) to service_role;
commit;
