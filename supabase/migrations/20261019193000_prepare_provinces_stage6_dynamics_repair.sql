begin;
set local lock_timeout = '1500ms';
set local statement_timeout = '10s';
set local application_name = 'provinces-stage6-reviewed-repair-install';

-- Explicit historical exception, limited to the exact audited stage and edition.
-- Do not invoke normal settlement: it is intentionally immutable after homologation.
create or replace function public.repair_provinces_stage6_20261019(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
set statement_timeout = '20s'
set lock_timeout = '1500ms'
set timezone = 'UTC'
set application_name = 'provinces-stage6-repair-apply'
as $$
declare
  v_key constant text := 'provinces-s4-stage6-race-dynamics-20261019';
  v_edition constant uuid := '25d91f02-caff-4b23-9fd1-c6392b35fbcd';
  v_stage constant uuid := '92f2682e-40af-44ab-858d-81f3c8ae912a';
  v_source_engine constant text := '2026.10-prepared-stage-leaders-v46';
  v_lock public.official_stage_simulations%rowtype;
  v_correction public.official_race_historical_corrections%rowtype;
  v_snapshot jsonb;
  v_summary jsonb;
  v_claim uuid;
  v_row record;
  v_day uuid;
  v_changed integer;
begin
  if p_payload is null or jsonb_typeof(p_payload) <> 'object'
    or p_payload->>'editionId' is distinct from v_edition::text
    or p_payload->>'stageId' is distinct from v_stage::text
    or p_payload->>'oldEngineVersion' is distinct from v_source_engine
    or p_payload->>'newEngineVersion' is distinct from '2026.10-consistent-detached-and-finish-clocks-v47'
    or jsonb_typeof(p_payload->'sourceInput') is distinct from 'object'
    or jsonb_typeof(p_payload->'sourceSimulation') is distinct from 'object'
    or jsonb_typeof(p_payload->'simulation') is distinct from 'object'
    or jsonb_typeof(p_payload->'before') is distinct from 'object'
    or jsonb_typeof(p_payload->'stageAfter') is distinct from 'array'
    or jsonb_typeof(p_payload->'secondaryAfter') is distinct from 'array'
    or jsonb_typeof(p_payload->'attackAfter') is distinct from 'array'
    or jsonb_typeof(p_payload->'newsAfter') is distinct from 'array'
    or jsonb_typeof(p_payload->'combativityAfter') is distinct from 'array'
    or jsonb_typeof(p_payload->'moraleChanges') is distinct from 'array'
    or jsonb_typeof(p_payload->'interviewsToReset') is distinct from 'array'
    or jsonb_typeof(p_payload->'auditSummary') is distinct from 'object' then
    raise exception 'Invalid Provinces stage 6 repair payload.';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(v_key,0));
  select * into v_correction from public.official_race_historical_corrections where correction_key=v_key;
  if found then
    if v_correction.payload_md5 <> md5(p_payload::text) or v_correction.after_summary->>'status' <> 'applied'
      or not exists(select 1 from public.official_stage_simulations where stage_id=v_stage
        and engine_version=p_payload->>'newEngineVersion' and input_data=p_payload->'sourceInput'
        and simulation_data=p_payload->'simulation') then
      raise exception 'Existing correction does not match this payload.';
    end if;
    return v_correction.after_summary || jsonb_build_object('alreadyApplied',true);
  end if;

  -- Acquire the same distributed claim as the canonical settlement runner.
  -- A currently active homologation is allowed to finish; it is never cancelled.
  insert into public.race_edition_settlement_claims as claim(race_edition_id,claimed_at)
  values(v_edition,clock_timestamp()) on conflict(race_edition_id) do update
  set claimed_at=excluded.claimed_at where claim.claimed_at < statement_timestamp()-interval '5 minutes'
  returning race_edition_id into v_claim;
  if v_claim is null then raise exception 'Edition settlement claim is still active; retry later.'; end if;
  perform pg_advisory_xact_lock(hashtextextended('replace-official-stage-results:'||v_stage::text,0));
  perform 1 from public.race_editions where id=v_edition for update;
  perform 1 from public.stages where race_edition_id=v_edition order by stage_number for update;
  select * into v_lock from public.official_stage_simulations
    where stage_id=v_stage and race_edition_id=v_edition for update;
  if not found or v_lock.engine_version is distinct from v_source_engine
    or v_lock.input_data is distinct from p_payload->'sourceInput'
    or v_lock.simulation_data is distinct from p_payload->'sourceSimulation'
    or p_payload#>>'{simulation,stageId}' is distinct from v_stage::text
    or p_payload#>>'{simulation,seed}' is distinct from v_lock.seed then
    raise exception 'Saved stage 6 input, RNG seed or source simulation changed.';
  end if;
  if clock_timestamp() >= timestamptz '2026-10-20 11:50:00+00'
    or (select count(*) from public.stages where race_edition_id=v_edition) <> 12
    or (select count(*) from public.stages where race_edition_id=v_edition and stage_number<=6 and status='completed') <> 6
    or exists(select 1 from public.stages where race_edition_id=v_edition and stage_number>6 and status<>'planned')
    or (select count(*) from public.official_stage_simulations where race_edition_id=v_edition) <> 6
    or exists(select 1 from public.official_stage_simulation_claims where race_edition_id=v_edition)
    or exists(select 1 from public.stage_results r join public.stages s on s.id=r.stage_id where s.race_edition_id=v_edition and s.stage_number>6)
    or exists(select 1 from public.race_results where race_edition_id=v_edition)
    or exists(select 1 from public.reward_events where source_reference=any(array(
      with entrants as materialized (
        select r.id roster_id,r.rider_id from public.race_rosters r join public.race_registrations x on x.id=r.race_registration_id where x.race_edition_id=v_edition
      )
      select 'official-race:'||v_edition::text||':rider:'||rider_id::text||':v1' from entrants
      union all select 'official-race:'||v_edition::text||':detection-rider:'||rider_id::text||':v1' from entrants
      union all select 'official-stage-prize:'||v_edition::text||':stage:'||s.id::text||':rider:'||r.rider_id::text||':v1'
        from public.stages s join public.stage_results x on x.stage_id=s.id join entrants r on r.roster_id=x.race_roster_id where s.race_edition_id=v_edition
      union all select 'official-stage-sporting:'||v_edition::text||':stage:'||s.id::text||':rider:'||r.rider_id::text||':rank:'||x.rank::text||':v1'
        from public.stages s join public.stage_results x on x.stage_id=s.id join entrants r on r.roster_id=x.race_roster_id where s.race_edition_id=v_edition
      union all select 'official-stage-sporting:'||v_edition::text||':stage:'||s.id::text||':detection-rider:'||r.rider_id::text||':rank:'||x.rank::text||':v1'
        from public.stages s join public.stage_results x on x.stage_id=s.id join entrants r on r.roster_id=x.race_roster_id where s.race_edition_id=v_edition
      union all select 'official-combativity:'||v_edition::text||':stage:'||a.stage_id::text||':rider:'||r.rider_id::text||':v1'
        from public.race_combativity_awards a join entrants r on r.roster_id=a.race_roster_id where a.race_edition_id=v_edition and a.award_scope='stage'
    ))) then
    raise exception 'The safe six-stage, unpaid, future-unlocked repair window has changed.';
  end if;

  -- Compare every source row that is about to be changed. Old stages remain read-only.
  perform 1 from public.stage_results where stage_id=v_stage order by id for update;
  perform 1 from public.race_secondary_results where race_edition_id=v_edition for update;
  perform 1 from public.race_combativity_awards where stage_id=v_stage for update;
  if (select coalesce(jsonb_agg(to_jsonb(r) order by s.stage_number,r.id),'[]') from public.stage_results r join public.stages s on s.id=r.stage_id where s.race_edition_id=v_edition) is distinct from p_payload#>'{before,stageResults}'
    or (select coalesce(jsonb_agg(to_jsonb(r) order by r.classification_type,r.rank),'[]') from public.race_secondary_results r where r.race_edition_id=v_edition) is distinct from p_payload#>'{before,secondary}'
    or (select coalesce(jsonb_agg(to_jsonb(r) order by r.race_roster_id),'[]') from public.stage_attack_participants r where r.stage_id=v_stage) is distinct from p_payload#>'{before,attacks}'
    or (select coalesce(jsonb_agg(to_jsonb(r) order by r.award_key),'[]') from public.race_combativity_awards r where r.stage_id=v_stage) is distinct from p_payload#>'{before,combativity}'
    or (select coalesce(jsonb_agg(to_jsonb(r) order by r.id),'[]') from public.post_race_news_events r where r.stage_id=v_stage) is distinct from p_payload#>'{before,news}'
    or (select coalesce(jsonb_agg(to_jsonb(r) order by r.id),'[]') from public.race_rosters r join public.race_registrations x on x.id=r.race_registration_id where x.race_edition_id=v_edition) is distinct from p_payload#>'{before,rosters}'
    or (select coalesce(jsonb_agg(to_jsonb(r) order by r.rider_id),'[]') from public.stage_rider_condition_effects r where r.stage_id=v_stage) is distinct from p_payload#>'{before,conditionEffects}'
    or (select coalesce(jsonb_agg(to_jsonb(r) order by r.id),'[]') from public.rider_injuries r where r.source_stage_id=v_stage) is distinct from p_payload#>'{before,injuries}'
    or (select coalesce(jsonb_agg(to_jsonb(r) order by r.rider_id),'[]') from public.stage_rider_unavailabilities r where r.stage_id=v_stage) is distinct from p_payload#>'{before,unavailabilities}' then
    raise exception 'Persisted sporting state changed after the audit.';
  end if;
  if (select coalesce(jsonb_agg(jsonb_build_object('stage_id',o.stage_id,'engine_version',o.engine_version,'seed',o.seed,'created_at',o.created_at,'inputMd5',md5(o.input_data::text),'simulationMd5',md5(o.simulation_data::text)) order by s.stage_number),'[]') from public.official_stage_simulations o join public.stages s on s.id=o.stage_id where s.race_edition_id=v_edition) is distinct from p_payload#>'{before,lockGuards}' then
    raise exception 'An immutable stage 1-6 lock changed after the audit.';
  end if;

  create temporary table pg_temp.provinces_after on commit drop as
    select * from jsonb_populate_recordset(null::public.stage_results,p_payload->'stageAfter');
  if (select count(*) from pg_temp.provinces_after)<>180
    or (select count(distinct id) from pg_temp.provinces_after)<>180
    or (select count(distinct race_roster_id) from pg_temp.provinces_after)<>180
    or (select count(distinct rank) from pg_temp.provinces_after)<>180
    or (select min(rank) from pg_temp.provinces_after)<>1 or (select max(rank) from pg_temp.provinces_after)<>180
    or jsonb_array_length(p_payload#>'{simulation,results}')<>180
    or exists(select 1 from pg_temp.provinces_after n left join public.stage_results o on o.id=n.id and o.stage_id=v_stage
      where o.id is null or n.stage_id<>v_stage or n.race_roster_id is distinct from o.race_roster_id
        or o.status<>'finished' or n.status<>'finished'
        or n.injury_id is distinct from o.injury_id or n.injury_id is not null
        or n.abandonment_reason is distinct from o.abandonment_reason or n.abandonment_reason is not null
        or n.time_penalty_seconds is distinct from o.time_penalty_seconds
        or n.equipment_snapshot is distinct from o.equipment_snapshot
        or n.created_at is distinct from o.created_at
        or n.elapsed_time_ms is null or n.elapsed_time_ms<=0 or n.gap_to_winner_ms is null
        or n.gap_to_winner_ms<>n.elapsed_time_ms-(select elapsed_time_ms from pg_temp.provinces_after where rank=1)
        or n.mountain_points<0 or n.sprint_points<0 or n.time_bonus_seconds<0)
    or exists(select 1 from pg_temp.provinces_after a join pg_temp.provinces_after b on b.rank=a.rank+1 where a.elapsed_time_ms>b.elapsed_time_ms)
    or exists(select 1 from jsonb_array_elements(p_payload#>'{simulation,results}') r
      left join public.race_rosters x on x.rider_id=(r->>'riderId')::uuid and x.id in(select race_roster_id from pg_temp.provinces_after)
      left join pg_temp.provinces_after n on n.race_roster_id=x.id
      where n.id is null or r->>'status'<>'finished' or nullif(r->'injury','null'::jsonb) is not null
        or nullif(r->'abandonment','null'::jsonb) is not null or n.rank<>(r->>'rank')::integer
        or n.elapsed_time_ms<>(r->>'elapsedTimeSeconds')::bigint*1000
        or n.gap_to_winner_ms<>(r->>'gapToWinnerSeconds')::bigint*1000
        or n.mountain_points<>coalesce((p_payload#>>array['simulation','mountainPoints',r->>'riderId'])::integer,0)
        or n.sprint_points<>coalesce((p_payload#>>array['simulation','sprintPoints',r->>'riderId'])::integer,0)
        or n.time_bonus_seconds is distinct from (
          select coalesce(sum(b.seconds),0) from (
            select case (r->>'rank')::integer when 1 then 10 when 2 then 6 when 3 then 4 else 0 end as seconds
            union all
            select case (c->>'rank')::integer when 1 then 3 when 2 then 2 when 3 then 1 else 0 end
            from (select p from jsonb_array_elements(p_payload#>'{simulation,primes}') p
              where p#>>'{prime,type}'='intermediate_sprint' order by (p->>'segmentNumber')::integer limit 3) primes
            cross join lateral jsonb_array_elements(primes.p->'classification') c where c->>'riderId'=r->>'riderId'
          ) b))
    or (select count(distinct r->>'riderId') from jsonb_array_elements(p_payload#>'{simulation,results}') r)<>180 then
    raise exception 'Replayed results violate the fixed 180-rider, injury-free state or result integrity.';
  end if;

  create temporary table pg_temp.provinces_secondary on commit drop as
    select * from jsonb_populate_recordset(null::public.race_secondary_results,p_payload->'secondaryAfter');
  if (select count(*) from pg_temp.provinces_secondary)=0
    or exists(select 1 from pg_temp.provinces_secondary where race_edition_id is distinct from v_edition or classification_type not in ('mountain','sprint','youth','team') or rank<1
      or (classification_type<>'team' and (race_roster_id is null or team_season_id is not null))
      or (classification_type='team' and (race_roster_id is not null or (team_season_id is null and historical_team_name is null))))
    or exists(select 1 from pg_temp.provinces_secondary group by classification_type,rank having count(*)<>1)
    or exists(select 1 from pg_temp.provinces_secondary n where n.race_roster_id is not null and not exists(select 1 from public.race_rosters x join public.race_registrations r on r.id=x.race_registration_id where x.id=n.race_roster_id and r.race_edition_id=v_edition)) then
    raise exception 'Invalid corrected secondary classifications.';
  end if;
  if jsonb_array_length(p_payload->'combativityAfter')<>1
    or exists(select 1 from jsonb_populate_recordset(null::public.race_combativity_awards,p_payload->'combativityAfter') n
      left join public.race_combativity_awards o on o.id=n.id and o.stage_id=v_stage
      where o.id is null or n.race_edition_id<>v_edition or n.stage_id<>v_stage
        or n.award_key is distinct from o.award_key or n.award_scope is distinct from o.award_scope
        or n.cash_prize is distinct from o.cash_prize or n.experience_points is distinct from o.experience_points
        or not exists(select 1 from pg_temp.provinces_after where race_roster_id=n.race_roster_id)) then
    raise exception 'Invalid unpaid stage combativity replacement.';
  end if;
  if exists(select 1 from jsonb_to_recordset(p_payload->'attackAfter') n(stage_id uuid,race_roster_id uuid,participation_type text,first_segment_number integer)
    where stage_id is distinct from v_stage or participation_type not in ('breakaway','chase') or first_segment_number not between 1 and 15
      or not exists(select 1 from pg_temp.provinces_after where race_roster_id=n.race_roster_id))
    or exists(select 1 from jsonb_to_recordset(p_payload->'newsAfter') n(id text,stage_id uuid,race_edition_id uuid,event_kind text)
      where stage_id is distinct from v_stage or race_edition_id is distinct from v_edition
        or id not like 'post-race:'||v_stage::text||':%' or event_kind not in ('breakaway','incident','classification'))
    or exists(select 1 from jsonb_to_recordset(p_payload->'moraleChanges') n("riderId" uuid,delta numeric)
      where delta is null or delta=0 or delta not between -3 and 3 or not exists(select 1 from public.race_rosters r join pg_temp.provinces_after s on s.race_roster_id=r.id where r.rider_id=n."riderId"))
    or exists(select 1 from jsonb_to_recordset(p_payload->'moraleChanges') n("riderId" uuid) group by "riderId" having count(*)<>1) then
    raise exception 'Invalid attacks, news or morale deltas.';
  end if;

  -- Keep all submitted interviews, decisions, reactions and their consequences.
  perform 1 from public.post_race_interviews i where i.stage_id=v_stage
    and i.id in(select value::uuid from jsonb_array_elements_text(p_payload->'interviewsToReset'))
    order by i.id for update;
  if exists(select 1 from jsonb_array_elements_text(p_payload->'interviewsToReset') requested(id)
    left join public.post_race_interviews i on i.id=requested.id::uuid and i.stage_id=v_stage
    where i.id is null or i.status<>'pending' or i.answers<>'[]'::jsonb or i.closing_note is not null
      or i.submitted_at is not null or i.event_choice_id is not null or i.event_outcome is not null or i.event_resolved_at is not null
      or exists(select 1 from public.post_race_interview_answer_reactions r where r.interview_id=i.id)) then
    raise exception 'An interview selected for draft reset has received a player action.';
  end if;
  v_snapshot:=p_payload->'before'||jsonb_build_object('officialLock',to_jsonb(v_lock),
    'interviews',(select coalesce(jsonb_agg(to_jsonb(i) order by i.id),'[]') from public.post_race_interviews i where i.stage_id=v_stage),
    'conditionStatesAtApply',(select coalesce(jsonb_agg(to_jsonb(c) order by c.rider_id,c.season_day_id),'[]') from public.rider_condition_states c
      where c.rider_id in(select r.rider_id from public.race_rosters r join pg_temp.provinces_after p on p.race_roster_id=r.id)
        and c.season_day_id in(select d.id from public.season_days d join public.race_editions e on e.season_id=d.season_id
          where e.id=v_edition and d.day_number>=(select d2.day_number from public.season_days d2 join public.stages s on s.season_day_id=d2.id where s.id=v_stage))));
  insert into public.official_race_historical_corrections(correction_key,race_edition_id,stage_id,payload_md5,before_snapshot,after_summary)
    values(v_key,v_edition,v_stage,md5(p_payload::text),v_snapshot,jsonb_build_object('status','applying'));

  update public.stage_results set rank=rank+1000 where stage_id=v_stage;
  update public.stage_results o set rank=n.rank,elapsed_time_ms=n.elapsed_time_ms,gap_to_winner_ms=n.gap_to_winner_ms,
    mountain_points=n.mountain_points,sprint_points=n.sprint_points,time_bonus_seconds=n.time_bonus_seconds,updated_at=now()
    from pg_temp.provinces_after n where o.id=n.id and o.stage_id=v_stage;
  get diagnostics v_changed=row_count;
  if v_changed<>180 then raise exception 'Expected exactly 180 updates, got %.',v_changed; end if;
  delete from public.race_secondary_results o where race_edition_id=v_edition and not exists(select 1 from pg_temp.provinces_secondary n where n.classification_type=o.classification_type and n.rank=o.rank);
  insert into public.race_secondary_results(race_edition_id,classification_type,race_roster_id,team_season_id,historical_team_name,rank,points,total_time_ms)
    select v_edition,classification_type,race_roster_id,team_season_id,historical_team_name,rank,points,total_time_ms from pg_temp.provinces_secondary
    on conflict(race_edition_id,classification_type,rank) do update set race_roster_id=excluded.race_roster_id,
      team_season_id=excluded.team_season_id,historical_team_name=excluded.historical_team_name,points=excluded.points,total_time_ms=excluded.total_time_ms,updated_at=now();
  delete from public.stage_attack_participants where stage_id=v_stage;
  insert into public.stage_attack_participants(stage_id,race_roster_id,participation_type,first_segment_number)
    select v_stage,race_roster_id,participation_type,first_segment_number from jsonb_to_recordset(p_payload->'attackAfter') n(race_roster_id uuid,participation_type text,first_segment_number smallint);
  update public.race_combativity_awards o set race_roster_id=n.race_roster_id,combativity_score=n.combativity_score,score_breakdown=n.score_breakdown
    from jsonb_populate_recordset(null::public.race_combativity_awards,p_payload->'combativityAfter') n where o.id=n.id and o.stage_id=v_stage;
  delete from public.post_race_news_events where stage_id=v_stage;
  insert into public.post_race_news_events(id,race_edition_id,stage_id,event_kind,title,detail,featured_rider_id,featured_team_id,happened_at)
    select id,v_edition,v_stage,event_kind,title,detail,featured_rider_id,featured_team_id,happened_at
    from jsonb_populate_recordset(null::public.post_race_news_events,p_payload->'newsAfter');
  delete from public.post_race_interviews where stage_id=v_stage and id in(select value::uuid from jsonb_array_elements_text(p_payload->'interviewsToReset'));
  update public.official_stage_simulations set engine_version=p_payload->>'newEngineVersion',simulation_data=p_payload->'simulation'
    where stage_id=v_stage and race_edition_id=v_edition;

  select d.id into v_day from public.season_days d join public.seasons s on s.id=d.season_id
    join public.race_editions e on e.season_id=s.id where e.id=v_edition and d.day_number<=s.current_day_number order by d.day_number desc limit 1;
  for v_row in select * from jsonb_to_recordset(p_payload->'moraleChanges') n("riderId" uuid,delta numeric,metadata jsonb) loop
    perform public.apply_rider_morale_event(v_row."riderId",v_day,'manual_adjustment',v_key,v_row.delta,
      'Correction du classement — Boucle des Provinces, étape 6',coalesce(v_row.metadata,'{}'::jsonb)||jsonb_build_object('correctionKey',v_key));
  end loop;
  v_summary:=p_payload->'auditSummary'||jsonb_build_object('status','applied','engineVersion',p_payload->>'newEngineVersion',
    'stageRows',v_changed,'moraleChanges',jsonb_array_length(p_payload->'moraleChanges'),'resetDrafts',jsonb_array_length(p_payload->'interviewsToReset'),
    'savedInputPreserved',true,'oldStageLocksPreserved',true,'resultIdsPreserved',true,'formEffectsPreserved',true,'noRewardsReapplied',true);
  update public.official_race_historical_corrections set after_summary=v_summary where correction_key=v_key;
  return v_summary;
end;
$$;
revoke all on function public.repair_provinces_stage6_20261019(jsonb) from public,anon,authenticated;
grant execute on function public.repair_provinces_stage6_20261019(jsonb) to service_role;
notify pgrst, 'reload schema';
commit;
