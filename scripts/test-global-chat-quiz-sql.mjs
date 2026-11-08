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
    extract(epoch from ends_at - starts_at)::integer as duration
    from private.global_chat_quiz_rounds`);
  equal(schedule.rider_id, target, 'filters homonyms and retired riders');
  equal(schedule.hour >= 12 && schedule.hour <= 21 && schedule.minute % 15 === 0, true, 'draw uses daytime Paris slots');
  equal(schedule.duration, 600, 'ten-minute window');
  await db.exec(`update private.global_chat_quiz_rounds
    set starts_at = now() + interval '10 minutes', ends_at = now() + interval '20 minutes'`);
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
  equal((await prepare()).portraitReady, true, 'retry can skip image rendering');
  await db.exec('select public.process_global_chat_quiz()');
  equal(await eventCount(), 0, 'ready future round stays private');

  const round = await scalar('select public.quiz_fixture_open_round()');
  await db.exec('select public.process_global_chat_quiz()');
  equal(await eventCount(), 1, 'lifecycle tick is idempotent');
  const open = await publicState();
  equal(open.id, round, 'current round is public');
  equal(open.status, 'open', 'round is open');
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
  await db.exec("update public.global_chat_quiz_events set ends_at = clock_timestamp() - interval '1 second'");
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
    set starts_at = now() - interval '1 minute', ends_at = now() + interval '9 minutes',
        portrait_ready = true;
    select public.process_global_chat_quiz();`);
  await post(13, exact);
  equal((await publicState()).status, 'won', 'published album can reward a subsequent season');
  equal(await scalar("select collection_season_id from public.cyclo_stickers_boosters where source_reference = $1", [rolloverRound.id]), rolloverRound.collection_season_id, 'rollover reward lands in the matching album inventory');

  console.log(JSON.stringify({ isolatedPostgresChecks: checks, productionAccess: false }));
} finally {
  await db.close();
}
