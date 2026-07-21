-- ============================================================
-- CYCLING MANAGER — Staff, marché de l'emploi et masse salariale
-- ============================================================

begin;

create table public.staff_members (
  id uuid primary key default gen_random_uuid(),
  country_id uuid not null references public.countries(id) on delete restrict,
  first_name text not null,
  last_name text not null,
  role text not null,
  level smallint not null,
  trainer_specialty text,
  created_at timestamptz not null default now(),

  constraint staff_members_first_name_not_empty check (btrim(first_name) <> ''),
  constraint staff_members_last_name_not_empty check (btrim(last_name) <> ''),
  constraint staff_members_role_allowed check (role in (
    'trainer', 'scout', 'doctor', 'mechanic', 'community_manager',
    'nutritionist', 'physiotherapist', 'architect'
  )),
  constraint staff_members_level_range check (level between 1 and 5),
  constraint staff_members_specialty_allowed check (
    trainer_specialty is null
    or trainer_specialty in (
      'mountain', 'hills', 'flat', 'sprint', 'time_trial', 'cobbles', 'endurance'
    )
  ),
  constraint staff_members_trainer_specialty_shape check (
    (role = 'trainer' and trainer_specialty is not null)
    or (role <> 'trainer' and trainer_specialty is null)
  )
);

create index staff_members_country_role_idx
  on public.staff_members (country_id, role, level desc);

create table public.staff_market_batches (
  id uuid primary key default gen_random_uuid(),
  market_date date not null unique,
  staff_count smallint not null default 25,
  generated_at timestamptz not null default now(),
  constraint staff_market_batches_count check (staff_count = 25)
);

create table public.staff_market_listings (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.staff_market_batches(id) on delete cascade,
  staff_member_id uuid not null unique references public.staff_members(id) on delete restrict,
  daily_slot smallint not null,
  signing_fee numeric(12, 2) not null,
  salary_per_season numeric(12, 2) not null,
  currency_code text not null default 'EUR',
  status text not null default 'available',
  hired_team_id uuid references public.teams(id) on delete restrict,
  hired_at timestamptz,
  created_at timestamptz not null default now(),

  constraint staff_market_listings_slot_range check (daily_slot between 1 and 25),
  constraint staff_market_listings_slot_unique unique (batch_id, daily_slot),
  constraint staff_market_listings_costs_positive check (
    signing_fee > 0 and salary_per_season > 0
  ),
  constraint staff_market_listings_currency check (currency_code ~ '^[A-Z]{3}$'),
  constraint staff_market_listings_status_allowed check (
    status in ('available', 'hired', 'expired')
  ),
  constraint staff_market_listings_hiring_shape check (
    (status = 'hired' and hired_team_id is not null and hired_at is not null)
    or (status <> 'hired' and hired_team_id is null and hired_at is null)
  )
);

create index staff_market_listings_batch_status_idx
  on public.staff_market_listings (batch_id, status, daily_slot);

create table public.staff_contracts (
  id uuid primary key default gen_random_uuid(),
  staff_member_id uuid not null references public.staff_members(id) on delete restrict,
  team_id uuid not null references public.teams(id) on delete restrict,
  start_season_id uuid not null references public.seasons(id) on delete restrict,
  end_season_id uuid references public.seasons(id) on delete restrict,
  salary_per_season numeric(12, 2) not null,
  currency_code text not null default 'EUR',
  signing_fee numeric(12, 2) not null,
  status text not null default 'active',
  signed_at timestamptz not null default now(),
  terminated_at timestamptz,

  constraint staff_contracts_salary_positive check (salary_per_season > 0),
  constraint staff_contracts_signing_fee_positive check (signing_fee > 0),
  constraint staff_contracts_currency check (currency_code ~ '^[A-Z]{3}$'),
  constraint staff_contracts_status_allowed check (
    status in ('active', 'completed', 'terminated', 'cancelled')
  ),
  constraint staff_contracts_termination_shape check (
    (status = 'terminated' and terminated_at is not null)
    or status <> 'terminated'
  )
);

