begin;
set local lock_timeout = '500ms';
set local statement_timeout = '10s';

-- Apply the new duration to new rows and leave published rounds unchanged.
alter table private.global_chat_quiz_rounds
  drop constraint global_chat_quiz_rounds_check,
  add constraint global_chat_quiz_rounds_duration_check
    check (ends_at = starts_at + interval '30 minutes') not valid;

-- A prepared round can be safely extended before it is published or starts.
-- If the new latest start has passed, keep the existing reservation as-is.
with upcoming as (
  select round.id, least(round.starts_at, (round.paris_day + time '21:30')
    at time zone 'Europe/Paris') as new_start
  from private.global_chat_quiz_rounds round
  where round.starts_at > now()
    and round.ends_at = round.starts_at + interval '10 minutes'
    and not exists (
      select 1 from public.global_chat_quiz_events event where event.id = round.id
    )
)
update private.global_chat_quiz_rounds round
set starts_at = upcoming.new_start, ends_at = upcoming.new_start + interval '30 minutes'
from upcoming
where round.id = upcoming.id and upcoming.new_start > now();

do $$
begin
  if not exists (
    select 1 from private.global_chat_quiz_rounds
    where ends_at <> starts_at + interval '30 minutes'
  ) then
    alter table private.global_chat_quiz_rounds
      validate constraint global_chat_quiz_rounds_duration_check;
  end if;
end
$$;

create or replace function public.prepare_global_chat_quiz_round(p_day date default null)
returns jsonb
language plpgsql security definer
set search_path = ''
as $$
declare
  v_today date := (clock_timestamp() at time zone 'Europe/Paris')::date;
  v_day date := coalesce(p_day, v_today);
  v_active_season uuid;
  v_game_year integer;
  v_collection uuid;
  v_round private.global_chat_quiz_rounds%rowtype;
  v_start timestamptz;
begin
  if v_day <> v_today or not (
    select enabled from private.global_chat_quiz_settings where singleton
  ) then
    return null;
  end if;

  perform pg_advisory_xact_lock(hashtextextended('global-chat-quiz:' || v_day::text, 0));
  select * into v_round from private.global_chat_quiz_rounds where paris_day = v_day;

  if not found then
    select id, game_year into v_active_season, v_game_year
    from public.seasons
    where status = 'active'
    order by game_year desc
    limit 1;
    if not found then
      return null;
    end if;

    select collection.id into v_collection
    from public.seasons collection
    join public.cyclo_stickers_editions album on album.collection_season_id = collection.id
    join public.seasons source on source.id = album.source_season_id
    where collection.game_year <= v_game_year and source.status = 'completed'
      and source.game_year = collection.game_year - 1
      and album.configuration ->> 'enabled' = 'true'
      and album.configuration ->> 'publicApproved' = 'true'
    order by collection.game_year desc
    limit 1;
    if not found then
      return null;
    end if;

    -- Draw one quarter-hour slot once. The last one ends at 22:00 Paris.
    v_start := (v_day + time '12:00' + floor(random() * 39)::integer * interval '15 minutes')
      at time zone 'Europe/Paris';
    with candidates as materialized (
      select rider.id, rider.avatar_profile_key, rider.avatar_seed, rating.age,
        btrim(rider.first_name) || ' ' || btrim(rider.last_name) as answer_name,
        private.global_chat_quiz_name_key(rider.first_name || ' ' || rider.last_name) as answer_key,
        private.global_chat_quiz_name_key(rider.last_name || ' ' || rider.first_name) as reverse_answer_key
      from public.rider_season_ratings rating
      join public.riders rider on rider.id = rating.rider_id and rider.status = 'active'
      join public.rider_contracts contract on contract.rider_id = rider.id and contract.status = 'active'
      join public.teams team on team.id = contract.team_id and team.status = 'active'
      where rating.season_id = v_active_season
    ), ambiguous_names as (
      select alias.name
      from candidates candidate
      cross join lateral (
        select candidate.answer_key as name
        union
        select candidate.reverse_answer_key
      ) alias
      group by alias.name
      having count(*) > 1
    ), recent_riders as materialized (
      select rider_id from private.global_chat_quiz_rounds
      where paris_day >= v_day - 14
    )
    insert into private.global_chat_quiz_rounds (
      paris_day, starts_at, ends_at, collection_season_id, rider_id,
      avatar_profile_key, avatar_seed, age, answer_name, answer_key, reverse_answer_key
    )
    select v_day, v_start, v_start + interval '30 minutes', v_collection, candidate.id,
      candidate.avatar_profile_key, candidate.avatar_seed, candidate.age,
      candidate.answer_name, candidate.answer_key, candidate.reverse_answer_key
    from candidates candidate
    where not exists (
      select 1 from ambiguous_names
      where name in (candidate.answer_key, candidate.reverse_answer_key)
    )
    order by exists (select 1 from recent_riders where rider_id = candidate.id), random()
    limit 1
    returning * into v_round;
  end if;

  if v_round.id is null or v_round.ends_at <= clock_timestamp()
    or (v_round.starts_at <= clock_timestamp() and not v_round.portrait_ready) then
    return null;
  end if;
  return jsonb_build_object(
    'id', v_round.id,
    'startsAt', v_round.starts_at,
    'endsAt', v_round.ends_at,
    'riderId', v_round.rider_id,
    'avatarProfileKey', v_round.avatar_profile_key,
    'avatarSeed', v_round.avatar_seed::text,
    'age', v_round.age,
    'portraitReady', v_round.portrait_ready
  );
end;
$$;

-- Quarter-hour ticks cover openings and closings in both CET and CEST.
-- The final winter round can close at 21:00 UTC (22:00 Paris).
select cron.schedule(
  'global-chat-quiz-tick', '0,15,30,45 10-21 * * *',
  $job$select public.process_global_chat_quiz();$job$
);

commit;
