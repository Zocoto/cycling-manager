// Called only by the isolated PGlite suite. Never run production fixtures.
import { readFile } from 'node:fs/promises';
export async function verifyHalloweenMobileReplays(db, { id, action, check, fail, q, scalar, wallet }) {
  await db.exec('begin');
  const verifyRejection = fail;
  fail = async (fn, match) => {
    await db.exec('savepoint expected_failure');
    try { await verifyRejection(fn, match); }
    finally { await db.exec('rollback to savepoint expected_failure; release savepoint expected_failure'); }
  };
  try {
    await db.exec("update halloween_runs set started_at=now()-interval '1 minute'");
    const cutoff = await scalar("select now()-interval '30 seconds' as value");
    const boundary = await action('start', {}, id(7));
    await q('update halloween_runs set started_at=$1 where id=$2', [cutoff, boundary.id]);
    // One resumable and one expired old session; neither must block restoration.
    await q("update halloween_runs set status='running',expires_at=now()+interval '1 hour' where user_id=$1", [id(3)]);
    await q("update halloween_runs set status='running',expires_at=now()-interval '1 minute' where user_id=$1", [id(4)]);
    await q('update halloween_runs set day=day-1 where user_id=$1', [id(5)]);
    const oldRuns = await q('select * from halloween_runs order by id');
    const oldWallets = await q('select * from halloween_wallets order by user_id');
    const oldLedger = await q('select * from halloween_ledger order by user_id,source');
    const grant = () => scalar('select grant_halloween_mobile_replays($1::timestamptz) as value', [cutoff]);
    await fail(() => scalar("select grant_halloween_mobile_replays(now()+interval '1 minute') as value"), /Date de correction invalide/);
    const operation = await readFile(new URL('../supabase/operations/grant_halloween_mobile_replays.sql', import.meta.url), 'utf8');
    const audited = operation.replace('__HALLOWEEN_UI_CUTOFF__', "'" + new Date(cutoff).toISOString() + "'")
      .replace(/^begin;\s*/i, '').replace(/commit;\s*$/i, '');
    await db.exec(audited);
    const awarded = await scalar("select current_setting('cyclostratege.mobile_replay_receipt')::jsonb as value");
    check(awarded.scoresPreserved, true); check(awarded.gainsAndTicketsPreserved, true);
    check(awarded.added, 6); check(awarded.total, 6);
    check(await q('select * from halloween_runs order by id'), oldRuns);
    check(await q('select * from halloween_wallets order by user_id'), oldWallets);
    check(await q('select * from halloween_ledger order by user_id,source'), oldLedger);
    // Retry with a later cutoff must not award new users or refresh used grants.
    check((await scalar('select grant_halloween_mobile_replays() as value')).added, 0);
    check((await scalar('select grant_halloween_mobile_replays() as value')).cutoff, awarded.cutoff);
    await db.exec(`set role authenticated;select set_config('test.user','${id(1)}',false)`);
    const visible = await scalar('select get_current_halloween_state() as value');
    check(visible.replayAvailable, true); check(visible.attempts, 2);
    await fail(() => grant(), /permission denied/);
    await fail(() => q("insert into halloween_mobile_replays(edition_id,user_id) values('halloween-2026',$1)", [id(7)]), /permission denied/);
    await db.exec('reset role');
    const finish = (run, user) => action('finish', { runId: run.id, distance: 100, coins: 2, score: 150, proof: {} }, user);
    // Player 1 already used both daily slots: the restored attempt is still free.
    const before = await wallet();
    const restored = await action('start');
    check((await q('select attempt from halloween_runs where id=$1', [restored.id]))[0].attempt, 3);
    check((await wallet()).tickets, before.tickets);
    check((await wallet()).coins, before.coins);
    check((await action('start')).id, restored.id);
    check(await scalar('select used_run_id as value from halloween_mobile_replays where user_id=$1', [id(1)]), restored.id);
    await finish(restored, id(1));
    check((await wallet()).coins, before.coins + 2);
    await finish(restored, id(1)); check((await wallet()).coins, before.coins + 2);
    await fail(() => action('start'), /essai quotidien/);
    const historical = oldRuns.filter(run => [id(1), id(2), id(6)].includes(run.user_id));
    check(await q('select * from halloween_runs where id=any($1::uuid[]) order by id', [historical.map(run => run.id)]), historical);
    check((await grant()).added, 0);
    await fail(() => action('start'), /essai quotidien/);
    await db.exec(`set role authenticated;select set_config('test.user','${id(1)}',false)`);
    const consumed = await scalar('select get_current_halloween_state() as value');
    check(consumed.replayAvailable, false); check(consumed.attempts, 2);
    await db.exec('reset role');
    // Restoration comes before a paid ticket and leaves that normal slot intact.
    await q('update halloween_wallets set tickets=1 where user_id=$1', [id(2)]);
    const free = await action('start', {}, id(2));
    check((await wallet(id(2))).tickets, 1);
    await finish(free, id(2));
    const paid = await action('start', {}, id(2));
    check((await wallet(id(2))).tickets, 0);
    check(await scalar('select attempt as value from halloween_runs where id=$1', [paid.id]), 2);
    await finish(paid, id(2)); await fail(() => action('start', {}, id(2)), /essai quotidien/);
    // Resuming an existing run does not use the new entitlement.
    const active = oldRuns.find(run => run.user_id === id(3));
    check((await action('start', {}, id(3))).id, active.id);
    check(await scalar('select used_run_id as value from halloween_mobile_replays where user_id=$1', [id(3)]), null);
    await finish(active, id(3));
    const afterActive = await action('start', {}, id(3));
    check(await scalar('select attempt as value from halloween_runs where id=$1', [afterActive.id]), 3);
    // An expired session remains in history, but cannot eat the restored attempt.
    const afterExpiry = await action('start', {}, id(4));
    check(await scalar('select attempt as value from halloween_runs where id=$1', [afterExpiry.id]), 3);
    check(await scalar('select count(*)::integer as value from halloween_runs where user_id=$1', [id(4)]), 2);
    // Unused restoration carries over: the next day's daily free run comes first.
    const nextDay = await action('start', {}, id(5));
    check(await scalar('select attempt as value from halloween_runs where id=$1', [nextDay.id]), 1);
    check(await scalar('select used_run_id as value from halloween_mobile_replays where user_id=$1', [id(5)]), null);
    await finish(nextDay, id(5));
    const carried = await action('start', {}, id(5));
    check(await scalar('select attempt as value from halloween_runs where id=$1', [carried.id]), 3);
    // Exact cutoff and later players are excluded; no additional daily play for them.
    await finish(boundary, id(7)); await fail(() => action('start', {}, id(7)), /essai quotidien/);
    const later = await action('start', {}, id(8));
    await finish(later, id(8)); await fail(() => action('start', {}, id(8)), /essai quotidien/);
    check((await scalar('select grant_halloween_mobile_replays() as value')).total, 6);
    check(await scalar('select count(*)::integer as value from halloween_mobile_replays where user_id in($1,$2)', [id(7), id(8)]), 0);
    await db.exec("update halloween_editions set enabled=false");
    await fail(() => action('start', {}, id(6)), /pas ouvert/);
    await db.exec("update halloween_editions set enabled=true,ends_at=now()-interval '1 second'");
    await fail(() => action('start', {}, id(6)), /terminés/);
    await fail(() => grant(), /doivent être ouverts/);
  } finally {
    // Rollback is safe here: this is the local, credential-free PGlite instance.
    await db.exec('rollback; reset role');
  }
}