create unique index staff_contracts_one_active_contract_idx
  on public.staff_contracts (staff_member_id)
  where status = 'active';

create index staff_contracts_team_status_idx
  on public.staff_contracts (team_id, status, signed_at);

create table public.staff_rider_assignments (
  id uuid primary key default gen_random_uuid(),
  staff_contract_id uuid not null
    references public.staff_contracts(id) on delete cascade,
  rider_id uuid not null references public.riders(id) on delete cascade,
  status text not null default 'active',
  assigned_at timestamptz not null default now(),
  ended_at timestamptz,

  constraint staff_rider_assignments_status_allowed check (
    status in ('active', 'ended')
  ),
  constraint staff_rider_assignments_end_shape check (
    (status = 'ended' and ended_at is not null)
    or (status = 'active' and ended_at is null)
  )
);

create unique index staff_rider_assignments_one_active_staff_idx
  on public.staff_rider_assignments (staff_contract_id, rider_id)
  where status = 'active';

create unique index staff_rider_assignments_one_active_physio_idx
  on public.staff_rider_assignments (rider_id)
  where status = 'active';

alter table public.staff_members enable row level security;
alter table public.staff_market_batches enable row level security;
alter table public.staff_market_listings enable row level security;
alter table public.staff_contracts enable row level security;
alter table public.staff_rider_assignments enable row level security;

create policy staff_members_read_authenticated
on public.staff_members
for select
to authenticated
using (true);

create policy staff_market_batches_read_authenticated
on public.staff_market_batches
for select
to authenticated
using (true);

create policy staff_market_listings_read_authenticated
on public.staff_market_listings
for select
to authenticated
using (true);

create policy staff_contracts_read_managed_team
on public.staff_contracts
for select
to authenticated
using (
  exists (
    select 1
    from public.team_manager_assignments as assignment
    join public.sporting_directors as director
      on director.id = assignment.sporting_director_id
    where assignment.team_id = staff_contracts.team_id
      and assignment.role = 'general_manager'
      and assignment.status = 'active'
      and director.auth_user_id = auth.uid()
  )
);

create policy staff_rider_assignments_read_managed_team
on public.staff_rider_assignments
for select
to authenticated
using (
  exists (
    select 1
    from public.staff_contracts as contract
    join public.team_manager_assignments as assignment
      on assignment.team_id = contract.team_id
    join public.sporting_directors as director
      on director.id = assignment.sporting_director_id
    where contract.id = staff_rider_assignments.staff_contract_id
      and assignment.role = 'general_manager'
      and assignment.status = 'active'
      and director.auth_user_id = auth.uid()
  )
);

create or replace function public.calculate_staff_salary(
  p_role text,
  p_level integer
)
returns numeric
language plpgsql
immutable
set search_path = public
as $$
declare
  v_base numeric;
  v_multiplier numeric;
  v_level integer := least(5, greatest(1, coalesce(p_level, 1)));
begin
  v_base := case p_role
    when 'trainer' then 18000
    when 'scout' then 15000
    when 'doctor' then 13000
    when 'mechanic' then 11000
    when 'nutritionist' then 10000
    when 'physiotherapist' then 9500
    when 'architect' then 9000
    when 'community_manager' then 8000
    else null
  end;

  if v_base is null then
    raise exception 'Métier de staff invalide.';
  end if;

  v_multiplier := (array[1.00, 1.35, 1.75, 2.25, 3.00]::numeric[])[v_level];
  return round((v_base * v_multiplier) / 500) * 500;
end;
$$;

create or replace function public.calculate_staff_signing_fee(
  p_role text,
  p_level integer
)
returns numeric
language sql
immutable
set search_path = public
as $$
  select greatest(
    1000,
    round(
      public.calculate_staff_salary(p_role, p_level)
      * (0.10 + least(5, greatest(1, coalesce(p_level, 1))) * 0.02)
      / 500
    ) * 500
  );
