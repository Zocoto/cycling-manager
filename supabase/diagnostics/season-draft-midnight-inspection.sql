begin read only;
set local statement_timeout = '3s';
set local lock_timeout = '500ms';
set local application_name = 'draft-midnight-inspection-20261105';

-- One bounded operational result. No helper, worker, settlement or mutation
-- is invoked. to_jsonb keeps this usable before the additive column exists.
with latest_editions as materialized (
  select edition.* from public.season_draft_editions edition
  order by edition.game_year desc limit 2
), seasons as materialized (
  select id,game_year,status,starts_on,ends_on,current_day_number
  from public.seasons where status in ('active','planned')
  order by game_year limit 4
), functions as materialized (
  select namespace.nspname schema_name,procedure.oid::regprocedure::text signature,
    md5(pg_catalog.pg_get_functiondef(procedure.oid)) definition_md5,
    procedure.prosecdef security_definer,procedure.proconfig configuration,
    pg_catalog.has_function_privilege('authenticated',procedure.oid,'EXECUTE') players_execute,
    pg_catalog.has_function_privilege('anon',procedure.oid,'EXECUTE') anonymous_execute
  from pg_catalog.pg_proc procedure
  join pg_catalog.pg_namespace namespace on namespace.oid=procedure.pronamespace
  where namespace.nspname in ('public','private') and (
    procedure.proname like '%season_draft%'
    or procedure.proname in ('rollover_game_season','settle_due_season_rollovers','settle_expiring_rider_contracts'))
  order by namespace.nspname,procedure.proname limit 30
), triggers as materialized (
  select relation.relname table_name,trigger.tgname trigger_name,
    trigger.tgenabled enabled,pg_catalog.pg_get_triggerdef(trigger.oid) definition
  from pg_catalog.pg_trigger trigger
  join pg_catalog.pg_class relation on relation.oid=trigger.tgrelid
  join pg_catalog.pg_namespace namespace on namespace.oid=relation.relnamespace
  join pg_catalog.pg_proc procedure on procedure.oid=trigger.tgfoid
  where namespace.nspname='public' and not trigger.tgisinternal
    and relation.relname in ('season_rollover_settlements','rider_contracts','transfer_market_listings')
    and (trigger.tgname like '%season_draft%' or procedure.proname like '%season_draft%')
  order by relation.relname,trigger.tgname limit 10
)
select jsonb_build_object(
  'databaseOk',true,'readOnly',true,'checkedAt',now(),
  'parisNow',now() at time zone 'Europe/Paris',
  'settings',(select to_jsonb(settings) from public.season_draft_settings settings where singleton),
  'seasons',(select coalesce(jsonb_agg(to_jsonb(seasons) order by game_year),'[]') from seasons),
  'editions',(select coalesce(jsonb_agg(jsonb_build_object(
    'id',edition.id,'gameYear',edition.game_year,'seasonId',edition.season_id,'status',edition.status,
    'announcementAt',edition.announcement_at,'opensAt',edition.opens_at,'startsAt',edition.starts_at,
    'initializedAt',edition.initialized_at,'poolReservedAt',to_jsonb(edition)->'pool_reserved_at',
    'participantCount',edition.participant_count,'poolCount',edition.pool_count,
    'actualPoolCount',(select count(*) from public.season_draft_riders pool where pool.edition_id=edition.id),
    'selectedPoolCount',(select count(*) from public.season_draft_riders pool where pool.edition_id=edition.id and pool.selected_team_id is not null),
    'actualParticipants',(select count(*) from public.season_draft_participants participant where participant.edition_id=edition.id),
    'rolloverReceiptExists',exists(select 1 from public.season_rollover_settlements receipt where receipt.target_season_id=edition.season_id),
    'poolConflictingContracts',(select count(*) from public.season_draft_riders pool
      where pool.edition_id=edition.id and pool.selected_team_id is null and exists(
        select 1 from public.rider_contracts contract where contract.rider_id=pool.rider_id and contract.status in ('active','planned'))),
    'poolOpenListings',(select count(*) from public.season_draft_riders pool
      where pool.edition_id=edition.id and pool.selected_team_id is null and exists(
        select 1 from public.transfer_market_listings listing where listing.rider_id=pool.rider_id and listing.status='open'))
  ) order by edition.game_year desc),'[]') from latest_editions edition),
  'functions',(select coalesce(jsonb_agg(to_jsonb(functions) order by signature),'[]') from functions),
  'triggers',(select coalesce(jsonb_agg(to_jsonb(triggers) order by table_name,trigger_name),'[]') from triggers),
  'jobs',(select coalesce(jsonb_agg(jsonb_build_object('name',jobname,'active',active,'schedule',schedule,'command',command) order by jobname),'[]')
    from cron.job where jobname in ('daily-season-rollover','season-opening-draft'))
) as inspection;
commit;
