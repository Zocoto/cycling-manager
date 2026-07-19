-- ============================================================
-- CYCLING MANAGER
-- Droits de lecture serveur des fiches coureurs
-- ============================================================

begin;

-- Les fiches sont assemblées exclusivement par les Server Components avec
-- SUPABASE_SECRET_KEY. Aucun droit direct n'est accordé à anon/authenticated.
grant usage
on schema public
to service_role;

grant select
on table
  public.riders,
  public.countries,
  public.seasons,
  public.season_days,
  public.rider_season_ratings,
  public.rider_contracts,
  public.rider_condition_states,
  public.rider_season_summaries,
  public.rider_equipment_assignments,
  public.equipment_catalog_items,
  public.teams,
  public.team_seasons,
  public.sporting_directors,
  public.team_manager_assignments,
  public.team_sponsor_contracts,
  public.sponsors
to service_role;

notify pgrst, 'reload schema';

commit;
