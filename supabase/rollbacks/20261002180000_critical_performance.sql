-- Emergency business rollback only. Deploy the previous app build alongside it.
-- Keep bounded telemetry data and additive indexes; no player data is deleted.
begin;
set local lock_timeout = '3s';
do $rollback$
declare v_definition text; v_start integer; v_end integer;
begin
  select pg_get_functiondef('public.save_current_team_national_championship_selections(jsonb)'::regprocedure) into v_definition;
  if position('perform public.sync_team_national_championship_registrations(v_season_id, v_team_season_id, now());' in v_definition)=0 then
    raise exception 'Unexpected CN save source; rollback aborted';
  end if;
  execute replace(v_definition,
    'perform public.sync_team_national_championship_registrations(v_season_id, v_team_season_id, now());',
    'perform public.sync_national_championship_registrations(v_season_id, now());');
  select replace(pg_get_functiondef('public.get_current_game_objective_summary_cached()'::regprocedure),chr(13),'') into v_definition;
  v_start := position('    with active_definitions as materialized (' in v_definition);
  v_end := position('    insert into public.game_objective_summary_cache (' in v_definition);
  if v_start=0 or v_end<=v_start then raise exception 'Unexpected summary source; rollback aborted'; end if;
  execute overlay(v_definition placing $original$
    select count(*)::integer,
      count(*) filter (where objective.is_completed and objective.claimed_at is null)::integer
    into v_total_count,v_ready_count
    from public.get_current_game_objectives() as objective;

  $original$ from v_start for v_end-v_start);
end;
$rollback$;
-- Expire the private cache, never objective definitions or claims.
delete from public.game_objective_summary_cache;
notify pgrst, 'reload schema';
commit;
