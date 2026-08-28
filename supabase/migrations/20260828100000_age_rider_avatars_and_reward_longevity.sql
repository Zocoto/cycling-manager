begin;

-- A 90-year-old rider must be representable by the game, while keeping a
-- defensive upper bound against corrupted ages.
alter table public.rider_season_ratings
  drop constraint rider_season_ratings_age_range,
  add constraint rider_season_ratings_age_range
    check (age between 15 and 120);

alter table public.rider_history_archives
  drop constraint rider_history_archives_age_range,
  add constraint rider_history_archives_age_range
    check (retirement_age is null or retirement_age between 15 and 120);

alter table public.global_chat_messages
  drop constraint global_chat_messages_preview_age_valid,
  add constraint global_chat_messages_preview_age_valid
    check (preview_age is null or preview_age between 15 and 120);

do $patch_rollover$
declare
  v_signature regprocedure :=
    'public.rollover_game_season(uuid,boolean)'::regprocedure;
  v_definition text;
  v_patched_definition text;
begin
  select pg_catalog.pg_get_functiondef(v_signature)
  into v_definition;

  v_patched_definition := replace(
    v_definition,
    'least(60, rating.age + 1)',
    'least(120, rating.age + 1)'
  );

  if v_patched_definition = v_definition then
    raise exception
      'La borne d’âge de rollover attendue est introuvable dans %.',
      v_signature::text;
  end if;

  execute v_patched_definition;
end;
$patch_rollover$;

create table public.longevity_trophy_reward_grants (
  id uuid primary key default gen_random_uuid(),
  trophy_id uuid not null
    references public.sporting_director_trophies(id) on delete cascade,
  sporting_director_id uuid not null
    references public.sporting_directors(id) on delete cascade,
  team_season_id uuid not null
    references public.team_seasons(id) on delete cascade,
  reward_slot smallint not null,
  reward_key text not null
    references public.daily_reward_catalog(reward_key) on delete restrict,
  created_at timestamptz not null default now(),
  constraint longevity_trophy_reward_slot_range
    check (reward_slot between 1 and 3),
  constraint longevity_trophy_reward_slot_unique
    unique (trophy_id, reward_slot)
);

alter table public.longevity_trophy_reward_grants enable row level security;
grant all privileges on table public.longevity_trophy_reward_grants
  to service_role;

alter table public.daily_reward_inventory
  add column source_longevity_trophy_reward_id uuid unique
    references public.longevity_trophy_reward_grants(id)
    on delete cascade;

alter table public.daily_reward_inventory
  drop constraint daily_reward_inventory_exactly_one_source;

alter table public.daily_reward_inventory
  add constraint daily_reward_inventory_exactly_one_source
  check (
    num_nonnulls(
      source_claim_id,
      source_referral_reward_id,
      source_auction_compensation_id,
      source_longevity_trophy_reward_id
    ) = 1
  );

