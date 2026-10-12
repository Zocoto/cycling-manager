-- Owner-requested S4 compensation, 2026-10-12: raise Pipo Inzaghi's
-- principal sponsor allowance to EUR 1,000,000, not his cash balance.
-- Exact one-team operation. No fixture, simulation, global change or replay.
-- Applied and independently re-read in production on 2026-10-12: allowance
-- EUR 1,000,000; four pending EUR 250,000 installments (J7/J14/J21/J28);
-- cash remains EUR 64,223; other ledger entries unchanged; trigger enabled.
begin;
set local lock_timeout='3s';
set local statement_timeout='10s';

-- The normal finance trigger initializes all salaries, including a zero-salary
-- rider unrelated to this compensation. Suppress only that trigger inside this
-- bounded transaction and update the four unpaid sponsor amounts explicitly.
-- This DDL is transactional: any failure rolls back the trigger state too.
do $trigger_guard$
begin
  if not exists(select 1 from pg_trigger
    where tgrelid='public.team_sponsor_contracts'::regclass
      and tgname='team_sponsor_contract_finance_sync' and tgenabled='O'
      and tgfoid='public.handle_finance_contract_change()'::regprocedure) then
    raise exception 'Pipo compensation: unexpected sponsor finance trigger state.';
  end if;
end;
$trigger_guard$;
alter table public.team_sponsor_contracts disable trigger team_sponsor_contract_finance_sync;

do $compensation$
declare
  v_contract public.team_sponsor_contracts%rowtype;
  v_team_season public.team_seasons%rowtype;
  v_offer public.sponsor_offers%rowtype;
  v_other_transactions jsonb;
  v_after_transactions jsonb;
  v_installment_ids uuid[];
