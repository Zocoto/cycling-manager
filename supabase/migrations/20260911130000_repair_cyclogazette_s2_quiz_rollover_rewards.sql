begin;

-- Le quiz de gala reste ouvert entre la fin de S2 et la publication de la
-- prochaine Gazette. Pendant cette fenêtre, l'édition reste rattachée à S2
-- mais la récompense doit être créditée sur la saison active (S3).
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
    active_day.id as season_day_id,
    active_day.day_number
  into v_context
  from public.sporting_directors as director
  join public.team_manager_assignments as assignment
    on assignment.sporting_director_id = director.id
   and assignment.role = 'general_manager'
   and assignment.status = 'active'
  join public.cyclogazette_editions as edition
    on edition.id = p_edition_id
  join public.seasons as edition_season
    on edition_season.id = edition.season_id
   and edition_season.game_year = 2
  join public.season_days as edition_day
    on edition_day.id = edition.season_day_id
   and edition_day.day_number = 28
  join public.seasons as active_season
    on active_season.status = 'active'
  join public.team_seasons as team_season
    on team_season.team_id = assignment.team_id
   and team_season.season_id = active_season.id
   and team_season.status = 'active'
  join public.season_days as active_day
    on active_day.season_id = active_season.id
   and active_day.day_number = coalesce(active_season.current_day_number, 1)
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

-- Rattrapage des réponses déjà enregistrées après le rollover. L'opération
-- déplace la transaction et l'événement vers la saison active, corrige les
-- soldes historiques/courants et est protégée contre un double crédit.
do $repair$
declare
  v_source_season public.seasons%rowtype;
  v_target_season public.seasons%rowtype;
  v_target_day public.season_days%rowtype;
  v_attempt record;
  v_target_team public.team_seasons%rowtype;
  v_transaction public.team_finance_transactions%rowtype;
  v_reward numeric(14, 2);
  v_source_team_id uuid;
  v_source_transaction_moved boolean;
  v_target_cash_credited boolean;
begin
  select season.*
  into v_source_season
  from public.seasons as season
  where season.game_year = 2;

  if not found then
    return;
  end if;

  select season.*
  into v_target_season
  from public.seasons as season
  where v_source_season.id is not null
    and season.game_year = v_source_season.game_year + 1
    and season.status in ('active', 'completed')
  order by case when season.status = 'active' then 0 else 1 end
  limit 1;

  if not found then
    return;
  end if;

  for v_attempt in
    select
      attempt.id,
      attempt.team_season_id,
      attempt.reward_cash,
      attempt.submitted_at,
      source_team.team_id
    from public.cyclogazette_season_quiz_attempts as attempt
    join public.cyclogazette_editions as edition
      on edition.id = attempt.edition_id
    join public.season_days as edition_day
      on edition_day.id = edition.season_day_id
     and edition_day.day_number = 28
    join public.team_seasons as source_team
      on source_team.id = attempt.team_season_id
     and source_team.season_id = v_source_season.id
    where edition.season_id = v_source_season.id
      and attempt.submitted_at >= (
        v_target_season.starts_on::timestamp at time zone 'Europe/Paris'
      )
    order by attempt.submitted_at, attempt.id
    for update of attempt
  loop
    select team_season.*
    into v_target_team
    from public.team_seasons as team_season
    where team_season.team_id = v_attempt.team_id
      and team_season.season_id = v_target_season.id
    for update;

    if v_target_team.id is null then
      continue;
    end if;

    select day.*
    into v_target_day
    from public.season_days as day
    where day.season_id = v_target_season.id
      and day.calendar_date = timezone(
        'Europe/Paris', v_attempt.submitted_at
      )::date
    limit 1;

    if v_target_day.id is null then
      select day.*
      into v_target_day
      from public.season_days as day
      where day.season_id = v_target_season.id
        and day.day_number = coalesce(v_target_season.current_day_number, 1)
      limit 1;
    end if;

    if v_target_day.id is null then
      continue;
    end if;

    v_reward := greatest(0, coalesce(v_attempt.reward_cash, 0));
    v_source_team_id := v_attempt.team_season_id;
    v_source_transaction_moved := false;
    v_target_cash_credited := false;

    if v_reward > 0 then
      select transaction.*
      into v_transaction
      from public.team_finance_transactions as transaction
      where transaction.team_season_id = v_source_team_id
        and transaction.source_reference =
          'cyclogazette-season-quiz:' || v_attempt.id::text
      for update;

      if v_transaction.id is not null then
        if not exists (
          select 1
          from public.team_finance_transactions as target_transaction
          where target_transaction.team_season_id = v_target_team.id
            and target_transaction.source_reference = v_transaction.source_reference
        ) then
          update public.team_finance_transactions
          set team_season_id = v_target_team.id,
              season_day_id = v_target_day.id,
              day_number = v_target_day.day_number,
              status = 'posted',
              posted_at = coalesce(posted_at, v_attempt.submitted_at)
          where id = v_transaction.id;
          v_source_transaction_moved := true;
          v_target_cash_credited := true;
        else
          delete from public.team_finance_transactions
          where id = v_transaction.id;
        end if;
      else
        if not exists (
          select 1
          from public.team_finance_transactions as target_transaction
          where target_transaction.team_season_id = v_target_team.id
            and target_transaction.source_reference =
              'cyclogazette-season-quiz:' || v_attempt.id::text
        ) then
          insert into public.team_finance_transactions (
            team_season_id, season_day_id, day_number, amount, category,
            status, description, source_reference, posted_at
          ) values (
            v_target_team.id,
            v_target_day.id,
            v_target_day.day_number,
            v_reward,
            'other',
            'posted',
            'Quiz de fin de saison de La Cyclogazette : '
              || round(v_reward / 10000)::text || '/10',
            'cyclogazette-season-quiz:' || v_attempt.id::text,
            v_attempt.submitted_at
          );
          v_target_cash_credited := true;
        end if;
      end if;

      if v_source_transaction_moved then
        update public.team_seasons
        set cash_balance = cash_balance - v_reward
        where id = v_source_team_id;
      end if;

      if v_target_cash_credited then
        update public.team_seasons
        set cash_balance = cash_balance + v_reward
        where id = v_target_team.id;
      end if;

      update public.reward_events
      set team_season_id = v_target_team.id
      where source_reference = 'cyclogazette-season-quiz:' || v_attempt.id::text;
    end if;

    update public.cyclogazette_season_quiz_attempts
    set team_season_id = v_target_team.id
    where id = v_attempt.id;
  end loop;
end;
$repair$;

comment on function public.complete_cyclogazette_season_quiz_for_user(
  uuid, uuid, integer, jsonb
) is
  'Crédite une seule fois 10 000 euros par bonne réponse sur la saison active, même lorsque le quiz de la saison 2 reste ouvert au jour 1 de la saison 3.';

notify pgrst, 'reload schema';

commit;
