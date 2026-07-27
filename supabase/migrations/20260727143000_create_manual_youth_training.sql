begin;

alter table public.youth_academy_riders
  add column training_mode text not null default 'automatic',
  add column automatic_since_season_id uuid
    references public.seasons(id) on delete restrict,
  add column automatic_since_day_number smallint;

update public.youth_academy_riders
set
  automatic_since_season_id = joined_season_id,
  automatic_since_day_number = joined_day_number;

alter table public.youth_academy_riders
  add constraint youth_academy_riders_training_mode_allowed check (
    training_mode in ('automatic', 'manual')
  ),
  add constraint youth_academy_riders_automatic_period_shape check (
    (
      training_mode = 'automatic'
      and automatic_since_season_id is not null
      and automatic_since_day_number between 1 and 28
    )
    or (
      training_mode = 'manual'
      and automatic_since_season_id is null
      and automatic_since_day_number is null
    )
  );

update public.youth_academy_riders
set training_priority = case
  when greatest(time_trial, flat, prologue) >= greatest(mountain, hills)
    then 'rouleur'
  when mountain >= hills then 'climber'
  else 'puncheur'
end
where training_priority = 'stage_racer';

alter table public.youth_academy_riders
  alter column training_priority set default 'rouleur',
  drop constraint youth_academy_riders_training_allowed,
  add constraint youth_academy_riders_training_allowed check (
    training_priority in (
      'climber',
      'puncheur',
      'northern_classics',
      'rouleur',
      'breakaway',
      'sprinter'
    )
  );

alter table public.youth_academy_riders
  drop constraint youth_academy_riders_ratings_range,
  add constraint youth_academy_riders_ratings_range check (
    mountain between 1 and 8.25
    and hills between 1 and 8.25
    and flat between 1 and 8.25
    and time_trial between 1 and 8.25
    and cobbles between 1 and 8.25
    and sprint between 1 and 8.25
    and acceleration between 1 and 8.25
    and downhill between 1 and 8.25
    and endurance between 1 and 8.25
    and resistance between 1 and 8.25
    and recovery between 1 and 8.25
    and breakaway between 1 and 8.25
    and prologue between 1 and 8.25
  );

alter table public.youth_academy_training_sessions
  drop constraint youth_academy_training_sessions_unique,
  add column training_mode text not null default 'automatic',
  add column slot text not null default 'automatic',
  add column game_type text,
  add column score smallint;

alter table public.youth_academy_training_sessions
  add constraint youth_academy_training_sessions_unique_slot unique (
    academy_rider_id,
    season_day_id,
    slot
  ),
  add constraint youth_academy_training_sessions_mode_allowed check (
    training_mode in ('automatic', 'manual')
  ),
  add constraint youth_academy_training_sessions_slot_allowed check (
    slot in ('automatic', 'manual_am', 'manual_pm')
  ),
  add constraint youth_academy_training_sessions_game_allowed check (
    game_type is null
    or game_type in ('rhythm', 'reflex', 'speed')
  ),
  add constraint youth_academy_training_sessions_score_range check (
    score is null or score between 0 and 1000
  ),
  add constraint youth_academy_training_sessions_mode_shape check (
    (
      training_mode = 'automatic'
      and slot = 'automatic'
      and game_type is null
      and score is null
    )
    or (
      training_mode = 'manual'
      and slot in ('manual_am', 'manual_pm')
      and game_type is not null
      and score is not null
    )
  );

create table public.youth_academy_training_attempts (
  id uuid primary key default gen_random_uuid(),
  academy_rider_id uuid not null
    references public.youth_academy_riders(id) on delete cascade,
  season_id uuid not null references public.seasons(id) on delete cascade,
  season_day_id uuid not null
    references public.season_days(id) on delete cascade,
  day_number smallint not null,
  slot text not null,
  training_priority text not null,
  game_type text not null,
  status text not null default 'started',
  score smallint,
  started_at timestamptz not null default now(),
  expires_at timestamptz not null,
  completed_at timestamptz,
  constraint youth_academy_training_attempts_unique_slot unique (
    academy_rider_id,
    season_day_id,
    slot
  ),
  constraint youth_academy_training_attempts_day_range check (
    day_number between 1 and 28
  ),
  constraint youth_academy_training_attempts_slot_allowed check (
    slot in ('manual_am', 'manual_pm')
  ),
  constraint youth_academy_training_attempts_priority_allowed check (
    training_priority in (
      'climber',
      'puncheur',
      'northern_classics',
      'rouleur',
      'breakaway',
      'sprinter'
    )
  ),
  constraint youth_academy_training_attempts_game_allowed check (
    game_type in ('rhythm', 'reflex', 'speed')
  ),
  constraint youth_academy_training_attempts_status_allowed check (
    status in ('started', 'completed', 'expired')
  ),
  constraint youth_academy_training_attempts_score_range check (
    score is null or score between 0 and 1000
  )
);

