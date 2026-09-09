begin;

-- The existing award builder remains the single source of truth. It may now run
-- on the active final day, but only after every race and stage is terminal.
do $migration$
declare
  v_source text;
  v_updated_source text;
  v_previous_guard constant text :=
    'if not found or v_season.status <> ''completed'' then
    return 0;
  end if;';
  v_final_day_guard constant text :=
    'if not found or (
    v_season.status <> ''completed''
    and not (
      v_season.status = ''active''
      and exists (
        select 1
        from public.seasons as final_day_season
        where final_day_season.id = p_season_id
          and final_day_season.current_day_number = 28
      )
      and exists (
        select 1
        from public.stages as final_stage
        join public.race_editions as final_edition
          on final_edition.id = final_stage.race_edition_id
        where final_edition.season_id = p_season_id
      )
      and not exists (
        select 1
        from public.stages as pending_stage
        join public.race_editions as pending_edition
          on pending_edition.id = pending_stage.race_edition_id
        where pending_edition.season_id = p_season_id
          and pending_stage.status not in (''completed'', ''cancelled'')
      )
      and not exists (
        select 1
        from public.race_editions as pending_edition
        where pending_edition.season_id = p_season_id
          and pending_edition.status not in (''completed'', ''cancelled'')
      )
    )
  ) then
    return 0;
  end if;';
begin
  select procedure.prosrc
  into v_source
  from pg_proc as procedure
  join pg_namespace as namespace on namespace.oid = procedure.pronamespace
  where namespace.nspname = 'private'
    and procedure.proname = 'create_season_awards_for_season'
    and pg_get_function_identity_arguments(procedure.oid) = 'p_season_id uuid';

  if v_source is null or position(v_previous_guard in v_source) = 0 then
    raise exception 'The season-award guard no longer matches the expected definition.';
  end if;

  v_updated_source := replace(v_source, v_previous_guard, v_final_day_guard);
  execute format(
    'create or replace function private.create_season_awards_for_season(p_season_id uuid)
     returns integer language plpgsql security definer
     set search_path = public, pg_temp as %L',
    v_updated_source
  );
end;
$migration$;

