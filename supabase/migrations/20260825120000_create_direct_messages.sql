begin;

-- ============================================================
-- MESSAGES PRIVES ENTRE DIRECTEURS SPORTIFS
--
-- Les conversations, leurs compteurs et leurs messages sont séparés du
-- chat global et de la boîte mail métier. Les lectures courantes passent
-- par des index bornés ; aucun compteur ne parcourt l'historique.
-- ============================================================

create table public.direct_conversations (
  id uuid primary key default gen_random_uuid(),
  member_low_id uuid not null
    references public.sporting_directors(id) on delete cascade,
  member_high_id uuid not null
    references public.sporting_directors(id) on delete cascade,
  last_message_sender_id uuid
    references public.sporting_directors(id) on delete set null,
  last_message_body text,
  last_message_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint direct_conversations_members_ordered check (
    member_low_id < member_high_id
  ),
  constraint direct_conversations_members_unique unique (
    member_low_id,
    member_high_id
  ),
  constraint direct_conversations_last_message_complete check (
    (
      last_message_sender_id is null
      and last_message_body is null
      and last_message_at is null
    )
    or (
      last_message_sender_id in (member_low_id, member_high_id)
      and nullif(btrim(last_message_body), '') is not null
      and last_message_at is not null
    )
  )
);

create table public.direct_conversation_states (
  conversation_id uuid not null
    references public.direct_conversations(id) on delete cascade,
  sporting_director_id uuid not null
    references public.sporting_directors(id) on delete cascade,
  unread_count integer not null default 0,
  last_read_at timestamptz,
  last_activity_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  primary key (conversation_id, sporting_director_id),
  constraint direct_conversation_states_unread_valid check (
    unread_count >= 0
  )
);

create table public.direct_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null
    references public.direct_conversations(id) on delete cascade,
  sender_id uuid not null
    references public.sporting_directors(id) on delete cascade,
  recipient_id uuid not null
    references public.sporting_directors(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now(),
  constraint direct_messages_members_distinct check (
    sender_id <> recipient_id
  ),
  constraint direct_messages_body_length check (
    char_length(btrim(body)) between 1 and 1000
  )
);

create index direct_conversation_states_director_activity_idx
  on public.direct_conversation_states (
    sporting_director_id,
    last_activity_at desc,
    conversation_id desc
  );

create index direct_conversation_states_director_unread_idx
  on public.direct_conversation_states (sporting_director_id)
  include (unread_count)
  where unread_count > 0;

create index direct_messages_conversation_created_idx
  on public.direct_messages (conversation_id, created_at desc, id desc);

create index direct_messages_recipient_created_idx
  on public.direct_messages (recipient_id, created_at desc, id desc);

create index direct_messages_sender_rate_idx
  on public.direct_messages (sender_id, created_at desc);

alter table public.direct_conversations enable row level security;
alter table public.direct_conversation_states enable row level security;
alter table public.direct_messages enable row level security;

create policy direct_messages_select_participant
on public.direct_messages
for select
to authenticated
using (
  exists (
    select 1
    from public.sporting_directors as viewer
    where viewer.auth_user_id = (select auth.uid())
      and viewer.status = 'active'
      and viewer.id in (
        direct_messages.sender_id,
        direct_messages.recipient_id
      )
  )
);

grant select on table public.direct_messages to authenticated;
grant all privileges on table public.direct_conversations to service_role;
grant all privileges on table public.direct_conversation_states to service_role;
grant all privileges on table public.direct_messages to service_role;

comment on table public.direct_conversations is
  'Conversations privées uniques entre deux Directeurs Sportifs.';
comment on table public.direct_conversation_states is
  'État de lecture pré-calculé de chaque participant, sans balayage des messages.';
comment on table public.direct_messages is
  'Messages privés persistants, lisibles uniquement par leurs deux participants.';

-- ============================================================
-- LISTE PAGINEE DES CONVERSATIONS
-- L'ordre vient directement de l'index par participant.
-- ============================================================

