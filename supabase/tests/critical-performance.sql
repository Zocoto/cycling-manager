-- Run by check-critical-performance-db.mjs within an always-rolled-back transaction.
create temporary table critical_performance_checks(check_name text, result jsonb);
do $test$
declare
  v_director record;
  v_count integer := 0;
  v_original jsonb;
  v_core jsonb;
  v_total integer;
  v_ready integer;
  v_actual record;
  v_started timestamptz;
  v_old_ms numeric := 0;
  v_core_ms numeric := 0;
begin
  for v_director in
    select distinct director.id, director.auth_user_id
    from public.sporting_directors director
    join public.team_manager_assignments assignment on assignment.sporting_director_id=director.id
    where director.status='active' and assignment.status='active' and assignment.role='general_manager'
    order by director.id limit 50
  loop
    perform set_config('request.jwt.claim.sub',v_director.auth_user_id::text,true);
    delete from public.game_objective_summary_cache where sporting_director_id=v_director.id;
    select count(*)::integer, count(*) filter (where is_completed and claimed_at is null)::integer
      into v_total,v_ready from public.get_current_game_objectives();
    select * into v_actual from public.get_current_game_objective_summary_cached();
    if v_actual.total_count is distinct from v_total or v_actual.ready_count is distinct from v_ready then
      raise exception 'Objective count mismatch';
    end if;
    -- Force a cache miss for the original blocking path, then measure the core.
    delete from public.game_objective_summary_cache where sporting_director_id=v_director.id;
    v_started := clock_timestamp();
    select to_jsonb(summary)-'objective_total_count'-'objective_ready_count' into v_original
      from public.get_current_dashboard_fast_summary_v2() summary;
    v_old_ms := v_old_ms + extract(epoch from clock_timestamp()-v_started)*1000;
    v_started := clock_timestamp();
    select to_jsonb(summary)-'objective_total_count'-'objective_ready_count' into v_core
      from public.get_current_dashboard_core_summary_v2() summary;
    v_core_ms := v_core_ms + extract(epoch from clock_timestamp()-v_started)*1000;
    if v_original is distinct from v_core then raise exception 'Dashboard business data changed'; end if;
    v_count := v_count + 1;
  end loop;
  if v_count < 10 then raise exception 'Insufficient dashboard coverage'; end if;
  insert into critical_performance_checks values ('dashboard_and_objectives',jsonb_build_object(
    'directors',v_count,'exact_match',true,'original_mean_ms',round(v_old_ms/v_count,2),'core_mean_ms',round(v_core_ms/v_count,2)));
  perform set_config('request.jwt.claim.sub','',true);
  if exists(select 1 from public.get_current_dashboard_core_summary_v2())
    or exists(select 1 from public.get_current_game_objective_summary_cached()) then raise exception 'Unauthenticated data disclosure'; end if;
  if has_function_privilege('anon','public.get_current_dashboard_core_summary_v2()','EXECUTE')
    or has_function_privilege('authenticated','public.sync_team_national_championship_registrations(uuid,uuid,timestamptz)','EXECUTE')
    or has_function_privilege('authenticated','public.get_performance_summary(integer)','EXECUTE') then raise exception 'Unsafe RPC grant'; end if;
  insert into critical_performance_checks values ('authentication_and_grants','{"ok":true}');
end;
$test$;

do $test$
declare
  v_season uuid;
  v_team uuid;
  v_country uuid;
  v_edition uuid;
  v_before jsonb;
  v_after jsonb;
  v_expected jsonb;
  v_actual jsonb;
  v_old_count integer;
  v_new_count integer;
  v_started timestamptz;
  v_old_ms numeric;
  v_new_ms numeric;
