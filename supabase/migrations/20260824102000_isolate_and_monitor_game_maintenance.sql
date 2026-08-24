begin;

-- Les tâches globales ne font plus partie du chemin critique d'une page. Une
-- ligne par tâche conserve un état exploitable par le contrôle de santé : un
-- processus interrompu restera notamment visible avec le statut "running".
create table if not exists public.game_maintenance_runs (
  task_key text primary key,
  status text not null default 'idle',
  last_started_at timestamptz,
  last_succeeded_at timestamptz,
  last_failed_at timestamptz,
  last_duration_ms integer,
  last_error text,
  updated_at timestamptz not null default now(),

  constraint game_maintenance_runs_task_allowed check (
    task_key in (
      'training',
      'health',
      'staff-academy',
      'infrastructure',
      'elite-wildcards',
      'development'
    )
  ),
  constraint game_maintenance_runs_status_allowed check (
    status in ('idle', 'running', 'succeeded', 'failed')
  ),
  constraint game_maintenance_runs_duration_valid check (
    last_duration_ms is null or last_duration_ms >= 0
  )
);

alter table public.game_maintenance_runs enable row level security;
revoke all on table public.game_maintenance_runs
  from public, anon, authenticated;
grant all on table public.game_maintenance_runs to service_role;

insert into public.game_maintenance_runs (task_key)
values
  ('training'),
  ('health'),
  ('staff-academy'),
  ('infrastructure'),
  ('elite-wildcards'),
  ('development')
on conflict (task_key) do nothing;

-- Un seul domaine par transaction : une tâche lente ou en échec ne peut plus
-- empêcher les autres de s'exécuter. Le délai long est réservé au service_role.
create or replace function public.run_game_maintenance_task(p_task_key text)
returns jsonb
language plpgsql
security definer
set search_path = ''
set statement_timeout = '240s'
as $$
declare
  v_result jsonb;
  v_count integer;
  v_processed boolean;
begin
  case p_task_key
    when 'training' then
      select to_jsonb(settlement)
      into v_result
      from public.settle_due_training_sessions_throttled() as settlement;

    when 'health' then
      select to_jsonb(settlement)
      into v_result
      from public.settle_current_health_and_form_throttled() as settlement;

    when 'staff-academy' then
      select public.settle_due_staff_academy_trainings_throttled()
      into v_processed;
      v_result := jsonb_build_object('processed', coalesce(v_processed, false));

    when 'infrastructure' then
      select public.settle_due_infrastructure_projects() into v_count;
      v_result := jsonb_build_object('completedProjects', coalesce(v_count, 0));

    when 'elite-wildcards' then
      select to_jsonb(settlement)
      into v_result
      from public.settle_due_elite_wildcards() as settlement;

    when 'development' then
      select public.settle_due_development_races() into v_count;
      v_result := jsonb_build_object('completedRaces', coalesce(v_count, 0));

    else
      raise exception 'Tâche de maintenance inconnue : %', p_task_key;
  end case;

  return coalesce(v_result, '{}'::jsonb);
end;
$$;

revoke all on function public.run_game_maintenance_task(text)
  from public, anon, authenticated;
grant execute on function public.run_game_maintenance_task(text)
  to service_role;

-- Ces règlements globaux restent accessibles aux fonctions SECURITY DEFINER
-- qui en ont besoin, mais plus directement depuis une session utilisateur.
revoke execute on function public.settle_due_infrastructure_projects()
  from public, anon, authenticated;
revoke execute on function public.settle_due_elite_wildcards()
  from public, anon, authenticated;
revoke execute on function public.settle_due_development_races()
  from public, anon, authenticated;
revoke execute on function public.settle_due_staff_academy_trainings()
  from public, anon, authenticated;
revoke execute on function public.settle_finished_race_conditions()
  from public, anon, authenticated;

grant execute on function public.settle_due_infrastructure_projects()
  to service_role;
grant execute on function public.settle_due_elite_wildcards()
  to service_role;
grant execute on function public.settle_due_development_races()
  to service_role;
grant execute on function public.settle_due_staff_academy_trainings()
  to service_role;
grant execute on function public.settle_finished_race_conditions()
  to service_role;

comment on table public.game_maintenance_runs is
  'Dernier état observable des maintenances globales exécutées hors navigation.';
comment on function public.run_game_maintenance_task(text) is
  'Exécute une seule maintenance globale avec un délai adapté, exclusivement via service_role.';

commit;