create or replace function public.get_current_direct_conversations(
  p_before_activity_at timestamptz default null,
  p_before_id uuid default null,
  p_limit integer default 21
)
returns table (
  conversation_id uuid,
  counterpart_director_id uuid,
  counterpart_display_name text,
  counterpart_avatar_key text,
  counterpart_avatar_frame_key text,
  counterpart_team_id uuid,
  counterpart_team_name text,
  last_message_body text,
  last_message_sender_id uuid,
  last_activity_at timestamptz,
  unread_count integer
)
language sql
stable
security definer
set search_path = ''
as $$
  with viewer as (
    select identity.sporting_director_id
    from public.get_current_global_chat_identity() as identity
  ),
  selected_states as materialized (
    select
      state.conversation_id,
      state.last_activity_at,
      state.unread_count
    from viewer
    join public.direct_conversation_states as state
      on state.sporting_director_id = viewer.sporting_director_id
    where (
      p_before_activity_at is null
      or state.last_activity_at < p_before_activity_at
      or (
        state.last_activity_at = p_before_activity_at
        and p_before_id is not null
        and state.conversation_id < p_before_id
      )
    )
    order by state.last_activity_at desc, state.conversation_id desc
    limit greatest(1, least(coalesce(p_limit, 21), 51))
  )
  select
    conversation.id,
    counterpart.id,
    counterpart.display_name,
    counterpart.avatar_key,
    counterpart.avatar_frame_key,
    assignment.team_id,
    coalesce(
      current_team_season.display_name,
      nullif(btrim(team.amateur_name), ''),
      team.internal_name,
      'Sans équipe'
    ),
    conversation.last_message_body,
    conversation.last_message_sender_id,
    selected_state.last_activity_at,
    selected_state.unread_count
  from viewer
  join selected_states as selected_state on true
  join public.direct_conversations as conversation
    on conversation.id = selected_state.conversation_id
  join public.sporting_directors as counterpart
    on counterpart.id = case
      when conversation.member_low_id = viewer.sporting_director_id
        then conversation.member_high_id
      else conversation.member_low_id
    end
  left join public.team_manager_assignments as assignment
    on assignment.sporting_director_id = counterpart.id
   and assignment.role = 'general_manager'
   and assignment.status = 'active'
  left join public.teams as team
    on team.id = assignment.team_id
   and team.status = 'active'
  left join lateral (
    select team_season.display_name
    from public.team_seasons as team_season
    where team_season.team_id = assignment.team_id
      and team_season.status in ('planned', 'active')
    order by
      case when team_season.status = 'active' then 0 else 1 end,
      team_season.created_at desc
    limit 1
  ) as current_team_season on true
  order by
    selected_state.last_activity_at desc,
    conversation.id desc;
$$;

create or replace function public.get_current_direct_conversation(
  p_conversation_id uuid
)
returns table (
  conversation_id uuid,
  counterpart_director_id uuid,
  counterpart_display_name text,
  counterpart_avatar_key text,
  counterpart_avatar_frame_key text,
  counterpart_team_id uuid,
  counterpart_team_name text,
  last_message_body text,
  last_message_sender_id uuid,
  last_activity_at timestamptz,
  unread_count integer
)
language sql
stable
security definer
set search_path = ''
as $$
  with viewer as (
    select identity.sporting_director_id
    from public.get_current_global_chat_identity() as identity
  )
  select
    conversation.id,
    counterpart.id,
    counterpart.display_name,
    counterpart.avatar_key,
    counterpart.avatar_frame_key,
    assignment.team_id,
    coalesce(
      current_team_season.display_name,
      nullif(btrim(team.amateur_name), ''),
      team.internal_name,
      'Sans équipe'
    ),
    conversation.last_message_body,
    conversation.last_message_sender_id,
    state.last_activity_at,
    state.unread_count
  from viewer
  join public.direct_conversation_states as state
    on state.sporting_director_id = viewer.sporting_director_id
   and state.conversation_id = p_conversation_id
  join public.direct_conversations as conversation
    on conversation.id = state.conversation_id
  join public.sporting_directors as counterpart
    on counterpart.id = case
      when conversation.member_low_id = viewer.sporting_director_id
        then conversation.member_high_id
      else conversation.member_low_id
    end
  left join public.team_manager_assignments as assignment
    on assignment.sporting_director_id = counterpart.id
   and assignment.role = 'general_manager'
   and assignment.status = 'active'
  left join public.teams as team
    on team.id = assignment.team_id
   and team.status = 'active'
  left join lateral (
    select team_season.display_name
    from public.team_seasons as team_season
    where team_season.team_id = assignment.team_id
      and team_season.status in ('planned', 'active')
    order by
      case when team_season.status = 'active' then 0 else 1 end,
      team_season.created_at desc
    limit 1
  ) as current_team_season on true;