-- The secret trophy sends the usual notification, but deliberately never
-- links to or mentions the public trophy gallery.
create or replace function private.create_trophy_notification(
  p_sporting_director_id uuid,
  p_trophy_kind text,
  p_trophy_key text,
  p_trophy_title text,
  p_source_reference text,
  p_awarded_at timestamptz default now(),
  p_season_id uuid default null,
  p_team_season_id uuid default null,
  p_detail text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_notification_id uuid;
  v_preview text;
  v_body text;
  v_action_href text;
  v_action_label text;
begin
  if not exists (
    select 1
    from public.sporting_directors as director
    where director.id = p_sporting_director_id
      and director.auth_user_id is not null
      and director.status = 'active'
      and not exists (
        select 1
        from public.alpha_bot_managers as bot
        where bot.sporting_director_id = director.id
      )
  ) then
    return null;
  end if;

  insert into public.sporting_director_trophy_notifications (
    sporting_director_id,
    season_id,
    team_season_id,
    trophy_kind,
    trophy_key,
    trophy_title,
    source_reference,
    awarded_at
  )
  values (
    p_sporting_director_id,
    p_season_id,
    p_team_season_id,
    p_trophy_kind,
    p_trophy_key,
    p_trophy_title,
    p_source_reference,
    coalesce(p_awarded_at, now())
  )
  on conflict (sporting_director_id, source_reference) do nothing
  returning id into v_notification_id;

  if v_notification_id is null then
    return null;
  end if;

  if p_trophy_key = 'peloton_eternel' then
    v_preview := 'Un secret rarissime vient d’être découvert.';
    v_body := 'Félicitations ! Le trophée secret « ' || p_trophy_title
      || ' » récompense votre incroyable fidélité à un coureur défiant le temps.'
      || case
        when nullif(btrim(coalesce(p_detail, '')), '') is null then ''
        else E'\n\n' || btrim(p_detail)
      end
      || E'\n\nCette distinction restera volontairement absente de la galerie.';
    v_action_href := '/jeu/inventaire';
    v_action_label := 'Voir mes objets';
  else
    v_preview := 'Votre palmarès s’enrichit d’un nouveau trophée.';
    v_body := 'Félicitations ! Le trophée « ' || p_trophy_title
      || ' » rejoint votre palmarès.'
      || case
        when nullif(btrim(coalesce(p_detail, '')), '') is null then ''
        else E'\n\n' || btrim(p_detail)
      end
      || E'\n\nRetrouvez cette distinction dans votre galerie de trophées.';
    v_action_href := '/jeu/objectifs?onglet=trophees';
    v_action_label := 'Voir mon trophée';
  end if;

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
  )
  values (
    p_sporting_director_id,
    p_season_id,
    p_team_season_id,
    'trophy',
    'Comité des distinctions',
    'Nouveau trophée · ' || p_trophy_title,
    v_preview,
    v_body,
    v_action_href,
    v_action_label,
    'trophy:' || p_source_reference,
    true,
    coalesce(p_awarded_at, now())
  )
  on conflict (sporting_director_id, source_reference) do nothing;

  return v_notification_id;
end;
$$;

revoke all on function private.create_trophy_notification(
  uuid, text, text, text, text, timestamptz, uuid, uuid, text
) from public, anon, authenticated;
grant execute on function private.create_trophy_notification(
  uuid, text, text, text, text, timestamptz, uuid, uuid, text
) to service_role;

create or replace function private.notify_sporting_director_trophy()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_title text;
  v_kind text;
  v_detail text;
begin
  if new.claimed_at is null then
    return new;
  end if;

  if tg_op = 'UPDATE' and old.claimed_at is not null then
    return new;
  end if;

  v_title := case new.trophy_key
    when 'alpha_tester' then 'Alphatesteur'
    when 'atlas_peloton' then 'Atlas du peloton'
    when 'campus_de_pointe' then 'Campus de pointe'
    when 'alchimiste_carbone' then 'Alchimiste du carbone'
    when 'triple_couronne_integrale' then 'Triple Couronne intégrale'
    when 'virage_cache' then 'Le Virage caché'
    when 'ambulancier' then 'Ambulancier'
    when 'medecin_urgentiste' then 'Médecin urgentiste'
    when 'peloton_eternel' then 'Le Peloton éternel'
    else initcap(replace(new.trophy_key, '_', ' '))
  end;
  v_kind := case
    when new.trophy_key in ('ambulancier', 'medecin_urgentiste') then 'medical'
    when new.trophy_key = 'alpha_tester' then 'special'
    else 'achievement'
  end;
  v_detail := case
    when new.trophy_key = 'peloton_eternel' then
      'Récompenses remises : 5 000 000 €, 5 000 XP, 500 points de réputation et 3 objets de niveau 10.'
    else
      'Cette distinction de carrière est désormais visible dans votre galerie.'
  end;

  perform private.create_trophy_notification(
    new.sporting_director_id,
    v_kind,
    new.trophy_key,
    v_title,
    'special:' || new.id::text,
    new.claimed_at,
    null,
    null,
    v_detail
  );

  return new;
