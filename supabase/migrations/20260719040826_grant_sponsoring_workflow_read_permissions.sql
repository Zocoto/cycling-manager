begin;

-- ============================================================
-- US14 — DROITS DE LECTURE DU MOTEUR DE SPONSORING
--
-- Le service serveur utilise SUPABASE_SECRET_KEY et le rôle
-- service_role. Les tables historiques restent protégées pour
-- les clients publics et authentifiés, mais deviennent lisibles
-- par le moteur serveur de sponsoring.
-- ============================================================

grant usage
on schema public
to service_role;

grant select
on table public.team_manager_assignments
to service_role;

grant select
on table public.initial_career_generations
to service_role;

comment on table public.team_manager_assignments is
  'Historique des directeurs sportifs affectés aux équipes. Lecture serveur autorisée pour résoudre l’équipe courante du moteur de sponsoring.';

comment on table public.initial_career_generations is
  'Traçabilité de la génération initiale des carrières. Lecture serveur autorisée comme solution de repli du moteur de sponsoring.';

notify pgrst, 'reload schema';

commit;