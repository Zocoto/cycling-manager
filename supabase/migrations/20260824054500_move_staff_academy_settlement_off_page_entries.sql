begin;

alter table public.game_settlement_throttles
  drop constraint if exists game_settlement_throttles_task_allowed;

alter table public.game_settlement_throttles
  add constraint game_settlement_throttles_task_allowed
  check (task_key in ('training', 'health', 'staff_academy'));

insert into public.game_settlement_throttles (task_key)
values ('staff_academy')
on conflict (task_key) do nothing;

create or replace function public.settle_due_staff_academy_trainings_throttled()
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_claimed boolean := false;
  v_season_id uuid;
  v_current_day_number integer;
begin
  select season.id, season.current_day_number::integer
  into v_season_id, v_current_day_number
  from public.seasons as season
  where season.status = 'active'
  limit 1;

  if v_season_id is null then
    return false;
  end if;

  update public.game_settlement_throttles as throttle
  set last_claimed_at = clock_timestamp()
  where throttle.task_key = 'staff_academy'
    and (
      throttle.last_completed_season_id is distinct from v_season_id
      or throttle.last_completed_day_number is null
      or throttle.last_completed_day_number < v_current_day_number
    )
  returning true into v_claimed;

  if not coalesce(v_claimed, false) then
    return false;
  end if;

  perform public.settle_due_staff_academy_trainings();

  update public.game_settlement_throttles
  set last_completed_season_id = v_season_id,
    last_completed_day_number = v_current_day_number
  where task_key = 'staff_academy';

  return true;
end;
$$;

create or replace function public.settle_current_rider_state_for_maintenance()
returns jsonb
language plpgsql
security definer
set search_path = ''
set statement_timeout = '240s'
as $$
declare
  v_training record;
  v_health record;
  v_staff_academy_processed boolean;
begin
  select *
  into v_training
  from public.settle_due_training_sessions_throttled();

  select *
  into v_health
  from public.settle_current_health_and_form_throttled();

  select public.settle_due_staff_academy_trainings_throttled()
  into v_staff_academy_processed;

  return jsonb_build_object(
    'trainingProcessed', coalesce(v_training.processed_sessions, 0),
    'trainingCompleted', coalesce(v_training.completed_sessions, 0),
    'healthDailyEffects', coalesce(v_health.processed_daily_effects, 0),
    'healthInjuryEffects', coalesce(v_health.processed_injury_effects, 0),
    'staffAcademyProcessed', coalesce(v_staff_academy_processed, false),
    'currentDayNumber', coalesce(
      v_health.current_day_number,
      v_training.current_day_number
    )
  );
end;
$$;

revoke all on function public.settle_due_staff_academy_trainings_throttled()
  from public, anon, authenticated;
grant execute on function public.settle_due_staff_academy_trainings_throttled()
  to service_role;

comment on function public.settle_due_staff_academy_trainings_throttled() is
  'Règle les stages de l’Académie hors navigation, au plus une fois par journée de jeu.';

commit;
