begin;
set local application_name = 'codex-chat-klipy-migration';
set local lock_timeout = '3s';
set local statement_timeout = '20s';

alter table public.global_chat_messages
  add column gif_attachment jsonb,
  add column gif_request_id uuid;

create function public.is_valid_global_chat_gif(g jsonb)
returns boolean language sql immutable set search_path = '' as $$
  select coalesce(
    pg_catalog.jsonb_typeof(g) = 'object' and pg_catalog.pg_column_size(g) <= 8192
    and g->>'provider' = 'klipy' and g->>'kind' in ('gif', 'meme')
    and pg_catalog.jsonb_typeof(g->'id') = 'string' and g->>'id' ~ '^[A-Za-z0-9_-]{1,80}$'
    and pg_catalog.jsonb_typeof(g->'slug') = 'string' and g->>'slug' ~ '^[A-Za-z0-9_-]{1,180}$'
    and pg_catalog.jsonb_typeof(g->'title') = 'string' and length(btrim(g->>'title')) between 1 and 200
    and pg_catalog.jsonb_typeof(g->'url') = 'string' and length(g->>'url') <= 2048
    and g->>'url' ~ '^https://static[12]?[.]klipy[.]com/[^[:space:]<>#]*$'
    and pg_catalog.jsonb_typeof(g->'previewUrl') = 'string' and length(g->>'previewUrl') <= 2048
    and g->>'previewUrl' ~ '^https://static[12]?[.]klipy[.]com/[^[:space:]<>#]*$'
    and pg_catalog.jsonb_typeof(g->'width') = 'number' and g->>'width' ~ '^[0-9]{1,4}$'
    and (g->>'width')::integer between 1 and 2048
    and pg_catalog.jsonb_typeof(g->'height') = 'number' and g->>'height' ~ '^[0-9]{1,4}$'
    and (g->>'height')::integer between 1 and 2048, false);
$$;

alter table public.global_chat_messages add constraint global_chat_gif_valid check (
  (gif_attachment is null and gif_request_id is null)
  or (gif_request_id is not null and public.is_valid_global_chat_gif(gif_attachment) and image_path is null)
) not valid;

create unique index global_chat_gif_request_idx
  on public.global_chat_messages(sporting_director_id, gif_request_id) where gif_request_id is not null;

create function public.post_global_chat_gif_message(
  p_message text, p_gif jsonb, p_request_id uuid,
  p_reply_to_message_id uuid default null,
  p_mentioned_sporting_director_ids uuid[] default array[]::uuid[]
) returns public.global_chat_messages language plpgsql security definer set search_path = '' as $$
declare v_result public.global_chat_messages; v_director_id uuid;
begin
  if auth.uid() is null then raise exception 'Vous devez être connecté pour partager un GIF.'; end if;
  if p_request_id is null or not public.is_valid_global_chat_gif(p_gif) then
    raise exception 'Ce GIF est invalide.';
  end if;
  select sporting_director_id into v_director_id from public.get_current_global_chat_identity() limit 1;
  if v_director_id is null then raise exception 'Vous devez diriger une équipe active pour partager un GIF.'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('chat-gif:' || auth.uid()::text || ':' || p_request_id::text, 0));
  select * into v_result from public.global_chat_messages where sporting_director_id=v_director_id and gif_request_id=p_request_id;
  if found then return v_result; end if;
  -- Delegate identity, replies, mentions, link restrictions and anti-spam to
  -- the existing message pipeline; attach metadata in the SAME transaction.
  v_result := public.post_global_chat_message_v4(
    coalesce(nullif(btrim(p_message), ''), 'GIF joint'), null, null,
    p_reply_to_message_id, p_mentioned_sporting_director_ids
  );
  update public.global_chat_messages set gif_attachment=p_gif, gif_request_id=p_request_id
    where id=v_result.id returning * into v_result;
  return v_result;
end; $$;

revoke all on function public.post_global_chat_gif_message(text,jsonb,uuid,uuid,uuid[]) from public, anon;
grant execute on function public.post_global_chat_gif_message(text,jsonb,uuid,uuid,uuid[]) to authenticated, service_role;

create function public.is_allowed_global_chat_reaction(p_emoji text)
returns boolean language sql immutable set search_path = '' as $$
  select coalesce(p_emoji = any(array['😀','😃','😄','😁','😆','😅','😂','🤣','🙂','🙃','😉','😊','😇','🥰','😍','🤩','😘','😋','😛','😜','🤪','😎','🥸','🤓','🧐','🤔','🤨','😐','😑','😶','🙄','😏','😬','🤐','😴','🥱','😮','😯','😲','😳','🥹','🥺','😢','😭','😤','😠','😡','🤯','😱','😨','😰','😥','😓','🤗','🤭','🫢','🫣','🤫','🫡','🫠','🤤','🤒','🤕','🤢','🤮','🤧','🥵','🥶','😵','😵‍💫','🥴','😈','👿','👻','💀','🤖','💩','👍','👎','👏','🙌','👐','🤲','🤝','🙏','💪','🦵','👊','✊','🤛','🤜','🤞','✌️','🤟','🤘','👌','🤌','🤏','👋','🤚','🖐️','✋','🖖','🫶','☝️','👆','👇','👈','👉','✍️','🫵','❤️','🧡','💛','💚','💙','💜','🖤','🤍','🤎','🩷','🩵','🩶','💔','❤️‍🔥','💕','💖','💗','💓','💞','💘','💝','💯','🔥','✨','⭐','🌟','💫','⚡','🎉','🎊','🥳','🎈','🎁','🎂','🍾','🥂','🚴','🚴‍♂️','🚴‍♀️','🚵','🚵‍♂️','🚵‍♀️','🚲','🏁','🏆','🥇','🥈','🥉','🎖️','🏅','⏱️','⏰','🛠️','⚙️','🩹','🚑','💨','🚀','🏔️','⛰️','🌄','🛣️','🌍','☀️','🌤️','🌧️','⛈️','❄️','🌬️','☔','💧','🔋','🪫','🎯','💥','👀','💤','🍌','🍎','🍊','🍋','🍉','🍓','🍒','🥑','🥕','🥖','🥐','🥨','🧀','🍕','🍔','🍟','🌭','🍝','🍚','🍫','🍪','🍩','🍯','🍼','🥤','☕','🍵','🍺','🐶','🐱','🦊','🐻','🐼','🐸','🦁','🐯','🐷','🐗','🐵','🦆','🦉','🐝','🦋','🐢','🐌','🦄','✅','❌','❎','✔️','❗','❓','⁉️','‼️','⛔','🚫','⚠️','🆘','🆗','🆒','🆕','🆙','🔝','🔜','🔙','🔄','🔁','➕','➖','➡️','⬅️','⬆️','⬇️','📈','📉','💰','💸','💎','🧠','🗣️','💬','📣','🤷','🤦','🙋','🙅','🙆','🤷‍♂️','🤷‍♀️','🤦‍♂️','🤦‍♀️' ]::text[]), false);
$$;

alter table public.global_chat_message_reactions drop constraint global_chat_message_reactions_emoji_allowed;
alter table public.global_chat_message_reactions add constraint global_chat_message_reactions_emoji_allowed
  check(public.is_allowed_global_chat_reaction(emoji)) not valid;

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

  if not public.is_allowed_global_chat_reaction(p_emoji) then
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

notify pgrst, 'reload schema';
commit;
