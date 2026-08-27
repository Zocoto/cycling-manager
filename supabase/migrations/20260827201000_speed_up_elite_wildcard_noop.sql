-- The wildcard maintenance runs frequently but usually has nothing to do.
-- Keep its due-edition and pending-registration checks index-only so it cannot
-- monopolise the database while player pages are loading.

create index if not exists race_editions_due_wildcards_idx
  on public.race_editions (wildcard_closes_at, id)
  where wildcard_closes_at is not null
    and status not in ('completed', 'cancelled');

create index if not exists race_registrations_pending_edition_idx
  on public.race_registrations (race_edition_id, id)
  where status = 'pending';
