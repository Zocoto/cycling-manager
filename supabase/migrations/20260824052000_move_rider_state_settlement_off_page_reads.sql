begin;

-- Les pages de lecture ne doivent jamais attendre un règlement global. Le
-- verrou mémorise désormais la dernière journée réellement terminée : le cron
-- peut passer souvent, mais le traitement coûteux ne s’exécute qu’une fois par
-- journée de jeu (et est automatiquement retenté après un échec transactionnel).
alter table public.game_settlement_throttles
  add column if not exists last_completed_season_id uuid,
  add column if not exists last_completed_day_number integer;

create or replace function public.settle_due_training_sessions_throttled()
returns table (
  processed_sessions integer,
  completed_sessions integer,
  current_day_number integer
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_claimed boolean := false;
  v_season_id uuid;
  v_current_day_number integer;
  v_processed_sessions integer := 0;
  v_completed_sessions integer := 0;
begin
  select season.id, season.current_day_number::integer
  into v_season_id, v_current_day_number
  from public.seasons as season
  where season.status = 'active'
  limit 1;

  if v_season_id is null then
    return query select 0, 0, null::integer;
    return;
  end if;

  update public.game_settlement_throttles as throttle
  set last_claimed_at = clock_timestamp()
  where throttle.task_key = 'training'
    and (
      throttle.last_completed_season_id is distinct from v_season_id
      or throttle.last_completed_day_number is null
      or throttle.last_completed_day_number < v_current_day_number
    )
  returning true into v_claimed;

  if coalesce(v_claimed, false) then
    select
      settlement.processed_sessions,
      settlement.completed_sessions,
      settlement.current_day_number
    into
      v_processed_sessions,
      v_completed_sessions,
      v_current_day_number
    from public.settle_due_training_sessions() as settlement;

    update public.game_settlement_throttles
    set last_completed_season_id = v_season_id,
      last_completed_day_number = v_current_day_number
    where task_key = 'training';
  end if;

  return query select
    coalesce(v_processed_sessions, 0),
    coalesce(v_completed_sessions, 0),
    v_current_day_number;
end;
$$;

create or replace function public.settle_current_health_and_form_throttled()
returns table (
  processed_daily_effects integer,
  processed_injury_effects integer,
  current_day_number integer
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_claimed boolean := false;
  v_season_id uuid;
  v_current_day_number integer;
  v_processed_daily_effects integer := 0;
  v_processed_injury_effects integer := 0;
begin
  select season.id, season.current_day_number::integer
  into v_season_id, v_current_day_number
  from public.seasons as season
  where season.status = 'active'
  limit 1;

  if v_season_id is null then
    return query select 0, 0, null::integer;
    return;
  end if;

  update public.game_settlement_throttles as throttle
  set last_claimed_at = clock_timestamp()
  where throttle.task_key = 'health'
    and (
      throttle.last_completed_season_id is distinct from v_season_id
      or throttle.last_completed_day_number is null
      or throttle.last_completed_day_number < v_current_day_number
    )
  returning true into v_claimed;

  if coalesce(v_claimed, false) then
    select
      settlement.processed_daily_effects,
      settlement.processed_injury_effects,
      settlement.current_day_number
    into
      v_processed_daily_effects,
      v_processed_injury_effects,
      v_current_day_number
    from public.settle_current_health_and_form() as settlement;

    update public.game_settlement_throttles
    set last_completed_season_id = v_season_id,
      last_completed_day_number = v_current_day_number
    where task_key = 'health';
  end if;

  return query select
    coalesce(v_processed_daily_effects, 0),
    coalesce(v_processed_injury_effects, 0),
    v_current_day_number;
end;
$$;

-- PostgREST limite volontairement les requêtes interactives. Seul ce point
-- d’entrée service_role, appelé par une fonction Vercel longue, peut disposer
-- du temps nécessaire au rattrapage global lorsqu’un volume important arrive.
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
begin
  select *
  into v_training
  from public.settle_due_training_sessions_throttled();

  select *
  into v_health
  from public.settle_current_health_and_form_throttled();

  return jsonb_build_object(
    'trainingProcessed', coalesce(v_training.processed_sessions, 0),
    'trainingCompleted', coalesce(v_training.completed_sessions, 0),
    'healthDailyEffects', coalesce(v_health.processed_daily_effects, 0),
    'healthInjuryEffects', coalesce(v_health.processed_injury_effects, 0),
    'currentDayNumber', coalesce(
      v_health.current_day_number,
      v_training.current_day_number
    )
  );
end;
$$;

revoke all on function public.settle_current_rider_state_for_maintenance()
  from public, anon, authenticated;
grant execute on function public.settle_current_rider_state_for_maintenance()
  to service_role;

comment on function public.settle_current_rider_state_for_maintenance() is
  'Règle hors requête utilisateur l’état quotidien global avec un délai adapté au volume, au plus une fois par journée de jeu.';

commit;
