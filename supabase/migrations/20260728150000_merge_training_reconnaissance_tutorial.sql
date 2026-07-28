-- Le didacticiel Entraînement couvre désormais aussi les stages de reconnaissance.
-- Une seule progression valide donc toute la rubrique et évite de demander deux
-- parcours distincts au joueur pour la récompense globale.
begin;

update public.game_required_tutorials
set
  title = 'Entraînement et stages de reconnaissance',
  is_active = true,
  updated_at = now()
where tutorial_key = 'training';

update public.game_required_tutorials
set
  is_active = false,
  updated_at = now()
where tutorial_key = 'race-reconnaissance';

commit;