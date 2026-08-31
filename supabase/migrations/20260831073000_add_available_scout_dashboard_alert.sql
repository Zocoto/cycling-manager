begin;

-- Keep the Bureau on its single compact RPC and reuse the same active-contract
-- and active-mission rules as the youth scouting page.
do $migration$
declare
  v_definition text;
  v_previous_payload constant text := $previous$
      'juniorManualTrainingSlot', case
        when extract(hour from now() at time zone 'Europe/Paris') < 12
          then 'manual_am'
        else 'manual_pm'
      end
    ) as items
$previous$;
  v_replacement_payload constant text := $replacement$
      'juniorManualTrainingSlot', case
        when extract(hour from now() at time zone 'Europe/Paris') < 12
          then 'manual_am'
        else 'manual_pm'
      end,
      'availableScoutCount', (
        select count(*)::integer
        from public.staff_contracts as contract
        join public.staff_members as member
          on member.id = contract.staff_member_id
        join current_context as context
          on context.team_id = contract.team_id
        where contract.status = 'active'
          and member.role = 'scout'
          and not exists (
            select 1
            from public.youth_scouting_missions as mission
            where mission.scout_contract_id = contract.id
              and mission.status = 'active'
          )
      )
    ) as items
$replacement$;
begin
  select pg_get_functiondef(
    'public.get_current_dashboard_assistant_summary()'::regprocedure
  ) into v_definition;

  if strpos(v_definition, v_previous_payload) = 0 then
    raise exception
      'Le payload du résumé du Bureau est introuvable.';
  end if;

  execute replace(
    v_definition,
    v_previous_payload,
    v_replacement_payload
  );
end;
$migration$;

comment on function public.get_current_dashboard_assistant_summary() is
  'Résumé opérationnel compact du Bureau. Il inclut les scouts actifs sans mission et le rappel du créneau manuel courant des juniors.';

notify pgrst, 'reload schema';

commit;
