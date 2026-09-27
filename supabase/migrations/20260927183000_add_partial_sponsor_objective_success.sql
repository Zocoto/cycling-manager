begin;

-- A race objective remains failed when the requested rank is missed, but a
-- result immediately beyond the target now earns a small, auditable share of
-- its satisfaction. For a victory objective, the partial tier is the podium.
alter function public.evaluate_sponsor_objectives_for_contract(uuid, boolean)
  rename to evaluate_sponsor_objectives_pre_partial_success_20260927;

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
  v_objective record;
  v_edition_id uuid;
  v_edition_status text;
  v_result_rank integer;
  v_target_rank integer;
  v_partial_threshold integer;
  v_achievement_level text;
  v_partial_satisfaction_points integer;
begin
  perform public.evaluate_sponsor_objectives_pre_partial_success_20260927(
    p_contract_id,
    p_finalize
  );

  select
    contract.id,
    contract.sponsor_offer_id,
    coalesce(
      contract.objective_season_id,
      contract.start_season_id
    ) as objective_season_id
  into v_contract
  from public.team_sponsor_contracts as contract
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
      objective.target_details,
      objective.satisfaction_points,
      progress.id as progress_id,
      progress.current_value
    from public.sponsor_objectives as objective
    join public.objective_progress as progress
      on progress.sponsor_objective_id = objective.id
      and progress.team_sponsor_contract_id = v_contract.id
      and progress.season_id = v_contract.objective_season_id
    where objective.sponsor_offer_id = v_contract.sponsor_offer_id
      and objective.season_id = v_contract.objective_season_id
      and objective.objective_type = 'race_result'
      and objective.status <> 'cancelled'
    order by objective.display_order, objective.id
    for update of progress
  loop
    v_target_rank := greatest(
      1,
      coalesce(
        nullif(v_objective.target_details ->> 'targetRank', '')::integer,
        1
      )
    );
    v_partial_threshold := greatest(
      3,
      ceil(v_target_rank * 1.5)::integer
    );
    v_edition_id := case
      when coalesce(v_objective.target_details ->> 'raceEditionId', '') ~*
        '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
        then (v_objective.target_details ->> 'raceEditionId')::uuid
      else null
    end;

    if v_edition_id is null or not exists (
      select 1
      from public.race_editions as expected_edition
      where expected_edition.id = v_edition_id
        and expected_edition.season_id = v_contract.objective_season_id
    ) then
      select edition.id
      into v_edition_id
      from public.race_editions as edition
      where edition.race_id = case
        when coalesce(v_objective.target_details ->> 'raceId', '') ~*
          '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
          then (v_objective.target_details ->> 'raceId')::uuid
        else null
      end
        and edition.season_id = v_contract.objective_season_id
      order by edition.created_at
      limit 1;
    end if;

    select edition.status
    into v_edition_status
    from public.race_editions as edition
    where edition.id = v_edition_id;

    if v_edition_status = 'completed' then
      v_result_rank := nullif(round(v_objective.current_value)::integer, 0);
      v_achievement_level := case
        when v_result_rank is not null and v_result_rank <= v_target_rank
          then 'full'
        when v_result_rank is not null
          and v_result_rank <= v_partial_threshold
          then 'partial'
        else 'missed'
      end;
      v_partial_satisfaction_points := case
        when v_achievement_level = 'partial' then greatest(
          1,
          round(v_objective.satisfaction_points * 0.40)::integer
        )
        else 0
      end;

      update public.objective_progress
      set
        details = coalesce(details, '{}'::jsonb) || jsonb_build_object(
          'resultRank', v_result_rank,
          'targetRank', v_target_rank,
          'achievementLevel', v_achievement_level,
          'partialThresholdRank', v_partial_threshold,
          'partialSatisfactionPoints', v_partial_satisfaction_points
        ),
        updated_at = now()
      where id = v_objective.progress_id;
    end if;
  end loop;

  -- Re-touching the contract lets the canonical S3 trigger add sporting
  -- events while also incorporating the newly credited partial objective.
  update public.team_sponsor_contracts
  set
    satisfaction_score = public.get_sponsor_objective_satisfaction_score(id),
    satisfaction_updated_at = now()
  where id = v_contract.id;
end;
$$;

