begin;
set local lock_timeout = '500ms';
set local statement_timeout = '15s';

create table private.global_chat_quiz_settings (
  singleton boolean primary key default true check (singleton),
  enabled boolean not null default false
);
insert into private.global_chat_quiz_settings default values;

create table private.global_chat_quiz_rounds (
  id uuid primary key default gen_random_uuid(),
  paris_day date not null unique,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  collection_season_id uuid not null references public.seasons(id),
  rider_id uuid not null,
  avatar_profile_key text,
  avatar_seed bigint,
  age smallint not null,
  answer_name text not null,
  answer_key text not null,
  reverse_answer_key text not null,
  portrait_ready boolean not null default false,
  check (ends_at = starts_at + interval '10 minutes')
);

-- Realtime and authenticated reads expose this table only. Unpublished rounds,
-- rider identity and portrait generation inputs stay in the private schema.
create table public.global_chat_quiz_events (
  id uuid primary key,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  portrait_path text not null check (portrait_path = id::text || '.webp'),
  status text not null default 'open' check (status in ('open', 'won', 'expired')),
  answer_name text,
  answer_rider_id uuid,
  winner_name text,
  winner_username text,
  winner_sporting_director_id uuid,
  winning_message_id uuid,
  check (num_nonnulls(answer_name, answer_rider_id) = case when status = 'open' then 0 else 2 end),
  check (num_nonnulls(winner_name, winner_username, winner_sporting_director_id, winning_message_id)
    = case when status = 'won' then 4 else 0 end)
);
create unique index global_chat_quiz_one_open_idx
  on public.global_chat_quiz_events ((true)) where status = 'open';
create index global_chat_quiz_events_latest_idx
  on public.global_chat_quiz_events (ends_at desc);

revoke all on private.global_chat_quiz_settings, private.global_chat_quiz_rounds
  from public, anon, authenticated, service_role;
alter table public.global_chat_quiz_events enable row level security;
revoke all on public.global_chat_quiz_events from public, anon, authenticated, service_role;
grant select on public.global_chat_quiz_events to authenticated;
create policy global_chat_quiz_recent_events on public.global_chat_quiz_events
  for select to authenticated
  using (ends_at > now() - interval '15 minutes');

insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values ('global-chat-quiz-portraits', 'global-chat-quiz-portraits', true, 30720, array['image/webp'])
on conflict (id) do nothing;

do $$
begin
  if not exists (
    select 1 from storage.buckets where id = 'global-chat-quiz-portraits'
      and name = id and public and file_size_limit = 30720
      and allowed_mime_types = array['image/webp']
  ) then
    raise exception 'Unexpected global chat quiz portrait bucket configuration';
  end if;
end
$$;

create function private.global_chat_quiz_name_key(p_name text)
returns text
language sql stable strict
set search_path = ''
as $$
  select btrim(regexp_replace(
    lower(extensions.unaccent(translate(p_name, '’‘ʼ‐‑–—', chr(39) || chr(39) || chr(39) || '----'))),
    '[[:space:]]+', ' ', 'g'
  ));
$$;

create function public.get_global_chat_quiz()
returns jsonb
language sql stable security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'id', event.id,
    'startsAt', event.starts_at,
    'endsAt', event.ends_at,
    'portraitPath', event.portrait_path,
    'status', event.status,
    'answerName', event.answer_name,
    'answerRiderId', event.answer_rider_id,
    'winnerName', event.winner_name,
    'winnerUsername', event.winner_username,
    'winnerSportingDirectorId', event.winner_sporting_director_id,
    'winningMessageId', event.winning_message_id
  )
  from public.global_chat_quiz_events event
  where event.ends_at > now() - interval '15 minutes'
    and (select auth.uid()) is not null
    and (select enabled from private.global_chat_quiz_settings where singleton)
  order by event.ends_at desc
  limit 1;
$$;

create function public.prepare_global_chat_quiz_round(p_day date default null)
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

    -- Draw one quarter-hour slot once. The last one ends before 22:00 Paris.
    v_start := (v_day + time '12:00' + floor(random() * 40)::integer * interval '15 minutes')
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
    select v_day, v_start, v_start + interval '10 minutes', v_collection, candidate.id,
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

create function public.complete_global_chat_quiz_portrait(p_round_id uuid, p_portrait_path text)
returns boolean
language sql security definer
set search_path = ''
as $$
  with updated as (
    update private.global_chat_quiz_rounds
    set portrait_ready = true
    where id = p_round_id and p_portrait_path = id::text || '.webp'
      and ends_at > clock_timestamp()
      and not portrait_ready
      and exists (
        select 1 from storage.objects
        where bucket_id = 'global-chat-quiz-portraits' and name = p_portrait_path
      )
    returning id
  )
  select exists (select 1 from updated) or exists (
    select 1 from private.global_chat_quiz_rounds
    where id = p_round_id and p_portrait_path = id::text || '.webp'
      and ends_at > clock_timestamp() and portrait_ready
  );
$$;

create function public.process_global_chat_quiz()
returns void
language plpgsql security definer
set search_path = ''
set lock_timeout = '500ms'
as $$
declare
  v_now timestamptz := clock_timestamp();
  v_enabled boolean;
