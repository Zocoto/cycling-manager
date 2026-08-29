begin;

-- Les prises en charge médicales sont déjà historisées. On réutilise ces
-- faits de jeu pour rendre le nouvel objectif rétroactif, sans compteur ni
-- écriture supplémentaire pendant les soins.
create index if not exists rider_injury_treatments_team_season_injury_idx
  on public.rider_injury_treatments (team_season_id, rider_injury_id);

create index if not exists rider_injury_care_applications_team_season_injury_idx
  on public.rider_injury_care_item_applications (
    team_season_id,
    rider_injury_id
  );

alter function public.calculate_game_objective_progress(text, uuid, uuid, numeric)
  rename to calculate_game_objective_progress_pre_hl_thl_wellness;

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
    when 'treated_injuries' then
      select count(distinct care.rider_injury_id)::integer
      into v_value
      from (
        select
          treatment.rider_injury_id,
          team_season.team_id
        from public.rider_injury_treatments as treatment
        join public.team_seasons as team_season
          on team_season.id = treatment.team_season_id

        union all

        select
          application.rider_injury_id,
          team_season.team_id
        from public.rider_injury_care_item_applications as application
        join public.team_seasons as team_season
          on team_season.id = application.team_season_id
      ) as care
      where exists (
        select 1
        from public.team_manager_assignments as assignment
        where assignment.sporting_director_id = p_director_id
          and assignment.role = 'general_manager'
          and assignment.team_id = care.team_id
      );

    else
      return public.calculate_game_objective_progress_pre_hl_thl_wellness(
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
  (
    'training_sessions_hl', 'secondary', 'training',
    'La fabrique du progrès',
    'Palier HL · Achever 500 séances individuelles d’entraînement au cours de la carrière.',
    'completed_training_sessions', 500,
    100000, 300, 10, 'potential-spark', null, false, 1540, true
  ),
  (
    'training_sessions_thl', 'secondary', 'training',
    'Une vie à entraîner',
    'Palier THL · Achever 2 500 séances individuelles d’entraînement au cours de la carrière.',
    'completed_training_sessions', 2500,
    350000, 900, 30, null, null, true, 1550, true
  ),
  (
    'nutrition_interventions_hl', 'secondary', 'health',
    'Cuisine de haute précision',
    'Palier HL · Réaliser 100 interventions nutritionnelles auprès des coureurs.',
    'nutrition_interventions', 100,
    75000, 220, 7, 'potential-spark', null, false, 1750, true
  ),
  (
    'nutrition_interventions_thl', 'secondary', 'health',
    'La table des champions',
    'Palier THL · Réaliser 500 interventions nutritionnelles auprès des coureurs.',
    'nutrition_interventions', 500,
    275000, 700, 22, null, null, true, 1760, true
  ),
  (
    'nutrition_form_hl', 'secondary', 'health',
    'Réserves inépuisables',
    'Palier HL · Faire regagner 500 points de forme cumulés grâce à la nutrition.',
    'nutrition_form_gained', 500,
    100000, 300, 10, 'potential-spark', null, false, 1770, true
  ),
  (
    'nutrition_form_thl', 'secondary', 'health',
    'Énergie d’une dynastie',
    'Palier THL · Faire regagner 2 500 points de forme cumulés grâce à la nutrition.',
    'nutrition_form_gained', 2500,
    350000, 900, 30, null, null, true, 1780, true
  ),
  (
    'physio_form_saved_hl', 'secondary', 'health',
    'Capital jambes',
    'Palier HL · Préserver 500 points de forme cumulés grâce au travail des kinés.',
    'physio_form_saved', 500,
    125000, 350, 12, 'potential-spark', null, false, 1790, true
  ),
  (
    'physio_form_saved_thl', 'secondary', 'health',
    'Les gardiens de la fraîcheur',
    'Palier THL · Préserver 2 500 points de forme cumulés grâce au travail des kinés.',
    'physio_form_saved', 2500,
    400000, 1000, 35, null, null, true, 1800, true
  ),
  (
    'treated_injuries_hl', 'secondary', 'health',
    'Infirmerie de référence',
    'Palier HL · Prendre en charge 25 blessures distinctes par un protocole ou un objet de soin.',
    'treated_injuries', 25,
    80000, 250, 8, 'injury-care-anti-inflammatory-protocol', null, false, 1810, true
  ),
  (
    'treated_injuries_thl', 'secondary', 'health',
    'Cent retours au peloton',
    'Palier THL · Prendre en charge 100 blessures distinctes par un protocole ou un objet de soin.',
    'treated_injuries', 100,
    300000, 750, 25, null, null, true, 1820, true
  )
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

revoke all
on function public.calculate_game_objective_progress(text, uuid, uuid, numeric)
from public, anon, authenticated;
grant execute
on function public.calculate_game_objective_progress(text, uuid, uuid, numeric)
to service_role;

comment on function public.calculate_game_objective_progress(text, uuid, uuid, numeric) is
  'Calcule les objectifs de carrière, dont les blessures distinctes prises en charge par les équipes successives du DS.';

notify pgrst, 'reload schema';

commit;
