begin;

-- Keep one immutable trace of the curative pass. It records what the running
-- contract and annual offer contained before they were aligned with the
-- satisfaction earned during the source season.
create table if not exists public.sponsor_annual_budget_repair_audit (
  team_sponsor_contract_id uuid not null
    references public.team_sponsor_contracts(id),
  source_season_id uuid not null references public.seasons(id),
  target_season_id uuid not null references public.seasons(id),
  source_sponsor_offer_id uuid not null references public.sponsor_offers(id),
  target_sponsor_offer_id uuid not null references public.sponsor_offers(id),
  source_budget_per_season numeric(14, 2) not null,
  original_contract_budget_per_season numeric(14, 2) not null,
  original_target_offer_budget_per_season numeric(14, 2) not null,
  repaired_budget_per_season numeric(14, 2) not null,
  satisfaction_score smallint not null,
  renewal_budget_adjustment_percent numeric not null,
  repaired_at timestamptz not null default now(),
  primary key (team_sponsor_contract_id, source_season_id, target_season_id)
);

alter table public.sponsor_annual_budget_repair_audit enable row level security;
revoke all on public.sponsor_annual_budget_repair_audit
  from public, anon, authenticated;
grant all on public.sponsor_annual_budget_repair_audit to service_role;

-- This is the single preventive budget calculator for automatically prepared
-- annual programs. It must run before objective_season_id changes, while the
-- source season's satisfaction is still present on the contract.
create or replace function private.finalize_continuing_sponsor_offer_budget(
  p_contract_id uuid,
  p_target_season_id uuid
)
returns numeric
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_context record;
  v_adjustment_percent numeric;
  v_renewal_base numeric;
  v_budget_ceiling numeric;
  v_negotiated_budget numeric;
begin
  select
    contract.budget_per_season,
    contract.satisfaction_score,
    offer.id as offer_id,
    offer.objective_difficulty,
    offer.negotiation_budget_ceiling,
    target_season.game_year
  into v_context
  from public.team_sponsor_contracts as contract
  join public.sponsor_offers as offer
    on offer.continuing_contract_id = contract.id
   and offer.season_id = p_target_season_id
   and offer.status = 'accepted'
  join public.seasons as target_season on target_season.id = offer.season_id
  where contract.id = p_contract_id
    and contract.role = 'principal'
    and contract.status = 'active'
  for update of contract, offer;

  if not found then
    raise exception 'Programme annuel sponsor introuvable pour le contrat % et la saison %.',
      p_contract_id, p_target_season_id;
  end if;

  if v_context.game_year < 3 then
    return v_context.budget_per_season;
  end if;

  v_adjustment_percent := case
    when v_context.satisfaction_score <= 50 then
      (v_context.satisfaction_score - 50) / 2.0
    else (v_context.satisfaction_score - 50) / 5.0
  end;
  v_renewal_base := round(
    v_context.budget_per_season * (1 + v_adjustment_percent / 100),
    0
  );
  v_budget_ceiling := greatest(
    coalesce(v_context.negotiation_budget_ceiling, v_renewal_base),
    v_renewal_base
  );
  v_negotiated_budget := case v_context.objective_difficulty
    when 'accessible' then round(v_renewal_base * 0.90 / 10000) * 10000
    when 'ambitious' then round(v_renewal_base * 1.10 / 10000) * 10000
    else v_renewal_base
  end;
  v_negotiated_budget := greatest(
    10000,
    least(v_negotiated_budget, v_budget_ceiling)
  );

  update public.sponsor_offers
  set base_budget_per_season = v_renewal_base,
      budget_per_season = v_negotiated_budget,
      negotiation_budget_ceiling = v_budget_ceiling
  where id = v_context.offer_id;

  return v_negotiated_budget;
end;
$$;

revoke all on function private.finalize_continuing_sponsor_offer_budget(uuid, uuid)
  from public, anon, authenticated;
