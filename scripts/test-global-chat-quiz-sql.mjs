// Run against isolated PostgreSQL/WASM only. No URL or network configuration accepted.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { isAbsolute } from 'node:path';
import { pathToFileURL } from 'node:url';

const modulePath = process.argv[2];
if (!isAbsolute(modulePath ?? '') || !modulePath.replaceAll('\\', '/').endsWith('/@electric-sql/pglite/dist/index.js')) {
  throw new Error('Pass the absolute path to an installed local PGlite module.');
}
const { PGlite } = await import(pathToFileURL(modulePath).href);
const { unaccent } = await import(new URL('./contrib/unaccent.js', pathToFileURL(modulePath)).href);
const db = new PGlite({ extensions: { unaccent } });
const account = (prefix, number) => `${prefix}0000000-0000-4000-8000-${String(number).padStart(12, '0')}`;
const exact = 'Émile D’Arcy';
const target = account(4, 1);
let checks = 0;

function equal(actual, expected, label) {
  assert.deepEqual(actual, expected, label);
  checks += 1;
}
async function rows(sql, values = []) {
  return (await db.query(sql, values)).rows;
}
async function scalar(sql, values = []) {
  return Object.values((await rows(sql, values))[0])[0];
}
async function setUser(number) {
  return scalar("select set_config('request.jwt.claim.sub', $1, false)", [number ? account(2, number) : '']);
}
async function withRole(role, number, run) {
  await db.exec(`set role ${role}`);
  try {
    await setUser(number);
    return await run();
  } finally {
    await db.exec('reset role');
  }
}
const post = (number, message) => withRole('authenticated', number, () => (
  scalar('select (public.post_global_chat_message($1)).id', [message])
));
const publicState = () => withRole('authenticated', 1, () => scalar('select public.get_global_chat_quiz()'));
const packs = () => scalar("select count(*)::integer from public.cyclo_stickers_boosters where acquisition_source = 'global_chat_quiz'");
const eventCount = () => scalar('select count(*)::integer from public.global_chat_quiz_events');
const enable = (enabled) => withRole('service_role', null, () => (
  scalar('select public.set_global_chat_quiz_enabled($1)', [enabled])
));
const runFixture = (path) => readFile(new URL(path, import.meta.url), 'utf8').then(sql => db.exec(sql));

