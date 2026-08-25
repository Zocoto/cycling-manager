begin;

-- Une mention est une relation légère, créée seulement lorsque le DS choisit
-- un membre dans l'autocomplétion. Le fil général ne balaie donc jamais
-- l'annuaire pour analyser chaque message.
create table public.global_chat_mentions (
  message_id uuid not null
    references public.global_chat_messages(id) on delete cascade,
  mentioned_sporting_director_id uuid not null
    references public.sporting_directors(id) on delete cascade,
  sender_sporting_director_id uuid not null
    references public.sporting_directors(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (message_id, mentioned_sporting_director_id),
  constraint global_chat_mentions_not_self check (
    mentioned_sporting_director_id <> sender_sporting_director_id
  )
);

create index global_chat_mentions_recipient_created_idx
  on public.global_chat_mentions (
    mentioned_sporting_director_id,
    created_at desc,
    message_id desc
  );

alter table public.global_chat_mentions enable row level security;

create policy global_chat_mentions_select_participant
on public.global_chat_mentions
for select
to authenticated
using (
  exists (
    select 1
    from public.sporting_directors as director
    where director.auth_user_id = (select auth.uid())
      and director.id in (
        global_chat_mentions.mentioned_sporting_director_id,
        global_chat_mentions.sender_sporting_director_id
      )
  )
);

grant select on table public.global_chat_mentions to authenticated;
grant all privileges on table public.global_chat_mentions to service_role;

create or replace function public.search_current_global_chat_mentions(
  p_query text,
  p_limit integer default 6
)
returns table (
  sporting_director_id uuid,
  username text,
  display_name text,
  avatar_key text,
  avatar_frame_key text,
  team_id uuid,
  team_name text
)
language sql
stable
security definer
set search_path = ''
as $$
  with search_input as (
    select
      lower(btrim(coalesce(p_query, ''))) as normalized_query,
      greatest(1, least(coalesce(p_limit, 6), 8)) as result_limit
  ),
  viewer as (
    select identity.sporting_director_id
    from public.get_current_global_chat_identity() as identity
  ),
  candidates as (
    select
      director.id,
      director.username,
      director.display_name,
      director.avatar_key,
      director.avatar_frame_key,
      assignment.team_id,
      coalesce(
        current_team_season.display_name,
        nullif(btrim(team.amateur_name), ''),
        team.internal_name
      ) as team_name,
      case
        when lower(director.username) = search_input.normalized_query then 0
        when left(
          lower(director.username),
          char_length(search_input.normalized_query)
        ) = search_input.normalized_query then 1
        when left(
          lower(director.display_name),
          char_length(search_input.normalized_query)
        ) = search_input.normalized_query then 2
        else 3
      end as match_rank
    from search_input
    join viewer on true
    join public.sporting_directors as director
      on director.status = 'active'
     and director.id <> viewer.sporting_director_id
    join public.team_manager_assignments as assignment
      on assignment.sporting_director_id = director.id
     and assignment.role = 'general_manager'
     and assignment.status = 'active'
    join public.teams as team
      on team.id = assignment.team_id
     and team.status = 'active'
    left join lateral (
      select team_season.display_name
      from public.team_seasons as team_season
      where team_season.team_id = team.id
        and team_season.status in ('planned', 'active')
      order by
        case when team_season.status = 'active' then 0 else 1 end,
        team_season.created_at desc
      limit 1
    ) as current_team_season on true
    where char_length(search_input.normalized_query) >= 1
      and (
        strpos(lower(director.username), search_input.normalized_query) > 0
        or strpos(lower(director.display_name), search_input.normalized_query) > 0
        or strpos(
          lower(coalesce(
            current_team_season.display_name,
            team.amateur_name,
            team.internal_name
          )),
          search_input.normalized_query
        ) > 0
      )
      and not exists (
        select 1
        from public.alpha_bot_managers as bot
        where bot.sporting_director_id = director.id
      )
  )
  select
    candidate.id,
    candidate.username,
    candidate.display_name,
    candidate.avatar_key,
    candidate.avatar_frame_key,
    candidate.team_id,
    candidate.team_name
  from candidates as candidate
  order by candidate.match_rank, candidate.display_name, candidate.id
  limit (select result_limit from search_input);
$$;

create or replace function public.post_global_chat_message_v3(
  p_message text,
  p_preview_type text default null,
  p_preview_entity_id uuid default null,
  p_reply_to_message_id uuid default null,
  p_mentioned_sporting_director_ids uuid[] default array[]::uuid[]
)
returns public.global_chat_messages
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_result public.global_chat_messages;
  v_mention_count integer;
begin
  select count(*)::integer
  into v_mention_count
  from (
    select distinct mention_id
    from unnest(coalesce(
      p_mentioned_sporting_director_ids,
      array[]::uuid[]
    )) as mention(mention_id)
  ) as mentions;

  if v_mention_count > 5 then
    raise exception 'Un message ne peut notifier que 5 membres à la fois.';
  end if;

  v_result := public.post_global_chat_message_v2(
    p_message,
    p_preview_type,
    p_preview_entity_id,
    p_reply_to_message_id
  );

  insert into public.global_chat_mentions (
    message_id,
    mentioned_sporting_director_id,
    sender_sporting_director_id,
    created_at
  )
  select
    v_result.id,
    director.id,
    v_result.sporting_director_id,
    v_result.created_at
  from (
    select distinct mention_id
    from unnest(coalesce(
      p_mentioned_sporting_director_ids,
      array[]::uuid[]
    )) as mention(mention_id)
  ) as requested
  join public.sporting_directors as director
    on director.id = requested.mention_id
   and director.status = 'active'
   and director.id <> v_result.sporting_director_id
  where strpos(
    lower(v_result.message),
    '@' || lower(director.username)
  ) > 0;

  return v_result;
end;
$$;

-- Les mentions réutilisent la file Web Push et ses heures silencieuses.
alter table public.push_notification_outbox
  drop constraint if exists push_notification_outbox_event_type_allowed;

alter table public.push_notification_outbox
  add constraint push_notification_outbox_event_type_allowed check (
    event_type in (
      'race_live_started',
      'transfer_offer_received',
      'transfer_offer_answered',
      'transfer_bid_outbid',
      'cyclogazette_published',
      'scouting_completed',
      'infrastructure_completed',
      'global_chat_mention'
    )
  );

create or replace function public.enqueue_global_chat_mention_push()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_auth_user_id uuid;
  v_author_display_name text;
  v_message text;
begin
  select director.auth_user_id
  into v_auth_user_id
  from public.sporting_directors as director
  where director.id = new.mentioned_sporting_director_id
    and director.status = 'active';

  if v_auth_user_id is null
    or not exists (
      select 1
      from public.push_subscriptions as subscription
      where subscription.auth_user_id = v_auth_user_id
        and subscription.is_active = true
    )
  then
    return new;
  end if;

  select message.author_display_name, message.message
  into v_author_display_name, v_message
  from public.global_chat_messages as message
  where message.id = new.message_id;

  insert into public.push_notification_outbox (
    auth_user_id,
    event_type,
    event_key,
    title,
    body,
    action_href,
    deliver_after
  ) values (
    v_auth_user_id,
    'global_chat_mention',
    'global-chat-mention:' || new.message_id::text,
    left(coalesce(v_author_display_name, 'Un DS') || ' vous mentionne', 120),
    left(coalesce(v_message, 'Vous avez été mentionné dans le chat.'), 240),
    '/jeu/chat#global-chat-message-' || new.message_id::text,
    public.get_next_decent_push_delivery_at(new.created_at)
  )
  on conflict (auth_user_id, event_key) do nothing;

  return new;
end;
$$;

create trigger global_chat_mentions_enqueue_push
after insert on public.global_chat_mentions
for each row execute function public.enqueue_global_chat_mention_push();

revoke all on function public.search_current_global_chat_mentions(text, integer)
  from public, anon;
revoke all on function public.post_global_chat_message_v3(text, text, uuid, uuid, uuid[])
  from public, anon;
revoke all on function public.enqueue_global_chat_mention_push()
  from public, anon, authenticated;

grant execute on function public.search_current_global_chat_mentions(text, integer)
  to authenticated, service_role;
grant execute on function public.post_global_chat_message_v3(text, text, uuid, uuid, uuid[])
  to authenticated, service_role;

comment on table public.global_chat_mentions is
  'Destinataires explicitement notifiés par une mention dans le chat général.';
comment on function public.post_global_chat_message_v3(text, text, uuid, uuid, uuid[]) is
  'Publie un message général et enregistre au plus cinq mentions validées.';

notify pgrst, 'reload schema';

commit;
