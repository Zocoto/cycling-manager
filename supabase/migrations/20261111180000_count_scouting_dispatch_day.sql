begin;
set local application_name = 'scouting-dispatch-day-20261111';
set local lock_timeout = '3s';
set local statement_timeout = '10s';

-- Preserve completed and cancelled missions recorded under the previous rule.
alter table public.youth_scouting_missions
  drop constraint youth_scouting_missions_day_order;

update public.youth_scouting_missions
set completes_day_number = completes_day_number - 1,
    updated_at = now()
where status = 'active'
  and completes_day_number = start_day_number + duration_days;

alter table public.youth_scouting_missions
  add constraint youth_scouting_missions_day_order check (
    completes_day_number = start_day_number + duration_days - 1
    or (status <> 'active' and completes_day_number = start_day_number + duration_days)
  );

do $migration$
declare
  v_start_definition text;
  v_dashboard_definition text;
  v_date_guard constant text := 'v_context.current_day_number + p_duration_days > 28';
  v_insert_date constant text := E'v_context.current_day_number + p_duration_days\n';
  v_alert_window constant text := 'context.current_day_number + 3 <= 28 -- scout_launch_window_v1';
  v_inclusive_date_guard constant text := 'v_context.current_day_number + p_duration_days - 1 > 28';
  v_inclusive_insert_date constant text := E'v_context.current_day_number + p_duration_days - 1\n';
  v_inclusive_alert_window constant text := 'context.current_day_number + 2 <= 28 -- scout_launch_window_v2';
begin
  v_start_definition := replace(pg_get_functiondef(
    'public.start_current_team_youth_scouting(uuid,uuid,integer)'::regprocedure
  ), E'\r\n', E'\n');
  v_dashboard_definition := pg_get_functiondef('public.get_current_dashboard_assistant_summary()'::regprocedure);

  if strpos(v_start_definition, v_inclusive_date_guard) > 0
    and strpos(v_start_definition, v_inclusive_insert_date) > 0
    and strpos(v_dashboard_definition, v_inclusive_alert_window) > 0
    and strpos(v_start_definition, v_date_guard) = 0
    and strpos(v_start_definition, v_insert_date) = 0
    and strpos(v_dashboard_definition, v_alert_window) = 0 then
    return;
  end if;

  if (length(v_start_definition) - length(replace(v_start_definition, v_date_guard, ''))) <> length(v_date_guard)
    or (length(v_start_definition) - length(replace(v_start_definition, v_insert_date, ''))) <> length(v_insert_date)
    or (length(v_dashboard_definition) - length(replace(v_dashboard_definition, v_alert_window, ''))) <> length(v_alert_window)
    or strpos(v_start_definition, v_inclusive_date_guard) > 0
    or strpos(v_start_definition, v_inclusive_insert_date) > 0
    or strpos(v_dashboard_definition, v_inclusive_alert_window) > 0 then
    raise exception 'Unexpected scouting mission dates or dashboard launch window.';
  end if;

  v_start_definition := replace(v_start_definition, v_date_guard, v_inclusive_date_guard);
  execute replace(v_start_definition, v_insert_date, v_inclusive_insert_date);
  execute replace(v_dashboard_definition, v_alert_window, v_inclusive_alert_window);
end;
$migration$;

notify pgrst, 'reload schema';
commit;