grant execute on function private.finalize_continuing_sponsor_offer_budget(uuid, uuid)
  to service_role;

-- Automatic offer creation used to copy the previous budget unchanged. Add the
-- same satisfaction calculation used by the negotiated J21-J28 workflow.
do $patch_automatic_annual_budget$
declare
  v_definition text;
  v_patched text;
  v_marker text := '    v_prepared := v_prepared + 1;';
begin
  select replace(
    pg_get_functiondef(
      'public.prepare_annual_sponsor_objective_offers(uuid)'::regprocedure
    ),
    chr(13),
    ''
  ) into v_definition;

  if position('private.finalize_continuing_sponsor_offer_budget' in v_definition) = 0 then
    if position(v_marker in v_definition) = 0 then
      raise exception 'Point de finalisation du programme sponsor automatique introuvable.';
    end if;

    v_patched := replace(
      v_definition,
      v_marker,
      '    perform private.finalize_continuing_sponsor_offer_budget(v_contract.id, v_target.id);'
        || chr(10) || v_marker
    );
    execute v_patched;
  end if;
end;
$patch_automatic_annual_budget$;

-- A current contract only represents its current annual budget. Historical
-- instalments must read the archived annual budget and posted rows are immutable
-- during ordinary synchronizations.
create or replace function public.sync_sponsor_installments(
  p_contract_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
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
    select
      team_season.*,
      coalesce(
        annual_history.budget_per_season,
        v_contract.budget_per_season
      ) as annual_contract_budget
    from public.team_seasons as team_season
    join public.seasons as season on season.id = team_season.season_id
    join public.seasons as start_season on start_season.id = v_contract.start_season_id
    left join public.seasons as end_season on end_season.id = v_contract.end_season_id
    left join public.sponsor_annual_objective_history as annual_history
      on annual_history.team_sponsor_contract_id = v_contract.id
     and annual_history.season_id = team_season.season_id
    where team_season.team_id = v_contract.team_id
      and season.game_year between start_season.game_year
        and start_season.game_year + v_contract.contract_duration_seasons - 1
      and (end_season.id is null or season.game_year <= end_season.game_year)
  loop
    v_budget := v_team_season.annual_contract_budget
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
        amount = case
          when team_finance_transactions.status = 'posted'
            then team_finance_transactions.amount
          else excluded.amount
        end,
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

-- Keep the late-repair path equivalent to the normal rollover: compute the
-- target budget before archiving the source state, then align the current team
-- budget and instalments as part of the same transaction.
create or replace function public.repair_due_annual_sponsor_objectives()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_season public.seasons%rowtype;
  v_contract record;
  v_repaired integer := 0;
begin
  select * into v_season from public.seasons where status = 'active' limit 1;
  if v_season.id is null or v_season.game_year < 3 then return 0; end if;

  perform public.prepare_annual_sponsor_objective_offers(v_season.id);

  for v_contract in
    select contract.id, contract.team_id, offer.id as offer_id,
      offer.budget_per_season, contract.currency_code
    from public.team_sponsor_contracts as contract
    join public.sponsor_offers as offer
      on offer.continuing_contract_id = contract.id
     and offer.season_id = v_season.id
     and offer.status = 'accepted'
    join public.seasons as objective_season
      on objective_season.id = coalesce(
        contract.objective_season_id,
        contract.start_season_id
      )
    where contract.role = 'principal'
      and contract.status = 'active'
      and objective_season.game_year < v_season.game_year
    order by contract.id
    for update of contract, offer
  loop
    update public.sponsor_objectives
    set status = 'active', is_provisional = false, updated_at = now()
    where sponsor_offer_id = v_contract.offer_id
      and season_id = v_season.id
      and status = 'draft';

    update public.team_sponsor_contracts
    set sponsor_offer_id = v_contract.offer_id,
        objective_season_id = v_season.id,
        budget_per_season = v_contract.budget_per_season,
        pending_sponsor_offer_id = case
          when pending_sponsor_offer_id = v_contract.offer_id then null
          else pending_sponsor_offer_id
        end
    where id = v_contract.id;

    update public.team_seasons
    set operating_budget = round(
          v_contract.budget_per_season
            * (1 + least(7, next_sponsor_budget_bonus_percent) / 100),
          2
        ),
        currency_code = v_contract.currency_code,
        currency = v_contract.currency_code
    where team_id = v_contract.team_id
      and season_id = v_season.id;

    perform public.sync_sponsor_installments(v_contract.id);

    insert into public.objective_progress (
      sponsor_objective_id, team_sponsor_contract_id, season_id,
      status, current_value, details
    )
    select objective.id, v_contract.id, v_season.id,
      'not_started', 0, '{}'::jsonb
    from public.sponsor_objectives as objective
    where objective.sponsor_offer_id = v_contract.offer_id
      and objective.season_id = v_season.id
    on conflict (sponsor_objective_id, team_sponsor_contract_id, season_id)
      do nothing;

    v_repaired := v_repaired + 1;
  end loop;

  return v_repaired;
end;
$$;

revoke all on function public.repair_due_annual_sponsor_objectives()
  from public, anon, authenticated;
grant execute on function public.repair_due_annual_sponsor_objectives()
  to service_role;

-- Curative pass for every principal contract that spans the completed season
-- immediately preceding the active one. No team or player is selected by name.
create temporary table annual_sponsor_budget_repair on commit drop as
with active_season as (
  select season.* from public.seasons as season
  where season.status = 'active'
  order by season.game_year desc
  limit 1
), source_season as (
  select season.*
  from public.seasons as season
  join active_season on season.game_year = active_season.game_year - 1
), raw as (
  select
    contract.id as contract_id,
    contract.team_id,
    source_season.id as source_season_id,
    active_season.id as target_season_id,
    source_offer.id as source_offer_id,
    target_offer.id as target_offer_id,
    source_team.id as source_team_season_id,
    target_team.id as target_team_season_id,
    coalesce(history.budget_per_season, source_offer.budget_per_season)
      as source_budget,
    contract.budget_per_season as original_contract_budget,
    target_offer.budget_per_season as original_target_offer_budget,
    target_offer.objective_difficulty,
    target_offer.negotiation_budget_ceiling,
    coalesce(
      history.satisfaction_score,
      source_score.satisfaction_score,
      0
    )::smallint as satisfaction_score,
    coalesce(
      history.objective_reputation_penalty,
      contract.objective_reputation_penalty,
      0
    )::integer as objective_reputation_penalty,
    coalesce(
      history.renewal_budget_adjustment_percent,
      case
        when coalesce(source_score.satisfaction_score, 0) <= 50 then
          (coalesce(source_score.satisfaction_score, 0) - 50) / 2.0
        else (coalesce(source_score.satisfaction_score, 0) - 50) / 5.0
      end
    ) as adjustment_percent,
    coalesce(source_team.next_sponsor_budget_bonus_percent, 0) as source_bonus_percent,
    coalesce(target_team.next_sponsor_budget_bonus_percent, 0) as target_bonus_percent,
    source_offer.candidate_count
  from public.team_sponsor_contracts as contract
  cross join active_season
  cross join source_season
  join public.seasons as start_season on start_season.id = contract.start_season_id
  left join public.seasons as end_season on end_season.id = contract.end_season_id
  join public.seasons as objective_season
    on objective_season.id = coalesce(
      contract.objective_season_id,
      contract.start_season_id
    )
  join public.sponsor_offers as target_offer
    on target_offer.id = contract.sponsor_offer_id
   and target_offer.season_id = active_season.id
   and target_offer.continuing_contract_id = contract.id
   and target_offer.status = 'accepted'
  join public.team_seasons as source_team
    on source_team.team_id = contract.team_id
   and source_team.season_id = source_season.id
  join public.team_seasons as target_team
    on target_team.team_id = contract.team_id
   and target_team.season_id = active_season.id
  left join public.sponsor_annual_objective_history as history
    on history.team_sponsor_contract_id = contract.id
   and history.season_id = source_season.id
  join lateral (
    select candidate.*, count(*) over () as candidate_count
    from public.sponsor_offers as candidate
    where candidate.sponsor_id = contract.sponsor_id
      and candidate.season_id = source_season.id
      and candidate.status = 'accepted'
      and (
        candidate.id = history.sponsor_offer_id
        or (
          history.sponsor_offer_id is null
          and exists (
            select 1
            from public.team_manager_assignments as assignment
            where assignment.team_id = contract.team_id
              and assignment.sporting_director_id = candidate.sporting_director_id
              and assignment.role = 'general_manager'
          )
        )
      )
    order by candidate.created_at desc, candidate.id
    limit 1
  ) as source_offer on true
  left join lateral (
    select least(100, coalesce(sum(objective.satisfaction_points), 0))::integer
      as satisfaction_score
    from public.sponsor_objectives as objective
    where objective.sponsor_offer_id = source_offer.id
      and objective.season_id = source_season.id
      and objective.status = 'completed'
  ) as source_score on true
  where contract.role = 'principal'
    and contract.status = 'active'
    and active_season.game_year >= 3
    and source_season.game_year between start_season.game_year
      and start_season.game_year + contract.contract_duration_seasons - 1
    and active_season.game_year between start_season.game_year
      and start_season.game_year + contract.contract_duration_seasons - 1
    and (
      end_season.id is null
      or active_season.game_year <= end_season.game_year
    )
    and objective_season.id = active_season.id
), renewal as (
  select raw.*,
    round(source_budget * (1 + adjustment_percent / 100), 0) as renewal_base
  from raw
), repaired as (
  select renewal.*,
    greatest(
      coalesce(negotiation_budget_ceiling, renewal_base),
      renewal_base
    ) as repaired_budget_ceiling,
    greatest(
      10000,
      least(
        case objective_difficulty
          when 'accessible' then round(renewal_base * 0.90 / 10000) * 10000
          when 'ambitious' then round(renewal_base * 1.10 / 10000) * 10000
          else renewal_base
        end,
        greatest(
          coalesce(negotiation_budget_ceiling, renewal_base),
          renewal_base
        )
      )
    ) as repaired_budget
  from renewal
)
select repaired.*,
  round(source_budget * (1 + least(7, source_bonus_percent) / 100), 2)
    as source_finance_budget,
  round(repaired_budget * (1 + least(7, target_bonus_percent) / 100), 2)
    as target_finance_budget
from repaired;

do $validate_repair_scope$
declare
  v_expected integer;
  v_actual integer;
begin
  select count(*) into v_expected
  from public.team_sponsor_contracts as contract
  join public.seasons as active_season on active_season.status = 'active'
  join public.seasons as source_season
    on source_season.game_year = active_season.game_year - 1
  join public.seasons as start_season on start_season.id = contract.start_season_id
  left join public.seasons as end_season on end_season.id = contract.end_season_id
  join public.seasons as objective_season
    on objective_season.id = coalesce(
      contract.objective_season_id,
      contract.start_season_id
    )
  where contract.role = 'principal'
    and contract.status = 'active'
    and active_season.game_year >= 3
    and source_season.game_year between start_season.game_year
      and start_season.game_year + contract.contract_duration_seasons - 1
    and active_season.game_year between start_season.game_year
      and start_season.game_year + contract.contract_duration_seasons - 1
    and (end_season.id is null or active_season.game_year <= end_season.game_year)
    and objective_season.id = active_season.id;

  select count(*) into v_actual from annual_sponsor_budget_repair;

  if v_actual <> v_expected then
    raise exception 'Réparation sponsor incomplète : % contrat(s) attendu(s), % préparé(s).',
      v_expected, v_actual;
  end if;

  if exists (
    select 1 from annual_sponsor_budget_repair where candidate_count <> 1
  ) then
    raise exception 'Une offre sponsor source est ambiguë.';
  end if;
end;
$validate_repair_scope$;

insert into public.sponsor_annual_budget_repair_audit (
  team_sponsor_contract_id, source_season_id, target_season_id,
  source_sponsor_offer_id, target_sponsor_offer_id,
  source_budget_per_season, original_contract_budget_per_season,
  original_target_offer_budget_per_season, repaired_budget_per_season,
  satisfaction_score, renewal_budget_adjustment_percent
)
select
  contract_id, source_season_id, target_season_id,
  source_offer_id, target_offer_id, source_budget,
  original_contract_budget, original_target_offer_budget,
  repaired_budget, satisfaction_score, adjustment_percent
from annual_sponsor_budget_repair
on conflict (team_sponsor_contract_id, source_season_id, target_season_id)
  do nothing;

-- Backfill every annual source row, including contracts that rolled over before
-- the archival trigger existed. The graph now has one authoritative value per
-- contract and season.
insert into public.sponsor_annual_objective_history (
  team_sponsor_contract_id, season_id, sponsor_offer_id,
  satisfaction_score, objective_reputation_penalty,
  renewal_budget_adjustment_percent, budget_per_season
)
select
  contract_id, source_season_id, source_offer_id,
  satisfaction_score, objective_reputation_penalty,
  adjustment_percent, source_budget
from annual_sponsor_budget_repair
on conflict (team_sponsor_contract_id, season_id) do update set
  sponsor_offer_id = excluded.sponsor_offer_id,
  satisfaction_score = excluded.satisfaction_score,
  objective_reputation_penalty = excluded.objective_reputation_penalty,
  renewal_budget_adjustment_percent = excluded.renewal_budget_adjustment_percent,
  budget_per_season = excluded.budget_per_season;

update public.sponsor_offers as offer
set base_budget_per_season = repair.renewal_base,
    budget_per_season = repair.repaired_budget,
    negotiation_budget_ceiling = repair.repaired_budget_ceiling
from annual_sponsor_budget_repair as repair
where offer.id = repair.target_offer_id;

update public.team_sponsor_contracts as contract
set budget_per_season = repair.repaired_budget,
    renewal_budget_adjustment_percent = 0
from annual_sponsor_budget_repair as repair
where contract.id = repair.contract_id;

update public.team_seasons as team_season
set operating_budget = repair.source_finance_budget
from annual_sponsor_budget_repair as repair
where team_season.id = repair.source_team_season_id;

update public.team_seasons as team_season
set operating_budget = repair.target_finance_budget
from annual_sponsor_budget_repair as repair
where team_season.id = repair.target_team_season_id;

-- The contract update trigger uses the now-archived source budget. Repeat once
-- explicitly so missing rows are also created before the one-off historical fix.
do $sync_repaired_contracts$
declare
  v_contract_id uuid;
begin
  for v_contract_id in
    select contract_id from annual_sponsor_budget_repair order by contract_id
  loop
    perform public.sync_sponsor_installments(v_contract_id);
  end loop;
end;
$sync_repaired_contracts$;

create temporary table expected_sponsor_installments on commit drop as
select
  repair.contract_id,
  repair.source_team_season_id as team_season_id,
  repair.source_season_id as season_id,
  installment.number,
  case when installment.number < 4
    then round(repair.source_finance_budget / 4, 2)
    else repair.source_finance_budget
      - round(repair.source_finance_budget / 4, 2) * 3
  end as amount,
  'sponsor:' || repair.contract_id::text || ':'
    || repair.source_season_id::text || ':' || installment.number
    as source_reference
from annual_sponsor_budget_repair as repair
cross join generate_series(1, 4) as installment(number)
union all
select
  repair.contract_id,
  repair.target_team_season_id,
  repair.target_season_id,
  installment.number,
  case when installment.number < 4
    then round(repair.target_finance_budget / 4, 2)
    else repair.target_finance_budget
      - round(repair.target_finance_budget / 4, 2) * 3
  end,
  'sponsor:' || repair.contract_id::text || ':'
    || repair.target_season_id::text || ':' || installment.number
from annual_sponsor_budget_repair as repair
cross join generate_series(1, 4) as installment(number);

-- Ordinary syncs now preserve posted rows. This controlled curative pass is the
-- only place where already posted, historically overwritten instalments change.
create temporary table sponsor_installment_cash_delta on commit drop as
select
  expected.team_season_id,
  sum(expected.amount - transaction.amount) as amount_delta
from expected_sponsor_installments as expected
join public.team_finance_transactions as transaction
  on transaction.team_season_id = expected.team_season_id
 and transaction.source_reference = expected.source_reference
where transaction.status = 'posted'
group by expected.team_season_id;

update public.team_finance_transactions as transaction
set amount = expected.amount
from expected_sponsor_installments as expected
where transaction.team_season_id = expected.team_season_id
  and transaction.source_reference = expected.source_reference
  and transaction.amount is distinct from expected.amount;

update public.team_seasons as team_season
set cash_balance = team_season.cash_balance + delta.amount_delta
from sponsor_installment_cash_delta as delta
where team_season.id = delta.team_season_id
  and delta.amount_delta <> 0;

do $assert_repair$
declare
  v_definition text;
begin
  if exists (
    select 1
    from annual_sponsor_budget_repair as repair
    join public.team_sponsor_contracts as contract on contract.id = repair.contract_id
    join public.sponsor_offers as offer on offer.id = repair.target_offer_id
    join public.sponsor_annual_objective_history as history
      on history.team_sponsor_contract_id = repair.contract_id
     and history.season_id = repair.source_season_id
    join public.team_seasons as target_team
      on target_team.id = repair.target_team_season_id
    where contract.budget_per_season is distinct from repair.repaired_budget
       or offer.budget_per_season is distinct from repair.repaired_budget
       or offer.base_budget_per_season is distinct from repair.renewal_base
       or history.budget_per_season is distinct from repair.source_budget
       or history.satisfaction_score is distinct from repair.satisfaction_score
       or target_team.operating_budget is distinct from repair.target_finance_budget
  ) then
    raise exception 'Au moins un budget annuel sponsor reste incohérent après réparation.';
  end if;

  if exists (
    select 1
    from expected_sponsor_installments as expected
    left join public.team_finance_transactions as transaction
      on transaction.team_season_id = expected.team_season_id
     and transaction.source_reference = expected.source_reference
    where transaction.id is null
       or transaction.amount is distinct from expected.amount
  ) then
    raise exception 'Au moins une échéance sponsor reste incohérente après réparation.';
  end if;

  select pg_get_functiondef(
    'public.prepare_annual_sponsor_objective_offers(uuid)'::regprocedure
  ) into v_definition;
  if position('private.finalize_continuing_sponsor_offer_budget' in v_definition) = 0 then
    raise exception 'La prévention des budgets sponsor automatiques n est pas installée.';
  end if;

  select pg_get_functiondef(
    'public.sync_sponsor_installments(uuid)'::regprocedure
  ) into v_definition;
  if position('annual_history.budget_per_season' in v_definition) = 0
     or position('status = ''posted''' in v_definition) = 0 then
    raise exception 'La protection des échéances sponsor historiques n est pas installée.';
  end if;
end;
$assert_repair$;

comment on function private.finalize_continuing_sponsor_offer_budget(uuid, uuid) is
  'Calcule le budget annuel S3+ à partir de la satisfaction source puis du niveau d ambition, y compris pour la préparation automatique.';
comment on table public.sponsor_annual_budget_repair_audit is
  'Trace du correctif global S2 vers S3 appliqué aux budgets annuels des contrats sponsors pluriannuels.';

notify pgrst, 'reload schema';

commit;