begin
  select enabled into v_enabled from private.global_chat_quiz_settings where singleton for share;

  update public.global_chat_quiz_events event
  set status = 'expired', answer_name = round.answer_name, answer_rider_id = round.rider_id
  from private.global_chat_quiz_rounds round
  where event.status = 'open' and round.id = event.id
    and (event.ends_at <= v_now or not v_enabled);

  if not v_enabled then
    return;
  end if;

  insert into public.global_chat_quiz_events (id, starts_at, ends_at, portrait_path)
  select round.id, round.starts_at, round.ends_at, round.id::text || '.webp'
  from private.global_chat_quiz_rounds round
  join public.seasons collection on collection.id = round.collection_season_id
  join public.cyclo_stickers_editions album on album.collection_season_id = collection.id
  where round.paris_day = (v_now at time zone 'Europe/Paris')::date
    and round.portrait_ready
    and round.starts_at <= v_now and round.ends_at > v_now
    and exists (
      select 1 from public.seasons active
      where active.status = 'active' and active.game_year >= collection.game_year
    )
    and album.configuration ->> 'enabled' = 'true'
    and album.configuration ->> 'publicApproved' = 'true'
  on conflict do nothing;
end;
$$;

create function public.set_global_chat_quiz_enabled(p_enabled boolean)
returns void
language plpgsql security definer
set search_path = ''
as $$
begin
  update private.global_chat_quiz_settings set enabled = p_enabled where singleton;
  perform public.process_global_chat_quiz();
end;
$$;

create function private.score_global_chat_quiz_message()
returns trigger
language plpgsql security definer
set search_path = ''
set lock_timeout = '250ms'
as $$
declare
  v_round private.global_chat_quiz_rounds%rowtype;
  v_answer text;
  v_director record;
begin
  -- The common path is one lookup on the singleton partial open index.
  select round.* into v_round
  from public.global_chat_quiz_events event
  join private.global_chat_quiz_rounds round on round.id = event.id
  where event.status = 'open'
    and event.starts_at <= new.created_at
    and event.ends_at > clock_timestamp();
  if not found or char_length(new.message) > 160 then
    return null;
  end if;

  v_answer := private.global_chat_quiz_name_key(new.message);
  if v_answer not in (v_round.answer_key, v_round.reverse_answer_key) then
    return null;
  end if;

  -- The enclosing chat RPC adds these fields after inserting the base row.
  -- A deferred trigger sees that final row without changing chat writes.
  if not exists (
    select 1 from public.global_chat_messages message
    where message.id = new.id and message.message = new.message
      and message.source_race_edition_id is null and message.source_stage_id is null
      and message.image_path is null and message.gif_attachment is null
  ) then
    return null;
  end if;

  select director.id, director.username, director.display_name into v_director
  from public.sporting_directors director
  where director.id = new.sporting_director_id and director.auth_user_id = (select auth.uid())
    and director.status = 'active'
    and not exists (
      select 1 from public.alpha_bot_managers bot where bot.sporting_director_id = director.id
    );
  if not found then
    return null;
  end if;

  -- Only correct eligible answers take locks. The exception block rolls
  -- back the quiz work if the reward fails, while preserving the chat post.
  perform 1 from private.global_chat_quiz_settings where singleton and enabled for share nowait;
  if not found then
    return null;
  end if;

  perform 1
  from public.cyclo_stickers_editions album
  join public.seasons collection on collection.id = album.collection_season_id
  where collection.id = v_round.collection_season_id
    and album.configuration ->> 'enabled' = 'true'
    and album.configuration ->> 'publicApproved' = 'true'
    and exists (
      select 1 from public.seasons active
      where active.status = 'active' and active.game_year >= collection.game_year
    )
  for share of album, collection nowait;
  if not found then
    return null;
  end if;

  update public.global_chat_quiz_events
  set status = 'won', answer_name = v_round.answer_name, answer_rider_id = v_round.rider_id,
    winner_name = v_director.display_name, winner_username = v_director.username,
    winner_sporting_director_id = v_director.id, winning_message_id = new.id
  where id = v_round.id and status = 'open' and ends_at > clock_timestamp();
  if not found then
    return null;
  end if;

  insert into public.cyclo_stickers_boosters (
    sporting_director_id, collection_season_id, acquisition_source, source_reference, awarded_on
  )
  values (v_director.id, v_round.collection_season_id, 'global_chat_quiz', v_round.id::text, v_round.paris_day);
  return null;
exception when others then
  raise warning 'Global chat quiz settlement failed for round % (SQLSTATE %)', v_round.id, sqlstate;
  return null;
end;
$$;

create constraint trigger score_global_chat_quiz_message
after insert on public.global_chat_messages
deferrable initially deferred
for each row execute function private.score_global_chat_quiz_message();

revoke all on function private.global_chat_quiz_name_key(text),
  private.score_global_chat_quiz_message() from public, anon, authenticated, service_role;
revoke all on function public.get_global_chat_quiz() from public, anon;
grant execute on function public.get_global_chat_quiz() to authenticated;
revoke all on function public.prepare_global_chat_quiz_round(date),
  public.complete_global_chat_quiz_portrait(uuid, text), public.process_global_chat_quiz(),
  public.set_global_chat_quiz_enabled(boolean) from public, anon, authenticated;
grant execute on function public.prepare_global_chat_quiz_round(date),
  public.complete_global_chat_quiz_portrait(uuid, text), public.process_global_chat_quiz(),
  public.set_global_chat_quiz_enabled(boolean) to service_role;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1 from pg_publication_tables where pubname = 'supabase_realtime'
         and schemaname = 'public' and tablename = 'global_chat_quiz_events'
     ) then
    alter publication supabase_realtime add table public.global_chat_quiz_events;
  end if;
end
$$;

-- A Paris 12:00–22:00 round is covered in both CET and CEST. These ticks
-- open quarter-hour slots and close unanswered rounds exactly ten minutes later.
select cron.schedule(
  'global-chat-quiz-tick', '0,10,15,25,30,40,45,55 10-20 * * *',
  $job$select public.process_global_chat_quiz();$job$
);

commit;
