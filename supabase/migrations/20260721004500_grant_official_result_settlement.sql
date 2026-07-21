begin;

-- Le traitement autonome des résultats utilise exactement les mêmes lectures
-- sécurisées que la page authentifiée. Aucun droit d'écriture utilisateur n'est
-- ajouté : seul le rôle technique peut exécuter ces deux fonctions de lecture.
grant execute
on function public.get_current_team_calendar_registrations()
to service_role;

grant execute
on function public.get_active_calendar_engaged_riders()
to service_role;

commit;
