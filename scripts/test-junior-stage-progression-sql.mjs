// Exercises the actual junior reward trigger in an isolated, in-memory database.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const modulePath = process.argv[2];
if (!modulePath) throw new Error('Pass the path to the installed PGlite module.');

const { PGlite } = await import(pathToFileURL(modulePath).href);
const db = new PGlite();
const query = async (sql, params = []) => (await db.query(sql, params)).rows;
const migration = name => readFileSync(new URL('../supabase/migrations/' + name + '.sql', import.meta.url), 'utf8');
const originalResults = migration('20260812130000_create_development_team');
const originalProgression = migration('20260822100000_add_development_podium_progression');
const recalibration = migration('20260824130000_recalibrate_youth_progression');
const potentialCaps = migration('20261011133000_enforce_training_potential_stat_caps');
const stageReward = migration('20261124190000_reward_junior_stage_winners');
const statKeys = [
  'mountain', 'hills', 'flat', 'time_trial', 'cobbles', 'sprint', 'acceleration',
  'downhill', 'endurance', 'resistance', 'recovery', 'breakaway', 'prologue',
];

function table(source, name) {
  const match = source.match(new RegExp('create table public\\.' + name + ' \\([\\s\\S]*?\\r?\\n\\);'));
  assert.ok(match, 'Missing original table ' + name);
  return match[0];
}

function sqlFunction(source, name) {
  const match = source.match(
    new RegExp('create or replace function public\\.' + name + '\\([\\s\\S]*?\\r?\\n\\$\\$;'),
  );
  assert.ok(match, 'Missing original function ' + name);
  return match[0];
}

async function academyRider(potential = 8, baseRating = 2.5) {
  const [record] = await query(
    'insert into public.youth_academy_riders(potential_steps,' + statKeys.join(',') + ') '
      + 'values($1,' + statKeys.map(() => '$2').join(',') + ') returning id',
    [potential, baseRating],
  );
  return record.id;
}

async function edition(profile, format) {
  const [record] = await query(
    'insert into public.development_race_editions(profile_type,race_format) values($1,$2) returning id',
    [profile, format],
  );
  return record.id;
}

async function stage(race, number, profile) {
  const [record] = await query(
    'insert into public.development_race_stages(race_edition_id,stage_number,day_number,name,stage_type,profile_type,distance_km) '
      + "values($1,$2,8,'Fixture stage',$3,$4,50) returning id",
    [race, number, profile === 'time_trial' ? 'individual_time_trial' : 'road', profile],
  );
  return record.id;
}

async function result(race, stageId, rank, rider) {
  const [record] = await query(
    'insert into public.development_race_results(race_edition_id,stage_id,result_scope,competitor_key,academy_rider_id,'
      + 'rider_name,team_name,country_code,rank,elapsed_time_seconds,gap_to_winner_seconds) '
      + "values($1,$2,$3,$4,$5,'Junior','Fixture','FR',$6,5000,0) returning id",
    [race, stageId, stageId === null ? 'general' : 'stage', rider ?? 'virtual:1', rider, rank],
  );
  return record.id;
}

async function ratings(rider) {
  return (await query(
    'select ' + statKeys.map(key => key + '::float8').join(',') + ' from public.youth_academy_riders where id=$1',
    [rider],
  ))[0];
}

const awards = rider => query(
  'select * from public.development_race_podium_progression where academy_rider_id=$1',
  [rider],
);

async function assertStageWin(race, stageId, rider, stageNumber, profile, ratingKey, dbRatingKey, gain) {
  const before = await ratings(rider);
  const resultId = await result(race, stageId, 1, rider);
  const after = await ratings(rider);
  assert.deepEqual(
    after,
    { ...before, [dbRatingKey]: Math.round((before[dbRatingKey] + gain / 8) * 1000) / 1000 },
    'Stage progression changes only the primary rating for the stage profile',
  );

  const reward = (await awards(rider)).find(row => row.race_edition_id === race && row.stage_number === stageNumber);
  assert.ok(reward);
  assert.equal(reward.final_rank, 1);
  assert.equal(reward.profile_type, profile);
  assert.equal(reward.primary_rating_key, ratingKey);
  assert.deepEqual(reward.projected_rating_changes, { [ratingKey]: gain });
  assert.deepEqual(reward.ratings_before, { [ratingKey]: Math.round((34 + before[dbRatingKey] * 8) * 1000) / 1000 });
  assert.deepEqual(reward.ratings_after, { [ratingKey]: Math.round((34 + after[dbRatingKey] * 8) * 1000) / 1000 });

  return { after, resultId };
}

