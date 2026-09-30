begin;

update public.alpha_bot_managers
set
  enabled = false,
  automation_season_id = null,
  automation_end_day_number = null,
  updated_at = now()
where bot_key in (
  'antoine_morel_29',
  'elodie_martin',
  'giulia_rinaldi',
  'mikkel_sorensen',
  'rafael_costa',
  'thomas_vermeulen'
);

revoke all
on function public.claim_alpha_bot_cycle(uuid, text, text)
from service_role;

revoke all
on function public.complete_alpha_bot_cycle(uuid, text, jsonb, text)
from service_role;

commit;
