-- ============================================================
-- INITIAL SPONSOR REGISTRY
-- Registre technique correspondant au catalogue TypeScript.
-- Les données graphiques et d'équilibrage restent dans le code.
-- ============================================================

do $$
declare
  missing_country_codes text;
begin
  select string_agg(seed.country_code, ', ')
  into missing_country_codes
  from (
    values
      ('FR'),
      ('BE'),
      ('ES')
  ) as seed(country_code)
  left join public.countries
    on upper(public.countries.iso_alpha2) = seed.country_code
  where public.countries.id is null;

  if missing_country_codes is not null then
    raise exception
      'Pays absents du référentiel countries : %',
      missing_country_codes;
  end if;
end;
$$;

insert into public.sponsors (
  catalog_key,
  country_id,
  name,
  short_name,
  industry,
  status
)
select
  seed.catalog_key,
  countries.id,
  seed.name,
  seed.short_name,
  seed.industry,
  'active'
from (
  values
    (
      'veloria-mobilites',
      'FR',
      'Veloria Mobilités',
      'Veloria',
      'Mobilité et transports'
    ),
    (
      'terroirs-unis',
      'FR',
      'Terroirs Unis',
      'Terroirs',
      'Agroalimentaire'
    ),
    (
      'nova-assurances',
      'FR',
      'Nova Assurances',
      'Nova',
      'Assurance'
    ),
    (
      'ardennes-outillage',
      'BE',
      'Ardennes Outillage',
      'Ardennes',
      'Outillage industriel'
    ),
    (
      'sol-del-sur',
      'ES',
      'Sol del Sur',
      'Sol',
      'Énergie solaire'
    )
) as seed(
  catalog_key,
  country_code,
  name,
  short_name,
  industry
)
join public.countries
  on upper(public.countries.iso_alpha2) =
    seed.country_code
where not exists (
  select 1
  from public.sponsors
  where lower(public.sponsors.catalog_key) =
    lower(seed.catalog_key)
);

comment on table public.sponsors is
  'Registre technique des sponsors définis dans le catalogue statique TypeScript.';