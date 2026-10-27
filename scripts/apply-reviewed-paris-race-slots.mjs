// Read-only S4/S5 audit and installation of this one reviewed DDL migration.
// No live fixtures, race saves, simulations, settlements or calendar rewrites.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';

const mode = process.argv[2];
assert(process.argv.length === 3 && ['--inspect', '--apply-reviewed-fix'].includes(mode));
assert.equal(readFileSync('supabase/.temp/project-ref', 'utf8').trim(), 'ikagfuchasnsakpouosg');
const version = '20261027200000';
const name = 'enforce_paris_race_slots';
const source = readFileSync(`supabase/migrations/${version}_${name}.sql`, 'utf8').replaceAll('\r\n', '\n');
assert(source.startsWith('begin;') && /commit;\s*$/.test(source));
assert(source.includes("set local lock_timeout = '500ms'") && source.includes("set local statement_timeout = '8s'"));
assert(source.includes("set local application_name = 'cyclostratege-paris-race-slots-20261027'"));
const hash = value => createHash('md5').update(value).digest('hex');
const quote = value => "'" + value.replaceAll("'", "''") + "'";
const require = createRequire(import.meta.url);
const binary = path.join(path.dirname(require.resolve('@supabase/cli-windows-x64/package.json')), 'bin/supabase.exe');
function query(sql) {
  const output = execFileSync(binary, ['db', 'query', '--linked', sql, '--output', 'json'], {
    encoding: 'utf8', timeout: 30000, maxBuffer: 100000,
  });
  const start = output.indexOf('{');
  assert(start >= 0, 'Missing SQL receipt; inspect before retrying.');
  return JSON.parse(output.slice(start)).rows;
}
const read = sql => query(`begin read only;
  set local application_name='paris-race-slot-audit-20261027';
  set local statement_timeout='3s'; set local lock_timeout='500ms';
  ${sql}; commit;`);
