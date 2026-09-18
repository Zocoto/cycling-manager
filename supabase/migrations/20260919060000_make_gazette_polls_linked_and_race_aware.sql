-- Keep poll choices tied to real entities and avoid predicting team winners of
-- individual championships. Existing votes are never rewritten or reset.
alter table public.cyclogazette_polls
  add column subjects jsonb not null default '[]'::jsonb;

alter table public.cyclogazette_polls
  add constraint cyclogazette_polls_subjects_array
  check (jsonb_typeof(subjects) = 'array');

create or replace function private.enrich_cyclogazette_poll_entities()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_season_id uuid;
  v_day_number integer;
  v_issue_number integer;
  v_game_year integer;
  v_race record;
  v_defending_team_id uuid;
  v_defending_team_name text;
  v_team record;
  v_rider record;
  v_subjects jsonb := '[]'::jsonb;
begin
  select edition.season_id, day.day_number, edition.issue_number, season.game_year
    into v_season_id, v_day_number, v_issue_number, v_game_year
  from public.cyclogazette_editions as edition
  join public.season_days as day on day.id = edition.season_day_id
  join public.seasons as season on season.id = edition.season_id
  where edition.id = new.edition_id;

  if v_season_id is null then
    return new;
  end if;

  -- The old generator could pick a national TT and then list random teams.
  -- Replace that proposal only for future polls, before anyone can vote.
  if tg_op = 'INSERT' and new.topic_type = 'race_prediction' then
    select race.id as race_id, edition.id as edition_id,
      edition.display_name, race.slug
      into v_race
    from public.race_editions as edition
    join public.races as race on race.id = edition.race_id
    join public.stages as stage on stage.race_edition_id = edition.id
    join public.season_days as day on day.id = stage.season_day_id
    where edition.season_id = v_season_id
      and edition.status in ('planned', 'registration_open', 'registration_closed', 'in_progress')
      and race.status = 'active'
      and race.competition_type = 'standard'
      and day.day_number > v_day_number
      and (
        select count(distinct registration.team_season_id)
        from public.race_registrations as registration
        where registration.race_edition_id = edition.id
          and registration.status = 'accepted'
      ) >= 2
    group by race.id, edition.id, edition.display_name, race.slug
    order by min(day.day_number), edition.display_name
    limit 1;

    if v_race is not null then
      select prior_team.team_id into v_defending_team_id
      from public.race_results as result
      join public.race_editions as prior_edition
        on prior_edition.id = result.race_edition_id
      join public.seasons as prior_season
        on prior_season.id = prior_edition.season_id
      join public.race_rosters as roster on roster.id = result.race_roster_id
      join public.race_registrations as prior_registration
        on prior_registration.id = roster.race_registration_id
      join public.team_seasons as prior_team
        on prior_team.id = prior_registration.team_season_id
      where prior_edition.race_id = v_race.race_id
        and prior_season.game_year < v_game_year
        and result.status = 'classified'
        and result.final_rank = 1
      order by prior_season.game_year desc
      limit 1;

      select current_team.display_name into v_defending_team_name
      from public.race_registrations as registration
      join public.team_seasons as current_team
        on current_team.id = registration.team_season_id
      where registration.race_edition_id = v_race.edition_id
        and registration.status = 'accepted'
        and current_team.team_id = v_defending_team_id
      limit 1;

      select jsonb_agg(
        jsonb_build_object(
          'id', 'option-' || candidate.position::text,
          'label', candidate.team_name,
          'href', '/jeu/equipes/' || candidate.team_id::text
        ) order by candidate.position
      ) into new.options
      from (
        select row_number() over (
          order by case when team.team_id = v_defending_team_id then 0 else 1 end,
            md5(team.team_id::text || ':poll:' || v_issue_number::text)
        ) as position,
          team.team_id, team.display_name as team_name
        from public.race_registrations as registration
        join public.team_seasons as team
          on team.id = registration.team_season_id
        where registration.race_edition_id = v_race.edition_id
          and registration.status = 'accepted'
        order by case when team.team_id = v_defending_team_id then 0 else 1 end,
          md5(team.team_id::text || ':poll:' || v_issue_number::text)
        limit 4
      ) as candidate;

      new.question := case
        when v_defending_team_name is not null then
          format('%s défend son titre sur %s : quelle équipe engagée l’emportera ?',
            v_defending_team_name, v_race.display_name)
        else format('Parmi les équipes engagées, laquelle remportera %s ?',
            v_race.display_name)
      end;
    else
      new.topic_type := 'team_opinion';
      new.question := 'Parmi ces formations, laquelle vous paraît la plus convaincante cette saison ?';
    end if;
  end if;

  -- IDs are stored beside the labels: no fuzzy lookup on every page view.
  if new.topic_type in ('race_prediction', 'rider_choice', 'team_opinion') then
    select coalesce(jsonb_agg(
      option_row.option ||
        case
          when option_row.option ? 'href' then '{}'::jsonb
          when new.topic_type in ('race_prediction', 'team_opinion')
            and team_ref.team_id is not null
            then jsonb_build_object('href', '/jeu/equipes/' || team_ref.team_id::text)
          when new.topic_type = 'rider_choice' and rider_ref.rider_id is not null
            then jsonb_build_object('href', '/jeu/coureurs/' || rider_ref.rider_id::text)
          else '{}'::jsonb
        end
      order by option_row.ordinality
    ), '[]'::jsonb) into new.options
    from jsonb_array_elements(new.options) with ordinality
      as option_row(option, ordinality)
    left join lateral (
      select team.team_id
      from public.team_seasons as team
      where team.season_id = v_season_id
        and team.display_name = option_row.option ->> 'label'
      order by team.id
      limit 1
    ) as team_ref on new.topic_type in ('race_prediction', 'team_opinion')
    left join lateral (
      select rider.id as rider_id
      from public.riders as rider
      join public.rider_season_ratings as rating
        on rating.rider_id = rider.id and rating.season_id = v_season_id
      where concat_ws(' ', rider.first_name, rider.last_name)
        = option_row.option ->> 'label'
      order by rider.id
      limit 1
    ) as rider_ref on new.topic_type = 'rider_choice';
  end if;

  if new.topic_type = 'race_prediction' then
    select race.slug, edition.display_name into v_race
    from public.race_editions as edition
    join public.races as race on race.id = edition.race_id
    where edition.season_id = v_season_id
      and position(edition.display_name in new.question) > 0
    order by length(edition.display_name) desc
    limit 1;
    if v_race.slug is not null then
      v_subjects := v_subjects || jsonb_build_array(jsonb_build_object(
        'label', v_race.display_name,
        'href', '/jeu/courses/' || v_race.slug
      ));
    end if;
  end if;

  if new.topic_type in ('team_opinion', 'team_recruitment', 'race_prediction') then
    select team.team_id, team.display_name into v_team
    from public.team_seasons as team
    where team.season_id = v_season_id
      and position(team.display_name in new.question) > 0
    order by length(team.display_name) desc
    limit 1;
    if v_team.team_id is not null then
      v_subjects := v_subjects || jsonb_build_array(jsonb_build_object(
        'label', v_team.display_name,
        'href', '/jeu/equipes/' || v_team.team_id::text
      ));
    end if;
  end if;

  if new.topic_type in ('rider_future', 'team_recruitment') then
    select rider.id, concat_ws(' ', rider.first_name, rider.last_name) as name
      into v_rider
    from public.riders as rider
    join public.rider_season_ratings as rating
      on rating.rider_id = rider.id and rating.season_id = v_season_id
    where position(concat_ws(' ', rider.first_name, rider.last_name) in new.question) > 0
    order by length(concat_ws(' ', rider.first_name, rider.last_name)) desc
    limit 1;
    if v_rider.id is not null then
      v_subjects := v_subjects || jsonb_build_array(jsonb_build_object(
        'label', v_rider.name,
        'href', '/jeu/coureurs/' || v_rider.id::text
      ));
    end if;
  end if;

  new.subjects := v_subjects;
  return new;
