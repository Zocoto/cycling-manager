begin;

-- ============================================================
-- EXPÉRIENCE DU DIRECTEUR SPORTIF
--
-- L’expérience représente la progression personnelle du DS
-- comme dans un RPG classique.
--
-- Elle est indépendante de la réputation, qui représente
-- la crédibilité du DS auprès des sponsors et du monde cycliste.
-- ============================================================

alter table public.sporting_directors
add column experience_points integer not null default 0;

alter table public.sporting_directors
add constraint sporting_directors_experience_points_check
check (experience_points >= 0);

comment on column public.sporting_directors.experience_points is
  'Nombre total de points d’expérience gagnés par le Directeur Sportif. Le niveau est calculé à partir de cette valeur et n’est pas stocké en base.';

-- Aucun droit de modification directe n’est accordé au joueur.
-- Les futurs gains d’expérience passeront par une logique
-- serveur sécurisée.

notify pgrst, 'reload schema';

commit;