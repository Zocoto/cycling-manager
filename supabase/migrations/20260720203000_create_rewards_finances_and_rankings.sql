-- ============================================================
-- CYCLING MANAGER
-- Récompenses, finances saisonnières et classements UCI
-- ============================================================

begin;

-- Le budget historique est conservé pour compatibilité. Le solde de trésorerie
-- devient la source de vérité et peut être négatif après une charge automatique.
alter table public.team_seasons
  drop constraint if exists team_seasons_operating_budget_non_negative,
  drop constraint if exists team_seasons_spent_budget_non_negative,
  drop constraint if exists team_seasons_spending_within_budget;

alter table public.team_seasons
  add column if not exists cash_balance numeric(14, 2) not null default 0,
  add column if not exists opening_cash_balance numeric(14, 2) not null default 0,
  add column if not exists negative_season_streak smallint not null default 0,
  add column if not exists next_sponsor_budget_bonus_percent numeric(5, 2)
    not null default 0;

alter table public.team_seasons
  add constraint team_seasons_negative_streak_non_negative
    check (negative_season_streak >= 0),
  add constraint team_seasons_sponsor_bonus_range
    check (
      next_sponsor_budget_bonus_percent >= 0
      and next_sponsor_budget_bonus_percent <= 14
    );

-- Les quatre divisions ont des frontières exclusives : 1-20, 21-50,
-- 51-100 et 101-200. En dessous, l'équipe reste amateur/non classée.
insert into public.divisions (
  code,
  name,
  rank_order,
  default_team_limit,
  description,
  is_active
)
values
  ('elite', 'Élite', 1, 20, 'Positions 1 à 20 du classement par équipes.', true),
  ('world', 'World', 2, 30, 'Positions 21 à 50 du classement par équipes.', true),
  ('continental', 'Continentale', 3, 50, 'Positions 51 à 100 du classement par équipes.', true),
  ('national', 'Nationale', 4, 100, 'Positions 101 à 200 du classement par équipes.', true)
on conflict (code)
do update set
  name = excluded.name,
  rank_order = excluded.rank_order,
  default_team_limit = excluded.default_team_limit,
  description = excluded.description,
  is_active = excluded.is_active;

create table public.team_finance_transactions (
  id uuid primary key default gen_random_uuid(),
  team_season_id uuid not null
    references public.team_seasons(id)
    on delete cascade,
  season_day_id uuid
    references public.season_days(id)
    on delete set null,
  day_number smallint not null,
  amount numeric(14, 2) not null,
  category text not null,
  status text not null default 'pending',
  description text not null,
  source_reference text not null,
  created_at timestamptz not null default now(),
  posted_at timestamptz,

  constraint team_finance_transactions_day_range
    check (day_number between 1 and 28),
  constraint team_finance_transactions_amount_non_zero
    check (amount <> 0),
  constraint team_finance_transactions_category_allowed
    check (
      category in (
        'sponsor',
        'race_prize',
        'rider_salary',
        'staff_salary',
        'equipment',
        'building',
        'transfer',
        'training',
        'other'
      )
    ),
  constraint team_finance_transactions_status_allowed
    check (status in ('pending', 'posted', 'cancelled')),
  constraint team_finance_transactions_description_not_empty
    check (btrim(description) <> ''),
  constraint team_finance_transactions_source_not_empty
    check (btrim(source_reference) <> ''),
  constraint team_finance_transactions_source_unique
    unique (team_season_id, source_reference)
);

create index team_finance_transactions_team_day_idx
  on public.team_finance_transactions (team_season_id, day_number, status);

create table public.team_finance_alerts (
  id uuid primary key default gen_random_uuid(),
  team_season_id uuid not null
    references public.team_seasons(id)
    on delete cascade,
  checkpoint_day_number smallint not null,
  balance numeric(14, 2) not null,
  severity text not null,
  reputation_penalty integer not null default 0,
  message text not null,
  created_at timestamptz not null default now(),

  constraint team_finance_alerts_checkpoint_allowed
    check (checkpoint_day_number in (7, 14, 21, 28)),
  constraint team_finance_alerts_severity_allowed
    check (severity in ('warning', 'critical', 'forced_recovery')),
  constraint team_finance_alerts_penalty_non_negative
    check (reputation_penalty >= 0),
  constraint team_finance_alerts_unique
    unique (team_season_id, checkpoint_day_number)
);

