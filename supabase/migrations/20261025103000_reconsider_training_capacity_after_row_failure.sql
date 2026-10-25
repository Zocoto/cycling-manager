begin;
set local lock_timeout = '2s';
set local statement_timeout = '15s';

-- Preserve the applied v2 definition, its grants and timeout configuration.
-- A write failure can free the place for an otherwise valid rider that was
-- rejected only because an earlier incoming request had priority.
do $migration$
declare
  v_definition text := pg_get_functiondef('public.save_current_rider_training_plans_v2(jsonb)'::regprocedure);
  v_anchor text := '      -- Cancellation, deadlock, serialization and resource failures are NOT';
  v_replacement text := $replacement$      -- Reconsider quota-only refusals after a permanent rider write failure.
      -- Every retry retains at least one new terminal save_failed outcome, so
      -- progress remains bounded by the original maximum of 35 riders.
      select jsonb_agg(case when item ->> 'status' = 'error'
        and item ->> 'code' = 'trainer_capacity'
        then item || jsonb_build_object('status', 'pending', 'code', null, 'message', null)
        else item end order by n)
      into v_items from jsonb_array_elements(v_items) with ordinality t(item, n);
      -- Cancellation, deadlock, serialization and resource failures are NOT$replacement$;
begin
  if position('-- Reconsider quota-only refusals after a permanent rider write failure.' in v_definition) > 0 then
    return;
  end if;
  if position(v_anchor in v_definition) = 0
    or position('code'', ''save_failed''' in v_definition) = 0
    or (length(v_definition) - length(replace(v_definition, v_anchor, ''))) / length(v_anchor) <> 1 then
    raise exception 'Unexpected training v2 function definition; no change applied.';
  end if;
  execute replace(v_definition, v_anchor, v_replacement);
end;
$migration$;

notify pgrst, 'reload schema';
commit;
