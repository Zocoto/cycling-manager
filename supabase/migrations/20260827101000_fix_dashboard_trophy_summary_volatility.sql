begin;

-- Le résumé compact appelle get_current_game_objective_summary_cached(), qui
-- peut rafraîchir son cache privé. Une fonction STABLE interdit cette écriture
-- et faisait échouer tout le bureau lors d’un cache expiré.
alter function public.get_current_dashboard_fast_summary_v2() volatile;

comment on function public.get_current_dashboard_fast_summary_v2() is
  'Résumé compact du bureau avec compteur de trophées ; VOLATILE car le cache privé des objectifs peut être rafraîchi pendant l’appel.';

notify pgrst, 'reload schema';

commit;