create index youth_academy_training_attempts_rider_day_idx
  on public.youth_academy_training_attempts (
    academy_rider_id,
    day_number desc
  );

alter table public.youth_academy_training_attempts enable row level security;

create policy youth_academy_training_attempts_read_managed
on public.youth_academy_training_attempts
for select
to authenticated
using (
  exists (
    select 1
    from public.youth_academy_riders as academy
    where academy.id = youth_academy_training_attempts.academy_rider_id
      and public.current_user_manages_team(academy.team_id)
  )
);

create or replace function public.normalize_youth_training_priority()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.training_priority = 'stage_racer' then
    new.training_priority := case
      when greatest(new.time_trial, new.flat, new.prologue)
        >= greatest(new.mountain, new.hills)
        then 'rouleur'
      when new.mountain >= new.hills then 'climber'
      else 'puncheur'
    end;
  end if;

  if new.training_mode = 'manual' then
    new.automatic_since_season_id := null;
    new.automatic_since_day_number := null;
  elsif (
    new.automatic_since_season_id is null
    or new.automatic_since_day_number is null
  ) then
    new.automatic_since_season_id := new.joined_season_id;
    new.automatic_since_day_number := new.joined_day_number;
  end if;

  return new;
end;
$$;

create trigger normalize_youth_training_priority_before_write
before insert or update of training_priority, training_mode
on public.youth_academy_riders
for each row execute function public.normalize_youth_training_priority();

create or replace function public.get_youth_training_domain_weight(
  p_domain text,
  p_rating_key text
)
returns numeric
language sql
immutable
set search_path = public
as $$
  select case
    when (
      (p_domain = 'climber' and p_rating_key in ('mountain', 'endurance'))
      or (
        p_domain = 'puncheur'
        and p_rating_key in ('hills', 'acceleration')
      )
      or (
        p_domain = 'northern_classics'
        and p_rating_key in ('cobbles', 'resistance', 'flat')
      )
      or (
        p_domain = 'rouleur'
        and p_rating_key in ('timeTrial', 'flat', 'prologue')
      )
      or (
        p_domain = 'breakaway'
        and p_rating_key in ('breakaway', 'endurance', 'resistance')
      )
      or (
        p_domain = 'sprinter'
        and p_rating_key in ('sprint', 'acceleration', 'flat')
      )
    ) then 1
    when (
      (
        p_domain = 'climber'
        and p_rating_key in (
          'hills',
          'recovery',
          'downhill',
          'acceleration'
        )
      )
      or (
        p_domain = 'puncheur'
        and p_rating_key in (
          'mountain',
          'sprint',
          'resistance',
          'breakaway'
        )
      )
      or (
        p_domain = 'northern_classics'
        and p_rating_key in (
          'endurance',
          'acceleration',
          'sprint',
          'breakaway'
        )
      )
      or (
        p_domain = 'rouleur'
        and p_rating_key in ('endurance', 'resistance', 'recovery')
      )
      or (
        p_domain = 'breakaway'
        and p_rating_key in ('hills', 'flat', 'recovery', 'downhill')
      )
      or (
        p_domain = 'sprinter'
        and p_rating_key in ('resistance', 'prologue', 'cobbles')
      )
    ) then 0.55
    else 0.1
  end;
$$;

