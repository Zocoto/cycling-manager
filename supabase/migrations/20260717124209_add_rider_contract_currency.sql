begin;

-- ============================================================
-- DEVISE DES CONTRATS DE COUREURS
--
-- Les contrats initiaux sont créés avec un salaire exprimé en
-- euros. La colonne était prévue dans le modèle fonctionnel,
-- mais absente de la table effectivement créée.
-- ============================================================

alter table public.rider_contracts
add column if not exists currency text not null default 'EUR';

alter table public.rider_contracts
drop constraint if exists rider_contracts_currency_format;

alter table public.rider_contracts
add constraint rider_contracts_currency_format
check (
  currency ~ '^[A-Z]{3}$'
);

comment on column public.rider_contracts.currency is
  'Code ISO 4217 de la devise utilisée pour le salaire du contrat.';

commit;