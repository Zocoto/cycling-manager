begin;
set local application_name = 'sponsor-visibility-objectives-20261128';
set local lock_timeout = '500ms';
set local statement_timeout = '8s';

alter table public.sponsor_objectives
  drop constraint sponsor_objectives_type_allowed,
  add constraint sponsor_objectives_type_allowed check (objective_type in (
    'race_result', 'nationality_quota', 'season_wins', 'uci_ranking',
    'nation_uci_ranking', 'national_championship', 'homegrown_roster',
    'youth_development', 'rider_recruitment', 'infrastructure', 'race_visibility'
  )) not valid,
  add constraint sponsor_objectives_visibility_target_allowed check (
    objective_type <> 'race_visibility' or coalesce(
      target_details->>'kind' = 'race_visibility'
      and target_details->>'metric' in ('classic_breakaways', 'stage_breakaways', 'combativity_awards')
      and jsonb_typeof(target_details->'minimumCount') = 'number'
      and target_details->>'minimumCount' ~ '^[1-9][0-9]{0,3}$',
      false
    )
  ) not valid;

-- The race roster freezes the club represented on race day, including for
-- riders who later transfer or leave the team. Each qualifying race or stage
-- can advance its objective only once, regardless of the riders involved.
create function private.count_sponsor_race_visibility(p_team_season_id uuid, p_season_id uuid, p_metric text)
returns integer
language sql
stable
set search_path = ''
as $$
  with registrations as materialized (
    select registration.id, edition.id as edition_id, race.race_format
    from public.race_registrations registration
    join public.race_editions edition on edition.id = registration.race_edition_id
    join public.races race on race.id = edition.race_id
    where registration.team_season_id = p_team_season_id
      and edition.season_id = p_season_id and edition.status <> 'cancelled'
      and race.competition_type = 'standard'
      and race.slug is distinct from 'criterium-de-la-decouverte'
  )
  select case
    when p_metric in ('classic_breakaways', 'stage_breakaways') then (
      select count(distinct case when p_metric = 'classic_breakaways' then registration.edition_id else stage.id end)::integer
      from registrations registration
      join public.race_rosters roster on roster.race_registration_id = registration.id
      join public.stage_attack_participants participation on participation.race_roster_id = roster.id
        and participation.participation_type = 'breakaway'
      join public.stages stage on stage.id = participation.stage_id and stage.race_edition_id = registration.edition_id
      where stage.status = 'completed' and stage.stage_type = 'road'
        and registration.race_format = case p_metric when 'classic_breakaways' then 'one_day' else 'stage_race' end
    )
    when p_metric = 'combativity_awards' then (
      select count(distinct stage.id)::integer
      from registrations registration
      join public.race_rosters roster on roster.race_registration_id = registration.id
      join public.race_combativity_awards award on award.race_roster_id = roster.id
        and award.race_edition_id = registration.edition_id and award.award_scope = 'stage'
      join public.stages stage on stage.id = award.stage_id and stage.race_edition_id = registration.edition_id
      where stage.status = 'completed' and stage.stage_type = 'road'
    )
    else 0
  end;
$$;

-- Extend the canonical seasonal evaluator before its cached terminal states.
-- This keeps progress creation, satisfaction, reputation and season-end
-- settlement on the existing path. Settled visibility records stay frozen.
do $visibility_evaluator$
declare
  v_definition text;
  v_anchor constant text := '    elsif v_objective.objective_status = ''completed''';
  v_public_function constant regprocedure :=
    'public.evaluate_sponsor_objectives_for_contract_pre_philosophies_20260821(uuid,boolean)'::regprocedure;
begin
  select replace(pg_get_functiondef(v_public_function), chr(13), '') into v_definition;
  if length(v_definition) - length(replace(v_definition, v_anchor, '')) <> length(v_anchor)
    or position('v_contract.objective_season_id' in v_definition) = 0
    or position('v_objective.settled_at is null' in v_definition) = 0 then
    raise exception 'Unexpected sponsor evaluator definition for visibility goals.';
  end if;
  execute replace(v_definition, v_anchor, $branch$    elsif v_objective.objective_type = 'race_visibility' then
      if v_objective.settled_at is not null then
        continue;
      end if;
      v_target_value := (v_objective.target_details->>'minimumCount')::integer;
      v_current_value := private.count_sponsor_race_visibility(
        v_contract.team_season_id, v_contract.objective_season_id, v_objective.target_details->>'metric'
      );
      if v_current_value >= v_target_value then
        v_status := 'achieved';
      elsif p_finalize then
        v_status := 'failed';
      end if;

    elsif v_objective.objective_status = 'completed'$branch$);