end;
$$;

revoke all on function private.notify_sporting_director_trophy()
  from public, anon, authenticated;

-- Evaluation is event-driven: no page load and no recurring scan is added.
create or replace function private.grant_longevity_trophy_for_team(
  p_team_id uuid,
  p_rider_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_director_id uuid;
  v_team_season_id uuid;
  v_season_id uuid;
  v_game_year integer;
  v_day_number integer;
  v_season_day_id uuid;
  v_trophy_id uuid;
  v_reward_key text;
  v_grant_id uuid;
  v_slot integer;
begin
  select
    director.id,
    team_season.id,
    season.id,
    season.game_year,
    coalesce(season.current_day_number, 1),
    season_day.id
  into
    v_director_id,
    v_team_season_id,
    v_season_id,
    v_game_year,
    v_day_number,
    v_season_day_id
  from public.team_manager_assignments as assignment
  join public.sporting_directors as director
    on director.id = assignment.sporting_director_id
   and director.auth_user_id is not null
   and director.status = 'active'
  join public.seasons as season
    on season.status = 'active'
  join public.team_seasons as team_season
    on team_season.team_id = assignment.team_id
   and team_season.season_id = season.id
  left join public.season_days as season_day
    on season_day.season_id = season.id
   and season_day.day_number = coalesce(season.current_day_number, 1)
  where assignment.team_id = p_team_id
    and assignment.role = 'general_manager'
    and assignment.status = 'active'
    and not exists (
      select 1
      from public.alpha_bot_managers as bot
      where bot.sporting_director_id = director.id
    )
  limit 1;

  if v_director_id is null then
    return false;
  end if;

  if not exists (
    select 1
    from public.rider_contracts as contract
    join public.rider_season_ratings as rating
      on rating.rider_id = contract.rider_id
     and rating.season_id = v_season_id
    where contract.team_id = p_team_id
      and contract.rider_id = p_rider_id
      and contract.status = 'active'
      and rating.age > 90
  ) then
    return false;
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('peloton-eternel:' || v_director_id::text, 0)
  );

  insert into public.sporting_director_trophies (
    sporting_director_id,
    trophy_key,
    available_at,
    claimed_at
  )
  values (
    v_director_id,
    'peloton_eternel',
    now(),
    now()
  )
  on conflict (sporting_director_id, trophy_key) do nothing
  returning id into v_trophy_id;

  if v_trophy_id is null then
    return false;
  end if;

  insert into public.reward_events (
    source_reference,
    source_type,
    sporting_director_id,
    team_season_id,
    rider_id,
    reputation_points,
    experience_points,
    cash_prize,
    description
  )
  values (
    'trophy:peloton-eternel:' || v_director_id::text,
    'game_objective',
    v_director_id,
    v_team_season_id,
    p_rider_id,
    500,
    5000,
    5000000,
    'Récompense secrète du trophée Le Peloton éternel.'
  );

  update public.team_seasons
  set cash_balance = cash_balance + 5000000
  where id = v_team_season_id;

  update public.sporting_directors
  set
    experience_points = experience_points + 5000,
    reputation_points = reputation_points + 500
  where id = v_director_id;

  insert into public.team_finance_transactions (
    team_season_id,
    season_day_id,
    day_number,
    amount,
    category,
    status,
    description,
    source_reference,
    posted_at
  )
  values (
    v_team_season_id,
    v_season_day_id,
    v_day_number,
    5000000,
    'other',
    'posted',
    'Trophée secret · Le Peloton éternel',
    'reward:longevity-trophy:' || v_director_id::text,
    now()
  );

  for v_slot in 1..3 loop
    select catalog.reward_key
    into v_reward_key
    from public.daily_reward_catalog as catalog
    where catalog.is_active
      and catalog.importance = 10
    order by md5(catalog.reward_key || ':' || v_trophy_id::text)
    offset (v_slot - 1)
    limit 1;

    if v_reward_key is null then
      raise exception
        'Au moins trois objets actifs de niveau 10 sont requis.';
    end if;

    insert into public.longevity_trophy_reward_grants (
      trophy_id,
      sporting_director_id,
      team_season_id,
      reward_slot,
      reward_key
    )
    values (
      v_trophy_id,
      v_director_id,
      v_team_season_id,
      v_slot,
      v_reward_key
    )
    returning id into v_grant_id;

    insert into public.daily_reward_inventory (
      sporting_director_id,
      team_season_id,
      source_claim_id,
      source_referral_reward_id,
      source_auction_compensation_id,
      source_longevity_trophy_reward_id,
      reward_key,
      expires_after_game_year
    )
    values (
      v_director_id,
      v_team_season_id,
      null,
      null,
      null,
      v_grant_id,
      v_reward_key,
      v_game_year + 1
    );
  end loop;

  return true;
