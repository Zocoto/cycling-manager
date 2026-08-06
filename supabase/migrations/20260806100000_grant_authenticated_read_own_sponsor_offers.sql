-- ============================================================
-- LECTURE DE SES PROPRES OFFRES PAR LE JOUEUR AUTHENTIFIÉ
--
-- La politique « Sporting directors can read their sponsor offers »
-- (20260718051127) autorise déjà un Directeur Sportif à lire ses
-- offres, mais aucun GRANT ne l’accompagnait : une policy sans
-- privilège de table reste inopérante.
--
-- Conséquence : la vérification d’appartenance faite par l’action
-- serveur signSponsorOfferAction échouait, et la signature était
-- refusée avec « Cette offre est introuvable ou ne vous appartient
-- pas. »
--
-- La RLS reste active : chaque joueur ne voit que ses propres offres.
-- ============================================================

begin;

grant usage
on schema public
to authenticated;

grant select
on table public.sponsor_offers
to authenticated;

notify pgrst, 'reload schema';

commit;
