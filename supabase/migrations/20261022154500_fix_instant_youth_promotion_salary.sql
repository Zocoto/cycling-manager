begin;
set local application_name = 'instant-junior-salary-migration';
set local lock_timeout = '2s';
set local statement_timeout = '15s';

-- Only the instant-promotion contracts and their proven zero-salary legacy
-- successors opt into this boundary. Existing contracts keep their original
-- quarterly billing behavior; this is not a change to daily salary proration.
alter table public.rider_contracts
  add column if not exists salary_billing_from_game_day_index integer;

comment on column public.rider_contracts.salary_billing_from_game_day_index is
  'Optional earliest payable quarterly salary installment: game_year * 28 + day_number - 1. Prevents retroactive billing after an instant youth promotion or its zero-salary repair.';

-- Preserve the live function, including its completed-DevTeam-race guard,
-- inventory locks, atomic consumption and all existing career triggers.
do $promotion$
declare
  v_definition text;
  v_old_contract constant text := $old_contract$
  insert into public.rider_contracts (
    rider_id,
    team_id,
    start_season_id,
    end_season_id,
    salary_per_season,
    currency,
    currency_code,
    status,
    signed_at,
    acquisition_type
  ) values (
    v_rider_id,
    v_context.team_id,
    v_context.season_id,
    v_context.season_id,
    0,
    v_context.currency,
    v_context.currency,
    'active',
    now(),
    'academy'
  );
$old_contract$;
  v_new_contract constant text := $new_contract$
  -- instant-youth-salary-v1: price the professional contract before INSERT so
  -- the existing Data Room INSERT discount remains effective exactly once.
  insert into public.rider_contracts (
    rider_id,
    team_id,
    start_season_id,
    end_season_id,
    salary_per_season,
    currency,
    currency_code,
    status,
    signed_at,
    acquisition_type,
    salary_billing_from_game_day_index
  ) values (
    v_rider_id,
    v_context.team_id,
    v_context.season_id,
    v_context.season_id,
    greatest(6000, coalesce(public.calculate_rider_season_salary(
      v_rider_id, v_context.season_id
    ), 6000)),
    v_context.currency,
    v_context.currency,
    'active',
    now(),
    'academy',
    v_context.game_year * 28 + v_context.current_day_number - 1
  );
$new_contract$;
  v_academy_update constant text := $academy_update$
  update public.youth_academy_riders
  set
    status = 'promoted',
    promotion_game_year = null,
    promoted_rider_id = v_rider_id,
    updated_at = now()
  where id = v_academy.id;
$academy_update$;
  v_after_academy constant text := $after_academy$

  -- The academy update grants Formé au club only after the contract exists.
  -- Re-submit its actual (possibly Data Room-discounted) salary, not the quote,
  -- so the existing homegrown trigger now applies its discount exactly once.
  update public.rider_contracts as promoted_contract
  set salary_per_season = promoted_contract.salary_per_season
  where promoted_contract.rider_id = v_rider_id
    and promoted_contract.team_id = v_context.team_id
    and promoted_contract.start_season_id = v_context.season_id
    and promoted_contract.status = 'active'
    and promoted_contract.acquisition_type = 'academy';
$after_academy$;
begin
  select replace(pg_get_functiondef(
    'public.redeem_instant_youth_promotion_reward(uuid,uuid)'::regprocedure
  ), E'\r\n', E'\n') into v_definition;

  if position('-- instant-youth-salary-v1:' in v_definition) > 0 then
    if position('salary_billing_from_game_day_index' in v_definition) = 0
      or position('set salary_per_season = promoted_contract.salary_per_season' in v_definition) = 0
    then
      raise exception 'Incomplete instant youth salary patch; migration stopped.';
    end if;
    return;
  end if;
  if position(v_old_contract in v_definition) = 0
    or position(v_academy_update in v_definition) = 0
    or position('edition.status = ''planned''' in v_definition) = 0
    or position('result.result_scope = ''general''' in v_definition) = 0
  then
    raise exception 'Unexpected instant youth promotion definition; migration stopped.';
  end if;
  v_definition := replace(v_definition, v_old_contract, v_new_contract);
  v_definition := replace(v_definition, v_academy_update, v_academy_update || v_after_academy);
  execute v_definition;
end;
$promotion$;

-- Do not globally rework the salary scheduler. An optional billing boundary
-- filters only the affected contracts, and keeps their already-posted history
-- byte-for-byte intact when a later salary trigger resynchronizes installments.
do $installments$
declare
  v_definition text;
  v_contract_select constant text := $contract_select$
  from public.rider_contracts as contract
  where contract.id = p_contract_id;
$contract_select$;
  v_cancel_before_boundary constant text := $cancel_before_boundary$

  -- instant-youth-billing-boundary-v1: never collect pre-repair arrears.
  if v_contract.salary_billing_from_game_day_index is not null then
    update public.team_finance_transactions as transaction
    set status = 'cancelled'
    from public.team_seasons as team_season, public.seasons as season
    where transaction.team_season_id = team_season.id
      and season.id = team_season.season_id
      and transaction.source_reference like
        'rider-salary:' || p_contract_id::text || ':%'
      and transaction.category = 'rider_salary'
      and transaction.status = 'pending'
      and season.game_year * 28 + transaction.day_number - 1
        < v_contract.salary_billing_from_game_day_index;
  end if;
