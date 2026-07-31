begin;

-- Le succès final récompense tout le circuit réellement proposé dans le centre.
update public.game_required_tutorials
set
  is_active = false,
  updated_at = now();

insert into public.game_required_tutorials (
  tutorial_key,
  section_key,
  title,
  display_order,
  is_active
)
values
  ('onboarding-core', 'onboarding', 'Premiers pas', 10, true),
  ('criterium-discovery', 'courses', 'Critérium de la découverte', 20, true),
  ('roster-management', 'roster', 'Effectif et contrats', 30, true),
  ('training', 'training', 'Entraînement et reconnaissance', 40, true),
  ('medical-center', 'health', 'Centre de soin et récupération', 50, true),
  ('staff', 'staff', 'Constituer son staff', 60, true),
  ('transfers', 'market', 'Marché des transferts', 70, true),
  ('equipment', 'equipment', 'Matériel et équipements', 80, true),
  ('infrastructure', 'infrastructure', 'Infrastructures', 90, true),
  ('youth-development', 'youth', 'Centre de formation', 100, true)
on conflict (tutorial_key) do update set
  section_key = excluded.section_key,
  title = excluded.title,
  display_order = excluded.display_order,
  is_active = true,
  updated_at = now();

update public.game_objective_definitions
set
  description = 'Terminer les deux formations essentielles et tous les guides des rubriques du jeu.',
  metric_key = 'all_required_tutorials_completed',
  target_value = 1,
  is_active = true,
  updated_at = now()
where objective_key = 'complete_tutorial';

-- Évite deux récompenses distinctes pour le même accomplissement.
update public.game_objective_definitions
set
  is_active = false,
  updated_at = now()
where objective_key = 'tutorial_mastery';

notify pgrst, 'reload schema';

commit;