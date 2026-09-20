begin;

create table public.newcomer_journey_step_definitions (
  step_key text primary key,
  position smallint not null unique,
  chapter_label text not null,
  title text not null,
  description text not null,
  href text not null,
  reward_cash numeric(14, 2) not null default 0,
  reward_experience integer not null default 0,
  created_at timestamptz not null default now(),
  constraint newcomer_journey_step_key_format
    check (step_key ~ '^[a-z0-9_]{3,80}$'),
  constraint newcomer_journey_step_position_range
    check (position between 1 and 8),
  constraint newcomer_journey_step_href_game_only
    check (href like '/jeu%'),
  constraint newcomer_journey_step_rewards_non_negative
    check (reward_cash >= 0 and reward_experience >= 0)
);

insert into public.newcomer_journey_step_definitions (
  step_key,
  position,
  chapter_label,
  title,
  description,
  href,
  reward_cash,
  reward_experience
)
values
  (
    'claim_daily_reward', 1, 'Premiers repères',
    'Récupérer le cadeau quotidien',
    'Ouvrez votre premier cadeau et découvrez la série de récompenses.',
    '/jeu/objectifs?onglet=quotidiennes', 2000, 5
  ),
  (
    'post_global_chat_message', 2, 'Premiers repères',
    'Dire bonjour au peloton',
    'Postez un message personnel dans le chat pour vous présenter ou poser une question.',
    '/jeu/chat', 2000, 5
  ),
  (
    'configure_training', 3, 'Prise en main',
    'Paramétrer un entraînement',
    'Choisissez un domaine et une intensité pour au moins un coureur.',
    '/jeu/entrainement', 3000, 10
  ),
  (
    'recruit_staff_member', 4, 'Prise en main',
    'Recruter un membre du staff',
    'Renforcez votre encadrement depuis le marché du staff.',
    '/jeu/staff?onglet=marche', 4000, 10
  ),
  (
    'place_auction_bid', 5, 'Premières décisions',
    'Faire une offre aux enchères',
    'Placez une enchère sur un coureur du marché quotidien.',
    '/jeu/transferts?onglet=quotidiennes', 4000, 10
  ),
  (
    'register_for_race', 6, 'Premières décisions',
    'S’inscrire à une course',
    'Choisissez une épreuve accessible et envoyez votre demande d’inscription.',
    '/jeu/calendrier', 5000, 10
  ),
  (
    'prepare_race', 7, 'Jour de course',
    'Préparer une course',
    'Enregistrez une stratégie d’étape pour une course à venir.',
    '/jeu/preparation-course', 5000, 15
  ),
  (
    'follow_race_live', 8, 'Jour de course',
    'Suivre le live d’une course',
    'Ouvrez le direct pendant qu’une course est en train de se dérouler.',
    '/jeu/resultats', 5000, 15
  );

create table public.newcomer_journeys (
  id uuid primary key default gen_random_uuid(),
  sporting_director_id uuid not null
    references public.sporting_directors(id) on delete cascade,
  team_id uuid not null references public.teams(id) on delete cascade,
  enrolled_at timestamptz not null default now(),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint newcomer_journeys_director_unique unique (sporting_director_id),
  constraint newcomer_journeys_completed_after_enrollment
    check (completed_at is null or completed_at >= enrolled_at)
);

create index newcomer_journeys_active_idx
  on public.newcomer_journeys (sporting_director_id, enrolled_at)
  where completed_at is null;

create table public.newcomer_journey_steps (
  journey_id uuid not null
    references public.newcomer_journeys(id) on delete cascade,
  step_key text not null
    references public.newcomer_journey_step_definitions(step_key)
    on delete restrict,
  completed_at timestamptz,
  claimed_at timestamptz,
  created_at timestamptz not null default now(),
  primary key (journey_id, step_key),
  constraint newcomer_journey_steps_claimed_after_completion
    check (claimed_at is null or (completed_at is not null and claimed_at >= completed_at))
);

create index newcomer_journey_steps_progress_idx
  on public.newcomer_journey_steps (journey_id, claimed_at, completed_at);

alter table public.newcomer_journey_step_definitions enable row level security;
alter table public.newcomer_journeys enable row level security;
alter table public.newcomer_journey_steps enable row level security;