$cancel_before_boundary$;
  v_old_team_select constant text := '    select team_season.*';
  v_new_team_select constant text := '    select team_season.*, season.game_year as salary_game_year';
  v_old_rider_filter constant text := '      where rider.id = v_contract.rider_id';
  v_new_rider_filter constant text := $rider_filter$
      where rider.id = v_contract.rider_id
        and (
          v_contract.salary_billing_from_game_day_index is null
          or v_team_season.salary_game_year * 28 + day.day_number - 1
            >= v_contract.salary_billing_from_game_day_index
        )
$rider_filter$;
  v_old_upsert constant text := $old_upsert$
          else 'pending'
        end;
$old_upsert$;
  v_new_upsert constant text := $new_upsert$
          else 'pending'
        end
      where v_contract.salary_billing_from_game_day_index is null
        or team_finance_transactions.status <> 'posted';
$new_upsert$;
begin
  select replace(pg_get_functiondef(
    'public.sync_rider_salary_installments(uuid)'::regprocedure
  ), E'\r\n', E'\n') into v_definition;

  if position('-- instant-youth-billing-boundary-v1:' in v_definition) > 0 then
    if position('>= v_contract.salary_billing_from_game_day_index' in v_definition) = 0
      or position('or team_finance_transactions.status <> ''posted''' in v_definition) = 0
    then
      raise exception 'Incomplete instant youth billing patch; migration stopped.';
    end if;
    return;
  end if;
  if position(v_contract_select in v_definition) = 0
    or position(v_old_team_select in v_definition) = 0
    or position(v_old_rider_filter in v_definition) = 0
    or position(v_old_upsert in v_definition) = 0
  then
    raise exception 'Unexpected rider salary installment definition; migration stopped.';
  end if;
  v_definition := replace(v_definition, v_contract_select, v_contract_select || v_cancel_before_boundary);
  v_definition := replace(v_definition, v_old_team_select, v_new_team_select);
  v_definition := replace(v_definition, v_old_rider_filter, v_new_rider_filter);
  v_definition := replace(v_definition, v_old_upsert, v_new_upsert);
  execute v_definition;
end;
$installments$;

-- An old free renewal must not become the base of another free renewal.
-- Ignore individual zero/null bases without changing any existing positive
-- base or the normal age/duration adjustment and infrastructure discounts.
do $renewal$
declare
  v_definition text;
  v_old_base constant text := $old_base$
  v_base_salary := case
    when v_existing.id is not null then coalesce(
      v_existing.homegrown_salary_before_discount,
      v_existing.roster_management_salary_before_discount,
      v_existing.salary_per_season
    )
    else public.calculate_rider_season_salary(
      p_rider_id, v_next_season.id
    )
  end;
$old_base$;
  v_new_base constant text := $new_base$
  -- instant-youth-renewal-salary-v1: a zero is never a reusable salary quote.
  v_base_salary := coalesce(
    case when v_existing.id is not null then
      case when exists (
        select 1
        from public.rider_special_abilities as ability
        join public.youth_academy_riders as academy
          on academy.promoted_rider_id = ability.rider_id
          and academy.team_id = v_existing.team_id
          and academy.status = 'promoted'
        where ability.rider_id = v_existing.rider_id
          and ability.ability_code = 'homegrown'
      ) then
        -- With Formé au club, only its positive pre-discount base is safe.
        -- Net/retention bases may already be halved and must not be halved
        -- again when the unchanged UPDATE triggers run below.
        case when v_existing.homegrown_salary_before_discount > 0
          then v_existing.homegrown_salary_before_discount end
      else coalesce(
        case when v_existing.roster_management_salary_before_discount > 0
          then v_existing.roster_management_salary_before_discount end,
        case when v_existing.salary_per_season > 0
          then v_existing.salary_per_season end
      ) end
    end,
    greatest(6000, coalesce(public.calculate_rider_season_salary(
      p_rider_id, v_next_season.id
    ), 6000))
  );
$new_base$;
begin
  select replace(pg_get_functiondef(
    'public.renew_current_team_rider_until(uuid,integer)'::regprocedure
  ), E'\r\n', E'\n') into v_definition;
  if position('-- instant-youth-renewal-salary-v1:' in v_definition) > 0 then
    return;
  end if;
  if position(v_old_base in v_definition) = 0 then
    raise exception 'Unexpected rider renewal salary definition; migration stopped.';
  end if;
  execute replace(v_definition, v_old_base, v_new_base);
end;
$renewal$;

