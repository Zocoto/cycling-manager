begin;
set local statement_timeout = '8s';
set local lock_timeout = '500ms';

-- Find missing results before reading the (potentially large) simulation JSON.
-- The original eligibility threshold still counts ALL expected participants.
create or replace function public.get_incomplete_completed_race_edition_ids(p_season_id uuid)
returns table(race_edition_id uuid)
language sql stable security definer
set search_path to ''
as $function$
  with roster_candidates as not materialized (
    select edition.id as race_edition_id, race.competition_type,
      roster.id as race_roster_id, roster.rider_id
    from public.race_editions edition
    join public.races race on race.id = edition.race_id
    join public.race_registrations registration
      on registration.race_edition_id = edition.id
      and registration.status = 'accepted'
      and registration.team_season_id is not null
    join public.race_rosters roster on roster.race_registration_id = registration.id
    where edition.season_id = p_season_id and edition.status = 'completed'
      and (roster.status in ('selected', 'confirmed') or (
        roster.status = 'withdrawn' and exists (
          select 1 from public.stage_results outside_time_result
          join public.stages result_stage on result_stage.id = outside_time_result.stage_id
          where outside_time_result.race_roster_id = roster.id
            and outside_time_result.status = 'outside_time_limit'
            and result_stage.race_edition_id = edition.id
        )
      ))
  ), missing_results as materialized (
    select candidate.* from roster_candidates candidate
    left join public.race_results result
      on result.race_edition_id = candidate.race_edition_id
      and result.race_roster_id = candidate.race_roster_id
    where result.id is null
  ), missing_editions as materialized (
    select distinct missing.race_edition_id from missing_results missing
    where not exists (
      select 1 from public.stages first_stage
      join public.official_stage_simulations simulation on simulation.stage_id = first_stage.id
      where first_stage.race_edition_id = missing.race_edition_id
        and first_stage.stage_number = 1
        and coalesce(simulation.input_data -> 'unavailableRiderIds', '[]'::jsonb) ? missing.rider_id::text
    )
  )
  select candidate.race_edition_id
  from missing_editions missing
  join roster_candidates candidate on candidate.race_edition_id = missing.race_edition_id
  where not exists (
    select 1 from public.stages first_stage
    join public.official_stage_simulations simulation on simulation.stage_id = first_stage.id
    where first_stage.race_edition_id = candidate.race_edition_id
      and first_stage.stage_number = 1
      and coalesce(simulation.input_data -> 'unavailableRiderIds', '[]'::jsonb) ? candidate.rider_id::text
  )
  group by candidate.race_edition_id, candidate.competition_type
  having count(*) >= case when candidate.competition_type = 'standard' then 2 else 1 end
  order by candidate.race_edition_id;
$function$;

-- Keep reconciliation, qualification freezing and expired-call processing.
-- Only the per-country generation loop is skipped once every possible target
-- departure has passed. Callup deadlines are always at/before departure.
do $migration$
declare
  v_definition text;
  v_anchor text := E'    for v_country in\n';
  v_guard text := $guard$
    -- performance_closed_callup_slots_v1
    if p_now is not null and not exists (
      select 1 from public.race_editions edition
      join public.races race on race.id = edition.race_id
      join public.stages stage on stage.race_edition_id = edition.id
      where edition.season_id = v_season.id
        and edition.status <> 'cancelled'
        and race.competition_type = v_slot.competition_code
        and (stage.departure_at > p_now or stage.departure_at is null)
    ) then
      continue;
    end if;

$guard$;
begin
  select pg_get_functiondef('public.prepare_due_automatic_federation_professional_lineups(timestamptz)'::regprocedure)
    into v_definition;
  if position('performance_closed_callup_slots_v1' in v_definition) = 0 then
    if (length(v_definition) - length(replace(v_definition, v_anchor, ''))) / length(v_anchor) <> 1 then
      raise exception 'Automatic federation lineup loop changed; review required';
    end if;
    execute replace(v_definition, v_anchor, v_guard || v_anchor);
  end if;
end;
$migration$;

commit;
