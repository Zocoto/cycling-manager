begin;

create table public.cyclogazette_polls (
  id uuid primary key default gen_random_uuid(),
  edition_id uuid not null
    references public.cyclogazette_editions(id)
    on delete cascade,
  topic_type text not null,
  question text not null,
  options jsonb not null,
  created_at timestamptz not null default now(),
  constraint cyclogazette_polls_one_per_edition unique (edition_id),
  constraint cyclogazette_polls_topic_allowed check (
    topic_type in (
      'team_opinion',
      'rider_future',
      'team_recruitment',
      'race_prediction',
      'rider_choice'
    )
  ),
  constraint cyclogazette_polls_question_not_empty check (btrim(question) <> ''),
  constraint cyclogazette_polls_options_array check (
    jsonb_typeof(options) = 'array'
    and jsonb_array_length(options) between 2 and 4
  )
);

create table public.cyclogazette_poll_votes (
  id uuid primary key default gen_random_uuid(),
  poll_id uuid not null
    references public.cyclogazette_polls(id)
    on delete cascade,
  sporting_director_id uuid not null
    references public.sporting_directors(id)
    on delete cascade,
  option_id text not null,
  created_at timestamptz not null default now(),
  constraint cyclogazette_poll_votes_option_not_empty
    check (btrim(option_id) <> ''),
  constraint cyclogazette_poll_votes_once
    unique (poll_id, sporting_director_id)
);

create index cyclogazette_poll_votes_poll_idx
  on public.cyclogazette_poll_votes (poll_id, option_id);

alter table public.cyclogazette_polls enable row level security;
alter table public.cyclogazette_poll_votes enable row level security;

grant all privileges on public.cyclogazette_polls to service_role;
grant all privileges on public.cyclogazette_poll_votes to service_role;

