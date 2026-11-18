begin;
set local lock_timeout = '500ms';
set local statement_timeout = '5s';

-- A future second stage cannot reopen the startlist of a race already begun.
-- Check the actual first departure and its official simulation/settlement
-- state while retaining the existing pre-departure registration cutoff.
do $detection$
declare
  v_definition text := replace(pg_get_functiondef('public.settle_due_free_agent_detection_teams(timestamptz)'::regprocedure), chr(13), '');
  v_previous constant text := E'      and exists (\n        select 1\n        from public.stages as future_stage\n        where future_stage.race_edition_id = edition.id\n          and future_stage.departure_at > p_now\n      )';
  v_replacement constant text := replace($new$      and exists (
        select 1
        from public.stages as first_stage
        where first_stage.race_edition_id = edition.id
          and first_stage.stage_number = 1
          and first_stage.status = 'planned'
          and first_stage.departure_at > p_now
          and not exists (
            select 1 from public.official_stage_simulations as simulation where simulation.stage_id = first_stage.id
          )
          and not exists (
            -- Official simulation claims become reclaimable after 120 seconds.
            select 1 from public.official_stage_simulation_claims as claim
            where claim.stage_id = first_stage.id and claim.claimed_at >= p_now - interval '120 seconds'
          )
          and not exists (
            select 1 from public.stage_results as result where result.stage_id = first_stage.id
          )
      )$new$, chr(13), '');
begin
  if strpos(v_definition, v_replacement) > 0 and strpos(v_definition, v_previous) = 0 then return; end if;
  if length(v_definition) - length(replace(v_definition, v_previous, '')) <> length(v_previous) then
    raise exception 'Unexpected detection-team startlist cutoff.';
  end if;
  execute replace(v_definition, v_previous, v_replacement);
end;
$detection$;

comment on function public.settle_due_free_agent_detection_teams(timestamptz) is
  'Complète, après la clôture des inscriptions et avant le premier départ et sa simulation officielle, les courses standard éligibles avec des agents libres.';

commit;