create or replace function public.prepare_cyclogazette_season_gala(
  p_season_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_season record;
  v_pending_stages integer := 0;
  v_pending_editions integer := 0;
  v_award_count integer := 0;
begin
  select id, game_year, status, current_day_number
  into v_season
  from public.seasons
  where id = p_season_id;

  if not found
    or v_season.game_year <> 2
    or v_season.status <> 'active'
    or v_season.current_day_number <> 28 then
    return jsonb_build_object(
      'ready', false,
      'reason', 'not-season-two-final-day',
      'pendingStages', 0,
      'pendingEditions', 0,
      'awardCount', 0
    );
  end if;

  select count(*)::integer
  into v_pending_stages
  from public.stages as stage
  join public.race_editions as edition on edition.id = stage.race_edition_id
  where edition.season_id = p_season_id
    and stage.status not in ('completed', 'cancelled');

  select count(*)::integer
  into v_pending_editions
  from public.race_editions as edition
  where edition.season_id = p_season_id
    and edition.status not in ('completed', 'cancelled');

  if v_pending_stages > 0 or v_pending_editions > 0 then
    return jsonb_build_object(
      'ready', false,
      'reason', 'races-still-pending',
      'pendingStages', v_pending_stages,
      'pendingEditions', v_pending_editions,
      'awardCount', 0
    );
  end if;

  perform private.create_season_awards_for_season(p_season_id);

  select count(*)::integer
  into v_award_count
  from public.season_awards
  where season_id = p_season_id;

  return jsonb_build_object(
    'ready', v_award_count = 5,
    'reason', case when v_award_count = 5 then 'ready' else 'awards-incomplete' end,
    'pendingStages', 0,
    'pendingEditions', 0,
    'awardCount', v_award_count
  );
end;
$$;

revoke all on function public.prepare_cyclogazette_season_gala(uuid)
  from public, anon, authenticated;
grant execute on function public.prepare_cyclogazette_season_gala(uuid)
  to service_role;

create table public.cyclogazette_season_quiz_attempts (
  id uuid primary key default gen_random_uuid(),
  edition_id uuid not null
    references public.cyclogazette_editions(id) on delete cascade,
  sporting_director_id uuid not null
    references public.sporting_directors(id) on delete cascade,
  team_season_id uuid not null
    references public.team_seasons(id) on delete cascade,
  answers jsonb not null,
  correct_answers smallint not null,
  reward_cash numeric(14, 2) not null,
  submitted_at timestamptz not null default now(),
  constraint cyclogazette_season_quiz_answers_object
    check (jsonb_typeof(answers) = 'object'),
  constraint cyclogazette_season_quiz_score_valid
    check (correct_answers between 0 and 10),
  constraint cyclogazette_season_quiz_reward_valid
    check (reward_cash = correct_answers * 10000),
  constraint cyclogazette_season_quiz_once
    unique (edition_id, sporting_director_id)
);

create index cyclogazette_season_quiz_edition_idx
  on public.cyclogazette_season_quiz_attempts (edition_id, submitted_at);

alter table public.cyclogazette_season_quiz_attempts enable row level security;

create policy cyclogazette_season_quiz_select_own
on public.cyclogazette_season_quiz_attempts
for select
to authenticated
using (
  exists (
    select 1
    from public.sporting_directors as director
    where director.id = sporting_director_id
      and director.auth_user_id = (select auth.uid())
  )
);

grant select on public.cyclogazette_season_quiz_attempts to authenticated;
grant all privileges on public.cyclogazette_season_quiz_attempts to service_role;

create or replace function public.complete_cyclogazette_season_quiz_for_user(
  p_auth_user_id uuid,
  p_edition_id uuid,
  p_correct_answers integer,
  p_answers jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_context record;
  v_attempt_id uuid;
  v_existing record;
  v_reward numeric(14, 2);
  v_now timestamptz := now();
begin
  if p_auth_user_id is null
    or p_correct_answers is null
    or p_correct_answers not between 0 and 10
    or p_answers is null
    or jsonb_typeof(p_answers) <> 'object'
    or (select count(*) from jsonb_object_keys(p_answers)) <> 10 then
    raise exception 'Cette participation au quiz est invalide.';
  end if;

  v_reward := p_correct_answers * 10000;

  select
    director.id as director_id,
    team_season.id as team_season_id,
    edition.id as edition_id,
    edition.season_day_id,
    season_day.day_number
  into v_context
  from public.sporting_directors as director
  join public.team_manager_assignments as assignment
    on assignment.sporting_director_id = director.id
   and assignment.role = 'general_manager'
   and assignment.status = 'active'
  join public.cyclogazette_editions as edition
    on edition.id = p_edition_id
  join public.seasons as season
    on season.id = edition.season_id
   and season.game_year = 2
  join public.season_days as season_day
    on season_day.id = edition.season_day_id
   and season_day.day_number = 28
  join public.team_seasons as team_season
    on team_season.team_id = assignment.team_id
   and team_season.season_id = edition.season_id
  where director.auth_user_id = p_auth_user_id
    and director.status = 'active'
    and edition.id = (
      select latest.id
      from public.cyclogazette_editions as latest
      order by latest.published_at desc
      limit 1
    )
    and not exists (
      select 1
      from public.alpha_bot_managers as bot
      where bot.sporting_director_id = director.id
    )
  limit 1
  for update of team_season;

  if v_context is null then
    raise exception 'Cette édition ne peut plus attribuer de gain.';
  end if;

  insert into public.cyclogazette_season_quiz_attempts (
    edition_id,
    sporting_director_id,
    team_season_id,
    answers,
    correct_answers,
    reward_cash,
    submitted_at
  )
  values (
    v_context.edition_id,
    v_context.director_id,
    v_context.team_season_id,
    p_answers,
    p_correct_answers,
    v_reward,
    v_now
  )
  on conflict (edition_id, sporting_director_id) do nothing
  returning id into v_attempt_id;

  if v_attempt_id is null then
    select answers, correct_answers, reward_cash
    into v_existing
    from public.cyclogazette_season_quiz_attempts
    where edition_id = v_context.edition_id
      and sporting_director_id = v_context.director_id;

    return jsonb_build_object(
      'status', 'already-completed',
      'correctAnswers', v_existing.correct_answers,
      'rewardCash', v_existing.reward_cash,
      'answers', v_existing.answers
    );
  end if;

  if v_reward > 0 then
    update public.team_seasons
    set cash_balance = cash_balance + v_reward
    where id = v_context.team_season_id;

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
      v_context.team_season_id,
      v_context.season_day_id,
      v_context.day_number,
      v_reward,
      'other',
      'posted',
      'Quiz de fin de saison de La Cyclogazette : '
        || p_correct_answers::text || '/10',
      'cyclogazette-season-quiz:' || v_attempt_id::text,
      v_now
    );

    insert into public.reward_events (
      source_reference,
      source_type,
      sporting_director_id,
      team_season_id,
      cash_prize,
      description
    )
    values (
      'cyclogazette-season-quiz:' || v_attempt_id::text,
      'gazette_game',
      v_context.director_id,
      v_context.team_season_id,
      v_reward,
      'Quiz spécial saison 2 de La Cyclogazette : '
        || p_correct_answers::text || ' bonne(s) réponse(s)'
    );
  end if;

  return jsonb_build_object(
    'status', 'completed',
    'correctAnswers', p_correct_answers,
    'rewardCash', v_reward,
    'answers', p_answers
  );
end;
$$;

revoke all on function public.complete_cyclogazette_season_quiz_for_user(
  uuid, uuid, integer, jsonb
) from public, anon, authenticated;
grant execute on function public.complete_cyclogazette_season_quiz_for_user(
  uuid, uuid, integer, jsonb
) to service_role;

comment on table public.cyclogazette_season_quiz_attempts is
  'Participation unique et récompense atomique du quiz de gala de la saison 2.';
comment on function public.prepare_cyclogazette_season_gala(uuid) is
  'Fige les cinq awards J28 uniquement après la clôture de toutes les courses de la saison 2.';
comment on function public.complete_cyclogazette_season_quiz_for_user(uuid, uuid, integer, jsonb) is
  'Crédite une seule fois 10 000 euros par bonne réponse au quiz de gala validé côté serveur.';

notify pgrst, 'reload schema';

commit;
