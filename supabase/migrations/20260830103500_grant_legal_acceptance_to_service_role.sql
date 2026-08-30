begin;

grant select, insert
on table public.user_legal_acceptances
to service_role;

revoke update, delete
on table public.user_legal_acceptances
from service_role;

commit;
