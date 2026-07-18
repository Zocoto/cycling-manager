-- ============================================================
-- SPONSOR CATALOG KEY
-- Relie le registre Supabase au catalogue statique TypeScript.
-- ============================================================

alter table public.sponsors
  add column catalog_key text;

-- Sécurise une éventuelle donnée historique déjà présente.
-- Sur une base vide, cette mise à jour n'a aucun effet.
update public.sponsors
set catalog_key = 'legacy-' || id::text
where catalog_key is null;

alter table public.sponsors
  alter column catalog_key set not null;

alter table public.sponsors
  add constraint sponsors_catalog_key_not_empty
  check (btrim(catalog_key) <> '');

create unique index sponsors_catalog_key_lower_unique_idx
  on public.sponsors (lower(catalog_key));

comment on column public.sponsors.catalog_key is
  'Clé textuelle stable correspondant au sponsor défini dans le catalogue TypeScript.';