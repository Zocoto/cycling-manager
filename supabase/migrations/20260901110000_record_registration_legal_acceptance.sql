begin;

create table if not exists public.user_legal_acceptances (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  terms_version text not null,
  privacy_notice_version text not null,
  accepted_at timestamptz not null default now(),
  constraint user_legal_acceptances_versions_not_blank check (
    btrim(terms_version) <> ''
    and btrim(privacy_notice_version) <> ''
  ),
  constraint user_legal_acceptances_unique_version unique (
    user_id,
    terms_version,
    privacy_notice_version
  )
);

comment on table public.user_legal_acceptances is
  'Preuve serveur, horodatée et immuable, de l’acceptation des CGU et de la prise de connaissance de la politique de confidentialité.';

comment on column public.user_legal_acceptances.accepted_at is
  'Horodatage généré par PostgreSQL ; aucune adresse IP ni empreinte de terminal n’est conservée.';

alter table public.user_legal_acceptances enable row level security;

revoke all on table public.user_legal_acceptances from public, anon;
revoke insert, update, delete on table public.user_legal_acceptances from authenticated;
grant select on table public.user_legal_acceptances to authenticated;

drop policy if exists user_legal_acceptances_select_own
on public.user_legal_acceptances;

create policy user_legal_acceptances_select_own
on public.user_legal_acceptances
for select
to authenticated
using (user_id = (select auth.uid()));

commit;
