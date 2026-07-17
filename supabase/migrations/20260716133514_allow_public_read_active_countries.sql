begin;

-- ============================================================
-- LECTURE PUBLIQUE DU RÉFÉRENTIEL DES PAYS
-- Les pays actifs constituent un référentiel non sensible.
-- Ils peuvent être consultés avant ou après authentification.
-- ============================================================

grant usage
  on schema public
  to anon, authenticated;

grant select
  on table public.countries
  to anon, authenticated;

drop policy if exists countries_select_active_authenticated
  on public.countries;

drop policy if exists countries_select_active
  on public.countries;

create policy countries_select_active
  on public.countries
  for select
  to anon, authenticated
  using (is_active = true);

comment on policy countries_select_active
  on public.countries is
  'Autorise la consultation publique des pays actifs.';

notify pgrst, 'reload schema';

commit;