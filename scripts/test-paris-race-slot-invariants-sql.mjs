// Isolated PostgreSQL/WASM only. No Supabase client, credentials, network or
// production fixtures. Existing calendar guards are the real migration code.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const modulePath = process.argv[2] || 'C:/Dev/tmp/rnd-postgres-validation/node_modules/@electric-sql/pglite/dist/index.js';
assert(modulePath.replaceAll('\\', '/').endsWith('/pglite/dist/index.js'));
const { PGlite } = await import(pathToFileURL(modulePath).href);
const db = new PGlite();
const read = name => readFileSync(`supabase/migrations/${name}.sql`, 'utf8').replaceAll('\r\n', '\n');
const migration = read('20261027200000_enforce_paris_race_slots');
const spacing = read('20260925153000_space_same_country_standard_races');
const federation = read('20260914100000_rebuild_federation_race_workflow');
const opening = read('20261009190000_reserve_future_season_opening_day');
const elite = read('20261027160000_expand_s5_elite_calendar');
const id = number => `00000000-0000-4000-8000-${String(number).padStart(12, '0')}`;
const definition = (source, name) => {
  const start = source.indexOf(`create or replace function ${name}(`);
  assert(start >= 0, `Missing real definition: ${name}`);
  return source.slice(start, source.indexOf('$$;', start) + 3);
};
const query = async (sql, args = []) => (await db.query(sql, args)).rows;
const scalar = async (sql, args = []) => Object.values((await query(sql, args))[0])[0];
let checks = 0;
const check = (actual, expected, label) => { assert.deepEqual(actual, expected, label); checks += 1; };
async function transaction(sql, args = []) {
  await db.exec('begin');
  try {
    if (args.length) await db.query(sql, args);
    else await db.exec(sql);
    await db.exec('commit');
  } catch (error) {
    await db.exec('rollback');
    throw error;
  }
}
const rejects = async (sql, label, pattern = error => error.code === '23514') => {
  await assert.rejects(() => transaction(sql), pattern, label);
  checks += 1;
};
const row = async stage => (await query('select * from public.stages where id=$1', [id(stage)]))[0];
const protectedData = () => query(`select 'simulation' as kind,to_jsonb(t)::text as value from official_stage_simulations t
  union all select 'result',to_jsonb(t)::text from stage_results t
  union all select 'strategy',to_jsonb(t)::text from race_stage_strategies t order by kind,value`);
const insertStage = (stage, edition, day, slot = 'early', timestamp = null, status = 'planned', number = 1) =>
  `insert into public.stages(id,race_edition_id,season_day_id,stage_number,name,stage_type,distance_km,status,departure_at,profile_type,day_slot)
  values('${id(stage)}','${id(edition)}','${id(day)}',${number},'Test stage','road',150,'${status}',
    ${timestamp ? `'${timestamp}'::timestamptz` : 'null'},'flat','${slot}');`;
const parisDeparture = (date, slot) => `${date} ${slot === 'early' ? '14:00' : '18:00'} Europe/Paris`;

