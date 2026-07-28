-- Le parcours du Centre de soin couvre désormais les blessures, la forme,
-- la nutrition, les kinés et le résumé de l'équipe médicale.
-- Une seule progression valide donc toute la rubrique pour la récompense
-- globale de fin des didacticiels.
begin;

update public.game_required_tutorials
set
  title = 'Centre de soin et récupération',
  is_active = true,
  updated_at = now()
where tutorial_key = 'medical-center';

update public.game_required_tutorials
set
  is_active = false,
  updated_at = now()
where tutorial_key = 'nutrition';

commit;