$$;

create or replace function public.calculate_staff_director_level(
  p_experience_points numeric
)
returns integer
language plpgsql
immutable
set search_path = public
as $$
declare
  v_experience integer := greatest(0, floor(coalesce(p_experience_points, 0))::integer);
  v_level integer := 1;
  v_consumed integer := 0;
  v_required integer := 100;
begin
  while v_experience >= v_consumed + v_required loop
    v_consumed := v_consumed + v_required;
    v_level := v_level + 1;
    v_required := 100 + (v_level - 1) * 50;
  end loop;

  return v_level;
end;
$$;

create or replace function public.get_staff_capacity_for_director_level(
  p_level integer
)
returns integer
language sql
immutable
set search_path = public
as $$
  select case
    when coalesce(p_level, 0) <= 1 then 1
    when p_level = 2 then 2
    when p_level = 3 then 3
    when p_level = 4 then 5
    when p_level = 5 then 7
    when p_level = 6 then 10
    when p_level = 7 then 13
    when p_level = 8 then 17
    when p_level = 9 then 21
    when p_level = 10 then 25
    else least(45, 25 + (p_level - 10) * 4)
  end;
$$;

create or replace function public.get_active_team_staff_level(
  p_team_id uuid,
  p_role text,
  p_trainer_specialty text default null
)
returns integer
language sql
stable
set search_path = public
as $$
  select coalesce(max(member.level), 0)::integer
  from public.staff_contracts as contract
  join public.staff_members as member on member.id = contract.staff_member_id
  where contract.team_id = p_team_id
    and contract.status = 'active'
    and member.role = p_role
    and (
      p_trainer_specialty is null
      or member.trainer_specialty = p_trainer_specialty
    );
$$;

create or replace function public.get_physiotherapist_rider_capacity(
  p_level integer
)
returns integer
language sql
immutable
set search_path = public
as $$
  select (array[2, 4, 6, 9, 12]::integer[])[
    least(5, greatest(1, coalesce(p_level, 1)))
  ];
$$;

create or replace function public.get_active_rider_physiotherapist_level(
  p_team_id uuid,
  p_rider_id uuid
)
returns integer
language sql
stable
set search_path = public
as $$
  select coalesce(max(member.level), 0)::integer
  from public.staff_rider_assignments as staff_assignment
  join public.staff_contracts as contract
    on contract.id = staff_assignment.staff_contract_id
   and contract.status = 'active'
  join public.staff_members as member
    on member.id = contract.staff_member_id
   and member.role = 'physiotherapist'
  where contract.team_id = p_team_id
    and staff_assignment.rider_id = p_rider_id
    and staff_assignment.status = 'active';
$$;

