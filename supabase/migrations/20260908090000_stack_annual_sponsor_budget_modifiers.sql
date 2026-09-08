begin;

-- A multi-season contract must only read the objectives and sporting bonuses
-- of its current objective season. Without this filter, S3 bonuses would leak
-- into every later season covered by the same legal contract.
create or replace function public.get_sponsor_objective_satisfaction_score(
  p_contract_id uuid
)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select least(
    100,
    coalesce(sum(objective.satisfaction_points) filter (
      where objective.status = 'completed'
    ), 0)
  )::integer
  from public.team_sponsor_contracts as contract
  left join public.sponsor_objectives as objective
    on objective.sponsor_offer_id = contract.sponsor_offer_id
    and objective.season_id = coalesce(
      contract.objective_season_id,
      contract.start_season_id
    )
  where contract.id = p_contract_id;
$$;

create or replace function public.get_sponsor_performance_satisfaction_score(
  p_contract_id uuid
)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select least(25, coalesce(sum(event.points), 0))::integer
  from public.team_sponsor_contracts as contract
  left join public.sponsor_satisfaction_events as event
    on event.team_sponsor_contract_id = contract.id
    and event.season_id = coalesce(
      contract.objective_season_id,
      contract.start_season_id
    )
  where contract.id = p_contract_id;
$$;

