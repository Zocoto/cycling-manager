begin;

-- ============================================================
-- SPONSOR OBJECTIVE ENGINE PERMISSIONS
--
-- Autorise uniquement le rôle serveur service_role à créer,
-- consulter et mettre à jour les objectifs des offres.
-- Les joueurs ne reçoivent aucun droit d’écriture direct.
-- ============================================================

grant usage
on schema public
to service_role;

grant select, insert, update
on table public.sponsor_objectives
to service_role;

-- Ces tables spécialisées seront utilisées plus tard par
-- le moteur complet d’évaluation des objectifs.
grant select, insert, update
on table public.race_result_objectives
to service_role;

grant select, insert, update
on table public.nationality_objectives
to service_role;

grant select, insert, update
on table public.season_win_objectives
to service_role;

grant select, insert, update
on table public.objective_progress
to service_role;

notify pgrst, 'reload schema';

commit;