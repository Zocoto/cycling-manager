-- ============================================================
-- PREPARE SPONSOR CATALOG SYNC
-- Prépare catalog_key pour les synchronisations automatisées.
-- ============================================================

-- Uniformise les clés existantes avant d'ajouter la contrainte.
update public.sponsors
set catalog_key = lower(btrim(catalog_key));

-- L'ancien index garantissait une unicité insensible à la casse,
-- mais ne pouvait pas être ciblé directement par un upsert Supabase.
drop index if exists public.sponsors_catalog_key_lower_unique_idx;

-- Toutes les clés du catalogue doivent être normalisées en minuscules.
alter table public.sponsors
  add constraint sponsors_catalog_key_lowercase
  check (
    catalog_key = lower(btrim(catalog_key))
  );

-- Cette contrainte permettra :
-- upsert(..., { onConflict: "catalog_key" })
alter table public.sponsors
  add constraint sponsors_catalog_key_unique
  unique (catalog_key);

comment on constraint sponsors_catalog_key_unique
on public.sponsors is
  'Permet la synchronisation automatisée du catalogue TypeScript par catalog_key.';