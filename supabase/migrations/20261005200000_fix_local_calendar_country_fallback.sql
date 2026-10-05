-- Preparing future sponsor offers inserts the team's next season, which invokes
-- the local-calendar trigger. An anonymous ROW assigned to RECORD loses the
-- catalog's field names for countries without a dedicated catalog entry.
-- Use the actual catalog row type; retain the calendar logic and function ACLs.
begin;
set local lock_timeout = '3s';
set local statement_timeout = '15s';

do $migration$
declare
  v_definition text;
begin
  select pg_catalog.pg_get_functiondef(
    'private.ensure_local_race_calendar_for_country(uuid,uuid)'::regprocedure
  ) into v_definition;

  if position('v_catalog private.local_race_country_catalog%rowtype;' in v_definition) > 0 then
    return;
  end if;

  if position('v_catalog record;' in v_definition) = 0 then
    raise exception 'Unexpected local-calendar catalog declaration; migration aborted.';
  end if;

  v_definition := replace(
    v_definition,
    'v_catalog record;',
    'v_catalog private.local_race_country_catalog%rowtype;'
  );
  execute v_definition;
end;
$migration$;

notify pgrst, 'reload schema';
commit;
