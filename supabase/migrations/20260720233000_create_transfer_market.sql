-- ============================================================
-- CYCLING MANAGER — Marché des transferts
-- ============================================================

begin;

alter table public.rider_contracts
  add column if not exists acquisition_type text not null default 'initial',
  add column if not exists transfer_locked_season_id uuid
    references public.seasons(id) on delete set null;

alter table public.rider_contracts
  add constraint rider_contracts_acquisition_type_allowed
    check (acquisition_type in (
      'initial', 'daily_auction', 'director_auction', 'free_agent', 'renewal'
    ));

create table public.transfer_daily_batches (
  id uuid primary key default gen_random_uuid(),
  market_date date not null unique,
  rider_count smallint not null default 5,
  generated_at timestamptz not null default now(),
  constraint transfer_daily_batches_rider_count check (rider_count = 5)
);

create table public.transfer_market_listings (
  id uuid primary key default gen_random_uuid(),
  rider_id uuid not null references public.riders(id) on delete restrict,
  season_id uuid not null references public.seasons(id) on delete restrict,
  listing_type text not null,
  seller_team_id uuid references public.teams(id) on delete restrict,
  market_date date,
  daily_slot smallint,
  minimum_bid numeric(14, 2) not null,
  salary_per_season numeric(12, 2) not null,
  currency_code text not null default 'EUR',
  opens_at timestamptz not null,
  closes_at timestamptz not null,
  status text not null default 'open',
  winning_team_id uuid references public.teams(id) on delete restrict,
  winning_bid numeric(14, 2),
  settled_at timestamptz,
  created_at timestamptz not null default now(),
  constraint transfer_market_listing_type_allowed
    check (listing_type in ('daily', 'director')),
  constraint transfer_market_listing_status_allowed
    check (status in ('open', 'settled', 'no_bid', 'cancelled')),
  constraint transfer_market_listing_price_positive check (minimum_bid >= 500),
  constraint transfer_market_listing_salary_non_negative check (salary_per_season >= 0),
  constraint transfer_market_listing_currency check (currency_code ~ '^[A-Z]{3}$'),
  constraint transfer_market_listing_dates check (closes_at > opens_at),
  constraint transfer_market_daily_shape check (
    (listing_type = 'daily' and seller_team_id is null and market_date is not null and daily_slot between 1 and 5)
    or
    (listing_type = 'director' and seller_team_id is not null and market_date is null and daily_slot is null)
  ),
  constraint transfer_market_settlement_shape check (
    (status = 'settled' and winning_team_id is not null and winning_bid is not null and settled_at is not null)
    or status <> 'settled'
  ),
  constraint transfer_market_daily_slot_unique unique (listing_type, market_date, daily_slot)
);

create unique index transfer_market_one_open_listing_per_rider_idx
  on public.transfer_market_listings (rider_id)
  where status = 'open';

create index transfer_market_listings_window_idx
  on public.transfer_market_listings (status, closes_at, opens_at);

create index transfer_market_listings_seller_idx
  on public.transfer_market_listings (seller_team_id, created_at desc);

create table public.transfer_market_bids (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.transfer_market_listings(id) on delete cascade,
  team_id uuid not null references public.teams(id) on delete restrict,
  sporting_director_id uuid not null references public.sporting_directors(id) on delete restrict,
  amount numeric(14, 2) not null,
  created_at timestamptz not null default now(),
  constraint transfer_market_bid_amount_positive check (amount >= 500)
);

create index transfer_market_bids_listing_rank_idx
  on public.transfer_market_bids (listing_id, amount desc, created_at asc);

create index transfer_market_bids_team_idx
  on public.transfer_market_bids (team_id, created_at desc);

alter table public.transfer_daily_batches enable row level security;
alter table public.transfer_market_listings enable row level security;
alter table public.transfer_market_bids enable row level security;

create or replace function public.calculate_rider_overall(
  p_rider_id uuid,
  p_season_id uuid
)
returns numeric
language sql
stable
set search_path = public
as $$
  select round((
    mountain + hills + flat + time_trial + cobbles + sprint + acceleration
    + downhill + endurance + resistance + recovery + breakaway + prologue
  )::numeric / 13, 2)
  from public.rider_season_ratings
  where rider_id = p_rider_id and season_id = p_season_id;
