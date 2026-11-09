begin;
set local lock_timeout = '500ms';
set local statement_timeout = '5s';

-- Keep the original round, its image and its result. A legacy row occupies
-- the window containing its start without changing its stored timestamps.
alter table private.global_chat_quiz_rounds
  add column daily_slot smallint check (daily_slot between 1 and 3),
  drop constraint global_chat_quiz_rounds_paris_day_key,
  add constraint global_chat_quiz_rounds_day_slot_key
    unique nulls not distinct (paris_day, daily_slot);

create or replace function public.prepare_global_chat_quiz_round(p_day date default null)
returns jsonb
language plpgsql security definer
set search_path = ''
as $$
declare
  v_today date := (clock_timestamp() at time zone 'Europe/Paris')::date;
  v_day date := coalesce(p_day, v_today);
  v_now timestamptz;
  v_active_season uuid;
  v_game_year integer;
  v_collection uuid;
  v_round private.global_chat_quiz_rounds%rowtype;
  v_slots smallint[];
  v_starts timestamptz[];
begin
  if v_day <> v_today or not coalesce((
    select enabled from private.global_chat_quiz_settings where singleton
  ), false) then
    return null;
  end if;

  perform pg_advisory_xact_lock(hashtextextended('global-chat-quiz:' || v_day::text, 0));
  v_now := clock_timestamp();

  -- Draw only missing windows. On a late deployment or retry, never insert a
  -- round whose preparation window has already passed.
  select array_agg(bounds.slot order by bounds.slot), array_agg(draw.starts_at order by bounds.slot)
  into v_slots, v_starts
  from (values
    (1::smallint, time '12:00', time '15:00'),
    (2::smallint, time '15:00', time '18:00'),
    (3::smallint, time '18:00', time '22:00')
  ) as bounds(slot, opens_at, closes_at)
  cross join lateral (
    select quarter.local_start at time zone 'Europe/Paris' as starts_at
    from generate_series(
      v_day + bounds.opens_at,
      v_day + bounds.closes_at - interval '30 minutes',
      interval '15 minutes'
    ) as quarter(local_start)
    where quarter.local_start at time zone 'Europe/Paris' > v_now + interval '1 minute'
      and not exists (
        select 1 from private.global_chat_quiz_rounds round
        where round.paris_day = v_day
          and round.starts_at < (quarter.local_start at time zone 'Europe/Paris') + interval '30 minutes'
          and round.ends_at > quarter.local_start at time zone 'Europe/Paris'
      )
    order by random()
    limit 1
  ) as draw
  where not exists (
    select 1 from private.global_chat_quiz_rounds round
    where round.paris_day = v_day
      and coalesce(round.daily_slot, case
        when (round.starts_at at time zone 'Europe/Paris')::time < time '15:00' then 1
        when (round.starts_at at time zone 'Europe/Paris')::time < time '18:00' then 2
        else 3
      end) = bounds.slot
  );

  if cardinality(v_slots) > 0 then
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
      select rider_id, paris_day from private.global_chat_quiz_rounds
      where paris_day between v_day - 14 and v_day
    ), drawn_riders as (
      select candidate.*
      from candidates candidate
      where not exists (
        select 1 from ambiguous_names
        where name in (candidate.answer_key, candidate.reverse_answer_key)
      ) and not exists (
        select 1 from recent_riders recent
        where recent.rider_id = candidate.id and recent.paris_day = v_day
      )
      order by exists (select 1 from recent_riders where rider_id = candidate.id), random()
      limit cardinality(v_slots)
    ), numbered_riders as (
      select rider.*, row_number() over () as position from drawn_riders rider
    )
    insert into private.global_chat_quiz_rounds (
      paris_day, daily_slot, starts_at, ends_at, collection_season_id, rider_id,
      avatar_profile_key, avatar_seed, age, answer_name, answer_key, reverse_answer_key
    )
    select v_day, planned.slot, planned.starts_at, planned.starts_at + interval '30 minutes',
      v_collection, rider.id, rider.avatar_profile_key, rider.avatar_seed, rider.age,
      rider.answer_name, rider.answer_key, rider.reverse_answer_key
    from unnest(v_slots, v_starts) with ordinality as planned(slot, starts_at, position)
    join numbered_riders rider on rider.position = planned.position;
  end if;

  -- Each invocation prepares at most one image. The caller can complete that
  -- portrait and call again without regenerating an already-ready portrait.
  select * into v_round from private.global_chat_quiz_rounds
  where paris_day = v_day and not portrait_ready and starts_at > clock_timestamp()
  order by starts_at
  limit 1;
  if not found then
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

commit;
