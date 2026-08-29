begin;

-- The season day changes before the 08:00 Paris training cutoff. The previous
-- throttle keyed its claim to seasons.current_day_number, so a pre-cutoff cron
-- could mark the new day as completed even though settle_due_training_sessions
-- correctly had nothing to process yet. Key the claim to the latest day whose
-- actual training cutoff has passed instead.
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
  v_due_day_number integer;
  v_processed_sessions integer := 0;
  v_completed_sessions integer := 0;
begin
  select
    season.id,
    season.current_day_number::integer,
    (max(day.day_number) filter (
      where now() >= (
        (day.calendar_date::timestamp + time '08:00')
          at time zone 'Europe/Paris'
      )
    ))::integer
  into v_season_id, v_current_day_number, v_due_day_number
  from public.seasons as season
  left join public.season_days as day
    on day.season_id = season.id
  where season.status = 'active'
  group by season.id, season.current_day_number
  limit 1;

  if v_season_id is null then
    return query select 0, 0, null::integer;
    return;
  end if;

  if v_due_day_number is null then
    return query select 0, 0, v_current_day_number;
    return;
  end if;

  update public.game_settlement_throttles as throttle
  set last_claimed_at = clock_timestamp()
  where throttle.task_key = 'training'
    and (
      throttle.last_completed_season_id is distinct from v_season_id
      or throttle.last_completed_day_number is null
      or throttle.last_completed_day_number < v_due_day_number
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
      last_completed_day_number = v_due_day_number
    where task_key = 'training';
  end if;

  return query select
    coalesce(v_processed_sessions, 0),
    coalesce(v_completed_sessions, 0),
    v_current_day_number;
end;
$$;

-- Re-arm today's claim once. The settlement function is idempotent through the
-- rider/day uniqueness constraint, so this only catches up sessions skipped by
-- the premature claim and cannot duplicate already recorded sessions.
update public.game_settlement_throttles
set last_completed_season_id = null,
  last_completed_day_number = null
where task_key = 'training';

revoke all on function public.settle_due_training_sessions_throttled()
  from public, anon, authenticated;
grant execute on function public.settle_due_training_sessions_throttled()
  to service_role;

comment on function public.settle_due_training_sessions_throttled() is
  'Settles professional training once per cutoff-eligible Paris day, never when the season day changes before 08:00.';

commit;
