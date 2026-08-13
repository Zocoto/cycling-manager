begin;

-- Le budget d'une reconduction dépend de la satisfaction finale. Cette valeur
-- est conservée sur le contrat pour l'audit, mais n'est jamais appliquée aux
-- offres d'un autre sponsor.
alter table public.team_sponsor_contracts
  add column if not exists renewal_budget_adjustment_percent numeric(5, 2)
    not null default 0,
  add column if not exists objective_reputation_penalty smallint
    not null default 0;

alter table public.team_sponsor_contracts
  drop constraint if exists team_sponsor_contracts_renewal_adjustment_range,
  drop constraint if exists team_sponsor_contracts_objective_reputation_penalty_range;

alter table public.team_sponsor_contracts
  add constraint team_sponsor_contracts_renewal_adjustment_range
    check (renewal_budget_adjustment_percent between -25 and 10),
  add constraint team_sponsor_contracts_objective_reputation_penalty_range
    check (objective_reputation_penalty between 0 and 50);

-- Les anciens bonus par objectif ne doivent plus être appliqués au budget de
-- toutes les équipes lors du rollover : seule l'offre de reconduction porte
-- désormais l'ajustement calculé depuis la satisfaction.
update public.team_seasons
set next_sponsor_budget_bonus_percent = 0
where next_sponsor_budget_bonus_percent <> 0;

update public.sponsor_objectives
set renewal_bonus_percent = 0
where renewal_bonus_percent <> 0;

-- Un objectif rempli ne rapporte plus de réputation et ne modifie plus le
-- budget à lui seul. La satisfaction et la pénalité agrégée sont réglées par
-- le moteur de fin de saison ci-dessous.
create or replace function public.reward_completed_sponsor_objective()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  return new;
end;
$$;

alter function public.evaluate_sponsor_objectives_for_contract(uuid, boolean)
  rename to evaluate_sponsor_objectives_for_contract_legacy_20260813;

create function public.evaluate_sponsor_objectives_for_contract(
  p_contract_id uuid,
  p_finalize boolean default false
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_contract record;
  v_director_id uuid;
  v_reputation_before integer;
  v_previous_objective_penalty integer := 0;
  v_live_objective_count integer := 0;
  v_completed_objective_count integer := 0;
  v_required_completed_count integer := 0;
  v_objective_penalty integer := 0;
  v_satisfaction_score integer := 0;
  v_budget_adjustment numeric(5, 2) := 0;
begin
  if not p_finalize then
    perform public.evaluate_sponsor_objectives_for_contract_legacy_20260813(
      p_contract_id,
      false
    );
    return;
  end if;

  select
    contract.id,
    contract.team_id,
    contract.sponsor_offer_id,
    contract.start_season_id,
    team_season.id as team_season_id,
    contract.objective_reputation_penalty
  into v_contract
  from public.team_sponsor_contracts as contract
  join public.team_seasons as team_season
    on team_season.team_id = contract.team_id
    and team_season.season_id = contract.start_season_id
  where contract.id = p_contract_id
    and contract.sponsor_offer_id is not null
    and contract.status in ('active', 'completed')
  for update of contract;

  if v_contract is null then
    return;
  end if;

  select
    sporting_director.id,
    sporting_director.reputation_points
  into
    v_director_id,
    v_reputation_before
  from public.team_manager_assignments as assignment
  join public.sporting_directors as sporting_director
    on sporting_director.id = assignment.sporting_director_id
  where assignment.team_id = v_contract.team_id
    and assignment.role = 'general_manager'
    and assignment.status = 'active'
  limit 1;

  v_previous_objective_penalty :=
    coalesce(v_contract.objective_reputation_penalty, 0);

  -- Le moteur historique reste la source de vérité pour déterminer quels
  -- objectifs sont atteints ou échoués. Ses anciennes pénalités unitaires
  -- sont ensuite remplacées de manière idempotente par le nouveau barème.
  perform public.evaluate_sponsor_objectives_for_contract_legacy_20260813(
    p_contract_id,
    true
  );

  select
    count(*) filter (where objective.status <> 'cancelled'),
    count(*) filter (where objective.status = 'completed'),
    least(
      100,
      coalesce(sum(objective.satisfaction_points) filter (
        where objective.status = 'completed'
      ), 0)
    )::integer
  into
    v_live_objective_count,
    v_completed_objective_count,
    v_satisfaction_score
  from public.sponsor_objectives as objective
  where objective.sponsor_offer_id = v_contract.sponsor_offer_id
    and objective.season_id = v_contract.start_season_id;

  v_required_completed_count := ceil(v_live_objective_count / 2.0)::integer;
  v_objective_penalty := greatest(
    0,
    v_required_completed_count - v_completed_objective_count
  ) * 10;

  if v_satisfaction_score <= 50 then
    v_budget_adjustment := (v_satisfaction_score - 50) / 2.0;
  else
    v_budget_adjustment := (v_satisfaction_score - 50) / 5.0;
  end if;

  if v_director_id is not null then
    update public.sporting_directors
    set reputation_points = greatest(
      0,
      v_reputation_before
        + v_previous_objective_penalty
        - v_objective_penalty
    )
    where id = v_director_id;
  end if;

  update public.team_sponsor_contracts
  set
    satisfaction_score = v_satisfaction_score,
    satisfaction_updated_at = now(),
    renewal_budget_adjustment_percent = v_budget_adjustment,
    objective_reputation_penalty = v_objective_penalty
  where id = p_contract_id;

  update public.objective_progress
  set
    reputation_penalty = 0,
    details = details - 'reputationPenalty',
    updated_at = now()
  where team_sponsor_contract_id = p_contract_id
    and reputation_penalty <> 0;

  update public.team_seasons
  set next_sponsor_budget_bonus_percent = 0
  where id = v_contract.team_season_id
    and next_sponsor_budget_bonus_percent <> 0;
end;
$$;

revoke all on function public.evaluate_sponsor_objectives_for_contract(uuid, boolean)
  from public;
grant execute on function public.evaluate_sponsor_objectives_for_contract(uuid, boolean)
  to service_role;

revoke all on function public.evaluate_sponsor_objectives_for_contract_legacy_20260813(uuid, boolean)
  from public;
grant execute on function public.evaluate_sponsor_objectives_for_contract_legacy_20260813(uuid, boolean)
  to service_role;

comment on column public.team_sponsor_contracts.renewal_budget_adjustment_percent is
  'Ajustement linéaire réservé à une offre de reconduction : -25 % à satisfaction 0, 0 % à 50 et +10 % à 100.';

comment on column public.team_sponsor_contracts.objective_reputation_penalty is
  'Pénalité agrégée de 10 points par objectif manquant sous la moitié des objectifs vivants, sans gain au-dessus.';

comment on function public.evaluate_sponsor_objectives_for_contract(uuid, boolean) is
  'Évalue les objectifs sponsor, calcule la satisfaction, le barème de reconduction et une pénalité de réputation uniquement sous 50 % de réussite.';

notify pgrst, 'reload schema';

commit;
