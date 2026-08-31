begin;

-- A programme saved after the 8 h cutoff only becomes effective at the next
-- session. The training page already displays that pending version, so the
-- Bureau must use the same latest scheduled version instead of the version
-- that was effective for the session that has just passed.
do $migration$
declare
  v_definition text;
  v_previous_cte constant text := $previous$
  latest_training_plans as (
    select distinct on (plan.rider_id)
      plan.rider_id,
      plan.intensity
    from public.rider_training_plan_versions as plan
    join active_contracts as contract
      on contract.rider_id = plan.rider_id
    join current_context as context
      on context.team_id = plan.team_id
     and context.season_id = plan.season_id
    where plan.effective_from_day_number <= context.current_day_number
    order by
      plan.rider_id,
      plan.effective_from_day_number desc,
      plan.created_at desc
  ),
$previous$;
  v_replacement_cte constant text := $replacement$
  latest_training_plans as (
    select distinct on (plan.rider_id)
      plan.rider_id,
      plan.intensity
    from public.rider_training_plan_versions as plan
    join active_contracts as contract
      on contract.rider_id = plan.rider_id
    join current_context as context
      on context.team_id = plan.team_id
     and context.season_id = plan.season_id
    order by
      plan.rider_id,
      plan.effective_from_day_number desc,
      plan.created_at desc
  ),
$replacement$;
begin
  select pg_get_functiondef(
    'public.get_current_dashboard_assistant_summary()'::regprocedure
  ) into v_definition;

  if strpos(v_definition, v_previous_cte) = 0 then
    raise exception
      'Le bloc des programmes d’entraînement du résumé du Bureau est introuvable.';
  end if;

  execute replace(v_definition, v_previous_cte, v_replacement_cte);
end;
$migration$;

comment on function public.get_current_dashboard_assistant_summary() is
  'Résumé opérationnel compact du Bureau. L’alerte d’entraînement repose sur le dernier programme planifié, y compris celui de la prochaine séance.';

notify pgrst, 'reload schema';

commit;
