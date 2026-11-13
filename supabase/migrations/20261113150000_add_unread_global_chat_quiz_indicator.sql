begin;
set local lock_timeout = '500ms';
set local statement_timeout = '5s';

-- Older published rounds use starts_at. Recording actual publication time
-- for new rounds covers any delay while the portrait is prepared.
alter table public.global_chat_quiz_events
  add column notification_at timestamptz;

create function private.set_global_chat_quiz_notification_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.notification_at := clock_timestamp();
  elsif old.status <> 'won' and new.status = 'won' then
    new.notification_at := clock_timestamp();
  end if;
  return new;
end;
$$;

revoke all on function private.set_global_chat_quiz_notification_at()
  from public, anon, authenticated, service_role;

create trigger set_global_chat_quiz_notification_at
before insert or update of status on public.global_chat_quiz_events
for each row execute function private.set_global_chat_quiz_notification_at();

create table private.global_chat_quiz_read_receipts (
  sporting_director_id uuid primary key references public.sporting_directors(id) on delete cascade,
  last_read_at timestamptz not null
);

alter table private.global_chat_quiz_read_receipts enable row level security;
revoke all on private.global_chat_quiz_read_receipts
  from public, anon, authenticated, service_role;

create function public.mark_global_chat_quiz_read(p_read_at timestamptz)
returns timestamptz
language plpgsql volatile security definer
set search_path = ''
as $$
declare
  v_director_id uuid;
  v_last_read_at timestamptz;
begin
  select director.id into v_director_id
  from public.sporting_directors as director
  where director.auth_user_id = (select auth.uid()) and director.status = 'active'
  limit 1;

  if v_director_id is null or p_read_at is null then
    return null;
  end if;

  insert into private.global_chat_quiz_read_receipts as receipt (sporting_director_id, last_read_at)
  values (v_director_id, least(p_read_at, now()))
  on conflict (sporting_director_id) do update
  set last_read_at = excluded.last_read_at
  where receipt.last_read_at < excluded.last_read_at
  returning last_read_at into v_last_read_at;

  if not found then
    select receipt.last_read_at into v_last_read_at
    from private.global_chat_quiz_read_receipts as receipt
    where receipt.sporting_director_id = v_director_id;
  end if;

  return v_last_read_at;
end;
$$;

create function public.get_current_game_header_indicators_v6()
returns table (
  current_sporting_director_id uuid,
  mailbox_unread_count integer,
  direct_message_unread_count integer,
  has_unread_global_chat boolean,
  has_unread_cyclogazette boolean,
  game_role text,
  collector_album_available boolean,
  collector_album_has_unopened_boosters boolean,
  has_unread_global_chat_quiz boolean,
  global_chat_quiz_unread_until timestamptz
)
language sql stable security definer
set search_path = ''
as $$
  select indicators.current_sporting_director_id,
    indicators.mailbox_unread_count,
    indicators.direct_message_unread_count,
    indicators.has_unread_global_chat,
    indicators.has_unread_cyclogazette,
    indicators.game_role,
    indicators.collector_album_available,
    indicators.collector_album_has_unopened_boosters,
    quiz.unread_until is not null,
    quiz.unread_until
  from public.get_current_game_header_indicators_v5() as indicators
  left join private.global_chat_quiz_read_receipts as receipt
    on receipt.sporting_director_id = indicators.current_sporting_director_id
  left join lateral (
    select event.ends_at + interval '15 minutes' as unread_until
    from public.global_chat_quiz_events as event
    where indicators.current_sporting_director_id is not null
      and (select enabled from private.global_chat_quiz_settings where singleton)
      and event.starts_at <= now()
      and event.ends_at > now() - interval '15 minutes'
      and coalesce(event.notification_at, event.starts_at) > coalesce(receipt.last_read_at, '-infinity'::timestamptz)
    order by event.ends_at desc
    limit 1
  ) as quiz on true;
$$;

create or replace function public.get_global_chat_quiz()
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
    'winningMessageId', event.winning_message_id,
    'notificationAt', coalesce(event.notification_at, event.starts_at)
  )
  from public.global_chat_quiz_events event
  where event.starts_at <= now()
    and event.ends_at > now() - interval '15 minutes'
    and (select auth.uid()) is not null
    and (select enabled from private.global_chat_quiz_settings where singleton)
  order by event.ends_at desc
  limit 1;
$$;

revoke all on function public.mark_global_chat_quiz_read(timestamptz) from public, anon;
grant execute on function public.mark_global_chat_quiz_read(timestamptz) to authenticated;
revoke all on function public.get_current_game_header_indicators_v6() from public, anon;
grant execute on function public.get_current_game_header_indicators_v6() to authenticated, service_role;

notify pgrst, 'reload schema';
commit;
