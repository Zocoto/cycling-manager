// Isolated PostgreSQL regressions. This script never connects to Supabase.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';

const modulePath = process.argv[2] ??
  'C:/Dev/tmp/rnd-postgres-validation/node_modules/@electric-sql/pglite/dist/index.js';
if (!modulePath.replaceAll('\\', '/').endsWith('/pglite/dist/index.js')) {
  throw new Error('Pass the path of an existing local PGlite runtime.');
}
const { PGlite } = await import(pathToFileURL(modulePath).href);
const read = (name) => readFileSync(new URL(`../supabase/migrations/${name}.sql`, import.meta.url), 'utf8').replaceAll('\r', '');
const migration = read('20261128120000_reserve_s6_international_calendar_days');
const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const db = new PGlite();
let checks = 0;
const check = (value, expected, label) => { assert.deepEqual(value, expected, label); checks += 1; };
const rows = async (sql, params = []) => (await db.query(sql, params)).rows;
const scalar = async (sql, params = []) => Object.values((await rows(sql, params))[0])[0];
const extractedDefinition = (sql, qualifiedName) => {
  const at = sql.toLowerCase().indexOf(`create or replace function ${qualifiedName.toLowerCase()}(`);
  assert(at >= 0, `Missing source definition ${qualifiedName}`);
  const end = sql.indexOf('$$;', at);
  assert(end >= 0, `Missing source function terminator ${qualifiedName}`);
  return sql.slice(at, end + 3);
};

