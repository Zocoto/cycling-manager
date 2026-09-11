begin;

-- L'intervention demandée est un one-shot en J1. Tous les choix faits
-- aujourd'hui sont conservés, même lorsqu'ils anticipent au-delà de J14 ; seul
-- le moteur récurrent est fermé afin qu'aucune nouvelle action ne soit lancée.

update public.alpha_bot_managers
set
  enabled = false,
  automation_season_id = null,
  automation_end_day_number = null,
  updated_at = now()
where bot_key in (
  'elodie_martin',
  'thomas_vermeulen',
  'giulia_rinaldi',
  'mikkel_sorensen',
  'rafael_costa',
  'antoine_morel_29'
);

-- Antoine était un compte d'audit inclus uniquement dans cette intervention.
-- Le retirer du registre des bots rétablit son comportement de compte joueur.
delete from public.alpha_bot_managers
where bot_key = 'antoine_morel_29';

revoke execute on function public.claim_alpha_bot_cycle(
  uuid,
  text,
  text
) from service_role;
revoke execute on function public.complete_alpha_bot_cycle(
  uuid,
  text,
  jsonb,
  text
) from service_role;

comment on table public.alpha_bot_managers is
  'Registre historique des managers alpha automatisés. Les comptes sont conservés, mais aucune entrée n’est active après le one-shot du J1 de la saison 3.';

commit;