$$;

-- ============================================================
-- OUVERTURE, ENVOI ET LECTURE
-- Toutes les écritures restent derrière des RPC authentifiées.
-- ============================================================

create or replace function public.get_or_create_current_direct_conversation(
  p_recipient_id uuid
)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_sender_id uuid;
  v_member_low_id uuid;
  v_member_high_id uuid;
  v_conversation_id uuid;
begin
  select identity.sporting_director_id
  into v_sender_id
  from public.get_current_global_chat_identity() as identity;

  if v_sender_id is null then
    raise exception 'Votre profil de Directeur Sportif est indisponible.';
  end if;

  if p_recipient_id is null or p_recipient_id = v_sender_id then
    raise exception 'Le destinataire de ce message privé est invalide.';
  end if;

  if not exists (
    select 1
    from public.sporting_directors as recipient
    join public.team_manager_assignments as assignment
      on assignment.sporting_director_id = recipient.id
     and assignment.role = 'general_manager'
     and assignment.status = 'active'
    join public.teams as team
      on team.id = assignment.team_id
     and team.status = 'active'
    where recipient.id = p_recipient_id
      and recipient.status = 'active'
      and not exists (
        select 1
        from public.alpha_bot_managers as bot
        where bot.sporting_director_id = recipient.id
      )
  ) then
    raise exception 'Ce Directeur Sportif ne peut pas recevoir de message privé.';
  end if;

  v_member_low_id := least(v_sender_id, p_recipient_id);
  v_member_high_id := greatest(v_sender_id, p_recipient_id);

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      v_member_low_id::text || ':' || v_member_high_id::text,
      0
    )
  );

  insert into public.direct_conversations (
    member_low_id,
    member_high_id
  ) values (
    v_member_low_id,
    v_member_high_id
  )
  on conflict (member_low_id, member_high_id) do update
  set updated_at = public.direct_conversations.updated_at
  returning id into v_conversation_id;

  insert into public.direct_conversation_states (
    conversation_id,
    sporting_director_id,
    last_read_at,
    last_activity_at
  ) values (
    v_conversation_id,
    v_sender_id,
    now(),
    now()
  )
  on conflict (conversation_id, sporting_director_id) do nothing;

  return v_conversation_id;
end;
$$;

create or replace function public.post_current_direct_message(
  p_conversation_id uuid,
  p_body text
)
returns public.direct_messages
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_sender_id uuid;
  v_recipient_id uuid;
  v_body text;
  v_result public.direct_messages;
