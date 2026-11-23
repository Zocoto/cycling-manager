begin;
set local statement_timeout = '5s';
set local lock_timeout = '500ms';

-- A national title goal ends when its own championships have been homologated,
-- not when another country's race starts or the calendar date has elapsed.
create function private.evaluate_national_championship_sponsor_goal(
  p_team_id uuid,
  p_season_id uuid,
  p_target_details jsonb,
  p_finalize boolean default false
)
returns table(current_value numeric, target_value integer, evaluated_status text)
language sql
stable
security definer
set search_path = ''
as $$
  with target as (
    select upper(coalesce(p_target_details->>'countryCode', '')) as country_code,
      coalesce(p_target_details->>'championshipType', 'any') as championship_type,
      coalesce(nullif(p_target_details->>'requiredTitleCount', '')::integer, 1) as required_count
  ), expected as (
    select discipline.competition_type
    from target
    cross join (values ('road', 'national_road'), ('time_trial', 'national_time_trial'))
      as discipline(championship_type, competition_type)
    where target.championship_type = 'any'
      or target.championship_type = discipline.championship_type
  ), achievement as (
    select count(distinct title.id)::numeric as title_count
    from public.rider_national_championship_titles as title
    join public.countries as country on country.id = title.country_id
    join public.seasons as season on season.id = title.season_id
    cross join target
    where title.season_id = p_season_id
      and upper(country.iso_alpha2) = target.country_code
      and ((target.championship_type = 'any' and title.championship_type in ('road', 'time_trial'))
        or title.championship_type = target.championship_type)
      and exists (
        select 1
        from public.rider_contracts as contract
        join public.seasons as start_season on start_season.id = contract.start_season_id
        join public.seasons as end_season on end_season.id = contract.end_season_id
        where contract.rider_id = title.rider_id
          and contract.team_id = p_team_id
          and contract.status in ('active', 'completed', 'terminated')
          and season.game_year between start_season.game_year and end_season.game_year
      )
  ), championships as (
    select exists (select 1 from expected)
      and not exists (
        select 1 from expected
        where not exists (
          select 1
          from public.races as race
          join public.countries as country on country.id = race.country_id
          join public.race_editions as edition on edition.race_id = race.id
          cross join target
          where race.competition_type = expected.competition_type
            and upper(country.iso_alpha2) = target.country_code
            and edition.season_id = p_season_id
            and edition.status in ('completed', 'cancelled')
        )
        or exists (
          select 1
          from public.races as race
          join public.countries as country on country.id = race.country_id
          join public.race_editions as edition on edition.race_id = race.id
          cross join target
          where race.competition_type = expected.competition_type
            and upper(country.iso_alpha2) = target.country_code
            and edition.season_id = p_season_id
            and edition.status not in ('completed', 'cancelled')
        )
      ) as finished
  )
  select achievement.title_count, target.required_count,
    case when achievement.title_count >= target.required_count then 'achieved'
      when p_finalize or championships.finished then 'failed'
      else 'in_progress' end
  from achievement cross join target cross join championships;
$$;

revoke all on function private.evaluate_national_championship_sponsor_goal(uuid,uuid,jsonb,boolean)
  from public, anon, authenticated;
grant execute on function private.evaluate_national_championship_sponsor_goal(uuid,uuid,jsonb,boolean)
  to service_role;

do $national_title_goals$
declare
  v_definition text;
  v_branch_start constant text := '    elsif v_objective.objective_type = ''national_championship'' then';
  v_branch_end constant text := '    elsif v_objective.objective_type = ''homegrown_roster'' then';
  v_failed_guard constant text := replace($guard$    elsif v_objective.objective_status = 'failed'
      or v_objective.progress_status = 'failed' then
      v_status := 'failed';$guard$, chr(13), '');
  v_start integer;
  v_end integer;
  v_branch text;
