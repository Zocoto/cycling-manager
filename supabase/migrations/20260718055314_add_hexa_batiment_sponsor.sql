-- ============================================================
-- HEXA BÂTIMENT
-- Ajoute le registre technique du sponsor défini dans
-- le catalogue TypeScript.
-- ============================================================

insert into public.sponsors (
  catalog_key,
  country_id,
  name,
  short_name,
  industry,
  status
)
select
  'hexa-batiment',
  countries.id,
  'Hexa Bâtiment',
  'Hexa',
  'Construction',
  'active'
from public.countries
where upper(countries.iso_alpha2) = 'FR'
  and not exists (
    select 1
    from public.sponsors
    where lower(catalog_key) = 'hexa-batiment'
  );

do $$
begin
  if not exists (
    select 1
    from public.sponsors
    where lower(catalog_key) = 'hexa-batiment'
  ) then
    raise exception
      'Impossible d’ajouter Hexa Bâtiment : le pays FR est absent du référentiel countries.';
  end if;
end;
$$;