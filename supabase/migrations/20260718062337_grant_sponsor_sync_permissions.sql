-- ============================================================
-- SPONSOR CATALOG SYNC PERMISSIONS
-- Autorise uniquement le rôle serveur service_role à
-- synchroniser le registre technique des sponsors.
-- ============================================================

grant usage
on schema public
to service_role;

grant select
on table public.countries
to service_role;

grant select, insert, update
on table public.sponsors
to service_role;

comment on table public.sponsors is
  'Registre technique synchronisé depuis le catalogue statique TypeScript.';

notify pgrst, 'reload schema';