create or replace function private.ensure_cyclogazette_poll(
  p_edition_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_edition record;
  v_poll_id uuid;
  v_topic_index integer;
  v_team_id uuid;
  v_team_name text;
  v_rider_name text;
  v_recruit_name text;
  v_race_id uuid;
  v_race_name text;
  v_question text;
  v_topic_type text;
  v_options jsonb;
begin
  select poll.id
  into v_poll_id
  from public.cyclogazette_polls as poll
  where poll.edition_id = p_edition_id;

  if v_poll_id is not null then
    return v_poll_id;
  end if;

  select
    edition.id,
    edition.season_id,
    edition.issue_number,
    season_day.day_number
  into v_edition
  from public.cyclogazette_editions as edition
  join public.season_days as season_day
    on season_day.id = edition.season_day_id
  where edition.id = p_edition_id;

  if v_edition is null then
    return null;
  end if;

  select team_season.team_id, team_season.display_name
  into v_team_id, v_team_name
  from public.team_seasons as team_season
  join public.team_manager_assignments as assignment
    on assignment.team_id = team_season.team_id
   and assignment.role = 'general_manager'
   and assignment.status = 'active'
  join public.sporting_directors as director
    on director.id = assignment.sporting_director_id
   and director.status = 'active'
  where team_season.season_id = v_edition.season_id
    and team_season.status in ('active', 'completed')
    and not exists (
      select 1
      from public.alpha_bot_managers as bot
      where bot.sporting_director_id = director.id
    )
  order by md5(team_season.id::text || ':' || v_edition.issue_number::text)
  limit 1;

  if v_team_id is null then
    select team_season.team_id, team_season.display_name
    into v_team_id, v_team_name
    from public.team_seasons as team_season
    where team_season.season_id = v_edition.season_id
      and team_season.status in ('active', 'completed')
    order by md5(team_season.id::text || ':' || v_edition.issue_number::text)
    limit 1;
  end if;

  select concat_ws(' ', rider.first_name, rider.last_name)
  into v_rider_name
  from public.riders as rider
  join public.rider_season_ratings as rating
    on rating.rider_id = rider.id
   and rating.season_id = v_edition.season_id
  join public.rider_contracts as contract
    on contract.rider_id = rider.id
   and contract.status = 'active'
  where rider.status = 'active'
  order by md5(rider.id::text || ':' || v_edition.issue_number::text)
  limit 1;

  select concat_ws(' ', rider.first_name, rider.last_name)
  into v_recruit_name
  from public.riders as rider
  join public.rider_season_ratings as rating
    on rating.rider_id = rider.id
   and rating.season_id = v_edition.season_id
  left join public.rider_contracts as contract
    on contract.rider_id = rider.id
   and contract.status = 'active'
  where rider.status in ('active', 'free_agent')
    and (v_team_id is null or contract.team_id is distinct from v_team_id)
  order by md5(rider.id::text || ':recruit:' || v_edition.issue_number::text)
  limit 1;

  select race.id, race.display_name
  into v_race_id, v_race_name
  from public.race_editions as race
  join public.stages as stage
    on stage.race_edition_id = race.id
  join public.season_days as season_day
    on season_day.id = stage.season_day_id
  where race.season_id = v_edition.season_id
    and race.status in (
      'planned',
      'registration_open',
      'registration_closed',
      'in_progress'
    )
    and season_day.day_number > v_edition.day_number
  group by race.id, race.display_name
  order by min(season_day.day_number), race.display_name
  limit 1;

  v_topic_index := mod(v_edition.issue_number, 5);

  if v_topic_index = 0 and v_team_name is not null then
    v_topic_type := 'team_opinion';
    v_question := format('Que pensez-vous de %s cette saison ?', v_team_name);
    v_options := jsonb_build_array(
      jsonb_build_object('id', 'option-1', 'label', 'Elle impressionne'),
      jsonb_build_object('id', 'option-2', 'label', 'Elle progresse'),
      jsonb_build_object('id', 'option-3', 'label', 'Elle doit encore convaincre')
    );
  elsif v_topic_index = 1 and v_rider_name is not null then
    v_topic_type := 'rider_future';
    v_question := format('%s devrait-il changer d’air ?', v_rider_name);
    v_options := jsonb_build_array(
      jsonb_build_object('id', 'option-1', 'label', 'Oui'),
      jsonb_build_object('id', 'option-2', 'label', 'Non'),
      jsonb_build_object('id', 'option-3', 'label', 'Encore trop tôt pour le dire')
    );
  elsif v_topic_index = 2
        and v_team_name is not null
        and v_recruit_name is not null then
    v_topic_type := 'team_recruitment';
    v_question := format(
      '%s devrait-elle recruter %s ?',
      v_team_name,
      v_recruit_name
    );
    v_options := jsonb_build_array(
      jsonb_build_object('id', 'option-1', 'label', 'Oui, absolument'),
      jsonb_build_object('id', 'option-2', 'label', 'Pourquoi pas'),
      jsonb_build_object('id', 'option-3', 'label', 'Non, mauvais profil')
    );
  elsif v_topic_index = 3 and v_race_name is not null then
    v_topic_type := 'race_prediction';
    v_question := format('Quelle équipe remportera %s ?', v_race_name);

    select jsonb_agg(
      jsonb_build_object(
        'id', 'option-' || candidate.position::text,
        'label', candidate.team_name
      )
      order by candidate.position
    )
    into v_options
    from (
      select
        row_number() over (order by selected.sort_key) as position,
        selected.team_name
      from (
        select
          team_season.display_name as team_name,
          md5(team_season.id::text || ':race:' || v_edition.issue_number::text) as sort_key
        from public.race_registrations as registration
        join public.team_seasons as team_season
          on team_season.id = registration.team_season_id
        where registration.race_edition_id = v_race_id
          and registration.status = 'accepted'
        group by team_season.id, team_season.display_name
        order by sort_key
        limit 4
      ) as selected
    ) as candidate;

    if coalesce(jsonb_array_length(v_options), 0) < 2 then
      select jsonb_agg(
        jsonb_build_object(
          'id', 'option-' || candidate.position::text,
          'label', candidate.team_name
        )
        order by candidate.position
      )
      into v_options
      from (
        select
          row_number() over (order by selected.sort_key) as position,
          selected.team_name
        from (
          select
            team_season.display_name as team_name,
            md5(team_season.id::text || ':fallback:' || v_edition.issue_number::text) as sort_key
          from public.team_seasons as team_season
          where team_season.season_id = v_edition.season_id
            and team_season.status in ('active', 'completed')
          order by sort_key
          limit 4
        ) as selected
      ) as candidate;
    end if;
  else
    v_topic_type := 'rider_choice';
    v_question := 'Quel coureur vous impressionne le plus actuellement ?';

    select jsonb_agg(
      jsonb_build_object(
        'id', 'option-' || candidate.position::text,
        'label', candidate.rider_name
      )
      order by candidate.position
    )
    into v_options
    from (
      select
        row_number() over (order by selected.sort_key) as position,
        selected.rider_name
      from (
        select
          concat_ws(' ', rider.first_name, rider.last_name) as rider_name,
          md5(rider.id::text || ':choice:' || v_edition.issue_number::text) as sort_key
        from public.riders as rider
        join public.rider_season_ratings as rating
          on rating.rider_id = rider.id
         and rating.season_id = v_edition.season_id
        where rider.status = 'active'
        order by sort_key
        limit 4
      ) as selected
    ) as candidate;
  end if;

  if v_question is null or coalesce(jsonb_array_length(v_options), 0) < 2 then
    v_topic_type := 'team_opinion';
    v_question := 'Quelle est votre lecture du peloton actuel ?';
    v_options := jsonb_build_array(
      jsonb_build_object('id', 'option-1', 'label', 'Les favoris dominent'),
      jsonb_build_object('id', 'option-2', 'label', 'La hiérarchie se resserre'),
      jsonb_build_object('id', 'option-3', 'label', 'Une surprise se prépare')
    );
  end if;

  insert into public.cyclogazette_polls (
    edition_id,
    topic_type,
    question,
    options
  )
  values (
    v_edition.id,
    v_topic_type,
    v_question,
    v_options
  )
  on conflict (edition_id) do nothing
  returning id into v_poll_id;

  if v_poll_id is null then
    select poll.id
    into v_poll_id
    from public.cyclogazette_polls as poll
    where poll.edition_id = v_edition.id;
  end if;

  return v_poll_id;
end;
$$;

create or replace function private.create_cyclogazette_poll_after_publication()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.ensure_cyclogazette_poll(new.id);
  return new;
end;
$$;

create trigger cyclogazette_editions_create_daily_poll
after insert on public.cyclogazette_editions
for each row execute function private.create_cyclogazette_poll_after_publication();

create or replace function public.get_cyclogazette_game_summary(
  p_edition_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_director_id uuid;
  v_viewer_completed jsonb := '[]'::jsonb;
  v_completers jsonb := '[]'::jsonb;
  v_total_completers integer := 0;
  v_poll jsonb := null;
  v_poll_id uuid;
  v_poll_question text;
  v_poll_options jsonb;
  v_poll_results jsonb := '[]'::jsonb;
  v_poll_total integer := 0;
  v_viewer_option_id text;
begin
  if auth.uid() is null then
    raise exception using
      errcode = '42501',
      message = 'Vous devez être connecté pour consulter la Gazette.';
  end if;

  select director.id
  into v_director_id
  from public.sporting_directors as director
  where director.auth_user_id = auth.uid()
    and director.status = 'active'
  limit 1;

  select coalesce(jsonb_agg(completion.game_type order by completion.game_type), '[]'::jsonb)
  into v_viewer_completed
  from public.cyclogazette_game_completions as completion
  where completion.edition_id = p_edition_id
    and completion.sporting_director_id = v_director_id;

  select count(distinct completion.sporting_director_id)::integer
  into v_total_completers
  from public.cyclogazette_game_completions as completion
  where completion.edition_id = p_edition_id
    and not exists (
      select 1
      from public.alpha_bot_managers as bot
      where bot.sporting_director_id = completion.sporting_director_id
    );

  with grouped as (
    select
      director.display_name,
      array_agg(completion.game_type order by completion.game_type) as completed_games,
      max(completion.completed_at) as latest_completion,
      count(distinct completion.game_type) as game_count
    from public.cyclogazette_game_completions as completion
    join public.sporting_directors as director
      on director.id = completion.sporting_director_id
    where completion.edition_id = p_edition_id
      and not exists (
        select 1
        from public.alpha_bot_managers as bot
        where bot.sporting_director_id = director.id
      )
    group by completion.sporting_director_id, director.display_name
    order by game_count desc, latest_completion asc, director.display_name asc
    limit 24
  )
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'directorName', grouped.display_name,
        'completedGames', to_jsonb(grouped.completed_games)
      )
      order by grouped.game_count desc, grouped.latest_completion asc, grouped.display_name asc
    ),
    '[]'::jsonb
  )
  into v_completers
  from grouped;

  select poll.id, poll.question, poll.options
  into v_poll_id, v_poll_question, v_poll_options
  from public.cyclogazette_polls as poll
  where poll.edition_id = p_edition_id;

  if v_poll_id is not null then
    select count(*)::integer
    into v_poll_total
    from public.cyclogazette_poll_votes as vote
    where vote.poll_id = v_poll_id;

    select vote.option_id
    into v_viewer_option_id
    from public.cyclogazette_poll_votes as vote
    where vote.poll_id = v_poll_id
      and vote.sporting_director_id = v_director_id;

    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'id', option_row.option ->> 'id',
          'label', option_row.option ->> 'label',
          'votes', (
            select count(*)
            from public.cyclogazette_poll_votes as vote
            where vote.poll_id = v_poll_id
              and vote.option_id = option_row.option ->> 'id'
          )
        )
        order by option_row.ordinality
      ),
      '[]'::jsonb
    )
    into v_poll_results
    from jsonb_array_elements(v_poll_options) with ordinality
      as option_row(option, ordinality);

    v_poll := jsonb_build_object(
      'id', v_poll_id,
      'question', v_poll_question,
      'options', v_poll_results,
      'totalVotes', greatest(coalesce(v_poll_total, 0), 0),
      'viewerOptionId', v_viewer_option_id
    );
  end if;

  return jsonb_build_object(
    'viewerCompleted', v_viewer_completed,
    'completers', v_completers,
    'totalCompleters', greatest(coalesce(v_total_completers, 0), 0),
    'poll', v_poll
  );
