begin;

-- Les offres de transfert deviennent des événements métier visibles dans le
-- fil privé. Leur nature et leur référence les rendent immuables et
-- idempotentes sans alourdir les messages ordinaires.
alter table public.direct_messages
  add column if not exists message_type text not null default 'user',
  add column if not exists source_reference text;

alter table public.direct_messages
  drop constraint if exists direct_messages_type_allowed,
  add constraint direct_messages_type_allowed
    check (message_type in ('user', 'transfer_offer')),
  drop constraint if exists direct_messages_source_reference_not_empty,
  add constraint direct_messages_source_reference_not_empty
    check (source_reference is null or btrim(source_reference) <> '');

create unique index if not exists direct_messages_source_reference_unique_idx
  on public.direct_messages (source_reference)
  where source_reference is not null;

comment on column public.direct_messages.message_type is
  'Nature du message : saisie libre ou événement officiel d’offre de transfert.';
comment on column public.direct_messages.source_reference is
  'Clé métier idempotente des messages générés automatiquement.';

create or replace function public.submit_direct_transfer_offer_with_message(
  p_rider_id uuid,
  p_amount numeric,
  p_message text default null
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_offer_id uuid;
  v_offer public.direct_transfer_offers%rowtype;
  v_seller_director_id uuid;
  v_seller_is_human boolean := false;
  v_buyer_team_name text;
  v_rider_name text;
  v_custom_message text;
  v_body text;
  v_conversation_id uuid;
  v_direct_message public.direct_messages;
begin
  v_custom_message := replace(
    replace(btrim(coalesce(p_message, '')), E'\r\n', E'\n'),
    E'\r',
    E'\n'
  );
  v_custom_message := regexp_replace(v_custom_message, E'[\t ]+', ' ', 'g');
  v_custom_message := regexp_replace(v_custom_message, E'\n[\t ]+', E'\n', 'g');
  v_custom_message := regexp_replace(v_custom_message, E'\n{3,}', E'\n\n', 'g');

  if char_length(v_custom_message) > 500 then
    raise exception 'Le message ne peut pas dépasser 500 caractères.';
  end if;

  -- La fonction historique conserve toute la validation financière et
  -- contractuelle. Appelée ici, elle reste dans la même transaction.
  v_offer_id := public.submit_direct_transfer_offer(p_rider_id, p_amount);

  select offer.*
  into v_offer
  from public.direct_transfer_offers as offer
  where offer.id = v_offer_id;

  select
    director.id,
    director.auth_user_id is not null
      and not exists (
        select 1
        from public.alpha_bot_managers as bot
        where bot.sporting_director_id = director.id
      )
  into v_seller_director_id, v_seller_is_human
  from public.team_manager_assignments as assignment
  join public.sporting_directors as director
    on director.id = assignment.sporting_director_id
   and director.status = 'active'
  where assignment.team_id = v_offer.seller_team_id
    and assignment.role = 'general_manager'
    and assignment.status = 'active'
  limit 1;

  -- Les équipes automatisées continuent d’utiliser le flux historique sans
  -- créer une conversation privée sans destinataire humain.
  if v_seller_director_id is null or not v_seller_is_human then
    return jsonb_build_object(
      'offerId', v_offer_id,
      'conversationId', null
    );
  end if;

  select team_season.display_name
  into v_buyer_team_name
  from public.team_seasons as team_season
  where team_season.team_id = v_offer.buyer_team_id
    and team_season.season_id = v_offer.season_id
  limit 1;

  select concat_ws(' ', rider.first_name, rider.last_name)
  into v_rider_name
  from public.riders as rider
  where rider.id = v_offer.rider_id;

  v_conversation_id := public.get_or_create_current_direct_conversation(
    v_seller_director_id
  );

  v_body :=
    '💼 ' || coalesce(v_buyer_team_name, 'Une équipe') ||
    ' propose ' || v_offer.offered_amount::bigint::text || ' ' ||
    v_offer.currency_code || ' pour ' || coalesce(v_rider_name, 'ce coureur') ||
    '.' ||
    case
      when v_custom_message <> ''
        then E'\n\nMessage du DS :\n' || v_custom_message
      else ''
    end ||
    E'\n\nVoir la fiche du coureur : /jeu/coureurs/' ||
    v_offer.rider_id::text;

  if char_length(v_body) > 1000 then
    raise exception 'Le message associé à cette offre est trop long.';
  end if;

  insert into public.direct_messages (
    conversation_id,
    sender_id,
    recipient_id,
    body,
    message_type,
    source_reference
  ) values (
    v_conversation_id,
    v_offer.submitted_by_director_id,
    v_seller_director_id,
    v_body,
    'transfer_offer',
    'direct-transfer-offer:' || v_offer_id::text || ':chat'
  )
  returning * into v_direct_message;

  update public.direct_conversations as conversation
  set
    last_message_sender_id = v_offer.submitted_by_director_id,
    last_message_body = v_body,
    last_message_at = v_direct_message.created_at,
    updated_at = v_direct_message.created_at
  where conversation.id = v_conversation_id;

  insert into public.direct_conversation_states (
    conversation_id,
    sporting_director_id,
    unread_count,
    last_activity_at
  ) values (
    v_conversation_id,
    v_seller_director_id,
    1,
    v_direct_message.created_at
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
    v_conversation_id,
    v_offer.submitted_by_director_id,
    0,
    v_direct_message.created_at,
    v_direct_message.created_at
  )
  on conflict (conversation_id, sporting_director_id) do update
  set
    unread_count = 0,
    last_read_at = excluded.last_read_at,
    last_activity_at = excluded.last_activity_at;

  return jsonb_build_object(
    'offerId', v_offer_id,
    'conversationId', v_conversation_id
  );
end;
$$;

-- Un événement d’offre bénéficie déjà de la notification métier qui mène au
-- bureau des transferts. Le fil privé est mis à jour sans seconde push.
create or replace function public.enqueue_direct_message_push()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_auth_user_id uuid;
  v_sender_display_name text;
begin
  if new.message_type = 'transfer_offer' then
    return new;
  end if;

  select recipient.auth_user_id, sender.display_name
  into v_auth_user_id, v_sender_display_name
  from public.sporting_directors as recipient
  join public.sporting_directors as sender
    on sender.id = new.sender_id
  where recipient.id = new.recipient_id
    and recipient.status = 'active';

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
    'direct_message_received',
    'direct-message:' || new.id::text,
    left(
      'Message privé de ' || coalesce(
        nullif(btrim(v_sender_display_name), ''),
        'un Directeur Sportif'
      ),
      120
    ),
    left(new.body, 240),
    '/jeu/chat?mp=' || new.sender_id::text,
    public.get_next_decent_push_delivery_at(new.created_at)
  )
  on conflict (auth_user_id, event_key) do nothing;

  return new;
end;
$$;

-- Les entrées métier ne peuvent pas être réécrites comme un simple MP.
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
  if v_existing.message_type <> 'user' then
    raise exception 'Une offre de transfert enregistrée ne peut pas être modifiée.';
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

  update public.direct_conversations as conversation
  set last_message_body = v_body
  where conversation.id = v_existing.conversation_id
    and conversation.last_message_sender_id = v_existing.sender_id
    and conversation.last_message_at = v_existing.created_at;

  return v_result;
end;
$$;

-- Les clients doivent obligatoirement passer par la version transactionnelle
-- qui alimente le chat. La version historique reste privée pour être réutilisée
-- par cette fonction sans dupliquer les validations métier.
revoke execute on function public.submit_direct_transfer_offer(uuid, numeric)
  from authenticated;
revoke all on function public.submit_direct_transfer_offer_with_message(
  uuid, numeric, text
) from public, anon;
grant execute on function public.submit_direct_transfer_offer_with_message(
  uuid, numeric, text
) to authenticated, service_role;

notify pgrst, 'reload schema';

commit;
