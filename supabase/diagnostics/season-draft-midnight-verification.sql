begin read only;
set local statement_timeout = '3s';
set local lock_timeout = '500ms';
set local application_name = 'draft-midnight-verification-20261105';

with edition as materialized (
  select * from public.season_draft_editions order by game_year desc limit 1
), checks as (
  select
    exists(select 1 from information_schema.columns where table_schema='public'
      and table_name='season_draft_editions' and column_name='pool_reserved_at') reserved_at_column,
    to_regprocedure('public.reserve_season_draft_pool(uuid,integer)') is not null reservation_helper,
    to_regprocedure('public.reserve_season_draft_on_rollover()') is not null receipt_helper,
    exists(select 1 from pg_catalog.pg_trigger trigger
      where trigger.tgrelid='public.season_rollover_settlements'::regclass
        and trigger.tgname='season_draft_reserve_on_rollover' and trigger.tgenabled='O'
        and not trigger.tgisinternal
        and trigger.tgfoid=to_regprocedure('public.reserve_season_draft_on_rollover()')) atomic_receipt_hook,
    (select count(*)=4 from pg_catalog.pg_trigger where not tgisinternal and tgenabled='O'
      and tgname in ('aa_season_draft_contract_reservation','ab_season_draft_contract_resale',
        'aa_season_draft_listing_reservation','ab_season_draft_listing_resale')) all_transfer_guards,
    exists(select 1 from cron.job where jobname='season-opening-draft' and active and schedule='* * * * *') minute_worker_active,
    exists(select 1 from cron.job where jobname='daily-season-rollover' and active and schedule='*/10 * * * *') rollover_worker_active,
    not exists(select 1 from pg_catalog.pg_proc procedure where procedure.oid in (
      to_regprocedure('public.reserve_season_draft_pool(uuid,integer)'),
      to_regprocedure('public.reserve_season_draft_on_rollover()')) and (
        pg_catalog.has_function_privilege('authenticated',procedure.oid,'EXECUTE')
        or pg_catalog.has_function_privilege('anon',procedure.oid,'EXECUTE'))) helpers_private
)
select jsonb_build_object(
  'databaseOk',true,'readOnly',true,'checkedAt',now(),'checks',to_jsonb(checks),
  'edition',(select jsonb_build_object('id',edition.id,'gameYear',edition.game_year,'status',edition.status,
    'poolReservedAt',to_jsonb(edition)->'pool_reserved_at','opensAt',edition.opens_at,'startsAt',edition.starts_at,
    'actualPoolCount',(select count(*) from public.season_draft_riders pool where pool.edition_id=edition.id),
    'actualParticipants',(select count(*) from public.season_draft_participants participant where participant.edition_id=edition.id),
    'reservationNotDueYet',now()<((edition.opens_at at time zone 'Europe/Paris')::date::timestamp at time zone 'Europe/Paris'),
    'openingStillAtEight',(edition.opens_at at time zone 'Europe/Paris')::time=time '08:00',
    'selectionStillAtFourteen',(edition.starts_at at time zone 'Europe/Paris')::time=time '14:00',
    'rolloverReceiptExists',exists(select 1 from public.season_rollover_settlements receipt where receipt.target_season_id=edition.season_id)) from edition)
) as verification from checks;
commit;