begin
  select id into v_season from public.seasons where status='active';
  select candidate.country_id into v_country
    from public.get_national_championship_country_rankings(v_season) candidate
    where candidate.team_season_id is not null
    group by candidate.country_id having count(distinct candidate.team_season_id)>1
    order by count(distinct candidate.team_season_id) desc limit 1;
  select candidate.team_season_id into v_team
    from public.get_national_championship_country_rankings(v_season) candidate
    where candidate.team_season_id is not null and candidate.country_id=v_country
    group by candidate.team_season_id,candidate.country_id order by count(*) desc limit 1;
  select edition.id into v_edition from public.race_editions edition join public.races race on race.id=edition.race_id
    where edition.season_id=v_season and race.country_id=v_country and race.competition_type='national_road' limit 1;
  if v_edition is null then raise exception 'No CN fixture'; end if;
  -- Reopen just one completed edition in this private, rolled-back transaction.
  update public.race_editions set status='registration_open' where id=v_edition;
  update public.stages set departure_at=now()+interval '1 day' where race_edition_id=v_edition and stage_number=1;
  insert into public.national_championship_rider_preferences(race_edition_id,rider_id,team_season_id,is_selected,updated_at)
    select v_edition,candidate.rider_id,v_team,candidate.national_rank%2=0,now()
    from public.get_national_championship_country_rankings(v_season) candidate
    where candidate.team_season_id=v_team and candidate.country_id=v_country
    on conflict(race_edition_id,rider_id) do update set is_selected=excluded.is_selected,team_season_id=excluded.team_season_id;
  -- Include another team explicitly, so a missing scope filter cannot pass.
  insert into public.national_championship_rider_preferences(race_edition_id,rider_id,team_season_id,is_selected,updated_at)
    select v_edition,candidate.rider_id,candidate.team_season_id,true,now()
    from public.get_national_championship_country_rankings(v_season) candidate
    where candidate.team_season_id<>v_team and candidate.country_id=v_country
      and not exists(select 1 from public.rider_injuries injury where injury.rider_id=candidate.rider_id
        and injury.started_at<now()+interval '32 hours' and injury.expected_recovery_at>now()+interval '1 day')
    limit 1
    on conflict(race_edition_id,rider_id) do update set is_selected=excluded.is_selected;
  begin
    v_started := clock_timestamp();
    v_old_count := public.sync_national_championship_registrations(v_season,now());
    v_old_ms := extract(epoch from clock_timestamp()-v_started)*1000;
    select jsonb_agg(jsonb_build_array(reg.race_edition_id,roster.rider_id,roster.status,roster.race_role) order by reg.race_edition_id,roster.rider_id)
      into v_expected from public.race_rosters roster join public.race_registrations reg on reg.id=roster.race_registration_id where reg.team_season_id=v_team;
    raise exception using errcode='ZX001',message='Rollback old synchronization fixture';
  exception when sqlstate 'ZX001' then null;
  end;
  select jsonb_agg(to_jsonb(roster) order by roster.id) into v_before
    from public.race_rosters roster join public.race_registrations reg on reg.id=roster.race_registration_id where reg.team_season_id is distinct from v_team;
  v_started := clock_timestamp();
  v_new_count := public.sync_team_national_championship_registrations(v_season,v_team,now());
  v_new_ms := extract(epoch from clock_timestamp()-v_started)*1000;
  select jsonb_agg(jsonb_build_array(reg.race_edition_id,roster.rider_id,roster.status,roster.race_role) order by reg.race_edition_id,roster.rider_id)
    into v_actual from public.race_rosters roster join public.race_registrations reg on reg.id=roster.race_registration_id where reg.team_season_id=v_team;
  select jsonb_agg(to_jsonb(roster) order by roster.id) into v_after
    from public.race_rosters roster join public.race_registrations reg on reg.id=roster.race_registration_id where reg.team_season_id is distinct from v_team;
  if v_expected is distinct from v_actual then raise exception 'CN targeted outcome mismatch'; end if;
  if v_before is distinct from v_after then raise exception 'CN modified another team'; end if;
  if v_new_count=0 then raise exception 'Empty targeted CN coverage'; end if;
  if v_old_count<=v_new_count then raise exception 'Missing multi-team CN coverage'; end if;
  -- A past departure must not re-open or rewrite even the target team.
  if public.sync_team_national_championship_registrations(v_season,v_team,now()+interval '2 days')<>0 then
    raise exception 'CN departure lock not respected';
  end if;
  insert into critical_performance_checks values ('cn_targeted_vs_global',jsonb_build_object('exact_match',true,'other_teams_unchanged',true,
    'old_synced',v_old_count,'targeted_synced',v_new_count,'old_ms',round(v_old_ms,2),'targeted_ms',round(v_new_ms,2)));
end;
$test$;

do $test$
declare v_summary record;
begin
  perform public.record_performance_samples('[{"source":"rpc","route":"/jeu","metric":"test","device":"server","value":100,"ok":true},{"source":"rpc","route":"/jeu","metric":"test","device":"server","value":200,"ok":false}]','rollback-test');
  select * into v_summary from public.get_performance_summary(1) where deployment='rollback-test';
  if v_summary.sample_count<>2 or v_summary.error_count<>1 or v_summary.p50<>150 or v_summary.p95<>195 then raise exception 'Incorrect performance aggregates'; end if;
  update public.performance_samples set recorded_at=now()-interval '15 days' where deployment='rollback-test';
  if public.prune_performance_samples()<>2 then raise exception 'Incorrect retention'; end if;
  update public.performance_sample_budgets set used=20000 where day=current_date;
  if public.record_performance_samples('[{"source":"rpc","route":"/jeu","metric":"test","device":"server","value":100,"ok":true}]','rollback-test')<>0 then raise exception 'Budget not enforced'; end if;
  insert into critical_performance_checks values ('telemetry_aggregates_retention_ceiling','{"ok":true}');
end;
$test$;
select check_name,result from critical_performance_checks;
