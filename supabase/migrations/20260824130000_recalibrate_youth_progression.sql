begin;

create or replace function public.get_youth_talent_progress_multiplier(
  p_potential_steps integer
)
returns numeric
language sql
immutable
strict
parallel safe
set search_path = public
as $$
  select
    0.50
    + 1.05
    * power(
      (least(8, greatest(1, p_potential_steps)) - 1) / 7.0,
      1.35
    );
$$;

create or replace function public.get_youth_rating_progress_factor(
  p_projected_rating numeric
)
returns numeric
language sql
immutable
strict
parallel safe
set search_path = public
as $$
  select least(
    1.30,
    greatest(
      0.45,
      0.45
      + 0.75
      * power(
        greatest(
          0.01,
          (105 - least(100, greatest(0, p_projected_rating))) / 65.0
        ),
        1.15
      )
    )
  );
$$;

create or replace function public.get_youth_profile_load_factor(
  p_profile_peak_rating numeric,
  p_profile_average_rating numeric
)
returns numeric
language sql
immutable
strict
parallel safe
set search_path = public
as $$
  with normalized as (
    select
      least(1, greatest(0, (p_profile_peak_rating - 68) / 20.0)) as peak_load,
      least(1, greatest(0, (p_profile_average_rating - 62) / 23.0)) as average_load
  ), smoothed as (
    select
      peak_load * peak_load * (3 - 2 * peak_load) as peak_load,
      average_load * average_load * (3 - 2 * average_load) as average_load
    from normalized
  )
  select (1 - peak_load * 0.18) * (1 - average_load * 0.22)
  from smoothed;
$$;

create or replace function public.get_youth_training_session_variance(
  p_seed text
)
returns numeric
language plpgsql
immutable
strict
parallel safe
set search_path = public
as $$
declare
  v_roll numeric;
begin
  v_roll := (
    ('x' || substr(md5(p_seed), 1, 8))::bit(32)::bigint
  )::numeric / 4294967295.0;

  if v_roll < 0.05 then
    return 0.78 + (v_roll / 0.05) * 0.07;
  end if;

  if v_roll > 0.95 then
    return 1.15 + ((v_roll - 0.95) / 0.05) * 0.13;
  end if;

  return 0.90 + ((v_roll - 0.05) / 0.90) * 0.20;
end;
$$;

create or replace function public.calculate_youth_training_projected_gain(
  p_training_mode text,
  p_score integer,
  p_potential_steps integer,
  p_projected_rating numeric,
  p_profile_peak_rating numeric,
  p_profile_average_rating numeric,
  p_domain_weight numeric,
  p_session_variance numeric
)
returns numeric
language sql
immutable
strict
parallel safe
set search_path = public
as $$
  select
    0.32
    * public.get_youth_talent_progress_multiplier(p_potential_steps)
    * public.get_youth_rating_progress_factor(p_projected_rating)
    * public.get_youth_profile_load_factor(
      p_profile_peak_rating,
      p_profile_average_rating
    )
    * least(1, greatest(0, p_domain_weight))
    * case p_training_mode
        when 'automatic' then 1.00
        when 'manual' then
          0.75
          * (
            0.25
            + 0.75 * least(1000, greatest(0, p_score)) / 1000.0
          )
        else 0
      end
    * least(1.28, greatest(0.78, p_session_variance));
$$;

-- Kept as a compatibility wrapper for callers deployed before this migration.
-- Unlike the former implementation, it remains continuous and never reaches 0.
create or replace function public.get_youth_high_rating_progress_factor(
  p_projected_rating numeric,
  p_potential_steps integer
)
returns numeric
language sql
immutable
strict
parallel safe
set search_path = public
as $$
  select
    public.get_youth_rating_progress_factor(p_projected_rating)
    * public.get_youth_talent_progress_multiplier(p_potential_steps);
$$;