begin
  v_definition := replace(pg_get_functiondef(
    'public.evaluate_sponsor_objectives_for_contract_pre_philosophies_20260821(uuid,boolean)'::regprocedure
  ), chr(13), '');
  if length(v_definition)-length(replace(v_definition,v_branch_start,'')) <> length(v_branch_start)
    or length(v_definition)-length(replace(v_definition,v_branch_end,'')) <> length(v_branch_end)
    or length(v_definition)-length(replace(v_definition,v_failed_guard,'')) <> length(v_failed_guard)
  then
    raise exception 'Unexpected national championship sponsor evaluator anchors';
  end if;
  v_start := strpos(v_definition,v_branch_start);
  v_end := strpos(v_definition,v_branch_end);
  v_branch := substring(v_definition from v_start for v_end-v_start);
  if v_end <= v_start
    or strpos(v_branch,'title.season_id = v_contract.objective_season_id') = 0
    or strpos(v_branch,'elsif p_finalize then') = 0
    or strpos(v_branch,'public.rider_national_championship_titles') = 0
  then
    raise exception 'Unexpected national championship sponsor evaluator body';
  end if;
  v_definition := replace(v_definition,v_branch,replace($branch$    elsif v_objective.objective_type = 'national_championship' then
      select goal.current_value, goal.target_value, goal.evaluated_status
      into v_current_value, v_target_value, v_status
      from private.evaluate_national_championship_sponsor_goal(
        v_contract.team_id, v_contract.objective_season_id,
        v_objective.target_details, p_finalize
      ) as goal;

$branch$, chr(13), ''));
  -- A failed, unsealed goal can still follow an official replay/correction.
  -- Preserve achieved goals, settled history and every other objective type.
  v_definition := replace(v_definition,v_failed_guard,replace($guard$    elsif (v_objective.objective_status = 'failed'
      or v_objective.progress_status = 'failed')
      and (v_objective.objective_type <> 'national_championship'
        or v_objective.settled_at is not null) then
      v_status := 'failed';$guard$, chr(13), ''));
  execute v_definition;
end;
$national_title_goals$;

-- Repair only stale, unsuccessful goals for the live annual contract. No
-- season settlement, budget, reputation, offer generation or other goal runs.
with candidates as materialized (
  select progress.id as progress_id, objective.id as objective_id,
    goal.current_value, goal.target_value
  from public.sponsor_objectives as objective
  join public.seasons as season on season.id = objective.season_id and season.status = 'active'
  join public.team_sponsor_contracts as contract
    on contract.sponsor_offer_id = objective.sponsor_offer_id
    and coalesce(contract.objective_season_id,contract.start_season_id) = objective.season_id
    and contract.status = 'active'
    and contract.role = 'principal'
  join public.objective_progress as progress
    on progress.sponsor_objective_id = objective.id
    and progress.team_sponsor_contract_id = contract.id
    and progress.season_id = objective.season_id
  cross join lateral private.evaluate_national_championship_sponsor_goal(
    contract.team_id, objective.season_id, objective.target_details, false
  ) as goal
  where objective.objective_type = 'national_championship'
    and objective.status = 'active'
    and progress.status in ('not_started','in_progress')
    and progress.settled_at is null
    and goal.evaluated_status = 'failed'
), repaired as (
  update public.objective_progress as progress
  set status = 'failed', current_value = candidate.current_value,
    details = coalesce(progress.details,'{}'::jsonb) || jsonb_build_object(
      'currentValue',candidate.current_value,'targetValue',candidate.target_value,
      'evaluatedStatus','failed'
    ), last_evaluated_at = now(), updated_at = now()
  from candidates as candidate
  where progress.id = candidate.progress_id
    and progress.status in ('not_started','in_progress')
    and progress.settled_at is null
  returning candidate.objective_id
)
update public.sponsor_objectives as objective
set status = 'failed', updated_at = now()
from repaired
where objective.id = repaired.objective_id and objective.status = 'active';

notify pgrst, 'reload schema';
commit;
