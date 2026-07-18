-- ============================================================
-- SPONSOR OFFER RECIPIENT
-- Chaque proposition est destinée à un Directeur Sportif.
-- ============================================================

alter table public.sponsor_offers
  add column sporting_director_id uuid not null
  references public.sporting_directors(id)
  on delete cascade;

create index sponsor_offers_sporting_director_id_idx
  on public.sponsor_offers (sporting_director_id);

-- Un même sponsor ne peut être proposé qu'une seule fois
-- au même Directeur Sportif pour une saison donnée.
create unique index sponsor_offers_recipient_season_sponsor_unique_idx
  on public.sponsor_offers (
    sporting_director_id,
    season_id,
    sponsor_id
  );

comment on column public.sponsor_offers.sporting_director_id is
  'Directeur Sportif auquel cette proposition de sponsoring est destinée.';

-- Le joueur authentifié peut consulter uniquement ses propres offres.
create policy "Sporting directors can read their sponsor offers"
on public.sponsor_offers
for select
to authenticated
using (
  exists (
    select 1
    from public.sporting_directors
    where sporting_directors.id =
      sponsor_offers.sporting_director_id
      and sporting_directors.auth_user_id = auth.uid()
  )
);

notify pgrst, 'reload schema';