try {
  await db.exec(`
    create role anon; create role authenticated; create role service_role;
    create schema private;
    create table public.countries(id uuid primary key,iso_alpha2 text unique);
    create table public.seasons(id uuid primary key, game_year integer unique, status text);
    create table public.season_days(id uuid primary key, season_id uuid, day_number integer, calendar_date date, unique(season_id,day_number));
    create table public.race_categories(id uuid primary key, code text);
    create table public.races(id uuid primary key default gen_random_uuid(), country_id uuid, slug text unique, name text, short_name text, status text default 'active',
      competition_type text, race_format text, is_grand_tour boolean default false,is_monument boolean default false);
    create table public.race_editions(id uuid primary key default gen_random_uuid(), race_id uuid, season_id uuid, race_category_id uuid, display_name text,
      status text, registration_closes_at timestamptz, withdrawal_closes_at timestamptz, wildcard_closes_at timestamptz,
      edition_number integer, minimum_reputation numeric, registration_policy text, field_limit integer,
      unique(race_id,season_id));
    create table public.stages(id uuid primary key default gen_random_uuid(), race_edition_id uuid, season_day_id uuid, stage_number integer, status text,
      day_slot text, departure_at timestamptz, stage_type text default 'road', name text, profile_type text default 'flat', distance_km numeric,
      constraint stages_day_slot_unique unique(race_edition_id,season_day_id,day_slot) deferrable initially immediate,
      unique(race_edition_id,stage_number));
    create table public.stage_results(stage_id uuid);
    create table public.official_stage_simulations(stage_id uuid);
    create table public.stage_segments(id uuid primary key, stage_id uuid, segment_number integer, terrain_type text,
      surface_type text, distance_km numeric, average_gradient_pct numeric, unique(stage_id,segment_number));
    create table public.stage_segment_primes(stage_segment_id uuid, prime_type text, mountain_category text, points_scale smallint[], unique(stage_segment_id,prime_type));
    create table public.national_federation_selection_slots(competition_code text,rider_category text,active_from_game_year integer,
      day_number integer,profile_label text);
    create table public.national_federation_race_projects(id uuid, country_id uuid, race_id uuid, status text, activation_game_year integer,
      start_day_number integer, start_day_slot text, stage_blueprint jsonb);
    create table public.development_race_editions(season_id uuid,status text,competition_type text,start_day_number integer,end_day_number integer);
    create table public.season_events(season_day_id uuid,event_type text,title text,description text,href text,is_filter_persistent boolean,
      participation_rule text,unique(season_day_id,event_type));
    create table private.grand_tour_profile_rotations(race_edition_id uuid);
    create table private.championship_road_rotation_locks(race_edition_id uuid);
    -- Auxiliary player data must survive a calendar-only relocation unchanged.
    create table public.fixture_entries(id uuid primary key,race_edition_id uuid,rider_id uuid);
    create table public.fixture_preparations(id uuid primary key,stage_id uuid,payload jsonb);
    create index on public.stages(season_day_id);
    create index on public.stages(race_edition_id);
    create index on public.race_editions(season_id);
    create index on public.races(country_id);
    insert into public.seasons values('${id(5)}',5,'active'),('${id(6)}',6,'planned'),('${id(7)}',7,'planned'),('${id(8)}',8,'planned');
    insert into public.season_days select ('00000000-0000-4000-8000-'||lpad((year*100+day)::text,12,'0'))::uuid,
      ('00000000-0000-4000-8000-'||lpad(year::text,12,'0'))::uuid,day,date '2026-12-04'+(year-6)*28+day-1
      from generate_series(5,8) year cross join generate_series(1,28) day;
    insert into public.race_categories values('${id(21)}','world'),('${id(22)}','continental'),('${id(23)}','national'),
      ('${id(24)}','regional'),('${id(25)}','local'),('${id(26)}','elite');
    insert into public.national_federation_selection_slots values
      ('continental_championship','professional',3,15,'Route'),('world_championship','professional',3,26,'Route'),
      ('nations_cup','professional',3,24,'Montagne');
  `);

  // Compile the real legacy calendar functions used by the new migration.
  await db.exec(extractedDefinition(read('20261027160000_expand_s5_elite_calendar'), 'private.s5_elite_calendar_plan'));
  const definitionsPath = process.argv[4];
  if (definitionsPath) {
    const source = JSON.parse(readFileSync(definitionsPath, 'utf8').replace(/^\uFEFF/, ''));
    for (const f of source.rows) await db.exec(f.definition);
    const elite = JSON.parse(readFileSync(join(dirname(definitionsPath), 'elite-functions-before.json'), 'utf8').replace(/^\uFEFF/, ''));
    for (const f of elite.rows) await db.exec(f.definition);
  } else {
    await db.exec(`
      create function public.provision_season_race_calendar(p_source_season_id uuid,p_target_season_id uuid)
      returns void language plpgsql as $$ begin
  perform private.apply_s5_elite_calendar(p_target_season_id);
        perform public.repair_missing_standard_race_deadlines(p_target_season_id);
      end $$;
      create function public.repair_missing_standard_race_deadlines(uuid) returns integer language sql as $$ select 0 $$;
    `);
    await db.exec(extractedDefinition(read('20260930150000_create_s4_local_race_circuit'), 'private.find_free_standard_race_start_day'));
    await db.exec(`create function private.standard_race_country_overlap_allowed(uuid,uuid,uuid,uuid) returns boolean language sql stable as $$select false$$;`);
    await db.exec(`
      create function public.enforce_international_elite_stage_calendar() returns trigger language plpgsql as $$ declare v_game_year integer:=6; begin
        perform * from private.s5_elite_calendar_plan(); return new;
      end $$;
      create function private.apply_s5_elite_calendar(p_season_id uuid) returns void language plpgsql as $$ declare v_year integer:=6; begin
        perform * from private.s5_elite_calendar_plan();
      end $$;
    `);
  }

  const snapshotPath = process.argv[3];
  if (snapshotPath) {
    const data = JSON.parse(readFileSync(snapshotPath, 'utf8').replace(/^\uFEFF/, '')).rows;
    assert(data.length > 0, 'Nonempty calendar snapshot');
    const season = data[0].season_id;
    await db.query('update public.seasons set id=$1 where game_year=6', [season]);
    await db.query('update public.season_days set season_id=$1 where season_id=$2', [season, id(6)]);
    const json = JSON.stringify(data);
    await db.query(`insert into public.races(id,country_id,slug,name,status,competition_type,race_format,is_grand_tour)
      select race_id,country_id,min(slug),min(slug),'active',min(competition_type),
        case when max(stage_number)>1 then 'stage_race' else 'one_day' end,
        min(slug) in ('corsa-delle-regioni','boucle-des-provinces','ruta-de-las-sierras')
      from jsonb_to_recordset($1::jsonb) x(race_id uuid,country_id uuid,slug text,competition_type text,stage_number integer)
      group by race_id,country_id`, [json]);
    await db.query(`insert into public.race_editions(id,race_id,season_id,race_category_id,display_name,status,
      registration_closes_at,withdrawal_closes_at,wildcard_closes_at)
      select distinct x.edition_id,x.race_id,x.season_id,c.id,x.display_name,x.edition_status,x.registration_closes_at,
        x.withdrawal_closes_at,x.wildcard_closes_at
      from jsonb_to_recordset($1::jsonb) x(edition_id uuid,race_id uuid,season_id uuid,category_code text,display_name text,
        edition_status text,registration_closes_at timestamptz,withdrawal_closes_at timestamptz,wildcard_closes_at timestamptz)
      join public.race_categories c on c.code=x.category_code`, [json]);
    await db.query(`insert into public.stages(id,race_edition_id,season_day_id,stage_number,status,day_slot,departure_at)
      select x.stage_id,x.edition_id,d.id,x.stage_number,x.stage_status,x.day_slot,x.departure_at
      from jsonb_to_recordset($1::jsonb) x(stage_id uuid,edition_id uuid,season_id uuid,day_number integer,stage_number integer,
        stage_status text,day_slot text,departure_at timestamptz)
      join public.season_days d on d.season_id=x.season_id and d.day_number=x.day_number`, [json]);
    await db.exec(`
      insert into public.countries(id) select distinct country_id from public.races where country_id is not null;
      update public.countries c set iso_alpha2=source.country_code from (
        select distinct race.country_id,plan.country_code from private.s5_elite_calendar_plan() plan
        join public.races race on race.slug=plan.slug where plan.country_code is not null
      ) source where c.id=source.country_id;
      update public.races r set is_monument=plan.monument from private.s5_elite_calendar_plan() plan where r.slug=plan.slug;
    `);
  }

  async function addEdition({ number, year = 6, category = 'world', type = 'standard', days, status = 'planned', country = number }) {
    const season = await scalar('select id from public.seasons where game_year=$1', [year]);
    await db.query(`insert into public.races(id,country_id,slug,name,status,competition_type,race_format)
      values($1,$2,$3,$3,'active',$4,$5)`, [id(number), id(900000 + country), `fixture-${number}`, type, days.length > 1 ? 'stage_race' : 'one_day']);
    const edition = id(number + 10000);
    await db.query(`insert into public.race_editions(id,race_id,season_id,race_category_id,display_name,status,
      registration_closes_at,withdrawal_closes_at,wildcard_closes_at)
      select $1,$2,$3,c.id,$4,'registration_open',(d.calendar_date::timestamp+time '08:00') at time zone 'Europe/Paris',
        (d.calendar_date::timestamp+time '08:00') at time zone 'Europe/Paris',((d.calendar_date::timestamp+time '14:00') at time zone 'Europe/Paris')-interval '24 hours'
      from public.race_categories c cross join public.season_days d
      where c.code=$5 and d.season_id=$3 and d.day_number=$6`, [edition, id(number), season, `fixture-${number}`, category, days[0]]);
    for (const [index, day] of days.entries()) {
      const slot = index % 2 === 0 ? 'early' : 'late';
      await db.query(`insert into public.stages(id,race_edition_id,season_day_id,stage_number,status,day_slot,departure_at)
        select $1,$2,d.id,$3,$4,$5,(d.calendar_date::timestamp+case $5 when 'early' then time '14:00' else time '18:00' end) at time zone 'Europe/Paris'
        from public.season_days d where d.season_id=$6 and d.day_number=$7`,
      [id(number * 100 + index), edition, index + 1, status, slot, season, day]);
    }
    return edition;
  }

  const historical = await addEdition({ number: 1000, year: 5, days: [24] });
  const tour = await addEdition({ number: 1001, days: [23, 23, 24, 24, 25] });
  const regional = await addEdition({ number: 1002, category: 'regional', days: [24] });
  const local = await addEdition({ number: 1003, category: 'local', days: [24] });
  const cc = await addEdition({ number: 1004, category: 'national', days: [15] });
  const world = await addEdition({ number: 1005, category: 'continental', days: [26] });
  await addEdition({ number: 1006, type: 'national_road', category: 'national', days: [8] });
  const cnParallel = await addEdition({ number: 1007, category: 'world', days: [8] });
  await db.query(`insert into public.stage_segments select id,id,1,'flat','asphalt',100,0 from public.stages`);
  await db.query(`insert into public.fixture_entries values($1,$2,$3)`, [id(99001), tour, id(99002)]);
  await db.query(`insert into public.fixture_preparations select $1,id,'{"role":"leader"}'::jsonb from public.stages where race_edition_id=$2 and stage_number=1`, [id(99003), tour]);

  const historicalBefore = await rows('select * from public.stages where race_edition_id=$1 order by id', [historical]);
  const allIdsBefore = await rows('select id,race_edition_id,stage_number from public.stages order by id');
  const categoriesBefore = await rows(`select e.id,r.slug,c.code from public.race_editions e join public.races r on r.id=e.race_id
    join public.race_categories c on c.id=e.race_category_id where e.season_id=(select id from public.seasons where game_year=6) order by e.id`);
  const segmentsBefore = await rows('select * from public.stage_segments order by id');
  const playerBefore = await rows('select * from public.fixture_entries order by id');
  const preparationBefore = await rows('select * from public.fixture_preparations order by id');
  const daysBefore = await rows(`select t.id,t.race_edition_id,d.day_number,t.day_slot,t.departure_at,e.registration_closes_at,
    e.withdrawal_closes_at,e.wildcard_closes_at from public.stages t join public.season_days d on d.id=t.season_day_id
    join public.race_editions e on e.id=t.race_edition_id order by t.id`);

  if (definitionsPath) {
    // Exercise the interaction with production's existing before/deferred
    // guards and deadline recalculation, rather than testing an empty schema.
    await db.exec(extractedDefinition(read('20261027160000_expand_s5_elite_calendar'), 'private.guard_s5_elite_daily_limit'));
    await db.exec(`
      create trigger enforce_international_elite_stage_calendar_trigger before insert or update of
        race_edition_id,season_day_id,departure_at,day_slot,stage_type on public.stages for each row
        execute function public.enforce_international_elite_stage_calendar();
      create trigger refresh_schedule_dependent_edition_deadlines_trigger after insert or update of
        race_edition_id,season_day_id,departure_at,day_slot,stage_type on public.stages for each row
        execute function public.refresh_schedule_dependent_edition_deadlines();
      create constraint trigger guard_s5_elite_daily_limit after insert or update of
        race_edition_id,season_day_id,day_slot on public.stages deferrable initially deferred for each row
        execute function private.guard_s5_elite_daily_limit();
      create constraint trigger enforce_standard_race_country_spacing_trigger after insert or update of
        race_edition_id,season_day_id on public.stages deferrable initially deferred for each row
        execute function private.enforce_standard_race_country_spacing();
    `);
  }

  await db.exec(migration);
  check(await rows('select * from public.stages where race_edition_id=$1 order by id', [historical]), historicalBefore, 'S5 schedules remain byte-for-byte unchanged');
  check(await rows('select id,race_edition_id,stage_number from public.stages order by id'), allIdsBefore, 'No stage or edition identity replaced');
  if (snapshotPath) {
    const oldCategories = new Map(categoriesBefore.map((edition) => [edition.id, edition.code]));
    const categoriesAfter = await rows(`select e.id,r.slug,c.code,e.minimum_reputation from public.race_editions e join public.races r on r.id=e.race_id
      join public.race_categories c on c.id=e.race_category_id where e.season_id=(select id from public.seasons where game_year=6) order by e.id`);
    const reclassified = categoriesAfter.filter((edition) => edition.code !== oldCategories.get(edition.id));
    check(reclassified.map((edition) => edition.slug).sort(), ['circuit-des-salines', 'gp-des-plaines-du-danube'], 'Exactly the two approved flat classics are reclassified');
    for (const edition of reclassified) {
      check(edition.code, 'world', 'Approved classic remains available at World level');
      check(Number(edition.minimum_reputation), 200, 'Reclassified classic uses the existing World reputation threshold');
    }
    check(categoriesAfter.filter((edition) => edition.code === 'elite').length, 23, 'Retain 23 Elite editions including Bratislava');
  }
  check(await rows('select * from public.stage_segments order by id'), segmentsBefore, 'Course routes unchanged');
  check(await rows('select * from public.fixture_entries order by id'), playerBefore, 'Player entries unchanged');
  check(await rows('select * from public.fixture_preparations order by id'), preparationBefore, 'Race preparations unchanged');
  check(await scalar(`select count(*)::integer from public.stages t join public.race_editions e on e.id=t.race_edition_id
    join public.seasons s on s.id=e.season_id join public.races r on r.id=e.race_id join public.race_categories c on c.id=e.race_category_id
    join public.season_days d on d.id=t.season_day_id
    where s.game_year>=6 and r.competition_type='standard' and c.code not in ('regional','local')
      and d.day_number in (8,15,24,26)`), 0, 'No ordinary high-category stage shares CN/NC/CC/CM days');
  for (const edition of [regional, local]) check(await scalar(`select d.day_number from public.stages t join public.season_days d on d.id=t.season_day_id where t.race_edition_id=$1`, [edition]), 24, 'REG/LOC remain available on Nations Cup day');
  check(await scalar(`select d.day_number<>8 from public.stages t join public.season_days d on d.id=t.season_day_id where t.race_edition_id=$1`, [cnParallel]), true, 'CN protection also displaces an ordinary World race');
  check(await scalar(`select count(*)::integer from (
    select t.season_day_id from public.stages t join public.race_editions e on e.id=t.race_edition_id
    join public.seasons s on s.id=e.season_id and s.game_year>=6
    join public.race_categories c on c.id=e.race_category_id and c.code='elite'
    where e.status<>'cancelled' and t.status<>'cancelled' group by t.season_day_id
    having count(distinct e.id)>2) overcrowded`), 0, 'Retain a maximum of two Elite races per day');

  const daysAfter = await rows(`select t.id,t.race_edition_id,d.day_number,t.day_slot,t.departure_at,e.registration_closes_at,
    e.withdrawal_closes_at,e.wildcard_closes_at from public.stages t join public.season_days d on d.id=t.season_day_id
    join public.race_editions e on e.id=t.race_edition_id order by t.id`);
  const beforeById = new Map(daysBefore.map((stage) => [stage.id, stage]));
  const movedByEdition = new Map();
  for (const stage of daysAfter) {
    const before = beforeById.get(stage.id);
    const delta = stage.day_number - before.day_number;
    if (!delta) continue;
    check(stage.day_slot, before.day_slot, 'Preserve each moved stage daily slot');
    const previousDelta = movedByEdition.get(stage.race_edition_id);
    if (previousDelta !== undefined) check(delta, previousDelta, 'Move all stages of a tour by one common offset');
    movedByEdition.set(stage.race_edition_id, delta);
    for (const name of ['departure_at', 'registration_closes_at', 'withdrawal_closes_at', 'wildcard_closes_at']) {
      if (before[name] !== null) check(new Date(stage[name]).getTime() - new Date(before[name]).getTime(), delta * 86400000, `${name} follows the edition shift`);
    }
  }
  check(movedByEdition.has(tour), true, 'Whole tour spanning Nations Cup moved');
  check(movedByEdition.has(cc) && movedByEdition.has(world), true, 'CC and CM collisions moved');
  const s6 = await scalar('select id from public.seasons where game_year=6');
  check(await scalar('select private.reserve_s6_international_calendar_days($1)', [s6]), 0, 'Calendar normalization is idempotent');
  check(await rows(`select t.id,t.race_edition_id,d.day_number,t.day_slot,t.departure_at,e.registration_closes_at,
    e.withdrawal_closes_at,e.wildcard_closes_at from public.stages t join public.season_days d on d.id=t.season_day_id
    join public.race_editions e on e.id=t.race_edition_id order by t.id`), daysAfter, 'Replay changes no schedule or deadline');

  const definition = await scalar(`select pg_get_functiondef('public.provision_season_race_calendar(uuid,uuid)'::regprocedure)`);
  check(definition.includes('private.reserve_s6_international_calendar_days(p_target_season_id)'), true, 'Every future season provisioning includes normalization');
  const forbidden = await rows(`select t.id from public.stages t join public.race_editions e on e.id=t.race_edition_id
    where e.id=$1 order by t.stage_number limit 1`, [tour]);
  let rejected = false;
  try {
    await db.exec('begin');
    await db.query(`update public.stages set season_day_id=(select id from public.season_days where season_id=$1 and day_number=24) where id=$2`, [s6, forbidden[0].id]);
    await db.exec('set constraints all immediate');
    await db.exec('commit');
  } catch {
    rejected = true;
    await db.exec('rollback');
  }
  check(rejected, true, 'Deferred final-state guard rejects a new Nations Cup collision');

  async function expectRejected(label, action, pattern) {
    await db.exec('begin');
    let error;
    try {
      await action();
      await db.exec('set constraints all immediate');
    } catch (caught) {
      error = caught;
    } finally {
      await db.exec('rollback');
    }
    check(Boolean(error), true, label);
    if (pattern) check(pattern.test(error?.message ?? ''), true, `${label}: reports the concrete cause`);
  }
  await expectRejected('Changing an existing REG edition to World cannot bypass protection', async () => {
    await db.query('update public.race_editions set race_category_id=$1 where id=$2', [id(21), regional]);
  });

  await addEdition({ number: 1010, category: 'world', days: [10] });
  await expectRejected('Adding an international stage on an occupied ordinary day is rejected too', async () => {
    await db.exec("update public.national_federation_selection_slots set day_number=10 where competition_code='world_championship'");
    await addEdition({ number: 1011, type: 'world_championship', days: [10] });
  });
  await expectRejected('A started stage must never be relocated by the repair', async () => {
    await addEdition({ number: 1012, days: [24], status: 'in_progress' });
    await db.query('select private.reserve_s6_international_calendar_days($1)', [s6]);
  }, /arbitration/i);
  await expectRejected('A stage with an official simulation must never be relocated', async () => {
    const edition = await addEdition({ number: 1013, days: [24] });
    await db.query('insert into public.official_stage_simulations select id from public.stages where race_edition_id=$1', [edition]);
    await db.query('select private.reserve_s6_international_calendar_days($1)', [s6]);
  }, /arbitration/i);
  for (const role of ['anon', 'authenticated']) {
    check(await scalar(`select has_function_privilege($1,'private.reserve_s6_international_calendar_days(uuid)','execute')`, [role]), false, `${role} cannot invoke the calendar repair`);
    check(await scalar(`select has_function_privilege($1,'private.prepare_s6_international_elite_categories(uuid)','execute')`, [role]), false, `${role} cannot reclassify races`);
  }

  // Exercise later normal and quadrennial seasons through the same hook body,
  // in a transaction just as real calendar provisioning does.
  for (const year of [7, 8]) {
    await db.exec('begin');
    const season = await scalar('select id from public.seasons where game_year=$1', [year]);
    await addEdition({ number: 1100 + year, year, type: 'nations_cup', days: [24] });
    const edition = await addEdition({ number: 1200 + year, year, days: [23, 23, 24] });
    const moved = await scalar('select private.reserve_s6_international_calendar_days($1)', [season]);
    await db.exec('set constraints all immediate');
    await db.exec('commit');
    check(moved, 1, `Same repair is effective in S${year}${year === 8 ? ' (quadrennial event)' : ''}`);
    check(await scalar(`select count(*)::integer from public.stages t join public.season_days d on d.id=t.season_day_id
      where t.race_edition_id=$1 and d.day_number=24`, [edition]), 0, `S${year} ordinary stages avoid the federation event`);
  }
  // A moved edition keeps Paris wall-clock hours across summer time, rather
  // than adding a fixed number of UTC hours to departures and deadlines.
  await db.exec('begin');
  await db.query("insert into public.seasons values($1,9,'planned')", [id(9)]);
  await db.exec(`insert into public.season_days select ('00000000-0000-4000-8000-'||lpad((900+day)::text,12,'0'))::uuid,
    '${id(9)}',day,date '2027-03-15'+day-1 from generate_series(1,28) day;
    update public.national_federation_selection_slots set day_number=14 where competition_code='nations_cup';`);
  await addEdition({ number: 1309, year: 9, type: 'nations_cup', days: [14] });
  const summerEdition = await addEdition({ number: 1409, year: 9, days: [14] });
  const summerBefore = await scalar('select departure_at from public.stages where race_edition_id=$1', [summerEdition]);
  await db.query('select private.reserve_s6_international_calendar_days($1)', [id(9)]);
  const summerAfter = (await rows(`select t.departure_at,(t.departure_at at time zone 'Europe/Paris')::time::text as local_departure,
    (e.registration_closes_at at time zone 'Europe/Paris')::time::text as local_close
    from public.stages t join public.race_editions e on e.id=t.race_edition_id where e.id=$1`, [summerEdition]))[0];
  check(summerAfter.local_departure, '14:00:00', 'DST relocation retains the 14:00 Paris departure');
  check(summerAfter.local_close, '08:00:00', 'DST relocation retains the 08:00 Paris registration deadline');
  check(new Date(summerAfter.departure_at).getTime() - new Date(summerBefore).getTime(), -23 * 3600000, 'DST relocation uses a Paris calendar day of 23 hours');
  await db.exec('rollback');
  check(await scalar(`select private.reserve_s6_international_calendar_days($1)`, [id(5)]), 0, 'Repair refuses to rewrite active S5');
  await db.query(`update public.seasons set status='active' where id=$1`, [s6]);
  check(await scalar(`select private.reserve_s6_international_calendar_days($1)`, [s6]), 0, 'Repair does not rewrite a running S6 either');

  console.log(`S6 international calendar SQL: ${checks} assertions passed${snapshotPath ? ' including the captured full S6 calendar' : ''}.`);
} catch (error) {
  console.error(JSON.stringify({ message: error.message, code: error.code, detail: error.detail, where: error.where }, null, 2));
  process.exitCode = 1;
  try { await db.exec('rollback'); } catch { /* An aborted fixture may already have rolled back. */ }
} finally {
  await db.close();
}