begin
  select identity.sporting_director_id
  into v_sender_id
  from public.get_current_global_chat_identity() as identity;

  if v_sender_id is null then
    raise exception 'Votre profil de Directeur Sportif est indisponible.';
  end if;

  v_body := regexp_replace(btrim(coalesce(p_body, '')), '\s+', ' ', 'g');

  if char_length(v_body) not between 1 and 1000 then
    raise exception 'Le message doit contenir entre 1 et 1000 caractères.';
  end if;

  select case
    when conversation.member_low_id = v_sender_id
      then conversation.member_high_id
    when conversation.member_high_id = v_sender_id
      then conversation.member_low_id
    else null
  end
  into v_recipient_id
  from public.direct_conversations as conversation
  where conversation.id = p_conversation_id
  for update;

  if v_recipient_id is null then
    raise exception 'Cette conversation privée est inaccessible.';
  end if;

  if not exists (
    select 1
    from public.sporting_directors as recipient
    where recipient.id = v_recipient_id
      and recipient.status = 'active'
      and recipient.auth_user_id is not null
      and not exists (
        select 1
        from public.alpha_bot_managers as bot
        where bot.sporting_director_id = recipient.id
      )
  ) then
    raise exception 'Ce Directeur Sportif ne peut plus recevoir de message privé.';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_sender_id::text, 0)
  );

  if exists (
    select 1
    from public.direct_messages as recent_message
    where recent_message.sender_id = v_sender_id
      and recent_message.created_at > now() - interval '1 second'
  ) then
    raise exception 'Patientez un instant avant d’envoyer un nouveau message.';
  end if;

  if (
    select count(*)
    from public.direct_messages as recent_message
    where recent_message.sender_id = v_sender_id
      and recent_message.created_at > now() - interval '1 minute'
  ) >= 30 then
    raise exception 'Trop de messages ont été envoyés. Réessayez dans une minute.';
  end if;

  insert into public.direct_messages (
    conversation_id,
    sender_id,
    recipient_id,
    body
  ) values (
    p_conversation_id,
    v_sender_id,
    v_recipient_id,
    v_body
  )
  returning * into v_result;

  update public.direct_conversations as conversation
  set
    last_message_sender_id = v_sender_id,
    last_message_body = v_body,
    last_message_at = v_result.created_at,
    updated_at = v_result.created_at
  where conversation.id = p_conversation_id;

  insert into public.direct_conversation_states (
    conversation_id,
    sporting_director_id,
    unread_count,
    last_activity_at
  ) values (
    p_conversation_id,
    v_recipient_id,
    1,
    v_result.created_at
  )
  on conflict (conversation_id, sporting_director_id) do update
  set
    unread_count = public.direct_conversation_states.unread_count + 1,
    last_activity_at = excluded.last_activity_at;

  insert into public.direct_conversation_states (
    conversation_id,
    sporting_director_id,
    unread_count,
    last_read_at,
    last_activity_at
  ) values (
    p_conversation_id,
    v_sender_id,
    0,
    v_result.created_at,
    v_result.created_at
  )
  on conflict (conversation_id, sporting_director_id) do update
  set
    unread_count = 0,
    last_read_at = excluded.last_read_at,
    last_activity_at = excluded.last_activity_at;

  return v_result;
end;
$$;

create or replace function public.mark_current_direct_conversation_read(
  p_conversation_id uuid
)
returns integer
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_director_id uuid;
  v_cleared integer := 0;
begin
  select identity.sporting_director_id
  into v_director_id
  from public.get_current_global_chat_identity() as identity;

  if v_director_id is null then
    raise exception 'Votre profil de Directeur Sportif est indisponible.';
  end if;

  update public.direct_conversation_states as state
  set
    unread_count = 0,
    last_read_at = now()
  where state.conversation_id = p_conversation_id
    and state.sporting_director_id = v_director_id
  returning state.unread_count into v_cleared;

  return coalesce(v_cleared, 0);
end;
$$;

create or replace function public.get_current_unread_direct_message_count()
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(sum(state.unread_count), 0)::integer
  from public.direct_conversation_states as state
  join public.sporting_directors as director
    on director.id = state.sporting_director_id
  where director.auth_user_id = (select auth.uid())
    and state.unread_count > 0;
$$;

-- ============================================================
-- RECHERCHE A LA DEMANDE D'UN DESTINATAIRE
-- Aucun annuaire complet n'est chargé avec le chat.
-- ============================================================