function inspect() {
  const metadata = read(`select true as database_ok,
    (select md5(statements[1]) from supabase_migrations.schema_migrations where version=${quote(version)}) as recorded_hash,
    (select count(*)::integer from pg_trigger where not tgisinternal and tgdeferrable and tginitdeferred and tgenabled='O'
      and (tgrelid,tgname) in ((to_regclass('public.stages'),'enforce_paris_race_stage_schedule'),
        (to_regclass('public.season_days'),'enforce_paris_race_day_schedule'),
        (to_regclass('public.race_editions'),'enforce_paris_race_edition_schedule'),
        (to_regclass('public.seasons'),'enforce_paris_race_season_schedule'))) as ready_guards,
    (select count(*)::integer from pg_proc where oid in (
      to_regprocedure('private.assert_paris_race_stage_departure(uuid)'),
      to_regprocedure('private.enforce_paris_race_stage_schedule()'),
      to_regprocedure('private.enforce_paris_race_day_schedule()'),
      to_regprocedure('private.enforce_paris_race_edition_schedule()'),
      to_regprocedure('private.enforce_paris_race_season_schedule()'))
      and prosecdef and provolatile='v' and proconfig @> array['search_path=""']
      and not has_function_privilege('anon',oid,'execute')
      and not has_function_privilege('authenticated',oid,'execute')) as private_guard_functions,
    (select jsonb_object_agg(oid::regprocedure::text,md5(pg_get_functiondef(oid))) from pg_proc where oid in (
      to_regprocedure('public.provision_season_race_calendar(uuid,uuid)'),
      to_regprocedure('public.compact_planned_stage_races(uuid)'),
      to_regprocedure('private.normalize_standard_race_country_spacing(uuid)'),
      to_regprocedure('private.preserve_federation_race_stage_schedule()'))) as protected_functions,
    (select jsonb_object_agg(tgrelid::regclass::text||':'||tgname,md5(pg_get_triggerdef(oid)))
      from pg_trigger where not tgisinternal
        and tgrelid in('public.stages'::regclass,'public.season_days'::regclass,'public.race_editions'::regclass,'public.seasons'::regclass)
        and tgname not like 'enforce_paris_race_%') as protected_triggers`)[0];
  const calendar = read(`select season.game_year,count(*)::integer as stages,
    count(*) filter(where stage.status='planned')::integer as planned,
    count(*) filter(where stage.status='cancelled')::integer as cancelled,
    count(*) filter(where stage.status in('completed','in_progress'))::integer as started,
    count(*) filter(where stage.departure_at is distinct from (
      day.calendar_date::timestamp+case stage.day_slot when 'early' then time '14:00' else time '18:00' end
    ) at time zone 'Europe/Paris' or day.season_id<>edition.season_id)::integer as anomalies,
    count(*) filter(where stage.status='planned' and (
      stage.departure_at is distinct from (day.calendar_date::timestamp+
        case stage.day_slot when 'early' then time '14:00' else time '18:00' end) at time zone 'Europe/Paris'
      or day.season_id<>edition.season_id))::integer as planned_anomalies
    from public.stages stage join public.race_editions edition on edition.id=stage.race_edition_id
    join public.seasons season on season.id=edition.season_id
    join public.season_days day on day.id=stage.season_day_id
    where season.game_year in(4,5) group by season.game_year order by season.game_year`);
  const anomalies = read(`select season.game_year,stage.id,edition.display_name,stage.status,stage.day_slot,
    day.calendar_date,stage.departure_at at time zone 'Europe/Paris' as actual_paris,
    day.calendar_date::timestamp+case stage.day_slot when 'early' then time '14:00' else time '18:00' end as expected_paris
    from public.stages stage join public.race_editions edition on edition.id=stage.race_edition_id
    join public.seasons season on season.id=edition.season_id join public.season_days day on day.id=stage.season_day_id
    where season.game_year in(4,5) and (stage.departure_at is distinct from (
      day.calendar_date::timestamp+case stage.day_slot when 'early' then time '14:00' else time '18:00' end
    ) at time zone 'Europe/Paris' or day.season_id<>edition.season_id)
    order by season.game_year,day.day_number,stage.id limit 20`);
  const history = read(`select stage.departure_at,stage.status,edition.registration_closes_at,edition.withdrawal_closes_at,
    simulation.created_at as simulation_created_at,simulation.engine_version,
    (select count(*)::integer from public.stage_results result where result.stage_id=stage.id) as result_rows
    from public.stages stage join public.race_editions edition on edition.id=stage.race_edition_id
    left join public.official_stage_simulations simulation on simulation.stage_id=stage.id
    where stage.id='f41907e5-2287-49c8-8a80-342aec357446'`)[0];
  return { ...metadata, calendar, anomalies, history };
}
const before = inspect();
assert(before.database_ok && Object.keys(before.protected_functions).length === 4);
assert.equal(before.calendar.length, 2);
assert(before.calendar.every(season => season.planned_anomalies === 0), 'Unexpected planned departure; stop for review.');
assert(before.anomalies.every(stage => stage.id === 'f41907e5-2287-49c8-8a80-342aec357446' && stage.status === 'completed'),
  'An additional calendar anomaly needs review before installation.');
if (before.recorded_hash) assert.equal(before.recorded_hash, hash(source), 'Migration receipt differs; stop.');
if (mode === '--inspect') {
  console.log(JSON.stringify(before));
  process.exit(0);
}
if (!before.recorded_hash) {
  query(source.replace(/commit;\s*$/, () => `insert into supabase_migrations.schema_migrations(version,name,statements)
    values(${quote(version)},${quote(name)},array[${quote(source)}]);\ncommit;`));
}
const after = inspect();
assert(after.database_ok && after.ready_guards === 4 && after.private_guard_functions === 5);
assert.equal(after.recorded_hash, hash(source));
assert.deepEqual(after.protected_functions, before.protected_functions);
assert.deepEqual(after.protected_triggers, before.protected_triggers);
assert.deepEqual(after.history, before.history, 'The already disputed race must remain unchanged.');
assert(after.calendar.every(season => season.planned_anomalies === 0));
assert.deepEqual(after.anomalies, before.anomalies);
console.log(JSON.stringify({migration:version,database_ok:true,ready_guards:after.ready_guards,
  private_guard_functions:after.private_guard_functions,calendar:after.calendar,anomalies:after.anomalies,
  protected_functions_unchanged:true,protected_triggers_unchanged:true,historical_race_unchanged:true}));
