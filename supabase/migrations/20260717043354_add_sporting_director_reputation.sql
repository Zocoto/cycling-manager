begin;

-- ============================================================
-- RÉPUTATION DU DIRECTEUR SPORTIF
--
-- Seul le nombre total de points est enregistré.
-- Le niveau et la progression vers le niveau suivant seront
-- calculés par l'application à partir de seuils.
--
-- Dans le MVP, la réputation reste initialisée à 0 et son
-- affichage est uniquement cosmétique.
-- ============================================================

alter table public.sporting_directors
add column reputation_points integer not null default 0;

alter table public.sporting_directors
add constraint sporting_directors_reputation_points_check
check (reputation_points >= 0);

comment on column public.sporting_directors.reputation_points is
  'Nombre total de points de réputation du Directeur Sportif.';

-- Aucun droit de modification n'est accordé directement au joueur.
-- Les futurs gains seront attribués par une logique serveur sécurisée.

notify pgrst, 'reload schema';

commit;