-- The preview shown from J21 uses the live satisfaction score as its first
-- modifier, then preserves the player's annual ambition tier as the second.
create or replace function public.ensure_continuing_sponsor_offer(
  p_contract_id uuid,
  p_sporting_director_id uuid,
  p_base_budget numeric,
  p_budget_ceiling numeric
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_contract record;
  v_active_season record;
  v_target_season record;
  v_offer record;
  v_offer_id uuid;
  v_adjustment_percent numeric;
  v_expected_base numeric;
  v_negotiated_budget numeric;
  v_budget_changed boolean := false;
begin
  if p_contract_id is null or p_sporting_director_id is null then
    raise exception 'Le contrat et le Directeur Sportif sont obligatoires.';
  end if;

  select
    contract.id,
    contract.team_id,
    contract.sponsor_id,
    contract.budget_per_season,
    contract.satisfaction_score,
    contract.currency_code,
    start_season.game_year as start_game_year,
    start_season.game_year + contract.contract_duration_seasons - 1
      as end_game_year,
    sponsor.name as sponsor_name
  into v_contract
  from public.team_sponsor_contracts as contract
  join public.seasons as start_season
    on start_season.id = contract.start_season_id
  join public.sponsors as sponsor
    on sponsor.id = contract.sponsor_id
  join public.team_manager_assignments as assignment
    on assignment.team_id = contract.team_id
   and assignment.sporting_director_id = p_sporting_director_id
   and assignment.role = 'general_manager'
   and assignment.status = 'active'
  where contract.id = p_contract_id
    and contract.role = 'principal'
    and contract.status = 'active'
  for update of contract;

  if not found then
    raise exception 'Ce contrat est introuvable ou ne vous appartient pas.';
  end if;

  select season.id, season.game_year, season.current_day_number
  into v_active_season
  from public.seasons as season
  where season.status = 'active';

  if not found or coalesce(v_active_season.current_day_number, 0) < 21 then
    raise exception 'La préparation du sponsor de la saison suivante ouvre au jour 21.';
  end if;

  select season.id, season.game_year
  into v_target_season
  from public.seasons as season
  where season.game_year = v_active_season.game_year + 1
    and season.status = 'planned';

  if not found or v_target_season.game_year < 3 then
    raise exception 'Le cumul satisfaction et ambition débute en saison 3.';
  end if;

  if v_contract.end_game_year < v_target_season.game_year then
    raise exception 'Ce contrat ne couvre pas la saison suivante.';
  end if;

  v_adjustment_percent := case
    when v_contract.satisfaction_score <= 50 then
      (v_contract.satisfaction_score - 50) / 2.0
    else (v_contract.satisfaction_score - 50) / 5.0
  end;
  v_expected_base := round(
    v_contract.budget_per_season * (1 + v_adjustment_percent / 100),
    0
  );

  if p_base_budget <= 0
     or abs(v_expected_base - p_base_budget) > 0.01 then
    raise exception 'La satisfaction sponsor a évolué. Rechargez la page.';
  end if;

  if p_budget_ceiling is null or p_budget_ceiling < p_base_budget then
    raise exception 'Le plafond de négociation est invalide.';
  end if;

  select
    offer.id,
    offer.base_budget_per_season,
    offer.negotiation_budget_ceiling,
    offer.objective_difficulty,
    offer.status
  into v_offer
  from public.sponsor_offers as offer
  where offer.continuing_contract_id = v_contract.id
    and offer.season_id = v_target_season.id
  for update;

  if found then
    if v_offer.status <> 'accepted' then
      raise exception 'Cette préparation annuelle n est plus modifiable.';
    end if;

    v_budget_changed :=
      abs(v_offer.base_budget_per_season - p_base_budget) > 0.01
      or abs(v_offer.negotiation_budget_ceiling - p_budget_ceiling) > 0.01;

    v_negotiated_budget := case v_offer.objective_difficulty
      when 'accessible' then
        round(p_base_budget * 0.90 / 10000) * 10000
      when 'ambitious' then
        round(p_base_budget * 1.10 / 10000) * 10000
      else p_base_budget
    end;
    v_negotiated_budget := greatest(
      10000,
      least(v_negotiated_budget, p_budget_ceiling)
    );

    update public.sponsor_offers
    set base_budget_per_season = p_base_budget,
        budget_per_season = v_negotiated_budget,
        negotiation_budget_ceiling = p_budget_ceiling
    where id = v_offer.id;

    v_offer_id := v_offer.id;

    if v_budget_changed then
      delete from public.sponsor_objectives
      where sponsor_offer_id = v_offer_id
        and season_id = v_target_season.id
        and status = 'draft';
    end if;
  else
    insert into public.sponsor_offers (
      sponsor_id,
      season_id,
      sporting_director_id,
      continuing_contract_id,
      title,
      description,
      budget_per_season,
      base_budget_per_season,
      negotiation_budget_ceiling,
      objective_difficulty,
      currency_code,
      contract_duration_seasons,
      available_from,
      available_until,
      status,
      generation_version
    ) values (
      v_contract.sponsor_id,
      v_target_season.id,
      p_sporting_director_id,
      v_contract.id,
      'Objectifs annuels · ' || v_contract.sponsor_name,
      'Renégociation annuelle cumulant satisfaction et niveau d ambition.',
      p_base_budget,
      p_base_budget,
      p_budget_ceiling,
      'balanced',
      v_contract.currency_code,
      1,
      now(),
      null,
      'accepted',
      9
    )
    returning id into v_offer_id;
  end if;

  update public.team_sponsor_contracts
  set pending_sponsor_offer_id = v_offer_id
  where id = v_contract.id;

  return v_offer_id;
end;
$$;

-- Keep an already prepared annual offer synchronized when the objective
-- evaluator finalizes a satisfaction adjustment. The rollover below remains
-- the authority of last resort and repeats the same calculation atomically.
create or replace function private.finalize_planned_sponsor_renewal_budget()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_planned record;
  v_annual record;
  v_renewal_base numeric;
  v_negotiated_budget numeric;
  v_adjustment_percent numeric;
begin
  if new.role <> 'principal' then
    return new;
  end if;

  for v_planned in
    select
      planned_contract.id as contract_id,
      planned_contract.sponsor_offer_id,
      offer.objective_difficulty,
      offer.negotiation_budget_ceiling
    from public.team_sponsor_contracts as planned_contract
    join public.seasons as old_start_season
      on old_start_season.id = new.start_season_id
    join public.seasons as planned_start_season
      on planned_start_season.id = planned_contract.start_season_id
    join public.sponsor_offers as offer
      on offer.id = planned_contract.sponsor_offer_id
    where planned_contract.id <> new.id
      and planned_contract.team_id = new.team_id
      and planned_contract.sponsor_id = new.sponsor_id
      and planned_contract.role = 'principal'
      and planned_contract.status = 'planned'
      and planned_start_season.game_year =
        old_start_season.game_year + new.contract_duration_seasons
    for update of planned_contract, offer
  loop
    v_renewal_base := round(
      new.budget_per_season
        * (1 + new.renewal_budget_adjustment_percent / 100),
      2
    );

    v_negotiated_budget := case v_planned.objective_difficulty
      when 'accessible' then
        round(v_renewal_base * 0.90 / 10000) * 10000
      when 'ambitious' then
        round(v_renewal_base * 1.10 / 10000) * 10000
      else v_renewal_base
    end;
    v_negotiated_budget := greatest(
      10000,
      least(
        v_negotiated_budget,
        greatest(v_planned.negotiation_budget_ceiling, v_renewal_base)
      )
    );

    update public.team_sponsor_contracts
    set budget_per_season = v_negotiated_budget
    where id = v_planned.contract_id;

    update public.sponsor_offers
    set base_budget_per_season = v_renewal_base,
        budget_per_season = v_negotiated_budget
    where id = v_planned.sponsor_offer_id;
  end loop;

  select
    offer.id as offer_id,
    offer.objective_difficulty,
    offer.negotiation_budget_ceiling,
    target_season.game_year
  into v_annual
  from public.sponsor_offers as offer
  join public.seasons as target_season
    on target_season.id = offer.season_id
  where offer.id = new.pending_sponsor_offer_id
    and offer.continuing_contract_id = new.id
    and offer.status = 'accepted'
  for update of offer;

  if found and v_annual.game_year >= 3 then
    v_adjustment_percent := case
      when new.satisfaction_score <= 50 then
        (new.satisfaction_score - 50) / 2.0
      else (new.satisfaction_score - 50) / 5.0
    end;
    v_renewal_base := round(
      new.budget_per_season * (1 + v_adjustment_percent / 100),
      0
    );
    v_negotiated_budget := case v_annual.objective_difficulty
      when 'accessible' then
        round(v_renewal_base * 0.90 / 10000) * 10000
      when 'ambitious' then
        round(v_renewal_base * 1.10 / 10000) * 10000
      else v_renewal_base
    end;
    v_negotiated_budget := greatest(
      10000,
      least(
        v_negotiated_budget,
        greatest(v_annual.negotiation_budget_ceiling, v_renewal_base)
      )
    );

    update public.sponsor_offers
    set base_budget_per_season = v_renewal_base,
        budget_per_season = v_negotiated_budget,
        negotiation_budget_ceiling = greatest(
          negotiation_budget_ceiling,
          v_renewal_base
        )
    where id = v_annual.offer_id;
  end if;

  return new;
end;
$$;

-- Annual sponsor satisfaction and ambition stack: settle the final budget
-- after the source season evaluation and immediately before annual activation.
do $patch_rollover_final_budget$
declare
  v_definition text;
  v_marker text := '  -- Annual sponsor terms prepared during J21-J28 become live atomically.';
  v_patched text;
  v_block text := $block$
  -- Annual sponsor satisfaction and ambition stack from season 3 onward.
  with annual_budget_base as (
    select
      offer.id as offer_id,
      offer.objective_difficulty,
      offer.negotiation_budget_ceiling,
      round(
        contract.budget_per_season * (
          1 + case
            when contract.satisfaction_score <= 50 then
              (contract.satisfaction_score - 50) / 2.0
            else (contract.satisfaction_score - 50) / 5.0
          end / 100
        ),
        0
      ) as renewal_base
    from public.team_sponsor_contracts as contract
    join public.sponsor_offers as offer
      on offer.id = contract.pending_sponsor_offer_id
     and offer.continuing_contract_id = contract.id
    join public.seasons as target_season
      on target_season.id = offer.season_id
    where contract.role = 'principal'
      and contract.status = 'active'
      and offer.status = 'accepted'
      and offer.season_id = v_target.id
      and target_season.game_year >= 3
  ),
  annual_budget as (
    select
      annual_budget_base.*,
      greatest(
        10000,
        least(
          case annual_budget_base.objective_difficulty
            when 'accessible' then
              round(annual_budget_base.renewal_base * 0.90 / 10000) * 10000
            when 'ambitious' then
              round(annual_budget_base.renewal_base * 1.10 / 10000) * 10000
            else annual_budget_base.renewal_base
          end,
          greatest(
            annual_budget_base.negotiation_budget_ceiling,
            annual_budget_base.renewal_base
          )
        )
      ) as negotiated_budget
    from annual_budget_base
  )
  update public.sponsor_offers as offer
  set
    base_budget_per_season = annual_budget.renewal_base,
    budget_per_season = annual_budget.negotiated_budget,
    negotiation_budget_ceiling = greatest(
      annual_budget.negotiation_budget_ceiling,
      annual_budget.renewal_base
    )
  from annual_budget
  where offer.id = annual_budget.offer_id;

$block$;
begin
  select pg_get_functiondef(
    'public.rollover_game_season(uuid,boolean)'::regprocedure
  ) into v_definition;

  if position('Annual sponsor satisfaction and ambition stack from season 3 onward' in v_definition) = 0 then
    if position(v_marker in v_definition) = 0 then
      raise exception 'Le point de finalisation du budget sponsor annuel est introuvable.';
    end if;

    v_patched := replace(v_definition, v_marker, v_block || v_marker);
    execute v_patched;
  end if;
end;
$patch_rollover_final_budget$;

revoke all on function public.get_sponsor_objective_satisfaction_score(uuid)
  from public;
revoke all on function public.get_sponsor_performance_satisfaction_score(uuid)
  from public;
revoke all on function public.ensure_continuing_sponsor_offer(
  uuid, uuid, numeric, numeric
) from public, anon, authenticated;

grant execute on function public.get_sponsor_objective_satisfaction_score(uuid)
  to service_role;
grant execute on function public.get_sponsor_performance_satisfaction_score(uuid)
  to service_role;
grant execute on function public.ensure_continuing_sponsor_offer(
  uuid, uuid, numeric, numeric
) to service_role;

comment on function public.ensure_continuing_sponsor_offer(
  uuid, uuid, numeric, numeric
) is 'Prépare le budget annuel S3+ en cumulant satisfaction courante puis palier d ambition, sans effet avant rollover.';

notify pgrst, 'reload schema';

commit;