end;
$$;

create trigger cyclogazette_polls_enrich_entities
before insert or update of question, options on public.cyclogazette_polls
for each row execute function private.enrich_cyclogazette_poll_entities();

-- Add navigable references to the archive while retaining every option ID.
update public.cyclogazette_polls set options = options;

-- Three votes already exist for this individual championship poll. Keep the
-- options and votes intact, but remove the incorrect claim that a team wins it.
update public.cyclogazette_polls as poll
set question = 'Parmi ces équipes, laquelle vous semble la mieux armée pour les prochains chronos ?'
from public.cyclogazette_editions as edition
where edition.id = poll.edition_id
  and edition.issue_number = 63
  and poll.question = 'Quelle équipe remportera Championnat de Afghanistan - Contre-la-montre ?';

-- The underlying game summary remains unchanged; this wrapper adds links in
-- the same client RPC round trip without altering voting or reward logic.
create or replace function public.get_cyclogazette_game_summary_v2(
  p_edition_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_summary jsonb;
  v_poll jsonb;
  v_options jsonb;
  v_subjects jsonb;
  v_linked_options jsonb;
begin
  v_summary := public.get_cyclogazette_game_summary(p_edition_id);
  v_poll := v_summary -> 'poll';
  if v_poll is null or v_poll = 'null'::jsonb then return v_summary; end if;

  select poll.options, poll.subjects into v_options, v_subjects
  from public.cyclogazette_polls as poll
  where poll.edition_id = p_edition_id;

  select coalesce(jsonb_agg(
    summary_option.option ||
      case when stored.option ->> 'href' ~ '^/jeu/(coureurs|equipes|courses)/[a-zA-Z0-9-]+$'
        then jsonb_build_object('href', stored.option ->> 'href')
        else '{}'::jsonb end
    order by summary_option.ordinality
  ), '[]'::jsonb) into v_linked_options
  from jsonb_array_elements(v_poll -> 'options') with ordinality
    as summary_option(option, ordinality)
  left join lateral (
    select option
    from jsonb_array_elements(v_options) as stored(option)
    where option ->> 'id' = summary_option.option ->> 'id'
    limit 1
  ) as stored on true;

  v_poll := jsonb_set(v_poll, '{options}', v_linked_options);
  v_poll := jsonb_set(v_poll, '{subjects}', coalesce(v_subjects, '[]'::jsonb));
  return jsonb_set(v_summary, '{poll}', v_poll);
end;
$$;

revoke all on function public.get_cyclogazette_game_summary_v2(uuid)
  from public, anon;
grant execute on function public.get_cyclogazette_game_summary_v2(uuid)
  to authenticated;
revoke all on function private.enrich_cyclogazette_poll_entities()
  from public, anon, authenticated;

notify pgrst, 'reload schema';
