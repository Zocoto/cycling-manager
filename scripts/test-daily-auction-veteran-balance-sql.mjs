// Isolated fixture exercising the actual daily-auction generator and the migration.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const modulePath = process.argv[2];
if (!modulePath) throw new Error('Pass the path to the installed PGlite module.');

const { PGlite } = await import(pathToFileURL(modulePath).href);
const db = new PGlite();
const rows = async (sql, params = []) => (await db.query(sql, params)).rows;
const readMigration = name => readFileSync(new URL('../supabase/migrations/' + name + '.sql', import.meta.url), 'utf8');

function originalFunction(version, name) {
  const declaration = readMigration(version).match(
    new RegExp('create or replace function public\\.' + name + '\\([\\s\\S]*?\\r?\\n\\$\\$;', 'i'),
  );
  assert.ok(declaration, 'Missing original SQL function ' + name);
  return declaration[0];
}

const originalMarket = '20260720233000_create_transfer_market';
const nationalMarket = '20260826110000_add_national_day_daily_auctions';
const migrationName = '20261123170000_balance_daily_auction_rider_experience';
const ratings = [
  'mountain', 'hills', 'flat', 'time_trial', 'cobbles', 'sprint', 'acceleration',
  'downhill', 'endurance', 'resistance', 'recovery', 'breakaway', 'prologue',
];
const countryId = 'a0000000-0000-0000-0000-000000000001';
const firstDate = '2035-01-01';
const round = (value, digits = 2) => Math.round(value * 10 ** digits) / 10 ** digits;
const mean = values => values.reduce((sum, value) => sum + value, 0) / values.length;

const generateMarket = async date => (await rows(
  'select public.create_daily_transfer_market($1,$2::jsonb,true) as count',
  [date, JSON.stringify(Array.from({ length: 15 }, (_, i) => ({
    country_id: countryId,
    first_name: 'Coureur',
    last_name: String(i + 1),
    is_national_day_bonus: i >= 10,
  })))],
))[0].count;