create or replace function public.complete_current_youth_training_attempt(
  p_attempt_id uuid,
  p_score integer
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_context record;
  v_stat record;
  v_current_slot text;
  v_ratings jsonb;
  v_ratings_after jsonb := '{}'::jsonb;
  v_raw_changes jsonb := '{}'::jsonb;
  v_projected_changes jsonb := '{}'::jsonb;
  v_current_raw numeric;
  v_current_projected numeric;
  v_profile_peak_rating numeric;
  v_profile_average_rating numeric;
  v_session_variance numeric;
  v_weight numeric;
  v_projected_gain numeric;
  v_next_raw numeric;
  v_raw_gain numeric;
begin
  if p_score is null or p_score < 0 or p_score > 1000 then
    raise exception 'Le score du minijeu est invalide.';
  end if;

  perform public.sync_active_season_day();

  select
    attempt.id as attempt_id,
    attempt.academy_rider_id,
    attempt.season_id,
    attempt.season_day_id,
    attempt.day_number,
    attempt.slot,
    attempt.training_priority as attempt_training_priority,
    attempt.game_type,
    attempt.status as attempt_status,
    attempt.started_at,
    attempt.expires_at,
    academy.training_mode,
    academy.potential_steps,
    academy.mountain,
    academy.hills,
    academy.flat,
    academy.time_trial,
    academy.cobbles,
    academy.sprint,
    academy.acceleration,
    academy.downhill,
    academy.endurance,
    academy.resistance,
    academy.recovery,
    academy.breakaway,
    academy.prologue,
    coalesce(season.current_day_number, 1) as current_day_number,
    current_day.id as current_season_day_id
  into v_context
  from public.youth_academy_training_attempts as attempt
  join public.youth_academy_riders as academy
    on academy.id = attempt.academy_rider_id
  join public.seasons as season
    on season.id = attempt.season_id
   and season.status = 'active'
  join public.season_days as current_day
    on current_day.season_id = season.id
   and current_day.day_number = coalesce(season.current_day_number, 1)
  where attempt.id = p_attempt_id
    and academy.status in ('active', 'recruited')
    and public.current_user_manages_team(academy.team_id)
  for update of attempt, academy;

  if v_context is null then
    raise exception 'Cette tentative d’entraînement est introuvable.';
  end if;

  if v_context.attempt_status <> 'started' then
    raise exception 'Cette tentative d’entraînement est déjà terminée.';
  end if;

  if now() < v_context.started_at + interval '30 seconds' then
    raise exception 'La séance doit durer au moins trente secondes.';
  end if;

  if now() > v_context.expires_at then
    update public.youth_academy_training_attempts
    set status = 'expired'
    where id = v_context.attempt_id;
    raise exception 'Cette tentative a expiré. Relancez le minijeu.';
  end if;

  v_current_slot := case
    when extract(hour from now() at time zone 'Europe/Paris') < 12
      then 'manual_am'
    else 'manual_pm'
  end;

  if (
    v_context.season_day_id <> v_context.current_season_day_id
    or v_context.slot <> v_current_slot
  ) then
    raise exception 'Le créneau de cette tentative est terminé.';
  end if;

  if v_context.training_mode <> 'manual' then
    raise exception 'Ce jeune n’est plus programmé en entraînement manuel.';
  end if;

  if exists (
    select 1
    from public.youth_academy_training_sessions as session
    where session.academy_rider_id = v_context.academy_rider_id
      and session.season_day_id = v_context.season_day_id
      and session.slot = v_context.slot
  ) then
    raise exception 'Ce créneau d’entraînement a déjà été réalisé.';
  end if;

  v_ratings := jsonb_build_object(
    'mountain', v_context.mountain,
    'hills', v_context.hills,
    'flat', v_context.flat,
    'timeTrial', v_context.time_trial,
    'cobbles', v_context.cobbles,
    'sprint', v_context.sprint,
    'acceleration', v_context.acceleration,
    'downhill', v_context.downhill,
    'endurance', v_context.endurance,
    'resistance', v_context.resistance,
    'recovery', v_context.recovery,
    'breakaway', v_context.breakaway,
    'prologue', v_context.prologue
  );

  select
    max(least(100, greatest(0, 34 + rating.value::numeric * 8))),
    avg(least(100, greatest(0, 34 + rating.value::numeric * 8)))
  into v_profile_peak_rating, v_profile_average_rating
  from jsonb_each_text(v_ratings) as rating;

  v_session_variance := public.get_youth_training_session_variance(
    v_context.academy_rider_id::text
    || ':' || v_context.season_day_id::text
    || ':' || v_context.slot
    || ':manual'
  );

  for v_stat in
    select stat.rating_key
    from (
      values
        ('mountain'),
        ('hills'),
        ('flat'),
        ('timeTrial'),
        ('cobbles'),
        ('sprint'),
        ('acceleration'),
        ('downhill'),
        ('endurance'),
        ('resistance'),
        ('recovery'),
        ('breakaway'),
        ('prologue')
    ) as stat(rating_key)
  loop
    v_current_raw := (v_ratings ->> v_stat.rating_key)::numeric;
    v_current_projected := least(
      100,
      greatest(0, 34 + v_current_raw * 8)
    );
    v_weight := public.get_youth_training_domain_weight(
      v_context.attempt_training_priority,
      v_stat.rating_key
    );
    v_projected_gain := public.calculate_youth_training_projected_gain(
      'manual',
      p_score,
      v_context.potential_steps,
      v_current_projected,
      v_profile_peak_rating,
      v_profile_average_rating,
      v_weight,
      v_session_variance
    );
    v_next_raw := least(
      8.25,
      round((v_current_raw + v_projected_gain / 8.0)::numeric, 3)
    );
    v_raw_gain := greatest(0, v_next_raw - v_current_raw);

    v_ratings_after := jsonb_set(
      v_ratings_after,
      array[v_stat.rating_key],
      to_jsonb(v_next_raw),
      true
    );

    if v_raw_gain > 0 then
      v_raw_changes := jsonb_set(
        v_raw_changes,
        array[v_stat.rating_key],
        to_jsonb(v_raw_gain),
        true
      );
      v_projected_changes := jsonb_set(
        v_projected_changes,
        array[v_stat.rating_key],
        to_jsonb(round((v_raw_gain * 8)::numeric, 3)),
        true
      );
    end if;
  end loop;

  update public.youth_academy_riders
  set
    mountain = (v_ratings_after ->> 'mountain')::numeric,
    hills = (v_ratings_after ->> 'hills')::numeric,
    flat = (v_ratings_after ->> 'flat')::numeric,
    time_trial = (v_ratings_after ->> 'timeTrial')::numeric,
    cobbles = (v_ratings_after ->> 'cobbles')::numeric,
    sprint = (v_ratings_after ->> 'sprint')::numeric,
    acceleration = (v_ratings_after ->> 'acceleration')::numeric,
    downhill = (v_ratings_after ->> 'downhill')::numeric,
    endurance = (v_ratings_after ->> 'endurance')::numeric,
    resistance = (v_ratings_after ->> 'resistance')::numeric,
    recovery = (v_ratings_after ->> 'recovery')::numeric,
    breakaway = (v_ratings_after ->> 'breakaway')::numeric,
    prologue = (v_ratings_after ->> 'prologue')::numeric,
    updated_at = now()
  where id = v_context.academy_rider_id;

  insert into public.youth_academy_training_sessions (
    academy_rider_id,
    season_id,
    season_day_id,
    day_number,
    training_priority,
    training_mode,
    slot,
    game_type,
    score,
    rating_changes,
    ratings_after
  ) values (
    v_context.academy_rider_id,
    v_context.season_id,
    v_context.season_day_id,
    v_context.day_number,
    v_context.attempt_training_priority,
    'manual',
    v_context.slot,
    v_context.game_type,
    p_score,
    v_raw_changes,
    v_ratings_after
  );

  update public.youth_academy_training_attempts
  set
    status = 'completed',
    score = p_score,
    completed_at = now()
  where id = v_context.attempt_id;

  return jsonb_build_object(
    'score', p_score,
    'slot', v_context.slot,
    'trainingPriority', v_context.attempt_training_priority,
    'ratingChanges', v_projected_changes
  );
end;
$$;

-- The race reward remains capped at +1 for the winner, but its attenuation is
-- now continuous as well instead of changing abruptly at 70, 74 and 77.
create or replace function public.get_development_podium_rating_factor(
  p_projected_rating numeric
)
returns numeric
language sql
immutable
strict
parallel safe
set search_path = public
as $$
  select least(
    1.00,
    1.25 * power(public.get_youth_rating_progress_factor(p_projected_rating), 2)
  );
$$;

revoke execute on function public.get_youth_talent_progress_multiplier(integer)
  from public, anon, authenticated;
revoke execute on function public.get_youth_rating_progress_factor(numeric)
  from public, anon, authenticated;
revoke execute on function public.get_youth_profile_load_factor(numeric, numeric)
  from public, anon, authenticated;
revoke execute on function public.get_youth_training_session_variance(text)
  from public, anon, authenticated;
revoke execute on function public.calculate_youth_training_projected_gain(
  text,
  integer,
  integer,
  numeric,
  numeric,
  numeric,
  numeric,
  numeric
) from public, anon, authenticated;
revoke execute on function public.get_youth_high_rating_progress_factor(numeric, integer)
  from public, anon, authenticated;
revoke execute on function public.get_development_podium_rating_factor(numeric)
  from public, anon, authenticated;

revoke all on function public.complete_current_youth_training_attempt(uuid, integer)
  from public, anon;
grant execute on function public.complete_current_youth_training_attempt(uuid, integer)
  to authenticated, service_role;

comment on function public.get_youth_talent_progress_multiplier(integer) is
  'Continuous youth-only talent multiplier. Talent has substantially more influence than in professional training.';
comment on function public.get_youth_rating_progress_factor(numeric) is
  'Continuous individual-stat development curve without a rating-70 step or a soft ceiling.';
comment on function public.get_youth_profile_load_factor(numeric, numeric) is
  'Slightly slows the whole profile when a youth already has a very strong peak or average.';
comment on function public.get_youth_training_session_variance(text) is
  'Deterministic session-quality variance, including rare poor and exceptional training days.';
comment on function public.calculate_youth_training_projected_gain(text, integer, integer, numeric, numeric, numeric, numeric, numeric) is
  'Shared continuous youth progression formula. Two good manual sessions are about 39 percent stronger than one automatic day.';
comment on function public.get_youth_high_rating_progress_factor(numeric, integer) is
  'Compatibility wrapper for the former threshold-based youth function; now continuous and always positive.';
comment on function public.complete_current_youth_training_attempt(uuid, integer) is
  'Validates a manual minigame and atomically applies the continuous youth progression model.';
comment on function public.get_development_podium_rating_factor(numeric) is
  'Continuously attenuates junior podium progression as the relevant rating becomes stronger.';

notify pgrst, 'reload schema';

commit;
