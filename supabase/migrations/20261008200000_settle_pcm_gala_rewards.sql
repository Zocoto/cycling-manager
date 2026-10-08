begin;

set local lock_timeout = '5s';
set local statement_timeout = '30s';

-- Exclusive prizes must never enter the shop, daily gifts or partner supplies.
alter table public.equipment_catalog_items
  drop constraint equipment_catalog_items_acquisition_channel_allowed;
alter table public.equipment_catalog_items
  add constraint equipment_catalog_items_acquisition_channel_allowed
  check (acquisition_channel in ('commercial', 'equipment_partner', 'research_prototype', 'event_reward'));

insert into public.equipment_catalog_items (
  catalog_key, name, slot_type, status, supplier_key, supplier_name,
  description, price, rarity, image_path, effect_summary, effect_payload,
  acquisition_channel
)
values
  ('gala-roue-avant-or', 'Roue avant · Éclat de Gala', 'front_wheel', 'active', 'gala-fin-de-saison', 'Grand Gala',
   'Lot exclusif du premier coureur de chaque poule du Grand Gala de fin de saison.', 0, 'premium', '/images/equipment/products/novaspoke-vent-28.webp',
   '+3 VAL · +2 DES · +1 RES', '{"ratingBonuses":{"hills":3,"downhill":2,"resistance":1}}', 'event_reward'),
  ('gala-gants-or', 'Gants de Gala', 'gloves', 'active', 'gala-fin-de-saison', 'Grand Gala',
   'Lot exclusif du deuxième coureur de chaque poule du Grand Gala de fin de saison.', 0, 'premium', '/images/equipment/products/montclair-podium-atelier.webp',
   '+2 VAL · +2 ACC · +1 RES', '{"ratingBonuses":{"hills":2,"acceleration":2,"resistance":1}}', 'event_reward'),
  ('gala-casque-bronze', 'Casque · Sérénité de Gala', 'helmet', 'active', 'gala-fin-de-saison', 'Grand Gala',
   'Lot exclusif du troisième coureur de chaque poule du Grand Gala de fin de saison.', 0, 'performance', '/images/equipment/products/aerion-stratos-pro.webp',
   '+2 RES · +1 END', '{"ratingBonuses":{"resistance":2,"endurance":1}}', 'event_reward'),
  ('gala-chaussures', 'Chaussures · Dernière Relance', 'shoes', 'active', 'gala-fin-de-saison', 'Grand Gala',
   'Lot exclusif du quatrième coureur de chaque poule du Grand Gala de fin de saison.', 0, 'performance', '/images/equipment/products/montclair-alpine-lace.webp',
   '+2 ACC · +1 SPR', '{"ratingBonuses":{"acceleration":2,"sprint":1}}', 'event_reward'),
  ('gala-lunettes', 'Lunettes · Ligne d’Horizon', 'glasses', 'active', 'gala-fin-de-saison', 'Grand Gala',
   'Lot exclusif du cinquième coureur de chaque poule du Grand Gala de fin de saison.', 0, 'performance', '/images/equipment/products/aerion-prism-horizon.webp',
   '+1 VAL · +1 DES', '{"ratingBonuses":{"hills":1,"downhill":1}}', 'event_reward')
on conflict (catalog_key) do update set
  name = excluded.name, slot_type = excluded.slot_type, status = excluded.status,
  supplier_key = excluded.supplier_key, supplier_name = excluded.supplier_name,
  description = excluded.description, price = excluded.price, rarity = excluded.rarity,
  image_path = excluded.image_path, effect_summary = excluded.effect_summary,
  effect_payload = excluded.effect_payload, acquisition_channel = excluded.acquisition_channel,
  updated_at = now();

