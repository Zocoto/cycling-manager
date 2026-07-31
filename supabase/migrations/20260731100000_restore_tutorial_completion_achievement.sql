begin;

-- La bibliothèque de carrière étendue avait désactivé cet objectif historique.
-- La progression étant calculée en direct, les DS qui ont déjà terminé les
-- deux parcours essentiels pourront également récupérer leur récompense.
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
  reward_random_special_ability = excluded.reward_random_special_ability,
  display_order = excluded.display_order,
  is_active = true,
  updated_at = now();

notify pgrst, 'reload schema';

commit;