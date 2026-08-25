begin;

-- L’édition est un UPDATE ponctuel sur la clé primaire du message. Elle ne
-- crée ni polling, ni lecture supplémentaire dans le fil, ni nouvel index.
alter table public.global_chat_messages
  add column edited_at timestamptz,
  add constraint global_chat_messages_edited_after_creation check (
    edited_at is null or edited_at >= created_at
  );

alter table public.direct_messages
  add column edited_at timestamptz,
  add constraint direct_messages_edited_after_creation check (
    edited_at is null or edited_at >= created_at
  );

create or replace function public.edit_current_global_chat_message(
  p_message_id uuid,
  p_message text,
  p_preview_type text default null,
  p_preview_entity_identifier text default null
)
returns public.global_chat_messages
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_director_id uuid;
  v_message text;
  v_existing public.global_chat_messages;
  v_result public.global_chat_messages;
begin
  select identity.sporting_director_id
  into v_director_id
  from public.get_current_global_chat_identity() as identity;

  if v_director_id is null then
    raise exception 'Votre profil de Directeur Sportif est indisponible.';
  end if;

  select message.*
  into v_existing
  from public.global_chat_messages as message
  where message.id = p_message_id
  for update;

  if not found or v_existing.sporting_director_id <> v_director_id then
    raise exception 'Vous ne pouvez modifier que vos propres messages.';
  end if;

  if clock_timestamp() > v_existing.created_at + interval '15 minutes' then
    raise exception 'Ce message ne peut plus être modifié après 15 minutes.';
  end if;

  v_message := regexp_replace(
    btrim(coalesce(p_message, '')),
    '\s+',
    ' ',
    'g'
  );

  if char_length(v_message) not between 1 and 500 then
    raise exception 'Le message doit contenir entre 1 et 500 caractères.';
  end if;

  -- Une mini-fiche est un instantané calculé à l’envoi. L’édition corrige le
  -- texte mais ne peut pas la remplacer silencieusement par une autre fiche.
  if v_existing.preview_type is null then
    if p_preview_type is not null
      or v_message ~* '/jeu/(equipes|coureurs|directeurs-sportifs)/'
    then
      raise exception 'Le lien partagé ne peut pas être ajouté ou remplacé pendant l’édition.';
    end if;
  elsif v_existing.preview_type in ('team', 'rider') then
    if p_preview_type is distinct from v_existing.preview_type
      or lower(coalesce(p_preview_entity_identifier, ''))
        <> v_existing.preview_entity_id::text
      or strpos(
        lower(v_message),
        '/jeu/' || case
          when v_existing.preview_type = 'team' then 'equipes'
          else 'coureurs'
        end || '/' || v_existing.preview_entity_id::text
      ) = 0
    then
      raise exception 'Le lien partagé ne peut pas être ajouté ou remplacé pendant l’édition.';
    end if;
  elsif v_existing.preview_type = 'director' then
    if p_preview_type is distinct from 'director'
      or lower(coalesce(p_preview_entity_identifier, '')) not in (
        lower(coalesce(v_existing.preview_public_identifier, '')),
        v_existing.preview_entity_id::text
      )
      or strpos(lower(v_message), '/jeu/directeurs-sportifs/') = 0
    then
      raise exception 'Le lien partagé ne peut pas être ajouté ou remplacé pendant l’édition.';
    end if;
  end if;

  if v_message = v_existing.message then
    return v_existing;
  end if;

  update public.global_chat_messages as message
  set
    message = v_message,
    edited_at = clock_timestamp()
  where message.id = v_existing.id
  returning message.* into v_result;

  -- Une mention supprimée du texte ne reste pas attachée au message. Ajouter
  -- une nouvelle mention lors d’une correction ne renvoie pas de notification.
  delete from public.global_chat_mentions as mention
  using public.sporting_directors as director
  where mention.message_id = v_existing.id
    and director.id = mention.mentioned_sporting_director_id
    and strpos(lower(v_message), '@' || lower(director.username)) = 0;

  return v_result;
end;
$$;

create or replace function public.edit_current_direct_message(
  p_message_id uuid,
  p_body text
)
returns public.direct_messages
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_director_id uuid;
  v_body text;
  v_existing public.direct_messages;
  v_result public.direct_messages;
begin
  select identity.sporting_director_id
  into v_director_id
  from public.get_current_global_chat_identity() as identity;

  if v_director_id is null then
    raise exception 'Votre profil de Directeur Sportif est indisponible.';
  end if;

  select message.*
  into v_existing
  from public.direct_messages as message
  where message.id = p_message_id
  for update;

  if not found or v_existing.sender_id <> v_director_id then
    raise exception 'Vous ne pouvez modifier que vos propres messages privés.';
  end if;

  if clock_timestamp() > v_existing.created_at + interval '15 minutes' then
    raise exception 'Ce message privé ne peut plus être modifié après 15 minutes.';
  end if;

  v_body := regexp_replace(btrim(coalesce(p_body, '')), '\s+', ' ', 'g');
  if char_length(v_body) not between 1 and 1000 then
    raise exception 'Le message doit contenir entre 1 et 1000 caractères.';
  end if;

  if v_body = v_existing.body then
    return v_existing;
  end if;

  update public.direct_messages as message
  set
    body = v_body,
    edited_at = clock_timestamp()
  where message.id = v_existing.id
  returning message.* into v_result;

  -- La liste des conversations conserve son aperçu pré-calculé lorsque le
  -- message corrigé est encore le dernier de la discussion.
  update public.direct_conversations as conversation
  set last_message_body = v_body
  where conversation.id = v_existing.conversation_id
    and conversation.last_message_sender_id = v_existing.sender_id
    and conversation.last_message_at = v_existing.created_at;

  return v_result;
end;
$$;

revoke all on function public.edit_current_global_chat_message(
  uuid, text, text, text
)
from public, anon;
revoke all on function public.edit_current_direct_message(uuid, text)
from public, anon;

grant execute on function public.edit_current_global_chat_message(
  uuid, text, text, text
)
to authenticated, service_role;
grant execute on function public.edit_current_direct_message(uuid, text)
to authenticated, service_role;

comment on column public.global_chat_messages.edited_at is
  'Date de la dernière correction effectuée par l’auteur dans les 15 minutes.';
comment on column public.direct_messages.edited_at is
  'Date de la dernière correction effectuée par l’expéditeur dans les 15 minutes.';
comment on function public.edit_current_global_chat_message(
  uuid, text, text, text
) is
  'Corrige un message général appartenant au DS connecté, sans recalcul du fil.';
comment on function public.edit_current_direct_message(uuid, text) is
  'Corrige un MP appartenant au DS connecté et son aperçu s’il est le plus récent.';

notify pgrst, 'reload schema';

commit;
