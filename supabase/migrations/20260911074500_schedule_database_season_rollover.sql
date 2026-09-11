-- The rollover now exceeds the Database REST API's practical execution
-- window. Run the authoritative attempt inside Postgres, where the operation
-- can keep its atomic transaction, and retain the Vercel maintenance call as
-- an idempotent fallback five minutes later.
begin;

create extension if not exists pg_cron with schema pg_catalog;

alter function public.rollover_game_season(uuid, boolean)
  set statement_timeout = '5min';

alter function public.settle_due_season_rollovers()
  set statement_timeout = '5min';

select cron.schedule(
  'daily-season-rollover',
  '0 23 * * *',
  $job$select public.settle_due_season_rollovers();$job$
);

commit;
