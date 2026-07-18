-- ============================================================
-- SPONSOR ENGINE PERMISSIONS
-- Autorise uniquement le rôle serveur service_role à générer,
-- consulter et mettre à jour les propositions de sponsoring.
-- ============================================================

grant usage
on schema public
to service_role;

-- Identification du Directeur Sportif et lecture de sa réputation.
grant select
on table public.sporting_directors
to service_role;

-- Identification de la saison active.
grant select
on table public.seasons
to service_role;

-- Lecture des contrats afin d'exclure les sponsors déjà engagés.
grant select
on table public.team_sponsor_contracts
to service_role;

-- Lecture, création et mise à jour des offres générées.
grant select, insert, update
on table public.sponsor_offers
to service_role;

notify pgrst, 'reload schema';