try {
  await runFixture('../supabase/tests/global-chat-quiz-fixture.sql');
  await runFixture('../supabase/migrations/20260727220000_create_global_game_chat.sql');
  await db.exec('select public.quiz_fixture_install_chat_metadata()');
  await runFixture('../supabase/migrations/20261108170000_add_global_chat_quiz.sql');
  await db.exec(`
    with fixture_windows as (
      select (now() at time zone 'Europe/Paris')::date + offset_days as day, start_time
      from (values (-1, time '12:00'), (1, time '21:45')) fixture(offset_days, start_time)
    )
    insert into private.global_chat_quiz_rounds (
      paris_day, starts_at, ends_at, collection_season_id, rider_id, age,
      answer_name, answer_key, reverse_answer_key
    )
    select day, (day + start_time) at time zone 'Europe/Paris',
      ((day + start_time) at time zone 'Europe/Paris') + interval '10 minutes',
      '50000000-0000-4000-8000-000000000005', '${target}', 28,
      'Émile D’Arcy', 'emile d''arcy', 'd''arcy emile'
    from fixture_windows;
    insert into public.global_chat_quiz_events (
      id, starts_at, ends_at, portrait_path, status, answer_name, answer_rider_id
    )
    select id, starts_at, ends_at, id::text || '.webp', 'expired', answer_name, rider_id
    from private.global_chat_quiz_rounds where ends_at < now();
  `);
  const legacyEvent = await rows('select * from public.global_chat_quiz_events');
  await runFixture('../supabase/migrations/20261108171000_extend_global_chat_quiz_to_thirty_minutes.sql');
  equal(await rows('select * from public.global_chat_quiz_events'), legacyEvent, 'published ten-minute history is preserved');
  equal(await rows(`
    select extract(epoch from ends_at - starts_at)::integer as duration,
      (starts_at at time zone 'Europe/Paris')::time::text as local_start,
      (ends_at at time zone 'Europe/Paris')::time::text as local_end
    from private.global_chat_quiz_rounds order by paris_day
  `), [
    { duration: 600, local_start: '12:00:00', local_end: '12:10:00' },
    { duration: 1800, local_start: '21:30:00', local_end: '22:00:00' },
  ], 'future unpublished late slot moves earlier and ends at 22:00');
  equal(await rows("select schedule from cron.fixture_jobs where name = 'global-chat-quiz-tick'"),
    [{ schedule: '0,15,30,45 10-21 * * *' }], 'the existing cron runs on all quarter hours, including final CET close');
  await assert.rejects(
    db.exec("update private.global_chat_quiz_rounds set ends_at = starts_at + interval '10 minutes' where ends_at > now()"),
    /global_chat_quiz_rounds_duration_check/
  );
  checks += 1;

  const previousRounds = await rows('select to_jsonb(round) as round from private.global_chat_quiz_rounds round order by paris_day');
  await runFixture('../supabase/migrations/20261109100000_schedule_three_daily_global_chat_quiz_rounds.sql');
  equal(await rows("select to_jsonb(round) - 'daily_slot' as round from private.global_chat_quiz_rounds round order by paris_day"),
    previousRounds, 'three-round migration preserves the original round data');
  equal(await rows('select * from public.global_chat_quiz_events'), legacyEvent, 'three-round migration preserves published results');

  // The scheduling clock is controlled only in this isolated database so the
  // test can exercise morning preparation and late catch-up at any host hour.
  await db.exec(`create function private.quiz_fixture_scheduling_clock() returns timestamptz
    language sql stable as $$select current_setting('quiz_fixture.scheduling_clock')::timestamptz$$`);
  const setScheduleTime = (time) => scalar(`select set_config('quiz_fixture.scheduling_clock',
    (((now() at time zone 'Europe/Paris')::date + $1::time) at time zone 'Europe/Paris')::text, false)`, [time]);
  await setScheduleTime('04:00');
  const prepareDefinition = await scalar("select pg_get_functiondef('public.prepare_global_chat_quiz_round(date)'::regprocedure)");
  await db.exec(prepareDefinition.replaceAll('clock_timestamp()', 'private.quiz_fixture_scheduling_clock()'));

  await db.exec('delete from public.global_chat_quiz_events; delete from private.global_chat_quiz_rounds;');

  equal(await scalar('select enabled from private.global_chat_quiz_settings'), false, 'starts disabled');
  equal(await publicState(), null, 'no public state with switch off');
  equal(await withRole('service_role', null, () => scalar('select public.prepare_global_chat_quiz_round()')), null, 'no preparation with switch off');
  const ordinaryPost = await post(1, exact);
  equal(await scalar('select message from public.global_chat_messages where id = $1', [ordinaryPost]), exact, 'switch off preserves posts');
  equal(await packs(), 0, 'switch off grants nothing');
  equal(await scalar("select count(*)::integer from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'global_chat_quiz_events'"), 1, 'sanitized table published');
  equal(await scalar("select count(*)::integer from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'private'"), 0, 'private inputs excluded from Realtime');
  await assert.rejects(withRole('anon', null, () => scalar('select public.get_global_chat_quiz()')), /permission denied/);
  await assert.rejects(withRole('authenticated', 1, () => rows('select * from private.global_chat_quiz_rounds')), /permission denied/);
  await assert.rejects(withRole('authenticated', 1, () => scalar('select public.prepare_global_chat_quiz_round()')), /permission denied/);
  await assert.rejects(withRole('authenticated', 1, () => scalar('select public.set_global_chat_quiz_enabled(true)')), /permission denied/);
  checks += 4;

  await enable(true);
  const prepare = () => withRole('service_role', null, () => scalar('select public.prepare_global_chat_quiz_round()'));
  await prepare();
  const [schedule] = await rows(`select id, rider_id,
    extract(hour from starts_at at time zone 'Europe/Paris')::integer as hour,
    extract(minute from starts_at at time zone 'Europe/Paris')::integer as minute,
    ((ends_at at time zone 'Europe/Paris')::time <= time '22:00') as before_close,
    extract(epoch from ends_at - starts_at)::integer as duration
    from private.global_chat_quiz_rounds`);
  equal(schedule.rider_id, target, 'filters homonyms and retired riders');
  equal(schedule.hour >= 12 && schedule.hour <= 21 && schedule.minute % 15 === 0, true, 'draw uses daytime Paris slots');
  equal(schedule.before_close, true, 'scheduled round finishes by 22:00 Paris');
  equal(schedule.duration, 1800, 'thirty-minute window');
  await db.exec(`update private.global_chat_quiz_rounds
    set starts_at = now() + interval '10 minutes', ends_at = now() + interval '40 minutes'`);
  const before = await prepare();
  equal(before.id, schedule.id, 'repeated calls retain the original round');
  equal(before.avatarSeed, '123456789012345678', 'bigint seed stays exact in trusted payload');
  equal(before.portraitReady, false, 'fresh portrait must upload first');
  equal(await prepare(), before, 'retry returns identical portrait inputs');
  equal(await publicState(), null, 'future answers and times not exposed');
  const path = `${schedule.id}.webp`;
  const complete = (portrait) => withRole('service_role', null, () => scalar(
    'select public.complete_global_chat_quiz_portrait($1, $2)', [schedule.id, portrait]
  ));
  equal(await complete(path), false, 'missing asset cannot be completed');
  await db.query("insert into storage.objects values ('global-chat-quiz-portraits', $1)", [path]);
  equal(await complete('other.webp'), false, 'unexpected paths cannot be completed');
  equal(await complete(path), true, 'stored asset completes portrait');
  equal(await complete(path), true, 'completing the same asset twice is safe');
  equal(await prepare(), null, 'a ready portrait is skipped when no other riders can be drawn');
  await db.exec('select public.process_global_chat_quiz()');
  equal(await eventCount(), 0, 'ready future round stays private');

  const round = await scalar('select public.quiz_fixture_open_round()');
  await db.exec(`
    update private.global_chat_quiz_rounds
      set starts_at = now() - interval '11 minutes', ends_at = now() + interval '19 minutes';
    update public.global_chat_quiz_events event
      set starts_at = round.starts_at, ends_at = round.ends_at
      from private.global_chat_quiz_rounds round where round.id = event.id;
  `);
  await db.exec('select public.process_global_chat_quiz()');
  equal(await eventCount(), 1, 'lifecycle tick is idempotent');
  const open = await publicState();
  equal(open.id, round, 'current round is public');
  equal(open.status, 'open', 'round is still open after eleven minutes');
  equal(open.answerName, null, 'open answer name withheld');
  equal(open.answerRiderId, null, 'open rider ID withheld');
  equal(open.winnerSportingDirectorId, null, 'no winner before score');
  equal(open.portraitPath, `${round}.webp`, 'opaque portrait key only');
  equal(['avatarSeed', 'avatarProfileKey', 'riderId', 'answerKey'].some(key => key in open), false, 'no private fields in read RPC');

  await post(2, 'Émile');
  await post(3, 'Je pense que c’est Émile D’Arcy');
  await post(60, exact);
  equal(await packs(), 0, 'misses and bots cannot win');
  const edited = await post(4, 'Autre nom');
  await db.query('update public.global_chat_messages set message = $1 where id = $2', [exact, edited]);
  equal(await packs(), 0, 'edits cannot win');

  for (const [number, column, assignment] of [
    [5, 'source_race_edition_id', 'gen_random_uuid()'],
    [6, 'image_path', "'test.webp'"],
    [7, 'gif_attachment', "'{}'::jsonb"],
  ]) {
    await setUser(number);
    await db.exec('begin');
    const caption = await scalar('select (public.post_global_chat_message($1)).id', [exact]);
    await db.query(`update public.global_chat_messages set ${column} = ${assignment} where id = $1`, [caption]);
    await db.exec('commit');
    equal(await packs(), 0, `deferred scoring ignores ${column}`);
  }

  await db.exec("update public.cyclo_stickers_editions set configuration = '{\"enabled\":false,\"publicApproved\":true}'");
  await post(8, exact);
  equal(await packs(), 0, 'disabling the album mid-round prevents an unpaid win');
  equal((await publicState()).status, 'open', 'no phantom winner from a disabled album');
  await db.exec("update public.cyclo_stickers_editions set configuration = '{\"enabled\":true,\"publicApproved\":true}'");
  await db.exec("alter table public.cyclo_stickers_boosters add constraint fixture_reject_quiz check (acquisition_source <> 'global_chat_quiz')");
  const failed = await post(9, exact);
  equal(await scalar('select message from public.global_chat_messages where id = $1', [failed]), exact, 'failed reward cannot roll back chat');
  equal(await packs(), 0, 'failed reward creates no partial prize');
  equal((await publicState()).status, 'open', 'failed reward creates no phantom winner');
  await db.exec('alter table public.cyclo_stickers_boosters drop constraint fixture_reject_quiz');

  const winningMessage = await post(10, "  D'ARCY    Emile ");
  const win = await publicState();
  equal(win.status, 'won', 'correct full name wins regardless of case, spacing, accents or word order');
  equal(win.winningMessageId, winningMessage, 'winning chat message reference');
  equal(win.winnerUsername, 'ds10', 'canonical real mention');
  equal(win.winnerSportingDirectorId, account(1, 10), 'canonical DS link ID');
  equal(win.answerName, exact, 'winning event reveals the correct name');
  equal(win.answerRiderId, target, 'winning event reveals the rider ID');
  await post(11, exact);
  equal(await packs(), 1, 'subsequent correct answer remains visible without duplicate reward');
  equal(await scalar("select opened_at is null from public.cyclo_stickers_boosters where acquisition_source = 'global_chat_quiz'"), true, 'booster is unopened');

  await db.exec('select public.quiz_fixture_open_round()');
  await db.exec(`
    update private.global_chat_quiz_rounds
      set starts_at = now() - interval '30 minutes 1 second', ends_at = now() - interval '1 second';
    update public.global_chat_quiz_events event
      set starts_at = round.starts_at, ends_at = round.ends_at
      from private.global_chat_quiz_rounds round where round.id = event.id;
  `);
  await post(12, exact);
  equal(await packs(), 1, 'late posts are ordinary chat even before closing tick');
  await db.exec('select public.process_global_chat_quiz()');
  equal((await publicState()).status, 'expired', 'expiry tick closes no-winner round');
  equal((await publicState()).answerRiderId, target, 'expiry reveals the rider');
  equal((await publicState()).winnerSportingDirectorId, null, 'expiry does not declare a winner');
  await db.exec('select public.quiz_fixture_open_round()');
  await enable(false);
  equal(await publicState(), null, 'kill switch stops getter immediately');
  equal(await scalar('select status from public.global_chat_quiz_events'), 'expired', 'kill switch closes active round');

  await db.exec(`
    delete from public.global_chat_quiz_events;
    delete from private.global_chat_quiz_rounds;
    update public.seasons set status = 'completed' where game_year = 5;
    insert into public.seasons values ('50000000-0000-4000-8000-000000000006', 6, 'active');
    insert into public.rider_season_ratings values (
      '${target}', '50000000-0000-4000-8000-000000000006', 29
    );
  `);
  await enable(true);
  await prepare();
  const [rolloverRound] = await rows('select id, age, collection_season_id from private.global_chat_quiz_rounds');
  equal(rolloverRound.age, 29, 'post-rollover selection uses current rider ratings');
  equal(rolloverRound.collection_season_id, '50000000-0000-4000-8000-000000000005', 'retains the latest published album after its collection season');
  await db.exec(`update private.global_chat_quiz_rounds
    set starts_at = now() - interval '1 minute', ends_at = now() + interval '29 minutes',
        portrait_ready = true;
    select public.process_global_chat_quiz();`);
  await post(13, exact);
  equal((await publicState()).status, 'won', 'published album can reward a subsequent season');
  equal(await scalar("select collection_season_id from public.cyclo_stickers_boosters where source_reference = $1", [rolloverRound.id]), rolloverRound.collection_season_id, 'rollover reward lands in the matching album inventory');

  await db.exec(`
    delete from public.global_chat_quiz_events;
    delete from private.global_chat_quiz_rounds;
    insert into public.riders values
      ('${account(4, 5)}', 'Lise', 'Marin', 'active', 'france', 5),
      ('${account(4, 6)}', 'Victor', 'Garnier', 'active', 'france', 6);
    insert into public.rider_contracts
    select id, '${account(3, 1)}', 'active' from public.riders where id in ('${account(4, 5)}', '${account(4, 6)}');
    insert into public.rider_season_ratings
    select id, '50000000-0000-4000-8000-000000000006', 24 from public.riders where id in ('${account(4, 5)}', '${account(4, 6)}');
  `);

  const first = await prepare();
  const dailyRounds = await rows(`select id, rider_id, daily_slot, answer_name,
    extract(epoch from ends_at - starts_at)::int as duration,
    extract(minute from starts_at at time zone 'Europe/Paris')::int as local_minute,
    ((starts_at at time zone 'Europe/Paris')::time >= (array[time '12:00', time '15:00', time '18:00'])[daily_slot]
      and (ends_at at time zone 'Europe/Paris')::time <= (array[time '15:00', time '18:00', time '22:00'])[daily_slot]) as fits_window,
    coalesce(lag(ends_at) over (order by starts_at) <= starts_at, true) as separated
    from private.global_chat_quiz_rounds order by starts_at`);
  equal(dailyRounds.map(row => row.daily_slot), [1, 2, 3], 'one round in each of the three local windows');
  equal(dailyRounds.every(row => row.duration === 1800 && row.local_minute % 15 === 0 && row.fits_window && row.separated),
    true, 'all three starts are aligned, last thirty minutes, and never overlap');
  equal(new Set(dailyRounds.map(row => row.rider_id)).size, 3, 'three distinct riders on the same day');
  equal(first.id, dailyRounds[0].id, 'prepares the earliest portrait first');
  equal(await prepare(), first, 'a preparation retry retains the same round');
  equal(await eventCount(), 0, 'preparing three portraits exposes no future round');

  await db.exec(`update private.global_chat_quiz_rounds set
    starts_at = now() + (daily_slot * interval '1 hour'),
    ends_at = now() + (daily_slot * interval '1 hour') + interval '30 minutes'`);
  for (const scheduled of dailyRounds) {
    equal((await prepare()).id, scheduled.id, 'scalar preparation advances to the next unready round');
    const portrait = `${scheduled.id}.webp`;
    await db.query("insert into storage.objects values ('global-chat-quiz-portraits', $1)", [portrait]);
    equal(await withRole('service_role', null, () => scalar(
      'select public.complete_global_chat_quiz_portrait($1, $2)', [scheduled.id, portrait]
    )), true, 'each round completes its own immutable portrait');
  }
  equal(await prepare(), null, 'all three ready portraits stop preparation');
  equal(await scalar('select count(*)::int from private.global_chat_quiz_rounds'), 3, 'retries do not add a fourth round');

  const packsBeforeDailyRounds = await packs();
  for (const scheduled of dailyRounds) {
    await db.query(`update private.global_chat_quiz_rounds
      set starts_at = now() - interval '1 minute', ends_at = now() + interval '29 minutes' where id = $1`, [scheduled.id]);
    await db.exec('select public.process_global_chat_quiz()');
    equal(await scalar("select count(*)::int from public.global_chat_quiz_events where status = 'open'"), 1,
      'only one round is open at a time');
    const message = await post(14, scheduled.answer_name);
    equal(await scalar('select status from public.global_chat_quiz_events where id = $1', [scheduled.id]), 'won',
      'the winner is recorded independently for each round');
    await db.query("update public.global_chat_messages set created_at = now() - interval '3 minutes' where id = $1", [message]);
  }
  equal(await packs(), packsBeforeDailyRounds + 3, 'one booster per round for the same winner on the same day');

  await db.exec(`
    delete from public.global_chat_quiz_events;
    delete from private.global_chat_quiz_rounds;
    with today as (select (now() at time zone 'Europe/Paris')::date as day)
    insert into private.global_chat_quiz_rounds (
      paris_day, starts_at, ends_at, collection_season_id, rider_id, age,
      answer_name, answer_key, reverse_answer_key, portrait_ready
    )
    select day, (day + time '14:45') at time zone 'Europe/Paris',
      (day + time '15:15') at time zone 'Europe/Paris',
      '50000000-0000-4000-8000-000000000005', '${target}', 29,
      'Émile D’Arcy', 'emile d''arcy', 'd''arcy emile', true from today;
  `);
  const legacyToday = await rows('select to_jsonb(round) as round from private.global_chat_quiz_rounds round');
  const afternoon = await prepare();
  equal(await rows('select to_jsonb(round) as round from private.global_chat_quiz_rounds round where daily_slot is null'), legacyToday,
    'the previously prepared legacy portrait and times remain intact');
  equal(await rows('select daily_slot from private.global_chat_quiz_rounds order by starts_at'),
    [{ daily_slot: null }, { daily_slot: 2 }, { daily_slot: 3 }], 'legacy round takes the first slot and is counted in the daily total');
  equal(await scalar(`select starts_at >= ((paris_day + time '15:15') at time zone 'Europe/Paris')
    from private.global_chat_quiz_rounds where id = $1`, [afternoon.id]), true,
    'the next window skips times overlapping the legacy round');

  await db.exec('delete from private.global_chat_quiz_rounds');
  await setScheduleTime('16:00');
  await prepare();
  equal(await rows('select daily_slot from private.global_chat_quiz_rounds order by starts_at'),
    [{ daily_slot: 2 }, { daily_slot: 3 }], 'late preparation skips the past window');
  equal(await scalar('select bool_and(starts_at > private.quiz_fixture_scheduling_clock()) from private.global_chat_quiz_rounds'),
    true, 'late preparation draws future times only');

  console.log(JSON.stringify({ isolatedPostgresChecks: checks, productionAccess: false }));
} finally {
  await db.close();
}
