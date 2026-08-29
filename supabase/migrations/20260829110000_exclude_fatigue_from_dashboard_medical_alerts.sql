begin;

do $migration$
declare
  v_definition text;
  v_previous_cte constant text := $previous$
  medical_alerts as (
    select count(*)::integer as untreated_injury_count
    from public.rider_injuries as injury
    join active_contracts as contract
      on contract.rider_id = injury.rider_id
    where injury.status = 'active'
      and injury.expected_recovery_at > now()
      and injury.protocol_code is null
  ),
$previous$;
  v_replacement_cte constant text := $replacement$
  medical_alerts as (
    select count(*)::integer as untreated_injury_count
    from public.rider_injuries as injury
    join active_contracts as contract
      on contract.rider_id = injury.rider_id
    where injury.status = 'active'
      and injury.expected_recovery_at > now()
      and injury.protocol_code is null
      and injury.diagnosis_code is distinct from 'fatigue_exhaustion'
  ),
$replacement$;
begin
  select pg_get_functiondef(
    'public.get_current_dashboard_assistant_summary()'::regprocedure
  ) into v_definition;

  if strpos(v_definition, v_previous_cte) = 0 then
    raise exception
      'Le bloc des alertes médicales du résumé du Bureau est introuvable.';
  end if;

  execute replace(v_definition, v_previous_cte, v_replacement_cte);
end;
$migration$;

comment on function public.get_current_dashboard_assistant_summary() is
  'Résumé opérationnel compact du Bureau. Les alertes médicales excluent les blessures de fatigue incompressibles et non soignables.';

notify pgrst, 'reload schema';

commit;