$$;

create or replace function public.calculate_market_random_stat(
  p_seed text,
  p_key text,
  p_minimum integer default 42,
  p_maximum integer default 70
)
returns integer
language sql
immutable
set search_path = public
as $$
  select p_minimum + (
    (hashtextextended(p_seed || ':' || p_key, 0) % (p_maximum - p_minimum + 1)
      + (p_maximum - p_minimum + 1)) % (p_maximum - p_minimum + 1)
  )::integer;
$$;

create or replace function public.ensure_transfer_next_season(
  p_active_season_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_current public.seasons%rowtype;
  v_next_id uuid;
begin
  select * into v_current
  from public.seasons
  where id = p_active_season_id;

  if v_current is null then
    raise exception 'La saison active est introuvable.';
  end if;

  insert into public.seasons (
    game_year, name, starts_on, ends_on, status, current_day_number
  )
  values (
    v_current.game_year + 1,
    'Saison ' || (v_current.game_year + 1),
    v_current.ends_on + 1,
    v_current.ends_on + 28,
    'planned',
    1
  )
  on conflict (game_year) do update set
    name = excluded.name
  returning id into v_next_id;

  insert into public.season_days (season_id, day_number, calendar_date, label)
  select v_next_id, day_number, v_current.ends_on + day_number,
    'Jour ' || day_number
  from generate_series(1, 28) as day_number
  on conflict (season_id, day_number) do update set
    calendar_date = excluded.calendar_date,
    label = excluded.label;

  return v_next_id;
end;
$$;

create or replace function public.get_projected_transfer_budget(
  p_team_season_id uuid
)
returns numeric
language sql
stable
set search_path = public
as $$
  select greatest(
    0,
    team_season.cash_balance + coalesce((
      select sum(transaction.amount)
      from public.team_finance_transactions as transaction
      where transaction.team_season_id = team_season.id
        and transaction.status = 'pending'
    ), 0)
  )
  from public.team_seasons as team_season
  where team_season.id = p_team_season_id;
$$;

create or replace function public.create_daily_transfer_market(
  p_market_date date,
  p_rider_identities jsonb,
  p_force boolean default false
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_market_date date := coalesce(p_market_date, (now() at time zone 'Europe/Paris')::date);
  v_open_at timestamptz;
  v_close_at timestamptz;
  v_active_season public.seasons%rowtype;
  v_identity jsonb;
  v_slot integer;
  v_rider_id uuid;
  v_seed text;
  v_age integer;
  v_overall numeric;
  v_adjustment integer;
  v_salary numeric;
  v_minimum_bid numeric;
  v_country_profile text;
begin
  v_open_at := (v_market_date + time '09:00') at time zone 'Europe/Paris';
  v_close_at := (v_market_date + time '18:00') at time zone 'Europe/Paris';

  if not p_force and now() < v_open_at then
    return 0;
  end if;

  if jsonb_typeof(p_rider_identities) <> 'array'
    or jsonb_array_length(p_rider_identities) <> 5 then
    raise exception 'Le marché quotidien exige exactement cinq identités.';
  end if;

  select * into v_active_season
  from public.seasons
  where status = 'active'
  limit 1;

  if v_active_season is null then
    raise exception 'Aucune saison active n’est disponible.';
  end if;

  insert into public.transfer_daily_batches (market_date)
  values (v_market_date)
  on conflict (market_date) do nothing;

  if not found then
    return 0;
  end if;

  for v_identity, v_slot in
    select value, ordinality::integer
    from jsonb_array_elements(p_rider_identities) with ordinality
  loop
    if coalesce(v_identity ->> 'first_name', '') = ''
      or coalesce(v_identity ->> 'last_name', '') = '' then
      raise exception 'Une identité de coureur est incomplète.';
    end if;

    select profile.name_profile_code
    into v_country_profile
    from public.countries as country
    join public.country_rider_generation_profiles as profile
      on profile.country_id = country.id
    where country.id = (v_identity ->> 'country_id')::uuid
      and country.is_active = true;

    if v_country_profile is null then
      raise exception 'Le pays d’un coureur ne permet pas sa génération.';
    end if;

    insert into public.riders (
      country_id, first_name, last_name, status, generated_name_profile_code
    )
    values (
      (v_identity ->> 'country_id')::uuid,
      left(btrim(v_identity ->> 'first_name'), 80),
      left(btrim(v_identity ->> 'last_name'), 80),
      'free_agent',
      v_country_profile
    )
    returning id into v_rider_id;

    v_seed := v_market_date::text || ':' || v_slot::text || ':' || v_rider_id::text;
    v_age := public.calculate_market_random_stat(v_seed, 'age', 18, 30);

    insert into public.rider_season_ratings (
      rider_id, season_id, age, mountain, hills, flat, time_trial, cobbles,
      sprint, acceleration, downhill, endurance, resistance, recovery,
      breakaway, prologue
    )
    values (
      v_rider_id, v_active_season.id, v_age,
      public.calculate_market_random_stat(v_seed, 'mountain'),
      public.calculate_market_random_stat(v_seed, 'hills'),
      public.calculate_market_random_stat(v_seed, 'flat'),
      public.calculate_market_random_stat(v_seed, 'time_trial'),
      public.calculate_market_random_stat(v_seed, 'cobbles'),
      public.calculate_market_random_stat(v_seed, 'sprint'),
      public.calculate_market_random_stat(v_seed, 'acceleration'),
      public.calculate_market_random_stat(v_seed, 'downhill'),
      public.calculate_market_random_stat(v_seed, 'endurance'),
      public.calculate_market_random_stat(v_seed, 'resistance'),
      public.calculate_market_random_stat(v_seed, 'recovery'),
      public.calculate_market_random_stat(v_seed, 'breakaway'),
      public.calculate_market_random_stat(v_seed, 'prologue')
    );

    v_overall := public.calculate_rider_overall(v_rider_id, v_active_season.id);
    if v_overall > 65 then
      v_adjustment := ceil(v_overall - 65)::integer;
      update public.rider_season_ratings set
        mountain = greatest(0, mountain - v_adjustment),
        hills = greatest(0, hills - v_adjustment),
        flat = greatest(0, flat - v_adjustment),
        time_trial = greatest(0, time_trial - v_adjustment),
        cobbles = greatest(0, cobbles - v_adjustment),
        sprint = greatest(0, sprint - v_adjustment),
        acceleration = greatest(0, acceleration - v_adjustment),
        downhill = greatest(0, downhill - v_adjustment),
        endurance = greatest(0, endurance - v_adjustment),
        resistance = greatest(0, resistance - v_adjustment),
        recovery = greatest(0, recovery - v_adjustment),
        breakaway = greatest(0, breakaway - v_adjustment),
        prologue = greatest(0, prologue - v_adjustment)
      where rider_id = v_rider_id and season_id = v_active_season.id;
      v_overall := public.calculate_rider_overall(v_rider_id, v_active_season.id);
    end if;

    v_salary := public.calculate_rider_season_salary(v_rider_id, v_active_season.id);
    v_minimum_bid := greatest(
      2500,
      round((3000 + power(greatest(0, v_overall - 45), 2) * 80
        + greatest(0, 24 - v_age) * 250) / 500) * 500
    );

    insert into public.transfer_market_listings (
      rider_id, season_id, listing_type, market_date, daily_slot,
      minimum_bid, salary_per_season, opens_at, closes_at
    )
    values (
      v_rider_id, v_active_season.id, 'daily', v_market_date, v_slot,
      v_minimum_bid, v_salary, v_open_at, v_close_at
    );
  end loop;

  return 5;
exception
  when others then
    delete from public.transfer_daily_batches where market_date = v_market_date;
    raise;
end;
$$;

create or replace function public.complete_transfer_listing(
  p_listing_id uuid,
  p_winning_team_id uuid,
  p_winning_bid numeric
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_listing public.transfer_market_listings%rowtype;
  v_season public.seasons%rowtype;
  v_next_season_id uuid;
  v_buyer_team_season_id uuid;
  v_seller_team_season_id uuid;
  v_new_contract_id uuid;
begin
  select * into v_listing
  from public.transfer_market_listings
  where id = p_listing_id
  for update;

  if v_listing is null or v_listing.status <> 'open' then
    raise exception 'Cette enchère n’est plus ouverte.';
  end if;

  select * into v_season from public.seasons where id = v_listing.season_id;
  v_next_season_id := public.ensure_transfer_next_season(v_season.id);

  select id into v_buyer_team_season_id
  from public.team_seasons
  where team_id = p_winning_team_id and season_id = v_season.id
  for update;

  if v_buyer_team_season_id is null then
    raise exception 'L’équipe gagnante ne participe pas à la saison active.';
  end if;

  if v_listing.seller_team_id is not null then
    select id into v_seller_team_season_id
    from public.team_seasons
    where team_id = v_listing.seller_team_id and season_id = v_season.id
    for update;
  end if;

  update public.rider_contracts
  set status = 'terminated'
  where rider_id = v_listing.rider_id and status = 'active';

  update public.rider_contracts
  set status = 'cancelled'
  where rider_id = v_listing.rider_id and status = 'planned';

  delete from public.rider_equipment_pending_assignments
  where rider_id = v_listing.rider_id;
  delete from public.rider_equipment_assignments
  where rider_id = v_listing.rider_id;

  insert into public.rider_contracts (
    rider_id, team_id, start_season_id, end_season_id, salary_per_season,
    currency, currency_code, status, signed_at, acquisition_type,
    transfer_locked_season_id
  )
  values (
    v_listing.rider_id, p_winning_team_id, v_season.id, v_next_season_id,
    v_listing.salary_per_season, v_listing.currency_code, v_listing.currency_code,
    'active', now(),
    case when v_listing.listing_type = 'daily' then 'daily_auction' else 'director_auction' end,
    v_season.id
  )
  on conflict (rider_id, team_id, start_season_id) do update set
    end_season_id = excluded.end_season_id,
    salary_per_season = excluded.salary_per_season,
    currency = excluded.currency,
    currency_code = excluded.currency_code,
    status = 'active',
    signed_at = excluded.signed_at,
    acquisition_type = excluded.acquisition_type,
    transfer_locked_season_id = excluded.transfer_locked_season_id
  returning id into v_new_contract_id;

  update public.riders set status = 'active' where id = v_listing.rider_id;

  insert into public.team_finance_transactions (
    team_season_id, day_number, amount, category, status, description,
    source_reference, posted_at
  )
  select v_buyer_team_season_id, coalesce(v_season.current_day_number, 1),
    -p_winning_bid, 'transfer', 'posted',
    'Transfert entrant · ' || rider.first_name || ' ' || rider.last_name,
    'transfer-purchase:' || v_listing.id::text, now()
  from public.riders as rider where rider.id = v_listing.rider_id;

  update public.team_seasons
  set cash_balance = cash_balance - p_winning_bid
  where id = v_buyer_team_season_id;

  if v_seller_team_season_id is not null then
    insert into public.team_finance_transactions (
      team_season_id, day_number, amount, category, status, description,
      source_reference, posted_at
    )
    select v_seller_team_season_id, coalesce(v_season.current_day_number, 1),
      p_winning_bid, 'transfer', 'posted',
      'Transfert sortant · ' || rider.first_name || ' ' || rider.last_name,
      'transfer-sale:' || v_listing.id::text, now()
    from public.riders as rider where rider.id = v_listing.rider_id;

    update public.team_seasons
    set cash_balance = cash_balance + p_winning_bid
    where id = v_seller_team_season_id;
  end if;

  update public.transfer_market_listings set
    status = 'settled', winning_team_id = p_winning_team_id,
    winning_bid = p_winning_bid, settled_at = now()
  where id = v_listing.id;

  return v_new_contract_id;
end;
$$;

create or replace function public.settle_transfer_market()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_listing public.transfer_market_listings%rowtype;
  v_bid record;
  v_team_season_id uuid;
  v_available numeric;
  v_settled integer := 0;
  v_has_winner boolean;
begin
  for v_listing in
    select * from public.transfer_market_listings
    where status = 'open' and closes_at <= now()
    order by closes_at, id
    for update skip locked
  loop
    v_has_winner := false;

    for v_bid in
      select candidate.* from (
        select distinct on (bid.team_id)
          bid.team_id, bid.amount, bid.created_at
        from public.transfer_market_bids as bid
        where bid.listing_id = v_listing.id
        order by bid.team_id, bid.amount desc, bid.created_at asc
      ) as candidate
      order by candidate.amount desc, candidate.created_at asc, candidate.team_id
    loop
      select id into v_team_season_id
      from public.team_seasons
      where team_id = v_bid.team_id and season_id = v_listing.season_id
      for update;

      v_available := public.get_projected_transfer_budget(v_team_season_id);
      if v_team_season_id is not null
        and v_available >= v_bid.amount + v_listing.salary_per_season then
        perform public.complete_transfer_listing(
          v_listing.id, v_bid.team_id, v_bid.amount
        );
        v_has_winner := true;
        v_settled := v_settled + 1;
        exit;
      end if;
    end loop;

    if not v_has_winner then
      update public.transfer_market_listings set
        status = 'no_bid', settled_at = now()
      where id = v_listing.id;

      if v_listing.listing_type = 'daily' then
        update public.riders set status = 'free_agent'
        where id = v_listing.rider_id;
      end if;
      v_settled := v_settled + 1;
    end if;
  end loop;

  return v_settled;
end;
$$;

create or replace function public.place_transfer_bid(
  p_listing_id uuid,
  p_amount numeric
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_context record;
  v_listing public.transfer_market_listings%rowtype;
  v_current_amount numeric;
  v_minimum_amount numeric;
  v_reserved numeric;
  v_available numeric;
  v_bid_id uuid;
begin
  perform public.settle_transfer_market();

  select director.id as director_id, assignment.team_id,
    team_season.id as team_season_id
  into v_context
  from public.sporting_directors as director
  join public.team_manager_assignments as assignment
    on assignment.sporting_director_id = director.id
    and assignment.role = 'general_manager' and assignment.status = 'active'
  join public.seasons as season on season.status = 'active'
  join public.team_seasons as team_season
    on team_season.team_id = assignment.team_id and team_season.season_id = season.id
  where director.auth_user_id = auth.uid() and director.status = 'active'
  limit 1;

  if v_context is null then raise exception 'Aucune équipe active ne correspond au DS.'; end if;

  select * into v_listing from public.transfer_market_listings
  where id = p_listing_id for update;

  if v_listing is null or v_listing.status <> 'open'
    or now() < v_listing.opens_at or now() >= v_listing.closes_at then
    raise exception 'Cette enchère n’est pas ouverte.';
  end if;
  if v_listing.seller_team_id = v_context.team_id then
    raise exception 'Vous ne pouvez pas enchérir sur votre propre coureur.';
  end if;

  select max(amount) into v_current_amount
  from public.transfer_market_bids where listing_id = v_listing.id;
  v_minimum_amount := case
    when v_current_amount is null then v_listing.minimum_bid
    else v_current_amount + greatest(500, ceil(v_current_amount * 0.02 / 100) * 100)
  end;

  if p_amount is null or p_amount < v_minimum_amount then
    raise exception 'La prochaine offre doit atteindre au moins % €.', v_minimum_amount;
  end if;

  with leaders as (
    select distinct on (bid.listing_id)
      bid.listing_id, bid.team_id,
      bid.amount + listing.salary_per_season as amount
    from public.transfer_market_bids as bid
    join public.transfer_market_listings as listing on listing.id = bid.listing_id
    where listing.status = 'open' and listing.id <> v_listing.id
    order by bid.listing_id, bid.amount desc, bid.created_at asc
  )
  select coalesce(sum(amount), 0) into v_reserved
  from leaders where team_id = v_context.team_id;

  v_available := public.get_projected_transfer_budget(v_context.team_season_id);
  if v_available - v_reserved < p_amount + v_listing.salary_per_season then
    raise exception 'Votre budget disponible ne couvre pas l’offre et la première saison de salaire.';
  end if;

  insert into public.transfer_market_bids (
    listing_id, team_id, sporting_director_id, amount
  ) values (
    v_listing.id, v_context.team_id, v_context.director_id, p_amount
  ) returning id into v_bid_id;

  return v_bid_id;
end;
$$;

create or replace function public.create_director_transfer_listing(
  p_rider_id uuid,
  p_minimum_bid numeric
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_context record;
  v_contract public.rider_contracts%rowtype;
  v_listing_id uuid;
  v_salary numeric;
begin
  perform public.settle_transfer_market();

  select director.id as director_id, assignment.team_id, season.id as season_id
  into v_context
  from public.sporting_directors as director
  join public.team_manager_assignments as assignment
    on assignment.sporting_director_id = director.id
    and assignment.role = 'general_manager' and assignment.status = 'active'
  join public.seasons as season on season.status = 'active'
  where director.auth_user_id = auth.uid() and director.status = 'active'
  limit 1;

  if v_context is null then raise exception 'Aucune équipe active ne correspond au DS.'; end if;
  if p_minimum_bid < 500 or p_minimum_bid > 1000000 then
    raise exception 'Le prix d’appel doit être compris entre 500 € et 1 000 000 €.';
  end if;

  select * into v_contract from public.rider_contracts
  where rider_id = p_rider_id and team_id = v_context.team_id and status = 'active'
  for update;

  if v_contract is null then raise exception 'Ce coureur n’appartient pas à votre équipe.'; end if;
  if v_contract.transfer_locked_season_id = v_context.season_id then
    raise exception 'Un coureur recruté cette saison ne peut pas être revendu avant la saison suivante.';
  end if;
  if exists (select 1 from public.transfer_market_listings where rider_id = p_rider_id and status = 'open') then
    raise exception 'Ce coureur est déjà proposé sur le marché.';
  end if;

  v_salary := public.calculate_rider_season_salary(p_rider_id, v_context.season_id);
  insert into public.transfer_market_listings (
    rider_id, season_id, listing_type, seller_team_id, minimum_bid,
    salary_per_season, opens_at, closes_at
  ) values (
    p_rider_id, v_context.season_id, 'director', v_context.team_id,
    round(p_minimum_bid / 100) * 100, v_salary, now(), now() + interval '24 hours'
  ) returning id into v_listing_id;

  return v_listing_id;
end;
$$;

create or replace function public.sign_current_team_free_agent(
  p_rider_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_context record;
  v_next_season_id uuid;
  v_salary numeric;
  v_contract_id uuid;
begin
  perform public.settle_transfer_market();

  select assignment.team_id, season.id as season_id,
    team_season.id as team_season_id
  into v_context
  from public.sporting_directors as director
  join public.team_manager_assignments as assignment
    on assignment.sporting_director_id = director.id
    and assignment.role = 'general_manager' and assignment.status = 'active'
  join public.seasons as season on season.status = 'active'
  join public.team_seasons as team_season
    on team_season.team_id = assignment.team_id and team_season.season_id = season.id
  where director.auth_user_id = auth.uid() and director.status = 'active'
  limit 1;

  if v_context is null then raise exception 'Aucune équipe active ne correspond au DS.'; end if;
  if not exists (select 1 from public.riders where id = p_rider_id and status = 'free_agent')
    or exists (select 1 from public.rider_contracts where rider_id = p_rider_id and status = 'active') then
    raise exception 'Ce coureur n’est plus agent libre.';
  end if;
  if exists (select 1 from public.transfer_market_listings where rider_id = p_rider_id and status = 'open') then
    raise exception 'Ce coureur est encore engagé dans une enchère.';
  end if;

  v_salary := public.calculate_rider_season_salary(p_rider_id, v_context.season_id);
  if public.get_projected_transfer_budget(v_context.team_season_id) < v_salary then
    raise exception 'La trésorerie projetée ne permet pas d’assumer ce salaire.';
  end if;
  v_next_season_id := public.ensure_transfer_next_season(v_context.season_id);

  insert into public.rider_contracts (
    rider_id, team_id, start_season_id, end_season_id, salary_per_season,
    currency, currency_code, status, signed_at, acquisition_type,
    transfer_locked_season_id
  ) values (
    p_rider_id, v_context.team_id, v_context.season_id, v_next_season_id,
    v_salary, 'EUR', 'EUR', 'active', now(), 'free_agent', v_context.season_id
  ) returning id into v_contract_id;

  update public.riders set status = 'active' where id = p_rider_id;
  return v_contract_id;
end;
$$;

create or replace function public.renew_current_team_rider(
  p_rider_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_context record;
  v_current_contract public.rider_contracts%rowtype;
  v_next_season_id uuid;
  v_overall numeric;
  v_salary numeric;
  v_contract_id uuid;
begin
  select assignment.team_id, season.id as season_id, season.game_year
  into v_context
  from public.sporting_directors as director
  join public.team_manager_assignments as assignment
    on assignment.sporting_director_id = director.id
    and assignment.role = 'general_manager' and assignment.status = 'active'
  join public.seasons as season on season.status = 'active'
  where director.auth_user_id = auth.uid() and director.status = 'active'
  limit 1;

  if v_context is null then raise exception 'Aucune équipe active ne correspond au DS.'; end if;
  select * into v_current_contract from public.rider_contracts
  where rider_id = p_rider_id and team_id = v_context.team_id and status = 'active'
  for update;
  if v_current_contract is null then raise exception 'Ce coureur n’appartient pas à votre équipe.'; end if;

  if exists (
    select 1
    from public.seasons as contract_end
    where contract_end.id = v_current_contract.end_season_id
      and contract_end.game_year > v_context.game_year
  ) then
    raise exception 'Ce coureur est déjà sous contrat pour la saison suivante.';
  end if;

  v_next_season_id := public.ensure_transfer_next_season(v_context.season_id);
  if exists (
    select 1 from public.rider_contracts
    where rider_id = p_rider_id and start_season_id = v_next_season_id
      and status in ('planned', 'active')
  ) then raise exception 'Le contrat de ce coureur est déjà renouvelé.'; end if;

  v_overall := public.calculate_rider_overall(p_rider_id, v_context.season_id);
  v_salary := case when v_overall < 60 then 0
    else public.calculate_rider_season_salary(p_rider_id, v_context.season_id) end;

  insert into public.rider_contracts (
    rider_id, team_id, start_season_id, end_season_id, salary_per_season,
    currency, currency_code, status, signed_at, acquisition_type
  ) values (
    p_rider_id, v_context.team_id, v_next_season_id, v_next_season_id,
    v_salary, 'EUR', 'EUR', 'planned', now(), 'renewal'
  ) returning id into v_contract_id;

  return v_contract_id;
end;
$$;

grant select on table
  public.transfer_daily_batches,
  public.transfer_market_listings,
  public.transfer_market_bids,
  public.country_rider_generation_profiles
to service_role;

grant all privileges on table
  public.transfer_daily_batches,
  public.transfer_market_listings,
  public.transfer_market_bids
to service_role;

revoke all on function public.create_daily_transfer_market(date, jsonb, boolean) from public;
grant execute on function public.create_daily_transfer_market(date, jsonb, boolean) to service_role;
revoke all on function public.settle_transfer_market() from public;
grant execute on function public.settle_transfer_market() to service_role;
revoke all on function public.complete_transfer_listing(uuid, uuid, numeric) from public;
grant execute on function public.complete_transfer_listing(uuid, uuid, numeric) to service_role;
revoke all on function public.ensure_transfer_next_season(uuid) from public;
grant execute on function public.ensure_transfer_next_season(uuid) to service_role;
revoke all on function public.place_transfer_bid(uuid, numeric) from public;
grant execute on function public.place_transfer_bid(uuid, numeric) to authenticated;
revoke all on function public.create_director_transfer_listing(uuid, numeric) from public;
grant execute on function public.create_director_transfer_listing(uuid, numeric) to authenticated;
revoke all on function public.sign_current_team_free_agent(uuid) from public;
grant execute on function public.sign_current_team_free_agent(uuid) to authenticated;
revoke all on function public.renew_current_team_rider(uuid) from public;
grant execute on function public.renew_current_team_rider(uuid) to authenticated;

notify pgrst, 'reload schema';

commit;
