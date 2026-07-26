begin;

-- Le scénario précédent a été retiré. Cette migration réactive l’objectif
-- uniquement avec le nouveau Critérium de la découverte, construit sur les
-- écrans réels d’inscription et de replay.
do $$
begin
  if to_regprocedure(
    'public.calculate_game_objective_progress_legacy(text,uuid,uuid,numeric)'
  ) is null then
    raise exception
      'La fonction calculate_game_objective_progress_legacy est introuvable.';
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
set search_path = public
as $$
declare
  v_value integer := 0;
begin
  if p_metric_key = 'tutorial_completion' then
    select count(*)::integer
    into v_value
    from public.tutorial_progress
    where sporting_director_id = p_director_id
      and tutorial_key in (
        'onboarding-core',
        'criterium-discovery'
      )
      and status = 'completed';

    return greatest(0, coalesce(v_value, 0));
  end if;

  return public.calculate_game_objective_progress_legacy(
    p_metric_key,
    p_director_id,
    p_current_team_id,
    p_experience_points
  );
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
values (
  'complete_tutorial',
  'primary',
  'onboarding',
  'Finaliser le didacticiel',
  'Terminer le tutoriel de base et le Critérium de la découverte afin de maîtriser les fondamentaux de Cyclostratège.',
  'tutorial_completion',
  2,
  50000,
  100,
  0,
  null,
  null,
  true,
  25,
  true
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
  reward_random_special_ability =
    excluded.reward_random_special_ability,
  display_order = excluded.display_order,
  is_active = true,
  updated_at = now();

revoke all
on function public.calculate_game_objective_progress(
  text, uuid, uuid, numeric
)
from public, anon, authenticated;

grant execute
on function public.calculate_game_objective_progress(
  text, uuid, uuid, numeric
)
to service_role;

comment on function public.calculate_game_objective_progress(
  text, uuid, uuid, numeric
) is
  'Calcule la progression des objectifs, y compris le tutoriel de base et le Critérium de la découverte.';

notify pgrst, 'reload schema';

commit;