end;
$$;

create or replace function public.vote_cyclogazette_poll(
  p_poll_id uuid,
  p_option_id text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_director_id uuid;
  v_edition_id uuid;
  v_options jsonb;
  v_selected_option_id text;
begin
  if auth.uid() is null then
    raise exception using
      errcode = '42501',
      message = 'Vous devez être connecté pour voter.';
  end if;

  select director.id
  into v_director_id
  from public.sporting_directors as director
  where director.auth_user_id = auth.uid()
    and director.status = 'active'
    and not exists (
      select 1
      from public.alpha_bot_managers as bot
      where bot.sporting_director_id = director.id
    )
  limit 1;

  if v_director_id is null then
    raise exception 'Directeur sportif introuvable.';
  end if;

  select poll.edition_id, poll.options
  into v_edition_id, v_options
  from public.cyclogazette_polls as poll
  where poll.id = p_poll_id
    and poll.edition_id = (
      select edition.id
      from public.cyclogazette_editions as edition
      order by edition.published_at desc
      limit 1
    );

  if v_edition_id is null then
    raise exception 'Ce sondage est clos.';
  end if;

  select option_rows.option ->> 'id'
  into v_selected_option_id
  from jsonb_array_elements(v_options) as option_rows(option)
  where option_rows.option ->> 'id' = btrim(coalesce(p_option_id, ''))
  limit 1;

  if v_selected_option_id is null then
    raise exception 'Cette réponse n’existe pas.';
  end if;

  insert into public.cyclogazette_poll_votes (
    poll_id,
    sporting_director_id,
    option_id
  )
  values (
    p_poll_id,
    v_director_id,
    v_selected_option_id
  )
  on conflict (poll_id, sporting_director_id) do nothing;

  select vote.option_id
  into v_selected_option_id
  from public.cyclogazette_poll_votes as vote
  where vote.poll_id = p_poll_id
    and vote.sporting_director_id = v_director_id;

  return jsonb_build_object(
    'status', 'recorded',
    'optionId', v_selected_option_id,
    'editionId', v_edition_id
  );
end;
$$;

do $$
declare
  v_latest_edition_id uuid;
begin
  select edition.id
  into v_latest_edition_id
  from public.cyclogazette_editions as edition
  order by edition.published_at desc
  limit 1;

  if v_latest_edition_id is not null then
    perform private.ensure_cyclogazette_poll(v_latest_edition_id);
  end if;
end;
$$;

revoke all on function private.ensure_cyclogazette_poll(uuid)
  from public, anon, authenticated;
revoke all on function private.create_cyclogazette_poll_after_publication()
  from public, anon, authenticated;

revoke all on function public.vote_cyclogazette_poll(uuid, text)
  from public, anon;
grant execute on function public.vote_cyclogazette_poll(uuid, text)
  to authenticated;

comment on table public.cyclogazette_polls is
  'Un sondage communautaire fermé, créé une seule fois pour chaque édition de La Cyclogazette.';
comment on table public.cyclogazette_poll_votes is
  'Un vote immuable par Directeur Sportif et par sondage de La Cyclogazette.';
comment on function private.ensure_cyclogazette_poll(uuid) is
  'Compose sans IA ni tâche récurrente un sondage déterministe à partir des données sportives de l’édition.';
comment on function public.vote_cyclogazette_poll(uuid, text) is
  'Enregistre le vote unique du Directeur Sportif sur le seul sondage encore ouvert.';

notify pgrst, 'reload schema';

commit;
