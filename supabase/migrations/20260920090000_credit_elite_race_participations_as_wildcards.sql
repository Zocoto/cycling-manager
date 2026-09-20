begin;

-- Une équipe promue en division Élite n'a plus à demander de WildCard pour
-- les courses Élite. Ses inscriptions acceptées à ces épreuves doivent donc
-- continuer à faire progresser les objectifs de carrière correspondants.
alter function public.calculate_game_objective_progress(
  text,
  uuid,
  uuid,
  numeric
)
rename to calculate_game_objective_progress_pre_elite_participation_credit;

create function public.calculate_game_objective_progress(
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
begin
  if p_metric_key = 'accepted_wildcards' then
    return (
      select count(distinct registration.id)::integer
      from public.race_registrations as registration
      join public.team_seasons as team_season
        on team_season.id = registration.team_season_id
      left join public.divisions as division
        on division.id = team_season.division_id
      join public.race_editions as edition
        on edition.id = registration.race_edition_id
      join public.race_categories as category
        on category.id = edition.race_category_id
      where registration.status = 'accepted'
        and (
          registration.entry_method = 'invited'
          or (
            division.code = 'elite'
            and category.code = 'elite'
          )
        )
        and exists (
          select 1
          from public.team_manager_assignments as assignment
          where assignment.sporting_director_id = p_director_id
            and assignment.role = 'general_manager'
            and assignment.team_id = team_season.team_id
        )
    );
  end if;

  return public.calculate_game_objective_progress_pre_elite_participation_credit(
    p_metric_key,
    p_director_id,
    p_current_team_id,
    p_experience_points
  );
end;
$$;

update public.game_objective_definitions
set
  description = case objective_key
    when 'wildcard_1'
      then 'Obtenir une wildcard acceptée ou une participation validée à une course Élite avec une équipe Élite.'
    when 'wildcard_5'
      then 'Cumuler cinq wildcards acceptées ou participations validées à des courses Élite avec une équipe Élite.'
    else description
  end,
  updated_at = now()
where objective_key in ('wildcard_1', 'wildcard_5');

revoke all on function public.calculate_game_objective_progress_pre_elite_participation_credit(
  text,
  uuid,
  uuid,
  numeric
) from public, anon, authenticated;
grant execute on function public.calculate_game_objective_progress_pre_elite_participation_credit(
  text,
  uuid,
  uuid,
  numeric
) to service_role;

revoke all on function public.calculate_game_objective_progress(
  text,
  uuid,
  uuid,
  numeric
) from public, anon;
grant execute on function public.calculate_game_objective_progress(
  text,
  uuid,
  uuid,
  numeric
) to authenticated, service_role;

comment on function public.calculate_game_objective_progress(
  text,
  uuid,
  uuid,
  numeric
) is
  'Calcule les objectifs de carrière et assimile les participations Élite des équipes Élite à des WildCards acceptées.';

commit;