-- Audited, repeatable repair of precisely the zero-salary contracts whose
-- academy notification proves an instant consumable promotion. No migration
-- fixture, gameplay settlement, debit or historical contract repricing occurs.
create table if not exists private.instant_youth_salary_corrections (
  contract_id uuid primary key,
  rider_id uuid not null,
  academy_rider_id uuid not null,
  team_id uuid not null,
  previous_salary_per_season numeric(12, 2) not null,
  nominal_salary_per_season numeric(12, 2) not null,
  repaired_salary_per_season numeric(12, 2) not null,
  salary_billing_from_game_day_index integer not null,
  corrected_at timestamptz not null default now()
);
alter table private.instant_youth_salary_corrections enable row level security;
revoke all on private.instant_youth_salary_corrections
  from public, anon, authenticated, service_role;

do $repair$
declare
  v_clock record;
  v_contract record;
  v_salary numeric;
  v_nominal_salary numeric;
  v_age integer;
  v_boundary integer;
  v_repaired_salary numeric;
begin
  select season.id, season.game_year,
    coalesce(season.current_day_number, 1)::integer as day_number
  into v_clock
  from public.seasons as season
  where season.status = 'active';

  if v_clock.id is null then
    raise exception 'No active season for instant youth salary repair.';
  end if;

  for v_contract in
    select contract.id, contract.rider_id, contract.team_id,
      contract.start_season_id, contract.end_season_id, contract.status,
      contract.acquisition_type, contract.salary_per_season,
      start_season.game_year as start_year, end_season.game_year as end_year,
      academy.id as academy_rider_id, academy.birth_game_year
    from public.rider_contracts as contract
    join public.seasons as start_season on start_season.id = contract.start_season_id
    join public.seasons as end_season on end_season.id = contract.end_season_id
    join public.youth_academy_riders as academy
      on academy.promoted_rider_id = contract.rider_id
      and academy.team_id = contract.team_id
      and academy.status = 'promoted'
    where contract.status in ('active', 'planned')
      and contract.acquisition_type in ('academy', 'renewal')
      and contract.salary_per_season = 0
      and end_season.game_year >= v_clock.game_year
      and start_season.game_year <= end_season.game_year
      and not exists (
        select 1 from private.instant_youth_salary_corrections as correction
        where correction.contract_id = contract.id
      )
      and exists (
        select 1 from public.youth_development_notifications as notification
        where notification.team_id = academy.team_id
          and notification.notification_type = 'promoted'
          and notification.source_reference = 'instant-youth-promotion:' || academy.id::text
      )
    order by contract.id
    for update of contract
  loop
    v_nominal_salary := greatest(6000, coalesce(public.calculate_rider_season_salary(
      v_contract.rider_id,
      case when v_contract.status = 'active' then v_clock.id
        else v_contract.start_season_id end
    ), 6000));

    -- A renewal covering both S+1 and S+2 keeps the existing age adjustment.
    if v_contract.acquisition_type = 'renewal'
      and v_contract.end_year = v_contract.start_year + 1
    then
      select rating.age into v_age
      from public.rider_season_ratings as rating
      join public.seasons as season on season.id = rating.season_id
      where rating.rider_id = v_contract.rider_id
        and season.game_year = v_contract.start_year - 1;
      v_age := coalesce(v_age,
        v_contract.start_year - 1 - v_contract.birth_game_year);
      v_nominal_salary := round(v_nominal_salary * (
        1 + public.rider_two_season_salary_adjustment(v_age)::numeric / 100
      ), 2);
    end if;

    v_salary := v_nominal_salary;
    -- Every legacy INSERT (academy or renewal) had a zero salary, so the
    -- INSERT-only Data Room trigger did nothing. Reproduce that one discount
    -- before UPDATE's existing homegrown/retention triggers, unchanged.
    v_salary := round(v_salary * (1 - 0.03 * greatest(0, coalesce(
      public.get_team_specialization_power(v_contract.team_id,
        'recruitment_data_room', 'deal_room'), 0
    ))), 2);
    if v_salary <= 0 then
      raise exception 'Invalid instant youth repaired salary for contract %.', v_contract.id;
    end if;

    v_boundary := case
      when v_contract.status = 'planned' and v_contract.start_year > v_clock.game_year
        then v_contract.start_year * 28
      else v_clock.game_year * 28 + v_clock.day_number - 1
    end;

    update public.rider_contracts as contract
    set salary_per_season = v_salary,
      salary_billing_from_game_day_index = v_boundary
    where contract.id = v_contract.id
      and contract.salary_per_season = 0
      and contract.status in ('active', 'planned')
    returning contract.salary_per_season into v_repaired_salary;

    if v_repaired_salary is null or v_repaired_salary <= 0 then
      raise exception 'Instant youth salary repair failed for contract %.', v_contract.id;
    end if;
    insert into private.instant_youth_salary_corrections (
      contract_id, rider_id, academy_rider_id, team_id,
      previous_salary_per_season, nominal_salary_per_season,
      repaired_salary_per_season, salary_billing_from_game_day_index
    ) values (
      v_contract.id, v_contract.rider_id, v_contract.academy_rider_id,
      v_contract.team_id, v_contract.salary_per_season, v_nominal_salary,
      v_repaired_salary, v_boundary
    );
  end loop;
end;
$repair$;

notify pgrst, 'reload schema';
commit;