create table public.reward_events (
  id uuid primary key default gen_random_uuid(),
  source_reference text not null unique,
  source_type text not null,
  sporting_director_id uuid
    references public.sporting_directors(id)
    on delete set null,
  team_season_id uuid
    references public.team_seasons(id)
    on delete set null,
  rider_id uuid
    references public.riders(id)
    on delete set null,
  country_id uuid
    references public.countries(id)
    on delete set null,
  reputation_points integer not null default 0,
  experience_points integer not null default 0,
  cash_prize numeric(14, 2) not null default 0,
  uci_points integer not null default 0,
  description text not null,
  created_at timestamptz not null default now(),

  constraint reward_events_source_type_allowed
    check (
      source_type in (
        'race_result',
        'stage_result',
        'mountain_prime',
        'intermediate_sprint',
        'secondary_classification',
        'game_objective',
        'sponsor_objective',
        'division_bonus'
      )
    ),
  constraint reward_events_values_non_negative
    check (
      reputation_points >= 0
      and experience_points >= 0
      and cash_prize >= 0
      and uci_points >= 0
    ),
  constraint reward_events_description_not_empty
    check (btrim(description) <> '')
);

create index reward_events_team_season_idx
  on public.reward_events (team_season_id, created_at desc);
create index reward_events_rider_idx
  on public.reward_events (rider_id, created_at desc);
create index reward_events_country_idx
  on public.reward_events (country_id, created_at desc);

alter table public.team_finance_transactions enable row level security;
alter table public.team_finance_alerts enable row level security;
alter table public.reward_events enable row level security;

create policy team_finance_transactions_select_managed
on public.team_finance_transactions
for select
to authenticated
using (
  exists (
    select 1
    from public.team_seasons
    join public.team_manager_assignments
      on team_manager_assignments.team_id = team_seasons.team_id
      and team_manager_assignments.role = 'general_manager'
      and team_manager_assignments.status = 'active'
    join public.sporting_directors
      on sporting_directors.id = team_manager_assignments.sporting_director_id
    where team_seasons.id = team_finance_transactions.team_season_id
      and sporting_directors.auth_user_id = auth.uid()
  )
);

create policy team_finance_alerts_select_managed
on public.team_finance_alerts
for select
to authenticated
using (
  exists (
    select 1
    from public.team_seasons
    join public.team_manager_assignments
      on team_manager_assignments.team_id = team_seasons.team_id
      and team_manager_assignments.role = 'general_manager'
      and team_manager_assignments.status = 'active'
    join public.sporting_directors
      on sporting_directors.id = team_manager_assignments.sporting_director_id
    where team_seasons.id = team_finance_alerts.team_season_id
      and sporting_directors.auth_user_id = auth.uid()
  )
);

create policy reward_events_select_authenticated
on public.reward_events
for select
to authenticated
using (true);

-- Calcule le salaire pro à partir de la moyenne générale et du palmarès UCI.
create or replace function public.calculate_rider_season_salary(
  p_rider_id uuid,
  p_season_id uuid
)
returns numeric
language sql
stable
set search_path = public
as $$
  with rating as (
    select (
      mountain + hills + flat + time_trial + cobbles + sprint
      + acceleration + downhill + endurance + resistance + recovery
      + breakaway + prologue
    )::numeric / 13 as overall
    from public.rider_season_ratings
    where rider_id = p_rider_id
      and season_id = p_season_id
  ),
  pedigree as (
    select coalesce(max(summary.points), 0)::numeric as previous_points
    from public.rider_season_summaries as summary
    join public.seasons as summary_season
      on summary_season.id = summary.season_id
    join public.seasons as target_season
      on target_season.id = p_season_id
    where summary.rider_id = p_rider_id
      and summary_season.game_year < target_season.game_year
  )
  select round(
    greatest(
      2500,
      least(
        150000,
        2500
        + power(greatest(0, (coalesce(rating.overall, 45) - 45) / 55), 2) * 100000
        + least(37500, pedigree.previous_points * 30)
      )
    ) / 100
  ) * 100
  from rating
  cross join pedigree;
$$;

