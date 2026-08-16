begin;

drop trigger if exists grant_alpha_tester_trophy_after_director_creation
  on public.sporting_directors;

drop trigger if exists grant_alpha_tester_trophy_after_director_activation
  on public.sporting_directors;

drop function if exists public.grant_alpha_tester_trophy_to_new_director();

comment on table public.sporting_director_trophies is
  'Distinctions de carrière disponibles ou récupérées par chaque Directeur Sportif. Le trophée Alphatesteur est désormais une distinction historique.';

notify pgrst, 'reload schema';

commit;
