begin;
set local application_name = 'site-latency-delivery-20261017';
set local lock_timeout = '1s';
set local statement_timeout = '8s';

-- Counting completed sessions must not read the large report JSON heap across
-- every season. Also benefits every uncached career objective computation.
create index if not exists rider_training_sessions_completed_team_idx
  on public.rider_training_sessions(team_id) where status = 'completed';

-- Exact season/rider scope and stable order used by the training history reader.
create index if not exists rider_training_sessions_eligible_history_idx
  on public.rider_training_sessions(season_id, rider_id, processed_at desc, id desc)
  where is_contract_eligible = true;

-- The assistant counts pending invitations for one director, not every country.
create index if not exists federation_selection_members_pending_owner_idx
  on public.national_federation_selection_members(owner_director_id)
  where response_status = 'pending';

-- Preserve the live definition, permissions, 60-second freshness and claim
-- invalidation. During concurrent refresh only, a matching snapshot younger
-- than two minutes can be served without queueing another page behind it.
do $migration$
declare
  v_definition text;
  v_anchor text := $anchor$  perform pg_catalog.pg_advisory_xact_lock($anchor$;
begin
  select replace(pg_get_functiondef('public.get_current_game_objective_summary_cached()'::regprocedure), chr(13), '')
    into v_definition;
  if position('objective_refresh_contention_v1' in v_definition) > 0 then return; end if;
  if (length(v_definition) - length(replace(v_definition, v_anchor, ''))) / length(v_anchor) <> 1
    or position('interval ''60 seconds''' in v_definition) = 0
    or position('from (select distinct metric_key from unclaimed) as metric' in v_definition) = 0 then
    raise exception 'Unexpected objective cache definition: review before applying';
  end if;
  v_definition := replace(v_definition, v_anchor, $replacement$  -- objective_refresh_contention_v1
  if not pg_catalog.pg_try_advisory_xact_lock(pg_catalog.hashtextextended(
    'game-objective-summary:' || v_context.sporting_director_id::text, 0
  )) then
    select cache.total_count, cache.ready_count
      into v_total_count, v_ready_count
    from public.game_objective_summary_cache as cache
    where cache.sporting_director_id = v_context.sporting_director_id
      and cache.team_id = v_context.team_id
      and cache.season_id = v_context.season_id
      and cache.season_day_number = v_context.season_day_number
      and cache.experience_points = v_context.experience_points
      and cache.computed_at >= statement_timestamp() - interval '120 seconds';
    if found then
      return query select v_total_count, v_ready_count;
      return;
    end if;
    -- No valid snapshot (including after claiming a reward): retain exact
    -- cold-cache semantics and double-check after the in-flight refresh.
    perform pg_catalog.pg_advisory_xact_lock($replacement$);
  -- Close the conditional immediately after the original lock expression.
  v_definition := replace(v_definition, E'  );\n\n  -- Une requête concurrente', E'  );\n  end if;\n\n  -- Une requête concurrente');
  if position(E'end if;\n\n  -- Une requête concurrente' in v_definition) = 0 then
    raise exception 'Unexpected objective lock boundary';
  end if;
  execute v_definition;
end;
$migration$;

notify pgrst, 'reload schema';
commit;