try {
  await db.exec('create schema private; create role anon; create role authenticated; create role service_role;');
  await db.exec(
    'create table public.seasons (id uuid primary key default gen_random_uuid(), status text not null);' +
    "insert into public.seasons(status) values ('active');" +
    'create table public.countries (id uuid primary key, is_active boolean not null);' +
    'create table public.country_rider_generation_profiles (country_id uuid primary key references countries, name_profile_code text not null);' +
    "insert into public.countries values ('" + countryId + "', true);" +
    "insert into public.country_rider_generation_profiles values ('" + countryId + "', 'fixture');" +
    'create sequence public.fixture_rider_number;' +
    "create table public.riders (id uuid primary key default md5(nextval('public.fixture_rider_number')::text)::uuid, " +
    'country_id uuid references countries, first_name text, last_name text, status text, generated_name_profile_code text, potential_steps integer);' +
    'create table public.rider_season_ratings (rider_id uuid references riders, season_id uuid references seasons, ' +
    'age integer, ' + ratings.map(key => key + ' smallint not null').join(', ') + ', primary key (rider_id, season_id));' +
    'create table public.transfer_daily_batches (market_date date primary key, rider_count integer);' +
    'create table public.transfer_market_listings (rider_id uuid references riders, season_id uuid references seasons, ' +
    'listing_type text, market_date date, daily_slot integer, is_national_day_bonus boolean, minimum_bid numeric, ' +
    'salary_per_season numeric, opens_at timestamptz, closes_at timestamptz, unique(market_date, daily_slot));' +
    'create table public.special_ability_catalog (code text primary key, is_active boolean);' +
    'create table public.rider_special_abilities (rider_id uuid, ability_code text, source_type text, source_reference text, ' +
    'unique(rider_id,ability_code));',
  );
  for (const fn of ['calculate_market_random_stat', 'calculate_rider_overall']) {
    await db.exec(originalFunction(originalMarket, fn));
  }
  for (const fn of [
    'create_daily_transfer_market', 'calculate_initial_rider_potential_steps', 'assign_daily_auction_rider_potential',
  ]) {
    await db.exec(originalFunction(nationalMarket, fn));
  }
  await db.exec(originalFunction('20261011133000_enforce_training_potential_stat_caps', 'get_rider_potential_stat_cap'));
  await db.exec([
    'create or replace function public.calculate_rider_season_salary(p_rider_id uuid,p_season_id uuid) returns numeric',
    'language sql stable as $$ select public.calculate_rider_overall(p_rider_id,p_season_id)*100 $$;',
    'create trigger assign_daily_potential after insert on public.transfer_market_listings',
    'for each row execute function public.assign_daily_auction_rider_potential();',
    'revoke execute on function public.create_daily_transfer_market(date,jsonb,boolean) from public;',
    'grant execute on function public.create_daily_transfer_market(date,jsonb,boolean) to service_role;',
  ].join('\n'));

  const lotSnapshot = date => rows([
    'select listing.*, rating.*, rider.potential_steps',
    'from public.transfer_market_listings listing',
    'join public.riders rider on rider.id=listing.rider_id',
    'join public.rider_season_ratings rating on rating.rider_id=listing.rider_id and rating.season_id=listing.season_id',
    'where listing.market_date=$1 order by listing.daily_slot',
  ].join('\n'), [date]);
  assert.equal(await generateMarket(firstDate), 15);
  const historicalLots = await lotSnapshot(firstDate);
  assert.equal(historicalLots.length, 15);

  const migration = readMigration(migrationName);
  await db.exec(migration);
  assert.deepEqual(await lotSnapshot(firstDate), historicalLots, 'Existing auctions retain their notes and conditions.');
  assert.equal(await generateMarket(firstDate), 0, 'Same-day retry preserves existing auction demand.');
  assert.deepEqual(await lotSnapshot(firstDate), historicalLots);

  // Stable rider UUIDs and fixed dates give a reproducible sample of actual generator results.
  const [created] = await rows([
    'select sum(public.create_daily_transfer_market(date, $1::jsonb, true))::int as lots',
    "from (select '2035-02-01'::date + day as date from generate_series(0, 99) day) dates",
  ].join('\n'), [JSON.stringify(Array.from({ length: 15 }, (_, i) => ({
    country_id: countryId,
    first_name: 'Coureur',
    last_name: String(i + 1),
    is_national_day_bonus: i >= 10,
  })))]);
  assert.equal(created.lots, 1500);
  const lots = await rows([
    'select listing.market_date, listing.is_national_day_bonus as special, rating.age, rider.potential_steps as talent,',
    '  public.calculate_market_random_stat(seed.value, \'age\', 18, 30) as expected_age,',
    '  public.calculate_initial_rider_potential_steps(rider.id,',
    "    case when listing.is_national_day_bonus then 'national_day_auction' else 'auction' end) as expected_talent,",
    '  listing.minimum_bid::int, listing.salary_per_season::float8,',
    '  public.get_rider_potential_stat_cap(rider.potential_steps) as talent_cap,',
    '  public.calculate_rider_overall(rating.rider_id,rating.season_id)::float8 as overall,',
    '  array[' + ratings.map(key => 'rating.' + key).join(',') + '] as grades,',
    '  array[' + ratings.map(key => "public.calculate_market_random_stat(seed.value, '" + key +
      "', bounds.minimum, bounds.maximum)").join(',') + '] as original_grades',
    'from public.transfer_market_listings listing',
    'join public.riders rider on rider.id=listing.rider_id',
    'join public.rider_season_ratings rating on rating.rider_id=listing.rider_id and rating.season_id=listing.season_id',
    "cross join lateral (select listing.market_date::text || ':' || listing.daily_slot::text || ':' || rider.id::text as value) seed",
    'cross join lateral (select case when listing.is_national_day_bonus then 44 else 42 end as minimum,',
    '  case when listing.is_national_day_bonus then 72 else 70 end as maximum) bounds',
    'where listing.market_date<>$1 order by listing.market_date,listing.daily_slot',
  ].join('\n'), [firstDate]);

  const cohorts = { young: [], mature: [], veteran: [] };
  const counts = { regular: 0, special: 0 };
  let exceptionalVeteranGrades = 0;
  let regularGradesAtTalentCap = 0;
  let existingSpecialGradesAboveTalent = 0;
  for (const lot of lots) {
    counts[lot.special ? 'special' : 'regular'] += 1;
    assert.equal(lot.age, lot.expected_age);
    assert.equal(lot.talent, lot.expected_talent);
    assert.equal(lot.overall, round(mean(lot.grades)));
    assert.ok(lot.overall <= (lot.special ? 67 : 65), 'Preserve existing overall limits.');
    assert.equal(lot.salary_per_season, round(lot.overall * 100), 'Calculate salary from final ratings.');
    const bidBeforeRounding = 3000 + Math.max(0, lot.overall - 45) ** 2 * 80 + Math.max(0, 24 - lot.age) * 250;
    assert.equal(lot.minimum_bid, Math.max(2500, Math.round(bidBeforeRounding / 500) * 500));
    const originalAdjustment = Math.max(0, Math.ceil(round(mean(lot.original_grades)) - (lot.special ? 67 : 65)));
    const originalFinalGrades = lot.original_grades.map(grade => grade - originalAdjustment);
    const gain = round(lot.overall - round(mean(originalFinalGrades)));
    assert.ok(gain >= 0, 'Boost should not lower overall quality.');

    if (lot.age < 26) {
      assert.deepEqual(lot.grades, originalFinalGrades, 'Keep the existing generation for younger riders.');
      cohorts.young.push(gain);
    } else {
      cohorts[lot.age < 28 ? 'mature' : 'veteran'].push(gain);
    }
    for (const [index, grade] of lot.grades.entries()) {
      const original = lot.original_grades[index];
      const marketCap = lot.special ? 74 : 73;
      assert.ok(grade <= marketCap);
      assert.ok(grade <= Math.max(original, lot.talent_cap), 'Age advantages respect the training potential cap.');
      if (grade > (lot.special ? 72 : 70)) exceptionalVeteranGrades += 1;
      if (!lot.special && lot.talent === 1 && grade === 70 && original < 70) regularGradesAtTalentCap += 1;
      if (lot.special && lot.talent === 1 && original > 70 && grade === original) existingSpecialGradesAboveTalent += 1;
    }
  }

  assert.deepEqual(counts, { regular: 1000, special: 500 });
  assert.deepEqual([...new Set(lots.map(lot => lot.age))].sort((a, b) => a - b), Array.from({ length: 13 }, (_, i) => 18 + i));
  assert.ok(exceptionalVeteranGrades > 0 && regularGradesAtTalentCap > 0 && existingSpecialGradesAboveTalent > 0);
  const matureBoosted = cohorts.mature.filter(gain => gain > 0).length / cohorts.mature.length;
  const veteranBoosted = cohorts.veteran.filter(gain => gain > 0).length / cohorts.veteran.length;
  assert.ok(matureBoosted > 0.29 && matureBoosted < 0.51, 'Some 26–27-year-olds are stronger.');
  assert.ok(veteranBoosted > 0.60 && veteranBoosted < 0.80, 'Veterans are stronger more often, with room for overlap.');
  assert.ok(mean(cohorts.veteran) > 2 && mean(cohorts.veteran) < 3.4, 'The typical veteran advantage stays moderate.');
  assert.ok(mean(cohorts.mature) < mean(cohorts.veteran));
  assert.ok(lots.some(lot => lot.age < 26 && lot.overall > 61));
  assert.ok(lots.some(lot => lot.age >= 28 && lot.overall < 57));

  const [acl] = await rows([
    'select has_function_privilege(\'service_role\', signature, \'execute\') as service,',
    '  has_function_privilege(\'anon\', signature, \'execute\') as anon,',
    '  has_function_privilege(\'authenticated\', signature, \'execute\') as player',
    "from (select 'public.create_daily_transfer_market(date,jsonb,boolean)'::regprocedure as signature) fn",
  ].join('\n'));
  assert.deepEqual(acl, { service: true, anon: false, player: false });
  console.log('Isolated auction generation passed for ' + lots.length + ' bids. Average boost 26–27: ' +
    round(mean(cohorts.mature)) + ', 28–30: ' + round(mean(cohorts.veteran)) + '.');
} catch (error) {
  if (!error.query) throw error;
  console.error(error.message);
  if (error.where) console.error(error.where.split('\n').at(-1));
  process.exitCode = 1;
} finally {
  await db.close();
}
