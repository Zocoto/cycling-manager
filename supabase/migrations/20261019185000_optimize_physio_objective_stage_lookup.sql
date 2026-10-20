-- Restrict the historical physiotherapist objective to the director's exact stage/rider pairs.
-- Rewrites only the timed-out course branch of physio_form_saved.
-- No row mutation, index build, fixture, benchmark, or result correction.
begin;
set local application_name = 'incident-20261019-physio-query';
set local lock_timeout = '500ms';
set local statement_timeout = '8s';

do $migration$
declare
  v_definition text;
  v_anchor text := $anchor$        select effect.physiotherapist_form_protection::integer as points
        from public.stage_rider_condition_effects as effect
        join public.stages as stage on stage.id = effect.stage_id
        join public.race_rosters as roster on roster.rider_id = effect.rider_id
        join public.race_registrations as registration
          on registration.id = roster.race_registration_id
         and registration.race_edition_id = stage.race_edition_id
        join public.team_seasons as team_season
          on team_season.id = registration.team_season_id
        where effect.physiotherapist_form_protection > 0
          and exists (
            select 1 from public.team_manager_assignments as assignment
            where assignment.sporting_director_id = p_director_id
              and assignment.role = 'general_manager'
              and assignment.team_id = team_season.team_id
          )$anchor$;
  v_replacement text := $replacement$        -- physio_stage_exact_lookup_v1
        select scoped_effect.points
        from (
          with owned_registrations as materialized (
            -- DISTINCT retains the original EXISTS semantics when a director
            -- has multiple historical manager assignments for the same team.
            select distinct registration.id, registration.race_edition_id
            from public.team_manager_assignments as assignment
            join public.team_seasons as team_season
              on team_season.team_id = assignment.team_id
            join public.race_registrations as registration
              on registration.team_season_id = team_season.id
            where assignment.sporting_director_id = p_director_id
              and assignment.role = 'general_manager'
          ), owned_stage_rosters as materialized (
            select stage.id as stage_id, roster.rider_id
            from owned_registrations as registration
            join public.stages as stage
              on stage.race_edition_id = registration.race_edition_id
            join public.race_rosters as roster
              on roster.race_registration_id = registration.id
          )
          select effect.points
          from owned_stage_rosters as owned
          cross join lateral (
            -- Probe the existing UNIQUE(stage_id, rider_id) index. OFFSET 0
            -- keeps this parameterized lookup from flattening back into the
            -- global effect/rider-history join which timed out in production.
            select effect.physiotherapist_form_protection::integer as points
            from public.stage_rider_condition_effects as effect
            where effect.stage_id = owned.stage_id
              and effect.rider_id = owned.rider_id
              and effect.physiotherapist_form_protection > 0
            offset 0
          ) as effect
        ) as scoped_effect$replacement$;
begin
  select replace(pg_get_functiondef(
    'public.calculate_expanded_game_objective_progress(text,uuid)'::regprocedure
  ), chr(13), '') into v_definition;
  if position('physio_stage_exact_lookup_v1' in v_definition) > 0 then
    return;
  end if;
  if (length(v_definition) - length(replace(v_definition, v_anchor, ''))) / length(v_anchor) <> 1
    or position('and session.is_contract_eligible' in v_definition) = 0 then
    raise exception 'Unexpected objective metric definition: review before applying';
  end if;
  execute replace(v_definition, v_anchor, v_replacement);
end;
$migration$;

-- Same signature/permissions. The function remains stable/security definer.
-- No PostgREST schema change is required.
commit;
