-- ============================================================
-- PRÉPARATION DE LA SAISON SUIVANTE — DROITS D’ÉCRITURE SERVEUR
--
-- La fenêtre de sponsoring anticipé (jour 21) doit créer, si elle
-- n’existe pas encore : la saison suivante, ses 28 journées et
-- l’inscription de l’équipe. Ce travail est réalisé côté serveur
-- avec SUPABASE_SECRET_KEY (rôle service_role).
--
-- Seules les lectures étaient accordées : la page /jeu/sponsoring
-- échouait donc avec « permission denied for table season_days ».
-- Aucun droit n’est accordé à anon ni à authenticated.
-- ============================================================

begin;

grant usage
on schema public
to service_role;

grant insert
on table
  public.seasons,
  public.season_days,
  public.team_seasons
to service_role;

notify pgrst, 'reload schema';

commit;
