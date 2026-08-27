begin;

-- Keep the existing event families and add the missing high-value inbox and
-- private-message events. The outbox remains deduplicated per user/event.
alter table public.push_notification_outbox
  drop constraint if exists push_notification_outbox_event_type_allowed;

alter table public.push_notification_outbox
  add constraint push_notification_outbox_event_type_allowed check (
    event_type in (
      'race_live_started',
      'transfer_offer_received',
      'transfer_offer_answered',
      'transfer_bid_outbid',
      'transfer_auction_won',
      'direct_message_received',
      'director_mail_important',
      'cyclogazette_published',
      'scouting_completed',
      'infrastructure_completed',
      'global_chat_mention'
    )
  );

-- Existing transfer, scouting and infrastructure messages keep their precise
-- event type. Auction victories are now pushed too; every other mail must be
-- explicitly marked important, which excludes routine race-result mail.
create or replace function public.enqueue_director_mailbox_push()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_auth_user_id uuid;
  v_event_type text;
begin
  v_event_type := case
    when new.source_reference like 'direct-transfer-offer:%:received'
      then 'transfer_offer_received'
    when new.source_reference like 'direct-transfer-offer:%:accepted'
      or new.source_reference like 'direct-transfer-offer:%:rejected'
      then 'transfer_offer_answered'
    when new.source_reference like 'transfer-auction-outbid:%'
      then 'transfer_bid_outbid'
    when new.source_reference like 'transfer-auction-won:%'
      then 'transfer_auction_won'
    when new.source_reference like 'scouting-report:%'
      then 'scouting_completed'
    when new.source_reference like 'infrastructure:%'
      then 'infrastructure_completed'
    when new.is_important
      then 'director_mail_important'
    else null
  end;

  if v_event_type is null then
    return new;
  end if;

  select director.auth_user_id
  into v_auth_user_id
  from public.sporting_directors as director
  where director.id = new.sporting_director_id
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
    v_event_type,
    'mailbox:' || new.source_reference,
    left(new.subject, 120),
    left(new.preview, 240),
    coalesce(new.action_href, '/jeu/messagerie'),
    public.get_next_decent_push_delivery_at(coalesce(new.sent_at, now()))
  )
  on conflict (auth_user_id, event_key) do nothing;

  return new;
end;
$$;

-- A private message receives its own push and opens the relevant conversation.
-- The sender text is intentionally capped by the outbox limits and quiet hours
-- remain centralized in get_next_decent_push_delivery_at.
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

drop trigger if exists direct_messages_enqueue_push
  on public.direct_messages;
create trigger direct_messages_enqueue_push
after insert on public.direct_messages
for each row execute function public.enqueue_direct_message_push();

revoke all on function public.enqueue_director_mailbox_push()
  from public, anon, authenticated;
revoke all on function public.enqueue_direct_message_push()
  from public, anon, authenticated;

notify pgrst, 'reload schema';

commit;