-- The media-center multiplier continues to apply to the objective subtotal.
-- A partial result is derived from the objective weight, not from mutable UI
-- metadata, which keeps recalculations deterministic and idempotent.
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
    round(
      coalesce(sum(
        case
          when objective.status = 'completed'
            then objective.satisfaction_points
          when objective.objective_type = 'race_result'
            and objective.status = 'failed'
            and progress.details ->> 'achievementLevel' = 'partial'
            then greatest(
              1,
              round(objective.satisfaction_points * 0.40)::integer
            )
          else 0
        end
      ), 0) * (
        1 + 0.10 * public.get_team_specialization_power(
          contract.team_id,
          'media_center',
          'community_media'
        )
      )
    )
  )::integer
  from public.team_sponsor_contracts as contract
  left join public.sponsor_objectives as objective
    on objective.sponsor_offer_id = contract.sponsor_offer_id
    and objective.season_id = coalesce(
      contract.objective_season_id,
      contract.start_season_id
    )
  left join public.objective_progress as progress
    on progress.sponsor_objective_id = objective.id
    and progress.team_sponsor_contract_id = contract.id
    and progress.season_id = objective.season_id
  where contract.id = p_contract_id
  group by contract.team_id;
$$;

-- The canonical BEFORE trigger must use NEW during annual rollover. Keep its
-- direct calculation aligned with get_sponsor_objective_satisfaction_score.
create or replace function public.synchronize_s3_sponsor_satisfaction_score()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_active_game_year integer;
  v_objective_score integer;
  v_performance_score integer;
begin
  if new.role <> 'principal' or new.sponsor_offer_id is null then
    return new;
  end if;

  select max(season.game_year)
  into v_active_game_year
  from public.seasons as season
  where season.status = 'active';

  if coalesce(v_active_game_year, 0) < 3 then
    return new;
  end if;

  select least(
    100,
    round(
      coalesce(sum(
        case
          when objective.status = 'completed'
            then objective.satisfaction_points
          when objective.objective_type = 'race_result'
            and objective.status = 'failed'
            and progress.details ->> 'achievementLevel' = 'partial'
            then greatest(
              1,
              round(objective.satisfaction_points * 0.40)::integer
            )
          else 0
        end
      ), 0) * (
        1 + 0.10 * public.get_team_specialization_power(
          new.team_id,
          'media_center',
          'community_media'
        )
      )
    )
  )::integer
  into v_objective_score
  from public.sponsor_objectives as objective
  left join public.objective_progress as progress
    on progress.sponsor_objective_id = objective.id
    and progress.team_sponsor_contract_id = new.id
    and progress.season_id = objective.season_id
  where objective.sponsor_offer_id = new.sponsor_offer_id
    and objective.season_id = coalesce(
      new.objective_season_id,
      new.start_season_id
    );

  select least(25, coalesce(sum(event.points), 0))::integer
  into v_performance_score
  from public.sponsor_satisfaction_events as event
  where event.team_sponsor_contract_id = new.id
    and event.season_id = coalesce(
      new.objective_season_id,
      new.start_season_id
    );

  new.satisfaction_score := least(
    100,
    coalesce(v_objective_score, 0) + coalesce(v_performance_score, 0)
  );
  new.satisfaction_updated_at := now();
  return new;
end;
$$;

revoke all on function public.evaluate_sponsor_objectives_for_contract(
  uuid,
  boolean
) from public;
grant execute on function public.evaluate_sponsor_objectives_for_contract(
  uuid,
  boolean
) to service_role;

revoke all on function public.evaluate_sponsor_objectives_pre_partial_success_20260927(
  uuid,
  boolean
) from public;
grant execute on function public.evaluate_sponsor_objectives_pre_partial_success_20260927(
  uuid,
  boolean
) to service_role;

revoke all on function public.get_sponsor_objective_satisfaction_score(uuid)
  from public;
grant execute on function public.get_sponsor_objective_satisfaction_score(uuid)
  to service_role;

revoke all on function public.synchronize_s3_sponsor_satisfaction_score()
  from public;

comment on function public.evaluate_sponsor_objectives_for_contract(
  uuid,
  boolean
) is
  'Évalue les objectifs sponsor, conserve le classement final des objectifs de course et crédite 40 % de satisfaction en cas de résultat proche.';

notify pgrst, 'reload schema';

commit;