end;
$$;

revoke all on function private.grant_longevity_trophy_for_team(uuid, uuid)
  from public, anon, authenticated;
grant execute on function private.grant_longevity_trophy_for_team(uuid, uuid)
  to service_role;

create or replace function private.check_longevity_trophy_from_contract()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'active' then
    perform private.grant_longevity_trophy_for_team(new.team_id, new.rider_id);
  end if;
  return new;
end;
$$;

drop trigger if exists check_longevity_trophy_after_contract
  on public.rider_contracts;
create trigger check_longevity_trophy_after_contract
after insert or update of status, team_id, rider_id
on public.rider_contracts
for each row execute function private.check_longevity_trophy_from_contract();

create or replace function private.check_longevity_trophy_from_rating()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_team_id uuid;
begin
  if new.age <= 90 then
    return new;
  end if;

  for v_team_id in
    select contract.team_id
    from public.rider_contracts as contract
    join public.seasons as season
      on season.id = new.season_id
     and season.status = 'active'
    where contract.rider_id = new.rider_id
      and contract.status = 'active'
  loop
    perform private.grant_longevity_trophy_for_team(v_team_id, new.rider_id);
  end loop;

  return new;
end;
$$;

drop trigger if exists check_longevity_trophy_after_rating
  on public.rider_season_ratings;
create trigger check_longevity_trophy_after_rating
after insert or update of age
on public.rider_season_ratings
for each row execute function private.check_longevity_trophy_from_rating();

create or replace function private.check_longevity_trophy_from_manager()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rider_id uuid;
begin
  if new.role <> 'general_manager' or new.status <> 'active' then
    return new;
  end if;

  for v_rider_id in
    select contract.rider_id
    from public.rider_contracts as contract
    join public.rider_season_ratings as rating
      on rating.rider_id = contract.rider_id
    join public.seasons as season
      on season.id = rating.season_id
     and season.status = 'active'
    where contract.team_id = new.team_id
      and contract.status = 'active'
      and rating.age > 90
  loop
    perform private.grant_longevity_trophy_for_team(new.team_id, v_rider_id);
  end loop;

  return new;
end;
$$;

drop trigger if exists check_longevity_trophy_after_manager
  on public.team_manager_assignments;
create trigger check_longevity_trophy_after_manager
after insert or update of role, status, team_id
on public.team_manager_assignments
for each row execute function private.check_longevity_trophy_from_manager();

do $backfill$
declare
  v_eligible record;
begin
  for v_eligible in
    select distinct contract.team_id, contract.rider_id
    from public.rider_contracts as contract
    join public.rider_season_ratings as rating
      on rating.rider_id = contract.rider_id
    join public.seasons as season
      on season.id = rating.season_id
     and season.status = 'active'
    where contract.status = 'active'
      and rating.age > 90
  loop
    perform private.grant_longevity_trophy_for_team(
      v_eligible.team_id,
      v_eligible.rider_id
    );
  end loop;
