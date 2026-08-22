begin;

-- L'expérience affichée sur les fiches vaut 0,2 point par jour de course,
-- avec un plafond de 100 atteint après 500 jours. L'objectif retient le
-- meilleur score parmi l'effectif professionnel actif et les juniors encore
-- rattachés au centre de formation de l'équipe actuelle.
alter function public.calculate_game_objective_progress(text, uuid, uuid, numeric)
  rename to calculate_game_objective_progress_pre_rider_experience;

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
    when 'highest_active_rider_experience' then
      select coalesce(max(candidate.experience_score), 0)::integer
      into v_value
      from (
        select least(
          100,
          floor(greatest(0, rider.career_race_days)::numeric / 5)::integer
        ) as experience_score
        from public.rider_contracts as contract
        join public.riders as rider on rider.id = contract.rider_id
        where contract.team_id = p_current_team_id
          and contract.status = 'active'

        union all

        select least(
          100,
          floor(greatest(0, academy.career_race_days)::numeric / 5)::integer
        ) as experience_score
        from public.youth_academy_riders as academy
        where academy.team_id = p_current_team_id
          and academy.status in ('active', 'recruited')
      ) as candidate;

    else
      return public.calculate_game_objective_progress_pre_rider_experience(
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
    'rider_experience_25', 'secondary', 'roster',
    'Premiers automatismes',
    'Avoir dans son effectif professionnel ou son centre de formation un coureur à au moins 25/100 d’expérience.',
    'highest_active_rider_experience', 25,
    7500, 25, 1, null, null, false, 230, true
  ),
  (
    'rider_experience_50', 'secondary', 'roster',
    'Le métier rentre',
    'Avoir dans son effectif professionnel ou son centre de formation un coureur à au moins 50/100 d’expérience.',
    'highest_active_rider_experience', 50,
    20000, 70, 2, null, null, false, 240, true
  ),
  (
    'rider_experience_100', 'secondary', 'roster',
    'La science de la course',
    'Avoir dans son effectif professionnel ou son centre de formation un coureur à 100/100 d’expérience.',
    'highest_active_rider_experience', 100,
    60000, 180, 6, 'potential-spark', null, false, 250, true
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
  'Calcule les objectifs de carrière, dont le meilleur score d’expérience 0-100 parmi les coureurs actifs professionnels ou juniors du DS.';

notify pgrst, 'reload schema';

commit;
