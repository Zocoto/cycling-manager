begin;

-- ============================================================
-- LECTURE DU RÉFÉRENTIEL DES PAYS
-- Les utilisateurs authentifiés peuvent consulter uniquement
-- les pays actifs afin de renseigner leur nationalité.
-- ============================================================

grant select
  on table public.countries
  to authenticated;

drop policy if exists countries_select_active_authenticated
  on public.countries;

create policy countries_select_active_authenticated
  on public.countries
  for select
  to authenticated
  using (is_active = true);

comment on policy countries_select_active_authenticated
  on public.countries is
  'Autorise les utilisateurs authentifiés à consulter les pays actifs.';

commit;