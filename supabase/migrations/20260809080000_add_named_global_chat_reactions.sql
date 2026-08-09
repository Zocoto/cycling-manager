begin;

create table if not exists public.global_chat_message_reactions (
  message_id uuid not null
    references public.global_chat_messages(id)
    on delete cascade,
  sporting_director_id uuid not null
    references public.sporting_directors(id)
    on delete cascade,
  reactor_display_name text not null,
  team_id uuid not null
    references public.teams(id)
    on delete cascade,
  team_display_name text not null,
  emoji text not null,
  created_at timestamptz not null default now(),

  primary key (message_id, sporting_director_id, emoji),
  constraint global_chat_message_reactions_reactor_not_empty
    check (btrim(reactor_display_name) <> ''),
  constraint global_chat_message_reactions_team_not_empty
    check (btrim(team_display_name) <> ''),
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
  v_display_name text;
  v_team_id uuid;
  v_team_name text;
begin
  select
    identity.sporting_director_id,
    identity.display_name,
    identity.team_id,
    identity.team_name
  into
    v_director_id,
    v_display_name,
    v_team_id,
    v_team_name
  from public.get_current_global_chat_identity() as identity
  limit 1;

  if v_director_id is null or v_team_id is null then
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
    reactor_display_name,
    team_id,
    team_display_name,
    emoji
  ) values (
    p_message_id,
    v_director_id,
    v_display_name,
    v_team_id,
    v_team_name,
    p_emoji
  );

  return true;
end;
$$;

revoke all on function public.toggle_global_chat_message_reaction(uuid, text)
from public, anon;

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
  'Réactions émojis des Directeurs Sportifs, avec identité publique affichable dans le chat.';

comment on function public.toggle_global_chat_message_reaction(uuid, text) is
  'Ajoute ou retire atomiquement une réaction et enregistre le nom public du membre et de son équipe.';

commit;