create policy newcomer_journeys_select_own
on public.newcomer_journeys for select to authenticated
using (
  exists (
    select 1
    from public.sporting_directors as director
    where director.id = newcomer_journeys.sporting_director_id
      and director.auth_user_id = (select auth.uid())
  )
);

create policy newcomer_journey_steps_select_own
on public.newcomer_journey_steps for select to authenticated
using (
  exists (
    select 1
    from public.newcomer_journeys as journey
    join public.sporting_directors as director
      on director.id = journey.sporting_director_id
    where journey.id = newcomer_journey_steps.journey_id
      and director.auth_user_id = (select auth.uid())
  )
);

grant select on public.newcomer_journey_step_definitions to authenticated;
grant select on public.newcomer_journeys, public.newcomer_journey_steps
  to authenticated;
grant all privileges on public.newcomer_journey_step_definitions,
  public.newcomer_journeys, public.newcomer_journey_steps to service_role;

create or replace function private.enroll_newcomer_journey(
  p_sporting_director_id uuid,
  p_team_id uuid,
  p_enrolled_at timestamptz default now()
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_journey_id uuid;
begin
  if not exists (
    select 1
    from public.sporting_directors as director
    where director.id = p_sporting_director_id
      and director.status = 'active'
      and director.auth_user_id is not null
      and director.created_at >= now() - interval '48 hours'
      and not exists (
        select 1
        from public.alpha_bot_managers as bot
        where bot.sporting_director_id = director.id
      )
  ) then
    return null;
  end if;

  insert into public.newcomer_journeys (
    sporting_director_id,
    team_id,
    enrolled_at
  )
  values (
    p_sporting_director_id,
    p_team_id,
    coalesce(p_enrolled_at, now())
  )
  on conflict (sporting_director_id) do nothing
  returning id into v_journey_id;

  if v_journey_id is null then
    select journey.id
    into v_journey_id
    from public.newcomer_journeys as journey
    where journey.sporting_director_id = p_sporting_director_id;
  end if;

  insert into public.newcomer_journey_steps (journey_id, step_key)
  select v_journey_id, definition.step_key
  from public.newcomer_journey_step_definitions as definition
  on conflict (journey_id, step_key) do nothing;

  return v_journey_id;
end;
$$;

create or replace function public.enroll_newcomer_journey_after_team_creation()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform private.enroll_newcomer_journey(
    new.sporting_director_id,
    new.team_id,
    now()
  );
  return new;
end;
$$;

create trigger enroll_newcomer_journey_after_initial_career
after insert on public.initial_career_generations
for each row execute function public.enroll_newcomer_journey_after_team_creation();

create or replace function public.remove_newcomer_journey_from_bot()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  delete from public.newcomer_journeys
  where sporting_director_id = new.sporting_director_id;

  delete from public.sporting_director_trophies
  where sporting_director_id = new.sporting_director_id
    and trophy_key = 'premiers_tours_de_roue';

  return new;
end;
$$;

create trigger remove_newcomer_journey_after_bot_creation
after insert on public.alpha_bot_managers
for each row execute function public.remove_newcomer_journey_from_bot();

create or replace function private.refresh_newcomer_journey_progress(
  p_journey_id uuid
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_journey public.newcomer_journeys%rowtype;
begin
  select journey.*
  into v_journey
  from public.newcomer_journeys as journey
  where journey.id = p_journey_id
    and journey.completed_at is null;

  if v_journey.id is null then
    return;
  end if;

  update public.newcomer_journey_steps as step
  set completed_at = now()
  where step.journey_id = v_journey.id
    and step.completed_at is null
    and (
      (
        step.step_key = 'claim_daily_reward'
        and exists (
          select 1
          from public.daily_reward_claims as claim
          where claim.sporting_director_id = v_journey.sporting_director_id
            and claim.claimed_at >= v_journey.enrolled_at
        )
      )
      or (
        step.step_key = 'post_global_chat_message'
        and exists (
          select 1
          from public.global_chat_messages as message
          where message.sporting_director_id = v_journey.sporting_director_id
            and message.created_at >= v_journey.enrolled_at
        )
      )
      or (
        step.step_key = 'configure_training'
        and exists (
          select 1
          from public.rider_training_plan_versions as plan
          where plan.team_id = v_journey.team_id
            and plan.created_at >= v_journey.enrolled_at
        )
      )
      or (
        step.step_key = 'recruit_staff_member'
        and exists (
          select 1
          from public.staff_contracts as contract
          where contract.team_id = v_journey.team_id
            and contract.signed_at >= v_journey.enrolled_at
        )
      )
      or (
        step.step_key = 'place_auction_bid'
        and exists (
          select 1
          from public.transfer_market_bids as bid
          where bid.sporting_director_id = v_journey.sporting_director_id
            and bid.created_at >= v_journey.enrolled_at
        )
      )
      or (
        step.step_key = 'register_for_race'
        and exists (
          select 1
          from public.race_registrations as registration
          join public.team_seasons as team_season
            on team_season.id = registration.team_season_id
          where team_season.team_id = v_journey.team_id
            and registration.created_at >= v_journey.enrolled_at
            and registration.status <> 'withdrawn'
        )
      )
      or (
        step.step_key = 'prepare_race'
        and (
          exists (
            select 1
            from public.race_stage_strategies as strategy
            where strategy.team_id = v_journey.team_id
              and strategy.updated_at >= v_journey.enrolled_at
          )
          or exists (
            select 1
            from public.race_time_trial_rider_plans as plan
            where plan.team_id = v_journey.team_id
              and plan.updated_at >= v_journey.enrolled_at
          )
        )
      )
    );
end;
$$;

create or replace function public.get_current_newcomer_journey()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_journey public.newcomer_journeys%rowtype;
  v_first_unclaimed_position integer;
  v_wave_start integer;
  v_completed_count integer;
  v_claimed_count integer;
  v_steps jsonb;
begin
  if auth.uid() is null then
    raise exception using errcode = '42501', message = 'Vous devez être connecté.';
  end if;

  select journey.*
  into v_journey
  from public.newcomer_journeys as journey
  join public.sporting_directors as director
    on director.id = journey.sporting_director_id
  where director.auth_user_id = auth.uid()
    and director.status = 'active'
    and journey.completed_at is null
  limit 1;

  if v_journey.id is null then
    return null;
  end if;

  perform private.refresh_newcomer_journey_progress(v_journey.id);

  select min(definition.position)
  into v_first_unclaimed_position
  from public.newcomer_journey_steps as step
  join public.newcomer_journey_step_definitions as definition
    on definition.step_key = step.step_key
  where step.journey_id = v_journey.id
    and step.claimed_at is null;

  if v_first_unclaimed_position is null then
    return null;
  end if;

  v_wave_start := ((v_first_unclaimed_position - 1) / 2) * 2 + 1;

  select
    count(*) filter (where step.completed_at is not null)::integer,
    count(*) filter (where step.claimed_at is not null)::integer
  into v_completed_count, v_claimed_count
  from public.newcomer_journey_steps as step
  where step.journey_id = v_journey.id;

  select jsonb_agg(
    jsonb_build_object(
      'key', definition.step_key,
      'position', definition.position,
      'title', definition.title,
      'description', definition.description,
      'href', definition.href,
      'rewardCash', definition.reward_cash,
      'rewardExperience', definition.reward_experience,
      'completed', step.completed_at is not null,
      'claimed', step.claimed_at is not null
    )
    order by definition.position
  )
  into v_steps
  from public.newcomer_journey_steps as step
  join public.newcomer_journey_step_definitions as definition
    on definition.step_key = step.step_key
  where step.journey_id = v_journey.id
    and definition.position between v_wave_start and v_wave_start + 1;

  return jsonb_build_object(
    'enrolledAt', v_journey.enrolled_at,
    'chapter', (
      select definition.chapter_label
      from public.newcomer_journey_step_definitions as definition
      where definition.position = v_wave_start
    ),
    'wave', ((v_wave_start - 1) / 2) + 1,
    'totalWaves', 4,
    'completedCount', coalesce(v_completed_count, 0),
    'claimedCount', coalesce(v_claimed_count, 0),
    'totalCount', 8,
    'steps', coalesce(v_steps, '[]'::jsonb)
  );
end;
$$;

create or replace function public.claim_current_newcomer_journey_step(
  p_step_key text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_journey public.newcomer_journeys%rowtype;
  v_definition public.newcomer_journey_step_definitions%rowtype;
  v_step public.newcomer_journey_steps%rowtype;
  v_first_unclaimed_position integer;
  v_wave_start integer;
  v_team_season record;
  v_journey_completed boolean := false;
begin
  if auth.uid() is null then
    raise exception using errcode = '42501', message = 'Vous devez être connecté.';
  end if;

  select journey.*
  into v_journey
  from public.newcomer_journeys as journey
  join public.sporting_directors as director
    on director.id = journey.sporting_director_id
  where director.auth_user_id = auth.uid()
    and director.status = 'active'
    and journey.completed_at is null
  for update of journey;

  if v_journey.id is null then
    raise exception 'Aucun parcours de bienvenue actif pour ce compte.';
  end if;

  perform private.refresh_newcomer_journey_progress(v_journey.id);

  select definition.*
  into v_definition
  from public.newcomer_journey_step_definitions as definition
  where definition.step_key = trim(coalesce(p_step_key, ''));

  if v_definition.step_key is null then
    raise exception 'Étape de bienvenue inconnue.';
  end if;

  select step.*
  into v_step
  from public.newcomer_journey_steps as step
  where step.journey_id = v_journey.id
    and step.step_key = v_definition.step_key
  for update;

  if v_step.completed_at is null then
    raise exception 'Terminez d’abord cet objectif dans le jeu.';
  end if;

  if v_step.claimed_at is not null then
    raise exception 'Cette récompense a déjà été récupérée.';
  end if;

  select min(definition.position)
  into v_first_unclaimed_position
  from public.newcomer_journey_steps as step
  join public.newcomer_journey_step_definitions as definition
    on definition.step_key = step.step_key
  where step.journey_id = v_journey.id
    and step.claimed_at is null;

  v_wave_start := ((v_first_unclaimed_position - 1) / 2) * 2 + 1;
  if v_definition.position not between v_wave_start and v_wave_start + 1 then
    raise exception 'Cette étape n’est pas encore accessible.';
  end if;

  select
    team_season.id as team_season_id,
    season.id as season_id,
    greatest(1, least(28, coalesce(season.current_day_number, 1)))::integer
      as current_day_number,
    season_day.id as season_day_id
  into v_team_season
  from public.seasons as season
  join public.team_seasons as team_season
    on team_season.season_id = season.id
   and team_season.team_id = v_journey.team_id
  left join public.season_days as season_day
    on season_day.season_id = season.id
   and season_day.day_number = greatest(
     1,
     least(28, coalesce(season.current_day_number, 1))
   )
  where season.status = 'active'
  limit 1;

  if v_team_season.team_season_id is null then
    raise exception 'La saison active de votre équipe est introuvable.';
  end if;

  update public.newcomer_journey_steps
  set claimed_at = now()
  where journey_id = v_journey.id
    and step_key = v_definition.step_key;

  insert into public.reward_events (
    source_reference,
    source_type,
    sporting_director_id,
    team_season_id,
    experience_points,
    cash_prize,
    description
  )
  values (
    'newcomer-journey:' || v_journey.id::text || ':' || v_definition.step_key,
    'game_objective',
    v_journey.sporting_director_id,
    v_team_season.team_season_id,
    v_definition.reward_experience,
    v_definition.reward_cash,
    'Parcours de bienvenue : ' || v_definition.title
  );

  update public.sporting_directors
  set experience_points = experience_points + v_definition.reward_experience
  where id = v_journey.sporting_director_id;

  if v_definition.reward_cash > 0 then
    update public.team_seasons
    set cash_balance = cash_balance + v_definition.reward_cash
    where id = v_team_season.team_season_id;

    insert into public.team_finance_transactions (
      team_season_id,
      season_day_id,
      day_number,
      amount,
      category,
      status,
      description,
      source_reference,
      posted_at
    )
    values (
      v_team_season.team_season_id,
      v_team_season.season_day_id,
      v_team_season.current_day_number,
      v_definition.reward_cash,
      'other',
      'posted',
      'Parcours de bienvenue : ' || v_definition.title,
      'newcomer-journey:' || v_journey.id::text || ':' || v_definition.step_key,
      now()
    );
  end if;

  if not exists (
    select 1
    from public.newcomer_journey_steps as step
    where step.journey_id = v_journey.id
      and step.claimed_at is null
  ) then
    update public.newcomer_journeys
    set completed_at = now()
    where id = v_journey.id;

    insert into public.sporting_director_trophies (
      sporting_director_id,
      trophy_key,
      available_at,
      claimed_at
    )
    values (
      v_journey.sporting_director_id,
      'premiers_tours_de_roue',
      now(),
      now()
    )
    on conflict (sporting_director_id, trophy_key) do update
    set claimed_at = coalesce(
      public.sporting_director_trophies.claimed_at,
      excluded.claimed_at
    );

    v_journey_completed := true;
  end if;

  return jsonb_build_object(
    'status', 'claimed',
    'stepKey', v_definition.step_key,
    'cash', v_definition.reward_cash,
    'experience', v_definition.reward_experience,
    'journeyCompleted', v_journey_completed
  );
end;
$$;

create or replace function public.record_current_newcomer_live_visit(
  p_stage_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_journey_id uuid;
begin
  if auth.uid() is null then
    return false;
  end if;

  select journey.id
  into v_journey_id
  from public.newcomer_journeys as journey
  join public.sporting_directors as director
    on director.id = journey.sporting_director_id
  where director.auth_user_id = auth.uid()
    and director.status = 'active'
    and journey.completed_at is null
  limit 1;

  if v_journey_id is null then
    return false;
  end if;

  if not exists (
    select 1
    from public.stages as stage
    join public.season_days as season_day
      on season_day.id = stage.season_day_id
    join public.seasons as season
      on season.id = season_day.season_id
    where stage.id = p_stage_id
      and season.status = 'active'
      and season_day.day_number = season.current_day_number
      and coalesce(
        stage.departure_at,
        (
          season_day.calendar_date::timestamp
          + case stage.day_slot
              when 'early' then time '14:00'
              else time '18:00'
            end
        ) at time zone 'Europe/Paris'
      ) <= now()
  ) then
    return false;
  end if;

  update public.newcomer_journey_steps
  set completed_at = coalesce(completed_at, now())
  where journey_id = v_journey_id
    and step_key = 'follow_race_live';

  return found;
end;
$$;

select private.enroll_newcomer_journey(
  generation.sporting_director_id,
  generation.team_id,
  now()
)
from public.initial_career_generations as generation
join public.sporting_directors as director
  on director.id = generation.sporting_director_id
where director.created_at >= now() - interval '48 hours'
  and director.status = 'active'
  and director.auth_user_id is not null
  and not exists (
    select 1
    from public.alpha_bot_managers as bot
    where bot.sporting_director_id = director.id
  );

revoke all on function private.enroll_newcomer_journey(uuid, uuid, timestamptz)
  from public, anon, authenticated;
revoke all on function private.refresh_newcomer_journey_progress(uuid)
  from public, anon, authenticated;
revoke all on function public.enroll_newcomer_journey_after_team_creation()
  from public, anon, authenticated;
revoke all on function public.remove_newcomer_journey_from_bot()
  from public, anon, authenticated;

revoke all on function public.get_current_newcomer_journey()
  from public, anon;
grant execute on function public.get_current_newcomer_journey()
  to authenticated;

revoke all on function public.claim_current_newcomer_journey_step(text)
  from public, anon;
grant execute on function public.claim_current_newcomer_journey_step(text)
  to authenticated;

revoke all on function public.record_current_newcomer_live_visit(uuid)
  from public, anon;
grant execute on function public.record_current_newcomer_live_visit(uuid)
  to authenticated;

comment on table public.newcomer_journeys is
  'Parcours de bienvenue persistant, réservé aux DS ayant créé leur carrière moins de 48 h après leur inscription.';
comment on function public.get_current_newcomer_journey() is
  'Synchronise les actions réelles du jeu et expose uniquement le chapitre courant de deux objectifs.';
comment on function public.claim_current_newcomer_journey_step(text) is
  'Crédite de façon transactionnelle la petite récompense d’une étape validée et remet le trophée final.';

commit;