create or replace function public.create_daily_staff_market(
  p_market_date date,
  p_candidates jsonb
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_market_date date := coalesce(
    p_market_date,
    (now() at time zone 'Europe/Paris')::date
  );
  v_batch_id uuid;
  v_candidate jsonb;
  v_staff_member_id uuid;
  v_slot integer := 0;
  v_role text;
  v_level integer;
  v_specialty text;
  v_country_id uuid;
begin
  if jsonb_typeof(p_candidates) <> 'array'
    or jsonb_array_length(p_candidates) <> 25 then
    raise exception 'Le marché du staff exige exactement 25 profils.';
  end if;

  insert into public.staff_market_batches (market_date)
  values (v_market_date)
  on conflict (market_date) do nothing
  returning id into v_batch_id;

  if v_batch_id is null then
    return 0;
  end if;

  update public.staff_market_listings as listing
  set status = 'expired'
  from public.staff_market_batches as batch
  where listing.batch_id = batch.id
    and batch.market_date < v_market_date
    and listing.status = 'available';

  for v_candidate in select value from jsonb_array_elements(p_candidates)
  loop
    v_slot := v_slot + 1;
    v_role := btrim(v_candidate ->> 'role');
    v_level := (v_candidate ->> 'level')::integer;
    v_specialty := nullif(btrim(v_candidate ->> 'trainer_specialty'), '');
    v_country_id := (v_candidate ->> 'country_id')::uuid;

    if v_role not in (
      'trainer', 'scout', 'doctor', 'mechanic', 'community_manager',
      'nutritionist', 'physiotherapist', 'architect'
    ) then
      raise exception 'Métier de staff invalide à la position %.', v_slot;
    end if;

    if v_level not between 1 and 5 then
      raise exception 'Niveau de staff invalide à la position %.', v_slot;
    end if;

    if (v_role = 'trainer' and v_specialty not in (
      'mountain', 'hills', 'flat', 'sprint', 'time_trial', 'cobbles', 'endurance'
    )) or (v_role <> 'trainer' and v_specialty is not null) then
      raise exception 'Spécialité de staff invalide à la position %.', v_slot;
    end if;

    if not exists (
      select 1 from public.countries
      where id = v_country_id and is_active = true
    ) then
      raise exception 'Nationalité de staff invalide à la position %.', v_slot;
    end if;

    insert into public.staff_members (
      country_id,
      first_name,
      last_name,
      role,
      level,
      trainer_specialty
    )
    values (
      v_country_id,
      btrim(v_candidate ->> 'first_name'),
      btrim(v_candidate ->> 'last_name'),
      v_role,
      v_level,
      v_specialty
    )
    returning id into v_staff_member_id;

    insert into public.staff_market_listings (
      batch_id,
      staff_member_id,
      daily_slot,
      signing_fee,
      salary_per_season
    )
    values (
      v_batch_id,
      v_staff_member_id,
      v_slot,
      public.calculate_staff_signing_fee(v_role, v_level),
      public.calculate_staff_salary(v_role, v_level)
    );
  end loop;

  return v_slot;
end;
$$;

create or replace function public.sync_staff_salary_installments(
  p_contract_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_contract record;
  v_team_season record;
  v_regular_installment numeric(14, 2);
  v_amount numeric(14, 2);
begin
  select contract.*, member.first_name, member.last_name
  into v_contract
  from public.staff_contracts as contract
  join public.staff_members as member on member.id = contract.staff_member_id
  where contract.id = p_contract_id;

  if v_contract is null or v_contract.status <> 'active' then
    update public.team_finance_transactions
    set status = 'cancelled'
    where source_reference like 'staff-contract:' || p_contract_id::text || ':%'
      and status = 'pending';
    return;
  end if;

  v_regular_installment := round(v_contract.salary_per_season / 4, 2);

  for v_team_season in
    select team_season.*
    from public.team_seasons as team_season
    join public.seasons as season on season.id = team_season.season_id
    join public.seasons as start_season on start_season.id = v_contract.start_season_id
    left join public.seasons as end_season on end_season.id = v_contract.end_season_id
    where team_season.team_id = v_contract.team_id
      and team_season.status in ('planned', 'active')
      and season.game_year >= start_season.game_year
      and (end_season.id is null or season.game_year <= end_season.game_year)
  loop
    for v_installment in 1..4 loop
      v_amount := case
        when v_installment < 4 then v_regular_installment
        else v_contract.salary_per_season - v_regular_installment * 3
      end;

      insert into public.team_finance_transactions (
        team_season_id,
        season_day_id,
        day_number,
        amount,
        category,
        status,
        description,
        source_reference
      )
      select
        v_team_season.id,
        day.id,
        v_installment * 7,
        -v_amount,
        'staff_salary',
        'pending',
        'Salaire de ' || v_contract.first_name || ' ' || v_contract.last_name
          || ' · échéance ' || v_installment || '/4',
        'staff-contract:' || p_contract_id::text || ':'
          || v_team_season.season_id::text || ':' || v_installment
      from public.season_days as day
      where day.season_id = v_team_season.season_id
        and day.day_number = v_installment * 7
      on conflict (team_season_id, source_reference)
      do update set
        amount = excluded.amount,
        description = excluded.description,
        season_day_id = excluded.season_day_id,
        status = case
          when team_finance_transactions.status = 'posted'
            then team_finance_transactions.status
          else 'pending'
        end;
    end loop;
  end loop;
end;
$$;

create or replace function public.handle_staff_contract_finance_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.sync_staff_salary_installments(new.id);
  return new;
end;
$$;

create trigger staff_contract_finance_sync
after insert or update of status, salary_per_season
on public.staff_contracts
for each row execute function public.handle_staff_contract_finance_change();

create or replace function public.initialize_professional_team_finances(
  p_team_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rider_contract record;
  v_staff_contract record;
begin
  for v_rider_contract in
    select contract.id, contract.rider_id, contract.salary_per_season,
      contract.start_season_id
    from public.rider_contracts as contract
    where contract.team_id = p_team_id
      and contract.status = 'active'
  loop
    if v_rider_contract.salary_per_season <= 0 then
      update public.rider_contracts
      set salary_per_season = public.calculate_rider_season_salary(
        v_rider_contract.rider_id,
        v_rider_contract.start_season_id
      )
      where id = v_rider_contract.id;
    end if;

    perform public.sync_rider_salary_installments(v_rider_contract.id);
  end loop;

  for v_staff_contract in
    select contract.id
    from public.staff_contracts as contract
    where contract.team_id = p_team_id
      and contract.status = 'active'
  loop
    perform public.sync_staff_salary_installments(v_staff_contract.id);
  end loop;
end;
$$;

create or replace function public.hire_current_team_staff(
  p_listing_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_context record;
  v_listing record;
  v_contract_id uuid;
  v_staff_count integer;
  v_director_level integer;
  v_staff_capacity integer;
  v_projected_budget numeric(14, 2);
  v_due_installments integer;
  v_regular_installment numeric(14, 2);
  v_due_salary numeric(14, 2);
begin
  if p_listing_id is null then
    raise exception 'Le profil de staff est obligatoire.';
  end if;

  perform public.settle_current_team_finances();

  select
    director.id as director_id,
    director.experience_points,
    assignment.team_id,
    season.id as season_id,
    season.current_day_number,
    team_season.id as team_season_id,
    team_season.cash_balance,
    team_season.currency,
    season_day.id as season_day_id
  into v_context
  from public.sporting_directors as director
  join public.team_manager_assignments as assignment
    on assignment.sporting_director_id = director.id
    and assignment.role = 'general_manager'
    and assignment.status = 'active'
  join public.seasons as season on season.status = 'active'
  join public.team_seasons as team_season
    on team_season.team_id = assignment.team_id
    and team_season.season_id = season.id
  join public.season_days as season_day
    on season_day.season_id = season.id
    and season_day.day_number = season.current_day_number
  where director.auth_user_id = auth.uid()
    and director.status = 'active'
  limit 1;

  if v_context is null then
    raise exception 'Aucune équipe active ne correspond au Directeur Sportif.';
  end if;

  perform 1
  from public.team_seasons
  where id = v_context.team_season_id
  for update;

  select
    listing.id,
    listing.staff_member_id,
    listing.signing_fee,
    listing.salary_per_season,
    listing.currency_code,
    listing.status,
    batch.market_date,
    member.first_name,
    member.last_name
  into v_listing
  from public.staff_market_listings as listing
  join public.staff_market_batches as batch on batch.id = listing.batch_id
  join public.staff_members as member on member.id = listing.staff_member_id
  where listing.id = p_listing_id
  for update of listing;

  if v_listing is null
    or v_listing.status <> 'available'
    or v_listing.market_date <> (now() at time zone 'Europe/Paris')::date then
    raise exception 'Ce membre du staff n’est plus disponible.';
  end if;

  select count(*)::integer
  into v_staff_count
  from public.staff_contracts
  where team_id = v_context.team_id
    and status = 'active';

  v_director_level := public.calculate_staff_director_level(
    v_context.experience_points
  );
  v_staff_capacity := public.get_staff_capacity_for_director_level(
    v_director_level
  );

  if v_staff_count >= v_staff_capacity then
    raise exception 'Votre niveau de Directeur Sportif limite actuellement le staff à % membre(s).',
      v_staff_capacity;
  end if;

  v_regular_installment := round(v_listing.salary_per_season / 4, 2);
  v_due_installments := least(
    4,
    greatest(0, floor(v_context.current_day_number / 7.0)::integer)
  );
  v_due_salary := case
    when v_due_installments < 4 then v_regular_installment * v_due_installments
    else v_listing.salary_per_season
  end;
  v_projected_budget := public.get_projected_transfer_budget(
    v_context.team_season_id
  );

  if v_context.cash_balance < v_listing.signing_fee + v_due_salary then
    raise exception 'La trésorerie actuelle ne couvre pas la signature et les échéances salariales déjà dues.';
  end if;

  if v_projected_budget < v_listing.signing_fee + v_listing.salary_per_season then
    raise exception 'Le budget projeté ne couvre pas la signature et le salaire de la saison.';
  end if;

  insert into public.staff_contracts (
    staff_member_id,
    team_id,
    start_season_id,
    salary_per_season,
    currency_code,
    signing_fee,
    status
  )
  values (
    v_listing.staff_member_id,
    v_context.team_id,
    v_context.season_id,
    v_listing.salary_per_season,
    v_listing.currency_code,
    v_listing.signing_fee,
    'active'
  )
  returning id into v_contract_id;

  update public.staff_market_listings
  set
    status = 'hired',
    hired_team_id = v_context.team_id,
    hired_at = now()
  where id = v_listing.id;

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
    v_context.team_season_id,
    v_context.season_day_id,
    v_context.current_day_number,
    -v_listing.signing_fee,
    'staff_salary',
    'posted',
    'Prime de signature de ' || v_listing.first_name || ' ' || v_listing.last_name,
    'staff-signing:' || v_contract_id::text,
    now()
  );

  perform public.settle_current_team_finances();
  return v_contract_id;
end;
$$;

create or replace function public.assign_current_team_physiotherapist(
  p_staff_contract_id uuid,
  p_rider_ids uuid[]
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_context record;
  v_rider_ids uuid[] := coalesce(p_rider_ids, array[]::uuid[]);
  v_unique_count integer;
  v_capacity integer;
begin
  select
    contract.id as contract_id,
    contract.team_id,
    member.level
  into v_context
  from public.staff_contracts as contract
  join public.staff_members as member
    on member.id = contract.staff_member_id
   and member.role = 'physiotherapist'
  join public.team_manager_assignments as team_assignment
    on team_assignment.team_id = contract.team_id
   and team_assignment.role = 'general_manager'
   and team_assignment.status = 'active'
  join public.sporting_directors as director
    on director.id = team_assignment.sporting_director_id
   and director.auth_user_id = auth.uid()
   and director.status = 'active'
  where contract.id = p_staff_contract_id
    and contract.status = 'active'
  for update of contract;

  if v_context is null then
    raise exception 'Ce kiné ne fait pas partie du staff actif de votre équipe.';
  end if;

  select count(distinct rider_id)::integer
  into v_unique_count
  from unnest(v_rider_ids) as rider_id;

  if v_unique_count <> cardinality(v_rider_ids) then
    raise exception 'Un coureur ne peut apparaître qu’une fois dans cette affectation.';
  end if;

  v_capacity := public.get_physiotherapist_rider_capacity(v_context.level);
  if v_unique_count > v_capacity then
    raise exception 'Ce kiné de niveau % peut suivre au maximum % coureur(s).',
      v_context.level, v_capacity;
  end if;

  if exists (
    select 1
    from unnest(v_rider_ids) as requested_rider_id
    where not exists (
      select 1
      from public.rider_contracts as rider_contract
      where rider_contract.rider_id = requested_rider_id
        and rider_contract.team_id = v_context.team_id
        and rider_contract.status = 'active'
    )
  ) then
    raise exception 'Un des coureurs sélectionnés ne fait pas partie de votre effectif actif.';
  end if;

  update public.staff_rider_assignments
  set status = 'ended', ended_at = now()
  where staff_contract_id = v_context.contract_id
    and status = 'active'
    and not (rider_id = any(v_rider_ids));

  update public.staff_rider_assignments as staff_assignment
  set status = 'ended', ended_at = now()
  where staff_assignment.rider_id = any(v_rider_ids)
    and staff_assignment.status = 'active'
    and staff_assignment.staff_contract_id <> v_context.contract_id;

  insert into public.staff_rider_assignments (
    staff_contract_id,
    rider_id,
    status,
    assigned_at
  )
  select
    v_context.contract_id,
    rider_id,
    'active',
    now()
  from unnest(v_rider_ids) as rider_id
  where not exists (
    select 1
    from public.staff_rider_assignments as existing
    where existing.staff_contract_id = v_context.contract_id
      and existing.rider_id = rider_id
      and existing.status = 'active'
  );

  return v_unique_count;
end;
$$;

create or replace function public.apply_community_manager_reputation_bonus()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_team_id uuid;
  v_level integer;
  v_bonus numeric(12, 2);
begin
  if new.team_season_id is null
    or new.sporting_director_id is null
    or coalesce(new.reputation_points, 0) <= 0 then
    return new;
  end if;

  select team_id into v_team_id
  from public.team_seasons
  where id = new.team_season_id;

  v_level := public.get_active_team_staff_level(
    v_team_id,
    'community_manager'
  );

  if v_level <= 0 then
    return new;
  end if;

  v_bonus := round(new.reputation_points * (v_level * 2) / 100.0, 2);
  if v_bonus <= 0 then
    return new;
  end if;

  update public.reward_events
  set reputation_points = reputation_points + v_bonus
  where id = new.id;

  update public.sporting_directors
  set reputation_points = reputation_points + v_bonus
  where id = new.sporting_director_id;

  return new;
end;
$$;

create trigger reward_event_community_manager_bonus
after insert
on public.reward_events
for each row execute function public.apply_community_manager_reputation_bonus();

alter table public.rider_injuries
  add column doctor_recovery_hours_reduced smallint not null default 0,
  add constraint rider_injuries_doctor_reduction_non_negative check (
    doctor_recovery_hours_reduced >= 0
  );

create or replace function public.apply_team_doctor_to_new_injury()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_team_id uuid;
  v_doctor_level integer;
  v_reduction_hours integer;
begin
  select contract.team_id
  into v_team_id
  from public.rider_contracts as contract
  where contract.rider_id = new.rider_id
    and contract.status = 'active'
  order by contract.signed_at desc
  limit 1;

  if v_team_id is null then
    return new;
  end if;

  v_doctor_level := public.get_active_team_staff_level(v_team_id, 'doctor');
  if v_doctor_level <= 0 then
    return new;
  end if;

  v_reduction_hours := ceil(
    new.recovery_hours * (v_doctor_level * 6) / 100.0
  )::integer;
  new.doctor_recovery_hours_reduced := v_reduction_hours;
  new.expected_recovery_at := new.expected_recovery_at
    - make_interval(hours => v_reduction_hours);

  return new;
end;
$$;

create trigger rider_injury_team_doctor_reduction
before insert
on public.rider_injuries
for each row execute function public.apply_team_doctor_to_new_injury();

create or replace function public.apply_assigned_physio_to_race_condition()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_team_id uuid;
  v_physio_level integer;
begin
  select team_season.team_id
  into v_team_id
  from public.stages as stage
  join public.race_registrations as registration
    on registration.race_edition_id = stage.race_edition_id
   and registration.status = 'accepted'
  join public.race_rosters as roster
    on roster.race_registration_id = registration.id
   and roster.rider_id = new.rider_id
  join public.team_seasons as team_season
    on team_season.id = registration.team_season_id
  where stage.id = new.stage_id
  limit 1;

  if v_team_id is null then
    return new;
  end if;

  v_physio_level := public.get_active_rider_physiotherapist_level(
    v_team_id,
    new.rider_id
  );
  if v_physio_level <= 0 then
    return new;
  end if;

  new.form_delta := least(-1, new.form_delta + v_physio_level);
  new.form_after := greatest(0, new.form_before + new.form_delta);
  return new;
end;
$$;

create trigger stage_condition_assigned_physio_reduction
before insert
on public.stage_rider_condition_effects
for each row execute function public.apply_assigned_physio_to_race_condition();

create or replace function public.sync_race_finish_form_with_physio_effect()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_adjusted_form integer;
begin
  if new.source <> 'race_finish' then
    return new;
  end if;

  select effect.form_after
  into v_adjusted_form
  from public.stage_rider_condition_effects as effect
  where effect.rider_id = new.rider_id
    and effect.season_day_id = new.season_day_id
  order by effect.applied_at desc
  limit 1;

  if v_adjusted_form is not null then
    new.form := v_adjusted_form;
  end if;
  return new;
end;
$$;

create trigger rider_condition_sync_physio_race_finish
before insert or update of form, source
on public.rider_condition_states
for each row execute function public.sync_race_finish_form_with_physio_effect();

-- L'ancien forfait fictif de 60 000 € est remplacé par les contrats réels.
update public.team_finance_transactions
set status = 'cancelled'
where source_reference like 'staff-salary:%';

update public.team_seasons as team_season
set cash_balance = team_season.opening_cash_balance + coalesce((
  select sum(transaction.amount)
  from public.team_finance_transactions as transaction
  where transaction.team_season_id = team_season.id
    and transaction.status = 'posted'
), 0);

grant select on table public.staff_members to authenticated, service_role;
grant select on table public.staff_market_batches to authenticated, service_role;
grant select on table public.staff_market_listings to authenticated, service_role;
grant select on table public.staff_contracts to authenticated;
grant select on table public.staff_rider_assignments to authenticated;
grant all privileges on table public.staff_members to service_role;
grant all privileges on table public.staff_market_batches to service_role;
grant all privileges on table public.staff_market_listings to service_role;
grant all privileges on table public.staff_contracts to service_role;
grant all privileges on table public.staff_rider_assignments to service_role;

revoke all on function public.create_daily_staff_market(date, jsonb) from public;
grant execute on function public.create_daily_staff_market(date, jsonb) to service_role;

revoke all on function public.hire_current_team_staff(uuid) from public;
grant execute on function public.hire_current_team_staff(uuid) to authenticated;

revoke all on function public.assign_current_team_physiotherapist(uuid, uuid[]) from public;
grant execute on function public.assign_current_team_physiotherapist(uuid, uuid[]) to authenticated;

revoke all on function public.sync_staff_salary_installments(uuid) from public;
grant execute on function public.sync_staff_salary_installments(uuid) to service_role;

comment on table public.staff_members is
  'Identités permanentes des membres du staff, avec métier, niveau et spécialité.';
comment on table public.staff_market_listings is
  'Pool mondial quotidien de 25 membres du staff, commun à tous les joueurs.';
comment on table public.staff_contracts is
  'Contrats actifs du staff et source de vérité de la masse salariale.';
comment on table public.staff_rider_assignments is
  'Coureurs suivis individuellement par les kinés actifs de leur équipe.';
comment on function public.hire_current_team_staff(uuid) is
  'Recrute atomiquement un membre disponible après contrôles de capacité et de solvabilité.';

notify pgrst, 'reload schema';

commit;
