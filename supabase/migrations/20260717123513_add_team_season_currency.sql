begin;

-- ============================================================
-- DEVISE DE LA SAISON D'ÉQUIPE
--
-- La fonction de création de carrière initialise les données
-- financières de l'équipe en euros. La colonne était prévue
-- dans le modèle, mais absente de la base effectivement créée.
-- ============================================================

alter table public.team_seasons
add column if not exists currency text not null default 'EUR';

alter table public.team_seasons
drop constraint if exists team_seasons_currency_format;

alter table public.team_seasons
add constraint team_seasons_currency_format
check (
  currency ~ '^[A-Z]{3}$'
);

comment on column public.team_seasons.currency is
  'Code ISO 4217 de la devise utilisée pour les données financières de l’équipe pendant la saison.';

commit;