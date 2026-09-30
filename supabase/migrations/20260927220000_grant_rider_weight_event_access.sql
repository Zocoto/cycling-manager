begin;

grant select on table public.rider_weight_events to authenticated;
grant all privileges on table public.rider_weight_events to service_role;

notify pgrst, 'reload schema';

commit;