try {
  await db.exec(`
    create role anon;
    create role authenticated;
    create role service_role;
    create schema private;
    create table public.youth_academy_riders (
      id uuid primary key default gen_random_uuid(), team_id uuid, potential_steps smallint not null,
      updated_at timestamptz not null default now(),
      ${statKeys.map(key => key + ' numeric(5,3) not null').join(', ')}
    );
    create table public.development_race_editions (
      id uuid primary key default gen_random_uuid(), profile_type text not null, race_format text not null
    );
    create table public.development_teams (id uuid primary key);
    create function public.current_user_manages_team(uuid) returns boolean language sql as 'select false';
  `);
  for (const name of ['development_race_stages', 'development_race_results']) {
    await db.exec(table(originalResults, name));
  }
  await db.exec(`
    create unique index development_race_results_competitor_unique_idx on public.development_race_results (
      race_edition_id, result_scope, coalesce(stage_id, '00000000-0000-0000-0000-000000000000'::uuid), competitor_key
    );
    create unique index development_race_results_rank_unique_idx on public.development_race_results (
      race_edition_id, result_scope, coalesce(stage_id, '00000000-0000-0000-0000-000000000000'::uuid), rank
    );
  `);
  await db.exec(originalProgression);
  for (const name of ['get_youth_rating_progress_factor', 'get_development_podium_rating_factor']) {
    await db.exec(sqlFunction(recalibration, name));
  }
  for (const name of ['get_rider_potential_stat_cap', 'get_youth_training_next_raw_rating']) {
    await db.exec(sqlFunction(potentialCaps, name));
  }

  const historicalRider = await academyRider();
  const historicalTour = await edition('mixed', 'stage_race');
  const historicalStage = await stage(historicalTour, 1, 'mountain');
  await result(historicalTour, historicalStage, 1, historicalRider);
  assert.deepEqual(await awards(historicalRider), [], 'The old rule did not award stage progression');
  await result(historicalTour, null, 1, historicalRider);
  const historicalAwards = await awards(historicalRider);
  const historicalRatings = await ratings(historicalRider);
  assert.equal(historicalAwards[0].projected_rating_changes.endurance, 1);
  assert.ok(historicalAwards[0].projected_rating_changes.mountain > 0);

  const originalClassic = await edition('cobbles', 'one_day');
  const originalClassicRider = await academyRider();
  await result(originalClassic, null, 1, originalClassicRider);
  const originalClassicAward = (await awards(originalClassicRider))[0];

  await db.exec(stageReward);
  assert.deepEqual(await awards(historicalRider), historicalAwards.map(row => ({ ...row, stage_number: null })));
  assert.deepEqual(await ratings(historicalRider), historicalRatings, 'No retroactive rating rewrite');

  const tour = await edition('mixed', 'stage_race');
  const mountain = await stage(tour, 1, 'mountain');
  const timeTrial = await stage(tour, 2, 'time_trial');
  const sprint = await stage(tour, 3, 'sprint');
  const winner = await academyRider();
  const second = await academyRider();
  const third = await academyRider();
  const initialSecond = await ratings(second);
  const initialThird = await ratings(third);
  const firstWin = await assertStageWin(tour, mountain, winner, 1, 'mountain', 'mountain', 'mountain', 0.248);
  await result(tour, mountain, 2, second);
  await result(tour, mountain, 3, third);
  assert.deepEqual(await ratings(second), initialSecond);
  assert.deepEqual(await ratings(third), initialThird);
  assert.deepEqual(await awards(second), []);
  assert.deepEqual(await awards(third), []);

  await db.query('delete from public.development_race_results where id=$1', [firstWin.resultId]);
  await result(tour, mountain, 1, winner);
  assert.deepEqual(await ratings(winner), firstWin.after, 'A replayed result cannot pay its reward twice');
  assert.equal((await awards(winner)).length, 1);

  await assertStageWin(tour, timeTrial, winner, 2, 'time_trial', 'timeTrial', 'time_trial', 0.248);
  await result(tour, sprint, 1, null);
  assert.equal((await query(
    'select count(*)::int as n from public.development_race_podium_progression where race_edition_id=$1 and stage_number=3',
    [tour],
  ))[0].n, 0, 'Virtual winners cannot receive a rating progression');
  await result(tour, null, 1, winner);
  await result(tour, null, 2, second);
  await result(tour, null, 3, third);
  const afterGeneral = await awards(winner);
  assert.deepEqual(afterGeneral.map(row => row.stage_number).sort(), [1, 2, null]);
  const general = afterGeneral.find(row => row.stage_number === null);
  assert.deepEqual(general.projected_rating_changes, historicalAwards[0].projected_rating_changes, 'The existing general podium still includes secondary stats');
  assert.equal((await awards(second))[0].projected_rating_changes.endurance, 0.6);
  assert.equal((await awards(third))[0].projected_rating_changes.endurance, 0.352);

  const classic = await edition('cobbles', 'one_day');
  const classicRider = await academyRider();
  await result(classic, await stage(classic, 1, 'cobbles'), 1, classicRider);
  assert.deepEqual(await awards(classicRider), [], 'A one-day stage row does not award a second bonus');
  const newClassicResult = await result(classic, null, 1, classicRider);
  const [newClassicAward] = await awards(classicRider);
  assert.equal(newClassicAward.stage_number, null);
  assert.deepEqual(newClassicAward.projected_rating_changes, originalClassicAward.projected_rating_changes);
  const classicRatings = await ratings(classicRider);
  await db.query('delete from public.development_race_results where id=$1', [newClassicResult]);
  await result(classic, null, 1, classicRider);
  assert.deepEqual(await ratings(classicRider), classicRatings, 'Final podium awards also remain idempotent');

  const malformed = await academyRider();
  const anotherTour = await edition('hilly', 'stage_race');
  await result(anotherTour, mountain, 1, malformed);
  assert.deepEqual(await awards(malformed), [], 'The referenced stage must belong to the same tour');

  const strongerRider = await academyRider(8, 4);
  const strongerStage = await stage(tour, 4, 'sprint');
  const [{ gain }] = await query(
    'select (round(0.25 * public.get_development_podium_rating_factor(66) / 8, 3) * 8)::float8 as gain',
  );
  assert.ok(gain > 0 && gain < 0.248);
  await assertStageWin(tour, strongerStage, strongerRider, 4, 'sprint', 'sprint', 'sprint', gain);

  const nearCap = await academyRider(1, 4.49);
  const nearCapStage = await stage(tour, 5, 'hilly');
  await assertStageWin(tour, nearCapStage, nearCap, 5, 'hilly', 'hills', 'hills', 0.08);
  assert.equal((await ratings(nearCap)).hills, 4.5, 'A 0.5-star rider caps at 70 projected');

  const aboveCap = await academyRider(1, 4.75);
  const aboveCapStage = await stage(tour, 6, 'cobbles');
  const aboveCapRatings = await ratings(aboveCap);
  await result(tour, aboveCapStage, 1, aboveCap);
  assert.deepEqual(await ratings(aboveCap), aboveCapRatings, 'A legacy rating above talent cap cannot grow or be reduced');
  assert.ok((await awards(aboveCap)).every(row => row.projected_rating_changes.cobbles === undefined));

  console.log('Junior stage winner progression passed in isolated PGlite.');
} catch (error) {
  console.error(error.message);
  if (error.where) console.error(error.where);
  process.exitCode = 1;
} finally {
  await db.close();
}