-- The authoritative per-stage effect reader used by the simulation must include
-- physical exclusive prizes just like commercial equipment. Preserve all
-- existing partner and research-prototype behavior outside this gala change.
do $migration$
declare v_definition text;
begin
  select pg_get_functiondef('public.get_active_calendar_stage_equipment_effects(uuid[])'::regprocedure)
  into v_definition;
  if position('item.acquisition_channel = ''commercial''' in v_definition) > 0 then
    v_definition := replace(v_definition,
      'item.acquisition_channel = ''commercial''',
      'item.acquisition_channel in (''commercial'', ''event_reward'')');
    execute v_definition;
  elsif position('item.acquisition_channel in (''commercial'', ''event_reward'')' in v_definition) = 0 then
    raise exception 'Unexpected stage-equipment reader; review its definition before adding gala prizes.';
  end if;
end;
$migration$;

create table public.pcm_gala_reward_grants (
  id uuid primary key default gen_random_uuid(),
  gala_event_id uuid not null references public.pcm_gala_events(id) on delete restrict,
  group_number smallint not null check (group_number in (1, 2)),
  rank smallint not null check (rank between 1 and 5),
  rider_id uuid references public.riders(id) on delete set null,
  rider_name text not null,
  team_id uuid references public.teams(id) on delete set null,
  team_name text not null,
  team_season_id uuid references public.team_seasons(id) on delete set null,
  sporting_director_id uuid references public.sporting_directors(id) on delete set null,
  manager_name text not null,
  equipment_item_id uuid not null references public.equipment_catalog_items(id) on delete restrict,
  item_name text not null,
  summary text not null,
  allocated_at timestamptz not null default now(),
  unique (gala_event_id, group_number, rank),
  unique (gala_event_id, rider_id)
);

create table public.pcm_gala_reward_publications (
  gala_event_id uuid primary key references public.pcm_gala_events(id) on delete restrict,
  published_at timestamptz not null default now()
);

create table public.pcm_gala_reward_emails (
  id uuid primary key default gen_random_uuid(),
  gala_event_id uuid not null references public.pcm_gala_events(id) on delete restrict,
  group_number smallint not null check (group_number in (1, 2)),
  sporting_director_id uuid references public.sporting_directors(id) on delete set null,
  auth_user_id uuid,
  manager_name text not null,
  team_name text not null,
  subject text not null,
  body text not null,
  idempotency_key text not null unique,
  status text not null default 'pending' check (status in ('pending', 'sending', 'sent', 'failed', 'uncertain')),
  attempt_count smallint not null default 0 check (attempt_count between 0 and 3),
  claimed_at timestamptz,
  sent_at timestamptz,
  provider_message_id text,
  last_error text,
  created_at timestamptz not null default now(),
  unique (gala_event_id, group_number, sporting_director_id)
);

alter table public.pcm_gala_reward_grants enable row level security;
alter table public.pcm_gala_reward_publications enable row level security;
alter table public.pcm_gala_reward_emails enable row level security;
revoke all on public.pcm_gala_reward_grants, public.pcm_gala_reward_publications, public.pcm_gala_reward_emails
  from public, anon, authenticated;
grant all on public.pcm_gala_reward_grants, public.pcm_gala_reward_publications, public.pcm_gala_reward_emails to service_role;

