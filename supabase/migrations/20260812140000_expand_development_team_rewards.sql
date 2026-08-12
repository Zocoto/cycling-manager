begin;

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
set search_path = public
as $$
declare
  v_value integer;
begin
  case p_metric_key
    when 'development_teams_created' then
      select count(*)::integer into v_value
      from public.development_teams as development_team
      where exists (
        select 1
        from public.team_manager_assignments as assignment
        where assignment.sporting_director_id = p_director_id
          and assignment.role = 'general_manager'
          and assignment.team_id = development_team.team_id
      );

    when 'development_roster_size' then
      select coalesce(max(roster_count), 0)::integer into v_value
      from (
        select development_team.id, count(roster.id) as roster_count
        from public.development_teams as development_team
        left join public.development_team_roster as roster
          on roster.development_team_id = development_team.id
        where exists (
          select 1
          from public.team_manager_assignments as assignment
          where assignment.sporting_director_id = p_director_id
            and assignment.role = 'general_manager'
            and assignment.team_id = development_team.team_id
        )
        group by development_team.id
      ) as roster_sizes;

    when 'development_race_registrations' then
      select count(*)::integer into v_value
      from public.development_race_registrations as registration
      join public.development_teams as development_team
        on development_team.id = registration.development_team_id
      where registration.status in ('registered', 'completed')
        and exists (
          select 1
          from public.team_manager_assignments as assignment
          where assignment.sporting_director_id = p_director_id
            and assignment.role = 'general_manager'
            and assignment.team_id = development_team.team_id
        );

    when 'development_race_podiums' then
      select count(*)::integer into v_value
      from public.development_race_results as result
      join public.development_teams as development_team
        on development_team.id = result.development_team_id
      where result.result_scope = 'general'
        and result.rank <= 3
        and exists (
          select 1
          from public.team_manager_assignments as assignment
          where assignment.sporting_director_id = p_director_id
            and assignment.role = 'general_manager'
            and assignment.team_id = development_team.team_id
        );

    when 'development_stage_wins' then
      select count(*)::integer into v_value
      from public.development_race_results as result
      join public.development_teams as development_team
        on development_team.id = result.development_team_id
      where result.result_scope = 'stage'
        and result.rank = 1
        and exists (
          select 1
          from public.team_manager_assignments as assignment
          where assignment.sporting_director_id = p_director_id
            and assignment.role = 'general_manager'
            and assignment.team_id = development_team.team_id
        );

    when 'development_race_wins' then
      select count(*)::integer into v_value
      from public.development_race_results as result
      join public.development_teams as development_team
        on development_team.id = result.development_team_id
      where result.result_scope = 'general'
        and result.rank = 1
        and exists (
          select 1
          from public.team_manager_assignments as assignment
          where assignment.sporting_director_id = p_director_id
            and assignment.role = 'general_manager'
            and assignment.team_id = development_team.team_id
        );

    when 'development_profile_wins' then
      select count(distinct edition.profile_type)::integer into v_value
      from public.development_race_results as result
      join public.development_race_editions as edition
        on edition.id = result.race_edition_id
      join public.development_teams as development_team
        on development_team.id = result.development_team_id
      where result.result_scope = 'general'
        and result.rank = 1
        and exists (
          select 1
          from public.team_manager_assignments as assignment
          where assignment.sporting_director_id = p_director_id
            and assignment.role = 'general_manager'
            and assignment.team_id = development_team.team_id
        );

    when 'development_unique_winners' then
      select count(distinct result.academy_rider_id)::integer into v_value
      from public.development_race_results as result
      join public.development_teams as development_team
        on development_team.id = result.development_team_id
      where result.result_scope = 'general'
        and result.rank = 1
        and result.academy_rider_id is not null
        and exists (
          select 1
          from public.team_manager_assignments as assignment
          where assignment.sporting_director_id = p_director_id
            and assignment.role = 'general_manager'
            and assignment.team_id = development_team.team_id
        );

    when 'development_world_podiums' then
      select count(*)::integer into v_value
      from public.development_race_results as result
      join public.development_race_editions as edition
        on edition.id = result.race_edition_id
      join public.development_teams as development_team
        on development_team.id = result.development_team_id
      where result.result_scope = 'general'
        and result.rank <= 3
        and edition.is_world_championship
        and exists (
          select 1
          from public.team_manager_assignments as assignment
          where assignment.sporting_director_id = p_director_id
            and assignment.role = 'general_manager'
            and assignment.team_id = development_team.team_id
        );

    when 'development_world_titles' then
      select count(*)::integer into v_value
      from public.development_race_results as result
      join public.development_race_editions as edition
        on edition.id = result.race_edition_id
      join public.development_teams as development_team
        on development_team.id = result.development_team_id
      where result.result_scope = 'general'
        and result.rank = 1
        and edition.is_world_championship
        and exists (
          select 1
          from public.team_manager_assignments as assignment
          where assignment.sporting_director_id = p_director_id
            and assignment.role = 'general_manager'
            and assignment.team_id = development_team.team_id
        );

    when 'development_tour_wins' then
      select count(*)::integer into v_value
      from public.development_race_results as result
      join public.development_race_editions as edition
        on edition.id = result.race_edition_id
      join public.development_teams as development_team
        on development_team.id = result.development_team_id
      where result.result_scope = 'general'
        and result.rank = 1
        and edition.race_format = 'stage_race'
        and exists (
          select 1
          from public.team_manager_assignments as assignment
          where assignment.sporting_director_id = p_director_id
            and assignment.role = 'general_manager'
            and assignment.team_id = development_team.team_id
        );

    else
      return public.calculate_game_objective_progress_pre_development(
        p_metric_key,
        p_director_id,
        p_current_team_id,
        p_experience_points
      );
  end case;

  return greatest(coalesce(v_value, 0), 0);
