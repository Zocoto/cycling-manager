begin;

alter table public.global_chat_messages
  add column if not exists reply_to_message_id uuid
    references public.global_chat_messages(id)
    on delete set null,
  add column if not exists reply_to_author_display_name text,
  add column if not exists reply_to_message_excerpt text;

alter table public.global_chat_messages
  drop constraint if exists global_chat_messages_reply_complete;

alter table public.global_chat_messages
  add constraint global_chat_messages_reply_complete
  check (
    (
      reply_to_message_id is null
      and reply_to_author_display_name is null
      and reply_to_message_excerpt is null
    )
    or (
      btrim(coalesce(reply_to_author_display_name, '')) <> ''
      and btrim(coalesce(reply_to_message_excerpt, '')) <> ''
    )
  );

create index if not exists global_chat_messages_reply_idx
  on public.global_chat_messages (reply_to_message_id)
  where reply_to_message_id is not null;

create table if not exists public.global_chat_message_reactions (
  message_id uuid not null
    references public.global_chat_messages(id)
    on delete cascade,
  sporting_director_id uuid not null
    references public.sporting_directors(id)
    on delete cascade,
  emoji text not null,
  created_at timestamptz not null default now(),

  primary key (message_id, sporting_director_id, emoji),
  constraint global_chat_message_reactions_emoji_allowed
    check (
      emoji in (
        '👍', '❤️', '😂', '😮', '👏', '🔥',
        '😢', '😡', '🎉', '🤝', '🚴', '🏆'
      )
    )
);

create index if not exists global_chat_message_reactions_message_idx
  on public.global_chat_message_reactions (message_id, created_at);

alter table public.global_chat_message_reactions enable row level security;

drop policy if exists global_chat_message_reactions_select_authenticated
  on public.global_chat_message_reactions;

create policy global_chat_message_reactions_select_authenticated
on public.global_chat_message_reactions
for select
to authenticated
using (true);

grant select on table public.global_chat_message_reactions
to authenticated, service_role;

grant all on table public.global_chat_message_reactions
to service_role;

create or replace function public.post_global_chat_message_v2(
  p_message text,
  p_preview_type text default null,
  p_preview_entity_id uuid default null,
  p_reply_to_message_id uuid default null
)
returns public.global_chat_messages
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_reply_author text;
  v_reply_excerpt text;
  v_result public.global_chat_messages;
begin
  if p_reply_to_message_id is not null then
    select
      message.author_display_name,
      left(
        btrim(
          regexp_replace(
            message.message,
            '\[cycling-reaction:[^]]+\]',
            '',
            'gi'
          )
        ),
        180
      )
    into v_reply_author, v_reply_excerpt
    from public.global_chat_messages as message
    where message.id = p_reply_to_message_id;

    if not found then
      raise exception 'Le message auquel vous répondez n’existe plus.';
    end if;

    if coalesce(v_reply_excerpt, '') = '' then
      v_reply_excerpt := 'Réaction cycliste';
    end if;
  end if;

  v_result := public.post_global_chat_message(
    p_message,
    p_preview_type,
    p_preview_entity_id
  );

  if p_reply_to_message_id is not null then
    update public.global_chat_messages
    set
      reply_to_message_id = p_reply_to_message_id,
      reply_to_author_display_name = v_reply_author,
      reply_to_message_excerpt = v_reply_excerpt
    where id = v_result.id
    returning * into v_result;
  end if;

  return v_result;
end;
$$;

create or replace function public.toggle_global_chat_message_reaction(
  p_message_id uuid,
  p_emoji text
)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_director_id uuid;
begin
  select identity.sporting_director_id
  into v_director_id
  from public.get_current_global_chat_identity() as identity
  limit 1;

  if v_director_id is null then
    raise exception 'Vous devez diriger une équipe active pour réagir.';
  end if;

  if p_emoji is null or p_emoji not in (
    '👍', '❤️', '😂', '😮', '👏', '🔥',
    '😢', '😡', '🎉', '🤝', '🚴', '🏆'
  ) then
    raise exception 'Cette réaction n’est pas autorisée.';
  end if;

  if not exists (
    select 1
    from public.global_chat_messages as message
    where message.id = p_message_id
  ) then
    raise exception 'Ce message n’existe plus.';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      p_message_id::text || ':' || v_director_id::text || ':' || p_emoji,
      0
    )
  );

  delete from public.global_chat_message_reactions
  where message_id = p_message_id
    and sporting_director_id = v_director_id
    and emoji = p_emoji;

  if found then
    return false;
  end if;

  insert into public.global_chat_message_reactions (
    message_id,
    sporting_director_id,
    emoji
  ) values (
    p_message_id,
    v_director_id,
    p_emoji
  );

  return true;
end;
$$;

revoke all on function public.post_global_chat_message_v2(text, text, uuid, uuid)
from public, anon;
revoke all on function public.toggle_global_chat_message_reaction(uuid, text)
from public, anon;

grant execute on function public.post_global_chat_message_v2(text, text, uuid, uuid)
to authenticated, service_role;
grant execute on function public.toggle_global_chat_message_reaction(uuid, text)
to authenticated, service_role;

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'global_chat_message_reactions'
  ) then
    alter publication supabase_realtime
      add table public.global_chat_message_reactions;
  end if;
end;
$$;

comment on table public.global_chat_message_reactions is
  'Réactions émojis uniques des Directeurs Sportifs sur les messages du chat général.';

comment on function public.post_global_chat_message_v2(text, text, uuid, uuid) is
  'Publie un message global avec un éventuel aperçu interne et une réponse citée durable.';

comment on function public.toggle_global_chat_message_reaction(uuid, text) is
  'Ajoute ou retire atomiquement une réaction émoji du Directeur Sportif connecté.';

commit;