end;
$visibility_evaluator$;

-- Daily publication needs live progress between tour stages. Refresh just the
-- visibility objectives of the clubs entered in the edition rather than
-- running the full sponsorship and finance evaluators after an award.
create function private.refresh_sponsor_visibility_for_edition(p_race_edition_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_contract record;
  v_objective record;
  v_target integer;
  v_current integer;
  v_status text;
  v_objective_status text;
  v_changed boolean;
begin
  for v_contract in
    select contract.id, contract.sponsor_offer_id, registration.team_season_id, edition.season_id
    from public.race_editions edition
    join public.races race on race.id = edition.race_id
    join public.race_registrations registration on registration.race_edition_id = edition.id
    join public.team_seasons team_season on team_season.id = registration.team_season_id
      and team_season.season_id = edition.season_id
    join public.team_sponsor_contracts contract on contract.team_id = team_season.team_id
      and coalesce(contract.objective_season_id, contract.start_season_id) = edition.season_id
    where edition.id = p_race_edition_id and edition.status <> 'cancelled'
      and race.competition_type = 'standard'
      and race.slug is distinct from 'criterium-de-la-decouverte'
      and contract.status in ('active', 'completed')
      and exists (
        select 1 from public.sponsor_objectives objective
        join public.objective_progress progress on progress.sponsor_objective_id = objective.id
          and progress.team_sponsor_contract_id = contract.id and progress.season_id = objective.season_id
        where objective.sponsor_offer_id = contract.sponsor_offer_id and objective.season_id = edition.season_id
          and objective.objective_type = 'race_visibility' and objective.status <> 'cancelled'
          and progress.settled_at is null
      )
    order by contract.id
  loop
    v_changed := false;
    for v_objective in
      select objective.id, objective.status as objective_status, objective.target_details, objective.satisfaction_points,
        progress.id as progress_id, progress.status as progress_status, progress.current_value, progress.details
      from public.sponsor_objectives objective
      join public.objective_progress progress on progress.sponsor_objective_id = objective.id
        and progress.team_sponsor_contract_id = v_contract.id and progress.season_id = objective.season_id
      where objective.sponsor_offer_id = v_contract.sponsor_offer_id and objective.season_id = v_contract.season_id
        and objective.objective_type = 'race_visibility' and objective.status <> 'cancelled'
        and progress.settled_at is null
      order by objective.display_order, objective.id
      for update of progress
    loop
      v_target := (v_objective.target_details->>'minimumCount')::integer;
      v_current := private.count_sponsor_race_visibility(
        v_contract.team_season_id, v_contract.season_id, v_objective.target_details->>'metric'
      );
      v_status := case when v_current >= v_target then 'achieved' else 'in_progress' end;
      v_objective_status := case v_status when 'achieved' then 'completed' else 'active' end;

      if v_objective.progress_status is distinct from v_status
        or v_objective.current_value is distinct from v_current
        or (v_objective.details->>'targetValue') is distinct from v_target::text then
        update public.objective_progress progress
        set status = v_status, current_value = v_current,
          details = coalesce(progress.details, '{}'::jsonb) || jsonb_build_object(
            'currentValue', v_current, 'targetValue', v_target, 'evaluatedStatus', v_status,
            'satisfactionPoints', v_objective.satisfaction_points
          ),
          last_evaluated_at = now(), updated_at = now(),
          achieved_at = case when v_status = 'achieved' then coalesce(progress.achieved_at, now()) end
        where progress.id = v_objective.progress_id;
      end if;

      if v_objective.objective_status is distinct from v_objective_status then
        update public.sponsor_objectives objective
        set status = v_objective_status, updated_at = now()
        where objective.id = v_objective.id;
        v_changed := true;
      end if;
    end loop;

    if v_changed then
      update public.team_sponsor_contracts contract
      set satisfaction_score = public.get_sponsor_objective_satisfaction_score(v_contract.id),
        satisfaction_updated_at = now()
      where contract.id = v_contract.id;
    end if;
  end loop;
end;
$$;

create function public.refresh_sponsor_visibility_for_stage(p_stage_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
set lock_timeout = '500ms'
as $$
declare v_race_edition_id uuid;
begin
  select stage.race_edition_id into v_race_edition_id from public.stages stage
  where stage.id = p_stage_id and stage.status = 'completed' and stage.stage_type = 'road';
  if v_race_edition_id is not null then
    perform private.refresh_sponsor_visibility_for_edition(v_race_edition_id);
  end if;
end;
$$;

-- Applied official corrections already have a single edition-level hook
-- after all facts have been replaced. Recompute the still-open counters there.
do $visibility_replays$
declare
  v_definition text;
  v_anchor constant text := replace($anchor$    perform public.reconcile_sponsor_race_objectives_for_edition(
      new.race_edition_id
    );$anchor$, chr(13), '');
begin
  select replace(pg_get_functiondef('private.reconcile_sponsor_objectives_after_official_replay()'::regprocedure), chr(13), '')
    into v_definition;
  if length(v_definition) - length(replace(v_definition, v_anchor, '')) <> length(v_anchor) then
    raise exception 'Unexpected sponsor correction definition for visibility goals.';
  end if;
  execute replace(v_definition, v_anchor, v_anchor || E'\n    perform private.refresh_sponsor_visibility_for_edition(new.race_edition_id);');
end;
$visibility_replays$;

-- New annual clones reuse the portfolio consistency and weighting functions.
-- Keep separate classic, tour and combativity requirements in the same plan.
do $visibility_portfolios$
declare
  v_definition text;
  v_metric_anchor constant text := '    when ''youth_development'' then a->>''metric''=b->>''metric''';
  v_weight_anchor constant text := '    when ''infrastructure'' then 5+3*(d->>''minimumCompletedCount'')::double precision';
  v_alignment_anchor constant text := '    when ''youth_development'' then d->>''kind'' in (''youth_development'',''homegrown_roster'')';
begin
  select replace(pg_get_functiondef('private.sponsor_objective_requirements_overlap(jsonb,jsonb)'::regprocedure), chr(13), '')
    into v_definition;
  if length(v_definition) - length(replace(v_definition, v_metric_anchor, '')) <> length(v_metric_anchor) then
    raise exception 'Unexpected sponsor portfolio requirements definition for visibility goals.';
  end if;
  execute replace(v_definition, v_metric_anchor, v_metric_anchor || E'\n    when ''race_visibility'' then a->>''metric''=b->>''metric''');

  select replace(pg_get_functiondef('private.sponsor_objective_difficulty_weight(jsonb,text,text)'::regprocedure), chr(13), '')
    into v_definition;
  if length(v_definition) - length(replace(v_definition, v_weight_anchor, '')) <> length(v_weight_anchor)
    or length(v_definition) - length(replace(v_definition, v_alignment_anchor, '')) <> length(v_alignment_anchor) then
    raise exception 'Unexpected sponsor portfolio difficulty definition for visibility goals.';
  end if;
  v_definition := replace(v_definition, v_weight_anchor, v_weight_anchor || $weight$
    when 'race_visibility' then case d->>'metric'
      when 'classic_breakaways' then 7+1.5*(d->>'minimumCount')::double precision
      when 'stage_breakaways' then 7+1.2*(d->>'minimumCount')::double precision
      when 'combativity_awards' then 10+4*(d->>'minimumCount')::double precision
    end$weight$);
  execute replace(v_definition, v_alignment_anchor, v_alignment_anchor || E'\n    when ''visibility'' then d->>''kind''=''race_visibility''');
end;
$visibility_portfolios$;

-- Selecting an ambition for the first time should keep the offer's original
-- sporting identity after the existing negotiation archives its current plan.
create function public.get_archived_sponsor_offer_philosophies(p_offer_ids uuid[])
returns table(sponsor_offer_id uuid, sporting_philosophy text)
language sql
stable
security definer
set search_path = ''
as $$
  select distinct on (plan.sponsor_offer_id) plan.sponsor_offer_id, goal.sporting_philosophy
  from private.sponsor_objective_ambition_plans plan
  cross join lateral (
    select objective.value->'target_details'->>'sportingPhilosophy' as sporting_philosophy
    from jsonb_array_elements(plan.objectives) with ordinality as objective(value, position)
    where nullif(objective.value->'target_details'->>'sportingPhilosophy', '') is not null
    order by objective.position
    limit 1
  ) goal
  where plan.sponsor_offer_id = any(p_offer_ids)
  order by plan.sponsor_offer_id, plan.created_at, plan.objective_difficulty;
$$;

revoke all on function private.count_sponsor_race_visibility(uuid, uuid, text) from public, anon, authenticated, service_role;
revoke all on function private.refresh_sponsor_visibility_for_edition(uuid) from public, anon, authenticated, service_role;
revoke all on function public.refresh_sponsor_visibility_for_stage(uuid), public.get_archived_sponsor_offer_philosophies(uuid[])
  from public, anon, authenticated;
grant execute on function public.refresh_sponsor_visibility_for_stage(uuid), public.get_archived_sponsor_offer_philosophies(uuid[])
  to service_role;

notify pgrst, 'reload schema';
commit;
