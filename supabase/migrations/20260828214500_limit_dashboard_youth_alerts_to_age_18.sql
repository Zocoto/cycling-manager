begin;

do $migration$
declare
  v_definition text;
  v_previous_cte constant text := $previous$
  youth_alerts as (
    select count(*)::integer as youth_alert_count
    from public.youth_development_notifications as notification
    join current_context as context
      on context.team_id = notification.team_id
    where notification.read_at is null
  ),
$previous$;
  v_replacement_cte constant text := $replacement$
  youth_alerts as (
    select count(*)::integer as youth_alert_count
    from public.youth_academy_riders as academy
    join current_context as context
      on context.team_id = academy.team_id
    where academy.status = 'active'
      and context.game_year - academy.birth_game_year = 18
  ),
$replacement$;
begin
  select pg_get_functiondef(
    'public.get_current_dashboard_assistant_summary()'::regprocedure
  ) into v_definition;

  if strpos(v_definition, v_previous_cte) = 0 then
    raise exception
      'Le bloc des alertes juniors du résumé du Bureau est introuvable.';
  end if;

  execute replace(v_definition, v_previous_cte, v_replacement_cte);
end;
$migration$;

comment on function public.get_current_dashboard_assistant_summary() is
  'Résumé opérationnel compact du Bureau. Les alertes juniors ciblent uniquement les jeunes actifs de 18 ans dont la promotion professionnelle reste à programmer.';

notify pgrst, 'reload schema';

commit;
