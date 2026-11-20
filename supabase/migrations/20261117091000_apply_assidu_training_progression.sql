begin;
set local lock_timeout = '500ms';
set local statement_timeout = '10s';

-- Apply Assidu to training gain before rating ceilings and ledger writes.
-- Read the personality in each engine's existing rider query.
do $assidu$
declare
  v_signature regprocedure;
  v_definition text;
  v_select_anchor text;
  v_select_replacement text;
  v_gain_anchor text;
  v_gain_replacement text;
  v_pro_multiplier constant text := ' * case when v_rider.personality_key = ''assidu'' then 1.05 else 1 end';
begin
  foreach v_signature in array array[
    'public.settle_due_training_sessions()'::regprocedure,
    'public.settle_due_free_agent_training(integer)'::regprocedure,
    'public.complete_current_youth_training_attempt(uuid,integer)'::regprocedure
  ] loop
    v_definition := replace(pg_get_functiondef(v_signature), E'\r\n', E'\n');
    if position('assidu_training_progression_v1' in v_definition) > 0 then continue; end if;

    if v_signature = 'public.settle_due_training_sessions()'::regprocedure then
      v_select_anchor := E'\n        rider.potential_steps,';
      v_select_replacement := v_select_anchor || E'\n        rider.personality_key,';
      v_gain_anchor := '* public.get_rider_training_progress_multiplier(v_rider.id)';
      v_gain_replacement := v_gain_anchor || E'\n           ' || v_pro_multiplier;
    elsif v_signature = 'public.settle_due_free_agent_training(integer)'::regprocedure then
      v_select_anchor := 'select rating.*, rider.potential_steps, rider.decline_resistance_multiplier';
      v_select_replacement := v_select_anchor || ', rider.personality_key';
      v_gain_anchor := '* public.get_rider_training_progress_multiplier(v_rider.rider_id)';
      v_gain_replacement := v_gain_anchor || E'\n         ' || v_pro_multiplier;
    else
      v_select_anchor := E'\n    academy.potential_steps,';
      v_select_replacement := v_select_anchor || E'\n    academy.personality_key,';
      v_gain_anchor := 'v_next_raw := public.get_youth_training_next_raw_rating(v_current_raw, v_projected_gain, v_context.potential_steps);';
      v_gain_replacement := 'v_projected_gain := v_projected_gain * case when v_context.personality_key = ''assidu'' then 1.05 else 1 end;'
        || E'\n    ' || v_gain_anchor;
    end if;

    if (length(v_definition) - length(replace(v_definition, v_select_anchor, ''))) <> length(v_select_anchor)
      or (length(v_definition) - length(replace(v_definition, v_gain_anchor, ''))) <> length(v_gain_anchor) then
      raise exception 'Unexpected training definition for %, cannot apply Assidu safely.', v_signature;
    end if;
    v_definition := replace(v_definition, v_select_anchor, v_select_replacement || ' -- assidu_training_progression_v1');
    v_definition := replace(v_definition, v_gain_anchor, v_gain_replacement);
    execute v_definition;
  end loop;
end;
$assidu$;

commit;