try {
  await db.exec(`set time zone 'UTC';
    create schema private; create role anon; create role authenticated; create role service_role;
    create table public.seasons(id uuid primary key,game_year integer,status text);
    create table public.countries(id uuid primary key,name text);
    create table public.season_days(id uuid primary key,season_id uuid references seasons,day_number integer,calendar_date date);
    create index season_days_season_id_idx on public.season_days(season_id);
    create table public.race_categories(id uuid primary key,code text);
    create table public.races(id uuid primary key,country_id uuid references countries,name text,slug text,
      race_format text,status text,competition_type text,is_grand_tour boolean default false);
    create table public.race_editions(id uuid primary key,race_id uuid references races,season_id uuid references seasons,
      race_category_id uuid references race_categories,status text);
    create index race_editions_season_id_idx on public.race_editions(season_id);
    create table public.stages(id uuid primary key,race_edition_id uuid references race_editions,season_day_id uuid references season_days,
      stage_number integer,name text,stage_type text,distance_km numeric,status text,departure_at timestamptz,profile_type text,day_slot text,
      unique(race_edition_id,stage_number),
      constraint stages_day_slot_unique unique(race_edition_id,season_day_id,day_slot) deferrable initially deferred);
    create index stages_race_edition_id_idx on public.stages(race_edition_id);
    create index stages_season_day_slot_idx on public.stages(season_day_id,day_slot);
    create table public.official_stage_simulations(stage_id uuid primary key references stages,simulation jsonb);
    create table public.stage_results(stage_id uuid references stages,result jsonb);
    create table public.race_stage_strategies(stage_id uuid references stages,attack_orders jsonb,sprint_train_order uuid[]);
    create table public.national_federation_race_projects(id uuid primary key,race_id uuid,status text,stage_blueprint jsonb,
      start_day_number integer,start_day_slot text);
    insert into public.seasons values('${id(4)}',4,'active'),('${id(5)}',5,'planned'),('${id(6)}',6,'completed'),
      ('${id(3)}',3,'planned'),('${id(7)}',3,'planned');
    insert into public.race_categories values('${id(8)}','national'),('${id(9)}','elite');
    insert into public.season_days values
      ('${id(401)}','${id(4)}',1,'2030-03-30'),('${id(402)}','${id(4)}',2,'2030-03-31'),
      ('${id(403)}','${id(4)}',3,'2030-10-26'),('${id(404)}','${id(4)}',4,'2030-10-27'),
      ('${id(405)}','${id(4)}',5,'2030-11-01'),('${id(406)}','${id(4)}',6,'2030-11-02'),
      ('${id(501)}','${id(5)}',1,'2030-10-25'),('${id(502)}','${id(5)}',2,'2030-10-26'),
      ('${id(503)}','${id(5)}',3,'2030-10-27'),('${id(504)}','${id(5)}',4,'2030-10-28'),
      ('${id(505)}','${id(5)}',5,'2030-10-29'),('${id(506)}','${id(5)}',6,'2030-10-30'),
      ('${id(601)}','${id(6)}',2,'2030-10-26'),('${id(301)}','${id(3)}',2,'2030-10-26'),
      ('${id(701)}','${id(7)}',2,'2030-10-26');
  `);
  for (let number = 10; number <= 30; number += 1) {
    await query('insert into public.countries values($1,$2)', [id(1000 + number), `Country ${number}`]);
    await query(`insert into public.races values($1,$2,$3,$4,'one_day','active','standard',false)`,
      [id(2000 + number), id(1000 + number), `Race ${number}`, `race-${number}`]);
    const season = number === 16 ? 6 : number === 17 ? 3 : number === 18 ? 7 : number <= 14 ? 4 : 5;
    await query('insert into public.race_editions values($1,$2,$3,$4,$5)',
      [id(number), id(2000 + number), id(season), id(number >= 25 ? 9 : 8), number === 15 ? 'completed' : 'registration_open']);
  }

  const dates = ['2030-03-30', '2030-03-31', '2030-10-26', '2030-10-27'];
  for (const [dateIndex, date] of dates.entries()) {
    for (const [slotIndex, slot] of ['early', 'late'].entries()) {
      await db.exec(insertStage(40 + dateIndex * 2 + slotIndex, 10, 401 + dateIndex, slot, parisDeparture(date, slot), 'planned', dateIndex * 2 + slotIndex + 1));
    }
  }
  await db.exec(insertStage(60, 11, 403, 'early', '2030-10-26 13:00 Europe/Paris', 'completed'));
  await db.exec(insertStage(61, 12, 404, 'late', '2030-10-27 17:00 Europe/Paris', 'in_progress'));
  await db.exec(insertStage(62, 13, 405, 'early', '2030-11-01 14:00 Europe/Paris'));
  await db.exec(insertStage(63, 14, 406, 'late', null, 'cancelled'));
  await db.exec(insertStage(64, 17, 301, 'early', '2030-10-26 13:00 Europe/Paris'));
  await db.exec(insertStage(65, 15, 502, 'early', '2030-10-26 13:00 Europe/Paris'));
  await db.exec(insertStage(66, 16, 601, 'early', '2030-10-26 13:00 Europe/Paris'));
  await db.exec(insertStage(67, 18, 701, 'early', '2030-10-26 13:00 Europe/Paris'));
  await db.exec(`insert into official_stage_simulations values('${id(60)}','{"locked":true}'),('${id(62)}','{"locked":true}');
    insert into stage_results values('${id(60)}','{"winner":"historic"}');
    insert into race_stage_strategies values('${id(60)}','[{"segmentNumber":20}]',array['${id(900)}'::uuid]),
      ('${id(62)}','[{"segmentNumber":21}]',array['${id(901)}'::uuid]);`);

  // Real pre-existing constraints and federation normalization. Their hashes
  // must remain unchanged after the new invariant is installed.
  await db.exec(definition(spacing, 'private.standard_race_country_overlap_allowed'));
  await db.exec(definition(spacing, 'private.enforce_standard_race_country_spacing'));
  const spacingPatchStart = elite.indexOf('do $patch$', elite.indexOf('-- A deferred guard'));
  await db.exec(elite.slice(spacingPatchStart, elite.indexOf('$patch$;', spacingPatchStart) + 8));
  await db.exec(definition(federation, 'private.preserve_federation_race_stage_schedule'));
  await db.exec(definition(opening, 'private.enforce_future_season_opening_day'));
  await db.exec(definition(elite, 'private.guard_s5_elite_daily_limit'));
  await db.exec(`create trigger preserve_federation_race_stage_schedule before insert or update on public.stages
      for each row execute function private.preserve_federation_race_stage_schedule();
    create constraint trigger enforce_standard_race_country_spacing after insert or update of race_edition_id,season_day_id on public.stages
      deferrable initially deferred for each row execute function private.enforce_standard_race_country_spacing();
    create constraint trigger enforce_future_season_opening_day after insert or update on public.stages
      deferrable initially deferred for each row execute function private.enforce_future_season_opening_day();
    create constraint trigger guard_s5_elite_daily_limit after insert or update of race_edition_id,season_day_id,day_slot on public.stages
      deferrable initially deferred for each row execute function private.guard_s5_elite_daily_limit();`);
  const existingGuards = () => query(`select proname,md5(pg_get_functiondef(oid)) hash from pg_proc
    where pronamespace='private'::regnamespace and proname in('standard_race_country_overlap_allowed','enforce_standard_race_country_spacing',
      'preserve_federation_race_stage_schedule','enforce_future_season_opening_day','guard_s5_elite_daily_limit') order by proname`);
  const scheduleBefore = await query('select * from stages order by id');
  const protectedBefore = await protectedData();
  const guardsBefore = await existingGuards();
  await db.exec(insertStage(68, 20, 502, 'early', '2030-10-26 13:00 Europe/Paris'));
  await assert.rejects(() => db.exec(migration), error => error.code === '23514', 'installation rejects an existing future anomaly instead of rewriting it');
  checks += 1;
  await db.exec('rollback');
  check(await scalar("select to_regprocedure('private.assert_paris_race_stage_departure(uuid)') is null"), true,
    'failed installation rolls back every helper / trigger change');
  check((await row(68)).departure_at.toISOString(), '2030-10-26T11:00:00.000Z', 'failed installation does not silently repair the anomalous row');
  await db.exec(`delete from stages where id='${id(68)}'`);
  await db.exec(migration);
  check(await query('select * from stages order by id'), scheduleBefore, 'migration does not rewrite any schedule or historic departure');
  check(await protectedData(), protectedBefore, 'locked simulations, results, attack orders and sprint plans remain unchanged');
  check(await existingGuards(), guardsBefore, 'all existing federation / country / Elite / opening-day guards remain unchanged');

  check(await query(`select to_char(departure_at at time zone 'Europe/Paris','YYYY-MM-DD HH24:MI') local_time,
      to_char(departure_at at time zone 'UTC','HH24:MI') utc_time from stages where race_edition_id='${id(10)}' order by stage_number`),
    dates.flatMap((date, index) => [{local_time:`${date} 14:00`,utc_time:['13:00','12:00','12:00','13:00'][index]},
      {local_time:`${date} 18:00`,utc_time:['17:00','16:00','16:00','17:00'][index]}]), 'both slots stay 14/18 Paris across spring and autumn DST');
  for (const [stage, hour] of [[40, '13:00'], [41, '17:00']]) {
    const before = await row(stage);
    await rejects(`update stages set departure_at=('2030-03-30 ${hour} Europe/Paris')::timestamptz where id='${id(stage)}'`, 'wrong 13/17 local hour is rejected at commit');
    check(await row(stage), before, 'invalid schedule update is atomic');
  }
  await rejects(`update stages set departure_at=null where id='${id(40)}'`, 'null departure on future planned stage is rejected');
  await rejects(`update stages set departure_at=departure_at+interval '1 day' where id='${id(40)}'`, 'wrong calendar date is rejected');
  await rejects(`update stages set day_slot='late' where id='${id(62)}'`, 'slot change without its matching timestamp is rejected');
  await rejects(insertStage(70, 19, 502, 'early', '2030-10-26 13:00 Europe/Paris'), 'wrong new stage is rejected');
  await transaction(insertStage(70, 19, 502, 'early', '2030-10-26 13:00 Europe/Paris') +
    `update stages set departure_at='2030-10-26 14:00 Europe/Paris' where id='${id(70)}';`);
  check((await row(70)).day_slot, 'early', 'invalid insert corrected within the transaction is accepted');
  await transaction(insertStage(71, 20, 502, 'early', '2030-10-26 13:00 Europe/Paris') + `delete from stages where id='${id(71)}';`);
  check(await row(71), undefined, 'insert then delete does not validate a stale NEW image');
  await transaction(insertStage(71, 20, 502, 'early', '2030-10-26 13:00 Europe/Paris') + `delete from stages where id='${id(71)}';` +
    insertStage(71, 20, 502, 'early', '2030-10-26 14:00 Europe/Paris'));
  check((await row(71)).departure_at.toISOString(), '2030-10-26T12:00:00.000Z', 'delete / reinsert validates only the final row for the reused identity');

  await transaction(`update stages set season_day_id='${id(402)}' where id='${id(70)}';
    update stages set race_edition_id='${id(11)}',stage_number=2,departure_at='2030-03-31 14:00 Europe/Paris' where id='${id(70)}';`);
  check((await row(70)).season_day_id, id(402), 'separate day/edition and timestamp updates are validated against the final row');
  await rejects(`update stages set season_day_id='${id(401)}',departure_at=departure_at-interval '1 day' where id='${id(70)}'`,
    'naive UTC relocation across spring DST cannot shift departure away from 14 Paris');
  await transaction(`update stages set season_day_id='${id(401)}',departure_at='2030-03-30 14:00 Europe/Paris' where id='${id(70)}';`);
  check((await row(70)).departure_at.toISOString(), '2030-03-30T13:00:00.000Z', 'Paris-aware relocation preserves the slot across spring DST');
  await transaction(`update stages set season_day_id='${id(403)}',day_slot='late',departure_at='2030-10-26 18:00 Europe/Paris' where id='${id(70)}';`);
  await rejects(`update stages set season_day_id='${id(404)}',departure_at=departure_at+interval '1 day' where id='${id(70)}'`,
    'naive UTC relocation across autumn DST cannot shift departure to 17 Paris');
  await transaction(`update stages set season_day_id='${id(404)}',departure_at='2030-10-27 18:00 Europe/Paris' where id='${id(70)}';`);
  check((await row(70)).departure_at.toISOString(), '2030-10-27T17:00:00.000Z', 'Paris-aware relocation preserves the late slot across autumn DST');

  await rejects(`update season_days set calendar_date=calendar_date+3 where id='${id(405)}'`, 'parent day date change cannot leave stale child timestamps');
  await transaction(`update season_days set calendar_date=calendar_date+3 where id='${id(405)}';
    update stages set departure_at='2030-11-04 14:00 Europe/Paris' where id='${id(62)}';`);
  check((await row(62)).departure_at.toISOString(), '2030-11-04T13:00:00.000Z', 'parent day and child departure can be corrected atomically');
  await rejects(`update season_days set season_id='${id(5)}' where id='${id(405)}'`, 'parent day cannot silently move into another season');
  await rejects(`update race_editions set season_id='${id(5)}' where id='${id(13)}'`, 'edition reparenting cannot silently mismatch its season day');
  await rejects(`update race_editions set status='registration_open' where id='${id(15)}'`, 'reopening an edition validates its previously excluded planned stages');
  await transaction(`update stages set departure_at='2030-10-26 14:00 Europe/Paris' where id='${id(65)}';
    update race_editions set status='registration_open' where id='${id(15)}';`);
  check((await row(65)).departure_at.toISOString(), '2030-10-26T12:00:00.000Z', 'reopening with a correct final departure succeeds');
  await rejects(`update seasons set status='planned' where id='${id(6)}'`, 'activating an excluded season validates its planned stages');
  await transaction(`update seasons set status='planned' where id='${id(6)}';
    update stages set departure_at='2030-10-26 14:00 Europe/Paris' where id='${id(66)}';`);
  check(await scalar(`select status from seasons where id='${id(6)}'`), 'planned', 'season activation can be completed atomically');
  await rejects(`update seasons set game_year=7 where id='${id(7)}'`, 'bringing an old game year into the policy activates validation');
  await transaction(`update seasons set game_year=7 where id='${id(7)}';
    update stages set departure_at='2030-10-26 14:00 Europe/Paris' where id='${id(67)}';`);
  await rejects(`update stages set departure_at='2030-11-04 13:00 Europe/Paris' where id='${id(62)}'`, 'a locked planned simulation does not bypass the invariant');
  await rejects(`update stages set status='planned' where id='${id(60)}'`, 'reopening an old completed row does not bypass slot validation');
  await rejects(`update stages set status='planned' where id='${id(61)}'`, 'reopening an in-progress row validates its final schedule');
  await rejects(`update stages set status='planned' where id='${id(63)}'`, 'reopening a cancelled row validates its missing departure');
  check(await row(60), scheduleBefore.find(stage => stage.id === id(60)), 'completed historic departure remains unchanged');
  check(await row(61), scheduleBefore.find(stage => stage.id === id(61)), 'in-progress historic departure remains unchanged');
  check(await row(64), scheduleBefore.find(stage => stage.id === id(64)), 'pre-S4 historic policy stays unchanged');
  check(await protectedData(), protectedBefore, 'failed schedule changes never alter sporting results, simulations or tactics');

  const project = [{name:'Federation route',stageType:'road',profileType:'hilly',segments:[{distanceKm:75},{distanceKm:75}]}];
  await query(`insert into national_federation_race_projects values($1,$2,'active',$3,3,'late')`, [id(100), id(2021), JSON.stringify(project)]);
  await transaction(insertStage(80, 21, 502, 'early', '2030-10-26 13:00 Europe/Paris'));
  check(await query(`select day_slot,season_day_id,to_char(departure_at at time zone 'Europe/Paris','HH24:MI') departure,name
    from stages where id='${id(80)}'`), [{day_slot:'late',season_day_id:id(503),departure:'18:00',name:'Federation route'}],
    'real federation BEFORE trigger normalizes its final date and slot before deferred validation');

  await rejects(insertStage(81, 22, 501, 'early', '2030-10-25 14:00 Europe/Paris'), 'opening-day restriction still applies', /J1 est réservé/);
  await query(`update races set country_id=(select country_id from races where id='${id(2023)}') where id='${id(2024)}'`);
  await transaction(insertStage(82, 23, 504, 'early', '2030-10-28 14:00 Europe/Paris'));
  await rejects(insertStage(83, 24, 504, 'late', '2030-10-28 18:00 Europe/Paris'), 'country spacing still applies', /Calendrier national invalide/);
  await transaction(insertStage(84, 25, 505, 'early', '2030-10-29 14:00 Europe/Paris') +
    insertStage(85, 26, 505, 'late', '2030-10-29 18:00 Europe/Paris'));
  await rejects(insertStage(86, 27, 505, 'early', '2030-10-29 14:00 Europe/Paris'), 'Elite daily cap still applies', /Deux épreuves Elite/);

  const triggerNames = [...migration.matchAll(/create constraint trigger\s+([a-z_]+)/gi)].map(match => match[1]);
  check(triggerNames.length, 4, 'four write surfaces have constraint triggers');
  check(await query(`select c.relname,count(*)::integer n,bool_and(t.tgdeferrable and t.tginitdeferred and t.tgenabled<>'D') deferred
    from pg_trigger t join pg_class c on c.oid=t.tgrelid where t.tgname=any($1::text[]) group by c.relname order by c.relname`, [triggerNames]),
    ['race_editions','season_days','seasons','stages'].map(relname => ({relname,n:1,deferred:true})), 'all four triggers are active and initially deferred');
  check(await scalar(`select prosecdef and proconfig @> array['search_path=""']
    and not has_function_privilege('anon',oid,'execute') and not has_function_privilege('authenticated',oid,'execute')
    from pg_proc where oid='private.assert_paris_race_stage_departure(uuid)'::regprocedure`), true, 'assertion helper is private with a fixed search path');
  const indexDefinitions = await query("select indexname,indexdef from pg_indexes where tablename in('stages','race_editions','season_days') order by indexname");
  check(indexDefinitions.some(index => /\(season_day_id, day_slot\)/.test(index.indexdef)), true, 'parent-day checks have an indexed child lookup');
  check(indexDefinitions.some(index => index.indexname === 'race_editions_season_id_idx' && /\(season_id\)/.test(index.indexdef)), true,
    'season checks have an indexed edition lookup');
  const benchmarkStartedAt = performance.now();
  const benchmarkRows = await query(`select private.assert_paris_race_stage_departure($1) from generate_series(1,1318)`, [id(40)]);
  const benchmarkDurationMs = Math.round(performance.now() - benchmarkStartedAt);
  check(benchmarkRows.length, 1318, 'a calendar-sized batch of primary-key validations completes in the isolated runtime');
  const finalSchedule = await query('select * from stages order by id');
  await db.exec(migration);
  check(await query('select * from stages order by id'), finalSchedule, 'reapplying the migration is idempotent and does not rewrite schedules');
  check(await protectedData(), protectedBefore, 'reapplying the invariant preserves all sporting records');
  check(await existingGuards(), guardsBefore, 'existing calendar and federation guards stay unchanged after reapplication');
  console.log(`Paris race-slot invariants: ${checks} isolated PostgreSQL checks passed.`);
  console.log(`Indicative local PGlite cost: 1318 helper calls on an indexed valid stage in ${benchmarkDurationMs} ms; no production benchmark or absolute timing assertion.`);
} finally {
  await db.close();
}
