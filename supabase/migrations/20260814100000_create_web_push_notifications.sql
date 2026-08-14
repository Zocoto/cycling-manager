begin;

-- ============================================================
-- ABONNEMENTS WEB PUSH PAR APPAREIL
-- Les cles privees VAPID restent exclusivement cote serveur.
-- ============================================================

create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth_key text not null,
  user_agent text,
  is_active boolean not null default true,
  failure_count smallint not null default 0,
  last_success_at timestamptz,
  disabled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint push_subscriptions_endpoint_valid check (
    endpoint like 'https://%' and char_length(endpoint) between 20 and 2048
  ),
  constraint push_subscriptions_keys_present check (
    char_length(p256dh) between 20 and 512
    and char_length(auth_key) between 8 and 256
  ),
  constraint push_subscriptions_failure_count_valid check (
    failure_count between 0 and 20
  )
);

create index push_subscriptions_user_active_idx
  on public.push_subscriptions (auth_user_id, is_active);

alter table public.push_subscriptions enable row level security;
grant all privileges on table public.push_subscriptions to service_role;

create or replace function public.upsert_current_push_subscription(
  p_endpoint text,
  p_p256dh text,
  p_auth text,
  p_user_agent text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_auth_user_id uuid := auth.uid();
  v_subscription_id uuid;
begin
  if v_auth_user_id is null then
    raise exception 'Authentification requise.';
  end if;

  if p_endpoint is null
    or p_endpoint not like 'https://%'
    or char_length(p_endpoint) not between 20 and 2048
    or p_p256dh is null
    or char_length(p_p256dh) not between 20 and 512
    or p_auth is null
    or char_length(p_auth) not between 8 and 256
  then
    raise exception 'Abonnement push invalide.';
  end if;

  insert into public.push_subscriptions (
    auth_user_id,
    endpoint,
    p256dh,
    auth_key,
    user_agent,
    is_active,
    failure_count,
    disabled_at,
    updated_at
  ) values (
    v_auth_user_id,
    p_endpoint,
    p_p256dh,
    p_auth,
    left(nullif(btrim(p_user_agent), ''), 500),
    true,
    0,
    null,
    now()
  )
  on conflict (endpoint) do update set
    auth_user_id = excluded.auth_user_id,
    p256dh = excluded.p256dh,
    auth_key = excluded.auth_key,
    user_agent = excluded.user_agent,
    is_active = true,
    failure_count = 0,
    disabled_at = null,
    updated_at = now()
  returning id into v_subscription_id;

  return v_subscription_id;
end;
$$;

create or replace function public.disable_current_push_subscription(
  p_endpoint text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_updated integer;
begin
  if auth.uid() is null then
    raise exception 'Authentification requise.';
  end if;

  update public.push_subscriptions
  set
    is_active = false,
    disabled_at = now(),
    updated_at = now()
  where auth_user_id = auth.uid()
    and endpoint = p_endpoint
    and is_active = true;

  get diagnostics v_updated = row_count;
  return v_updated > 0;
end;
$$;

revoke all on function public.upsert_current_push_subscription(text, text, text, text)
  from public, anon;
revoke all on function public.disable_current_push_subscription(text)
  from public, anon;
grant execute on function public.upsert_current_push_subscription(text, text, text, text)
  to authenticated, service_role;
grant execute on function public.disable_current_push_subscription(text)
  to authenticated, service_role;

-- ============================================================
-- FILE D'ATTENTE ET HEURES DECENTES (EUROPE/PARIS)
-- Aucune notification entre 22 h incluses et 8 h exclues.
-- ============================================================

create table public.push_notification_outbox (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid not null references auth.users(id) on delete cascade,
  event_type text not null,
  event_key text not null,
  title text not null,
  body text not null,
  action_href text not null,
  deliver_after timestamptz not null default now(),
  status text not null default 'pending',
  attempt_count smallint not null default 0,
  claimed_at timestamptz,
  sent_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint push_notification_outbox_event_type_allowed check (
    event_type in (
      'race_live_started',
      'transfer_offer_received',
      'transfer_offer_answered',
      'cyclogazette_published',
      'scouting_completed',
      'infrastructure_completed'
    )
  ),
  constraint push_notification_outbox_status_allowed check (
    status in ('pending', 'processing', 'sent', 'cancelled')
  ),
  constraint push_notification_outbox_text_present check (
    btrim(event_key) <> ''
    and btrim(title) <> ''
    and btrim(body) <> ''
    and action_href like '/jeu/%'
  ),
  constraint push_notification_outbox_attempts_valid check (
    attempt_count between 0 and 10
  ),
  constraint push_notification_outbox_recipient_event_unique
    unique (auth_user_id, event_key)
);

create index push_notification_outbox_due_idx
  on public.push_notification_outbox (deliver_after, created_at)
  where status = 'pending';

alter table public.push_notification_outbox enable row level security;
grant all privileges on table public.push_notification_outbox to service_role;

create or replace function public.get_next_decent_push_delivery_at(
  p_requested_at timestamptz default now()
)
returns timestamptz
language plpgsql
stable
set search_path = ''
as $$
declare
  v_requested_at timestamptz := coalesce(p_requested_at, now());
  v_paris timestamp without time zone;
begin
  v_paris := v_requested_at at time zone 'Europe/Paris';

  if v_paris::time < time '08:00' then
    return (v_paris::date + time '08:00') at time zone 'Europe/Paris';
  end if;

  if v_paris::time >= time '22:00' then
    return (v_paris::date + 1 + time '08:00') at time zone 'Europe/Paris';
  end if;

  return v_requested_at;
end;
$$;

revoke all on function public.get_next_decent_push_delivery_at(timestamptz)
  from public, anon, authenticated;
grant execute on function public.get_next_decent_push_delivery_at(timestamptz)
  to service_role;

-- ============================================================
-- EVENEMENTS DEJA CENTRALISES DANS LA BOITE MAIL DU DS
-- ============================================================

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

drop trigger if exists sporting_director_messages_enqueue_push
  on public.sporting_director_messages;
create trigger sporting_director_messages_enqueue_push
after insert on public.sporting_director_messages
for each row execute function public.enqueue_director_mailbox_push();

-- ============================================================
-- PUBLICATION QUOTIDIENNE DE LA CYCLOGAZETTE
-- ============================================================

create or replace function public.enqueue_cyclogazette_push()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.push_notification_outbox (
    auth_user_id,
    event_type,
    event_key,
    title,
    body,
    action_href,
    deliver_after
  )
  select distinct
    director.auth_user_id,
    'cyclogazette_published',
    'cyclogazette:' || new.id::text,
    'La Cyclogazette n°' || new.issue_number::text || ' est publiée',
    left(new.subtitle, 240),
    '/jeu/gazette?edition=' || new.id::text,
    public.get_next_decent_push_delivery_at(coalesce(new.published_at, now()))
  from public.sporting_directors as director
  where director.auth_user_id is not null
    and director.status = 'active'
    and exists (
      select 1
      from public.push_subscriptions as subscription
      where subscription.auth_user_id = director.auth_user_id
        and subscription.is_active = true
    )
  on conflict (auth_user_id, event_key) do nothing;

  return new;
end;
$$;

drop trigger if exists cyclogazette_editions_enqueue_push
  on public.cyclogazette_editions;
create trigger cyclogazette_editions_enqueue_push
after insert on public.cyclogazette_editions
for each row execute function public.enqueue_cyclogazette_push();

-- ============================================================
-- DEPART D'UN LIVE POUR LES EQUIPES INSCRITES
-- La fenetre de 20 minutes absorbe un leger retard du cron.
-- ============================================================

create or replace function public.enqueue_due_race_live_push_notifications()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_inserted integer;
begin
  insert into public.push_notification_outbox (
    auth_user_id,
    event_type,
    event_key,
    title,
    body,
    action_href,
    deliver_after
  )
  select distinct
    director.auth_user_id,
    'race_live_started',
    'race-live:' || stage.id::text,
    'Le direct de ' || edition.display_name || ' commence',
    case
      when stage.stage_number = 1 and race.race_format = 'one_day'
        then 'Votre équipe est au départ. Ouvrez le live pour suivre la course.'
      else 'Étape ' || stage.stage_number::text || ' · ' || stage.name
        || '. Votre équipe est au départ.'
    end,
    '/jeu/resultats/' || race.slug || '/' || stage.stage_number::text,
    public.get_next_decent_push_delivery_at(stage.departure_at)
  from public.stages as stage
  join public.race_editions as edition on edition.id = stage.race_edition_id
  join public.races as race on race.id = edition.race_id
  join public.race_registrations as registration
    on registration.race_edition_id = edition.id
   and registration.status = 'accepted'
  join public.team_seasons as team_season
    on team_season.id = registration.team_season_id
   and team_season.season_id = edition.season_id
  join public.team_manager_assignments as assignment
    on assignment.team_id = team_season.team_id
   and assignment.role = 'general_manager'
   and assignment.status = 'active'
  join public.sporting_directors as director
    on director.id = assignment.sporting_director_id
   and director.status = 'active'
  where stage.departure_at is not null
    and stage.departure_at <= now()
    and stage.departure_at > now() - interval '20 minutes'
    and stage.status <> 'cancelled'
    and edition.status <> 'cancelled'
    and director.auth_user_id is not null
    and exists (
      select 1
      from public.push_subscriptions as subscription
      where subscription.auth_user_id = director.auth_user_id
        and subscription.is_active = true
    )
  on conflict (auth_user_id, event_key) do nothing;

  get diagnostics v_inserted = row_count;
  return v_inserted;
end;
$$;

-- ============================================================
-- PRISE ATOMIQUE DES NOTIFICATIONS A DISTRIBUER
-- ============================================================

create or replace function public.claim_due_push_notifications(
  p_limit integer default 50
)
returns table (
  notification_id uuid,
  recipient_auth_user_id uuid,
  notification_event_type text,
  notification_event_key text,
  notification_title text,
  notification_body text,
  notification_action_href text,
  notification_attempt_count smallint
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (now() at time zone 'Europe/Paris')::time < time '08:00'
    or (now() at time zone 'Europe/Paris')::time >= time '22:00'
  then
    return;
  end if;

  return query
  with due as (
    select outbox.id
    from public.push_notification_outbox as outbox
    where (
        outbox.status = 'pending'
        or (
          outbox.status = 'processing'
          and outbox.claimed_at < now() - interval '10 minutes'
        )
      )
      and outbox.deliver_after <= now()
      and outbox.attempt_count < 10
    order by outbox.deliver_after, outbox.created_at
    for update skip locked
    limit greatest(1, least(coalesce(p_limit, 50), 200))
  ), claimed as (
    update public.push_notification_outbox as outbox
    set
      status = 'processing',
      claimed_at = now(),
      attempt_count = outbox.attempt_count + 1,
      updated_at = now()
    from due
    where outbox.id = due.id
    returning outbox.*
  )
  select
    claimed.id,
    claimed.auth_user_id,
    claimed.event_type,
    claimed.event_key,
    claimed.title,
    claimed.body,
    claimed.action_href,
    claimed.attempt_count
  from claimed;
end;
$$;

revoke all on function public.enqueue_director_mailbox_push()
  from public, anon, authenticated;
revoke all on function public.enqueue_cyclogazette_push()
  from public, anon, authenticated;
revoke all on function public.enqueue_due_race_live_push_notifications()
  from public, anon, authenticated;
revoke all on function public.claim_due_push_notifications(integer)
  from public, anon, authenticated;
grant execute on function public.enqueue_due_race_live_push_notifications()
  to service_role;
grant execute on function public.claim_due_push_notifications(integer)
  to service_role;

comment on table public.push_subscriptions is
  'Abonnements Web Push actifs, un par navigateur ou application installee.';
comment on table public.push_notification_outbox is
  'File dedupliquee des notifications push, distribuee uniquement entre 8 h et 22 h heure de Paris.';

notify pgrst, 'reload schema';

commit;
