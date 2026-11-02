begin;
set local application_name = 'sponsor-race-results-fix-20261102';
set local statement_timeout = '5s';
set local lock_timeout = '500ms';

-- A terminal status is a cached evaluation, not a final settlement. Evaluate
-- an unsealed race goal against its official classification before preserving
-- terminal states. Keep settled history, annual scope, payouts and all other
-- objective types on their existing paths. Reuse the existing indexed lookup.
do $refresh_unsettled_race_results$
declare
  v_function regprocedure := 'public.evaluate_sponsor_objectives_for_contract_pre_philosophies_20260821(uuid,boolean)'::regprocedure;
  v_definition text;
  v_terminal_checks text := $anchor$    if v_objective.objective_status = 'completed'
      or v_objective.progress_status = 'achieved' then
      v_status := 'achieved';
    elsif v_objective.objective_status = 'failed'
      or v_objective.progress_status = 'failed' then
      v_status := 'failed';

    elsif v_objective.objective_type = 'race_result' then$anchor$;
  v_next_branch text := $anchor$    elsif v_objective.objective_type = 'nationality_quota' then$anchor$;
begin
  select replace(pg_get_functiondef(v_function), chr(13), '') into v_definition;
  v_terminal_checks := replace(v_terminal_checks, chr(13), '');
  if position('-- Unsettled race goals follow the official classification.' in v_definition) > 0 then
    return;
  end if;
  if (length(v_definition) - length(replace(v_definition, v_terminal_checks, ''))) / length(v_terminal_checks) <> 1
    or (length(v_definition) - length(replace(v_definition, v_next_branch, ''))) / length(v_next_branch) <> 1 then
    raise exception 'Unexpected sponsor race evaluator: reviewed anchors must occur exactly once';
  end if;
  v_definition := replace(v_definition, v_terminal_checks, $replacement$    -- Unsettled race goals follow the official classification.
    if v_objective.objective_type = 'race_result'
      and v_objective.settled_at is null then$replacement$);
  v_definition := replace(v_definition, v_next_branch, $replacement$    elsif v_objective.objective_status = 'completed'
      or v_objective.progress_status = 'achieved' then
      v_status := 'achieved';
    elsif v_objective.objective_status = 'failed'
      or v_objective.progress_status = 'failed' then
      v_status := 'failed';

    elsif v_objective.objective_type = 'nationality_quota' then$replacement$);
  execute v_definition;
end;
$refresh_unsettled_race_results$;

commit;
