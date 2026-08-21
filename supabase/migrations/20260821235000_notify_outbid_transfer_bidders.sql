begin;

-- Une surenchère produit d'abord un courrier privé dans la boîte du DS.
-- Le pipeline Web Push existant transforme ensuite ce courrier en notification
-- téléphone/PC, tout en respectant les heures silencieuses configurées.

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
      'infrastructure_completed'
    )
  );

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
    when new.source_reference like 'scouting-report:%'
      then 'scouting_completed'
    when new.source_reference like 'infrastructure:%'
      then 'infrastructure_completed'
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

create or replace function public.notify_outbid_transfer_bidder()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_previous_bid public.transfer_market_bids%rowtype;
  v_listing public.transfer_market_listings%rowtype;
  v_rider_name text;
  v_team_season_id uuid;
  v_action_href text;
  v_previous_amount text;
  v_new_amount text;
begin
  select bid.*
  into v_previous_bid
  from public.transfer_market_bids as bid
  where bid.listing_id = new.listing_id
    and bid.id <> new.id
  order by bid.amount desc, bid.created_at asc, bid.id asc
  limit 1;

  if v_previous_bid is null
    or v_previous_bid.team_id = new.team_id
  then
    return new;
  end if;

  select listing.*
  into v_listing
  from public.transfer_market_listings as listing
  where listing.id = new.listing_id;

  if v_listing is null then
    return new;
  end if;

  if not exists (
    select 1
    from public.sporting_directors as director
    where director.id = v_previous_bid.sporting_director_id
      and director.status = 'active'
  ) then
    return new;
  end if;

  select concat_ws(' ', rider.first_name, rider.last_name)
  into v_rider_name
  from public.riders as rider
  where rider.id = v_listing.rider_id;

  select team_season.id
  into v_team_season_id
  from public.team_seasons as team_season
  where team_season.team_id = v_previous_bid.team_id
    and team_season.season_id = v_listing.season_id
  limit 1;

  v_action_href := '/jeu/transferts?onglet=' ||
    case
      when v_listing.listing_type = 'daily' then 'quotidiennes'
      else 'directeurs'
    end || '#enchere-' || v_listing.id::text;
  v_previous_amount := v_previous_bid.amount::numeric(14, 0)::text ||
    ' ' || v_listing.currency_code;
  v_new_amount := new.amount::numeric(14, 0)::text ||
    ' ' || v_listing.currency_code;

  insert into public.sporting_director_messages (
    sporting_director_id,
    season_id,
    team_season_id,
    message_type,
    sender_name,
    subject,
    preview,
    body,
    action_href,
    action_label,
    source_reference,
    is_important,
    sent_at
  ) values (
    v_previous_bid.sporting_director_id,
    v_listing.season_id,
    v_team_season_id,
    'system',
    'Bureau des transferts',
    'Vous n’êtes plus en tête pour ' || v_rider_name,
    'Une offre de ' || v_new_amount || ' est désormais en tête.',
    format(
      'Une autre équipe a surenchéri sur %s. Votre offre de %s n’est plus la meilleure : la nouvelle enchère atteint %s.%s%sEnchérissez à nouveau avant la clôture si vous souhaitez toujours recruter ce coureur.',
      v_rider_name,
      v_previous_amount,
      v_new_amount,
      E'\n',
      E'\n'
    ),
    v_action_href,
    'Enchérir à nouveau',
    'transfer-auction-outbid:' || new.id::text,
    true,
    now()
  )
  on conflict (sporting_director_id, source_reference) do nothing;

  return new;
end;
$$;

drop trigger if exists transfer_market_bids_notify_outbid
  on public.transfer_market_bids;
create trigger transfer_market_bids_notify_outbid
after insert on public.transfer_market_bids
for each row execute function public.notify_outbid_transfer_bidder();

revoke all on function public.enqueue_director_mailbox_push()
  from public, anon, authenticated;
revoke all on function public.notify_outbid_transfer_bidder()
  from public, anon, authenticated;

notify pgrst, 'reload schema';

commit;
