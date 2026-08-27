begin;

create table public.race_edition_settlement_claims (
  race_edition_id uuid primary key
    references public.race_editions(id) on delete cascade,
  claimed_at timestamptz not null default clock_timestamp()
);

create index race_edition_settlement_claims_age_idx
  on public.race_edition_settlement_claims (claimed_at);

alter table public.race_edition_settlement_claims enable row level security;

revoke all on table public.race_edition_settlement_claims
  from public, anon, authenticated;
grant all on table public.race_edition_settlement_claims to service_role;

create or replace function public.claim_race_editions_for_settlement(
  p_race_edition_ids uuid[]
)
returns table (race_edition_id uuid)
language sql
security definer
set search_path = public
as $$
  insert into public.race_edition_settlement_claims as claim (
    race_edition_id,
    claimed_at
  )
  select distinct requested.race_edition_id, clock_timestamp()
  from unnest(coalesce(p_race_edition_ids, array[]::uuid[]))
    as requested(race_edition_id)
  join public.race_editions as edition
    on edition.id = requested.race_edition_id
  on conflict (race_edition_id) do update
  set claimed_at = excluded.claimed_at
  where claim.claimed_at < statement_timestamp() - interval '5 minutes'
  returning claim.race_edition_id;
$$;

revoke all on function public.claim_race_editions_for_settlement(uuid[])
  from public, anon, authenticated;
grant execute on function public.claim_race_editions_for_settlement(uuid[])
  to service_role;

comment on table public.race_edition_settlement_claims is
  'Verrou distribué empêchant plusieurs pages ou crons de simuler et homologuer simultanément la même course.';

commit;
