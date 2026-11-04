begin;
set local lock_timeout='3s';
set local statement_timeout='5s';

-- A mission takes at least 3 complete days and must finish by J28. Keep
-- physical staff availability and ready reports untouched; only this prompt
-- must require a launchable mission. Reuse the existing dashboard context.
do $patch$
declare
  v_definition text;
  v_anchor constant text := $anchor$      'availableScoutCount', (
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
      )$anchor$;
  v_replacement text;
begin
  v_definition:=replace(pg_get_functiondef('public.get_current_dashboard_assistant_summary()'::regprocedure),E'\r\n',E'\n');
  if position('scout_launch_window_v1' in v_definition)>0 then return; end if;
  if (length(v_definition)-length(replace(v_definition,v_anchor,'')))/length(v_anchor)<>1 then
    raise exception 'Unexpected scout alert count: nothing patched.';
  end if;
  v_replacement:=replace(v_anchor, '        where contract.status = ''active''',
    '        where contract.status = ''active'''||E'\n          and context.current_day_number + 3 <= 28 -- scout_launch_window_v1');
  execute replace(v_definition,v_anchor,v_replacement);
end;
$patch$;

notify pgrst,'reload schema';
commit;
