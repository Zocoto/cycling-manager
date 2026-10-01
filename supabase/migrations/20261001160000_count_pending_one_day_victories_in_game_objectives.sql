begin;

-- Une classique d'un jour peut avoir son classement d'étape homologué avant
-- que le classement final de l'édition ne soit consolidé. L'objectif de
-- carrière doit compter cette victoire immédiatement, y compris en Régionale,
-- sans la compter une seconde fois lorsque race_results est ensuite créé.
do $$
begin
  if to_regprocedure(
    'public.calculate_game_objective_progress_pre_one_day_fallback(text,uuid,uuid,numeric)'
  ) is null then
    alter function public.calculate_game_objective_progress(
      text,
      uuid,
      uuid,
      numeric
    ) rename to calculate_game_objective_progress_pre_one_day_fallback;
  end if;
end;
$$;

create or replace function public.calculate_game_objective_progress(
  p_metric_key text,
  p_director_id uuid,
  p_current_team_id uuid,
  p_experience_points numeric
)
returns integer
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_value integer;
begin
  if p_metric_key <> 'victories' then
    return public.calculate_game_objective_progress_pre_one_day_fallback(
      p_metric_key,
      p_director_id,
      p_current_team_id,
      p_experience_points
    );
  end if;

  select count(*)::integer
  into v_value
  from (
    select result.id
    from public.race_results as result
    join public.race_rosters as roster
      on roster.id = result.race_roster_id
    join public.race_registrations as registration
      on registration.id = roster.race_registration_id
    join public.team_seasons as team_season
      on team_season.id = registration.team_season_id
    where result.status = 'classified'
      and result.final_rank = 1
      and exists (
        select 1
        from public.team_manager_assignments as assignment
        where assignment.sporting_director_id = p_director_id
          and assignment.role = 'general_manager'
          and assignment.team_id = team_season.team_id
      )

    union all

    select result.id
    from public.stage_results as result
    join public.stages as stage on stage.id = result.stage_id
    join public.race_rosters as roster
      on roster.id = result.race_roster_id
    join public.race_registrations as registration
      on registration.id = roster.race_registration_id
    join public.team_seasons as team_season
      on team_season.id = registration.team_season_id
    where result.status = 'finished'
      and result.rank = 1
      and (
        (
          select count(*)
          from public.stages as edition_stage
          where edition_stage.race_edition_id = stage.race_edition_id
        ) > 1
        or not exists (
          select 1
          from public.race_results as final_result
          where final_result.race_edition_id = stage.race_edition_id
            and final_result.race_roster_id = result.race_roster_id
            and final_result.status = 'classified'
            and final_result.final_rank = 1
        )
      )
      and exists (
        select 1
        from public.team_manager_assignments as assignment
        where assignment.sporting_director_id = p_director_id
          and assignment.role = 'general_manager'
          and assignment.team_id = team_season.team_id
      )
  ) as director_victory;

  return greatest(coalesce(v_value, 0), 0);
end;
$$;

revoke all
on function public.calculate_game_objective_progress(text, uuid, uuid, numeric)
from public, anon, authenticated;

grant execute
on function public.calculate_game_objective_progress(text, uuid, uuid, numeric)
to service_role;

comment on function public.calculate_game_objective_progress(text, uuid, uuid, numeric)
is 'Calcule les objectifs et compte sans doublon les victoires de classiques dès leur classement d étape, avant la consolidation finale éventuelle.';

notify pgrst, 'reload schema';

commit;
