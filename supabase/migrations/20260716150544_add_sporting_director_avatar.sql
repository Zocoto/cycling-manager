begin;

-- ============================================================
-- AVATAR DU DIRECTEUR SPORTIF
--
-- L'avatar est choisi dans une galerie prédéfinie.
-- La base enregistre uniquement une clé stable, et non une URL.
-- ============================================================

alter table public.sporting_directors
add column avatar_key text;

alter table public.sporting_directors
add constraint sporting_directors_avatar_key_check
check (
  avatar_key is null
  or avatar_key in (
    'director_m_01',
    'director_m_02',
    'director_m_03',
    'director_m_04',
    'director_f_01',
    'director_f_02',
    'director_f_03',
    'director_f_04'
  )
);

comment on column public.sporting_directors.avatar_key is
  'Clé de l’avatar prédéfini choisi pour le Directeur Sportif.';

-- Autorise le joueur authentifié à modifier son propre avatar.
grant update (avatar_key)
on public.sporting_directors
to authenticated;

notify pgrst, 'reload schema';

commit;