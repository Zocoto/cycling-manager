begin;
set local statement_timeout = '5s';
set local lock_timeout = '500ms';

create index if not exists global_chat_quiz_events_starts_at_idx
  on public.global_chat_quiz_events (starts_at desc, id desc);

-- Published rounds remain part of the chat history. Keep the narrower raw
-- Realtime policy and expose only the fields needed to display a question.
create function public.get_global_chat_quiz_history(
  p_from timestamptz default null,
  p_before timestamptz default null
)
returns table (
  id uuid,
  starts_at timestamptz,
  ends_at timestamptz,
  portrait_path text,
  status text,
  answer_name text,
  answer_rider_id uuid,
  winner_username text,
  winner_sporting_director_id uuid
)
language sql stable security definer
set search_path = ''
as $$
  select event.id, event.starts_at, event.ends_at, event.portrait_path, event.status,
    case when event.status in ('won', 'expired') then event.answer_name end,
    case when event.status in ('won', 'expired') then event.answer_rider_id end,
    case when event.status = 'won' then event.winner_username end,
    case when event.status = 'won' then event.winner_sporting_director_id end
  from public.global_chat_quiz_events event
  where (select auth.uid()) is not null
    and event.starts_at <= now()
    and event.starts_at >= coalesce(p_from, '-infinity'::timestamptz)
    and event.starts_at < coalesce(p_before, 'infinity'::timestamptz)
  order by event.starts_at desc, event.id desc
  limit 60;
$$;

revoke all on function public.get_global_chat_quiz_history(timestamptz, timestamptz)
  from public, anon, authenticated, service_role;
grant execute on function public.get_global_chat_quiz_history(timestamptz, timestamptz)
  to authenticated;

commit;
