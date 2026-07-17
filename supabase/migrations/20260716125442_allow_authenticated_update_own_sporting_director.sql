begin;

-- ============================================================
-- MODIFICATION DU PROFIL DU DIRECTEUR SPORTIF
-- Un utilisateur authentifié peut modifier uniquement son propre
-- profil et seulement les champs éditables prévus dans l'US 11.
-- ============================================================

grant update (
  display_name,
  country_id
)
  on table public.sporting_directors
  to authenticated;

drop policy if exists sporting_directors_update_own
  on public.sporting_directors;

create policy sporting_directors_update_own
  on public.sporting_directors
  for update
  to authenticated
  using (
    (select auth.uid()) = auth_user_id
  )
  with check (
    (select auth.uid()) = auth_user_id
  );

comment on policy sporting_directors_update_own
  on public.sporting_directors is
  'Autorise un utilisateur authentifié à modifier les champs éditables de son propre profil de Directeur Sportif.';

commit;