begin;

-- L'index historique bloquait aussi les offres retirées ou expirées. Après une
-- régénération, le nouveau lot pouvait donc sélectionner le même sponsor puis
-- échouer à l'insertion alors que l'ancienne offre n'était plus active.
drop index if exists public.sponsor_offers_recipient_season_sponsor_unique_idx;

-- Les offres qui comptent encore dans le parcours restent uniques pour un DS,
-- une saison et un sponsor. Les archives n'empêchent plus une nouvelle offre.
create unique index sponsor_offers_recipient_season_sponsor_unique_idx
  on public.sponsor_offers (
    sporting_director_id,
    season_id,
    sponsor_id
  )
  where status in ('draft', 'open', 'accepted');

notify pgrst, 'reload schema';

commit;
