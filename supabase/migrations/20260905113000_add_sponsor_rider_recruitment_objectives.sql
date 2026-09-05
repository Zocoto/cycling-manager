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
      'rider_recruitment',
      'infrastructure'
    )
  );

-- L'enveloppe ne crée ni ne modifie aucun objectif existant. Elle apprend
-- seulement au moteur d'évaluation à suivre les nouvelles offres qui auront
-- explicitement ciblé un coureur après le déploiement de cette migration.
alter function public.evaluate_sponsor_objectives_for_contract_legacy_20260813(
  uuid,
  boolean
)
  rename to evaluate_sponsor_objectives_pre_recruitment_20260905;

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
  v_target_rider_id uuid;
  v_current_value numeric(10, 2);
  v_status text;
  v_satisfaction_score integer;
begin
  perform public.evaluate_sponsor_objectives_pre_recruitment_20260905(
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
      and objective.objective_type = 'rider_recruitment'
    order by objective.display_order, objective.id
    for update of progress
  loop
    v_target_rider_id := case
      when coalesce(v_objective.target_details ->> 'riderId', '') ~*
        '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
        then (v_objective.target_details ->> 'riderId')::uuid
      else null
    end;

    select case
      when v_target_rider_id is not null and exists (
        select 1
        from public.rider_contracts as rider_contract
        join public.seasons as start_season
          on start_season.id = rider_contract.start_season_id
        join public.seasons as end_season
          on end_season.id = rider_contract.end_season_id
        where rider_contract.rider_id = v_target_rider_id
          and rider_contract.team_id = v_contract.team_id
          and rider_contract.status in (
            'planned',
            'active',
            'completed',
            'terminated'
          )
          and v_contract.game_year between
            start_season.game_year and end_season.game_year
      ) then 1
      else 0
    end::numeric
    into v_current_value;

    v_status := case
      when v_objective.objective_status = 'completed'
        or v_objective.progress_status = 'achieved'
        then 'achieved'
      when v_current_value >= 1
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
        'targetValue', 1,
        'targetRiderId', v_target_rider_id,
        'evaluatedStatus', v_status,
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

revoke all on function public.evaluate_sponsor_objectives_pre_recruitment_20260905(
  uuid,
  boolean
) from public;
grant execute on function public.evaluate_sponsor_objectives_pre_recruitment_20260905(
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
  'Évalue les objectifs historiques puis valide le recrutement du coureur précisément désigné par une nouvelle offre sponsor.';

notify pgrst, 'reload schema';

commit;