create or replace function public.search_current_direct_message_recipients(
  p_query text,
  p_limit integer default 8
)
returns table (
  sporting_director_id uuid,
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
      greatest(1, least(coalesce(p_limit, 8), 12)) as result_limit
  ),
  viewer as (
    select identity.sporting_director_id
    from public.get_current_global_chat_identity() as identity
  ),
  candidates as (
    select
      director.id,
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
        when lower(director.display_name) = search_input.normalized_query
          or lower(coalesce(current_team_season.display_name, '')) = search_input.normalized_query
          then 0
        when left(lower(director.display_name), char_length(search_input.normalized_query)) = search_input.normalized_query
          or left(lower(coalesce(current_team_season.display_name, '')), char_length(search_input.normalized_query)) = search_input.normalized_query
          then 1
        else 2
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
    where char_length(search_input.normalized_query) >= 2
      and (
        strpos(lower(director.display_name), search_input.normalized_query) > 0
        or strpos(lower(director.username), search_input.normalized_query) > 0
        or strpos(
          lower(coalesce(current_team_season.display_name, team.amateur_name, team.internal_name)),
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
    candidate.display_name,
    candidate.avatar_key,
    candidate.avatar_frame_key,
    candidate.team_id,
    candidate.team_name
  from candidates as candidate
  order by candidate.match_rank, candidate.display_name, candidate.id
  limit (select result_limit from search_input);
$$;

-- ============================================================
-- INDICATEURS DU BANDEAU V2
-- Un seul aller-retour fournit aussi l'identité nécessaire au filtre Realtime.
-- ============================================================

create or replace function public.get_current_game_header_indicators_v2()
returns table (
  current_sporting_director_id uuid,
  mailbox_unread_count integer,
  direct_message_unread_count integer,
  has_unread_global_chat boolean,
  has_unread_cyclogazette boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    (
      select director.id
      from public.sporting_directors as director
      where director.auth_user_id = (select auth.uid())
        and director.status = 'active'
      limit 1
    ),
    public.get_current_director_unread_message_count(),
    public.get_current_unread_direct_message_count(),
    public.has_unread_global_chat_messages(),
    public.has_unread_cyclogazette_editions();
$$;

revoke all on function public.get_current_direct_conversations(timestamptz, uuid, integer)
  from public, anon;
revoke all on function public.get_current_direct_conversation(uuid)
  from public, anon;
revoke all on function public.get_or_create_current_direct_conversation(uuid)
  from public, anon;
revoke all on function public.post_current_direct_message(uuid, text)
  from public, anon;
revoke all on function public.mark_current_direct_conversation_read(uuid)
  from public, anon;
revoke all on function public.get_current_unread_direct_message_count()
  from public, anon;
revoke all on function public.search_current_direct_message_recipients(text, integer)
  from public, anon;
revoke all on function public.get_current_game_header_indicators_v2()
  from public, anon;

grant execute on function public.get_current_direct_conversations(timestamptz, uuid, integer)
  to authenticated, service_role;
grant execute on function public.get_current_direct_conversation(uuid)
  to authenticated, service_role;
grant execute on function public.get_or_create_current_direct_conversation(uuid)
  to authenticated, service_role;
grant execute on function public.post_current_direct_message(uuid, text)
  to authenticated, service_role;
grant execute on function public.mark_current_direct_conversation_read(uuid)
  to authenticated, service_role;
grant execute on function public.get_current_unread_direct_message_count()
  to authenticated, service_role;
grant execute on function public.search_current_direct_message_recipients(text, integer)
  to authenticated, service_role;
grant execute on function public.get_current_game_header_indicators_v2()
  to authenticated, service_role;

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'direct_messages'
  ) then
    alter publication supabase_realtime
      add table public.direct_messages;
  end if;
end;
$$;

comment on function public.post_current_direct_message(uuid, text) is
  'Envoie atomiquement un MP, met à jour les résumés et incrémente le compteur du seul destinataire.';
comment on function public.get_current_game_header_indicators_v2() is
  'Regroupe les indicateurs du bandeau, les MP non lus et l’identité du filtre Realtime.';

notify pgrst, 'reload schema';

commit;