end;
$$;

insert into public.game_objective_definitions (
  objective_key,
  objective_type,
  objective_group,
  title,
  description,
  metric_key,
  target_value,
  reward_cash,
  reward_experience,
  reward_reputation,
  reward_inventory_item_key,
  reward_equipment_catalog_key,
  reward_random_special_ability,
  display_order,
  is_active
)
values
  ('development_first_registration', 'secondary', 'development_team', 'Premiers dossards juniors', 'Inscrire pour la première fois votre Development Team à une épreuve.', 'development_race_registrations', 1, 5000, 20, 1, null, null, false, 1475, true),
  ('development_calendar_complete', 'secondary', 'development_team', 'Une relève qui court', 'Cumuler dix inscriptions sur le calendrier de la Development Team.', 'development_race_registrations', 10, 40000, 130, 5, null, null, false, 1485, true),
  ('development_first_podium', 'secondary', 'development_team', 'Dans la cour des grands', 'Obtenir un premier podium sur une épreuve junior.', 'development_race_podiums', 1, 15000, 50, 2, null, null, false, 1490, true),
  ('development_podiums_10', 'secondary', 'development_team', 'Pépinière de podiums', 'Cumuler dix podiums avec les coureurs de vos Development Teams.', 'development_race_podiums', 10, 70000, 210, 7, 'mountain-focus', null, false, 1492, true),
  ('development_first_stage_win', 'secondary', 'development_team', 'Une étape pour la relève', 'Remporter une première étape sur le Tour de la Relève.', 'development_stage_wins', 1, 20000, 70, 3, null, null, false, 1494, true),
  ('development_stage_wins_5', 'secondary', 'development_team', 'Chasseurs d’étapes', 'Cumuler cinq victoires d’étape avec vos juniors.', 'development_stage_wins', 5, 65000, 190, 6, null, null, false, 1496, true),
  ('development_first_win', 'secondary', 'development_team', 'Première victoire junior', 'Remporter une épreuve avec un coureur de votre Development Team.', 'development_race_wins', 1, 35000, 120, 5, 'acceleration-focus', null, false, 1500, true),
  ('development_victories_3', 'secondary', 'development_team', 'La culture de la gagne', 'Cumuler trois victoires sur des épreuves Development Team.', 'development_race_wins', 3, 55000, 160, 6, null, null, false, 1510, true),
  ('development_victories_10', 'secondary', 'development_team', 'Génération dorée', 'Cumuler dix victoires sur des épreuves Development Team.', 'development_race_wins', 10, 140000, 380, 13, 'medallion-panache', null, false, 1520, true),
  ('development_profile_wins_4', 'secondary', 'development_team', 'École de la polyvalence', 'Gagner sur quatre profils de course juniors différents.', 'development_profile_wins', 4, 80000, 240, 8, null, null, false, 1530, true),
  ('development_unique_winners_3', 'secondary', 'development_team', 'Le collectif avant tout', 'Faire gagner au moins trois juniors différents.', 'development_unique_winners', 3, 75000, 220, 8, null, null, false, 1540, true),
  ('development_tour_win', 'secondary', 'development_team', 'Patron de la relève', 'Remporter le classement général du Tour de la Relève.', 'development_tour_wins', 1, 100000, 320, 12, 'potential-notebook', null, false, 1560, true),
  ('development_world_podiums_3', 'secondary', 'development_team', 'Habitués de l’arc-en-ciel', 'Cumuler trois podiums sur les Championnats du monde juniors.', 'development_world_podiums', 3, 110000, 330, 11, null, null, false, 1570, true),
  ('development_world_title', 'secondary', 'development_team', 'Arc-en-ciel junior', 'Former un champion du monde junior, sur route ou contre-la-montre.', 'development_world_titles', 1, 125000, 400, 15, null, null, true, 1580, true),
  ('development_double_world_title', 'secondary', 'development_team', 'Deux arcs-en-ciel', 'Cumuler deux titres de champion du monde junior.', 'development_world_titles', 2, 250000, 700, 25, null, null, true, 1590, true)
on conflict (objective_key) do update set
  objective_type = excluded.objective_type,
  objective_group = excluded.objective_group,
  title = excluded.title,
  description = excluded.description,
  metric_key = excluded.metric_key,
  target_value = excluded.target_value,
  reward_cash = excluded.reward_cash,
  reward_experience = excluded.reward_experience,
  reward_reputation = excluded.reward_reputation,
  reward_inventory_item_key = excluded.reward_inventory_item_key,
  reward_equipment_catalog_key = excluded.reward_equipment_catalog_key,
  reward_random_special_ability = excluded.reward_random_special_ability,
  display_order = excluded.display_order,
  is_active = excluded.is_active,
  updated_at = now();

revoke all on function public.calculate_game_objective_progress(text, uuid, uuid, numeric)
  from public, anon, authenticated;
grant execute on function public.calculate_game_objective_progress(text, uuid, uuid, numeric)
  to service_role;

notify pgrst, 'reload schema';

commit;