create or replace function public.save_current_youth_training_settings(
  p_academy_rider_id uuid,
  p_training_priority text,
  p_training_mode text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_academy record;
  v_current_season_id uuid;
  v_current_day_id uuid;
  v_current_day_number smallint;
begin
  if p_training_priority not in (
    'climber',
    'puncheur',
    'northern_classics',
    'rouleur',
    'breakaway',
    'sprinter'
  ) then
    raise exception 'La priorité d’entraînement junior est invalide.';
  end if;

  if p_training_mode not in ('automatic', 'manual') then
    raise exception 'Le mode d’entraînement junior est invalide.';
  end if;

  select academy.*
  into v_academy
  from public.youth_academy_riders as academy
  where academy.id = p_academy_rider_id
    and academy.status in ('active', 'recruited')
    and public.current_user_manages_team(academy.team_id)
  for update;

  if v_academy is null then
    raise exception 'Ce jeune ne fait pas partie de votre école.';
  end if;

  select season.id, day.id, day.day_number
  into v_current_season_id, v_current_day_id, v_current_day_number
  from public.seasons as season
  join public.season_days as day
    on day.season_id = season.id
   and day.day_number = coalesce(season.current_day_number, 1)
  where season.status = 'active'
  limit 1;

  if (
    v_academy.training_mode is distinct from p_training_mode
    or v_academy.training_priority is distinct from p_training_priority
  ) and (
    exists (
      select 1
      from public.youth_academy_training_sessions as session
      where session.academy_rider_id = v_academy.id
        and session.season_day_id = v_current_day_id
    )
    or exists (
      select 1
      from public.youth_academy_training_attempts as attempt
      where attempt.academy_rider_id = v_academy.id
        and attempt.season_day_id = v_current_day_id
        and attempt.status = 'started'
        and attempt.expires_at > now()
    )
  ) then
    raise exception 'L’entraînement du jour a déjà commencé. Cette programmation pourra être modifiée demain.';
  end if;

  update public.youth_academy_riders
  set
    training_priority = p_training_priority,
    training_mode = p_training_mode,
    automatic_since_season_id = case
      when p_training_mode = 'manual' then null
      when v_academy.training_mode is distinct from 'automatic'
        then v_current_season_id
      else v_academy.automatic_since_season_id
    end,
    automatic_since_day_number = case
      when p_training_mode = 'manual' then null
      when v_academy.training_mode is distinct from 'automatic'
        then v_current_day_number
      else v_academy.automatic_since_day_number
    end,
    updated_at = now()
  where id = v_academy.id;
end;
$$;

create or replace function public.start_current_youth_training_attempt(
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

  v_game_type := case
    when v_context.training_priority in ('climber', 'puncheur')
      then 'rhythm'
    when v_context.training_priority in (
      'northern_classics',
      'breakaway'
    ) then 'reflex'
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
    35,
    'startedAt',
    v_attempt.started_at
  );
end;
$$;

create or replace function public.complete_current_youth_training_attempt(
  p_attempt_id uuid,
  p_score integer
)
returns jsonb
language plpgsql
security definer
set search_path = public
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
  v_divisor numeric;
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
    v_divisor := case
      when v_current_projected < 50 then 1000
      when v_current_projected < 60 then 2000
      when v_current_projected < 65 then 4000
      when v_current_projected < 70 then 6000
      else 10000
    end;
    v_weight := public.get_youth_training_domain_weight(
      v_context.attempt_training_priority,
      v_stat.rating_key
    );
    v_projected_gain := (
      p_score * (v_context.potential_steps / 2.0) / v_divisor
    ) * v_weight;
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
    'score',
    p_score,
    'slot',
    v_context.slot,
    'trainingPriority',
    v_context.attempt_training_priority,
    'ratingChanges',
    v_projected_changes
  );
end;
$$;

grant select on table public.youth_academy_training_attempts
  to authenticated;
grant all privileges on table public.youth_academy_training_attempts
  to service_role;

revoke all on function public.normalize_youth_training_priority()
  from public, anon;
revoke all on function public.get_youth_training_domain_weight(text, text)
  from public, anon;

revoke all on function public.save_current_youth_training_priority(uuid, text)
  from public, anon, authenticated;

revoke all on function public.save_current_youth_training_settings(
  uuid,
  text,
  text
) from public, anon;
grant execute on function public.save_current_youth_training_settings(
  uuid,
  text,
  text
) to authenticated, service_role;

revoke all on function public.start_current_youth_training_attempt(uuid)
  from public, anon;
grant execute on function public.start_current_youth_training_attempt(uuid)
  to authenticated, service_role;

revoke all on function public.complete_current_youth_training_attempt(
  uuid,
  integer
) from public, anon;
grant execute on function public.complete_current_youth_training_attempt(
  uuid,
  integer
) to authenticated, service_role;

comment on table public.youth_academy_training_attempts is
  'Tentatives de minijeu junior, limitées à un résultat validé par jeune et par demi-journée.';
comment on function public.save_current_youth_training_settings(
  uuid,
  text,
  text
) is
  'Programme le profil et le mode du junior tant que son entraînement du jour n’a pas commencé.';
comment on function public.start_current_youth_training_attempt(uuid) is
  'Ouvre ou relance une tentative manuelle dans le créneau parisien courant.';
comment on function public.complete_current_youth_training_attempt(
  uuid,
  integer
) is
  'Valide la durée et le score du minijeu, puis applique atomiquement les gains liés au potentiel.';

notify pgrst, 'reload schema';

commit;
