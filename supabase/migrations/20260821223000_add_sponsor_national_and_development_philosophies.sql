begin;

alter table public.sponsor_objectives
  drop constraint if exists sponsor_objectives_type_allowed;

alter table public.sponsor_objectives
  add constraint sponsor_objectives_type_allowed
  check (
    objective_type in (
      'race_result',
      'nationality_quota',
      'season_wins',
      'uci_ranking',
      'nation_uci_ranking',
      'national_championship',
      'homegrown_roster',
      'youth_development',
      'infrastructure'
    )
  );

-- Le moteur public de satisfaction appelle cette fonction historique pour
-- l'évaluation détaillée, puis applique le barème agrégé de fin de saison.
-- On conserve donc son nom public et on enveloppe l'ancienne implémentation.
alter function public.evaluate_sponsor_objectives_for_contract_legacy_20260813(
  uuid,
  boolean
)
  rename to evaluate_sponsor_objectives_for_contract_pre_philosophies_20260821;

create function public.evaluate_sponsor_objectives_for_contract_legacy_20260813(
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
  v_objective record;
  v_metric text;
  v_status text;
  v_current_value numeric(10, 2);
  v_target_value integer;
  v_satisfaction_score integer;
begin
  perform public.evaluate_sponsor_objectives_for_contract_pre_philosophies_20260821(
    p_contract_id,
    p_finalize
  );

  select
    contract.id,
    contract.team_id,
    contract.sponsor_offer_id,
    contract.start_season_id,
    season.game_year
  into v_contract
  from public.team_sponsor_contracts as contract
  join public.seasons as season on season.id = contract.start_season_id
  where contract.id = p_contract_id
    and contract.sponsor_offer_id is not null
    and contract.status in ('active', 'completed')
  limit 1;

  if v_contract is null then
    return;
  end if;

  for v_objective in
    select
      objective.id,
      objective.status as objective_status,
      objective.target_details,
      objective.satisfaction_points,
      progress.id as progress_id,
      progress.status as progress_status
    from public.sponsor_objectives as objective
    join public.objective_progress as progress
      on progress.sponsor_objective_id = objective.id
      and progress.team_sponsor_contract_id = v_contract.id
      and progress.season_id = objective.season_id
    where objective.sponsor_offer_id = v_contract.sponsor_offer_id
      and objective.season_id = v_contract.start_season_id
      and objective.objective_type = 'youth_development'
    order by objective.display_order, objective.id
    for update of progress
  loop
    v_metric := coalesce(v_objective.target_details ->> 'metric', '');
    v_target_value := greatest(
      1,
      coalesce(
        nullif(v_objective.target_details ->> 'minimumCount', '')::integer,
        1
      )
    );
    v_current_value := 0;

    if v_metric = 'promotions' then
      select count(*)::numeric
      into v_current_value
      from public.youth_academy_riders as academy
      where academy.team_id = v_contract.team_id
        and academy.promotion_game_year = v_contract.game_year
        and academy.status = 'promoted'
        and academy.promoted_rider_id is not null;

    elsif v_metric = 'development_roster' then
      select coalesce(max(roster.roster_count), 0)::numeric
      into v_current_value
      from (
        select
          development_team.id,
          count(member.id) as roster_count
        from public.development_teams as development_team
        left join public.development_team_roster as member
          on member.development_team_id = development_team.id
        where development_team.team_id = v_contract.team_id
          and development_team.season_id = v_contract.start_season_id
        group by development_team.id
      ) as roster;

    elsif v_metric = 'junior_race_wins' then
      select count(distinct result.id)::numeric
      into v_current_value
      from public.development_race_results as result
      join public.development_teams as development_team
        on development_team.id = result.development_team_id
      where development_team.team_id = v_contract.team_id
        and development_team.season_id = v_contract.start_season_id
        and result.result_scope = 'general'
        and result.rank = 1;

    elsif v_metric = 'homegrown_sales' then
      select count(distinct listing.id)::numeric
      into v_current_value
      from public.transfer_market_listings as listing
      where listing.seller_team_id = v_contract.team_id
        and listing.season_id = v_contract.start_season_id
        and listing.status = 'settled'
        and exists (
          select 1
          from public.youth_academy_riders as academy
          where academy.team_id = v_contract.team_id
            and academy.status = 'promoted'
            and academy.promoted_rider_id = listing.rider_id
        );
    end if;

    v_current_value := greatest(0, coalesce(v_current_value, 0));
    v_status := case
      when v_objective.objective_status = 'completed'
        or v_objective.progress_status = 'achieved'
        then 'achieved'
      when v_current_value >= v_target_value
        then 'achieved'
      when p_finalize
        then 'failed'
      else 'in_progress'
    end;

    update public.objective_progress
    set
      status = v_status,
      current_value = v_current_value,
      details = coalesce(details, '{}'::jsonb) || jsonb_build_object(
        'currentValue', v_current_value,
        'targetValue', v_target_value,
        'evaluatedStatus', v_status,
        'developmentMetric', v_metric,
        'satisfactionPoints', v_objective.satisfaction_points
      ),
      last_evaluated_at = now(),
      achieved_at = case
        when v_status = 'achieved' then coalesce(achieved_at, now())
        else null
      end,
      updated_at = now()
    where id = v_objective.progress_id;

    update public.sponsor_objectives
    set
      status = case v_status
        when 'achieved' then 'completed'
        when 'failed' then 'failed'
        else 'active'
      end,
      updated_at = now()
    where id = v_objective.id;
  end loop;

  -- L'évaluation courante (hors clôture) doit immédiatement refléter les
  -- objectifs juniors corrigés par l'enveloppe ci-dessus.
  select least(
    100,
    coalesce(sum(objective.satisfaction_points) filter (
      where objective.status = 'completed'
    ), 0)
  )::integer
  into v_satisfaction_score
  from public.sponsor_objectives as objective
  where objective.sponsor_offer_id = v_contract.sponsor_offer_id
    and objective.season_id = v_contract.start_season_id;

  update public.team_sponsor_contracts
  set
    satisfaction_score = v_satisfaction_score,
    satisfaction_updated_at = now()
  where id = v_contract.id;
end;
$$;

revoke all on function public.evaluate_sponsor_objectives_for_contract_pre_philosophies_20260821(
  uuid,
  boolean
) from public;
grant execute on function public.evaluate_sponsor_objectives_for_contract_pre_philosophies_20260821(
  uuid,
  boolean
) to service_role;

revoke all on function public.evaluate_sponsor_objectives_for_contract_legacy_20260813(
  uuid,
  boolean
) from public;
grant execute on function public.evaluate_sponsor_objectives_for_contract_legacy_20260813(
  uuid,
  boolean
) to service_role;

comment on function public.evaluate_sponsor_objectives_for_contract_legacy_20260813(
  uuid,
  boolean
) is
  'Évalue les objectifs historiques puis les promotions, la Dev Team, les victoires juniors et les ventes de coureurs formés au club.';

notify pgrst, 'reload schema';

commit;