begin
  if not exists(select 1 from public.sporting_directors d
    join public.team_manager_assignments a on a.sporting_director_id=d.id
    where d.id='4d6b6328-62d9-4288-a156-7e472603e770'
      and d.display_name='Pipo Inzaghi' and a.role='general_manager' and a.status='active'
      and a.team_id='ad506cc8-91ff-4306-a30f-b1397e2154a5') then
    raise exception 'Pipo compensation: manager/team identity changed.';
  end if;
  if not exists(select 1 from public.seasons
    where id='c0c5824c-43a4-442e-907c-265c479efa0a' and status='active'
      and game_year=4 and current_day_number<7) then
    raise exception 'Pipo compensation: season or payment window changed.';
  end if;

  select * into strict v_contract from public.team_sponsor_contracts
    where id='b7049ab4-1802-42b0-b2f6-0b00691018ff' for update nowait;
  select * into strict v_team_season from public.team_seasons
    where id='2280f300-7224-4a10-8461-be6425267ca9' for update nowait;
  select * into strict v_offer from public.sponsor_offers
    where id='c5f1e90c-b762-4a03-a1af-de67b5ba2824' for update nowait;

  if v_contract.team_id<>v_team_season.team_id
    or v_contract.team_id<>'ad506cc8-91ff-4306-a30f-b1397e2154a5'
    or v_contract.sponsor_offer_id<>v_offer.id
    or v_contract.role<>'principal' or v_contract.status<>'active'
    or v_contract.start_season_id<>v_team_season.season_id
    or v_contract.end_season_id<>v_team_season.season_id
    or v_offer.season_id<>v_team_season.season_id or v_offer.status<>'accepted'
    or v_contract.currency_code<>'EUR'
    or v_team_season.next_sponsor_budget_bonus_percent<>0 then
    raise exception 'Pipo compensation: contract scope changed.';
  end if;
  if exists(select 1 from public.sponsor_annual_objective_history
    where team_sponsor_contract_id=v_contract.id) then
    raise exception 'Pipo compensation: unexpected archived annual budget.';
  end if;

  perform id from public.team_finance_transactions
    where team_season_id=v_team_season.id
      and source_reference like 'sponsor:'||v_contract.id::text||':%'
    for update nowait;
  select array_agg(id order by day_number) into v_installment_ids
    from public.team_finance_transactions
    where team_season_id=v_team_season.id
      and source_reference like 'sponsor:'||v_contract.id::text||':%';
  if v_installment_ids is distinct from array[
    'eb2eb67e-17b1-4db6-8944-c5d9a65229ec'::uuid,
    '83331693-214b-4e18-80a3-d02647af0b53'::uuid,
    '3ab20d12-aaa5-4db1-ad95-521f082cf1da'::uuid,
    '6cad263d-a018-403d-8358-a5378a1e2ad2'::uuid] then
    raise exception 'Pipo compensation: installment identities changed.';
  end if;
  if exists(select 1 from public.team_finance_transactions
    where id=any(v_installment_ids) and
      (status<>'pending' or category<>'sponsor' or day_number not in(7,14,21,28))) then
    raise exception 'Pipo compensation: an installment is no longer unpaid.';
  end if;

  -- Idempotent receipt: a repeated invocation cannot grant anything twice.
  if v_contract.budget_per_season=1000000
    and v_team_season.operating_budget=1000000 and v_offer.budget_per_season=260000
    and not exists(select 1 from public.team_finance_transactions
      where id=any(v_installment_ids) and amount<>250000) then return; end if;
  if v_contract.budget_per_season<>260000 or v_team_season.operating_budget<>260000
    or v_offer.budget_per_season<>260000
    or exists(select 1 from public.team_finance_transactions
      where id=any(v_installment_ids) and amount<>65000) then
    raise exception 'Pipo compensation: allowance differs from the reviewed EUR 260,000.';
  end if;

  select coalesce(jsonb_agg(to_jsonb(t) order by t.id),'[]'::jsonb)
    into v_other_transactions from public.team_finance_transactions t
    where t.team_season_id=v_team_season.id and not(t.id=any(v_installment_ids));

  -- The accepted offer is historical: retain its original negotiation terms.
  update public.team_sponsor_contracts set budget_per_season=1000000 where id=v_contract.id;
  update public.team_seasons set operating_budget=1000000 where id=v_team_season.id;
  update public.team_finance_transactions set amount=250000 where id=any(v_installment_ids);

  if not exists(select 1 from public.team_seasons t
    where t.id=v_team_season.id and t.operating_budget=1000000
      and t.cash_balance=v_team_season.cash_balance
      and t.registration_country_id is not distinct from v_team_season.registration_country_id) then
    raise exception 'Pipo compensation: cash or team nationality unexpectedly changed.';
  end if;
  if (select count(*) from public.team_finance_transactions
    where id=any(v_installment_ids) and amount=250000 and status='pending')<>4 then
    raise exception 'Pipo compensation: expected four unpaid EUR 250,000 installments.';
  end if;
  select coalesce(jsonb_agg(to_jsonb(t) order by t.id),'[]'::jsonb)
    into v_after_transactions from public.team_finance_transactions t
    where t.team_season_id=v_team_season.id and not(t.id=any(v_installment_ids));
  if v_after_transactions is distinct from v_other_transactions then
    raise exception 'Pipo compensation: unrelated financial entries changed.';
  end if;
  if (select to_jsonb(o) from public.sponsor_offers o where o.id=v_offer.id)
      is distinct from to_jsonb(v_offer) then
    raise exception 'Pipo compensation: original accepted offer changed.';
  end if;
end;
$compensation$;

alter table public.team_sponsor_contracts enable trigger team_sponsor_contract_finance_sync;

select c.budget_per_season,ts.operating_budget,ts.cash_balance,
  (select tgenabled='O' from pg_trigger where tgrelid='public.team_sponsor_contracts'::regclass
    and tgname='team_sponsor_contract_finance_sync') finance_trigger_enabled,
  (select count(*) from public.team_finance_transactions t where t.team_season_id=ts.id
    and t.source_reference like 'sponsor:'||c.id::text||':%' and t.status='pending') pending_installments,
  (select sum(amount) from public.team_finance_transactions t where t.team_season_id=ts.id
    and t.source_reference like 'sponsor:'||c.id::text||':%' and t.status='pending') remaining_allowance
from public.team_sponsor_contracts c join public.team_seasons ts on ts.team_id=c.team_id
where c.id='b7049ab4-1802-42b0-b2f6-0b00691018ff'
  and ts.id='2280f300-7224-4a10-8461-be6425267ca9';
commit;
