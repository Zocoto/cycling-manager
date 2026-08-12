begin;
-- A season rollover is a single, durable settlement.  The primary key makes a
-- retry harmless and gives operations a compact audit trail.
create table if not exists public.season_rollover_settlements (
  source_season_id uuid primary key references public.seasons(id) on delete restrict,
  target_season_id uuid not null unique references public.seasons(id) on delete restrict,
  copied_rider_count integer not null default 0,
  promoted_youth_count integer not null default 0,
  released_youth_count integer not null default 0,
  carried_team_count integer not null default 0,
  settled_at timestamptz not null default now(),
  constraint season_rollover_counts_non_negative check (
    copied_rider_count >= 0
    and promoted_youth_count >= 0
    and released_youth_count >= 0
    and carried_team_count >= 0
  )
);
alter table public.season_rollover_settlements enable row level security;
-- Financial closure must run after sponsor objectives (aaa) and before the
-- existing aaa_team_season_sponsor_objective_closure trigger, specifically,
-- target team row is copied by the division trigger.
drop trigger if exists team_season_financial_closure on public.team_seasons;
drop trigger if exists bbb_team_season_financial_closure on public.team_seasons;
create trigger bbb_team_season_financial_closure
after update of status on public.team_seasons
for each row execute function public.close_team_finances_when_season_completes();
-- Future sponsor preparation can pre-create a team_seasons row.  Updating only
-- its division used to discard the closing balance and debt/sponsor state.
create or replace function public.assign_next_season_team_division(
  p_team_season_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_current public.team_seasons%rowtype;
  v_next_season_id uuid;
  v_next_division_id uuid;
begin
  select team_season.*
  into v_current
  from public.team_seasons as team_season
  where team_season.id = p_team_season_id
  for update;

  if v_current is null then
    raise exception 'Saison d equipe introuvable.';
  end if;
  if v_current.status <> 'completed' then
    raise exception 'La division suivante ne peut etre attribuee qu a la cloture.';
  end if;

  if v_current.final_rank is null then
    perform public.refresh_uci_rankings(v_current.season_id);
    select team_season.* into v_current
    from public.team_seasons as team_season
    where team_season.id = p_team_season_id;
  end if;

  select public.ensure_transfer_next_season(v_current.season_id)
  into v_next_season_id;

  select division.id
  into v_next_division_id
  from public.divisions as division
  where division.code = case
    when v_current.final_rank between 1 and 20 then 'elite'
    when v_current.final_rank between 21 and 50 then 'world'
    when v_current.final_rank between 51 and 100 then 'continental'
    when v_current.final_rank between 101 and 200 then 'national'
    else null
  end;

  insert into public.team_seasons (
    team_id, season_id, division_id, registration_country_id,
    display_name, short_name, points, final_rank, operating_budget,
    spent_budget, currency_code, currency, opening_cash_balance,
    cash_balance, negative_season_streak,
    next_sponsor_budget_bonus_percent, finance_start_day_number, status
  )
  values (
    v_current.team_id, v_next_season_id, v_next_division_id,
    v_current.registration_country_id, v_current.display_name,
    v_current.short_name, 0, null, 0, 0, v_current.currency_code,
    v_current.currency, v_current.cash_balance, v_current.cash_balance,
    v_current.negative_season_streak,
    v_current.next_sponsor_budget_bonus_percent, 1, 'planned'
  )
  on conflict (team_id, season_id) do update set
    division_id = excluded.division_id,
    opening_cash_balance = excluded.opening_cash_balance,
    cash_balance = excluded.cash_balance,
    negative_season_streak = excluded.negative_season_streak,
    next_sponsor_budget_bonus_percent = excluded.next_sponsor_budget_bonus_percent,
    finance_start_day_number = 1,
    points = 0,
    final_rank = null,
    operating_budget = 0,
    spent_budget = 0;
end;
$$;
-- A contract with a not-yet-created end season must still be bounded by its
-- duration.  Previously a NULL end season scheduled payments forever.
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
  v_installment integer;
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
      and season.game_year between start_season.game_year
        and start_season.game_year + v_contract.contract_duration_seasons - 1
      and (end_season.id is null or season.game_year <= end_season.game_year)
  loop
    v_budget := v_contract.budget_per_season
      * (1 + least(7, v_team_season.next_sponsor_budget_bonus_percent) / 100);

    for v_installment in 1..4 loop
      insert into public.team_finance_transactions (
        team_season_id, season_day_id, day_number, amount, category,
        status, description, source_reference
      )
      select
        v_team_season.id, day.id, v_installment * 7,
        case when v_installment < 4 then round(v_budget / 4, 2)
          else v_budget - round(v_budget / 4, 2) * 3 end,
        'sponsor', 'pending',
        'Versement ' || v_contract.sponsor_name || ' - echeance '
          || v_installment || '/4',
        'sponsor:' || p_contract_id::text || ':'
          || v_team_season.season_id::text || ':' || v_installment
      from public.season_days as day
      where day.season_id = v_team_season.season_id
        and day.day_number = v_installment * 7
      on conflict (team_season_id, source_reference) do update set
        amount = excluded.amount,
        description = excluded.description,
        season_day_id = excluded.season_day_id,
        status = case when team_finance_transactions.status = 'posted'
          then team_finance_transactions.status else 'pending' end;
    end loop;
  end loop;
end;
$$;
create or replace function public.get_season_rollover_readiness(
  p_source_season_id uuid
)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with source as (
    select * from public.seasons where id = p_source_season_id
  ), target as (
    select season.*
    from public.seasons as season, source
    where season.game_year = source.game_year + 1
  )
  select jsonb_build_object(
    'sourceSeasonId', source.id,
    'sourceStatus', source.status,
    'targetSeasonId', target.id,
    'targetStatus', target.status,
    'due', (timezone('Europe/Paris', now())::date > source.ends_on),
    'unfinishedRaceEditions', (
      select count(*) from public.race_editions as edition
      where edition.season_id = source.id
        and edition.status not in ('completed', 'cancelled')
    ),
    'sourceTeams', (
      select count(*) from public.team_seasons as team_season
      where team_season.season_id = source.id
        and team_season.status <> 'withdrawn'
    ),
    'targetTeams', (
      select count(*) from public.team_seasons as team_season
      where team_season.season_id = target.id
        and team_season.status <> 'withdrawn'
    ),
    'sourceRiderRatings', (
      select count(*) from public.rider_season_ratings as rating
      where rating.season_id = source.id
    ),
    'targetRiderRatings', (
      select count(*) from public.rider_season_ratings as rating
      where rating.season_id = target.id
    ),
    'plannedSponsorWithoutJersey', (
      select count(*) from public.team_sponsor_contracts as contract
      where contract.start_season_id = target.id
        and contract.status = 'planned'
        and (contract.selected_jersey_id is null
          or contract.selected_jersey_style is null)
    ),
    'alreadySettled', exists (
      select 1 from public.season_rollover_settlements as settlement
      where settlement.source_season_id = source.id
    )
  )
  from source
  left join target on true;
$$;
create or replace function public.rollover_game_season(
  p_source_season_id uuid,
  p_force boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_source public.seasons%rowtype;
  v_target public.seasons%rowtype;
  v_target_id uuid;
  v_existing public.season_rollover_settlements%rowtype;
  v_team record;
  v_sponsor record;
  v_youth record;
  v_new_rider_id uuid;
  v_unfinished_races integer;
  v_copied_riders integer := 0;
  v_promoted_youth integer := 0;
  v_released_youth integer := 0;
  v_carried_teams integer := 0;
  v_missing_team_count integer;
  v_missing_rating_count integer;
  v_remaining_planned_contracts integer;
begin
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('cycling-manager:season-rollover', 0)
  );

  select settlement.* into v_existing
  from public.season_rollover_settlements as settlement
  where settlement.source_season_id = p_source_season_id;

  if v_existing is not null then
    return jsonb_build_object(
      'sourceSeasonId', v_existing.source_season_id,
      'targetSeasonId', v_existing.target_season_id,
      'copiedRiderCount', v_existing.copied_rider_count,
      'promotedYouthCount', v_existing.promoted_youth_count,
      'releasedYouthCount', v_existing.released_youth_count,
      'carriedTeamCount', v_existing.carried_team_count,
      'settledAt', v_existing.settled_at,
      'idempotentReplay', true
    );
  end if;

  select season.* into v_source
  from public.seasons as season
  where season.id = p_source_season_id
  for update;

  if v_source is null or v_source.status <> 'active' then
    raise exception 'La saison source doit etre active.';
  end if;
  if not p_force
    and timezone('Europe/Paris', now())::date <= v_source.ends_on then
    raise exception 'La saison ne peut pas etre cloturee avant le lendemain du jour 28.';
  end if;

  select public.ensure_transfer_next_season(v_source.id) into v_target_id;
  select season.* into v_target
  from public.seasons as season
  where season.id = v_target_id
  for update;

  if v_target.status <> 'planned' then
    raise exception 'La saison cible doit etre planifiee.';
  end if;

  select count(*)::integer into v_unfinished_races
  from public.race_editions as edition
  where edition.season_id = v_source.id
    and edition.status not in ('completed', 'cancelled');

  if v_unfinished_races > 0 and not p_force then
    raise exception '% edition(s) de course ne sont pas encore terminees.',
      v_unfinished_races;
  end if;

  perform public.refresh_uci_rankings(v_source.id);

  for v_team in
    select team_season.id
    from public.team_seasons as team_season
    where team_season.season_id = v_source.id
      and team_season.status <> 'withdrawn'
    order by team_season.id
  loop
    perform public.settle_due_equipment_assignments(v_team.id);
  end loop;

  -- This fires sponsor objectives, financial closure, and division carry-over
  -- in that order (aaa, bbb, then team_season_division_closure).
  update public.team_seasons
  set status = 'completed'
  where season_id = v_source.id
    and status = 'active';

  select count(*)::integer into v_carried_teams
  from public.team_seasons
  where season_id = v_target.id
    and status <> 'withdrawn';

  -- Staff and manager rewards still need their active assignment during team
  -- financial closure, so their expiry happens only now.
  update public.staff_rider_assignments as assignment
  set status = 'ended', ended_at = coalesce(assignment.ended_at, now())
  where assignment.status = 'active'
    and exists (
      select 1 from public.staff_contracts as contract
      where contract.id = assignment.staff_contract_id
        and contract.status = 'active'
        and contract.end_season_id = v_source.id
    );

  update public.staff_contracts
  set status = 'completed'
  where status = 'active'
    and end_season_id = v_source.id;

  update public.team_manager_assignments
  set status = 'completed'
  where status = 'active'
    and end_season_id = v_source.id;

  update public.team_manager_assignments
  set status = 'active'
  where status = 'planned'
    and start_season_id = v_target.id;

  -- Completing the season activates the existing contract/archive/trophy hooks.
  update public.seasons
  set status = 'completed', current_day_number = 28
  where id = v_source.id;

  insert into public.rider_season_ratings (
    rider_id, season_id, age, mountain, hills, flat, time_trial, cobbles,
    sprint, acceleration, downhill, endurance, resistance, recovery,
    breakaway, prologue
  )
  select
    rating.rider_id, v_target.id, least(60, rating.age + 1)::smallint,
    rating.mountain, rating.hills, rating.flat, rating.time_trial,
    rating.cobbles, rating.sprint, rating.acceleration, rating.downhill,
    rating.endurance, rating.resistance, rating.recovery,
    rating.breakaway, rating.prologue
  from public.rider_season_ratings as rating
  join public.riders as rider on rider.id = rating.rider_id
  where rating.season_id = v_source.id
    and rider.status <> 'retired'
  on conflict (rider_id, season_id) do nothing;
  get diagnostics v_copied_riders = row_count;

  -- Keep the latest effective pro-training choices, while dropping a trainer
  -- whose contract expired with the source season.
  insert into public.team_training_setting_versions (
    team_id, season_id, minimum_form, effective_from_day_number
  )
  select distinct on (setting.team_id)
    setting.team_id, v_target.id, setting.minimum_form, 1
  from public.team_training_setting_versions as setting
  where setting.season_id = v_source.id
  order by setting.team_id, setting.effective_from_day_number desc, setting.created_at desc
  on conflict (team_id, season_id, effective_from_day_number) do nothing;

  insert into public.rider_training_plan_versions (
    rider_id, team_id, season_id, intensity, domain,
    trainer_contract_id, effective_from_day_number
  )
  select distinct on (plan.rider_id)
    plan.rider_id, plan.team_id, v_target.id, plan.intensity, plan.domain,
    case when trainer.status = 'active' then plan.trainer_contract_id else null end,
    1
  from public.rider_training_plan_versions as plan
  left join public.staff_contracts as trainer on trainer.id = plan.trainer_contract_id
  where plan.season_id = v_source.id
    and exists (
      select 1 from public.rider_contracts as contract
      join public.seasons as start_season on start_season.id = contract.start_season_id
      join public.seasons as end_season on end_season.id = contract.end_season_id
      where contract.rider_id = plan.rider_id
        and contract.team_id = plan.team_id
        and contract.status in ('active', 'planned')
        and v_target.game_year between start_season.game_year and end_season.game_year
    )
  order by plan.rider_id, plan.effective_from_day_number desc, plan.created_at desc
  on conflict (rider_id, season_id, effective_from_day_number) do nothing;

  -- Purchased/reward inventory is seasonal storage, but ownership survives.
  insert into public.team_equipment_inventory (
    team_season_id, equipment_item_id, quantity, last_purchase_price,
    acquired_at, updated_at
  )
  select target_team.id, inventory.equipment_item_id, inventory.quantity,
    inventory.last_purchase_price, inventory.acquired_at, now()
  from public.team_equipment_inventory as inventory
  join public.team_seasons as source_team on source_team.id = inventory.team_season_id
  join public.team_seasons as target_team
    on target_team.team_id = source_team.team_id
    and target_team.season_id = v_target.id
  where source_team.season_id = v_source.id
  on conflict (team_season_id, equipment_item_id) do update set
    quantity = greatest(public.team_equipment_inventory.quantity, excluded.quantity),
    last_purchase_price = case
      when excluded.quantity > public.team_equipment_inventory.quantity
        then excluded.last_purchase_price
      else public.team_equipment_inventory.last_purchase_price end,
    updated_at = now();

  -- Close the old transfer window. Bids have no reservation row; cancelled
  -- listings are automatically excluded from the live reserved-balance query.
  update public.transfer_market_listings
  set status = 'cancelled', settled_at = coalesce(settled_at, now())
  where season_id = v_source.id and status = 'open';

  update public.direct_transfer_offers
  set status = 'cancelled', responded_at = coalesce(responded_at, now())
  where season_id = v_source.id and status = 'pending';

  -- Partner equipment contracts are inclusive of end_season_id.
  update public.equipment_partner_contracts as contract
  set status = 'completed', completed_at = coalesce(contract.completed_at, now())
  from public.seasons as end_season
  where end_season.id = contract.end_season_id
    and contract.status = 'active'
    and end_season.game_year < v_target.game_year;

  delete from public.rider_equipment_pending_assignments as pending
  using public.rider_contracts as rider_contract,
    public.equipment_partner_products as product,
    public.equipment_partner_contracts as partner_contract
  where rider_contract.rider_id = pending.rider_id
    and rider_contract.team_id = partner_contract.team_id
    and rider_contract.status = 'active'
    and product.equipment_item_id = pending.equipment_item_id
    and product.supplier_key = partner_contract.supplier_key
    and partner_contract.status = 'completed';

  delete from public.rider_equipment_assignments as assignment
  using public.rider_contracts as rider_contract,
    public.equipment_partner_products as product,
    public.equipment_partner_contracts as partner_contract
  where rider_contract.rider_id = assignment.rider_id
    and rider_contract.team_id = partner_contract.team_id
    and rider_contract.status = 'active'
    and product.equipment_item_id = assignment.equipment_item_id
    and product.supplier_key = partner_contract.supplier_key
    and partner_contract.status = 'completed';

  insert into public.team_equipment_inventory (
    team_season_id, equipment_item_id, quantity, last_purchase_price
  )
  select target_team.id, product.equipment_item_id, 35, 0
  from public.equipment_partner_contracts as contract
  join public.seasons as start_season on start_season.id = contract.start_season_id
  join public.seasons as end_season on end_season.id = contract.end_season_id
  join public.team_seasons as target_team
    on target_team.team_id = contract.team_id
    and target_team.season_id = v_target.id
  join public.equipment_partner_products as product
    on product.supplier_key = contract.supplier_key
  where contract.status = 'active'
    and v_target.game_year between start_season.game_year and end_season.game_year
    and (product.offer_type = 'core' or exists (
      select 1 from public.equipment_partner_offers as offer
      where offer.contract_id = contract.id
        and offer.equipment_item_id = product.equipment_item_id
        and offer.status = 'claimed'
    ))
  on conflict (team_season_id, equipment_item_id) do update set
    quantity = greatest(public.team_equipment_inventory.quantity, 35),
    last_purchase_price = 0,
    updated_at = now();

  -- Resolve end_season_id when that future season exists. Payment scheduling is
  -- still duration-bounded when it does not.
  update public.team_sponsor_contracts as contract
  set end_season_id = end_season.id
  from public.seasons as start_season, public.seasons as end_season
  where start_season.id = contract.start_season_id
    and end_season.game_year = start_season.game_year
      + contract.contract_duration_seasons - 1
    and contract.end_season_id is null;

  -- Objectives must be finalized while the old principal contract is active.
  update public.team_sponsor_contracts as contract
  set status = 'completed', completed_at = coalesce(contract.completed_at, now())
  from public.seasons as start_season
  where start_season.id = contract.start_season_id
    and contract.status = 'active'
    and coalesce(
      (select end_season.game_year
       from public.seasons as end_season
       where end_season.id = contract.end_season_id),
      start_season.game_year + contract.contract_duration_seasons - 1)
      < v_target.game_year;

  -- Restore the permanent identity first; applying continuing/new sponsors in a
  -- second pass also prevents a sponsor moving teams from hitting unique names.
  update public.team_seasons as target_team
  set display_name = coalesce(
      (select contract.previous_team_display_name
       from public.team_sponsor_contracts as contract
       where contract.team_id = target_team.team_id
         and contract.previous_team_display_name is not null
       order by contract.created_at desc limit 1),
      team.amateur_name, team.internal_name),
    short_name = coalesce(
      (select contract.previous_team_short_name
       from public.team_sponsor_contracts as contract
       where contract.team_id = target_team.team_id
         and contract.previous_team_short_name is not null
       order by contract.created_at desc limit 1),
      left(coalesce(team.amateur_name, team.internal_name), 12)),
    registration_country_id = team.home_country_id,
    operating_budget = 0,
    currency_code = coalesce(nullif(target_team.currency_code, ''), 'EUR'),
    currency = coalesce(nullif(target_team.currency, ''), 'EUR')
  from public.teams as team
  where target_team.team_id = team.id
    and target_team.season_id = v_target.id;

  -- A future contract is activated automatically only when its jersey was
  -- actually validated. An incomplete contract stays planned and can still be
  -- completed by the DS during the new season.
  for v_sponsor in
    select contract.id, contract.team_id, contract.sponsor_id,
      contract.budget_per_season, contract.currency_code,
      contract.status, sponsor.name as sponsor_name,
      coalesce(nullif(btrim(sponsor.short_name), ''), sponsor.name) as sponsor_short_name,
      sponsor.country_id
    from public.team_sponsor_contracts as contract
    join public.sponsors as sponsor on sponsor.id = contract.sponsor_id
    join public.seasons as start_season on start_season.id = contract.start_season_id
    left join public.seasons as end_season on end_season.id = contract.end_season_id
    where contract.role = 'principal'
      and (
        (contract.status = 'active'
          and v_target.game_year between start_season.game_year and
            coalesce(end_season.game_year,
              start_season.game_year + contract.contract_duration_seasons - 1))
        or (contract.status = 'planned'
          and contract.start_season_id = v_target.id
          and contract.selected_jersey_id is not null
          and contract.selected_jersey_style is not null)
      )
    order by contract.team_id, start_season.game_year desc
  loop
    if v_sponsor.status = 'planned' then
      update public.team_sponsor_contracts as contract
      set previous_team_display_name = target_team.display_name,
        previous_team_short_name = target_team.short_name,
        previous_registration_country_id = target_team.registration_country_id,
        status = 'active',
        activated_at = coalesce(contract.activated_at, now())
      from public.team_seasons as target_team
      where contract.id = v_sponsor.id
        and target_team.team_id = contract.team_id
        and target_team.season_id = v_target.id;
    end if;

    update public.team_seasons
    set display_name = v_sponsor.sponsor_name,
      short_name = v_sponsor.sponsor_short_name,
      registration_country_id = coalesce(v_sponsor.country_id, registration_country_id),
      operating_budget = round(v_sponsor.budget_per_season
        * (1 + least(7, next_sponsor_budget_bonus_percent) / 100), 2),
      currency_code = v_sponsor.currency_code,
      currency = v_sponsor.currency_code
    where team_id = v_sponsor.team_id
      and season_id = v_target.id;

    update public.sponsor_objectives
    set status = 'active', updated_at = now()
    where sponsor_offer_id = (
      select contract.sponsor_offer_id
      from public.team_sponsor_contracts as contract
      where contract.id = v_sponsor.id
    )
      and season_id = v_target.id
      and status = 'draft';

    insert into public.objective_progress (
      sponsor_objective_id, team_sponsor_contract_id, season_id,
      status, current_value, details
    )
    select objective.id, v_sponsor.id, v_target.id,
      'not_started', 0, '{}'::jsonb
    from public.sponsor_objectives as objective
    join public.team_sponsor_contracts as contract
      on contract.sponsor_offer_id = objective.sponsor_offer_id
    where contract.id = v_sponsor.id
      and objective.season_id = v_target.id
    on conflict (sponsor_objective_id, team_sponsor_contract_id, season_id)
      do nothing;
  end loop;

  update public.team_seasons
  set status = 'active', finance_start_day_number = 1
  where season_id = v_target.id and status = 'planned';

  update public.seasons
  set status = 'active', current_day_number = 1
  where id = v_target.id;

  -- Youth transitions were previously lazy and happened only when a player
  -- opened the academy page. They are now global and deterministic at J1.
  for v_youth in
    select academy.*
    from public.youth_academy_riders as academy
    where (academy.status = 'recruited'
        and academy.promotion_game_year <= v_target.game_year)
      or (academy.status = 'active'
        and v_target.game_year - academy.birth_game_year > 18)
    order by academy.team_id, academy.id
    for update
  loop
    insert into public.riders (
      country_id, first_name, last_name, status, potential_steps
    )
    values (
      v_youth.country_id, v_youth.first_name, v_youth.last_name,
      case when v_youth.status = 'recruited' then 'active' else 'free_agent' end,
      v_youth.potential_steps
    )
    returning id into v_new_rider_id;

    insert into public.rider_season_ratings (
      rider_id, season_id, age, mountain, hills, flat, time_trial, cobbles,
      sprint, acceleration, downhill, endurance, resistance, recovery,
      breakaway, prologue
    ) values (
      v_new_rider_id, v_target.id,
      (v_target.game_year - v_youth.birth_game_year)::smallint,
      least(100, greatest(0, round(34 + v_youth.mountain * 8)))::smallint,
      least(100, greatest(0, round(34 + v_youth.hills * 8)))::smallint,
      least(100, greatest(0, round(34 + v_youth.flat * 8)))::smallint,
      least(100, greatest(0, round(34 + v_youth.time_trial * 8)))::smallint,
      least(100, greatest(0, round(34 + v_youth.cobbles * 8)))::smallint,
      least(100, greatest(0, round(34 + v_youth.sprint * 8)))::smallint,
      least(100, greatest(0, round(34 + v_youth.acceleration * 8)))::smallint,
      least(100, greatest(0, round(34 + v_youth.downhill * 8)))::smallint,
      least(100, greatest(0, round(34 + v_youth.endurance * 8)))::smallint,
      least(100, greatest(0, round(34 + v_youth.resistance * 8)))::smallint,
      least(100, greatest(0, round(34 + v_youth.recovery * 8)))::smallint,
      least(100, greatest(0, round(34 + v_youth.breakaway * 8)))::smallint,
      least(100, greatest(0, round(34 + v_youth.prologue * 8)))::smallint
    );

    if v_youth.status = 'recruited' then
      insert into public.rider_contracts (
        rider_id, team_id, start_season_id, end_season_id,
        salary_per_season, currency, currency_code, status,
        signed_at, acquisition_type
      )
      select v_new_rider_id, v_youth.team_id, v_target.id, v_target.id,
        0, team_season.currency, team_season.currency, 'active', now(), 'academy'
      from public.team_seasons as team_season
      where team_season.team_id = v_youth.team_id
        and team_season.season_id = v_target.id;

      update public.youth_academy_riders
      set status = 'promoted', promoted_rider_id = v_new_rider_id, updated_at = now()
      where id = v_youth.id;
      v_promoted_youth := v_promoted_youth + 1;
    else
      update public.youth_academy_riders
      set status = 'free_agent', promoted_rider_id = v_new_rider_id, updated_at = now()
      where id = v_youth.id;
      v_released_youth := v_released_youth + 1;
    end if;
  end loop;

  -- Existing riders need the same J1 profile state that the insert trigger gives
  -- newly promoted riders.
  insert into public.rider_season_summaries (rider_id, season_id)
  select rating.rider_id, v_target.id
  from public.rider_season_ratings as rating
  where rating.season_id = v_target.id
  on conflict (rider_id, season_id) do nothing;

  insert into public.rider_condition_states (
    rider_id, season_day_id, form, fatigue, source
  )
  select rating.rider_id, day.id, 75, 0, 'season_rollover'
  from public.rider_season_ratings as rating
  join public.season_days as day
    on day.season_id = v_target.id and day.day_number = 1
  where rating.season_id = v_target.id
  on conflict (rider_id, season_day_id) do nothing;

  insert into public.team_finance_transactions (
    team_season_id, season_day_id, day_number, amount, category,
    status, description, source_reference
  )
  select team_season.id, day.id, installment.day_number,
    case when installment.number < 4
      then -round(academy.tuition_per_season / 4, 2)
      else -(academy.tuition_per_season - round(academy.tuition_per_season / 4, 2) * 3)
    end,
    'training', 'pending',
    'Frais de scolarite - ' || academy.first_name || ' ' || academy.last_name,
    'youth-tuition:' || academy.id::text || ':' || v_target.id::text
      || ':' || installment.number
  from public.youth_academy_riders as academy
  join public.team_seasons as team_season
    on team_season.team_id = academy.team_id
    and team_season.season_id = v_target.id
  cross join (values (1, 7), (2, 14), (3, 21), (4, 28))
    as installment(number, day_number)
  join public.season_days as day
    on day.season_id = v_target.id
    and day.day_number = installment.day_number
  where academy.status in ('active', 'recruited')
    and academy.tuition_per_season > 0
  on conflict (team_season_id, source_reference) do nothing;

  for v_team in
    select team_season.team_id
    from public.team_seasons as team_season
    where team_season.season_id = v_target.id
      and team_season.status = 'active'
    order by team_season.team_id
  loop
    perform public.initialize_professional_team_finances(v_team.team_id);
  end loop;

  for v_sponsor in
    select contract.id
    from public.team_sponsor_contracts as contract
    join public.seasons as start_season on start_season.id = contract.start_season_id
    left join public.seasons as end_season on end_season.id = contract.end_season_id
    where contract.status = 'active'
      and v_target.game_year between start_season.game_year
        and coalesce(end_season.game_year,
          start_season.game_year + contract.contract_duration_seasons - 1)
  loop
    perform public.sync_sponsor_installments(v_sponsor.id);
  end loop;

  select count(*)::integer into v_missing_team_count
  from public.team_seasons as source_team
  where source_team.season_id = v_source.id
    and source_team.status <> 'withdrawn'
    and not exists (
      select 1 from public.team_seasons as target_team
      where target_team.team_id = source_team.team_id
        and target_team.season_id = v_target.id
        and target_team.status = 'active'
    );

  select count(*)::integer into v_missing_rating_count
  from public.rider_contracts as contract
  where contract.status = 'active'
    and not exists (
      select 1 from public.rider_season_ratings as rating
      where rating.rider_id = contract.rider_id
        and rating.season_id = v_target.id
    );

  select count(*)::integer into v_remaining_planned_contracts
  from public.rider_contracts
  where start_season_id = v_target.id and status = 'planned';

  if v_missing_team_count > 0
    or v_missing_rating_count > 0
    or v_remaining_planned_contracts > 0
    or (select count(*) from public.season_days where season_id = v_target.id) <> 28
    or not exists (select 1 from public.race_editions where season_id = v_target.id)
  then
    raise exception 'Invariants S2 invalides: equipes %, notes %, contrats planifies %.',
      v_missing_team_count, v_missing_rating_count, v_remaining_planned_contracts;
  end if;

  insert into public.season_rollover_settlements (
    source_season_id, target_season_id, copied_rider_count,
    promoted_youth_count, released_youth_count, carried_team_count
  ) values (
    v_source.id, v_target.id, v_copied_riders,
    v_promoted_youth, v_released_youth, v_carried_teams
  );

  return jsonb_build_object(
    'sourceSeasonId', v_source.id,
    'targetSeasonId', v_target.id,
    'copiedRiderCount', v_copied_riders,
    'promotedYouthCount', v_promoted_youth,
    'releasedYouthCount', v_released_youth,
    'carriedTeamCount', v_carried_teams,
    'settledAt', now(),
    'idempotentReplay', false
  );
end;
$$;
create or replace function public.settle_due_season_rollovers()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_source record;
  v_results jsonb := '[]'::jsonb;
begin
  for v_source in
    select season.id
    from public.seasons as season
    where season.status = 'active'
      and timezone('Europe/Paris', now())::date > season.ends_on
    order by season.game_year
  loop
    v_results := v_results || jsonb_build_array(
      public.rollover_game_season(v_source.id, false)
    );
  end loop;
  return v_results;
end;
$$;
revoke all on table public.season_rollover_settlements from public, anon, authenticated;
grant select, insert, update on table public.season_rollover_settlements to service_role;
revoke all on function public.get_season_rollover_readiness(uuid)
  from public, anon, authenticated;
revoke all on function public.rollover_game_season(uuid, boolean)
  from public, anon, authenticated;
revoke all on function public.settle_due_season_rollovers()
  from public, anon, authenticated;
grant execute on function public.get_season_rollover_readiness(uuid) to service_role;
grant execute on function public.rollover_game_season(uuid, boolean) to service_role;
grant execute on function public.settle_due_season_rollovers() to service_role;
comment on table public.season_rollover_settlements is
  'Journal idempotent des bascules atomiques entre deux saisons du jeu.';
comment on function public.rollover_game_season(uuid, boolean) is
  'Clot une saison et active la suivante dans une transaction avec controles finaux.';
comment on function public.settle_due_season_rollovers() is
  'Bascule les saisons actives dont le jour 28 est termine dans le fuseau Europe/Paris.';
notify pgrst, 'reload schema';
commit;
