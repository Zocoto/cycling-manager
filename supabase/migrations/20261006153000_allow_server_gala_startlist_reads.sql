begin;
set local lock_timeout = '3s';
set local statement_timeout = '15s';

-- Player access still goes through the authenticated, team-scoped RPCs.
-- The private PCM export needs SELECT only; it never changes registrations.
grant select on table public.pcm_gala_events to service_role;
grant select on table public.pcm_gala_registrations to service_role;
grant select on table public.pcm_gala_registration_riders to service_role;

commit;
