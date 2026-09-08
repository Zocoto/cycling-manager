-- Race simulations read fan-club allocations with the service role. Keep the
-- operational tables private from users while allowing the trusted backend to
-- build simulation inputs.

begin;

grant select on table public.fan_club_profiles to service_role;
grant select on table public.fan_club_trip_allocations to service_role;

commit;
