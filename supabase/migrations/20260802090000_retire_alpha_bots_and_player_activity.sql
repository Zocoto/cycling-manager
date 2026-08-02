begin;

-- Keep the five alpha accounts and their teams intact, but stop every automated
-- manager action. The runtime also filters on this flag as a second safeguard.
update public.alpha_bot_managers
set
  enabled = false,
  updated_at = now()
where enabled = true;

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

-- Player activity tracking is retired. Historical rows stay available for
-- database administration, while neither the application nor a service task can
-- create or expose new tracking data through the former RPC functions.
revoke execute on function public.record_current_player_activity(
  text,
  text,
  text,
  text,
  text,
  text
) from authenticated, service_role;

revoke execute on function public.get_player_activity_monitoring(
  text,
  text,
  integer,
  integer
) from authenticated, service_role;

comment on table public.alpha_bot_managers is
  'Registre historique des managers alpha automatises. Les comptes et equipes sont conserves, mais toutes les entrees sont desactivees.';

commit;
