-- API permissions for the economy ledgers.

begin;

grant select on table public.team_finance_transactions to authenticated;
grant select on table public.team_finance_alerts to authenticated;
grant select on table public.reward_events to authenticated;

grant all privileges on table public.team_finance_transactions to service_role;
grant all privileges on table public.team_finance_alerts to service_role;
grant all privileges on table public.reward_events to service_role;

commit;