create or replace function public.sync_rider_salary_installments(
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
  v_amount numeric(14, 2);
begin
  select contract.*
  into v_contract
  from public.rider_contracts as contract
  where contract.id = p_contract_id;

  if v_contract is null or v_contract.status <> 'active' then
    update public.team_finance_transactions
    set status = 'cancelled'
    where source_reference like 'rider-salary:' || p_contract_id::text || ':%'
      and status = 'pending';
    return;
  end if;

  for v_team_season in
    select team_season.*
    from public.team_seasons as team_season
    join public.seasons as season on season.id = team_season.season_id
    join public.seasons as start_season on start_season.id = v_contract.start_season_id
    join public.seasons as end_season on end_season.id = v_contract.end_season_id
    where team_season.team_id = v_contract.team_id
      and season.game_year between start_season.game_year and end_season.game_year
  loop
    v_amount := coalesce(v_contract.salary_per_season, 0);

    if v_amount <= 0 then
      continue;
    end if;

    for v_installment in 1..4 loop
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
        case
          when v_installment < 4 then -round(v_amount / 4, 2)
          else -(v_amount - round(v_amount / 4, 2) * 3)
        end,
        'rider_salary',
        'pending',
        'Salaire de ' || rider.first_name || ' ' || rider.last_name
          || ' · échéance ' || v_installment || '/4',
        'rider-salary:' || p_contract_id::text || ':'
          || v_team_season.season_id::text || ':' || v_installment
      from public.riders as rider
      join public.season_days as day
        on day.season_id = v_team_season.season_id
        and day.day_number = v_installment * 7
      where rider.id = v_contract.rider_id
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

create or replace function public.initialize_professional_team_finances(
  p_team_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_contract record;
  v_team_season record;
begin
  for v_contract in
    select contract.id, contract.rider_id, contract.salary_per_season,
      contract.start_season_id
    from public.rider_contracts as contract
    where contract.team_id = p_team_id
      and contract.status = 'active'
  loop
    if v_contract.salary_per_season <= 0 then
      update public.rider_contracts
      set salary_per_season = public.calculate_rider_season_salary(
        v_contract.rider_id,
        v_contract.start_season_id
      )
      where id = v_contract.id;
    end if;

    perform public.sync_rider_salary_installments(v_contract.id);
  end loop;

  for v_team_season in
    select team_season.*
    from public.team_seasons as team_season
    where team_season.team_id = p_team_id
      and team_season.status in ('planned', 'active')
  loop
    for v_installment in 1..4 loop
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
        -15000,
        'staff_salary',
        'pending',
        'Salaires du staff · échéance ' || v_installment || '/4',
        'staff-salary:' || v_team_season.season_id::text || ':' || v_installment
      from public.season_days as day
      where day.season_id = v_team_season.season_id
        and day.day_number = v_installment * 7
      on conflict (team_season_id, source_reference) do nothing;
    end loop;
  end loop;
end;
$$;

create or replace function public.sync_sponsor_installments(
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
  v_budget numeric(14, 2);
begin
  select contract.*, sponsor.name as sponsor_name
  into v_contract
  from public.team_sponsor_contracts as contract
  join public.sponsors as sponsor on sponsor.id = contract.sponsor_id
  where contract.id = p_contract_id;

  if v_contract is null or v_contract.status <> 'active' then
    update public.team_finance_transactions
    set status = 'cancelled'
    where source_reference like 'sponsor:' || p_contract_id::text || ':%'
      and status = 'pending';
    return;
  end if;

  perform public.initialize_professional_team_finances(v_contract.team_id);

  for v_team_season in
    select team_season.*
    from public.team_seasons as team_season
    join public.seasons as season on season.id = team_season.season_id
    join public.seasons as start_season on start_season.id = v_contract.start_season_id
    left join public.seasons as end_season on end_season.id = v_contract.end_season_id
    where team_season.team_id = v_contract.team_id
      and season.game_year >= start_season.game_year
      and (end_season.id is null or season.game_year <= end_season.game_year)
  loop
    v_budget := v_contract.budget_per_season
      * (1 + least(14, v_team_season.next_sponsor_budget_bonus_percent) / 100);

    for v_installment in 1..4 loop
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
        case
          when v_installment < 4 then round(v_budget / 4, 2)
          else v_budget - round(v_budget / 4, 2) * 3
        end,
        'sponsor',
        'pending',
        'Versement ' || v_contract.sponsor_name || ' · échéance '
          || v_installment || '/4',
        'sponsor:' || p_contract_id::text || ':'
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

create or replace function public.handle_finance_contract_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_table_name = 'team_sponsor_contracts' then
    perform public.sync_sponsor_installments(new.id);
  elsif tg_table_name = 'rider_contracts' then
    perform public.sync_rider_salary_installments(new.id);
  end if;
  return new;
end;
$$;

create trigger team_sponsor_contract_finance_sync
after insert or update of status, budget_per_season
on public.team_sponsor_contracts
for each row execute function public.handle_finance_contract_change();

create trigger rider_contract_finance_sync
after insert or update of status, salary_per_season
on public.rider_contracts
for each row execute function public.handle_finance_contract_change();

create or replace function public.refresh_uci_rankings(p_season_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  with ranked_teams as (
    select
      team_season.id,
      row_number() over (
        order by team_season.points desc, team_season.display_name, team_season.id
      )::integer as ranking_position
    from public.team_seasons as team_season
    where team_season.season_id = p_season_id
      and team_season.status <> 'withdrawn'
  )
  update public.team_seasons as team_season
  set
    final_rank = ranked.ranking_position,
    division_id = division.id
  from ranked_teams as ranked
  left join public.divisions as division
    on division.code = case
      when ranked.ranking_position between 1 and 20 then 'elite'
      when ranked.ranking_position between 21 and 50 then 'world'
      when ranked.ranking_position between 51 and 100 then 'continental'
      when ranked.ranking_position between 101 and 200 then 'national'
      else null
    end
  where team_season.id = ranked.id;

  with ranked_riders as (
    select
      summary.id,
      row_number() over (
        order by coalesce(summary.points, 0) desc, rider.last_name,
          rider.first_name, rider.id
      )::integer as ranking_position
    from public.rider_season_summaries as summary
    join public.riders as rider on rider.id = summary.rider_id
    where summary.season_id = p_season_id
  )
  update public.rider_season_summaries as summary
  set uci_rank = ranked.ranking_position,
      updated_at = now()
  from ranked_riders as ranked
  where summary.id = ranked.id;
end;
$$;

create or replace function public.settle_current_team_finances()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_context record;
  v_checkpoint integer;
  v_checkpoint_balance numeric(14, 2);
  v_previous_negative boolean;
  v_penalty integer;
begin
  select
    team_season.id as team_season_id,
    team_season.opening_cash_balance,
    season.current_day_number,
    sporting_director.id as sporting_director_id
  into v_context
  from public.sporting_directors as sporting_director
  join public.team_manager_assignments as assignment
    on assignment.sporting_director_id = sporting_director.id
    and assignment.role = 'general_manager'
    and assignment.status = 'active'
  join public.seasons as season on season.status = 'active'
  join public.team_seasons as team_season
    on team_season.team_id = assignment.team_id
    and team_season.season_id = season.id
  where sporting_director.auth_user_id = auth.uid()
  limit 1;

  if v_context is null then
    raise exception 'Aucune équipe active ne correspond au Directeur Sportif.';
  end if;

  update public.team_finance_transactions
  set status = 'posted', posted_at = coalesce(posted_at, now())
  where team_season_id = v_context.team_season_id
    and status = 'pending'
    and day_number <= v_context.current_day_number;

  update public.team_seasons
  set cash_balance = opening_cash_balance + coalesce((
    select sum(transaction.amount)
    from public.team_finance_transactions as transaction
    where transaction.team_season_id = v_context.team_season_id
      and transaction.status = 'posted'
  ), 0)
  where id = v_context.team_season_id;

  foreach v_checkpoint in array array[7, 14, 21, 28]
  loop
    if v_checkpoint > v_context.current_day_number then
      continue;
    end if;

    if exists (
      select 1 from public.team_finance_alerts
      where team_season_id = v_context.team_season_id
        and checkpoint_day_number = v_checkpoint
    ) then
      continue;
    end if;

    select v_context.opening_cash_balance + coalesce(sum(transaction.amount), 0)
    into v_checkpoint_balance
    from public.team_finance_transactions as transaction
    where transaction.team_season_id = v_context.team_season_id
      and transaction.status = 'posted'
      and transaction.day_number <= v_checkpoint;

    if v_checkpoint_balance < 0 then
      select exists (
        select 1
        from public.team_finance_alerts
        where team_season_id = v_context.team_season_id
          and checkpoint_day_number < v_checkpoint
          and balance < 0
      ) into v_previous_negative;

      v_penalty := case
        when v_previous_negative then least(
          35,
          10 + ceil(abs(v_checkpoint_balance) / 25000)::integer * 2
        )
        else 0
      end;

      insert into public.team_finance_alerts (
        team_season_id,
        checkpoint_day_number,
        balance,
        severity,
        reputation_penalty,
        message
      )
      values (
        v_context.team_season_id,
        v_checkpoint,
        v_checkpoint_balance,
        case when v_previous_negative then 'critical' else 'warning' end,
        v_penalty,
        case
          when v_previous_negative then
            'La dette n’a pas été résorbée depuis le précédent contrôle : '
              || v_penalty || ' points de réputation sont retirés.'
          else
            'Trésorerie négative : le solde doit redevenir positif avant le prochain contrôle hebdomadaire.'
        end
      );

      if v_penalty > 0 then
        update public.sporting_directors
        set reputation_points = greatest(0, reputation_points - v_penalty)
        where id = v_context.sporting_director_id;
      end if;
    end if;
  end loop;
end;
$$;

create or replace function public.record_current_team_expense(
  p_amount numeric,
  p_category text,
  p_description text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_context record;
  v_transaction_id uuid;
begin
  if p_amount <= 0 then
    raise exception 'Le montant doit être strictement positif.';
  end if;

  if p_category not in ('equipment', 'building', 'transfer', 'training', 'other') then
    raise exception 'Catégorie de dépense non autorisée.';
  end if;

  perform public.settle_current_team_finances();

  select
    team_season.id as team_season_id,
    team_season.cash_balance,
    season.current_day_number,
    season_day.id as season_day_id
  into v_context
  from public.sporting_directors as sporting_director
  join public.team_manager_assignments as assignment
    on assignment.sporting_director_id = sporting_director.id
    and assignment.role = 'general_manager'
    and assignment.status = 'active'
  join public.seasons as season on season.status = 'active'
  join public.team_seasons as team_season
    on team_season.team_id = assignment.team_id
    and team_season.season_id = season.id
  join public.season_days as season_day
    on season_day.season_id = season.id
    and season_day.day_number = season.current_day_number
  where sporting_director.auth_user_id = auth.uid()
  limit 1;

  if v_context.cash_balance <= 0 or v_context.cash_balance < p_amount then
    raise exception 'Trésorerie insuffisante : aucune nouvelle dépense ne peut être engagée.';
  end if;

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
    -p_amount,
    p_category,
    'posted',
    btrim(p_description),
    'manual:' || gen_random_uuid()::text,
    now()
  )
  returning id into v_transaction_id;

  update public.team_seasons
  set cash_balance = cash_balance - p_amount
  where id = v_context.team_season_id;

  return v_transaction_id;
end;
$$;

-- Point d'entrée idempotent du futur moteur de résultats. Les mêmes points UCI
-- alimentent le coureur, son équipe et, par agrégation, sa nation.
create or replace function public.apply_competition_reward(
  p_source_reference text,
  p_source_type text,
  p_rider_id uuid,
  p_reputation_points integer,
  p_experience_points integer,
  p_cash_prize numeric,
  p_uci_points integer,
  p_description text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_context record;
  v_reward_id uuid;
begin
  select
    rider.country_id,
    rider_contract.team_id,
    team_season.id as team_season_id,
    team_season.season_id,
    sporting_director.id as sporting_director_id,
    season.current_day_number,
    season_day.id as season_day_id
  into v_context
  from public.riders as rider
  join public.rider_contracts as rider_contract
    on rider_contract.rider_id = rider.id
    and rider_contract.status = 'active'
  join public.seasons as season on season.status = 'active'
  join public.team_seasons as team_season
    on team_season.team_id = rider_contract.team_id
    and team_season.season_id = season.id
  left join public.team_manager_assignments as assignment
    on assignment.team_id = rider_contract.team_id
    and assignment.role = 'general_manager'
    and assignment.status = 'active'
  left join public.sporting_directors as sporting_director
    on sporting_director.id = assignment.sporting_director_id
  join public.season_days as season_day
    on season_day.season_id = season.id
    and season_day.day_number = season.current_day_number
  where rider.id = p_rider_id
  limit 1;

  if v_context is null then
    raise exception 'Le coureur ne possède pas de contexte de saison actif.';
  end if;

  insert into public.reward_events (
    source_reference,
    source_type,
    sporting_director_id,
    team_season_id,
    rider_id,
    country_id,
    reputation_points,
    experience_points,
    cash_prize,
    uci_points,
    description
  )
  values (
    btrim(p_source_reference),
    p_source_type,
    v_context.sporting_director_id,
    v_context.team_season_id,
    p_rider_id,
    v_context.country_id,
    greatest(0, p_reputation_points),
    greatest(0, p_experience_points),
    greatest(0, p_cash_prize),
    greatest(0, p_uci_points),
    btrim(p_description)
  )
  on conflict (source_reference) do nothing
  returning id into v_reward_id;

  if v_reward_id is null then
    select id into v_reward_id
    from public.reward_events
    where source_reference = btrim(p_source_reference);
    return v_reward_id;
  end if;

  update public.sporting_directors
  set
    reputation_points = reputation_points + greatest(0, p_reputation_points),
    experience_points = experience_points + greatest(0, p_experience_points)
  where id = v_context.sporting_director_id;

  update public.team_seasons
  set
    points = points + greatest(0, p_uci_points),
    cash_balance = cash_balance + greatest(0, p_cash_prize)
  where id = v_context.team_season_id;

  insert into public.rider_season_summaries (
    rider_id,
    season_id,
    victories,
    points
  )
  values (
    p_rider_id,
    v_context.season_id,
    case when p_source_type in ('race_result', 'stage_result')
      and p_reputation_points > 0 then 1 else 0 end,
    greatest(0, p_uci_points)
  )
  on conflict (rider_id, season_id)
  do update set
    victories = coalesce(rider_season_summaries.victories, 0)
      + excluded.victories,
    points = coalesce(rider_season_summaries.points, 0) + excluded.points,
    updated_at = now();

  if p_cash_prize > 0 then
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
      p_cash_prize,
      'race_prize',
      'posted',
      p_description,
      'reward:' || p_source_reference,
      now()
    )
    on conflict (team_season_id, source_reference) do nothing;
  end if;

  perform public.refresh_uci_rankings(v_context.season_id);
  return v_reward_id;
end;
$$;

-- Convertit les contrats déjà actifs au nouveau paiement hebdomadaire.
do $$
declare
  v_contract record;
begin
  for v_contract in
    select id from public.team_sponsor_contracts where status = 'active'
  loop
    perform public.sync_sponsor_installments(v_contract.id);
  end loop;
end;
$$;

do $$
declare
  v_season record;
begin
  for v_season in select id from public.seasons
  loop
    perform public.refresh_uci_rankings(v_season.id);
  end loop;
end;
$$;

revoke all on function public.settle_current_team_finances() from public;
grant execute on function public.settle_current_team_finances() to authenticated;

revoke all on function public.record_current_team_expense(numeric, text, text) from public;
grant execute on function public.record_current_team_expense(numeric, text, text) to authenticated;

revoke all on function public.apply_competition_reward(
  text, text, uuid, integer, integer, numeric, integer, text
) from public;
grant execute on function public.apply_competition_reward(
  text, text, uuid, integer, integer, numeric, integer, text
) to service_role;

revoke all on function public.refresh_uci_rankings(uuid) from public;
grant execute on function public.refresh_uci_rankings(uuid) to service_role;

grant select on public.team_finance_transactions to authenticated;
grant select on public.team_finance_alerts to authenticated;
grant select on public.reward_events to authenticated;

comment on table public.reward_events is
  'Journal idempotent des gains de réputation, expérience, primes et points UCI.';
comment on table public.team_finance_transactions is
  'Registre réel et prévisionnel des entrées et sorties de trésorerie d’une équipe.';
comment on function public.apply_competition_reward(
  text, text, uuid, integer, integer, numeric, integer, text
) is
  'Applique une récompense sportive une seule fois au DS, au coureur et à son équipe.';

notify pgrst, 'reload schema';

commit;
