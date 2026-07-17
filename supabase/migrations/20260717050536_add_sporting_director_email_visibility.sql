begin;

-- ============================================================
-- VISIBILITÉ DE L’ADRESSE E-MAIL
--
-- Ce réglage contrôle uniquement l’affichage de l’adresse
-- e-mail dans le profil du Directeur Sportif.
--
-- Il ne modifie pas l’adresse utilisée pour l’authentification
-- et ne supprime aucune donnée du compte utilisateur.
-- ============================================================

alter table public.sporting_directors
add column is_email_visible boolean not null default true;

comment on column public.sporting_directors.is_email_visible is
  'Indique si l’adresse e-mail du Directeur Sportif peut être affichée dans son profil.';

-- Le joueur peut modifier uniquement la visibilité de
-- l’adresse e-mail de son propre profil grâce à la règle RLS
-- déjà présente sur sporting_directors.

grant update (is_email_visible)
on public.sporting_directors
to authenticated;

notify pgrst, 'reload schema';

commit;