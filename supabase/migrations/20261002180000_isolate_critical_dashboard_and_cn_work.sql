begin;
set local lock_timeout = '3s';
set local statement_timeout = '30s';

-- Patch the current definitions, not an old copy: every unrelated gameplay
-- correction and every return column is retained. Abort on unexpected source.
do $migration$
declare
  v_definition text;
  v_anchor text;
begin
  select replace(pg_get_functiondef('public.get_current_dashboard_fast_summary()'::regprocedure), chr(13), '') into v_definition;
  v_anchor := E'    select summary.total_count, summary.ready_count\n    from public.get_current_game_objective_summary_cached() as summary';
  if position(v_anchor in v_definition) = 0 then
    raise exception 'Unexpected dashboard objective source; migration aborted';
  end if;
  v_definition := replace(v_definition,
    'FUNCTION public.get_current_dashboard_fast_summary()',
    'FUNCTION public.get_current_dashboard_core_summary()');
  execute replace(v_definition, v_anchor,
    '    select 0::integer as total_count, 0::integer as ready_count');

  select replace(pg_get_functiondef('public.get_current_dashboard_fast_summary_v2()'::regprocedure), chr(13), '') into v_definition;
  if position('from public.get_current_dashboard_fast_summary() as summary' in v_definition) = 0 then
    raise exception 'Unexpected dashboard v2 source; migration aborted';
  end if;
  v_definition := replace(v_definition,
    'FUNCTION public.get_current_dashboard_fast_summary_v2()',
    'FUNCTION public.get_current_dashboard_core_summary_v2()');
  execute replace(v_definition,
    'from public.get_current_dashboard_fast_summary() as summary',
    'from public.get_current_dashboard_core_summary() as summary');

  -- The summary needs progress only for unclaimed objectives. Already claimed
  -- objectives still count in total_count; their detail page is unchanged.
  select replace(pg_get_functiondef('public.get_current_game_objective_summary_cached()'::regprocedure), chr(13), '') into v_definition;
  v_anchor := E'    select\n      count(*)::integer,\n      count(*) filter (\n        where objective.is_completed\n          and objective.claimed_at is null\n      )::integer\n    into v_total_count, v_ready_count\n    from public.get_current_game_objectives() as objective;';
  if position(v_anchor in v_definition) = 0 then
    raise exception 'Unexpected objective summary source; migration aborted';
  end if;
  execute replace(v_definition, v_anchor, $replacement$
    with active_definitions as materialized (
      select definition.objective_key, definition.metric_key, definition.target_value
      from public.game_objective_definitions as definition
      where definition.is_active = true
    ), unclaimed as materialized (
      select definition.*
      from active_definitions as definition
      left join public.game_objective_claims as claim
        on claim.objective_key = definition.objective_key
        and claim.sporting_director_id = v_context.sporting_director_id
      where claim.claimed_at is null
    ), metric_progress as materialized (
      select metric.metric_key, public.calculate_game_objective_progress(
        metric.metric_key, v_context.sporting_director_id,
        v_context.team_id, v_context.experience_points
      ) as value
      from (select distinct metric_key from unclaimed) as metric
    )
    select (select count(*)::integer from active_definitions),
      count(*) filter (where progress.value >= definition.target_value)::integer
    into v_total_count, v_ready_count
    from unclaimed as definition
    join metric_progress as progress on progress.metric_key = definition.metric_key;
  $replacement$);

  -- Keep the world-wide scheduler intact. A DS saving their grid synchronizes
  -- only their team: no lock/write fan-out to every other team's CN roster.
  select replace(pg_get_functiondef('public.sync_national_championship_registrations(uuid,timestamptz)'::regprocedure), chr(13), '') into v_definition;
  if position('where registration.id = roster.race_registration_id' in v_definition) = 0
    or position(E'    where (\n      preference.is_selected = true' in v_definition) = 0
    or position('national_championship_notifications' in v_definition) > 0 then
    raise exception 'Unexpected CN synchronizer; migration aborted';
  end if;
  v_definition := replace(v_definition,
    'FUNCTION public.sync_national_championship_registrations(p_season_id uuid, p_now',
    'FUNCTION public.sync_team_national_championship_registrations(p_season_id uuid, p_team_season_id uuid, p_now');
  v_definition := replace(v_definition,
    'where registration.id = roster.race_registration_id',
    E'where registration.id = roster.race_registration_id\n    and registration.team_season_id = p_team_season_id');
  v_definition := replace(v_definition,
    E'    where (\n      preference.is_selected = true',
    E'    where candidate.team_season_id = p_team_season_id\n    and (\n      preference.is_selected = true');
  execute v_definition;

  select replace(pg_get_functiondef('public.save_current_team_national_championship_selections(jsonb)'::regprocedure), chr(13), '') into v_definition;
  v_anchor := 'perform public.sync_national_championship_registrations(v_season_id, now());';
  if position(v_anchor in v_definition) = 0 then
    raise exception 'Unexpected CN save source; migration aborted';
  end if;
  execute replace(v_definition, v_anchor,
    'perform public.sync_team_national_championship_registrations(v_season_id, v_team_season_id, now());');
end;
$migration$;

revoke all on function public.get_current_dashboard_core_summary() from public, anon, authenticated;
grant execute on function public.get_current_dashboard_core_summary() to service_role;
revoke all on function public.get_current_dashboard_core_summary_v2() from public, anon;
grant execute on function public.get_current_dashboard_core_summary_v2() to authenticated, service_role;
revoke all on function public.get_current_game_objective_summary_cached() from public, anon;
grant execute on function public.get_current_game_objective_summary_cached() to authenticated, service_role;
revoke all on function public.sync_team_national_championship_registrations(uuid,uuid,timestamptz) from public, anon, authenticated;
grant execute on function public.sync_team_national_championship_registrations(uuid,uuid,timestamptz) to service_role;

-- Additive only: speed the selected/confirmed roster join without changing rows.
create index if not exists race_rosters_active_registration_cover_idx
  on public.race_rosters (race_registration_id, rider_id)
  include (race_role, bib_number, starting_form)
  where status in ('selected', 'confirmed');

notify pgrst, 'reload schema';
commit;