create or replace function public.settle_pcm_gala_rewards(p_event_id uuid, p_rewards jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_event public.pcm_gala_events%rowtype;
  v_row record;
  v_target record;
  v_item public.equipment_catalog_items%rowtype;
  v_existing public.pcm_gala_reward_grants%rowtype;
  v_grant_id uuid;
  v_allocated integer := 0;
  v_existing_count integer := 0;
  v_mail record;
  v_body text;
  v_source text;
begin
  if jsonb_typeof(p_rewards) is distinct from 'array' then
    raise exception 'Gala rewards must be a JSON array.';
  end if;
  if jsonb_array_length(p_rewards) <> 10 then
    raise exception 'Both complete top fives (10 prizes) are required for atomic settlement.';
  end if;
  if (select count(distinct (r.group_number, r.rank))
      from jsonb_to_recordset(p_rewards) as r(group_number integer, rank integer)) <> 10
    or exists (select 1 from jsonb_to_recordset(p_rewards) as r(group_number integer, rank integer, rider_id uuid, team_id uuid, team_name text)
      where r.group_number is null or r.group_number not in (1, 2)
        or r.rank is null or r.rank not between 1 and 5
        or r.rider_id is null or r.team_id is null
        or nullif(btrim(r.team_name), '') is null or length(r.team_name) > 200)
    or (select count(distinct r.rider_id) from jsonb_to_recordset(p_rewards) as r(rider_id uuid)) <> 10
  then
    raise exception 'Invalid or duplicate gala podium entries.';
  end if;

  select * into v_event from public.pcm_gala_events where id = p_event_id for update;
  if v_event.id is null or v_event.event_key <> 'gala-des-puncheurs' then
    raise exception 'A season-finale gala is required.';
  end if;

  for v_row in select * from jsonb_to_recordset(p_rewards)
    as r(group_number integer, rank integer, rider_id uuid, team_id uuid, team_name text)
    order by r.group_number, r.rank
  loop
    -- An award is tied to the frozen registration, not today's changed roster.
    if not exists (
      select 1 from public.pcm_gala_registrations as registration
      join public.pcm_gala_registration_riders as roster on roster.registration_id = registration.id
      where registration.gala_event_id = v_event.id
        and registration.season_id = v_event.season_id
        and registration.team_id = v_row.team_id and roster.rider_id = v_row.rider_id
    ) then
      raise exception 'Rider % is not registered for team % in this gala.', v_row.rider_id, v_row.team_id;
    end if;

    select * into v_existing from public.pcm_gala_reward_grants
      where gala_event_id = p_event_id and group_number = v_row.group_number and rank = v_row.rank;
    if v_existing.id is not null then
      if v_existing.rider_id is distinct from v_row.rider_id or v_existing.team_id is distinct from v_row.team_id
         or v_existing.team_name <> btrim(v_row.team_name) then
        raise exception 'A settled podium entry cannot be overwritten.';
      end if;
      v_existing_count := v_existing_count + 1;
      continue;
    end if;

    select team_season.id as team_season_id, director.id as director_id,
      director.auth_user_id, director.display_name as manager_name,
      concat_ws(' ', rider.first_name, rider.last_name) as rider_name
    into v_target
    from public.team_seasons as team_season
    join public.seasons as season on season.id = team_season.season_id and season.status = 'active'
    join public.team_manager_assignments as assignment on assignment.team_id = team_season.team_id
      and assignment.role = 'general_manager' and assignment.status = 'active'
    join public.sporting_directors as director on director.id = assignment.sporting_director_id and director.status = 'active'
    join public.riders as rider on rider.id = v_row.rider_id
    where team_season.team_id = v_row.team_id and team_season.status in ('active', 'planned')
    for update of team_season;
    if v_target.team_season_id is null then
      raise exception 'No active inventory/manager exists for rewarded team %.', v_row.team_id;
    end if;

    select * into strict v_item from public.equipment_catalog_items
    where catalog_key = case v_row.rank
      when 1 then 'gala-roue-avant-or' when 2 then 'gala-gants-or'
      when 3 then 'gala-casque-bronze' when 4 then 'gala-chaussures' when 5 then 'gala-lunettes' end
      and acquisition_channel = 'event_reward' and status = 'active';

    insert into public.pcm_gala_reward_grants (
      gala_event_id, group_number, rank, rider_id, rider_name, team_id, team_name,
      team_season_id, sporting_director_id, manager_name, equipment_item_id, item_name, summary
    ) values (
      p_event_id, v_row.group_number, v_row.rank, v_row.rider_id, v_target.rider_name,
      v_row.team_id, btrim(v_row.team_name), v_target.team_season_id,
      v_target.director_id, v_target.manager_name, v_item.id, v_item.name, v_item.effect_summary
    ) on conflict (gala_event_id, group_number, rank) do nothing returning id into v_grant_id;

    if v_grant_id is not null then
      insert into public.team_equipment_inventory (team_season_id, equipment_item_id, quantity, last_purchase_price)
      values (v_target.team_season_id, v_item.id, 1, 0)
      on conflict (team_season_id, equipment_item_id) do update
      set quantity = public.team_equipment_inventory.quantity + 1, updated_at = now();
      v_allocated := v_allocated + 1;
    end if;
  end loop;

  for v_mail in
    select grant_row.group_number, grant_row.sporting_director_id, grant_row.team_season_id,
      grant_row.team_name, grant_row.manager_name, director.auth_user_id,
      string_agg(format('%s%s : %s (%s) — %s', grant_row.rank,
        case when grant_row.rank = 1 then 'er' else 'e' end, grant_row.item_name,
        grant_row.summary, grant_row.rider_name), E'\n' order by grant_row.rank) as prize_lines
    from public.pcm_gala_reward_grants as grant_row
    join public.sporting_directors as director on director.id = grant_row.sporting_director_id
    where grant_row.gala_event_id = p_event_id
    group by grant_row.group_number, grant_row.sporting_director_id, grant_row.team_season_id,
      grant_row.team_name, grant_row.manager_name, director.auth_user_id
    order by grant_row.group_number, grant_row.team_name
  loop
    v_source := 'pcm-gala-rewards:' || p_event_id::text || ':' || v_mail.group_number::text || ':' || v_mail.sporting_director_id::text;
    v_body := 'Bonjour ' || v_mail.manager_name || E',\n\nLes résultats du Grand Gala de fin de saison sont disponibles. Votre équipe '
      || v_mail.team_name || ' a remporté ces lots dans la poule ' || v_mail.group_number::text || E' :\n\n'
      || v_mail.prize_lines || E'\n\nLes lots ont été ajoutés à votre inventaire. Équipez-les sur vos coureurs pour activer leurs bonus.'
      || E'\nLes vidéos et classements sont disponibles sur la page du Gala. Cette course hors-circuit ne modifie ni argent, ni points, ni forme.'
      || E'\n\nMerci pour votre participation !\nCyclo Stratège';
    insert into public.sporting_director_messages (
      sporting_director_id, season_id, team_season_id, message_type, sender_name,
      subject, preview, body, action_href, action_label, source_reference, is_important
    ) values (
      v_mail.sporting_director_id, v_event.season_id, v_mail.team_season_id, 'system', 'Grand Gala · Cyclo Stratège',
      'Grand Gala : vos lots ont rejoint votre inventaire',
      'Poule ' || v_mail.group_number::text || ' : retrouvez vos récompenses et les résultats.',
      v_body, '/jeu/gala-fin-de-saison', 'Voir les résultats et les vidéos', v_source, true
    ) on conflict (sporting_director_id, source_reference) do nothing;
    insert into public.pcm_gala_reward_emails (
      gala_event_id, group_number, sporting_director_id, auth_user_id, manager_name,
      team_name, subject, body, idempotency_key
    ) values (
      p_event_id, v_mail.group_number, v_mail.sporting_director_id, v_mail.auth_user_id,
      v_mail.manager_name, v_mail.team_name, 'Grand Gala : vos récompenses sont disponibles', v_body, v_source
    ) on conflict (gala_event_id, group_number, sporting_director_id) do nothing;
  end loop;

  -- Publication and closing happen only after all ten awards and messages
  -- succeed; any invalid result rolls the whole transaction back.
  update public.pcm_gala_events set status = 'closed', updated_at = now()
    where id = p_event_id and status = 'open';
  insert into public.pcm_gala_reward_publications (gala_event_id) values (p_event_id)
    on conflict (gala_event_id) do nothing;
  return jsonb_build_object('allocatedCount', v_allocated, 'alreadyAllocatedCount', v_existing_count,
    'emailRecipientCount', (select count(*) from public.pcm_gala_reward_emails where gala_event_id = p_event_id));
end;
$function$;

create or replace function public.get_pcm_gala_published_rewards(p_event_id uuid)
returns table (group_number integer, rank integer, rider_id uuid, rider_name text,
  team_id uuid, team_name text, manager_name text, item_name text, summary text, allocated_at timestamptz)
language sql stable security definer set search_path = '' as $function$
  select grant_row.group_number::integer, grant_row.rank::integer, grant_row.rider_id,
    grant_row.rider_name, grant_row.team_id, grant_row.team_name, grant_row.manager_name,
    grant_row.item_name, grant_row.summary, grant_row.allocated_at
  from public.pcm_gala_reward_grants as grant_row
  join public.pcm_gala_reward_publications as publication on publication.gala_event_id = grant_row.gala_event_id
  where grant_row.gala_event_id = p_event_id
  order by grant_row.group_number, grant_row.rank;
$function$;

create or replace function public.claim_pcm_gala_reward_emails(p_event_id uuid, p_limit integer default 10)
returns table (id uuid, gala_event_id uuid, group_number integer, sporting_director_id uuid,
  auth_user_id uuid, manager_name text, team_name text, subject text, body text, idempotency_key text)
language sql security definer set search_path = '' as $function$
  with claims as (
    select email.id from public.pcm_gala_reward_emails as email
    join public.pcm_gala_reward_publications as publication on publication.gala_event_id = email.gala_event_id
    join public.sporting_directors as director on director.id = email.sporting_director_id
      and director.status = 'active' and director.auth_user_id = email.auth_user_id
    where email.gala_event_id = p_event_id and email.status in ('pending', 'failed')
      and email.attempt_count < 3
    order by email.group_number, email.team_name
    limit least(greatest(coalesce(p_limit, 10), 1), 20)
    for update of email skip locked
  ), updated as (
    update public.pcm_gala_reward_emails as email
    set status = 'sending', attempt_count = email.attempt_count + 1, claimed_at = now(), last_error = null
    from claims where email.id = claims.id returning email.*
  )
  select updated.id, updated.gala_event_id, updated.group_number::integer, updated.sporting_director_id,
    updated.auth_user_id, updated.manager_name, updated.team_name, updated.subject, updated.body, updated.idempotency_key
  from updated;
$function$;

create or replace function public.mark_pcm_gala_reward_email(
  p_email_id uuid, p_status text, p_message_id text default null, p_error text default null
)
returns boolean language plpgsql security definer set search_path = '' as $function$
begin
  if p_status not in ('sent', 'failed', 'uncertain') or p_status is null then
    raise exception 'Invalid email outcome.';
  end if;
  update public.pcm_gala_reward_emails as email
  set status = p_status,
    sent_at = case when p_status = 'sent' then now() else null end,
    provider_message_id = nullif(left(p_message_id, 500), ''),
    last_error = nullif(left(p_error, 1000), '')
  where email.id = p_email_id and email.status = 'sending';
  return found;
end;
$function$;

revoke all on function public.settle_pcm_gala_rewards(uuid, jsonb),
  public.claim_pcm_gala_reward_emails(uuid, integer), public.mark_pcm_gala_reward_email(uuid, text, text, text)
  from public, anon, authenticated;
grant execute on function public.settle_pcm_gala_rewards(uuid, jsonb),
  public.claim_pcm_gala_reward_emails(uuid, integer), public.mark_pcm_gala_reward_email(uuid, text, text, text)
  to service_role;
revoke all on function public.get_pcm_gala_published_rewards(uuid) from public, anon;
grant execute on function public.get_pcm_gala_published_rewards(uuid) to authenticated, service_role;

comment on table public.pcm_gala_reward_grants is 'Immutable idempotent gala prize snapshots; nullable identity references do not block account/team/rider deletion. No official race, finance, points or rider-state settlement.';
comment on table public.pcm_gala_reward_emails is 'Transactional prize notification outbox. Ambiguous sends are never retried automatically.';
notify pgrst, 'reload schema';
commit;
