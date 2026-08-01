begin;

alter table public.youth_academy_training_sessions
  drop constraint youth_academy_training_sessions_game_allowed,
  add constraint youth_academy_training_sessions_game_allowed check (
    game_type is null
    or game_type in (
      'rhythm',
      'reflex',
      'speed',
      'time_trial',
      'breakaway',
      'puncheur'
    )
  );

alter table public.youth_academy_training_attempts
  drop constraint youth_academy_training_attempts_game_allowed,
  add constraint youth_academy_training_attempts_game_allowed check (
    game_type in (
      'rhythm',
      'reflex',
      'speed',
      'time_trial',
      'breakaway',
      'puncheur'
    )
  );
create or replace function public.start_current_youth_training_attempt_immediate(
  p_academy_rider_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_context record;
  v_attempt record;
  v_slot text;
  v_game_type text;
begin
  perform public.sync_active_season_day();

  select
    academy.*,
    season.id as season_id,
    coalesce(season.current_day_number, 1) as current_day_number,
    day.id as season_day_id
  into v_context
  from public.youth_academy_riders as academy
  join public.seasons as season on season.status = 'active'
  join public.season_days as day
    on day.season_id = season.id
   and day.day_number = coalesce(season.current_day_number, 1)
  where academy.id = p_academy_rider_id
    and academy.status in ('active', 'recruited')
    and public.current_user_manages_team(academy.team_id)
  for update of academy;

  if v_context is null then
    raise exception 'Ce jeune ne fait pas partie de votre école.';
  end if;

  if v_context.training_mode <> 'manual' then
    raise exception 'Ce jeune est programmé en entraînement automatique.';
  end if;

  v_slot := case
    when extract(hour from now() at time zone 'Europe/Paris') < 12
      then 'manual_am'
    else 'manual_pm'
  end;

  v_game_type := case v_context.training_priority
    when 'climber' then 'rhythm'
    when 'puncheur' then 'puncheur'
    when 'northern_classics' then 'reflex'
    when 'breakaway' then 'breakaway'
    when 'rouleur' then 'time_trial'
    else 'speed'
  end;

  if exists (
    select 1
    from public.youth_academy_training_sessions as session
    where session.academy_rider_id = v_context.id
      and session.season_day_id = v_context.season_day_id
      and session.slot = v_slot
  ) then
    raise exception 'Ce créneau d’entraînement a déjà été réalisé.';
  end if;

  select attempt.*
  into v_attempt
  from public.youth_academy_training_attempts as attempt
  where attempt.academy_rider_id = v_context.id
    and attempt.season_day_id = v_context.season_day_id
    and attempt.slot = v_slot
  for update;

  if v_attempt.id is null then
    insert into public.youth_academy_training_attempts (
      academy_rider_id,
      season_id,
      season_day_id,
      day_number,
      slot,
      training_priority,
      game_type,
      status,
      started_at,
      expires_at
    ) values (
      v_context.id,
      v_context.season_id,
      v_context.season_day_id,
      v_context.current_day_number,
      v_slot,
      v_context.training_priority,
      v_game_type,
      'started',
      now(),
      now() + interval '2 minutes'
    )
    returning * into v_attempt;
  else
    update public.youth_academy_training_attempts
    set
      training_priority = v_context.training_priority,
      game_type = v_game_type,
      status = 'started',
      score = null,
      started_at = now(),
      expires_at = now() + interval '2 minutes',
      completed_at = null
    where id = v_attempt.id
    returning * into v_attempt;
  end if;

  return jsonb_build_object(
    'attemptId',
    v_attempt.id,
    'gameType',
    v_attempt.game_type,
    'slot',
    v_attempt.slot,
    'durationSeconds',
    30,
    'startedAt',
    v_attempt.started_at
  );
end;
$$;

revoke all on function public.start_current_youth_training_attempt_immediate(
  uuid
) from public, anon, authenticated, service_role;

comment on function public.start_current_youth_training_attempt_immediate(uuid) is
  'Ouvre une tentative manuelle de 30 secondes avec un minijeu propre à chaque profil junior.';

notify pgrst, 'reload schema';

commit;