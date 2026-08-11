-- Autorise le backend de confiance à synchroniser les métriques calculées du Fan Club.

begin;

grant select, insert, update
on table public.fan_club_profiles
to service_role;

commit;