end;
$backfill$;

-- Three free agents expose every visible threshold immediately after deploy.
with test_riders(id, first_name, last_name, age, potential_steps) as (
  values
    ('f0400000-0000-4000-8000-000000000040'::uuid, 'Arsène', 'Grison', 40, 4),
    ('f0550000-0000-4000-8000-000000000055'::uuid, 'Albin', 'Neige', 55, 3),
    ('f0900000-0000-4000-8000-000000000090'::uuid, 'Mortimer', 'Éternel', 90, 2)
), french_country as (
  select country.id
  from public.countries as country
  where country.iso_alpha2 = 'FR'
)
insert into public.riders (
  id,
  country_id,
  first_name,
  last_name,
  status,
  potential_steps,
  decline_resistance_multiplier
)
select
  test_rider.id,
  french_country.id,
  test_rider.first_name,
  test_rider.last_name,
  'free_agent',
  test_rider.potential_steps,
  1.00
from test_riders as test_rider
cross join french_country
on conflict (id) do update set
  country_id = excluded.country_id,
  first_name = excluded.first_name,
  last_name = excluded.last_name,
  status = 'free_agent',
  potential_steps = excluded.potential_steps,
  decline_resistance_multiplier = excluded.decline_resistance_multiplier;

with test_ratings(
  rider_id, age, mountain, hills, flat, time_trial, cobbles,
  sprint, acceleration, downhill, endurance, resistance, recovery,
  breakaway, prologue
) as (
  values
    ('f0400000-0000-4000-8000-000000000040'::uuid, 40, 55, 58, 52, 51, 54, 48, 52, 56, 58, 57, 54, 53, 49),
    ('f0550000-0000-4000-8000-000000000055'::uuid, 55, 49, 52, 55, 53, 51, 46, 48, 54, 56, 55, 52, 50, 51),
    ('f0900000-0000-4000-8000-000000000090'::uuid, 90, 44, 47, 50, 48, 46, 42, 45, 52, 54, 53, 50, 49, 47)
), active_season as (
  select season.id
  from public.seasons as season
  where season.status = 'active'
)
insert into public.rider_season_ratings (
  rider_id,
  season_id,
  age,
  mountain,
  hills,
  flat,
  time_trial,
  cobbles,
  sprint,
  acceleration,
  downhill,
  endurance,
  resistance,
  recovery,
  breakaway,
  prologue
)
select
  test_rating.rider_id,
  active_season.id,
  test_rating.age,
  test_rating.mountain,
  test_rating.hills,
  test_rating.flat,
  test_rating.time_trial,
  test_rating.cobbles,
  test_rating.sprint,
  test_rating.acceleration,
  test_rating.downhill,
  test_rating.endurance,
  test_rating.resistance,
  test_rating.recovery,
  test_rating.breakaway,
  test_rating.prologue
from test_ratings as test_rating
cross join active_season
on conflict (rider_id, season_id) do update set
  age = excluded.age,
  mountain = excluded.mountain,
  hills = excluded.hills,
  flat = excluded.flat,
  time_trial = excluded.time_trial,
  cobbles = excluded.cobbles,
  sprint = excluded.sprint,
  acceleration = excluded.acceleration,
  downhill = excluded.downhill,
  endurance = excluded.endurance,
  resistance = excluded.resistance,
  recovery = excluded.recovery,
  breakaway = excluded.breakaway,
  prologue = excluded.prologue,
  updated_at = now();

comment on table public.longevity_trophy_reward_grants is
  'Sources auditables des trois objets niveau 10 du trophée secret Le Peloton éternel.';
comment on function private.grant_longevity_trophy_for_team(uuid, uuid) is
  'Attribue une seule fois le trophée caché au DS qui emploie un coureur strictement âgé de plus de 90 ans.';

notify pgrst, 'reload schema';

commit;
