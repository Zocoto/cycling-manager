begin;
set local lock_timeout = '500ms';
set local statement_timeout = '5s';

-- Unlock the second gift only on its published issue, including its archive.
-- The existing claim function keeps one durable receipt per reader and issue.
create or replace function private.cyclogazette_booster_gift_collection(p_edition_id uuid)
returns uuid
language sql
stable
set search_path = ''
as $$
  select collection.id
  from public.cyclogazette_editions issue
  join public.season_days issue_day on issue_day.id = issue.season_day_id
    and issue_day.season_id = issue.season_id
  join public.seasons collection on collection.id = issue.season_id
  join public.cyclo_stickers_editions album on album.collection_season_id = collection.id
  join public.seasons source on source.id = album.source_season_id
  where issue.id = p_edition_id
    and (
      (issue.issue_number, issue.issue_date, issue_day.day_number) = (114, date '2026-11-07', 2)
      or (issue.issue_number, issue.issue_date, issue_day.day_number) = (121, date '2026-11-14', 9)
    )
    and issue_day.calendar_date = issue.issue_date
    and issue.published_at <= now()
    and collection.game_year = 5
    and source.game_year = collection.game_year - 1
    and source.status = 'completed'
    and album.configuration ->> 'enabled' = 'true'
    and album.configuration ->> 'publicApproved' = 'true'
    and exists (
      select 1 from public.seasons active
      where active.status = 'active' and active.game_year >= collection.game_year
    );
$$;

commit;
