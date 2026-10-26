begin;
set local application_name = 's5-sponsor-main-objective-cap-install';
set local statement_timeout = '5s';
set local lock_timeout = '500ms';

-- Season 4 and settled commitments keep their recorded terms. The cap is also
-- enforced at the database boundary for older application clients and when a
-- renewal's final annual budget changes before or during season activation.
create or replace function private.cap_sponsor_main_objective_reward()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_game_year integer;
  v_target_details jsonb;
  v_annual_budget numeric;
  v_target_rank numeric;
  v_cap_rate numeric;
  v_raw_cap numeric;
  v_cash_cap numeric;
begin
  if new.settlement_status <> 'pending'
    or (tg_op = 'UPDATE' and old.settlement_status <> 'pending') then
    return new;
  end if;

  select season.game_year, objective.target_details,
    coalesce(contract.budget_per_season, offer.budget_per_season)
  into v_game_year, v_target_details, v_annual_budget
  from public.sponsor_objectives as objective
  join public.seasons as season on season.id = objective.season_id
  join public.sponsor_offers as offer on offer.id = objective.sponsor_offer_id
  left join public.team_sponsor_contracts as contract
    on contract.sponsor_offer_id = offer.id
   and contract.role = 'principal'
   and contract.status in ('planned', 'active')
   and coalesce(contract.objective_season_id, contract.start_season_id) = objective.season_id
  where objective.id = new.sponsor_objective_id;

  if v_game_year is null or v_game_year < 5 then
    return new;
  end if;
  if v_annual_budget is null or v_annual_budget <= 0
    or v_annual_budget::text in ('NaN', 'Infinity', '-Infinity') then
    raise exception 'Le budget annuel du sponsor doit être un montant strictement positif.';
  end if;

  v_target_rank := case
    when v_target_details ->> 'achievementType' = 'win' then 1
    else greatest(1, floor(coalesce(nullif(v_target_details ->> 'targetRank', '')::numeric, 10)))
  end;
  v_cap_rate := case when v_target_rank = 1 then 0.15
    when v_target_rank <= 3 then 0.125 else 0.10 end;
  v_raw_cap := v_annual_budget * v_cap_rate;
  v_cash_cap := case when v_raw_cap >= 5000
    then floor(v_raw_cap / 5000) * 5000
    else floor(v_raw_cap * 100) / 100 end;

  if v_cash_cap < 0.01 then
    raise exception 'Le budget annuel du sponsor est trop faible pour calculer une prime.';
  end if;
  if new.cash_reward > v_cash_cap then
    new.reputation_penalty := greatest(
      1, round(new.reputation_penalty * v_cash_cap / new.cash_reward)
    );
    new.cash_reward := v_cash_cap;
  end if;
  return new;
end;
$$;

create or replace function private.recap_sponsor_main_objectives_after_budget_change()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_offer_ids uuid[];
begin
  if new.budget_per_season is not distinct from old.budget_per_season then
    return new;
  end if;

  if tg_table_name = 'sponsor_offers' then
    v_offer_ids := array[new.id];
  elsif tg_table_name = 'team_sponsor_contracts' then
    v_offer_ids := array[new.sponsor_offer_id, new.pending_sponsor_offer_id];
  else
    raise exception 'Source de budget sponsor non prise en charge.';
  end if;

  -- A pending annual offer uses its own budget, never the previous season's
  -- contract budget. Once activated, the matching objective-season contract
  -- becomes authoritative. At most the changed parent's two offers are read.
  with contexts as (
    select terms.sponsor_objective_id, objective.target_details,
      coalesce(contract.budget_per_season, offer.budget_per_season) as annual_budget
    from public.sponsor_objectives as objective
    join public.sponsor_main_objective_terms as terms
      on terms.sponsor_objective_id = objective.id
     and terms.settlement_status = 'pending'
    join public.seasons as season
      on season.id = objective.season_id and season.game_year >= 5
    join public.sponsor_offers as offer on offer.id = objective.sponsor_offer_id
    left join public.team_sponsor_contracts as contract
      on contract.sponsor_offer_id = offer.id
     and contract.role = 'principal'
     and contract.status in ('planned', 'active')
     and coalesce(contract.objective_season_id, contract.start_season_id) = objective.season_id
    where objective.sponsor_offer_id = any(v_offer_ids)
  ), raw_caps as (
    select contexts.*,
      annual_budget * case
        when target_details ->> 'achievementType' = 'win'
          or greatest(1, floor(coalesce(nullif(target_details ->> 'targetRank', '')::numeric, 10))) = 1
          then 0.15
        when greatest(1, floor(coalesce(nullif(target_details ->> 'targetRank', '')::numeric, 10))) <= 3
          then 0.125
        else 0.10 end as raw_cap
    from contexts
  ), caps as (
    select sponsor_objective_id,
      case when annual_budget is null or annual_budget <= 0
          or annual_budget::text in ('NaN', 'Infinity', '-Infinity') then 0
        when raw_cap >= 5000 then floor(raw_cap / 5000) * 5000
        else floor(raw_cap * 100) / 100 end as cash_cap
    from raw_caps
  )
  update public.sponsor_main_objective_terms as terms
  set cash_reward = terms.cash_reward
  from caps
  where terms.sponsor_objective_id = caps.sponsor_objective_id
    and terms.settlement_status = 'pending'
    and terms.cash_reward > caps.cash_cap;
  -- The BEFORE trigger clamps cash and scales reputation once. A higher
  -- budget never raises an already-promised reward, and no-op visits write
  -- nothing. This relay does not settle objectives or touch finance ledgers.
  return new;
end;
$$;

revoke all on function private.cap_sponsor_main_objective_reward()
  from public, anon, authenticated;
revoke all on function private.recap_sponsor_main_objectives_after_budget_change()
  from public, anon, authenticated;

drop trigger if exists cap_future_sponsor_main_objective_reward
  on public.sponsor_main_objective_terms;
create trigger cap_future_sponsor_main_objective_reward
before insert or update on public.sponsor_main_objective_terms
for each row execute function private.cap_sponsor_main_objective_reward();

drop trigger if exists recap_future_main_objectives_offer_budget on public.sponsor_offers;
create trigger recap_future_main_objectives_offer_budget
after update of budget_per_season on public.sponsor_offers
for each row
when (old.budget_per_season is distinct from new.budget_per_season)
execute function private.recap_sponsor_main_objectives_after_budget_change();

drop trigger if exists recap_future_main_objectives_contract_budget on public.team_sponsor_contracts;
create trigger recap_future_main_objectives_contract_budget
after update of budget_per_season on public.team_sponsor_contracts
for each row
when (old.budget_per_season is distinct from new.budget_per_season)
execute function private.recap_sponsor_main_objectives_after_budget_change();

commit;
